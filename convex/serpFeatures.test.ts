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

/** Create a domain + keyword, return both IDs. */
async function setupDomainAndKeyword(t: any, projectId: string) {
  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });

  const keywordId = await t.run(async (ctx: any) => {
    return ctx.db.insert("keywords", {
      domainId,
      phrase: "test keyword",
      status: "active",
      createdAt: Date.now(),
    });
  });

  return { domainId, keywordId };
}

const FEATURES_A = {
  featuredSnippet: true,
  peopleAlsoAsk: true,
  imagePack: false,
  videoPack: false,
  localPack: false,
  knowledgeGraph: false,
  sitelinks: false,
  topStories: false,
  relatedSearches: false,
};

const FEATURES_B = {
  featuredSnippet: false,
  peopleAlsoAsk: true,
  imagePack: true,
  videoPack: false,
  localPack: false,
  knowledgeGraph: true,
  sitelinks: false,
  topStories: false,
  relatedSearches: false,
};

// ===========================================================================
// getSerpFeaturesByKeyword
// ===========================================================================

describe("serpFeatures_queries.getSerpFeaturesByKeyword", () => {
  test("returns features within default 30-day range", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    // Insert one recent and one old record
    const today = new Date();
    const recentDate = new Date(today);
    recentDate.setDate(recentDate.getDate() - 5);
    const recentStr = recentDate.toISOString().split("T")[0];

    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 60);
    const oldStr = oldDate.toISOString().split("T")[0];

    await t.run(async (ctx: any) => {
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: recentStr,
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: oldStr,
        features: FEATURES_B,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const results = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesByKeyword,
      { keywordId }
    );

    // Only the recent one should be returned (default 30 days)
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe(recentStr);
    expect(results[0].features.featuredSnippet).toBe(true);
  });

  test("filters by custom days parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const today = new Date();
    const date10 = new Date(today);
    date10.setDate(date10.getDate() - 10);
    const date10Str = date10.toISOString().split("T")[0];

    const date50 = new Date(today);
    date50.setDate(date50.getDate() - 50);
    const date50Str = date50.toISOString().split("T")[0];

    await t.run(async (ctx: any) => {
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: date10Str,
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: date50Str,
        features: FEATURES_B,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });

    // With 7 days, neither should match
    const narrow = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesByKeyword,
      { keywordId, days: 7 }
    );
    expect(narrow).toHaveLength(0);

    // With 90 days, both should match
    const wide = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesByKeyword,
      { keywordId, days: 90 }
    );
    expect(wide).toHaveLength(2);
  });

  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: "2025-01-15",
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
    });

    // No identity
    const results = await t.query(
      api.serpFeatures_queries.getSerpFeaturesByKeyword,
      { keywordId }
    );
    expect(results).toEqual([]);
  });

  test("returns empty array for unknown keyword", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    await setupHierarchy(t, userId);

    // Create a keyword to get a valid ID, then delete it
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    // Delete the keyword so it becomes "unknown"
    await t.run(async (ctx: any) => {
      await ctx.db.delete(keywordId);
    });

    const asUser = t.withIdentity({ subject: userId });
    const results = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesByKeyword,
      { keywordId }
    );
    expect(results).toEqual([]);
  });

  test("returns results sorted by date ascending", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const today = new Date();
    const dates = [3, 1, 2].map((daysAgo) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split("T")[0];
    });

    // Insert out of order
    await t.run(async (ctx: any) => {
      for (const date of dates) {
        await ctx.db.insert("serpFeatureTracking", {
          keywordId,
          date,
          features: FEATURES_A,
          fetchedAt: Date.now(),
        });
      }
    });

    const asUser = t.withIdentity({ subject: userId });
    const results = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesByKeyword,
      { keywordId }
    );

    expect(results).toHaveLength(3);
    // Verify ascending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i].date >= results[i - 1].date).toBe(true);
    }
  });
});

// ===========================================================================
// getCurrentSerpFeatures
// ===========================================================================

describe("serpFeatures_queries.getCurrentSerpFeatures", () => {
  test("returns the most recent entry", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: "2025-01-10",
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: "2025-01-20",
        features: FEATURES_B,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(
      api.serpFeatures_queries.getCurrentSerpFeatures,
      { keywordId }
    );

    expect(result).not.toBeNull();
    expect(result!.date).toBe("2025-01-20");
    expect(result!.features.knowledgeGraph).toBe(true);
  });

  test("returns null when no data exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(
      api.serpFeatures_queries.getCurrentSerpFeatures,
      { keywordId }
    );
    expect(result).toBeNull();
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: "2025-01-15",
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(
      api.serpFeatures_queries.getCurrentSerpFeatures,
      { keywordId }
    );
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getSerpFeaturesSummary
// ===========================================================================

describe("serpFeatures_queries.getSerpFeaturesSummary", () => {
  test("aggregates features across keywords in a domain", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId, keywordId: kw1 } = await setupDomainAndKeyword(
      t,
      projectId
    );

    // Add a second keyword for the same domain
    const kw2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "second keyword",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const today = new Date();
    const recentDate = new Date(today);
    recentDate.setDate(recentDate.getDate() - 5);
    const recentStr = recentDate.toISOString().split("T")[0];

    await t.run(async (ctx: any) => {
      // kw1: featuredSnippet + peopleAlsoAsk
      await ctx.db.insert("serpFeatureTracking", {
        keywordId: kw1,
        date: recentStr,
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
      // kw2: peopleAlsoAsk + imagePack + knowledgeGraph
      await ctx.db.insert("serpFeatureTracking", {
        keywordId: kw2,
        date: recentStr,
        features: FEATURES_B,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesSummary,
      { domainId }
    );

    expect(summary).not.toBeNull();
    expect(summary!.totalKeywords).toBe(2);
    expect(summary!.totalDataPoints).toBe(2);
    // featuredSnippet: 1/2 = 50%
    expect(summary!.featurePercentages.featuredSnippet).toBe(50);
    // peopleAlsoAsk: 2/2 = 100%
    expect(summary!.featurePercentages.peopleAlsoAsk).toBe(100);
    // imagePack: 1/2 = 50% (FEATURES_A has false, FEATURES_B has true)
    expect(summary!.featurePercentages.imagePack).toBe(50);
    // knowledgeGraph: 1/2 = 50%
    expect(summary!.featurePercentages.knowledgeGraph).toBe(50);
  });

  test("returns zeroed percentages for domain with no tracking data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainAndKeyword(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesSummary,
      { domainId }
    );

    expect(summary).not.toBeNull();
    expect(summary!.totalDataPoints).toBe(0);
    expect(summary!.featurePercentages.featuredSnippet).toBe(0);
    expect(summary!.featurePercentages.peopleAlsoAsk).toBe(0);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainAndKeyword(t, projectId);

    const result = await t.query(
      api.serpFeatures_queries.getSerpFeaturesSummary,
      { domainId }
    );
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getSerpFeaturesTimeline
// ===========================================================================

describe("serpFeatures_queries.getSerpFeaturesTimeline", () => {
  test("detects feature appearance and disappearance between records", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const today = new Date();
    const date1 = new Date(today);
    date1.setDate(date1.getDate() - 10);
    const date1Str = date1.toISOString().split("T")[0];
    const date2 = new Date(today);
    date2.setDate(date2.getDate() - 5);
    const date2Str = date2.toISOString().split("T")[0];

    await t.run(async (ctx: any) => {
      // Day 1: featuredSnippet=true, imagePack=false
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: date1Str,
        features: {
          featuredSnippet: true,
          peopleAlsoAsk: false,
          imagePack: false,
        },
        fetchedAt: Date.now(),
      });
      // Day 2: featuredSnippet=false, imagePack=true (snippet disappeared, imagePack appeared)
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: date2Str,
        features: {
          featuredSnippet: false,
          peopleAlsoAsk: false,
          imagePack: true,
        },
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const timeline = await asUser.query(
      api.serpFeatures_queries.getSerpFeaturesTimeline,
      { keywordId }
    );

    expect(timeline.length).toBeGreaterThanOrEqual(2);

    const snippetChange = timeline.find(
      (e: any) => e.feature === "featuredSnippet"
    );
    expect(snippetChange).toBeDefined();
    expect(snippetChange!.appeared).toBe(false); // disappeared

    const imageChange = timeline.find((e: any) => e.feature === "imagePack");
    expect(imageChange).toBeDefined();
    expect(imageChange!.appeared).toBe(true); // appeared
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const result = await t.query(
      api.serpFeatures_queries.getSerpFeaturesTimeline,
      { keywordId }
    );
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// saveSerpFeatures (mutation)
// ===========================================================================

describe("serpFeatures_mutations.saveSerpFeatures", () => {
  test("creates a new SERP feature record", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const id = await t.mutation(
      api.serpFeatures_mutations.saveSerpFeatures,
      {
        keywordId,
        date: "2025-01-15",
        features: FEATURES_A,
      }
    );

    expect(id).toBeTruthy();

    const record = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(record).not.toBeNull();
    expect(record!.keywordId).toBe(keywordId);
    expect(record!.date).toBe("2025-01-15");
    expect(record!.features.featuredSnippet).toBe(true);
    expect(record!.fetchedAt).toBeGreaterThan(0);
  });

  test("updates existing record for same keyword+date", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    // First insert
    const id1 = await t.mutation(
      api.serpFeatures_mutations.saveSerpFeatures,
      {
        keywordId,
        date: "2025-01-15",
        features: FEATURES_A,
      }
    );

    // Second insert with same keyword+date but different features
    const id2 = await t.mutation(
      api.serpFeatures_mutations.saveSerpFeatures,
      {
        keywordId,
        date: "2025-01-15",
        features: FEATURES_B,
      }
    );

    // Should return the same ID (updated, not duplicated)
    expect(id2).toEqual(id1);

    const record = await t.run(async (ctx: any) => ctx.db.get(id1));
    expect(record!.features.featuredSnippet).toBe(false); // Updated to FEATURES_B
    expect(record!.features.knowledgeGraph).toBe(true);
  });
});

// ===========================================================================
// bulkSaveSerpFeatures (mutation)
// ===========================================================================

describe("serpFeatures_mutations.bulkSaveSerpFeatures", () => {
  test("saves multiple records in bulk", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    const result = await t.mutation(
      api.serpFeatures_mutations.bulkSaveSerpFeatures,
      {
        records: [
          { keywordId, date: "2025-01-10", features: FEATURES_A },
          { keywordId, date: "2025-01-11", features: FEATURES_B },
        ],
      }
    );

    expect(result.saved).toBe(2);
    expect(result.ids).toHaveLength(2);

    // Verify both records exist
    const r1 = await t.run(async (ctx: any) => ctx.db.get(result.ids[0]));
    const r2 = await t.run(async (ctx: any) => ctx.db.get(result.ids[1]));
    expect(r1!.date).toBe("2025-01-10");
    expect(r2!.date).toBe("2025-01-11");
  });

  test("updates existing records during bulk save", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { keywordId } = await setupDomainAndKeyword(t, projectId);

    // Pre-insert a record
    await t.run(async (ctx: any) => {
      await ctx.db.insert("serpFeatureTracking", {
        keywordId,
        date: "2025-01-10",
        features: FEATURES_A,
        fetchedAt: Date.now(),
      });
    });

    // Bulk save with same date (should update) + new date (should insert)
    const result = await t.mutation(
      api.serpFeatures_mutations.bulkSaveSerpFeatures,
      {
        records: [
          { keywordId, date: "2025-01-10", features: FEATURES_B },
          { keywordId, date: "2025-01-12", features: FEATURES_A },
        ],
      }
    );

    expect(result.saved).toBe(2);

    // Verify the updated record has new features
    const updated = await t.run(async (ctx: any) => ctx.db.get(result.ids[0]));
    expect(updated!.features.featuredSnippet).toBe(false); // FEATURES_B
    expect(updated!.features.knowledgeGraph).toBe(true);

    // Verify total records: should be 2 (one updated, one new), not 3
    const all = await t.run(async (ctx: any) => {
      return ctx.db
        .query("serpFeatureTracking")
        .withIndex("by_keyword", (q: any) => q.eq("keywordId", keywordId))
        .collect();
    });
    expect(all).toHaveLength(2);
  });
});
