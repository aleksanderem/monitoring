import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";
import { getSupabaseAdmin } from "./lib/supabase";

/**
 * Internal query to get competitor by ID
 */
export const getCompetitorInternal = internalQuery({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.competitorId);
  },
});

/**
 * Internal query: get list of competitor domain strings for a given domain.
 * Used by AI competitor search to exclude already-tracked competitors.
 */
export const getCompetitorDomainsForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    return competitors.map((c) => c.competitorDomain);
  },
});

/**
 * Internal: Add a competitor domain to track (used by SERP fetch job)
 */
export const addCompetitorInternal = internalMutation({
  args: {
    domainId: v.id("domains"),
    competitorDomain: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if competitor already exists
    const existing = await ctx.db
      .query("competitors")
      .withIndex("by_domain_competitor", (q) =>
        q.eq("domainId", args.domainId).eq("competitorDomain", args.competitorDomain)
      )
      .first();

    if (existing) {
      // Don't reactivate paused competitors - respect user's choice
      // Just update lastCheckedAt if it's active
      if (existing.status === "active") {
        await ctx.db.patch(existing._id, { lastCheckedAt: Date.now() });
      }
      return existing._id;
    }

    // Create new competitor (paused by default - user must activate)
    const competitorId = await ctx.db.insert("competitors", {
      domainId: args.domainId,
      competitorDomain: args.competitorDomain,
      name: args.name || args.competitorDomain,
      status: "paused",
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
    });

    return competitorId;
  },
});

/**
 * Add a competitor domain to track
 */
export const addCompetitor = mutation({
  args: {
    domainId: v.id("domains"),
    competitorDomain: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Check if competitor already exists
    const existing = await ctx.db
      .query("competitors")
      .withIndex("by_domain_competitor", (q) =>
        q.eq("domainId", args.domainId).eq("competitorDomain", args.competitorDomain)
      )
      .first();

    if (existing) {
      if (existing.status === "paused") {
        // Re-activate previously removed competitor
        await ctx.db.patch(existing._id, {
          status: "active",
          name: args.name || existing.name,
          lastCheckedAt: Date.now(),
        });
        return existing._id;
      }
      throw new Error(
        `Competitor "${args.competitorDomain}" is already being tracked.`
      );
    }

    // Create new competitor (active by default)
    const competitorId = await ctx.db.insert("competitors", {
      domainId: args.domainId,
      competitorDomain: args.competitorDomain,
      name: args.name || args.competitorDomain,
      status: "active",
      createdAt: Date.now(),
    });

    return competitorId;
  },
});

/**
 * Get all competitors for a domain (both active and paused)
 */
export const getCompetitors = query({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return competitors;
  },
});

/**
 * Remove/pause a competitor
 */
export const removeCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) throw new Error("Competitor not found");
    await requireTenantAccess(ctx, "domain", competitor.domainId);

    await ctx.db.patch(args.competitorId, {
      status: "paused",
    });
  },
});

/**
 * Internal: Save competitor position data from SERP results
 */
export const saveCompetitorPosition = internalMutation({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    date: v.string(),
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Check if position for this date already exists
    const existing = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor_keyword_date", (q) =>
        q
          .eq("competitorId", args.competitorId)
          .eq("keywordId", args.keywordId)
          .eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        position: args.position,
        url: args.url,
        fetchedAt: Date.now(),
      });
    } else {
      // Create new
      await ctx.db.insert("competitorKeywordPositions", {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        date: args.date,
        position: args.position,
        url: args.url,
        fetchedAt: Date.now(),
      });
    }
  },
});

/**
 * Get competitor positions for a keyword over time (Supabase action)
 */
export const getCompetitorPositions = action({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    // Verify access via internal helper
    const competitor = await ctx.runQuery(internal.competitors_internal.getCompetitorDetails, { competitorId: args.competitorId });
    if (!competitor) return [];

    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: competitor.domainId });
    if (!domain) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const { data } = await sb
      .from("competitor_keyword_positions")
      .select("convex_competitor_id, convex_keyword_id, date, position, url")
      .eq("convex_competitor_id", args.competitorId)
      .eq("convex_keyword_id", args.keywordId)
      .order("date", { ascending: false })
      .limit(30);

    // Return in a shape compatible with the old Convex document format
    return (data || []).map((row) => ({
      competitorId: row.convex_competitor_id,
      keywordId: row.convex_keyword_id,
      date: row.date,
      position: row.position,
      url: row.url,
    }));
  },
});

/**
 * Internal mutation to update competitor last checked timestamp
 */
export const updateCompetitorLastChecked = internalMutation({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.competitorId, {
      lastCheckedAt: Date.now(),
    });
  },
});

/**
 * Update competitor (name or status)
 */
export const updateCompetitor = mutation({
  args: {
    competitorId: v.id("competitors"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) throw new Error("Competitor not found");
    await requireTenantAccess(ctx, "domain", competitor.domainId);

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.competitorId, updates);
  },
});

/**
 * Get all competitors with their positions for a specific keyword (Supabase action)
 */
export const getCompetitorsForKeyword = action({
  args: {
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const domain = await ctx.runQuery(internal.competitors_internal.verifyDomainAccess, { domainId: args.domainId });
    if (!domain) return [];

    // Get all active competitors for this domain
    const competitors = await ctx.runQuery(internal.competitors_internal.getActiveCompetitors, { domainId: args.domainId });

    if (competitors.length === 0) return [];

    const sb = getSupabaseAdmin();
    if (!sb) {
      // Fallback: return competitors without position data
      return competitors.map((c: any) => ({
        ...c,
        currentPosition: null,
        currentUrl: null,
        lastChecked: null,
      }));
    }

    const competitorIds = competitors.map((c: any) => c._id);

    // Get latest positions for all competitors for this keyword
    const { data: rows } = await sb
      .from("competitor_keyword_positions")
      .select("convex_competitor_id, position, url, date")
      .in("convex_competitor_id", competitorIds)
      .eq("convex_keyword_id", args.keywordId)
      .order("date", { ascending: false });

    // Deduplicate to latest per competitor
    const latestByCompetitor = new Map<string, { position: number | null; url: string | null; date: string }>();
    for (const row of rows || []) {
      if (!latestByCompetitor.has(row.convex_competitor_id)) {
        latestByCompetitor.set(row.convex_competitor_id, {
          position: row.position,
          url: row.url,
          date: row.date,
        });
      }
    }

    return competitors.map((c: any) => {
      const posData = latestByCompetitor.get(c._id);
      return {
        ...c,
        currentPosition: posData?.position ?? null,
        currentUrl: posData?.url ?? null,
        lastChecked: posData ? new Date(posData.date).getTime() : null,
      };
    });
  },
});

/**
 * Discover competitor domains from SERP results.
 * Aggregates domains that appear across monitored keyword SERPs,
 * excluding the user's own domain, already-tracked competitors,
 * and generic platforms (social media, marketplaces, etc.).
 */

const BLOCKED_COMPETITOR_DOMAINS = new Set([
  // Social media
  "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com",
  "linkedin.com", "pinterest.com", "reddit.com", "tumblr.com", "snapchat.com",
  "threads.net", "mastodon.social",
  // Video platforms
  "youtube.com", "vimeo.com", "dailymotion.com", "twitch.tv",
  // Marketplaces
  "amazon.com", "amazon.de", "amazon.co.uk", "amazon.fr", "amazon.es",
  "amazon.it", "amazon.pl", "amazon.nl", "amazon.se", "amazon.com.au",
  "ebay.com", "ebay.de", "ebay.co.uk", "ebay.fr", "ebay.pl",
  "aliexpress.com", "alibaba.com", "etsy.com", "allegro.pl",
  "walmart.com", "target.com", "temu.com", "shein.com",
  // Search engines & aggregators
  "google.com", "bing.com", "yahoo.com", "duckduckgo.com",
  "yandex.com", "yandex.ru", "baidu.com",
  // Generic platforms & wikis
  "wikipedia.org", "en.wikipedia.org", "pl.wikipedia.org", "de.wikipedia.org",
  "quora.com", "medium.com", "blogspot.com", "wordpress.com", "wix.com",
  "github.com", "stackoverflow.com", "stackexchange.com",
  // Maps & directories
  "yelp.com", "tripadvisor.com", "booking.com", "maps.google.com",
  // News aggregators
  "news.google.com", "apple.news",
]);

function isBlockedCompetitorDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (BLOCKED_COMPETITOR_DOMAINS.has(d)) return true;
  // Also check if it's a subdomain of a blocked domain
  for (const blocked of BLOCKED_COMPETITOR_DOMAINS) {
    if (d.endsWith("." + blocked)) return true;
  }
  return false;
}

export const getCompetitorSuggestionsFromSerp = query({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Get monitored keywords for this domain
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const activeKeywords = allKeywords.filter((k) => k.status === "active");
    if (activeKeywords.length === 0) return [];

    // Get already tracked competitor domains
    const existingCompetitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const trackedDomains = new Set(existingCompetitors.map((c) => c.competitorDomain));

    // Aggregate domains from SERP results across keywords
    const domainStats: Record<string, { count: number; totalPosition: number; keywords: string[] }> = {};

    for (const kw of activeKeywords.slice(0, 50)) {
      const results = await ctx.db
        .query("keywordSerpResults")
        .withIndex("by_keyword_date", (q) => q.eq("keywordId", kw._id))
        .order("desc")
        .take(100);

      if (results.length === 0) continue;

      const latestDate = results[0].date;
      const latest = results.filter((r) => r.date === latestDate && !r.isYourDomain);

      for (const r of latest) {
        const d = r.domain;
        if (!d || trackedDomains.has(d) || isBlockedCompetitorDomain(d)) continue;

        if (!domainStats[d]) {
          domainStats[d] = { count: 0, totalPosition: 0, keywords: [] };
        }
        domainStats[d].count++;
        domainStats[d].totalPosition += r.position;
        if (domainStats[d].keywords.length < 3) {
          domainStats[d].keywords.push(kw.phrase);
        }
      }
    }

    return Object.entries(domainStats)
      .map(([domain, stats]) => ({
        domain,
        keywordOverlap: stats.count,
        avgPosition: Math.round((stats.totalPosition / stats.count) * 10) / 10,
        sampleKeywords: stats.keywords,
      }))
      .sort((a, b) => b.keywordOverlap - a.keywordOverlap)
      .slice(0, 30);
  },
});
