import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getSupabaseAdmin } from "../lib/supabase";

/**
 * Get all competitors for a domain with stats from Supabase
 */
export const getCompetitorsByDomain = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<any[]> => {
    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: args.domainId });
    if (!domain) return [];

    const competitors = await ctx.runQuery(internal.competitors_internal.getCompetitorsByDomain, { domainId: args.domainId });

    const sb = getSupabaseAdmin();
    if (!sb) {
      // Graceful fallback: return competitors without position stats
      return competitors
        .map((c: any) => ({
          ...c,
          keywordCount: 0,
          avgPosition: null,
          lastChecked: c.lastCheckedAt,
        }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
    }

    const competitorIds = competitors.map((c: any) => c._id);
    if (competitorIds.length === 0) return [];

    // Get latest position per competitor+keyword from Supabase
    const { data: positions } = await sb
      .from("competitor_keyword_positions")
      .select("convex_competitor_id, convex_keyword_id, position")
      .in("convex_competitor_id", competitorIds);

    // Build stats per competitor
    const statsMap = new Map<string, { keywords: Set<string>; positions: number[] }>();
    for (const row of positions || []) {
      let stats = statsMap.get(row.convex_competitor_id);
      if (!stats) {
        stats = { keywords: new Set(), positions: [] };
        statsMap.set(row.convex_competitor_id, stats);
      }
      stats.keywords.add(row.convex_keyword_id);
      if (row.position !== null) {
        stats.positions.push(row.position);
      }
    }

    return competitors
      .map((c: any) => {
        const stats = statsMap.get(c._id);
        const rankedPositions = stats?.positions || [];
        const avgPosition = rankedPositions.length > 0
          ? Math.round((rankedPositions.reduce((sum: number, p: number) => sum + p, 0) / rankedPositions.length) * 10) / 10
          : null;

        return {
          ...c,
          keywordCount: stats?.keywords.size || 0,
          avgPosition,
          lastChecked: c.lastCheckedAt,
        };
      })
      .sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

/**
 * Get competitor overview - position comparison over time
 */
export const getCompetitorOverview = action({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    data: Array<{
      date: string;
      ownAvgPosition: number | null;
      competitors: Array<{ competitorId: string; avgPosition: number }>;
    }>;
    competitors: Array<{ id: string; name: string; domain: string }>;
  } | null> => {
    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: args.domainId });
    if (!domain) return null;

    const sb = getSupabaseAdmin();
    if (!sb) return null;

    const daysToFetch = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Get competitors and keywords from Convex
    const competitors = await ctx.runQuery(internal.competitors_internal.getActiveCompetitors, { domainId: args.domainId });
    const keywords = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, { domainId: args.domainId });

    const competitorIds = competitors.map((c: any) => c._id);
    const keywordIds = keywords.map((k: any) => k._id);

    // Query Supabase for competitor positions
    const { data: compPositions } = await sb
      .from("competitor_keyword_positions")
      .select("convex_competitor_id, convex_keyword_id, date, position")
      .in("convex_competitor_id", competitorIds.length > 0 ? competitorIds : ["__none__"])
      .in("convex_keyword_id", keywordIds.length > 0 ? keywordIds : ["__none__"])
      .gte("date", startDateStr);

    // Query Supabase for own positions
    const { data: ownPositions } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, date, position")
      .in("convex_keyword_id", keywordIds.length > 0 ? keywordIds : ["__none__"])
      .gte("date", startDateStr);

    // Aggregate by date
    const dateMap = new Map<string, {
      date: string;
      own: number[];
      competitors: Map<string, number[]>;
    }>();

    // Process own positions
    for (const pos of ownPositions || []) {
      if (pos.position === null) continue;
      if (!dateMap.has(pos.date)) {
        dateMap.set(pos.date, { date: pos.date, own: [], competitors: new Map() });
      }
      dateMap.get(pos.date)!.own.push(pos.position);
    }

    // Process competitor positions
    for (const pos of compPositions || []) {
      if (pos.position === null) continue;
      if (!dateMap.has(pos.date)) {
        dateMap.set(pos.date, { date: pos.date, own: [], competitors: new Map() });
      }
      const dayData = dateMap.get(pos.date)!;
      if (!dayData.competitors.has(pos.convex_competitor_id)) {
        dayData.competitors.set(pos.convex_competitor_id, []);
      }
      dayData.competitors.get(pos.convex_competitor_id)!.push(pos.position);
    }

    // Calculate averages
    const result = Array.from(dateMap.values())
      .map((day) => {
        const ownAvg = day.own.length > 0
          ? day.own.reduce((sum, pos) => sum + pos, 0) / day.own.length
          : null;

        const competitorAvgs: Array<{
          competitorId: string;
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
      competitors: competitors.map((c: any) => ({
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
export const getKeywordOverlap = action({
  args: {
    domainId: v.id("domains"),
    competitorId: v.optional(v.id("competitors")),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: args.domainId });
    if (!domain) return { onlyOwn: 0, onlyCompetitor: 0, both: 0, totalOwn: 0, totalCompetitor: 0 };

    const sb = getSupabaseAdmin();
    if (!sb) return { onlyOwn: 0, onlyCompetitor: 0, both: 0, totalOwn: 0, totalCompetitor: 0 };

    const keywords = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, { domainId: args.domainId });
    const keywordIds = keywords.map((k: any) => k._id);

    if (keywordIds.length === 0) {
      return { onlyOwn: 0, onlyCompetitor: 0, both: 0, totalOwn: 0, totalCompetitor: 0 };
    }

    // Get latest own positions from Supabase (distinct keywords where we rank)
    const { data: ownRows } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, position")
      .in("convex_keyword_id", keywordIds)
      .not("position", "is", null)
      .order("date", { ascending: false });

    // Deduplicate to get latest per keyword
    const ownRankingKeywords = new Set<string>();
    const seenOwn = new Set<string>();
    for (const row of ownRows || []) {
      if (!seenOwn.has(row.convex_keyword_id)) {
        seenOwn.add(row.convex_keyword_id);
        if (row.position !== null) {
          ownRankingKeywords.add(row.convex_keyword_id);
        }
      }
    }

    // Get competitor positions
    let competitorRankingKeywords = new Set<string>();

    if (args.competitorId) {
      const { data: compRows } = await sb
        .from("competitor_keyword_positions")
        .select("convex_keyword_id, position")
        .eq("convex_competitor_id", args.competitorId)
        .not("position", "is", null)
        .order("date", { ascending: false });

      const seenComp = new Set<string>();
      for (const row of compRows || []) {
        if (!seenComp.has(row.convex_keyword_id)) {
          seenComp.add(row.convex_keyword_id);
          if (row.position !== null) {
            competitorRankingKeywords.add(row.convex_keyword_id);
          }
        }
      }
    }

    // Calculate overlap
    const onlyOwn = [...ownRankingKeywords].filter((k) => !competitorRankingKeywords.has(k)).length;
    const onlyCompetitor = [...competitorRankingKeywords].filter((k) => !ownRankingKeywords.has(k)).length;
    const both = [...ownRankingKeywords].filter((k) => competitorRankingKeywords.has(k)).length;

    return {
      onlyOwn,
      onlyCompetitor,
      both,
      totalOwn: ownRankingKeywords.size,
      totalCompetitor: competitorRankingKeywords.size,
    };
  },
});

/**
 * Get keyword gap opportunities - keywords competitor ranks for but we don't (or rank poorly)
 */
export const getCompetitorKeywordGaps = action({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
    minPosition: v.optional(v.number()),
    maxOwnPosition: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: args.domainId });
    if (!domain) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const minPosition = args.minPosition || 20;
    const maxOwnPosition = args.maxOwnPosition || 50;

    // Get keywords from Convex (need phrase, searchVolume, difficulty)
    const keywords = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, { domainId: args.domainId });
    const keywordIds = keywords.map((k: any) => k._id);
    const keywordMap = new Map(keywords.map((k: any) => [k._id, k]));

    if (keywordIds.length === 0) return [];

    // Get latest competitor positions from Supabase
    const { data: compRows } = await sb
      .from("competitor_keyword_positions")
      .select("convex_keyword_id, position, url, date")
      .eq("convex_competitor_id", args.competitorId)
      .in("convex_keyword_id", keywordIds)
      .order("date", { ascending: false });

    // Deduplicate to latest per keyword
    const latestCompPositions = new Map<string, { position: number | null; url: string | null; date: string }>();
    for (const row of compRows || []) {
      if (!latestCompPositions.has(row.convex_keyword_id)) {
        latestCompPositions.set(row.convex_keyword_id, {
          position: row.position,
          url: row.url,
          date: row.date,
        });
      }
    }

    // Get latest own positions from Supabase
    const { data: ownRows } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, position, search_volume, difficulty")
      .in("convex_keyword_id", keywordIds)
      .order("date", { ascending: false });

    // Deduplicate to latest per keyword
    const latestOwnPositions = new Map<string, { position: number | null; searchVolume: number | null; difficulty: number | null }>();
    for (const row of ownRows || []) {
      if (!latestOwnPositions.has(row.convex_keyword_id)) {
        latestOwnPositions.set(row.convex_keyword_id, {
          position: row.position,
          searchVolume: row.search_volume,
          difficulty: row.difficulty,
        });
      }
    }

    // Calculate gaps
    const gaps: Array<{
      keywordId: string;
      phrase: string;
      competitorPosition: number;
      competitorUrl: string | null;
      ourPosition: number | null;
      gap: number;
      searchVolume: number | undefined;
      difficulty: number | undefined;
      gapScore: number;
    }> = [];

    for (const keyword of keywords) {
      const compData = latestCompPositions.get(keyword._id);
      if (!compData || compData.position === null || compData.position > minPosition) {
        continue;
      }

      const ownData = latestOwnPositions.get(keyword._id);
      const ourPosition = ownData?.position ?? null;

      // Gap exists if competitor ranks well and we don't
      if (ourPosition === null || ourPosition > maxOwnPosition) {
        const gap = ourPosition !== null ? ourPosition - compData.position : 100;
        const sv = ownData?.searchVolume ?? keyword.searchVolume;
        const diff = ownData?.difficulty ?? keyword.difficulty;

        gaps.push({
          keywordId: keyword._id,
          phrase: keyword.phrase,
          competitorPosition: compData.position,
          competitorUrl: compData.url,
          ourPosition,
          gap,
          searchVolume: sv ?? undefined,
          difficulty: diff ?? undefined,
          gapScore: calculateGapScore(
            compData.position,
            ourPosition,
            sv || 0,
            diff || 50
          ),
        });
      }
    }

    return gaps.sort((a, b) => b.gapScore - a.gapScore);
  },
});

/**
 * Calculate opportunity score for a keyword gap
 */
function calculateGapScore(
  competitorPosition: number,
  ourPosition: number | null,
  searchVolume: number,
  difficulty: number
): number {
  const competitorFactor = (21 - Math.min(competitorPosition, 20)) / 20;
  const ourPositionFactor = ourPosition === null ? 1 : Math.min(ourPosition / 100, 1);
  const volumeFactor = Math.log10(Math.max(searchVolume, 10)) / 4;
  const difficultyFactor = (100 - difficulty) / 100;

  const score = (
    competitorFactor * 30 +
    ourPositionFactor * 25 +
    volumeFactor * 25 +
    difficultyFactor * 20
  );

  return Math.round(score * 10) / 10;
}
