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

  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google.com",
        location: "Poland",
        language: "pl",
      },
    });
  });

  return { orgId, teamId, projectId, domainId };
}

/** Insert a calendar event directly into the DB. */
async function insertEvent(
  t: any,
  domainId: any,
  overrides: Record<string, any> = {}
) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("calendarEvents", {
      domainId,
      category: "custom",
      title: "Test Event",
      scheduledAt: Date.now(),
      priority: "medium",
      status: "scheduled",
      sourceType: "user",
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

// ===========================================================================
// getEvents
// ===========================================================================

describe("calendarEvents.getEvents", () => {
  test("returns events within date range", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    await insertEvent(t, domainId, { title: "In Range", scheduledAt: now + 1000 });
    await insertEvent(t, domainId, { title: "Before Range", scheduledAt: now - 100000 });
    await insertEvent(t, domainId, { title: "After Range", scheduledAt: now + 200000 });

    const events = await asUser.query(api.calendarEvents.getEvents, {
      domainId,
      startDate: now,
      endDate: now + 50000,
    });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("In Range");
  });

  test("filters by category", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    await insertEvent(t, domainId, {
      title: "Custom",
      category: "custom",
      scheduledAt: now + 100,
    });
    await insertEvent(t, domainId, {
      title: "Audit",
      category: "audit_task",
      scheduledAt: now + 200,
    });

    const events = await asUser.query(api.calendarEvents.getEvents, {
      domainId,
      startDate: now,
      endDate: now + 10000,
      category: "audit_task",
    });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Audit");
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    await insertEvent(t, domainId, {
      title: "Scheduled",
      status: "scheduled",
      scheduledAt: now + 100,
    });
    await insertEvent(t, domainId, {
      title: "Completed",
      status: "completed",
      scheduledAt: now + 200,
    });

    const events = await asUser.query(api.calendarEvents.getEvents, {
      domainId,
      startDate: now,
      endDate: now + 10000,
      status: "completed",
    });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Completed");
  });

  test("returns empty array when no events match", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const events = await asUser.query(api.calendarEvents.getEvents, {
      domainId,
      startDate: Date.now(),
      endDate: Date.now() + 10000,
    });

    expect(events).toEqual([]);
  });
});

// ===========================================================================
// getUpcomingEvents
// ===========================================================================

describe("calendarEvents.getUpcomingEvents", () => {
  test("returns only future non-completed events", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Active future event
    await insertEvent(t, domainId, {
      title: "Future Scheduled",
      status: "scheduled",
      scheduledAt: now + oneDay,
    });
    // Completed future event (should be excluded)
    await insertEvent(t, domainId, {
      title: "Future Completed",
      status: "completed",
      scheduledAt: now + oneDay * 2,
    });
    // Dismissed future event (should be excluded)
    await insertEvent(t, domainId, {
      title: "Future Dismissed",
      status: "dismissed",
      scheduledAt: now + oneDay * 3,
    });
    // In progress future event (should be included)
    await insertEvent(t, domainId, {
      title: "Future In Progress",
      status: "in_progress",
      scheduledAt: now + oneDay * 4,
    });

    const events = await asUser.query(api.calendarEvents.getUpcomingEvents, {
      domainId,
    });

    expect(events).toHaveLength(2);
    const titles = events.map((e: any) => e.title);
    expect(titles).toContain("Future Scheduled");
    expect(titles).toContain("Future In Progress");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < 5; i++) {
      await insertEvent(t, domainId, {
        title: `Event ${i}`,
        status: "scheduled",
        priority: "medium",
        scheduledAt: now + oneDay * (i + 1),
      });
    }

    const events = await asUser.query(api.calendarEvents.getUpcomingEvents, {
      domainId,
      limit: 2,
    });

    expect(events).toHaveLength(2);
  });

  test("sorts by priority then date", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    await insertEvent(t, domainId, {
      title: "Low Priority Early",
      priority: "low",
      scheduledAt: now + oneDay,
    });
    await insertEvent(t, domainId, {
      title: "Critical Late",
      priority: "critical",
      scheduledAt: now + oneDay * 3,
    });
    await insertEvent(t, domainId, {
      title: "Critical Early",
      priority: "critical",
      scheduledAt: now + oneDay * 2,
    });

    const events = await asUser.query(api.calendarEvents.getUpcomingEvents, {
      domainId,
    });

    expect(events[0].title).toBe("Critical Early");
    expect(events[1].title).toBe("Critical Late");
    expect(events[2].title).toBe("Low Priority Early");
  });
});

// ===========================================================================
// getEventCounts
// ===========================================================================

describe("calendarEvents.getEventCounts", () => {
  test("returns correct counts by category", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    await insertEvent(t, domainId, { category: "custom", scheduledAt: now + 100 });
    await insertEvent(t, domainId, { category: "custom", scheduledAt: now + 200 });
    await insertEvent(t, domainId, { category: "audit_task", scheduledAt: now + 300 });

    const counts = await asUser.query(api.calendarEvents.getEventCounts, {
      domainId,
      startDate: now,
      endDate: now + 10000,
    });

    expect(counts.all).toBe(3);
    expect(counts.custom).toBe(2);
    expect(counts.audit_task).toBe(1);
  });
});

// ===========================================================================
// createEvent
// ===========================================================================

describe("calendarEvents.createEvent", () => {
  test("inserts event and returns its ID", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const eventId = await asUser.mutation(api.calendarEvents.createEvent, {
      domainId,
      category: "content_plan",
      title: "Write blog post",
      description: "About SEO tips",
      scheduledAt: Date.now() + 86400000,
      priority: "high",
      sourceType: "user",
    });

    expect(eventId).toBeTruthy();

    const event = await t.run(async (ctx: any) => ctx.db.get(eventId));
    expect(event).not.toBeNull();
    expect(event!.title).toBe("Write blog post");
    expect(event!.category).toBe("content_plan");
    expect(event!.priority).toBe("high");
    expect(event!.status).toBe("scheduled");
    expect(event!.description).toBe("About SEO tips");
    expect(event!.createdAt).toBeGreaterThan(0);
  });
});

// ===========================================================================
// updateEventStatus
// ===========================================================================

describe("calendarEvents.updateEventStatus", () => {
  test("updates event status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);

    const eventId = await insertEvent(t, domainId, { status: "scheduled" });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.calendarEvents.updateEventStatus, {
      eventId,
      status: "in_progress",
    });

    const event = await t.run(async (ctx: any) => ctx.db.get(eventId));
    expect(event!.status).toBe("in_progress");
  });

  test("sets completedAt when status is completed", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);

    const eventId = await insertEvent(t, domainId, { status: "scheduled" });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.calendarEvents.updateEventStatus, {
      eventId,
      status: "completed",
    });

    const event = await t.run(async (ctx: any) => ctx.db.get(eventId));
    expect(event!.status).toBe("completed");
    expect(event!.completedAt).toBeDefined();
    expect(event!.completedAt).toBeGreaterThan(0);
  });
});

// ===========================================================================
// deleteEvent
// ===========================================================================

describe("calendarEvents.deleteEvent", () => {
  test("removes the event", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);

    const eventId = await insertEvent(t, domainId);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.calendarEvents.deleteEvent, { eventId });

    const event = await t.run(async (ctx: any) => ctx.db.get(eventId));
    expect(event).toBeNull();
  });
});

// ===========================================================================
// batchCreateEvents (internal mutation)
// ===========================================================================

describe("calendarEvents.batchCreateEvents", () => {
  test("inserts multiple events at once", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);
    const asUser = t.withIdentity({ subject: userId });

    const now = Date.now();
    const ids = await t.mutation(
      internal.calendarEvents.batchCreateEvents,
      {
        events: [
          {
            domainId,
            category: "ranking_drop",
            title: "Drop on keyword A",
            scheduledAt: now + 1000,
            priority: "critical",
          },
          {
            domainId,
            category: "content_plan",
            title: "Write new article",
            scheduledAt: now + 2000,
            priority: "medium",
            description: "Detailed plan",
          },
          {
            domainId,
            category: "competitor_alert",
            title: "Competitor ranked",
            scheduledAt: now + 3000,
            priority: "high",
            competitorDomain: "rival.com",
          },
        ],
      }
    );

    expect(ids).toHaveLength(3);

    // Verify they are stored correctly
    const stored = await t.run(async (ctx: any) => {
      const results = [];
      for (const id of ids) {
        results.push(await ctx.db.get(id));
      }
      return results;
    });

    expect(stored[0]!.title).toBe("Drop on keyword A");
    expect(stored[0]!.sourceType).toBe("ai_generated");
    expect(stored[0]!.status).toBe("scheduled");
    expect(stored[1]!.description).toBe("Detailed plan");
    expect(stored[2]!.competitorDomain).toBe("rival.com");
  });
});

// ===========================================================================
// autoResolveEvents (internal mutation)
// ===========================================================================

describe("calendarEvents.autoResolveEvents", () => {
  test("marks events as auto_resolved with completedAt", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { name: "Alice", email: "alice@test.com" })
    );
    const { domainId } = await setupHierarchy(t, userId);

    const id1 = await insertEvent(t, domainId, { title: "Resolve me 1" });
    const id2 = await insertEvent(t, domainId, { title: "Resolve me 2" });
    const id3 = await insertEvent(t, domainId, { title: "Keep me" });

    await t.mutation(internal.calendarEvents.autoResolveEvents, {
      eventIds: [id1, id2],
    });

    const e1 = await t.run(async (ctx: any) => ctx.db.get(id1));
    const e2 = await t.run(async (ctx: any) => ctx.db.get(id2));
    const e3 = await t.run(async (ctx: any) => ctx.db.get(id3));

    expect(e1!.status).toBe("auto_resolved");
    expect(e1!.completedAt).toBeGreaterThan(0);
    expect(e2!.status).toBe("auto_resolved");
    expect(e2!.completedAt).toBeGreaterThan(0);
    expect(e3!.status).toBe("scheduled"); // untouched
  });
});
