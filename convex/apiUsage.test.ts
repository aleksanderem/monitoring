import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { serpCostForDepth, extractApiCost, API_COSTS } from "./apiUsage";

const modules = import.meta.glob("./**/*.ts");

// ===========================================================================
// Pure function tests
// ===========================================================================

describe("serpCostForDepth", () => {
  test("returns base cost for depth <= 10", () => {
    expect(serpCostForDepth(10)).toBe(0.002);
    expect(serpCostForDepth(5)).toBe(0.002);
    expect(serpCostForDepth(1)).toBe(0.002);
  });

  test("adds per-page cost for deeper depths", () => {
    // depth=20 => 2 pages => 0.002 + 1*0.0015 = 0.0035
    expect(serpCostForDepth(20)).toBeCloseTo(0.0035);
    // depth=100 => 10 pages => 0.002 + 9*0.0015 = 0.0155
    expect(serpCostForDepth(100)).toBeCloseTo(0.0155);
  });
});

describe("extractApiCost", () => {
  test("extracts cost from response when present", () => {
    expect(extractApiCost({ cost: 0.123 }, 0.05)).toBe(0.123);
  });

  test("returns fallback when cost not present", () => {
    expect(extractApiCost({}, 0.05)).toBe(0.05);
    expect(extractApiCost(null, 0.05)).toBe(0.05);
    expect(extractApiCost(undefined, 0.05)).toBe(0.05);
  });
});

// ===========================================================================
// logApiUsage (internal mutation)
// ===========================================================================

describe("apiUsage.logApiUsage", () => {
  test("inserts a usage log entry", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.apiUsage.logApiUsage, {
      endpoint: "/serp/google/organic/live/advanced",
      taskCount: 5,
      estimatedCost: 0.025,
      caller: "checkPositions",
    });

    const logs = await t.run(async (ctx: any) => {
      return ctx.db.query("apiUsageLog").collect();
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].endpoint).toBe("/serp/google/organic/live/advanced");
    expect(logs[0].taskCount).toBe(5);
    expect(logs[0].estimatedCost).toBe(0.025);
    expect(logs[0].caller).toBe("checkPositions");
  });

  test("inserts with optional domainId and metadata", async () => {
    const t = convexTest(schema, modules);

    // Create a minimal domain for the reference
    const projectId = await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      return ctx.db.insert("projects", {
        teamId,
        name: "Proj",
        createdAt: Date.now(),
      });
    });

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "test.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "weekly" as const,
          searchEngine: "google.com",
          location: "US",
          language: "en",
        },
      });
    });

    await t.mutation(internal.apiUsage.logApiUsage, {
      endpoint: "/labs/ranked_keywords",
      taskCount: 1,
      estimatedCost: 0.01,
      caller: "fetchRankedKeywords",
      domainId,
      metadata: JSON.stringify({ depth: 100 }),
    });

    const logs = await t.run(async (ctx: any) => {
      return ctx.db.query("apiUsageLog").collect();
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].domainId).toEqual(domainId);
    expect(logs[0].metadata).toBe(JSON.stringify({ depth: 100 }));
  });
});

// ===========================================================================
// getUsageSummary
// ===========================================================================

describe("apiUsage.getUsageSummary", () => {
  test("aggregates usage by endpoint, caller, and domain", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx: any) => {
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 3,
        estimatedCost: 0.015,
        caller: "checkPositions",
        createdAt: now - 1000,
      });
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 2,
        estimatedCost: 0.01,
        caller: "checkPositions",
        createdAt: now - 500,
      });
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/labs/ranked",
        taskCount: 1,
        estimatedCost: 0.01,
        caller: "fetchRanked",
        createdAt: now - 200,
      });
    });

    const summary = await t.query(api.apiUsage.getUsageSummary, {
      startDate: now - 2000,
      endDate: now,
    });

    expect(summary.totalCalls).toBe(3);
    expect(summary.totalTasks).toBe(6);
    expect(summary.totalCost).toBeCloseTo(0.035);

    expect(summary.byEndpoint["/serp/live"].calls).toBe(2);
    expect(summary.byEndpoint["/serp/live"].taskCount).toBe(5);
    expect(summary.byEndpoint["/labs/ranked"].calls).toBe(1);

    expect(summary.byCaller["checkPositions"].calls).toBe(2);
    expect(summary.byCaller["fetchRanked"].calls).toBe(1);
  });

  test("returns zeroes for empty date range", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx: any) => {
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 1,
        estimatedCost: 0.005,
        caller: "test",
        createdAt: now,
      });
    });

    // Query a range that excludes the log
    const summary = await t.query(api.apiUsage.getUsageSummary, {
      startDate: now - 100000,
      endDate: now - 50000,
    });

    expect(summary.totalCalls).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.totalTasks).toBe(0);
  });
});

// ===========================================================================
// getRecentLogs
// ===========================================================================

describe("apiUsage.getRecentLogs", () => {
  test("returns recent logs in descending order", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx: any) => {
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 1,
        estimatedCost: 0.005,
        caller: "first",
        createdAt: now - 2000,
      });
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/labs/ranked",
        taskCount: 1,
        estimatedCost: 0.01,
        caller: "second",
        createdAt: now - 1000,
      });
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 2,
        estimatedCost: 0.01,
        caller: "third",
        createdAt: now,
      });
    });

    const logs = await t.query(api.apiUsage.getRecentLogs, { limit: 2 });
    expect(logs).toHaveLength(2);
    expect(logs[0].caller).toBe("third"); // most recent first
    expect(logs[1].caller).toBe("second");
  });

  test("defaults to 100 limit", async () => {
    const t = convexTest(schema, modules);

    const logs = await t.query(api.apiUsage.getRecentLogs, {});
    expect(logs).toHaveLength(0); // empty db, just verifying no error
  });
});

// ===========================================================================
// getUsageByDomain
// ===========================================================================

describe("apiUsage.getUsageByDomain", () => {
  test("returns usage filtered by domain", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    // Set up minimal hierarchy for a domain
    const domainId = await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      const projectId = await ctx.db.insert("projects", {
        teamId,
        name: "Proj",
        createdAt: Date.now(),
      });
      return ctx.db.insert("domains", {
        projectId,
        domain: "test.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "weekly" as const,
          searchEngine: "google.com",
          location: "US",
          language: "en",
        },
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 3,
        estimatedCost: 0.015,
        caller: "check",
        domainId,
        createdAt: now - 1000,
      });
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/labs/ranked",
        taskCount: 1,
        estimatedCost: 0.01,
        caller: "fetch",
        domainId,
        createdAt: now,
      });
      // Log for a different domain (no domainId)
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 10,
        estimatedCost: 0.05,
        caller: "other",
        createdAt: now,
      });
    });

    const usage = await t.query(api.apiUsage.getUsageByDomain, { domainId });

    expect(usage.totalCalls).toBe(2);
    expect(usage.totalTasks).toBe(4);
    expect(usage.totalCost).toBeCloseTo(0.025);
    expect(usage.logs).toHaveLength(2);
  });

  test("filters by startDate", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const domainId = await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      const projectId = await ctx.db.insert("projects", {
        teamId,
        name: "Proj",
        createdAt: Date.now(),
      });
      return ctx.db.insert("domains", {
        projectId,
        domain: "test.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "weekly" as const,
          searchEngine: "google.com",
          location: "US",
          language: "en",
        },
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 1,
        estimatedCost: 0.005,
        caller: "old",
        domainId,
        createdAt: now - 100000,
      });
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 1,
        estimatedCost: 0.005,
        caller: "recent",
        domainId,
        createdAt: now,
      });
    });

    const usage = await t.query(api.apiUsage.getUsageByDomain, {
      domainId,
      startDate: now - 1000,
    });

    expect(usage.totalCalls).toBe(1);
    expect(usage.logs).toHaveLength(1);
    expect(usage.logs[0].caller).toBe("recent");
  });
});

// ===========================================================================
// getDailyApiCostStatus
// ===========================================================================

describe("apiUsage.getDailyApiCostStatus", () => {
  test("returns today's cost status", async () => {
    const t = convexTest(schema, modules);

    // Insert a log entry with current timestamp
    await t.run(async (ctx: any) => {
      await ctx.db.insert("apiUsageLog", {
        endpoint: "/serp/live",
        taskCount: 5,
        estimatedCost: 0.025,
        caller: "test",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.apiUsage.getDailyApiCostStatus, {});

    expect(status.todayCost).toBeGreaterThanOrEqual(0.025);
    expect(status.defaultCap).toBe(5);
    expect(status.callsToday).toBeGreaterThanOrEqual(1);
    expect(typeof status.pace24h).toBe("number");
  });
});

// ===========================================================================
// API_COSTS constants
// ===========================================================================

describe("API_COSTS", () => {
  test("has expected endpoint cost entries", () => {
    expect(API_COSTS.SERP_LIVE_ADVANCED).toBe(0.005);
    expect(API_COSTS.LABS_HISTORICAL_RANK_OVERVIEW).toBe(0.10);
    expect(API_COSTS.ON_PAGE_CONTENT_PARSING).toBe(0.001);
  });
});
