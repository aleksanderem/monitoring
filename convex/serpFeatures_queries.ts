import { query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

/**
 * Get SERP features for a specific keyword over time
 */
export const getSerpFeaturesByKeyword = query({
  args: {
    keywordId: v.id("keywords"),
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return [];
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    const days = args.days ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const features = await ctx.db
      .query("serpFeatureTracking")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .filter((q) => q.gte(q.field("date"), cutoffDateStr))
      .collect();

    return features.sort((a, b) => a.date.localeCompare(b.date));
  },
});

/**
 * Get current SERP features for a keyword (most recent)
 */
export const getCurrentSerpFeatures = query({
  args: {
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return null;
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    const features = await ctx.db
      .query("serpFeatureTracking")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .order("desc")
      .first();

    return features;
  },
});

/**
 * Get SERP features summary for a domain
 * Returns aggregated statistics about which features appear most often
 */
export const getSerpFeaturesSummary = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const days = args.days ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    // Get all keywords for this domain
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const keywordIds = keywords.map((k) => k._id);

    // Get all SERP features for these keywords
    const allFeatures = await Promise.all(
      keywordIds.map((keywordId) =>
        ctx.db
          .query("serpFeatureTracking")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
          .filter((q) => q.gte(q.field("date"), cutoffDateStr))
          .collect()
      )
    );

    const flatFeatures = allFeatures.flat();

    // Calculate statistics
    const totalDataPoints = flatFeatures.length;
    if (totalDataPoints === 0) {
      return {
        totalKeywords: keywords.length,
        totalDataPoints: 0,
        featurePercentages: {
          featuredSnippet: 0,
          peopleAlsoAsk: 0,
          imagePack: 0,
          videoPack: 0,
          localPack: 0,
          knowledgeGraph: 0,
          sitelinks: 0,
          topStories: 0,
          relatedSearches: 0,
        },
      };
    }

    const featureCounts = {
      featuredSnippet: 0,
      peopleAlsoAsk: 0,
      imagePack: 0,
      videoPack: 0,
      localPack: 0,
      knowledgeGraph: 0,
      sitelinks: 0,
      topStories: 0,
      relatedSearches: 0,
    };

    flatFeatures.forEach((record) => {
      if (record.features.featuredSnippet) featureCounts.featuredSnippet++;
      if (record.features.peopleAlsoAsk) featureCounts.peopleAlsoAsk++;
      if (record.features.imagePack) featureCounts.imagePack++;
      if (record.features.videoPack) featureCounts.videoPack++;
      if (record.features.localPack) featureCounts.localPack++;
      if (record.features.knowledgeGraph) featureCounts.knowledgeGraph++;
      if (record.features.sitelinks) featureCounts.sitelinks++;
      if (record.features.topStories) featureCounts.topStories++;
      if (record.features.relatedSearches) featureCounts.relatedSearches++;
    });

    const featurePercentages = {
      featuredSnippet: (featureCounts.featuredSnippet / totalDataPoints) * 100,
      peopleAlsoAsk: (featureCounts.peopleAlsoAsk / totalDataPoints) * 100,
      imagePack: (featureCounts.imagePack / totalDataPoints) * 100,
      videoPack: (featureCounts.videoPack / totalDataPoints) * 100,
      localPack: (featureCounts.localPack / totalDataPoints) * 100,
      knowledgeGraph: (featureCounts.knowledgeGraph / totalDataPoints) * 100,
      sitelinks: (featureCounts.sitelinks / totalDataPoints) * 100,
      topStories: (featureCounts.topStories / totalDataPoints) * 100,
      relatedSearches: (featureCounts.relatedSearches / totalDataPoints) * 100,
    };

    return {
      totalKeywords: keywords.length,
      totalDataPoints,
      featurePercentages,
      featureCounts,
    };
  },
});

/**
 * Get SERP features timeline for a keyword
 * Returns when features appeared/disappeared
 */
export const getSerpFeaturesTimeline = query({
  args: {
    keywordId: v.id("keywords"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return [];
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    const days = args.days ?? 90; // Longer period for timeline
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const features = await ctx.db
      .query("serpFeatureTracking")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .filter((q) => q.gte(q.field("date"), cutoffDateStr))
      .collect();

    const sorted = features.sort((a, b) => a.date.localeCompare(b.date));

    // Track changes between consecutive records
    const timeline: Array<{
      date: string;
      feature: string;
      appeared: boolean; // true if appeared, false if disappeared
    }> = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // Check each feature for changes
      const featureKeys = Object.keys(
        curr.features
      ) as (keyof typeof curr.features)[];

      featureKeys.forEach((key) => {
        const prevValue = prev.features[key] || false;
        const currValue = curr.features[key] || false;

        if (prevValue !== currValue) {
          timeline.push({
            date: curr.date,
            feature: key,
            appeared: currValue,
          });
        }
      });
    }

    return timeline;
  },
});
