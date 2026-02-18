import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

/** NaN-safe number read: returns fallback if value is null, undefined, NaN, or Infinity */
function safeNum(val: number | null | undefined, fallback: number): number {
  if (val == null || isNaN(val) || !isFinite(val)) return fallback;
  return val;
}

/** Derive priority from opportunity score (single source of truth) */
function derivePriority(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Get content gaps with advanced filtering
 * Returns gaps ordered by opportunity score
 *
 * Optimized: uses targeted ctx.db.get() for enrichment instead of
 * loading ALL keywords/competitors (avoids 32k doc read limit).
 */
export const getContentGaps = query({
  args: {
    domainId: v.id("domains"),
    filters: v.optional(
      v.object({
        priority: v.optional(
          v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
        ),
        status: v.optional(
          v.union(
            v.literal("identified"),
            v.literal("monitoring"),
            v.literal("ranking"),
            v.literal("dismissed")
          )
        ),
        minScore: v.optional(v.number()),
        maxScore: v.optional(v.number()),
        minVolume: v.optional(v.number()),
        maxVolume: v.optional(v.number()),
        minDifficulty: v.optional(v.number()),
        maxDifficulty: v.optional(v.number()),
        competitorId: v.optional(v.id("competitors")),
      })
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const limit = args.limit ?? 200;

    // Use index-based filtering when possible to reduce docs scanned
    let gaps;
    if (args.filters?.status) {
      gaps = await ctx.db
        .query("contentGaps")
        .withIndex("by_status", (q) =>
          q.eq("domainId", args.domainId).eq("status", args.filters!.status!)
        )
        .collect();
    } else {
      // Default: read up to 4x limit using score index (desc) to reduce reads
      gaps = await ctx.db
        .query("contentGaps")
        .withIndex("by_score", (q) => q.eq("domainId", args.domainId))
        .order("desc")
        .take(limit * 4);
    }

    // Apply remaining in-memory filters
    if (args.filters) {
      const f = args.filters;

      if (f.priority) {
        gaps = gaps.filter((g) => g.priority === f.priority);
      }

      // status already applied via index when present
      if (f.minScore !== undefined) {
        const minScore = f.minScore;
        gaps = gaps.filter((g) => g.opportunityScore >= minScore);
      }

      if (f.maxScore !== undefined) {
        const maxScore = f.maxScore;
        gaps = gaps.filter((g) => g.opportunityScore <= maxScore);
      }

      if (f.minVolume !== undefined) {
        const minVolume = f.minVolume;
        gaps = gaps.filter((g) => g.searchVolume >= minVolume);
      }

      if (f.maxVolume !== undefined) {
        const maxVolume = f.maxVolume;
        gaps = gaps.filter((g) => g.searchVolume <= maxVolume);
      }

      if (f.minDifficulty !== undefined) {
        const minDifficulty = f.minDifficulty;
        gaps = gaps.filter((g) => g.difficulty >= minDifficulty);
      }

      if (f.maxDifficulty !== undefined) {
        const maxDifficulty = f.maxDifficulty;
        gaps = gaps.filter((g) => g.difficulty <= maxDifficulty);
      }

      if (f.competitorId) {
        gaps = gaps.filter((g) => g.competitorId === f.competitorId);
      }
    }

    // Sort by opportunity score descending
    gaps.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Apply limit
    gaps = gaps.slice(0, limit);

    // Targeted enrichment: load only the keywords and competitors we need
    const uniqueKeywordIds = [...new Set(gaps.map((g) => g.keywordId))];
    const uniqueCompetitorIds = [...new Set(gaps.map((g) => g.competitorId))];

    const [keywordDocs, competitorDocs] = await Promise.all([
      Promise.all(uniqueKeywordIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueCompetitorIds.map((id) => ctx.db.get(id))),
    ]);

    const keywordMap = new Map(
      uniqueKeywordIds.map((id, i) => [id, keywordDocs[i]])
    );
    const competitorMap = new Map(
      uniqueCompetitorIds.map((id, i) => [id, competitorDocs[i]])
    );

    // Enrich with keyword and competitor data, sanitize NaN values
    const enrichedGaps = gaps.map((gap) => {
      const keyword = keywordMap.get(gap.keywordId);
      const competitor = competitorMap.get(gap.competitorId);

      let score = gap.opportunityScore;
      let priority = gap.priority;
      let difficulty = gap.difficulty;
      if (isNaN(score)) {
        const vol = gap.searchVolume || 0;
        const diff = isNaN(difficulty) ? 50 : (difficulty || 50);
        const compPos = gap.competitorPosition || 50;
        const volScore = Math.min((vol / 10000) * 50, 50);
        const diffScore = Math.max(50 - diff / 2, 0);
        const posBonus = compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0;
        score = Math.min(Math.round(volScore + diffScore + posBonus), 100);
      }
      if (isNaN(difficulty)) difficulty = 0;
      if (score >= 70) priority = "high";
      else if (score >= 40) priority = "medium";
      else priority = "low";

      return {
        ...gap,
        opportunityScore: score,
        difficulty,
        priority,
        keywordPhrase: keyword?.phrase ?? "Unknown",
        competitorDomain: competitor?.competitorDomain ?? "Unknown",
        competitorName: competitor?.name ?? "Unknown",
      };
    });

    return enrichedGaps;
  },
});

/**
 * Get gap summary statistics for a domain
 *
 * Optimized: uses streaming aggregation to compute stats in a single pass
 * over gaps, then targeted ctx.db.get() for top-10 enrichment only.
 * Avoids loading ALL keywords + ALL competitors (was hitting 32k limit).
 */
export const getGapSummary = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { totalGaps: 0, highPriority: 0, mediumPriority: 0, lowPriority: 0, statusCounts: { identified: 0, monitoring: 0, ranking: 0, dismissed: 0 }, totalEstimatedValue: 0, topOpportunities: [], competitorsAnalyzed: 0, lastAnalyzedAt: null };
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Single pass: compute all stats + collect top 10 in one traversal
    let totalGaps = 0;
    let highPriority = 0;
    let mediumPriority = 0;
    let lowPriority = 0;
    let totalEstimatedValue = 0;
    const statusCounts = { identified: 0, monitoring: 0, ranking: 0, dismissed: 0 };
    const competitorSet = new Set<Id<"competitors">>();

    // Keep a min-heap of top 10 by score (use sorted array for simplicity)
    const TOP_N = 10;
    type ScoredGap = { _id: Id<"contentGaps">; keywordId: Id<"keywords">; competitorId: Id<"competitors">; opportunityScore: number; estimatedTrafficValue: number; priority: "high" | "medium" | "low" };
    const topGaps: ScoredGap[] = [];
    let minTopScore = -1;

    // Stream through all gaps without collecting into one giant array
    const gapsCursor = ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId));

    for await (const g of gapsCursor) {
      // Sanitize score
      let score = g.opportunityScore;
      if (isNaN(score) || score === null || score === undefined) {
        const vol = g.searchVolume || 0;
        const diff = isNaN(g.difficulty) ? 50 : (g.difficulty || 50);
        const compPos = g.competitorPosition || 50;
        const volScore = Math.min((vol / 10000) * 50, 50);
        const diffScore = Math.max(50 - diff / 2, 0);
        const posBonus = compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0;
        score = Math.min(Math.round(volScore + diffScore + posBonus), 100);
      }
      const priority = derivePriority(score);

      // Aggregate stats
      totalGaps++;
      if (priority === "high") highPriority++;
      else if (priority === "medium") mediumPriority++;
      else lowPriority++;
      if (g.status in statusCounts) statusCounts[g.status as keyof typeof statusCounts]++;
      totalEstimatedValue += safeNum(g.estimatedTrafficValue, 0);
      competitorSet.add(g.competitorId);

      // Track top N
      if (topGaps.length < TOP_N || score > minTopScore) {
        topGaps.push({
          _id: g._id,
          keywordId: g.keywordId,
          competitorId: g.competitorId,
          opportunityScore: score,
          estimatedTrafficValue: safeNum(g.estimatedTrafficValue, 0),
          priority,
        });
        if (topGaps.length > TOP_N) {
          topGaps.sort((a, b) => b.opportunityScore - a.opportunityScore);
          topGaps.length = TOP_N;
        }
        minTopScore = topGaps[topGaps.length - 1].opportunityScore;
      }
    }

    topGaps.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Targeted enrichment for top 10 only (max 20 doc reads)
    const uniqueKeywordIds = [...new Set(topGaps.map((g) => g.keywordId))];
    const uniqueCompetitorIds = [...new Set(topGaps.map((g) => g.competitorId))];

    const [keywordDocs, competitorDocs] = await Promise.all([
      Promise.all(uniqueKeywordIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueCompetitorIds.map((id) => ctx.db.get(id))),
    ]);

    const keywordMap = new Map(uniqueKeywordIds.map((id, i) => [id, keywordDocs[i]]));
    const competitorMap = new Map(uniqueCompetitorIds.map((id, i) => [id, competitorDocs[i]]));

    const topOpportunities = topGaps.map((gap) => {
      const keyword = keywordMap.get(gap.keywordId);
      const competitor = competitorMap.get(gap.competitorId);
      return {
        gapId: gap._id,
        keywordPhrase: keyword?.phrase ?? "Unknown",
        competitorDomain: competitor?.competitorDomain ?? "Unknown",
        opportunityScore: gap.opportunityScore,
        estimatedValue: gap.estimatedTrafficValue,
        priority: gap.priority,
      };
    });

    // Get latest report
    const latestReport = await ctx.db
      .query("gapAnalysisReports")
      .withIndex("by_domain_date", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    return {
      totalGaps,
      highPriority,
      mediumPriority,
      lowPriority,
      statusCounts,
      totalEstimatedValue,
      topOpportunities,
      competitorsAnalyzed: competitorSet.size,
      lastAnalyzedAt: latestReport?.generatedAt ?? null,
    };
  },
});

/**
 * Get gap trends over time (historical changes)
 */
export const getGapTrends = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const days = args.days || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startTimestamp = startDate.getTime();

    // Get all reports in the time range
    const reports = await ctx.db
      .query("gapAnalysisReports")
      .withIndex("by_domain_date", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.gte(q.field("generatedAt"), startTimestamp))
      .collect();

    // Sort by date ascending
    reports.sort((a, b) => a.generatedAt - b.generatedAt);

    // Transform to trend data
    const trends = reports.map((report) => ({
      date: new Date(report.generatedAt).toISOString().split("T")[0],
      totalGaps: report.totalGaps,
      highPriorityGaps: report.highPriorityGaps,
      estimatedValue: report.estimatedTotalValue,
    }));

    // Calculate new gaps and closed gaps between reports
    const detailedTrends = trends.map((trend, index) => {
      if (index === 0) {
        return {
          ...trend,
          newGaps: 0,
          closedGaps: 0,
          netChange: 0,
        };
      }

      const previous = trends[index - 1];
      const netChange = trend.totalGaps - previous.totalGaps;
      const newGaps = netChange > 0 ? netChange : 0;
      const closedGaps = netChange < 0 ? Math.abs(netChange) : 0;

      return {
        ...trend,
        newGaps,
        closedGaps,
        netChange,
      };
    });

    return detailedTrends;
  },
});

/**
 * Get topic clusters (group gaps by semantic similarity)
 * Uses simple keyword phrase analysis to cluster related keywords
 *
 * Optimized: limits gaps read and uses targeted ctx.db.get() for keywords
 * instead of loading ALL keywords for the domain.
 */
export const getTopicClusters = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Limit to top 2000 gaps by score to avoid exceeding read limits
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_score", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(2000);

    // Filter out dismissed in memory (small fraction after take)
    const activeGaps = gaps.filter((g) => g.status !== "dismissed");

    // Targeted keyword loading: only fetch keywords referenced by these gaps
    const uniqueKeywordIds = [...new Set(activeGaps.map((g) => g.keywordId))];
    const keywordDocs = await Promise.all(
      uniqueKeywordIds.map((id) => ctx.db.get(id))
    );
    const keywordMap = new Map(
      uniqueKeywordIds.map((id, i) => [id, keywordDocs[i]])
    );

    const gapsWithKeywords = activeGaps.map((gap) => ({
      ...gap,
      phrase: keywordMap.get(gap.keywordId)?.phrase ?? "",
    }));

    // Simple clustering based on common words (excluding common stop words)
    const stopWords = new Set([
      "a",
      "an",
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "were",
      "been",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
    ]);

    const clusters = new Map<string, typeof gapsWithKeywords>();

    for (const gap of gapsWithKeywords) {
      const words = gap.phrase
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

      // Find most common word as cluster key
      if (words.length > 0) {
        const clusterKey = words[0]; // Use first meaningful word as cluster
        const existing = clusters.get(clusterKey) || [];
        clusters.set(clusterKey, [...existing, gap]);
      }
    }

    // Transform clusters to array with statistics
    const clusterArray = Array.from(clusters.entries()).map(
      ([topic, clusterGaps]) => {
        const totalScore = clusterGaps.reduce(
          (sum, g) => sum + safeNum(g.opportunityScore, 0),
          0
        );
        const totalValue = clusterGaps.reduce(
          (sum, g) => sum + safeNum(g.estimatedTrafficValue, 0),
          0
        );
        const avgScore =
          clusterGaps.length > 0 ? totalScore / clusterGaps.length : 0;

        // Get top keywords sorted by score
        const sorted = [...clusterGaps].sort((a, b) => b.opportunityScore - a.opportunityScore);

        const topKeywords = sorted.slice(0, 3).map((g) => g.phrase);

        // All keywords with details (sorted by score)
        const keywords = sorted.map((g) => ({
          phrase: g.phrase,
          searchVolume: safeNum(g.searchVolume, 0),
          opportunityScore: safeNum(g.opportunityScore, 0),
          difficulty: safeNum(g.difficulty, 0),
          estimatedTrafficValue: safeNum(g.estimatedTrafficValue, 0),
          competitorPosition: g.competitorPosition,
          priority: derivePriority(safeNum(g.opportunityScore, 0)),
          status: g.status,
        }));

        const totalSearchVolume = clusterGaps.reduce(
          (sum, g) => sum + safeNum(g.searchVolume, 0),
          0
        );
        const avgDifficulty =
          clusterGaps.length > 0
            ? clusterGaps.reduce((sum, g) => sum + safeNum(g.difficulty, 0), 0) / clusterGaps.length
            : 0;

        return {
          topic: topic.charAt(0).toUpperCase() + topic.slice(1), // Capitalize
          gapCount: clusterGaps.length,
          totalOpportunityScore: totalScore,
          avgOpportunityScore: avgScore,
          totalEstimatedValue: totalValue,
          totalSearchVolume,
          avgDifficulty: Math.round(avgDifficulty),
          topKeywords,
          keywords,
          gapIds: clusterGaps.map((g) => g._id),
        };
      }
    );

    // Sort by total opportunity score descending
    clusterArray.sort((a, b) => b.totalOpportunityScore - a.totalOpportunityScore);

    return clusterArray;
  },
});

/**
 * Compare gap counts across competitors
 *
 * Optimized: uses streaming aggregation (no giant gaps array in memory)
 * and targeted ctx.db.get() for competitor enrichment.
 */
export const getCompetitorGapComparison = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Stream-aggregate by competitor to avoid holding all gaps in memory
    const competitorAgg = new Map<
      Id<"competitors">,
      { count: number; highPriority: number; totalScore: number }
    >();

    const gapsCursor = ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId));

    for await (const gap of gapsCursor) {
      if (gap.status === "dismissed") continue;

      const score = safeNum(gap.opportunityScore, 0);
      const priority = derivePriority(score);
      const existing = competitorAgg.get(gap.competitorId) || {
        count: 0,
        highPriority: 0,
        totalScore: 0,
      };

      competitorAgg.set(gap.competitorId, {
        count: existing.count + 1,
        highPriority: existing.highPriority + (priority === "high" ? 1 : 0),
        totalScore: existing.totalScore + score,
      });
    }

    // Targeted competitor enrichment (typically <20 competitors)
    const competitorIds = [...competitorAgg.keys()];
    const competitorDocs = await Promise.all(
      competitorIds.map((id) => ctx.db.get(id))
    );
    const competitorLookup = new Map(
      competitorIds.map((id, i) => [id, competitorDocs[i]])
    );

    const comparison = competitorIds.map((competitorId) => {
      const data = competitorAgg.get(competitorId)!;
      const competitor = competitorLookup.get(competitorId);
      return {
        competitorId,
        competitorDomain: competitor?.competitorDomain ?? "Unknown",
        competitorName: competitor?.name ?? "Unknown",
        totalGaps: data.count,
        highPriorityGaps: data.highPriority,
        avgOpportunityScore:
          data.count > 0 ? data.totalScore / data.count : 0,
      };
    });

    // Sort by total gaps descending
    comparison.sort((a, b) => b.totalGaps - a.totalGaps);

    return comparison;
  },
});
