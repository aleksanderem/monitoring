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
