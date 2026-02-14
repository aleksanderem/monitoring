import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
    let query = ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId));

    let gaps = await query.collect();

    // Apply filters
    if (args.filters) {
      const f = args.filters;

      if (f.priority) {
        gaps = gaps.filter((g) => g.priority === f.priority);
      }

      if (f.status) {
        gaps = gaps.filter((g) => g.status === f.status);
      }

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

    // Apply limit if specified
    if (args.limit) {
      gaps = gaps.slice(0, args.limit);
    }

    // Batch fetch keywords and competitors for this domain (2 queries instead of 2*N)
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const keywordMap = new Map(allKeywords.map((kw) => [kw._id, kw]));

    const allCompetitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const competitorMap = new Map(allCompetitors.map((c) => [c._id, c]));

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
 */
export const getGapSummary = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const rawGaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Sanitize NaN scores and recalculate priorities
    const gaps = rawGaps.map((g) => {
      let score = g.opportunityScore;
      let priority = g.priority;
      if (isNaN(score) || score === null || score === undefined) {
        const vol = g.searchVolume || 0;
        const diff = isNaN(g.difficulty) ? 50 : (g.difficulty || 50);
        const compPos = g.competitorPosition || 50;
        const volScore = Math.min((vol / 10000) * 50, 50);
        const diffScore = Math.max(50 - diff / 2, 0);
        const posBonus = compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0;
        score = Math.min(Math.round(volScore + diffScore + posBonus), 100);
      }
      if (score >= 70) priority = "high";
      else if (score >= 40) priority = "medium";
      else priority = "low";
      return { ...g, opportunityScore: score, priority };
    });

    // Calculate statistics
    const totalGaps = gaps.length;
    const highPriority = gaps.filter((g) => g.priority === "high").length;
    const mediumPriority = gaps.filter((g) => g.priority === "medium").length;
    const lowPriority = gaps.filter((g) => g.priority === "low").length;

    const statusCounts = {
      identified: gaps.filter((g) => g.status === "identified").length,
      monitoring: gaps.filter((g) => g.status === "monitoring").length,
      ranking: gaps.filter((g) => g.status === "ranking").length,
      dismissed: gaps.filter((g) => g.status === "dismissed").length,
    };

    // Calculate total estimated traffic value (NaN-safe)
    const totalEstimatedValue = gaps.reduce(
      (sum, gap) => sum + safeNum(gap.estimatedTrafficValue, 0),
      0
    );

    // Get top 10 opportunities
    const topGaps = [...gaps]
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 10);

    // Batch fetch keywords and competitors for enrichment (2 queries instead of 2*N)
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const keywordMap = new Map(allKeywords.map((kw) => [kw._id, kw]));

    const allCompetitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const competitorMap = new Map(allCompetitors.map((c) => [c._id, c]));

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

    const uniqueCompetitors = new Set(gaps.map((g) => g.competitorId));
    const competitorsAnalyzed = uniqueCompetitors.size;

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
      competitorsAnalyzed,
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
 */
export const getTopicClusters = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.neq(q.field("status"), "dismissed"))
      .collect();

    // Batch fetch all keywords for domain (1 query instead of N)
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const keywordMap = new Map(allKeywords.map((kw) => [kw._id, kw]));

    const gapsWithKeywords = gaps.map((gap) => ({
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
 */
export const getCompetitorGapComparison = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.neq(q.field("status"), "dismissed"))
      .collect();

    // Group by competitor
    const competitorMap = new Map<
      Id<"competitors">,
      {
        gaps: (typeof gaps)[0][];
        highPriority: number;
        totalScore: number;
      }
    >();

    for (const gap of gaps) {
      const existing = competitorMap.get(gap.competitorId) || {
        gaps: [],
        highPriority: 0,
        totalScore: 0,
      };

      const score = safeNum(gap.opportunityScore, 0);
      const priority = derivePriority(score);
      competitorMap.set(gap.competitorId, {
        gaps: [...existing.gaps, gap],
        highPriority:
          existing.highPriority + (priority === "high" ? 1 : 0),
        totalScore: existing.totalScore + score,
      });
    }

    // Batch fetch all competitors for domain (1 query instead of N)
    const allCompetitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const competitorLookup = new Map(allCompetitors.map((c) => [c._id, c]));

    const comparison = Array.from(competitorMap.entries()).map(
      ([competitorId, data]) => {
        const competitor = competitorLookup.get(competitorId);
        return {
          competitorId,
          competitorDomain: competitor?.competitorDomain ?? "Unknown",
          competitorName: competitor?.name ?? "Unknown",
          totalGaps: data.gaps.length,
          highPriorityGaps: data.highPriority,
          avgOpportunityScore:
            data.gaps.length > 0 ? data.totalScore / data.gaps.length : 0,
        };
      }
    );

    // Sort by total gaps descending
    comparison.sort((a, b) => b.totalGaps - a.totalGaps);

    return comparison;
  },
});
