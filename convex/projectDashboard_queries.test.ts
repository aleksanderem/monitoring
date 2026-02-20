import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupHierarchy(t: any, userId: string) {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx: any) => {
    return ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx: any) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  return { orgId, teamId, projectId };
}

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

// ===========================================================================
// getProjectOverview
// ===========================================================================

describe("projectDashboard.getProjectOverview", () => {
  test("returns aggregated stats across domains", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    // Add keywords and discovered keywords
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword 1",
        status: "active",
        createdAt: Date.now(),
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword 2",
        status: "active",
        createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "disc 1",
        bestPosition: 5,
        url: "https://example.com/a",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
        etv: 100,
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "disc 2",
        bestPosition: 15,
        url: "https://example.com/b",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
        etv: 200,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const overview = await asUser.query(api.projectDashboard_queries.getProjectOverview, { projectId });

    expect(overview).not.toBeNull();
    expect(overview!.projectName).toBe("Test Project");
    expect(overview!.totalDomains).toBe(1);
    expect(overview!.totalKeywords).toBe(2);
    expect(overview!.totalDiscoveredKeywords).toBe(2);
    expect(overview!.avgPosition).toBe(10); // (5+15)/2
    expect(overview!.totalEstimatedTraffic).toBe(300); // 100+200
    expect(overview!.domains).toHaveLength(1);
    expect(overview!.domains[0].domain).toBe("example.com");
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const overview = await t.query(api.projectDashboard_queries.getProjectOverview, { projectId });
    expect(overview).toBeNull();
  });

  test("includes backlinks summary data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 500,
        totalDomains: 50,
        totalIps: 30,
        totalSubnets: 20,
        dofollow: 400,
        nofollow: 100,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const overview = await asUser.query(api.projectDashboard_queries.getProjectOverview, { projectId });

    expect(overview!.totalBacklinks).toBe(500);
    expect(overview!.totalReferringDomains).toBe(50);
  });
});

// ===========================================================================
// getProjectPositionDistribution
// ===========================================================================

describe("projectDashboard.getProjectPositionDistribution", () => {
  test("buckets discovered keywords by position range", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      // top3
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "k1", bestPosition: 2, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      // top10 (4-10)
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "k2", bestPosition: 7, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      // top20 (11-20)
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "k3", bestPosition: 15, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      // top50 (21-50)
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "k4", bestPosition: 35, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      // beyond 100
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "k5", bestPosition: 150, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      // excluded (999)
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "k6", bestPosition: 999, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const dist = await asUser.query(api.projectDashboard_queries.getProjectPositionDistribution, { projectId });

    expect(dist).not.toBeNull();
    const bucketMap = Object.fromEntries(dist!.map((b: any) => [b.bucket, b.count]));
    expect(bucketMap.top3).toBe(1);
    expect(bucketMap.top10).toBe(1);
    expect(bucketMap.top20).toBe(1);
    expect(bucketMap.top50).toBe(1);
    expect(bucketMap.top100).toBe(0);
    expect(bucketMap.beyond).toBe(1);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const dist = await t.query(api.projectDashboard_queries.getProjectPositionDistribution, { projectId });
    expect(dist).toBeNull();
  });
});

// ===========================================================================
// getProjectTopPerformers
// ===========================================================================

describe("projectDashboard.getProjectTopPerformers", () => {
  test("returns gainers and losers sorted by absolute change", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      // Gainer: moved from 20 to 5 (change = +15)
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "big gainer",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
        previousPosition: 20,
      });
      // Gainer: moved from 10 to 8 (change = +2)
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "small gainer",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 8,
        previousPosition: 10,
      });
      // Loser: moved from 3 to 25 (change = -22)
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "big loser",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 25,
        previousPosition: 3,
      });
      // No change: stays at 5
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "no change",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
        previousPosition: 5,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.projectDashboard_queries.getProjectTopPerformers, { projectId });

    expect(result).not.toBeNull();
    expect(result!.gainers).toHaveLength(2);
    expect(result!.gainers[0].keyword).toBe("big gainer");
    expect(result!.gainers[0].change).toBe(15);
    expect(result!.gainers[1].keyword).toBe("small gainer");
    expect(result!.gainers[1].change).toBe(2);

    expect(result!.losers).toHaveLength(1);
    expect(result!.losers[0].keyword).toBe("big loser");
    expect(result!.losers[0].change).toBe(-22);
  });

  test("returns empty arrays when no position data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.projectDashboard_queries.getProjectTopPerformers, { projectId });

    expect(result).not.toBeNull();
    expect(result!.gainers).toHaveLength(0);
    expect(result!.losers).toHaveLength(0);
  });
});

// ===========================================================================
// getProjectBacklinksSummary
// ===========================================================================

describe("projectDashboard.getProjectBacklinksSummary", () => {
  test("aggregates backlink data across multiple domains", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domain1Id = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "site1.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const domain2Id = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "site2.com",
        createdAt: Date.now(),
        settings: { ...DEFAULT_SETTINGS, location: "US", language: "en" },
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId: domain1Id,
        totalBacklinks: 100,
        totalDomains: 20,
        totalIps: 10,
        totalSubnets: 5,
        dofollow: 80,
        nofollow: 20,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("domainBacklinksSummary", {
        domainId: domain2Id,
        totalBacklinks: 200,
        totalDomains: 30,
        totalIps: 15,
        totalSubnets: 10,
        dofollow: 150,
        nofollow: 50,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(api.projectDashboard_queries.getProjectBacklinksSummary, { projectId });

    expect(summary).not.toBeNull();
    expect(summary!.totalBacklinks).toBe(300);
    expect(summary!.totalReferringDomains).toBe(50);
    expect(summary!.totalDofollow).toBe(230);
    expect(summary!.totalNofollow).toBe(70);
    expect(summary!.dofollowPercent).toBe(77); // 230/300 * 100 ~ 76.67 => 77
    expect(summary!.domainSummaries).toHaveLength(2);
  });

  test("returns zeroed stats when no backlink data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(api.projectDashboard_queries.getProjectBacklinksSummary, { projectId });

    expect(summary).not.toBeNull();
    expect(summary!.totalBacklinks).toBe(0);
    expect(summary!.totalReferringDomains).toBe(0);
    expect(summary!.dofollowPercent).toBe(0);
    expect(summary!.domainSummaries).toHaveLength(0);
  });
});

// ===========================================================================
// getProjectDomainsWithMetrics
// ===========================================================================

describe("projectDashboard.getProjectDomainsWithMetrics", () => {
  test("returns domain metrics including keywords and discovered keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "metrics.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "kw1",
        status: "active",
        createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "dk1",
        bestPosition: 3,
        url: "https://metrics.com/a",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
        etv: 50,
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "dk2",
        bestPosition: 7,
        url: "https://metrics.com/b",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
        etv: 30,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.projectDashboard_queries.getProjectDomainsWithMetrics, { projectId });

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    const d = result![0];
    expect(d.domain).toBe("metrics.com");
    expect(d.monitoredKeywords).toBe(1);
    expect(d.discoveredKeywords).toBe(2);
    expect(d.avgPosition).toBe(5); // (3+7)/2
    expect(d.estimatedTraffic).toBe(80); // 50+30
    expect(d.totalBacklinks).toBe(0);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const result = await t.query(api.projectDashboard_queries.getProjectDomainsWithMetrics, { projectId });
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getProjectMovementTrend
// ===========================================================================

describe("projectDashboard.getProjectMovementTrend", () => {
  test("aggregates visibility history by date across domains", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const today = new Date().toISOString().split("T")[0];

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainVisibilityHistory", {
        domainId,
        date: today,
        metrics: {
          etv: 500,
          count: 100,
          is_up: 10,
          is_down: 5,
          is_new: 3,
          is_lost: 2,
        },
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const trend = await asUser.query(api.projectDashboard_queries.getProjectMovementTrend, {
      projectId,
      days: 30,
    });

    expect(trend).not.toBeNull();
    expect(trend!.length).toBeGreaterThanOrEqual(1);
    const entry = trend!.find((e: any) => e.date === today);
    expect(entry).toBeDefined();
    expect(entry!.etv).toBe(500);
    expect(entry!.isUp).toBe(10);
    expect(entry!.isDown).toBe(5);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const trend = await t.query(api.projectDashboard_queries.getProjectMovementTrend, { projectId });
    expect(trend).toBeNull();
  });
});
