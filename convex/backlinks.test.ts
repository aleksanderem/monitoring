import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

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

/** Create a domain and return its ID. */
async function createDomain(t: any, projectId: any, domain = "example.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

/** Insert a backlink directly into domainBacklinks. */
async function insertBacklink(
  t: any,
  domainId: any,
  overrides: Record<string, any> = {}
) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domainBacklinks", {
      domainId,
      urlFrom: "https://source.com/page",
      urlTo: "https://example.com/target",
      fetchedAt: Date.now(),
      ...overrides,
    });
  });
}

// ===========================================================================
// getBacklinkSummary
// ===========================================================================

describe("backlinks.getBacklinkSummary", () => {
  test("returns null when no summary exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const summary = await t.query(api.backlinks.getBacklinkSummary, { domainId });
    expect(summary).toBeNull();
  });

  test("returns summary when one exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 100,
        totalDomains: 50,
        totalIps: 40,
        totalSubnets: 30,
        dofollow: 80,
        nofollow: 20,
        fetchedAt: Date.now(),
      });
    });

    const summary = await t.query(api.backlinks.getBacklinkSummary, { domainId });
    expect(summary).not.toBeNull();
    expect(summary!.totalBacklinks).toBe(100);
    expect(summary!.totalDomains).toBe(50);
    expect(summary!.dofollow).toBe(80);
    expect(summary!.nofollow).toBe(20);
  });
});

// ===========================================================================
// isBacklinkDataStale
// ===========================================================================

describe("backlinks.isBacklinkDataStale", () => {
  test("returns true when no summary exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const stale = await t.query(api.backlinks.isBacklinkDataStale, { domainId });
    expect(stale).toBe(true);
  });

  test("returns false when summary is fresh", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 10,
        totalDomains: 5,
        totalIps: 3,
        totalSubnets: 2,
        dofollow: 8,
        nofollow: 2,
        fetchedAt: Date.now(), // fresh
      });
    });

    const stale = await t.query(api.backlinks.isBacklinkDataStale, { domainId });
    expect(stale).toBe(false);
  });

  test("returns true when summary is older than 7 days", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 10,
        totalDomains: 5,
        totalIps: 3,
        totalSubnets: 2,
        dofollow: 8,
        nofollow: 2,
        fetchedAt: eightDaysAgo,
      });
    });

    const stale = await t.query(api.backlinks.isBacklinkDataStale, { domainId });
    expect(stale).toBe(true);
  });
});

// ===========================================================================
// getBacklinks
// ===========================================================================

describe("backlinks.getBacklinks", () => {
  test("returns empty results when no backlinks exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.query(api.backlinks.getBacklinks, { domainId });
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  test("returns backlinks with stats", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await insertBacklink(t, domainId, {
      domainFrom: "site-a.com",
      dofollow: true,
      rank: 100,
      backlink_spam_score: 10,
    });
    await insertBacklink(t, domainId, {
      domainFrom: "site-b.com",
      dofollow: false,
      rank: 200,
      backlink_spam_score: 30,
    });

    const result = await t.query(api.backlinks.getBacklinks, { domainId });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.stats.totalDofollow).toBe(1);
    expect(result.stats.totalNofollow).toBe(1);
    expect(result.stats.avgRank).toBe(150);
    expect(result.stats.avgSpamScore).toBe(20);
  });

  test("filters by dofollow", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await insertBacklink(t, domainId, { dofollow: true, urlFrom: "https://a.com/1" });
    await insertBacklink(t, domainId, { dofollow: false, urlFrom: "https://b.com/2" });
    await insertBacklink(t, domainId, { dofollow: true, urlFrom: "https://c.com/3" });

    const dofollow = await t.query(api.backlinks.getBacklinks, {
      domainId,
      filterDofollow: true,
    });
    expect(dofollow.total).toBe(2);

    const nofollow = await t.query(api.backlinks.getBacklinks, {
      domainId,
      filterDofollow: false,
    });
    expect(nofollow.total).toBe(1);
  });

  test("paginates with limit and offset", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    for (let i = 0; i < 5; i++) {
      await insertBacklink(t, domainId, { urlFrom: `https://site${i}.com/page` });
    }

    const page1 = await t.query(api.backlinks.getBacklinks, {
      domainId,
      limit: 2,
      offset: 0,
    });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);

    const page2 = await t.query(api.backlinks.getBacklinks, {
      domainId,
      limit: 2,
      offset: 2,
    });
    expect(page2.items).toHaveLength(2);

    const page3 = await t.query(api.backlinks.getBacklinks, {
      domainId,
      limit: 2,
      offset: 4,
    });
    expect(page3.items).toHaveLength(1);
  });

  test("sorts by rank descending", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await insertBacklink(t, domainId, { rank: 50, urlFrom: "https://low.com" });
    await insertBacklink(t, domainId, { rank: 500, urlFrom: "https://high.com" });
    await insertBacklink(t, domainId, { rank: 200, urlFrom: "https://mid.com" });

    const result = await t.query(api.backlinks.getBacklinks, {
      domainId,
      sortBy: "rank",
    });
    expect(result.items[0].rank).toBe(500);
    expect(result.items[1].rank).toBe(200);
    expect(result.items[2].rank).toBe(50);
  });
});

// ===========================================================================
// saveBacklinkData (internal mutation)
// ===========================================================================

describe("backlinks.saveBacklinkData", () => {
  test("stores summary, distributions, and backlinks", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.mutation(internal.backlinks.saveBacklinkData, {
      domainId,
      summary: {
        totalBacklinks: 200,
        totalDomains: 80,
        totalIps: 60,
        totalSubnets: 40,
        dofollow: 150,
        nofollow: 50,
      },
      distributions: {
        tldDistribution: { ".com": 100, ".org": 30 },
        platformTypes: { cms: 50 },
        countries: { US: 80, UK: 20 },
        linkTypes: { anchor: 150 },
        linkAttributes: { nofollow: 50 },
        semanticLocations: { footer: 20 },
      },
      backlinks: [
        {
          domain_from: "source1.com",
          url_from: "https://source1.com/page",
          url_to: "https://example.com/target",
          dofollow: true,
          rank: 300,
          backlink_spam_score: 5,
        },
        {
          domain_from: "source2.com",
          url_from: "https://source2.com/page",
          url_to: "https://example.com/other",
          dofollow: false,
          rank: 100,
          backlink_spam_score: 80,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.backlinksInserted).toBe(2);

    // Verify summary was stored
    const summary = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinksSummary")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .unique();
    });
    expect(summary).not.toBeNull();
    expect(summary!.totalBacklinks).toBe(200);
    expect(summary!.dofollow).toBe(150);

    // Verify distributions were stored
    const dist = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinksDistributions")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .unique();
    });
    expect(dist).not.toBeNull();
    expect(dist!.tldDistribution).toEqual({ ".com": 100, ".org": 30 });

    // Verify individual backlinks were stored
    const backlinks = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(backlinks).toHaveLength(2);
  });

  test("replaces existing data on re-save", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const baseSummary = {
      totalBacklinks: 10,
      totalDomains: 5,
      totalIps: 3,
      totalSubnets: 2,
      dofollow: 8,
      nofollow: 2,
    };
    const baseDist = {
      tldDistribution: {},
      platformTypes: {},
      countries: {},
      linkTypes: {},
      linkAttributes: {},
      semanticLocations: {},
    };

    // First save
    await t.mutation(internal.backlinks.saveBacklinkData, {
      domainId,
      summary: baseSummary,
      distributions: baseDist,
      backlinks: [
        { url_from: "https://old.com/1", url_to: "https://example.com", domain_from: "old.com" },
      ],
    });

    // Second save with different data
    await t.mutation(internal.backlinks.saveBacklinkData, {
      domainId,
      summary: { ...baseSummary, totalBacklinks: 999 },
      distributions: baseDist,
      backlinks: [
        { url_from: "https://new.com/1", url_to: "https://example.com", domain_from: "new.com" },
        { url_from: "https://new.com/2", url_to: "https://example.com", domain_from: "new.com" },
      ],
    });

    // Summary should be replaced
    const summary = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinksSummary")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .unique();
    });
    expect(summary!.totalBacklinks).toBe(999);

    // Old backlinks should be gone, only new ones
    const backlinks = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(backlinks).toHaveLength(2);
    expect(backlinks.every((b: any) => b.domainFrom === "new.com")).toBe(true);
  });
});

// ===========================================================================
// getBacklinkDistributions
// ===========================================================================

describe("backlinks.getBacklinkDistributions", () => {
  test("returns empty distributions when none exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const dist = await t.query(api.backlinks.getBacklinkDistributions, { domainId });
    expect(dist.tldDistribution).toEqual({});
    expect(dist.countries).toEqual({});
  });

  test("returns stored distributions with enriched linkAttributes", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksDistributions", {
        domainId,
        tldDistribution: { ".com": 50 },
        platformTypes: { cms: 30 },
        countries: { US: 40 },
        linkTypes: { anchor: 60 },
        linkAttributes: { sponsored: 5 },
        semanticLocations: { footer: 10 },
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 100,
        totalDomains: 50,
        totalIps: 40,
        totalSubnets: 30,
        dofollow: 80,
        nofollow: 20,
        fetchedAt: Date.now(),
      });
    });

    const dist = await t.query(api.backlinks.getBacklinkDistributions, { domainId });
    expect(dist.tldDistribution).toEqual({ ".com": 50 });
    expect(dist.linkAttributes.dofollow).toBe(80);
    expect(dist.linkAttributes.nofollow).toBe(20);
    expect(dist.linkAttributes.sponsored).toBe(5);
  });
});

// ===========================================================================
// getBacklinksHistory
// ===========================================================================

describe("backlinks.getBacklinksHistory", () => {
  test("groups backlinks by month from firstSeen", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await insertBacklink(t, domainId, { firstSeen: "2025-01-15T00:00:00Z", urlFrom: "https://a.com/1" });
    await insertBacklink(t, domainId, { firstSeen: "2025-01-20T00:00:00Z", urlFrom: "https://a.com/2" });
    await insertBacklink(t, domainId, { firstSeen: "2025-02-10T00:00:00Z", urlFrom: "https://b.com/1" });

    const history = await t.query(api.backlinks.getBacklinksHistory, {
      domainId,
      granularity: "monthly",
    });

    expect(history).toHaveLength(2);
    expect(history[0].date).toBe("2025-01-01");
    expect(history[0].backlinks).toBe(2);
    expect(history[1].date).toBe("2025-02-01");
    expect(history[1].backlinks).toBe(1);
  });
});

// ===========================================================================
// backlinkAnalysis_queries: getToxicLinks
// ===========================================================================

describe("backlinkAnalysis_queries.getToxicLinks", () => {
  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.query(api.backlinkAnalysis_queries.getToxicLinks, { domainId });
    expect(result).toBeNull();
  });

  test("identifies toxic links above threshold", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await insertBacklink(t, domainId, {
      domainFrom: "clean.com",
      backlink_spam_score: 10,
      urlFrom: "https://clean.com/1",
    });
    await insertBacklink(t, domainId, {
      domainFrom: "spammy.com",
      backlink_spam_score: 85,
      urlFrom: "https://spammy.com/1",
    });
    await insertBacklink(t, domainId, {
      domainFrom: "toxic.com",
      backlink_spam_score: 95,
      urlFrom: "https://toxic.com/1",
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.backlinkAnalysis_queries.getToxicLinks, {
      domainId,
      threshold: 70,
    });

    expect(result).not.toBeNull();
    expect(result!.toxicCount).toBe(2);
    expect(result!.totalAnalyzed).toBe(3);
    expect(result!.items).toHaveLength(2);
    // Sorted by spam score desc
    expect(result!.items[0].spamScore).toBe(95);
    expect(result!.items[1].spamScore).toBe(85);
  });
});

// ===========================================================================
// backlinkAnalysis_queries: getAnchorTextDistribution
// ===========================================================================

describe("backlinkAnalysis_queries.getAnchorTextDistribution", () => {
  test("returns null when no backlinks exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(
      api.backlinkAnalysis_queries.getAnchorTextDistribution,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("classifies anchors into categories", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId, "mybrand.com");

    // Branded anchor (contains domain base "mybrand")
    await insertBacklink(t, domainId, { anchor: "mybrand official", urlFrom: "https://a.com/1" });
    // Generic anchor
    await insertBacklink(t, domainId, { anchor: "click here", urlFrom: "https://b.com/1" });
    // URL anchor
    await insertBacklink(t, domainId, { anchor: "https://mybrand.com/page", urlFrom: "https://c.com/1" });
    // Other anchor
    await insertBacklink(t, domainId, { anchor: "great seo tools for 2025", urlFrom: "https://d.com/1" });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(
      api.backlinkAnalysis_queries.getAnchorTextDistribution,
      { domainId }
    );

    expect(result).not.toBeNull();
    expect(result!.total).toBe(4);

    const catMap = Object.fromEntries(result!.categories.map((c: any) => [c.name, c.count]));
    expect(catMap.branded).toBe(1);
    expect(catMap.generic).toBe(1);
    expect(catMap.exact_url).toBe(1);
    expect(catMap.other).toBe(1);
  });
});

// ===========================================================================
// backlinkAnalysis_queries: getLinkQualityScores
// ===========================================================================

describe("backlinkAnalysis_queries.getLinkQualityScores", () => {
  test("returns quality score distribution", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    // High quality: high rank, dofollow, low spam
    await insertBacklink(t, domainId, {
      rank: 900,
      domainFromRank: 800,
      dofollow: true,
      backlink_spam_score: 0,
      urlFrom: "https://top.com/1",
    });
    // Low quality: low rank, nofollow, high spam
    await insertBacklink(t, domainId, {
      rank: 10,
      domainFromRank: 5,
      dofollow: false,
      backlink_spam_score: 90,
      urlFrom: "https://bad.com/1",
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(
      api.backlinkAnalysis_queries.getLinkQualityScores,
      { domainId }
    );

    expect(result).not.toBeNull();
    expect(result!.distribution).toHaveLength(4); // excellent, good, average, poor
    expect(result!.topLinks).toHaveLength(2);
    // First should be the high-quality one
    expect(result!.topLinks[0].qualityScore).toBeGreaterThan(result!.topLinks[1].qualityScore);
  });
});

// ===========================================================================
// backlinkAnalysis_queries: getBacklinkGap
// ===========================================================================

describe("backlinkAnalysis_queries.getBacklinkGap", () => {
  test("returns empty gaps when no competitors exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.backlinkAnalysis_queries.getBacklinkGap, { domainId });
    expect(result.gaps).toHaveLength(0);
    expect(result.competitorCount).toBe(0);
  });

  test("finds domains linking to competitors but not to us", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    // Our backlink: from shared.com
    await insertBacklink(t, domainId, { domainFrom: "shared.com", urlFrom: "https://shared.com/1" });

    // Create a competitor
    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Competitor backlinks: from shared.com (we have this too) and gap-domain.com (we don't)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorBacklinks", {
        competitorId,
        domainFrom: "shared.com",
        urlFrom: "https://shared.com/link",
        urlTo: "https://rival.com/page",
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("competitorBacklinks", {
        competitorId,
        domainFrom: "gap-domain.com",
        urlFrom: "https://gap-domain.com/link",
        urlTo: "https://rival.com/page",
        domainFromRank: 500,
        dofollow: true,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.backlinkAnalysis_queries.getBacklinkGap, { domainId });

    expect(result.competitorCount).toBe(1);
    // Only gap-domain.com should appear (shared.com links to us already)
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].domain).toBe("gap-domain.com");
    expect(result.gaps[0].competitorCount).toBe(1);
    expect(result.gaps[0].competitors).toContain("rival.com");
  });
});

// ===========================================================================
// deleteBacklinks
// ===========================================================================

describe("backlinks.deleteBacklinks", () => {
  test("deletes specified backlinks by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "a@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const id1 = await insertBacklink(t, domainId, { urlFrom: "https://a.com/1" });
    const id2 = await insertBacklink(t, domainId, { urlFrom: "https://b.com/1" });
    await insertBacklink(t, domainId, { urlFrom: "https://c.com/1" });

    await t.mutation(api.backlinks.deleteBacklinks, { backlinkIds: [id1, id2] });

    const remaining = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].urlFrom).toBe("https://c.com/1");
  });
});
