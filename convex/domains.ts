import { v } from "convex/values";
import { mutation, query, action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { checkKeywordLimit } from "./limits";
import type { Id } from "./_generated/dataModel";
import { requirePermission, getOrgFromProject, getContextFromDomain } from "./permissions";

// Get domains for a project
export const getDomains = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get keyword count and average position for each domain
    const domainsWithStats = await Promise.all(
      domains.map(async (domain) => {
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        // Calculate average position
        let totalPosition = 0;
        let positionCount = 0;

        await Promise.all(
          keywords.map(async (keyword) => {
            const latestPosition = await ctx.db
              .query("keywordPositions")
              .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
              .order("desc")
              .first();

            if (latestPosition?.position) {
              totalPosition += latestPosition.position;
              positionCount++;
            }
          })
        );

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

    return await ctx.db.insert("domains", {
      projectId: args.projectId,
      domain: args.domain,
      settings: args.settings,
      createdAt: Date.now(),
    });
  },
});

// Update domain
export const updateDomain = mutation({
  args: {
    domainId: v.id("domains"),
    domain: v.optional(v.string()),
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

    // Get permission context
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }

    // Check permission
    await requirePermission(ctx, "domains.edit", context);

    const updates: Record<string, unknown> = {};
    if (args.domain) updates.domain = args.domain;
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

    for (const id of args.keywordIds) {
      await ctx.db.patch(id, { status: "ignored" });
    }
  },
});

// Get count of discovered keywords by status
export const getDiscoveredKeywordsCount = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
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
    const limit = args.limit || 100;
    const backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .take(limit);

    // Sort by inlinkRank descending (best first)
    return backlinks.sort((a, b) => (b.inlinkRank || 0) - (a.inlinkRank || 0));
  },
});

// Get position distribution for a domain (for histogram chart)
export const getPositionDistribution = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Count keywords in each position bucket
    const buckets = {
      "1-3": 0,
      "4-10": 0,
      "11-20": 0,
      "21-50": 0,
      "51-100": 0,
      "100+": 0,
    };

    for (const keyword of keywords) {
      const latestPosition = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .first();

      if (latestPosition?.position) {
        const pos = latestPosition.position;
        if (pos >= 1 && pos <= 3) buckets["1-3"]++;
        else if (pos >= 4 && pos <= 10) buckets["4-10"]++;
        else if (pos >= 11 && pos <= 20) buckets["11-20"]++;
        else if (pos >= 21 && pos <= 50) buckets["21-50"]++;
        else if (pos >= 51 && pos <= 100) buckets["51-100"]++;
        else if (pos > 100) buckets["100+"]++;
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

// =================================================================
// Bulk Domain Checking
// =================================================================

// Check rankings for all domains in a project
export const checkAllDomainsForProject = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{
    success: boolean;
    totalDomains: number;
    successCount: number;
    failureCount: number;
    totalKeywords: number;
    errors: Array<{ domainName: string; error: string }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get all domains for the project
    const domains = await ctx.runQuery(internal.domains.getDomainsInternal, {
      projectId: args.projectId,
    });

    let successCount = 0;
    let failureCount = 0;
    let totalKeywords = 0;
    const errors: Array<{ domainName: string; error: string }> = [];

    console.log(`[checkAllDomainsForProject] Checking ${domains.length} domains for project ${args.projectId}`);

    // Check each domain sequentially
    for (const domain of domains) {
      try {
        // Get keywords for this domain
        const keywords = await ctx.runQuery(internal.scheduler.getDomainKeywords, {
          domainId: domain._id,
        });

        if (keywords.length === 0) {
          console.log(`[checkAllDomainsForProject] Skipping domain ${domain.domain} - no active keywords`);
          continue;
        }

        console.log(`[checkAllDomainsForProject] Checking ${keywords.length} keywords for domain ${domain.domain}`);

        // Call fetchPositions action
        const result = await ctx.runAction(internal.dataforseo.fetchPositionsInternal, {
          domainId: domain._id,
          keywords: keywords.map((k: { _id: Id<"keywords">; phrase: string }) => ({ id: k._id, phrase: k.phrase })),
          domain: domain.domain,
          searchEngine: domain.settings.searchEngine,
          location: domain.settings.location,
          language: domain.settings.language,
        });

        if (result.success) {
          successCount++;
          totalKeywords += keywords.length;

          // Update lastRefreshedAt
          await ctx.runMutation(internal.domains.markRefreshedInternal, {
            domainId: domain._id,
          });

          console.log(`[checkAllDomainsForProject] Successfully checked domain ${domain.domain}`);
        } else {
          failureCount++;
          errors.push({
            domainName: domain.domain,
            error: result.error || "Unknown error",
          });

          console.error(`[checkAllDomainsForProject] Failed to check domain ${domain.domain}:`, result.error);
        }
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({
          domainName: domain.domain,
          error: errorMessage,
        });

        console.error(`[checkAllDomainsForProject] Error checking domain ${domain.domain}:`, error);

        // Log to system logs
        await ctx.runMutation(internal.logs.logSystemMessage, {
          level: "error",
          message: `Failed to check domain ${domain.domain}: ${errorMessage}`,
          eventType: "bulk_domain_check_error",
        });
      }
    }

    console.log(`[checkAllDomainsForProject] Complete: ${successCount} successful, ${failureCount} failed, ${totalKeywords} keywords updated`);

    return {
      success: successCount > 0,
      totalDomains: domains.length,
      successCount,
      failureCount,
      totalKeywords,
      errors,
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
