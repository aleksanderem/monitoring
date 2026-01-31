import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Get competitor by ID (internal)
 */
export const getCompetitorById = internalQuery({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.competitorId);
  },
});

/**
 * Get domain by ID (internal)
 */
export const getDomainById = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.domainId);
  },
});

/**
 * Get keywords for a domain (internal)
 */
export const getKeywordsByDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});
