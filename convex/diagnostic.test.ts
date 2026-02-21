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

async function createUser(t: any, name: string, email: string) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name, email });
  });
}

async function makeSuperAdmin(t: any, userId: string) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("superAdmins", {
      userId,
      grantedAt: Date.now(),
    });
  });
}

async function setupFullHierarchy(t: any, userId: string) {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Diag Org",
      slug: "diag-org",
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
      name: "Diag Project",
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

// ===========================================================================
// getDiagnosticSnapshot
// ===========================================================================

describe("diagnostic.getDiagnosticSnapshot", () => {
  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.diagnostic.getDiagnosticSnapshot, {});
    expect(result).toBeNull();
  });

  test("returns null for non-admin user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");
    await setupFullHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.diagnostic.getDiagnosticSnapshot, {});
    expect(result).toBeNull();
  });

  test("returns snapshot for super admin with empty domain", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    await setupFullHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDiagnosticSnapshot, {});

    expect(result).not.toBeNull();
    expect(result!.organization.name).toBe("Diag Org");
    expect(result!.hierarchy.projects).toHaveLength(1);
    expect(result!.hierarchy.projects[0].domains).toHaveLength(1);
    expect(result!.invariants.length).toBeGreaterThanOrEqual(1);
    // With no data, we should see "ok" invariants
    const okInvariants = result!.invariants.filter((i: any) => i.status === "ok");
    expect(okInvariants.length).toBeGreaterThanOrEqual(1);
  });

  test("returns snapshot with keyword stats", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { domainId } = await setupFullHierarchy(t, adminId);

    // Add keywords
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "seo tools",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "keyword tracker",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 2,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "paused kw",
        status: "paused",
        createdAt: Date.now(),
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDiagnosticSnapshot, {});

    expect(result).not.toBeNull();
    const domainStats = result!.hierarchy.projects[0].domains[0];
    expect(domainStats.keywords.active).toBe(2);
    expect(domainStats.keywords.paused).toBe(1);
    expect(domainStats.keywords.total).toBe(3);
    expect(domainStats.keywords.withinLimit).toBe(true);
  });

  test("returns null when admin has no org membership", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    // No org membership created

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDiagnosticSnapshot, {});
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getDomainDiagnostic
// ===========================================================================

describe("diagnostic.getDomainDiagnostic", () => {
  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "User", "user@test.com");
    const { domainId } = await setupFullHierarchy(t, userId);

    const result = await t.query(api.diagnostic.getDomainDiagnostic, { domainId });
    expect(result).toBeNull();
  });

  test("returns null for non-admin user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");
    const { domainId } = await setupFullHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.diagnostic.getDomainDiagnostic, { domainId });
    expect(result).toBeNull();
  });

  test("returns diagnostic for super admin", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { domainId } = await setupFullHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDomainDiagnostic, { domainId });

    expect(result).not.toBeNull();
    expect(result!.domain.name).toBe("example.com");
    expect(result!.generatedAt).toBeGreaterThan(0);
    expect(result!.invariants.length).toBeGreaterThanOrEqual(1);
  });

  test("includes keyword and position stats", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { domainId } = await setupFullHierarchy(t, adminId);

    // Add active keyword with position
    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test kw",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 7,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordPositions", {
        keywordId,
        date: "2025-01-15",
        position: 7,
        url: "https://example.com/page",
        fetchedAt: Date.now(),
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDomainDiagnostic, { domainId });

    expect(result).not.toBeNull();
    expect(result!.domain.keywords.active).toBe(1);
    expect(result!.domain.crossValidation.monitoring.top10).toBe(1);
    expect(result!.domain.crossValidation.monitoring.avgPosition).toBe(7);
  });

  test("detects competitors without positions", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { domainId } = await setupFullHierarchy(t, adminId);

    // Add competitor with no position data
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDomainDiagnostic, { domainId });

    expect(result).not.toBeNull();
    expect(result!.domain.competitors.count).toBe(1);
    expect(result!.domain.competitors.withPositions).toBe(0);

    // Should have a warning invariant
    const warning = result!.invariants.find(
      (i: any) => i.name === "competitors_without_positions"
    );
    expect(warning).toBeDefined();
    expect(warning!.status).toBe("warning");
  });

  test("reports content gap stats", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { domainId } = await setupFullHierarchy(t, adminId);

    // Need a keyword and competitor for contentGaps FK
    const gapKeywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "gap kw",
        status: "active",
        createdAt: Date.now(),
      });
    });
    const competitorId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "comp.com",
        name: "Comp",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      const now = Date.now();
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId: gapKeywordId,
        competitorId,
        status: "identified",
        priority: "high",
        opportunityScore: 85,
        competitorPosition: 3,
        yourPosition: null,
        difficulty: 30,
        searchVolume: 1000,
        competitorUrl: "https://comp.com/page",
        estimatedTrafficValue: 500,
        identifiedAt: now,
        lastChecked: now,
      });
      await ctx.db.insert("contentGaps", {
        domainId,
        keywordId: gapKeywordId,
        competitorId,
        status: "dismissed",
        priority: "low",
        opportunityScore: 20,
        competitorPosition: 50,
        yourPosition: null,
        difficulty: 80,
        searchVolume: 100,
        competitorUrl: "https://comp.com/page2",
        estimatedTrafficValue: 10,
        identifiedAt: now,
        lastChecked: now,
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDomainDiagnostic, { domainId });

    expect(result).not.toBeNull();
    expect(result!.domain.contentGaps.total).toBe(2);
    expect(result!.domain.contentGaps.identified).toBe(1);
    expect(result!.domain.contentGaps.dismissed).toBe(1);
  });

  test("reports job stats", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { domainId } = await setupFullHierarchy(t, adminId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId,
        status: "completed",
        totalKeywords: 5,
        processedKeywords: 5,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
      await ctx.db.insert("keywordCheckJobs", {
        domainId,
        status: "pending",
        totalKeywords: 3,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.diagnostic.getDomainDiagnostic, { domainId });

    expect(result).not.toBeNull();
    expect(result!.domain.jobs.completed).toBe(1);
    expect(result!.domain.jobs.pending).toBe(1);
  });
});

// ===========================================================================
// getDiagnosticSnapshotInternal
// ===========================================================================

describe("diagnostic.getDiagnosticSnapshotInternal", () => {
  test("returns snapshot without auth (internal query)", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "User", "user@test.com");
    const { orgId } = await setupFullHierarchy(t, userId);

    const result = await t.run(async (ctx: any) => {
      const { getDiagnosticSnapshotInternal } = await import("./diagnostic");
      // Internal queries don't need auth - call via internal API
    });

    // Use the internal function reference
    const snapshot = await t.query(
      internal.diagnostic.getDiagnosticSnapshotInternal as any,
      { organizationId: orgId }
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot!.organization.name).toBe("Diag Org");
  });

  test("returns first org when no organizationId specified", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "User", "user@test.com");
    await setupFullHierarchy(t, userId);

    const snapshot = await t.query(
      internal.diagnostic.getDiagnosticSnapshotInternal as any,
      {}
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot!.organization.name).toBe("Diag Org");
  });

  test("returns null when no orgs exist", async () => {
    const t = convexTest(schema, modules);

    const snapshot = await t.query(
      internal.diagnostic.getDiagnosticSnapshotInternal as any,
      {}
    );

    expect(snapshot).toBeNull();
  });
});
