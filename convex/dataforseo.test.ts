import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupKeyword(t: ReturnType<typeof convexTest>) {
  const orgId = await t.run(async (ctx) => {
    return ctx.db.insert("organizations", {
      name: "Org",
      slug: "org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });
  const teamId = await t.run(async (ctx) => {
    return ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Team",
      createdAt: Date.now(),
    });
  });
  const projectId = await t.run(async (ctx) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Proj",
      createdAt: Date.now(),
    });
  });
  const domainId = await t.run(async (ctx) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google.com",
        location: "US",
        language: "en",
      },
    });
  });
  const keywordId = await t.run(async (ctx) => {
    return ctx.db.insert("keywords", {
      domainId,
      phrase: "test keyword",
      status: "active" as const,
      createdAt: Date.now(),
    });
  });
  return { orgId, teamId, projectId, domainId, keywordId };
}

// ---------------------------------------------------------------------------
// storePositionInternal
// ---------------------------------------------------------------------------
describe("storePositionInternal", () => {
  test("inserts a new position record", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    const posId = await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 5,
      url: "https://example.com/page",
    });

    expect(posId).toBeDefined();

    const pos = await t.run(async (ctx) => {
      return ctx.db.get(posId);
    });
    expect(pos).not.toBeNull();
    expect(pos!.keywordId).toBe(keywordId);
    expect(pos!.date).toBe("2025-01-15");
    expect(pos!.position).toBe(5);
    expect(pos!.url).toBe("https://example.com/page");
  });

  test("upserts existing position for same keyword+date", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    const posId1 = await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 5,
      url: "https://example.com/page",
    });

    const posId2 = await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 3,
      url: "https://example.com/better-page",
    });

    // Should reuse the same record
    expect(posId2).toBe(posId1);

    const pos = await t.run(async (ctx) => {
      return ctx.db.get(posId1);
    });
    expect(pos!.position).toBe(3);
    expect(pos!.url).toBe("https://example.com/better-page");
  });

  test("denormalizes currentPosition onto keyword", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 8,
      url: "https://example.com/page",
    });

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    expect(kw!.currentPosition).toBe(8);
    expect(kw!.currentUrl).toBe("https://example.com/page");
  });

  test("calculates positionChange correctly (positive = improvement)", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    // First position
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-14",
      position: 10,
      url: "https://example.com/page",
    });

    // Second position — improved from 10 to 5, change = 10-5 = 5
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 5,
      url: "https://example.com/page",
    });

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    expect(kw!.currentPosition).toBe(5);
    expect(kw!.previousPosition).toBe(10);
    expect(kw!.positionChange).toBe(5); // previousPosition - currentPosition
  });

  test("maintains recentPositions array (max 7 entries)", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    // Insert 9 positions — only the last 7 should be kept
    for (let i = 1; i <= 9; i++) {
      await t.mutation(internal.dataforseo.storePositionInternal, {
        keywordId,
        date: `2025-01-${String(i).padStart(2, "0")}`,
        position: i * 2,
        url: null,
      });
    }

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    expect(kw!.recentPositions).toHaveLength(7);
    // Should keep dates 03..09 (last 7)
    expect(kw!.recentPositions![0].date).toBe("2025-01-03");
    expect(kw!.recentPositions![6].date).toBe("2025-01-09");
  });

  test("handles null position correctly", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: null,
      url: null,
    });

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    expect(kw!.currentPosition).toBeNull();
    expect(kw!.currentUrl).toBeNull();
    expect(kw!.positionChange).toBeNull();
  });

  test("updates searchVolume, difficulty, and cpc on keyword", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 3,
      url: "https://example.com/page",
      searchVolume: 5000,
      difficulty: 45,
      cpc: 2.5,
    });

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    expect(kw!.searchVolume).toBe(5000);
    expect(kw!.difficulty).toBe(45);
    expect(kw!.latestCpc).toBe(2.5);
  });

  test("multiple dates build up recentPositions correctly", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-10",
      position: 20,
      url: null,
    });
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-11",
      position: 15,
      url: null,
    });
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-12",
      position: 10,
      url: null,
    });

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    expect(kw!.recentPositions).toHaveLength(3);
    expect(kw!.recentPositions).toEqual([
      { date: "2025-01-10", position: 20 },
      { date: "2025-01-11", position: 15 },
      { date: "2025-01-12", position: 10 },
    ]);
    // Latest is 10, previous is 15, change = 15-10 = 5
    expect(kw!.currentPosition).toBe(10);
    expect(kw!.previousPosition).toBe(15);
    expect(kw!.positionChange).toBe(5);
  });

  test("replaces entry for same date in recentPositions on upsert", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-10",
      position: 20,
      url: null,
    });
    // Upsert same date with new position
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-10",
      position: 12,
      url: null,
    });

    const kw = await t.run(async (ctx) => {
      return ctx.db.get(keywordId);
    });
    // Should still be length 1, not 2
    expect(kw!.recentPositions).toHaveLength(1);
    expect(kw!.recentPositions![0]).toEqual({ date: "2025-01-10", position: 12 });
  });
});

// ---------------------------------------------------------------------------
// markDomainRefreshed
// ---------------------------------------------------------------------------
describe("markDomainRefreshed", () => {
  test("sets lastRefreshedAt timestamp on domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupKeyword(t);

    // Verify no timestamp initially
    const before = await t.run(async (ctx) => {
      return ctx.db.get(domainId);
    });
    expect(before!.lastRefreshedAt).toBeUndefined();

    await t.mutation(internal.dataforseo.markDomainRefreshed, { domainId });

    const after = await t.run(async (ctx) => {
      return ctx.db.get(domainId);
    });
    expect(after!.lastRefreshedAt).toBeDefined();
    expect(typeof after!.lastRefreshedAt).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// checkKeywordHasHistory
// ---------------------------------------------------------------------------
describe("checkKeywordHasHistory", () => {
  test("returns false when no positions exist", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    const result = await t.query(internal.dataforseo.checkKeywordHasHistory, {
      keywordId,
    });
    expect(result).toBe(false);
  });

  test("returns false when only 1 position exists", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 5,
      url: null,
    });

    const result = await t.query(internal.dataforseo.checkKeywordHasHistory, {
      keywordId,
    });
    expect(result).toBe(false);
  });

  test("returns true when >= 2 positions exist", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-14",
      position: 5,
      url: null,
    });
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 3,
      url: null,
    });

    const result = await t.query(internal.dataforseo.checkKeywordHasHistory, {
      keywordId,
    });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getExistingPositionDates
// ---------------------------------------------------------------------------
describe("getExistingPositionDates", () => {
  test("returns empty array when no positions exist", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    const dates = await t.query(internal.dataforseo.getExistingPositionDates, {
      keywordId,
    });
    expect(dates).toEqual([]);
  });

  test("returns dates that have stored positions", async () => {
    const t = convexTest(schema, modules);
    const { keywordId } = await setupKeyword(t);

    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-14",
      position: 5,
      url: null,
    });
    await t.mutation(internal.dataforseo.storePositionInternal, {
      keywordId,
      date: "2025-01-15",
      position: 3,
      url: null,
    });

    const dates = await t.query(internal.dataforseo.getExistingPositionDates, {
      keywordId,
    });
    expect(dates).toHaveLength(2);
    expect(dates).toContain("2025-01-14");
    expect(dates).toContain("2025-01-15");
  });
});
