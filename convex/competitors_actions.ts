"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildLocationParam } from "./dataforseoLocations";
import { createDebugLogger } from "./lib/debugLogger";
import { API_COSTS, extractApiCost } from "./apiUsage";

// DataForSEO API configuration
const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

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
        estimatedCost: extractApiCost(data, API_COSTS.LABS_COMPETITORS_DOMAIN),
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
