import { v } from "convex/values";
import { query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";
import { getSupabaseAdmin } from "./lib/supabase";

/**
 * Get position scatter data: your position vs competitor position per keyword.
 * Each data point is a keyword-competitor pair where both sides have a ranking.
 * Migrated to Supabase action.
 */
export const getPositionScatterData = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: args.domainId });
    if (!domain) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    // Get active keywords with denormalized positions from Convex
    const keywords = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, { domainId: args.domainId });
    const competitors = await ctx.runQuery(internal.competitors_internal.getActiveCompetitors, { domainId: args.domainId });

    if (competitors.length === 0 || keywords.length === 0) return [];

    // Build keyword map for quick lookup (only keywords where we have a position)
    type KW = { _id: string; currentPosition?: number | null; phrase: string; searchVolume?: number | null };
    const keywordMap = new Map<string, KW>(
      keywords
        .filter((k: KW) => k.currentPosition != null)
        .map((k: KW) => [k._id, k])
    );

    const keywordIds = [...keywordMap.keys()];
    if (keywordIds.length === 0) return [];

    const competitorIds = competitors.map((c: { _id: string }) => c._id);

    // Get latest competitor positions from Supabase
    const { data: compRows } = await sb
      .from("competitor_keyword_positions")
      .select("convex_competitor_id, convex_keyword_id, position, date")
      .in("convex_competitor_id", competitorIds)
      .in("convex_keyword_id", keywordIds)
      .not("position", "is", null)
      .order("date", { ascending: false });

    // Build competitor name map
    const competitorNameMap = new Map<string, string>(
      competitors.map((c: { _id: string; name?: string | null; competitorDomain: string }) => [c._id, c.name || c.competitorDomain])
    );

    // Deduplicate to latest per competitor+keyword
    const latestByKey = new Map<string, { competitorId: string; keywordId: string; position: number }>();
    for (const row of compRows || []) {
      const key = `${row.convex_competitor_id}:${row.convex_keyword_id}`;
      if (!latestByKey.has(key)) {
        latestByKey.set(key, {
          competitorId: row.convex_competitor_id,
          keywordId: row.convex_keyword_id,
          position: row.position,
        });
      }
    }

    // Match with our keywords
    const result: Array<{
      keyword: string;
      yourPosition: number;
      competitorName: string;
      competitorPosition: number;
      searchVolume: number;
    }> = [];

    for (const [, compData] of latestByKey) {
      const keyword = keywordMap.get(compData.keywordId);
      if (!keyword || keyword.currentPosition == null) continue;

      result.push({
        keyword: keyword.phrase,
        yourPosition: keyword.currentPosition,
        competitorName: competitorNameMap.get(compData.competitorId) || "Unknown",
        competitorPosition: compData.position,
        searchVolume: keyword.searchVolume ?? 0,
      });
    }

    return result;
  },
});

/**
 * Get backlink radar data: normalized metrics for radar chart comparison.
 * Metrics: totalBacklinks, referringDomains, dofollowRatio, avgDomainRank, freshBacklinksRatio
 * NOTE: This does NOT read competitorKeywordPositions, so it stays as a query.
 */
export const getBacklinkRadarData = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

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
 * NOTE: This does NOT read competitorKeywordPositions, so it stays as a query.
 */
export const getBacklinkQualityComparison = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { tiers: [], series: [] };
    await requireTenantAccess(ctx, "domain", args.domainId);

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
 * NOTE: This uses SERP results, NOT competitorKeywordPositions. Stays as a query.
 */
export const getKeywordPositionBars = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { keywords: [], series: [] };
    await requireTenantAccess(ctx, "domain", args.domainId);

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

    // Get active competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    const competitorDomains = competitors.map((c) =>
      c.competitorDomain.toLowerCase().replace(/^www\./, "")
    );

    // Use SERP results (same source as keyword map) for competitor positions
    const ownPositions: (number | null)[] = [];
    const competitorPositionsByDomain = new Map<string, (number | null)[]>();
    for (const cd of competitorDomains) {
      competitorPositionsByDomain.set(cd, []);
    }

    for (const keyword of topKeywords) {
      // Get latest SERP results for this keyword
      const serpResults = await ctx.db
        .query("keywordSerpResults")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(100);

      if (serpResults.length === 0) {
        // Fall back to recentPositions -> currentPosition for own domain
        const recent = keyword.recentPositions;
        const ownPos = (recent && recent.length > 0)
          ? (recent[recent.length - 1].position ?? null)
          : (keyword.currentPosition ?? null);
        ownPositions.push(ownPos);
        for (const cd of competitorDomains) {
          competitorPositionsByDomain.get(cd)!.push(null);
        }
        continue;
      }

      const latestDate = serpResults[0].date;
      const latestResults = serpResults.filter((r) => r.date === latestDate);

      // Own position: SERP first, then recentPositions, then currentPosition
      const yourResult = latestResults.find((r) => r.isYourDomain);
      let ownPos = yourResult?.position ?? null;
      if (ownPos == null) {
        const recent = keyword.recentPositions;
        ownPos = (recent && recent.length > 0)
          ? (recent[recent.length - 1].position ?? null)
          : (keyword.currentPosition ?? null);
      }
      ownPositions.push(ownPos);

      // Competitor positions from SERP
      for (const cd of competitorDomains) {
        const compResult = latestResults.find((r) => {
          const rd = (r.mainDomain || r.domain || "").toLowerCase().replace(/^www\./, "");
          return rd === cd || rd.endsWith("." + cd);
        });
        competitorPositionsByDomain.get(cd)!.push(compResult?.position ?? null);
      }
    }

    const series: Array<{ name: string; positions: (number | null)[] }> = [
      { name: "__own__", positions: ownPositions },
    ];

    for (const comp of competitors) {
      const cd = comp.competitorDomain.toLowerCase().replace(/^www\./, "");
      series.push({
        name: comp.name || comp.competitorDomain,
        positions: competitorPositionsByDomain.get(cd) ?? [],
      });
    }

    return {
      keywords: topKeywords.map((k) => k.phrase),
      series,
    };
  },
});
