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

/** Create a domain, keyword, competitor, and a content gap. Returns all IDs. */
async function setupDomainWithGap(
  t: any,
  projectId: string,
  overrides?: {
    opportunityScore?: number;
    searchVolume?: number;
    difficulty?: number;
    competitorPosition?: number;
    status?: "identified" | "monitoring" | "ranking" | "dismissed";
    priority?: "high" | "medium" | "low";
    phrase?: string;
    competitorDomain?: string;
  }
) {
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
      phrase: overrides?.phrase ?? "test keyword",
      status: "active",
      createdAt: Date.now(),
    });
  });

  const competitorId = await t.run(async (ctx: any) => {
    return ctx.db.insert("competitors", {
      domainId,
      competitorDomain: overrides?.competitorDomain ?? "competitor.com",
      name: overrides?.competitorDomain ?? "competitor.com",
      status: "active",
      createdAt: Date.now(),
    });
  });

  const gapId = await t.run(async (ctx: any) => {
    return ctx.db.insert("contentGaps", {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: overrides?.opportunityScore ?? 75,
      competitorPosition: overrides?.competitorPosition ?? 3,
      yourPosition: null,
      searchVolume: overrides?.searchVolume ?? 5000,
      difficulty: overrides?.difficulty ?? 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 100,
      priority: overrides?.priority ?? "high",
      status: overrides?.status ?? "identified",
      identifiedAt: Date.now(),
      lastChecked: Date.now(),
    });
  });

  return { domainId, keywordId, competitorId, gapId };
}

// ===========================================================================
// getContentGaps
// ===========================================================================

describe("contentGaps_queries.getContentGaps", () => {
  test("returns gaps for a domain with enriched keyword and competitor data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainWithGap(t, projectId, {
      phrase: "seo tools",
      competitorDomain: "rival.com",
    });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].keywordPhrase).toBe("seo tools");
    expect(gaps[0].competitorDomain).toBe("rival.com");
    expect(gaps[0].opportunityScore).toBeGreaterThanOrEqual(0);
  });

  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainWithGap(t, projectId);

    const gaps = await t.query(api.contentGaps_queries.getContentGaps, {
      domainId,
    });
    expect(gaps).toEqual([]);
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    // Create domain + keyword + competitor manually so we can share domainId
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
        phrase: "kw1",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Insert two gaps with different statuses
    await t.run(async (ctx: any) => {
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 80,
        competitorPosition: 2,
        yourPosition: null,
        searchVolume: 1000,
        difficulty: 20,
        competitorUrl: "https://comp.com/a",
        estimatedTrafficValue: 50,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 60,
        competitorPosition: 5,
        yourPosition: null,
        searchVolume: 500,
        difficulty: 40,
        competitorUrl: "https://comp.com/b",
        estimatedTrafficValue: 30,
        priority: "medium",
        status: "dismissed",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { status: "identified" },
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].opportunityScore).toBe(80);
  });

  test("filters by priority", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

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
        phrase: "kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      // High priority gap (score 80 => high)
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 80,
        competitorPosition: 1,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 10,
        competitorUrl: "https://comp.com/a",
        estimatedTrafficValue: 200,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      // Low priority gap (score 20 => low)
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 20,
        competitorPosition: 50,
        yourPosition: null,
        searchVolume: 100,
        difficulty: 80,
        competitorUrl: "https://comp.com/b",
        estimatedTrafficValue: 5,
        priority: "low",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    // The query derives priority from score, so score 80 => high, score 20 => low
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      filters: { priority: "high" },
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].opportunityScore).toBe(80);
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

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
        phrase: "kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Insert 3 gaps
    await t.run(async (ctx: any) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("contentGaps", {
          domainId,
          keywordId,
          competitorId,
          opportunityScore: 50 + i * 10,
          competitorPosition: 5,
          yourPosition: null,
          searchVolume: 1000,
          difficulty: 30,
          competitorUrl: `https://comp.com/${i}`,
          estimatedTrafficValue: 50,
          priority: "medium",
          status: "identified",
          identifiedAt: Date.now(),
          lastChecked: Date.now(),
        });
      }
    });

    const asUser = t.withIdentity({ subject: userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId,
      limit: 2,
    });

    expect(gaps).toHaveLength(2);
  });
});

// ===========================================================================
// getGapSummary
// ===========================================================================

describe("contentGaps_queries.getGapSummary", () => {
  test("returns zeroed summary for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainWithGap(t, projectId);

    const summary = await t.query(api.contentGaps_queries.getGapSummary, {
      domainId,
    });
    expect(summary.totalGaps).toBe(0);
  });

  test("returns correct counts and top opportunities", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

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
        phrase: "seo keyword",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "rival.com",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      // High priority gap (score 80)
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 80,
        competitorPosition: 2,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 20,
        competitorUrl: "https://rival.com/a",
        estimatedTrafficValue: 200,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      // Medium priority gap (score 50)
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 50,
        competitorPosition: 8,
        yourPosition: null,
        searchVolume: 2000,
        difficulty: 50,
        competitorUrl: "https://rival.com/b",
        estimatedTrafficValue: 80,
        priority: "medium",
        status: "monitoring",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      // Low priority gap (score 20)
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 20,
        competitorPosition: 40,
        yourPosition: null,
        searchVolume: 200,
        difficulty: 80,
        competitorUrl: "https://rival.com/c",
        estimatedTrafficValue: 10,
        priority: "low",
        status: "dismissed",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(api.contentGaps_queries.getGapSummary, {
      domainId,
    });

    expect(summary.totalGaps).toBe(3);
    expect(summary.highPriority).toBe(1);
    expect(summary.mediumPriority).toBe(1);
    expect(summary.lowPriority).toBe(1);
    expect(summary.statusCounts.identified).toBe(1);
    expect(summary.statusCounts.monitoring).toBe(1);
    expect(summary.statusCounts.dismissed).toBe(1);
    expect(summary.totalEstimatedValue).toBe(290);
    expect(summary.competitorsAnalyzed).toBe(1);
    expect(summary.topOpportunities).toHaveLength(3);
    // Top opportunity should be highest score
    expect(summary.topOpportunities[0].opportunityScore).toBe(80);
  });
});

// ===========================================================================
// getGapTrends
// ===========================================================================

describe("contentGaps_queries.getGapTrends", () => {
  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainWithGap(t, projectId);

    const trends = await t.query(api.contentGaps_queries.getGapTrends, {
      domainId,
    });
    expect(trends).toEqual([]);
  });

  test("returns trend data from gap analysis reports", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId, gapId } = await setupDomainWithGap(t, projectId);

    const now = Date.now();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
        totalGaps: 10,
        highPriorityGaps: 3,
        estimatedTotalValue: 500,
        topOpportunities: [gapId],
        competitorsAnalyzed: 2,
        keywordsAnalyzed: 20,
      });
      await ctx.db.insert("gapAnalysisReports", {
        domainId,
        generatedAt: now - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        totalGaps: 15,
        highPriorityGaps: 5,
        estimatedTotalValue: 800,
        topOpportunities: [gapId],
        competitorsAnalyzed: 3,
        keywordsAnalyzed: 30,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const trends = await asUser.query(api.contentGaps_queries.getGapTrends, {
      domainId,
      days: 7,
    });

    expect(trends).toHaveLength(2);
    // First report has no previous, so netChange = 0
    expect(trends[0].netChange).toBe(0);
    // Second report: 15 - 10 = 5 new gaps
    expect(trends[1].newGaps).toBe(5);
    expect(trends[1].netChange).toBe(5);
  });
});

// ===========================================================================
// getCompetitorGapComparison
// ===========================================================================

describe("contentGaps_queries.getCompetitorGapComparison", () => {
  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { domainId } = await setupDomainWithGap(t, projectId);

    const result = await t.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );
    expect(result).toEqual([]);
  });

  test("aggregates gaps per competitor, excludes dismissed", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

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
        phrase: "kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const comp1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp1.com",
        name: "Comp 1",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const comp2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp2.com",
        name: "Comp 2",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      // 2 gaps for comp1 (one identified, one dismissed)
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId: comp1,
        opportunityScore: 80,
        competitorPosition: 2,
        yourPosition: null,
        searchVolume: 1000,
        difficulty: 20,
        competitorUrl: "https://comp1.com/a",
        estimatedTrafficValue: 100,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId: comp1,
        opportunityScore: 50,
        competitorPosition: 10,
        yourPosition: null,
        searchVolume: 500,
        difficulty: 40,
        competitorUrl: "https://comp1.com/b",
        estimatedTrafficValue: 40,
        priority: "medium",
        status: "dismissed",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      // 1 gap for comp2
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId: comp2,
        opportunityScore: 70,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 3000,
        difficulty: 25,
        competitorUrl: "https://comp2.com/a",
        estimatedTrafficValue: 150,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const comparison = await asUser.query(
      api.contentGaps_queries.getCompetitorGapComparison,
      { domainId }
    );

    // Dismissed gaps are excluded, so comp1 has 1 gap, comp2 has 1 gap
    expect(comparison).toHaveLength(2);
    // Both have 1 active gap, order by totalGaps desc (tied => either order)
    const comp1Data = comparison.find(
      (c: any) => c.competitorDomain === "comp1.com"
    );
    const comp2Data = comparison.find(
      (c: any) => c.competitorDomain === "comp2.com"
    );
    expect(comp1Data).toBeDefined();
    expect(comp1Data!.totalGaps).toBe(1);
    expect(comp2Data).toBeDefined();
    expect(comp2Data!.totalGaps).toBe(1);
  });
});

// ===========================================================================
// updateGapStatus
// ===========================================================================

describe("contentGaps_mutations.updateGapStatus", () => {
  test("updates the status of a gap", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { gapId } = await setupDomainWithGap(t, projectId);

    await t.mutation(api.contentGaps_mutations.updateGapStatus, {
      gapId,
      status: "monitoring",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.status).toBe("monitoring");
    expect(gap!.lastChecked).toBeGreaterThan(0);
  });

  test("throws for non-existent gap", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { gapId } = await setupDomainWithGap(t, projectId);

    // Delete the gap so the ID is now stale
    await t.run(async (ctx: any) => {
      await ctx.db.delete(gapId);
    });

    await expect(
      t.mutation(api.contentGaps_mutations.updateGapStatus, {
        gapId,
        status: "monitoring",
      })
    ).rejects.toThrow("Gap not found");
  });
});

// ===========================================================================
// updateGapPriority
// ===========================================================================

describe("contentGaps_mutations.updateGapPriority", () => {
  test("updates the priority of a gap", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { gapId } = await setupDomainWithGap(t, projectId, {
      priority: "low",
    });

    await t.mutation(api.contentGaps_mutations.updateGapPriority, {
      gapId,
      priority: "high",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.priority).toBe("high");
  });
});

// ===========================================================================
// dismissGap
// ===========================================================================

describe("contentGaps_mutations.dismissGap", () => {
  test("sets status to dismissed", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { gapId } = await setupDomainWithGap(t, projectId);

    await t.mutation(api.contentGaps_mutations.dismissGap, { gapId });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.status).toBe("dismissed");
  });
});

// ===========================================================================
// addGapsToMonitoring
// ===========================================================================

describe("contentGaps_mutations.addGapsToMonitoring", () => {
  test("sets gaps to monitoring and optionally activates keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    // Create keyword with "paused" status
    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "paused kw",
        status: "paused",
        createdAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const gapId = await t.run(async (ctx: any) => {
      return ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 75,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 30,
        competitorUrl: "https://comp.com/a",
        estimatedTrafficValue: 100,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const result = await t.mutation(
      api.contentGaps_mutations.addGapsToMonitoring,
      {
        gapIds: [gapId],
        addToActiveMonitoring: true,
      }
    );

    expect(result.success).toBe(true);
    expect(result.updatedGaps).toBe(1);
    expect(result.addedToMonitoring).toBe(1);

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.status).toBe("monitoring");

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword!.status).toBe("active");
  });
});

// ===========================================================================
// bulkUpdateGapStatus
// ===========================================================================

describe("contentGaps_mutations.bulkUpdateGapStatus", () => {
  test("updates status of multiple gaps", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

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
        phrase: "kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "comp.com",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const gapIds = await t.run(async (ctx: any) => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push(
          await ctx.db.insert("contentGaps", {
            domainId,
            keywordId,
            competitorId,
            opportunityScore: 60,
            competitorPosition: 5,
            yourPosition: null,
            searchVolume: 1000,
            difficulty: 30,
            competitorUrl: `https://comp.com/${i}`,
            estimatedTrafficValue: 50,
            priority: "medium",
            status: "identified",
            identifiedAt: Date.now(),
            lastChecked: Date.now(),
          })
        );
      }
      return ids;
    });

    const result = await t.mutation(
      api.contentGaps_mutations.bulkUpdateGapStatus,
      {
        gapIds,
        status: "ranking",
      }
    );

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(3);

    // Verify all updated
    for (const id of gapIds) {
      const gap = await t.run(async (ctx: any) => ctx.db.get(id));
      expect(gap!.status).toBe("ranking");
    }
  });
});

// ===========================================================================
// bulkUpdateGapPriority
// ===========================================================================

describe("contentGaps_mutations.bulkUpdateGapPriority", () => {
  test("updates priority of multiple gaps", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { gapId } = await setupDomainWithGap(t, projectId, {
      priority: "low",
    });

    const result = await t.mutation(
      api.contentGaps_mutations.bulkUpdateGapPriority,
      {
        gapIds: [gapId],
        priority: "high",
      }
    );

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.priority).toBe("high");
  });
});
