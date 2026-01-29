import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// SE Ranking Data API configuration
const SERANKING_API_URL = "https://api.seranking.com/v1";

// Map DataForSEO location names to SE Ranking country codes
const locationToSourceMap: Record<string, string> = {
  "Poland": "pl",
  "United States": "us",
  "United Kingdom": "uk",
  "Germany": "de",
  "France": "fr",
  "Spain": "es",
  "Italy": "it",
  "Netherlands": "nl",
  "Belgium": "be",
  "Austria": "at",
  "Switzerland": "ch",
  "Czech Republic": "cz",
  "Slovakia": "sk",
  "Ukraine": "ua",
  "Russia": "ru",
  "Canada": "ca",
  "Australia": "au",
  "Brazil": "br",
  "Mexico": "mx",
  "India": "in",
  "Japan": "jp",
  "South Korea": "kr",
  "China": "cn",
};

function getSourceCode(location: string): string {
  // First check exact match
  if (locationToSourceMap[location]) {
    return locationToSourceMap[location];
  }
  // Check if it's already a 2-letter code
  if (location.length === 2) {
    return location.toLowerCase();
  }
  // Default to 'us'
  return "us";
}

interface SERankingKeyword {
  keyword: string;
  position: number;
  prev_pos: number | null;
  volume: number;
  cpc: number;
  traffic: number;
  url: string;
  difficulty?: number;
}

interface SERankingHistoryItem {
  year: number;
  month: number;
  keywords_count: number;
  traffic_sum: number;
  price_sum: number;
  top1_5?: number;
  top6_10?: number;
  top11_20?: number;
  top21_50?: number;
  top51_100?: number;
}

// Fetch domain visibility history from SE Ranking Data API
// Returns monthly snapshots with position distribution and traffic
export const fetchVisibilityHistory = action({
  args: {
    domainId: v.id("domains"),
    domain: v.string(),
    location: v.string(), // Location name like "Poland" or country code "pl"
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    datesStored?: number;
    data?: SERankingHistoryItem[];
  }> => {
    const apiKey = process.env.SERANKING_API_KEY;

    const source = getSourceCode(args.location);
    console.log(`=== SE Ranking fetchVisibilityHistory: ${args.domain} (source: ${source}) ===`);

    if (!apiKey) {
      console.log("SE Ranking API key not configured");
      return { success: false, error: "SE Ranking API key not configured" };
    }

    try {
      // SE Ranking Data API: /domain/overview/history
      const url = new URL(`${SERANKING_API_URL}/domain/overview/history`);
      url.searchParams.set("source", source);
      url.searchParams.set("domain", args.domain);
      url.searchParams.set("type", "organic");

      console.log(`Calling SE Ranking API: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      console.log("SE Ranking API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SE Ranking API error:", response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();
      console.log("SE Ranking API response:", JSON.stringify(data).substring(0, 500));

      // SE Ranking returns array of monthly history items
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, error: "No historical data returned" };
      }

      // Convert SE Ranking format to our visibility history format
      // SE Ranking provides: top1_5, top6_10, top11_20, top21_50, top51_100
      // Our chart needs: top3 (1-3), pos4_10 (4-10), pos11_50 (11-50), pos51_100 (51-100)
      const historyItems = data.map((item: SERankingHistoryItem) => {
        const top1_5 = item.top1_5 || 0;
        const top6_10 = item.top6_10 || 0;
        const top11_20 = item.top11_20 || 0;
        const top21_50 = item.top21_50 || 0;
        const top51_100 = item.top51_100 || 0;

        // Approximate distribution:
        // pos_1 ≈ top1_5 * 0.2 (1 out of 5)
        // pos_2_3 ≈ top1_5 * 0.4 (2 out of 5)
        // pos_4_10 ≈ top1_5 * 0.4 + top6_10 (2 out of 5 from top1_5 + all of top6_10)
        const pos_1 = Math.round(top1_5 * 0.2);
        const pos_2_3 = Math.round(top1_5 * 0.4);
        const pos_4_10 = Math.round(top1_5 * 0.4) + top6_10;

        return {
          date: `${item.year}-${String(item.month).padStart(2, "0")}-01`,
          metrics: {
            pos_1,
            pos_2_3,
            pos_4_10,
            pos_11_20: top11_20,
            pos_21_30: Math.round(top21_50 / 3),
            pos_31_40: Math.round(top21_50 / 3),
            pos_41_50: top21_50 - Math.round(top21_50 / 3) * 2,
            pos_51_60: Math.round(top51_100 / 5),
            pos_61_70: Math.round(top51_100 / 5),
            pos_71_80: Math.round(top51_100 / 5),
            pos_81_90: Math.round(top51_100 / 5),
            pos_91_100: top51_100 - Math.round(top51_100 / 5) * 4,
            etv: item.traffic_sum || 0,
            count: item.keywords_count || 0,
          },
        };
      });

      console.log(`Storing ${historyItems.length} visibility history entries from SE Ranking`);

      // Store using existing mutation
      await ctx.runMutation(internal.dataforseo.storeVisibilityHistory, {
        domainId: args.domainId,
        history: historyItems,
      });

      return {
        success: true,
        datesStored: historyItems.length,
        data: data,
      };
    } catch (error) {
      console.error("SE Ranking API error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Fetch current keyword rankings from SE Ranking Data API
// Returns keywords the domain ranks for with current and previous positions
export const fetchDomainKeywords = action({
  args: {
    domainId: v.id("domains"),
    domain: v.string(),
    location: v.string(), // Location name like "Poland" or country code "pl"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    keywords?: SERankingKeyword[];
    totalFound?: number;
  }> => {
    const apiKey = process.env.SERANKING_API_KEY;
    const limit = args.limit || 100;
    const source = getSourceCode(args.location);

    console.log(`=== SE Ranking fetchDomainKeywords: ${args.domain} (source: ${source}) ===`);

    if (!apiKey) {
      return { success: false, error: "SE Ranking API key not configured" };
    }

    try {
      const url = new URL(`${SERANKING_API_URL}/domain/keywords`);
      url.searchParams.set("source", source);
      url.searchParams.set("domain", args.domain);
      url.searchParams.set("type", "organic");
      url.searchParams.set("limit", limit.toString());
      url.searchParams.set("order_field", "traffic");
      url.searchParams.set("order_type", "desc");

      console.log(`Calling SE Ranking API: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SE Ranking API error:", response.status, errorText);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      // SE Ranking returns { keywords: [...], total: N }
      const keywords: SERankingKeyword[] = (data.keywords || data || []).map((item: any) => ({
        keyword: item.keyword,
        position: item.position,
        prev_pos: item.prev_pos,
        volume: item.volume || 0,
        cpc: item.cpc || 0,
        traffic: item.traffic || 0,
        url: item.url || `https://${args.domain}`,
        difficulty: item.difficulty,
      }));

      console.log(`Found ${keywords.length} keywords from SE Ranking`);

      // Store as discovered keywords with all SE Ranking data
      const today = new Date().toISOString().split("T")[0];
      await ctx.runMutation(internal.dataforseo.storeDiscoveredKeywords, {
        domainId: args.domainId,
        keywords: keywords.map(kw => ({
          keyword: kw.keyword,
          position: kw.position,
          previousPosition: kw.prev_pos || undefined,
          url: kw.url,
          searchVolume: kw.volume,
          cpc: kw.cpc,
          difficulty: kw.difficulty,
          traffic: kw.traffic,
          date: today,
        })),
      });

      return {
        success: true,
        keywords,
        totalFound: data.total || keywords.length,
      };
    } catch (error) {
      console.error("SE Ranking API error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// =================================================================
// Backlinks API
// =================================================================

interface BacklinksSummaryResponse {
  backlinks?: number;
  domains?: number;
  ips?: number;
  subnets?: number;
  dofollow?: number;
  nofollow?: number;
  new_backlinks?: number;
  lost_backlinks?: number;
  inlink_rank?: number;
}

interface BacklinkItem {
  url_from: string;
  url_to: string;
  anchor: string;
  nofollow: boolean;
  inlink_rank?: number;
  domain_inlink_rank?: number;
  first_seen?: string;
  last_visited?: string;
}

// Fetch backlinks summary from SE Ranking
export const fetchBacklinksSummary = action({
  args: {
    domainId: v.id("domains"),
    domain: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    summary?: BacklinksSummaryResponse;
  }> => {
    const apiKey = process.env.SERANKING_API_KEY;

    console.log(`=== SE Ranking fetchBacklinksSummary: ${args.domain} ===`);

    if (!apiKey) {
      return { success: false, error: "SE Ranking API key not configured" };
    }

    try {
      // SE Ranking Backlinks API: /backlinks/summary
      const url = new URL(`${SERANKING_API_URL}/backlinks/summary`);
      url.searchParams.set("target", args.domain);
      url.searchParams.set("mode", "domain");

      console.log(`Calling SE Ranking Backlinks API: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      console.log("SE Ranking API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SE Ranking API error:", response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data: BacklinksSummaryResponse = await response.json();
      console.log("SE Ranking Backlinks summary:", JSON.stringify(data).substring(0, 500));

      // Store the summary
      await ctx.runMutation(internal.seranking.storeBacklinksSummary, {
        domainId: args.domainId,
        summary: {
          totalBacklinks: data.backlinks || 0,
          totalDomains: data.domains || 0,
          totalIps: data.ips || 0,
          totalSubnets: data.subnets || 0,
          dofollow: data.dofollow || 0,
          nofollow: data.nofollow || 0,
          newBacklinks: data.new_backlinks,
          lostBacklinks: data.lost_backlinks,
          avgInlinkRank: data.inlink_rank,
        },
      });

      return {
        success: true,
        summary: data,
      };
    } catch (error) {
      console.error("SE Ranking Backlinks API error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Fetch individual backlinks from SE Ranking
export const fetchBacklinks = action({
  args: {
    domainId: v.id("domains"),
    domain: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    backlinks?: BacklinkItem[];
    total?: number;
  }> => {
    const apiKey = process.env.SERANKING_API_KEY;
    const limit = args.limit || 100;

    console.log(`=== SE Ranking fetchBacklinks: ${args.domain} (limit: ${limit}) ===`);

    if (!apiKey) {
      return { success: false, error: "SE Ranking API key not configured" };
    }

    try {
      // SE Ranking Backlinks API: /backlinks/all
      const url = new URL(`${SERANKING_API_URL}/backlinks/all`);
      url.searchParams.set("target", args.domain);
      url.searchParams.set("mode", "domain");
      url.searchParams.set("limit", limit.toString());
      url.searchParams.set("order_field", "inlink_rank");
      url.searchParams.set("order_type", "desc");

      console.log(`Calling SE Ranking Backlinks API: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      console.log("SE Ranking API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SE Ranking API error:", response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();
      console.log("SE Ranking Backlinks response:", JSON.stringify(data).substring(0, 500));

      // SE Ranking returns { backlinks: [...], total: N }
      const backlinks: BacklinkItem[] = (data.backlinks || data || []).map((item: any) => ({
        url_from: item.url_from || "",
        url_to: item.url_to || "",
        anchor: item.anchor || "",
        nofollow: !!item.nofollow,
        inlink_rank: item.inlink_rank,
        domain_inlink_rank: item.domain_inlink_rank,
        first_seen: item.first_seen,
        last_visited: item.last_visited,
      }));

      console.log(`Found ${backlinks.length} backlinks from SE Ranking`);

      // Calculate summary statistics from actual backlinks
      const uniqueDomains = new Set(backlinks.map(bl => {
        try {
          return new URL(bl.url_from).hostname;
        } catch {
          return bl.url_from;
        }
      })).size;

      const dofollowCount = backlinks.filter(bl => !bl.nofollow).length;
      const nofollowCount = backlinks.filter(bl => bl.nofollow).length;

      const inlinkRanks = backlinks.map(bl => bl.inlink_rank).filter(rank => rank !== undefined && rank !== null) as number[];
      const avgInlinkRank = inlinkRanks.length > 0
        ? inlinkRanks.reduce((sum, rank) => sum + rank, 0) / inlinkRanks.length
        : undefined;

      // Store the backlinks
      await ctx.runMutation(internal.seranking.storeBacklinks, {
        domainId: args.domainId,
        backlinks: backlinks.map(bl => ({
          urlFrom: bl.url_from,
          urlTo: bl.url_to,
          anchor: bl.anchor,
          nofollow: bl.nofollow,
          inlinkRank: bl.inlink_rank,
          domainInlinkRank: bl.domain_inlink_rank,
          firstSeen: bl.first_seen,
          lastVisited: bl.last_visited,
        })),
      });

      // Store calculated summary
      await ctx.runMutation(internal.seranking.storeBacklinksSummary, {
        domainId: args.domainId,
        summary: {
          totalBacklinks: backlinks.length,
          totalDomains: uniqueDomains,
          totalIps: 0, // We don't have IP data in backlinks response
          totalSubnets: 0,
          dofollow: dofollowCount,
          nofollow: nofollowCount,
          newBacklinks: undefined,
          lostBacklinks: undefined,
          avgInlinkRank: avgInlinkRank,
        },
      });

      return {
        success: true,
        backlinks,
        total: data.total || backlinks.length,
      };
    } catch (error) {
      console.error("SE Ranking Backlinks API error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Internal mutation to store backlinks summary
export const storeBacklinksSummary = internalMutation({
  args: {
    domainId: v.id("domains"),
    summary: v.object({
      totalBacklinks: v.number(),
      totalDomains: v.number(),
      totalIps: v.number(),
      totalSubnets: v.number(),
      dofollow: v.number(),
      nofollow: v.number(),
      newBacklinks: v.optional(v.number()),
      lostBacklinks: v.optional(v.number()),
      avgInlinkRank: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    // Delete existing summary for this domain
    const existing = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Insert new summary
    await ctx.db.insert("domainBacklinksSummary", {
      domainId: args.domainId,
      ...args.summary,
      fetchedAt: Date.now(),
    });
  },
});

// Internal mutation to store backlinks
export const storeBacklinks = internalMutation({
  args: {
    domainId: v.id("domains"),
    backlinks: v.array(v.object({
      urlFrom: v.string(),
      urlTo: v.string(),
      anchor: v.string(),
      nofollow: v.boolean(),
      inlinkRank: v.optional(v.number()),
      domainInlinkRank: v.optional(v.number()),
      firstSeen: v.optional(v.string()),
      lastVisited: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Delete existing backlinks for this domain
    const existing = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    for (const bl of existing) {
      await ctx.db.delete(bl._id);
    }

    // Insert new backlinks with field mapping
    const now = Date.now();
    for (const bl of args.backlinks) {
      await ctx.db.insert("domainBacklinks", {
        domainId: args.domainId,
        domainFrom: bl.urlFrom.split("/")[2] || "", // Extract domain from URL
        urlFrom: bl.urlFrom,
        urlTo: bl.urlTo,
        anchor: bl.anchor,
        dofollow: !bl.nofollow, // Convert nofollow to dofollow
        rank: bl.inlinkRank,
        firstSeen: bl.firstSeen,
        lastSeen: bl.lastVisited,
        fetchedAt: now,
      });
    }
  },
});

// Test SE Ranking API connection
export const testConnection = action({
  args: {
    domain: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    data?: any;
  }> => {
    const apiKey = process.env.SERANKING_API_KEY;

    if (!apiKey) {
      return { success: false, error: "SE Ranking API key not configured. Set SERANKING_API_KEY environment variable." };
    }

    try {
      // Test with domain overview endpoint
      const url = new URL(`${SERANKING_API_URL}/domain/overview`);
      url.searchParams.set("source", args.source);
      url.searchParams.set("domain", args.domain);
      url.searchParams.set("type", "organic");

      console.log(`Testing SE Ranking API: ${url.toString()}`);
      console.log(`API Key (first 8 chars): ${apiKey.substring(0, 8)}...`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const responseText = await response.text();
      console.log("Response status:", response.status);
      console.log("Response body:", responseText.substring(0, 500));

      if (!response.ok) {
        return {
          success: false,
          error: `API error: ${response.status} - ${responseText}`,
        };
      }

      const data = JSON.parse(responseText);
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
