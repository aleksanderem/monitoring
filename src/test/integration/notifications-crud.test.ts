/**
 * Integration tests for convex/notifications.ts
 *
 * Tests the notification CRUD operations by mocking the Convex runtime
 * (ctx.db, auth.getUserId) and verifying query/mutation handler logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("convex/values", () => ({
  v: {
    optional: (x: unknown) => x,
    number: () => "number",
    string: () => "string",
    id: (table: string) => `id<${table}>`,
    union: (...args: unknown[]) => args,
    literal: (val: string) => val,
  },
}));

vi.mock("@convex/_generated/server", () => ({
  query: ({ handler }: { handler: Function }) => handler,
  mutation: ({ handler }: { handler: Function }) => handler,
  internalMutation: ({ handler }: { handler: Function }) => handler,
}));

const mockGetUserId = vi.fn();
vi.mock("@convex/auth", () => ({
  auth: { getUserId: (...args: unknown[]) => mockGetUserId(...args) },
}));

// ---------------------------------------------------------------------------
// Import handlers (after mocks are set up, they resolve to raw handler fns)
// ---------------------------------------------------------------------------

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createJobNotification,
} from "@convex/notifications";

// ---------------------------------------------------------------------------
// Helper: build a mock ctx with chainable db.query
// ---------------------------------------------------------------------------

function createMockCtx() {
  const takeFn = vi.fn().mockResolvedValue([]);
  const collectFn = vi.fn().mockResolvedValue([]);
  const orderFn = vi.fn().mockReturnValue({ take: takeFn });
  const withIndexFn = vi.fn().mockReturnValue({
    order: orderFn,
    collect: collectFn,
  });
  const queryFn = vi.fn().mockReturnValue({ withIndex: withIndexFn });

  return {
    db: {
      query: queryFn,
      get: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
    },
    // Expose inner mocks for assertions
    _chain: { withIndexFn, orderFn, takeFn, collectFn },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = "user_abc123" as any;
const OTHER_USER_ID = "user_def456" as any;
const DOMAIN_ID = "domain_001" as any;
const PROJECT_ID = "project_001" as any;
const TEAM_ID = "team_001" as any;
const NOTIF_ID_1 = "notif_001" as any;
const NOTIF_ID_2 = "notif_002" as any;
const NOTIF_ID_3 = "notif_003" as any;

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    _id: NOTIF_ID_1,
    userId: USER_ID,
    domainId: DOMAIN_ID,
    type: "job_completed" as const,
    title: "Position check done",
    message: "All keywords checked for example.com",
    isRead: false,
    createdAt: 1700000000000,
    domainName: "example.com",
    ...overrides,
  };
}

const NOTIF_READ = makeNotification({ _id: NOTIF_ID_2, isRead: true, createdAt: 1700000001000 });
const NOTIF_UNREAD_1 = makeNotification({ _id: NOTIF_ID_1, isRead: false, createdAt: 1700000002000 });
const NOTIF_UNREAD_2 = makeNotification({ _id: NOTIF_ID_3, isRead: false, createdAt: 1700000003000 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================================================
// getNotifications
// ==========================================================================

describe("getNotifications", () => {
  const handler = getNotifications as unknown as (ctx: any, args: any) => Promise<any[]>;

  it("returns empty array when user is not authenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const ctx = createMockCtx();

    const result = await handler(ctx, {});

    expect(result).toEqual([]);
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("queries notifications with by_user index and correct userId", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    const notifications = [NOTIF_UNREAD_2, NOTIF_UNREAD_1];
    ctx._chain.takeFn.mockResolvedValue(notifications);

    const result = await handler(ctx, {});

    expect(ctx.db.query).toHaveBeenCalledWith("notifications");
    // withIndex receives the index name and a callback; verify index name
    expect(ctx._chain.withIndexFn).toHaveBeenCalled();
    const indexCall = ctx._chain.withIndexFn.mock.calls[0];
    expect(indexCall[0]).toBe("by_user");
    // The callback should call q.eq("userId", userId)
    const eqFn = vi.fn().mockReturnThis();
    indexCall[1]({ eq: eqFn });
    expect(eqFn).toHaveBeenCalledWith("userId", USER_ID);
  });

  it("returns results ordered desc", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    const notifications = [NOTIF_UNREAD_2, NOTIF_UNREAD_1];
    ctx._chain.takeFn.mockResolvedValue(notifications);

    const result = await handler(ctx, {});

    expect(ctx._chain.orderFn).toHaveBeenCalledWith("desc");
    expect(result).toEqual(notifications);
  });

  it("uses default limit of 50 when not specified", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();

    await handler(ctx, {});

    expect(ctx._chain.takeFn).toHaveBeenCalledWith(50);
  });

  it("respects custom limit parameter", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();

    await handler(ctx, { limit: 10 });

    expect(ctx._chain.takeFn).toHaveBeenCalledWith(10);
  });

  it("returns all notifications including read and unread", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    const mixed = [NOTIF_UNREAD_2, NOTIF_READ, NOTIF_UNREAD_1];
    ctx._chain.takeFn.mockResolvedValue(mixed);

    const result = await handler(ctx, {});

    expect(result).toHaveLength(3);
    expect(result).toEqual(mixed);
  });
});

// ==========================================================================
// getUnreadCount
// ==========================================================================

describe("getUnreadCount", () => {
  const handler = getUnreadCount as unknown as (ctx: any, args: any) => Promise<number>;

  it("returns 0 when user is not authenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const ctx = createMockCtx();

    const result = await handler(ctx, {});

    expect(result).toBe(0);
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("queries using by_user_unread index with userId and isRead false", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx._chain.collectFn.mockResolvedValue([NOTIF_UNREAD_1, NOTIF_UNREAD_2]);

    await handler(ctx, {});

    expect(ctx.db.query).toHaveBeenCalledWith("notifications");
    const indexCall = ctx._chain.withIndexFn.mock.calls[0];
    expect(indexCall[0]).toBe("by_user_unread");
    // Verify the callback calls eq for userId and isRead
    const eqFn = vi.fn().mockReturnThis();
    indexCall[1]({ eq: eqFn });
    expect(eqFn).toHaveBeenCalledWith("userId", USER_ID);
    expect(eqFn).toHaveBeenCalledWith("isRead", false);
  });

  it("returns count of collected unread items", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx._chain.collectFn.mockResolvedValue([NOTIF_UNREAD_1, NOTIF_UNREAD_2]);

    const result = await handler(ctx, {});

    expect(result).toBe(2);
  });

  it("returns 0 when user has no unread notifications", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx._chain.collectFn.mockResolvedValue([]);

    const result = await handler(ctx, {});

    expect(result).toBe(0);
  });
});

// ==========================================================================
// markAsRead
// ==========================================================================

describe("markAsRead", () => {
  const handler = markAsRead as unknown as (ctx: any, args: any) => Promise<void>;

  it("throws when not authenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const ctx = createMockCtx();

    await expect(handler(ctx, { notificationId: NOTIF_ID_1 })).rejects.toThrow(
      "Authentication required"
    );
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("throws when notification not found", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx.db.get.mockResolvedValue(null);

    await expect(handler(ctx, { notificationId: NOTIF_ID_1 })).rejects.toThrow(
      "Notification not found"
    );
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("throws when notification belongs to another user", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx.db.get.mockResolvedValue(makeNotification({ _id: NOTIF_ID_1, userId: OTHER_USER_ID }));

    await expect(handler(ctx, { notificationId: NOTIF_ID_1 })).rejects.toThrow(
      "Access denied"
    );
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("calls db.patch with notificationId and isRead true", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx.db.get.mockResolvedValue(makeNotification({ _id: NOTIF_ID_1, userId: USER_ID }));

    await handler(ctx, { notificationId: NOTIF_ID_1 });

    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    expect(ctx.db.patch).toHaveBeenCalledWith(NOTIF_ID_1, { isRead: true });
  });

  it("patches the specific notification passed in args", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx.db.get.mockResolvedValue(makeNotification({ _id: NOTIF_ID_3, userId: USER_ID }));

    await handler(ctx, { notificationId: NOTIF_ID_3 });

    expect(ctx.db.patch).toHaveBeenCalledWith(NOTIF_ID_3, { isRead: true });
  });
});

// ==========================================================================
// markAllAsRead
// ==========================================================================

describe("markAllAsRead", () => {
  const handler = markAllAsRead as unknown as (ctx: any, args: any) => Promise<void>;

  it("does nothing when user is not authenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const ctx = createMockCtx();

    await handler(ctx, {});

    expect(ctx.db.query).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("queries unread notifications for the authenticated user", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx._chain.collectFn.mockResolvedValue([]);

    await handler(ctx, {});

    expect(ctx.db.query).toHaveBeenCalledWith("notifications");
    const indexCall = ctx._chain.withIndexFn.mock.calls[0];
    expect(indexCall[0]).toBe("by_user_unread");
    const eqFn = vi.fn().mockReturnThis();
    indexCall[1]({ eq: eqFn });
    expect(eqFn).toHaveBeenCalledWith("userId", USER_ID);
    expect(eqFn).toHaveBeenCalledWith("isRead", false);
  });

  it("patches each unread notification to isRead true", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx._chain.collectFn.mockResolvedValue([NOTIF_UNREAD_1, NOTIF_UNREAD_2]);

    await handler(ctx, {});

    expect(ctx.db.patch).toHaveBeenCalledTimes(2);
    expect(ctx.db.patch).toHaveBeenCalledWith(NOTIF_ID_1, { isRead: true });
    expect(ctx.db.patch).toHaveBeenCalledWith(NOTIF_ID_3, { isRead: true });
  });

  it("handles empty unread list gracefully without patching", async () => {
    mockGetUserId.mockResolvedValue(USER_ID);
    const ctx = createMockCtx();
    ctx._chain.collectFn.mockResolvedValue([]);

    await handler(ctx, {});

    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// createJobNotification
// ==========================================================================

describe("createJobNotification", () => {
  const handler = createJobNotification as unknown as (ctx: any, args: any) => Promise<void>;

  const baseArgs = {
    domainId: DOMAIN_ID,
    type: "job_completed" as const,
    title: "Position check complete",
    message: "All 25 keywords checked for example.com",
  };

  it("returns early if domain is not found", async () => {
    const ctx = createMockCtx();
    ctx.db.get.mockResolvedValue(null);

    await handler(ctx, baseArgs);

    expect(ctx.db.get).toHaveBeenCalledWith(DOMAIN_ID);
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("returns early if project is not found", async () => {
    const ctx = createMockCtx();
    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce(null); // project not found

    await handler(ctx, baseArgs);

    expect(ctx.db.get).toHaveBeenCalledWith(PROJECT_ID);
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("queries team members via project.teamId", async () => {
    const ctx = createMockCtx();
    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([]);

    await handler(ctx, baseArgs);

    expect(ctx.db.query).toHaveBeenCalledWith("teamMembers");
    const indexCall = ctx._chain.withIndexFn.mock.calls[0];
    expect(indexCall[0]).toBe("by_team");
    const eqFn = vi.fn().mockReturnThis();
    indexCall[1]({ eq: eqFn });
    expect(eqFn).toHaveBeenCalledWith("teamId", TEAM_ID);
  });

  it("inserts a notification for each team member with correct fields", async () => {
    const ctx = createMockCtx();
    const member1 = { _id: "tm_1", userId: USER_ID, teamId: TEAM_ID };
    const member2 = { _id: "tm_2", userId: OTHER_USER_ID, teamId: TEAM_ID };

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([member1, member2]);

    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    await handler(ctx, baseArgs);

    expect(ctx.db.insert).toHaveBeenCalledTimes(2);
    expect(ctx.db.insert).toHaveBeenCalledWith("notifications", {
      userId: USER_ID,
      domainId: DOMAIN_ID,
      type: "job_completed",
      title: "Position check complete",
      message: "All 25 keywords checked for example.com",
      isRead: false,
      createdAt: now,
      jobType: undefined,
      jobId: undefined,
      domainName: "example.com",
    });
    expect(ctx.db.insert).toHaveBeenCalledWith("notifications", {
      userId: OTHER_USER_ID,
      domainId: DOMAIN_ID,
      type: "job_completed",
      title: "Position check complete",
      message: "All 25 keywords checked for example.com",
      isRead: false,
      createdAt: now,
      jobType: undefined,
      jobId: undefined,
      domainName: "example.com",
    });

    vi.restoreAllMocks();
  });

  it("sets isRead to false on every inserted notification", async () => {
    const ctx = createMockCtx();
    const member = { _id: "tm_1", userId: USER_ID, teamId: TEAM_ID };

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([member]);

    vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    await handler(ctx, baseArgs);

    const insertedData = ctx.db.insert.mock.calls[0][1];
    expect(insertedData.isRead).toBe(false);

    vi.restoreAllMocks();
  });

  it("includes optional jobType and jobId when provided", async () => {
    const ctx = createMockCtx();
    const member = { _id: "tm_1", userId: USER_ID, teamId: TEAM_ID };

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([member]);

    vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    await handler(ctx, {
      ...baseArgs,
      jobType: "position_check",
      jobId: "job_xyz789",
    });

    const insertedData = ctx.db.insert.mock.calls[0][1];
    expect(insertedData.jobType).toBe("position_check");
    expect(insertedData.jobId).toBe("job_xyz789");

    vi.restoreAllMocks();
  });

  it("uses domain.domain as domainName in each notification", async () => {
    const ctx = createMockCtx();
    const member = { _id: "tm_1", userId: USER_ID, teamId: TEAM_ID };

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "mysite.io", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([member]);

    vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    await handler(ctx, baseArgs);

    const insertedData = ctx.db.insert.mock.calls[0][1];
    expect(insertedData.domainName).toBe("mysite.io");

    vi.restoreAllMocks();
  });

  it("handles team with no members without inserting", async () => {
    const ctx = createMockCtx();

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([]);

    await handler(ctx, baseArgs);

    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("supports job_started notification type", async () => {
    const ctx = createMockCtx();
    const member = { _id: "tm_1", userId: USER_ID, teamId: TEAM_ID };

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([member]);

    vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    await handler(ctx, { ...baseArgs, type: "job_started" });

    const insertedData = ctx.db.insert.mock.calls[0][1];
    expect(insertedData.type).toBe("job_started");

    vi.restoreAllMocks();
  });

  it("supports job_failed notification type", async () => {
    const ctx = createMockCtx();
    const member = { _id: "tm_1", userId: USER_ID, teamId: TEAM_ID };

    ctx.db.get
      .mockResolvedValueOnce({ _id: DOMAIN_ID, domain: "example.com", projectId: PROJECT_ID })
      .mockResolvedValueOnce({ _id: PROJECT_ID, teamId: TEAM_ID });
    ctx._chain.collectFn.mockResolvedValue([member]);

    vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    await handler(ctx, { ...baseArgs, type: "job_failed" });

    const insertedData = ctx.db.insert.mock.calls[0][1];
    expect(insertedData.type).toBe("job_failed");

    vi.restoreAllMocks();
  });
});
