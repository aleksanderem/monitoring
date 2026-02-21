import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create org -> team -> project -> domain -> keyword chain
async function setupKeywordChain(t: any) {
  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
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
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  const keywordId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("keywords", {
      domainId,
      phrase: "test keyword",
      createdAt: Date.now(),
      status: "active" as const,
    });
  });

  return { orgId, teamId, projectId, domainId, keywordId };
}

// Helper: insert a position record for a keyword
async function insertPosition(
  t: any,
  keywordId: any,
  opts: { date: string; position: number | null; url?: string | null; fetchedAt?: number }
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("keywordPositions", {
      keywordId,
      date: opts.date,
      position: opts.position,
      url: opts.url ?? null,
      fetchedAt: opts.fetchedAt ?? Date.now(),
    });
  });
}

describe("keywordPositions_internal", () => {
  describe("getLatestPosition", () => {
    test("returns null when keyword has no positions", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      const result = await t.query(internal.keywordPositions_internal.getLatestPosition, {
        keywordId,
      });

      expect(result).toBeNull();
    });

    test("returns the single position when only one exists", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: 5,
        url: "https://example.com/page",
        fetchedAt: 1000,
      });

      const result = await t.query(internal.keywordPositions_internal.getLatestPosition, {
        keywordId,
      });

      expect(result).not.toBeNull();
      expect(result!.position).toBe(5);
      expect(result!.url).toBe("https://example.com/page");
      expect(result!.date).toBe("2025-01-15");
    });

    test("returns the most recently created position when multiple exist", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      await insertPosition(t, keywordId, {
        date: "2025-01-10",
        position: 10,
        url: "https://example.com/old",
      });
      await insertPosition(t, keywordId, {
        date: "2025-01-12",
        position: 7,
        url: "https://example.com/mid",
      });
      // Last inserted = most recent by _creationTime, which "desc" returns first
      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: 3,
        url: "https://example.com/new",
      });

      const result = await t.query(internal.keywordPositions_internal.getLatestPosition, {
        keywordId,
      });

      expect(result).not.toBeNull();
      expect(result!.position).toBe(3);
      expect(result!.date).toBe("2025-01-15");
    });

    test("returns position with null values correctly", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: null,
        url: null,
      });

      const result = await t.query(internal.keywordPositions_internal.getLatestPosition, {
        keywordId,
      });

      expect(result).not.toBeNull();
      expect(result!.position).toBeNull();
      expect(result!.url).toBeNull();
    });
  });

  describe("getLatestPositionsBatch", () => {
    test("returns empty array when no keyword IDs provided", async () => {
      const t = convexTest(schema, modules);

      const results = await t.query(internal.keywordPositions_internal.getLatestPositionsBatch, {
        keywordIds: [],
      });

      expect(results).toEqual([]);
    });

    test("returns empty array when keywords have no positions", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      const results = await t.query(internal.keywordPositions_internal.getLatestPositionsBatch, {
        keywordIds: [keywordId],
      });

      expect(results).toEqual([]);
    });

    test("returns positions for keywords that have them", async () => {
      const t = convexTest(schema, modules);
      const { keywordId, domainId } = await setupKeywordChain(t);

      // Create a second keyword
      const keywordId2 = await t.run(async (ctx: any) => {
        return await ctx.db.insert("keywords", {
          domainId,
          phrase: "second keyword",
          createdAt: Date.now(),
          status: "active" as const,
        });
      });

      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: 5,
        url: "https://example.com/a",
      });
      await insertPosition(t, keywordId2, {
        date: "2025-01-15",
        position: 12,
        url: "https://example.com/b",
      });

      const results = await t.query(internal.keywordPositions_internal.getLatestPositionsBatch, {
        keywordIds: [keywordId, keywordId2],
      });

      expect(results).toHaveLength(2);
      expect(results.find((r: any) => r.keywordId === keywordId)?.position).toBe(5);
      expect(results.find((r: any) => r.keywordId === keywordId2)?.position).toBe(12);
    });

    test("skips keywords that have no positions", async () => {
      const t = convexTest(schema, modules);
      const { keywordId, domainId } = await setupKeywordChain(t);

      const keywordId2 = await t.run(async (ctx: any) => {
        return await ctx.db.insert("keywords", {
          domainId,
          phrase: "no-positions keyword",
          createdAt: Date.now(),
          status: "active" as const,
        });
      });

      // Only add position for the first keyword
      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: 8,
        url: "https://example.com/page",
      });

      const results = await t.query(internal.keywordPositions_internal.getLatestPositionsBatch, {
        keywordIds: [keywordId, keywordId2],
      });

      expect(results).toHaveLength(1);
      expect(results[0].keywordId).toBe(keywordId);
      expect(results[0].position).toBe(8);
    });

    test("returns latest position per keyword when multiple exist", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      await insertPosition(t, keywordId, {
        date: "2025-01-10",
        position: 20,
        url: "https://example.com/old",
        fetchedAt: 1000,
      });
      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: 3,
        url: "https://example.com/new",
        fetchedAt: 2000,
      });

      const results = await t.query(internal.keywordPositions_internal.getLatestPositionsBatch, {
        keywordIds: [keywordId],
      });

      expect(results).toHaveLength(1);
      expect(results[0].position).toBe(3);
      expect(results[0].date).toBe("2025-01-15");
    });

    test("handles null url by returning null in results", async () => {
      const t = convexTest(schema, modules);
      const { keywordId } = await setupKeywordChain(t);

      await insertPosition(t, keywordId, {
        date: "2025-01-15",
        position: 5,
        url: null,
      });

      const results = await t.query(internal.keywordPositions_internal.getLatestPositionsBatch, {
        keywordIds: [keywordId],
      });

      expect(results).toHaveLength(1);
      expect(results[0].url).toBeNull();
    });
  });
});
