import { v } from "convex/values";
import { internalAction, internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Analyze content gap between your domain and a competitor
 * Finds keywords where competitor ranks but you don't
 */
export const analyzeContentGap = internalAction({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    console.log(`[analyzeContentGap] Starting analysis for competitor ${args.competitorId}`);

    // Get own domain
    const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
      domainId: args.domainId,
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    // Get competitor
    const competitor = await ctx.runQuery(internal.competitors.getCompetitorInternal, {
      competitorId: args.competitorId,
    });

    if (!competitor) {
      throw new Error("Competitor not found");
    }

    // Get API credentials
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      throw new Error("DataForSEO credentials not configured");
    }

    const auth = btoa(`${login}:${password}`);

    // Map location names to DataForSEO location codes
    const locationCodeMap: Record<string, number> = {
      "Poland": 2616,
      "United States": 2840,
      "United Kingdom": 2826,
      "Germany": 2276,
      "France": 2250,
      "Spain": 2724,
      "Italy": 2380,
      "Netherlands": 2528,
    };

    const locationCode = locationCodeMap[domain.settings.location] || 2616; // Default to Poland

    // Call Domain Intersection API
    // intersections: false means "keywords where target2 ranks but target1 doesn't"
    const requestBody = [{
      target1: domain.domain,
      target2: competitor.competitorDomain,
      location_code: locationCode,
      language_code: domain.settings.language,
      intersections: false, // Content gap: competitor has, we don't
      limit: 1000,
      filters: [
        "keyword_data.keyword_info.search_volume", ">", 0
      ],
      order_by: ["keyword_data.keyword_info.search_volume,desc"], // Order by search volume
    }];

    console.log(`[analyzeContentGap] Calling Domain Intersection API for ${domain.domain} vs ${competitor.competitorDomain}`);

    const response = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      console.error(`[analyzeContentGap] API error: ${response.status}`);
      throw new Error(`DataForSEO API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status_code !== 20000) {
      console.error(`[analyzeContentGap] API returned error: ${data.status_code}`);
      throw new Error(`DataForSEO API error: ${data.status_code}`);
    }

    const taskResult = data.tasks?.[0];

    if (!taskResult || taskResult.status_code !== 20000) {
      console.error(`[analyzeContentGap] Task failed with status: ${taskResult?.status_code}`);
      console.error(`[analyzeContentGap] Task error message: ${taskResult?.status_message}`);
      console.error(`[analyzeContentGap] Full task result:`, JSON.stringify(taskResult, null, 2));
      throw new Error(`Domain Intersection task failed: ${taskResult?.status_message || 'Unknown error'} (code: ${taskResult?.status_code})`);
    }

    const result = taskResult.result?.[0];
    if (!result || !result.items) {
      console.log(`[analyzeContentGap] No content gap found`);
      return { opportunitiesFound: 0 };
    }

    // Store content gap opportunities
    let stored = 0;
    for (const item of result.items) {
      try {
        const keywordPhrase = item.keyword_data?.keyword || "";

        // Find or create keyword in keywords table
        let keyword = await ctx.runQuery(internal.keywords.getKeywordByPhraseInternal, {
          domainId: args.domainId,
          phrase: keywordPhrase,
        });

        // If keyword doesn't exist, create it as discovered
        if (!keyword) {
          const keywordId = await ctx.runMutation(internal.keywords.createKeywordInternal, {
            domainId: args.domainId,
            phrase: keywordPhrase,
            status: "paused", // Don't actively monitor, just track as opportunity
            searchVolume: item.keyword_data?.keyword_info?.search_volume || undefined,
            difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || undefined,
          });
          keyword = await ctx.runQuery(internal.keywords.getKeywordInternal, {
            keywordId,
          });
        }

        if (!keyword) {
          console.error(`[analyzeContentGap] Failed to create keyword: ${keywordPhrase}`);
          continue;
        }

        await ctx.runMutation(internal.contentGap.storeContentGapOpportunity, {
          domainId: args.domainId,
          competitorId: args.competitorId,
          keywordId: keyword._id,
          keyword: keywordPhrase,
          searchVolume: item.keyword_data?.keyword_info?.search_volume || 0,
          difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || 0,
          competitorPosition: item.target2_serp_info?.rank_absolute || item.target2_serp_info?.rank_group || 0,
          competitorUrl: item.target2_serp_info?.page_address || "",
          estimatedTrafficValue: Math.round((item.keyword_data?.keyword_info?.search_volume || 0) * 0.3), // Estimate 30% CTR for top 3
        });
        stored++;
      } catch (error) {
        console.error(`[analyzeContentGap] Error storing opportunity for "${item.keyword_data?.keyword}":`, error);
      }
    }

    console.log(`[analyzeContentGap] Stored ${stored} content gap opportunities`);
    return { opportunitiesFound: stored };
  },
});

/**
 * Internal mutation to store a content gap opportunity
 */
export const storeContentGapOpportunity = internalMutation({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    keyword: v.string(),
    searchVolume: v.number(),
    difficulty: v.number(),
    competitorPosition: v.number(),
    competitorUrl: v.string(),
    estimatedTrafficValue: v.number(),
  },
  handler: async (ctx, args) => {
    // Calculate opportunity score (0-100)
    // Higher score = better opportunity
    // Factors: high search volume, low difficulty, high traffic value, competitor in top 3
    const vol = args.searchVolume ?? 0;
    const diff = args.difficulty ?? 50;
    const compPos = args.competitorPosition ?? null;
    const searchVolumeScore = Math.min((vol / 10000) * 50, 50); // 0-50 points
    const difficultyScore = Math.max(50 - diff / 2, 0); // 0-50 points (lower difficulty = higher score)
    const positionBonus = compPos !== null && compPos > 0 ? (compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0) : 0;
    const opportunityScore = Math.min(Math.round(searchVolumeScore + difficultyScore + positionBonus), 100);

    // Determine priority
    let priority: "high" | "medium" | "low" = "low";
    if (opportunityScore >= 70) priority = "high";
    else if (opportunityScore >= 40) priority = "medium";

    // Check if this gap already exists for this keyword
    const existing = await ctx.db
      .query("contentGaps")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        competitorPosition: args.competitorPosition,
        competitorUrl: args.competitorUrl,
        estimatedTrafficValue: args.estimatedTrafficValue,
        opportunityScore,
        priority,
        lastChecked: Date.now(),
      });
    } else {
      // Create new
      await ctx.db.insert("contentGaps", {
        domainId: args.domainId,
        keywordId: args.keywordId,
        competitorId: args.competitorId,
        opportunityScore,
        competitorPosition: args.competitorPosition,
        yourPosition: null,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        competitorUrl: args.competitorUrl,
        estimatedTrafficValue: args.estimatedTrafficValue,
        priority,
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    }
  },
});

/**
 * Get content gap opportunities for a domain
 */
export const getContentGapOpportunities = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let opportunities = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "identified"))
      .take(limit);

    // Filter by priority if specified
    if (args.priority) {
      opportunities = opportunities.filter(opp => opp.priority === args.priority);
    }

    // Resolve keywords and sanitize NaN values
    const resolved = await Promise.all(
      opportunities.map(async (opp) => {
        const kw = await ctx.db.get(opp.keywordId);
        // Sanitize NaN score and recalculate priority
        let score = opp.opportunityScore;
        let priority = opp.priority;
        let difficulty = opp.difficulty;
        if (isNaN(score) || score === null || score === undefined) {
          const vol = opp.searchVolume ?? 0;
          const diff = isNaN(difficulty) ? 50 : (difficulty ?? 50);
          const compPos = opp.competitorPosition ?? null;
          const volScore = Math.min((vol / 10000) * 50, 50);
          const diffScore = Math.max(50 - diff / 2, 0);
          const posBonus = compPos !== null && compPos > 0 ? (compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0) : 0;
          score = Math.min(Math.round(volScore + diffScore + posBonus), 100);
        }
        if (isNaN(difficulty)) {
          difficulty = 0;
        }
        if (score >= 70) priority = "high";
        else if (score >= 40) priority = "medium";
        else priority = "low";
        return {
          ...opp,
          keyword: kw?.phrase ?? "Unknown keyword",
          opportunityScore: score,
          difficulty,
          priority,
        };
      })
    );

    // Sort by opportunity score (higher = better)
    return resolved.sort((a, b) => b.opportunityScore - a.opportunityScore);
  },
});

/**
 * Trigger content gap analysis for a competitor
 */
export const triggerContentGapAnalysis = mutation({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    // Schedule the analysis
    await ctx.scheduler.runAfter(0, internal.contentGap.analyzeContentGap, {
      domainId: args.domainId,
      competitorId: args.competitorId,
    });

    return { success: true };
  },
});

/**
 * Mark a content gap opportunity as monitoring (user started tracking it)
 */
export const markOpportunityAsMonitoring = mutation({
  args: {
    gapId: v.id("contentGaps"),
  },
  handler: async (ctx, args) => {
    const gap = await ctx.db.get(args.gapId);
    if (!gap) {
      throw new Error("Content gap not found");
    }

    // Update status to monitoring
    await ctx.db.patch(args.gapId, {
      status: "monitoring",
    });

    // Activate the keyword for monitoring
    await ctx.db.patch(gap.keywordId, {
      status: "active",
    });
  },
});

/**
 * Dismiss a content gap opportunity
 */
export const dismissOpportunity = mutation({
  args: {
    gapId: v.id("contentGaps"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gapId, {
      status: "dismissed",
    });
  },
});
