import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { checkKeywordLimit } from "./limits";
import { requirePermission, getContextFromDomain, getContextFromKeyword } from "./permissions";

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

// Get keywords for a domain
export const getKeywords = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Get latest position for each keyword
    const keywordsWithPositions = await Promise.all(
      keywords.map(async (keyword) => {
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .order("desc")
          .take(2);

        const currentPosition = positions[0] || null;
        const previousPosition = positions[1] || null;

        let change = null;
        if (currentPosition?.position && previousPosition?.position) {
          change = previousPosition.position - currentPosition.position;
        }

        return {
          ...keyword,
          currentPosition: currentPosition?.position ?? null,
          url: currentPosition?.url ?? null,
          searchVolume: currentPosition?.searchVolume,
          difficulty: currentPosition?.difficulty,
          lastUpdated: keyword.lastUpdated ?? currentPosition?.fetchedAt,
          change,
          checkingStatus: keyword.checkingStatus,
          checkJobId: keyword.checkJobId,
        };
      })
    );

    return keywordsWithPositions;
  },
});

// Get keyword with history
export const getKeywordWithHistory = query({
  args: {
    keywordId: v.id("keywords"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) {
      return null;
    }

    const daysToFetch = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    const startDateStr = startDate.toISOString().split("T")[0];

    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .filter((q) => q.gte(q.field("date"), startDateStr))
      .collect();

    // Get latest 2 positions to calculate change
    const allPositions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .order("desc")
      .take(2);

    const currentPosition = allPositions[0] || null;
    const previousPosition = allPositions[1] || null;

    let change = null;
    if (currentPosition?.position && previousPosition?.position) {
      change = previousPosition.position - currentPosition.position;
    }

    return {
      ...keyword,
      currentPosition: currentPosition?.position ?? null,
      rankingUrl: currentPosition?.url ?? null,
      searchVolume: currentPosition?.searchVolume,
      difficulty: currentPosition?.difficulty,
      lastUpdated: currentPosition?.fetchedAt,
      change,
      history: positions.sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});

// Get position distribution across ranking ranges
export const getPositionDistribution = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get all discovered keywords with actual rankings (bestPosition !== 999)
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.neq(q.field("bestPosition"), 999))
      .collect();

    const distribution = {
      top3: 0,
      pos4_10: 0,
      pos11_20: 0,
      pos21_50: 0,
      pos51_100: 0,
      pos100plus: 0,
    };

    for (const keyword of discoveredKeywords) {
      const pos = keyword.bestPosition;

      // Only process valid positions
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
export const getMovementTrend = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Note: domainVisibilityHistory stores MONTHLY data (first day of each month)
    // So we need to fetch more months to have enough data points for the trend
    const monthsToFetch = 6; // Get last 6 months of data
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToFetch);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Get visibility history from domainVisibilityHistory table
    const history = await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.gte(q.field("date"), cutoffDateStr))
      .collect();

    // Map to chart format
    return history
      .map((entry) => ({
        date: new Date(entry.date).getTime(),
        gainers: entry.metrics.is_up || 0,
        losers: entry.metrics.is_down || 0,
      }))
      .sort((a, b) => a.date - b.date);
  },
});

// Get monitoring statistics for overview cards
export const getMonitoringStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = new Date(sevenDaysAgo).toISOString().split('T')[0];

    let totalPosition = 0;
    let positionCount = 0;
    let totalPositionSevenDaysAgo = 0;
    let positionCountSevenDaysAgo = 0;
    let estimatedMonthlyTraffic = 0;
    let gainers = 0;
    let losers = 0;
    let stable = 0;

    for (const keyword of keywords) {
      // Get latest position
      const latestPosition = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .first();

      if (latestPosition?.position) {
        totalPosition += latestPosition.position;
        positionCount++;

        // Calculate potential traffic for keywords in top 50
        if (latestPosition.position <= 50 && latestPosition.searchVolume) {
          const ctr = getCTRForPosition(latestPosition.position);
          estimatedMonthlyTraffic += latestPosition.searchVolume * ctr;
        }
      }

      // Get positions from the last 7 days to compare
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .filter((q) => q.gte(q.field("date"), sevenDaysAgoStr))
        .collect();

      if (positions.length >= 2) {
        // Sort by date
        positions.sort((a, b) => a.date.localeCompare(b.date));
        const oldPos = positions[0].position;
        const newPos = positions[positions.length - 1].position;

        if (oldPos !== null && newPos !== null) {
          totalPositionSevenDaysAgo += oldPos;
          positionCountSevenDaysAgo++;

          // Determine movement status (lower position number = better)
          if (newPos < oldPos) {
            gainers++;
          } else if (newPos > oldPos) {
            losers++;
          } else {
            stable++;
          }
        }
      }
    }

    const avgPosition = positionCount > 0 ? totalPosition / positionCount : 0;
    const avgPositionSevenDaysAgo = positionCountSevenDaysAgo > 0
      ? totalPositionSevenDaysAgo / positionCountSevenDaysAgo
      : 0;

    const avgPositionChange7d = avgPositionSevenDaysAgo > 0
      ? avgPositionSevenDaysAgo - avgPosition // Negative means improvement
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
export const getKeywordMonitoring = query({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .take(args.limit ?? 100);

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const results = [];

    for (const keyword of keywords) {
      // Try to find rich data from discoveredKeywords table FIRST
      const discoveredKeyword = await ctx.db
        .query("discoveredKeywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("keyword"), keyword.phrase))
        .first();

      // Get only LAST 7 days for mini sparkline (not 30!)
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .filter((q) => q.gte(q.field("date"), new Date(sevenDaysAgo).toISOString().split('T')[0]))
        .order("desc")
        .take(7);

      positions.sort((a, b) => a.date.localeCompare(b.date));

      // Get current position (most recent)
      const latestPosition = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .first();

      // Use monitoring position if available, otherwise fall back to discoveredKeywords bestPosition
      const currentPosition = latestPosition?.position ||
        (discoveredKeyword?.bestPosition && discoveredKeyword.bestPosition !== 999
          ? discoveredKeyword.bestPosition
          : null);

      // Get previous position (second most recent)
      const allPositionsDesc = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(2);

      // Use monitoring previous position if available, otherwise fall back to discoveredKeywords
      let previousPosition: number | null = null;
      if (allPositionsDesc.length >= 2) {
        previousPosition = allPositionsDesc[1].position;
      } else if (discoveredKeyword?.previousPosition !== undefined &&
                 discoveredKeyword.previousPosition !== null &&
                 discoveredKeyword.previousPosition !== 999) {
        previousPosition = discoveredKeyword.previousPosition;
      } else if (discoveredKeyword?.previousRankAbsolute !== undefined &&
                 discoveredKeyword.previousRankAbsolute !== null &&
                 discoveredKeyword.previousRankAbsolute !== 999) {
        previousPosition = discoveredKeyword.previousRankAbsolute;
      }

      // Calculate change - use monitoring data first, then fall back to discoveredKeywords change
      let change: number | null = null;
      if (currentPosition && previousPosition) {
        change = previousPosition - currentPosition; // Negative means dropped
      } else if (discoveredKeyword?.isUp) {
        // If we don't have exact change but know it went up, estimate based on isUp/isDown
        change = 1; // Positive = improved
      } else if (discoveredKeyword?.isDown) {
        change = -1; // Negative = dropped
      }

      // Determine status
      let status: "rising" | "stable" | "falling" | "new" = "stable";
      if (discoveredKeyword?.isNew || (!latestPosition && discoveredKeyword)) {
        status = "new";
      } else if (change && change > 0) {
        status = "rising"; // Improved (lower position number)
      } else if (change && change < 0) {
        status = "falling"; // Dropped (higher position number)
      }

      // Calculate potential
      const potential = currentPosition && latestPosition?.searchVolume
        ? Math.round(latestPosition.searchVolume * getCTRForPosition(currentPosition))
        : null;

      // Build position history array for sparkline (last 30 days)
      const positionHistory = positions.map(p => ({
        date: new Date(p.date).getTime(),
        position: p.position,
      }));

      results.push({
        keywordId: keyword._id,
        domainId: keyword.domainId,
        phrase: keyword.phrase,
        currentPosition,
        previousPosition,
        change,
        status,
        searchVolume: discoveredKeyword?.searchVolume || latestPosition?.searchVolume || null,
        difficulty: discoveredKeyword?.difficulty || latestPosition?.difficulty || null,
        url: latestPosition?.url || discoveredKeyword?.url || null,
        positionHistory,
        lastUpdated: latestPosition?._creationTime || keyword._creationTime,
        potential,
        checkingStatus: keyword.checkingStatus,

        // Rich data from discoveredKeywords
        cpc: discoveredKeyword?.cpc || latestPosition?.cpc || null,
        etv: discoveredKeyword?.etv || null,
        competition: discoveredKeyword?.competition || null,
        competitionLevel: discoveredKeyword?.competitionLevel || null,
        intent: discoveredKeyword?.intent || null,
        serpFeatures: discoveredKeyword?.serpFeatures || null,
        estimatedPaidTrafficCost: discoveredKeyword?.estimatedPaidTrafficCost || null,
        monthlySearches: discoveredKeyword?.monthlySearches || null,
        isNew: discoveredKeyword?.isNew || null,
        isUp: discoveredKeyword?.isUp || null,
        isDown: discoveredKeyword?.isDown || null,
      });
    }

    return results;
  },
});

// Get recent keyword position changes (for recent changes table)
export const getRecentChanges = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = args.days || 7;
    const limit = args.limit || 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const changesPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(50);

      if (positions.length < 2) return null;

      const current = positions[0];
      const oldPosition = positions.find(p => p.date <= cutoffStr);

      if (!current.position || !oldPosition?.position) return null;

      const change = oldPosition.position - current.position;
      if (change === 0) return null;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPosition.position,
        newPosition: current.position,
        change,
        searchVolume: current.searchVolume,
        url: current.url,
      };
    });

    const changes = (await Promise.all(changesPromises)).filter(c => c !== null);

    // Sort by absolute change, biggest first
    changes.sort((a, b) => Math.abs(b!.change) - Math.abs(a!.change));

    return changes.slice(0, limit);
  },
});

// Get top gainers and losers (for performance tables)
export const getTopPerformers = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = args.days || 30;
    const limit = args.limit || 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const changesPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(100);

      if (positions.length < 2) return null;

      const current = positions[0];
      const oldPosition = positions.find(p => p.date <= cutoffStr);

      if (!current.position || !oldPosition?.position) return null;

      const change = oldPosition.position - current.position;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPosition.position,
        newPosition: current.position,
        change,
        searchVolume: current.searchVolume,
        url: current.url,
      };
    });

    const allChanges = (await Promise.all(changesPromises)).filter(c => c !== null);

    const gainers = allChanges.filter(c => c!.change > 0).sort((a, b) => b!.change - a!.change).slice(0, limit);
    const losers = allChanges.filter(c => c!.change < 0).sort((a, b) => a!.change - b!.change).slice(0, limit);

    return { gainers, losers };
  },
});

// Get top keywords by search volume (for top keywords table)
export const getTopKeywordsByVolume = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const keywordsWithDataPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(8);

      if (positions.length === 0) return null;

      const current = positions[0];
      if (!current.searchVolume) return null;

      const previous = positions.find(p => p.date !== current.date);
      const change = previous?.position && current.position
        ? previous.position - current.position
        : null;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        position: current.position,
        searchVolume: current.searchVolume,
        url: current.url,
        change,
        history: positions.slice(0, 7).reverse(),
      };
    });

    const keywordsWithData = (await Promise.all(keywordsWithDataPromises))
      .filter(k => k !== null)
      .sort((a, b) => b!.searchVolume! - a!.searchVolume!);

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

    // Check if keyword already exists
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("phrase"), args.phrase.toLowerCase().trim()))
      .unique();

    if (existing) {
      throw new Error("Keyword already exists");
    }

    return await ctx.db.insert("keywords", {
      domainId: args.domainId,
      phrase: args.phrase.toLowerCase().trim(),
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // Filter out existing keywords first to get accurate count
    const uniquePhrases: string[] = [];
    for (const phrase of args.phrases) {
      const normalized = phrase.toLowerCase().trim();
      if (!normalized) continue;

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
    // Check if position for this date already exists
    const existing = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword_date", (q) =>
        q.eq("keywordId", args.keywordId).eq("date", args.date)
      )
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        position: args.position,
        url: args.url,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        cpc: args.cpc,
        fetchedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("keywordPositions", {
      keywordId: args.keywordId,
      date: args.date,
      position: args.position,
      url: args.url,
      searchVolume: args.searchVolume,
      difficulty: args.difficulty,
      cpc: args.cpc,
      fetchedAt: Date.now(),
    });
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

    // Create a check job for these keywords
    const jobId = await ctx.db.insert("keywordCheckJobs", {
      domainId,
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
 * Query to get SERP results for a keyword
 */
export const getSerpResultsForKeyword = query({
  args: {
    keywordId: v.id("keywords"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get the most recent SERP results for this keyword
    const results = await ctx.db
      .query("keywordSerpResults")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .order("desc")
      .take(100); // Get up to 100 results

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

// Position aggregation: temporal comparison of keyword positions
export const getPositionAggregation = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoff).toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    if (keywords.length === 0) return null;

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

    for (const kw of keywords) {
      // Get most recent position
      const latestPos = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
        .order("desc")
        .first();

      if (!latestPos || latestPos.position === null) continue;

      // Get position from N days ago
      const oldPositions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
        .filter((q) => q.lte(q.field("date"), cutoffDate))
        .order("desc")
        .first();

      const currentPos = latestPos.position;
      keywordsWithPositions++;
      totalCurrentPos += currentPos;

      // Bucket current position
      if (currentPos <= 3) positionBuckets.top3.current++;
      else if (currentPos <= 10) positionBuckets.top10.current++;
      else if (currentPos <= 20) positionBuckets.top20.current++;
      else if (currentPos <= 50) positionBuckets.top50.current++;
      else positionBuckets.beyond.current++;

      if (oldPositions && oldPositions.position !== null) {
        const prevPos = oldPositions.position;
        totalPreviousPos += prevPos;

        // Bucket previous position
        if (prevPos <= 3) positionBuckets.top3.previous++;
        else if (prevPos <= 10) positionBuckets.top10.previous++;
        else if (prevPos <= 20) positionBuckets.top20.previous++;
        else if (prevPos <= 50) positionBuckets.top50.previous++;
        else positionBuckets.beyond.previous++;

        const diff = prevPos - currentPos; // positive = improved
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
