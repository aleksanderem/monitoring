import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  writeKeywordPositions,
  writeCompetitorPositions,
  type KeywordPositionRow,
  type CompetitorPositionRow,
} from "./lib/supabase";

const BATCH_SIZE = 500;

/**
 * Internal query: get all keyword positions for a single keyword.
 * Returns domainId for Supabase row construction.
 */
export const getKeywordPositionsForBackfill = internalQuery({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return null;

    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .collect();

    return {
      domainId: keyword.domainId,
      positions: positions.map((p) => ({
        date: p.date,
        position: p.position,
        url: p.url,
        searchVolume: p.searchVolume ?? null,
        difficulty: p.difficulty ?? null,
        cpc: p.cpc ?? null,
      })),
    };
  },
});

/**
 * Internal query: get all competitor positions for a single competitor.
 */
export const getCompetitorPositionsForBackfill = internalQuery({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const positions = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    return positions.map((p) => ({
      keywordId: p.keywordId as string,
      date: p.date,
      position: p.position,
      url: p.url,
    }));
  },
});

/**
 * Internal query: get all keyword IDs for a domain.
 */
export const getDomainKeywordIdsForBackfill = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    return keywords.map((k) => k._id);
  },
});

/**
 * Internal query: get all competitor IDs for a domain.
 */
export const getDomainCompetitorIdsForBackfill = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    return competitors.map((c) => c._id);
  },
});

/**
 * Internal query: get all domain IDs in the system.
 */
export const getAllDomainIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const domains = await ctx.db.query("domains").collect();
    return domains.map((d) => d._id);
  },
});

/**
 * Backfill keyword positions for a single domain to Supabase.
 * Processes keywords one at a time, batches writes to Supabase in chunks of BATCH_SIZE.
 */
export const backfillKeywordPositionsForDomain = internalAction({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<{ domainId: string; keywordCount: number; positionRows: number }> => {
    const keywordIds: string[] = await ctx.runQuery(
      internal.backfillSupabase.getDomainKeywordIdsForBackfill,
      { domainId: args.domainId } as any // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    console.log(`[backfill] Domain ${args.domainId}: ${keywordIds.length} keywords to backfill`);

    let totalRows = 0;
    let buffer: KeywordPositionRow[] = [];

    for (const keywordId of keywordIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ctx.runQuery(
        internal.backfillSupabase.getKeywordPositionsForBackfill,
        { keywordId: keywordId as any }
      ) as { domainId: string; positions: Array<{ date: string; position: number | null; url: string | null; searchVolume: number | null; difficulty: number | null; cpc: number | null }> } | null;

      if (!result) continue;

      for (const pos of result.positions) {
        buffer.push({
          convex_domain_id: result.domainId,
          convex_keyword_id: keywordId,
          date: pos.date,
          position: pos.position,
          url: pos.url,
          search_volume: pos.searchVolume,
          difficulty: pos.difficulty,
          cpc: pos.cpc,
        });

        if (buffer.length >= BATCH_SIZE) {
          await writeKeywordPositions(buffer);
          totalRows += buffer.length;
          buffer = [];
        }
      }
    }

    // Flush remaining
    if (buffer.length > 0) {
      await writeKeywordPositions(buffer);
      totalRows += buffer.length;
    }

    console.log(`[backfill] Domain ${args.domainId}: wrote ${totalRows} keyword position rows to Supabase`);
    return { domainId: args.domainId, keywordCount: keywordIds.length, positionRows: totalRows };
  },
});

/**
 * Backfill competitor positions for a single domain to Supabase.
 */
export const backfillCompetitorPositionsForDomain = internalAction({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<{ domainId: string; competitorCount: number; positionRows: number }> => {
    const competitorIds: string[] = await ctx.runQuery(
      internal.backfillSupabase.getDomainCompetitorIdsForBackfill,
      { domainId: args.domainId } as any // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    console.log(`[backfill] Domain ${args.domainId}: ${competitorIds.length} competitors to backfill`);

    let totalRows = 0;
    let buffer: CompetitorPositionRow[] = [];

    for (const competitorId of competitorIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const positions: Array<{ keywordId: string; date: string; position: number | null; url: string | null }> = await ctx.runQuery(
        internal.backfillSupabase.getCompetitorPositionsForBackfill,
        { competitorId: competitorId as any }
      );

      for (const pos of positions) {
        buffer.push({
          convex_competitor_id: competitorId,
          convex_keyword_id: pos.keywordId,
          date: pos.date,
          position: pos.position,
          url: pos.url,
        });

        if (buffer.length >= BATCH_SIZE) {
          await writeCompetitorPositions(buffer);
          totalRows += buffer.length;
          buffer = [];
        }
      }
    }

    // Flush remaining
    if (buffer.length > 0) {
      await writeCompetitorPositions(buffer);
      totalRows += buffer.length;
    }

    console.log(`[backfill] Domain ${args.domainId}: wrote ${totalRows} competitor position rows to Supabase`);
    return { domainId: args.domainId, competitorCount: competitorIds.length, positionRows: totalRows };
  },
});

/**
 * Backfill ALL historical data from Convex to Supabase.
 * Schedules per-domain backfills to avoid action timeouts.
 */
export const backfillAll = internalAction({
  args: {},
  handler: async (ctx): Promise<{ domainsScheduled: number }> => {
    const domainIds: string[] = await ctx.runQuery(internal.backfillSupabase.getAllDomainIds);

    console.log(`[backfill] Starting full backfill for ${domainIds.length} domains`);

    for (const domainId of domainIds) {
      // Schedule each domain as a separate action to avoid timeout
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.scheduler.runAfter(0, internal.backfillSupabase.backfillKeywordPositionsForDomain, {
        domainId: domainId as any,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.scheduler.runAfter(0, internal.backfillSupabase.backfillCompetitorPositionsForDomain, {
        domainId: domainId as any,
      });
    }

    console.log(`[backfill] Scheduled ${domainIds.length * 2} backfill jobs (keywords + competitors)`);
    return { domainsScheduled: domainIds.length };
  },
});

/**
 * Internal query: get keywords with sparse position data (fewer than minEntries).
 * Returns keyword info needed for fetchHistoricalPositionsInternal.
 */
export const getKeywordsNeedingHistory = internalQuery({
  args: { domainId: v.id("domains"), minEntries: v.number() },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return [];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const results: Array<{
      keywordId: string;
      phrase: string;
      positionCount: number;
      domain: string;
      location: string;
      language: string;
    }> = [];

    for (const kw of keywords) {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword_date", (q) => q.eq("keywordId", kw._id))
        .collect();

      if (positions.length < args.minEntries) {
        results.push({
          keywordId: kw._id,
          phrase: kw.phrase,
          positionCount: positions.length,
          domain: domain.domain,
          location: domain.settings?.location ?? "Poland",
          language: domain.settings?.language ?? "pl",
        });
      }
    }

    return results;
  },
});

/**
 * Backfill historical positions for keywords that have sparse data.
 * Calls fetchHistoricalPositionsInternal for each keyword with < minEntries positions.
 * Schedules per-domain to avoid action timeouts.
 */
export const backfillHistoricalPositions = internalAction({
  args: { minEntries: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ totalKeywords: number; domainsProcessed: number }> => {
    const minEntries = args.minEntries ?? 3;
    const domainIds: string[] = await ctx.runQuery(internal.backfillSupabase.getAllDomainIds);

    let totalKeywords = 0;

    for (const domainId of domainIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keywords = await ctx.runQuery(internal.backfillSupabase.getKeywordsNeedingHistory, {
        domainId: domainId as any,
        minEntries,
      });

      for (const kw of keywords) {
        console.log(`[backfillHistory] Fetching history for "${kw.phrase}" (${kw.positionCount} existing entries)`);
        try {
          await ctx.runAction(internal.dataforseo.fetchHistoricalPositionsInternal, {
            keywordId: kw.keywordId as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            phrase: kw.phrase,
            domain: kw.domain,
            location: kw.location,
            language: kw.language,
            months: 6,
          });
          totalKeywords++;
        } catch (err: any) {
          console.error(`[backfillHistory] Failed for "${kw.phrase}":`, err.message);
        }
      }
    }

    console.log(`[backfillHistory] Completed: fetched history for ${totalKeywords} keywords across ${domainIds.length} domains`);
    return { totalKeywords, domainsProcessed: domainIds.length };
  },
});
