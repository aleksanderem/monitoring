import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";
import { API_COSTS, extractApiCost } from "./apiUsage";

/**
 * Analyze competitor page content for a specific keyword
 * Uses DataForSEO Instant Pages API to get on-page analysis
 */
export const analyzeCompetitorPage = internalAction({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
    url: v.string(),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(`[analyzeCompetitorPage] Analyzing ${args.url} for competitor ${args.competitorId}`);

    // Check cache — skip API call if URL was analyzed within 7 days
    const cached = await ctx.runQuery(internal.competitorAnalysis.getCachedPageAnalysis, {
      url: args.url,
    });
    if (cached) {
      console.log(`[analyzeCompetitorPage] Cache hit for ${args.url} (fetched ${new Date(cached.fetchedAt).toISOString()})`);
      return { success: true };
    }

    // Get API credentials
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      throw new Error("DataForSEO credentials not configured");
    }

    const auth = btoa(`${login}:${password}`);

    // Call DataForSEO On-Page Instant Pages API
    const requestBody = [{
      url: args.url,
      enable_javascript: true,
      load_resources: true,
      enable_browser_rendering: true,
      custom_js: "meta = {}; meta.url = document.URL; meta;",
    }];

    console.log(`[analyzeCompetitorPage] Calling Instant Pages API for ${args.url}`);

    const response = await fetch(
      "https://api.dataforseo.com/v3/on_page/instant_pages",
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
      console.error(`[analyzeCompetitorPage] API error: ${response.status}`);
      throw new Error(`DataForSEO API error: ${response.status}`);
    }

    const data = await response.json();

    // Log API usage
    await ctx.runMutation(internal.apiUsage.logApiUsage, {
      endpoint: "/on_page/instant_pages",
      taskCount: 1,
      estimatedCost: extractApiCost(data, API_COSTS.ON_PAGE_INSTANT_PAGES),
      caller: "analyzeCompetitorPage",
    });

    if (data.status_code !== 20000) {
      console.error(`[analyzeCompetitorPage] API returned error: ${data.status_code}`);
      throw new Error(`DataForSEO API error: ${data.status_code}`);
    }

    const taskResult = data.tasks?.[0];

    if (!taskResult || taskResult.status_code !== 20000) {
      console.error(`[analyzeCompetitorPage] Task failed`);
      throw new Error("Instant Pages task failed");
    }

    const result = taskResult.result?.[0];
    if (!result) {
      console.log(`[analyzeCompetitorPage] No data returned`);
      return { success: false };
    }

    // Extract page data
    const pageData = result.items?.[0];
    if (!pageData) {
      console.log(`[analyzeCompetitorPage] No page data`);
      return { success: false };
    }

    // Store analysis
    await ctx.runMutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId: args.competitorId,
      keywordId: args.keywordId,
      url: args.url,
      position: args.position,
      title: pageData.meta?.title || undefined,
      metaDescription: pageData.meta?.description || undefined,
      h1: pageData.meta?.h1 || undefined,
      canonical: pageData.meta?.canonical || undefined,
      wordCount: pageData.page_metrics?.word_count || 0,
      plainTextSize: pageData.page_metrics?.plain_text_size || undefined,
      plainTextRate: pageData.page_metrics?.plain_text_rate || undefined,
      htags: pageData.meta?.htags ? {
        h1: pageData.meta.htags.h1 || [],
        h2: pageData.meta.htags.h2 || [],
        h3: pageData.meta.htags.h3 || undefined,
        h4: pageData.meta.htags.h4 || undefined,
      } : undefined,
      internalLinksCount: pageData.meta?.internal_links_count || undefined,
      externalLinksCount: pageData.meta?.external_links_count || undefined,
      imagesCount: pageData.meta?.images_count || undefined,
      loadTime: pageData.page_timing?.time_to_interactive || undefined,
      pageSize: pageData.page_metrics?.html_size || undefined,
      coreWebVitals: pageData.page_timing ? {
        largestContentfulPaint: pageData.page_timing.largest_contentful_paint || 0,
        firstInputDelay: pageData.page_timing.first_input_delay || 0,
        timeToInteractive: pageData.page_timing.time_to_interactive || 0,
        cumulativeLayoutShift: pageData.page_timing.cumulative_layout_shift || undefined,
      } : undefined,
      onpageScore: pageData.onpage_score || undefined,
      readabilityScores: pageData.page_metrics?.readability ? {
        automatedReadabilityIndex: pageData.page_metrics.readability.automated_readability_index || 0,
        fleschKincaidIndex: pageData.page_metrics.readability.flesch_kincaid_grade_level || 0,
      } : undefined,
      schemaTypes: pageData.meta?.schema_types || undefined,
    });

    console.log(`[analyzeCompetitorPage] Successfully analyzed ${args.url}`);
    return { success: true };
  },
});

/**
 * Internal mutation to store competitor page analysis
 */
export const storeCompetitorPageAnalysis = internalMutation({
  args: {
    competitorId: v.optional(v.id("competitors")), // Optional for keyword-specific reports
    keywordId: v.id("keywords"),
    url: v.string(),
    position: v.number(),
    title: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    h1: v.optional(v.string()),
    canonical: v.optional(v.string()),
    wordCount: v.number(),
    plainTextSize: v.optional(v.number()),
    plainTextRate: v.optional(v.number()),
    htags: v.optional(v.object({
      h1: v.array(v.string()),
      h2: v.array(v.string()),
      h3: v.optional(v.array(v.string())),
      h4: v.optional(v.array(v.string())),
    })),
    internalLinksCount: v.optional(v.number()),
    externalLinksCount: v.optional(v.number()),
    imagesCount: v.optional(v.number()),
    loadTime: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    coreWebVitals: v.optional(v.object({
      largestContentfulPaint: v.number(),
      firstInputDelay: v.number(),
      timeToInteractive: v.number(),
      cumulativeLayoutShift: v.optional(v.number()),
    })),
    onpageScore: v.optional(v.number()),
    readabilityScores: v.optional(v.object({
      automatedReadabilityIndex: v.number(),
      fleschKincaidIndex: v.number(),
    })),
    schemaTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Check if analysis for this URL already exists
    // For keyword-specific reports (competitorId is null), match by URL + keywordId
    const existing = args.competitorId
      ? await ctx.db
          .query("competitorPageAnalysis")
          .withIndex("by_competitor_keyword", (q) =>
            q.eq("competitorId", args.competitorId).eq("keywordId", args.keywordId)
          )
          .first()
      : await ctx.db
          .query("competitorPageAnalysis")
          .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
          .filter((q) => q.eq(q.field("url"), args.url))
          .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        url: args.url,
        position: args.position,
        title: args.title,
        metaDescription: args.metaDescription,
        h1: args.h1,
        canonical: args.canonical,
        wordCount: args.wordCount,
        plainTextSize: args.plainTextSize,
        plainTextRate: args.plainTextRate,
        htags: args.htags,
        internalLinksCount: args.internalLinksCount,
        externalLinksCount: args.externalLinksCount,
        imagesCount: args.imagesCount,
        loadTime: args.loadTime,
        pageSize: args.pageSize,
        coreWebVitals: args.coreWebVitals,
        onpageScore: args.onpageScore,
        readabilityScores: args.readabilityScores,
        schemaTypes: args.schemaTypes,
        fetchedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new
      const id = await ctx.db.insert("competitorPageAnalysis", {
        competitorId: args.competitorId,
        keywordId: args.keywordId,
        url: args.url,
        position: args.position,
        title: args.title,
        metaDescription: args.metaDescription,
        h1: args.h1,
        canonical: args.canonical,
        wordCount: args.wordCount,
        plainTextSize: args.plainTextSize,
        plainTextRate: args.plainTextRate,
        htags: args.htags,
        internalLinksCount: args.internalLinksCount,
        externalLinksCount: args.externalLinksCount,
        imagesCount: args.imagesCount,
        loadTime: args.loadTime,
        pageSize: args.pageSize,
        coreWebVitals: args.coreWebVitals,
        onpageScore: args.onpageScore,
        readabilityScores: args.readabilityScores,
        schemaTypes: args.schemaTypes,
        fetchedAt: Date.now(),
      });
      return id;
    }
  },
});

/**
 * Get competitor page analysis for a specific keyword
 */
export const getCompetitorPageAnalysis = query({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) return null;
    await requireTenantAccess(ctx, "domain", competitor.domainId);

    return await ctx.db
      .query("competitorPageAnalysis")
      .withIndex("by_competitor_keyword", (q) =>
        q.eq("competitorId", args.competitorId).eq("keywordId", args.keywordId)
      )
      .first();
  },
});

/**
 * Get all analyzed pages for a competitor
 */
export const getCompetitorAnalyzedPages = query({
  args: {
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) return [];
    await requireTenantAccess(ctx, "domain", competitor.domainId);

    return await ctx.db
      .query("competitorPageAnalysis")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();
  },
});

/**
 * Compare your page with competitor page for a keyword
 */
export const comparePageWithCompetitor = query({
  args: {
    keywordId: v.id("keywords"),
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) return null;
    await requireTenantAccess(ctx, "domain", competitor.domainId);

    // Get competitor page analysis
    const competitorPage = await ctx.db
      .query("competitorPageAnalysis")
      .withIndex("by_competitor_keyword", (q) =>
        q.eq("competitorId", args.competitorId).eq("keywordId", args.keywordId)
      )
      .first();

    if (!competitorPage) {
      return null;
    }

    // Get keyword to find your URL
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) {
      return null;
    }

    // Get latest SERP result for this keyword to find your page
    const yourSerpResult = await ctx.db
      .query("keywordSerpResults")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .filter((q) => q.eq(q.field("isYourDomain"), true))
      .first();

    // Get your page analysis if available
    // (You would need to have run on-page analysis on your own domain)
    const yourPage = yourSerpResult ? await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", keyword.domainId))
      .filter((q) => q.eq(q.field("url"), yourSerpResult.url))
      .first() : null;

    return {
      competitor: competitorPage,
      yours: yourPage,
      comparison: yourPage ? {
        wordCountDiff: competitorPage.wordCount - yourPage.wordCount,
        h2CountDiff: (competitorPage.htags?.h2.length || 0) - (yourPage.htags?.h2.length || 0),
        imagesCountDiff: (competitorPage.imagesCount || 0) - (yourPage.imagesCount || 0),
        internalLinksDiff: (competitorPage.internalLinksCount || 0) - (yourPage.internalLinksCount || 0),
      } : null,
    };
  },
});

/**
 * Trigger competitor page analysis for a keyword.
 * Finds the competitor's URL from SERP position data and schedules analysis.
 */
export const triggerCompetitorPageAnalysis = mutation({
  args: {
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const competitor = await ctx.db.get(args.competitorId);
    if (!competitor) throw new Error("Competitor not found");
    await requireTenantAccess(ctx, "domain", competitor.domainId);

    let url: string | null = null;
    let position = 0;

    // 1. Try competitorKeywordPositions first
    const positionRecord = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor_keyword", (q) =>
        q.eq("competitorId", args.competitorId).eq("keywordId", args.keywordId)
      )
      .order("desc")
      .first();

    if (positionRecord?.url) {
      url = positionRecord.url;
      position = positionRecord.position ?? 0;
    }

    // 2. Fallback: search keywordSerpResults for this competitor's domain
    if (!url) {
      const competitor = await ctx.db.get(args.competitorId);
      if (!competitor) {
        throw new Error("Competitor not found");
      }

      const keyword = await ctx.db.get(args.keywordId);
      if (!keyword) {
        throw new Error("Keyword not found");
      }

      const serpResults = await ctx.db
        .query("keywordSerpResults")
        .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
        .collect();

      const match = serpResults.find(
        (r) => r.domain === competitor.competitorDomain || r.url.includes(competitor.competitorDomain)
      );

      if (match) {
        url = match.url;
        position = match.position;
      }
    }

    if (!url) {
      return { success: false, error: "No SERP data found for this competitor and keyword. Run a SERP check for this keyword first.", url: null };
    }

    // Schedule the internal action
    await ctx.scheduler.runAfter(0, internal.competitorAnalysis.analyzeCompetitorPage, {
      competitorId: args.competitorId,
      keywordId: args.keywordId,
      url,
      position,
    });

    return { success: true, url };
  },
});

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Look up a recent page analysis by URL (within 7 days).
 * Used as a cache to avoid redundant DataForSEO API calls.
 */
export const getCachedPageAnalysis = internalQuery({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - CACHE_TTL_MS;
    const entry = await ctx.db
      .query("competitorPageAnalysis")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .order("desc")
      .first();

    if (!entry || entry.fetchedAt < cutoff) return null;
    return entry;
  },
});
