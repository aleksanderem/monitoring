import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTenantHierarchy(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return ctx.db.insert("users", {
      email: "alice@test.com",
      emailVerificationTime: Date.now(),
    });
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
      role: "owner" as const,
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
      role: "owner" as const,
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
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google",
        location: "United States",
        language: "en",
      },
    });
  });

  return { userId, orgId, teamId, projectId, domainId };
}

/** Create a strategy session directly in the DB and return its ID. */
async function insertSession(
  t: any,
  domainId: any,
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("aiStrategySessions", {
      domainId,
      businessDescription: "Test biz",
      targetCustomer: "SMBs",
      dataSnapshot: null,
      strategy: null,
      drillDowns: [],
      status: "initializing",
      progress: 0,
      currentStep: "Initializing...",
      steps: [
        { name: "Loading domain data", status: "pending" },
        { name: "Collecting data", status: "pending" },
        { name: "Analyzing", status: "pending" },
      ],
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

// ===========================================================================
// createSession (internalMutation)
// ===========================================================================

describe("aiStrategy.createSession", () => {
  test("creates a session with default fields", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const sessionId = await t.mutation(internal.aiStrategy.createSession, {
      domainId,
      businessDescription: "E-commerce store",
      targetCustomer: "Online shoppers",
    });

    expect(sessionId).toBeDefined();
    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.status).toBe("initializing");
    expect(session.progress).toBe(0);
    expect(session.drillDowns).toEqual([]);
    expect(session.dataSnapshot).toBeNull();
    expect(session.strategy).toBeNull();
    expect(session.steps).toHaveLength(9); // STRATEGY_STEPS has 9 entries
    expect(session.steps[0].status).toBe("pending");
    expect(session.createdAt).toBeGreaterThan(0);
  });

  test("stores optional fields", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const sessionId = await t.mutation(internal.aiStrategy.createSession, {
      domainId,
      businessDescription: "Test",
      targetCustomer: "Users",
      focusKeywords: ["seo", "marketing"],
      generateBacklinkContent: true,
      generateContentMockups: false,
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.focusKeywords).toEqual(["seo", "marketing"]);
    expect(session.generateBacklinkContent).toBe(true);
    expect(session.generateContentMockups).toBe(false);
  });
});

// ===========================================================================
// updateSessionProgress (internalMutation)
// ===========================================================================

describe("aiStrategy.updateSessionProgress", () => {
  test("updates progress and step status", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    await t.mutation(internal.aiStrategy.updateSessionProgress, {
      sessionId,
      progress: 30,
      currentStep: "Collecting data",
      status: "collecting",
      stepIndex: 0,
      stepStatus: "completed",
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.progress).toBe(30);
    expect(session.currentStep).toBe("Collecting data");
    expect(session.status).toBe("collecting");
    expect(session.steps[0].status).toBe("completed");
    expect(session.steps[0].completedAt).toBeGreaterThan(0);
  });

  test("sets startedAt when step status is running", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    await t.mutation(internal.aiStrategy.updateSessionProgress, {
      sessionId,
      progress: 10,
      stepIndex: 1,
      stepStatus: "running",
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.steps[1].status).toBe("running");
    expect(session.steps[1].startedAt).toBeGreaterThan(0);
  });

  test("no-ops for non-existent session", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);
    await t.run(async (ctx: any) => ctx.db.delete(sessionId));

    // Should not throw
    await t.mutation(internal.aiStrategy.updateSessionProgress, {
      sessionId,
      progress: 50,
    });
  });
});

// ===========================================================================
// updateStrategy (internalMutation)
// ===========================================================================

describe("aiStrategy.updateStrategy", () => {
  test("stores strategy and marks completed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    const mockStrategy = { executiveSummary: "Great site", actionPlan: [] };
    await t.mutation(internal.aiStrategy.updateStrategy, {
      sessionId,
      dataSnapshot: { keywordCount: 50 },
      strategy: mockStrategy,
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.status).toBe("completed");
    expect(session.completedAt).toBeGreaterThan(0);
    expect(session.strategy.executiveSummary).toBe("Great site");
    expect(session.dataSnapshot.keywordCount).toBe(50);
  });
});

// ===========================================================================
// failSession (internalMutation)
// ===========================================================================

describe("aiStrategy.failSession", () => {
  test("marks session as failed with error message", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    await t.mutation(internal.aiStrategy.failSession, {
      sessionId,
      error: "API timeout",
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.status).toBe("failed");
    expect(session.error).toBe("API timeout");
  });

  test("marks running step as failed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId, {
      steps: [
        { name: "Step 1", status: "completed" },
        { name: "Step 2", status: "running", startedAt: Date.now() },
        { name: "Step 3", status: "pending" },
      ],
    });

    await t.mutation(internal.aiStrategy.failSession, {
      sessionId,
      error: "Crash",
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.steps[0].status).toBe("completed");
    expect(session.steps[1].status).toBe("failed");
    expect(session.steps[1].completedAt).toBeGreaterThan(0);
    expect(session.steps[2].status).toBe("pending");
  });
});

// ===========================================================================
// appendDrillDown (internalMutation)
// ===========================================================================

describe("aiStrategy.appendDrillDown", () => {
  test("appends drill-down to session", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    await t.mutation(internal.aiStrategy.appendDrillDown, {
      sessionId,
      sectionKey: "keywords",
      question: "What about long-tail?",
      response: "Focus on long-tail keywords for quick wins.",
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.drillDowns).toHaveLength(1);
    expect(session.drillDowns[0].sectionKey).toBe("keywords");
    expect(session.drillDowns[0].question).toBe("What about long-tail?");
    expect(session.drillDowns[0].createdAt).toBeGreaterThan(0);
  });

  test("appends multiple drill-downs", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    await t.mutation(internal.aiStrategy.appendDrillDown, {
      sessionId,
      sectionKey: "backlinks",
      response: "Build more links.",
    });
    await t.mutation(internal.aiStrategy.appendDrillDown, {
      sessionId,
      sectionKey: "content",
      response: "Create content hubs.",
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.drillDowns).toHaveLength(2);
    expect(session.drillDowns[0].sectionKey).toBe("backlinks");
    expect(session.drillDowns[1].sectionKey).toBe("content");
  });

  test("throws for non-existent session", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);
    await t.run(async (ctx: any) => ctx.db.delete(sessionId));

    await expect(
      t.mutation(internal.aiStrategy.appendDrillDown, {
        sessionId,
        sectionKey: "x",
        response: "y",
      })
    ).rejects.toThrow("Session not found");
  });
});

// ===========================================================================
// getHistory (query — requires auth)
// ===========================================================================

describe("aiStrategy.getHistory", () => {
  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const result = await t.query(api.aiStrategy.getHistory, { domainId });
    expect(result).toEqual([]);
  });

  test("returns sessions ordered desc, limited to 10", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 12; i++) {
        await ctx.db.insert("aiStrategySessions", {
          domainId,
          businessDescription: `Session ${i}`,
          targetCustomer: "Users",
          dataSnapshot: null,
          strategy: null,
          drillDowns: [],
          status: "completed",
          createdAt: i * 1000,
        });
      }
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.aiStrategy.getHistory, { domainId });
    expect(result).toHaveLength(10);
    // Newest first
    expect(result[0].businessDescription).toBe("Session 11");
  });
});

// ===========================================================================
// getLatest (query — requires auth)
// ===========================================================================

describe("aiStrategy.getLatest", () => {
  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const result = await t.query(api.aiStrategy.getLatest, { domainId });
    expect(result).toBeNull();
  });

  test("returns the most recent session", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("aiStrategySessions", {
        domainId,
        businessDescription: "Old",
        targetCustomer: "X",
        dataSnapshot: null,
        strategy: null,
        drillDowns: [],
        status: "completed",
        createdAt: 1000,
      });
      await ctx.db.insert("aiStrategySessions", {
        domainId,
        businessDescription: "New",
        targetCustomer: "Y",
        dataSnapshot: null,
        strategy: null,
        drillDowns: [],
        status: "completed",
        createdAt: 2000,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.aiStrategy.getLatest, { domainId });
    expect(result).not.toBeNull();
    expect(result!.businessDescription).toBe("New");
  });

  test("returns null when no sessions exist", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.aiStrategy.getLatest, { domainId });
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getActiveStrategy / setActiveStrategy
// ===========================================================================

describe("aiStrategy.setActiveStrategy & getActiveStrategy", () => {
  test("sets and retrieves active strategy", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    const sessionId = await insertSession(t, domainId, {
      status: "completed",
      strategy: { actionPlan: [{ title: "Task 1" }], actionableSteps: [{ title: "Step 1" }] },
    });

    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.aiStrategy.setActiveStrategy, {
      domainId,
      sessionId,
    });

    const active = await asUser.query(api.aiStrategy.getActiveStrategy, { domainId });
    expect(active).not.toBeNull();
    expect(active!._id).toEqual(sessionId);
  });

  test("initializes taskStatuses and stepStatuses on activation", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    const sessionId = await insertSession(t, domainId, {
      status: "completed",
      strategy: {
        actionPlan: [{ title: "T1" }, { title: "T2" }],
        actionableSteps: [{ title: "S1" }],
      },
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.aiStrategy.setActiveStrategy, { domainId, sessionId });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.taskStatuses).toHaveLength(2);
    expect(session.taskStatuses[0]).toEqual({ index: 0, completed: false });
    expect(session.stepStatuses).toHaveLength(1);
    expect(session.stepStatuses[0]).toEqual({ index: 0, completed: false });
  });

  test("clears active strategy when sessionId is undefined", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    const sessionId = await insertSession(t, domainId, { status: "completed" });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.aiStrategy.setActiveStrategy, { domainId, sessionId });
    await asUser.mutation(api.aiStrategy.setActiveStrategy, { domainId });

    const active = await asUser.query(api.aiStrategy.getActiveStrategy, { domainId });
    expect(active).toBeNull();
  });

  test("rejects non-completed session", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);

    const sessionId = await insertSession(t, domainId, { status: "analyzing" });
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.aiStrategy.setActiveStrategy, { domainId, sessionId })
    ).rejects.toThrow("Only completed strategies can be activated");
  });

  test("rejects session from different domain", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId, projectId } = await createTenantHierarchy(t);

    const otherDomainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "other.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "weekly" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
    });

    const sessionId = await insertSession(t, otherDomainId, { status: "completed" });
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.aiStrategy.setActiveStrategy, { domainId, sessionId })
    ).rejects.toThrow("Session does not belong to this domain");
  });
});

// ===========================================================================
// updateTaskStatus (mutation — requires auth)
// ===========================================================================

describe("aiStrategy.updateTaskStatus", () => {
  test("marks a task as completed", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId, {
      status: "completed",
      taskStatuses: [
        { index: 0, completed: false },
        { index: 1, completed: false },
      ],
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.aiStrategy.updateTaskStatus, {
      sessionId,
      taskIndex: 0,
      completed: true,
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.taskStatuses[0].completed).toBe(true);
    expect(session.taskStatuses[0].completedAt).toBeGreaterThan(0);
    expect(session.taskStatuses[1].completed).toBe(false);
  });

  test("creates new task status entry if missing", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId, { status: "completed" });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.aiStrategy.updateTaskStatus, {
      sessionId,
      taskIndex: 5,
      completed: true,
    });

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.taskStatuses).toHaveLength(1);
    expect(session.taskStatuses[0].index).toBe(5);
    expect(session.taskStatuses[0].completed).toBe(true);
  });
});

// ===========================================================================
// updateStepStatus (mutation — requires auth)
// ===========================================================================

describe("aiStrategy.updateStepStatus", () => {
  test("marks a step as completed and clears completedAt on uncheck", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId, {
      status: "completed",
      stepStatuses: [{ index: 0, completed: false }],
    });

    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.aiStrategy.updateStepStatus, {
      sessionId,
      stepIndex: 0,
      completed: true,
    });

    let session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.stepStatuses[0].completed).toBe(true);
    expect(session.stepStatuses[0].completedAt).toBeGreaterThan(0);

    await asUser.mutation(api.aiStrategy.updateStepStatus, {
      sessionId,
      stepIndex: 0,
      completed: false,
    });

    session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.stepStatuses[0].completed).toBe(false);
    expect(session.stepStatuses[0].completedAt).toBeUndefined();
  });
});

// ===========================================================================
// deleteSession (mutation — requires auth)
// ===========================================================================

describe("aiStrategy.deleteSession", () => {
  test("deletes a session", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.aiStrategy.deleteSession, { id: sessionId });

    const deleted = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(deleted).toBeNull();
  });

  test("clears activeStrategyId on domain when deleting the active strategy", async () => {
    const t = convexTest(schema, modules);
    const { userId, domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId, { status: "completed" });

    // Set as active
    await t.run(async (ctx: any) => {
      await ctx.db.patch(domainId, { activeStrategyId: sessionId });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.aiStrategy.deleteSession, { id: sessionId });

    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain.activeStrategyId).toBeUndefined();
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    await expect(
      t.mutation(api.aiStrategy.deleteSession, { id: sessionId })
    ).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// getSessionInternal (internalQuery)
// ===========================================================================

describe("aiStrategy.getSessionInternal", () => {
  test("returns session by ID", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);
    const sessionId = await insertSession(t, domainId);

    const session = await t.query(internal.aiStrategy.getSessionInternal, { sessionId });
    expect(session).not.toBeNull();
    expect(session!._id).toEqual(sessionId);
    expect(session!.businessDescription).toBe("Test biz");
  });
});

// ===========================================================================
// getOrgAISettingsForDomain (internalQuery)
// ===========================================================================

describe("aiStrategy.getOrgAISettingsForDomain", () => {
  test("returns aiSettings from the org hierarchy", async () => {
    const t = convexTest(schema, modules);
    const { domainId, orgId } = await createTenantHierarchy(t);

    const aiSettings = { provider: "anthropic" as const, model: "claude-sonnet" };
    await t.run(async (ctx: any) => {
      await ctx.db.patch(orgId, { aiSettings });
    });

    const result = await t.query(internal.aiStrategy.getOrgAISettingsForDomain, { domainId });
    expect(result).toEqual(aiSettings);
  });

  test("returns null when org has no aiSettings", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const result = await t.query(internal.aiStrategy.getOrgAISettingsForDomain, { domainId });
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getContentGapsInternal (internalQuery)
// ===========================================================================

describe("aiStrategy.getContentGapsInternal", () => {
  test("returns gaps with keyword phrases and counts", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const { keywordId, competitorId } = await t.run(async (ctx: any) => {
      const kid = await ctx.db.insert("keywords", {
        domainId,
        phrase: "seo tool",
        status: "active",
        createdAt: Date.now(),
      });
      const cid = await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active",
        createdAt: Date.now(),
      });
      return { keywordId: kid, competitorId: cid };
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId,
        competitorId,
        opportunityScore: 80,
        competitorPosition: 3,
        yourPosition: null,
        searchVolume: 5000,
        difficulty: 30,
        competitorUrl: "https://rival.com/seo",
        estimatedTrafficValue: 200,
        priority: "high",
        status: "identified",
        identifiedAt: Date.now(),
        lastChecked: Date.now(),
      });
    });

    const result = await t.query(internal.aiStrategy.getContentGapsInternal, { domainId });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].keywordPhrase).toBe("seo tool");
    expect(result.totalCount).toBe(1);
    expect(result.identifiedCount).toBe(1);
  });

  test("returns empty when no gaps exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const result = await t.query(internal.aiStrategy.getContentGapsInternal, { domainId });
    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.identifiedCount).toBe(0);
  });
});

// ===========================================================================
// getCompetitorsInternal (internalQuery)
// ===========================================================================

describe("aiStrategy.getCompetitorsInternal", () => {
  test("returns competitors for domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active",
        createdAt: Date.now(),
      });
      await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "other.com",
        name: "Other",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.aiStrategy.getCompetitorsInternal, { domainId });
    expect(result).toHaveLength(2);
  });
});

// ===========================================================================
// getCannibalizationInternal (internalQuery)
// ===========================================================================

describe("aiStrategy.getCannibalizationInternal", () => {
  test("detects cannibalization when same URL ranks for multiple keywords", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    // Create two keywords
    const { kw1Id, kw2Id } = await t.run(async (ctx: any) => {
      const k1 = await ctx.db.insert("keywords", {
        domainId,
        phrase: "seo tools",
        status: "active",
        createdAt: Date.now(),
      });
      const k2 = await ctx.db.insert("keywords", {
        domainId,
        phrase: "best seo tools",
        status: "active",
        createdAt: Date.now(),
      });
      return { kw1Id: k1, kw2Id: k2 };
    });

    // Both keywords rank on the same URL
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId: kw1Id,
        domainId,
        date: "2025-01-15",
        position: 5,
        url: "https://example.com/seo-tools/",
        domain: "example.com",
        title: "SEO Tools",
        isYourDomain: true,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("keywordSerpResults", {
        keywordId: kw2Id,
        domainId,
        date: "2025-01-15",
        position: 8,
        url: "https://example.com/seo-tools/",
        domain: "example.com",
        title: "SEO Tools",
        isYourDomain: true,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(internal.aiStrategy.getCannibalizationInternal, { domainId });
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/seo-tools");
    expect(result[0].keywordCount).toBe(2);
    expect(result[0].keywords).toHaveLength(2);
    // Sorted by position asc
    expect(result[0].keywords[0].position).toBe(5);
    expect(result[0].keywords[1].position).toBe(8);
    expect(result[0].avgPosition).toBe(6.5);
  });

  test("returns empty when no cannibalization", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const kwId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "seo tools",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId: kwId,
        domainId,
        date: "2025-01-15",
        position: 5,
        url: "https://example.com/page1",
        domain: "example.com",
        title: "Page 1",
        isYourDomain: true,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(internal.aiStrategy.getCannibalizationInternal, { domainId });
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// getQuickWinsEnrichedInternal (internalQuery)
// ===========================================================================

describe("aiStrategy.getQuickWinsEnrichedInternal", () => {
  test("returns qualifying quick-win keywords sorted by score", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    await t.run(async (ctx: any) => {
      // Qualifies: pos 15 (11-20 range), vol >= 100, diff < 50
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "best seo tool",
        bestPosition: 15,
        url: "https://example.com/seo",
        searchVolume: 2000,
        difficulty: 30,
        cpc: 2.5,
        traffic: 100,
        lastSeenDate: "2025-01-15",
        status: "discovered",
        createdAt: Date.now(),
      });
      // Qualifies: pos 8 (4-10 range)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "seo checker",
        bestPosition: 8,
        url: "https://example.com/checker",
        searchVolume: 500,
        difficulty: 20,
        cpc: 1.0,
        traffic: 50,
        lastSeenDate: "2025-01-15",
        status: "discovered",
        createdAt: Date.now(),
      });
      // Does NOT qualify: pos 2 (<=3)
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "example brand",
        bestPosition: 2,
        url: "https://example.com",
        searchVolume: 10000,
        difficulty: 10,
        lastSeenDate: "2025-01-15",
        status: "discovered",
        createdAt: Date.now(),
      });
      // Does NOT qualify: difficulty >= 50
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "competitive keyword",
        bestPosition: 10,
        url: "https://example.com/comp",
        searchVolume: 3000,
        difficulty: 80,
        lastSeenDate: "2025-01-15",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.aiStrategy.getQuickWinsEnrichedInternal, { domainId });
    expect(result).toHaveLength(2);
    // "best seo tool" at pos 15 with vol 2000 gets the 1.5x positionFactor bonus
    // "seo checker" at pos 8 with vol 500
    expect(result[0].keyword).toBe("best seo tool");
    expect(result[0].quickWinScore).toBeGreaterThan(0);
    expect(result[1].keyword).toBe("seo checker");
  });

  test("returns empty for domain with no discovered keywords", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantHierarchy(t);

    const result = await t.query(internal.aiStrategy.getQuickWinsEnrichedInternal, { domainId });
    expect(result).toHaveLength(0);
  });
});
