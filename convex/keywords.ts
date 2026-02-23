import { v } from "convex/values";
import { action, mutation, query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { checkKeywordLimit, checkRefreshLimits } from "./limits";
import { requirePermission, requireTenantAccess, getContextFromDomain, getContextFromKeyword } from "./permissions";
import { isValidKeywordPhrase } from "./lib/keywordValidation";
import { getSupabaseAdmin } from "./lib/supabase";

// CTR curve based on organic search position (industry standard)
function getCTRForPosition(position: number): number {
  const ctrMap: Record<number, number> = {
    1: 0.285, 2: 0.157, 3: 0.110, 4: 0.080, 5: 0.072,
    6: 0.051, 7: 0.040, 8: 0.032, 9: 0.028, 10: 0.025,
  };

  if (position <= 10) return ctrMap[position] || 0;
  if (position <= 20) return 0.015;
  if (position <= 50) return 0.005;
  if (position <= 100) return 0.001;
  return 0;
}

// Get keywords for a domain (uses denormalized position data — single query, no N+1)
export const getKeywords = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return keywords.map((keyword) => ({
      ...keyword,
      currentPosition: keyword.currentPosition ?? null,
      url: keyword.currentUrl ?? null,
      searchVolume: keyword.searchVolume,
      difficulty: keyword.difficulty,
      lastUpdated: keyword.lastUpdated ?? keyword.positionUpdatedAt,
      change: keyword.positionChange ?? null,
      checkingStatus: keyword.checkingStatus,
      checkJobId: keyword.checkJobId,
    }));
  },
});

// Get keyword with history (action — reads history from Supabase)
export const getKeywordWithHistory = action({
  args: {
    keywordId: v.id("keywords"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth + fetch keyword via internal query
    const keyword: any = await ctx.runQuery(internal.lib.analyticsHelpers.verifyKeywordAccess, {
      keywordId: args.keywordId,
    });
    if (!keyword) return null;

    const daysToFetch = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Use denormalized fields for current/previous/change
    const currentPosition = keyword.currentPosition ?? null;
    const change = keyword.positionChange ?? null;

    // Fetch history from Supabase
    let history: Array<{ date: string; position: number | null; url: string | null; searchVolume?: number | null; difficulty?: number | null; cpc?: number | null; fetchedAt?: string }> = [];
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data, error } = await sb
        .from("keyword_positions")
        .select("date, position, url, search_volume, difficulty, cpc, created_at")
        .eq("convex_keyword_id", args.keywordId)
        .gte("date", startDateStr)
        .order("date", { ascending: true });

      if (!error && data) {
        history = data.map((row) => ({
          date: row.date,
          position: row.position,
          url: row.url,
          searchVolume: row.search_volume,
          difficulty: row.difficulty,
          cpc: row.cpc,
          fetchedAt: row.created_at,
        }));
      }
    }

    return {
      ...keyword,
      currentPosition,
      rankingUrl: keyword.currentUrl ?? null,
      searchVolume: keyword.searchVolume,
      difficulty: keyword.difficulty,
      lastUpdated: keyword.positionUpdatedAt,
      change,
      history,
    };
  },
});

// Get position distribution across ranking ranges (uses denormalized currentPosition on keywords table)
export const getPositionDistribution = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const allDiscovered = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const discoveredMap = new Map<string, typeof allDiscovered[0]>();
    for (const dk of allDiscovered) {
      discoveredMap.set(dk.keyword, dk);
    }

    const distribution = {
      top3: 0,
      pos4_10: 0,
      pos11_20: 0,
      pos21_50: 0,
      pos51_100: 0,
      pos100plus: 0,
    };

    for (const keyword of keywords) {
      const discovered = discoveredMap.get(keyword.phrase);
      const pos = keyword.currentPosition ??
        (discovered?.bestPosition && discovered.bestPosition !== 999
          ? discovered.bestPosition
          : null);
      if (pos == null) continue;

      if (pos > 0 && pos <= 3) distribution.top3++;
      else if (pos > 3 && pos <= 10) distribution.pos4_10++;
      else if (pos > 10 && pos <= 20) distribution.pos11_20++;
      else if (pos > 20 && pos <= 50) distribution.pos21_50++;
      else if (pos > 50 && pos <= 100) distribution.pos51_100++;
      else if (pos > 100) distribution.pos100plus++;
    }

    return distribution;
  },
});

// Get movement trend over time (gainers vs losers per day)
// Uses monitoring data (keywords.recentPositions) — NOT domainVisibilityHistory
export const getMovementTrend = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const active = keywords.filter((k) => k.status === "active");

    // Collect all dates present across all keywords' recentPositions
    // For each keyword, build a date→position map from recentPositions
    const dateGainers = new Map<string, number>();
    const dateLosers = new Map<string, number>();

    for (const kw of active) {
      const recent = kw.recentPositions ?? [];
      if (recent.length < 2) continue;

      // Compare each consecutive pair to determine gainer/loser on that date
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1];
        const curr = recent[i];
        if (prev.position == null || curr.position == null) continue;

        const date = curr.date;
        if (curr.position < prev.position) {
          dateGainers.set(date, (dateGainers.get(date) ?? 0) + 1);
        } else if (curr.position > prev.position) {
          dateLosers.set(date, (dateLosers.get(date) ?? 0) + 1);
        }
      }
    }

    // Merge all dates and return sorted
    const allDates = new Set([...dateGainers.keys(), ...dateLosers.keys()]);
    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date: new Date(date).getTime(),
        gainers: dateGainers.get(date) ?? 0,
        losers: dateLosers.get(date) ?? 0,
      }));
  },
});

// Internal query to verify domain access from actions (actions can't use requireTenantAccess directly)
export const _verifyDomainAccess = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;
    try {
      await requireTenantAccess(ctx, "domain", args.domainId);
      return true;
    } catch {
      return false;
    }
  },
});

// Movement trend from Supabase (full history, not limited to 7 days)
export const getMovementTrendSupabase = action({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await ctx.runQuery(internal.keywords._verifyDomainAccess, { domainId: args.domainId });
    if (!hasAccess) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const days = args.days ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const { data, error } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, date, position")
      .eq("convex_domain_id", args.domainId)
      .gte("date", cutoff)
      .not("position", "is", null)
      .order("convex_keyword_id")
      .order("date", { ascending: true });

    if (error || !data) return [];

    // Group by keyword, then compare consecutive days
    const dateGainers = new Map<string, number>();
    const dateLosers = new Map<string, number>();

    const byKeyword = new Map<string, Array<{ date: string; position: number }>>();
    for (const row of data) {
      if (row.position == null) continue;
      const arr = byKeyword.get(row.convex_keyword_id);
      const entry = { date: row.date, position: row.position };
      if (arr) arr.push(entry);
      else byKeyword.set(row.convex_keyword_id, [entry]);
    }

    for (const positions of byKeyword.values()) {
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];
        if (curr.position < prev.position) {
          dateGainers.set(curr.date, (dateGainers.get(curr.date) ?? 0) + 1);
        } else if (curr.position > prev.position) {
          dateLosers.set(curr.date, (dateLosers.get(curr.date) ?? 0) + 1);
        }
      }
    }

    const allDates = new Set([...dateGainers.keys(), ...dateLosers.keys()]);
    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date: new Date(date).getTime(),
        gainers: dateGainers.get(date) ?? 0,
        losers: dateLosers.get(date) ?? 0,
      }));
  },
});

// Get monitoring statistics for overview cards (uses denormalized data — single query, no N+1)
export const getMonitoringStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const allDiscovered = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const discoveredMap = new Map<string, typeof allDiscovered[0]>();
    for (const dk of allDiscovered) {
      discoveredMap.set(dk.keyword, dk);
    }

    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let totalPosition = 0;
    let positionCount = 0;
    let totalPositionSevenDaysAgo = 0;
    let positionCountSevenDaysAgo = 0;
    let estimatedMonthlyTraffic = 0;
    let gainers = 0;
    let losers = 0;
    let stable = 0;

    for (const keyword of keywords) {
      const discovered = discoveredMap.get(keyword.phrase);
      const currentPos = keyword.currentPosition ??
        (discovered?.bestPosition && discovered.bestPosition !== 999
          ? discovered.bestPosition
          : null);

      if (currentPos != null && currentPos !== null) {
        totalPosition += currentPos;
        positionCount++;

        if (currentPos <= 50 && keyword.searchVolume) {
          estimatedMonthlyTraffic += keyword.searchVolume * getCTRForPosition(currentPos);
        }
      }

      // Use recentPositions for 7-day comparison (no DB query needed)
      const recent = keyword.recentPositions ?? [];
      if (recent.length >= 2) {
        // Filter to entries within the last 7 days
        const weekEntries = recent.filter((p) => p.date >= sevenDaysAgoStr);
        if (weekEntries.length >= 2) {
          const oldPos = weekEntries[0].position;
          const newPos = weekEntries[weekEntries.length - 1].position;

          if (oldPos !== null && newPos !== null) {
            totalPositionSevenDaysAgo += oldPos;
            positionCountSevenDaysAgo++;

            if (newPos < oldPos) gainers++;
            else if (newPos > oldPos) losers++;
            else stable++;
          }
        }
      }
    }

    const avgPosition = positionCount > 0 ? totalPosition / positionCount : 0;
    const avgPositionSevenDaysAgo = positionCountSevenDaysAgo > 0
      ? totalPositionSevenDaysAgo / positionCountSevenDaysAgo
      : 0;
    const avgPositionChange7d = avgPositionSevenDaysAgo > 0
      ? avgPositionSevenDaysAgo - avgPosition
      : 0;

    return {
      totalKeywords: keywords.length,
      avgPosition: Math.round(avgPosition * 10) / 10,
      avgPositionChange7d: Math.round(avgPositionChange7d * 10) / 10,
      estimatedMonthlyTraffic: Math.round(estimatedMonthlyTraffic),
      movementBreakdown: { gainers, losers, stable },
      netMovement7d: gainers - losers,
    };
  },
});

// Get keyword monitoring data with sparklines and status
// Optimized: batch-fetches discoveredKeywords once, uses denormalized position data
// Reduced from ~4 queries/keyword to ~0 queries/keyword (uses recentPositions from keyword record)
export const getKeywordMonitoring = query({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .take(args.limit ?? 100);

    // Batch: fetch ALL discoveredKeywords for domain once, build a Map by phrase
    const allDiscovered = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const discoveredMap = new Map<string, typeof allDiscovered[0]>();
    for (const dk of allDiscovered) {
      discoveredMap.set(dk.keyword, dk);
    }

    return keywords.map((keyword) => {
      const discovered = discoveredMap.get(keyword.phrase) ?? null;

      // Use denormalized position data (no DB queries needed)
      const currentPosition = keyword.currentPosition ??
        (discovered?.bestPosition && discovered.bestPosition !== 999
          ? discovered.bestPosition
          : null);

      // Previous position: denormalized, then fall back to discoveredKeywords
      let previousPosition: number | null = keyword.previousPosition ?? null;
      if (previousPosition == null) {
        if (discovered?.previousPosition != null && discovered.previousPosition !== 999) {
          previousPosition = discovered.previousPosition;
        } else if (discovered?.previousRankAbsolute != null && discovered.previousRankAbsolute !== 999) {
          previousPosition = discovered.previousRankAbsolute;
        }
      }

      // Change: denormalized first, then discoveredKeywords fallback
      let change: number | null = keyword.positionChange ?? null;
      if (change == null) {
        if (currentPosition != null && previousPosition != null) {
          change = previousPosition - currentPosition;
        } else if (discovered?.isUp) {
          change = 1;
        } else if (discovered?.isDown) {
          change = -1;
        }
      }

      // Status
      let status: "rising" | "stable" | "falling" | "new" = "stable";
      if (discovered?.isNew || (!keyword.positionUpdatedAt && discovered)) {
        status = "new";
      } else if (change && change > 0) {
        status = "rising";
      } else if (change && change < 0) {
        status = "falling";
      }

      // Potential traffic
      const sv = discovered?.searchVolume || keyword.searchVolume || null;
      const potential = currentPosition != null && sv
        ? Math.round(sv * getCTRForPosition(currentPosition))
        : null;

      // Sparkline from denormalized recentPositions (no DB query needed)
      const positionHistory = (keyword.recentPositions ?? []).map((p) => ({
        date: new Date(p.date).getTime(),
        position: p.position,
      }));

      return {
        keywordId: keyword._id,
        domainId: keyword.domainId,
        phrase: keyword.phrase,
        currentPosition,
        previousPosition,
        change,
        status,
        searchVolume: discovered?.searchVolume || keyword.searchVolume || null,
        difficulty: discovered?.difficulty || keyword.difficulty || null,
        url: keyword.currentUrl || discovered?.url || null,
        positionHistory,
        lastUpdated: keyword.positionUpdatedAt || keyword._creationTime,
        potential,
        checkingStatus: keyword.checkingStatus,

        // Rich data from discoveredKeywords
        cpc: discovered?.cpc || keyword.latestCpc || null,
        etv: discovered?.etv || null,
        competition: discovered?.competition || null,
        competitionLevel: discovered?.competitionLevel || null,
        intent: discovered?.intent || null,
        serpFeatures: discovered?.serpFeatures || null,
        estimatedPaidTrafficCost: discovered?.estimatedPaidTrafficCost || null,
        monthlySearches: discovered?.monthlySearches || null,
        isNew: discovered?.isNew || null,
        isUp: discovered?.isUp || null,
        isDown: discovered?.isDown || null,
        proposedBy: keyword.proposedBy || null,
      };
    });
  },
});

// Get recent keyword position changes (for recent changes table)
// Optimized: for 7-day window uses denormalized recentPositions (zero DB queries per keyword)
export const getRecentChanges = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const daysAgo = args.days || 7;
    const limit = args.limit || 10;
    const cutoffStr = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const useRecentPositions = daysAgo <= 7;

    const changes: {
      keywordId: typeof keywords[0]["_id"];
      phrase: string;
      oldPosition: number;
      newPosition: number;
      change: number;
      searchVolume: number | undefined;
      url: string | null | undefined;
    }[] = [];

    for (const keyword of keywords) {
      const currentPos = keyword.currentPosition;
      if (currentPos == null) continue;

      let oldPos: number | null = null;

      if (useRecentPositions) {
        const recent = keyword.recentPositions ?? [];
        const old = recent.find((p) => p.date <= cutoffStr);
        oldPos = old?.position ?? null;
      } else {
        // Fall back to DB for longer periods
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .order("desc")
          .take(50);
        const old = positions.find((p) => p.date <= cutoffStr);
        oldPos = old?.position ?? null;
      }

      if (oldPos == null) continue;
      const change = oldPos - currentPos;
      if (change === 0) continue;

      changes.push({
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPos,
        newPosition: currentPos,
        change,
        searchVolume: keyword.searchVolume,
        url: keyword.currentUrl,
      });
    }

    changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return changes.slice(0, limit);
  },
});

// Get top gainers and losers (for performance tables)
// Optimized: for <=7 day window uses denormalized data; longer periods still need DB queries
export const getTopPerformers = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const daysAgo = args.days || 30;
    const limit = args.limit || 10;
    const cutoffStr = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const useRecentPositions = daysAgo <= 7;

    type ChangeEntry = {
      keywordId: typeof keywords[0]["_id"];
      phrase: string;
      oldPosition: number;
      newPosition: number;
      change: number;
      searchVolume: number | undefined;
      url: string | null | undefined;
    };

    const allChanges: ChangeEntry[] = [];

    for (const keyword of keywords) {
      const currentPos = keyword.currentPosition;
      if (currentPos == null) continue;

      let oldPos: number | null = null;

      if (useRecentPositions) {
        const recent = keyword.recentPositions ?? [];
        const old = recent.find((p) => p.date <= cutoffStr);
        oldPos = old?.position ?? null;
      } else {
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .order("desc")
          .take(100);
        const old = positions.find((p) => p.date <= cutoffStr);
        oldPos = old?.position ?? null;
      }

      if (oldPos == null) continue;
      const change = oldPos - currentPos;

      allChanges.push({
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPos,
        newPosition: currentPos,
        change,
        searchVolume: keyword.searchVolume,
        url: keyword.currentUrl,
      });
    }

    const gainers = allChanges.filter((c) => c.change > 0).sort((a, b) => b.change - a.change).slice(0, limit);
    const losers = allChanges.filter((c) => c.change < 0).sort((a, b) => a.change - b.change).slice(0, limit);

    return { gainers, losers };
  },
});

// Get top keywords by search volume (for top keywords table)
// Optimized: uses denormalized data, zero per-keyword DB queries
export const getTopKeywordsByVolume = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const limit = args.limit || 10;

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const keywordsWithData = keywords
      .filter((kw) => kw.searchVolume && kw.searchVolume > 0)
      .map((kw) => ({
        keywordId: kw._id,
        phrase: kw.phrase,
        position: kw.currentPosition,
        searchVolume: kw.searchVolume!,
        url: kw.currentUrl,
        change: kw.positionChange ?? null,
        history: (kw.recentPositions ?? []).map((p) => ({
          date: p.date,
          position: p.position,
        })),
      }))
      .sort((a, b) => b.searchVolume - a.searchVolume);

    return keywordsWithData.slice(0, limit);
  },
});

// Add keyword
export const addKeyword = mutation({
  args: {
    domainId: v.id("domains"),
    phrase: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // Check keyword limit
    const limitCheck = await checkKeywordLimit(ctx, args.domainId, 1);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.message || "Keyword limit exceeded");
    }

    // Validate phrase
    const normalized = args.phrase.toLowerCase().trim();
    const validation = isValidKeywordPhrase(normalized);
    if (!validation.valid) {
      throw new Error(validation.reason || "Invalid keyword phrase");
    }

    // Check if keyword already exists
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("phrase"), normalized))
      .unique();

    if (existing) {
      throw new Error("Keyword already exists");
    }

    return await ctx.db.insert("keywords", {
      domainId: args.domainId,
      phrase: normalized,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Add multiple keywords
export const addKeywords = mutation({
  args: {
    domainId: v.id("domains"),
    phrases: v.array(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // Filter out existing and invalid keywords to get accurate count
    const uniquePhrases: string[] = [];
    const invalidPhrases: string[] = [];
    for (const phrase of args.phrases) {
      const normalized = phrase.toLowerCase().trim();
      if (!normalized) continue;

      // Validate phrase
      const validation = isValidKeywordPhrase(normalized);
      if (!validation.valid) {
        invalidPhrases.push(normalized);
        continue;
      }

      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), normalized))
        .unique();

      if (!existing && !uniquePhrases.includes(normalized)) {
        uniquePhrases.push(normalized);
      }
    }

    // Check keyword limit for the batch
    if (uniquePhrases.length > 0) {
      const limitCheck = await checkKeywordLimit(ctx, args.domainId, uniquePhrases.length);
      if (!limitCheck.allowed) {
        const canAdd = limitCheck.remaining ?? 0;
        throw new Error(
          `Przekroczono limit fraz. Limit: ${limitCheck.limit}, obecnie: ${limitCheck.currentCount}, można dodać: ${canAdd}, próbujesz dodać: ${uniquePhrases.length}`
        );
      }
    }

    // Insert the unique phrases
    const results = [];
    for (const normalized of uniquePhrases) {
      const id = await ctx.db.insert("keywords", {
        domainId: args.domainId,
        phrase: normalized,
        status: "active",
        createdAt: Date.now(),
        ...(args.source ? { proposedBy: args.source } : {}),
      });
      results.push(id);
    }

    return results;
  },
});

// Update keyword status
export const updateKeywordStatus = mutation({
  args: {
    keywordId: v.id("keywords"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("pending_approval")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) throw new Error("Keyword not found");
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    // Check permission
    const context = await getContextFromKeyword(ctx, args.keywordId);
    if (!context) {
      throw new Error("Keyword not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    await ctx.db.patch(args.keywordId, {
      status: args.status,
    });

    return args.keywordId;
  },
});

// Delete keyword
export const deleteKeyword = mutation({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) throw new Error("Keyword not found");
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    // Check permission
    const context = await getContextFromKeyword(ctx, args.keywordId);
    if (!context) {
      throw new Error("Keyword not found");
    }
    await requirePermission(ctx, "keywords.remove", context);

    // Delete positions
    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .collect();

    for (const pos of positions) {
      await ctx.db.delete(pos._id);
    }

    await ctx.db.delete(args.keywordId);
  },
});

// Delete multiple keywords (bulk operation)
export const deleteKeywords = mutation({
  args: { keywordIds: v.array(v.id("keywords")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation: check first keyword's domain
    if (args.keywordIds.length > 0) {
      const firstKw = await ctx.db.get(args.keywordIds[0]);
      if (firstKw) {
        await requireTenantAccess(ctx, "domain", firstKw.domainId);
      }
    }

    for (const keywordId of args.keywordIds) {
      // Check permission for each keyword
      const context = await getContextFromKeyword(ctx, keywordId);
      if (!context) {
        continue; // Skip if keyword not found
      }
      await requirePermission(ctx, "keywords.remove", context);

      // Delete positions
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
        .collect();

      for (const pos of positions) {
        await ctx.db.delete(pos._id);
      }

      await ctx.db.delete(keywordId);
    }
  },
});

// Store position data (called by DataForSEO integration)
// Also maintains denormalized position data on the keyword record
export const storePosition = mutation({
  args: {
    keywordId: v.id("keywords"),
    date: v.string(),
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    searchVolume: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    cpc: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const kw = await ctx.db.get(args.keywordId);
    if (!kw) throw new Error("Keyword not found");
    await requireTenantAccess(ctx, "domain", kw.domainId);

    // Check if position for this date already exists
    const existing = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword_date", (q) =>
        q.eq("keywordId", args.keywordId).eq("date", args.date)
      )
      .unique();

    let positionId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        position: args.position,
        url: args.url,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        cpc: args.cpc,
        fetchedAt: Date.now(),
      });
      positionId = existing._id;
    } else {
      positionId = await ctx.db.insert("keywordPositions", {
        keywordId: args.keywordId,
        date: args.date,
        position: args.position,
        url: args.url,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        cpc: args.cpc,
        fetchedAt: Date.now(),
      });
    }

    // Denormalize: update keyword record with current position data
    const keyword = await ctx.db.get(args.keywordId);
    if (keyword) {
      const oldPosition = keyword.currentPosition;
      const recentPositions = keyword.recentPositions ?? [];

      // Update recentPositions: add/replace entry for this date, keep last 7 by date
      const filtered = recentPositions.filter((p) => p.date !== args.date);
      filtered.push({ date: args.date, position: args.position });
      filtered.sort((a, b) => a.date.localeCompare(b.date));
      const trimmed = filtered.slice(-7);

      // Determine current and previous from the sorted recent list
      const latestEntry = trimmed[trimmed.length - 1];
      const prevEntry = trimmed.length >= 2 ? trimmed[trimmed.length - 2] : null;

      const currentPos = latestEntry?.position ?? null;
      const previousPos = prevEntry?.position ?? oldPosition ?? null;
      const change = (currentPos != null && previousPos != null)
        ? previousPos - currentPos
        : null;

      await ctx.db.patch(args.keywordId, {
        currentPosition: currentPos,
        previousPosition: previousPos,
        positionChange: change,
        currentUrl: args.url,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        latestCpc: args.cpc,
        positionUpdatedAt: Date.now(),
        recentPositions: trimmed,
      });
    }

    return positionId;
  },
});

// Repair denormalization drift for a single domain.
// Reads keywordPositions for each keyword with missing/stale denormalized data,
// then patches the keyword record with correct currentPosition, recentPositions, etc.
export const repairDenormalization = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    let repaired = 0;
    let noPositionRecords = 0;
    let alreadyCorrect = 0;
    let positionsWereNull = 0;
    let positionsFixed = 0;

    for (const keyword of keywords) {
      // Get latest 7 positions sorted by date
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword_date", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(7);

      if (positions.length === 0) {
        noPositionRecords++;
        continue;
      }

      // Sort ascending by date for recentPositions
      const sorted = [...positions].sort((a, b) => a.date.localeCompare(b.date));
      const recentPositions = sorted.map((p) => ({
        date: p.date,
        position: p.position,
      }));

      const latest = sorted[sorted.length - 1];
      const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

      const currentPos = latest.position;
      const previousPos = prev?.position ?? null;
      const change =
        currentPos != null && previousPos != null
          ? previousPos - currentPos
          : null;

      // Check if repair is needed
      const needsRepair =
        keyword.currentPosition !== currentPos ||
        (keyword.recentPositions ?? []).length !== recentPositions.length;

      if (!needsRepair) {
        alreadyCorrect++;
        continue;
      }

      await ctx.db.patch(keyword._id, {
        currentPosition: currentPos,
        previousPosition: previousPos,
        positionChange: change,
        currentUrl: latest.url,
        positionUpdatedAt: latest.fetchedAt ?? Date.now(),
        recentPositions,
      });

      if (currentPos == null) {
        positionsWereNull++;
      } else {
        positionsFixed++;
      }
      repaired++;
    }

    console.log(`[repairDenormalization] domain=${args.domainId}: total=${keywords.length}, repaired=${repaired} (fixed=${positionsFixed}, null=${positionsWereNull}), correct=${alreadyCorrect}, noRecords=${noPositionRecords}`);
    return { domainId: args.domainId, totalKeywords: keywords.length, repaired, positionsFixed, positionsWereNull, alreadyCorrect, noPositionRecords };
  },
});

// Repair denormalization across all domains in the system
export const repairAllDenormalization = internalAction({
  handler: async (ctx): Promise<Array<{ domain: string; totalKeywords: number; repaired: number }>> => {
    const domains = await ctx.runQuery(internal.keywords.listAllDomainIds);

    const results: Array<{ domain: string; totalKeywords: number; repaired: number }> = [];
    for (const domain of domains) {
      const result = await ctx.runMutation(internal.keywords.repairDenormalization, {
        domainId: domain._id,
      });
      results.push({ domain: domain.domain, ...result });
    }

    return results;
  },
});

// Helper: list all domain IDs (for repair action)
export const listAllDomainIds = internalQuery({
  handler: async (ctx) => {
    const domains = await ctx.db.query("domains").collect();
    return domains.map((d) => ({ _id: d._id, domain: d.domain }));
  },
});

// Queue keywords for position refresh (bulk operation)
export const refreshKeywordPositions = mutation({
  args: { keywordIds: v.array(v.id("keywords")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.keywordIds.length === 0) {
      throw new Error("No keywords selected");
    }

    // Get the first keyword to find the domain
    const firstKeyword = await ctx.db.get(args.keywordIds[0]);
    if (!firstKeyword) {
      throw new Error("Keyword not found");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", firstKeyword.domainId);

    // Verify all keywords belong to the same domain
    const domainId = firstKeyword.domainId;
    for (const keywordId of args.keywordIds) {
      const keyword = await ctx.db.get(keywordId);
      if (!keyword || keyword.domainId !== domainId) {
        throw new Error("All keywords must belong to the same domain");
      }
    }

    // Check permission
    const context = await getContextFromKeyword(ctx, args.keywordIds[0]);
    if (!context) {
      throw new Error("Context not found");
    }
    await requirePermission(ctx, "keywords.refresh", context);

    // Get userId for per-user rate limiting and job tracking
    const userId = await auth.getUserId(ctx);

    // Check refresh rate limits (cooldown + daily quota + per-user + per-project + per-domain + bulk cap)
    await checkRefreshLimits(ctx, domainId, userId, args.keywordIds.length);

    // Create a check job for these keywords
    const jobId = await ctx.db.insert("keywordCheckJobs", {
      domainId,
      createdBy: userId ?? undefined,
      status: "pending",
      totalKeywords: args.keywordIds.length,
      processedKeywords: 0,
      failedKeywords: 0,
      keywordIds: args.keywordIds,
      createdAt: Date.now(),
    });

    // Update each keyword's checking status
    for (const keywordId of args.keywordIds) {
      await ctx.db.patch(keywordId, {
        checkingStatus: "queued",
        checkJobId: jobId,
      });
    }

    // Schedule background processing
    await ctx.scheduler.runAfter(0, internal.keywordCheckJobs.processKeywordCheckJobInternal, {
      jobId,
    });

    return jobId;
  },
});

// Clear all checking statuses (for debugging/cleanup)
export const clearAllCheckingStatuses = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    let cleared = 0;
    for (const keyword of keywords) {
      if (keyword.checkingStatus) {
        await ctx.db.patch(keyword._id, {
          checkingStatus: undefined,
          checkJobId: undefined,
        });
        cleared++;
      }
    }

    return { cleared };
  },
});

// Bulk import keywords with detailed results
export const importKeywords = mutation({
  args: {
    domainId: v.id("domains"),
    keywords: v.array(v.object({
      phrase: v.string(),
      searchEngine: v.optional(v.string()),
      location: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Tenant isolation
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    const results = {
      imported: [] as string[],
      duplicates: [] as string[],
      errors: [] as { phrase: string; error: string }[],
      total: args.keywords.length,
    };

    // Normalize and deduplicate input
    const uniquePhrases = new Map<string, typeof args.keywords[0]>();
    for (const kw of args.keywords) {
      const normalized = kw.phrase.toLowerCase().trim();
      if (!normalized) continue;
      if (!uniquePhrases.has(normalized)) {
        uniquePhrases.set(normalized, { ...kw, phrase: normalized });
      }
    }

    // Check for existing keywords
    const phrasesArray = Array.from(uniquePhrases.entries());
    for (const [normalized, kw] of phrasesArray) {
      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), normalized))
        .unique();

      if (existing) {
        results.duplicates.push(kw.phrase);
        uniquePhrases.delete(normalized);
      }
    }

    // Check keyword limit for remaining keywords
    const toImport = Array.from(uniquePhrases.values());
    if (toImport.length > 0) {
      const limitCheck = await checkKeywordLimit(ctx, args.domainId, toImport.length);
      if (!limitCheck.allowed) {
        const canAdd = limitCheck.remaining ?? 0;
        throw new Error(
          `Keyword limit exceeded. Limit: ${limitCheck.limit}, current: ${limitCheck.currentCount}, can add: ${canAdd}, trying to add: ${toImport.length}`
        );
      }
    }

    // Insert keywords
    for (const kw of toImport) {
      try {
        await ctx.db.insert("keywords", {
          domainId: args.domainId,
          phrase: kw.phrase,
          status: "active",
          createdAt: Date.now(),
        });
        results.imported.push(kw.phrase);
      } catch (error) {
        results.errors.push({
          phrase: kw.phrase,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});

/**
 * Internal query to get a keyword by ID
 */
export const getKeywordInternal = internalQuery({
  args: {
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.keywordId);
  },
});

/**
 * Batch fetch keywords by IDs (single query instead of N individual fetches).
 * Uses Promise.all with ctx.db.get() since Convex has no WHERE IN.
 */
export const getKeywordsByIdsBatch = internalQuery({
  args: {
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.keywordIds.map((id) => ctx.db.get(id))
    );
    // Filter out nulls (deleted keywords)
    return results.filter((k): k is NonNullable<typeof k> => k !== null);
  },
});

/**
 * Batch update keyword checking status (single mutation instead of N individual patches).
 */
export const updateKeywordStatusBatch = internalMutation({
  args: {
    updates: v.array(v.object({
      keywordId: v.id("keywords"),
      status: v.union(
        v.literal("queued"),
        v.literal("checking"),
        v.literal("completed"),
        v.literal("failed")
      ),
    })),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      await ctx.db.patch(update.keywordId, {
        checkingStatus: update.status,
      });
    }
  },
});

/**
 * Internal query to get all monitored keywords for a domain
 */
export const getMonitoredKeywordsInternal = internalQuery({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return keywords.map((kw) => ({
      _id: kw._id,
      phrase: kw.phrase,
    }));
  },
});

/**
 * Internal query to get keyword by phrase
 */
export const getKeywordByPhraseInternal = internalQuery({
  args: {
    domainId: v.id("domains"),
    phrase: v.string(),
  },
  handler: async (ctx, args) => {
    const keyword = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("phrase"), args.phrase))
      .first();

    return keyword;
  },
});

/**
 * Internal mutation to create a keyword
 */
export const createKeywordInternal = internalMutation({
  args: {
    domainId: v.id("domains"),
    phrase: v.string(),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("pending_approval")),
    searchVolume: v.optional(v.number()),
    difficulty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only enforce limit for active keywords (paused/pending don't count toward limit)
    if (args.status === "active") {
      const limitCheck = await checkKeywordLimit(ctx, args.domainId);
      if (!limitCheck.allowed) {
        console.log(`[createKeywordInternal] Keyword limit reached for domain ${args.domainId}: ${limitCheck.currentCount}/${limitCheck.limit}`);
        return null;
      }
    }

    const keywordId = await ctx.db.insert("keywords", {
      domainId: args.domainId,
      phrase: args.phrase,
      status: args.status,
      createdAt: Date.now(),
      searchVolume: args.searchVolume,
      difficulty: args.difficulty,
    });

    return keywordId;
  },
});

/**
 * Get full position history for a keyword (action — reads from Supabase).
 * Used in the keyword detail modal for a complete chart (not just 7-day sparkline).
 */
export const getPositionHistory = action({
  args: {
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    // Auth via internal query
    const keyword = await ctx.runQuery(internal.lib.analyticsHelpers.verifyKeywordAccess, {
      keywordId: args.keywordId,
    });
    if (!keyword) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const { data, error } = await sb
      .from("keyword_positions")
      .select("date, position")
      .eq("convex_keyword_id", args.keywordId)
      .not("position", "is", null)
      .order("date", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      date: new Date(row.date).getTime(),
      position: row.position as number,
    }));
  },
});

/**
 * Query to get SERP results for a keyword
 */
export const getSerpResultsForKeyword = query({
  args: {
    keywordId: v.id("keywords"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return null;
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    const limit = args.limit || 10;

    // Get the most recent SERP results for this keyword
    const results = await ctx.db
      .query("keywordSerpResults")
      .withIndex("by_keyword_date", (q) => q.eq("keywordId", args.keywordId))
      .order("desc")
      .take(100);

    if (results.length === 0) {
      return null;
    }

    // Group by date and get the most recent date
    const latestDate = results[0].date;
    const latestResults = results.filter((r) => r.date === latestDate);

    // Sort by position and take top N
    const topResults = latestResults
      .sort((a, b) => a.position - b.position)
      .slice(0, limit);

    return {
      date: latestDate,
      fetchedAt: results[0].fetchedAt,
      results: topResults.map((r) => ({
        // Ranking info
        position: r.position,
        rankGroup: r.rankGroup,
        rankAbsolute: r.rankAbsolute,

        // Basic info
        domain: r.domain,
        url: r.url,
        title: r.title,
        description: r.description,
        breadcrumb: r.breadcrumb,
        websiteName: r.websiteName,
        relativeUrl: r.relativeUrl,
        mainDomain: r.mainDomain,

        // Highlighted text
        highlighted: r.highlighted,

        // Sitelinks
        sitelinks: r.sitelinks,

        // Traffic & Value
        etv: r.etv,
        estimatedPaidTrafficCost: r.estimatedPaidTrafficCost,

        // SERP Features
        isFeaturedSnippet: r.isFeaturedSnippet,
        isMalicious: r.isMalicious,
        isWebStory: r.isWebStory,
        ampVersion: r.ampVersion,

        // Rating
        rating: r.rating,

        // Price
        price: r.price,

        // Timestamps
        timestamp: r.timestamp,

        // About this result
        aboutThisResult: r.aboutThisResult,

        // Your domain flag
        isYourDomain: r.isYourDomain,
      })),
    };
  },
});

// Internal query: get domain keywords with denormalized position data (for actions)
export const getDomainKeywordsWithPositionData = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return keywords.map((kw) => ({
      _id: kw._id,
      currentPosition: kw.currentPosition ?? null,
      recentPositions: kw.recentPositions ?? [],
    }));
  },
});

// Position aggregation: temporal comparison of keyword positions
// Hybrid: <=7d uses denormalized recentPositions, >7d uses Supabase batch query
export const getPositionAggregation = action({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth via internal query
    const domain: any = await ctx.runQuery(internal.lib.analyticsHelpers.verifyDomainAccess, {
      domainId: args.domainId,
    });
    if (!domain) return null;

    // Fetch keywords with denormalized data
    const keywords: Array<{
      _id: string;
      currentPosition: number | null;
      recentPositions: Array<{ date: string; position: number | null }>;
    }> = await ctx.runQuery(internal.keywords.getDomainKeywordsWithPositionData, {
      domainId: args.domainId,
    });

    if (keywords.length === 0) return null;

    const days = args.days ?? 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let improving = 0;
    let declining = 0;
    let stable = 0;
    let newEntries = 0;
    let totalCurrentPos = 0;
    let totalPreviousPos = 0;
    let keywordsWithPositions = 0;

    const positionBuckets = {
      top3: { current: 0, previous: 0 },
      top10: { current: 0, previous: 0 },
      top20: { current: 0, previous: 0 },
      top50: { current: 0, previous: 0 },
      beyond: { current: 0, previous: 0 },
    };

    // For short periods (<=7 days), use denormalized recentPositions — no external query needed
    const useRecentPositions = days <= 7;

    // For >7d, batch-fetch old positions from Supabase in a single query
    let prevPositionMap = new Map<string, number>();
    if (!useRecentPositions) {
      const sb = getSupabaseAdmin();
      if (sb) {
        const keywordIds = keywords
          .filter((kw) => kw.currentPosition != null)
          .map((kw) => kw._id as string);

        if (keywordIds.length > 0) {
          // Get the latest position on or before cutoff for each keyword
          const { data, error } = await sb
            .from("keyword_positions")
            .select("convex_keyword_id, position, date")
            .in("convex_keyword_id", keywordIds)
            .lte("date", cutoffDate)
            .not("position", "is", null)
            .order("date", { ascending: false });

          if (!error && data) {
            // Keep only the most recent entry per keyword (first seen since ordered desc)
            for (const row of data) {
              if (!prevPositionMap.has(row.convex_keyword_id)) {
                prevPositionMap.set(row.convex_keyword_id, row.position as number);
              }
            }
          }
        }
      }
    }

    for (const kw of keywords) {
      const currentPos = kw.currentPosition;
      if (currentPos == null) continue;

      keywordsWithPositions++;
      totalCurrentPos += currentPos;

      // Bucket current position
      if (currentPos <= 3) positionBuckets.top3.current++;
      else if (currentPos <= 10) positionBuckets.top10.current++;
      else if (currentPos <= 20) positionBuckets.top20.current++;
      else if (currentPos <= 50) positionBuckets.top50.current++;
      else positionBuckets.beyond.current++;

      let prevPos: number | null = null;

      if (useRecentPositions) {
        const recent = kw.recentPositions ?? [];
        const oldEntry = recent.find((p: { date: string; position: number | null }) => p.date <= cutoffDate);
        prevPos = oldEntry?.position ?? null;
      } else {
        prevPos = prevPositionMap.get(kw._id as string) ?? null;
      }

      if (prevPos !== null) {
        totalPreviousPos += prevPos;

        if (prevPos <= 3) positionBuckets.top3.previous++;
        else if (prevPos <= 10) positionBuckets.top10.previous++;
        else if (prevPos <= 20) positionBuckets.top20.previous++;
        else if (prevPos <= 50) positionBuckets.top50.previous++;
        else positionBuckets.beyond.previous++;

        const diff = prevPos - currentPos;
        if (diff > 1) improving++;
        else if (diff < -1) declining++;
        else stable++;
      } else {
        newEntries++;
      }
    }

    const avgCurrentPos = keywordsWithPositions > 0 ? Math.round((totalCurrentPos / keywordsWithPositions) * 10) / 10 : null;
    const compared = improving + declining + stable;
    const avgPreviousPos = compared > 0 ? Math.round((totalPreviousPos / compared) * 10) / 10 : null;
    const avgChange = avgCurrentPos !== null && avgPreviousPos !== null ? Math.round((avgPreviousPos - avgCurrentPos) * 10) / 10 : null;

    return {
      totalKeywords: keywords.length,
      keywordsWithPositions,
      improving,
      declining,
      stable,
      newEntries,
      avgCurrentPosition: avgCurrentPos,
      avgPreviousPosition: avgPreviousPos,
      avgPositionChange: avgChange,
      positionDistributionShift: Object.entries(positionBuckets).map(([bucket, data]) => ({
        bucket,
        current: data.current,
        previous: data.previous,
        change: data.current - data.previous,
      })),
      period: days,
    };
  },
});

// Backfill denormalized position data for keywords that are missing it.
// This populates currentPosition, previousPosition, positionChange,
// currentUrl, recentPositions from existing keywordPositions records.
// Safe to run multiple times — idempotent.
export const backfillDenormalizedPositions = internalMutation({
  args: { domainId: v.optional(v.id("domains")) },
  handler: async (ctx, args) => {
    // Get keywords — optionally scoped to a domain
    let keywords;
    const domainId = args.domainId;
    if (domainId) {
      keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domainId))
        .collect();
    } else {
      keywords = await ctx.db.query("keywords").collect();
    }

    // Only process keywords missing denormalized data
    const needsBackfill = keywords.filter(
      (k) => k.currentPosition === undefined && k.recentPositions === undefined
    );

    let updated = 0;
    for (const keyword of needsBackfill) {
      // Get last 7 positions sorted by date desc
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(7);

      if (positions.length === 0) continue;

      // Build recentPositions (sorted by date asc, last 7)
      const recentPositions = positions
        .map((p) => ({ date: p.date, position: p.position }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const latest = recentPositions[recentPositions.length - 1];
      const prev = recentPositions.length >= 2 ? recentPositions[recentPositions.length - 2] : null;

      const currentPos = latest?.position ?? null;
      const previousPos = prev?.position ?? null;
      const change = (currentPos != null && previousPos != null)
        ? previousPos - currentPos
        : null;

      // Get URL and metadata from the most recent position record
      const latestRecord = positions[0]; // already sorted desc

      await ctx.db.patch(keyword._id, {
        currentPosition: currentPos,
        previousPosition: previousPos,
        positionChange: change,
        currentUrl: latestRecord.url,
        searchVolume: latestRecord.searchVolume ?? keyword.searchVolume,
        difficulty: latestRecord.difficulty ?? keyword.difficulty,
        latestCpc: latestRecord.cpc ?? keyword.latestCpc,
        positionUpdatedAt: latestRecord.fetchedAt ?? Date.now(),
        recentPositions,
      });
      updated++;
    }

    console.log(`[backfill] Updated ${updated}/${needsBackfill.length} keywords (${keywords.length} total)`);
    return { updated, total: keywords.length, needsBackfill: needsBackfill.length };
  },
});

// One-time cleanup: remove duplicate keywordPositions (same keywordId + date)
export const deduplicatePositions = internalMutation({
  args: { domainId: v.optional(v.id("domains")) },
  handler: async (ctx, args) => {
    let keywords;
    const domainId = args.domainId;
    if (domainId) {
      keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domainId))
        .collect();
    } else {
      keywords = await ctx.db.query("keywords").collect();
    }

    let totalDeleted = 0;
    let keywordsProcessed = 0;

    for (const keyword of keywords) {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .collect();

      // Group by date
      const byDate = new Map<string, typeof positions>();
      for (const pos of positions) {
        const existing = byDate.get(pos.date);
        if (existing) {
          existing.push(pos);
        } else {
          byDate.set(pos.date, [pos]);
        }
      }

      // For each date with duplicates, keep the one with latest fetchedAt
      for (const [, group] of byDate) {
        if (group.length <= 1) continue;

        group.sort((a, b) => (b.fetchedAt ?? b._creationTime) - (a.fetchedAt ?? a._creationTime));

        // Delete all but the first (most recent)
        for (let i = 1; i < group.length; i++) {
          await ctx.db.delete(group[i]._id);
          totalDeleted++;
        }
      }

      keywordsProcessed++;
    }

    console.log(`[dedup] Deleted ${totalDeleted} duplicate positions across ${keywordsProcessed} keywords`);
    return { deleted: totalDeleted, keywordsProcessed };
  },
});

// =================================================================
// Bulk Keyword Management (R18)
// =================================================================

// Bulk delete keywords and their position history
export const bulkDeleteKeywords = mutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) throw new Error("Domain not found");
    await requirePermission(ctx, "keywords.remove", context);

    for (const id of args.keywordIds) {
      // Delete position history
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", id))
        .collect();
      for (const p of positions) await ctx.db.delete(p._id);

      // Delete group memberships
      const memberships = await ctx.db
        .query("keywordGroupMemberships")
        .withIndex("by_keyword", (q) => q.eq("keywordId", id))
        .collect();
      for (const m of memberships) await ctx.db.delete(m._id);

      await ctx.db.delete(id);
    }

    return args.keywordIds.length;
  },
});

// Bulk move keywords to a group (via keywordGroupMemberships)
export const bulkMoveToGroup = mutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
    groupId: v.optional(v.id("keywordGroups")),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) throw new Error("Domain not found");
    await requirePermission(ctx, "keywords.add", context);

    for (const keywordId of args.keywordIds) {
      // Remove all existing group memberships for this keyword
      const existing = await ctx.db
        .query("keywordGroupMemberships")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
        .collect();
      for (const m of existing) await ctx.db.delete(m._id);

      // Add to new group if specified
      if (args.groupId) {
        await ctx.db.insert("keywordGroupMemberships", {
          keywordId,
          groupId: args.groupId,
          addedAt: Date.now(),
        });
      }
    }

    return args.keywordIds.length;
  },
});

// Bulk change tags on keywords (set/add/remove)
export const bulkChangeTags = mutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
    tags: v.array(v.string()),
    operation: v.union(v.literal("set"), v.literal("add"), v.literal("remove")),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) throw new Error("Domain not found");
    await requirePermission(ctx, "keywords.add", context);

    for (const id of args.keywordIds) {
      const kw = await ctx.db.get(id);
      if (!kw) continue;

      let newTags: string[];
      if (args.operation === "set") {
        newTags = args.tags;
      } else if (args.operation === "add") {
        newTags = [...new Set([...(kw.tags ?? []), ...args.tags])];
      } else {
        newTags = (kw.tags ?? []).filter((t) => !args.tags.includes(t));
      }

      await ctx.db.patch(id, { tags: newTags.length > 0 ? newTags : undefined });
    }

    return args.keywordIds.length;
  },
});

// Bulk toggle keyword monitoring status (pause/resume)
export const bulkToggleStatus = mutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
    status: v.union(v.literal("active"), v.literal("paused")),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) throw new Error("Domain not found");
    await requirePermission(ctx, "keywords.add", context);

    for (const id of args.keywordIds) {
      await ctx.db.patch(id, { status: args.status });
    }

    return args.keywordIds.length;
  },
});

// ─── Health Check ─────────────────────────────────────────

/**
 * Weekly health check: compare keyword position counts between Convex and Supabase.
 * Flags domains where drift exceeds 10%.
 */
export const healthCheckConsistency = internalAction({
  handler: async (ctx) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      console.error("[healthCheck] Supabase not configured");
      return;
    }

    const domains = await ctx.runQuery(internal.keywords.listAllDomainIds);
    console.log(`[healthCheck] Checking ${domains.length} domains`);

    for (const domain of domains) {
      const convexKeywords = await ctx.runQuery(
        internal.keywords.getDomainKeywordsWithPositionData,
        { domainId: domain._id }
      );
      const convexWithPosition = convexKeywords.filter(
        (k: { currentPosition: number | null }) => k.currentPosition != null
      ).length;

      const { count, error } = await sb
        .from("keyword_positions")
        .select("*", { count: "exact", head: true })
        .eq("convex_domain_id", domain._id)
        .not("position", "is", null);

      if (error) {
        console.error(`[healthCheck] Supabase query failed for ${domain.domain}:`, error.message);
        continue;
      }

      const supabaseCount = count ?? 0;
      const drift = Math.abs(convexWithPosition - supabaseCount);
      const driftPct = convexWithPosition > 0
        ? Math.round((drift / convexWithPosition) * 100)
        : (supabaseCount > 0 ? 100 : 0);

      if (driftPct > 10) {
        console.error(
          `[healthCheck] DRIFT domain=${domain.domain}: convex=${convexWithPosition} vs supabase=${supabaseCount} (${driftPct}% drift)`
        );
      } else {
        console.log(
          `[healthCheck] OK domain=${domain.domain}: convex=${convexWithPosition}, supabase=${supabaseCount}`
        );
      }
    }
  },
});
