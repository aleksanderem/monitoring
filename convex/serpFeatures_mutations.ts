import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Save or update SERP features for a keyword
 */
export const saveSerpFeatures = mutation({
  args: {
    keywordId: v.id("keywords"),
    date: v.string(), // YYYY-MM-DD
    features: v.object({
      featuredSnippet: v.optional(v.boolean()),
      peopleAlsoAsk: v.optional(v.boolean()),
      imagePack: v.optional(v.boolean()),
      videoPack: v.optional(v.boolean()),
      localPack: v.optional(v.boolean()),
      knowledgeGraph: v.optional(v.boolean()),
      sitelinks: v.optional(v.boolean()),
      topStories: v.optional(v.boolean()),
      relatedSearches: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    // Check if record already exists for this keyword and date
    const existing = await ctx.db
      .query("serpFeatureTracking")
      .withIndex("by_keyword_date", (q) =>
        q.eq("keywordId", args.keywordId).eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        features: args.features,
        fetchedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new record
      const id = await ctx.db.insert("serpFeatureTracking", {
        keywordId: args.keywordId,
        date: args.date,
        features: args.features,
        fetchedAt: Date.now(),
      });
      return id;
    }
  },
});

/**
 * Bulk save SERP features for multiple keywords
 */
export const bulkSaveSerpFeatures = mutation({
  args: {
    records: v.array(
      v.object({
        keywordId: v.id("keywords"),
        date: v.string(),
        features: v.object({
          featuredSnippet: v.optional(v.boolean()),
          peopleAlsoAsk: v.optional(v.boolean()),
          imagePack: v.optional(v.boolean()),
          videoPack: v.optional(v.boolean()),
          localPack: v.optional(v.boolean()),
          knowledgeGraph: v.optional(v.boolean()),
          sitelinks: v.optional(v.boolean()),
          topStories: v.optional(v.boolean()),
          relatedSearches: v.optional(v.boolean()),
        }),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.records.map(async (record) => {
        // Check if exists
        const existing = await ctx.db
          .query("serpFeatureTracking")
          .withIndex("by_keyword_date", (q) =>
            q.eq("keywordId", record.keywordId).eq("date", record.date)
          )
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, {
            features: record.features,
            fetchedAt: Date.now(),
          });
          return existing._id;
        } else {
          const id = await ctx.db.insert("serpFeatureTracking", {
            keywordId: record.keywordId,
            date: record.date,
            features: record.features,
            fetchedAt: Date.now(),
          });
          return id;
        }
      })
    );

    return {
      saved: results.length,
      ids: results,
    };
  },
});
