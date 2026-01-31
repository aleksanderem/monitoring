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
