import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(t: any, name = "Alice", email = "alice@test.com") {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name, email });
  });
}

async function insertNotification(
  t: any,
  userId: string,
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("notifications", {
      userId,
      type: "info" as const,
      title: "Test notification",
      message: "Test message",
      isRead: false,
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

// ===========================================================================
// getNotifications
// ===========================================================================

describe("notifications.getNotifications", () => {
  test("returns empty array when no notifications exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    const notifications = await asUser.query(api.notifications.getNotifications, {});

    expect(notifications).toEqual([]);
  });

  test("returns notifications in newest-first order", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await insertNotification(t, userId, {
      title: "Old",
      createdAt: 1000,
    });
    await insertNotification(t, userId, {
      title: "New",
      createdAt: 2000,
    });

    const asUser = t.withIdentity({ subject: userId });
    const notifications = await asUser.query(api.notifications.getNotifications, {});

    expect(notifications).toHaveLength(2);
    // desc order by _creationTime (Convex default ordering for .order("desc"))
    expect(notifications[0].title).toBe("New");
    expect(notifications[1].title).toBe("Old");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await insertNotification(t, userId, { title: "A", createdAt: 1000 });
    await insertNotification(t, userId, { title: "B", createdAt: 2000 });
    await insertNotification(t, userId, { title: "C", createdAt: 3000 });

    const asUser = t.withIdentity({ subject: userId });
    const notifications = await asUser.query(api.notifications.getNotifications, {
      limit: 2,
    });

    expect(notifications).toHaveLength(2);
  });

  test("returns empty array when user is not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await insertNotification(t, userId, { title: "Hidden" });

    // No identity set => unauthenticated
    const notifications = await t.query(api.notifications.getNotifications, {});
    expect(notifications).toEqual([]);
  });
});

// ===========================================================================
// getUnreadCount
// ===========================================================================

describe("notifications.getUnreadCount", () => {
  test("returns 0 when no unread notifications exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    const count = await asUser.query(api.notifications.getUnreadCount, {});

    expect(count).toBe(0);
  });

  test("returns correct count of unread notifications", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await insertNotification(t, userId, { isRead: false });
    await insertNotification(t, userId, { isRead: false });
    await insertNotification(t, userId, { isRead: true });

    const asUser = t.withIdentity({ subject: userId });
    const count = await asUser.query(api.notifications.getUnreadCount, {});

    expect(count).toBe(2);
  });

  test("returns 0 when user is not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await insertNotification(t, userId, { isRead: false });

    const count = await t.query(api.notifications.getUnreadCount, {});
    expect(count).toBe(0);
  });
});

// ===========================================================================
// markAsRead
// ===========================================================================

describe("notifications.markAsRead", () => {
  test("sets isRead to true on a notification", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const notifId = await insertNotification(t, userId, { isRead: false });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.notifications.markAsRead, {
      notificationId: notifId,
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(notifId));
    expect(updated!.isRead).toBe(true);
  });
});

// ===========================================================================
// markAllAsRead
// ===========================================================================

describe("notifications.markAllAsRead", () => {
  test("marks all unread notifications as read for the user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const n1 = await insertNotification(t, userId, { isRead: false, title: "One" });
    const n2 = await insertNotification(t, userId, { isRead: false, title: "Two" });
    const n3 = await insertNotification(t, userId, { isRead: true, title: "Already read" });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.notifications.markAllAsRead, {});

    const all = await t.run(async (ctx: any) => {
      return Promise.all([ctx.db.get(n1), ctx.db.get(n2), ctx.db.get(n3)]);
    });
    expect(all[0]!.isRead).toBe(true);
    expect(all[1]!.isRead).toBe(true);
    expect(all[2]!.isRead).toBe(true);
  });

  test("does nothing when user is not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const notifId = await insertNotification(t, userId, { isRead: false });

    // No identity => markAllAsRead should silently return
    await t.mutation(api.notifications.markAllAsRead, {});

    const notif = await t.run(async (ctx: any) => ctx.db.get(notifId));
    expect(notif!.isRead).toBe(false);
  });
});

// ===========================================================================
// createJobNotification (internal mutation)
// ===========================================================================

describe("notifications.createJobNotification", () => {
  test("creates notifications for all team members of a domain", async () => {
    const t = convexTest(schema, modules);

    const user1 = await createUser(t, "User1", "user1@test.com");
    const user2 = await createUser(t, "User2", "user2@test.com");

    const orgId = await t.run(async (ctx: any) => {
      return ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
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
        userId: user1,
        role: "owner",
        joinedAt: Date.now(),
      });
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: user2,
        role: "member",
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

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "weekly" as const,
          searchEngine: "google.com",
          location: "US",
          language: "en",
        },
      });
    });

    await t.mutation(internal.notifications.createJobNotification, {
      domainId,
      type: "job_completed",
      title: "Job Done",
      message: "Your keyword check is complete",
      jobType: "keyword_check",
    });

    // Both team members should have a notification
    const notifs = await t.run(async (ctx: any) => {
      return ctx.db.query("notifications").collect();
    });

    expect(notifs).toHaveLength(2);
    const userIds = notifs.map((n: any) => n.userId);
    expect(userIds).toContain(user1);
    expect(userIds).toContain(user2);
    expect(notifs[0].type).toBe("job_completed");
    expect(notifs[0].title).toBe("Job Done");
    expect(notifs[0].isRead).toBe(false);
    expect(notifs[0].domainName).toBe("example.com");
  });
});

// ===========================================================================
// User isolation
// ===========================================================================

describe("notifications - user isolation", () => {
  test("notifications for different users are isolated", async () => {
    const t = convexTest(schema, modules);

    const userA = await createUser(t, "UserA", "a@test.com");
    const userB = await createUser(t, "UserB", "b@test.com");

    await insertNotification(t, userA, { title: "For A" });
    await insertNotification(t, userB, { title: "For B" });

    const asA = t.withIdentity({ subject: userA });
    const notifsA = await asA.query(api.notifications.getNotifications, {});
    expect(notifsA).toHaveLength(1);
    expect(notifsA[0].title).toBe("For A");

    const asB = t.withIdentity({ subject: userB });
    const notifsB = await asB.query(api.notifications.getNotifications, {});
    expect(notifsB).toHaveLength(1);
    expect(notifsB[0].title).toBe("For B");
  });

  test("markAllAsRead only affects current user's notifications", async () => {
    const t = convexTest(schema, modules);

    const userA = await createUser(t, "UserA", "a@test.com");
    const userB = await createUser(t, "UserB", "b@test.com");

    await insertNotification(t, userA, { isRead: false, title: "A's notif" });
    const notifB = await insertNotification(t, userB, {
      isRead: false,
      title: "B's notif",
    });

    const asA = t.withIdentity({ subject: userA });
    await asA.mutation(api.notifications.markAllAsRead, {});

    // User B's notification should still be unread
    const bNotif = await t.run(async (ctx: any) => ctx.db.get(notifB));
    expect(bNotif!.isRead).toBe(false);
  });
});
