import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDomain(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
  });

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

  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "onboard.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google.com",
        location: "US",
        language: "en",
      },
    });
  });

  return { userId, orgId, teamId, projectId, domainId };
}

// ===========================================================================
// Fresh domain — no steps completed
// ===========================================================================

describe("onboarding.getOnboardingStatus", () => {
  test("fresh domain has all steps false", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });

    expect(status).not.toBeNull();
    expect(status!.isCompleted).toBe(false);
    expect(status!.isDismissed).toBe(false);
    expect(status!.steps.businessContextSet).toBe(false);
    expect(status!.steps.keywordsDiscovered).toBe(false);
    expect(status!.steps.keywordsMonitored).toBe(false);
    expect(status!.steps.serpChecked).toBe(false);
    expect(status!.steps.competitorsAdded).toBe(false);
    expect(status!.steps.analysisComplete).toBe(false);

    expect(status!.counts.discoveredKeywords).toBe(0);
    expect(status!.counts.monitoredKeywords).toBe(0);
    expect(status!.counts.activeCompetitors).toBe(0);
    expect(status!.counts.contentGaps).toBe(0);
  });

  test("returns null for non-existent domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // Delete the domain
    await t.run(async (ctx: any) => {
      await ctx.db.delete(domainId);
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status).toBeNull();
  });
});

// ===========================================================================
// Steps derived from actual data
// ===========================================================================

describe("onboarding steps - data-driven", () => {
  test("businessContextSet becomes true when business description is set", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // Set business context
    await t.run(async (ctx: any) => {
      await ctx.db.patch(domainId, {
        businessDescription: "We sell widgets",
        targetCustomer: "Small businesses",
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.businessContextSet).toBe(true);
  });

  test("keywordsDiscovered becomes true when discovered keywords exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "test keyword",
        bestPosition: 5,
        url: "https://onboard.com/page",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.keywordsDiscovered).toBe(true);
    expect(status!.counts.discoveredKeywords).toBe(1);
  });

  test("keywordsDiscovered is also true when active monitored keywords exist (no discovered)", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "monitored keyword",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.keywordsDiscovered).toBe(true);
    expect(status!.steps.keywordsMonitored).toBe(true);
    expect(status!.counts.monitoredKeywords).toBe(1);
  });

  test("keywordsMonitored becomes true when active keywords exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "keyword one",
        status: "active",
        createdAt: Date.now(),
      });
      // Paused keywords should not count
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "paused keyword",
        status: "paused",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.keywordsMonitored).toBe(true);
    expect(status!.counts.monitoredKeywords).toBe(1); // Only active ones
  });

  test("serpChecked becomes true when SERP results exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId,
        domainId,
        date: "2025-01-01",
        position: 3,
        domain: "onboard.com",
        url: "https://onboard.com/page",
        isYourDomain: true,
        fetchedAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.serpChecked).toBe(true);
  });

  test("competitorsAdded becomes true when active competitors exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.competitorsAdded).toBe(true);
    expect(status!.counts.activeCompetitors).toBe(1);
  });

  test("paused competitors do not count for competitorsAdded", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "paused-rival.com",
        name: "Paused Rival",
        status: "paused",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.competitorsAdded).toBe(false);
    expect(status!.counts.activeCompetitors).toBe(0);
  });

  test("analysisComplete becomes true when a completed gap job exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "Comp",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorContentGapJobs", {
        domainId,
        competitorId,
        status: "completed",
        createdAt: Date.now(),
        completedAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.analysisComplete).toBe(true);
  });

  test("pending gap job does not mark analysisComplete", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "Comp",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorContentGapJobs", {
        domainId,
        competitorId,
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.steps.analysisComplete).toBe(false);
  });
});

// ===========================================================================
// All steps complete at once
// ===========================================================================

describe("onboarding - full completion", () => {
  test("all steps true when all data is present", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // Set business context
    await t.run(async (ctx: any) => {
      await ctx.db.patch(domainId, {
        businessDescription: "Widgets Inc",
        targetCustomer: "Enterprises",
      });
    });

    // Add discovered keyword
    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "disc",
        bestPosition: 5,
        url: "u",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    // Add active keyword
    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "mon",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Add SERP result
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId,
        domainId,
        date: "2025-01-01",
        position: 1,
        domain: "onboard.com",
        url: "u",
        isYourDomain: true,
        fetchedAt: Date.now(),
      });
    });

    // Add competitor
    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "Comp",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Complete gap job
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorContentGapJobs", {
        domainId,
        competitorId,
        status: "completed",
        createdAt: Date.now(),
        completedAt: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });

    expect(status!.steps.businessContextSet).toBe(true);
    expect(status!.steps.keywordsDiscovered).toBe(true);
    expect(status!.steps.keywordsMonitored).toBe(true);
    expect(status!.steps.serpChecked).toBe(true);
    expect(status!.steps.competitorsAdded).toBe(true);
    expect(status!.steps.analysisComplete).toBe(true);
  });
});

// ===========================================================================
// completeOnboarding
// ===========================================================================

describe("onboarding.completeOnboarding", () => {
  test("marks onboarding as completed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(api.onboarding.completeOnboarding, { domainId });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.isCompleted).toBe(true);
  });
});

// ===========================================================================
// dismissOnboarding
// ===========================================================================

describe("onboarding.dismissOnboarding", () => {
  test("marks onboarding as dismissed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(api.onboarding.dismissOnboarding, { domainId });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.isDismissed).toBe(true);
  });

  test("dismissing does not mark as completed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(api.onboarding.dismissOnboarding, { domainId });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.isDismissed).toBe(true);
    expect(status!.isCompleted).toBe(false);
  });
});

// ===========================================================================
// Content gap counts
// ===========================================================================

describe("onboarding - contentGaps count", () => {
  test("counts content gaps for the domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "Comp",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "gap kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 80,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 1000,
        difficulty: 30,
        competitorUrl: "https://comp.com/page",
        estimatedTrafficValue: 500,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 50,
        competitorPosition: 8,
        yourPosition: 25,
        searchVolume: 500,
        difficulty: 50,
        competitorUrl: "https://comp.com/other",
        estimatedTrafficValue: 200,
        priority: "medium",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const status = await t.query(api.onboarding.getOnboardingStatus, { domainId });
    expect(status!.counts.contentGaps).toBe(2);
  });
});
