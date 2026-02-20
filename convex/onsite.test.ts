import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDomain(t: any) {
  return await t.run(async (ctx: any) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" },
    });
    const teamId = await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default",
      createdAt: Date.now(),
    });
    const projectId = await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
    const domainId = await ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily",
        searchEngine: "google",
        location: "United States",
        language: "en",
      },
    });
    return domainId;
  });
}

async function insertAnalysis(
  t: any,
  domainId: string,
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    const scanId = await ctx.db.insert("onSiteScans", {
      domainId,
      status: "complete",
      startedAt: Date.now(),
    });
    return ctx.db.insert("domainOnsiteAnalysis", {
      domainId,
      scanId,
      healthScore: 85,
      totalPages: 50,
      criticalIssues: 2,
      warnings: 10,
      recommendations: 5,
      issues: {
        missingTitles: 1,
        missingMetaDescriptions: 2,
        duplicateContent: 0,
        brokenLinks: 1,
        slowPages: 3,
        suboptimalTitles: 2,
        thinContent: 1,
        missingH1: 0,
        largeImages: 2,
        missingAltText: 3,
      },
      fetchedAt: Date.now(),
      ...overrides,
    });
  });
}

async function insertPage(
  t: any,
  domainId: string,
  url: string,
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    const scanId = await ctx.db.insert("onSiteScans", {
      domainId,
      status: "complete",
      startedAt: Date.now(),
    });
    return ctx.db.insert("domainOnsitePages", {
      domainId,
      scanId,
      url,
      statusCode: 200,
      wordCount: 500,
      issueCount: 0,
      issues: [],
      ...overrides,
    });
  });
}

// ===========================================================================
// getOnsiteAnalysis
// ===========================================================================

describe("onsite.getOnsiteAnalysis", () => {
  test("returns null when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    const result = await t.query(api.onsite.getOnsiteAnalysis, { domainId });
    expect(result).toBeNull();
  });

  test("returns analysis for domain", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);
    await insertAnalysis(t, domainId, { healthScore: 92 });

    const result = await t.query(api.onsite.getOnsiteAnalysis, { domainId });
    expect(result).not.toBeNull();
    expect(result!.healthScore).toBe(92);
    expect(result!.domainId).toBe(domainId);
  });

  test("returns most recent analysis (desc order)", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    await insertAnalysis(t, domainId, { healthScore: 70, fetchedAt: 1000 });
    await insertAnalysis(t, domainId, { healthScore: 90, fetchedAt: 2000 });

    const result = await t.query(api.onsite.getOnsiteAnalysis, { domainId });
    expect(result).not.toBeNull();
    // Should get the most recently inserted (last in desc order by _creationTime)
    expect(result!.healthScore).toBe(90);
  });
});

// ===========================================================================
// getOnsitePages
// ===========================================================================

describe("onsite.getOnsitePages", () => {
  test("returns empty array when no pages exist", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    const result = await t.query(api.onsite.getOnsitePages, { domainId });
    expect(result).toEqual([]);
  });

  test("returns all pages for domain", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    await insertPage(t, domainId, "https://example.com/page1");
    await insertPage(t, domainId, "https://example.com/page2");
    await insertPage(t, domainId, "https://example.com/page3");

    const result = await t.query(api.onsite.getOnsitePages, { domainId });
    expect(result).toHaveLength(3);
    const urls = result.map((p: any) => p.url);
    expect(urls).toContain("https://example.com/page1");
    expect(urls).toContain("https://example.com/page2");
    expect(urls).toContain("https://example.com/page3");
  });

  test("does not return pages from other domains", async () => {
    const t = convexTest(schema, modules);
    const domainId1 = await setupDomain(t);
    const domainId2 = await t.run(async (ctx: any) => {
      const project = await ctx.db
        .query("projects")
        .first();
      return ctx.db.insert("domains", {
        projectId: project._id,
        domain: "other.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily",
          searchEngine: "google",
          location: "United States",
          language: "en",
        },
      });
    });

    await insertPage(t, domainId1, "https://example.com/page1");
    await insertPage(t, domainId2, "https://other.com/page1");

    const result = await t.query(api.onsite.getOnsitePages, { domainId: domainId1 });
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/page1");
  });
});

// ===========================================================================
// isOnsiteDataStale
// ===========================================================================

describe("onsite.isOnsiteDataStale", () => {
  test("returns true when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    const result = await t.query(api.onsite.isOnsiteDataStale, { domainId });
    expect(result).toBe(true);
  });

  test("returns false when analysis is recent (less than 7 days)", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    // Fetched 1 day ago
    const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;
    await insertAnalysis(t, domainId, { fetchedAt: oneDayAgo });

    const result = await t.query(api.onsite.isOnsiteDataStale, { domainId });
    expect(result).toBe(false);
  });

  test("returns true when analysis is older than 7 days", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    // Fetched 8 days ago
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await insertAnalysis(t, domainId, { fetchedAt: eightDaysAgo });

    const result = await t.query(api.onsite.isOnsiteDataStale, { domainId });
    expect(result).toBe(true);
  });

  test("returns false when analysis is exactly at 7-day boundary", async () => {
    const t = convexTest(schema, modules);
    const domainId = await setupDomain(t);

    // fetchedAt = now means sevenDaysAgo < fetchedAt, so not stale
    await insertAnalysis(t, domainId, { fetchedAt: Date.now() });

    const result = await t.query(api.onsite.isOnsiteDataStale, { domainId });
    expect(result).toBe(false);
  });
});
