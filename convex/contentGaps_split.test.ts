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

async function setupUser(t: any) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
  });
}

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

async function setupDomain(t: any, projectId: string) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

async function setupKeyword(t: any, domainId: string, phrase = "test keyword") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("keywords", {
      domainId,
      phrase,
      status: "active",
      createdAt: Date.now(),
    });
  });
}

async function setupCompetitor(t: any, domainId: string, domain = "competitor.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("competitors", {
      domainId,
      competitorDomain: domain,
      name: domain,
      status: "active",
      createdAt: Date.now(),
    });
  });
}

async function insertGap(
  t: any,
  domainId: string,
  keywordId: string,
  competitorId: string,
  overrides: Record<string, any> = {}
) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("contentGaps", {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 75,
      competitorPosition: 3,
      yourPosition: null,
      searchVolume: 5000,
      difficulty: 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 100,
      priority: "high",
      status: "identified",
      identifiedAt: Date.now(),
      lastChecked: Date.now(),
      ...overrides,
    });
  });
}

/** Full setup returning all IDs */
async function fullSetup(t: any, gapOverrides: Record<string, any> = {}) {
  const userId = await setupUser(t);
  const { projectId } = await setupHierarchy(t, userId);
  const domainId = await setupDomain(t, projectId);
  const keywordId = await setupKeyword(t, domainId);
  const competitorId = await setupCompetitor(t, domainId);
  const gapId = await insertGap(t, domainId, keywordId, competitorId, gapOverrides);
  return { userId, projectId, domainId, keywordId, competitorId, gapId };
}

// ===========================================================================
// contentGaps_internal — getGapSummary (internal query)
// ===========================================================================

describe("contentGaps_internal.getGapSummary", () => {
  test("returns summary with total gaps and top opportunities", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await fullSetup(t, {
      opportunityScore: 80,
      priority: "high",
      estimatedTrafficValue: 250,
    });

    const result = await t.query(
      internal.contentGaps_internal.getGapSummary,
      { domainId }
    );

    expect(result.totalGaps).toBe(1);
    expect(result.highPriority).toBe(1);
    expect(result.totalEstimatedValue).toBe(250);
    expect(result.topOpportunities).toHaveLength(1);
    expect(result.topOpportunities[0].keywordPhrase).toBe("test keyword");
    expect(result.topOpportunities[0].competitorDomain).toBe("competitor.com");
    expect(result.topOpportunities[0].opportunityScore).toBe(80);
  });

  test("returns zeros when no gaps exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(
      internal.contentGaps_internal.getGapSummary,
      { domainId }
    );

    expect(result.totalGaps).toBe(0);
    expect(result.highPriority).toBe(0);
    expect(result.totalEstimatedValue).toBe(0);
    expect(result.topOpportunities).toEqual([]);
  });

  test("limits top opportunities to 10", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    // Insert 15 gaps
    for (let i = 0; i < 15; i++) {
      await insertGap(t, domainId, keywordId, competitorId, {
        opportunityScore: 50 + i,
        priority: i >= 8 ? "high" : "medium",
      });
    }

    const result = await t.query(
      internal.contentGaps_internal.getGapSummary,
      { domainId }
    );

    expect(result.totalGaps).toBe(15);
    expect(result.topOpportunities).toHaveLength(10);
    // Top opportunity should be the highest score
    expect(result.topOpportunities[0].opportunityScore).toBe(64);
  });

  test("counts priorities correctly with multiple gaps", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 90, priority: "high", estimatedTrafficValue: 100,
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 50, priority: "medium", estimatedTrafficValue: 50,
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 20, priority: "low", estimatedTrafficValue: 10,
    });

    const result = await t.query(
      internal.contentGaps_internal.getGapSummary,
      { domainId }
    );

    expect(result.totalGaps).toBe(3);
    expect(result.highPriority).toBe(1);
    expect(result.totalEstimatedValue).toBe(160);
  });

  test("handles deleted keyword/competitor gracefully", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 80,
    });

    // Delete keyword and competitor
    await t.run(async (ctx: any) => {
      await ctx.db.delete(keywordId);
      await ctx.db.delete(competitorId);
    });

    const result = await t.query(
      internal.contentGaps_internal.getGapSummary,
      { domainId }
    );

    expect(result.totalGaps).toBe(1);
    expect(result.topOpportunities[0].keywordPhrase).toBe("Unknown");
    expect(result.topOpportunities[0].competitorDomain).toBe("Unknown");
  });
});

// ===========================================================================
// contentGaps_mutations — updateGapStatus
// ===========================================================================

describe("contentGaps_mutations.updateGapStatus", () => {
  test("updates gap status", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    await t.mutation(api.contentGaps_mutations.updateGapStatus, {
      gapId,
      status: "monitoring",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.status).toBe("monitoring");
  });

  test("updates lastChecked timestamp", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    const before = Date.now();
    await t.mutation(api.contentGaps_mutations.updateGapStatus, {
      gapId,
      status: "ranking",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.lastChecked).toBeGreaterThanOrEqual(before);
  });

  test("throws when gap not found", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    // Delete the gap first
    await t.run(async (ctx: any) => ctx.db.delete(gapId));

    await expect(
      t.mutation(api.contentGaps_mutations.updateGapStatus, {
        gapId,
        status: "monitoring",
      })
    ).rejects.toThrow("Gap not found");
  });
});

// ===========================================================================
// contentGaps_mutations — updateGapPriority
// ===========================================================================

describe("contentGaps_mutations.updateGapPriority", () => {
  test("updates gap priority", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    await t.mutation(api.contentGaps_mutations.updateGapPriority, {
      gapId,
      priority: "low",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.priority).toBe("low");
  });

  test("throws when gap not found", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);
    await t.run(async (ctx: any) => ctx.db.delete(gapId));

    await expect(
      t.mutation(api.contentGaps_mutations.updateGapPriority, {
        gapId,
        priority: "high",
      })
    ).rejects.toThrow("Gap not found");
  });
});

// ===========================================================================
// contentGaps_mutations — dismissGap
// ===========================================================================

describe("contentGaps_mutations.dismissGap", () => {
  test("sets status to dismissed", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    await t.mutation(api.contentGaps_mutations.dismissGap, { gapId });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.status).toBe("dismissed");
  });

  test("accepts optional reason without error", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    await t.mutation(api.contentGaps_mutations.dismissGap, {
      gapId,
      reason: "not relevant",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.status).toBe("dismissed");
  });

  test("throws when gap not found", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);
    await t.run(async (ctx: any) => ctx.db.delete(gapId));

    await expect(
      t.mutation(api.contentGaps_mutations.dismissGap, { gapId })
    ).rejects.toThrow("Gap not found");
  });
});

// ===========================================================================
// contentGaps_mutations — addGapsToMonitoring
// ===========================================================================

describe("contentGaps_mutations.addGapsToMonitoring", () => {
  test("updates gap statuses to monitoring", async () => {
    const t = convexTest(schema, modules);
    const { domainId, keywordId, competitorId } = await fullSetup(t);

    const gap2 = await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 60, priority: "medium",
    });

    const { gapId } = await fullSetup(t);

    const result = await t.mutation(api.contentGaps_mutations.addGapsToMonitoring, {
      gapIds: [gapId, gap2],
    });

    expect(result.success).toBe(true);
    expect(result.updatedGaps).toBe(2);

    const g1 = await t.run(async (ctx: any) => ctx.db.get(gapId));
    const g2 = await t.run(async (ctx: any) => ctx.db.get(gap2));
    expect(g1.status).toBe("monitoring");
    expect(g2.status).toBe("monitoring");
  });

  test("optionally activates keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    // Set keyword to paused
    await t.run(async (ctx: any) => {
      await ctx.db.patch(keywordId, { status: "paused" });
    });

    const gapId = await insertGap(t, domainId, keywordId, competitorId);

    const result = await t.mutation(api.contentGaps_mutations.addGapsToMonitoring, {
      gapIds: [gapId],
      addToActiveMonitoring: true,
    });

    expect(result.addedToMonitoring).toBe(1);

    const kw = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(kw.status).toBe("active");
  });

  test("skips non-existent gaps gracefully", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);

    // Delete one gap
    await t.run(async (ctx: any) => ctx.db.delete(gapId));

    const result = await t.mutation(api.contentGaps_mutations.addGapsToMonitoring, {
      gapIds: [gapId],
    });

    expect(result.success).toBe(true);
    expect(result.updatedGaps).toBe(0);
  });

  test("does not re-activate already active keywords", async () => {
    const t = convexTest(schema, modules);
    const { gapId, keywordId } = await fullSetup(t);

    const result = await t.mutation(api.contentGaps_mutations.addGapsToMonitoring, {
      gapIds: [gapId],
      addToActiveMonitoring: true,
    });

    // Keyword was already active so addedToMonitoring should be 0
    expect(result.addedToMonitoring).toBe(0);

    const kw = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(kw.status).toBe("active");
  });
});

// ===========================================================================
// contentGaps_mutations — bulkUpdateGapStatus
// ===========================================================================

describe("contentGaps_mutations.bulkUpdateGapStatus", () => {
  test("updates multiple gaps at once", async () => {
    const t = convexTest(schema, modules);
    const { domainId, keywordId, competitorId, gapId } = await fullSetup(t);
    const gap2 = await insertGap(t, domainId, keywordId, competitorId);

    const result = await t.mutation(api.contentGaps_mutations.bulkUpdateGapStatus, {
      gapIds: [gapId, gap2],
      status: "ranking",
    });

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);

    const g1 = await t.run(async (ctx: any) => ctx.db.get(gapId));
    const g2 = await t.run(async (ctx: any) => ctx.db.get(gap2));
    expect(g1.status).toBe("ranking");
    expect(g2.status).toBe("ranking");
  });

  test("skips deleted gaps", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);
    await t.run(async (ctx: any) => ctx.db.delete(gapId));

    const result = await t.mutation(api.contentGaps_mutations.bulkUpdateGapStatus, {
      gapIds: [gapId],
      status: "dismissed",
    });

    expect(result.updatedCount).toBe(0);
  });
});

// ===========================================================================
// contentGaps_mutations — bulkUpdateGapPriority
// ===========================================================================

describe("contentGaps_mutations.bulkUpdateGapPriority", () => {
  test("updates multiple gap priorities", async () => {
    const t = convexTest(schema, modules);
    const { domainId, keywordId, competitorId, gapId } = await fullSetup(t);
    const gap2 = await insertGap(t, domainId, keywordId, competitorId);

    const result = await t.mutation(api.contentGaps_mutations.bulkUpdateGapPriority, {
      gapIds: [gapId, gap2],
      priority: "low",
    });

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);

    const g1 = await t.run(async (ctx: any) => ctx.db.get(gapId));
    const g2 = await t.run(async (ctx: any) => ctx.db.get(gap2));
    expect(g1.priority).toBe("low");
    expect(g2.priority).toBe("low");
  });

  test("skips deleted gaps", async () => {
    const t = convexTest(schema, modules);
    const { gapId } = await fullSetup(t);
    await t.run(async (ctx: any) => ctx.db.delete(gapId));

    const result = await t.mutation(api.contentGaps_mutations.bulkUpdateGapPriority, {
      gapIds: [gapId],
      priority: "high",
    });

    expect(result.updatedCount).toBe(0);
  });
});

// ===========================================================================
// contentGaps_queries — getContentGaps
// ===========================================================================

describe("contentGaps_queries.getContentGaps (split)", () => {
  test("filters by priority", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 80, priority: "high",
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 20, priority: "low",
    });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { priority: "high" },
    });

    // All returned gaps should have high priority (score >= 70 after derivation)
    for (const g of gaps) {
      expect(g.priority).toBe("high");
    }
  });

  test("filters by score range", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 90 });
    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 50 });
    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 20 });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { minScore: 40, maxScore: 95 },
    });

    for (const g of gaps) {
      expect(g.opportunityScore).toBeGreaterThanOrEqual(40);
      expect(g.opportunityScore).toBeLessThanOrEqual(95);
    }
  });

  test("filters by volume range", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, { searchVolume: 10000 });
    await insertGap(t, domainId, keywordId, competitorId, { searchVolume: 500 });
    await insertGap(t, domainId, keywordId, competitorId, { searchVolume: 100 });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { minVolume: 400, maxVolume: 11000 },
    });

    for (const g of gaps) {
      expect(g.searchVolume).toBeGreaterThanOrEqual(400);
      expect(g.searchVolume).toBeLessThanOrEqual(11000);
    }
  });

  test("filters by difficulty range", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, { difficulty: 80 });
    await insertGap(t, domainId, keywordId, competitorId, { difficulty: 40 });
    await insertGap(t, domainId, keywordId, competitorId, { difficulty: 10 });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { minDifficulty: 30, maxDifficulty: 85 },
    });

    for (const g of gaps) {
      expect(g.difficulty).toBeGreaterThanOrEqual(30);
      expect(g.difficulty).toBeLessThanOrEqual(85);
    }
  });

  test("filters by competitorId", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const comp1 = await setupCompetitor(t, domainId, "comp1.com");
    const comp2 = await setupCompetitor(t, domainId, "comp2.com");

    await insertGap(t, domainId, keywordId, comp1);
    await insertGap(t, domainId, keywordId, comp2);

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { competitorId: comp1 },
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].competitorDomain).toBe("comp1.com");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    for (let i = 0; i < 5; i++) {
      await insertGap(t, domainId, keywordId, competitorId, {
        opportunityScore: 50 + i,
      });
    }

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      limit: 3,
    });

    expect(gaps).toHaveLength(3);
  });

  test("sorts by opportunity score descending", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 30 });
    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 90 });
    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 60 });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
    });

    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].opportunityScore).toBeGreaterThanOrEqual(gaps[i].opportunityScore);
    }
  });

  test("derives priority from score (NaN-safe)", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 80,
      priority: "low", // stored as low but score says high
    });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
    });

    // Query re-derives priority from score
    expect(gaps[0].priority).toBe("high");
  });
});

// ===========================================================================
// contentGaps_queries — getGapSummary (public query)
// ===========================================================================

describe("contentGaps_queries.getGapSummary", () => {
  test("returns full summary with stats", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 80, status: "identified", estimatedTrafficValue: 200,
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 50, status: "monitoring", estimatedTrafficValue: 100,
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 20, status: "dismissed", estimatedTrafficValue: 10,
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.contentGaps_queries.getGapSummary, {
      domainId,
    });

    expect(result.totalGaps).toBe(3);
    expect(result.highPriority).toBe(1);
    expect(result.mediumPriority).toBe(1);
    expect(result.lowPriority).toBe(1);
    expect(result.statusCounts.identified).toBe(1);
    expect(result.statusCounts.monitoring).toBe(1);
    expect(result.statusCounts.dismissed).toBe(1);
    expect(result.totalEstimatedValue).toBe(310);
    expect(result.competitorsAnalyzed).toBe(1);
  });

  test("returns empty result for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await fullSetup(t);

    const result = await t.query(api.contentGaps_queries.getGapSummary, {
      domainId,
    });

    expect(result.totalGaps).toBe(0);
    expect(result.topOpportunities).toEqual([]);
  });

  test("includes lastAnalyzedAt from reports", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const now = Date.now();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now,
        totalGaps: 5,
        highPriorityGaps: 2,
        estimatedTotalValue: 500,
        topOpportunities: [],
        competitorsAnalyzed: 3,
        keywordsAnalyzed: 10,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.contentGaps_queries.getGapSummary, {
      domainId,
    });

    expect(result.lastAnalyzedAt).toBe(now);
  });
});

// ===========================================================================
// contentGaps_queries — getGapTrends
// ===========================================================================

describe("contentGaps_queries.getGapTrends", () => {
  test("returns trend data from reports", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const now = Date.now();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 2 * 86400000,
        totalGaps: 10,
        highPriorityGaps: 3,
        estimatedTotalValue: 1000,
        topOpportunities: [],
        competitorsAnalyzed: 5,
        keywordsAnalyzed: 20,
      });
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 86400000,
        totalGaps: 15,
        highPriorityGaps: 5,
        estimatedTotalValue: 1500,
        topOpportunities: [],
        competitorsAnalyzed: 5,
        keywordsAnalyzed: 25,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const trends = await asUser.query(api.contentGaps_queries.getGapTrends, {
      domainId,
    });

    expect(trends).toHaveLength(2);
    expect(trends[0].newGaps).toBe(0); // first entry
    expect(trends[1].newGaps).toBe(5); // 15 - 10
    expect(trends[1].netChange).toBe(5);
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await fullSetup(t);

    const result = await t.query(api.contentGaps_queries.getGapTrends, {
      domainId,
    });
    expect(result).toEqual([]);
  });

  test("filters by days parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const now = Date.now();
    await t.run(async (ctx: any) => {
      // Recent report (within 7 days)
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 3 * 86400000,
        totalGaps: 10,
        highPriorityGaps: 3,
        estimatedTotalValue: 1000,
        topOpportunities: [],
        competitorsAnalyzed: 5,
        keywordsAnalyzed: 20,
      });
      // Old report (100 days ago)
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 100 * 86400000,
        totalGaps: 5,
        highPriorityGaps: 1,
        estimatedTotalValue: 500,
        topOpportunities: [],
        competitorsAnalyzed: 3,
        keywordsAnalyzed: 10,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const trends = await asUser.query(api.contentGaps_queries.getGapTrends, {
      domainId,
      days: 7,
    });

    expect(trends).toHaveLength(1);
  });

  test("calculates closed gaps when total decreases", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const now = Date.now();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 2 * 86400000,
        totalGaps: 20,
        highPriorityGaps: 8,
        estimatedTotalValue: 2000,
        topOpportunities: [],
        competitorsAnalyzed: 5,
        keywordsAnalyzed: 30,
      });
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 86400000,
        totalGaps: 15,
        highPriorityGaps: 5,
        estimatedTotalValue: 1500,
        topOpportunities: [],
        competitorsAnalyzed: 5,
        keywordsAnalyzed: 25,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const trends = await asUser.query(api.contentGaps_queries.getGapTrends, {
      domainId,
    });

    expect(trends[1].closedGaps).toBe(5);
    expect(trends[1].netChange).toBe(-5);
    expect(trends[1].newGaps).toBe(0);
  });
});

// ===========================================================================
// contentGaps_queries — getTopicClusters
// ===========================================================================

describe("contentGaps_queries.getTopicClusters", () => {
  test("clusters gaps by first meaningful word", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const competitorId = await setupCompetitor(t, domainId);

    const kw1 = await setupKeyword(t, domainId, "seo tools online");
    const kw2 = await setupKeyword(t, domainId, "seo audit checker");
    const kw3 = await setupKeyword(t, domainId, "marketing automation");

    await insertGap(t, domainId, kw1, competitorId, { opportunityScore: 80 });
    await insertGap(t, domainId, kw2, competitorId, { opportunityScore: 70 });
    await insertGap(t, domainId, kw3, competitorId, { opportunityScore: 60 });

    const asUser = t.withIdentity({ subject: userId });
    const clusters = await asUser.query(api.contentGaps_queries.getTopicClusters, {
      domainId,
    });

    // "seo" keywords cluster together, "marketing" separate
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const seoCluster = clusters.find((c: any) => c.topic.toLowerCase() === "seo");
    expect(seoCluster).toBeDefined();
    expect(seoCluster!.gapCount).toBe(2);
  });

  test("excludes dismissed gaps", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId, "keyword test");
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 80, status: "identified",
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 60, status: "dismissed",
    });

    const asUser = t.withIdentity({ subject: userId });
    const clusters = await asUser.query(api.contentGaps_queries.getTopicClusters, {
      domainId,
    });

    const totalGapCount = clusters.reduce((sum: number, c: any) => sum + c.gapCount, 0);
    expect(totalGapCount).toBe(1);
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await fullSetup(t);

    const result = await t.query(api.contentGaps_queries.getTopicClusters, {
      domainId,
    });
    expect(result).toEqual([]);
  });

  test("returns cluster statistics correctly", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const competitorId = await setupCompetitor(t, domainId);

    const kw1 = await setupKeyword(t, domainId, "react hooks guide");
    const kw2 = await setupKeyword(t, domainId, "react components tutorial");

    await insertGap(t, domainId, kw1, competitorId, {
      opportunityScore: 80, searchVolume: 5000, difficulty: 30, estimatedTrafficValue: 200,
    });
    await insertGap(t, domainId, kw2, competitorId, {
      opportunityScore: 60, searchVolume: 3000, difficulty: 50, estimatedTrafficValue: 100,
    });

    const asUser = t.withIdentity({ subject: userId });
    const clusters = await asUser.query(api.contentGaps_queries.getTopicClusters, {
      domainId,
    });

    const reactCluster = clusters.find((c: any) => c.topic.toLowerCase() === "react");
    expect(reactCluster).toBeDefined();
    expect(reactCluster!.gapCount).toBe(2);
    expect(reactCluster!.totalSearchVolume).toBe(8000);
    expect(reactCluster!.totalEstimatedValue).toBe(300);
    expect(reactCluster!.avgDifficulty).toBe(40);
    expect(reactCluster!.keywords).toHaveLength(2);
    // Sorted by score desc
    expect(reactCluster!.keywords[0].opportunityScore).toBeGreaterThanOrEqual(
      reactCluster!.keywords[1].opportunityScore
    );
  });
});

// ===========================================================================
// contentGaps_queries — getCompetitorGapComparison
// ===========================================================================

describe("contentGaps_queries.getCompetitorGapComparison", () => {
  test("aggregates gap stats per competitor", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const comp1 = await setupCompetitor(t, domainId, "comp1.com");
    const comp2 = await setupCompetitor(t, domainId, "comp2.com");

    await insertGap(t, domainId, keywordId, comp1, { opportunityScore: 80 });
    await insertGap(t, domainId, keywordId, comp1, { opportunityScore: 60 });
    await insertGap(t, domainId, keywordId, comp2, { opportunityScore: 90 });

    const asUser = t.withIdentity({ subject: userId });
    const comparison = await asUser.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );

    expect(comparison).toHaveLength(2);

    const c1 = comparison.find((c: any) => c.competitorDomain === "comp1.com");
    expect(c1).toBeDefined();
    expect(c1!.totalGaps).toBe(2);
    expect(c1!.avgOpportunityScore).toBe(70);

    const c2 = comparison.find((c: any) => c.competitorDomain === "comp2.com");
    expect(c2).toBeDefined();
    expect(c2!.totalGaps).toBe(1);
  });

  test("skips dismissed gaps", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 80, status: "identified",
    });
    await insertGap(t, domainId, keywordId, competitorId, {
      opportunityScore: 60, status: "dismissed",
    });

    const asUser = t.withIdentity({ subject: userId });
    const comparison = await asUser.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );

    expect(comparison[0].totalGaps).toBe(1);
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await fullSetup(t);

    const result = await t.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );
    expect(result).toEqual([]);
  });

  test("sorts by total gaps descending", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const comp1 = await setupCompetitor(t, domainId, "few-gaps.com");
    const comp2 = await setupCompetitor(t, domainId, "many-gaps.com");

    await insertGap(t, domainId, keywordId, comp1, { opportunityScore: 80 });
    await insertGap(t, domainId, keywordId, comp2, { opportunityScore: 80 });
    await insertGap(t, domainId, keywordId, comp2, { opportunityScore: 70 });
    await insertGap(t, domainId, keywordId, comp2, { opportunityScore: 60 });

    const asUser = t.withIdentity({ subject: userId });
    const comparison = await asUser.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );

    expect(comparison[0].competitorDomain).toBe("many-gaps.com");
    expect(comparison[0].totalGaps).toBe(3);
    expect(comparison[1].competitorDomain).toBe("few-gaps.com");
    expect(comparison[1].totalGaps).toBe(1);
  });

  test("counts high priority gaps correctly", async () => {
    const t = convexTest(schema, modules);
    const userId = await setupUser(t);
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    // Score >= 70 = high priority
    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 80 });
    await insertGap(t, domainId, keywordId, competitorId, { opportunityScore: 30 });

    const asUser = t.withIdentity({ subject: userId });
    const comparison = await asUser.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );

    expect(comparison[0].highPriorityGaps).toBe(1);
  });
});
