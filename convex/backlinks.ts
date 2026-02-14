import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import { createDebugLogger } from "./lib/debugLogger";
import { buildLocationParam } from "./dataforseoLocations";

// Get backlink summary for a domain
export const getBacklinkSummary = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    return summary;
  },
});

// Check if backlink data is stale (older than 7 days)
export const isBacklinkDataStale = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    if (!summary) return true;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return summary.fetchedAt < sevenDaysAgo;
  },
});

// Action to fetch backlinks from external API
export const fetchBacklinks = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    // Start fetching in background - we'll return immediately
    // The actual API call will happen via http action
    return { success: true, message: "Backlinks fetch started" };
  },
});

// Get backlinks list for a domain with sorting and filtering
export const getBacklinks = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()), // "rank", "domainRank", "spam", "date"
    filterDofollow: v.optional(v.boolean()), // null = all, true = dofollow, false = nofollow
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    let backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Filter by dofollow/nofollow if specified
    if (args.filterDofollow !== undefined && args.filterDofollow !== null) {
      backlinks = backlinks.filter(b => b.dofollow === args.filterDofollow);
    }

    // Sort by specified field
    if (args.sortBy === "rank" && backlinks.length > 0) {
      backlinks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
    } else if (args.sortBy === "domainRank") {
      backlinks.sort((a, b) => (b.domainFromRank || 0) - (a.domainFromRank || 0));
    } else if (args.sortBy === "spam") {
      backlinks.sort((a, b) => (a.backlink_spam_score || 0) - (b.backlink_spam_score || 0));
    } else if (args.sortBy === "date") {
      backlinks.sort((a, b) => {
        const dateA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const dateB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return dateB - dateA;
      });
    }

    return {
      total: backlinks.length,
      items: backlinks.slice(offset, offset + limit),
      stats: {
        totalDofollow: backlinks.filter(b => b.dofollow === true).length,
        totalNofollow: backlinks.filter(b => b.dofollow !== true).length,
        avgRank: backlinks.reduce((sum, b) => sum + (b.rank || 0), 0) / backlinks.length || 0,
        avgSpamScore: backlinks.reduce((sum, b) => sum + (b.backlink_spam_score || 0), 0) / backlinks.length || 0,
      },
    };
  },
});

// Cleanup function to delete all old backlinks with incompatible schema
export const deleteAllBacklinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allBacklinks = await ctx.db.query("domainBacklinks").collect();
    for (const backlink of allBacklinks) {
      await ctx.db.delete(backlink._id);
    }
    return { deleted: allBacklinks.length };
  },
});

export const deleteBacklinks = mutation({
  args: { backlinkIds: v.array(v.id("domainBacklinks")) },
  handler: async (ctx, args) => {
    for (const id of args.backlinkIds) {
      await ctx.db.delete(id);
    }
  },
});

// Internal mutation to save backlink data
export const saveBacklinkData = internalMutation({
  args: {
    domainId: v.id("domains"),
    summary: v.object({
      totalBacklinks: v.number(),
      totalDomains: v.number(),
      totalIps: v.number(),
      totalSubnets: v.number(),
      dofollow: v.number(),
      nofollow: v.number(),
    }),
    distributions: v.object({
      tldDistribution: v.any(),
      platformTypes: v.any(),
      countries: v.any(),
      linkTypes: v.any(),
      linkAttributes: v.any(),
      semanticLocations: v.any(),
    }),
    backlinks: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const fetchedAt = Date.now();

    // Delete existing summary if any
    const existingSummary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    if (existingSummary) {
      await ctx.db.delete(existingSummary._id);
    }

    // Insert new summary
    await ctx.db.insert("domainBacklinksSummary", {
      domainId: args.domainId,
      totalBacklinks: args.summary.totalBacklinks,
      totalDomains: args.summary.totalDomains,
      totalIps: args.summary.totalIps,
      totalSubnets: args.summary.totalSubnets,
      dofollow: args.summary.dofollow,
      nofollow: args.summary.nofollow,
      fetchedAt,
    });

    // Delete existing distributions if any
    const existingDistributions = await ctx.db
      .query("domainBacklinksDistributions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    if (existingDistributions) {
      await ctx.db.delete(existingDistributions._id);
    }

    // Insert new distributions
    await ctx.db.insert("domainBacklinksDistributions", {
      domainId: args.domainId,
      tldDistribution: args.distributions.tldDistribution,
      platformTypes: args.distributions.platformTypes,
      countries: args.distributions.countries,
      linkTypes: args.distributions.linkTypes,
      linkAttributes: args.distributions.linkAttributes,
      semanticLocations: args.distributions.semanticLocations,
      fetchedAt,
    });

    // Delete existing backlinks (we'll replace with fresh data)
    const existingBacklinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    for (const backlink of existingBacklinks) {
      await ctx.db.delete(backlink._id);
    }

    // Insert new backlinks (limit to first 1000 to avoid timeout)
    const backlinksToInsert = args.backlinks.slice(0, 1000);
    for (const backlink of backlinksToInsert) {
      await ctx.db.insert("domainBacklinks", {
        domainId: args.domainId,
        domainFrom: backlink.domain_from ?? undefined,
        urlFrom: backlink.url_from ?? "",
        urlTo: backlink.url_to ?? "",
        tldFrom: backlink.tld_from ?? undefined,
        anchor: backlink.anchor ?? undefined,
        textPre: backlink.text_pre ?? undefined,
        textPost: backlink.text_post ?? undefined,
        dofollow: backlink.dofollow ?? undefined,
        itemType: backlink.item_type ?? undefined,
        rank: backlink.rank ?? undefined,
        pageFromRank: backlink.page_from_rank ?? undefined,
        domainFromRank: backlink.domain_from_rank ?? undefined,
        backlink_spam_score: backlink.backlink_spam_score ?? undefined,
        firstSeen: backlink.first_seen ?? undefined,
        lastSeen: backlink.last_seen ?? undefined,
        isNew: backlink.is_new ?? undefined,
        isLost: backlink.is_lost ?? undefined,
        pageFromTitle: backlink.page_from_title ?? undefined,
        semanticLocation: backlink.semantic_location ?? undefined,
        domainFromCountry: backlink.domain_from_country ?? undefined,
        fetchedAt,
      });
    }

    return {
      success: true,
      backlinksInserted: backlinksToInsert.length,
    };
  },
});

// Action to fetch backlinks from external API
export const fetchBacklinksFromAPI = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get domain info
    const domain = await ctx.runQuery(api.domains.getDomain, {
      domainId: args.domainId,
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    try {
      const debug = await createDebugLogger(ctx, "backlinks", args.domainId);
      // Ensure domain has protocol prefix (avoid double https://)
      const target = domain.domain.startsWith("http") ? domain.domain : `https://${domain.domain}`;

      // Build request body with location/language codes
      const locationParam = buildLocationParam(domain.settings.location);
      const locationCode = "location_code" in locationParam ? locationParam.location_code : 0;
      const languageCode = domain.settings.language || "en";
      const requestBody = `domain=${encodeURIComponent(target)}&location_code=${locationCode}&language_code=${encodeURIComponent(languageCode)}`;

      // Call external API
      const data: any = await debug.logStep("n8n_backlinks", { url: "https://n8n.kolabogroup.pl/webhook/dfs", method: "POST", body: requestBody }, async () => {
        const response = await fetch("https://n8n.kolabogroup.pl/webhook/dfs", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: requestBody,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("API returned empty response");
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`API returned invalid JSON (${text.length} chars): ${text.slice(0, 200)}`);
        }
      });

      // Extract summary data from response
      const backlink_summary = data[0]?.backlink_summary?.[0];
      const result = backlink_summary?.result?.[0];

      // Extract individual backlinks from response
      const backlinks_data = data[1]?.backlinks?.[0];
      const backlinks = backlinks_data?.result?.[0]?.items || [];

      // Save whatever data we have (zeros if API returned no results for this domain)
      await ctx.runMutation(internal.backlinks.saveBacklinkData, {
        domainId: args.domainId,
        summary: {
          totalBacklinks: result?.backlinks || 0,
          totalDomains: result?.referring_domains || 0,
          totalIps: result?.referring_ips || 0,
          totalSubnets: result?.referring_subnets || 0,
          dofollow: (result?.backlinks || 0) - (result?.backlinks_nofollow || 0),
          nofollow: result?.backlinks_nofollow || 0,
        },
        distributions: {
          tldDistribution: result?.referring_links_tld || {},
          platformTypes: result?.referring_links_platform_types || {},
          countries: result?.referring_links_countries || {},
          linkTypes: result?.referring_links_types || {},
          linkAttributes: result?.referring_links_attributes || {},
          semanticLocations: result?.referring_links_semantic_locations || {},
        },
        backlinks,
      });

      if (!result) {
        console.warn(`No backlink data returned for domain ${domain.domain} — saved empty summary`);
      }

      return {
        success: true,
        message: result
          ? "Backlinks data fetched successfully"
          : "No backlink data found for this domain",
        backlinksCount: backlinks.length,
      };
    } catch (error) {
      console.error("Error fetching backlinks:", error);
      throw new Error(`Failed to fetch backlinks: ${error}`);
    }
  },
});

// Get backlink distributions (TLD, platforms, countries, etc.)
export const getBacklinkDistributions = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const distributions = await ctx.db
      .query("domainBacklinksDistributions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    if (!distributions) {
      return {
        tldDistribution: {},
        platformTypes: {},
        countries: {},
        linkTypes: {},
        linkAttributes: {},
        semanticLocations: {},
      };
    }

    return {
      tldDistribution: distributions.tldDistribution || {},
      platformTypes: distributions.platformTypes || {},
      countries: distributions.countries || {},
      linkTypes: distributions.linkTypes || {},
      linkAttributes: distributions.linkAttributes || {},
      semanticLocations: distributions.semanticLocations || {},
    };
  },
});

// Get backlinks history grouped by day or month
export const getBacklinksHistory = query({
  args: {
    domainId: v.id("domains"),
    granularity: v.optional(v.union(v.literal("daily"), v.literal("monthly"))),
  },
  handler: async (ctx, args) => {
    const backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const granularity = args.granularity ?? "monthly";
    const groupedData = new Map<string, number>();

    for (const backlink of backlinks) {
      const dateStr = backlink.firstSeen || new Date(backlink.fetchedAt).toISOString();

      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const key = granularity === "daily"
            ? date.toISOString().split("T")[0] // YYYY-MM-DD
            : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
          groupedData.set(key, (groupedData.get(key) || 0) + 1);
        }
      } catch (e) {
        continue;
      }
    }

    return Array.from(groupedData.entries())
      .map(([date, count]) => ({ date, backlinks: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

// =================================================================
// Competitor Backlinks Functions
// =================================================================

/**
 * Get backlink summary for a competitor
 */
export const getCompetitorBacklinkSummary = query({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("competitorBacklinksSummary")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .unique();

    return summary;
  },
});

/**
 * Internal: Get competitor backlink summary
 */
export const getCompetitorBacklinksSummaryInternal = internalQuery({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("competitorBacklinksSummary")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .unique();

    return summary;
  },
});

/**
 * Check if competitor backlink data is stale (older than 7 days)
 */
export const isCompetitorBacklinkDataStale = query({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("competitorBacklinksSummary")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .unique();

    if (!summary) return true;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return summary.fetchedAt < sevenDaysAgo;
  },
});

/**
 * Get competitor backlinks list with sorting and filtering
 */
export const getCompetitorBacklinks = query({
  args: {
    competitorId: v.id("competitors"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    filterDofollow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    let backlinks = await ctx.db
      .query("competitorBacklinks")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    // Filter by dofollow/nofollow if specified
    if (args.filterDofollow !== undefined && args.filterDofollow !== null) {
      backlinks = backlinks.filter(b => b.dofollow === args.filterDofollow);
    }

    // Sort by specified field
    if (args.sortBy === "rank" && backlinks.length > 0) {
      backlinks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
    } else if (args.sortBy === "domainRank") {
      backlinks.sort((a, b) => (b.domainFromRank || 0) - (a.domainFromRank || 0));
    } else if (args.sortBy === "spam") {
      backlinks.sort((a, b) => (a.backlink_spam_score || 0) - (b.backlink_spam_score || 0));
    } else if (args.sortBy === "date") {
      backlinks.sort((a, b) => {
        const dateA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const dateB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return dateB - dateA;
      });
    }

    return {
      total: backlinks.length,
      items: backlinks.slice(offset, offset + limit),
      stats: {
        totalDofollow: backlinks.filter(b => b.dofollow === true).length,
        totalNofollow: backlinks.filter(b => b.dofollow !== true).length,
        avgRank: backlinks.reduce((sum, b) => sum + (b.rank || 0), 0) / backlinks.length || 0,
        avgSpamScore: backlinks.reduce((sum, b) => sum + (b.backlink_spam_score || 0), 0) / backlinks.length || 0,
      },
    };
  },
});

/**
 * Get competitor backlink distributions
 */
export const getCompetitorBacklinkDistributions = query({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const distributions = await ctx.db
      .query("competitorBacklinksDistributions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .unique();

    if (!distributions) {
      return {
        tldDistribution: {},
        platformTypes: {},
        countries: {},
        linkTypes: {},
        linkAttributes: {},
        semanticLocations: {},
      };
    }

    return {
      tldDistribution: distributions.tldDistribution || {},
      platformTypes: distributions.platformTypes || {},
      countries: distributions.countries || {},
      linkTypes: distributions.linkTypes || {},
      linkAttributes: distributions.linkAttributes || {},
      semanticLocations: distributions.semanticLocations || {},
    };
  },
});

/**
 * Internal mutation to save competitor backlink data
 */
export const saveCompetitorBacklinkData = internalMutation({
  args: {
    competitorId: v.id("competitors"),
    summary: v.object({
      totalBacklinks: v.number(),
      totalDomains: v.number(),
      totalIps: v.number(),
      totalSubnets: v.number(),
      dofollow: v.number(),
      nofollow: v.number(),
    }),
    distributions: v.object({
      tldDistribution: v.any(),
      platformTypes: v.any(),
      countries: v.any(),
      linkTypes: v.any(),
      linkAttributes: v.any(),
      semanticLocations: v.any(),
    }),
    backlinks: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const fetchedAt = Date.now();

    // Delete existing summary if any
    const existingSummary = await ctx.db
      .query("competitorBacklinksSummary")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .unique();

    if (existingSummary) {
      await ctx.db.delete(existingSummary._id);
    }

    // Insert new summary
    await ctx.db.insert("competitorBacklinksSummary", {
      competitorId: args.competitorId,
      totalBacklinks: args.summary.totalBacklinks,
      totalDomains: args.summary.totalDomains,
      totalIps: args.summary.totalIps,
      totalSubnets: args.summary.totalSubnets,
      dofollow: args.summary.dofollow,
      nofollow: args.summary.nofollow,
      fetchedAt,
    });

    // Delete existing distributions if any
    const existingDistributions = await ctx.db
      .query("competitorBacklinksDistributions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .unique();

    if (existingDistributions) {
      await ctx.db.delete(existingDistributions._id);
    }

    // Insert new distributions
    await ctx.db.insert("competitorBacklinksDistributions", {
      competitorId: args.competitorId,
      tldDistribution: args.distributions.tldDistribution,
      platformTypes: args.distributions.platformTypes,
      countries: args.distributions.countries,
      linkTypes: args.distributions.linkTypes,
      linkAttributes: args.distributions.linkAttributes,
      semanticLocations: args.distributions.semanticLocations,
      fetchedAt,
    });

    // Delete existing backlinks
    const existingBacklinks = await ctx.db
      .query("competitorBacklinks")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    for (const backlink of existingBacklinks) {
      await ctx.db.delete(backlink._id);
    }

    // Insert new backlinks (limit to first 1000 to avoid timeout)
    const backlinksToInsert = args.backlinks.slice(0, 1000);
    for (const backlink of backlinksToInsert) {
      await ctx.db.insert("competitorBacklinks", {
        competitorId: args.competitorId,
        domainFrom: backlink.domain_from ?? undefined,
        urlFrom: backlink.url_from ?? "",
        urlTo: backlink.url_to ?? "",
        tldFrom: backlink.tld_from ?? undefined,
        anchor: backlink.anchor ?? undefined,
        textPre: backlink.text_pre ?? undefined,
        textPost: backlink.text_post ?? undefined,
        dofollow: backlink.dofollow ?? undefined,
        itemType: backlink.item_type ?? undefined,
        rank: backlink.rank ?? undefined,
        pageFromRank: backlink.page_from_rank ?? undefined,
        domainFromRank: backlink.domain_from_rank ?? undefined,
        backlink_spam_score: backlink.backlink_spam_score ?? undefined,
        firstSeen: backlink.first_seen ?? undefined,
        lastSeen: backlink.last_seen ?? undefined,
        isNew: backlink.is_new ?? undefined,
        isLost: backlink.is_lost ?? undefined,
        pageFromTitle: backlink.page_from_title ?? undefined,
        semanticLocation: backlink.semantic_location ?? undefined,
        domainFromCountry: backlink.domain_from_country ?? undefined,
        fetchedAt,
      });
    }

    return {
      success: true,
      backlinksInserted: backlinksToInsert.length,
    };
  },
});

/**
 * Action to fetch competitor backlinks from external API
 */
export const fetchCompetitorBacklinksFromAPI = action({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    // Get competitor info
    const competitor = await ctx.runQuery(internal.competitors.getCompetitorInternal, {
      competitorId: args.competitorId,
    });

    if (!competitor) {
      throw new Error("Competitor not found");
    }

    try {
      const debug = await createDebugLogger(ctx, "competitor_backlinks");
      // Ensure domain has protocol prefix (avoid double https://)
      const target = competitor.competitorDomain.startsWith("http")
        ? competitor.competitorDomain
        : `https://${competitor.competitorDomain}`;

      // Get parent domain for location/language settings
      const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
        domainId: competitor.domainId,
      });
      const locationParam = domain ? buildLocationParam(domain.settings.location) : {};
      const locationCode = locationParam && "location_code" in locationParam ? locationParam.location_code : 0;
      const languageCode = domain?.settings?.language || "en";
      const requestBody = `domain=${encodeURIComponent(target)}&location_code=${locationCode}&language_code=${encodeURIComponent(languageCode)}`;

      // Call external API (same n8n webhook as for own domain)
      const data: any = await debug.logStep("n8n_competitor_backlinks", { url: "https://n8n.kolabogroup.pl/webhook/dfs", method: "POST", body: requestBody }, async () => {
        const response = await fetch("https://n8n.kolabogroup.pl/webhook/dfs", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: requestBody,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("API returned empty response");
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`API returned invalid JSON (${text.length} chars): ${text.slice(0, 200)}`);
        }
      });

      // Extract summary data from response
      const backlink_summary = data[0]?.backlink_summary?.[0];
      const result = backlink_summary?.result?.[0];

      // Extract individual backlinks from response
      const backlinks_data = data[1]?.backlinks?.[0];
      const backlinks = backlinks_data?.result?.[0]?.items || [];

      // Save whatever data we have (zeros if API returned no results)
      await ctx.runMutation(internal.backlinks.saveCompetitorBacklinkData, {
        competitorId: args.competitorId,
        summary: {
          totalBacklinks: result?.backlinks || 0,
          totalDomains: result?.referring_domains || 0,
          totalIps: result?.referring_ips || 0,
          totalSubnets: result?.referring_subnets || 0,
          dofollow: (result?.backlinks || 0) - (result?.backlinks_nofollow || 0),
          nofollow: result?.backlinks_nofollow || 0,
        },
        distributions: {
          tldDistribution: result?.referring_links_tld || {},
          platformTypes: result?.referring_links_platform_types || {},
          countries: result?.referring_links_countries || {},
          linkTypes: result?.referring_links_types || {},
          linkAttributes: result?.referring_links_attributes || {},
          semanticLocations: result?.referring_links_semantic_locations || {},
        },
        backlinks,
      });

      // Update competitor's lastCheckedAt
      await ctx.runMutation(internal.competitors.updateCompetitorLastChecked, {
        competitorId: args.competitorId,
      });

      if (!result) {
        console.warn(`No backlink data returned for competitor ${competitor.competitorDomain} — saved empty summary`);
      }

      return {
        success: true,
        message: result
          ? "Competitor backlinks data fetched successfully"
          : "No backlink data found for this competitor",
        backlinksCount: backlinks.length,
      };
    } catch (error) {
      console.error("Error fetching competitor backlinks:", error);
      throw new Error(`Failed to fetch competitor backlinks: ${error}`);
    }
  },
});
