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

async function setupDomain(t: any, projectId: string, domain = "example.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

// ===========================================================================
// getDomainHealthScore
// ===========================================================================

describe("insights_queries.getDomainHealthScore", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    // No identity set
    const result = await t.query(api.insights_queries.getDomainHealthScore, {
      domainId,
    });
    expect(result).toBeNull();
  });

  test("returns a score object for a domain with keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    // Insert active keywords with denormalized position data
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "keyword one",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
        recentPositions: [],
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "keyword two",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 10,
        recentPositions: [],
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.insights_queries.getDomainHealthScore, {
      domainId,
    });

    expect(result).not.toBeNull();
    expect(result!.totalScore).toBeGreaterThan(0);
    expect(result!.maxScore).toBe(100);
    expect(result!.breakdown.keywords.max).toBe(30);
    expect(result!.breakdown.backlinks.max).toBe(30);
    expect(result!.breakdown.onsite.max).toBe(20);
    expect(result!.breakdown.content.max).toBe(20);
    expect(result!.stats.totalKeywords).toBe(2);
    expect(result!.stats.avgPosition).not.toBeNull();
  });

  test("handles domain with no keywords (default scores)", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.insights_queries.getDomainHealthScore, {
      domainId,
    });

    expect(result).not.toBeNull();
    expect(result!.breakdown.keywords.score).toBe(0);
    expect(result!.stats.totalKeywords).toBe(0);
    expect(result!.stats.avgPosition).toBeNull();
    expect(result!.stats.improving).toBe(0);
    expect(result!.stats.declining).toBe(0);
  });

  test("keywords with good positions yield higher keyword score", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    // Domain A: keywords with great positions (avg ~3)
    const domainA = await setupDomain(t, projectId, "good.com");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: domainA,
        phrase: "kw1",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 1,
        recentPositions: [],
      });
      await ctx.db.insert("keywords", {
        domainId: domainA,
        phrase: "kw2",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
        recentPositions: [],
      });
    });

    // Domain B: keywords with poor positions (avg ~80)
    const domainB = await setupDomain(t, projectId, "poor.com");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: domainB,
        phrase: "kw3",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 70,
        recentPositions: [],
      });
      await ctx.db.insert("keywords", {
        domainId: domainB,
        phrase: "kw4",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 90,
        recentPositions: [],
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const resultA = await asUser.query(api.insights_queries.getDomainHealthScore, { domainId: domainA });
    const resultB = await asUser.query(api.insights_queries.getDomainHealthScore, { domainId: domainB });

    expect(resultA!.breakdown.keywords.score).toBeGreaterThan(resultB!.breakdown.keywords.score);
  });

  test("includes backlink score when summary exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 500,
        totalDomains: 100,
        totalIps: 80,
        totalSubnets: 60,
        dofollow: 400,
        nofollow: 100,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.insights_queries.getDomainHealthScore, { domainId });

    expect(result!.breakdown.backlinks.score).toBeGreaterThan(0);
    expect(result!.stats.totalBacklinks).toBe(500);
    expect(result!.stats.referringDomains).toBe(100);
  });
});

// ===========================================================================
// getKeywordInsights
// ===========================================================================

describe("insights_queries.getKeywordInsights", () => {
  test("returns empty insights when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(api.insights_queries.getKeywordInsights, { domainId });
    expect(result.atRisk).toEqual([]);
    expect(result.opportunities).toEqual([]);
    expect(result.nearPage1).toEqual([]);
  });

  test("identifies near page 1 keywords (position 11-20)", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "near page one",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 12,
        recentPositions: [],
        searchVolume: 500,
      });
      // Position 5 should NOT be in nearPage1
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "already top 10",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
        recentPositions: [],
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.insights_queries.getKeywordInsights, { domainId });

    expect(result.nearPage1).toHaveLength(1);
    expect(result.nearPage1[0].keyword).toBe("near page one");
    expect(result.nearPage1[0].position).toBe(12);
    expect(result.summary.nearPage1Count).toBe(1);
  });

  test("returns empty for domain with no keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.insights_queries.getKeywordInsights, { domainId });

    expect(result.atRisk).toEqual([]);
    expect(result.opportunities).toEqual([]);
    expect(result.nearPage1).toEqual([]);
    expect(result.summary.atRiskCount).toBe(0);
  });
});
