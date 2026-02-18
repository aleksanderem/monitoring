import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Cost constants per task (approximate USD)
export const API_COSTS = {
  SERP_LIVE_ADVANCED: 0.003,
  KEYWORDS_DATA_SEARCH_VOLUME: 0.0005,
  KEYWORDS_DATA_GOOGLE_ADS: 0.0005,
  LABS_DOMAIN_INTERSECTION: 0.005,
  LABS_HISTORICAL_SERPS: 0.003,
  LABS_KEYWORDS_FOR_SITE: 0.003,
  LABS_RANKED_KEYWORDS: 0.003,
  LABS_HISTORICAL_RANK_OVERVIEW: 0.003,
  LABS_COMPETITORS_DOMAIN: 0.003,
  ON_PAGE_INSTANT_PAGES: 0.005,
  ON_PAGE_CONTENT_PARSING: 0.001,
} as const;

// Internal mutation to log a single API call
export const logApiUsage = internalMutation({
  args: {
    endpoint: v.string(),
    taskCount: v.number(),
    estimatedCost: v.number(),
    caller: v.string(),
    domainId: v.optional(v.id("domains")),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiUsageLog", {
      endpoint: args.endpoint,
      taskCount: args.taskCount,
      estimatedCost: args.estimatedCost,
      caller: args.caller,
      domainId: args.domainId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

// Query: get usage summary for a date range
export const getUsageSummary = query({
  args: {
    startDate: v.number(), // timestamp
    endDate: v.number(),   // timestamp
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("apiUsageLog")
      .withIndex("by_date", (q) =>
        q.gte("createdAt", args.startDate).lte("createdAt", args.endDate)
      )
      .collect();

    // Aggregate by endpoint
    const byEndpoint: Record<string, { taskCount: number; cost: number; calls: number }> = {};
    // Aggregate by caller
    const byCaller: Record<string, { taskCount: number; cost: number; calls: number }> = {};
    // Aggregate by domain
    const byDomain: Record<string, { taskCount: number; cost: number; calls: number }> = {};

    let totalCost = 0;
    let totalTasks = 0;

    for (const log of logs) {
      totalCost += log.estimatedCost;
      totalTasks += log.taskCount;

      // By endpoint
      if (!byEndpoint[log.endpoint]) {
        byEndpoint[log.endpoint] = { taskCount: 0, cost: 0, calls: 0 };
      }
      byEndpoint[log.endpoint].taskCount += log.taskCount;
      byEndpoint[log.endpoint].cost += log.estimatedCost;
      byEndpoint[log.endpoint].calls += 1;

      // By caller
      if (!byCaller[log.caller]) {
        byCaller[log.caller] = { taskCount: 0, cost: 0, calls: 0 };
      }
      byCaller[log.caller].taskCount += log.taskCount;
      byCaller[log.caller].cost += log.estimatedCost;
      byCaller[log.caller].calls += 1;

      // By domain
      const domainKey = log.domainId || "unknown";
      if (!byDomain[domainKey]) {
        byDomain[domainKey] = { taskCount: 0, cost: 0, calls: 0 };
      }
      byDomain[domainKey].taskCount += log.taskCount;
      byDomain[domainKey].cost += log.estimatedCost;
      byDomain[domainKey].calls += 1;
    }

    return {
      totalCost,
      totalTasks,
      totalCalls: logs.length,
      byEndpoint,
      byCaller,
      byDomain,
    };
  },
});

// Query: get recent log entries (paginated)
export const getRecentLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const logs = await ctx.db
      .query("apiUsageLog")
      .withIndex("by_date")
      .order("desc")
      .take(limit);

    return logs;
  },
});

// Query: get usage for a specific domain
export const getUsageByDomain = query({
  args: {
    domainId: v.id("domains"),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("apiUsageLog")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId));

    const logs = await q.collect();

    const filtered = args.startDate
      ? logs.filter((l) => l.createdAt >= args.startDate!)
      : logs;

    let totalCost = 0;
    let totalTasks = 0;
    for (const log of filtered) {
      totalCost += log.estimatedCost;
      totalTasks += log.taskCount;
    }

    return { totalCost, totalTasks, totalCalls: filtered.length, logs: filtered };
  },
});

// ─── Daily cost cap ──────────────────────────────────────────────

const DEFAULT_DAILY_COST_CAP = 5; // $5 default when org has no explicit cap

function getTodayStartUtc(): number {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
}

// Internal query: get today's accumulated API cost
export const getTodaysCost = internalQuery({
  args: {},
  handler: async (ctx) => {
    const todayStart = getTodayStartUtc();
    const logs = await ctx.db
      .query("apiUsageLog")
      .withIndex("by_date", (q) => q.gte("createdAt", todayStart))
      .collect();

    let totalCost = 0;
    for (const log of logs) {
      totalCost += log.estimatedCost;
    }
    return totalCost;
  },
});

// Internal query: check if a new API call would exceed the daily cost cap.
// Returns { allowed, todayCost, cap } — does NOT throw so callers can decide.
export const checkDailyCostCap = internalQuery({
  args: {
    estimatedCost: v.number(),
    domainId: v.optional(v.id("domains")),
  },
  handler: async (ctx, args) => {
    // Resolve org's maxDailyApiCost
    let cap = DEFAULT_DAILY_COST_CAP;

    if (args.domainId) {
      const domain = await ctx.db.get(args.domainId);
      if (domain) {
        const project = await ctx.db.get(domain.projectId);
        if (project) {
          const team = await ctx.db.get(project.teamId);
          if (team) {
            const org = await ctx.db.get(team.organizationId);
            if (org?.limits?.maxDailyApiCost !== undefined) {
              cap = org.limits.maxDailyApiCost;
            }
          }
        }
      }
    }

    const todayStart = getTodayStartUtc();
    const logs = await ctx.db
      .query("apiUsageLog")
      .withIndex("by_date", (q) => q.gte("createdAt", todayStart))
      .collect();

    let todayCost = 0;
    for (const log of logs) {
      todayCost += log.estimatedCost;
    }

    return {
      allowed: todayCost + args.estimatedCost <= cap,
      todayCost: Math.round(todayCost * 10000) / 10000,
      cap,
    };
  },
});

// Public query: daily cost status for admin dashboard
export const getDailyApiCostStatus = query({
  args: {},
  handler: async (ctx) => {
    const todayStart = getTodayStartUtc();
    const logs = await ctx.db
      .query("apiUsageLog")
      .withIndex("by_date", (q) => q.gte("createdAt", todayStart))
      .collect();

    let todayCost = 0;
    for (const log of logs) {
      todayCost += log.estimatedCost;
    }

    // Extrapolate 24h pace based on hours elapsed
    const hoursElapsed = (Date.now() - todayStart) / (1000 * 60 * 60);
    const pace24h = hoursElapsed > 0.5 ? (todayCost / hoursElapsed) * 24 : 0;

    return {
      todayCost: Math.round(todayCost * 10000) / 10000,
      defaultCap: DEFAULT_DAILY_COST_CAP,
      pace24h: Math.round(pace24h * 100) / 100,
      callsToday: logs.length,
    };
  },
});
