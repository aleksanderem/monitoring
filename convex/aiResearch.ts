import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

export const getHistory = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiResearchSessions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(20);
  },
});

export const saveSession = internalMutation({
  args: {
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
    keywordCount: v.number(),
    focusType: v.union(
      v.literal("all"),
      v.literal("informational"),
      v.literal("commercial"),
      v.literal("transactional")
    ),
    keywords: v.array(v.object({
      keyword: v.string(),
      searchIntent: v.string(),
      relevanceScore: v.number(),
      rationale: v.string(),
      category: v.string(),
      searchVolume: v.number(),
      cpc: v.number(),
      competition: v.number(),
      difficulty: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiResearchSessions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const deleteSession = mutation({
  args: { id: v.id("aiResearchSessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
