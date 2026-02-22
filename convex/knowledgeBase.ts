import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

/**
 * List published articles, optionally filtered by category.
 */
export const getArticles = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.category) {
      const articles = await ctx.db
        .query("kbArticles")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
      return articles
        .filter((a) => a.isPublished)
        .sort((a, b) => a.order - b.order);
    }

    const articles = await ctx.db
      .query("kbArticles")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    return articles.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get a single article by slug.
 */
export const getArticle = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kbArticles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Full-text search across article titles and content.
 */
export const searchArticles = query({
  args: {
    queryText: v.string(),
  },
  handler: async (ctx, args) => {
    const searchLower = args.queryText.toLowerCase();
    if (!searchLower.trim()) return [];

    const allArticles = await ctx.db
      .query("kbArticles")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    return allArticles
      .filter(
        (a) =>
          a.title.toLowerCase().includes(searchLower) ||
          a.content.toLowerCase().includes(searchLower) ||
          a.tags.some((t) => t.toLowerCase().includes(searchLower))
      )
      .sort((a, b) => a.order - b.order);
  },
});

/**
 * Get distinct categories with article counts.
 */
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db
      .query("kbArticles")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    const categoryMap = new Map<string, number>();
    for (const article of articles) {
      categoryMap.set(
        article.category,
        (categoryMap.get(article.category) ?? 0) + 1
      );
    }

    return Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));
  },
});

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

/**
 * Create a new KB article.
 */
export const createArticle = mutation({
  args: {
    slug: v.string(),
    category: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check slug uniqueness
    const existing = await ctx.db
      .query("kbArticles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("Article with this slug already exists");

    const now = Date.now();
    return await ctx.db.insert("kbArticles", {
      slug: args.slug,
      category: args.category,
      title: args.title,
      content: args.content,
      tags: args.tags,
      order: args.order ?? 0,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing article.
 */
export const updateArticle = mutation({
  args: {
    articleId: v.id("kbArticles"),
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { articleId, ...updates } = args;
    const filtered: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }

    await ctx.db.patch(articleId, filtered);
  },
});

/**
 * Delete an article.
 */
export const deleteArticle = mutation({
  args: {
    articleId: v.id("kbArticles"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.articleId);
  },
});

/**
 * Toggle published/unpublished status.
 */
export const togglePublished = mutation({
  args: {
    articleId: v.id("kbArticles"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");

    await ctx.db.patch(args.articleId, {
      isPublished: !article.isPublished,
      updatedAt: Date.now(),
    });
  },
});
