"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildLocationParam } from "./dataforseoLocations";
import { createDebugLogger } from "./lib/debugLogger";
import { API_COSTS } from "./apiUsage";

// DataForSEO API configuration
const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

/**
 * Check positions for all keywords for a specific competitor
 * This reuses the same DataForSEO API endpoint as regular keyword position checking
 */
export const checkCompetitorPositions = action({
  args: {
    competitorId: v.id("competitors"),
    batchSize: v.optional(v.number()), // Number of keywords to check at once
    delayMs: v.optional(v.number()), // Delay between batches (to avoid rate limits)
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 10;
    const delayMs = args.delayMs || 1000; // 1 second default delay

    // Get competitor details
    const competitor: any = await ctx.runQuery(internal.competitors_internal.getCompetitorDetails, {
      competitorId: args.competitorId,
    });

    if (!competitor) {
      throw new Error("Competitor not found");
    }

    if (competitor.status !== "active") {
      throw new Error("Competitor is not active");
    }

    // Get all keywords for the domain
    const keywords: any = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, {
      domainId: competitor.domainId,
    });

    if (keywords.length === 0) {
      return { success: true, message: "No keywords to check", processedCount: 0, errors: [] };
    }

    // Get domain settings (for location and language)
    const domain = await ctx.runQuery(internal.competitors_internal.getDomainSettings, {
      domainId: competitor.domainId,
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    console.log(`Checking positions for competitor: ${competitor.name} (${keywords.length} keywords)`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process keywords in batches
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((keyword: any) =>
          ctx.runAction(internal.competitors_actions.checkSingleCompetitorPosition, {
            competitorId: args.competitorId,
            keywordId: keyword._id,
            phrase: keyword.phrase,
            competitorDomain: competitor.competitorDomain,
            location: domain.settings.location,
            language: domain.settings.language,
          })
        )
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value.success) {
          processedCount++;
        } else {
          errorCount++;
          const error = result.status === "rejected" ? result.reason : result.value.error;
          errors.push(error?.toString() || "Unknown error");
        }
      }

      // Delay between batches (except for the last batch)
      if (i + batchSize < keywords.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // Update last checked timestamp
    await ctx.runMutation(internal.competitors_internal.updateLastChecked, {
      competitorId: args.competitorId,
    });

    console.log(`Competitor position check complete: ${processedCount}/${keywords.length} successful, ${errorCount} errors`);

    return {
      success: true,
      message: `Processed ${processedCount} of ${keywords.length} keywords`,
      processedCount,
      errorCount,
      totalKeywords: keywords.length,
      errors: errors.slice(0, 10), // Return first 10 errors
    };
  },
});

/**
 * Internal action to check a single keyword position for a competitor
 * Reuses DataForSEO API logic from dataforseo.ts
 */
export const checkSingleCompetitorPosition = internalAction({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    phrase: v.string(),
    competitorDomain: v.string(),
    location: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; position?: number | null }> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    const today = new Date().toISOString().split("T")[0];

    if (!login || !password) {
      // Mock data for dev mode
      const position = Math.random() > 0.15 ? Math.floor(Math.random() * 50) + 1 : null;

      await ctx.runMutation(internal.competitors_internal.storeCompetitorPositionInternal, {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: today,
        position,
        url: position ? `https://${args.competitorDomain}/page-${Math.floor(Math.random() * 10)}` : null,
      });

      return { success: true, position };
    }

    try {
      // Check daily cost cap before making API call
      const costCheck = await ctx.runQuery(internal.apiUsage.checkDailyCostCap, {
        estimatedCost: API_COSTS.SERP_LIVE_ADVANCED,
      });
      if (!costCheck.allowed) {
        return { success: false, error: `Daily API cost limit reached ($${costCheck.todayCost}/$${costCheck.cap})` };
      }

      const debug = await createDebugLogger(ctx, "competitor_check");
      const authHeader = btoa(`${login}:${password}`);

      const serpRequestBody = [{ keyword: args.phrase, ...buildLocationParam(args.location), language_code: args.language, device: "desktop", os: "windows", depth: 100 }];
      const data = await debug.logStep("serp_live", serpRequestBody[0], async () => {
        const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/live/advanced`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(serpRequestBody),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
      });

      if (data.status_code !== 20000 || !data.tasks?.[0]?.result?.[0]?.items) {
        return { success: false, error: data.status_message || "No results" };
      }

      const items = data.tasks[0].result[0].items;
      const domainMatch = items.find((item: any) =>
        item.type === "organic" && item.url?.includes(args.competitorDomain)
      );

      const position = domainMatch?.rank_absolute || null;

      await ctx.runMutation(internal.competitors_internal.storeCompetitorPositionInternal, {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: today,
        position,
        url: domainMatch?.url || null,
      });

      return { success: true, position };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch position"
      };
    }
  },
});

/**
 * Check all active competitors for a domain
 * This can be called by a cron job
 */
export const checkAllActiveCompetitors = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get all active competitors
    const competitors: any = await ctx.runQuery(internal.competitors_internal.getActiveCompetitors, {
      domainId: args.domainId,
    });

    if (competitors.length === 0) {
      return { success: true, message: "No active competitors", processedCount: 0 };
    }

    console.log(`Checking ${competitors.length} active competitors for domain`);

    let processedCount = 0;
    let errorCount = 0;
    const results: Array<{
      competitorId: Id<"competitors">;
      competitorName: string;
      success: boolean;
      keywordsChecked: number;
      errors: number;
    }> = [];

    // Check each competitor sequentially (to avoid overwhelming the API)
    for (const competitor of competitors) {
      try {
        const result = await ctx.runAction(internal.competitors_actions.checkCompetitorPositionsInternal, {
          competitorId: competitor._id,
          batchSize: 5, // Smaller batch size for cron job
          delayMs: 2000, // Longer delay for cron job
        });

        results.push({
          competitorId: competitor._id,
          competitorName: competitor.name,
          success: result.success,
          keywordsChecked: result.processedCount,
          errors: result.errorCount,
        });

        processedCount++;

        // Delay between competitors
        if (processedCount < competitors.length) {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay between competitors
        }
      } catch (error) {
        errorCount++;
        console.error(`Failed to check competitor ${competitor.name}:`, error);
        results.push({
          competitorId: competitor._id,
          competitorName: competitor.name,
          success: false,
          keywordsChecked: 0,
          errors: 1,
        });
      }
    }

    return {
      success: true,
      message: `Checked ${processedCount} of ${competitors.length} competitors`,
      processedCount,
      errorCount,
      results,
    };
  },
});

/**
 * Internal version of checkCompetitorPositions for cron jobs
 */
export const checkCompetitorPositionsInternal = internalAction({
  args: {
    competitorId: v.id("competitors"),
    batchSize: v.optional(v.number()),
    delayMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; processedCount: number; errorCount: number; error?: string; message?: string; totalKeywords?: number }> => {
    // This is the same as checkCompetitorPositions, but marked internal for cron usage
    const batchSize = args.batchSize || 10;
    const delayMs = args.delayMs || 1000;

    const competitor: any = await ctx.runQuery(internal.competitors_internal.getCompetitorDetails, {
      competitorId: args.competitorId,
    });

    if (!competitor) {
      return { success: false, error: "Competitor not found", processedCount: 0, errorCount: 1 };
    }

    if (competitor.status !== "active") {
      return { success: false, error: "Competitor is not active", processedCount: 0, errorCount: 1 };
    }

    const keywords: any = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, {
      domainId: competitor.domainId,
    });

    if (keywords.length === 0) {
      return { success: true, message: "No keywords to check", processedCount: 0, errorCount: 0 };
    }

    const domain = await ctx.runQuery(internal.competitors_internal.getDomainSettings, {
      domainId: competitor.domainId,
    });

    if (!domain) {
      return { success: false, error: "Domain not found", processedCount: 0, errorCount: 1 };
    }

    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map((keyword: any) =>
          ctx.runAction(internal.competitors_actions.checkSingleCompetitorPosition, {
            competitorId: args.competitorId,
            keywordId: keyword._id,
            phrase: keyword.phrase,
            competitorDomain: competitor.competitorDomain,
            location: domain.settings.location,
            language: domain.settings.language,
          })
        )
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value.success) {
          processedCount++;
        } else {
          errorCount++;
        }
      }

      if (i + batchSize < keywords.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    await ctx.runMutation(internal.competitors_internal.updateLastChecked, {
      competitorId: args.competitorId,
    });

    return {
      success: true,
      processedCount,
      errorCount,
      totalKeywords: keywords.length,
    };
  },
});

/**
 * Suggest competitor domains from DataForSEO competitors_domain endpoint.
 * Returns domains that compete for the same keywords in organic search.
 */
export const suggestCompetitors = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; competitors: Array<{ domain: string; intersections: number; avgPosition: number | null; etv: number }> }> => {
    const domain: any = await ctx.runQuery(internal.competitors_internal.getDomainSettings, {
      domainId: args.domainId,
    });

    if (!domain) {
      return { success: false, error: "Domain not found", competitors: [] };
    }

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      // Mock data for dev mode
      const mockCompetitors = [
        { domain: "competitor-one.com", intersections: 142, avgPosition: 8.3, etv: 12500 },
        { domain: "competitor-two.com", intersections: 98, avgPosition: 12.1, etv: 8700 },
        { domain: "rival-site.org", intersections: 76, avgPosition: 15.4, etv: 5200 },
        { domain: "industry-leader.com", intersections: 63, avgPosition: 5.7, etv: 22000 },
        { domain: "niche-blog.net", intersections: 51, avgPosition: 18.9, etv: 3100 },
        { domain: "seo-competitor.com", intersections: 44, avgPosition: 11.2, etv: 6800 },
        { domain: "market-player.io", intersections: 38, avgPosition: 9.5, etv: 9400 },
        { domain: "content-hub.com", intersections: 29, avgPosition: 14.6, etv: 4300 },
      ];
      return { success: true, competitors: mockCompetitors };
    }

    try {
      // Check daily cost cap before making API call
      const costCheck = await ctx.runQuery(internal.apiUsage.checkDailyCostCap, {
        estimatedCost: API_COSTS.LABS_COMPETITORS_DOMAIN,
        domainId: args.domainId,
      });
      if (!costCheck.allowed) {
        return { success: false, error: `Daily API cost limit reached ($${costCheck.todayCost}/$${costCheck.cap})`, competitors: [] };
      }

      const authHeader = btoa(`${login}:${password}`);

      // Get already tracked competitors to exclude
      const existingCompetitors: any[] = await ctx.runQuery(
        internal.competitors_internal.getCompetitorsByDomain,
        { domainId: args.domainId }
      );
      const excludeDomains = [
        domain.domain,
        ...existingCompetitors.map((c: any) => c.competitorDomain),
      ];

      const debug = await createDebugLogger(ctx, "competitor_discovery", args.domainId);
      const requestBody = [{
        target: domain.domain,
        ...buildLocationParam(domain.settings.location),
        language_code: domain.settings.language,
        item_types: ["organic"],
        limit: 50,
        exclude_top_domains: true,
        exclude_domains: excludeDomains,
        order_by: ["metrics.organic.count,desc"],
      }];
      const data = await debug.logStep("competitors_domain", requestBody[0], async () => {
        const response = await fetch(`${DATAFORSEO_API_URL}/dataforseo_labs/google/competitors_domain/live`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
      });

      // Log competitors domain API usage
      await ctx.runMutation(internal.apiUsage.logApiUsage, {
        endpoint: "/dataforseo_labs/google/competitors_domain/live",
        taskCount: 1,
        estimatedCost: API_COSTS.LABS_COMPETITORS_DOMAIN,
        caller: "discoverCompetitors",
        domainId: args.domainId,
      });

      if (data.status_code !== 20000) {
        return { success: false, error: data.status_message || "Unknown API error", competitors: [] };
      }

      const items = data.tasks?.[0]?.result?.[0]?.items || [];

      const competitors = items.slice(0, 30).map((item: any) => ({
        domain: item.domain,
        intersections: item.metrics?.organic?.count ?? item.intersections ?? 0,
        avgPosition: item.avg_position ? Math.round(item.avg_position * 10) / 10 : null,
        etv: item.metrics?.organic?.etv ? Math.round(item.metrics.organic.etv) : 0,
      }));

      return { success: true, competitors };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch competitor suggestions",
        competitors: [],
      };
    }
  },
});
