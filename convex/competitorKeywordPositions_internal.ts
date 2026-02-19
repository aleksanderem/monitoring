import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Internal query to get latest position for a competitor and keyword
 */
export const getLatestPosition = internalQuery({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    const positions = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor_keyword", (q) =>
        q.eq("competitorId", args.competitorId).eq("keywordId", args.keywordId)
      )
      .order("desc")
      .take(1);

    return positions[0] ?? null;
  },
});

/**
 * Batch query: get latest positions for multiple competitors × keywords at once.
 * Fetches all positions per competitor (using by_competitor index), then filters
 * by the keyword set in memory — avoids N×M individual queries.
 * Returns array of { competitorId, keywordId, position, url, date }.
 */
export const getLatestCompetitorPositionsBatch = internalQuery({
  args: {
    competitorIds: v.array(v.id("competitors")),
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    const keywordIdSet = new Set(args.keywordIds.map((id) => id.toString()));
    const results: Array<{
      competitorId: string;
      keywordId: string;
      position: number | null;
      url: string | null;
      date: string;
    }> = [];

    for (const competitorId of args.competitorIds) {
      // Fetch all positions for this competitor, grouped by keyword
      const allPositions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
        .order("desc")
        .collect();

      // Keep only the latest position per keyword that's in our set
      const seenKeywords = new Set<string>();
      for (const pos of allPositions) {
        const kwId = pos.keywordId.toString();
        if (keywordIdSet.has(kwId) && !seenKeywords.has(kwId)) {
          seenKeywords.add(kwId);
          results.push({
            competitorId: pos.competitorId,
            keywordId: pos.keywordId,
            position: pos.position,
            url: pos.url ?? null,
            date: pos.date,
          });
        }
      }
    }

    return results;
  },
});
