import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Internal query to get latest position for a keyword
 */
export const getLatestPosition = internalQuery({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .order("desc")
      .take(1);

    return positions[0] ?? null;
  },
});

/**
 * Batch query: get latest position for multiple keywords at once.
 * Returns an array of { keywordId, position, url, date } for each keyword that has positions.
 */
export const getLatestPositionsBatch = internalQuery({
  args: { keywordIds: v.array(v.id("keywords")) },
  handler: async (ctx, args) => {
    const results: Array<{
      keywordId: string;
      position: number | null;
      url: string | null;
      date: string;
    }> = [];

    for (const keywordId of args.keywordIds) {
      const latest = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
        .order("desc")
        .first();

      if (latest) {
        results.push({
          keywordId: latest.keywordId,
          position: latest.position,
          url: latest.url ?? null,
          date: latest.date,
        });
      }
    }

    return results;
  },
});
