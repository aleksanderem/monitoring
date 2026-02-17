import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create full hierarchy (user -> org -> orgMember -> team -> project -> domain)
 * and return all IDs needed for tests. The user is an "owner" so all permissions are granted.
 */
async function setupTestHierarchy(t: ReturnType<typeof convexTest>, opts?: {
  domainLimits?: { maxKeywords?: number; maxDailyRefreshes?: number };
  orgLimits?: Record<string, number | undefined>;
}) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    } as any);
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
      limits: opts?.orgLimits as any,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Test Team",
      createdAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
      limits: opts?.domainLimits as any,
    });
  });

  return { userId, orgId, teamId, projectId, domainId };
}

// =============================================
// getKeywords
// =============================================

describe("getKeywords", () => {
  test("returns empty array for domain with no keywords", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toEqual([]);
  });

  test("returns keywords after adding them", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["best seo tools", "keyword research", "backlink analysis"],
    });

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(3);
    const phrases = keywords.map((k: any) => k.phrase).sort();
    expect(phrases).toEqual(["backlink analysis", "best seo tools", "keyword research"]);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    // No identity set, should return empty array
    const keywords = await t.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toEqual([]);
  });
});

// =============================================
// addKeyword / addKeywords
// =============================================

describe("addKeyword", () => {
  test("adds a single keyword successfully", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const keywordId = await asUser.mutation(api.keywords.addKeyword, {
      domainId,
      phrase: "SEO Optimization Tips",
    });

    expect(keywordId).toBeTruthy();

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(1);
    expect(keywords[0].phrase).toBe("seo optimization tips"); // normalized to lowercase
  });

  test("rejects duplicate keyword", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.keywords.addKeyword, {
      domainId,
      phrase: "seo tools",
    });

    await expect(
      asUser.mutation(api.keywords.addKeyword, {
        domainId,
        phrase: "seo tools",
      })
    ).rejects.toThrow("Keyword already exists");
  });

  test("rejects invalid keyword phrase (too short)", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.keywords.addKeyword, {
        domainId,
        phrase: "a",
      })
    ).rejects.toThrow();
  });

  test("rejects URL-like phrases", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.keywords.addKeyword, {
        domainId,
        phrase: "https://example.com/page",
      })
    ).rejects.toThrow();
  });
});

describe("addKeywords (bulk)", () => {
  test("adds multiple keywords and deduplicates", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const result = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: [
        "best seo tools 2024",
        "keyword research guide",
        "best seo tools 2024", // duplicate
        "link building strategies",
        "", // empty — should be skipped
      ],
    });

    // Should only insert 3 unique valid keywords
    expect(result).toHaveLength(3);

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(3);
  });

  test("skips already existing keywords in DB", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.keywords.addKeyword, {
      domainId,
      phrase: "seo tools",
    });

    const result = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["seo tools", "new keyword here"],
    });

    // Only "new keyword here" should be added
    expect(result).toHaveLength(1);

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(2);
  });
});

// =============================================
// Keyword limit enforcement
// =============================================

describe("keyword limit enforcement", () => {
  test("rejects adding keywords beyond domain limit", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t, {
      domainLimits: { maxKeywords: 3 },
    });
    const asUser = t.withIdentity({ subject: userId });

    // Add 3 keywords (at limit)
    await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["keyword one", "keyword two", "keyword three"],
    });

    // Adding one more should fail
    await expect(
      asUser.mutation(api.keywords.addKeyword, {
        domainId,
        phrase: "keyword four",
      })
    ).rejects.toThrow();
  });

  test("allows adding keywords up to the limit", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t, {
      domainLimits: { maxKeywords: 5 },
    });
    const asUser = t.withIdentity({ subject: userId });

    const result = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["kw one", "kw two", "kw three", "kw four", "kw five"],
    });

    expect(result).toHaveLength(5);
  });

  test("bulk add fails when adding more than remaining capacity", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t, {
      domainLimits: { maxKeywords: 3 },
    });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.keywords.addKeyword, {
      domainId,
      phrase: "existing keyword",
    });

    // Try adding 3 more when only 2 slots remain
    await expect(
      asUser.mutation(api.keywords.addKeywords, {
        domainId,
        phrases: ["new one", "new two", "new three"],
      })
    ).rejects.toThrow();
  });
});

// =============================================
// deleteKeyword / deleteKeywords
// =============================================

describe("deleteKeyword", () => {
  test("removes a specific keyword, others remain", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["alpha keyword", "beta keyword", "gamma keyword"],
    });

    await asUser.mutation(api.keywords.deleteKeyword, { keywordId: ids[0] });

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(2);
    const phrases = keywords.map((k: any) => k.phrase).sort();
    expect(phrases).toEqual(["beta keyword", "gamma keyword"]);
  });

  test("also deletes associated position records", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["test keyword"],
    });
    const keywordId = ids[0];

    // Store a position
    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-15",
      position: 5,
      url: "https://example.com/page",
    });

    // Delete the keyword
    await asUser.mutation(api.keywords.deleteKeyword, { keywordId });

    // Verify positions are gone
    const positions = await t.run(async (ctx) => {
      return await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q: any) => q.eq("keywordId", keywordId))
        .collect();
    });
    expect(positions).toHaveLength(0);
  });
});

describe("deleteKeywords (bulk)", () => {
  test("removes multiple keywords", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["one", "two", "three", "four"],
    });

    await asUser.mutation(api.keywords.deleteKeywords, {
      keywordIds: [ids[0], ids[1]],
    });

    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(2);
  });
});

// =============================================
// storePosition & denormalized fields
// =============================================

describe("storePosition", () => {
  test("stores a position and updates denormalized fields", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["rank tracking tool"],
    });
    const keywordId = ids[0];

    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-15",
      position: 8,
      url: "https://example.com/rank-tracking",
      searchVolume: 2400,
      difficulty: 45,
      cpc: 1.5,
    });

    // Check denormalized fields on keyword
    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(keywordId);
    });

    expect(keyword?.currentPosition).toBe(8);
    expect(keyword?.currentUrl).toBe("https://example.com/rank-tracking");
    expect(keyword?.searchVolume).toBe(2400);
    expect(keyword?.difficulty).toBe(45);
    expect(keyword?.latestCpc).toBe(1.5);
    expect(keyword?.positionUpdatedAt).toBeTruthy();
    expect(keyword?.recentPositions).toHaveLength(1);
    expect(keyword?.recentPositions?.[0]).toEqual({
      date: "2024-01-15",
      position: 8,
    });
  });

  test("updates previous position on subsequent store", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["position tracking"],
    });
    const keywordId = ids[0];

    // Store first position
    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-15",
      position: 10,
      url: "https://example.com/page",
    });

    // Store second position
    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-16",
      position: 7,
      url: "https://example.com/page",
    });

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(keywordId);
    });

    expect(keyword?.currentPosition).toBe(7);
    expect(keyword?.previousPosition).toBe(10);
    expect(keyword?.positionChange).toBe(3); // 10 - 7 = improvement of 3
  });

  test("calculates positionChange correctly for declining keyword", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["declining keyword"],
    });
    const keywordId = ids[0];

    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-15",
      position: 5,
      url: "https://example.com/page",
    });

    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-16",
      position: 12,
      url: "https://example.com/page",
    });

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(keywordId);
    });

    expect(keyword?.currentPosition).toBe(12);
    expect(keyword?.previousPosition).toBe(5);
    expect(keyword?.positionChange).toBe(-7); // 5 - 12 = decline of 7
  });

  test("overwrites same-date position (upsert)", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["upsert test"],
    });
    const keywordId = ids[0];

    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-15",
      position: 10,
      url: "https://example.com/page",
    });

    // Store again for same date with different position
    await asUser.mutation(api.keywords.storePosition, {
      keywordId,
      date: "2024-01-15",
      position: 8,
      url: "https://example.com/page-updated",
    });

    // Should have only 1 position record
    const positions = await t.run(async (ctx) => {
      return await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q: any) => q.eq("keywordId", keywordId))
        .collect();
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].position).toBe(8);
    expect(positions[0].url).toBe("https://example.com/page-updated");
  });
});

// =============================================
// recentPositions (last 7 only)
// =============================================

describe("recentPositions trimming", () => {
  test("after storing 10 positions, only last 7 remain in recentPositions", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["sparkline test"],
    });
    const keywordId = ids[0];

    // Store 10 positions across 10 consecutive days
    for (let i = 1; i <= 10; i++) {
      const day = String(i).padStart(2, "0");
      await asUser.mutation(api.keywords.storePosition, {
        keywordId,
        date: `2024-01-${day}`,
        position: 20 - i, // positions 19, 18, 17, ..., 11, 10
        url: `https://example.com/page-${i}`,
      });
    }

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(keywordId);
    });

    // recentPositions should have exactly 7 entries
    expect(keyword?.recentPositions).toHaveLength(7);

    // Should be the last 7 dates (Jan 4-10), sorted ascending
    const dates = keyword?.recentPositions?.map((p: any) => p.date);
    expect(dates).toEqual([
      "2024-01-04",
      "2024-01-05",
      "2024-01-06",
      "2024-01-07",
      "2024-01-08",
      "2024-01-09",
      "2024-01-10",
    ]);

    // The last entry should be the current position
    expect(keyword?.currentPosition).toBe(10); // 20 - 10
    // Previous should be 11 (20 - 9)
    expect(keyword?.previousPosition).toBe(11);
    expect(keyword?.positionChange).toBe(1); // improved by 1
  });
});

// =============================================
// getMonitoringStats
// =============================================

describe("getMonitoringStats", () => {
  test("returns correct stats for domain with keywords", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["keyword alpha", "keyword beta", "keyword gamma"],
    });

    // Store positions for all keywords
    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[0],
      date: "2024-06-01",
      position: 3,
      url: "https://example.com/a",
      searchVolume: 1000,
    });

    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[1],
      date: "2024-06-01",
      position: 15,
      url: "https://example.com/b",
      searchVolume: 500,
    });

    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[2],
      date: "2024-06-01",
      position: 50,
      url: "https://example.com/c",
      searchVolume: 200,
    });

    const stats = await asUser.query(api.keywords.getMonitoringStats, { domainId });
    expect(stats).not.toBeNull();
    expect(stats!.totalKeywords).toBe(3);
    // avg position = (3 + 15 + 50) / 3 = 22.7
    expect(stats!.avgPosition).toBeCloseTo(22.7, 0);
    // estimated traffic should be positive since all have search volume
    expect(stats!.estimatedMonthlyTraffic).toBeGreaterThan(0);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const stats = await t.query(api.keywords.getMonitoringStats, { domainId });
    expect(stats).toBeNull();
  });

  test("returns zeros for domain with no positioned keywords", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    // Add keywords without positions
    await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["no position yet"],
    });

    const stats = await asUser.query(api.keywords.getMonitoringStats, { domainId });
    expect(stats!.totalKeywords).toBe(1);
    expect(stats!.avgPosition).toBe(0);
    expect(stats!.estimatedMonthlyTraffic).toBe(0);
  });
});

// =============================================
// updateKeywordStatus
// =============================================

describe("updateKeywordStatus", () => {
  test("pauses an active keyword", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["pauseable keyword"],
    });

    await asUser.mutation(api.keywords.updateKeywordStatus, {
      keywordId: ids[0],
      status: "paused",
    });

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(ids[0]);
    });
    expect(keyword?.status).toBe("paused");
  });
});

// =============================================
// getPositionDistribution
// =============================================

describe("getPositionDistribution", () => {
  test("correctly buckets keywords by position range", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["kw1", "kw2", "kw3", "kw4", "kw5"],
    });

    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[0], date: "2024-01-01", position: 2, url: null,
    });
    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[1], date: "2024-01-01", position: 7, url: null,
    });
    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[2], date: "2024-01-01", position: 15, url: null,
    });
    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[3], date: "2024-01-01", position: 35, url: null,
    });
    await asUser.mutation(api.keywords.storePosition, {
      keywordId: ids[4], date: "2024-01-01", position: 75, url: null,
    });

    const dist = await asUser.query(api.keywords.getPositionDistribution, { domainId });
    expect(dist).not.toBeNull();
    expect(dist!.top3).toBe(1);      // position 2
    expect(dist!.pos4_10).toBe(1);    // position 7
    expect(dist!.pos11_20).toBe(1);   // position 15
    expect(dist!.pos21_50).toBe(1);   // position 35
    expect(dist!.pos51_100).toBe(1);  // position 75
  });
});

// =============================================
// importKeywords
// =============================================

describe("importKeywords", () => {
  test("imports with duplicate detection", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await setupTestHierarchy(t);
    const asUser = t.withIdentity({ subject: userId });

    // Add existing keyword
    await asUser.mutation(api.keywords.addKeyword, {
      domainId,
      phrase: "existing phrase",
    });

    const result = await asUser.mutation(api.keywords.importKeywords, {
      domainId,
      keywords: [
        { phrase: "existing phrase" },  // duplicate
        { phrase: "brand new phrase" },
        { phrase: "another new one" },
      ],
    });

    expect(result.imported).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]).toBe("existing phrase");
    expect(result.total).toBe(3);
  });
});

// =============================================
// Internal keyword operations
// =============================================

describe("internal keyword operations", () => {
  test("createKeywordInternal respects limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t, {
      domainLimits: { maxKeywords: 1 },
    });

    // Add first keyword (should succeed)
    const first = await t.run(async (ctx) => {
      return await ctx.db.insert("keywords", {
        domainId,
        phrase: "first keyword",
        status: "active",
        createdAt: Date.now(),
      });
    });
    expect(first).toBeTruthy();

    // Second should fail via createKeywordInternal
    const second = await t.mutation(internal.keywords.createKeywordInternal, {
      domainId,
      phrase: "second keyword",
      status: "active",
    });
    expect(second).toBeNull(); // returns null when limit reached
  });
});
