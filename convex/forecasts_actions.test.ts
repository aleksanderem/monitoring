import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ===========================================================================
// calculateLinearRegression
// ===========================================================================

describe("forecasts_actions.calculateLinearRegression", () => {
  test("computes correct regression for a simple linear dataset", async () => {
    const t = convexTest(schema, modules);

    // y = 2x + 1 (perfect linear data: day 0→1, day 1→3, day 2→5, day 3→7)
    const result = await t.action(api.forecasts_actions.calculateLinearRegression, {
      dataPoints: [
        { date: "2026-01-01", value: 1 },
        { date: "2026-01-02", value: 3 },
        { date: "2026-01-03", value: 5 },
        { date: "2026-01-04", value: 7 },
      ],
    });

    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(1, 5);
    expect(result.r2).toBeCloseTo(1, 5); // Perfect fit
    expect(result.rmse).toBeCloseTo(0, 5);
    expect(result.standardError).toBeCloseTo(0, 5);
    expect(result.firstDate).toBe("2026-01-01");
  });

  test("computes correct regression for noisy data", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.forecasts_actions.calculateLinearRegression, {
      dataPoints: [
        { date: "2026-01-01", value: 10 },
        { date: "2026-01-02", value: 12 },
        { date: "2026-01-03", value: 9 },
        { date: "2026-01-04", value: 14 },
        { date: "2026-01-05", value: 11 },
        { date: "2026-01-06", value: 15 },
      ],
    });

    // Should have positive slope (general upward trend)
    expect(result.slope).toBeGreaterThan(0);
    // R2 should be between 0 and 1
    expect(result.r2).toBeGreaterThanOrEqual(0);
    expect(result.r2).toBeLessThanOrEqual(1);
    // RMSE should be > 0 for noisy data
    expect(result.rmse).toBeGreaterThan(0);
    expect(result.standardError).toBeGreaterThan(0);
  });

  test("throws with fewer than 2 data points", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.forecasts_actions.calculateLinearRegression, {
        dataPoints: [{ date: "2026-01-01", value: 5 }],
      })
    ).rejects.toThrow("Need at least 2 data points");
  });

  test("handles constant values (zero variance in x is avoided by dates)", async () => {
    const t = convexTest(schema, modules);

    // All same y-values → slope should be 0
    const result = await t.action(api.forecasts_actions.calculateLinearRegression, {
      dataPoints: [
        { date: "2026-01-01", value: 5 },
        { date: "2026-01-02", value: 5 },
        { date: "2026-01-03", value: 5 },
      ],
    });

    expect(result.slope).toBeCloseTo(0, 5);
    expect(result.intercept).toBeCloseTo(5, 5);
    expect(result.rmse).toBeCloseTo(0, 5);
  });

  test("handles negative slope (decreasing trend)", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.forecasts_actions.calculateLinearRegression, {
      dataPoints: [
        { date: "2026-01-01", value: 50 },
        { date: "2026-01-02", value: 40 },
        { date: "2026-01-03", value: 30 },
        { date: "2026-01-04", value: 20 },
      ],
    });

    expect(result.slope).toBeCloseTo(-10, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });

  test("handles dates with gaps", async () => {
    const t = convexTest(schema, modules);

    // Days: 0, 7, 14 (weekly intervals)
    const result = await t.action(api.forecasts_actions.calculateLinearRegression, {
      dataPoints: [
        { date: "2026-01-01", value: 10 },
        { date: "2026-01-08", value: 17 },
        { date: "2026-01-15", value: 24 },
      ],
    });

    // slope should be 1 per day (7 increase per 7 days)
    expect(result.slope).toBeCloseTo(1, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });
});

// ===========================================================================
// generateKeywordForecast (action that calls external APIs — test graceful error)
// ===========================================================================

describe("forecasts_actions.generateKeywordForecast", () => {
  test("throws when keyword has no history (runAction to getKeywordWithHistory fails)", async () => {
    const t = convexTest(schema, modules);

    // Create a minimal keyword record
    const keywordId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      const projectId = await ctx.db.insert("projects", {
        teamId,
        name: "Project",
        createdAt: Date.now(),
      });
      const domainId = await ctx.db.insert("domains", {
        projectId,
        domain: "test.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
      return await ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        status: "active",
        createdAt: Date.now(),
      } as any);
    });

    // The action calls getKeywordWithHistory which needs Supabase or will fail
    await expect(
      t.action(api.forecasts_actions.generateKeywordForecast, {
        keywordId,
        metric: "position",
        daysToForecast: 30,
      })
    ).rejects.toThrow();
  });
});

// ===========================================================================
// detectAnomaliesForEntity (action — test graceful error for missing data)
// ===========================================================================

describe("forecasts_actions.detectAnomaliesForEntity", () => {
  test("returns 0 anomalies for domain backlinks entity type (not implemented)", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.forecasts_actions.detectAnomaliesForEntity, {
      entityType: "domain",
      entityId: "some-domain-id",
      metric: "backlinks",
    });

    expect(result.anomaliesDetected).toBe(0);
  });
});

// ===========================================================================
// generateDomainForecasts (action — test with empty keywords)
// ===========================================================================

describe("forecasts_actions.generateDomainForecasts", () => {
  test("returns success with zero counts when domain has no keywords", async () => {
    const t = convexTest(schema, modules);

    const domainId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      const projectId = await ctx.db.insert("projects", {
        teamId,
        name: "Project",
        createdAt: Date.now(),
      });
      return await ctx.db.insert("domains", {
        projectId,
        domain: "empty.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
    });

    const result = await t.action(api.forecasts_actions.generateDomainForecasts, {
      domainId,
    });

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ===========================================================================
// detectDomainAnomalies (action — test with empty keywords)
// ===========================================================================

describe("forecasts_actions.detectDomainAnomalies", () => {
  test("returns success with zero anomalies when domain has no keywords", async () => {
    const t = convexTest(schema, modules);

    const domainId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      const projectId = await ctx.db.insert("projects", {
        teamId,
        name: "Project",
        createdAt: Date.now(),
      });
      return await ctx.db.insert("domains", {
        projectId,
        domain: "empty.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
    });

    const result = await t.action(api.forecasts_actions.detectDomainAnomalies, {
      domainId,
    });

    expect(result.success).toBe(true);
    expect(result.totalAnomalies).toBe(0);
    expect(result.processedKeywords).toBe(0);
  });
});
