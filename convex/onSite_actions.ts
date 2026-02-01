import { v } from "convex/values";
import { mutation, action, internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// DataForSEO API configuration
const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

/**
 * Trigger an on-site scan for a domain
 * This creates a scan record and schedules background processing
 * Returns immediately with the scanId
 */
export const triggerOnSiteScan = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Check if there's already a scan in progress
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

    // Create scan record with status "queued"
    const scanId = await ctx.db.insert("onSiteScans", {
      domainId: args.domainId,
      status: "queued",
      startedAt: Date.now(),
    });

    // Schedule background processing
    await ctx.scheduler.runAfter(0, internal.onSite_actions.processOnSiteScanInternal, {
      scanId,
    });

    return scanId;
  },
});

/**
 * Internal action that processes the on-site scan in the background
 * This does all the actual API work
 */
export const processOnSiteScanInternal = internalAction({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    console.log(`[SCAN] Starting processOnSiteScanInternal for scanId=${args.scanId}`);

    // Get scan record
    const scan = await ctx.runQuery(internal.onSite_queries.getScanById, {
      scanId: args.scanId,
    });

    if (!scan) {
      console.error("[SCAN] ERROR: Scan not found:", args.scanId);
      return;
    }

    console.log(`[SCAN] Found scan record, domainId=${scan.domainId}`);

    // Get domain info
    const domain: any = await ctx.runQuery(internal.queries.competitorsInternal.getDomainById, {
      domainId: scan.domainId,
    });

    if (!domain) {
      console.error("[SCAN] ERROR: Domain not found for domainId:", scan.domainId);
      await ctx.runMutation(internal.onSite_actions.failScan, {
        scanId: args.scanId,
        error: "Domain not found",
      });
      return;
    }

    console.log(`[SCAN] Found domain: ${domain.domain}`);

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    // If no credentials, simulate scan for development (mock mode)
    if (!login || !password) {
      console.log("[SCAN] DEV MODE: Simulating on-site scan for", domain.domain);

      // Update status to processing
      await ctx.runMutation(internal.onSite_actions.updateScanStatus, {
        scanId: args.scanId,
        status: "processing",
      });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete mock scan
      await ctx.runMutation(internal.onSite_actions.completeMockScan, {
        scanId: args.scanId,
        domainId: scan.domainId,
      });

      return;
    }

    // Real API processing
    try {
      console.log("[SCAN] REAL MODE: Using DataForSEO API");
      const authHeader = btoa(`${login}:${password}`);

      // Update status to crawling
      console.log("[SCAN] Updating status to 'crawling'");
      await ctx.runMutation(internal.onSite_actions.updateScanStatus, {
        scanId: args.scanId,
        status: "crawling",
      });

      // DataForSEO On-Page API: task_post endpoint
      console.log(`[SCAN] Posting task to DataForSEO for domain: ${domain.domain}`);
      const response = await fetch(`${DATAFORSEO_API_URL}/on_page/task_post`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{
          target: domain.domain,
          max_crawl_pages: 100,
          enable_javascript: true,
          load_resources: true,
          enable_browser_rendering: true,
          calculate_keyword_density: true,
          check_spell: false,
        }]),
      });

      console.log(`[SCAN] DataForSEO response status: ${response.status}`);

      if (!response.ok) {
        console.error(`[SCAN] API error: ${response.status}`);
        await ctx.runMutation(internal.onSite_actions.failScan, {
          scanId: args.scanId,
          error: `API error: ${response.status}`,
        });
        return;
      }

      const data = await response.json();
      console.log(`[SCAN] API response status_code: ${data.status_code}`);

      if (data.status_code !== 20000) {
        console.error(`[SCAN] API returned error: ${data.status_message}`);
        await ctx.runMutation(internal.onSite_actions.failScan, {
          scanId: args.scanId,
          error: data.status_message || "Unknown API error",
        });
        return;
      }

      const taskId = data.tasks?.[0]?.id;
      console.log(`[SCAN] Received taskId: ${taskId}`);

      if (!taskId) {
        console.error("[SCAN] No task ID in response");
        await ctx.runMutation(internal.onSite_actions.failScan, {
          scanId: args.scanId,
          error: "No task ID returned from API",
        });
        return;
      }

      // Update scan with task ID
      console.log("[SCAN] Updating scan with taskId");
      await ctx.runMutation(internal.onSite_actions.updateScanTaskId, {
        scanId: args.scanId,
        taskId,
      });

      // Schedule polling for scan completion
      console.log("[SCAN] Scheduling first poll in 30s");
      await ctx.scheduler.runAfter(30000, internal.onSite_actions.pollScanStatus, {
        scanId: args.scanId,
        taskId,
        domainId: scan.domainId,
      });

    } catch (error) {
      await ctx.runMutation(internal.onSite_actions.failScan, {
        scanId: args.scanId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

/**
 * Poll DataForSEO for scan completion status
 */
export const pollScanStatus = internalAction({
  args: {
    scanId: v.id("onSiteScans"),
    taskId: v.string(),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    console.log(`[POLL] Checking scan status for scanId=${args.scanId}, taskId=${args.taskId}`);

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      console.log("[POLL] Mock mode - skipping polling");
      return; // Mock scans complete immediately
    }

    try {
      const authHeader = btoa(`${login}:${password}`);

      // First, fetch progress from summary endpoint
      console.log(`[POLL] Fetching progress from /on_page/summary/${args.taskId}`);
      const summaryResponse = await fetch(
        `${DATAFORSEO_API_URL}/on_page/summary/${args.taskId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Basic ${authHeader}`,
          },
        }
      );

      let summaryResult = null;

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summaryResult = summaryData?.tasks?.[0]?.result?.[0];

        if (summaryResult) {
          const crawlProgress = summaryResult.crawl_progress || {};
          const crawlStatus = summaryResult.crawl_status || {};
          const pagesScanned = crawlStatus.pages_crawled || 0;
          const pagesInQueue = crawlStatus.pages_in_queue || 0;
          const totalPages = pagesScanned + pagesInQueue;

          console.log(`[POLL] Progress: ${pagesScanned} pages scanned, ${pagesInQueue} in queue, ${totalPages} total`);

          // Update progress
          await ctx.runMutation(internal.onSite_actions.updateScanProgress, {
            scanId: args.scanId,
            pagesScanned,
            totalPagesToScan: totalPages > 0 ? totalPages : undefined,
          });
        } else {
          console.log("[POLL] No summary result yet");
        }
      } else {
        console.log(`[POLL] Summary endpoint returned ${summaryResponse.status}`);
      }

      // Check if crawl is finished in summary (more reliable than tasks_ready)
      const crawlProgress = summaryResult?.crawl_progress;
      console.log(`[POLL] Crawl progress status: ${crawlProgress}`);

      if (crawlProgress === "finished") {
        // Crawl is finished! Fetch results immediately
        console.log("[POLL] Crawl is FINISHED! Fetching final results now");
        await ctx.runAction(internal.onSite_actions.fetchScanResults, {
          scanId: args.scanId,
          taskId: args.taskId,
          domainId: args.domainId,
        });
        return;
      }

      // Crawl still in progress, check tasks_ready as fallback
      console.log(`[POLL] Crawl not finished yet (status: ${crawlProgress}), checking tasks_ready`);
      const response = await fetch(
        `${DATAFORSEO_API_URL}/on_page/tasks_ready`,
        {
          method: "GET",
          headers: {
            "Authorization": `Basic ${authHeader}`,
          },
        }
      );

      const data = await response.json();
      const task = data.tasks?.find((t: any) => t.id === args.taskId);

      if (task) {
        // Task is in ready queue (alternative way to detect completion)
        console.log("[POLL] Task found in tasks_ready! Fetching final results");
        await ctx.runAction(internal.onSite_actions.fetchScanResults, {
          scanId: args.scanId,
          taskId: args.taskId,
          domainId: args.domainId,
        });
        return;
      }

      // Not ready yet, poll again in 30 seconds
      console.log("[POLL] Task not ready yet, scheduling next poll in 30s");
      await ctx.scheduler.runAfter(30000, internal.onSite_actions.pollScanStatus, {
        scanId: args.scanId,
        taskId: args.taskId,
        domainId: args.domainId,
      });

    } catch (error) {
      console.error("[POLL] Error polling scan status:", error);
      // Retry polling
      console.log("[POLL] Scheduling retry in 30s");
      await ctx.scheduler.runAfter(30000, internal.onSite_actions.pollScanStatus, {
        scanId: args.scanId,
        taskId: args.taskId,
        domainId: args.domainId,
      });
    }
  },
});

/**
 * Fetch and process scan results from DataForSEO
 */
export const fetchScanResults = internalAction({
  args: {
    scanId: v.id("onSiteScans"),
    taskId: v.string(),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    console.log(`[FETCH] Starting fetchScanResults for scanId=${args.scanId}, taskId=${args.taskId}`);

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      console.log("[FETCH] No credentials, skipping");
      return;
    }

    try {
      const authHeader = btoa(`${login}:${password}`);

      // Fetch summary
      console.log(`[FETCH] Fetching summary from /on_page/summary/${args.taskId}`);
      const summaryResponse = await fetch(
        `${DATAFORSEO_API_URL}/on_page/summary/${args.taskId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Basic ${authHeader}`,
          },
        }
      );

      console.log(`[FETCH] Summary response status: ${summaryResponse.status}`);
      const summaryData = await summaryResponse.json();
      console.log(`[FETCH] Summary status_code: ${summaryData.status_code}`);

      // Fetch pages
      console.log(`[FETCH] Fetching pages from /on_page/pages/${args.taskId}`);
      const pagesResponse = await fetch(
        `${DATAFORSEO_API_URL}/on_page/pages/${args.taskId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Basic ${authHeader}`,
          },
        }
      );

      console.log(`[FETCH] Pages response status: ${pagesResponse.status}`);
      const pagesData = await pagesResponse.json();
      console.log(`[FETCH] Pages status_code: ${pagesData.status_code}, message: ${pagesData.status_message}`);

      // Check for DataForSEO error
      if (pagesData.status_code !== 20000) {
        console.error(`[FETCH] DataForSEO pages error: ${pagesData.status_code} - ${pagesData.status_message}`);
        // Try to continue with summary data only
        console.log("[FETCH] Continuing with summary data only (no pages)");
      }

      const pagesCount = pagesData?.tasks?.[0]?.result?.length || 0;
      console.log(`[FETCH] Received ${pagesCount} pages from API`);

      // Process and store results
      console.log(`[FETCH] Calling storeScanResults mutation`);
      await ctx.runMutation(internal.onSite_actions.storeScanResults, {
        scanId: args.scanId,
        domainId: args.domainId,
        summary: summaryData,
        pages: pagesData,
      });

      console.log(`[FETCH] storeScanResults completed successfully`);

    } catch (error) {
      console.error("[FETCH] Error fetching scan results:", error);
      await ctx.runMutation(internal.onSite_actions.failScan, {
        scanId: args.scanId,
        error: error instanceof Error ? error.message : "Failed to fetch results",
      });
    }
  },
});

/**
 * Internal mutations
 */

export const createScanRecord = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.insert("onSiteScans", {
      domainId: args.domainId,
      status: "queued",
      startedAt: Date.now(),
    });
  },
});

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
    await ctx.db.patch(args.scanId, {
      status: args.status,
    });
  },
});

export const updateScanProgress = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    pagesScanned: v.number(),
    totalPagesToScan: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      pagesScanned: args.pagesScanned,
      totalPagesToScan: args.totalPagesToScan,
      lastProgressUpdate: Date.now(),
    });
  },
});

export const deleteScan = mutation({
  args: {
    scanId: v.id("onSiteScans"),
  },
  handler: async (ctx, args) => {
    // Delete the scan
    await ctx.db.delete(args.scanId);
  },
});

export const deleteOldScans = mutation({
  args: {
    domainId: v.id("domains"),
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysThreshold = args.olderThanDays || 7;
    const thresholdTime = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);

    const oldScans = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.lt(q.field("startedAt"), thresholdTime))
      .collect();

    let deleted = 0;
    for (const scan of oldScans) {
      await ctx.db.delete(scan._id);
      deleted++;
    }

    return { deleted, total: oldScans.length };
  },
});

export const deleteAllScansForDomain = mutation({
  args: {
    domainName: v.string(),
  },
  handler: async (ctx, args) => {
    // Find domain by name
    const domain = await ctx.db
      .query("domains")
      .filter((q) => q.eq(q.field("domain"), args.domainName))
      .first();

    if (!domain) {
      return { error: `Domain not found: ${args.domainName}`, deleted: 0 };
    }

    // Find all scans for this domain
    const scans = await ctx.db
      .query("onSiteScans")
      .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
      .collect();

    let deleted = 0;
    for (const scan of scans) {
      await ctx.db.delete(scan._id);
      deleted++;
    }

    return {
      success: true,
      domainId: domain._id,
      domainName: domain.domain,
      deleted,
      scans: scans.map(s => ({ id: s._id, status: s.status, startedAt: s.startedAt }))
    };
  },
});

export const updateScanTaskId = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      taskId: args.taskId,
      status: "crawling",
    });
  },
});

export const failScan = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

/**
 * Fetch broken resources details from DataForSEO
 */
export const fetchBrokenResources = internalAction({
  args: {
    taskId: v.string(),
    scanId: v.id("onSiteScans"),
  },
  handler: async (ctx, args) => {
    console.log(`[BROKEN] Fetching broken resources for taskId=${args.taskId}`);

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      console.log("[BROKEN] No credentials");
      return { resources: [] };
    }

    try {
      const authHeader = btoa(`${login}:${password}`);

      // Fetch broken resources
      const response = await fetch(
        `${DATAFORSEO_API_URL}/on_page/resources`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([{
            id: args.taskId,
            filters: [
              ["checks.is_broken", "=", true]
            ],
            limit: 500,
          }]),
        }
      );

      console.log(`[BROKEN] Response status: ${response.status}`);
      const data = await response.json();
      console.log(`[BROKEN] Status code: ${data.status_code}`);

      if (data.status_code !== 20000) {
        console.error(`[BROKEN] API error: ${data.status_message}`);
        return { resources: [], error: data.status_message };
      }

      const resources = data.tasks?.[0]?.result || [];
      console.log(`[BROKEN] Found ${resources.length} broken resources`);

      return { resources, total: resources.length };
    } catch (error) {
      console.error("[BROKEN] Error fetching broken resources:", error);
      return { resources: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Debug action to check DataForSEO task status directly
 */
export const debugCheckTaskStatus = internalAction({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return { error: "No credentials" };
    }

    const authHeader = btoa(`${login}:${password}`);

    // Fetch summary
    const summaryResponse = await fetch(
      `${DATAFORSEO_API_URL}/on_page/summary/${args.taskId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authHeader}`,
        },
      }
    );

    const summaryData = await summaryResponse.json();

    // Also check tasks_ready
    const readyResponse = await fetch(
      `${DATAFORSEO_API_URL}/on_page/tasks_ready`,
      {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authHeader}`,
        },
      }
    );

    const readyData = await readyResponse.json();
    const task = readyData.tasks?.find((t: any) => t.id === args.taskId);

    return {
      summary: summaryData,
      isReady: !!task,
      readyTask: task || null,
    };
  },
});

/**
 * Generic internal action to fetch pages with specific issues
 */
export const fetchPagesWithIssue = internalAction({
  args: {
    taskId: v.string(),
    scanId: v.id("onSiteScans"),
    filters: v.array(v.array(v.any())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log(`[PAGES] Fetching pages with filters for taskId=${args.taskId}`);

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      console.log("[PAGES] No credentials");
      return { pages: [] };
    }

    try {
      const authHeader = btoa(`${login}:${password}`);

      const response = await fetch(
        `${DATAFORSEO_API_URL}/on_page/pages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([{
            id: args.taskId,
            filters: args.filters,
            limit: args.limit || 100,
            fields: ["url", "meta.title", "meta.description", "meta.htags", "checks", "page_timing", "size", "total_dom_size"],
          }]),
        }
      );

      console.log(`[PAGES] Response status: ${response.status}`);
      const data = await response.json();
      console.log(`[PAGES] Status code: ${data.status_code}`);

      if (data.status_code !== 20000) {
        console.error(`[PAGES] API error: ${data.status_message}`);
        return { pages: [], error: data.status_message };
      }

      const pages = data.tasks?.[0]?.result || [];
      console.log(`[PAGES] Found ${pages.length} pages`);

      return { pages, total: pages.length };
    } catch (error) {
      console.error("[PAGES] Error fetching pages:", error);
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch and return broken resources details (public action)
 */
export const getBrokenResourcesDetails = action({
  args: {
    scanId: v.id("onSiteScans"),
  },
  handler: async (ctx, args): Promise<{ resources: any[]; total?: number; error?: string }> => {
    const scan = await ctx.runQuery(internal.onSite_queries.getScanById, {
      scanId: args.scanId,
    });

    if (!scan) {
      throw new Error("Scan not found");
    }

    if (!scan.taskId) {
      throw new Error("No task ID available for this scan");
    }

    // Fetch broken resources from DataForSEO
    const result = await ctx.runAction(internal.onSite_actions.fetchBrokenResources, {
      taskId: scan.taskId,
      scanId: args.scanId,
    });

    return result;
  },
});

/**
 * Fetch pages missing titles from DATABASE
 */
export const getMissingTitlesDetails = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getPagesWithMissingTitles, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch pages missing meta descriptions from DATABASE
 */
export const getMissingMetaDescriptionsDetails = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getPagesWithMissingMetaDescriptions, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch pages missing H1 tags from DATABASE
 */
export const getMissingH1Details = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getPagesWithMissingH1, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch slow pages (load time > 3 seconds) from DATABASE
 */
export const getSlowPagesDetails = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getSlowPages, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch pages with duplicate content from DATABASE
 */
export const getDuplicateContentDetails = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getPagesWithDuplicateContent, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch pages with thin content (< 300 words) from DATABASE
 */
export const getThinContentDetails = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getPagesWithThinContent, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Fetch pages with broken outbound links from DATABASE
 */
export const getBrokenLinksDetails = action({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args): Promise<{ pages: any[]; total?: number; error?: string }> => {
    try {
      const pages = await ctx.runQuery(api.onSite_queries.getPagesWithBrokenLinks, { scanId: args.scanId });
      return { pages, total: pages.length };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

/**
 * Cancel an ongoing scan (public mutation)
 * Marks the scan as failed with a cancellation message
 */
export const cancelOnSiteScan = mutation({
  args: { scanId: v.id("onSiteScans") },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);

    if (!scan) {
      throw new Error("Scan not found");
    }

    // Only allow cancelling scans that are in progress
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

export const storeScanResults = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    summary: v.any(),
    pages: v.any(),
  },
  handler: async (ctx, args) => {
    console.log("[STORE] Starting storeScanResults");
    const summaryResult = args.summary?.tasks?.[0]?.result?.[0];
    const pagesResult = args.pages?.tasks?.[0]?.result || [];

    console.log(`[STORE] summaryResult exists: ${!!summaryResult}`);
    console.log(`[STORE] pagesResult count: ${pagesResult.length}`);

    // Calculate health score and issue counts
    let criticalIssues = 0;
    let warnings = 0;
    let recommendations = 0;
    let totalWordCount = 0;
    let totalLoadTime = 0;
    let pageCount = 0;

    const issueCounters = {
      missingTitles: 0,
      missingMetaDescriptions: 0,
      duplicateContent: 0,
      brokenLinks: 0,
      slowPages: 0,
      suboptimalTitles: 0,
      thinContent: 0,
      missingH1: 0,
      largeImages: 0,
      missingAltText: 0,
    };

    // If no individual pages, use summary page_metrics
    if (pagesResult.length === 0 && summaryResult?.page_metrics) {
      console.log("[STORE] No individual pages, using summary page_metrics");
      const checks = summaryResult.page_metrics.checks || {};
      const totalPages = summaryResult.crawl_status?.pages_crawled || 0;

      // Map DataForSEO checks to our issue counters
      issueCounters.missingTitles = checks.no_title || 0;
      issueCounters.missingMetaDescriptions = checks.no_description || 0;
      issueCounters.missingH1 = checks.no_h1_tag || 0;
      issueCounters.brokenLinks = summaryResult.page_metrics.broken_links || 0;
      issueCounters.duplicateContent = summaryResult.page_metrics.duplicate_content || 0;
      issueCounters.slowPages = checks.high_loading_time || 0;
      issueCounters.suboptimalTitles = (checks.title_too_long || 0) + (checks.title_too_short || 0);
      issueCounters.thinContent = checks.low_content_rate || 0;
      issueCounters.largeImages = checks.size_greater_than_3mb || 0;
      issueCounters.missingAltText = checks.no_image_alt || 0;

      // Calculate issue severities
      // Note: brokenLinks is total site count, not per-page, so we count it directly
      criticalIssues = issueCounters.missingTitles + issueCounters.missingH1 + issueCounters.brokenLinks;
      warnings = issueCounters.missingMetaDescriptions + issueCounters.slowPages + issueCounters.duplicateContent;
      recommendations = issueCounters.suboptimalTitles + issueCounters.thinContent + issueCounters.largeImages + issueCounters.missingAltText;

      pageCount = totalPages;
      console.log(`[STORE] Calculated from summary: ${totalPages} pages, ${criticalIssues} critical, ${warnings} warnings, ${recommendations} recommendations`);
    }

    // Process individual pages if available
    for (const page of pagesResult) {
      const checks = page.checks || {};
      const meta = page.meta || {};

      const issues: Array<{
        type: "critical" | "warning" | "recommendation";
        category: string;
        message: string;
      }> = [];

      // Check for issues
      if (!meta.title || meta.title.length === 0) {
        issues.push({ type: "critical", category: "meta_tags", message: "Missing title tag" });
        issueCounters.missingTitles++;
        criticalIssues++;
      }

      if (!meta.description || meta.description.length === 0) {
        issues.push({ type: "warning", category: "meta_tags", message: "Missing meta description" });
        issueCounters.missingMetaDescriptions++;
        warnings++;
      }

      if (!meta.h1 || meta.h1.length === 0) {
        issues.push({ type: "warning", category: "headings", message: "Missing H1 tag" });
        issueCounters.missingH1++;
        warnings++;
      }

      if (meta.content && meta.content.plain_text_word_count < 300) {
        issues.push({ type: "recommendation", category: "content", message: "Thin content (< 300 words)" });
        issueCounters.thinContent++;
        recommendations++;
      }

      // Store page
      await ctx.db.insert("domainOnsitePages", {
        domainId: args.domainId,
        scanId: args.scanId,
        analysisId: args.scanId as any, // Will be updated after analysis created
        url: page.url || "",
        statusCode: page.status_code || 200,
        title: meta.title?.[0] || undefined,
        metaDescription: meta.description?.[0] || undefined,
        h1: meta.h1?.[0] || undefined,
        wordCount: meta.content?.plain_text_word_count || 0,
        loadTime: page.page_timing?.time_to_interactive || undefined,
        pageSize: page.page_timing?.page_load_time || undefined,
        issueCount: issues.length,
        issues,
      });

      if (meta.content?.plain_text_word_count) {
        totalWordCount += meta.content.plain_text_word_count;
        pageCount++;
      }

      if (page.page_timing?.time_to_interactive) {
        totalLoadTime += page.page_timing.time_to_interactive;
      }
    }

    // Calculate health score (0-100)
    const totalIssues = criticalIssues + warnings + recommendations;
    let healthScore = Math.max(0, Math.min(100,
      100 - (criticalIssues * 5) - (warnings * 2) - (recommendations * 0.5)
    ));

    // Use DataForSEO's onpage_score if available (more accurate)
    if (summaryResult?.page_metrics?.onpage_score) {
      healthScore = summaryResult.page_metrics.onpage_score;
      console.log(`[STORE] Using DataForSEO onpage_score: ${healthScore}`);
    }

    const finalPageCount = pagesResult.length > 0 ? pagesResult.length : (summaryResult?.crawl_status?.pages_crawled || 0);
    console.log(`[STORE] Creating analysis: healthScore=${Math.round(healthScore)}, totalPages=${finalPageCount}`);

    // Create analysis summary
    const analysisId = await ctx.db.insert("domainOnsiteAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      healthScore: Math.round(healthScore),
      totalPages: finalPageCount,
      criticalIssues,
      warnings,
      recommendations,
      avgLoadTime: pageCount > 0 ? totalLoadTime / pageCount : undefined,
      avgWordCount: pageCount > 0 ? Math.round(totalWordCount / pageCount) : undefined,
      issues: issueCounters,
      fetchedAt: Date.now(),
    });

    console.log(`[STORE] Analysis created with ID: ${analysisId}`);

    // Update scan to complete
    console.log("[STORE] Updating scan status to complete");
    await ctx.db.patch(args.scanId, {
      status: "complete",
      completedAt: Date.now(),
      summary: {
        totalPages: finalPageCount,
        totalIssues,
        crawlTime: summaryResult?.crawl_progress?.pages_in_queue || 0,
      },
    });

    console.log("[STORE] storeScanResults completed successfully");
  },
});

/**
 * Mock scan completion for development
 */
export const completeMockScan = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    // Generate mock data
    const mockPages = 15;
    const issues = {
      missingTitles: 2,
      missingMetaDescriptions: 5,
      duplicateContent: 1,
      brokenLinks: 3,
      slowPages: 4,
      suboptimalTitles: 6,
      thinContent: 3,
      missingH1: 2,
      largeImages: 7,
      missingAltText: 10,
    };

    const criticalIssues = issues.missingTitles + issues.brokenLinks + issues.missingH1;
    const warnings = issues.missingMetaDescriptions + issues.slowPages + issues.duplicateContent;
    const recommendations = issues.suboptimalTitles + issues.thinContent + issues.largeImages + issues.missingAltText;

    const healthScore = 100 - (criticalIssues * 5) - (warnings * 2) - (recommendations * 0.5);

    // Create analysis
    const analysisId = await ctx.db.insert("domainOnsiteAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      healthScore: Math.round(healthScore),
      totalPages: mockPages,
      criticalIssues,
      warnings,
      recommendations,
      avgLoadTime: 2.3,
      avgWordCount: 847,
      issues,
      fetchedAt: Date.now(),
    });

    // Create mock pages
    const urls = ["/", "/about", "/contact", "/services", "/blog", "/products", "/pricing", "/team", "/faq", "/privacy", "/terms", "/careers", "/support", "/docs", "/api"];

    for (let i = 0; i < mockPages; i++) {
      const pageIssues: Array<{ type: "critical" | "warning" | "recommendation"; category: string; message: string }> = [];
      const issueCount = Math.floor(Math.random() * 3);

      if (Math.random() > 0.8) {
        pageIssues.push({ type: "critical", category: "meta_tags", message: "Missing title tag" });
      }
      if (Math.random() > 0.7) {
        pageIssues.push({ type: "warning", category: "meta_tags", message: "Missing meta description" });
      }
      if (Math.random() > 0.9) {
        pageIssues.push({ type: "warning", category: "headings", message: "Missing H1 tag" });
      }

      await ctx.db.insert("domainOnsitePages", {
        domainId: args.domainId,
        scanId: args.scanId,
        analysisId,
        url: urls[i] || `/page-${i}`,
        statusCode: Math.random() > 0.95 ? 404 : 200,
        title: `Page ${i + 1}`,
        metaDescription: Math.random() > 0.3 ? `Description for page ${i + 1}` : undefined,
        h1: Math.random() > 0.2 ? `Heading ${i + 1}` : undefined,
        wordCount: Math.floor(Math.random() * 1500) + 200,
        loadTime: Math.random() * 5 + 0.5,
        pageSize: Math.floor(Math.random() * 500000) + 50000,
        issueCount: pageIssues.length,
        issues: pageIssues,
      });
    }

    // Update scan to complete
    await ctx.db.patch(args.scanId, {
      status: "complete",
      completedAt: Date.now(),
      summary: {
        totalPages: mockPages,
        totalIssues: criticalIssues + warnings + recommendations,
        crawlTime: 120,
      },
    });
  },
});
