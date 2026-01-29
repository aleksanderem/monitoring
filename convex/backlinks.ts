import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

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

// Get backlinks list for a domain
export const getBacklinks = query({
  args: { 
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .collect();

    return {
      total: backlinks.length,
      items: backlinks.slice(offset, offset + limit),
    };
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
    tldDistribution: v.any(),
    platformTypes: v.any(),
    countries: v.any(),
  },
  handler: async (ctx, args) => {
    // Delete existing summary if any
    const existing = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Insert new summary with additional data as optional fields
    await ctx.db.insert("domainBacklinksSummary", {
      domainId: args.domainId,
      totalBacklinks: args.summary.totalBacklinks,
      totalDomains: args.summary.totalDomains,
      totalIps: args.summary.totalIps,
      totalSubnets: args.summary.totalSubnets,
      dofollow: args.summary.dofollow,
      nofollow: args.summary.nofollow,
      fetchedAt: Date.now(),
    });

    return { success: true };
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
      // Create form data
      const formData = new FormData();
      formData.append("domain", `https://${domain.domain}`);

      // Call external API
      const response = await fetch("https://n8n.kolabogroup.pl/webhook/dfs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract summary data from response
      const backlink_summary = data[0]?.backlink_summary?.[0];
      const result = backlink_summary?.result?.[0];

      if (!result) {
        throw new Error("No data in API response");
      }

      // Save to database
      await ctx.runMutation(internal.backlinks.saveBacklinkData, {
        domainId: args.domainId,
        summary: {
          totalBacklinks: result.backlinks || 0,
          totalDomains: result.referring_domains || 0,
          totalIps: result.referring_ips || 0,
          totalSubnets: result.referring_subnets || 0,
          dofollow: (result.backlinks || 0) - (result.backlinks_nofollow || 0),
          nofollow: result.backlinks_nofollow || 0,
        },
        tldDistribution: result.referring_links_tld || {},
        platformTypes: result.referring_links_platform_types || {},
        countries: result.referring_links_countries || {},
      });

      return { success: true, message: "Backlinks data fetched successfully" };
    } catch (error) {
      console.error("Error fetching backlinks:", error);
      throw new Error(`Failed to fetch backlinks: ${error}`);
    }
  },
});

// Get additional backlink data (TLD, platforms, countries)
export const getBacklinkDistributions = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // For now, return empty distributions
    // TODO: Store these in a separate table or extend domainBacklinksSummary
    return {
      tldDistribution: {},
      platformTypes: {},
      countries: {},
    };
  },
});
