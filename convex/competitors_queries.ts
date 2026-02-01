import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Get all competitors for a domain
 */
export const getCompetitorsByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return competitors;
  },
});

/**
 * Get position history for a specific competitor and keyword
 */
export const getCompetitorPositions = query({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const positions = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor_keyword", (q) =>
        q.eq("competitorId", args.competitorId).eq("keywordId", args.keywordId)
      )
      .filter((q) => q.gte(q.field("date"), startDateStr))
      .collect();

    // Sort by date ascending
    return positions.sort((a, b) => a.date.localeCompare(b.date));
  },
});

/**
 * Get average position trend for all competitors over time
 * Returns data for CompetitorOverviewChart
 */
export const getCompetitorOverview = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Get all active competitors for this domain
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    // Get all keywords for this domain
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const keywordIds = keywords.map((k) => k._id);

    // Get competitor positions for all keywords
    const competitorData = await Promise.all(
      competitors.map(async (competitor) => {
        const positions = await ctx.db
          .query("competitorKeywordPositions")
          .withIndex("by_competitor", (q) => q.eq("competitorId", competitor._id))
          .filter((q) => q.gte(q.field("date"), startDateStr))
          .collect();

        // Group by date and calculate average position
        const dateMap = new Map<string, { total: number; count: number }>();

        positions.forEach((pos) => {
          if (pos.position !== null && keywordIds.includes(pos.keywordId)) {
            const existing = dateMap.get(pos.date) || { total: 0, count: 0 };
            dateMap.set(pos.date, {
              total: existing.total + pos.position,
              count: existing.count + 1,
            });
          }
        });

        const dateAverages = Array.from(dateMap.entries()).map(([date, data]) => ({
          date,
          avgPosition: data.count > 0 ? data.total / data.count : null,
        }));

        return {
          competitorId: competitor._id,
          competitorDomain: competitor.competitorDomain,
          name: competitor.name,
          positions: dateAverages.sort((a, b) => a.date.localeCompare(b.date)),
        };
      })
    );

    // Also get your own domain's positions for comparison
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      return { yourDomain: null, competitors: competitorData };
    }

    const yourPositions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", keywordIds[0])) // This is inefficient, but works for now
      .filter((q) => q.gte(q.field("date"), startDateStr))
      .collect();

    // Group your positions by date
    const yourDateMap = new Map<string, { total: number; count: number }>();

    for (const keywordId of keywordIds) {
      const keywordPositions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
        .filter((q) => q.gte(q.field("date"), startDateStr))
        .collect();

      keywordPositions.forEach((pos) => {
        if (pos.position !== null) {
          const existing = yourDateMap.get(pos.date) || { total: 0, count: 0 };
          yourDateMap.set(pos.date, {
            total: existing.total + pos.position,
            count: existing.count + 1,
          });
        }
      });
    }

    const yourDateAverages = Array.from(yourDateMap.entries()).map(([date, data]) => ({
      date,
      avgPosition: data.count > 0 ? data.total / data.count : null,
    }));

    return {
      yourDomain: {
        domain: domain.domain,
        positions: yourDateAverages.sort((a, b) => a.date.localeCompare(b.date)),
      },
      competitors: competitorData,
    };
  },
});

/**
 * Find keyword gaps: keywords competitor ranks for but you don't (or rank poorly)
 * Returns data for CompetitorKeywordGapTable
 */
export const getKeywordGaps = query({
  args: {
    domainId: v.id("domains"),
    competitorId: v.optional(v.id("competitors")),
    minGapScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all keywords for this domain
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get competitors (either specific one or all active)
    let competitors;
    if (args.competitorId) {
      const competitor = await ctx.db.get(args.competitorId);
      competitors = competitor ? [competitor] : [];
    } else {
      competitors = await ctx.db
        .query("competitors")
        .withIndex("by_domain_status", (q) =>
          q.eq("domainId", args.domainId).eq("status", "active")
        )
        .collect();
    }

    if (competitors.length === 0) {
      return [];
    }

    const today = new Date().toISOString().split("T")[0];
    const gaps: Array<{
      keywordId: Id<"keywords">;
      phrase: string;
      yourPosition: number | null;
      competitorPosition: number | null;
      competitorDomain: string;
      competitorName: string;
      searchVolume: number | undefined;
      difficulty: number | undefined;
      gapScore: number;
    }> = [];

    // For each keyword, check if there's a gap
    for (const keyword of keywords) {
      // Get your latest position
      const yourPositions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(1);

      const yourPosition = yourPositions[0]?.position ?? null;

      // Get competitor positions
      for (const competitor of competitors) {
        const competitorPositions = await ctx.db
          .query("competitorKeywordPositions")
          .withIndex("by_competitor_keyword", (q) =>
            q.eq("competitorId", competitor._id).eq("keywordId", keyword._id)
          )
          .order("desc")
          .take(1);

        const competitorPosition = competitorPositions[0]?.position ?? null;

        // Calculate gap score
        // Gap exists if: competitor ranks and (you don't rank OR you rank worse)
        if (competitorPosition !== null) {
          const yourPos = yourPosition ?? 100; // Treat not ranking as position 100+
          const compPos = competitorPosition;

          // Only include if competitor ranks better than you
          if (compPos < yourPos) {
            const volume = keyword.searchVolume ?? 100;
            const difficulty = keyword.difficulty ?? 50;

            // Gap score formula: (yourPos / compPos) × log(volume) × (1 - difficulty/100)
            // Higher score = better opportunity
            const positionGap = yourPos / compPos;
            const volumeWeight = Math.log10(volume + 1); // +1 to avoid log(0)
            const difficultyWeight = 1 - difficulty / 100;
            const rawScore = positionGap * volumeWeight * difficultyWeight;

            // Normalize to 0-100 range (adjust multiplier as needed)
            const gapScore = Math.min(100, Math.round(rawScore * 10));

            // Filter by minimum gap score if specified
            if (args.minGapScore && gapScore < args.minGapScore) {
              continue;
            }

            gaps.push({
              keywordId: keyword._id,
              phrase: keyword.phrase,
              yourPosition,
              competitorPosition,
              competitorDomain: competitor.competitorDomain,
              competitorName: competitor.name,
              searchVolume: keyword.searchVolume,
              difficulty: keyword.difficulty,
              gapScore,
            });
          }
        }
      }
    }

    // Sort by gap score descending (best opportunities first)
    return gaps.sort((a, b) => b.gapScore - a.gapScore);
  },
});

/**
 * Get competitor summary stats for a domain
 */
export const getCompetitorStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const activeCompetitors = competitors.filter((c) => c.status === "active");
    const pausedCompetitors = competitors.filter((c) => c.status === "paused");

    // Get total keywords being tracked
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get total gaps (keywords with opportunities) - call as query, not direct function
    // For now, we'll return 0 for gaps since we can't call queries from within queries
    // In production, this would need to be calculated separately or via aggregation

    return {
      totalCompetitors: competitors.length,
      activeCompetitors: activeCompetitors.length,
      pausedCompetitors: pausedCompetitors.length,
      totalKeywords: keywords.length,
      totalGaps: 0, // TODO: Calculate gaps count efficiently
      highPriorityGaps: 0, // TODO: Calculate high priority gaps count
    };
  },
});
