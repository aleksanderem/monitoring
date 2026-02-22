import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { auth } from "./auth";
import { requireTenantAccess, getContextFromDomain, requirePermission, requireQueryPermission } from "./permissions";
import type { Id } from "./_generated/dataModel";

// =================================================================
// Rule type definitions
// =================================================================

const RULE_TYPE_VALIDATOR = v.union(
  v.literal("position_drop"),
  v.literal("top_n_exit"),
  v.literal("new_competitor"),
  v.literal("backlink_lost"),
  v.literal("visibility_drop")
);

// =================================================================
// Queries
// =================================================================

/**
 * Get all alert rules for a domain
 */
export const getAlertRulesByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    await requireTenantAccess(ctx, "domain", args.domainId);

    return await ctx.db
      .query("alertRules")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

/**
 * Get alert events for a domain, newest first
 */
export const getAlertEventsByDomain = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    statusFilter: v.optional(v.union(v.literal("active"), v.literal("acknowledged"))),
    typeFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    await requireTenantAccess(ctx, "domain", args.domainId);

    let events;
    if (args.statusFilter) {
      events = await ctx.db
        .query("alertEvents")
        .withIndex("by_domain_status", (q) =>
          q.eq("domainId", args.domainId).eq("status", args.statusFilter!)
        )
        .order("desc")
        .take(args.limit ?? 100);
    } else {
      events = await ctx.db
        .query("alertEvents")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .order("desc")
        .take(args.limit ?? 100);
    }

    // Client-side type filter
    if (args.typeFilter) {
      events = events.filter((e) => e.ruleType === args.typeFilter);
    }

    return events;
  },
});

/**
 * Get unacknowledged alert event count for a domain
 */
export const getUnacknowledgedAlertCount = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return 0;

    await requireTenantAccess(ctx, "domain", args.domainId);

    const events = await ctx.db
      .query("alertEvents")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    return events.length;
  },
});

// =================================================================
// Mutations
// =================================================================

/**
 * Create a new alert rule
 */
export const createAlertRule = mutation({
  args: {
    domainId: v.id("domains"),
    name: v.string(),
    ruleType: RULE_TYPE_VALIDATOR,
    threshold: v.number(),
    topN: v.optional(v.number()),
    cooldownMinutes: v.optional(v.number()),
    notifyVia: v.optional(v.array(v.union(v.literal("in_app"), v.literal("email")))),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const permCtx = await getContextFromDomain(ctx, args.domainId);
    if (!permCtx) throw new Error("Domain not found");

    await requirePermission(ctx, "alerts.manage", permCtx);

    const now = Date.now();
    return await ctx.db.insert("alertRules", {
      domainId: args.domainId,
      name: args.name,
      ruleType: args.ruleType,
      isActive: true,
      threshold: args.threshold,
      topN: args.topN,
      cooldownMinutes: args.cooldownMinutes ?? 1440,
      notifyVia: args.notifyVia ?? ["in_app"],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an alert rule
 */
export const updateAlertRule = mutation({
  args: {
    ruleId: v.id("alertRules"),
    name: v.optional(v.string()),
    threshold: v.optional(v.number()),
    topN: v.optional(v.number()),
    cooldownMinutes: v.optional(v.number()),
    notifyVia: v.optional(v.array(v.union(v.literal("in_app"), v.literal("email")))),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Alert rule not found");

    const permCtx = await getContextFromDomain(ctx, rule.domainId);
    if (!permCtx) throw new Error("Domain not found");

    await requirePermission(ctx, "alerts.manage", permCtx);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.threshold !== undefined) updates.threshold = args.threshold;
    if (args.topN !== undefined) updates.topN = args.topN;
    if (args.cooldownMinutes !== undefined) updates.cooldownMinutes = args.cooldownMinutes;
    if (args.notifyVia !== undefined) updates.notifyVia = args.notifyVia;

    await ctx.db.patch(args.ruleId, updates);
    return args.ruleId;
  },
});

/**
 * Toggle alert rule active/inactive
 */
export const toggleAlertRule = mutation({
  args: { ruleId: v.id("alertRules") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Alert rule not found");

    const permCtx = await getContextFromDomain(ctx, rule.domainId);
    if (!permCtx) throw new Error("Domain not found");

    await requirePermission(ctx, "alerts.manage", permCtx);

    await ctx.db.patch(args.ruleId, {
      isActive: !rule.isActive,
      updatedAt: Date.now(),
    });

    return !rule.isActive;
  },
});

/**
 * Delete an alert rule
 */
export const deleteAlertRule = mutation({
  args: { ruleId: v.id("alertRules") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Alert rule not found");

    const permCtx = await getContextFromDomain(ctx, rule.domainId);
    if (!permCtx) throw new Error("Domain not found");

    await requirePermission(ctx, "alerts.manage", permCtx);

    await ctx.db.delete(args.ruleId);
  },
});

/**
 * Acknowledge a single alert event
 */
export const acknowledgeAlertEvent = mutation({
  args: { eventId: v.id("alertEvents") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Alert event not found");

    await requireTenantAccess(ctx, "domain", event.domainId);

    await ctx.db.patch(args.eventId, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
      acknowledgedBy: userId,
    });
  },
});

/**
 * Acknowledge all active alert events for a domain
 */
export const acknowledgeAllAlertEvents = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireTenantAccess(ctx, "domain", args.domainId);

    const activeEvents = await ctx.db
      .query("alertEvents")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    const now = Date.now();
    for (const event of activeEvents) {
      await ctx.db.patch(event._id, {
        status: "acknowledged",
        acknowledgedAt: now,
        acknowledgedBy: userId,
      });
    }

    return activeEvents.length;
  },
});

// =================================================================
// Internal Mutations (called by evaluation engine)
// =================================================================

/**
 * Create default alert rules for a newly created domain
 */
export const createDefaultRules = internalMutation({
  args: {
    domainId: v.id("domains"),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const defaults = [
      {
        name: "Position drop > 10",
        ruleType: "position_drop" as const,
        threshold: 10,
        topN: undefined,
      },
      {
        name: "Keyword exits top 10",
        ruleType: "top_n_exit" as const,
        threshold: 10,
        topN: 10,
      },
      {
        name: "Backlinks lost > 5",
        ruleType: "backlink_lost" as const,
        threshold: 5,
        topN: undefined,
      },
      {
        name: "Visibility drop > 20%",
        ruleType: "visibility_drop" as const,
        threshold: 20,
        topN: undefined,
      },
    ];

    for (const rule of defaults) {
      await ctx.db.insert("alertRules", {
        domainId: args.domainId,
        name: rule.name,
        ruleType: rule.ruleType,
        isActive: true,
        threshold: rule.threshold,
        topN: rule.topN,
        cooldownMinutes: 1440,
        notifyVia: ["in_app"],
        createdBy: args.createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Create an alert event and update the rule's lastTriggeredAt
 */
export const createAlertEvent = internalMutation({
  args: {
    ruleId: v.id("alertRules"),
    domainId: v.id("domains"),
    ruleType: v.string(),
    data: v.object({
      keywordId: v.optional(v.id("keywords")),
      keywordPhrase: v.optional(v.string()),
      previousValue: v.optional(v.number()),
      currentValue: v.optional(v.number()),
      competitorDomain: v.optional(v.string()),
      details: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the event
    const eventId = await ctx.db.insert("alertEvents", {
      ruleId: args.ruleId,
      domainId: args.domainId,
      ruleType: args.ruleType,
      triggeredAt: now,
      data: args.data,
      status: "active",
    });

    // Update rule's lastTriggeredAt
    await ctx.db.patch(args.ruleId, { lastTriggeredAt: now });

    return eventId;
  },
});
