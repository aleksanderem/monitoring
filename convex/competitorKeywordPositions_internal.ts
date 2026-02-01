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
