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

async function setupDomain(t: any) {
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
      domain: "example.com",
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });

  return { orgId, teamId, projectId, domainId };
}

async function setupKeyword(t: any, domainId: any, phrase = "test keyword") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("keywords", {
      domainId,
      phrase,
      createdAt: Date.now(),
      status: "active" as const,
    });
  });
}

async function setupCompetitor(t: any, domainId: any, competitorDomain = "competitor.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("competitors", {
      domainId,
      competitorDomain,
      name: competitorDomain,
      status: "active" as const,
      createdAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// upsertGap
// ---------------------------------------------------------------------------

describe("upsertGap", () => {
  test("creates a new content gap with status 'identified' when not ranking", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    const gapId = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 75,
      competitorPosition: 3,
      yourPosition: null,
      searchVolume: 1000,
      difficulty: 40,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 150,
      priority: "high",
    });

    expect(gapId).toBeDefined();

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap).not.toBeNull();
    expect(gap!.status).toBe("identified");
    expect(gap!.opportunityScore).toBe(75);
    expect(gap!.yourPosition).toBeNull();
    expect(gap!.priority).toBe("high");
    expect(gap!.identifiedAt).toBeDefined();
    expect(gap!.lastChecked).toBeDefined();
  });

  test("creates gap with status 'ranking' when user position <= 10", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    const gapId = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 50,
      competitorPosition: 2,
      yourPosition: 8,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 75,
      priority: "medium",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.status).toBe("ranking");
  });

  test("creates gap with status 'identified' when user position > 10", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    const gapId = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 50,
      competitorPosition: 2,
      yourPosition: 25,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 75,
      priority: "medium",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.status).toBe("identified");
  });

  test("updates existing gap when keyword+competitor match exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    // Create first gap
    const gapId1 = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 50,
      competitorPosition: 5,
      yourPosition: null,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://competitor.com/old",
      estimatedTrafficValue: 50,
      priority: "medium",
    });

    // Upsert with same keyword+competitor should update
    const gapId2 = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 80,
      competitorPosition: 2,
      yourPosition: 15,
      searchVolume: 1500,
      difficulty: 45,
      competitorUrl: "https://competitor.com/new",
      estimatedTrafficValue: 200,
      priority: "high",
    });

    // Should return same ID (update, not insert)
    expect(gapId2).toEqual(gapId1);

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId1));
    expect(gap!.opportunityScore).toBe(80);
    expect(gap!.competitorUrl).toBe("https://competitor.com/new");
    expect(gap!.searchVolume).toBe(1500);
    expect(gap!.priority).toBe("high");
    // Status should remain "identified" because yourPosition=15 > 10
    expect(gap!.status).toBe("identified");
  });

  test("auto-updates status to 'ranking' on upsert when user now in top 10", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    // Create gap (user not ranking)
    await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 50,
      competitorPosition: 5,
      yourPosition: null,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 50,
      priority: "medium",
    });

    // Update with user now in top 10
    const gapId = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 60,
      competitorPosition: 5,
      yourPosition: 7,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 50,
      priority: "medium",
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(gapId));
    expect(gap!.status).toBe("ranking");
  });

  test("different competitors for same keyword create separate gaps", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const comp1 = await setupCompetitor(t, domainId, "comp1.com");
    const comp2 = await setupCompetitor(t, domainId, "comp2.com");

    const gapArgs = {
      domainId,
      keywordId,
      opportunityScore: 50,
      competitorPosition: 3,
      yourPosition: null,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://example.com",
      estimatedTrafficValue: 50,
      priority: "medium" as const,
    };

    const gapId1 = await t.mutation(internal.contentGaps_actions.upsertGap, {
      ...gapArgs,
      competitorId: comp1,
    });
    const gapId2 = await t.mutation(internal.contentGaps_actions.upsertGap, {
      ...gapArgs,
      competitorId: comp2,
    });

    expect(gapId1).not.toEqual(gapId2);
  });
});

// ---------------------------------------------------------------------------
// upsertGapsBatch
// ---------------------------------------------------------------------------

describe("upsertGapsBatch", () => {
  test("creates multiple gaps in a single mutation", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const kw1 = await setupKeyword(t, domainId, "keyword one");
    const kw2 = await setupKeyword(t, domainId, "keyword two");
    const comp = await setupCompetitor(t, domainId);

    const gaps = [
      {
        domainId,
        keywordId: kw1,
        competitorId: comp,
        opportunityScore: 70,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 1000,
        difficulty: 40,
        competitorUrl: "https://competitor.com/1",
        estimatedTrafficValue: 150,
        priority: "high" as const,
      },
      {
        domainId,
        keywordId: kw2,
        competitorId: comp,
        opportunityScore: 30,
        competitorPosition: 8,
        yourPosition: 20 as number | null,
        searchVolume: 200,
        difficulty: 60,
        competitorUrl: "https://competitor.com/2",
        estimatedTrafficValue: 10,
        priority: "low" as const,
      },
    ];

    const ids = await t.mutation(internal.contentGaps_actions.upsertGapsBatch, { gaps });
    expect(ids).toHaveLength(2);

    const gap1 = await t.run(async (ctx: any) => ctx.db.get(ids[0]));
    expect(gap1!.opportunityScore).toBe(70);
    expect(gap1!.status).toBe("identified");

    const gap2 = await t.run(async (ctx: any) => ctx.db.get(ids[1]));
    expect(gap2!.opportunityScore).toBe(30);
    expect(gap2!.status).toBe("identified");
  });

  test("batch upsert updates existing gaps", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const kw = await setupKeyword(t, domainId);
    const comp = await setupCompetitor(t, domainId);

    const gapData = {
      domainId,
      keywordId: kw,
      competitorId: comp,
      opportunityScore: 50,
      competitorPosition: 5,
      yourPosition: null,
      searchVolume: 500,
      difficulty: 30,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 50,
      priority: "medium" as const,
    };

    // Create first
    const ids1 = await t.mutation(internal.contentGaps_actions.upsertGapsBatch, {
      gaps: [gapData],
    });

    // Update via batch
    const ids2 = await t.mutation(internal.contentGaps_actions.upsertGapsBatch, {
      gaps: [{ ...gapData, opportunityScore: 90, priority: "high" as const }],
    });

    expect(ids1[0]).toEqual(ids2[0]);

    const gap = await t.run(async (ctx: any) => ctx.db.get(ids2[0]));
    expect(gap!.opportunityScore).toBe(90);
    expect(gap!.priority).toBe("high");
  });

  test("batch with empty array returns empty array", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.mutation(internal.contentGaps_actions.upsertGapsBatch, {
      gaps: [],
    });
    expect(ids).toEqual([]);
  });

  test("batch correctly sets ranking status for items with yourPosition <= 10", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const kw = await setupKeyword(t, domainId);
    const comp = await setupCompetitor(t, domainId);

    const ids = await t.mutation(internal.contentGaps_actions.upsertGapsBatch, {
      gaps: [{
        domainId,
        keywordId: kw,
        competitorId: comp,
        opportunityScore: 60,
        competitorPosition: 2,
        yourPosition: 5,
        searchVolume: 800,
        difficulty: 35,
        competitorUrl: "https://competitor.com/page",
        estimatedTrafficValue: 100,
        priority: "high" as const,
      }],
    });

    const gap = await t.run(async (ctx: any) => ctx.db.get(ids[0]));
    expect(gap!.status).toBe("ranking");
  });
});

// ---------------------------------------------------------------------------
// createReport
// ---------------------------------------------------------------------------

describe("createReport", () => {
  test("creates a gap analysis report", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);
    const keywordId = await setupKeyword(t, domainId);
    const competitorId = await setupCompetitor(t, domainId);

    // Create a content gap to reference
    const gapId = await t.mutation(internal.contentGaps_actions.upsertGap, {
      domainId,
      keywordId,
      competitorId,
      opportunityScore: 75,
      competitorPosition: 3,
      yourPosition: null,
      searchVolume: 1000,
      difficulty: 40,
      competitorUrl: "https://competitor.com/page",
      estimatedTrafficValue: 150,
      priority: "high",
    });

    const reportId = await t.mutation(internal.contentGaps_actions.createReport, {
      domainId,
      totalGaps: 10,
      highPriorityGaps: 3,
      estimatedTotalValue: 5000,
      topOpportunities: [gapId],
      competitorsAnalyzed: 2,
      keywordsAnalyzed: 15,
    });

    expect(reportId).toBeDefined();

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report).not.toBeNull();
    expect(report!.totalGaps).toBe(10);
    expect(report!.highPriorityGaps).toBe(3);
    expect(report!.estimatedTotalValue).toBe(5000);
    expect(report!.topOpportunities).toEqual([gapId]);
    expect(report!.competitorsAnalyzed).toBe(2);
    expect(report!.keywordsAnalyzed).toBe(15);
    expect(report!.generatedAt).toBeDefined();
  });

  test("creates report with empty topOpportunities", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const reportId = await t.mutation(internal.contentGaps_actions.createReport, {
      domainId,
      totalGaps: 0,
      highPriorityGaps: 0,
      estimatedTotalValue: 0,
      topOpportunities: [],
      competitorsAnalyzed: 1,
      keywordsAnalyzed: 5,
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.topOpportunities).toEqual([]);
    expect(report!.totalGaps).toBe(0);
  });
});
