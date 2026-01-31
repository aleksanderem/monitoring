import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

    // Get keyword count for each competitor
    const competitorsWithStats = await Promise.all(
      competitors.map(async (competitor) => {
        const positions = await ctx.db
          .query("competitorKeywordPositions")
          .withIndex("by_competitor", (q) => q.eq("competitorId", competitor._id))
          .collect();

        // Get unique keywords
        const uniqueKeywords = new Set(positions.map((p) => p.keywordId));

        // Get latest position data
        const latestPositions = positions
          .sort((a, b) => b.fetchedAt - a.fetchedAt)
          .slice(0, 100); // Sample for stats

        const rankedPositions = latestPositions.filter((p) => p.position !== null);
        const avgPosition = rankedPositions.length > 0
          ? rankedPositions.reduce((sum, p) => sum + (p.position || 0), 0) / rankedPositions.length
          : null;

        return {
          ...competitor,
          keywordCount: uniqueKeywords.size,
          avgPosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
          lastChecked: competitor.lastCheckedAt,
        };
      })
    );

    return competitorsWithStats.sort((a, b) => b.addedAt - a.addedAt);
  },
});

/**
 * Get competitor overview - position comparison over time
 */
export const getCompetitorOverview = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysToFetch = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Get all competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get all keywords for this domain
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get own domain's positions
    const ownPositions = await Promise.all(
      keywords.map(async (keyword) => {
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .filter((q) => q.gte(q.field("date"), startDateStr))
          .collect();
        return positions.map((p) => ({ ...p, keywordId: keyword._id }));
      })
    );

    // Get competitor positions
    const competitorData = await Promise.all(
      competitors.map(async (competitor) => {
        const allPositions = await ctx.db
          .query("competitorKeywordPositions")
          .withIndex("by_competitor", (q) => q.eq("competitorId", competitor._id))
          .filter((q) => q.gte(q.field("date"), startDateStr))
          .collect();

        return {
          competitor,
          positions: allPositions,
        };
      })
    );

    // Aggregate by date
    const dateMap = new Map<string, {
      date: string;
      own: number[];
      competitors: Map<Id<"competitors">, number[]>;
    }>();

    // Process own positions
    ownPositions.flat().forEach((pos) => {
      if (!pos.position) return;
      if (!dateMap.has(pos.date)) {
        dateMap.set(pos.date, {
          date: pos.date,
          own: [],
          competitors: new Map(),
        });
      }
      dateMap.get(pos.date)!.own.push(pos.position);
    });

    // Process competitor positions
    competitorData.forEach(({ competitor, positions }) => {
      positions.forEach((pos) => {
        if (!pos.position) return;
        if (!dateMap.has(pos.date)) {
          dateMap.set(pos.date, {
            date: pos.date,
            own: [],
            competitors: new Map(),
          });
        }
        const dayData = dateMap.get(pos.date)!;
        if (!dayData.competitors.has(competitor._id)) {
          dayData.competitors.set(competitor._id, []);
        }
        dayData.competitors.get(competitor._id)!.push(pos.position);
      });
    });

    // Calculate averages
    const result = Array.from(dateMap.values())
      .map((day) => {
        const ownAvg = day.own.length > 0
          ? day.own.reduce((sum, pos) => sum + pos, 0) / day.own.length
          : null;

        const competitorAvgs: Array<{
          competitorId: Id<"competitors">;
          avgPosition: number;
        }> = [];

        day.competitors.forEach((positions, competitorId) => {
          if (positions.length > 0) {
            const avg = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
            competitorAvgs.push({ competitorId, avgPosition: avg });
          }
        });

        return {
          date: day.date,
          ownAvgPosition: ownAvg,
          competitors: competitorAvgs,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      data: result,
      competitors: competitors.map((c) => ({
        id: c._id,
        name: c.name || c.competitorDomain,
        domain: c.competitorDomain,
      })),
    };
  },
});

/**
 * Get keyword overlap/gap data for Venn diagram
 */
export const getKeywordOverlap = query({
  args: {
    domainId: v.id("domains"),
    competitorId: v.optional(v.id("competitors")),
  },
  handler: async (ctx, args) => {
    // Get all keywords for domain
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const keywordIds = keywords.map((k) => k._id);

    // Get own positions (keywords we rank for)
    const ownPositions = await Promise.all(
      keywordIds.map(async (keywordId) => {
        const latest = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
          .order("desc")
          .first();
        return latest && latest.position !== null ? keywordId : null;
      })
    );

    const ownRankingKeywords = new Set(
      ownPositions.filter((id): id is Id<"keywords"> => id !== null)
    );

    // Get competitor positions
    let competitorRankingKeywords = new Set<Id<"keywords">>();

    if (args.competitorId) {
      const competitorPositions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
        .collect();

      const latestCompetitorPositions = new Map<Id<"keywords">, typeof competitorPositions[0]>();
      competitorPositions.forEach((pos) => {
        const existing = latestCompetitorPositions.get(pos.keywordId);
        if (!existing || pos.fetchedAt > existing.fetchedAt) {
          latestCompetitorPositions.set(pos.keywordId, pos);
        }
      });

      latestCompetitorPositions.forEach((pos, keywordId) => {
        if (pos.position !== null) {
          competitorRankingKeywords.add(keywordId);
        }
      });
    }

    // Calculate overlap
    const onlyOwn = new Set([...ownRankingKeywords].filter((k) => !competitorRankingKeywords.has(k)));
    const onlyCompetitor = new Set([...competitorRankingKeywords].filter((k) => !ownRankingKeywords.has(k)));
    const both = new Set([...ownRankingKeywords].filter((k) => competitorRankingKeywords.has(k)));

    return {
      onlyOwn: onlyOwn.size,
      onlyCompetitor: onlyCompetitor.size,
      both: both.size,
      totalOwn: ownRankingKeywords.size,
      totalCompetitor: competitorRankingKeywords.size,
    };
  },
});

/**
 * Get keyword gap opportunities - keywords competitor ranks for but we don't (or rank poorly)
 */
export const getCompetitorKeywordGaps = query({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
    minPosition: v.optional(v.number()), // Competitor must rank at least this well
    maxOwnPosition: v.optional(v.number()), // We must rank worse than this (or not at all)
  },
  handler: async (ctx, args) => {
    const minPosition = args.minPosition || 20;
    const maxOwnPosition = args.maxOwnPosition || 50;

    // Get all keywords
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get competitor positions
    const competitorPositions = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    // Get latest competitor position for each keyword
    const latestCompetitorPositions = new Map<Id<"keywords">, {
      position: number | null;
      url: string | null;
      date: string;
    }>();

    competitorPositions.forEach((pos) => {
      const existing = latestCompetitorPositions.get(pos.keywordId);
      if (!existing || pos.fetchedAt > (existing as any).fetchedAt) {
        latestCompetitorPositions.set(pos.keywordId, {
          position: pos.position,
          url: pos.url,
          date: pos.date,
        });
      }
    });

    // Get own positions
    const gaps = await Promise.all(
      keywords.map(async (keyword) => {
        const competitorData = latestCompetitorPositions.get(keyword._id);
        if (!competitorData || competitorData.position === null || competitorData.position > minPosition) {
          return null;
        }

        // Get our position
        const ownPosition = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .order("desc")
          .first();

        const ourPosition = ownPosition?.position || null;

        // Gap exists if competitor ranks well and we don't
        if (ourPosition === null || ourPosition > maxOwnPosition) {
          const gap = ourPosition !== null ? ourPosition - competitorData.position : 100;

          return {
            keywordId: keyword._id,
            phrase: keyword.phrase,
            competitorPosition: competitorData.position,
            competitorUrl: competitorData.url,
            ourPosition,
            gap,
            searchVolume: ownPosition?.searchVolume || keyword.searchVolume,
            difficulty: ownPosition?.difficulty || keyword.difficulty,
            gapScore: calculateGapScore(
              competitorData.position,
              ourPosition,
              ownPosition?.searchVolume || keyword.searchVolume || 0,
              ownPosition?.difficulty || keyword.difficulty || 50
            ),
          };
        }

        return null;
      })
    );

    return gaps
      .filter((gap): gap is NonNullable<typeof gap> => gap !== null)
      .sort((a, b) => b.gapScore - a.gapScore);
  },
});

/**
 * Calculate opportunity score for a keyword gap
 * Higher score = better opportunity
 */
function calculateGapScore(
  competitorPosition: number,
  ourPosition: number | null,
  searchVolume: number,
  difficulty: number
): number {
  // Competitor rank factor (better rank = higher score)
  const competitorFactor = (21 - Math.min(competitorPosition, 20)) / 20;

  // Our position factor (worse position = higher score for improvement)
  const ourPositionFactor = ourPosition === null ? 1 : Math.min(ourPosition / 100, 1);

  // Volume factor (logarithmic scale)
  const volumeFactor = Math.log10(Math.max(searchVolume, 10)) / 4; // Max log10(10000) = 4

  // Difficulty factor (easier = better)
  const difficultyFactor = (100 - difficulty) / 100;

  // Combined score (0-100)
  const score = (
    competitorFactor * 30 +
    ourPositionFactor * 25 +
    volumeFactor * 25 +
    difficultyFactor * 20
  );

  return Math.round(score * 10) / 10;
}
