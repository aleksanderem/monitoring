import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create full hierarchy and return all IDs.
 */
async function setupTestHierarchy(t: ReturnType<typeof convexTest>) {
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
      domain: "mysite.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  const asUser = t.withIdentity({ subject: userId });
  return { userId, orgId, teamId, projectId, domainId, asUser };
}

// =============================================
// setKeywordType
// =============================================

describe("setKeywordType", () => {
  test("assigns a keyword type to a keyword", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["best seo tools"],
    });

    await asUser.mutation(api.keywordMap_mutations.setKeywordType, {
      keywordId: ids[0],
      keywordType: "core",
    });

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(ids[0]);
    });
    expect(keyword?.keywordType).toBe("core");
  });

  test("updates keyword type from core to branded", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["mysite reviews"],
    });

    await asUser.mutation(api.keywordMap_mutations.setKeywordType, {
      keywordId: ids[0],
      keywordType: "core",
    });

    await asUser.mutation(api.keywordMap_mutations.setKeywordType, {
      keywordId: ids[0],
      keywordType: "branded",
    });

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(ids[0]);
    });
    expect(keyword?.keywordType).toBe("branded");
  });

  test("throws for non-existent keyword", async () => {
    const t = convexTest(schema, modules);
    await setupTestHierarchy(t);

    // Use a fake keyword ID
    await expect(
      t.mutation(api.keywordMap_mutations.setKeywordType, {
        keywordId: "k57f0vq0dg22csekbm8fxeh2s172w8m4" as Id<"keywords">,
        keywordType: "longtail",
      })
    ).rejects.toThrow();
  });
});

// =============================================
// backfillKeywordTypes
// =============================================

describe("backfillKeywordTypes", () => {
  test("auto-detects keyword types based on domain and phrase length", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: [
        "seo",                                       // core (short)
        "mysite review best tool 2024",              // branded (contains domain base)
        "how to do keyword research for beginners",  // longtail (4+ words)
      ],
    });

    const result = await asUser.mutation(api.keywordMap_mutations.backfillKeywordTypes, {
      domainId,
    });

    expect(result.updated).toBe(3);
    expect(result.total).toBe(3);

    // Verify the types
    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    const byPhrase = Object.fromEntries(keywords.map((k: any) => [k.phrase, k]));

    expect(byPhrase["seo"].keywordType).toBe("core");
    expect(byPhrase["mysite review best tool 2024"].keywordType).toBe("branded");
    expect(byPhrase["how to do keyword research for beginners"].keywordType).toBe("longtail");
  });

  test("skips keywords that already have a type", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["already typed"],
    });

    // Set type manually
    await asUser.mutation(api.keywordMap_mutations.setKeywordType, {
      keywordId: ids[0],
      keywordType: "branded",
    });

    const result = await asUser.mutation(api.keywordMap_mutations.backfillKeywordTypes, {
      domainId,
    });

    // Should not update the already-typed keyword
    expect(result.updated).toBe(0);

    const keyword = await t.run(async (ctx) => {
      return await ctx.db.get(ids[0]);
    });
    expect(keyword?.keywordType).toBe("branded"); // unchanged
  });
});

// =============================================
// getKeywordMapData
// =============================================

describe("getKeywordMapData", () => {
  test("returns empty for domain with no discovered keywords", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const data = await asUser.query(api.keywordMap_queries.getKeywordMapData, { domainId });
    expect(data).toEqual([]);
  });

  test("returns discovered keywords with monitoring status", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    // Add a monitored keyword
    await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["monitored keyword"],
    });

    // Insert discovered keywords (simulating what DataForSEO integration would do)
    await t.run(async (ctx) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "monitored keyword",
        bestPosition: 5,
        url: "https://mysite.com/page1",
        searchVolume: 1200,
        difficulty: 35,
        cpc: 2.5,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "unmonitored keyword",
        bestPosition: 12,
        url: "https://mysite.com/page2",
        searchVolume: 800,
        difficulty: 50,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const data = await asUser.query(api.keywordMap_queries.getKeywordMapData, { domainId });
    expect(data).toHaveLength(2);

    const monitored = data.find((d: any) => d.keyword === "monitored keyword");
    const unmonitored = data.find((d: any) => d.keyword === "unmonitored keyword");

    expect(monitored?.isMonitored).toBe(true);
    expect(monitored?.monitoredKeywordId).toBeTruthy();
    expect(monitored?.position).toBe(5);
    expect(monitored?.searchVolume).toBe(1200);
    expect(monitored?.difficulty).toBe(35);

    expect(unmonitored?.isMonitored).toBe(false);
    expect(unmonitored?.monitoredKeywordId).toBeNull();
  });

  test("correctly classifies keyword types", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      // Branded keyword (contains domain base "mysite")
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "mysite login",
        bestPosition: 1,
        url: "https://mysite.com/login",
        searchVolume: 5000,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Longtail keyword (4+ words)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "best way to track seo rankings",
        bestPosition: 8,
        url: "https://mysite.com/guide",
        searchVolume: 300,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Core keyword (short, not branded)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "seo tools",
        bestPosition: 15,
        url: "https://mysite.com/tools",
        searchVolume: 2000,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const data = await asUser.query(api.keywordMap_queries.getKeywordMapData, { domainId });

    const branded = data.find((d: any) => d.keyword === "mysite login");
    const longtail = data.find((d: any) => d.keyword === "best way to track seo rankings");
    const core = data.find((d: any) => d.keyword === "seo tools");

    expect(branded?.keywordType).toBe("branded");
    expect(longtail?.keywordType).toBe("longtail");
    expect(core?.keywordType).toBe("core");
  });

  test("filters out keywords with position 0", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "visible keyword",
        bestPosition: 10,
        url: "https://mysite.com/page",
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "zero position",
        bestPosition: 0,
        url: "https://mysite.com/page2",
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const data = await asUser.query(api.keywordMap_queries.getKeywordMapData, { domainId });
    expect(data).toHaveLength(1);
    expect(data[0].keyword).toBe("visible keyword");
  });
});

// =============================================
// getQuickWins
// =============================================

describe("getQuickWins", () => {
  test("returns keywords in striking distance with good metrics", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      // Quick win: position 11-20, high volume, low difficulty
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "easy win keyword",
        bestPosition: 12,
        url: "https://mysite.com/easy",
        searchVolume: 500,
        difficulty: 25,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Not a quick win: position too high (already top 3)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "already ranking",
        bestPosition: 2,
        url: "https://mysite.com/top",
        searchVolume: 1000,
        difficulty: 30,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Not a quick win: position too low (31+)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "too far away",
        bestPosition: 45,
        url: "https://mysite.com/far",
        searchVolume: 800,
        difficulty: 20,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Not a quick win: difficulty too high
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "hard keyword",
        bestPosition: 15,
        url: "https://mysite.com/hard",
        searchVolume: 600,
        difficulty: 75,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Not a quick win: volume too low
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "low volume",
        bestPosition: 10,
        url: "https://mysite.com/low",
        searchVolume: 50,
        difficulty: 20,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const wins = await asUser.query(api.keywordMap_queries.getQuickWins, { domainId });

    // Only "easy win keyword" should qualify (pos 4-30, vol >= 100, diff < 50)
    expect(wins).toHaveLength(1);
    expect(wins[0].keyword).toBe("easy win keyword");
    expect(wins[0].quickWinScore).toBeGreaterThan(0);
  });

  test("returns empty array for domain with no quick wins", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const wins = await asUser.query(api.keywordMap_queries.getQuickWins, { domainId });
    expect(wins).toEqual([]);
  });
});

// =============================================
// getDifficultyDistribution
// =============================================

describe("getDifficultyDistribution", () => {
  test("correctly buckets keywords by difficulty tier", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      // Easy (<30)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "easy kw",
        bestPosition: 5,
        url: "https://mysite.com/e",
        difficulty: 15,
        searchVolume: 100,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Medium (30-49)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "medium kw",
        bestPosition: 10,
        url: "https://mysite.com/m",
        difficulty: 40,
        searchVolume: 200,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Hard (50-74)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "hard kw",
        bestPosition: 20,
        url: "https://mysite.com/h",
        difficulty: 60,
        searchVolume: 300,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      // Very hard (75+)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "very hard kw",
        bestPosition: 30,
        url: "https://mysite.com/vh",
        difficulty: 85,
        searchVolume: 400,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const result = await asUser.query(api.keywordMap_queries.getDifficultyDistribution, { domainId });

    expect(result.distribution.easy).toBe(1);
    expect(result.distribution.medium).toBe(1);
    expect(result.distribution.hard).toBe(1);
    expect(result.distribution.very_hard).toBe(1);
    expect(result.total).toBe(4);

    // Volume by tier
    expect(result.volumeByTier.easy).toBe(100);
    expect(result.volumeByTier.medium).toBe(200);
    expect(result.volumeByTier.hard).toBe(300);
    expect(result.volumeByTier.very_hard).toBe(400);
  });
});

// =============================================
// getIntentDistribution
// =============================================

describe("getIntentDistribution", () => {
  test("groups keywords by search intent", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "what is seo",
        bestPosition: 8,
        url: "https://mysite.com/what",
        intent: "informational",
        searchVolume: 5000,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "best seo tool price",
        bestPosition: 12,
        url: "https://mysite.com/best",
        intent: "commercial",
        searchVolume: 2000,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });

      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "buy seo tool",
        bestPosition: 15,
        url: "https://mysite.com/buy",
        intent: "transactional",
        searchVolume: 1000,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const result = await asUser.query(api.keywordMap_queries.getIntentDistribution, { domainId });

    expect(result.informational.count).toBe(1);
    expect(result.informational.totalVolume).toBe(5000);
    expect(result.commercial.count).toBe(1);
    expect(result.commercial.totalVolume).toBe(2000);
    expect(result.transactional.count).toBe(1);
    expect(result.transactional.totalVolume).toBe(1000);
    expect(result.navigational.count).toBe(0);
  });
});

// =============================================
// Keyword map with monitored keyword type override
// =============================================

describe("keyword map with type override", () => {
  test("keywordTypeOverride from monitored keyword is reflected in map data", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    // Add and type a monitored keyword
    const ids = await asUser.mutation(api.keywords.addKeywords, {
      domainId,
      phrases: ["typed keyword"],
    });

    await asUser.mutation(api.keywordMap_mutations.setKeywordType, {
      keywordId: ids[0],
      keywordType: "branded",
    });

    // Insert corresponding discovered keyword
    await t.run(async (ctx) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "typed keyword",
        bestPosition: 7,
        url: "https://mysite.com/typed",
        searchVolume: 500,
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const data = await asUser.query(api.keywordMap_queries.getKeywordMapData, { domainId });
    const entry = data.find((d: any) => d.keyword === "typed keyword");

    expect(entry?.isMonitored).toBe(true);
    expect(entry?.keywordTypeOverride).toBe("branded");
    // Auto-detected type should be "core" (short phrase, no brand match based on auto-detection)
    expect(entry?.keywordType).toBe("core");
  });
});

// =============================================
// Keywords without URL mapping show in map
// =============================================

describe("keywords without additional metadata", () => {
  test("discovered keywords without optional fields still appear", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "minimal keyword",
        bestPosition: 20,
        url: "https://mysite.com/min",
        lastSeenDate: "2024-06-01",
        status: "discovered",
        createdAt: Date.now(),
        // No searchVolume, difficulty, cpc, intent, etc.
      });
    });

    const data = await asUser.query(api.keywordMap_queries.getKeywordMapData, { domainId });
    expect(data).toHaveLength(1);
    expect(data[0].keyword).toBe("minimal keyword");
    expect(data[0].searchVolume).toBeNull();
    expect(data[0].difficulty).toBeNull();
    expect(data[0].cpc).toBeNull();
    expect(data[0].intent).toBeNull();
    expect(data[0].quickWinScore).toBe(0); // no data = 0 score
  });
});
