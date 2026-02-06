import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Internal query to get competitor by ID
 */
export const getCompetitorInternal = internalQuery({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.competitorId);
  },
});

/**
 * Internal: Add a competitor domain to track (used by SERP fetch job)
 */
export const addCompetitorInternal = internalMutation({
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
      // Don't reactivate paused competitors - respect user's choice
      // Just update lastCheckedAt if it's active
      if (existing.status === "active") {
        await ctx.db.patch(existing._id, { lastCheckedAt: Date.now() });
      }
      return existing._id;
    }

    // Create new competitor (paused by default - user must activate)
    const competitorId = await ctx.db.insert("competitors", {
      domainId: args.domainId,
      competitorDomain: args.competitorDomain,
      name: args.name || args.competitorDomain,
      status: "paused",
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
    });

    return competitorId;
  },
});

/**
 * Add a competitor domain to track
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
      // Competitor already exists - throw error so user knows
      throw new Error(
        `Competitor "${args.competitorDomain}" already exists. ` +
        (existing.status === "paused"
          ? "It's currently paused - activate it from the list."
          : "It's already being tracked.")
      );
    }

    // Create new competitor (paused by default - user must activate)
    const competitorId = await ctx.db.insert("competitors", {
      domainId: args.domainId,
      competitorDomain: args.competitorDomain,
      name: args.name || args.competitorDomain,
      status: "paused",
      createdAt: Date.now(),
    });

    return competitorId;
  },
});

/**
 * Get all competitors for a domain (both active and paused)
 */
export const getCompetitors = query({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return competitors;
  },
});

/**
 * Remove/pause a competitor
 */
export const removeCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.competitorId, {
      status: "paused",
    });
  },
});

/**
 * Internal: Save competitor position data from SERP results
 */
export const saveCompetitorPosition = internalMutation({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    date: v.string(),
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Check if position for this date already exists
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
    } else {
      // Create new
      await ctx.db.insert("competitorKeywordPositions", {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: args.date,
        position: args.position,
        url: args.url,
        fetchedAt: Date.now(),
      });
    }
  },
});

/**
 * Get competitor positions for a keyword over time
 */
export const getCompetitorPositions = query({
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
      .take(30); // Last 30 data points

    return positions;
  },
});

/**
 * Internal mutation to update competitor last checked timestamp
 */
export const updateCompetitorLastChecked = internalMutation({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.competitorId, {
      lastCheckedAt: Date.now(),
    });
  },
});

/**
 * Update competitor (name or status)
 */
export const updateCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.competitorId, updates);
  },
});

/**
 * Get all competitors with their positions for a specific keyword
 */
export const getCompetitorsForKeyword = query({
  args: {
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    // Get all active competitors for this domain
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    // Get latest position for each competitor
    const competitorsWithPositions = await Promise.all(
      competitors.map(async (competitor) => {
        const latestPosition = await ctx.db
          .query("competitorKeywordPositions")
          .withIndex("by_competitor_keyword", (q) =>
            q.eq("competitorId", competitor._id).eq("keywordId", args.keywordId)
          )
          .order("desc")
          .first();

        return {
          ...competitor,
          currentPosition: latestPosition?.position || null,
          currentUrl: latestPosition?.url || null,
          lastChecked: latestPosition?.fetchedAt || null,
        };
      })
    );

    return competitorsWithPositions;
  },
});
