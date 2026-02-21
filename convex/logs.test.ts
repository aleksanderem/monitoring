import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create a user and return the ID.
 */
async function createUser(t: ReturnType<typeof convexTest>, name: string, email: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name, email } as any);
  });
}

/**
 * Helper: make a user a super admin.
 */
async function makeSuperAdmin(t: ReturnType<typeof convexTest>, userId: any, grantedBy?: any) {
  await t.run(async (ctx) => {
    await ctx.db.insert("superAdmins", {
      userId,
      grantedBy,
      grantedAt: Date.now(),
    });
  });
}

/**
 * Helper: create full hierarchy for auth (user -> org -> orgMember -> team -> teamMember -> project -> domain).
 */
async function setupTestHierarchy(t: ReturnType<typeof convexTest>) {
  const userId = await createUser(t, "Test User", "test@example.com");

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Test Team",
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: "mysite.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  const asUser = t.withIdentity({ subject: userId });
  return { userId, orgId, teamId, projectId, domainId, asUser };
}

/**
 * Helper: insert a system log entry directly.
 */
async function insertLog(
  t: ReturnType<typeof convexTest>,
  data: {
    level: "info" | "warning" | "error";
    message: string;
    eventType: string;
    userId?: any;
    createdAt?: number;
    stackTrace?: string;
    ipAddress?: string;
    requestMetadata?: any;
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("systemLogs", {
      level: data.level,
      message: data.message,
      eventType: data.eventType,
      userId: data.userId,
      createdAt: data.createdAt ?? Date.now(),
      stackTrace: data.stackTrace,
      ipAddress: data.ipAddress,
      requestMetadata: data.requestMetadata,
    });
  });
}

// =============================================
// getSystemLogs
// =============================================

describe("getSystemLogs", () => {
  test("returns empty logs for non-super-admin", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupTestHierarchy(t);

    const result = await asUser.query(api.logs.getSystemLogs, {});
    expect(result.logs).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test("returns empty logs for unauthenticated user", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.logs.getSystemLogs, {});
    expect(result.logs).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  test("returns logs for super admin", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, { level: "error", message: "Test error", eventType: "api_error", createdAt: Date.now() });
    await insertLog(t, { level: "info", message: "Test info", eventType: "crawl_completed", createdAt: Date.now() - 1000 });

    const result = await asUser.query(api.logs.getSystemLogs, {});
    expect(result.logs).toHaveLength(2);
    // Ordered desc by creation
    expect(result.logs[0].level).toBe("error");
    expect(result.logs[1].level).toBe("info");
  });

  test("filters by level", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, { level: "error", message: "Error 1", eventType: "api_error" });
    await insertLog(t, { level: "warning", message: "Warning 1", eventType: "limit_warning" });
    await insertLog(t, { level: "info", message: "Info 1", eventType: "crawl_completed" });

    const result = await asUser.query(api.logs.getSystemLogs, { level: "error" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].message).toBe("Error 1");
  });

  test("filters by eventType", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, { level: "error", message: "API Error", eventType: "api_error" });
    await insertLog(t, { level: "error", message: "DB Error", eventType: "database_error" });

    const result = await asUser.query(api.logs.getSystemLogs, { eventType: "api_error" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].message).toBe("API Error");
  });

  test("filters by userId", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    const otherUserId = await createUser(t, "Other User", "other@example.com");

    await insertLog(t, { level: "info", message: "By user", eventType: "keyword_import", userId });
    await insertLog(t, { level: "info", message: "By other", eventType: "keyword_import", userId: otherUserId });
    await insertLog(t, { level: "info", message: "No user", eventType: "system_event" });

    const result = await asUser.query(api.logs.getSystemLogs, { userId });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].message).toBe("By user");
  });

  test("filters by searchQuery in message", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, { level: "error", message: "Failed to fetch backlink profile", eventType: "api_error" });
    await insertLog(t, { level: "info", message: "Crawl completed successfully", eventType: "crawl_completed" });

    const result = await asUser.query(api.logs.getSystemLogs, { searchQuery: "backlink" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].message).toContain("backlink");
  });

  test("filters by searchQuery in stackTrace", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, {
      level: "error",
      message: "Generic error",
      eventType: "api_error",
      stackTrace: "Error at DataForSEOClient.fetchBacklinks line 45",
    });
    await insertLog(t, { level: "info", message: "Normal log", eventType: "info" });

    const result = await asUser.query(api.logs.getSystemLogs, { searchQuery: "fetchBacklinks" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].stackTrace).toContain("fetchBacklinks");
  });

  test("filters by date range", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    await insertLog(t, { level: "info", message: "Old log", eventType: "info", createdAt: now - 3 * oneDay });
    await insertLog(t, { level: "info", message: "Recent log", eventType: "info", createdAt: now - oneDay });
    await insertLog(t, { level: "info", message: "Today log", eventType: "info", createdAt: now });

    const result = await asUser.query(api.logs.getSystemLogs, {
      dateFrom: now - 2 * oneDay,
      dateTo: now,
    });
    expect(result.logs).toHaveLength(2);
  });

  test("respects limit and hasMore", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    for (let i = 0; i < 5; i++) {
      await insertLog(t, {
        level: "info",
        message: `Log ${i}`,
        eventType: "info",
        createdAt: Date.now() - i * 1000,
      });
    }

    const result = await asUser.query(api.logs.getSystemLogs, { limit: 3 });
    expect(result.logs).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });

  test("enriches logs with user email", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, { level: "info", message: "User action", eventType: "keyword_import", userId });

    const result = await asUser.query(api.logs.getSystemLogs, {});
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].userEmail).toBe("test@example.com");
  });
});

// =============================================
// getLogDetails
// =============================================

describe("getLogDetails", () => {
  test("returns null for non-super-admin", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupTestHierarchy(t);

    const logId = await insertLog(t, { level: "error", message: "Test", eventType: "api_error" });

    const result = await asUser.query(api.logs.getLogDetails, { logId });
    expect(result).toBeNull();
  });

  test("returns null for nonexistent log", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    // Create and delete a log to get a valid-format but nonexistent ID
    const logId = await insertLog(t, { level: "info", message: "temp", eventType: "temp" });
    await t.run(async (ctx) => { await ctx.db.delete(logId); });

    const result = await asUser.query(api.logs.getLogDetails, { logId });
    expect(result).toBeNull();
  });

  test("returns full log details with user info for super admin", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    const logId = await insertLog(t, {
      level: "error",
      message: "Failed to parse SERP response",
      eventType: "parsing_error",
      userId,
      stackTrace: "TypeError: Cannot read property 'items' of undefined",
      requestMetadata: { url: "/api/serp/parse", method: "POST" },
    });

    const result = await asUser.query(api.logs.getLogDetails, { logId });
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Failed to parse SERP response");
    expect(result!.level).toBe("error");
    expect(result!.stackTrace).toContain("TypeError");
    expect(result!.userEmail).toBe("test@example.com");
    expect(result!.userName).toBe("Test User");
    expect(result!.requestMetadata).toEqual({ url: "/api/serp/parse", method: "POST" });
  });

  test("returns log without user info when no userId", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    const logId = await insertLog(t, {
      level: "warning",
      message: "Rate limit exceeded",
      eventType: "rate_limit_warning",
    });

    const result = await asUser.query(api.logs.getLogDetails, { logId });
    expect(result).not.toBeNull();
    expect(result!.userEmail).toBeUndefined();
    expect(result!.userName).toBeUndefined();
  });
});

// =============================================
// getEventTypes
// =============================================

describe("getEventTypes", () => {
  test("returns empty array for non-super-admin", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupTestHierarchy(t);

    const result = await asUser.query(api.logs.getEventTypes, {});
    expect(result).toEqual([]);
  });

  test("returns unique sorted event types for super admin", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await insertLog(t, { level: "error", message: "e1", eventType: "api_error" });
    await insertLog(t, { level: "error", message: "e2", eventType: "api_error" }); // duplicate
    await insertLog(t, { level: "warning", message: "w1", eventType: "limit_warning" });
    await insertLog(t, { level: "info", message: "i1", eventType: "crawl_completed" });

    const result = await asUser.query(api.logs.getEventTypes, {});
    expect(result).toEqual(["api_error", "crawl_completed", "limit_warning"]);
  });
});

// =============================================
// seedTestLogs
// =============================================

describe("seedTestLogs", () => {
  test("throws for non-super-admin", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupTestHierarchy(t);

    await expect(
      asUser.mutation(api.logs.seedTestLogs, {})
    ).rejects.toThrow("Only super admins can seed data");
  });

  test("inserts mock logs for super admin", async () => {
    const t = convexTest(schema, modules);
    const { userId, asUser } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    const result = await asUser.mutation(api.logs.seedTestLogs, {});
    expect(result.count).toBe(10);

    // Verify logs were actually inserted
    const logs = await asUser.query(api.logs.getSystemLogs, {});
    expect(logs.logs.length).toBe(10);
  });
});

// =============================================
// logSystemMessage (internal mutation)
// =============================================

describe("logSystemMessage", () => {
  test("inserts a log entry", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setupTestHierarchy(t);
    await makeSuperAdmin(t, userId);

    await t.mutation(internal.logs.logSystemMessage, {
      level: "error",
      message: "Test internal log",
      eventType: "test_event",
      userId,
      stackTrace: "Error at line 42",
    });

    // Verify by reading directly
    const logs = await t.run(async (ctx) => {
      return await ctx.db.query("systemLogs").collect();
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].message).toBe("Test internal log");
    expect(logs[0].eventType).toBe("test_event");
    expect(logs[0].userId).toBe(userId);
    expect(logs[0].stackTrace).toBe("Error at line 42");
    expect(logs[0].createdAt).toBeGreaterThan(0);
  });

  test("inserts log without optional fields", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.logs.logSystemMessage, {
      level: "info",
      message: "Simple info log",
      eventType: "system_info",
    });

    const logs = await t.run(async (ctx) => {
      return await ctx.db.query("systemLogs").collect();
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBeUndefined();
    expect(logs[0].stackTrace).toBeUndefined();
    expect(logs[0].requestMetadata).toBeUndefined();
  });

  test("inserts log with requestMetadata", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.logs.logSystemMessage, {
      level: "warning",
      message: "Rate limited",
      eventType: "rate_limit",
      requestMetadata: { url: "/api/serp", method: "POST", body: { keyword: "test" } },
    });

    const logs = await t.run(async (ctx) => {
      return await ctx.db.query("systemLogs").collect();
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].requestMetadata).toEqual({ url: "/api/serp", method: "POST", body: { keyword: "test" } });
  });
});
