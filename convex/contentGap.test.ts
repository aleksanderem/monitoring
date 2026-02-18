import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full tenant hierarchy + competitor + keyword
async function createTestSetup(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: "alice@example.com",
      emailVerificationTime: Date.now(),
    });
  });

  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
      name: "Org A",
      slug: "org-a",
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

  const competitorId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("competitors", {
      domainId,
      competitorDomain: "rival.com",
      name: "Rival",
      status: "active" as const,
      createdAt: Date.now(),
    });
  });

  const keywordId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("keywords", {
      domainId,
      phrase: "seo tools",
      status: "active" as const,
      createdAt: Date.now(),
      searchVolume: 5000,
      difficulty: 45,
    });
  });

  return { userId, orgId, teamId, projectId, domainId, competitorId, keywordId };
}

// =====================================================================
// Content Gap Creation & Querying
// =====================================================================
describe("contentGap creation and queries", () => {
  test("create content gap and query it back", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Insert a content gap directly
    const gapId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 75,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 45,
        competitorUrl: "https://rival.com/seo-tools",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    // Query content gaps via the public API
    const asUser = t.withIdentity({ subject: setup.userId });
    const gaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId: setup.domainId,
    });

    expect(gaps.length).toBe(1);
    expect(gaps[0].keywordPhrase).toBe("seo tools");
    expect(gaps[0].competitorDomain).toBe("rival.com");
    expect(gaps[0].opportunityScore).toBe(75);
    expect(gaps[0].priority).toBe("high");
    expect(gaps[0].status).toBe("identified");
  });

  test("query with priority filter", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create a second keyword for low-priority gap
    const keyword2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: setup.domainId,
        phrase: "obscure term",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 10,
        difficulty: 90,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 80,
        competitorPosition: 2,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 45,
        competitorUrl: "https://rival.com/seo-tools",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });

      await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: keyword2,
        competitorId: setup.competitorId,
        opportunityScore: 15,
        competitorPosition: 50,
        yourPosition: null,
        searchVolume: 10,
        difficulty: 90,
        competitorUrl: "https://rival.com/obscure",
        estimatedTrafficValue: 3,
        priority: "low" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: setup.userId });

    // Filter by high priority
    const highGaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId: setup.domainId,
      filters: { priority: "high" },
    });
    expect(highGaps.length).toBe(1);
    expect(highGaps[0].keywordPhrase).toBe("seo tools");

    // Filter by low priority
    const lowGaps = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId: setup.domainId,
      filters: { priority: "low" },
    });
    expect(lowGaps.length).toBe(1);
    expect(lowGaps[0].keywordPhrase).toBe("obscure term");
  });

  test("query with status filter", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 75,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 45,
        competitorUrl: "https://rival.com/seo-tools",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "monitoring" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: setup.userId });

    // Filter by identified — should return 0 since the gap is "monitoring"
    const identified = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId: setup.domainId,
      filters: { status: "identified" },
    });
    expect(identified.length).toBe(0);

    // Filter by monitoring — should return 1
    const monitoring = await asUser.query(api.contentGaps_queries.getContentGaps, {
      domainId: setup.domainId,
      filters: { status: "monitoring" },
    });
    expect(monitoring.length).toBe(1);
  });
});

// =====================================================================
// Content Gap Status Updates
// =====================================================================
describe("content gap status updates", () => {
  test("update gap status from identified to monitoring", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const gapId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 75,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 45,
        competitorUrl: "https://rival.com/seo-tools",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: setup.userId });
    const result = await asUser.mutation(api.contentGaps_mutations.updateGapStatus, {
      gapId,
      status: "monitoring",
    });
    expect(result.success).toBe(true);

    // Verify status changed
    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.status).toBe("monitoring");
  });

  test("dismiss a content gap", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const gapId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 75,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 45,
        competitorUrl: "https://rival.com/seo-tools",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: setup.userId });
    await asUser.mutation(api.contentGaps_mutations.dismissGap, {
      gapId,
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.status).toBe("dismissed");
  });

  test("markOpportunityAsMonitoring activates keyword", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create a paused keyword specifically for this test
    const pausedKeywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: setup.domainId,
        phrase: "new keyword",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    const gapId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: pausedKeywordId,
        competitorId: setup.competitorId,
        opportunityScore: 60,
        competitorPosition: 5,
        yourPosition: null,
        searchVolume: 2000,
        difficulty: 30,
        competitorUrl: "https://rival.com/new-keyword",
        estimatedTrafficValue: 600,
        priority: "medium" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: setup.userId });
    await asUser.mutation(api.contentGap.markOpportunityAsMonitoring, {
      gapId,
    });

    // Verify gap status changed
    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap.status).toBe("monitoring");

    // Verify keyword was activated
    const keyword = await t.run(async (ctx: any) => ctx.db.get(pausedKeywordId));
    expect(keyword.status).toBe("active");
  });

  test("bulk update gap statuses", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const keyword2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: setup.domainId,
        phrase: "keyword 2",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const [gapId1, gapId2] = await t.run(async (ctx: any) => {
      const g1 = await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 75,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 45,
        competitorUrl: "https://rival.com/a",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      const g2 = await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: keyword2,
        competitorId: setup.competitorId,
        opportunityScore: 50,
        competitorPosition: 8,
        yourPosition: null,
        searchVolume: 3000,
        difficulty: 55,
        competitorUrl: "https://rival.com/b",
        estimatedTrafficValue: 900,
        priority: "medium" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      return [g1, g2];
    });

    const asUser = t.withIdentity({ subject: setup.userId });
    const result = await asUser.mutation(api.contentGaps_mutations.bulkUpdateGapStatus, {
      gapIds: [gapId1, gapId2],
      status: "dismissed",
    });
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);

    const g1 = await t.run(async (ctx: any) => ctx.db.get(gapId1));
    const g2 = await t.run(async (ctx: any) => ctx.db.get(gapId2));
    expect(g1.status).toBe("dismissed");
    expect(g2.status).toBe("dismissed");
  });
});

// =====================================================================
// Gap Summary Statistics
// =====================================================================
describe("getGapSummary", () => {
  test("returns correct counts by priority and status", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const keyword2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: setup.domainId,
        phrase: "keyword 2",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const keyword3 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: setup.domainId,
        phrase: "keyword 3",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      // High priority, identified
      await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: setup.keywordId,
        competitorId: setup.competitorId,
        opportunityScore: 80,
        competitorPosition: 2,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 30,
        competitorUrl: "https://rival.com/a",
        estimatedTrafficValue: 1500,
        priority: "high" as const,
        status: "identified" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });

      // Medium priority, monitoring
      await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: keyword2,
        competitorId: setup.competitorId,
        opportunityScore: 50,
        competitorPosition: 8,
        yourPosition: null,
        searchVolume: 2000,
        difficulty: 60,
        competitorUrl: "https://rival.com/b",
        estimatedTrafficValue: 600,
        priority: "medium" as const,
        status: "monitoring" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });

      // Low priority, dismissed
      await ctx.db.insert("contentGaps", {
        domainId: setup.domainId,
        keywordId: keyword3,
        competitorId: setup.competitorId,
        opportunityScore: 20,
        competitorPosition: 50,
        yourPosition: null,
        searchVolume: 100,
        difficulty: 85,
        competitorUrl: "https://rival.com/c",
        estimatedTrafficValue: 30,
        priority: "low" as const,
        status: "dismissed" as const,
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: setup.userId });
    const summary = await asUser.query(api.contentGaps_queries.getGapSummary, {
      domainId: setup.domainId,
    });

    expect(summary.totalGaps).toBe(3);
    expect(summary.highPriority).toBe(1);
    expect(summary.mediumPriority).toBe(1);
    expect(summary.lowPriority).toBe(1);
    expect(summary.statusCounts.identified).toBe(1);
    expect(summary.statusCounts.monitoring).toBe(1);
    expect(summary.statusCounts.dismissed).toBe(1);
    expect(summary.totalEstimatedValue).toBe(2130); // 1500 + 600 + 30
    expect(summary.competitorsAnalyzed).toBe(1);
  });

  test("returns zeros for empty domain", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const asUser = t.withIdentity({ subject: setup.userId });
    const summary = await asUser.query(api.contentGaps_queries.getGapSummary, {
      domainId: setup.domainId,
    });

    expect(summary.totalGaps).toBe(0);
    expect(summary.highPriority).toBe(0);
    expect(summary.topOpportunities).toEqual([]);
  });
});

// =====================================================================
// Batch creation via internal mutation
// =====================================================================
describe("batch content gap creation", () => {
  test("createKeywordsBatch deduplicates existing keywords", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // "seo tools" already exists from setup
    const results = await t.mutation(internal.contentGap.createKeywordsBatch, {
      domainId: setup.domainId,
      keywords: [
        { phrase: "seo tools", searchVolume: 5000, difficulty: 45 },
        { phrase: "new keyword", searchVolume: 1000, difficulty: 30 },
      ],
    });

    expect(results.length).toBe(2);
    // First one should be the existing keyword ID
    expect(results[0]).toBe(setup.keywordId);
    // Second should be a new ID (different from the first)
    expect(results[1]).not.toBe(setup.keywordId);
  });

  test("storeContentGapOpportunitiesBatch creates gaps correctly", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    const count = await t.mutation(
      internal.contentGap.storeContentGapOpportunitiesBatch,
      {
        domainId: setup.domainId,
        competitorId: setup.competitorId,
        opportunities: [
          {
            keywordId: setup.keywordId,
            keyword: "seo tools",
            searchVolume: 5000,
            difficulty: 45,
            competitorPosition: 3,
            competitorUrl: "https://rival.com/seo-tools",
            estimatedTrafficValue: 1500,
          },
        ],
      }
    );

    expect(count).toBe(1);

    // Verify the gap was created with correct calculated fields
    const gaps = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("contentGaps")
        .withIndex("by_domain", (q: any) => q.eq("domainId", setup.domainId))
        .collect();
    });
    expect(gaps.length).toBe(1);
    expect(gaps[0].opportunityScore).toBeGreaterThan(0);
    expect(gaps[0].status).toBe("identified");
  });

  test("storeContentGapOpportunitiesBatch updates existing gaps", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestSetup(t);

    // Create initial gap
    await t.mutation(internal.contentGap.storeContentGapOpportunitiesBatch, {
      domainId: setup.domainId,
      competitorId: setup.competitorId,
      opportunities: [
        {
          keywordId: setup.keywordId,
          keyword: "seo tools",
          searchVolume: 5000,
          difficulty: 45,
          competitorPosition: 3,
          competitorUrl: "https://rival.com/seo-tools",
          estimatedTrafficValue: 1500,
        },
      ],
    });

    // Store again with updated position
    await t.mutation(internal.contentGap.storeContentGapOpportunitiesBatch, {
      domainId: setup.domainId,
      competitorId: setup.competitorId,
      opportunities: [
        {
          keywordId: setup.keywordId,
          keyword: "seo tools",
          searchVolume: 5000,
          difficulty: 45,
          competitorPosition: 1,
          competitorUrl: "https://rival.com/seo-tools-v2",
          estimatedTrafficValue: 2000,
        },
      ],
    });

    // Should still be only 1 gap (updated, not duplicated)
    const gaps = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("contentGaps")
        .withIndex("by_domain", (q: any) => q.eq("domainId", setup.domainId))
        .collect();
    });
    expect(gaps.length).toBe(1);
    expect(gaps[0].competitorPosition).toBe(1);
    expect(gaps[0].competitorUrl).toBe("https://rival.com/seo-tools-v2");
  });
});
