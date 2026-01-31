import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Add a new competitor to track
 */
export const addCompetitor = mutation({
  args: {
    domainId: v.id("domains"),
    competitorDomain: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate domain format (basic check)
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(args.competitorDomain)) {
      throw new Error("Invalid domain format");
    }

    // Check for duplicates
    const existing = await ctx.db
      .query("competitors")
      .withIndex("by_domain_competitor", (q) =>
        q.eq("domainId", args.domainId).eq("competitorDomain", args.competitorDomain)
      )
      .first();

    if (existing) {
      throw new Error("This competitor is already being tracked");
    }

    // Get domain to verify it exists
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    // Check if trying to add own domain as competitor
    if (args.competitorDomain.toLowerCase() === domain.domain.toLowerCase()) {
      throw new Error("Cannot add your own domain as a competitor");
    }

    // Create competitor
    const competitorId = await ctx.db.insert("competitors", {
      domainId: args.domainId,
      competitorDomain: args.competitorDomain.toLowerCase(),
      name: args.name ?? args.competitorDomain, // Use nullish coalescing to ensure string type
      status: "active",
      createdAt: Date.now(),
    });

    return competitorId;
  },
});

/**
 * Update competitor name and/or status
 */
export const updateCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, args) => {
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) {
      throw new Error("Competitor not found");
    }

    const updates: Partial<{
      name: string;
      status: "active" | "paused";
    }> = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.status !== undefined) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.competitorId, updates);

    return { success: true };
  },
});

/**
 * Pause competitor position checking
 */
export const pauseCompetitor = mutation({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) {
      throw new Error("Competitor not found");
    }

    await ctx.db.patch(args.competitorId, {
      status: "paused",
    });

    return { success: true };
  },
});

/**
 * Resume competitor position checking
 */
export const resumeCompetitor = mutation({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) {
      throw new Error("Competitor not found");
    }

    await ctx.db.patch(args.competitorId, {
      status: "active",
    });

    return { success: true };
  },
});

/**
 * Remove a competitor and all associated data
 */
export const removeCompetitor = mutation({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) {
      throw new Error("Competitor not found");
    }

    // Delete all competitor keyword positions
    const positions = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    for (const position of positions) {
      await ctx.db.delete(position._id);
    }

    // Delete the competitor
    await ctx.db.delete(args.competitorId);

    return { success: true, deletedPositions: positions.length };
  },
});

/**
 * Internal mutation to store competitor keyword position
 * Called by competitor position checking action
 */
export const storeCompetitorPosition = mutation({
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
 * Bulk delete competitor positions (for cleanup/testing)
 */
export const bulkDeleteCompetitorPositions = mutation({
  args: {
    competitorId: v.id("competitors"),
    beforeDate: v.optional(v.string()), // Delete positions before this date
  },
  handler: async (ctx, args) => {
    let positions;

    if (args.beforeDate) {
      positions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
        .filter((q) => q.lt(q.field("date"), args.beforeDate!))
        .collect();
    } else {
      positions = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
        .collect();
    }

    for (const position of positions) {
      await ctx.db.delete(position._id);
    }

    return { success: true, deletedCount: positions.length };
  },
});
