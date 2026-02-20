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

async function insertReport(t: any, projectId: string, domainId: string, userId: string, overrides: any = {}) {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("generatedReports", {
      projectId,
      name: "Test Report",
      reportType: "summary" as const,
      format: "pdf" as const,
      dateRange: { start: "2025-01-01", end: "2025-01-31" },
      domainsIncluded: [domainId],
      status: "ready" as const,
      progress: 100,
      createdBy: userId,
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

// ===========================================================================
// getGeneratedReports
// ===========================================================================

describe("generatedReports.getGeneratedReports", () => {
  test("returns reports for a project", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await insertReport(t, projectId, domainId, userId, { name: "Report A" });
    await insertReport(t, projectId, domainId, userId, { name: "Report B" });

    const asUser = t.withIdentity({ subject: userId });
    const reports = await asUser.query(api.generatedReports.getGeneratedReports, { projectId });

    expect(reports).toHaveLength(2);
    const names = reports.map((r: any) => r.name);
    expect(names).toContain("Report A");
    expect(names).toContain("Report B");
  });

  test("returns empty array when no reports exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const reports = await asUser.query(api.generatedReports.getGeneratedReports, { projectId });

    expect(reports).toHaveLength(0);
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    await expect(
      t.query(api.generatedReports.getGeneratedReports, { projectId })
    ).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// getGeneratedReport (single)
// ===========================================================================

describe("generatedReports.getGeneratedReport", () => {
  test("returns a single report by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId, { name: "Single Report" });

    const asUser = t.withIdentity({ subject: userId });
    const report = await asUser.query(api.generatedReports.getGeneratedReport, { reportId });

    expect(report).not.toBeNull();
    expect(report!.name).toBe("Single Report");
    expect(report!.reportType).toBe("summary");
    expect(report!.format).toBe("pdf");
    expect(report!.status).toBe("ready");
    expect(report!.progress).toBe(100);
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId);

    await expect(
      t.query(api.generatedReports.getGeneratedReport, { reportId })
    ).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// createReportRecord (internal)
// ===========================================================================

describe("generatedReports.createReportRecord", () => {
  test("creates a report with generating status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.mutation(internal.generatedReports.createReportRecord, {
      projectId,
      name: "New Report",
      reportType: "detailed",
      format: "csv",
      dateRange: { start: "2025-02-01", end: "2025-02-28" },
      domainsIncluded: [domainId],
      createdBy: userId,
    });

    expect(reportId).toBeTruthy();

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.name).toBe("New Report");
    expect(report!.status).toBe("generating");
    expect(report!.progress).toBe(0);
    expect(report!.reportType).toBe("detailed");
    expect(report!.format).toBe("csv");
  });
});

// ===========================================================================
// completeReport (internal)
// ===========================================================================

describe("generatedReports.completeReport", () => {
  test("marks report as ready with file details", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId, {
      status: "generating",
      progress: 50,
    });

    await t.mutation(internal.generatedReports.completeReport, {
      reportId,
      fileUrl: "https://storage.example.com/report.pdf",
      fileSize: 102400,
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.status).toBe("ready");
    expect(report!.progress).toBe(100);
    expect(report!.fileUrl).toBe("https://storage.example.com/report.pdf");
    expect(report!.fileSize).toBe(102400);
    expect(report!.completedAt).toBeDefined();
  });
});

// ===========================================================================
// failReport (internal)
// ===========================================================================

describe("generatedReports.failReport", () => {
  test("marks report as failed with error message", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId, {
      status: "generating",
      progress: 30,
    });

    await t.mutation(internal.generatedReports.failReport, {
      reportId,
      error: "API timeout",
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.status).toBe("failed");
    expect(report!.error).toBe("API timeout");
    expect(report!.completedAt).toBeDefined();
  });
});

// ===========================================================================
// deleteGeneratedReport
// ===========================================================================

describe("generatedReports.deleteGeneratedReport", () => {
  test("deletes a report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.generatedReports.deleteGeneratedReport, { reportId });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report).toBeNull();
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId);

    await expect(
      t.mutation(api.generatedReports.deleteGeneratedReport, { reportId })
    ).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// markEmailSent (internal)
// ===========================================================================

describe("generatedReports.markEmailSent", () => {
  test("sets emailSent flag on report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);
    const reportId = await insertReport(t, projectId, domainId, userId);

    await t.mutation(internal.generatedReports.markEmailSent, { reportId });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.emailSent).toBe(true);
  });
});
