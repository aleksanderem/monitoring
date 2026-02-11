import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query, mutation } from "./_generated/server";
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

    // Batch: fetch all existing keywords for domain upfront (1 query instead of N)
    const existingKeywords: { _id: Id<"keywords">; phrase: string }[] = await ctx.runQuery(
      internal.contentGap.getAllKeywordsForDomain, { domainId: args.domainId }
    );
    const keywordByPhrase = new Map(existingKeywords.map((kw) => [kw.phrase, kw]));

    // Separate items into: has existing keyword vs needs new keyword
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsNeedingKeyword: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsWithKeyword: { item: any; keywordId: Id<"keywords"> }[] = [];

    for (const item of result.items) {
      const phrase = (item.keyword_data?.keyword || "").toLowerCase().trim();
      if (!phrase) continue;
      const existing = keywordByPhrase.get(phrase);
      if (existing) {
        itemsWithKeyword.push({ item, keywordId: existing._id });
      } else {
        itemsNeedingKeyword.push(item);
      }
    }

    // Batch create missing keywords (in chunks of 100 to stay within Convex limits)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < itemsNeedingKeyword.length; i += CHUNK_SIZE) {
      const chunk = itemsNeedingKeyword.slice(i, i + CHUNK_SIZE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created: (Id<"keywords"> | null)[] = await ctx.runMutation(internal.contentGap.createKeywordsBatch, {
        domainId: args.domainId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keywords: chunk.map((item: any) => ({
          phrase: (item.keyword_data?.keyword || "").toLowerCase().trim(),
          searchVolume: item.keyword_data?.keyword_info?.search_volume || undefined,
          difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || undefined,
        })),
      });

      // Map created keywords back to items
      for (let j = 0; j < created.length; j++) {
        if (created[j]) {
          itemsWithKeyword.push({
            item: chunk[j],
            keywordId: created[j] as Id<"keywords">,
          });
        }
      }
    }

    // Batch store content gap opportunities (in chunks)
    let stored = 0;
    for (let i = 0; i < itemsWithKeyword.length; i += CHUNK_SIZE) {
      const chunk = itemsWithKeyword.slice(i, i + CHUNK_SIZE);
      const count = await ctx.runMutation(internal.contentGap.storeContentGapOpportunitiesBatch, {
        domainId: args.domainId,
        competitorId: args.competitorId,
        opportunities: chunk.map(({ item, keywordId }) => ({
          keywordId,
          keyword: item.keyword_data?.keyword || "",
          searchVolume: item.keyword_data?.keyword_info?.search_volume || 0,
          difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || 0,
          competitorPosition: item.target2_serp_info?.rank_absolute || item.target2_serp_info?.rank_group || 0,
          competitorUrl: item.target2_serp_info?.page_address || "",
          estimatedTrafficValue: Math.round((item.keyword_data?.keyword_info?.search_volume || 0) * 0.3),
        })),
      });
      stored += count;
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

    // Batch fetch all keywords for this domain (single query instead of N queries)
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const keywordMap = new Map(allKeywords.map((kw) => [kw._id, kw]));

    // Resolve keywords and sanitize NaN values
    const resolved = opportunities.map((opp) => {
      const kw = keywordMap.get(opp.keywordId);
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
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// Batch helpers (used by analyzeContentGap to avoid N+1 patterns)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all keywords for a domain (batch fetch for content gap analysis)
 */
export const getAllKeywordsForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    return keywords.map((kw) => ({ _id: kw._id, phrase: kw.phrase }));
  },
});

/**
 * Batch create keywords that don't exist yet
 */
export const createKeywordsBatch = internalMutation({
  args: {
    domainId: v.id("domains"),
    keywords: v.array(v.object({
      phrase: v.string(),
      searchVolume: v.optional(v.number()),
      difficulty: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const results: (Id<"keywords"> | null)[] = [];
    for (const kw of args.keywords) {
      // Double-check it doesn't exist (race condition safety)
      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), kw.phrase))
        .first();
      if (existing) {
        results.push(existing._id);
      } else {
        const id = await ctx.db.insert("keywords", {
          domainId: args.domainId,
          phrase: kw.phrase,
          status: "paused",
          createdAt: Date.now(),
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
        });
        results.push(id);
      }
    }
    return results;
  },
});

/**
 * Batch store content gap opportunities
 */
export const storeContentGapOpportunitiesBatch = internalMutation({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
    opportunities: v.array(v.object({
      keywordId: v.id("keywords"),
      keyword: v.string(),
      searchVolume: v.number(),
      difficulty: v.number(),
      competitorPosition: v.number(),
      competitorUrl: v.string(),
      estimatedTrafficValue: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    let stored = 0;
    for (const opp of args.opportunities) {
      const vol = opp.searchVolume ?? 0;
      const diff = opp.difficulty ?? 50;
      const compPos = opp.competitorPosition ?? null;
      const searchVolumeScore = Math.min((vol / 10000) * 50, 50);
      const difficultyScore = Math.max(50 - diff / 2, 0);
      const positionBonus = compPos !== null && compPos > 0 ? (compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0) : 0;
      const opportunityScore = Math.min(Math.round(searchVolumeScore + difficultyScore + positionBonus), 100);

      let priority: "high" | "medium" | "low" = "low";
      if (opportunityScore >= 70) priority = "high";
      else if (opportunityScore >= 40) priority = "medium";

      const existing = await ctx.db
        .query("contentGaps")
        .withIndex("by_keyword", (q) => q.eq("keywordId", opp.keywordId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          searchVolume: opp.searchVolume,
          difficulty: opp.difficulty,
          competitorPosition: opp.competitorPosition,
          competitorUrl: opp.competitorUrl,
          estimatedTrafficValue: opp.estimatedTrafficValue,
          opportunityScore,
          priority,
          lastChecked: Date.now(),
        });
      } else {
        await ctx.db.insert("contentGaps", {
          domainId: args.domainId,
          keywordId: opp.keywordId,
          competitorId: args.competitorId,
          opportunityScore,
          competitorPosition: opp.competitorPosition,
          yourPosition: null,
          searchVolume: opp.searchVolume,
          difficulty: opp.difficulty,
          competitorUrl: opp.competitorUrl,
          estimatedTrafficValue: opp.estimatedTrafficValue,
          priority,
          status: "identified",
          identifiedAt: Date.now(),
          lastChecked: Date.now(),
        });
      }
      stored++;
    }
    return stored;
  },
});
