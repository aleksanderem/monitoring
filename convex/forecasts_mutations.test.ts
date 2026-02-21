import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePredictions(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    value: 5 + i,
    confidenceLower: 3 + i,
    confidenceUpper: 7 + i,
  }));
}

const DEFAULT_ACCURACY = {
  r2: 0.92,
  rmse: 1.5,
  confidenceLevel: "high",
};

function makeAnomalyArgs(overrides: Record<string, unknown> = {}) {
  return {
    entityType: "keyword" as const,
    entityId: "kw-123",
    metric: "position",
    date: "2026-02-15",
    type: "spike" as const,
    severity: "high" as const,
    value: 42,
    expectedValue: 10,
    zScore: 3.2,
    description: "Unexpected spike in position",
    ...overrides,
  };
}

// ===========================================================================
// generateForecast
// ===========================================================================

describe("forecasts_mutations.generateForecast", () => {
  test("stores a forecast and it is retrievable from the DB", async () => {
    const t = convexTest(schema, modules);

    const forecastId = await t.mutation(
      api.forecasts_mutations.generateForecast,
      {
        entityType: "keyword",
        entityId: "kw-001",
        metric: "position",
        predictions: makePredictions(),
        accuracy: DEFAULT_ACCURACY,
      }
    );

    expect(forecastId).toBeTruthy();

    const forecast = await t.run(async (ctx: any) => ctx.db.get(forecastId));
    expect(forecast).not.toBeNull();
    expect(forecast!.entityType).toBe("keyword");
    expect(forecast!.entityId).toBe("kw-001");
    expect(forecast!.metric).toBe("position");
    expect(forecast!.predictions).toHaveLength(3);
    expect(forecast!.accuracy.r2).toBe(0.92);
    expect(forecast!.generatedAt).toBeGreaterThan(0);
  });

  test("replaces existing forecast for same entity+metric", async () => {
    const t = convexTest(schema, modules);

    const firstId = await t.mutation(
      api.forecasts_mutations.generateForecast,
      {
        entityType: "keyword",
        entityId: "kw-001",
        metric: "position",
        predictions: makePredictions(2),
        accuracy: { r2: 0.8, rmse: 2.0, confidenceLevel: "medium" },
      }
    );

    const secondId = await t.mutation(
      api.forecasts_mutations.generateForecast,
      {
        entityType: "keyword",
        entityId: "kw-001",
        metric: "position",
        predictions: makePredictions(5),
        accuracy: DEFAULT_ACCURACY,
      }
    );

    // First forecast should be deleted
    const first = await t.run(async (ctx: any) => ctx.db.get(firstId));
    expect(first).toBeNull();

    // Second forecast should exist with the new data
    const second = await t.run(async (ctx: any) => ctx.db.get(secondId));
    expect(second).not.toBeNull();
    expect(second!.predictions).toHaveLength(5);
    expect(second!.accuracy.r2).toBe(0.92);
  });

  test("stores different metrics for same entity independently", async () => {
    const t = convexTest(schema, modules);

    const positionId = await t.mutation(
      api.forecasts_mutations.generateForecast,
      {
        entityType: "domain",
        entityId: "dom-001",
        metric: "position",
        predictions: makePredictions(2),
        accuracy: DEFAULT_ACCURACY,
      }
    );

    const trafficId = await t.mutation(
      api.forecasts_mutations.generateForecast,
      {
        entityType: "domain",
        entityId: "dom-001",
        metric: "traffic",
        predictions: makePredictions(4),
        accuracy: { r2: 0.75, rmse: 3.0, confidenceLevel: "medium" },
      }
    );

    // Both should exist
    const position = await t.run(async (ctx: any) => ctx.db.get(positionId));
    const traffic = await t.run(async (ctx: any) => ctx.db.get(trafficId));
    expect(position).not.toBeNull();
    expect(traffic).not.toBeNull();
    expect(position!.metric).toBe("position");
    expect(traffic!.metric).toBe("traffic");
    expect(position!.predictions).toHaveLength(2);
    expect(traffic!.predictions).toHaveLength(4);
  });

  test("generatedAt timestamp is set to current time", async () => {
    const t = convexTest(schema, modules);
    const before = Date.now();

    const forecastId = await t.mutation(
      api.forecasts_mutations.generateForecast,
      {
        entityType: "keyword",
        entityId: "kw-time",
        metric: "position",
        predictions: makePredictions(1),
        accuracy: DEFAULT_ACCURACY,
      }
    );

    const after = Date.now();
    const forecast = await t.run(async (ctx: any) => ctx.db.get(forecastId));
    expect(forecast!.generatedAt).toBeGreaterThanOrEqual(before);
    expect(forecast!.generatedAt).toBeLessThanOrEqual(after);
  });
});

// ===========================================================================
// createAnomaly
// ===========================================================================

describe("forecasts_mutations.createAnomaly", () => {
  test("creates an anomaly and verifies all fields", async () => {
    const t = convexTest(schema, modules);

    const anomalyId = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs()
    );

    expect(anomalyId).toBeTruthy();

    const anomaly = await t.run(async (ctx: any) => ctx.db.get(anomalyId));
    expect(anomaly).not.toBeNull();
    expect(anomaly!.entityType).toBe("keyword");
    expect(anomaly!.entityId).toBe("kw-123");
    expect(anomaly!.metric).toBe("position");
    expect(anomaly!.date).toBe("2026-02-15");
    expect(anomaly!.type).toBe("spike");
    expect(anomaly!.severity).toBe("high");
    expect(anomaly!.value).toBe(42);
    expect(anomaly!.expectedValue).toBe(10);
    expect(anomaly!.zScore).toBe(3.2);
    expect(anomaly!.description).toBe("Unexpected spike in position");
    expect(anomaly!.resolved).toBe(false);
    expect(anomaly!.detectedAt).toBeGreaterThan(0);
  });

  test("updates existing anomaly for same entity+metric+date", async () => {
    const t = convexTest(schema, modules);

    const firstId = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs({ value: 42, severity: "high" })
    );

    const secondId = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs({ value: 99, severity: "low", description: "Updated" })
    );

    // Should return the same ID (updated in place)
    expect(secondId).toEqual(firstId);

    const anomaly = await t.run(async (ctx: any) => ctx.db.get(firstId));
    expect(anomaly!.value).toBe(99);
    expect(anomaly!.severity).toBe("low");
    expect(anomaly!.description).toBe("Updated");
  });

  test("creates separate anomalies for different dates", async () => {
    const t = convexTest(schema, modules);

    const id1 = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs({ date: "2026-02-15" })
    );

    const id2 = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs({ date: "2026-02-16" })
    );

    expect(id1).not.toEqual(id2);

    const a1 = await t.run(async (ctx: any) => ctx.db.get(id1));
    const a2 = await t.run(async (ctx: any) => ctx.db.get(id2));
    expect(a1).not.toBeNull();
    expect(a2).not.toBeNull();
    expect(a1!.date).toBe("2026-02-15");
    expect(a2!.date).toBe("2026-02-16");
  });

  test("creates multiple anomalies for different entities", async () => {
    const t = convexTest(schema, modules);

    const ids = [];
    for (const entityId of ["kw-1", "kw-2", "kw-3"]) {
      const id = await t.mutation(
        api.forecasts_mutations.createAnomaly,
        makeAnomalyArgs({ entityId })
      );
      ids.push(id);
    }

    // All IDs should be unique
    const uniqueIds = new Set(ids.map((id) => String(id)));
    expect(uniqueIds.size).toBe(3);

    // All should exist in the DB
    for (const id of ids) {
      const anomaly = await t.run(async (ctx: any) => ctx.db.get(id));
      expect(anomaly).not.toBeNull();
    }
  });
});

// ===========================================================================
// resolveAnomaly
// ===========================================================================

describe("forecasts_mutations.resolveAnomaly", () => {
  test("marks an anomaly as resolved", async () => {
    const t = convexTest(schema, modules);

    const anomalyId = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs()
    );

    // Verify it starts unresolved
    const before = await t.run(async (ctx: any) => ctx.db.get(anomalyId));
    expect(before!.resolved).toBe(false);

    const result = await t.mutation(
      api.forecasts_mutations.resolveAnomaly,
      { anomalyId }
    );

    expect(result).toEqual({ success: true });

    const after = await t.run(async (ctx: any) => ctx.db.get(anomalyId));
    expect(after!.resolved).toBe(true);
  });

  test("resolving an already-resolved anomaly stays resolved", async () => {
    const t = convexTest(schema, modules);

    const anomalyId = await t.mutation(
      api.forecasts_mutations.createAnomaly,
      makeAnomalyArgs()
    );

    // Resolve twice
    await t.mutation(api.forecasts_mutations.resolveAnomaly, { anomalyId });
    await t.mutation(api.forecasts_mutations.resolveAnomaly, { anomalyId });

    const anomaly = await t.run(async (ctx: any) => ctx.db.get(anomalyId));
    expect(anomaly!.resolved).toBe(true);
  });
});
