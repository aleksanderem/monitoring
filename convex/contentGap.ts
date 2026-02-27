import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildLocationParam } from "./dataforseoLocations";
import { createDebugLogger } from "./lib/debugLogger";
import { API_COSTS, extractApiCost } from "./apiUsage";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

// Sanitize a number that may be NaN/undefined/null to a safe default
function safeNum(val: number | null | undefined, fallback: number): number {
  if (val == null || isNaN(val) || !isFinite(val)) return fallback;
  return val;
}

// Calculate opportunity score from gap data (single source of truth)
function calculateOpportunityScore(
  searchVolume: number,
  difficulty: number,
  competitorPosition: number | null
): { opportunityScore: number; priority: "high" | "medium" | "low" } {
  const vol = safeNum(searchVolume, 0);
  const diff = safeNum(difficulty, 50);
  const compPos = competitorPosition != null && !isNaN(competitorPosition) ? competitorPosition : null;
  const volScore = Math.min((vol / 10000) * 50, 50);
  const diffScore = Math.max(50 - diff / 2, 0);
  const posBonus = compPos !== null && compPos > 0 ? (compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0) : 0;
  const opportunityScore = Math.min(Math.round(volScore + diffScore + posBonus), 100);
  const priority: "high" | "medium" | "low" = opportunityScore >= 70 ? "high" : opportunityScore >= 40 ? "medium" : "low";
  return { opportunityScore, priority };
}

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
    const debug = await createDebugLogger(ctx, "content_gap", args.domainId);

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

    const locationParam = buildLocationParam(domain.settings.location);

    // Call Domain Intersection API
    // intersections: false returns keywords where target1 ranks but target2 DOESN'T.
    // For content gap (competitor has, we don't): competitor = target1, our domain = target2.
    const baseRequest = {
      target1: competitor.competitorDomain,
      target2: domain.domain,
      ...locationParam,
      language_code: domain.settings.language,
      intersections: false,
      limit: 1000,
      filters: [
        ["keyword_data.keyword_info.search_volume", ">", 0]
      ],
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
    };

    console.log(`[analyzeContentGap] Request params: location=${domain.settings.location}, language=${domain.settings.language}, locationParam=${JSON.stringify(locationParam)}`);

    // Helper: call the Labs domain_intersection endpoint
    const callIntersection = async (requestBody: object[]) => {
      return debug.logStep("domain_intersection", requestBody, async () => {
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
          throw new Error(`DataForSEO API error: ${response.status}`);
        }
        return await response.json();
      });
    };

    // Check daily cost cap before making API call
    const costCheck = await ctx.runQuery(internal.apiUsage.checkDailyCostCap, {
      estimatedCost: API_COSTS.LABS_DOMAIN_INTERSECTION,
      domainId: args.domainId,
    });
    if (!costCheck.allowed) {
      throw new Error(`Daily API cost limit reached ($${costCheck.todayCost}/$${costCheck.cap})`);
    }

    let data = await callIntersection([baseRequest]);

    // Log domain intersection API usage
    await ctx.runMutation(internal.apiUsage.logApiUsage, {
      endpoint: "/dataforseo_labs/google/domain_intersection/live",
      taskCount: 1,
      estimatedCost: extractApiCost(data, API_COSTS.LABS_DOMAIN_INTERSECTION),
      caller: "analyzeContentGap",
      domainId: args.domainId,
      metadata: JSON.stringify({ competitor: competitor.competitorDomain }),
    });

    if (data.status_code !== 20000) {
      throw new Error(`DataForSEO API error: ${data.status_code}`);
    }

    let taskResult = data.tasks?.[0];

    // Labs API enforces strict location+language pairs. If language_code is
    // invalid for this location (40501), retry without language parameter —
    // the API will auto-detect language from location.
    if (taskResult?.status_code === 40501) {
      console.warn(`[analyzeContentGap] 40501 with language_code="${domain.settings.language}": "${taskResult.status_message}". Retrying without language parameter.`);
      const { language_code: _, ...requestWithoutLang } = baseRequest;
      data = await callIntersection([requestWithoutLang]);
      if (data.status_code !== 20000) {
        throw new Error(`DataForSEO API error: ${data.status_code}`);
      }
      taskResult = data.tasks?.[0];
    }

    if (!taskResult || taskResult.status_code !== 20000) {
      console.error(`[analyzeContentGap] Task failed: ${taskResult?.status_message} (${taskResult?.status_code})`);
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
    let keywordCreateErrors = 0;
    for (let i = 0; i < itemsNeedingKeyword.length; i += CHUNK_SIZE) {
      const chunk = itemsNeedingKeyword.slice(i, i + CHUNK_SIZE);
      try {
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
      } catch (e) {
        keywordCreateErrors += chunk.length;
        console.error(`[analyzeContentGap] Failed to create keyword batch at offset ${i}:`, e);
      }
    }

    // Batch store content gap opportunities (in chunks)
    let stored = 0;
    let storeErrors = 0;
    for (let i = 0; i < itemsWithKeyword.length; i += CHUNK_SIZE) {
      const chunk = itemsWithKeyword.slice(i, i + CHUNK_SIZE);
      try {
        const count = await ctx.runMutation(internal.contentGap.storeContentGapOpportunitiesBatch, {
          domainId: args.domainId,
          competitorId: args.competitorId,
          opportunities: chunk.map(({ item, keywordId }) => ({
            keywordId,
            keyword: item.keyword_data?.keyword || "",
            searchVolume: item.keyword_data?.keyword_info?.search_volume || 0,
            difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || 0,
            competitorPosition: item.first_domain_serp_element?.rank_absolute || item.first_domain_serp_element?.rank_group || 0,
            competitorUrl: item.first_domain_serp_element?.url || "",
            estimatedTrafficValue: Math.round((item.keyword_data?.keyword_info?.search_volume || 0) * 0.3),
          })),
        });
        stored += count;
      } catch (e) {
        storeErrors += chunk.length;
        console.error(`[analyzeContentGap] Failed to store gap batch at offset ${i}:`, e);
      }
    }

    if (keywordCreateErrors > 0 || storeErrors > 0) {
      console.warn(`[analyzeContentGap] Partial failure: ${keywordCreateErrors} keyword creates failed, ${storeErrors} opportunity stores failed`);
    }
    console.log(`[analyzeContentGap] Stored ${stored} content gap opportunities`);
    return { opportunitiesFound: stored, partialFailure: keywordCreateErrors > 0 || storeErrors > 0 };
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
    // Calculate opportunity score and priority (NaN-safe)
    const { opportunityScore, priority } = calculateOpportunityScore(
      args.searchVolume, args.difficulty, args.competitorPosition
    );
    const sanitizedDifficulty = safeNum(args.difficulty, 50);
    const sanitizedEstTraffic = safeNum(args.estimatedTrafficValue, 0);

    // Check if this gap already exists for this keyword
    const existing = await ctx.db
      .query("contentGaps")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .first();

    if (existing) {
      // Update existing (NaN-safe values)
      await ctx.db.patch(existing._id, {
        searchVolume: safeNum(args.searchVolume, 0),
        difficulty: sanitizedDifficulty,
        competitorPosition: args.competitorPosition,
        competitorUrl: args.competitorUrl,
        estimatedTrafficValue: sanitizedEstTraffic,
        opportunityScore,
        priority,
        lastChecked: Date.now(),
      });
    } else {
      // Create new (NaN-safe values)
      await ctx.db.insert("contentGaps", {
        domainId: args.domainId,
        keywordId: args.keywordId,
        competitorId: args.competitorId,
        opportunityScore,
        competitorPosition: args.competitorPosition,
        yourPosition: null,
        searchVolume: safeNum(args.searchVolume, 0),
        difficulty: sanitizedDifficulty,
        competitorUrl: args.competitorUrl,
        estimatedTrafficValue: sanitizedEstTraffic,
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
 *
 * Optimized: uses targeted ctx.db.get() for keyword enrichment
 * instead of loading ALL keywords for the domain.
 */
export const getContentGapOpportunities = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

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

    // Targeted keyword loading: only fetch the keywords we need
    const uniqueKeywordIds = [...new Set(opportunities.map((o) => o.keywordId))];
    const keywordDocs = await Promise.all(
      uniqueKeywordIds.map((id) => ctx.db.get(id))
    );
    const keywordMap = new Map(
      uniqueKeywordIds.map((id, i) => [id, keywordDocs[i]])
    );

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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");
    await requireTenantAccess(ctx, "domain", args.domainId);

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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const gap = await ctx.db.get(args.gapId);
    if (!gap) {
      throw new Error("Content gap not found");
    }
    await requireTenantAccess(ctx, "domain", gap.domainId);

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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const gap = await ctx.db.get(args.gapId);
    if (!gap) throw new Error("Content gap not found");
    await requireTenantAccess(ctx, "domain", gap.domainId);

    await ctx.db.patch(args.gapId, {
      status: "dismissed",
    });
  },
});

export const dismissOpportunities = mutation({
  args: { gapIds: v.array(v.id("contentGaps")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    // Verify tenant access for the first gap (all gaps should belong to same domain)
    if (args.gapIds.length > 0) {
      const firstGap = await ctx.db.get(args.gapIds[0]);
      if (!firstGap) throw new Error("Content gap not found");
      await requireTenantAccess(ctx, "domain", firstGap.domainId);
    }

    for (const gapId of args.gapIds) {
      await ctx.db.patch(gapId, { status: "dismissed" });
    }
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
 *
 * Optimized: loads all keywords for domain ONCE into a Map, then does
 * in-memory dedup instead of per-keyword DB scans (was causing 32k limit).
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
    // Single scan: load all existing keywords for domain into a Map
    const existingKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const phraseMap = new Map(existingKeywords.map((kw) => [kw.phrase, kw._id]));

    const results: (Id<"keywords"> | null)[] = [];
    let insertedCount = 0;
    for (const kw of args.keywords) {
      const existing = phraseMap.get(kw.phrase);
      if (existing) {
        results.push(existing);
      } else {
        const id = await ctx.db.insert("keywords", {
          domainId: args.domainId,
          phrase: kw.phrase,
          status: "paused",
          createdAt: Date.now(),
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
        });
        // Add to map so subsequent items in this batch dedup correctly
        phraseMap.set(kw.phrase, id);
        results.push(id);
        insertedCount++;
      }
    }

    // Increment denormalized keyword count on domain
    if (insertedCount > 0) {
      const domain = await ctx.db.get(args.domainId);
      if (domain) {
        await ctx.db.patch(args.domainId, { keywordCount: (domain.keywordCount ?? 0) + insertedCount });
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
      const { opportunityScore, priority } = calculateOpportunityScore(
        opp.searchVolume, opp.difficulty, opp.competitorPosition
      );
      const sanitizedDifficulty = safeNum(opp.difficulty, 50);
      const sanitizedEstTraffic = safeNum(opp.estimatedTrafficValue, 0);

      const existing = await ctx.db
        .query("contentGaps")
        .withIndex("by_keyword", (q) => q.eq("keywordId", opp.keywordId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          searchVolume: safeNum(opp.searchVolume, 0),
          difficulty: sanitizedDifficulty,
          competitorPosition: opp.competitorPosition,
          competitorUrl: opp.competitorUrl,
          estimatedTrafficValue: sanitizedEstTraffic,
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
          searchVolume: safeNum(opp.searchVolume, 0),
          difficulty: sanitizedDifficulty,
          competitorUrl: opp.competitorUrl,
          estimatedTrafficValue: sanitizedEstTraffic,
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

/**
 * Repair content gaps with NaN scores/difficulty.
 * Recalculates opportunityScore and priority from stored fields.
 */
export const repairContentGapScores = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    let repaired = 0;
    for (const gap of gaps) {
      const scoreNaN = isNaN(gap.opportunityScore);
      const diffNaN = isNaN(gap.difficulty);
      const evNaN = isNaN(gap.estimatedTrafficValue);

      if (!scoreNaN && !diffNaN && !evNaN) continue;

      const { opportunityScore, priority } = calculateOpportunityScore(
        gap.searchVolume, gap.difficulty, gap.competitorPosition
      );

      await ctx.db.patch(gap._id, {
        opportunityScore,
        priority,
        difficulty: safeNum(gap.difficulty, 50),
        estimatedTrafficValue: safeNum(gap.estimatedTrafficValue, 0),
      });
      repaired++;
    }

    return { domainId: args.domainId, total: gaps.length, repaired };
  },
});
