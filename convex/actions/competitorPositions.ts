"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildLocationParam } from "../dataforseoLocations";
import { createDebugLogger } from "../lib/debugLogger";
import { API_COSTS } from "../apiUsage";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

/**
 * Check positions for a competitor across all keywords
 * This is the main entry point - can be called manually or by scheduler
 */
export const checkCompetitorPositions = action({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; checked?: number; errors?: number; total?: number }> => {
    // Get competitor details
    const competitor: any = await ctx.runQuery(internal.queries.competitorsInternal.getCompetitorById, {
      competitorId: args.competitorId,
    });

    if (!competitor) {
      throw new Error("Competitor not found");
    }

    if (competitor.status === "paused") {
      return { success: false, message: "Competitor is paused" };
    }

    // Get domain settings
    const domain: any = await ctx.runQuery(internal.queries.competitorsInternal.getDomainById, {
      domainId: competitor.domainId,
    });

    const settings = domain?.settings || {
      location: "United States",
      language: "en",
      searchEngine: "google.com",
      refreshFrequency: "weekly",
    };

    // Get all keywords for the domain
    const keywords: any = await ctx.runQuery(internal.queries.competitorsInternal.getKeywordsByDomain, {
      domainId: competitor.domainId,
    });

    if (keywords.length === 0) {
      return { success: true, message: "No keywords to check", checked: 0 };
    }

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    // Process keywords in batches
    const batchSize = 10;
    let checked = 0;
    let errors = 0;

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (keyword: any) => {
          try {
            await ctx.runAction(internal.actions.competitorPositions.checkSingleKeyword, {
              competitorId: args.competitorId,
              competitorDomain: competitor.competitorDomain,
              keywordId: keyword._id,
              phrase: keyword.phrase,
              location: settings.location,
              language: settings.language,
              login: login || "",
              password: password || "",
            });
            checked++;
          } catch (error) {
            console.error(`Error checking keyword ${keyword.phrase}:`, error);
            errors++;
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < keywords.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update last checked timestamp
    await ctx.runMutation(internal.mutations.competitors.updateLastChecked, {
      competitorId: args.competitorId,
    });

    return {
      success: true,
      checked,
      errors,
      total: keywords.length,
    };
  },
});

/**
 * Check position for a single keyword (internal)
 */
export const checkSingleKeyword = internalAction({
  args: {
    competitorId: v.id("competitors"),
    competitorDomain: v.string(),
    keywordId: v.id("keywords"),
    phrase: v.string(),
    location: v.string(),
    language: v.string(),
    login: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    // Dev mode - generate mock data
    if (!args.login || !args.password) {
      const position = Math.random() > 0.3 ? Math.floor(Math.random() * 50) + 1 : null;

      await ctx.runMutation(internal.mutations.competitors.storeCompetitorPosition, {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: today,
        position,
        url: position ? `https://${args.competitorDomain}/page-${Math.floor(Math.random() * 10)}` : null,
      });

      return { success: true, position };
    }

    // Production mode - call DataForSEO API
    try {
      const debug = await createDebugLogger(ctx, "competitor_position");
      const authHeader = btoa(`${args.login}:${args.password}`);

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

      // Log SERP API usage for competitor position check
      await ctx.runMutation(internal.apiUsage.logApiUsage, {
        endpoint: "/serp/google/organic/live/advanced",
        taskCount: 1,
        estimatedCost: API_COSTS.SERP_LIVE_ADVANCED,
        caller: "checkSingleKeyword",
        metadata: JSON.stringify({ competitor: args.competitorDomain, keyword: args.phrase }),
      });

      if (data.status_code !== 20000 || !data.tasks?.[0]?.result?.[0]?.items) {
        throw new Error(data.status_message || "No results");
      }

      const items = data.tasks[0].result[0].items;
      const domainMatch = items.find((item: any) =>
        item.type === "organic" && item.url?.includes(args.competitorDomain)
      );

      const position = domainMatch?.rank_absolute || null;

      await ctx.runMutation(internal.mutations.competitors.storeCompetitorPosition, {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: today,
        position,
        url: domainMatch?.url || null,
      });

      return { success: true, position };
    } catch (error) {
      console.error("DataForSEO API error:", error);
      throw error;
    }
  },
});

