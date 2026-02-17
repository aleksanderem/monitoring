import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

// Unified shape for all job types
type UnifiedJob = {
  id: string;
  table: string;
  type: string;
  domainName: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress?: number;
  currentStep?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
};

// Helper: normalize status strings across tables
function normalizeStatus(
  status: string
): UnifiedJob["status"] {
  switch (status) {
    case "queued":
      return "pending";
    case "crawling":
    case "processing":
    case "generating":
    case "initializing":
    case "analyzing":
    case "collecting":
      return "processing";
    case "complete":
    case "ready":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "completed":
      return "completed";
    default:
      return "processing";
  }
}

export const getAllJobs = query({
  args: {
    filter: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("recentlyFailed"),
      v.literal("all")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 100;

    // Fetch all 7 job tables in parallel
    const [
      keywordCheckJobs,
      keywordSerpJobs,
      onSiteScans,
      competitorBacklinksJobs,
      competitorContentGapJobs,
      generatedReports,
      domainReports,
    ] = await Promise.all([
      ctx.db.query("keywordCheckJobs").order("desc").take(limit),
      ctx.db.query("keywordSerpJobs").order("desc").take(limit),
      ctx.db.query("onSiteScans").order("desc").take(limit),
      ctx.db.query("competitorBacklinksJobs").order("desc").take(limit),
      ctx.db.query("competitorContentGapJobs").order("desc").take(limit),
      ctx.db.query("generatedReports").order("desc").take(limit),
      ctx.db.query("domainReports").order("desc").take(limit),
    ]);

    // Collect all domain IDs for batch lookup
    const domainIds = new Set<string>();
    for (const j of keywordCheckJobs) domainIds.add(j.domainId);
    for (const j of keywordSerpJobs) domainIds.add(j.domainId);
    for (const j of onSiteScans) domainIds.add(j.domainId);
    for (const j of competitorBacklinksJobs) domainIds.add(j.domainId);
    for (const j of competitorContentGapJobs) domainIds.add(j.domainId);
    for (const j of domainReports) domainIds.add(j.domainId);

    // Batch fetch domains
    const domainMap = new Map<string, string>();
    await Promise.all(
      [...domainIds].map(async (id) => {
        const domain = await ctx.db.get(id as any);
        if (domain && "domain" in domain) {
          domainMap.set(id, (domain as any).domain);
        }
      })
    );

    // Batch fetch competitors for content gap & backlinks jobs
    const competitorIds = new Set<string>();
    for (const j of competitorBacklinksJobs) competitorIds.add(j.competitorId);
    for (const j of competitorContentGapJobs) competitorIds.add(j.competitorId);

    const competitorMap = new Map<string, string>();
    await Promise.all(
      [...competitorIds].map(async (id) => {
        const competitor = await ctx.db.get(id as any);
        if (competitor && "competitorDomain" in competitor) {
          competitorMap.set(id, (competitor as any).competitorDomain);
        }
      })
    );

    // For generatedReports, resolve project → domains
    const projectIds = new Set<string>();
    for (const r of generatedReports) projectIds.add(r.projectId);
    const projectDomainNames = new Map<string, string>();
    await Promise.all(
      [...projectIds].map(async (id) => {
        const project = await ctx.db.get(id as any);
        if (project && "name" in project) {
          projectDomainNames.set(id, (project as any).name);
        }
      })
    );

    // Build unified jobs array
    const jobs: UnifiedJob[] = [];

    for (const j of keywordCheckJobs) {
      const progress =
        j.totalKeywords > 0
          ? Math.round((j.processedKeywords / j.totalKeywords) * 100)
          : 0;
      jobs.push({
        id: j._id,
        table: "keywordCheckJobs",
        type: "Keyword Check",
        domainName: domainMap.get(j.domainId) ?? "Unknown",
        status: normalizeStatus(j.status),
        progress,
        currentStep: `${j.processedKeywords}/${j.totalKeywords} keywords${j.failedKeywords > 0 ? ` (${j.failedKeywords} failed)` : ""}`,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
      });
    }

    for (const j of keywordSerpJobs) {
      const progress =
        j.totalKeywords > 0
          ? Math.round((j.processedKeywords / j.totalKeywords) * 100)
          : 0;
      jobs.push({
        id: j._id,
        table: "keywordSerpJobs",
        type: "SERP Fetch",
        domainName: domainMap.get(j.domainId) ?? "Unknown",
        status: normalizeStatus(j.status),
        progress,
        currentStep: `${j.processedKeywords}/${j.totalKeywords} keywords`,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
      });
    }

    for (const j of onSiteScans) {
      const progress =
        j.totalPagesToScan && j.totalPagesToScan > 0 && j.pagesScanned
          ? Math.round((j.pagesScanned / j.totalPagesToScan) * 100)
          : undefined;
      jobs.push({
        id: j._id,
        table: "onSiteScans",
        type: "On-Site Scan",
        domainName: domainMap.get(j.domainId) ?? "Unknown",
        status: normalizeStatus(j.status),
        progress,
        currentStep: j.pagesScanned != null
          ? `${j.pagesScanned}${j.totalPagesToScan ? `/${j.totalPagesToScan}` : ""} pages scanned`
          : undefined,
        createdAt: j.startedAt, // onSiteScans uses startedAt as creation time
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
      });
    }

    for (const j of competitorBacklinksJobs) {
      const competitorDomain = competitorMap.get(j.competitorId) ?? "Unknown competitor";
      jobs.push({
        id: j._id,
        table: "competitorBacklinksJobs",
        type: "Competitor Backlinks",
        domainName: competitorDomain,
        status: normalizeStatus(j.status),
        currentStep: j.backlinksFound != null
          ? `${j.backlinksFound} backlinks found`
          : undefined,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
      });
    }

    for (const j of competitorContentGapJobs) {
      const competitorDomain = competitorMap.get(j.competitorId) ?? "Unknown competitor";
      jobs.push({
        id: j._id,
        table: "competitorContentGapJobs",
        type: "Content Gap Analysis",
        domainName: competitorDomain,
        status: normalizeStatus(j.status),
        currentStep: j.opportunitiesFound != null
          ? `${j.opportunitiesFound} opportunities found`
          : undefined,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        error: j.error,
      });
    }

    for (const r of generatedReports) {
      jobs.push({
        id: r._id,
        table: "generatedReports",
        type: "Report Generation",
        domainName: projectDomainNames.get(r.projectId) ?? "Unknown project",
        status: normalizeStatus(r.status),
        progress: r.progress,
        currentStep: `${r.reportType} ${r.format}`,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        error: r.error,
      });
    }

    for (const r of domainReports) {
      jobs.push({
        id: r._id,
        table: "domainReports",
        type: "Domain SEO Report",
        domainName: domainMap.get(r.domainId) ?? "Unknown",
        status: normalizeStatus(r.status),
        progress: r.progress,
        currentStep: r.currentStep,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        error: r.error,
      });
    }

    // Sort by createdAt desc
    jobs.sort((a, b) => b.createdAt - a.createdAt);

    // Filter
    if (args.filter === "active") {
      return jobs.filter(
        (j) => j.status === "pending" || j.status === "processing"
      );
    }
    if (args.filter === "completed") {
      return jobs.filter((j) => j.status === "completed");
    }
    if (args.filter === "failed") {
      return jobs.filter(
        (j) => j.status === "failed" || j.status === "cancelled"
      );
    }
    if (args.filter === "recentlyFailed") {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      return jobs.filter(
        (j) =>
          (j.status === "failed" || j.status === "cancelled") &&
          j.completedAt != null &&
          j.completedAt > twoMinutesAgo
      );
    }
    return jobs.slice(0, limit);
  },
});

export const getJobStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { activeCount: 0, completedToday: 0, failedToday: 0 };

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Count active jobs across all tables
    const [
      kwCheckActive,
      kwSerpActive,
      onSiteActive,
      compBackActive,
      compGapActive,
      genReportActive,
      domReportActive,
    ] = await Promise.all([
      ctx.db
        .query("keywordCheckJobs")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("keywordSerpJobs")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("onSiteScans")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect(),
      ctx.db
        .query("competitorBacklinksJobs")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("competitorContentGapJobs")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("generatedReports")
        .withIndex("by_status", (q) => q.eq("status", "generating"))
        .collect(),
      ctx.db
        .query("domainReports")
        .withIndex("by_domain_status")
        .collect(),
    ]);

    // Also count processing jobs
    const [
      kwCheckProcessing,
      kwSerpProcessing,
      onSiteCrawling,
      onSiteProcessing,
      compBackProcessing,
      compGapProcessing,
    ] = await Promise.all([
      ctx.db
        .query("keywordCheckJobs")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .collect(),
      ctx.db
        .query("keywordSerpJobs")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .collect(),
      ctx.db
        .query("onSiteScans")
        .withIndex("by_status", (q) => q.eq("status", "crawling"))
        .collect(),
      ctx.db
        .query("onSiteScans")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .collect(),
      ctx.db
        .query("competitorBacklinksJobs")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .collect(),
      ctx.db
        .query("competitorContentGapJobs")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .collect(),
    ]);

    const domReportActiveFiltered = domReportActive.filter(
      (r) =>
        r.status === "initializing" ||
        r.status === "analyzing" ||
        r.status === "collecting"
    );

    const activeCount =
      kwCheckActive.length +
      kwCheckProcessing.length +
      kwSerpActive.length +
      kwSerpProcessing.length +
      onSiteActive.length +
      onSiteCrawling.length +
      onSiteProcessing.length +
      compBackActive.length +
      compBackProcessing.length +
      compGapActive.length +
      compGapProcessing.length +
      genReportActive.length +
      domReportActiveFiltered.length;

    // Count completed and failed in last 24h — use recent jobs approach
    const recentJobs = await Promise.all([
      ctx.db.query("keywordCheckJobs").order("desc").take(200),
      ctx.db.query("keywordSerpJobs").order("desc").take(200),
      ctx.db.query("onSiteScans").order("desc").take(200),
      ctx.db.query("competitorBacklinksJobs").order("desc").take(200),
      ctx.db.query("competitorContentGapJobs").order("desc").take(200),
      ctx.db.query("generatedReports").order("desc").take(200),
      ctx.db.query("domainReports").order("desc").take(200),
    ]);

    let completedToday = 0;
    let failedToday = 0;

    for (const table of recentJobs) {
      for (const job of table) {
        const completedAt = "completedAt" in job ? (job as any).completedAt : undefined;
        if (!completedAt || completedAt < twentyFourHoursAgo) continue;
        const status = "status" in job ? (job as any).status : "";
        const normalized = normalizeStatus(status);
        if (normalized === "completed") completedToday++;
        if (normalized === "failed" || normalized === "cancelled") failedToday++;
      }
    }

    return { activeCount, completedToday, failedToday };
  },
});

export const getScheduledJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    // Hardcoded based on convex/crons.ts
    return [
      {
        name: "Daily Keyword Refresh",
        schedule: "Daily at 6:00 UTC",
        description: "Refreshes keyword data for domains with daily refresh frequency",
      },
      {
        name: "Weekly Keyword Refresh",
        schedule: "Mondays at 7:00 UTC",
        description: "Refreshes keyword data for domains with weekly refresh frequency",
      },
      {
        name: "Cleanup Stuck Jobs",
        schedule: "Every 5 minutes",
        description: "Finds and resets jobs stuck in processing state",
      },
      {
        name: "Backlink Velocity",
        schedule: "Daily at 2:00 UTC",
        description: "Calculates daily backlink velocity metrics",
      },
      {
        name: "Anomaly Detection",
        schedule: "Daily at 3:00 UTC",
        description: "Detects anomalies in keyword positions and backlinks",
      },
      {
        name: "Content Gaps Analysis",
        schedule: "Sundays at 4:00 UTC",
        description: "Analyzes content gaps with competitors",
      },
    ];
  },
});

export const cancelAnyJob = mutation({
  args: {
    table: v.string(),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { table, jobId } = args;

    const cancelFields = {
      status: "failed" as const,
      error: "Cancelled by user",
      completedAt: Date.now(),
    };

    switch (table) {
      case "keywordCheckJobs": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "completed" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: Date.now(),
        });
        break;
      }
      case "keywordSerpJobs": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "completed" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: Date.now(),
        });
        break;
      }
      case "onSiteScans": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "complete" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          ...cancelFields,
          status: "failed", // onSiteScans doesn't have "cancelled" status
        });
        break;
      }
      case "competitorBacklinksJobs": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "completed" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: Date.now(),
        });
        break;
      }
      case "competitorContentGapJobs": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "completed" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: Date.now(),
        });
        break;
      }
      case "domainReports": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "ready" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          ...cancelFields,
        });
        break;
      }
      case "generatedReports": {
        const job = await ctx.db.get(jobId as any);
        if (!job) return;
        if ((job as any).status === "ready" || (job as any).status === "failed") return;
        await ctx.db.patch(jobId as any, {
          ...cancelFields,
        });
        break;
      }
    }
  },
});
