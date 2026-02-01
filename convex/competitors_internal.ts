import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Internal query to get competitor details
 */
export const getCompetitorDetails = internalQuery({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.competitorId);
  },
});

/**
 * Internal query to get all keywords for a domain
 */
export const getDomainKeywords = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

/**
 * Internal query to get domain settings
 */
export const getDomainSettings = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.domainId);
  },
});

/**
 * Internal mutation to store competitor position
 */
export const storeCompetitorPositionInternal = internalMutation({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    date: v.string(),
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Check if position already exists for this date
    const existing = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor_keyword_date", (q) =>
        q
          .eq("competitorId", args.competitorId)
          .eq("keywordId", args.keywordId)
          .eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing position
      await ctx.db.patch(existing._id, {
        position: args.position,
        url: args.url,
        fetchedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Insert new position
      const positionId = await ctx.db.insert("competitorKeywordPositions", {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: args.date,
        position: args.position,
        url: args.url,
        fetchedAt: Date.now(),
      });
      return positionId;
    }
  },
});

/**
 * Internal mutation to update last checked timestamp
 */
export const updateLastChecked = internalMutation({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.competitorId, {
      lastCheckedAt: Date.now(),
    });
  },
});

/**
 * Internal query to get active competitors
 */
export const getActiveCompetitors = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();
  },
});

/**
 * Internal query to get all competitors (including paused)
 */
export const getCompetitorsByDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});
