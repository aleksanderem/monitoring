import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

// ─── Queries ─────────────────────────────────────────────

export const getGeneratorOutputs = query({
  args: {
    domainId: v.id("domains"),
    type: v.optional(
      v.union(
        v.literal("jsonSchema"),
        v.literal("llmsTxt"),
        v.literal("llmsFullTxt")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("generatorOutputs")
        .withIndex("by_domain_type", (q) =>
          q.eq("domainId", args.domainId).eq("type", args.type!)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("generatorOutputs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .collect();
  },
});

export const getLatestOutput = query({
  args: {
    domainId: v.id("domains"),
    type: v.union(
      v.literal("jsonSchema"),
      v.literal("llmsTxt"),
      v.literal("llmsFullTxt")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generatorOutputs")
      .withIndex("by_domain_type", (q) =>
        q.eq("domainId", args.domainId).eq("type", args.type)
      )
      .order("desc")
      .first();
  },
});

// ─── Mutations ───────────────────────────────────────────

export const createGeneratorOutput = mutation({
  args: {
    domainId: v.id("domains"),
    type: v.union(
      v.literal("jsonSchema"),
      v.literal("llmsTxt"),
      v.literal("llmsFullTxt")
    ),
  },
  handler: async (ctx, args) => {
    // Auto-increment version
    const latest = await ctx.db
      .query("generatorOutputs")
      .withIndex("by_domain_type", (q) =>
        q.eq("domainId", args.domainId).eq("type", args.type)
      )
      .order("desc")
      .first();

    const version = (latest?.version ?? 0) + 1;

    return await ctx.db.insert("generatorOutputs", {
      domainId: args.domainId,
      type: args.type,
      version,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// ─── Internal (for actions) ──────────────────────────────

export const updateGeneratorStatus = internalMutation({
  args: {
    outputId: v.id("generatorOutputs"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { outputId, ...updates } = args;
    const patch: Record<string, any> = { status: updates.status };
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.metadata !== undefined) patch.metadata = updates.metadata;
    if (updates.error !== undefined) patch.error = updates.error;
    await ctx.db.patch(outputId, patch);
  },
});

export const getOnsitePagesInternal = internalQuery({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Sort by pageScore descending, take top N
    const sorted = pages
      .sort((a, b) => {
        const scoreA = (a as any).pageScore?.overall ?? 0;
        const scoreB = (b as any).pageScore?.overall ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, args.limit ?? 50);

    return sorted.map((p) => ({
      url: p.url,
      title: p.title ?? null,
      metaDescription: p.metaDescription ?? null,
      h1: p.h1 ?? null,
      htags: p.htags ?? null,
      wordCount: p.wordCount,
      statusCode: p.statusCode,
    }));
  },
});

export const getSchemaValidationInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schemaValidation")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getSitemapUrlsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const sitemap = await ctx.db
      .query("domainSitemapData")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
    return sitemap?.urls ?? [];
  },
});

export const getTopKeywordsInternal = internalQuery({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return keywords
      .filter((k) => k.currentPosition != null && k.currentPosition > 0)
      .sort((a, b) => (a.currentPosition ?? 999) - (b.currentPosition ?? 999))
      .slice(0, args.limit ?? 30)
      .map((k) => ({
        keyword: k.phrase,
        position: k.currentPosition,
        url: k.currentUrl ?? null,
      }));
  },
});
