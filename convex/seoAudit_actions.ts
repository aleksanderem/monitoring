import { v } from "convex/values";
import { mutation, action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// SEO Audit API check types → severity, category, and analysis field mapping
const CHECK_CONFIG: Record<
  string,
  {
    severity: "critical" | "warning" | "recommendation";
    category: "meta_tags" | "headings" | "images" | "links" | "performance" | "mobile" | "indexability" | "security" | "content";
    analysisField?: string;
    title: string;
    description: string;
  }
> = {
  // Critical
  HTTPS_CHECK: {
    severity: "critical",
    category: "security",
    analysisField: "missingHttps",
    title: "Missing HTTPS",
    description: "Page is not served over HTTPS, posing security risks.",
  },
  H1_FOUND: {
    severity: "critical",
    category: "headings",
    analysisField: "missingH1",
    title: "Missing H1 Tag",
    description: "No H1 heading tag found on the page.",
  },
  CANONICAL_FOUND: {
    severity: "critical",
    category: "indexability",
    analysisField: "missingCanonical",
    title: "Missing Canonical Tag",
    description: "No canonical URL tag found, risking duplicate content issues.",
  },
  // Warning
  TITLE_REPETITION: {
    severity: "warning",
    category: "meta_tags",
    title: "Duplicate Title Tags",
    description: "Multiple pages share the same title tag.",
  },
  META_DESCRIPTION_REPETITION: {
    severity: "warning",
    category: "meta_tags",
    title: "Duplicate Meta Descriptions",
    description: "Multiple pages share the same meta description.",
  },
  ROBOTS_META_FOUND: {
    severity: "warning",
    category: "indexability",
    analysisField: "missingRobotsMeta",
    title: "Missing Robots Meta Tag",
    description: "No robots meta tag found on the page.",
  },
  IMAGE_ALT_FOUND: {
    severity: "warning",
    category: "images",
    title: "Missing Image Alt Text",
    description: "Images on the page are missing alt attributes.",
  },
  MOBILE_FRIENDLY: {
    severity: "warning",
    category: "mobile",
    analysisField: "notMobileFriendly",
    title: "Not Mobile Friendly",
    description: "Page is not optimized for mobile devices.",
  },
  // Recommendation
  TEXT_TO_CODE_RATIO: {
    severity: "recommendation",
    category: "content",
    analysisField: "lowTextToCodeRatio",
    title: "Low Text-to-Code Ratio",
    description: "The text-to-code ratio is below the recommended threshold.",
  },
  DOM_SIZE: {
    severity: "recommendation",
    category: "performance",
    analysisField: "largeDomSize",
    title: "Large DOM Size",
    description: "The DOM size exceeds the recommended limit.",
  },
  ELEMENTS_SIMILARITY: {
    severity: "recommendation",
    category: "content",
    analysisField: "highElementSimilarity",
    title: "High Element Similarity",
    description: "Multiple elements on the page have very similar content.",
  },
  ELEMENTS_COUNT: {
    severity: "recommendation",
    category: "performance",
    analysisField: "tooManyElements",
    title: "Too Many DOM Elements",
    description: "The page has an excessive number of DOM elements.",
  },
  STRUCTURED_DATA_FOUND: {
    severity: "recommendation",
    category: "content",
    analysisField: "missingStructuredData",
    title: "Missing Structured Data",
    description: "No structured data (Schema.org) found on the page.",
  },
};

// ============================================================================
// Public Mutations
// ============================================================================

/**
 * Trigger a full-site SEO audit scan.
 * Creates a scan record and schedules background processing.
 */
export const triggerSeoAuditScan = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const existingScan = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "crawling"),
          q.eq(q.field("status"), "processing")
        )
      )
      .first();

    if (existingScan) {
      throw new Error("A scan is already in progress for this domain");
    }

    const scanId = await ctx.db.insert("onSiteScans", {
      domainId: args.domainId,
      status: "queued",
      startedAt: Date.now(),
      source: "seo_audit",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.seoAudit_actions.processSeoAuditInternal,
      { scanId }
    );

    // Notify: scan started
    await ctx.scheduler.runAfter(0, internal.notifications.createJobNotification, {
      domainId: args.domainId,
      type: "job_started",
      title: "Full site scan started",
      message: "Crawling and analyzing all pages",
      jobType: "on_site_scan",
    });

    return scanId;
  },
});

/**
 * Create a scan record for "Scan Selected Pages" (no background processing).
 * The frontend calls scanSelectedUrlsV2 separately with the returned scanId.
 */
export const triggerInstantPagesScan = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const existingScan = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "crawling"),
          q.eq(q.field("status"), "processing")
        )
      )
      .first();

    if (existingScan) {
      throw new Error("A scan is already in progress for this domain");
    }

    const scanId = await ctx.db.insert("onSiteScans", {
      domainId: args.domainId,
      status: "queued",
      startedAt: Date.now(),
      source: "seo_audit",
    });

    return scanId;
  },
});

/**
 * Cancel an in-progress scan.
 */
export const cancelSeoAuditScan = mutation({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);
    if (!scan) throw new Error("Scan not found");

    if (!["queued", "crawling", "processing"].includes(scan.status)) {
      throw new Error(`Cannot cancel scan with status: ${scan.status}`);
    }

    await ctx.db.patch(args.scanId, {
      status: "failed",
      error: "Scan cancelled by user",
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================================
// Background Processing (Full Site Scan)
// ============================================================================

/**
 * Main background worker for full-site SEO audit.
 * Steps: fetch sitemap/robots (Advertools) → start async SEO audit → schedule poll
 */
export const processSeoAuditInternal = internalAction({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    console.log(`[SEO_AUDIT] Starting for scanId=${args.scanId}`);

    const scan = await ctx.runQuery(
      internal.seoAudit_queries.getScanById,
      { scanId: args.scanId }
    );
    if (!scan) {
      console.error("[SEO_AUDIT] Scan not found:", args.scanId);
      return;
    }

    const domain: any = await ctx.runQuery(
      internal.domains.getDomainInternal,
      { domainId: scan.domainId }
    );
    if (!domain) {
      console.error("[SEO_AUDIT] Domain not found:", scan.domainId);
      await ctx.runMutation(internal.seoAudit_actions.failScan, {
        scanId: args.scanId,
        error: "Domain not found",
      });
      return;
    }

    const baseUrl = process.env.SEO_API_BASE_URL;

    // Mock mode when no API URL configured
    if (!baseUrl) {
      console.log("[SEO_AUDIT] DEV MODE: Mock scan for", domain.domain);
      await ctx.runMutation(internal.seoAudit_actions.updateScanStatus, {
        scanId: args.scanId,
        status: "processing",
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await ctx.runMutation(
        internal.seoAudit_actions.completeMockSeoAuditScan,
        {
          scanId: args.scanId,
          domainId: scan.domainId,
          domainName: domain.domain,
        }
      );
      return;
    }

    try {
      await ctx.runMutation(internal.seoAudit_actions.updateScanStatus, {
        scanId: args.scanId,
        status: "crawling",
      });

      const domainUrl = `https://${domain.domain}`;

      // Step A: Fetch Sitemap + Robots in parallel via Advertools
      console.log("[SEO_AUDIT] Fetching sitemap and robots.txt...");
      const [sitemapResult, robotsResult] = await Promise.allSettled([
        fetch(`${baseUrl}/advertools/sitemap/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sitemap_url: `${domainUrl}/sitemap.xml`,
            recursive: true,
          }),
        }).then((r) => r.json()),
        fetch(`${baseUrl}/advertools/robots/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            robotstxt_url: `${domainUrl}/robots.txt`,
          }),
        }).then((r) => r.json()),
      ]);

      // Store sitemap data
      if (
        sitemapResult.status === "fulfilled" &&
        sitemapResult.value?.total_urls !== undefined
      ) {
        const sData = sitemapResult.value;
        const urls = (sData.data || [])
          .map((row: any) => row.loc || row.url)
          .filter(Boolean);
        await ctx.runMutation(internal.seoAudit_actions.storeSitemapData, {
          domainId: scan.domainId,
          scanId: args.scanId,
          sitemapUrl: `${domainUrl}/sitemap.xml`,
          totalUrls: sData.total_urls || urls.length,
          urls: urls.slice(0, 500),
        });
        console.log(`[SEO_AUDIT] Stored sitemap: ${sData.total_urls} URLs`);
      } else {
        console.log("[SEO_AUDIT] Sitemap fetch failed or empty");
      }

      // Store robots data
      if (robotsResult.status === "fulfilled" && robotsResult.value) {
        await ctx.runMutation(internal.seoAudit_actions.storeRobotsData, {
          domainId: scan.domainId,
          scanId: args.scanId,
          robotsUrl: `${domainUrl}/robots.txt`,
          directives: robotsResult.value,
        });
        console.log("[SEO_AUDIT] Stored robots.txt data");
      }

      // Step B: Start async Full Audit (audits ALL pages on the site)
      console.log("[SEO_AUDIT] Starting Full Audit async...");
      const auditResponse = await fetch(`${baseUrl}/advertools/audit/full/async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: domainUrl,
          use_sitemap: true,
          max_pages: 100,
          crawl_delay: 0.5,
        }),
      });

      if (!auditResponse.ok) {
        throw new Error(`SEO Audit API error: ${auditResponse.status}`);
      }

      const auditJob = await auditResponse.json();
      const jobId = auditJob.job_id;
      if (!jobId) throw new Error("No job_id returned from SEO Audit API");

      console.log(`[SEO_AUDIT] Got job_id: ${jobId}`);

      await ctx.runMutation(internal.seoAudit_actions.updateScanJobId, {
        scanId: args.scanId,
        jobId,
      });

      // Set SEO Audit sub-status
      await ctx.runMutation(internal.seoAudit_actions.updateAuditSubStatus, {
        scanId: args.scanId,
        seoAuditStatus: "running",
      });

      // Step C: Schedule SEO Audit polling (30s interval)
      await ctx.scheduler.runAfter(
        30000,
        internal.seoAudit_actions.pollSeoAuditStatus,
        { scanId: args.scanId, jobId, domainId: scan.domainId }
      );

      // Step D: Start Advertools crawl in parallel
      try {
        console.log("[SEO_AUDIT] Starting Advertools crawl...");
        const crawlResponse = await fetch(`${baseUrl}/advertools/crawl/async`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url_list: [domainUrl],
            follow_links: true,
            allowed_domains: [domain.domain],
            custom_settings: {
              DEPTH_LIMIT: 2,
              CLOSESPIDER_PAGECOUNT: 100,
              CONCURRENT_REQUESTS_PER_DOMAIN: 2,
              DOWNLOAD_DELAY: 1,
            },
          }),
        });

        if (crawlResponse.ok) {
          const crawlJob = await crawlResponse.json();
          const crawlJobId = crawlJob.job_id;
          console.log(`[SEO_AUDIT] Crawl job started: ${crawlJobId}`);

          await ctx.runMutation(internal.seoAudit_actions.updateScanCrawlJobId, {
            scanId: args.scanId,
            crawlJobId,
          });
          await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
            scanId: args.scanId,
            advertoolsCrawlStatus: "running",
          });

          // Schedule crawl polling (20s interval)
          await ctx.scheduler.runAfter(
            20000,
            internal.seoAudit_actions.pollAdvertoolsCrawlStatus,
            { scanId: args.scanId, jobId: crawlJobId, domainId: scan.domainId, pollCount: 0 }
          );
        } else {
          console.error("[SEO_AUDIT] Crawl start failed:", crawlResponse.status);
          await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
            scanId: args.scanId,
            advertoolsCrawlStatus: "failed",
          });
        }
      } catch (crawlError) {
        console.error("[SEO_AUDIT] Crawl start error:", crawlError);
        await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
          scanId: args.scanId,
          advertoolsCrawlStatus: "failed",
        });
      }
    } catch (error) {
      console.error("[SEO_AUDIT] Error:", error);
      await ctx.runMutation(internal.seoAudit_actions.failScan, {
        scanId: args.scanId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

/**
 * Poll the SEO Audit async job for completion.
 */
export const pollSeoAuditStatus = internalAction({
  args: {
    scanId: v.id("onSiteScans"),
    jobId: v.string(),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    console.log(`[POLL] Checking job: ${args.jobId}`);

    const scan = await ctx.runQuery(
      internal.seoAudit_queries.getScanById,
      { scanId: args.scanId }
    );
    if (!scan || scan.status === "failed") {
      console.log("[POLL] Scan cancelled or not found - stopping");
      return;
    }

    const baseUrl = process.env.SEO_API_BASE_URL;
    if (!baseUrl) return;

    try {
      // Unified job system: GET /advertools/job/{job_id}
      const response = await fetch(
        `${baseUrl}/advertools/job/${args.jobId}`
      );
      if (!response.ok) {
        throw new Error(`Poll API error: ${response.status}`);
      }

      const jobData = await response.json();
      const progress = jobData.progress || {};
      console.log(`[POLL] Job status: ${jobData.status}, progress: ${progress.current ?? "?"}/${progress.total ?? "?"} — ${progress.message || ""}`);

      if (jobData.status === "completed") {
        console.log("[POLL] Full Audit completed! Fetching results...");
        await ctx.runMutation(internal.seoAudit_actions.updateScanStatus, {
          scanId: args.scanId,
          status: "processing",
        });

        // Results are at a separate endpoint: GET /advertools/job/{job_id}/result
        const resultResponse = await fetch(
          `${baseUrl}/advertools/job/${args.jobId}/result`
        );
        if (!resultResponse.ok) {
          throw new Error(`Result fetch error: ${resultResponse.status}`);
        }
        const auditResult = await resultResponse.json();

        await ctx.runMutation(internal.seoAudit_actions.storeFullAuditResults, {
          scanId: args.scanId,
          domainId: args.domainId,
          result: auditResult,
        });
        return;
      }

      if (jobData.status === "failed" || jobData.status === "error") {
        await ctx.runMutation(internal.seoAudit_actions.failScan, {
          scanId: args.scanId,
          error: jobData.error || "Full audit job failed",
        });
        return;
      }

      // Update progress from unified job progress field
      if (progress.current !== undefined && progress.current !== null) {
        await ctx.runMutation(internal.seoAudit_actions.updateScanProgress, {
          scanId: args.scanId,
          pagesScanned: progress.current,
          totalPagesToScan: progress.total || undefined,
        });
      }

      // Poll again in 15s (jobs have good progress tracking now)
      await ctx.scheduler.runAfter(
        15000,
        internal.seoAudit_actions.pollSeoAuditStatus,
        { scanId: args.scanId, jobId: args.jobId, domainId: args.domainId }
      );
    } catch (error) {
      console.error("[POLL] Error:", error);

      const scanCheck = await ctx.runQuery(
        internal.seoAudit_queries.getScanById,
        { scanId: args.scanId }
      );
      if (!scanCheck) {
        console.log("[POLL] Scan gone - stopping");
        return;
      }

      // Retry in 15s
      await ctx.scheduler.runAfter(
        15000,
        internal.seoAudit_actions.pollSeoAuditStatus,
        { scanId: args.scanId, jobId: args.jobId, domainId: args.domainId }
      );
    }
  },
});

// ============================================================================
// Result Storage
// ============================================================================

/**
 * Store results from a full-site async SEO audit.
 * Creates pages, analysis summary, and site-wide issue records.
 */
export const storeSeoAuditResults = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    results: v.any(),
  },
  handler: async (ctx, args) => {
    console.log("[STORE] Processing SEO audit results");

    // Parse results — handle multiple API response formats:
    // 1. Array of URL audits (direct)
    // 2. {results: [...]} wrapper
    // 3. {result: {url, score, results: [...]}} — single audit from async job
    // 4. {result: [...]} — array from async job
    let urlResults: any[];
    if (Array.isArray(args.results)) {
      urlResults = args.results;
    } else if (Array.isArray(args.results?.results)) {
      urlResults = args.results.results;
    } else if (Array.isArray(args.results?.result)) {
      urlResults = args.results.result;
    } else if (args.results?.result && typeof args.results.result === "object" && args.results.result.url) {
      // Single audit result object — wrap in array
      urlResults = [args.results.result];
    } else if (args.results?.url) {
      // Direct audit result
      urlResults = [args.results];
    } else {
      urlResults = [args.results];
    }

    // Debug: log first result structure
    if (urlResults.length > 0) {
      const first = urlResults[0];
      console.log(`[STORE] First result keys: ${Object.keys(first || {}).join(", ")}`);
      console.log(`[STORE] First result url: ${first?.url}, score: ${first?.score}, checks: ${(first?.results || []).length}`);
    }

    console.log(`[STORE] Processing ${urlResults.length} URL results`);

    // Load existing pages (may have been created by crawl enrichment)
    const existingPages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    const normalizeUrl = (url: string) => url.replace(/\/+$/, "");
    const existingPagesByUrl = new Map(existingPages.map((p) => [normalizeUrl(p.url), p]));
    console.log(`[STORE] Found ${existingPages.length} existing pages from crawl`);

    let totalScore = 0;
    let criticalIssues = 0;
    let warningCount = 0;
    let recommendationCount = 0;
    const analysisIssues: Record<string, number> = {};
    const checkFailureCounts: Record<string, number> = {};

    for (const urlResult of urlResults) {
      if (!urlResult?.url) continue;

      const score = urlResult.score ?? 0;
      totalScore += score;

      const issues: Array<{
        type: "critical" | "warning" | "recommendation";
        category: string;
        message: string;
      }> = [];

      for (const check of urlResult.results || []) {
        if (check.passed) continue;
        const config = CHECK_CONFIG[check.check];
        if (!config) continue;

        issues.push({
          type: config.severity,
          category: config.category,
          message: typeof check.result === "string" && check.result
            ? check.result
            : `Failed: ${check.check}`,
        });

        if (config.severity === "critical") criticalIssues++;
        else if (config.severity === "warning") warningCount++;
        else recommendationCount++;

        if (config.analysisField) {
          analysisIssues[config.analysisField] =
            (analysisIssues[config.analysisField] || 0) + 1;
        }
        checkFailureCounts[check.check] =
          (checkFailureCounts[check.check] || 0) + 1;
      }

      // Upsert: if crawl enrichment already created this page, patch it
      const normalizedUrl = normalizeUrl(urlResult.url);
      const existingPage = existingPagesByUrl.get(normalizedUrl);
      console.log(`[STORE] URL: ${urlResult.url} → normalized: ${normalizedUrl}, match: ${!!existingPage}, issues: ${issues.length}`);
      if (existingPage) {
        await ctx.db.patch(existingPage._id, {
          onpageScore: Math.round(score),
          checks: urlResult.results || [],
          issueCount: issues.length,
          issues,
        });
      } else {
        await ctx.db.insert("domainOnsitePages", {
          domainId: args.domainId,
          scanId: args.scanId,
          url: urlResult.url,
          statusCode: 200,
          wordCount: 0,
          onpageScore: Math.round(score),
          checks: urlResult.results || [],
          issueCount: issues.length,
          issues,
        });
      }
    }

    const totalPages = urlResults.filter((r) => r?.url).length;
    const healthScore =
      totalPages > 0 ? Math.round(totalScore / totalPages) : 0;

    console.log(
      `[STORE] Analysis: healthScore=${healthScore}, pages=${totalPages}`
    );

    // Create analysis summary
    const analysisId = await ctx.db.insert("domainOnsiteAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      healthScore,
      totalPages,
      criticalIssues,
      warnings: warningCount,
      recommendations: recommendationCount,
      issues: {
        // Legacy DataForSEO fields (zeroed for SEO Audit scans)
        missingTitles: 0,
        missingMetaDescriptions: 0,
        duplicateContent: 0,
        brokenLinks: 0,
        slowPages: 0,
        suboptimalTitles: 0,
        thinContent: 0,
        missingH1: analysisIssues.missingH1 || 0,
        largeImages: 0,
        missingAltText: 0,
        // SEO Audit API fields
        missingHttps: analysisIssues.missingHttps || 0,
        missingCanonical: analysisIssues.missingCanonical || 0,
        missingRobotsMeta: analysisIssues.missingRobotsMeta || 0,
        notMobileFriendly: analysisIssues.notMobileFriendly || 0,
        missingStructuredData: analysisIssues.missingStructuredData || 0,
        largeDomSize: analysisIssues.largeDomSize || 0,
        tooManyElements: analysisIssues.tooManyElements || 0,
        highElementSimilarity: analysisIssues.highElementSimilarity || 0,
        lowTextToCodeRatio: analysisIssues.lowTextToCodeRatio || 0,
      },
      fetchedAt: Date.now(),
    });

    // Link pages to analysis
    const pagesToUpdate = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    for (const page of pagesToUpdate) {
      await ctx.db.patch(page._id, { analysisId });
    }

    // Create site-wide onSiteIssues records
    for (const [checkType, count] of Object.entries(checkFailureCounts)) {
      const config = CHECK_CONFIG[checkType];
      if (!config || count === 0) continue;

      await ctx.db.insert("onSiteIssues", {
        scanId: args.scanId,
        domainId: args.domainId,
        severity: config.severity,
        category: config.category,
        title: config.title,
        description: config.description,
        affectedPages: count,
        detectedAt: Date.now(),
      });
    }

    // Update scan summary + pagesScanned (don't set status yet — dual-job checker handles that)
    await ctx.db.patch(args.scanId, {
      seoAuditStatus: "completed",
      pagesScanned: totalPages,
      summary: {
        totalPages,
        totalIssues: criticalIssues + warningCount + recommendationCount,
      },
    });

    // Check if both sub-jobs are done. If crawl never started (no advertoolsCrawlStatus),
    // checkDualJobCompletion treats it as "skipped" and will complete the scan.
    const updatedScan = await ctx.db.get(args.scanId);
    const crawlStatus = updatedScan?.advertoolsCrawlStatus;
    if (!crawlStatus || ["completed", "failed", "skipped"].includes(crawlStatus)) {
      // Crawl already done or never started — complete now
      await ctx.db.patch(args.scanId, {
        status: "complete",
        completedAt: Date.now(),
      });
      // If crawl completed, schedule analytics
      if (crawlStatus === "completed") {
        await ctx.scheduler.runAfter(
          0,
          internal.seoAudit_actions.runPostCrawlAnalytics,
          { scanId: args.scanId, domainId: args.domainId }
        );
      }
    }
    // Otherwise, crawl is still running — checkDualJobCompletion will be called
    // by pollAdvertoolsCrawlStatus when crawl finishes.

    console.log("[STORE] SEO audit results stored, seoAuditStatus=completed");
  },
});

// Priority → severity mapping for Full Audit API
const PRIORITY_TO_SEVERITY: Record<string, "critical" | "warning" | "recommendation"> = {
  critical: "critical",
  important: "warning",
  minor: "recommendation",
};

// Section → category mapping for Full Audit API
const SECTION_TO_CATEGORY: Record<string, "meta_tags" | "headings" | "images" | "links" | "performance" | "mobile" | "indexability" | "security" | "content"> = {
  technical: "performance",
  on_page: "meta_tags",
  content: "content",
  links: "links",
  images: "images",
  structured_data: "content",
};

/**
 * Store results from the Full Audit API.
 * Handles two result formats:
 * 1. New sections-based: {summary, sections, all_issues, recommendations}
 * 2. Legacy per-URL checks: {url, score, total_checks, results: [{check, passed, result}]}
 *    or array of such objects
 */
export const storeFullAuditResults = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const result = args.result;

    // Detect format: if result has "summary" with "grade", it's the new sections format.
    // If it has "url" + "results" (array of checks), or "total_checks", it's legacy per-URL.
    const isNewFormat = result?.summary?.grade !== undefined || result?.sections !== undefined;
    const isLegacyArray = Array.isArray(result);
    const isLegacySingle = !isLegacyArray && (result?.total_checks !== undefined || result?.results !== undefined);

    if (isLegacyArray || isLegacySingle) {
      // Delegate to existing storeSeoAuditResults for legacy check-based format
      console.log("[STORE_FULL] Detected legacy per-URL check format, delegating to storeSeoAuditResults");
      // Wrap in the format storeSeoAuditResults expects
      const wrappedResults = isLegacyArray ? result : [result];
      await ctx.runMutation(internal.seoAudit_actions.storeSeoAuditResults, {
        scanId: args.scanId,
        domainId: args.domainId,
        results: wrappedResults,
      });
      return;
    }

    // New sections-based format
    console.log("[STORE_FULL] Processing Full Audit results (sections format)");
    console.log(`[STORE_FULL] Result keys: ${Object.keys(result || {}).join(", ")}`);

    const summary = result?.summary || {};
    const sections = result?.sections || {};
    const allIssues = result?.all_issues || [];
    const recommendations = result?.recommendations || [];

    const healthScore = summary.score ?? 0;
    const grade = summary.grade || "?";
    const pagesAnalyzed = summary.pages_analyzed ?? 0;
    const criticalIssues = summary.critical_issues ?? 0;
    const importantIssues = summary.important_issues ?? 0;
    const minorIssues = summary.minor_issues ?? 0;

    console.log(`[STORE_FULL] Score=${healthScore}, Grade=${grade}, Pages=${pagesAnalyzed}, Issues=${allIssues.length}`);

    // Build legacy issues object from all_issues
    const legacyIssues: Record<string, number> = {};
    for (const issue of allIssues) {
      const section = issue.section?.toLowerCase() || "content";
      legacyIssues[section] = (legacyIssues[section] || 0) + 1;
    }

    // Create analysis summary
    const analysisId = await ctx.db.insert("domainOnsiteAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      healthScore: Math.round(healthScore),
      totalPages: pagesAnalyzed,
      criticalIssues,
      warnings: importantIssues,
      recommendations: minorIssues,
      // Full Audit fields
      grade,
      sections,
      allIssues,
      auditRecommendations: recommendations.slice(0, 50),
      pagesAnalyzed,
      // Legacy issues object (zero out DataForSEO fields)
      issues: {
        missingTitles: 0,
        missingMetaDescriptions: 0,
        duplicateContent: 0,
        brokenLinks: legacyIssues["links"] || 0,
        slowPages: legacyIssues["technical"] || 0,
        suboptimalTitles: legacyIssues["on_page"] || 0,
        thinContent: legacyIssues["content"] || 0,
        missingH1: 0,
        largeImages: legacyIssues["images"] || 0,
        missingAltText: 0,
      },
      fetchedAt: Date.now(),
    });

    // Link existing pages to analysis
    const pagesToUpdate = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    for (const page of pagesToUpdate) {
      await ctx.db.patch(page._id, { analysisId });
    }

    // Create onSiteIssues records from all_issues
    for (const issue of allIssues) {
      const severity = PRIORITY_TO_SEVERITY[issue.priority] || "recommendation";
      const category = SECTION_TO_CATEGORY[issue.section?.toLowerCase()] || "content";

      await ctx.db.insert("onSiteIssues", {
        scanId: args.scanId,
        domainId: args.domainId,
        severity,
        category,
        title: issue.issue || "Unknown issue",
        description: issue.action || "",
        affectedPages: 1,
        detectedAt: Date.now(),
      });
    }

    // Update scan: seoAuditStatus=completed
    await ctx.db.patch(args.scanId, {
      seoAuditStatus: "completed",
      pagesScanned: pagesAnalyzed,
      summary: {
        totalPages: pagesAnalyzed,
        totalIssues: allIssues.length,
      },
    });

    // Check if both sub-jobs are done
    const updatedScan = await ctx.db.get(args.scanId);
    const crawlStatus = updatedScan?.advertoolsCrawlStatus;
    if (!crawlStatus || ["completed", "failed", "skipped"].includes(crawlStatus)) {
      await ctx.db.patch(args.scanId, {
        status: "complete",
        completedAt: Date.now(),
      });
      if (crawlStatus === "completed") {
        await ctx.scheduler.runAfter(
          0,
          internal.seoAudit_actions.runPostCrawlAnalytics,
          { scanId: args.scanId, domainId: args.domainId }
        );
      }
    }

    console.log("[STORE_FULL] Full Audit results stored, seoAuditStatus=completed");
  },
});

/**
 * Recalculate domainOnsiteAnalysis from actual page data.
 * Runs after crawl enrichment completes so that even if the Full Audit API
 * returned empty data, we still have meaningful health scores from crawl-derived checks.
 */
export const recalculateAnalysisFromPages = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();

    if (pages.length === 0) {
      console.log("[RECALC] No pages found, skipping");
      return;
    }

    // Aggregate stats from page data
    let totalScore = 0;
    let scoredPages = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let recommendationCount = 0;
    let totalLoadTime = 0;
    let loadTimePages = 0;
    let totalWordCount = 0;
    let wordCountPages = 0;
    let totalPerformance = 0;
    let performancePages = 0;

    for (const page of pages) {
      if (page.onpageScore != null) {
        totalScore += page.onpageScore;
        scoredPages++;
      }
      for (const issue of (page.issues || [])) {
        if (issue.type === "critical") criticalCount++;
        else if (issue.type === "warning") warningCount++;
        else recommendationCount++;
      }
      if (page.loadTime && page.loadTime > 0) {
        totalLoadTime += page.loadTime;
        loadTimePages++;
      }
      if (page.wordCount > 0) {
        totalWordCount += page.wordCount;
        wordCountPages++;
      }
      if (page.lighthouseScores?.performance != null) {
        totalPerformance += page.lighthouseScores.performance;
        performancePages++;
      }
    }

    const avgScore = scoredPages > 0 ? Math.round(totalScore / scoredPages) : 0;
    const avgLoadTime = loadTimePages > 0 ? Math.round((totalLoadTime / loadTimePages) * 100) / 100 : undefined;
    const avgWordCount = wordCountPages > 0 ? Math.round(totalWordCount / wordCountPages) : undefined;
    const avgPerformance = performancePages > 0 ? Math.round(totalPerformance / performancePages) : undefined;

    console.log(`[RECALC] ${pages.length} pages: avgScore=${avgScore}, critical=${criticalCount}, warning=${warningCount}, recs=${recommendationCount}`);

    // Find existing analysis for this scan
    const existingAnalysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .first();

    if (existingAnalysis) {
      // Always update page counts and crawl-derived metrics
      const patch: Record<string, unknown> = {
        totalPages: pages.length,
        avgLoadTime,
        avgWordCount,
        avgPerformance,
      };

      // If Full Audit returned empty data (healthScore=0, grade="?"), replace with crawl data
      const fullAuditEmpty = existingAnalysis.healthScore === 0 && (existingAnalysis.grade === "?" || !existingAnalysis.grade);
      if (fullAuditEmpty) {
        patch.healthScore = avgScore;
        patch.criticalIssues = criticalCount;
        patch.warnings = warningCount;
        patch.recommendations = recommendationCount;
        patch.pagesAnalyzed = pages.length;

        // Derive a grade from the average score
        if (avgScore >= 90) patch.grade = "A";
        else if (avgScore >= 80) patch.grade = "B";
        else if (avgScore >= 70) patch.grade = "C";
        else if (avgScore >= 50) patch.grade = "D";
        else patch.grade = "F";

        // Build issues object from page issues
        const issuesByCategory: Record<string, number> = {};
        for (const page of pages) {
          for (const issue of (page.issues || [])) {
            issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
          }
        }
        patch.issues = {
          missingTitles: issuesByCategory["meta_tags"] || 0,
          missingMetaDescriptions: 0,
          duplicateContent: 0,
          brokenLinks: issuesByCategory["links"] || 0,
          slowPages: issuesByCategory["performance"] || 0,
          suboptimalTitles: 0,
          thinContent: issuesByCategory["content"] || 0,
          missingH1: issuesByCategory["headings"] || 0,
          largeImages: issuesByCategory["images"] || 0,
          missingAltText: 0,
          missingHttps: issuesByCategory["security"] || 0,
        };

        console.log(`[RECALC] Full Audit was empty — replaced with crawl-derived data: score=${avgScore}, grade=${patch.grade}`);
      } else {
        // Full Audit has real data — just update page count
        console.log(`[RECALC] Full Audit has real data (score=${existingAnalysis.healthScore}), only updating page count`);
      }

      await ctx.db.patch(existingAnalysis._id, patch);
    } else {
      // No analysis exists — create one from crawl data
      console.log("[RECALC] No analysis exists — creating from crawl data");

      let grade: string;
      if (avgScore >= 90) grade = "A";
      else if (avgScore >= 80) grade = "B";
      else if (avgScore >= 70) grade = "C";
      else if (avgScore >= 50) grade = "D";
      else grade = "F";

      const issuesByCategory: Record<string, number> = {};
      for (const page of pages) {
        for (const issue of (page.issues || [])) {
          issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
        }
      }

      await ctx.db.insert("domainOnsiteAnalysis", {
        domainId: args.domainId,
        scanId: args.scanId,
        healthScore: avgScore,
        totalPages: pages.length,
        criticalIssues: criticalCount,
        warnings: warningCount,
        recommendations: recommendationCount,
        grade,
        pagesAnalyzed: pages.length,
        avgLoadTime,
        avgWordCount,
        avgPerformance,
        issues: {
          missingTitles: issuesByCategory["meta_tags"] || 0,
          missingMetaDescriptions: 0,
          duplicateContent: 0,
          brokenLinks: issuesByCategory["links"] || 0,
          slowPages: issuesByCategory["performance"] || 0,
          suboptimalTitles: 0,
          thinContent: issuesByCategory["content"] || 0,
          missingH1: issuesByCategory["headings"] || 0,
          largeImages: issuesByCategory["images"] || 0,
          missingAltText: 0,
        },
        fetchedAt: Date.now(),
      });
    }
  },
});

/**
 * Store results from a selected-pages sync scan.
 * Creates page records and marks scan as complete (no analysis summary).
 */
export const storeInstantSeoAuditResults = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    results: v.any(),
  },
  handler: async (ctx, args) => {
    const results = args.results as any[];
    console.log(`[STORE_INSTANT] Storing ${results.length} pages`);

    for (const urlResult of results) {
      if (!urlResult?.url) continue;

      const issues: Array<{
        type: "critical" | "warning" | "recommendation";
        category: string;
        message: string;
      }> = [];

      for (const check of urlResult.results || []) {
        if (check.passed) continue;
        const config = CHECK_CONFIG[check.check];
        if (!config) continue;

        issues.push({
          type: config.severity,
          category: config.category,
          message: typeof check.result === "string" && check.result
            ? check.result
            : `Failed: ${check.check}`,
        });
      }

      await ctx.db.insert("domainOnsitePages", {
        domainId: args.domainId,
        scanId: args.scanId,
        url: urlResult.url,
        statusCode: 200,
        wordCount: 0,
        onpageScore: Math.round(urlResult.score ?? 0),
        checks: urlResult.results || [],
        issueCount: issues.length,
        issues,
      });
    }

    await ctx.db.patch(args.scanId, {
      status: "complete",
      completedAt: Date.now(),
      summary: {
        totalPages: results.length,
        totalIssues: results.reduce((sum: number, r: any) => {
          return (
            sum +
            (r.results || []).filter((c: any) => !c.passed).length
          );
        }, 0),
      },
    });

    console.log(`[STORE_INSTANT] Done`);
  },
});

// ============================================================================
// URL Discovery (Advertools-based)
// ============================================================================

/**
 * Fetch available URLs from sitemap via Advertools, with direct fetch fallback.
 */
export const fetchAvailableUrlsV2 = action({
  args: {
    domainId: v.id("domains"),
    sitemapUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ urls: string[]; source: string; error?: string }> => {
    const domainDoc = await ctx.runQuery(
      internal.domains.getDomainInternal,
      { domainId: args.domainId }
    );
    if (!domainDoc) throw new Error("Domain not found");

    const sitemapUrl =
      args.sitemapUrl || `https://${(domainDoc as any).domain}/sitemap.xml`;
    const baseUrl = process.env.SEO_API_BASE_URL;

    // Use Advertools if available
    if (baseUrl) {
      try {
        console.log(`[SITEMAP_V2] Advertools: ${sitemapUrl}`);
        const response = await fetch(
          `${baseUrl}/advertools/sitemap/parse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sitemap_url: sitemapUrl,
              recursive: true,
            }),
          }
        );

        if (!response.ok)
          throw new Error(`Advertools error: ${response.status}`);

        const data = await response.json();
        const urls = (data.data || [])
          .map((row: any) => row.loc || row.url)
          .filter(Boolean)
          .filter((url: string) => {
            const l = url.toLowerCase();
            return (
              !l.endsWith(".xml") &&
              !l.includes("/feed/") &&
              !l.includes("/rss")
            );
          });

        const uniqueUrls = Array.from(new Set(urls)) as string[];
        console.log(
          `[SITEMAP_V2] Found ${uniqueUrls.length} URLs via Advertools`
        );
        return { urls: uniqueUrls, source: "advertools_sitemap" };
      } catch (error) {
        console.error("[SITEMAP_V2] Advertools failed, falling back:", error);
      }
    }

    // Fallback: direct sitemap XML fetch
    try {
      console.log(`[SITEMAP_V2] Direct fetch: ${sitemapUrl}`);
      const response = await fetch(sitemapUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const xmlText = await response.text();
      const urlMatches = xmlText.match(/<loc>(.*?)<\/loc>/g);
      if (!urlMatches) throw new Error("No URLs found in sitemap");

      const urls = urlMatches
        .map((m) => m.replace(/<\/?loc>/g, "").trim())
        .filter((url) => {
          const l = url.toLowerCase();
          return (
            !l.endsWith(".xml") &&
            !l.includes("/feed/") &&
            !l.includes("/rss")
          );
        });

      return {
        urls: Array.from(new Set(urls)),
        source: "direct_sitemap",
      };
    } catch (error) {
      return {
        urls: [],
        source: "error",
        error:
          error instanceof Error ? error.message : "Failed to fetch sitemap",
      };
    }
  },
});

// ============================================================================
// Selected Pages Scan (Sync)
// ============================================================================

/**
 * Scan selected URLs using the sync SEO Audit API endpoint.
 * Each URL is audited immediately and results are stored.
 */
export const scanSelectedUrlsV2 = action({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    urls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`[SCAN_V2] Scanning ${args.urls.length} URLs (sync)`);

    const baseUrl = process.env.SEO_API_BASE_URL;
    if (!baseUrl) throw new Error("SEO_API_BASE_URL not configured");

    await ctx.runMutation(internal.seoAudit_actions.updateScanStatus, {
      scanId: args.scanId,
      status: "crawling",
    });

    const allResults: any[] = [];

    for (let i = 0; i < args.urls.length; i++) {
      const url = args.urls[i];
      console.log(
        `[SCAN_V2] Auditing ${i + 1}/${args.urls.length}: ${url}`
      );

      try {
        const response = await fetch(`${baseUrl}/seoaudit/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          console.error(`[SCAN_V2] Error for ${url}: ${response.status}`);
          continue;
        }

        allResults.push(await response.json());
      } catch (error) {
        console.error(`[SCAN_V2] Error auditing ${url}:`, error);
      }

      await ctx.runMutation(internal.seoAudit_actions.updateScanProgress, {
        scanId: args.scanId,
        pagesScanned: i + 1,
        totalPagesToScan: args.urls.length,
      });
    }

    console.log(
      `[SCAN_V2] Completed ${allResults.length}/${args.urls.length}`
    );

    await ctx.runMutation(
      internal.seoAudit_actions.storeInstantSeoAuditResults,
      {
        domainId: args.domainId,
        scanId: args.scanId,
        results: allResults,
      }
    );

    return { success: true, scannedUrls: allResults.length };
  },
});

// ============================================================================
// Helper Mutations
// ============================================================================

export const updateScanStatus = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    status: v.union(
      v.literal("queued"),
      v.literal("crawling"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, { status: args.status });
  },
});

export const updateScanProgress = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    pagesScanned: v.number(),
    totalPagesToScan: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);
    if (!scan) return;

    await ctx.db.patch(args.scanId, {
      pagesScanned: args.pagesScanned,
      totalPagesToScan: args.totalPagesToScan,
      lastProgressUpdate: Date.now(),
    });
  },
});

export const updateScanJobId = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      seoAuditJobId: args.jobId,
      fullAuditJobId: args.jobId,
    });
  },
});

export const updateScanCrawlJobId = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    crawlJobId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, { advertoolsCrawlJobId: args.crawlJobId });
  },
});

export const failScan = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);
    await ctx.db.patch(args.scanId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
    if (scan) {
      await ctx.runMutation(internal.notifications.createJobNotification, {
        domainId: scan.domainId,
        type: "job_failed",
        title: "On-Site scan failed",
        message: args.error.length > 100 ? args.error.slice(0, 100) + "..." : args.error,
        jobType: "on_site_scan",
      });
    }
  },
});

// ============================================================================
// Data Storage (Sitemap + Robots)
// ============================================================================

export const storeSitemapData = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    sitemapUrl: v.string(),
    totalUrls: v.number(),
    urls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("domainSitemapData", {
      domainId: args.domainId,
      scanId: args.scanId,
      sitemapUrl: args.sitemapUrl,
      totalUrls: args.totalUrls,
      urls: args.urls,
      fetchedAt: Date.now(),
    });
  },
});

export const storeRobotsData = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    robotsUrl: v.string(),
    directives: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("domainRobotsData", {
      domainId: args.domainId,
      scanId: args.scanId,
      robotsUrl: args.robotsUrl,
      directives: args.directives,
      fetchedAt: Date.now(),
    });
  },
});

// ============================================================================
// Crawl Analytics Storage
// ============================================================================

export const storeLinkAnalysis = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    totalLinks: v.number(),
    internalLinks: v.number(),
    externalLinks: v.number(),
    nofollowLinks: v.number(),
    links: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crawlLinkAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      totalLinks: args.totalLinks,
      internalLinks: args.internalLinks,
      externalLinks: args.externalLinks,
      nofollowLinks: args.nofollowLinks,
      links: args.links,
      fetchedAt: Date.now(),
    });
  },
});

export const storeRedirectAnalysis = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    totalRedirects: v.number(),
    redirects: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crawlRedirectAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      totalRedirects: args.totalRedirects,
      redirects: args.redirects,
      fetchedAt: Date.now(),
    });
  },
});

export const storeImageAnalysis = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    totalImages: v.number(),
    missingAltCount: v.number(),
    images: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crawlImageAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      totalImages: args.totalImages,
      missingAltCount: args.missingAltCount,
      images: args.images,
      fetchedAt: Date.now(),
    });
  },
});

export const storeWordFrequency = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    phraseLength: v.number(),
    totalWords: v.number(),
    data: v.array(v.object({
      word: v.string(),
      absFreq: v.number(),
      wtdFreq: v.optional(v.number()),
      relValue: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crawlWordFrequency", {
      domainId: args.domainId,
      scanId: args.scanId,
      phraseLength: args.phraseLength,
      totalWords: args.totalWords,
      data: args.data,
      fetchedAt: Date.now(),
    });
  },
});

export const storeRobotsTestResults = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    robotstxtUrl: v.string(),
    results: v.array(v.object({
      userAgent: v.string(),
      urlPath: v.string(),
      canFetch: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crawlRobotsTestResults", {
      domainId: args.domainId,
      scanId: args.scanId,
      robotstxtUrl: args.robotstxtUrl,
      results: args.results,
      fetchedAt: Date.now(),
    });
  },
});

// ============================================================================
// Crawl Enrichment & Dual-Job Completion
// ============================================================================

/**
 * Enrich existing domainOnsitePages with data from Advertools crawl results.
 * Matches by URL. Inserts new records for URLs found by crawl but not SEO Audit.
 */
export const enrichOnsitePagesFromCrawl = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    crawlResults: v.any(), // Pre-processed slim crawl records (batched)
  },
  handler: async (ctx, args) => {
    const crawlPages = args.crawlResults as Array<{
      url: string;
      status?: number;
      title?: string;
      h1?: string;
      metaDescription?: string;
      canonical?: string;
      wordCount: number;
      internalLinks: number;
      externalLinks: number;
      imagesCount?: number;
      imagesMissingAlt?: number;
      imageAlts?: Array<{ src: string; alt: string; hasAlt: boolean }>;
      loadTime?: number;
      pageSize?: number;
      htags?: { h1: string[]; h2: string[]; h3?: string[] };
    }>;
    console.log(`[ENRICH] Processing ${crawlPages.length} crawl results`);

    // Load monitored keywords for keyword matching in image alts
    const monitoredKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const activeKeywordPhrases = monitoredKeywords
      .filter((k) => k.status === "active")
      .map((k) => k.phrase.toLowerCase());

    // Load existing pages for this scan
    const existingPages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();

    const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
    const pagesByUrl = new Map(existingPages.map((p) => [normalizeUrl(p.url), p]));

    // Enrich image alts with keyword matching
    function enrichImageAlts(
      rawAlts?: Array<{ src: string; alt: string; hasAlt: boolean }>
    ): Array<{ src: string; alt: string; hasAlt: boolean; containsKeyword?: boolean; matchedKeyword?: string }> | undefined {
      if (!rawAlts || rawAlts.length === 0) return undefined;
      if (activeKeywordPhrases.length === 0) return rawAlts;
      return rawAlts.map((ia) => {
        if (!ia.hasAlt || !ia.alt) return ia;
        const altLower = ia.alt.toLowerCase();
        const match = activeKeywordPhrases.find((kw) => altLower.includes(kw));
        return match
          ? { ...ia, containsKeyword: true, matchedKeyword: match }
          : { ...ia, containsKeyword: false };
      });
    }

    // Generate basic SEO issues from crawl data
    function deriveCrawlIssues(page: {
      url: string;
      status?: number;
      title?: string;
      h1?: string;
      metaDescription?: string;
      canonical?: string;
      wordCount: number;
      loadTime?: number;
      imagesCount?: number;
      imagesMissingAlt?: number;
    }) {
      const issues: Array<{
        type: "critical" | "warning" | "recommendation";
        category: string;
        message: string;
      }> = [];

      const status = page.status || 200;
      if (status >= 400) {
        issues.push({ type: "critical", category: "indexability", message: `Broken page: HTTP ${status}` });
      } else if (status >= 300 && status < 400) {
        issues.push({ type: "warning", category: "indexability", message: `Redirect detected: HTTP ${status}` });
      }

      if (!page.title) {
        issues.push({ type: "critical", category: "meta_tags", message: "Missing page title" });
      } else if (page.title.length > 60) {
        issues.push({ type: "warning", category: "meta_tags", message: `Title too long (${page.title.length} chars, recommended: max 60)` });
      } else if (page.title.length < 10) {
        issues.push({ type: "warning", category: "meta_tags", message: `Title too short (${page.title.length} chars)` });
      }

      if (!page.metaDescription) {
        issues.push({ type: "warning", category: "meta_tags", message: "Missing meta description" });
      } else if (page.metaDescription.length > 160) {
        issues.push({ type: "warning", category: "meta_tags", message: `Meta description too long (${page.metaDescription.length} chars, recommended: max 160)` });
      }

      if (!page.canonical) {
        issues.push({ type: "recommendation", category: "meta_tags", message: "No canonical URL defined" });
      }

      if (!page.h1) {
        issues.push({ type: "critical", category: "headings", message: "Missing H1 heading" });
      }

      if (page.wordCount < 50 && status < 300) {
        issues.push({ type: "critical", category: "content", message: `Very thin content (${page.wordCount} words)` });
      } else if (page.wordCount < 300 && status < 300) {
        issues.push({ type: "warning", category: "content", message: `Thin content (${page.wordCount} words, recommended: 300+)` });
      }

      if (page.loadTime && page.loadTime > 5) {
        issues.push({ type: "critical", category: "performance", message: `Very slow page (${page.loadTime.toFixed(1)}s)` });
      } else if (page.loadTime && page.loadTime > 3) {
        issues.push({ type: "warning", category: "performance", message: `Slow page load (${page.loadTime.toFixed(1)}s, recommended: <3s)` });
      }

      if (!page.url.startsWith("https://")) {
        issues.push({ type: "critical", category: "security", message: "Not served over HTTPS" });
      }

      if (page.imagesMissingAlt && page.imagesMissingAlt > 0) {
        issues.push({ type: "warning", category: "images", message: `${page.imagesMissingAlt} image(s) missing alt text` });
      }

      // Score: start at 100, deduct per issue severity
      const criticalCount = issues.filter((i) => i.type === "critical").length;
      const warningCount = issues.filter((i) => i.type === "warning").length;
      const score = Math.max(0, Math.round(100 - criticalCount * 20 - warningCount * 10));

      return { issues, issueCount: issues.length, onpageScore: score };
    }

    let enriched = 0;
    let inserted = 0;

    for (const crawlPage of crawlPages) {
      const url = crawlPage.url;
      if (!url) continue;

      const existing = pagesByUrl.get(normalizeUrl(url));
      const crawlChecks = deriveCrawlIssues(crawlPage);

      if (existing) {
        // If page already has audit data (onpageScore set by SEO Audit), don't overwrite score/issues
        const patchData: Record<string, unknown> = {
          statusCode: crawlPage.status || existing.statusCode,
          title: crawlPage.title || existing.title,
          h1: crawlPage.h1 || existing.h1,
          metaDescription: crawlPage.metaDescription || existing.metaDescription,
          canonical: crawlPage.canonical || existing.canonical,
          wordCount: crawlPage.wordCount || existing.wordCount,
          internalLinksCount: crawlPage.internalLinks,
          externalLinksCount: crawlPage.externalLinks,
          imagesCount: crawlPage.imagesCount ?? existing.imagesCount,
          imagesMissingAlt: crawlPage.imagesMissingAlt ?? existing.imagesMissingAlt,
          imageAlts: enrichImageAlts(crawlPage.imageAlts) ?? existing.imageAlts,
          loadTime: crawlPage.loadTime || existing.loadTime,
          pageSize: crawlPage.pageSize || existing.pageSize,
        };
        if (crawlPage.htags && !existing.htags) {
          patchData.htags = crawlPage.htags;
        }
        // Only set crawl-derived score if no audit score exists
        if (existing.onpageScore == null) {
          patchData.onpageScore = crawlChecks.onpageScore;
          patchData.issueCount = crawlChecks.issueCount;
          patchData.issues = crawlChecks.issues;
        }
        await ctx.db.patch(existing._id, patchData);
        enriched++;
      } else {
        await ctx.db.insert("domainOnsitePages", {
          domainId: args.domainId,
          scanId: args.scanId,
          url,
          statusCode: crawlPage.status || 200,
          title: crawlPage.title || undefined,
          h1: crawlPage.h1 || undefined,
          metaDescription: crawlPage.metaDescription || undefined,
          canonical: crawlPage.canonical || undefined,
          wordCount: crawlPage.wordCount,
          internalLinksCount: crawlPage.internalLinks,
          externalLinksCount: crawlPage.externalLinks,
          imagesCount: crawlPage.imagesCount ?? undefined,
          imagesMissingAlt: crawlPage.imagesMissingAlt ?? undefined,
          imageAlts: enrichImageAlts(crawlPage.imageAlts),
          loadTime: crawlPage.loadTime || undefined,
          pageSize: crawlPage.pageSize || undefined,
          htags: crawlPage.htags,
          onpageScore: crawlChecks.onpageScore,
          issueCount: crawlChecks.issueCount,
          issues: crawlChecks.issues,
        });
        inserted++;
      }
    }

    console.log(`[ENRICH] Enriched ${enriched} pages, inserted ${inserted} new`);
  },
});

/**
 * Check if both SEO Audit and Advertools Crawl sub-jobs have completed.
 * Determines next step: run analytics pipeline or mark as complete/failed.
 */
export const checkDualJobCompletion = internalMutation({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);
    if (!scan) return;

    const auditStatus = scan.seoAuditStatus || "skipped";
    const crawlStatus = scan.advertoolsCrawlStatus || "skipped";

    const auditDone = ["completed", "failed", "skipped"].includes(auditStatus);
    const crawlDone = ["completed", "failed", "skipped"].includes(crawlStatus);

    if (!auditDone || !crawlDone) {
      console.log(`[DUAL_CHECK] Not done yet: audit=${auditStatus}, crawl=${crawlStatus}`);
      return;
    }

    console.log(`[DUAL_CHECK] Both done: audit=${auditStatus}, crawl=${crawlStatus}`);

    if (auditStatus === "failed" && crawlStatus === "failed") {
      await ctx.db.patch(args.scanId, {
        status: "failed",
        error: "Both SEO audit and crawl failed",
        completedAt: Date.now(),
      });
      return;
    }

    if (crawlStatus === "completed") {
      // Crawl completed → run post-crawl analytics pipeline
      await ctx.db.patch(args.scanId, { status: "processing" });
      await ctx.scheduler.runAfter(
        0,
        internal.seoAudit_actions.runPostCrawlAnalytics,
        { scanId: args.scanId, domainId: scan.domainId }
      );
    } else {
      // Crawl failed/skipped but audit completed → complete without analytics
      await ctx.db.patch(args.scanId, {
        status: "complete",
        completedAt: Date.now(),
      });
    }
  },
});

// ============================================================================
// Advertools Crawl Polling
// ============================================================================

/**
 * Poll Advertools crawl job for completion.
 * On completed: download full results, enrich pages, check dual-job completion.
 */
export const pollAdvertoolsCrawlStatus = internalAction({
  args: {
    scanId: v.id("onSiteScans"),
    jobId: v.string(),
    domainId: v.id("domains"),
    pollCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const count = args.pollCount || 0;
    const maxPolls = 60; // 60 * 30s = 30 minutes
    console.log(`[CRAWL_POLL] Checking job: ${args.jobId} (poll ${count}/${maxPolls})`);

    if (count >= maxPolls) {
      console.error("[CRAWL_POLL] Timeout after 30 minutes");
      await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
        scanId: args.scanId,
        advertoolsCrawlStatus: "failed",
      });
      await ctx.runMutation(internal.seoAudit_actions.checkDualJobCompletion, {
        scanId: args.scanId,
      });
      return;
    }

    const scan = await ctx.runQuery(
      internal.seoAudit_queries.getScanById,
      { scanId: args.scanId }
    );
    if (!scan || scan.status === "failed") {
      console.log("[CRAWL_POLL] Scan cancelled or not found - stopping");
      return;
    }

    const baseUrl = process.env.SEO_API_BASE_URL;
    if (!baseUrl) return;

    try {
      const response = await fetch(`${baseUrl}/advertools/crawl/job/${args.jobId}`);
      if (!response.ok) throw new Error(`Crawl poll error: ${response.status}`);

      const jobData = await response.json();
      const crawlRows = jobData.rows || 0;
      console.log(`[CRAWL_POLL] Status: ${jobData.status}, rows: ${crawlRows}`);

      if (jobData.status === "completed") {
        // Download full results (JSON Lines format, no truncation)
        console.log("[CRAWL_POLL] Downloading full results...");
        const downloadResponse = await fetch(
          `${baseUrl}/advertools/crawl/job/${args.jobId}/download`
        );

        let crawlResults: any[] = [];
        if (downloadResponse.ok) {
          const text = await downloadResponse.text();
          // Parse JSON Lines (one JSON object per line)
          crawlResults = text
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              try { return JSON.parse(line); }
              catch { return null; }
            })
            .filter(Boolean);
        } else {
          // Fallback to job results (may be truncated)
          crawlResults = jobData.result || [];
        }

        console.log(`[CRAWL_POLL] Got ${crawlResults.length} crawl results`);

        // Helper: Advertools JSONL stores multi-value fields as @@-separated strings
        const parseMulti = (val: unknown): string[] => {
          if (!val) return [];
          if (Array.isArray(val)) return val.map(String);
          if (typeof val === "string") return val.split("@@").map(s => s.trim()).filter(Boolean);
          return [];
        };

        // Log first result keys for debugging field names
        if (crawlResults.length > 0) {
          console.log(`[CRAWL_POLL] Sample crawl fields: ${Object.keys(crawlResults[0]).join(", ")}`);
        }

        // Strip crawl results to only needed fields (body_text & links_url are huge)
        const slimResults = crawlResults.map((r: any) => {
          const linksUrl = parseMulti(r.links_url);
          let domain = "";
          try { domain = new URL(r.url).hostname; } catch {}
          let internalLinks = 0;
          let externalLinks = 0;
          for (const link of linksUrl) {
            try {
              const h = new URL(link).hostname;
              if (h === domain || h.endsWith(`.${domain}`)) internalLinks++;
              else externalLinks++;
            } catch {}
          }
          const bodyText = r.body_text || "";
          const wordCount = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;
          const imgSrcs = parseMulti(r.img_src);
          const imgAlts = parseMulti(r.img_alt);

          // Build per-image alt data by zipping img_src and img_alt
          const imageAlts = imgSrcs.map((src: string, idx: number) => {
            const alt = imgAlts[idx] || "";
            return { src, alt, hasAlt: alt.length > 0 };
          });
          const imagesMissingAlt = imageAlts.filter((ia: { hasAlt: boolean }) => !ia.hasAlt).length;

          // Parse heading arrays
          const h1Arr = parseMulti(r.h1);
          const h2Arr = parseMulti(r.h2);
          const h3Arr = parseMulti(r.h3);

          return {
            url: r.url,
            status: r.status,
            title: r.title,
            h1: h1Arr[0] || undefined,
            metaDescription: r.meta_desc || r.description || undefined,
            canonical: r.canonical || undefined,
            wordCount,
            internalLinks,
            externalLinks,
            imagesCount: imgSrcs.length,
            imagesMissingAlt,
            imageAlts: imageAlts.length > 0 ? imageAlts.slice(0, 50) : undefined, // Cap at 50 per page
            loadTime: r.download_latency,
            pageSize: r.size,
            htags: (h1Arr.length > 0 || h2Arr.length > 0) ? {
              h1: h1Arr,
              h2: h2Arr,
              h3: h3Arr.length > 0 ? h3Arr : undefined,
            } : undefined,
          };
        });

        // Batch enrichment in chunks of 50 to avoid mutation timeout
        const BATCH_SIZE = 50;
        for (let i = 0; i < slimResults.length; i += BATCH_SIZE) {
          const batch = slimResults.slice(i, i + BATCH_SIZE);
          await ctx.runMutation(internal.seoAudit_actions.enrichOnsitePagesFromCrawl, {
            scanId: args.scanId,
            domainId: args.domainId,
            crawlResults: batch,
          });
          console.log(`[CRAWL_POLL] Enriched batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(slimResults.length / BATCH_SIZE)}`);
        }

        // Recalculate analysis from actual page data (fixes zeros if Full Audit returned empty)
        await ctx.runMutation(internal.seoAudit_actions.recalculateAnalysisFromPages, {
          scanId: args.scanId,
          domainId: args.domainId,
        });

        // Mark crawl as completed
        await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
          scanId: args.scanId,
          advertoolsCrawlStatus: "completed",
        });

        // Check if both jobs are done
        await ctx.runMutation(internal.seoAudit_actions.checkDualJobCompletion, {
          scanId: args.scanId,
        });
        return;
      }

      if (jobData.status === "failed") {
        console.error("[CRAWL_POLL] Crawl job failed");
        await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
          scanId: args.scanId,
          advertoolsCrawlStatus: "failed",
        });
        await ctx.runMutation(internal.seoAudit_actions.checkDualJobCompletion, {
          scanId: args.scanId,
        });
        return;
      }

      // Still running — poll again in 30s
      await ctx.scheduler.runAfter(
        30000,
        internal.seoAudit_actions.pollAdvertoolsCrawlStatus,
        {
          scanId: args.scanId,
          jobId: args.jobId,
          domainId: args.domainId,
          pollCount: count + 1,
        }
      );
    } catch (error) {
      console.error("[CRAWL_POLL] Error:", error);
      // Only retry if we haven't exhausted polls — prevents infinite error loops
      if (count + 1 < maxPolls) {
        await ctx.scheduler.runAfter(
          30000,
          internal.seoAudit_actions.pollAdvertoolsCrawlStatus,
          {
            scanId: args.scanId,
            jobId: args.jobId,
            domainId: args.domainId,
            pollCount: count + 1,
          }
        );
      } else {
        console.error("[CRAWL_POLL] Max retries reached, marking crawl as failed");
        await ctx.runMutation(internal.seoAudit_actions.updateCrawlSubStatus, {
          scanId: args.scanId,
          advertoolsCrawlStatus: "failed",
        });
        await ctx.runMutation(internal.seoAudit_actions.checkDualJobCompletion, {
          scanId: args.scanId,
        });
      }
    }
  },
});

/**
 * Run post-crawl analytics pipeline after Advertools crawl completes.
 * Calls: analytics/links, analytics/redirects, analytics/images,
 * text/word-frequency, robots/test — each stored independently.
 */
export const runPostCrawlAnalytics = internalAction({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    console.log("[ANALYTICS] Starting post-crawl analytics pipeline");

    const scan = await ctx.runQuery(
      internal.seoAudit_queries.getScanById,
      { scanId: args.scanId }
    );
    if (!scan?.advertoolsCrawlJobId) {
      console.error("[ANALYTICS] No crawl job ID found");
      await ctx.runMutation(internal.seoAudit_actions.completeScan, {
        scanId: args.scanId,
      });
      return;
    }

    const baseUrl = process.env.SEO_API_BASE_URL;
    if (!baseUrl) {
      await ctx.runMutation(internal.seoAudit_actions.completeScan, {
        scanId: args.scanId,
      });
      return;
    }

    const domain: any = await ctx.runQuery(
      internal.domains.getDomainInternal,
      { domainId: args.domainId }
    );
    const domainName = domain?.domain || "";
    const crawlJobId = scan.advertoolsCrawlJobId;

    // 1. Link Analysis
    try {
      console.log("[ANALYTICS] Running link analysis...");
      const linkResp = await fetch(`${baseUrl}/advertools/analytics/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: crawlJobId,
          internal_url_regex: domainName.replace(/\./g, "\\."),
        }),
      });
      if (linkResp.ok) {
        const linkData = await linkResp.json();
        const links = (linkData.data || []).slice(0, 1000);
        let internalCount = 0;
        let externalCount = 0;
        let nofollowCount = 0;
        for (const link of links) {
          if (link.internal) internalCount++;
          else externalCount++;
          if (link.nofollow) nofollowCount++;
        }
        await ctx.runMutation(internal.seoAudit_actions.storeLinkAnalysis, {
          domainId: args.domainId,
          scanId: args.scanId,
          totalLinks: linkData.total_links || links.length,
          internalLinks: internalCount,
          externalLinks: externalCount,
          nofollowLinks: nofollowCount,
          links: links.map((l: any) => ({
            sourceUrl: l.url,
            targetUrl: l.link,
            anchorText: l.text || "",
            nofollow: l.nofollow || false,
            internal: l.internal || false,
          })),
        });
        console.log(`[ANALYTICS] Stored ${links.length} links`);
      }
    } catch (e) {
      console.error("[ANALYTICS] Link analysis failed:", e);
    }

    // 2. Redirect Analysis
    let redirectStored = false;
    try {
      console.log("[ANALYTICS] Running redirect analysis...");
      const redirectResp = await fetch(`${baseUrl}/advertools/analytics/redirects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: crawlJobId }),
      });
      if (redirectResp.ok) {
        const redirectData = await redirectResp.json();
        const redirects = (redirectData.data || []).slice(0, 500);
        await ctx.runMutation(internal.seoAudit_actions.storeRedirectAnalysis, {
          domainId: args.domainId,
          scanId: args.scanId,
          totalRedirects: redirectData.total_redirects || redirects.length,
          redirects: redirects.map((r: any) => ({
            sourceUrl: r.url || r.source_url,
            targetUrl: r.redirect_url || r.target_url,
            statusCode: r.status || r.status_code,
            chain: r.redirect_chain || [],
            chainLength: r.redirect_times || r.chain_length || 1,
          })),
        });
        redirectStored = true;
        console.log(`[ANALYTICS] Stored ${redirects.length} redirects`);
      } else {
        console.error(`[ANALYTICS] Redirect API returned ${redirectResp.status}: ${await redirectResp.text().catch(() => "")}`);
      }
    } catch (e) {
      console.error("[ANALYTICS] Redirect analysis failed:", e);
    }

    // 2b. Fallback: derive redirects from crawl pages if API failed
    if (!redirectStored) {
      try {
        const crawlPages = await ctx.runQuery(internal.seoAudit_queries.getPageUrls, { scanId: args.scanId });
        const allPages = await ctx.runQuery(internal.seoAudit_queries.getPagesByStatusRange, { scanId: args.scanId, minStatus: 300, maxStatus: 399 });
        if (allPages.length > 0) {
          await ctx.runMutation(internal.seoAudit_actions.storeRedirectAnalysis, {
            domainId: args.domainId,
            scanId: args.scanId,
            totalRedirects: allPages.length,
            redirects: allPages.map((p: any) => ({
              sourceUrl: p.url,
              targetUrl: "",
              statusCode: p.statusCode,
              chain: [],
              chainLength: 1,
            })),
          });
          console.log(`[ANALYTICS] Fallback: stored ${allPages.length} redirects from crawl pages`);
        } else {
          // Store zero redirects so the card shows 0 instead of —
          await ctx.runMutation(internal.seoAudit_actions.storeRedirectAnalysis, {
            domainId: args.domainId,
            scanId: args.scanId,
            totalRedirects: 0,
            redirects: [],
          });
          console.log("[ANALYTICS] Fallback: stored 0 redirects (none found in crawl)");
        }
      } catch (e) {
        console.error("[ANALYTICS] Redirect fallback failed:", e);
      }
    }

    // 3. Image Analysis
    let imageStored = false;
    try {
      console.log("[ANALYTICS] Running image analysis...");
      const imageResp = await fetch(`${baseUrl}/advertools/analytics/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: crawlJobId }),
      });
      if (imageResp.ok) {
        const imageData = await imageResp.json();
        const images = (imageData.data || []).slice(0, 500);
        const missingAlt = images.filter((img: any) => !img.alt).length;
        await ctx.runMutation(internal.seoAudit_actions.storeImageAnalysis, {
          domainId: args.domainId,
          scanId: args.scanId,
          totalImages: imageData.total_images || images.length,
          missingAltCount: missingAlt,
          images: images.map((img: any) => ({
            pageUrl: img.url || img.page_url,
            imageUrl: img.img_src || img.image_url,
            alt: img.alt || "",
            missingAlt: !img.alt,
          })),
        });
        imageStored = true;
        console.log(`[ANALYTICS] Stored ${images.length} images (${missingAlt} missing alt)`);
      } else {
        console.error(`[ANALYTICS] Image API returned ${imageResp.status}: ${await imageResp.text().catch(() => "")}`);
      }
    } catch (e) {
      console.error("[ANALYTICS] Image analysis failed:", e);
    }

    // 3b. Fallback: derive image stats from enriched pages if API failed
    if (!imageStored) {
      try {
        const imageStats = await ctx.runQuery(internal.seoAudit_queries.getImageStatsFromPages, { scanId: args.scanId });
        await ctx.runMutation(internal.seoAudit_actions.storeImageAnalysis, {
          domainId: args.domainId,
          scanId: args.scanId,
          totalImages: imageStats.totalImages,
          missingAltCount: imageStats.missingAlt,
          images: imageStats.images,
        });
        console.log(`[ANALYTICS] Fallback: stored ${imageStats.images.length} images from crawl pages (${imageStats.totalImages} total, ${imageStats.missingAlt} missing alt)`);
      } catch (e) {
        console.error("[ANALYTICS] Image fallback failed:", e);
      }
    }

    // 4. Word Frequency (unigrams + bigrams)
    try {
      console.log("[ANALYTICS] Running word frequency analysis...");
      // Get page body texts from crawl
      const pages = await ctx.runQuery(
        internal.seoAudit_queries.getPageBodyTexts,
        { scanId: args.scanId, domainId: args.domainId }
      );
      const textList = pages
        .map((p: any) => p.bodyText)
        .filter((t: string) => t && t.length > 10);

      if (textList.length > 0) {
        for (const phraseLen of [1, 2]) {
          try {
            const wfResp = await fetch(`${baseUrl}/advertools/text/word-frequency`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text_list: textList.slice(0, 50), // Limit to 50 pages
                phrase_len: phraseLen,
                rm_words: ["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "it", "this", "that", "are", "was", "be", "has", "had", "have", "not", "no", "from", "as", "do", "does", "will"],
              }),
            });
            if (wfResp.ok) {
              const wfData = await wfResp.json();
              const topWords = (wfData.data || []).slice(0, 100);
              await ctx.runMutation(internal.seoAudit_actions.storeWordFrequency, {
                domainId: args.domainId,
                scanId: args.scanId,
                phraseLength: phraseLen,
                totalWords: wfData.total_words || 0,
                data: topWords.map((w: any) => ({
                  word: w.word,
                  absFreq: w.abs_freq || 0,
                  wtdFreq: w.wtd_freq,
                  relValue: w.rel_value,
                })),
              });
              console.log(`[ANALYTICS] Stored ${topWords.length} ${phraseLen === 1 ? "unigrams" : "bigrams"}`);
            }
          } catch (e) {
            console.error(`[ANALYTICS] Word frequency (len=${phraseLen}) failed:`, e);
          }
        }
      }
    } catch (e) {
      console.error("[ANALYTICS] Word frequency pipeline failed:", e);
    }

    // 5. Robots Test
    try {
      console.log("[ANALYTICS] Running robots.txt test...");
      // Get top URLs from sitemap
      const sitemap = await ctx.runQuery(
        internal.seoAudit_queries.getSitemapDataInternal,
        { domainId: args.domainId }
      );
      const sitemapUrls = (sitemap?.urls || []).slice(0, 20);

      if (sitemapUrls.length > 0) {
        const robotstxtUrl = `https://${domainName}/robots.txt`;
        const robotsResp = await fetch(`${baseUrl}/advertools/robots/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            robotstxt_url: robotstxtUrl,
            user_agents: ["Googlebot", "Bingbot", "*"],
            urls: sitemapUrls,
          }),
        });
        if (robotsResp.ok) {
          const robotsData = await robotsResp.json();
          const results = (robotsData.data || []).map((r: any) => ({
            userAgent: r.user_agent,
            urlPath: r.url_path,
            canFetch: r.can_fetch,
          }));
          await ctx.runMutation(internal.seoAudit_actions.storeRobotsTestResults, {
            domainId: args.domainId,
            scanId: args.scanId,
            robotstxtUrl,
            results,
          });
          console.log(`[ANALYTICS] Stored ${results.length} robots test results`);
        }
      }
    } catch (e) {
      console.error("[ANALYTICS] Robots test failed:", e);
    }

    // 6. Update analysis with averages from enriched pages
    try {
      const enrichedPages = await ctx.runQuery(
        internal.seoAudit_queries.getEnrichedPageStats,
        { scanId: args.scanId }
      );
      if (enrichedPages) {
        await ctx.runMutation(internal.seoAudit_actions.updateAnalysisAverages, {
          domainId: args.domainId,
          scanId: args.scanId,
          avgWordCount: enrichedPages.avgWordCount,
          avgLoadTime: enrichedPages.avgLoadTime,
        });
      }
    } catch (e) {
      console.error("[ANALYTICS] Average update failed:", e);
    }

    // 7. PageSpeed Insights batch (non-blocking: submit + schedule polling)
    try {
      console.log("[ANALYTICS] Submitting PageSpeed Insights batch...");
      const psiPages = await ctx.runQuery(
        internal.seoAudit_queries.getPageUrls,
        { scanId: args.scanId }
      );
      const psiUrls = psiPages.map((p: any) => p.url);

      if (psiUrls.length > 0) {
        const psiResp = await fetch(`${baseUrl}/advertools/pagespeed/batch/async`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: psiUrls,
            strategy: "mobile",
            categories: ["performance", "accessibility", "best-practices", "seo"],
          }),
        });
        if (psiResp.ok) {
          const psiJob = await psiResp.json();
          console.log(`[ANALYTICS] PSI batch submitted: job_id=${psiJob.job_id}, urls=${psiUrls.length}`);

          // Notify: PSI started
          await ctx.runMutation(internal.notifications.createJobNotification, {
            domainId: args.domainId,
            type: "job_started",
            title: "PageSpeed Insights analysis started",
            message: `Analyzing ${psiUrls.length} pages`,
            jobType: "psi_analysis",
          });

          // Store job tracking data
          await ctx.runMutation(internal.seoAudit_actions.updatePsiStatus, {
            scanId: args.scanId,
            psiJobId: psiJob.job_id,
            psiStatus: "pending" as const,
            psiProgress: { current: 0, total: psiUrls.length },
            psiStartedAt: Date.now(),
          });

          // Schedule async polling (doesn't block scan completion)
          await ctx.scheduler.runAfter(10000, internal.seoAudit_actions.pollPsiJob, {
            scanId: args.scanId,
            domainId: args.domainId,
            jobId: psiJob.job_id,
            attempt: 0,
          });
        } else {
          console.error(`[ANALYTICS] PSI batch request failed: ${psiResp.status} ${await psiResp.text().catch(() => "")}`);
        }
      }
    } catch (e) {
      console.error("[ANALYTICS] PSI batch pipeline failed:", e);
    }

    // 8. Complete the scan
    await ctx.runMutation(internal.seoAudit_actions.completeScan, {
      scanId: args.scanId,
    });

    console.log("[ANALYTICS] Post-crawl analytics pipeline complete");
  },
});

// Helper mutations for dual-job tracking

export const updateCrawlSubStatus = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    advertoolsCrawlStatus: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      advertoolsCrawlStatus: args.advertoolsCrawlStatus,
    });
  },
});

export const updateAuditSubStatus = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    seoAuditStatus: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      seoAuditStatus: args.seoAuditStatus,
    });
  },
});

export const completeScan = internalMutation({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);
    if (!scan) return;
    await ctx.db.patch(args.scanId, {
      status: "complete",
      completedAt: Date.now(),
    });

    // Count pages for notification message
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    await ctx.runMutation(internal.notifications.createJobNotification, {
      domainId: scan.domainId,
      type: "job_completed",
      title: "On-Site scan completed",
      message: `Analyzed ${pages.length} pages`,
      jobType: "on_site_scan",
    });

    // Trigger page scoring after scan completes
    await ctx.scheduler.runAfter(0, internal.pageScoring.computePageScores, {
      domainId: scan.domainId,
      offset: 0,
    });
  },
});

export const updateAnalysisAverages = internalMutation({
  args: {
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    avgWordCount: v.optional(v.number()),
    avgLoadTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .first();
    if (!analysis) return;
    const patch: any = {};
    if (args.avgWordCount !== undefined) patch.avgWordCount = args.avgWordCount;
    if (args.avgLoadTime !== undefined) patch.avgLoadTime = args.avgLoadTime;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(analysis._id, patch);
    }
  },
});

// ============================================================================
// PageSpeed Insights
// ============================================================================

export const storePsiResults = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    results: v.any(), // [{url, scores, core_web_vitals, ...}]
  },
  handler: async (ctx, args) => {
    const psiResults = args.results as Array<{
      url: string;
      scores?: { performance?: number; accessibility?: number; best_practices?: number; seo?: number };
      core_web_vitals?: {
        lcp?: { value?: number };
        cls?: { value?: number };
        fcp?: { value?: number };
        tbt?: { value?: number };
        ttfb?: { value?: number };
        si?: { value?: number };
        fid?: { value?: number };
      };
    }>;

    // Load pages for this scan
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();

    const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
    const pagesByUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));

    let updated = 0;
    for (const result of psiResults) {
      if (!result.url) continue;
      const page = pagesByUrl.get(normalizeUrl(result.url));
      if (!page) continue;

      const patch: Record<string, unknown> = {};

      if (result.scores) {
        patch.lighthouseScores = {
          performance: Math.round(result.scores.performance ?? 0),
          accessibility: Math.round(result.scores.accessibility ?? 0),
          bestPractices: Math.round(result.scores.best_practices ?? 0),
          seo: Math.round(result.scores.seo ?? 0),
        };
      }

      if (result.core_web_vitals) {
        const cwv = result.core_web_vitals;
        patch.coreWebVitals = {
          largestContentfulPaint: cwv.lcp?.value ?? 0,
          firstInputDelay: cwv.fid?.value ?? cwv.tbt?.value ?? 0,
          timeToInteractive: cwv.si?.value ?? 0,
          domComplete: cwv.ttfb?.value ?? 0,
          cumulativeLayoutShift: cwv.cls?.value ?? 0,
        };
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(page._id, patch);
        updated++;
      }
    }

    console.log(`[PSI] Updated ${updated}/${psiResults.length} pages with Lighthouse/CWV data`);

    // Trigger page scoring recomputation after PSI data is stored
    if (updated > 0) {
      await ctx.scheduler.runAfter(0, internal.pageScoring.computePageScores, {
        domainId: args.domainId,
        offset: 0,
      });
    }

    // Update avgPerformance on the analysis record
    if (updated > 0) {
      let totalPerf = 0;
      let perfCount = 0;
      for (const result of psiResults) {
        if (result.scores?.performance != null) {
          totalPerf += Math.round(result.scores.performance);
          perfCount++;
        }
      }
      if (perfCount > 0) {
        const avgPerformance = Math.round(totalPerf / perfCount);
        const analysis = await ctx.db
          .query("domainOnsiteAnalysis")
          .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
          .first();
        if (analysis) {
          await ctx.db.patch(analysis._id, { avgPerformance });
          console.log(`[PSI] Updated analysis avgPerformance=${avgPerformance}`);
        }
      }
    }
  },
});

/**
 * Standalone PageSpeed analysis — runs PSI batch on existing pages without a full rescan.
 * Callable from the frontend (public action).
 */
/**
 * Non-blocking: submits PSI batch job, stores job ID, schedules polling.
 * Frontend sees progress reactively via scan record.
 */
export const runPageSpeedAnalysis = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<{ jobId: string }> => {
    const baseUrl: string | undefined = process.env.SEO_API_BASE_URL;
    if (!baseUrl) throw new Error("SEO_API_BASE_URL not configured");

    const latestScan: { _id: any } | null = await ctx.runQuery(
      internal.seoAudit_queries.getLatestScanInternal,
      { domainId: args.domainId }
    );
    if (!latestScan) throw new Error("No scan found for this domain");

    const pages: Array<{ _id: any; url: string }> = await ctx.runQuery(
      internal.seoAudit_queries.getPageUrls,
      { scanId: latestScan._id }
    );
    const urls: string[] = pages.map((p) => p.url);
    if (urls.length === 0) throw new Error("No pages found to analyze");

    // Submit batch job
    const submitResp: Response = await fetch(`${baseUrl}/advertools/pagespeed/batch/async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls,
        strategy: "mobile",
        categories: ["performance", "accessibility", "best-practices", "seo"],
      }),
    });

    if (!submitResp.ok) {
      const body: string = await submitResp.text();
      throw new Error(`PSI batch submit failed: ${submitResp.status} — ${body.slice(0, 300)}`);
    }

    const submitData: { job_id: string } = await submitResp.json();
    console.log(`[PSI] Batch job submitted: ${submitData.job_id} for ${urls.length} URLs`);

    // Notify: PSI started
    await ctx.runMutation(internal.notifications.createJobNotification, {
      domainId: args.domainId,
      type: "job_started",
      title: "PageSpeed Insights analysis started",
      message: `Analyzing ${urls.length} pages`,
      jobType: "psi_analysis",
    });

    // Store job ID + status on scan record
    await ctx.runMutation(internal.seoAudit_actions.updatePsiStatus, {
      scanId: latestScan._id,
      psiJobId: submitData.job_id,
      psiStatus: "pending",
      psiProgress: { current: 0, total: urls.length },
      psiStartedAt: Date.now(),
    });

    // Schedule first poll in 10 seconds
    await ctx.scheduler.runAfter(10000, internal.seoAudit_actions.pollPsiJob, {
      scanId: latestScan._id,
      domainId: args.domainId,
      jobId: submitData.job_id,
      attempt: 0,
    });

    return { jobId: submitData.job_id };
  },
});

/** Update PSI job tracking fields on scan */
export const updatePsiStatus = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    psiJobId: v.optional(v.string()),
    psiStatus: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    psiProgress: v.optional(v.object({ current: v.number(), total: v.number() })),
    psiStartedAt: v.optional(v.number()),
    psiError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { psiStatus: args.psiStatus };
    if (args.psiJobId !== undefined) patch.psiJobId = args.psiJobId;
    if (args.psiProgress !== undefined) patch.psiProgress = args.psiProgress;
    if (args.psiStartedAt !== undefined) patch.psiStartedAt = args.psiStartedAt;
    if (args.psiError !== undefined) patch.psiError = args.psiError;
    await ctx.db.patch(args.scanId, patch);
  },
});

/** Poll PSI batch job status, update progress, schedule next poll or fetch results */
export const pollPsiJob = internalAction({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    jobId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const baseUrl = process.env.SEO_API_BASE_URL;
    if (!baseUrl) return;

    const MAX_ATTEMPTS = 540; // 540 × 10s = 90 min max (~40s per URL × up to 100+ URLs)
    if (args.attempt >= MAX_ATTEMPTS) {
      await ctx.runMutation(internal.seoAudit_actions.updatePsiStatus, {
        scanId: args.scanId,
        psiStatus: "failed",
        psiError: "Timed out after 90 minutes",
      });
      await ctx.runMutation(internal.notifications.createJobNotification, {
        domainId: args.domainId,
        type: "job_failed",
        title: "PageSpeed Insights analysis failed",
        message: "Timed out after 90 minutes",
        jobType: "psi_analysis",
      });
      return;
    }

    try {
      const pollResp = await fetch(`${baseUrl}/advertools/job/${args.jobId}`);
      if (!pollResp.ok) {
        // Retry
        await ctx.scheduler.runAfter(10000, internal.seoAudit_actions.pollPsiJob, {
          ...args,
          attempt: args.attempt + 1,
        });
        return;
      }

      const pollData = await pollResp.json() as {
        status: string;
        progress?: { current?: number; total?: number };
      };

      console.log(`[PSI_POLL] attempt=${args.attempt + 1} status=${pollData.status} progress=${pollData.progress?.current}/${pollData.progress?.total}`);

      // Update progress in DB
      const psiStatus = pollData.status === "completed" ? "completed" as const
        : pollData.status === "failed" ? "failed" as const
        : "running" as const;

      await ctx.runMutation(internal.seoAudit_actions.updatePsiStatus, {
        scanId: args.scanId,
        psiStatus,
        psiProgress: pollData.progress
          ? { current: pollData.progress.current ?? 0, total: pollData.progress.total ?? 0 }
          : undefined,
        psiError: pollData.status === "failed" ? "PSI batch job failed" : undefined,
      });

      if (pollData.status === "completed") {
        // Fetch and store results
        const resultResp = await fetch(`${baseUrl}/advertools/job/${args.jobId}/result`);
        if (resultResp.ok) {
          const resultData = await resultResp.json();
          const rawResults = resultData?.result?.results ?? [];
          const transformed = rawResults.map((r: any) => ({
            url: r.url,
            scores: {
              performance: r.scores?.performance?.score ?? 0,
              accessibility: r.scores?.accessibility?.score ?? 0,
              best_practices: r.scores?.["best-practices"]?.score ?? 0,
              seo: r.scores?.seo?.score ?? 0,
            },
            core_web_vitals: {
              lcp: r.core_web_vitals?.lcp ? { value: r.core_web_vitals.lcp.value } : undefined,
              cls: r.core_web_vitals?.cls ? { value: r.core_web_vitals.cls.value } : undefined,
              fcp: r.core_web_vitals?.fcp ? { value: r.core_web_vitals.fcp.value } : undefined,
              tbt: r.core_web_vitals?.tbt ? { value: r.core_web_vitals.tbt.value } : undefined,
              si: r.core_web_vitals?.si ? { value: r.core_web_vitals.si.value } : undefined,
              fid: r.core_web_vitals?.fid ? { value: r.core_web_vitals.fid.value } : undefined,
            },
          }));
          await ctx.runMutation(internal.seoAudit_actions.storePsiResults, {
            scanId: args.scanId,
            domainId: args.domainId,
            results: transformed,
          });
          console.log(`[PSI_POLL] Stored results for ${transformed.length} pages`);
          await ctx.runMutation(internal.notifications.createJobNotification, {
            domainId: args.domainId,
            type: "job_completed",
            title: "PageSpeed Insights analysis completed",
            message: `Analyzed ${transformed.length} pages`,
            jobType: "psi_analysis",
          });
        }
        return; // Done
      }

      if (pollData.status === "failed") {
        await ctx.runMutation(internal.notifications.createJobNotification, {
          domainId: args.domainId,
          type: "job_failed",
          title: "PageSpeed Insights analysis failed",
          message: "PSI batch job failed",
          jobType: "psi_analysis",
        });
        return; // Done
      }

      // Schedule next poll
      await ctx.scheduler.runAfter(10000, internal.seoAudit_actions.pollPsiJob, {
        ...args,
        attempt: args.attempt + 1,
      });
    } catch (e) {
      console.error("[PSI_POLL] Error:", e);
      await ctx.scheduler.runAfter(10000, internal.seoAudit_actions.pollPsiJob, {
        ...args,
        attempt: args.attempt + 1,
      });
    }
  },
});

// ============================================================================
// Mock Mode
// ============================================================================

/**
 * Generate realistic mock data for development without API credentials.
 * Creates pages with randomized check pass/fail, analysis summary,
 * sitemap data, robots data, and site-wide issue records.
 */
export const completeMockSeoAuditScan = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    domainName: v.string(),
  },
  handler: async (ctx, args) => {
    const mockPaths = [
      "/",
      "/about",
      "/contact",
      "/services",
      "/blog",
      "/products",
      "/pricing",
      "/team",
      "/faq",
      "/privacy",
      "/terms",
      "/careers",
      "/support",
      "/docs",
      "/api",
    ];

    const checkTypes = Object.keys(CHECK_CONFIG);
    let criticalIssues = 0;
    let warningCount = 0;
    let recommendationCount = 0;
    let totalScore = 0;
    const checkFailureCounts: Record<string, number> = {};
    const analysisIssues: Record<string, number> = {};

    for (let i = 0; i < mockPaths.length; i++) {
      const url = `https://${args.domainName}${mockPaths[i]}`;
      const passRate = 0.6 + Math.random() * 0.35; // 60-95%
      const passedCount = Math.floor(checkTypes.length * passRate);
      const failedCount = checkTypes.length - passedCount;
      const score = Math.round((passedCount / checkTypes.length) * 100);
      totalScore += score;

      // Randomly pick which checks fail
      const shuffled = [...checkTypes].sort(() => Math.random() - 0.5);
      const failedSet = new Set(shuffled.slice(0, failedCount));

      const checkResults: any[] = [];
      const issues: Array<{
        type: "critical" | "warning" | "recommendation";
        category: string;
        message: string;
      }> = [];

      for (const checkType of checkTypes) {
        const passed = !failedSet.has(checkType);
        const config = CHECK_CONFIG[checkType];

        checkResults.push({
          check: checkType,
          passed,
          result: passed
            ? `Check passed: ${config.title}`
            : config.description,
          arguments: {},
          audited_object: url,
        });

        if (!passed) {
          issues.push({
            type: config.severity,
            category: config.category,
            message: config.description,
          });

          if (config.severity === "critical") criticalIssues++;
          else if (config.severity === "warning") warningCount++;
          else recommendationCount++;

          checkFailureCounts[checkType] =
            (checkFailureCounts[checkType] || 0) + 1;
          if (config.analysisField) {
            analysisIssues[config.analysisField] =
              (analysisIssues[config.analysisField] || 0) + 1;
          }
        }
      }

      // Mock image alt data
      const mockImgCount = Math.floor(Math.random() * 8) + 1;
      const mockMissingAlt = Math.floor(Math.random() * Math.min(3, mockImgCount));
      const mockImageAlts = Array.from({ length: mockImgCount }, (_, idx) => ({
        src: `https://${args.domainName}/images/${mockPaths[i].slice(1) || "home"}-img${idx + 1}.webp`,
        alt: idx < mockImgCount - mockMissingAlt ? `${mockPaths[i].slice(1) || "home"} image ${idx + 1}` : "",
        hasAlt: idx < mockImgCount - mockMissingAlt,
        containsKeyword: false,
      }));

      // Mock Lighthouse scores
      const mockLighthouse = {
        performance: Math.floor(Math.random() * 30) + 65,
        accessibility: Math.floor(Math.random() * 20) + 78,
        bestPractices: Math.floor(Math.random() * 15) + 85,
        seo: Math.floor(Math.random() * 20) + 75,
      };

      // Mock Core Web Vitals
      const mockCwv = {
        largestContentfulPaint: +(1.2 + Math.random() * 2.5).toFixed(2),
        firstInputDelay: Math.floor(10 + Math.random() * 90),
        timeToInteractive: +(2 + Math.random() * 3).toFixed(2),
        domComplete: +(0.8 + Math.random() * 3).toFixed(2),
        cumulativeLayoutShift: +(Math.random() * 0.25).toFixed(3),
      };

      await ctx.db.insert("domainOnsitePages", {
        domainId: args.domainId,
        scanId: args.scanId,
        url,
        statusCode: 200,
        wordCount: Math.floor(Math.random() * 1500) + 200,
        onpageScore: score,
        checks: checkResults,
        issueCount: issues.length,
        issues,
        imagesCount: mockImgCount,
        imagesMissingAlt: mockMissingAlt,
        imageAlts: mockImageAlts,
        lighthouseScores: mockLighthouse,
        coreWebVitals: mockCwv,
        loadTime: +(0.5 + Math.random() * 4).toFixed(2),
        internalLinksCount: Math.floor(Math.random() * 30) + 5,
        externalLinksCount: Math.floor(Math.random() * 10),
      });
    }

    const healthScore = Math.round(totalScore / mockPaths.length);

    // Create analysis with Full Audit mock fields
    const mockSections = {
      technical: { score: 72, grade: "C", issues: [
        { issue: "Some pages have slow server response time", action: "Optimize server configuration and consider CDN", priority: "important" },
        { issue: "Missing XML sitemap entries", action: "Ensure all important pages are listed in sitemap.xml", priority: "minor" },
      ]},
      on_page: { score: 85, grade: "B", issues: [
        { issue: "Meta descriptions too short on 3 pages", action: "Write unique meta descriptions (120-160 chars)", priority: "important" },
      ]},
      content: { score: 78, grade: "C", issues: [
        { issue: "Thin content on 2 pages", action: "Expand content to at least 300 words per page", priority: "important" },
        { issue: "Duplicate content detected", action: "Use canonical tags or rewrite duplicate content", priority: "critical" },
      ]},
      links: { score: 90, grade: "A", issues: [
        { issue: "2 broken internal links detected", action: "Fix or remove broken links", priority: "critical" },
      ]},
      images: { score: 65, grade: "D", issues: [
        { issue: "5 images missing alt text", action: "Add descriptive alt text to all images", priority: "important" },
        { issue: "Large image files slowing page load", action: "Compress images and use modern formats (WebP)", priority: "important" },
      ]},
      structured_data: { score: 40, grade: "F", issues: [
        { issue: "No structured data found", action: "Add Schema.org markup (Organization, Article, etc.)", priority: "important" },
      ]},
    };
    const mockAllIssues = Object.entries(mockSections).flatMap(([section, data]) =>
      data.issues.map((i: any) => ({ ...i, section }))
    );
    const mockRecommendations = [
      "Add structured data markup to improve search appearance",
      "Optimize image sizes to improve page load time",
      "Fix broken internal links to improve crawlability",
      "Expand thin content pages to at least 300 words",
      "Implement canonical tags for duplicate content",
    ];

    const analysisId = await ctx.db.insert("domainOnsiteAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      healthScore,
      totalPages: mockPaths.length,
      criticalIssues,
      warnings: warningCount,
      recommendations: recommendationCount,
      avgWordCount: 847,
      // Full Audit fields
      grade: healthScore >= 90 ? "A" : healthScore >= 80 ? "B" : healthScore >= 70 ? "C" : healthScore >= 60 ? "D" : "F",
      sections: mockSections,
      allIssues: mockAllIssues,
      auditRecommendations: mockRecommendations,
      pagesAnalyzed: mockPaths.length,
      issues: {
        missingTitles: 0,
        missingMetaDescriptions: 0,
        duplicateContent: 0,
        brokenLinks: 0,
        slowPages: 0,
        suboptimalTitles: 0,
        thinContent: 0,
        missingH1: analysisIssues.missingH1 || 0,
        largeImages: 0,
        missingAltText: 0,
        missingHttps: analysisIssues.missingHttps || 0,
        missingCanonical: analysisIssues.missingCanonical || 0,
        missingRobotsMeta: analysisIssues.missingRobotsMeta || 0,
        notMobileFriendly: analysisIssues.notMobileFriendly || 0,
        missingStructuredData: analysisIssues.missingStructuredData || 0,
        largeDomSize: analysisIssues.largeDomSize || 0,
        tooManyElements: analysisIssues.tooManyElements || 0,
        highElementSimilarity: analysisIssues.highElementSimilarity || 0,
        lowTextToCodeRatio: analysisIssues.lowTextToCodeRatio || 0,
      },
      fetchedAt: Date.now(),
    });

    // Link pages to analysis
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_scan", (q) => q.eq("scanId", args.scanId))
      .collect();
    for (const page of pages) {
      await ctx.db.patch(page._id, { analysisId });
    }

    // Create site-wide issues
    for (const [checkType, count] of Object.entries(checkFailureCounts)) {
      const config = CHECK_CONFIG[checkType];
      if (!config || count === 0) continue;

      await ctx.db.insert("onSiteIssues", {
        scanId: args.scanId,
        domainId: args.domainId,
        severity: config.severity,
        category: config.category,
        title: config.title,
        description: config.description,
        affectedPages: count,
        detectedAt: Date.now(),
      });
    }

    // Mock sitemap
    await ctx.db.insert("domainSitemapData", {
      domainId: args.domainId,
      scanId: args.scanId,
      sitemapUrl: `https://${args.domainName}/sitemap.xml`,
      totalUrls: mockPaths.length,
      urls: mockPaths.map((p) => `https://${args.domainName}${p}`),
      fetchedAt: Date.now(),
    });

    // Mock robots
    await ctx.db.insert("domainRobotsData", {
      domainId: args.domainId,
      scanId: args.scanId,
      robotsUrl: `https://${args.domainName}/robots.txt`,
      directives: {
        user_agent: ["*"],
        allow: ["/"],
        disallow: ["/admin/", "/private/", "/wp-admin/"],
        sitemap: [`https://${args.domainName}/sitemap.xml`],
      },
      fetchedAt: Date.now(),
    });

    // Mock crawl analytics data
    // Link analysis
    const mockLinks = mockPaths.slice(0, 8).flatMap((fromPath) =>
      mockPaths.slice(0, 4).map((toPath) => ({
        sourceUrl: `https://${args.domainName}${fromPath}`,
        targetUrl: `https://${args.domainName}${toPath}`,
        anchorText: toPath === "/" ? "Home" : toPath.slice(1).replace(/-/g, " "),
        nofollow: Math.random() < 0.1,
        internal: true,
      }))
    );
    const externalLinks = [
      { sourceUrl: `https://${args.domainName}/blog`, targetUrl: "https://example.com/resource", anchorText: "External resource", nofollow: false, internal: false },
      { sourceUrl: `https://${args.domainName}/about`, targetUrl: "https://twitter.com/example", anchorText: "Follow us", nofollow: true, internal: false },
      { sourceUrl: `https://${args.domainName}/products`, targetUrl: "https://partner.com", anchorText: "Our partner", nofollow: false, internal: false },
    ];
    const allMockLinks = [...mockLinks, ...externalLinks];
    await ctx.db.insert("crawlLinkAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      totalLinks: allMockLinks.length,
      internalLinks: mockLinks.length,
      externalLinks: externalLinks.length,
      nofollowLinks: allMockLinks.filter((l) => l.nofollow).length,
      links: allMockLinks,
      fetchedAt: Date.now(),
    });

    // Redirect analysis
    await ctx.db.insert("crawlRedirectAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      totalRedirects: 3,
      redirects: [
        { sourceUrl: `https://${args.domainName}/old-about`, targetUrl: `https://${args.domainName}/about`, statusCode: 301, chain: [], chainLength: 1 },
        { sourceUrl: `http://${args.domainName}/`, targetUrl: `https://${args.domainName}/`, statusCode: 301, chain: [], chainLength: 1 },
        { sourceUrl: `https://${args.domainName}/legacy`, targetUrl: `https://${args.domainName}/old-page`, statusCode: 302, chain: [{ url: `https://${args.domainName}/old-page`, statusCode: 301 }], chainLength: 2 },
      ],
      fetchedAt: Date.now(),
    });

    // Image analysis
    const mockImages = mockPaths.slice(0, 6).map((path, i) => ({
      pageUrl: `https://${args.domainName}${path}`,
      imageUrl: `https://${args.domainName}/images/img-${i + 1}.jpg`,
      alt: i % 3 === 0 ? "" : `Image for ${path.slice(1) || "homepage"}`,
      missingAlt: i % 3 === 0,
    }));
    await ctx.db.insert("crawlImageAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      totalImages: mockImages.length,
      missingAltCount: mockImages.filter((img) => img.missingAlt).length,
      images: mockImages,
      fetchedAt: Date.now(),
    });

    // Word frequency (unigrams)
    await ctx.db.insert("crawlWordFrequency", {
      domainId: args.domainId,
      scanId: args.scanId,
      phraseLength: 1,
      totalWords: 12450,
      data: [
        { word: "services", absFreq: 89 }, { word: "solutions", absFreq: 76 },
        { word: "team", absFreq: 62 }, { word: "products", absFreq: 58 },
        { word: "contact", absFreq: 45 }, { word: "learn", absFreq: 42 },
        { word: "business", absFreq: 39 }, { word: "support", absFreq: 36 },
        { word: "pricing", absFreq: 33 }, { word: "features", absFreq: 31 },
        { word: "customers", absFreq: 28 }, { word: "platform", absFreq: 25 },
        { word: "security", absFreq: 23 }, { word: "data", absFreq: 21 },
        { word: "help", absFreq: 19 }, { word: "blog", absFreq: 17 },
        { word: "privacy", absFreq: 15 }, { word: "about", absFreq: 14 },
        { word: "careers", absFreq: 12 }, { word: "integration", absFreq: 10 },
      ],
      fetchedAt: Date.now(),
    });

    // Word frequency (bigrams)
    await ctx.db.insert("crawlWordFrequency", {
      domainId: args.domainId,
      scanId: args.scanId,
      phraseLength: 2,
      totalWords: 8200,
      data: [
        { word: "our team", absFreq: 34 }, { word: "learn more", absFreq: 29 },
        { word: "get started", absFreq: 25 }, { word: "contact us", absFreq: 22 },
        { word: "free trial", absFreq: 18 }, { word: "customer support", absFreq: 16 },
        { word: "privacy policy", absFreq: 14 }, { word: "terms service", absFreq: 12 },
        { word: "case study", absFreq: 11 }, { word: "best practices", absFreq: 9 },
      ],
      fetchedAt: Date.now(),
    });

    // Robots test results
    await ctx.db.insert("crawlRobotsTestResults", {
      domainId: args.domainId,
      scanId: args.scanId,
      robotstxtUrl: `https://${args.domainName}/robots.txt`,
      results: mockPaths.slice(0, 5).flatMap((path) => [
        { userAgent: "Googlebot", urlPath: `https://${args.domainName}${path}`, canFetch: true },
        { userAgent: "Bingbot", urlPath: `https://${args.domainName}${path}`, canFetch: true },
        { userAgent: "*", urlPath: `https://${args.domainName}${path}`, canFetch: true },
      ]).concat([
        { userAgent: "Googlebot", urlPath: `https://${args.domainName}/admin/`, canFetch: false },
        { userAgent: "Bingbot", urlPath: `https://${args.domainName}/admin/`, canFetch: false },
        { userAgent: "*", urlPath: `https://${args.domainName}/admin/`, canFetch: false },
      ]),
      fetchedAt: Date.now(),
    });

    // Enrich mock pages with crawl-like data
    for (const page of pages) {
      await ctx.db.patch(page._id, {
        title: `${page.url.split("/").pop() || "Home"} | ${args.domainName}`,
        h1: page.url === `https://${args.domainName}/` ? "Welcome" : (page.url.split("/").pop() || "Page").replace(/-/g, " "),
        internalLinksCount: Math.floor(Math.random() * 20) + 3,
        externalLinksCount: Math.floor(Math.random() * 5),
        loadTime: Math.round((Math.random() * 3 + 0.5) * 100) / 100,
        pageSize: Math.floor(Math.random() * 200000) + 10000,
      });
    }

    // Complete scan
    await ctx.db.patch(args.scanId, {
      status: "complete",
      completedAt: Date.now(),
      source: "mock",
      seoAuditStatus: "completed",
      advertoolsCrawlStatus: "completed",
      summary: {
        totalPages: mockPaths.length,
        totalIssues: criticalIssues + warningCount + recommendationCount,
        crawlTime: 45,
      },
    });

    console.log("[MOCK] SEO audit mock scan completed (with crawl analytics)");
  },
});
