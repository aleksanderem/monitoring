import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
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
      name: "Team",
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
      name: "Project",
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

async function createDomain(t: any, projectId: string) {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

// ---------------------------------------------------------------------------
// getDomainReport (public query)
// ---------------------------------------------------------------------------

describe("getDomainReport", () => {
  test("returns a report by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx) => {
      return ctx.db.insert("domainReports", {
        domainId,
        name: "Test Report",
        status: "initializing",
        progress: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.domainReports.getDomainReport, { reportId });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test Report");
    expect(result!.status).toBe("initializing");
    expect(result!.progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getLatestDomainReport (public query)
// ---------------------------------------------------------------------------

describe("getLatestDomainReport", () => {
  test("returns latest ready report for a domain", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    // Insert an older ready report
    await t.run(async (ctx) => {
      await ctx.db.insert("domainReports", {
        domainId,
        name: "Old Report",
        status: "ready",
        progress: 100,
        createdAt: Date.now() - 10000,
      });
    });

    // Insert a newer initializing report
    await t.run(async (ctx) => {
      await ctx.db.insert("domainReports", {
        domainId,
        name: "New Report",
        status: "initializing",
        progress: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.domainReports.getLatestDomainReport, { domainId });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Old Report");
    expect(result!.status).toBe("ready");
  });

  test("returns null when no ready reports exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainReports", {
        domainId,
        name: "Pending Report",
        status: "initializing",
        progress: 0,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.domainReports.getLatestDomainReport, { domainId });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createDomainReportInternal (internal mutation)
// ---------------------------------------------------------------------------

describe("createDomainReportInternal", () => {
  test("creates a report with pending steps", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "SEO Report — example.com",
      profile: "full",
    });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report).not.toBeNull();
    expect(report!.name).toBe("SEO Report — example.com");
    expect(report!.status).toBe("initializing");
    expect(report!.progress).toBe(0);
    expect(report!.currentStep).toBe("Initializing...");
    expect(report!.profile).toBe("full");
    expect(report!.steps).toHaveLength(10);
    expect(report!.steps!.every((s: any) => s.status === "pending")).toBe(true);
  });

  test("defaults profile to full when not provided", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "Report",
    });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.profile).toBe("full");
  });
});

// ---------------------------------------------------------------------------
// updateReportProgress (internal mutation)
// ---------------------------------------------------------------------------

describe("updateReportProgress", () => {
  test("updates progress and status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "Report",
    });

    await t.mutation(internal.domainReports.updateReportProgress, {
      reportId,
      progress: 50,
      currentStep: "Analyzing...",
      status: "analyzing",
    });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.progress).toBe(50);
    expect(report!.currentStep).toBe("Analyzing...");
    expect(report!.status).toBe("analyzing");
  });

  test("updates a specific step status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "Report",
    });

    // Mark step 0 as running
    await t.mutation(internal.domainReports.updateReportProgress, {
      reportId,
      progress: 5,
      stepIndex: 0,
      stepStatus: "running",
    });

    let report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.steps![0].status).toBe("running");
    expect(report!.steps![0].startedAt).toBeDefined();

    // Mark step 0 as completed
    await t.mutation(internal.domainReports.updateReportProgress, {
      reportId,
      progress: 15,
      stepIndex: 0,
      stepStatus: "completed",
    });

    report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.steps![0].status).toBe("completed");
    expect(report!.steps![0].completedAt).toBeDefined();
  });

  test("no-ops when report does not exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    // Create then delete to get a valid-shaped but non-existent ID
    const reportId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("domainReports", {
        domainId,
        name: "Temp",
        status: "initializing",
        progress: 0,
        createdAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    // Should not throw
    await t.mutation(internal.domainReports.updateReportProgress, {
      reportId,
      progress: 50,
    });
  });
});

// ---------------------------------------------------------------------------
// storeReportData (internal mutation)
// ---------------------------------------------------------------------------

describe("storeReportData", () => {
  test("stores report data and marks as ready", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "Report",
    });

    const reportData = { healthScore: { total: 75 }, keywords: { total: 10 } };
    await t.mutation(internal.domainReports.storeReportData, {
      reportId,
      reportData,
    });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.status).toBe("ready");
    expect(report!.progress).toBe(100);
    expect(report!.currentStep).toBe("Report ready!");
    expect(report!.completedAt).toBeDefined();
    expect(report!.reportData).toEqual(reportData);
  });
});

// ---------------------------------------------------------------------------
// failReport (internal mutation)
// ---------------------------------------------------------------------------

describe("failReport", () => {
  test("marks report as failed with error", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "Report",
    });

    await t.mutation(internal.domainReports.failReport, {
      reportId,
      error: "Something went wrong",
    });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.status).toBe("failed");
    expect(report!.error).toBe("Something went wrong");
    expect(report!.completedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// cancelReport (internal mutation)
// ---------------------------------------------------------------------------

describe("cancelReport", () => {
  test("cancels an in-progress report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.domainReports.createDomainReportInternal, {
      domainId,
      name: "Report",
    });

    await t.mutation(internal.domainReports.cancelReport, { reportId });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.status).toBe("failed");
    expect(report!.error).toBe("Cancelled by user");
  });

  test("does not cancel an already-ready report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx) => {
      return ctx.db.insert("domainReports", {
        domainId,
        name: "Report",
        status: "ready",
        progress: 100,
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.domainReports.cancelReport, { reportId });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.status).toBe("ready");
  });

  test("does not cancel an already-failed report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx) => {
      return ctx.db.insert("domainReports", {
        domainId,
        name: "Report",
        status: "failed",
        progress: 30,
        error: "Old error",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.domainReports.cancelReport, { reportId });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    expect(report!.error).toBe("Old error");
  });
});

// ---------------------------------------------------------------------------
// getDomainInternal / getReportInternal (internal queries)
// ---------------------------------------------------------------------------

describe("getDomainInternal", () => {
  test("returns a domain by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.query(internal.domainReports.getDomainInternal, { domainId });
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("example.com");
  });
});

describe("getReportInternal", () => {
  test("returns a report by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx) => {
      return ctx.db.insert("domainReports", {
        domainId,
        name: "Report",
        status: "ready",
        progress: 100,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.domainReports.getReportInternal, { reportId });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Report");
  });
});

// ---------------------------------------------------------------------------
// collectReportDataInternal (internal query - basic smoke test)
// ---------------------------------------------------------------------------

describe("collectReportDataInternal", () => {
  test("returns report data structure for empty domain", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.query(internal.domainReports.collectReportDataInternal, { domainId });

    expect(result).toBeDefined();
    expect(result.domainName).toBe("example.com");
    expect(result.healthScore).toBeDefined();
    expect(result.healthScore.total).toBeGreaterThanOrEqual(0);
    expect(result.keywords).toBeDefined();
    expect(result.keywords.total).toBe(0);
    expect(result.backlinks).toBeDefined();
    expect(result.backlinks.summary).toBeNull();
    expect(result.competitors).toBeDefined();
    expect(result.competitors.total).toBe(0);
    expect(result.contentGaps).toBeDefined();
    expect(result.contentGaps.total).toBe(0);
    expect(result.onSite).toBeNull();
    expect(result.linkBuilding).toBeDefined();
    expect(result.linkBuilding.totalProspects).toBe(0);
    expect(result.recommendations).toBeDefined();
  });

  test("includes keyword data in report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    // Insert some active keywords with positions
    await t.run(async (ctx) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 5,
        previousPosition: 8,
        positionChange: 3,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "another keyword",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 15,
        previousPosition: 12,
        positionChange: -3,
      });
    });

    const result = await t.query(internal.domainReports.collectReportDataInternal, { domainId });
    expect(result.keywords.total).toBe(2);
    expect(result.keywords.avgPosition).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// checkDataStaleness (internal query)
// ---------------------------------------------------------------------------

describe("checkDataStaleness", () => {
  test("returns stale flags for domain with no data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.query(internal.domainReports.checkDataStaleness, {
      domainId,
      thresholdMs: 24 * 60 * 60 * 1000,
    });

    expect(result.staleCompetitors).toEqual([]);
    expect(result.contentGapsStale).toBe(true);
    expect(result.linkBuildingStale).toBe(true);
    expect(result.onsiteAvailable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateProspectsInternal (internal mutation)
// ---------------------------------------------------------------------------

describe("generateProspectsInternal", () => {
  test("no-ops when no competitors exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.mutation(internal.domainReports.generateProspectsInternal, { domainId });

    const prospects = await t.run(async (ctx) => {
      return ctx.db
        .query("linkBuildingProspects")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(prospects).toHaveLength(0);
  });

  test("generates prospects from competitor backlinks", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    // Create a competitor
    const competitorId = await t.run(async (ctx) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Add competitor backlinks from external domains
    await t.run(async (ctx) => {
      await ctx.db.insert("competitorBacklinks", {
        competitorId,
        urlFrom: "https://blog.com/article",
        domainFrom: "blog.com",
        urlTo: "https://rival.com/page",
        domainFromRank: 300,
        dofollow: true,
        anchor: "great resource",
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("competitorBacklinks", {
        competitorId,
        urlFrom: "https://news.com/post",
        domainFrom: "news.com",
        urlTo: "https://rival.com/other",
        domainFromRank: 500,
        dofollow: false,
        anchor: "click here",
        fetchedAt: Date.now(),
      });
    });

    await t.mutation(internal.domainReports.generateProspectsInternal, { domainId });

    const prospects = await t.run(async (ctx) => {
      return ctx.db
        .query("linkBuildingProspects")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(prospects.length).toBeGreaterThanOrEqual(2);
    expect(prospects.every((p: any) => p.prospectScore > 0)).toBe(true);
  });
});
