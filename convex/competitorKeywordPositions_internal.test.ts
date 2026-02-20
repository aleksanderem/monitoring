import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a minimal tenant hierarchy
async function createTenantHierarchy(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      emailVerificationTime: Date.now(),
    });
  });

  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
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
      role: "owner" as const,
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Default Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: "mysite.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google",
        location: "United States",
        language: "en",
      },
    });
  });

  return { userId, orgId, teamId, projectId, domainId };
}

async function createCompetitor(t: any, domainId: any, domain: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("competitors", {
      domainId,
      competitorDomain: domain,
      name: domain,
      status: "active" as const,
      createdAt: Date.now(),
    });
  });
}

async function createKeyword(t: any, domainId: any, phrase: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("keywords", {
      domainId,
      phrase,
      status: "active" as const,
      createdAt: Date.now(),
    });
  });
}

async function insertPosition(
  t: any,
  competitorId: any,
  keywordId: any,
  position: number | null,
  date: string,
  url: string | null = null
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("competitorKeywordPositions", {
      competitorId,
      keywordId,
      date,
      position,
      url,
      fetchedAt: Date.now(),
    });
  });
}

describe("competitorKeywordPositions_internal", () => {
  describe("getLatestPosition", () => {
    test("returns null when no positions exist", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const kwId = await createKeyword(t, tenant.domainId, "test keyword");

      const result = await t.query(
        internal.competitorKeywordPositions_internal.getLatestPosition,
        { competitorId: compId, keywordId: kwId }
      );

      expect(result).toBeNull();
    });

    test("returns the latest position for a competitor-keyword pair", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const kwId = await createKeyword(t, tenant.domainId, "seo tools");

      await insertPosition(t, compId, kwId, 10, "2025-01-01", "https://rival.com/page1");
      await insertPosition(t, compId, kwId, 5, "2025-01-02", "https://rival.com/page2");
      await insertPosition(t, compId, kwId, 3, "2025-01-03", "https://rival.com/page3");

      const result = await t.query(
        internal.competitorKeywordPositions_internal.getLatestPosition,
        { competitorId: compId, keywordId: kwId }
      );

      expect(result).not.toBeNull();
      // The latest inserted (desc order by _creationTime) should be the one returned
      expect(result!.position).toBe(3);
      expect(result!.date).toBe("2025-01-03");
    });

    test("does not return positions for different competitor", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const comp1 = await createCompetitor(t, tenant.domainId, "rival1.com");
      const comp2 = await createCompetitor(t, tenant.domainId, "rival2.com");
      const kwId = await createKeyword(t, tenant.domainId, "seo tools");

      await insertPosition(t, comp1, kwId, 5, "2025-01-01");

      const result = await t.query(
        internal.competitorKeywordPositions_internal.getLatestPosition,
        { competitorId: comp2, keywordId: kwId }
      );

      expect(result).toBeNull();
    });

    test("does not return positions for different keyword", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const kw1 = await createKeyword(t, tenant.domainId, "keyword one");
      const kw2 = await createKeyword(t, tenant.domainId, "keyword two");

      await insertPosition(t, compId, kw1, 5, "2025-01-01");

      const result = await t.query(
        internal.competitorKeywordPositions_internal.getLatestPosition,
        { competitorId: compId, keywordId: kw2 }
      );

      expect(result).toBeNull();
    });
  });

  describe("getLatestCompetitorPositionsBatch", () => {
    test("returns empty array when no positions exist", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const kwId = await createKeyword(t, tenant.domainId, "seo tools");

      const results = await t.query(
        internal.competitorKeywordPositions_internal.getLatestCompetitorPositionsBatch,
        { competitorIds: [compId], keywordIds: [kwId] }
      );

      expect(results).toEqual([]);
    });

    test("returns latest positions for multiple competitors and keywords", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const comp1 = await createCompetitor(t, tenant.domainId, "rival1.com");
      const comp2 = await createCompetitor(t, tenant.domainId, "rival2.com");
      const kw1 = await createKeyword(t, tenant.domainId, "keyword one");
      const kw2 = await createKeyword(t, tenant.domainId, "keyword two");

      // Comp1 positions for kw1 (older then newer)
      await insertPosition(t, comp1, kw1, 10, "2025-01-01");
      await insertPosition(t, comp1, kw1, 5, "2025-01-02");
      // Comp1 position for kw2
      await insertPosition(t, comp1, kw2, 8, "2025-01-01");
      // Comp2 position for kw1
      await insertPosition(t, comp2, kw1, 3, "2025-01-01", "https://rival2.com/p");

      const results = await t.query(
        internal.competitorKeywordPositions_internal.getLatestCompetitorPositionsBatch,
        { competitorIds: [comp1, comp2], keywordIds: [kw1, kw2] }
      );

      expect(results).toHaveLength(3);

      // comp1+kw1 should be the latest (position 5)
      const c1k1 = results.find(
        (r: any) => r.competitorId === comp1 && r.keywordId === kw1
      );
      expect(c1k1).toBeDefined();
      expect(c1k1!.position).toBe(5);

      // comp1+kw2 should be position 8
      const c1k2 = results.find(
        (r: any) => r.competitorId === comp1 && r.keywordId === kw2
      );
      expect(c1k2).toBeDefined();
      expect(c1k2!.position).toBe(8);

      // comp2+kw1 should be position 3
      const c2k1 = results.find(
        (r: any) => r.competitorId === comp2 && r.keywordId === kw1
      );
      expect(c2k1).toBeDefined();
      expect(c2k1!.position).toBe(3);
      expect(c2k1!.url).toBe("https://rival2.com/p");
    });

    test("filters to only requested keyword IDs", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const kw1 = await createKeyword(t, tenant.domainId, "keyword one");
      const kw2 = await createKeyword(t, tenant.domainId, "keyword two");
      const kw3 = await createKeyword(t, tenant.domainId, "keyword three");

      await insertPosition(t, compId, kw1, 5, "2025-01-01");
      await insertPosition(t, compId, kw2, 10, "2025-01-01");
      await insertPosition(t, compId, kw3, 15, "2025-01-01");

      // Only request kw1 and kw3
      const results = await t.query(
        internal.competitorKeywordPositions_internal.getLatestCompetitorPositionsBatch,
        { competitorIds: [compId], keywordIds: [kw1, kw3] }
      );

      expect(results).toHaveLength(2);
      const keywords = results.map((r: any) => r.keywordId);
      expect(keywords).toContain(kw1);
      expect(keywords).toContain(kw3);
      expect(keywords).not.toContain(kw2);
    });

    test("returns empty for empty input arrays", async () => {
      const t = convexTest(schema, modules);

      const results = await t.query(
        internal.competitorKeywordPositions_internal.getLatestCompetitorPositionsBatch,
        { competitorIds: [], keywordIds: [] }
      );

      expect(results).toEqual([]);
    });

    test("handles null positions correctly", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const kwId = await createKeyword(t, tenant.domainId, "keyword");

      await insertPosition(t, compId, kwId, null, "2025-01-01", null);

      const results = await t.query(
        internal.competitorKeywordPositions_internal.getLatestCompetitorPositionsBatch,
        { competitorIds: [compId], keywordIds: [kwId] }
      );

      expect(results).toHaveLength(1);
      expect(results[0].position).toBeNull();
      expect(results[0].url).toBeNull();
    });
  });
});
