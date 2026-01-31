import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// DataForSEO API configuration
const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

/**
 * Trigger an on-site scan for a domain
 * This initiates a DataForSEO On-Page API crawl
 */
export const triggerOnSiteScan = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<{ success: boolean; scanId?: Id<"onSiteScans">; error?: string; mock?: boolean }> => {
    // Get domain info
    const domain: any = await ctx.runQuery(internal.queries.competitorsInternal.getDomainById, {
      domainId: args.domainId,
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    // Check if there's already a scan in progress
    const existingScan: any = await ctx.runQuery(internal.onSite_queries.getActiveScan, {
      domainId: args.domainId,
    });

    if (existingScan) {
      return {
        success: false,
        error: "A scan is already in progress for this domain",
        scanId: existingScan._id,
      };
    }

    // Create scan record
    const scanId: any = await ctx.runMutation(internal.onSite_actions.createScanRecord, {
      domainId: args.domainId,
    });

    // If no credentials, simulate scan for development
    if (!login || !password) {
      console.log("DEV MODE: Simulating on-site scan");

      // Simulate async processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update to complete and generate mock data
      await ctx.runMutation(internal.onSite_actions.completeMockScan, {
        scanId,
        domainId: args.domainId,
      });

      return { success: true, scanId, mock: true };
    }

    try {
      const authHeader = btoa(`${login}:${password}`);

      // DataForSEO On-Page API: task_post endpoint
      const response: any = await fetch(`${DATAFORSEO_API_URL}/on_page/task_post`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{
          target: domain.domain,
          max_crawl_pages: 100, // Limit for performance
          enable_javascript: true,
          load_resources: true,
          enable_browser_rendering: true,
          calculate_keyword_density: true,
          check_spell: false,
        }]),
      });

      if (!response.ok) {
        await ctx.runMutation(internal.onSite_actions.failScan, {
          scanId,
          error: `API error: ${response.status}`,
        });
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.status_code !== 20000) {
        await ctx.runMutation(internal.onSite_actions.failScan, {
          scanId,
          error: data.status_message || "Unknown API error",
        });
        return { success: false, error: data.status_message };
      }

      const taskId = data.tasks?.[0]?.id;

      if (!taskId) {
        await ctx.runMutation(internal.onSite_actions.failScan, {
          scanId,
          error: "No task ID returned from API",
        });
        return { success: false, error: "No task ID returned" };
      }

      // Update scan with task ID
      await ctx.runMutation(internal.onSite_actions.updateScanTaskId, {
        scanId,
        taskId,
      });

      // Schedule polling for scan completion
      await ctx.scheduler.runAfter(30000, internal.onSite_actions.pollScanStatus, {
        scanId,
        taskId,
        domainId: args.domainId,
      });

      return { success: true, scanId, taskId };

    } catch (error) {
      await ctx.runMutation(internal.onSite_actions.failScan, {
        scanId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
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
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return; // Mock scans complete immediately
    }

    try {
      const authHeader = btoa(`${login}:${password}`);

      // Check task status
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

      if (!task) {
        // Task not ready yet, poll again in 30 seconds
        await ctx.scheduler.runAfter(30000, internal.onSite_actions.pollScanStatus, {
          scanId: args.scanId,
          taskId: args.taskId,
          domainId: args.domainId,
        });
        return;
      }

      // Task is ready, fetch results
      await ctx.runAction(internal.onSite_actions.fetchScanResults, {
        scanId: args.scanId,
        taskId: args.taskId,
        domainId: args.domainId,
      });

    } catch (error) {
      console.error("Error polling scan status:", error);
      // Retry polling
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
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return;
    }

    try {
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

      // Fetch pages
      const pagesResponse = await fetch(
        `${DATAFORSEO_API_URL}/on_page/pages/${args.taskId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Basic ${authHeader}`,
          },
        }
      );

      const pagesData = await pagesResponse.json();

      // Process and store results
      await ctx.runMutation(internal.onSite_actions.storeScanResults, {
        scanId: args.scanId,
        domainId: args.domainId,
        summary: summaryData,
        pages: pagesData,
      });

    } catch (error) {
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

export const storeScanResults = internalMutation({
  args: {
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    summary: v.any(),
    pages: v.any(),
  },
  handler: async (ctx, args) => {
    const summaryResult = args.summary?.tasks?.[0]?.result?.[0];
    const pagesResult = args.pages?.tasks?.[0]?.result || [];

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

    // Process pages
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
    const healthScore = Math.max(0, Math.min(100,
      100 - (criticalIssues * 5) - (warnings * 2) - (recommendations * 0.5)
    ));

    // Create analysis summary
    const analysisId = await ctx.db.insert("domainOnsiteAnalysis", {
      domainId: args.domainId,
      scanId: args.scanId,
      healthScore: Math.round(healthScore),
      totalPages: pagesResult.length,
      criticalIssues,
      warnings,
      recommendations,
      avgLoadTime: pageCount > 0 ? totalLoadTime / pageCount : undefined,
      avgWordCount: pageCount > 0 ? Math.round(totalWordCount / pageCount) : undefined,
      issues: issueCounters,
      fetchedAt: Date.now(),
    });

    // Update scan to complete
    await ctx.db.patch(args.scanId, {
      status: "complete",
      completedAt: Date.now(),
      summary: {
        totalPages: pagesResult.length,
        totalIssues,
        crawlTime: summaryResult?.crawl_progress?.pages_in_queue || 0,
      },
    });
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
