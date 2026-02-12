import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";
import { requirePermission, getOrgFromProject, getContextFromDomain } from "./permissions";

// =================================================================
// Helper Functions (internal use)
// =================================================================

/**
 * Get full hierarchy for a domain: domain → project → team → org
 */
export async function getDomainHierarchy(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">
): Promise<{
  domain: Doc<"domains">;
  project: Doc<"projects">;
  team: Doc<"teams">;
  organization: Doc<"organizations">;
} | null> {
  const domain = await ctx.db.get(domainId);
  if (!domain) return null;

  const project = await ctx.db.get(domain.projectId);
  if (!project) return null;

  const team = await ctx.db.get(project.teamId);
  if (!team) return null;

  const organization = await ctx.db.get(team.organizationId);
  if (!organization) return null;

  return { domain, project, team, organization };
}

/**
 * Resolve effective keyword limit for a domain
 * Priority: domain → project → organization (first defined wins)
 */
export function resolveKeywordLimit(
  domain: Doc<"domains">,
  project: Doc<"projects">,
  organization: Doc<"organizations">
): number | null {
  // Domain-level limit takes precedence
  if (domain.limits?.maxKeywords !== undefined) {
    return domain.limits.maxKeywords;
  }

  // Project-level default per domain
  if (project.limits?.maxKeywordsPerDomain !== undefined) {
    return project.limits.maxKeywordsPerDomain;
  }

  // Organization-level default per domain
  if (organization.limits?.maxKeywordsPerDomain !== undefined) {
    return organization.limits.maxKeywordsPerDomain;
  }

  // No limit set
  return null;
}

/**
 * Count active keywords in a domain
 */
export async function countDomainKeywords(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">
): Promise<number> {
  const keywords = await ctx.db
    .query("keywords")
    .withIndex("by_domain", (q) => q.eq("domainId", domainId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();
  return keywords.length;
}

/**
 * Count all keywords in a project (across all domains)
 */
export async function countProjectKeywords(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<number> {
  const domains = await ctx.db
    .query("domains")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  let total = 0;
  for (const domain of domains) {
    total += await countDomainKeywords(ctx, domain._id);
  }
  return total;
}

/**
 * Count all keywords in an organization (across all projects)
 */
export async function countOrgKeywords(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<number> {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  let total = 0;
  for (const team of teams) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    for (const project of projects) {
      total += await countProjectKeywords(ctx, project._id);
    }
  }
  return total;
}

/**
 * Count domains in a project
 */
export async function countProjectDomains(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<number> {
  const domains = await ctx.db
    .query("domains")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  return domains.length;
}

/**
 * Count all domains in an organization
 */
export async function countOrgDomains(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<number> {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  let total = 0;
  for (const team of teams) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    for (const project of projects) {
      total += await countProjectDomains(ctx, project._id);
    }
  }
  return total;
}

/**
 * Count projects in an organization
 */
export async function countOrgProjects(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<number> {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  let total = 0;
  for (const team of teams) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    total += projects.length;
  }
  return total;
}

// =================================================================
// Check Limit Function (for use in mutations)
// =================================================================

export interface LimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  remaining: number | null;
  source: "domain" | "project" | "organization" | null;
  message?: string;
}

/**
 * Check if adding keywords is allowed for a domain
 * Returns detailed result with limit source and remaining capacity
 */
export async function checkKeywordLimit(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">,
  countToAdd: number = 1
): Promise<LimitCheckResult> {
  const hierarchy = await getDomainHierarchy(ctx, domainId);
  if (!hierarchy) {
    return {
      allowed: false,
      currentCount: 0,
      limit: null,
      remaining: null,
      source: null,
      message: "Domain not found",
    };
  }

  const { domain, project, organization } = hierarchy;
  const currentCount = await countDomainKeywords(ctx, domainId);

  // Determine limit and source
  let limit: number | null = null;
  let source: "domain" | "project" | "organization" | null = null;

  if (domain.limits?.maxKeywords !== undefined) {
    limit = domain.limits.maxKeywords;
    source = "domain";
  } else if (project.limits?.maxKeywordsPerDomain !== undefined) {
    limit = project.limits.maxKeywordsPerDomain;
    source = "project";
  } else if (organization.limits?.maxKeywordsPerDomain !== undefined) {
    limit = organization.limits.maxKeywordsPerDomain;
    source = "organization";
  }

  // No limit set
  if (limit === null) {
    return {
      allowed: true,
      currentCount,
      limit: null,
      remaining: null,
      source: null,
    };
  }

  const remaining = limit - currentCount;
  const allowed = currentCount + countToAdd <= limit;

  return {
    allowed,
    currentCount,
    limit,
    remaining: Math.max(0, remaining),
    source,
    message: allowed
      ? undefined
      : `Limit ${limit} keywords (${source}). Currently: ${currentCount}, trying to add: ${countToAdd}, can add: ${remaining}`,
  };
}

// =================================================================
// Queries
// =================================================================

/**
 * Get usage statistics for the current organization
 */
export const getUsageStats = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    // Check membership
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    if (!membership) return null;

    const totalKeywords = await countOrgKeywords(ctx, args.organizationId);
    const totalDomains = await countOrgDomains(ctx, args.organizationId);
    const totalProjects = await countOrgProjects(ctx, args.organizationId);

    return {
      keywords: {
        current: totalKeywords,
        limit: org.limits?.maxKeywords ?? null,
      },
      domains: {
        current: totalDomains,
        limit: org.limits?.maxDomains ?? null,
      },
      projects: {
        current: totalProjects,
        limit: org.limits?.maxProjects ?? null,
      },
      defaults: {
        maxDomainsPerProject: org.limits?.maxDomainsPerProject ?? null,
        maxKeywordsPerDomain: org.limits?.maxKeywordsPerDomain ?? null,
      },
    };
  },
});

/**
 * Check if keywords can be added to a domain (for UI feedback)
 */
export const checkAddKeywordsLimit = query({
  args: {
    domainId: v.id("domains"),
    countToAdd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await checkKeywordLimit(ctx, args.domainId, args.countToAdd ?? 1);
  },
});

/**
 * Get limits for a specific domain (resolved from hierarchy)
 */
export const getDomainLimits = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const hierarchy = await getDomainHierarchy(ctx, args.domainId);
    if (!hierarchy) return null;

    const { domain, project, organization } = hierarchy;
    const currentCount = await countDomainKeywords(ctx, args.domainId);

    const limit = resolveKeywordLimit(domain, project, organization);

    let source: "domain" | "project" | "organization" | null = null;
    if (domain.limits?.maxKeywords !== undefined) source = "domain";
    else if (project.limits?.maxKeywordsPerDomain !== undefined) source = "project";
    else if (organization.limits?.maxKeywordsPerDomain !== undefined) source = "organization";

    return {
      currentCount,
      limit,
      remaining: limit !== null ? Math.max(0, limit - currentCount) : null,
      source,
      domainLimit: domain.limits?.maxKeywords ?? null,
      projectDefault: project.limits?.maxKeywordsPerDomain ?? null,
      orgDefault: organization.limits?.maxKeywordsPerDomain ?? null,
    };
  },
});

// =================================================================
// Refresh Rate Limiting
// =================================================================

/**
 * Check cooldown between manual refreshes for a domain.
 * Looks at the most recent keywordCheckJob and keywordSerpJob for the domain.
 * Throws if within cooldown window. Skips if cooldown is 0 or undefined.
 */
export async function checkRefreshCooldown(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">,
  cooldownMinutes: number | undefined
): Promise<void> {
  if (!cooldownMinutes || cooldownMinutes <= 0) return;

  const cooldownMs = cooldownMinutes * 60 * 1000;
  const now = Date.now();

  // Check most recent keywordCheckJob for this domain
  const lastCheckJob = await ctx.db
    .query("keywordCheckJobs")
    .withIndex("by_domain", (q) => q.eq("domainId", domainId))
    .order("desc")
    .first();

  if (lastCheckJob && (now - lastCheckJob.createdAt) < cooldownMs) {
    const waitMinutes = Math.ceil((cooldownMs - (now - lastCheckJob.createdAt)) / 60000);
    throw new Error(`Please wait ${waitMinutes} min before refreshing this domain again`);
  }

  // Check most recent keywordSerpJob for this domain
  const lastSerpJob = await ctx.db
    .query("keywordSerpJobs")
    .withIndex("by_domain", (q) => q.eq("domainId", domainId))
    .order("desc")
    .first();

  if (lastSerpJob && (now - lastSerpJob.createdAt) < cooldownMs) {
    const waitMinutes = Math.ceil((cooldownMs - (now - lastSerpJob.createdAt)) / 60000);
    throw new Error(`Please wait ${waitMinutes} min before refreshing this domain again`);
  }
}

/**
 * Get start of today in UTC (midnight timestamp).
 */
function getTodayStartUtc(): number {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
}

/**
 * Count jobs created today for a set of domain IDs.
 */
async function countJobsTodayForDomains(
  ctx: QueryCtx | MutationCtx,
  domainIds: Id<"domains">[],
  todayStart: number,
  filterUserId?: Id<"users">
): Promise<number> {
  let total = 0;
  for (const domainId of domainIds) {
    const checkJobs = await ctx.db
      .query("keywordCheckJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .order("desc")
      .collect();
    total += checkJobs.filter((j) =>
      j.createdAt >= todayStart && (!filterUserId || j.createdBy === filterUserId)
    ).length;

    const serpJobs = await ctx.db
      .query("keywordSerpJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .order("desc")
      .collect();
    total += serpJobs.filter((j) =>
      j.createdAt >= todayStart && (!filterUserId || j.createdBy === filterUserId)
    ).length;
  }
  return total;
}

/**
 * Get all domain IDs within an organization.
 */
async function getOrgDomainIds(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<Id<"domains">[]> {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const domainIds: Id<"domains">[] = [];
  for (const team of teams) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    for (const project of projects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      for (const domain of domains) {
        domainIds.push(domain._id);
      }
    }
  }
  return domainIds;
}

/**
 * Get all domain IDs within a project.
 */
async function getProjectDomainIds(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<Id<"domains">[]> {
  const domains = await ctx.db
    .query("domains")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  return domains.map((d) => d._id);
}

/**
 * Check daily refresh quota for the organization.
 * Counts keywordCheckJobs + keywordSerpJobs created today across all org domains.
 * Throws if over limit. Skips if limit is 0 or undefined.
 */
export async function checkDailyRefreshQuota(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  maxDaily: number | undefined
): Promise<void> {
  if (!maxDaily || maxDaily <= 0) return;

  const todayStart = getTodayStartUtc();
  const domainIds = await getOrgDomainIds(ctx, organizationId);
  const totalJobsToday = await countJobsTodayForDomains(ctx, domainIds, todayStart);

  if (totalJobsToday >= maxDaily) {
    throw new Error(`Daily refresh limit reached (${maxDaily}/${maxDaily})`);
  }
}

/**
 * Check per-user daily refresh quota across the organization.
 * Counts jobs created by this specific user today.
 */
export async function checkPerUserDailyQuota(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  maxDailyPerUser: number | undefined
): Promise<void> {
  if (!maxDailyPerUser || maxDailyPerUser <= 0) return;

  const todayStart = getTodayStartUtc();
  const domainIds = await getOrgDomainIds(ctx, organizationId);
  const userJobsToday = await countJobsTodayForDomains(ctx, domainIds, todayStart, userId);

  if (userJobsToday >= maxDailyPerUser) {
    throw new Error(`Your daily refresh limit reached (${userJobsToday}/${maxDailyPerUser})`);
  }
}

/**
 * Check per-project daily refresh quota.
 * Counts jobs across all domains in the project created today.
 */
export async function checkProjectDailyQuota(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">
): Promise<void> {
  const maxDaily = project.limits?.maxDailyRefreshes;
  if (!maxDaily || maxDaily <= 0) return;

  const todayStart = getTodayStartUtc();
  const domainIds = await getProjectDomainIds(ctx, project._id);
  const totalJobsToday = await countJobsTodayForDomains(ctx, domainIds, todayStart);

  if (totalJobsToday >= maxDaily) {
    throw new Error(`Project daily refresh limit reached (${totalJobsToday}/${maxDaily})`);
  }
}

/**
 * Check per-domain daily refresh quota.
 * Counts jobs for this single domain created today.
 */
export async function checkDomainDailyQuota(
  ctx: QueryCtx | MutationCtx,
  domain: Doc<"domains">
): Promise<void> {
  const maxDaily = domain.limits?.maxDailyRefreshes;
  if (!maxDaily || maxDaily <= 0) return;

  const todayStart = getTodayStartUtc();
  const totalJobsToday = await countJobsTodayForDomains(ctx, [domain._id], todayStart);

  if (totalJobsToday >= maxDaily) {
    throw new Error(`Domain daily refresh limit reached (${totalJobsToday}/${maxDaily})`);
  }
}

/**
 * Check bulk action keyword cap.
 * Throws if keywordCount exceeds org maxKeywordsPerBulkRefresh. Skips if 0 or undefined.
 */
export function checkBulkActionCap(
  maxKeywordsPerBulk: number | undefined,
  keywordCount: number
): void {
  if (!maxKeywordsPerBulk || maxKeywordsPerBulk <= 0) return;
  if (keywordCount > maxKeywordsPerBulk) {
    throw new Error(`Maximum ${maxKeywordsPerBulk} keywords per bulk action (${keywordCount} selected)`);
  }
}

/**
 * Run all refresh limit checks for a domain.
 * Checks: bulk cap, cooldown, org daily quota, per-user daily quota, project daily quota, domain daily quota.
 */
export async function checkRefreshLimits(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">,
  userId?: Id<"users"> | null,
  keywordCount?: number
): Promise<void> {
  const hierarchy = await getDomainHierarchy(ctx, domainId);
  if (!hierarchy) return;

  const orgLimits = hierarchy.organization.limits;

  // 0. Bulk action keyword cap
  if (keywordCount !== undefined) {
    checkBulkActionCap(orgLimits?.maxKeywordsPerBulkRefresh, keywordCount);
  }

  // 1. Cooldown between refreshes per domain
  await checkRefreshCooldown(ctx, domainId, orgLimits?.refreshCooldownMinutes);

  // 2. Org-wide daily quota
  await checkDailyRefreshQuota(ctx, hierarchy.organization._id, orgLimits?.maxDailyRefreshes);

  // 3. Per-user daily quota
  if (userId && orgLimits?.maxDailyRefreshesPerUser) {
    await checkPerUserDailyQuota(ctx, hierarchy.organization._id, userId, orgLimits.maxDailyRefreshesPerUser);
  }

  // 4. Per-project daily quota
  await checkProjectDailyQuota(ctx, hierarchy.project);

  // 5. Per-domain daily quota
  await checkDomainDailyQuota(ctx, hierarchy.domain);
}

// =================================================================
// Queries (for UI status display)
// =================================================================

/**
 * Get the full refresh limit status for a domain.
 * Returns current usage vs limits at every level, without throwing.
 * Used by the RefreshConfirmModal to show limit info before user confirms.
 */
export const getRefreshLimitStatus = query({
  args: {
    domainId: v.id("domains"),
    keywordCount: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, keywordCount }) => {
    const userId = await auth.getUserId(ctx);
    const hierarchy = await getDomainHierarchy(ctx, domainId);
    if (!hierarchy) {
      return { cooldown: null, orgDaily: null, userDaily: null, projectDaily: null, domainDaily: null, canRefresh: false };
    }

    const orgLimits = hierarchy.organization.limits;
    const now = Date.now();
    const todayStart = getTodayStartUtc();

    // 1. Cooldown
    let cooldown: { minutes: number | null; lastRefreshAt: number | null; canRefreshAt: number | null; blocked: boolean } | null = null;
    const cooldownMinutes = orgLimits?.refreshCooldownMinutes;
    if (cooldownMinutes && cooldownMinutes > 0) {
      const cooldownMs = cooldownMinutes * 60 * 1000;
      let lastRefreshAt: number | null = null;

      const lastCheckJob = await ctx.db
        .query("keywordCheckJobs")
        .withIndex("by_domain", (q) => q.eq("domainId", domainId))
        .order("desc")
        .first();
      if (lastCheckJob) lastRefreshAt = lastCheckJob.createdAt;

      const lastSerpJob = await ctx.db
        .query("keywordSerpJobs")
        .withIndex("by_domain", (q) => q.eq("domainId", domainId))
        .order("desc")
        .first();
      if (lastSerpJob && (lastRefreshAt === null || lastSerpJob.createdAt > lastRefreshAt)) {
        lastRefreshAt = lastSerpJob.createdAt;
      }

      const canRefreshAt = lastRefreshAt ? lastRefreshAt + cooldownMs : null;
      cooldown = {
        minutes: cooldownMinutes,
        lastRefreshAt,
        canRefreshAt,
        blocked: canRefreshAt !== null && now < canRefreshAt,
      };
    }

    // 2. Org daily
    let orgDaily: { limit: number | null; used: number; blocked: boolean } | null = null;
    const orgMax = orgLimits?.maxDailyRefreshes;
    if (orgMax && orgMax > 0) {
      const orgDomainIds = await getOrgDomainIds(ctx, hierarchy.organization._id);
      const used = await countJobsTodayForDomains(ctx, orgDomainIds, todayStart);
      orgDaily = { limit: orgMax, used, blocked: used >= orgMax };
    }

    // 3. Per-user daily
    let userDaily: { limit: number | null; used: number; blocked: boolean } | null = null;
    const userMax = orgLimits?.maxDailyRefreshesPerUser;
    if (userMax && userMax > 0 && userId) {
      const orgDomainIds = orgDaily ? undefined : await getOrgDomainIds(ctx, hierarchy.organization._id);
      const allOrgDomainIds = orgDomainIds ?? await getOrgDomainIds(ctx, hierarchy.organization._id);
      const used = await countJobsTodayForDomains(ctx, allOrgDomainIds, todayStart, userId);
      userDaily = { limit: userMax, used, blocked: used >= userMax };
    }

    // 4. Project daily
    let projectDaily: { limit: number | null; used: number; blocked: boolean } | null = null;
    const projMax = hierarchy.project.limits?.maxDailyRefreshes;
    if (projMax && projMax > 0) {
      const projDomainIds = await getProjectDomainIds(ctx, hierarchy.project._id);
      const used = await countJobsTodayForDomains(ctx, projDomainIds, todayStart);
      projectDaily = { limit: projMax, used, blocked: used >= projMax };
    }

    // 5. Domain daily
    let domainDaily: { limit: number | null; used: number; blocked: boolean } | null = null;
    const domMax = hierarchy.domain.limits?.maxDailyRefreshes;
    if (domMax && domMax > 0) {
      const used = await countJobsTodayForDomains(ctx, [domainId], todayStart);
      domainDaily = { limit: domMax, used, blocked: used >= domMax };
    }

    // 6. Bulk action cap
    let bulkCap: { limit: number | null; count: number; blocked: boolean } | null = null;
    const bulkMax = orgLimits?.maxKeywordsPerBulkRefresh;
    if (bulkMax && bulkMax > 0) {
      const count = keywordCount ?? 0;
      bulkCap = { limit: bulkMax, count, blocked: count > bulkMax };
    }

    const canRefresh =
      !(cooldown?.blocked) &&
      !(orgDaily?.blocked) &&
      !(userDaily?.blocked) &&
      !(projectDaily?.blocked) &&
      !(domainDaily?.blocked) &&
      !(bulkCap?.blocked);

    return { cooldown, orgDaily, userDaily, projectDaily, domainDaily, bulkCap, canRefresh };
  },
});

/**
 * Get current org's refresh limit settings for the Limits tab in Settings.
 * Returns refresh-related limits for the org the current user belongs to.
 */
export const getOrgRefreshLimits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const org = await ctx.db.get(membership.organizationId);
    if (!org) return null;

    return {
      organizationId: org._id,
      refreshCooldownMinutes: org.limits?.refreshCooldownMinutes ?? 0,
      maxDailyRefreshes: org.limits?.maxDailyRefreshes ?? 0,
      maxDailyRefreshesPerUser: org.limits?.maxDailyRefreshesPerUser ?? 0,
      maxKeywordsPerBulkRefresh: org.limits?.maxKeywordsPerBulkRefresh ?? 0,
    };
  },
});

// =================================================================
// Mutations (for updating limits)
// =================================================================

/**
 * Update organization limits (requires org.limits.edit permission)
 */
export const updateOrganizationLimits = mutation({
  args: {
    organizationId: v.id("organizations"),
    limits: v.object({
      maxKeywords: v.optional(v.union(v.number(), v.null())),
      maxProjects: v.optional(v.union(v.number(), v.null())),
      maxDomains: v.optional(v.union(v.number(), v.null())),
      maxDomainsPerProject: v.optional(v.union(v.number(), v.null())),
      maxKeywordsPerDomain: v.optional(v.union(v.number(), v.null())),
      refreshCooldownMinutes: v.optional(v.union(v.number(), v.null())),
      maxDailyRefreshes: v.optional(v.union(v.number(), v.null())),
      maxDailyRefreshesPerUser: v.optional(v.union(v.number(), v.null())),
      maxKeywordsPerBulkRefresh: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check permission
    await requirePermission(ctx, "org.limits.edit", {
      organizationId: args.organizationId,
    });

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    // Merge with existing limits, converting null to undefined for removal
    const currentLimits = org.limits || {};
    const newLimits: Record<string, number | undefined> = { ...currentLimits };

    for (const [key, value] of Object.entries(args.limits)) {
      if (value === null) {
        delete newLimits[key];
      } else if (value !== undefined) {
        newLimits[key] = value;
      }
    }

    // Only set limits if there are any defined
    const hasLimits = Object.keys(newLimits).length > 0;

    await ctx.db.patch(args.organizationId, {
      limits: hasLimits ? newLimits as Doc<"organizations">["limits"] : undefined,
    });

    return args.organizationId;
  },
});

/**
 * Update project limits (requires org.limits.edit permission)
 */
export const updateProjectLimits = mutation({
  args: {
    projectId: v.id("projects"),
    limits: v.object({
      maxDomains: v.optional(v.union(v.number(), v.null())),
      maxKeywordsPerDomain: v.optional(v.union(v.number(), v.null())),
      maxDailyRefreshes: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get org context
    const organizationId = await getOrgFromProject(ctx, args.projectId);
    if (!organizationId) throw new Error("Project not found");

    // Check permission
    await requirePermission(ctx, "org.limits.edit", {
      organizationId,
      projectId: args.projectId,
    });

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Merge with existing limits
    const currentLimits = project.limits || {};
    const newLimits: Record<string, number | undefined> = { ...currentLimits };

    for (const [key, value] of Object.entries(args.limits)) {
      if (value === null) {
        delete newLimits[key];
      } else if (value !== undefined) {
        newLimits[key] = value;
      }
    }

    const hasLimits = Object.keys(newLimits).length > 0;

    await ctx.db.patch(args.projectId, {
      limits: hasLimits ? newLimits as Doc<"projects">["limits"] : undefined,
    });

    return args.projectId;
  },
});

/**
 * Update domain limits (requires org.limits.edit permission)
 */
export const updateDomainLimits = mutation({
  args: {
    domainId: v.id("domains"),
    limits: v.object({
      maxKeywords: v.optional(v.union(v.number(), v.null())),
      maxDailyRefreshes: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get permission context
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) throw new Error("Domain not found");

    // Check permission
    await requirePermission(ctx, "org.limits.edit", context);

    const hierarchy = await getDomainHierarchy(ctx, args.domainId);
    if (!hierarchy) throw new Error("Domain not found");

    // Merge with existing limits
    const currentLimits = hierarchy.domain.limits || {};
    const newLimits: Record<string, number | undefined> = { ...currentLimits };

    for (const [key, value] of Object.entries(args.limits)) {
      if (value === null) {
        delete newLimits[key];
      } else if (value !== undefined) {
        newLimits[key] = value;
      }
    }

    const hasLimits = Object.keys(newLimits).length > 0;

    await ctx.db.patch(args.domainId, {
      limits: hasLimits ? newLimits as Doc<"domains">["limits"] : undefined,
    });

    return args.domainId;
  },
});
