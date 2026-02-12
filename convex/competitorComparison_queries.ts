import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Get position scatter data: your position vs competitor position per keyword.
 * Each data point is a keyword-competitor pair where both sides have a ranking.
 */
export const getPositionScatterData = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get active keywords with denormalized positions
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get active competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    if (competitors.length === 0 || keywords.length === 0) return [];

    // Build keyword map for quick lookup
    const keywordMap = new Map(
      keywords
        .filter((k) => k.currentPosition != null)
        .map((k) => [k._id, k])
    );

    // Fetch all competitor positions in one batch per competitor
    const result: Array<{
      keyword: string;
      yourPosition: number;
      competitorName: string;
      competitorPosition: number;
      searchVolume: number;
    }> = [];

    for (const competitor of competitors) {
      const positions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) =>
          q.eq("competitorId", competitor._id)
        )
        .collect();

      // Get latest position per keyword
      const latestByKeyword = new Map<
        Id<"keywords">,
        { position: number | null; fetchedAt: number }
      >();
      for (const pos of positions) {
        const existing = latestByKeyword.get(pos.keywordId);
        if (!existing || pos.fetchedAt > existing.fetchedAt) {
          latestByKeyword.set(pos.keywordId, {
            position: pos.position,
            fetchedAt: pos.fetchedAt,
          });
        }
      }

      // Match with our keywords
      for (const [keywordId, compData] of latestByKeyword) {
        if (compData.position == null) continue;
        const keyword = keywordMap.get(keywordId);
        if (!keyword || keyword.currentPosition == null) continue;

        result.push({
          keyword: keyword.phrase,
          yourPosition: keyword.currentPosition,
          competitorName: competitor.name || competitor.competitorDomain,
          competitorPosition: compData.position,
          searchVolume: keyword.searchVolume ?? 0,
        });
      }
    }

    return result;
  },
});

/**
 * Get backlink radar data: normalized metrics for radar chart comparison.
 * Metrics: totalBacklinks, referringDomains, dofollowRatio, avgDomainRank, freshBacklinksRatio
 */
export const getBacklinkRadarData = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get domain's backlink summary
    const domainSummary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    // Get active competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    if (!domainSummary && competitors.length === 0) return [];

    // Fetch competitor backlink summaries
    const competitorSummaries = await Promise.all(
      competitors.map(async (comp) => {
        const summary = await ctx.db
          .query("competitorBacklinksSummary")
          .withIndex("by_competitor", (q) =>
            q.eq("competitorId", comp._id)
          )
          .first();
        return { competitor: comp, summary };
      })
    );

    // Extract raw metric values for each entity
    type RawMetrics = {
      name: string;
      totalBacklinks: number;
      referringDomains: number;
      dofollowRatio: number;
      avgDomainRank: number;
      freshBacklinksRatio: number;
    };

    const entities: RawMetrics[] = [];

    if (domainSummary) {
      const total = domainSummary.totalBacklinks || 1;
      entities.push({
        name: "__own__",
        totalBacklinks: domainSummary.totalBacklinks,
        referringDomains: domainSummary.totalDomains,
        dofollowRatio:
          total > 0 ? (domainSummary.dofollow / total) * 100 : 0,
        avgDomainRank: domainSummary.avgInlinkRank ?? 0,
        freshBacklinksRatio:
          total > 0
            ? ((domainSummary.newBacklinks ?? 0) / total) * 100
            : 0,
      });
    }

    for (const { competitor, summary } of competitorSummaries) {
      if (!summary) continue;
      const total = summary.totalBacklinks || 1;
      entities.push({
        name: competitor.name || competitor.competitorDomain,
        totalBacklinks: summary.totalBacklinks,
        referringDomains: summary.totalDomains,
        dofollowRatio: total > 0 ? (summary.dofollow / total) * 100 : 0,
        avgDomainRank: summary.avgInlinkRank ?? 0,
        freshBacklinksRatio:
          total > 0 ? ((summary.newBacklinks ?? 0) / total) * 100 : 0,
      });
    }

    if (entities.length === 0) return [];

    // Normalize each metric to 0-100 scale (max across all = 100)
    const metrics = [
      "totalBacklinks",
      "referringDomains",
      "dofollowRatio",
      "avgDomainRank",
      "freshBacklinksRatio",
    ] as const;

    const maxValues: Record<string, number> = {};
    for (const metric of metrics) {
      maxValues[metric] = Math.max(...entities.map((e) => e[metric]), 1);
    }

    return metrics.map((metric) => ({
      metric,
      yourValue: entities.find((e) => e.name === "__own__")
        ? Math.round(
            (entities.find((e) => e.name === "__own__")![metric] /
              maxValues[metric]) *
              100
          )
        : 0,
      competitors: entities
        .filter((e) => e.name !== "__own__")
        .map((e) => ({
          name: e.name,
          value: Math.round((e[metric] / maxValues[metric]) * 100),
        })),
    }));
  },
});

/**
 * Get backlink quality comparison: grouped by domain rank tiers.
 * High DR (60+), Medium DR (30-59), Low DR (0-29)
 */
export const getBacklinkQualityComparison = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const tiers = ["High DR (60+)", "Medium DR (30-59)", "Low DR (0-29)"];

    function tierIndex(rank: number | undefined | null): number {
      if (rank == null) return 2; // unknown = low
      if (rank >= 60) return 0;
      if (rank >= 30) return 1;
      return 2;
    }

    // Domain's own backlinks
    const domainBacklinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const ownCounts = [0, 0, 0];
    for (const bl of domainBacklinks) {
      ownCounts[tierIndex(bl.domainFromRank)]++;
    }

    // Get active competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    const series: Array<{ name: string; data: number[] }> = [
      { name: "__own__", data: ownCounts },
    ];

    for (const comp of competitors) {
      const backlinks = await ctx.db
        .query("competitorBacklinks")
        .withIndex("by_competitor", (q) =>
          q.eq("competitorId", comp._id)
        )
        .collect();

      const counts = [0, 0, 0];
      for (const bl of backlinks) {
        counts[tierIndex(bl.domainFromRank)]++;
      }
      series.push({
        name: comp.name || comp.competitorDomain,
        data: counts,
      });
    }

    return { tiers, series };
  },
});

/**
 * Get top keywords with position bars for your domain + each competitor.
 * Top N by search volume (default 15).
 */
export const getKeywordPositionBars = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 15;

    // Get all active keywords, sorted by search volume desc
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const topKeywords = allKeywords
      .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
      .slice(0, limit);

    if (topKeywords.length === 0) return { keywords: [], series: [] };

    const keywordIds = new Set(topKeywords.map((k) => k._id));

    // Get active competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    // Own positions from denormalized data
    const ownPositions = topKeywords.map(
      (k) => k.currentPosition ?? null
    );

    const series: Array<{ name: string; positions: (number | null)[] }> =
      [{ name: "__own__", positions: ownPositions }];

    // Competitor positions
    for (const comp of competitors) {
      const allPositions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) =>
          q.eq("competitorId", comp._id)
        )
        .collect();

      // Latest position per keyword
      const latestByKeyword = new Map<
        Id<"keywords">,
        { position: number | null; fetchedAt: number }
      >();
      for (const pos of allPositions) {
        if (!keywordIds.has(pos.keywordId)) continue;
        const existing = latestByKeyword.get(pos.keywordId);
        if (!existing || pos.fetchedAt > existing.fetchedAt) {
          latestByKeyword.set(pos.keywordId, {
            position: pos.position,
            fetchedAt: pos.fetchedAt,
          });
        }
      }

      const positions = topKeywords.map(
        (k) => latestByKeyword.get(k._id)?.position ?? null
      );

      series.push({
        name: comp.name || comp.competitorDomain,
        positions,
      });
    }

    return {
      keywords: topKeywords.map((k) => k.phrase),
      series,
    };
  },
});
