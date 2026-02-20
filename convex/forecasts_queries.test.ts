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

async function setupDomain(t: any, projectId: string, domain = "example.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

// ===========================================================================
// getForecast
// ===========================================================================

describe("forecasts_queries.getForecast", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.forecasts_queries.getForecast, {
      entityType: "domain",
      entityId: "fake-id",
      metric: "traffic",
    });
    expect(result).toBeNull();
  });

  test("returns the latest forecast for a domain+metric", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    // Insert two forecasts — older and newer
    await t.run(async (ctx: any) => {
      await ctx.db.insert("forecasts", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        generatedAt: 1000,
        predictions: [{ date: "2025-01-01", value: 100, confidenceLower: 80, confidenceUpper: 120 }],
        accuracy: { r2: 0.9, rmse: 5, confidenceLevel: "high" },
      });
      await ctx.db.insert("forecasts", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        generatedAt: 2000,
        predictions: [{ date: "2025-02-01", value: 200, confidenceLower: 170, confidenceUpper: 230 }],
        accuracy: { r2: 0.95, rmse: 3, confidenceLevel: "high" },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const forecast = await asUser.query(api.forecasts_queries.getForecast, {
      entityType: "domain",
      entityId: domainId,
      metric: "traffic",
    });

    expect(forecast).not.toBeNull();
    // The latest forecast (desc order) should have generatedAt=2000
    expect(forecast!.generatedAt).toBe(2000);
    expect(forecast!.predictions[0].value).toBe(200);
  });

  test("returns null when no forecast exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const forecast = await asUser.query(api.forecasts_queries.getForecast, {
      entityType: "domain",
      entityId: domainId,
      metric: "traffic",
    });
    expect(forecast).toBeNull();
  });

  test("returns forecast for a keyword entity", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("forecasts", {
        entityType: "keyword",
        entityId: keywordId,
        metric: "position",
        generatedAt: 5000,
        predictions: [{ date: "2025-03-01", value: 5, confidenceLower: 3, confidenceUpper: 8 }],
        accuracy: { r2: 0.85, rmse: 2, confidenceLevel: "medium" },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const forecast = await asUser.query(api.forecasts_queries.getForecast, {
      entityType: "keyword",
      entityId: keywordId,
      metric: "position",
    });

    expect(forecast).not.toBeNull();
    expect(forecast!.metric).toBe("position");
    expect(forecast!.predictions[0].value).toBe(5);
  });
});

// ===========================================================================
// getAnomalies
// ===========================================================================

describe("forecasts_queries.getAnomalies", () => {
  test("returns anomalies for a domain", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 1000,
        date: "2025-01-01",
        type: "drop",
        severity: "high",
        value: 50,
        expectedValue: 100,
        zScore: 3.5,
        description: "Traffic dropped significantly",
        resolved: false,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const anomalies = await asUser.query(api.forecasts_queries.getAnomalies, {
      domainId,
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].metric).toBe("traffic");
    expect(anomalies[0].severity).toBe("high");
  });

  test("filters by severity", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 1000,
        date: "2025-01-01",
        type: "drop",
        severity: "high",
        value: 50,
        expectedValue: 100,
        zScore: 3.5,
        description: "High severity",
        resolved: false,
      });
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "backlinks",
        detectedAt: 2000,
        date: "2025-01-02",
        type: "spike",
        severity: "low",
        value: 150,
        expectedValue: 100,
        zScore: 2.0,
        description: "Low severity",
        resolved: false,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const highOnly = await asUser.query(api.forecasts_queries.getAnomalies, {
      domainId,
      severity: "high",
    });

    expect(highOnly).toHaveLength(1);
    expect(highOnly[0].severity).toBe("high");
  });

  test("filters by resolved status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 1000,
        date: "2025-01-01",
        type: "drop",
        severity: "medium",
        value: 70,
        expectedValue: 100,
        zScore: 2.5,
        description: "Unresolved",
        resolved: false,
      });
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "backlinks",
        detectedAt: 2000,
        date: "2025-01-02",
        type: "spike",
        severity: "low",
        value: 150,
        expectedValue: 100,
        zScore: 2.0,
        description: "Resolved",
        resolved: true,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const unresolved = await asUser.query(api.forecasts_queries.getAnomalies, {
      domainId,
      resolved: false,
    });

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].resolved).toBe(false);
  });

  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const anomalies = await t.query(api.forecasts_queries.getAnomalies, {
      domainId: "fake-id",
    });
    expect(anomalies).toEqual([]);
  });

  test("sorts anomalies by detectedAt descending", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 1000,
        date: "2025-01-01",
        type: "drop",
        severity: "high",
        value: 50,
        expectedValue: 100,
        zScore: 3.5,
        description: "Older anomaly",
        resolved: false,
      });
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "backlinks",
        detectedAt: 3000,
        date: "2025-01-03",
        type: "spike",
        severity: "medium",
        value: 200,
        expectedValue: 100,
        zScore: 4.0,
        description: "Newer anomaly",
        resolved: false,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const anomalies = await asUser.query(api.forecasts_queries.getAnomalies, {
      domainId,
    });

    expect(anomalies).toHaveLength(2);
    expect(anomalies[0].detectedAt).toBe(3000);
    expect(anomalies[1].detectedAt).toBe(1000);
  });
});

// ===========================================================================
// getAnomalySummary
// ===========================================================================

describe("forecasts_queries.getAnomalySummary", () => {
  test("returns correct counts by severity", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    await t.run(async (ctx: any) => {
      // 2 high, 1 medium unresolved + 1 resolved (should be excluded)
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 1000,
        date: "2025-01-01",
        type: "drop",
        severity: "high",
        value: 50,
        expectedValue: 100,
        zScore: 3.5,
        description: "High 1",
        resolved: false,
      });
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "backlinks",
        detectedAt: 2000,
        date: "2025-01-02",
        type: "drop",
        severity: "high",
        value: 30,
        expectedValue: 100,
        zScore: 4.0,
        description: "High 2",
        resolved: false,
      });
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 3000,
        date: "2025-01-03",
        type: "spike",
        severity: "medium",
        value: 150,
        expectedValue: 100,
        zScore: 2.5,
        description: "Medium 1",
        resolved: false,
      });
      // Resolved — should be excluded from summary
      await ctx.db.insert("anomalies", {
        entityType: "domain",
        entityId: domainId,
        metric: "traffic",
        detectedAt: 4000,
        date: "2025-01-04",
        type: "drop",
        severity: "low",
        value: 90,
        expectedValue: 100,
        zScore: 1.5,
        description: "Resolved low",
        resolved: true,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(api.forecasts_queries.getAnomalySummary, {
      domainId,
    });

    expect(summary.total).toBe(3);
    expect(summary.high).toBe(2);
    expect(summary.medium).toBe(1);
    expect(summary.low).toBe(0);
  });

  test("returns zeros when no anomalies exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const summary = await asUser.query(api.forecasts_queries.getAnomalySummary, {
      domainId,
    });

    expect(summary).toEqual({ total: 0, high: 0, medium: 0, low: 0 });
  });

  test("returns zeros for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const summary = await t.query(api.forecasts_queries.getAnomalySummary, {
      domainId: "fake-id",
    });
    expect(summary).toEqual({ total: 0, high: 0, medium: 0, low: 0 });
  });
});
