import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Add a new competitor domain
 */
export const addCompetitor = mutation({
  args: {
    domainId: v.id("domains"),
    competitorDomain: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if competitor already exists
    const existing = await ctx.db
      .query("competitors")
      .withIndex("by_domain_competitor", (q) =>
        q.eq("domainId", args.domainId).eq("competitorDomain", args.competitorDomain)
      )
      .first();

    if (existing) {
      throw new Error("Competitor domain already added");
    }

    // Create competitor
    const competitorId = await ctx.db.insert("competitors", {
      domainId: args.domainId,
      competitorDomain: args.competitorDomain,
      name: args.name || args.competitorDomain,
      status: "active",
      createdAt: Date.now(),
    });

    return competitorId;
  },
});

/**
 * Update competitor details
 */
export const updateCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, args) => {
    const { competitorId, ...updates } = args;

    await ctx.db.patch(competitorId, {
      ...updates,
    });

    return competitorId;
  },
});

/**
 * Remove a competitor
 */
export const removeCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    // Delete all competitor keyword positions
    const positions = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    await Promise.all(positions.map((pos) => ctx.db.delete(pos._id)));

    // Delete competitor
    await ctx.db.delete(args.competitorId);

    return { success: true };
  },
});

/**
 * Store competitor position data (internal)
 */
export const storeCompetitorPosition = internalMutation({
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
      // Update existing
      await ctx.db.patch(existing._id, {
        position: args.position,
        url: args.url,
        fetchedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Insert new
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
 * Update last checked timestamp
 */
export const updateLastChecked = internalMutation({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.competitorId, {
      lastCheckedAt: Date.now(),
    });
  },
});
