import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

/**
 * Get the latest on-site scan for a domain
 */
export const getLatestScan = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(1);

    return scans[0] || null;
  },
});

/**
 * Get latest scan for a domain (internal — callable from actions)
 */
export const getLatestScanInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(1);
    return scans[0] || null;
  },
});

/**
 * Get scan by ID (internal)
 */
export const getScanById = internalQuery({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scanId);
  },
});

/**
 * Get active (running) scan for a domain
 */
export const getActiveScan = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const scan = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "crawling")
      )
      .first();

    if (scan) return scan;

    return await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "queued")
      )
      .first();
  },
});

/**
 * Get scan history for a domain
 */
export const getScanHistory = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scans = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(args.limit || 10);

    return scans;
  },
});

/**
 * Get the latest analysis summary for a domain
 */
export const getLatestAnalysis = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    return analysis || null;
  },
});

/**
 * Get live count of pages for a scan (reactive — updates as pages are stored)
 */
export const getScanPagesCount = query({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    return pages.length;
  },
});

/**
 * Get pages list with pagination and filtering
 */
export const getPagesList = query({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    hasIssues: v.optional(v.boolean()),
    searchQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pages = args.scanId
      ? await ctx.db
          .query("domainOnsitePages")
          .withIndex("by_scan", (q) => q.eq("scanId", args.scanId!))
          .collect()
      : await ctx.db
          .query("domainOnsitePages")
          .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
          .collect();

    let filteredPages = pages;

    if (args.hasIssues !== undefined) {
      if (args.hasIssues) {
        filteredPages = filteredPages.filter((p) => p.issueCount > 0);
      } else {
        filteredPages = filteredPages.filter((p) => p.issueCount === 0);
      }
    }

    if (args.searchQuery) {
      const q = args.searchQuery.toLowerCase();
      filteredPages = filteredPages.filter(
        (p) =>
          p.url.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q)
      );
    }

    // Scored pages first (by composite desc), fallback to onpageScore, then by URL
    filteredPages.sort((a, b) => {
      const aScore = a.pageScore?.composite ?? a.onpageScore ?? -1;
      const bScore = b.pageScore?.composite ?? b.onpageScore ?? -1;
      const aHas = aScore >= 0 ? 1 : 0;
      const bHas = bScore >= 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas && bHas) return bScore - aScore;
      return a.url.localeCompare(b.url);
    });

    const offset = args.offset || 0;
    const limit = args.limit || 25;
    const paginatedPages = filteredPages.slice(offset, offset + limit);

    return {
      pages: paginatedPages,
      total: filteredPages.length,
      hasMore: offset + limit < filteredPages.length,
    };
  },
});

/**
 * Check if on-site data is stale (older than 7 days)
 */
export const isOnsiteDataStale = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    if (!analysis) return true;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return analysis.fetchedAt < sevenDaysAgo;
  },
});

/**
 * Get sitemap data for a domain
 */
export const getSitemapData = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const data = await ctx.db
      .query("domainSitemapData")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    return data || null;
  },
});

/**
 * Get robots.txt data for a domain
 */
export const getRobotsData = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const data = await ctx.db
      .query("domainRobotsData")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    return data || null;
  },
});

/**
 * Get issues grouped by category for current scan
 */
export const getIssuesByCategory = query({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
  },
  handler: async (ctx, args) => {
    const issues = await ctx.db
      .query("onSiteIssues")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const filteredIssues = args.scanId
      ? issues.filter((i) => i.scanId === args.scanId)
      : issues;

    const grouped: Record<
      string,
      {
        category: string;
        critical: number;
        warnings: number;
        recommendations: number;
        total: number;
      }
    > = {};

    for (const issue of filteredIssues) {
      if (!grouped[issue.category]) {
        grouped[issue.category] = {
          category: issue.category,
          critical: 0,
          warnings: 0,
          recommendations: 0,
          total: 0,
        };
      }

      grouped[issue.category].total++;

      if (issue.severity === "critical") {
        grouped[issue.category].critical++;
      } else if (issue.severity === "warning") {
        grouped[issue.category].warnings++;
      } else {
        grouped[issue.category].recommendations++;
      }
    }

    return Object.values(grouped);
  },
});

/**
 * Get critical issues only
 */
export const getCriticalIssues = query({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const issues = await ctx.db
      .query("onSiteIssues")
      .withIndex("by_severity", (q) => q.eq("severity", "critical"))
      .collect();

    const domainIssues = issues.filter((i) => i.domainId === args.domainId);

    const filteredIssues = args.scanId
      ? domainIssues.filter((i) => i.scanId === args.scanId)
      : domainIssues;

    filteredIssues.sort((a, b) => b.affectedPages - a.affectedPages);

    return filteredIssues.slice(0, args.limit || 10);
  },
});

/**
 * Get pages with a specific failed check.
 * For SEO Audit pages, checks the raw `checks` array for exact check type match.
 * Falls back to searching the issues array for legacy DataForSEO pages.
 */
export const getPagesWithFailedCheck = query({
  args: {
    scanId: v.id("onSiteScans"),
    checkCategory: v.string(),
  },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();

    return pages.filter((page) => {
      // SEO Audit pages store raw check results in `checks`
      const checks = page.checks as any[] | undefined;
      if (Array.isArray(checks)) {
        return checks.some(
          (c: any) => c.check === args.checkCategory && !c.passed
        );
      }
      // Legacy fallback: search issues array
      return page.issues.some(
        (issue) =>
          issue.category === args.checkCategory ||
          issue.message
            .toLowerCase()
            .includes(args.checkCategory.toLowerCase())
      );
    });
  },
});

// ============================================================================
// Internal queries for post-crawl analytics pipeline
// ============================================================================

/**
 * Get body texts from crawl-enriched pages (for word frequency analysis).
 * Returns minimal data to avoid Convex size limits.
 */
export const getPageBodyTexts = internalQuery({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    // Word frequency needs body text, but domainOnsitePages doesn't store it.
    // The crawl results are passed transiently through enrichOnsitePagesFromCrawl.
    // For now, return empty — word frequency will use crawl job download data directly.
    // This query exists as a hook for future optimization.
    return [] as { bodyText: string }[];
  },
});

/**
 * Get sitemap data (internal, for robots test in analytics pipeline)
 */
export const getSitemapDataInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainSitemapData")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

/**
 * Get average stats from enriched pages (post-crawl)
 */
export const getEnrichedPageStats = internalQuery({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();

    if (pages.length === 0) return null;

    let totalWordCount = 0;
    let wordCountPages = 0;
    let totalLoadTime = 0;
    let loadTimePages = 0;
    let totalPerformance = 0;
    let performancePages = 0;

    for (const page of pages) {
      if (page.wordCount > 0) {
        totalWordCount += page.wordCount;
        wordCountPages++;
      }
      if (page.loadTime && page.loadTime > 0) {
        totalLoadTime += page.loadTime;
        loadTimePages++;
      }
      if (page.lighthouseScores?.performance != null) {
        totalPerformance += page.lighthouseScores.performance;
        performancePages++;
      }
    }

    return {
      avgWordCount: wordCountPages > 0 ? Math.round(totalWordCount / wordCountPages) : undefined,
      avgLoadTime: loadTimePages > 0 ? Math.round((totalLoadTime / loadTimePages) * 100) / 100 : undefined,
      avgPerformance: performancePages > 0 ? Math.round(totalPerformance / performancePages) : undefined,
    };
  },
});

export const getPageUrls = internalQuery({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    return pages.map((p) => ({ _id: p._id, url: p.url }));
  },
});

export const getPagesByStatusRange = internalQuery({
  args: {
    scanId: v.id("onSiteScans"),
    minStatus: v.number(),
    maxStatus: v.number(),
  },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    return pages
      .filter((p) => p.statusCode >= args.minStatus && p.statusCode <= args.maxStatus)
      .map((p) => ({ url: p.url, statusCode: p.statusCode }));
  },
});

export const getImageStatsFromPages = internalQuery({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    let totalImages = 0;
    let missingAlt = 0;
    const images: Array<{ pageUrl: string; imageUrl: string; alt: string; missingAlt: boolean }> = [];
    for (const page of pages) {
      totalImages += page.imagesCount || 0;
      missingAlt += page.imagesMissingAlt || 0;
      // Collect individual image records from per-page imageAlts (up to 500 total)
      if (page.imageAlts && images.length < 500) {
        for (const img of page.imageAlts) {
          if (images.length >= 500) break;
          images.push({
            pageUrl: page.url,
            imageUrl: img.src,
            alt: img.alt || "",
            missingAlt: !img.hasAlt,
          });
        }
      }
    }
    return { totalImages, missingAlt, images };
  },
});

// ============================================================================
// Crawl Analytics Queries (public)
// ============================================================================

/**
 * Get link analysis for a domain
 */
export const getLinkAnalysis = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawlLinkAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

/**
 * Get redirect analysis for a domain
 */
export const getRedirectAnalysis = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawlRedirectAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

/**
 * Get image analysis for a domain
 */
export const getImageAnalysis = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawlImageAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

/**
 * Get word frequency data for a domain
 */
export const getWordFrequency = query({
  args: {
    domainId: v.id("domains"),
    phraseLength: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("crawlWordFrequency")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .collect();

    if (args.phraseLength !== undefined) {
      return results.filter((r) => r.phraseLength === args.phraseLength);
    }
    return results;
  },
});

/**
 * Get robots test results for a domain
 */
export const getRobotsTestResults = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawlRobotsTestResults")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

/**
 * Check which crawl analytics data is available for a domain
 */
export const getCrawlAnalyticsAvailability = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const [links, redirects, images, wordFreq, robotsTest] = await Promise.all([
      ctx.db.query("crawlLinkAnalysis").withIndex("by_domain", (q) => q.eq("domainId", args.domainId)).first(),
      ctx.db.query("crawlRedirectAnalysis").withIndex("by_domain", (q) => q.eq("domainId", args.domainId)).first(),
      ctx.db.query("crawlImageAnalysis").withIndex("by_domain", (q) => q.eq("domainId", args.domainId)).first(),
      ctx.db.query("crawlWordFrequency").withIndex("by_domain", (q) => q.eq("domainId", args.domainId)).first(),
      ctx.db.query("crawlRobotsTestResults").withIndex("by_domain", (q) => q.eq("domainId", args.domainId)).first(),
    ]);

    // Show PageSpeed tab when pages exist (user can trigger analysis even without data)
    const anyPage = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    return {
      hasLinks: !!links,
      hasRedirects: !!redirects,
      hasImages: !!images,
      hasWordFreq: !!wordFreq,
      hasRobotsTest: !!robotsTest,
      hasPageSpeed: !!anyPage,
    };
  },
});

/**
 * Get PSI job status for the latest scan (for progress tracking in UI)
 */
export const getPsiJobStatus = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const scan = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
    if (!scan) return null;
    if (!scan.psiStatus) return null;
    return {
      psiJobId: scan.psiJobId ?? null,
      psiStatus: scan.psiStatus,
      psiProgress: scan.psiProgress ?? null,
      psiStartedAt: scan.psiStartedAt ?? null,
      psiError: scan.psiError ?? null,
    };
  },
});

/**
 * Get PageSpeed Insights data: average Lighthouse scores and per-page breakdown
 */
export const getPageSpeedData = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const psiPages = pages.filter((p) => p.lighthouseScores);
    if (psiPages.length === 0) return null;

    // Compute averages
    let totalPerf = 0, totalAcc = 0, totalBp = 0, totalSeo = 0;
    let totalLcp = 0, totalCls = 0, totalFid = 0;
    let cwvCount = 0;

    for (const page of psiPages) {
      const lh = page.lighthouseScores!;
      totalPerf += lh.performance;
      totalAcc += lh.accessibility;
      totalBp += lh.bestPractices;
      totalSeo += lh.seo;
      if (page.coreWebVitals) {
        totalLcp += page.coreWebVitals.largestContentfulPaint;
        totalCls += page.coreWebVitals.cumulativeLayoutShift || 0;
        totalFid += page.coreWebVitals.firstInputDelay;
        cwvCount++;
      }
    }

    const n = psiPages.length;
    const averages = {
      performance: Math.round(totalPerf / n),
      accessibility: Math.round(totalAcc / n),
      bestPractices: Math.round(totalBp / n),
      seo: Math.round(totalSeo / n),
    };

    const avgCwv = cwvCount > 0 ? {
      lcp: +(totalLcp / cwvCount).toFixed(2),
      cls: +(totalCls / cwvCount).toFixed(3),
      fid: Math.round(totalFid / cwvCount),
    } : null;

    // Per-page breakdown (sorted by performance ascending = worst first)
    const perPage = psiPages
      .map((p) => ({
        url: p.url,
        performance: p.lighthouseScores!.performance,
        accessibility: p.lighthouseScores!.accessibility,
        bestPractices: p.lighthouseScores!.bestPractices,
        seo: p.lighthouseScores!.seo,
        lcp: p.coreWebVitals?.largestContentfulPaint,
        cls: p.coreWebVitals?.cumulativeLayoutShift,
        fid: p.coreWebVitals?.firstInputDelay,
        tti: p.coreWebVitals?.timeToInteractive,
        domComplete: p.coreWebVitals?.domComplete,
      }))
      .sort((a, b) => a.performance - b.performance);

    return { averages, avgCwv, perPage, totalPages: n };
  },
});

/**
 * Get Full Audit sections, issues, recommendations, and grade
 */
export const getFullAuditSections = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    if (!analysis) return null;

    return {
      grade: analysis.grade,
      sections: analysis.sections,
      allIssues: analysis.allIssues,
      recommendations: analysis.auditRecommendations,
      pagesAnalyzed: analysis.pagesAnalyzed,
      healthScore: analysis.healthScore,
    };
  },
});
