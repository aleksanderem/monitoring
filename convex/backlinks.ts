import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

// Get backlink summary for a domain
export const getBacklinkSummary = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    return summary;
  },
});

// Check if backlink data is stale (older than 7 days)
export const isBacklinkDataStale = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    if (!summary) return true;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return summary.fetchedAt < sevenDaysAgo;
  },
});
