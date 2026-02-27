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

async function setupDomain(t: any) {
  const ids = await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", {
      email: "test@example.com",
      emailVerificationTime: Date.now(),
    });
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner" as const,
      joinedAt: Date.now(),
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
      domain: "example.com",
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
    return { userId, domainId };
  });
  const asUser = t.withIdentity({ subject: ids.userId });
  return { domainId: ids.domainId, asUser };
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function insertVelocityRecord(
  t: any,
  domainId: any,
  daysAgo: number,
  newBl: number,
  lostBl: number,
  total = 100,
) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("backlinkVelocityHistory", {
      domainId,
      date: dateStr(daysAgo),
      newBacklinks: newBl,
      lostBacklinks: lostBl,
      netChange: newBl - lostBl,
      totalBacklinks: total,
      createdAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// getVelocityHistory
// ---------------------------------------------------------------------------

describe("getVelocityHistory", () => {
  test("returns empty for domain with no history", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);
    const result = await asUser.query(api.backlinkVelocity.getVelocityHistory, {
      domainId,
    });
    expect(result).toEqual([]);
  });

  test("returns records within the requested days window", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    await insertVelocityRecord(t, domainId, 5, 10, 2);
    await insertVelocityRecord(t, domainId, 15, 8, 3);
    await insertVelocityRecord(t, domainId, 45, 20, 5); // outside 30-day window

    const result = await asUser.query(api.backlinkVelocity.getVelocityHistory, {
      domainId,
      days: 30,
    });

    expect(result.length).toBe(2);
    // Should be sorted by date ascending
    expect(result[0].date <= result[1].date).toBe(true);
  });

  test("respects custom days parameter", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    await insertVelocityRecord(t, domainId, 3, 5, 1);
    await insertVelocityRecord(t, domainId, 8, 7, 2);

    const result7 = await asUser.query(api.backlinkVelocity.getVelocityHistory, {
      domainId,
      days: 7,
    });
    expect(result7.length).toBe(1);

    const result14 = await asUser.query(api.backlinkVelocity.getVelocityHistory, {
      domainId,
      days: 14,
    });
    expect(result14.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getVelocityStats
// ---------------------------------------------------------------------------

describe("getVelocityStats", () => {
  test("returns zeros for empty history", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);
    const stats = await asUser.query(api.backlinkVelocity.getVelocityStats, {
      domainId,
    });
    expect(stats.avgNewPerDay).toBe(0);
    expect(stats.avgLostPerDay).toBe(0);
    expect(stats.totalNew).toBe(0);
    expect(stats.totalLost).toBe(0);
    expect(stats.daysTracked).toBe(0);
  });

  test("calculates correct averages and totals", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    await insertVelocityRecord(t, domainId, 1, 10, 2);
    await insertVelocityRecord(t, domainId, 2, 20, 4);
    await insertVelocityRecord(t, domainId, 3, 6, 0);

    const stats = await asUser.query(api.backlinkVelocity.getVelocityStats, {
      domainId,
      days: 30,
    });

    expect(stats.totalNew).toBe(36);
    expect(stats.totalLost).toBe(6);
    expect(stats.netChange).toBe(30);
    expect(stats.daysTracked).toBe(3);
    expect(stats.avgNewPerDay).toBe(12);
    expect(stats.avgLostPerDay).toBe(2);
    expect(stats.avgNetChange).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// detectVelocityAnomalies
// ---------------------------------------------------------------------------

describe("detectVelocityAnomalies", () => {
  test("returns empty when fewer than 3 data points", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    await insertVelocityRecord(t, domainId, 1, 5, 2);
    await insertVelocityRecord(t, domainId, 2, 6, 1);

    const anomalies = await asUser.query(api.backlinkVelocity.detectVelocityAnomalies, {
      domainId,
    });
    expect(anomalies).toEqual([]);
  });

  test("detects spikes in backlink velocity", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    // Normal days: ~10 net change
    for (let i = 1; i <= 10; i++) {
      await insertVelocityRecord(t, domainId, i, 12, 2);
    }
    // Spike day: 200 new
    await insertVelocityRecord(t, domainId, 0, 200, 2);

    const anomalies = await asUser.query(api.backlinkVelocity.detectVelocityAnomalies, {
      domainId,
      days: 30,
    });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    const spike = anomalies.find((a: any) => a.type === "spike");
    expect(spike).toBeDefined();
    expect(spike!.newBacklinks).toBe(200);
  });

  test("returns empty when all data points are identical", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    for (let i = 1; i <= 5; i++) {
      await insertVelocityRecord(t, domainId, i, 10, 5);
    }

    const anomalies = await asUser.query(api.backlinkVelocity.detectVelocityAnomalies, {
      domainId,
    });
    // All same => stdDev = 0 => zScore = 0 => no anomalies
    expect(anomalies).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveDailyVelocity (internalMutation)
// ---------------------------------------------------------------------------

describe("saveDailyVelocity", () => {
  test("creates a new velocity record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    const result = await t.mutation(internal.backlinkVelocity.saveDailyVelocity, {
      domainId,
      date: "2025-01-15",
      newBacklinks: 15,
      lostBacklinks: 3,
      totalBacklinks: 200,
    });

    expect(result).toEqual({ created: true });

    const records = await t.run(async (ctx: any) => {
      return ctx.db
        .query("backlinkVelocityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(records.length).toBe(1);
    expect(records[0].newBacklinks).toBe(15);
    expect(records[0].lostBacklinks).toBe(3);
    expect(records[0].netChange).toBe(12);
    expect(records[0].totalBacklinks).toBe(200);
  });

  test("updates existing record for same date", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    await t.mutation(internal.backlinkVelocity.saveDailyVelocity, {
      domainId,
      date: "2025-01-15",
      newBacklinks: 10,
      lostBacklinks: 2,
      totalBacklinks: 100,
    });

    const result = await t.mutation(internal.backlinkVelocity.saveDailyVelocity, {
      domainId,
      date: "2025-01-15",
      newBacklinks: 20,
      lostBacklinks: 5,
      totalBacklinks: 115,
    });

    expect(result).toEqual({ updated: true });

    const records = await t.run(async (ctx: any) => {
      return ctx.db
        .query("backlinkVelocityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(records.length).toBe(1);
    expect(records[0].newBacklinks).toBe(20);
    expect(records[0].netChange).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// recalculateVelocityHistory (internalMutation)
// ---------------------------------------------------------------------------

describe("recalculateVelocityHistory", () => {
  test("rebuilds velocity from backlink firstSeen/lastSeen dates", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    // Insert some backlinks with firstSeen dates
    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinks", {
        domainId,
        urlFrom: "https://a.com/1",
        urlTo: "https://example.com/page",
        firstSeen: "2025-01-10",
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("domainBacklinks", {
        domainId,
        urlFrom: "https://b.com/1",
        urlTo: "https://example.com/page",
        firstSeen: "2025-01-10",
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("domainBacklinks", {
        domainId,
        urlFrom: "https://c.com/1",
        urlTo: "https://example.com/other",
        firstSeen: "2025-01-12",
        isLost: true,
        lastSeen: "2025-01-15",
        fetchedAt: Date.now(),
      });
    });

    const result = await t.mutation(internal.backlinkVelocity.recalculateVelocityHistory, {
      domainId,
    });

    expect(result.backlinksAnalyzed).toBe(3);
    expect(result.inserted).toBeGreaterThanOrEqual(2); // At least dates 2025-01-10 and 2025-01-12

    // Verify records
    const records = await t.run(async (ctx: any) => {
      return ctx.db
        .query("backlinkVelocityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    // 2025-01-10 should have 2 new
    const jan10 = records.find((r: any) => r.date === "2025-01-10");
    expect(jan10).toBeDefined();
    expect(jan10!.newBacklinks).toBe(2);

    // 2025-01-12 should have 1 new
    const jan12 = records.find((r: any) => r.date === "2025-01-12");
    expect(jan12).toBeDefined();
    expect(jan12!.newBacklinks).toBe(1);

    // 2025-01-15 should have 1 lost
    const jan15 = records.find((r: any) => r.date === "2025-01-15");
    expect(jan15).toBeDefined();
    expect(jan15!.lostBacklinks).toBe(1);
  });

  test("clears existing velocity records before rebuilding", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    // Insert old velocity record
    await insertVelocityRecord(t, domainId, 5, 99, 99);

    // Insert a backlink
    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinks", {
        domainId,
        urlFrom: "https://x.com/1",
        urlTo: "https://example.com/page",
        firstSeen: dateStr(2),
        fetchedAt: Date.now(),
      });
    });

    await t.mutation(internal.backlinkVelocity.recalculateVelocityHistory, {
      domainId,
    });

    const records = await t.run(async (ctx: any) => {
      return ctx.db
        .query("backlinkVelocityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    // Old record (99/99) should be gone
    const hasOld = records.some((r: any) => r.newBacklinks === 99);
    expect(hasOld).toBe(false);
    expect(records.length).toBe(1);
    expect(records[0].newBacklinks).toBe(1);
  });

  test("uses summary totalBacklinks when available", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupDomain(t);

    // Insert summary
    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId,
        totalBacklinks: 500,
        totalDomains: 100,
        totalIps: 80,
        totalSubnets: 50,
        dofollow: 400,
        nofollow: 100,
        fetchedAt: Date.now(),
      });
    });

    // Insert a backlink
    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinks", {
        domainId,
        urlFrom: "https://a.com/1",
        urlTo: "https://example.com/page",
        firstSeen: "2025-02-01",
        fetchedAt: Date.now(),
      });
    });

    await t.mutation(internal.backlinkVelocity.recalculateVelocityHistory, {
      domainId,
    });

    const records = await t.run(async (ctx: any) => {
      return ctx.db
        .query("backlinkVelocityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(records[0].totalBacklinks).toBe(500);
  });
});
