import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// isEnabled (internalQuery)
// ---------------------------------------------------------------------------

describe("isEnabled", () => {
  test("returns false when no setting exists", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(internal.debugLog.isEnabled, {});
    expect(result).toBe(false);
  });

  test("returns true when setting is 'true'", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("appSettings", { key: "debug_logging", value: "true" });
    });
    const result = await t.query(internal.debugLog.isEnabled, {});
    expect(result).toBe(true);
  });

  test("returns false when setting is 'false'", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("appSettings", { key: "debug_logging", value: "false" });
    });
    const result = await t.query(internal.debugLog.isEnabled, {});
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveLog (internalMutation)
// ---------------------------------------------------------------------------

describe("saveLog", () => {
  test("inserts a debug log entry", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.debugLog.saveLog, {
      action: "fetchPositions",
      step: "api_call",
      request: '{"keyword":"seo"}',
      response: '{"position":5}',
      durationMs: 123,
      status: "success",
    });

    const logs = await t.run(async (ctx) => {
      return ctx.db.query("debugLogs").collect();
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("fetchPositions");
    expect(logs[0].step).toBe("api_call");
    expect(logs[0].status).toBe("success");
    expect(logs[0].durationMs).toBe(123);
    expect(logs[0].createdAt).toBeGreaterThan(0);
  });

  test("truncates long request/response payloads", async () => {
    const t = convexTest(schema, modules);
    const longString = "x".repeat(10000);

    await t.mutation(internal.debugLog.saveLog, {
      action: "test",
      step: "step",
      request: longString,
      response: longString,
      durationMs: 1,
      status: "success",
    });

    const logs = await t.run(async (ctx) => {
      return ctx.db.query("debugLogs").collect();
    });
    expect(logs[0].request.length).toBeLessThan(10000);
    expect(logs[0].request).toContain("...[truncated]");
    expect(logs[0].response).toContain("...[truncated]");
  });

  test("stores optional domainId and error", async () => {
    const t = convexTest(schema, modules);

    // Create a domain to reference
    const projectId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org", slug: "org", createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
      const teamId = await ctx.db.insert("teams", { organizationId: orgId, name: "Team", createdAt: Date.now() });
      return ctx.db.insert("projects", { teamId, name: "P", createdAt: Date.now() });
    });
    const domainId = await t.run(async (ctx) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "test.com",
        createdAt: Date.now(),
        settings: { refreshFrequency: "weekly" as const, searchEngine: "google.com", location: "US", language: "en" },
      });
    });

    await t.mutation(internal.debugLog.saveLog, {
      domainId,
      action: "test",
      step: "step",
      request: "req",
      response: "res",
      durationMs: 50,
      status: "error",
      error: "Something failed",
    });

    const logs = await t.run(async (ctx) => {
      return ctx.db.query("debugLogs").collect();
    });
    expect(logs[0].domainId).toEqual(domainId);
    expect(logs[0].error).toBe("Something failed");
    expect(logs[0].status).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// getStatus (public query)
// ---------------------------------------------------------------------------

describe("getStatus", () => {
  test("returns false when no setting exists", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.debugLog.getStatus, {});
    expect(result).toBe(false);
  });

  test("returns true when debug logging enabled", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("appSettings", { key: "debug_logging", value: "true" });
    });
    const result = await t.query(api.debugLog.getStatus, {});
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggle (mutation)
// ---------------------------------------------------------------------------

describe("toggle", () => {
  test("creates setting when none exists and enables", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.debugLog.toggle, { enabled: true });

    const status = await t.query(api.debugLog.getStatus, {});
    expect(status).toBe(true);
  });

  test("updates existing setting to disabled", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("appSettings", { key: "debug_logging", value: "true" });
    });

    await t.mutation(api.debugLog.toggle, { enabled: false });

    const status = await t.query(api.debugLog.getStatus, {});
    expect(status).toBe(false);
  });

  test("toggles back and forth", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.debugLog.toggle, { enabled: true });
    expect(await t.query(api.debugLog.getStatus, {})).toBe(true);

    await t.mutation(api.debugLog.toggle, { enabled: false });
    expect(await t.query(api.debugLog.getStatus, {})).toBe(false);

    await t.mutation(api.debugLog.toggle, { enabled: true });
    expect(await t.query(api.debugLog.getStatus, {})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLogs (public query)
// ---------------------------------------------------------------------------

describe("getLogs", () => {
  test("returns empty array when no logs", async () => {
    const t = convexTest(schema, modules);
    const logs = await t.query(api.debugLog.getLogs, {});
    expect(logs).toHaveLength(0);
  });

  test("returns logs ordered descending by creation", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("debugLogs", {
        action: "a", step: "s", request: "r", response: "r",
        durationMs: 1, status: "success", createdAt: 1000,
      });
      await ctx.db.insert("debugLogs", {
        action: "b", step: "s", request: "r", response: "r",
        durationMs: 2, status: "success", createdAt: 2000,
      });
    });

    const logs = await t.query(api.debugLog.getLogs, {});
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe("b");
    expect(logs[1].action).toBe("a");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert("debugLogs", {
          action: "test", step: "s", request: "r", response: "r",
          durationMs: 1, status: "success", createdAt: i * 1000,
        });
      }
    });

    const logs = await t.query(api.debugLog.getLogs, { limit: 3 });
    expect(logs).toHaveLength(3);
  });

  test("filters by action", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("debugLogs", {
        action: "fetchPositions", step: "s", request: "r", response: "r",
        durationMs: 1, status: "success", createdAt: 1000,
      });
      await ctx.db.insert("debugLogs", {
        action: "fetchBacklinks", step: "s", request: "r", response: "r",
        durationMs: 1, status: "success", createdAt: 2000,
      });
    });

    const logs = await t.query(api.debugLog.getLogs, { action: "fetchPositions" });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("fetchPositions");
  });
});

// ---------------------------------------------------------------------------
// clearLogs (mutation)
// ---------------------------------------------------------------------------

describe("clearLogs", () => {
  test("deletes logs and returns count", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("debugLogs", {
          action: "test", step: "s", request: "r", response: "r",
          durationMs: 1, status: "success", createdAt: i * 1000,
        });
      }
    });

    const result = await t.mutation(api.debugLog.clearLogs, {});
    expect(result.deleted).toBe(5);

    const remaining = await t.query(api.debugLog.getLogs, {});
    expect(remaining).toHaveLength(0);
  });

  test("returns zero when no logs exist", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.debugLog.clearLogs, {});
    expect(result.deleted).toBe(0);
  });
});
