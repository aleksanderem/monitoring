import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

/**
 * Get all competitors for a domain
 */
export const getCompetitorsByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

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
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) return [];
    await requireTenantAccess(ctx, "domain", competitor.domainId);

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
    const userId = await auth.getUserId(ctx);
    if (!userId) return { yourDomain: null, competitors: [] };
    await requireTenantAccess(ctx, "domain", args.domainId);

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

    // Your domain's positions: use denormalized recentPositions from keywords (zero extra queries)
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      return { yourDomain: null, competitors: competitorData };
    }

    const yourDateMap = new Map<string, { total: number; count: number }>();
    for (const kw of keywords) {
      const recent = kw.recentPositions ?? [];
      for (const pos of recent) {
        if (pos.position !== null && pos.date >= startDateStr) {
          const existing = yourDateMap.get(pos.date) || { total: 0, count: 0 };
          yourDateMap.set(pos.date, {
            total: existing.total + pos.position,
            count: existing.count + 1,
          });
        }
      }
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
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

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

    // Batch: fetch ALL competitor positions per competitor (1 query per competitor, not K*C)
    // Build a Map: competitorId -> keywordId -> latest position
    const compPositionMaps = new Map<Id<"competitors">, Map<Id<"keywords">, number | null>>();
    for (const competitor of competitors) {
      const allPositions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) => q.eq("competitorId", competitor._id))
        .order("desc")
        .collect();

      // Group by keywordId, take latest (already desc sorted)
      const kwMap = new Map<Id<"keywords">, number | null>();
      for (const pos of allPositions) {
        if (!kwMap.has(pos.keywordId)) {
          kwMap.set(pos.keywordId, pos.position);
        }
      }
      compPositionMaps.set(competitor._id, kwMap);
    }

    // Process keywords: use denormalized currentPosition (zero DB queries per keyword)
    for (const keyword of keywords) {
      const yourPosition = keyword.currentPosition ?? null;

      for (const competitor of competitors) {
        const kwMap = compPositionMaps.get(competitor._id);
        const competitorPosition = kwMap?.get(keyword._id) ?? null;

        if (competitorPosition !== null) {
          const yourPos = yourPosition ?? 100;
          const compPos = competitorPosition;

          if (compPos < yourPos) {
            const rawVol = keyword.searchVolume ?? 100;
            const volume = (isNaN(rawVol) || !isFinite(rawVol)) ? 100 : rawVol;
            const rawDiff = keyword.difficulty ?? 50;
            const difficulty = (isNaN(rawDiff) || !isFinite(rawDiff)) ? 50 : rawDiff;
            const positionGap = yourPos / compPos;
            const volumeWeight = Math.log10(volume + 1);
            const difficultyWeight = 1 - difficulty / 100;
            const rawScore = positionGap * volumeWeight * difficultyWeight;
            const gapScore = Math.min(100, Math.round(rawScore * 10));

            if (args.minGapScore && gapScore < args.minGapScore) continue;

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

    return gaps.sort((a, b) => b.gapScore - a.gapScore);
  },
});

/**
 * Get competitor summary stats for a domain
 */
export const getCompetitorStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { totalCompetitors: 0, activeCompetitors: 0, pausedCompetitors: 0, totalKeywords: 0, totalGaps: 0, highPriorityGaps: 0 };
    await requireTenantAccess(ctx, "domain", args.domainId);

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

    // Get content gap counts for this domain
    const contentGaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const activeGaps = contentGaps.filter((g) => g.status !== "dismissed");
    const highPriorityGaps = activeGaps.filter((g) => {
      const score = g.opportunityScore;
      const priority = (score != null && !isNaN(score) && score >= 70) ? "high"
        : (score != null && !isNaN(score) && score >= 40) ? "medium" : "low";
      return priority === "high";
    });

    return {
      totalCompetitors: competitors.length,
      activeCompetitors: activeCompetitors.length,
      pausedCompetitors: pausedCompetitors.length,
      totalKeywords: keywords.length,
      totalGaps: activeGaps.length,
      highPriorityGaps: highPriorityGaps.length,
    };
  },
});
