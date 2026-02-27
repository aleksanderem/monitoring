import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

// ─── Queries ─────────────────────────────────────────────────────────

/**
 * Get calendar events for a domain within a date range.
 * Used by the Calendar component to render events.
 */
export const getEvents = query({
  args: {
    domainId: v.id("domains"),
    startDate: v.number(),  // timestamp
    endDate: v.number(),    // timestamp
    category: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    // Fetch events in the date range using the composite index
    let events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_domain_date", (q) =>
        q
          .eq("domainId", args.domainId)
          .gte("scheduledAt", args.startDate)
          .lte("scheduledAt", args.endDate)
      )
      .collect();

    // Client-side filter for optional category/status
    if (args.category) {
      events = events.filter((e) => e.category === args.category);
    }
    if (args.status) {
      events = events.filter((e) => e.status === args.status);
    }

    return events;
  },
});

/**
 * Get upcoming events for a domain (next 7 days, not completed/dismissed).
 * Used for the dashboard widget and sidebar preview.
 */
export const getUpcomingEvents = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const now = Date.now();
    const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_domain_date", (q) =>
        q
          .eq("domainId", args.domainId)
          .gte("scheduledAt", now)
          .lte("scheduledAt", weekFromNow)
      )
      .collect();

    // Filter out completed/dismissed
    const active = events.filter(
      (e) => e.status === "scheduled" || e.status === "in_progress"
    );

    // Sort by priority (critical first), then by date
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    active.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.scheduledAt - b.scheduledAt;
    });

    return active.slice(0, args.limit ?? 20);
  },
});

/**
 * Get event counts by category for a domain (for tab badges).
 */
export const getEventCounts = query({
  args: {
    domainId: v.id("domains"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return {};
    await requireTenantAccess(ctx, "domain", args.domainId);

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_domain_date", (q) =>
        q
          .eq("domainId", args.domainId)
          .gte("scheduledAt", args.startDate)
          .lte("scheduledAt", args.endDate)
      )
      .collect();

    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.category] = (counts[event.category] || 0) + 1;
    }
    counts.all = events.length;

    return counts;
  },
});

// ─── Internal queries (called by AI actions) ────────────────────────

/**
 * Get recent AI-generated events for a domain (to avoid duplicate generation).
 */
export const getRecentAIEvents = internalQuery({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    return await ctx.db
      .query("calendarEvents")
      .withIndex("by_domain_date", (q) =>
        q
          .eq("domainId", args.domainId)
          .gte("scheduledAt", fourteenDaysAgo)
      )
      .filter((q) => q.eq(q.field("sourceType"), "ai_generated"))
      .collect();
  },
});

// ─── Mutations ───────────────────────────────────────────────────────

/**
 * Create a calendar event (user or system).
 */
export const createEvent = mutation({
  args: {
    domainId: v.id("domains"),
    category: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    aiReasoning: v.optional(v.string()),
    aiActionItems: v.optional(v.array(v.string())),
    scheduledAt: v.number(),
    scheduledEndAt: v.optional(v.number()),
    priority: v.string(),
    keywordId: v.optional(v.id("keywords")),
    keywordPhrase: v.optional(v.string()),
    competitorDomain: v.optional(v.string()),
    sourceType: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");
    await requireTenantAccess(ctx, "domain", args.domainId);

    return await ctx.db.insert("calendarEvents", {
      domainId: args.domainId,
      category: args.category as any,
      title: args.title,
      description: args.description,
      aiReasoning: args.aiReasoning,
      aiActionItems: args.aiActionItems,
      scheduledAt: args.scheduledAt,
      scheduledEndAt: args.scheduledEndAt,
      priority: args.priority as any,
      status: "scheduled",
      keywordId: args.keywordId,
      keywordPhrase: args.keywordPhrase,
      competitorDomain: args.competitorDomain,
      sourceType: args.sourceType as any,
      color: args.color,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update event status (complete, dismiss, start).
 */
export const updateEventStatus = mutation({
  args: {
    eventId: v.id("calendarEvents"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    await requireTenantAccess(ctx, "domain", event.domainId);

    const update: Record<string, any> = {
      status: args.status,
    };
    if (args.status === "completed") {
      update.completedAt = Date.now();
    }
    await ctx.db.patch(args.eventId, update);
  },
});

/**
 * Delete a calendar event.
 */
export const deleteEvent = mutation({
  args: {
    eventId: v.id("calendarEvents"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    await requireTenantAccess(ctx, "domain", event.domainId);

    await ctx.db.delete(args.eventId);
  },
});

// ─── Internal mutations (called by AI actions) ──────────────────────

/**
 * Batch-create events from AI Strategist.
 * Accepts an array of event data and inserts them all in one mutation.
 */
export const batchCreateEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        domainId: v.id("domains"),
        category: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        aiReasoning: v.optional(v.string()),
        aiActionItems: v.optional(v.array(v.string())),
        scheduledAt: v.number(),
        scheduledEndAt: v.optional(v.number()),
        priority: v.string(),
        keywordId: v.optional(v.id("keywords")),
        keywordPhrase: v.optional(v.string()),
        competitorDomain: v.optional(v.string()),
        color: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const event of args.events) {
      const id = await ctx.db.insert("calendarEvents", {
        domainId: event.domainId,
        category: event.category as any,
        title: event.title,
        description: event.description,
        aiReasoning: event.aiReasoning,
        aiActionItems: event.aiActionItems,
        scheduledAt: event.scheduledAt,
        scheduledEndAt: event.scheduledEndAt,
        priority: event.priority as any,
        status: "scheduled",
        keywordId: event.keywordId,
        keywordPhrase: event.keywordPhrase,
        competitorDomain: event.competitorDomain,
        sourceType: "ai_generated",
        color: event.color,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

/**
 * Record an AI Strategist run.
 */
export const recordStrategistRun = internalMutation({
  args: {
    domainId: v.id("domains"),
    eventsGenerated: v.number(),
    dataSnapshot: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiStrategistRuns", {
      domainId: args.domainId,
      ranAt: Date.now(),
      eventsGenerated: args.eventsGenerated,
      dataSnapshot: args.dataSnapshot,
      status: args.status as any,
      error: args.error,
    });
  },
});

/**
 * Auto-resolve events that are no longer relevant.
 * e.g., ranking_drop events where position has recovered.
 */
export const autoResolveEvents = internalMutation({
  args: {
    eventIds: v.array(v.id("calendarEvents")),
  },
  handler: async (ctx, args) => {
    for (const id of args.eventIds) {
      await ctx.db.patch(id, {
        status: "auto_resolved",
        completedAt: Date.now(),
      });
    }
  },
});
