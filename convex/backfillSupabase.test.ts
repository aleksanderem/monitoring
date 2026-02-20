import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google",
  location: "US",
  language: "en",
};

async function setupDomain(t: any, domainName = "example.com") {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });

  const teamId = await t.run(async (ctx: any) => {
    return ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx: any) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: domainName,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });

  return { orgId, teamId, projectId, domainId };
}

// ---------------------------------------------------------------------------
// getKeywordPositionsForBackfill
// ---------------------------------------------------------------------------

describe("getKeywordPositionsForBackfill", () => {
  test("returns null for non-existent keyword", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // Create a keyword to get a valid-format ID, then delete it
    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "temp",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });
    await t.run(async (ctx: any) => ctx.db.delete(keywordId));

    const result = await t.query(internal.backfillSupabase.getKeywordPositionsForBackfill, {
      keywordId,
    });
    expect(result).toBeNull();
  });

  test("returns domainId and empty positions when keyword has no position data", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const result = await t.query(internal.backfillSupabase.getKeywordPositionsForBackfill, {
      keywordId,
    });

    expect(result).not.toBeNull();
    expect(result!.domainId).toEqual(domainId);
    expect(result!.positions).toEqual([]);
  });

  test("returns keyword positions with all fields mapped correctly", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    // Insert position data
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordPositions", {
        keywordId,
        date: "2025-01-15",
        position: 5,
        url: "https://example.com/page",
        searchVolume: 1000,
        difficulty: 40,
        cpc: 2.5,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("keywordPositions", {
        keywordId,
        date: "2025-01-16",
        position: 3,
        url: "https://example.com/page",
        searchVolume: 1000,
        difficulty: 42,
        cpc: 2.6,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(internal.backfillSupabase.getKeywordPositionsForBackfill, {
      keywordId,
    });

    expect(result!.positions).toHaveLength(2);
    expect(result!.positions[0]).toEqual({
      date: "2025-01-15",
      position: 5,
      url: "https://example.com/page",
      searchVolume: 1000,
      difficulty: 40,
      cpc: 2.5,
    });
  });

  test("maps null optional fields correctly", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordPositions", {
        keywordId,
        date: "2025-01-15",
        position: null,
        url: null,
        fetchedAt: Date.now(),
        // No searchVolume, difficulty, or cpc
      });
    });

    const result = await t.query(internal.backfillSupabase.getKeywordPositionsForBackfill, {
      keywordId,
    });

    expect(result!.positions[0]).toEqual({
      date: "2025-01-15",
      position: null,
      url: null,
      searchVolume: null,
      difficulty: null,
      cpc: null,
    });
  });
});

// ---------------------------------------------------------------------------
// getCompetitorPositionsForBackfill
// ---------------------------------------------------------------------------

describe("getCompetitorPositionsForBackfill", () => {
  test("returns empty array when competitor has no positions", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.backfillSupabase.getCompetitorPositionsForBackfill, {
      competitorId,
    });
    expect(result).toEqual([]);
  });

  test("returns competitor positions with correct fields", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test kw",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorKeywordPositions", {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 4,
        url: "https://comp.com/page",
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(internal.backfillSupabase.getCompetitorPositionsForBackfill, {
      competitorId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].keywordId).toBeDefined();
    expect(result[0].date).toBe("2025-01-15");
    expect(result[0].position).toBe(4);
    expect(result[0].url).toBe("https://comp.com/page");
  });
});

// ---------------------------------------------------------------------------
// getDomainKeywordIdsForBackfill
// ---------------------------------------------------------------------------

describe("getDomainKeywordIdsForBackfill", () => {
  test("returns empty array when domain has no keywords", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const result = await t.query(internal.backfillSupabase.getDomainKeywordIdsForBackfill, {
      domainId,
    });
    expect(result).toEqual([]);
  });

  test("returns all keyword IDs for a domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const kw1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "kw1",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });
    const kw2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "kw2",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const result = await t.query(internal.backfillSupabase.getDomainKeywordIdsForBackfill, {
      domainId,
    });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(kw1);
    expect(result).toContainEqual(kw2);
  });
});

// ---------------------------------------------------------------------------
// getDomainCompetitorIdsForBackfill
// ---------------------------------------------------------------------------

describe("getDomainCompetitorIdsForBackfill", () => {
  test("returns empty array when domain has no competitors", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const result = await t.query(internal.backfillSupabase.getDomainCompetitorIdsForBackfill, {
      domainId,
    });
    expect(result).toEqual([]);
  });

  test("returns all competitor IDs for a domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const c1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp1.com",
        name: "comp1.com",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });
    const c2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp2.com",
        name: "comp2.com",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.backfillSupabase.getDomainCompetitorIdsForBackfill, {
      domainId,
    });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(c1);
    expect(result).toContainEqual(c2);
  });
});

// ---------------------------------------------------------------------------
// getAllDomainIds
// ---------------------------------------------------------------------------

describe("getAllDomainIds", () => {
  test("returns empty array when no domains exist", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(internal.backfillSupabase.getAllDomainIds, {});
    expect(result).toEqual([]);
  });

  test("returns all domain IDs", async () => {
    const t = convexTest(schema, modules);
    const { domainId: d1 } = await setupDomain(t, "domain1.com");

    // Create a second domain in same project structure
    const orgId = await t.run(async (ctx: any) => {
      return ctx.db.insert("organizations", {
        name: "Org 2",
        slug: "org-2",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
    });
    const teamId = await t.run(async (ctx: any) => {
      return ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team 2",
        createdAt: Date.now(),
      });
    });
    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Project 2",
        createdAt: Date.now(),
      });
    });
    const d2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "domain2.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const result = await t.query(internal.backfillSupabase.getAllDomainIds, {});
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(d1);
    expect(result).toContainEqual(d2);
  });
});
