import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx, action } from "./_generated/server";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";

// =================================================================
// Helper Functions
// =================================================================

/**
 * Check if current user is a super admin
 */
export async function isSuperAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<boolean> {
  const userId = await auth.getUserId(ctx);
  console.log("[isSuperAdmin] userId:", userId);
  if (!userId) return false;

  const superAdmin = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  console.log("[isSuperAdmin] superAdmin record:", superAdmin);
  return !!superAdmin;
}

/**
 * Require super admin - throws error if not
 */
export async function requireSuperAdmin(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const isAdmin = await isSuperAdmin(ctx);
  if (!isAdmin) {
    throw new Error("Super admin access required");
  }

  return userId;
}

/**
 * Log admin action for audit trail
 */
async function logAdminAction(
  ctx: MutationCtx,
  adminUserId: Id<"users">,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await ctx.db.insert("adminAuditLogs", {
    adminUserId,
    action,
    targetType,
    targetId,
    details,
    createdAt: Date.now(),
  });
}

// =================================================================
// Queries
// =================================================================

/**
 * Check if current user is super admin (for UI)
 */
export const checkIsSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    return await isSuperAdmin(ctx);
  },
});

/**
 * Get system statistics
 */
export const getSystemStats = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const users = await ctx.db.query("users").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const projects = await ctx.db.query("projects").collect();
    const domains = await ctx.db.query("domains").collect();
    const keywords = await ctx.db.query("keywords").collect();

    // Calculate recent activity (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentOrgs = orgs.filter((o) => o.createdAt > sevenDaysAgo);

    return {
      users: {
        total: users.length,
      },
      organizations: {
        total: orgs.length,
        recent: recentOrgs.length,
      },
      projects: {
        total: projects.length,
      },
      domains: {
        total: domains.length,
      },
      keywords: {
        total: keywords.length,
        active: keywords.filter((k) => k.status === "active").length,
        paused: keywords.filter((k) => k.status === "paused").length,
        pending: keywords.filter((k) => k.status === "pending_approval").length,
      },
    };
  },
});

/**
 * List all organizations with stats
 */
export const listAllOrganizations = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return { organizations: [], total: 0, hasMore: false };

    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    let orgs = await ctx.db.query("organizations").collect();

    // Search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      orgs = orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(searchLower) ||
          o.slug.toLowerCase().includes(searchLower)
      );
    }

    const total = orgs.length;
    const paginated = orgs.slice(offset, offset + limit);

    // Enrich with stats
    const enriched = await Promise.all(
      paginated.map(async (org) => {
        const members = await ctx.db
          .query("organizationMembers")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();

        const teams = await ctx.db
          .query("teams")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();

        // Check suspension status
        const suspension = await ctx.db
          .query("organizationSuspensions")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .unique();

        let projectCount = 0;
        let domainCount = 0;
        let keywordCount = 0;

        for (const team of teams) {
          const projects = await ctx.db
            .query("projects")
            .withIndex("by_team", (q) => q.eq("teamId", team._id))
            .collect();
          projectCount += projects.length;

          for (const project of projects) {
            const domains = await ctx.db
              .query("domains")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            domainCount += domains.length;

            for (const domain of domains) {
              const keywords = await ctx.db
                .query("keywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();
              keywordCount += keywords.length;
            }
          }
        }

        return {
          ...org,
          memberCount: members.length,
          projectCount,
          domainCount,
          keywordCount,
          suspended: !!suspension,
          suspendedAt: suspension?.suspendedAt,
        };
      })
    );

    return {
      organizations: enriched,
      total,
      hasMore: offset + limit < total,
    };
  },
});

/**
 * Get single organization details for admin
 */
export const getOrganizationDetails = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    // Get members with user details
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const membersWithUsers = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          user: user ? { email: (user as any).email, name: (user as any).name } : null,
        };
      })
    );

    // Get teams, projects, domains summary
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const teamsWithProjects = await Promise.all(
      teams.map(async (team) => {
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        const projectsWithDomains = await Promise.all(
          projects.map(async (project) => {
            const domains = await ctx.db
              .query("domains")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();

            return {
              ...project,
              domainCount: domains.length,
              domains: domains.map((d) => ({
                _id: d._id,
                domain: d.domain,
              })),
            };
          })
        );

        return {
          ...team,
          projects: projectsWithDomains,
        };
      })
    );

    // Calculate totals
    let totalDomains = 0;
    let totalKeywords = 0;
    let totalProjects = 0;

    for (const team of teamsWithProjects) {
      totalProjects += team.projects.length;
      for (const project of team.projects) {
        totalDomains += project.domainCount;
        // Count keywords for each domain
        for (const domain of project.domains) {
          const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
            .collect();
          totalKeywords += keywords.length;
        }
      }
    }

    // Flatten member data for easier consumption
    const flatMembers = membersWithUsers.map((m) => ({
      userId: m.userId,
      email: m.user?.email,
      name: m.user?.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    // Check suspension status
    const suspension = await ctx.db
      .query("organizationSuspensions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .unique();

    return {
      ...org,
      members: flatMembers,
      projectCount: totalProjects,
      domainCount: totalDomains,
      keywordCount: totalKeywords,
      teams: teamsWithProjects,
      suspended: !!suspension,
      suspendedAt: suspension?.suspendedAt,
    };
  },
});

/**
 * List all users
 */
export const listAllUsers = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return { users: [], total: 0, hasMore: false };

    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    let users = await ctx.db.query("users").collect();

    // Search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      users = users.filter(
        (u) =>
          (u as any).email?.toLowerCase().includes(searchLower) ||
          (u as any).name?.toLowerCase().includes(searchLower)
      );
    }

    const total = users.length;
    const paginated = users.slice(offset, offset + limit);

    // Get super admin status for each user
    const superAdmins = await ctx.db.query("superAdmins").collect();
    const superAdminUserIds = new Set(superAdmins.map((sa) => sa.userId));

    // Get all suspensions
    const suspensions = await ctx.db.query("userSuspensions").collect();
    const suspendedUserIds = new Set(suspensions.map((s) => s.userId));

    // Enrich with organization memberships
    const enriched = await Promise.all(
      paginated.map(async (user) => {
        const memberships = await ctx.db
          .query("organizationMembers")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        const orgs = await Promise.all(
          memberships.map(async (m) => {
            const org = await ctx.db.get(m.organizationId);
            return org ? { id: org._id, name: org.name, role: m.role } : null;
          })
        );

        return {
          _id: user._id,
          email: (user as any).email,
          name: (user as any).name,
          createdAt: user._creationTime,
          isSuperAdmin: superAdminUserIds.has(user._id),
          suspended: suspendedUserIds.has(user._id),
          organizationCount: memberships.length,
          organizations: orgs.filter(Boolean).map((org) => ({
            organizationId: org!.id,
            organizationName: org!.name,
            role: org!.role,
          })),
        };
      })
    );

    return {
      users: enriched,
      total,
      hasMore: offset + limit < total,
    };
  },
});

/**
 * Get detailed user information for admin
 */
export const getUserDetails = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Get super admin status
    const superAdmin = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    // Get suspension status
    const suspension = await ctx.db
      .query("userSuspensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    // Get organization memberships
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const organizations = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId);
        return org ? {
          organizationId: org._id,
          organizationName: org.name,
          role: m.role,
          joinedAt: m.joinedAt,
        } : null;
      })
    );

    // Get team memberships
    const teamMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const teams = await Promise.all(
      teamMemberships.map(async (tm) => {
        const team = await ctx.db.get(tm.teamId);
        if (!team) return null;

        const org = await ctx.db.get(team.organizationId);
        return {
          teamId: team._id,
          teamName: team.name,
          organizationId: team.organizationId,
          organizationName: org?.name || "Unknown",
          role: tm.role,
          joinedAt: tm.joinedAt,
        };
      })
    );

    return {
      _id: user._id,
      email: (user as any).email,
      name: (user as any).name,
      createdAt: user._creationTime,
      isSuperAdmin: !!superAdmin,
      suspended: !!suspension,
      suspendedAt: suspension?.suspendedAt,
      organizations: organizations.filter(Boolean),
      teams: teams.filter(Boolean),
    };
  },
});

/**
 * Get system configuration
 */
export const getSystemConfig = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const configs = await ctx.db.query("systemConfig").collect();

    const configMap: Record<string, unknown> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    // Check if APIs have data in the system
    const dataForSEOUsage = await ctx.db
      .query("apiUsageLogs")
      .withIndex("by_provider_date", (q) => q.eq("provider", "dataforseo"))
      .first();
    const seRankingData = await ctx.db
      .query("domainVisibilityHistory")
      .first();

    return {
      defaultOrgLimits: (configMap.defaultOrgLimits as {
        maxProjects: number;
        maxDomainsPerProject: number;
        maxKeywordsPerDomain: number;
      }) || {
        maxProjects: 5,
        maxDomainsPerProject: 10,
        maxKeywordsPerDomain: 100,
      },
      generalSettings: (configMap.generalSettings as {
        platformName?: string;
        supportEmail?: string;
        maintenanceMode?: boolean;
        defaultTimezone?: string;
      }) || {
        platformName: "SEO Monitor",
        supportEmail: "support@example.com",
        maintenanceMode: false,
        defaultTimezone: "UTC",
      },
      featureFlags: (configMap.featureFlags as {
        enableReports?: boolean;
        enableLinkAnalysis?: boolean;
        enableOnsiteAnalysis?: boolean;
        enableProposals?: boolean;
      }) || {
        enableReports: true,
        enableLinkAnalysis: true,
        enableOnsiteAnalysis: true,
        enableProposals: true,
      },
      apiConfig: {
        dataForSEO: !!dataForSEOUsage,
        seRanking: !!seRankingData,
      },
    };
  },
});

/**
 * Get API status (DataForSEO and SE Ranking)
 */
export const getApiStatus = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;

    // Note: Environment variables are not directly accessible in queries
    // This returns what can be determined from usage logs
    const recentDataForSEO = await ctx.db
      .query("apiUsageLogs")
      .withIndex("by_provider_date", (q) => q.eq("provider", "dataforseo"))
      .order("desc")
      .first();

    const recentSeRanking = await ctx.db
      .query("apiUsageLogs")
      .withIndex("by_provider_date", (q) => q.eq("provider", "seranking"))
      .order("desc")
      .first();

    // Check if APIs have data in the system (env vars not accessible in queries)
    // For SE Ranking, check if there's any visibility history data
    const seRankingData = await ctx.db
      .query("domainVisibilityHistory")
      .first();

    // For DataForSEO, check usage logs or other indicators
    const dataForSEOConfigured = !!recentDataForSEO;
    const seRankingConfigured = !!seRankingData || !!recentSeRanking;

    return {
      dataForSEO: {
        configured: dataForSEOConfigured,
        status: dataForSEOConfigured ? "active" : "not configured",
        lastUsed: recentDataForSEO?.createdAt || null,
        lastEndpoint: recentDataForSEO?.endpoint || null,
      },
      seRanking: {
        configured: seRankingConfigured,
        status: seRankingConfigured ? "active" : "not configured",
        lastUsed: recentSeRanking?.createdAt || null,
        lastEndpoint: recentSeRanking?.endpoint || null,
      },
    };
  },
});

/**
 * Get API usage logs
 */
export const getApiUsageLogs = query({
  args: {
    provider: v.optional(v.union(v.literal("dataforseo"), v.literal("seranking"))),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return [];

    const days = args.days ?? 30;
    const limit = args.limit ?? 100;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    let logs = await ctx.db.query("apiUsageLogs").order("desc").take(1000);

    // Filter by provider if specified
    if (args.provider) {
      logs = logs.filter((l) => l.provider === args.provider);
    }

    // Filter by date
    logs = logs.filter((l) => l.date >= startDateStr);

    return logs.slice(0, limit);
  },
});

/**
 * Get notification logs
 */
export const getNotificationLogs = query({
  args: {
    type: v.optional(v.union(v.literal("email"), v.literal("system"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return [];

    const limit = args.limit ?? 100;

    let logs;
    if (args.type) {
      logs = await ctx.db
        .query("notificationLogs")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(limit);
    } else {
      logs = await ctx.db.query("notificationLogs").order("desc").take(limit);
    }

    return logs;
  },
});

/**
 * Get admin audit logs
 */
export const getAdminAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return [];

    const limit = args.limit ?? 100;
    const logs = await ctx.db.query("adminAuditLogs").order("desc").take(limit);

    // Enrich with admin user info
    const enriched = await Promise.all(
      logs.map(async (log) => {
        const admin = await ctx.db.get(log.adminUserId);
        return {
          ...log,
          adminEmail: (admin as any)?.email || "Unknown",
        };
      })
    );

    return enriched;
  },
});

// =================================================================
// Mutations
// =================================================================

/**
 * Update organization limits (admin override)
 */
export const adminUpdateOrganizationLimits = mutation({
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
    const adminUserId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    const newLimits: Record<string, number | undefined> = { ...org.limits };

    for (const [key, value] of Object.entries(args.limits)) {
      if (value === null) {
        delete newLimits[key];
      } else if (value !== undefined) {
        newLimits[key] = value;
      }
    }

    const hasLimits = Object.keys(newLimits).length > 0;

    await ctx.db.patch(args.organizationId, {
      limits: hasLimits ? (newLimits as Doc<"organizations">["limits"]) : undefined,
    });

    await logAdminAction(ctx, adminUserId, "update_org_limits", "organization", args.organizationId, {
      limits: args.limits,
    });

    return args.organizationId;
  },
});

/**
 * Delete organization (cascade delete all related data)
 */
export const adminDeleteOrganization = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    // Get all related data and delete in order
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();

      for (const project of projects) {
        // Delete domains and keywords
        const domains = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        for (const domain of domains) {
          // Delete keywords and positions
          const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
            .collect();

          for (const keyword of keywords) {
            const positions = await ctx.db
              .query("keywordPositions")
              .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
              .collect();
            for (const pos of positions) await ctx.db.delete(pos._id);
            await ctx.db.delete(keyword._id);
          }

          // Delete discovered keywords
          const discovered = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
            .collect();
          for (const d of discovered) await ctx.db.delete(d._id);

          // Delete visibility history
          const history = await ctx.db
            .query("domainVisibilityHistory")
            .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
            .collect();
          for (const h of history) await ctx.db.delete(h._id);

          await ctx.db.delete(domain._id);
        }

        // Delete reports
        const reports = await ctx.db
          .query("reports")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        for (const r of reports) await ctx.db.delete(r._id);

        // Delete project members
        const projectMembers = await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        for (const pm of projectMembers) await ctx.db.delete(pm._id);

        await ctx.db.delete(project._id);
      }

      // Delete team members
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      for (const tm of teamMembers) await ctx.db.delete(tm._id);

      await ctx.db.delete(team._id);
    }

    // Delete organization members
    const orgMembers = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const om of orgMembers) await ctx.db.delete(om._id);

    // Delete custom roles
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const r of roles) await ctx.db.delete(r._id);

    // Delete clients
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const c of clients) await ctx.db.delete(c._id);

    // Finally delete organization
    await ctx.db.delete(args.organizationId);

    await logAdminAction(ctx, adminUserId, "delete_organization", "organization", args.organizationId, {
      name: org.name,
      slug: org.slug,
    });
  },
});

/**
 * Suspend organization
 */
export const adminSuspendOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    // Check if already suspended
    const existing = await ctx.db
      .query("organizationSuspensions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .unique();

    if (existing) {
      throw new Error("Organization is already suspended");
    }

    await ctx.db.insert("organizationSuspensions", {
      organizationId: args.organizationId,
      suspendedBy: adminUserId,
      suspendedAt: Date.now(),
      reason: args.reason,
    });

    await logAdminAction(ctx, adminUserId, "suspend_organization", "organization", args.organizationId, {
      name: org.name,
      reason: args.reason,
    });
  },
});

/**
 * Activate (unsuspend) organization
 */
export const adminActivateOrganization = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    // Find suspension record
    const suspension = await ctx.db
      .query("organizationSuspensions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .unique();

    if (!suspension) {
      throw new Error("Organization is not suspended");
    }

    await ctx.db.delete(suspension._id);

    await logAdminAction(ctx, adminUserId, "activate_organization", "organization", args.organizationId, {
      name: org.name,
    });
  },
});

/**
 * Grant super admin status to a user
 */
export const grantSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    // Check if user exists
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Check if already super admin
    const existing = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      throw new Error("User is already a super admin");
    }

    await ctx.db.insert("superAdmins", {
      userId: args.userId,
      grantedBy: adminUserId,
      grantedAt: Date.now(),
    });

    await logAdminAction(ctx, adminUserId, "grant_super_admin", "user", args.userId, {
      email: (user as any).email,
    });
  },
});

/**
 * Revoke super admin status from a user
 */
export const revokeSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    // Cannot revoke own super admin
    if (args.userId === adminUserId) {
      throw new Error("Cannot revoke your own super admin status");
    }

    const record = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!record) {
      throw new Error("User is not a super admin");
    }

    await ctx.db.delete(record._id);

    const user = await ctx.db.get(args.userId);
    await logAdminAction(ctx, adminUserId, "revoke_super_admin", "user", args.userId, {
      email: (user as any)?.email,
    });
  },
});

/**
 * Suspend a user account
 */
export const adminSuspendUser = mutation({
  args: { userId: v.id("users"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    // Cannot suspend self
    if (args.userId === adminUserId) {
      throw new Error("Cannot suspend your own account");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Check if already suspended
    const existing = await ctx.db
      .query("userSuspensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      throw new Error("User is already suspended");
    }

    await ctx.db.insert("userSuspensions", {
      userId: args.userId,
      suspendedBy: adminUserId,
      suspendedAt: Date.now(),
      reason: args.reason,
    });

    await logAdminAction(ctx, adminUserId, "suspend_user", "user", args.userId, {
      email: (user as any).email,
      reason: args.reason,
    });
  },
});

/**
 * Activate a suspended user account
 */
export const adminActivateUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Find and delete suspension record
    const suspension = await ctx.db
      .query("userSuspensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!suspension) {
      throw new Error("User is not suspended");
    }

    await ctx.db.delete(suspension._id);

    await logAdminAction(ctx, adminUserId, "activate_user", "user", args.userId, {
      email: (user as any).email,
    });
  },
});

/**
 * Impersonate a user (creates audit log entry)
 */
export const adminImpersonateUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    // Cannot impersonate self
    if (args.userId === adminUserId) {
      throw new Error("Cannot impersonate yourself");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await logAdminAction(ctx, adminUserId, "impersonate_user", "user", args.userId, {
      email: (user as any).email,
      timestamp: Date.now(),
    });

    return {
      userId: args.userId,
      email: (user as any).email,
      message: "Impersonation logged. Implement session switching in your auth system.",
    };
  },
});

/**
 * Delete a user and all their memberships
 */
export const adminDeleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    // Cannot delete self
    if (args.userId === adminUserId) {
      throw new Error("Cannot delete your own account");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Remove from super admins if applicable
    const superAdminRecord = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (superAdminRecord) {
      await ctx.db.delete(superAdminRecord._id);
    }

    // Remove suspension record if exists
    const suspension = await ctx.db
      .query("userSuspensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (suspension) {
      await ctx.db.delete(suspension._id);
    }

    // Remove organization memberships
    const orgMemberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const om of orgMemberships) {
      await ctx.db.delete(om._id);
    }

    // Remove project memberships
    const projectMemberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const pm of projectMemberships) {
      await ctx.db.delete(pm._id);
    }

    // Remove team memberships
    const teamMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const tm of teamMemberships) {
      await ctx.db.delete(tm._id);
    }

    // Delete user
    await ctx.db.delete(args.userId);

    await logAdminAction(ctx, adminUserId, "delete_user", "user", args.userId, {
      email: (user as any).email,
    });
  },
});

/**
 * Update default organization limits for new organizations
 */
export const updateDefaultOrgLimits = mutation({
  args: {
    limits: v.object({
      maxKeywords: v.optional(v.union(v.number(), v.null())),
      maxProjects: v.optional(v.union(v.number(), v.null())),
      maxDomains: v.optional(v.union(v.number(), v.null())),
      maxDomainsPerProject: v.optional(v.union(v.number(), v.null())),
      maxKeywordsPerDomain: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("key", "defaultOrgLimits"))
      .unique();

    // Clean up null values
    const cleanLimits: Record<string, number> = {};
    for (const [key, value] of Object.entries(args.limits)) {
      if (value !== null && value !== undefined) {
        cleanLimits[key] = value;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, { value: cleanLimits });
    } else {
      await ctx.db.insert("systemConfig", {
        key: "defaultOrgLimits",
        value: cleanLimits,
      });
    }

    await logAdminAction(ctx, adminUserId, "update_default_limits", "system", "defaultOrgLimits", {
      limits: cleanLimits,
    });
  },
});

/**
 * Update general system settings
 */
export const updateGeneralSettings = mutation({
  args: {
    platformName: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    maintenanceMode: v.optional(v.boolean()),
    defaultTimezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("key", "generalSettings"))
      .unique();

    const settings: Record<string, string | boolean> = {};
    if (args.platformName !== undefined) settings.platformName = args.platformName;
    if (args.supportEmail !== undefined) settings.supportEmail = args.supportEmail;
    if (args.maintenanceMode !== undefined) settings.maintenanceMode = args.maintenanceMode;
    if (args.defaultTimezone !== undefined) settings.defaultTimezone = args.defaultTimezone;

    if (existing) {
      await ctx.db.patch(existing._id, { value: settings });
    } else {
      await ctx.db.insert("systemConfig", {
        key: "generalSettings",
        value: settings,
      });
    }

    await logAdminAction(ctx, adminUserId, "update_general_settings", "system", "generalSettings", {
      settings,
    });
  },
});

/**
 * Update feature flags
 */
export const updateFeatureFlags = mutation({
  args: {
    enableReports: v.optional(v.boolean()),
    enableLinkAnalysis: v.optional(v.boolean()),
    enableOnsiteAnalysis: v.optional(v.boolean()),
    enableProposals: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminUserId = await requireSuperAdmin(ctx);

    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("key", "featureFlags"))
      .unique();

    const flags: Record<string, boolean> = {};
    if (args.enableReports !== undefined) flags.enableReports = args.enableReports;
    if (args.enableLinkAnalysis !== undefined) flags.enableLinkAnalysis = args.enableLinkAnalysis;
    if (args.enableOnsiteAnalysis !== undefined) flags.enableOnsiteAnalysis = args.enableOnsiteAnalysis;
    if (args.enableProposals !== undefined) flags.enableProposals = args.enableProposals;

    if (existing) {
      await ctx.db.patch(existing._id, { value: flags });
    } else {
      await ctx.db.insert("systemConfig", {
        key: "featureFlags",
        value: flags,
      });
    }

    await logAdminAction(ctx, adminUserId, "update_feature_flags", "system", "featureFlags", {
      flags,
    });
  },
});

/**
 * Initialize first super admin (one-time setup)
 */
export const initFirstSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Check if any super admins exist
    const existingAdmins = await ctx.db.query("superAdmins").collect();
    if (existingAdmins.length > 0) {
      throw new Error("Super admin already exists. Use grantSuperAdmin instead.");
    }

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.insert("superAdmins", {
      userId: args.userId,
      grantedAt: Date.now(),
    });

    return { message: "First super admin initialized successfully" };
  },
});

/**
 * Bootstrap helper: Find user by email and make them super admin
 * This is for initial setup only - works without auth
 */
export const bootstrapSuperAdminByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Check if any super admins exist
    const existingAdmins = await ctx.db.query("superAdmins").collect();
    if (existingAdmins.length > 0) {
      throw new Error("Super admin already exists. Use grantSuperAdmin instead.");
    }

    // Find user by email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();

    if (!user) {
      throw new Error(`User with email "${args.email}" not found`);
    }

    await ctx.db.insert("superAdmins", {
      userId: user._id,
      grantedAt: Date.now(),
    });

    return {
      message: "First super admin initialized successfully",
      userId: user._id,
      email: user.email,
    };
  },
});

/**
 * Log API usage (called by API integration actions)
 */
export const logApiUsage = mutation({
  args: {
    provider: v.union(v.literal("dataforseo"), v.literal("seranking")),
    endpoint: v.string(),
    organizationId: v.optional(v.id("organizations")),
    domainId: v.optional(v.id("domains")),
    requestCount: v.number(),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    await ctx.db.insert("apiUsageLogs", {
      provider: args.provider,
      endpoint: args.endpoint,
      organizationId: args.organizationId,
      domainId: args.domainId,
      requestCount: args.requestCount,
      cost: args.cost,
      date: today,
      createdAt: Date.now(),
    });
  },
});

/**
 * Test DataForSEO API connection
 */
export const testDataForSEOConnection = action({
  args: {},
  handler: async (): Promise<{ success: boolean; message: string; statusCode?: number }> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return {
        success: false,
        message: "DataForSEO credentials not configured (DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables)",
      };
    }

    try {
      // Test connection with a simple API call
      const authHeader = btoa(`${login}:${password}`);
      const response = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.status_code === 20000) {
        return {
          success: true,
          message: "Successfully connected to DataForSEO API",
          statusCode: data.status_code,
        };
      } else {
        return {
          success: false,
          message: `API returned error: ${data.status_message || "Unknown error"}`,
          statusCode: data.status_code,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Test SE Ranking API connection
 */
export const testSERankingConnection = action({
  args: {},
  handler: async (): Promise<{ success: boolean; message: string }> => {
    // SE Ranking API test would go here
    // For now, just return a placeholder
    return {
      success: false,
      message: "SE Ranking API test not implemented",
    };
  },
});
