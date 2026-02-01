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
 * Get pages list with pagination and filtering
 */
export const getPagesList = query({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    statusCode: v.optional(v.number()),
    hasIssues: v.optional(v.boolean()),
    searchQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("domainOnsitePages");

    // Filter by scan or domain
    if (args.scanId) {
      query = query.withIndex("by_scan", (q) => q.eq("scanId", args.scanId));
    } else {
      query = query.withIndex("by_domain", (q) => q.eq("domainId", args.domainId));
    }

    let pages = await query.collect();

    // Apply filters
    if (args.statusCode !== undefined) {
      pages = pages.filter((p) => p.statusCode === args.statusCode);
    }

    if (args.hasIssues !== undefined) {
      if (args.hasIssues) {
        pages = pages.filter((p) => p.issueCount > 0);
      } else {
        pages = pages.filter((p) => p.issueCount === 0);
      }
    }

    if (args.searchQuery) {
      const query = args.searchQuery.toLowerCase();
      pages = pages.filter(
        (p) =>
          p.url.toLowerCase().includes(query) ||
          p.title?.toLowerCase().includes(query)
      );
    }

    // Sort by URL
    pages.sort((a, b) => a.url.localeCompare(b.url));

    // Pagination
    const offset = args.offset || 0;
    const limit = args.limit || 25;
    const paginatedPages = pages.slice(offset, offset + limit);

    return {
      pages: paginatedPages,
      total: pages.length,
      hasMore: offset + limit < pages.length,
    };
  },
});

/**
 * Get issues grouped by category
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

    // Filter by scan if provided
    const filteredIssues = args.scanId
      ? issues.filter((i) => i.scanId === args.scanId)
      : issues;

    // Group by category
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

    // Filter by domain
    const domainIssues = issues.filter((i) => i.domainId === args.domainId);

    // Filter by scan if provided
    const filteredIssues = args.scanId
      ? domainIssues.filter((i) => i.scanId === args.scanId)
      : domainIssues;

    // Sort by affected pages count
    filteredIssues.sort((a, b) => b.affectedPages - a.affectedPages);

    return filteredIssues.slice(0, args.limit || 10);
  },
});

/**
 * Get Core Web Vitals for a domain
 */
export const getCoreWebVitals = query({
  args: {
    domainId: v.id("domains"),
    device: v.optional(v.union(v.literal("mobile"), v.literal("desktop"))),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("coreWebVitals")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId));

    let vitals = await query.collect();

    // Filter by device
    if (args.device) {
      vitals = vitals.filter((v) => v.device === args.device);
    }

    // Filter by date range
    if (args.days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - args.days);
      const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

      vitals = vitals.filter((v) => v.date >= cutoffDateStr);
    }

    // Sort by date descending
    vitals.sort((a, b) => b.date.localeCompare(a.date));

    return vitals;
  },
});

/**
 * Get latest Core Web Vitals for a device
 */
export const getLatestCoreWebVitals = query({
  args: {
    domainId: v.id("domains"),
    device: v.union(v.literal("mobile"), v.literal("desktop")),
  },
  handler: async (ctx, args) => {
    const vitals = await ctx.db
      .query("coreWebVitals")
      .withIndex("by_domain_device", (q) =>
        q.eq("domainId", args.domainId).eq("device", args.device)
      )
      .order("desc")
      .first();

    return vitals || null;
  },
});

/**
 * Get schema validation results for a scan
 */
export const getSchemaValidation = query({
  args: {
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("schemaValidation")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId));

    let validations = await query.collect();

    // Filter by scan if provided
    if (args.scanId) {
      validations = validations.filter((v) => v.scanId === args.scanId);
    }

    return validations;
  },
});

/**
 * Get page detail including schema validation
 */
export const getPageDetail = query({
  args: { pageId: v.id("domainOnsitePages") },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);

    if (!page) {
      return null;
    }

    // Get schema validation for this page
    const schemaValidation = await ctx.db
      .query("schemaValidation")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .first();

    return {
      ...page,
      schemaValidation: schemaValidation || null,
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

    if (!analysis) {
      return true; // No data = stale
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return analysis.fetchedAt < sevenDaysAgo;
  },
});
