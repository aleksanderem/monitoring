import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Internal query to get keywords by domain
 */
export const getKeywordsByDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return keywords;
  },
});
