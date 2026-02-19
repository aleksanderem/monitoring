import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";
import { checkKeywordLimit } from "./limits";
import type { Id } from "./_generated/dataModel";
import { requirePermission, requireTenantAccess, getOrgFromProject, getContextFromDomain } from "./permissions";

// Get domains for a project
export const getDomains = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "project", args.projectId);

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get keyword count and average position for each domain
    // Uses denormalized currentPosition on keywords — no keywordPositions reads
    const domainsWithStats = await Promise.all(
      domains.map(async (domain) => {
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        let totalPosition = 0;
        let positionCount = 0;

        for (const keyword of keywords) {
          const pos = keyword.currentPosition;
          if (pos != null && pos > 0) {
            totalPosition += pos;
            positionCount++;
          }
        }

        const avgPosition =
          positionCount > 0 ? Math.round((totalPosition / positionCount) * 10) / 10 : null;

        return {
          ...domain,
          keywordCount: keywords.length,
          avgPosition,
        };
      })
    );

    return domainsWithStats;
  },
});

// Get single domain
export const getDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    return await ctx.db.get(args.domainId);
  },
});

// Create domain
export const createDomain = mutation({
  args: {
    projectId: v.id("projects"),
    domain: v.string(),
    settings: v.object({
      refreshFrequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("on_demand")
      ),
      searchEngine: v.string(),
      location: v.string(),
      language: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "project", args.projectId);

    // Get organization from project
    const organizationId = await getOrgFromProject(ctx, args.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }

    // Check permission
    await requirePermission(ctx, "domains.create", {
      organizationId,
      projectId: args.projectId,
    });

    // Strip protocol — store bare hostname, lowercased for case-insensitive uniqueness
    const cleanDomain = args.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

    // Uniqueness check: same domain + location + language in same project
    const existing = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) =>
        q.and(
          q.eq(q.field("domain"), cleanDomain),
          q.eq(q.field("settings.location"), args.settings.location),
          q.eq(q.field("settings.language"), args.settings.language)
        )
      )
      .first();
    if (existing) {
      throw new Error("Domain with this location/language already exists in this project");
    }

    const domainId = await ctx.db.insert("domains", {
      projectId: args.projectId,
      domain: cleanDomain,
      settings: args.settings,
      createdAt: Date.now(),
    });

    // Schedule automatic initial data fetch (keywords + visibility)
    await ctx.scheduler.runAfter(0, internal.domains.initializeDomainData, {
      domainId,
      domain: cleanDomain,
      location: args.settings.location,
      language: args.settings.language,
    });

    return domainId;
  },
});

// Update domain
export const updateDomain = mutation({
  args: {
    domainId: v.id("domains"),
    domain: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    tags: v.optional(v.array(v.string())),
    settings: v.optional(
      v.object({
        refreshFrequency: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("on_demand")
        ),
        searchEngine: v.string(),
        location: v.string(),
        language: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Get permission context
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }

    // Check permission
    await requirePermission(ctx, "domains.edit", context);

    const updates: Record<string, unknown> = {};
    if (args.domain) {
      const cleanDomain = args.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
      // Uniqueness check when domain name changes
      const currentDomain = await ctx.db.get(args.domainId);
      if (currentDomain && cleanDomain !== currentDomain.domain) {
        const projectId = args.projectId ?? currentDomain.projectId;
        const settings = args.settings ?? currentDomain.settings;
        const existing = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .filter((q) =>
            q.and(
              q.eq(q.field("domain"), cleanDomain),
              q.eq(q.field("settings.location"), settings.location),
              q.eq(q.field("settings.language"), settings.language)
            )
          )
          .first();
        if (existing && existing._id !== args.domainId) {
          throw new Error("Domain with this location/language already exists in this project");
        }
      }
      updates.domain = cleanDomain;
    }
    if (args.projectId) updates.projectId = args.projectId;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.settings) updates.settings = args.settings;

    await ctx.db.patch(args.domainId, updates);
    return args.domainId;
  },
});

// Get user's role for a domain (traces: domain -> project -> team -> org -> membership)
export const getUserRoleForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    console.log("[getUserRoleForDomain] userId:", userId);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const domain = await ctx.db.get(args.domainId);
    console.log("[getUserRoleForDomain] domain:", domain?._id);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    console.log("[getUserRoleForDomain] project:", project?._id);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    console.log("[getUserRoleForDomain] team:", team?._id, "orgId:", team?.organizationId);
    if (!team) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", team.organizationId).eq("userId", userId)
      )
      .unique();

    console.log("[getUserRoleForDomain] membership role:", membership?.role);
    return membership?.role || null;
  },
});

// Delete domain (requires domains.delete permission)
export const deleteDomain = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Get permission context
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }

    // Check permission
    await requirePermission(ctx, "domains.delete", context);

    // Get domain for cascade delete
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    // Delete discovered keywords
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    for (const dk of discoveredKeywords) {
      await ctx.db.delete(dk._id);
    }

    // Delete all keywords and positions
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    for (const keyword of keywords) {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .collect();

      for (const pos of positions) {
        await ctx.db.delete(pos._id);
      }

      await ctx.db.delete(keyword._id);
    }

    await ctx.db.delete(args.domainId);
  },
});

// Update last refreshed timestamp
export const markRefreshed = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    await ctx.db.patch(args.domainId, {
      lastRefreshedAt: Date.now(),
    });
  },
});

// Internal version of markRefreshed for use in actions
export const markRefreshedInternal = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.domainId, {
      lastRefreshedAt: Date.now(),
    });
  },
});

// =================================================================
// Discovered Keywords (from domain visibility scan)
// =================================================================

// Get discovered keywords for a domain
export const getDiscoveredKeywords = query({
  args: {
    domainId: v.id("domains"),
    status: v.optional(v.union(
      v.literal("discovered"),
      v.literal("monitoring"),
      v.literal("ignored")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    let keywords;

    if (args.status) {
      const status = args.status; // TypeScript narrowing
      keywords = await ctx.db
        .query("discoveredKeywords")
        .withIndex("by_domain_status", (q) =>
          q.eq("domainId", args.domainId).eq("status", status)
        )
        .collect();
    } else {
      keywords = await ctx.db
        .query("discoveredKeywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .collect();
    }

    // Sort by position (best first)
    return keywords.sort((a, b) => a.bestPosition - b.bestPosition);
  },
});

// Add selected discovered keywords to monitoring
export const promoteDiscoveredKeywords = mutation({
  args: {
    domainId: v.id("domains"),
    keywordIds: v.array(v.id("discoveredKeywords")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    // First pass: count how many keywords will actually be added
    const keywordsToAdd: Array<{
      discoveredId: typeof args.keywordIds[0];
      discovered: NonNullable<Awaited<ReturnType<typeof ctx.db.get>>>;
    }> = [];
    const alreadyExistingIds: typeof args.keywordIds = [];

    for (const discoveredId of args.keywordIds) {
      const discovered = await ctx.db.get(discoveredId);
      if (!discovered || discovered.domainId !== args.domainId) continue;

      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), (discovered as { keyword: string }).keyword.toLowerCase()))
        .unique();

      if (!existing) {
        keywordsToAdd.push({ discoveredId, discovered: discovered as typeof keywordsToAdd[0]["discovered"] });
      } else {
        // Keyword already exists, still mark as monitoring
        alreadyExistingIds.push(discoveredId);
      }
    }

    // Check keyword limit for the batch
    if (keywordsToAdd.length > 0) {
      const limitCheck = await checkKeywordLimit(ctx, args.domainId, keywordsToAdd.length);
      if (!limitCheck.allowed) {
        const canAdd = limitCheck.remaining ?? 0;
        throw new Error(
          `Przekroczono limit fraz. Limit: ${limitCheck.limit}, obecnie: ${limitCheck.currentCount}, można dodać: ${canAdd}, próbujesz dodać: ${keywordsToAdd.length}`
        );
      }
    }

    const addedKeywordIds: string[] = [];

    // Second pass: actually add the keywords
    for (const { discoveredId, discovered } of keywordsToAdd) {
      const disc = discovered as { keyword: string; lastSeenDate: string; previousPosition?: number; bestPosition: number; url: string; searchVolume?: number; difficulty?: number; cpc?: number };

      // Create monitored keyword
      const keywordId = await ctx.db.insert("keywords", {
        domainId: args.domainId,
        phrase: disc.keyword.toLowerCase(),
        status: "active",
        createdAt: Date.now(),
      });

      // If we have previousPosition from SE Ranking, store it as an older entry
      // This gives us initial change data immediately
      if (disc.previousPosition) {
        const prevDate = new Date(disc.lastSeenDate);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevDateStr = prevDate.toISOString().split("T")[0];

        await ctx.db.insert("keywordPositions", {
          keywordId,
          date: prevDateStr,
          position: disc.previousPosition,
          url: disc.url,
          searchVolume: disc.searchVolume,
          difficulty: disc.difficulty,
          cpc: disc.cpc,
          fetchedAt: Date.now(),
        });
      }

      // Store current position from discovered data
      await ctx.db.insert("keywordPositions", {
        keywordId,
        date: disc.lastSeenDate,
        position: disc.bestPosition,
        url: disc.url,
        searchVolume: disc.searchVolume,
        difficulty: disc.difficulty,
        cpc: disc.cpc,
        fetchedAt: Date.now(),
      });

      addedKeywordIds.push(keywordId);

      // Mark discovered keyword as monitoring
      await ctx.db.patch(discoveredId, { status: "monitoring" });
    }

    // Mark already existing keywords as monitoring too
    for (const discoveredId of alreadyExistingIds) {
      await ctx.db.patch(discoveredId, { status: "monitoring" });
    }

    return addedKeywordIds;
  },
});

// Ignore discovered keywords (don't show in suggestions)
export const ignoreDiscoveredKeywords = mutation({
  args: {
    keywordIds: v.array(v.id("discoveredKeywords")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation: resolve domain from first discovered keyword
    if (args.keywordIds.length > 0) {
      const firstDk = await ctx.db.get(args.keywordIds[0]);
      if (firstDk) {
        await requireTenantAccess(ctx, "domain", firstDk.domainId);
      }
    }

    for (const id of args.keywordIds) {
      await ctx.db.patch(id, { status: "ignored" });
    }
  },
});

// Get count of discovered keywords by status
export const getDiscoveredKeywordsCount = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const all = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return {
      total: all.length,
      discovered: all.filter(k => k.status === "discovered").length,
      monitoring: all.filter(k => k.status === "monitoring").length,
      ignored: all.filter(k => k.status === "ignored").length,
    };
  },
});

// =================================================================
// Visibility History (for trend charts)
// =================================================================

// Get visibility history for a domain (for charting)
export const getVisibilityHistory = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()), // Default 365
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const history = await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Sort by date ascending
    const sorted = history.sort((a, b) => a.date.localeCompare(b.date));

    // Filter by days if specified
    if (args.days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - args.days);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];
      return sorted.filter(h => h.date >= cutoffStr);
    }

    return sorted;
  },
});

// =================================================================
// Backlinks
// =================================================================

// Get backlinks summary for a domain
export const getBacklinksSummary = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    return await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();
  },
});

// Get backlinks for a domain
export const getBacklinks = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const limit = args.limit || 100;
    const backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .take(limit);

    // Sort by rank descending (best first)
    return backlinks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  },
});

// Get position distribution for a domain (for histogram chart)
// Uses denormalized currentPosition on keywords — no keywordPositions reads
export const getPositionDistribution = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const buckets = {
      "1-3": 0,
      "4-10": 0,
      "11-20": 0,
      "21-50": 0,
      "51-100": 0,
      "100+": 0,
    };

    for (const keyword of keywords) {
      const pos = keyword.currentPosition;
      if (pos != null && pos > 0) {
        if (pos <= 3) buckets["1-3"]++;
        else if (pos <= 10) buckets["4-10"]++;
        else if (pos <= 20) buckets["11-20"]++;
        else if (pos <= 50) buckets["21-50"]++;
        else if (pos <= 100) buckets["51-100"]++;
        else buckets["100+"]++;
      }
    }

    return [
      { range: "1-3", count: buckets["1-3"] },
      { range: "4-10", count: buckets["4-10"] },
      { range: "11-20", count: buckets["11-20"] },
      { range: "21-50", count: buckets["21-50"] },
      { range: "51-100", count: buckets["51-100"] },
      { range: "100+", count: buckets["100+"] },
    ];
  },
});

// Get latest visibility metrics (current snapshot)
export const getLatestVisibilityMetrics = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const history = await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    if (history.length === 0) return null;

    // Get the most recent entry
    const sorted = history.sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];

    // Calculate aggregated metrics
    const metrics = latest.metrics;
    const top3 = (metrics.pos_1 || 0) + (metrics.pos_2_3 || 0);
    const top10 = top3 + (metrics.pos_4_10 || 0);
    const top20 = top10 + (metrics.pos_11_20 || 0);
    const top50 = top20 + (metrics.pos_21_30 || 0) + (metrics.pos_31_40 || 0) + (metrics.pos_41_50 || 0);
    const total = metrics.count || 0;

    // Calculate change from previous period (7 days ago)
    const weekAgo = new Date(latest.date);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const previousEntry = sorted.find(h => h.date <= weekAgoStr);

    let change = null;
    if (previousEntry) {
      const prevTop10 = (previousEntry.metrics.pos_1 || 0) +
        (previousEntry.metrics.pos_2_3 || 0) +
        (previousEntry.metrics.pos_4_10 || 0);
      change = {
        top10: top10 - prevTop10,
        total: total - (previousEntry.metrics.count || 0),
      };
    }

    return {
      date: latest.date,
      top3,
      top10,
      top20,
      top50,
      total,
      etv: metrics.etv,
      isNew: metrics.is_new,
      isUp: metrics.is_up,
      isDown: metrics.is_down,
      isLost: metrics.is_lost,
      change,
    };
  },
});

// Internal query to get domains for a project (for actions)
export const getDomainsInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Internal query to get single domain by ID (for actions)
export const getDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.domainId);
  },
});

// Internal query: get discovered keywords for a domain (for actions)
export const getDiscoveredKeywordsInternal = internalQuery({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    // Sort by volume desc, then take top N
    all.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
    return all.slice(0, args.limit ?? 200);
  },
});

// Internal query: get monitored keywords for a domain (for actions)
export const getMonitoredKeywordsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

// List all domains for current user (across all projects)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get user's teams
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (memberships.length === 0) {
      return [];
    }

    const teamIds = memberships.map((m) => m.teamId);

    // Get all projects from user's teams
    const allProjects: any[] = [];
    for (const teamId of teamIds) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      allProjects.push(...projects);
    }

    const projectIds = allProjects.map((p) => p._id);

    // Get all domains from these projects
    const allDomains: any[] = [];
    for (const projectId of projectIds) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();

      // Add project reference and get stats for each domain
      for (const domain of domains) {
        const project = allProjects.find((p) => p._id === projectId);

        // Get keyword count
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        allDomains.push({
          ...domain,
          project,
          keywordCount: keywords.length,
        });
      }
    }

    // Sort by creation time (most recent first)
    return allDomains.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Simplified create mutation (auto-resolves user's first team and project)
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    domain: v.string(),
    searchEngine: v.optional(v.string()),
    refreshFrequency: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("on_demand")
    )),
    location: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "project", args.projectId);

    // Strip protocol — store bare hostname, lowercased for case-insensitive uniqueness
    const cleanDomain = args.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

    // Uniqueness check: same domain + location + language in same project
    const existing = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) =>
        q.and(
          q.eq(q.field("domain"), cleanDomain),
          q.eq(q.field("settings.location"), args.location),
          q.eq(q.field("settings.language"), args.language)
        )
      )
      .first();
    if (existing) {
      throw new Error("Domain with this location/language already exists in this project");
    }

    const domainId = await ctx.db.insert("domains", {
      projectId: args.projectId,
      domain: cleanDomain,
      settings: {
        refreshFrequency: args.refreshFrequency || "weekly",
        searchEngine: args.searchEngine || "google.com",
        location: args.location,
        language: args.language,
      },
      createdAt: Date.now(),
    });

    // Schedule automatic initial data fetch (keywords + visibility)
    await ctx.scheduler.runAfter(0, internal.domains.initializeDomainData, {
      domainId,
      domain: cleanDomain,
      location: args.location,
      language: args.language,
    });

    return domainId;
  },
});

// Simplified delete mutation
export const remove = mutation({
  args: {
    id: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.id);

    // Get domain for cascade delete
    const domain = await ctx.db.get(args.id);
    if (!domain) {
      throw new Error("Domain not found");
    }

    // Delete discovered keywords
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.id))
      .collect();

    for (const dk of discoveredKeywords) {
      await ctx.db.delete(dk._id);
    }

    // Delete all keywords and positions
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.id))
      .collect();

    for (const keyword of keywords) {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .collect();

      for (const pos of positions) {
        await ctx.db.delete(pos._id);
      }

      await ctx.db.delete(keyword._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Get visibility statistics for a domain
export const getVisibilityStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Get all discovered keywords for this domain with actual rankings (bestPosition !== 999)
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.neq(q.field("bestPosition"), 999)) // Exclude keywords without rankings
      .collect();

    if (discoveredKeywords.length === 0) {
      return {
        totalKeywords: 0,
        avgPosition: 0,
        top3Count: 0,
        top10Count: 0,
        top100Count: 0,
        visibilityScore: 0,
        visibilityChange: 0,
      };
    }

    // Calculate stats from discovered keywords (they already have positions)
    let totalPosition = 0;
    let positionCount = 0;
    let top3Count = 0;
    let top10Count = 0;
    let top100Count = 0;
    let visibilityScore = 0;

    for (const keyword of discoveredKeywords) {
      const pos = keyword.bestPosition;

      // Only process valid positions (1-100)
      if (pos > 0 && pos <= 100) {
        totalPosition += pos;
        positionCount++;

        if (pos <= 3) top3Count++;
        if (pos <= 10) top10Count++;
        if (pos <= 100) top100Count++;

        // Calculate visibility score weighted by position and search volume
        const positionWeight = Math.max(0, (100 - pos) / 100);
        const volumeWeight = keyword.searchVolume ? Math.log10(keyword.searchVolume + 1) : 1;
        visibilityScore += positionWeight * volumeWeight * 100;
      }
    }

    const avgPosition = positionCount > 0 ? totalPosition / positionCount : 0;

    // For now, visibilityChange is 0 (would need historical data comparison)
    const visibilityChange = 0;

    return {
      totalKeywords: discoveredKeywords.length,
      avgPosition: Math.round(avgPosition * 10) / 10,
      top3Count,
      top10Count,
      top100Count,
      visibilityScore: Math.round(visibilityScore),
      visibilityChange,
    };
  },
});

// Get top keywords by position ranges
export const getTopKeywords = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    positionRange: v.optional(v.object({
      min: v.number(),
      max: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const limit = args.limit || 10;

    // Get all discovered keywords with actual rankings (bestPosition !== 999)
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.neq(q.field("bestPosition"), 999))
      .collect();

    // Map to expected format
    const keywordsWithPositions = discoveredKeywords.map((keyword) => {
      const change = keyword.previousPosition && keyword.bestPosition
        ? keyword.previousPosition - keyword.bestPosition
        : null;

      return {
        _id: keyword._id,
        phrase: keyword.keyword,
        position: keyword.bestPosition,
        previousPosition: keyword.previousPosition || null,
        change,
        volume: keyword.searchVolume || 0,
        difficulty: keyword.difficulty || 0,
      };
    });

    // Filter by position range if provided
    let filtered = keywordsWithPositions.filter(k => k.position !== null && k.position > 0 && k.position <= 100);
    if (args.positionRange) {
      filtered = filtered.filter(k =>
        k.position !== null &&
        k.position >= args.positionRange!.min &&
        k.position <= args.positionRange!.max
      );
    }

    // Sort by position (best first) and limit
    return filtered
      .sort((a, b) => (a.position || 999) - (b.position || 999))
      .slice(0, limit);
  },
});

// =================================================================
// Automatic Domain Initialization (Keywords + Visibility)
// =================================================================

/**
 * Internal action that runs automatically after domain creation
 * Fetches initial keyword suggestions and visibility history from DataForSEO
 */
export const initializeDomainData = internalAction({
  args: {
    domainId: v.id("domains"),
    domain: v.string(),
    location: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    console.log(`[INIT] Starting automatic initialization for domain: ${args.domain} (${args.location}/${language})`);

    try {
      // Fetch visibility + history in parallel (no data dependency between them)
      // Visibility: discovered keywords the domain ranks for ($0.085)
      // History: 12 months of position distribution ($0.10)
      // Note: history is only used in the PositionHistoryChart and ForecastSummaryCard
      // dashboard views — could be lazy-loaded on first chart view instead of at init,
      // but pre-fetching gives a better first-load experience.
      console.log(`[INIT] Fetching domain visibility and history in parallel...`);

      const [visibilityResult, historyResult] = await Promise.all([
        ctx.runAction(api.dataforseo.fetchAndStoreVisibility, {
          domainId: args.domainId,
          domain: args.domain,
          location: args.location,
          language,
        }),
        ctx.runAction(api.dataforseo.fetchAndStoreVisibilityHistory, {
          domainId: args.domainId,
          domain: args.domain,
          location: args.location,
          language,
        }),
      ]);

      if (visibilityResult.success) {
        console.log(`[INIT] ✓ Successfully fetched ${visibilityResult.count || 0} discovered keywords`);
      } else {
        console.error(`[INIT] ✗ Failed to fetch visibility: ${visibilityResult.error}`);
      }

      if (historyResult.success) {
        console.log(`[INIT] ✓ Successfully fetched ${historyResult.datesStored || 0} months of visibility history`);
      } else {
        console.error(`[INIT] ✗ Failed to fetch history: ${historyResult.error}`);
      }

      // Log completion
      const successCount = (visibilityResult.success ? 1 : 0) + (historyResult.success ? 1 : 0);
      console.log(`[INIT] Initialization complete: ${successCount}/2 tasks successful`);

      // Log to system logs
      await ctx.runMutation(internal.logs.logSystemMessage, {
        level: successCount === 2 ? "info" : "warning",
        message: `Domain initialization for ${args.domain}: ${successCount}/2 tasks successful (discovered ${visibilityResult.count || 0} keywords, ${historyResult.datesStored || 0} months history)`,
        eventType: "domain_initialization",
      });

    } catch (error) {
      console.error(`[INIT] Error during domain initialization:`, error);

      // Log error to system logs
      await ctx.runMutation(internal.logs.logSystemMessage, {
        level: "error",
        message: `Domain initialization failed for ${args.domain}: ${error instanceof Error ? error.message : "Unknown error"}`,
        eventType: "domain_initialization_error",
      });
    }
  },
});

// Save business context from onboarding wizard (public, auth-checked)
export const saveBusinessContextPublic = mutation({
  args: {
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }

    await requirePermission(ctx, "domains.edit", context);

    await ctx.db.patch(args.domainId, {
      businessDescription: args.businessDescription,
      targetCustomer: args.targetCustomer,
    });
  },
});

// Save business context to domain for auto-fill across AI features
export const saveBusinessContext = internalMutation({
  args: {
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.domainId, {
      businessDescription: args.businessDescription,
      targetCustomer: args.targetCustomer,
    });
  },
});

const PAGE_CONTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Return cached homepage content if it exists and is less than 24 hours old.
 */
export const getCachedPageContent = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (
      domain?.cachedPageContent &&
      domain.cachedPageContentAt &&
      Date.now() - domain.cachedPageContentAt < PAGE_CONTENT_CACHE_TTL_MS
    ) {
      return domain.cachedPageContent;
    }
    return null;
  },
});

/**
 * Store scraped homepage content on the domain record for caching.
 */
export const cachePageContent = internalMutation({
  args: {
    domainId: v.id("domains"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.domainId, {
      cachedPageContent: args.content,
      cachedPageContentAt: Date.now(),
    });
  },
});
