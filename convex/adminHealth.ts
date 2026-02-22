import { v } from "convex/values";
import { query } from "./_generated/server";
import { isSuperAdmin } from "./admin";

// =================================================================
// System Health Queries
// =================================================================

/**
 * Get comprehensive system health metrics.
 * Aggregates data from job tables, API usage logs, system logs, and notification logs.
 */
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Fetch job queues in parallel
    const [
      kwCheckPending,
      kwCheckProcessing,
      kwCheckFailed,
      kwSerpPending,
      kwSerpProcessing,
      kwSerpFailed,
      onSiteQueued,
      onSiteCrawling,
      onSiteFailed,
    ] = await Promise.all([
      ctx.db.query("keywordCheckJobs").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("keywordCheckJobs").withIndex("by_status", (q) => q.eq("status", "processing")).collect(),
      ctx.db.query("keywordCheckJobs").withIndex("by_status", (q) => q.eq("status", "failed")).collect(),
      ctx.db.query("keywordSerpJobs").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("keywordSerpJobs").withIndex("by_status", (q) => q.eq("status", "processing")).collect(),
      ctx.db.query("keywordSerpJobs").withIndex("by_status", (q) => q.eq("status", "failed")).collect(),
      ctx.db.query("onSiteScans").withIndex("by_status", (q) => q.eq("status", "queued")).collect(),
      ctx.db.query("onSiteScans").withIndex("by_status", (q) => q.eq("status", "crawling")).collect(),
      ctx.db.query("onSiteScans").withIndex("by_status", (q) => q.eq("status", "failed")).collect(),
    ]);

    // Count recent failures (last 24h)
    const recentKwCheckFailed = kwCheckFailed.filter(
      (j) => j.completedAt && j.completedAt > twentyFourHoursAgo
    ).length;
    const recentKwSerpFailed = kwSerpFailed.filter(
      (j) => j.completedAt && j.completedAt > twentyFourHoursAgo
    ).length;
    const recentOnSiteFailed = onSiteFailed.filter(
      (j) => j.completedAt && j.completedAt > twentyFourHoursAgo
    ).length;

    // System logs - recent errors
    const recentErrorLogs = await ctx.db
      .query("systemLogs")
      .withIndex("by_level", (q) => q.eq("level", "error"))
      .order("desc")
      .take(200);
    const errorsLast24h = recentErrorLogs.filter((l) => l.createdAt > twentyFourHoursAgo).length;
    const errorsLastHour = recentErrorLogs.filter((l) => l.createdAt > oneHourAgo).length;

    const recentWarningLogs = await ctx.db
      .query("systemLogs")
      .withIndex("by_level", (q) => q.eq("level", "warning"))
      .order("desc")
      .take(200);
    const warningsLast24h = recentWarningLogs.filter((l) => l.createdAt > twentyFourHoursAgo).length;

    // API usage - today's cost
    const todayStr = new Date().toISOString().split("T")[0];
    const todayApiLogs = await ctx.db
      .query("apiUsageLogs")
      .withIndex("by_date", (q) => q.eq("date", todayStr))
      .collect();
    let todayApiCost = 0;
    let todayApiCalls = 0;
    for (const log of todayApiLogs) {
      todayApiCost += log.cost ?? 0;
      todayApiCalls += log.requestCount;
    }

    // Notification delivery stats (last 24h)
    const recentNotifications = await ctx.db
      .query("notificationLogs")
      .order("desc")
      .take(500);
    const notificationsLast24h = recentNotifications.filter((n) => n.createdAt > twentyFourHoursAgo);
    const notifSent = notificationsLast24h.filter((n) => n.status === "sent").length;
    const notifFailed = notificationsLast24h.filter((n) => n.status === "failed").length;

    // Compute overall health status
    const totalActiveJobs =
      kwCheckPending.length + kwCheckProcessing.length +
      kwSerpPending.length + kwSerpProcessing.length +
      onSiteQueued.length + onSiteCrawling.length;
    const totalRecentFailures = recentKwCheckFailed + recentKwSerpFailed + recentOnSiteFailed;

    let overallStatus: "healthy" | "degraded" | "critical" = "healthy";
    if (errorsLastHour > 10 || totalRecentFailures > 20) {
      overallStatus = "critical";
    } else if (errorsLast24h > 20 || totalRecentFailures > 5 || warningsLast24h > 50) {
      overallStatus = "degraded";
    }

    return {
      overallStatus,
      jobQueue: {
        keywordCheck: {
          pending: kwCheckPending.length,
          processing: kwCheckProcessing.length,
          failedLast24h: recentKwCheckFailed,
        },
        keywordSerp: {
          pending: kwSerpPending.length,
          processing: kwSerpProcessing.length,
          failedLast24h: recentKwSerpFailed,
        },
        onSiteScan: {
          pending: onSiteQueued.length,
          processing: onSiteCrawling.length,
          failedLast24h: recentOnSiteFailed,
        },
        totalActive: totalActiveJobs,
        totalFailedLast24h: totalRecentFailures,
      },
      errors: {
        last24h: errorsLast24h,
        lastHour: errorsLastHour,
        warningsLast24h,
      },
      apiUsage: {
        todayCost: Math.round(todayApiCost * 10000) / 10000,
        todayCalls: todayApiCalls,
      },
      notifications: {
        sentLast24h: notifSent,
        failedLast24h: notifFailed,
      },
    };
  },
});

/**
 * Get details of recently failed jobs across all job tables.
 */
export const getFailedJobsDetail = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return [];

    const limit = args.limit ?? 50;
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Fetch failed jobs from all tables in parallel
    const [kwCheckFailed, kwSerpFailed, onSiteFailed] = await Promise.all([
      ctx.db.query("keywordCheckJobs").withIndex("by_status", (q) => q.eq("status", "failed")).order("desc").take(limit),
      ctx.db.query("keywordSerpJobs").withIndex("by_status", (q) => q.eq("status", "failed")).order("desc").take(limit),
      ctx.db.query("onSiteScans").withIndex("by_status", (q) => q.eq("status", "failed")).order("desc").take(limit),
    ]);

    // Collect domain IDs for batch lookup
    const domainIdSet = new Set<string>();
    for (const j of kwCheckFailed) domainIdSet.add(j.domainId);
    for (const j of kwSerpFailed) domainIdSet.add(j.domainId);
    for (const j of onSiteFailed) domainIdSet.add(j.domainId);

    const domainMap = new Map<string, string>();
    await Promise.all(
      [...domainIdSet].map(async (id) => {
        const domain = await ctx.db.get(id as any);
        if (domain && "domain" in domain) {
          domainMap.set(id, (domain as any).domain);
        }
      })
    );

    type FailedJob = {
      id: string;
      type: string;
      domainName: string;
      error: string | undefined;
      failedAt: number | undefined;
      createdAt: number;
    };

    const jobs: FailedJob[] = [];

    for (const j of kwCheckFailed) {
      if (j.completedAt && j.completedAt > twentyFourHoursAgo) {
        jobs.push({
          id: j._id,
          type: "Keyword Check",
          domainName: domainMap.get(j.domainId) ?? "Unknown",
          error: j.error,
          failedAt: j.completedAt,
          createdAt: j.createdAt,
        });
      }
    }

    for (const j of kwSerpFailed) {
      if (j.completedAt && j.completedAt > twentyFourHoursAgo) {
        jobs.push({
          id: j._id,
          type: "SERP Fetch",
          domainName: domainMap.get(j.domainId) ?? "Unknown",
          error: j.error,
          failedAt: j.completedAt,
          createdAt: j.createdAt,
        });
      }
    }

    for (const j of onSiteFailed) {
      if (j.completedAt && j.completedAt > twentyFourHoursAgo) {
        jobs.push({
          id: j._id,
          type: "On-Site Scan",
          domainName: domainMap.get(j.domainId) ?? "Unknown",
          error: j.error,
          failedAt: j.completedAt,
          createdAt: j.startedAt,
        });
      }
    }

    // Sort by failure time, most recent first
    jobs.sort((a, b) => (b.failedAt ?? 0) - (a.failedAt ?? 0));

    return jobs.slice(0, limit);
  },
});

/**
 * Get error timeline for the last 7 days, grouped by day.
 */
export const getErrorTimeline = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return [];

    const days = args.days ?? 7;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const errorLogs = await ctx.db
      .query("systemLogs")
      .withIndex("by_level", (q) => q.eq("level", "error"))
      .order("desc")
      .take(1000);

    const warningLogs = await ctx.db
      .query("systemLogs")
      .withIndex("by_level", (q) => q.eq("level", "warning"))
      .order("desc")
      .take(1000);

    // Group by day
    const dayMap = new Map<string, { errors: number; warnings: number }>();

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dayMap.set(dateStr, { errors: 0, warnings: 0 });
    }

    for (const log of errorLogs) {
      if (log.createdAt < startTime) continue;
      const dateStr = new Date(log.createdAt).toISOString().split("T")[0];
      const entry = dayMap.get(dateStr);
      if (entry) entry.errors++;
    }

    for (const log of warningLogs) {
      if (log.createdAt < startTime) continue;
      const dateStr = new Date(log.createdAt).toISOString().split("T")[0];
      const entry = dayMap.get(dateStr);
      if (entry) entry.warnings++;
    }

    // Convert to sorted array
    return [...dayMap.entries()]
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});
