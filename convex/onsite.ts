import { v } from "convex/values";
import { query } from "./_generated/server";

// Get on-site analysis for a domain
export const getOnsiteAnalysis = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();
  },
});

// Get crawled pages for a domain
export const getOnsitePages = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

// Check if on-site analysis data is stale (older than 7 days)
export const isOnsiteDataStale = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    if (!analysis) {
      return true; // No data = stale
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return analysis.fetchedAt < sevenDaysAgo;
  },
});
