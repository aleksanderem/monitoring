import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { isSuperAdmin } from "./admin";

// =================================================================
// Internal Mutation — stores analytics event
// =================================================================

export const trackEvent = internalMutation({
  args: {
    eventName: v.string(),
    category: v.union(
      v.literal("navigation"),
      v.literal("feature"),
      v.literal("conversion"),
      v.literal("performance"),
      v.literal("error")
    ),
    userId: v.optional(v.string()),
    properties: v.optional(v.any()),
    sessionId: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", {
      eventName: args.eventName,
      category: args.category,
      userId: args.userId,
      properties: args.properties,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
    });
  },
});

// =================================================================
// Public Action — track event from the client
// =================================================================

export const track = action({
  args: {
    eventName: v.string(),
    category: v.union(
      v.literal("navigation"),
      v.literal("feature"),
      v.literal("conversion"),
      v.literal("performance"),
      v.literal("error")
    ),
    properties: v.optional(v.any()),
    sessionId: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? undefined;

    await ctx.runMutation(internal.analytics.trackEvent, {
      eventName: args.eventName,
      category: args.category,
      userId,
      properties: args.properties,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
    });
  },
});

// =================================================================
// Admin Queries
// =================================================================

/**
 * Get feature usage counts (grouped by eventName) for a given time range.
 */
export const getFeatureUsage = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_category", (q) => q.eq("category", "feature"))
      .collect();

    const filtered = events.filter((e) => e.timestamp >= since);

    const counts: Record<string, number> = {};
    for (const e of filtered) {
      counts[e.eventName] = (counts[e.eventName] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },
});

/**
 * Get conversion funnel counts from existing tables.
 */
export const getConversionFunnel = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const users = await ctx.db.query("users").collect();
    const domains = await ctx.db.query("domains").collect();
    const keywords = await ctx.db.query("keywords").collect();
    const orgs = await ctx.db.query("organizations").collect();

    // Count orgs with a plan set
    const subscribedOrgs = orgs.filter((o) => o.planId != null);

    return {
      registered: users.length,
      added_domain: domains.length,
      added_keywords: keywords.length,
      subscribed: subscribedOrgs.length,
    };
  },
});

/**
 * Get Web Vitals events aggregated.
 */
export const getWebVitals = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const days = args.days ?? 7;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_category", (q) => q.eq("category", "performance"))
      .collect();

    const filtered = events.filter((e) => e.timestamp >= since);

    // Group by metric name and calculate avg
    const metricValues: Record<string, number[]> = {};
    for (const e of filtered) {
      const props = e.properties as { metric?: string; value?: number } | undefined;
      if (props?.metric && typeof props.value === "number") {
        if (!metricValues[props.metric]) metricValues[props.metric] = [];
        metricValues[props.metric].push(props.value);
      }
    }

    const result: Record<string, { avg: number; p75: number; count: number }> = {};
    for (const [metric, values] of Object.entries(metricValues)) {
      values.sort((a, b) => a - b);
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const p75Index = Math.floor(values.length * 0.75);
      result[metric] = {
        avg: Math.round(avg * 100) / 100,
        p75: values[p75Index] ?? avg,
        count: values.length,
      };
    }

    return result;
  },
});

/**
 * Get active users over recent period.
 */
export const getActiveUsers = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analyticsEvents")
      .collect();

    const filtered = events.filter((e) => e.timestamp >= since && e.userId);

    // Count unique users per day
    const dailyUsers: Record<string, Set<string>> = {};
    for (const e of filtered) {
      const date = new Date(e.timestamp).toISOString().split("T")[0];
      if (!dailyUsers[date]) dailyUsers[date] = new Set();
      dailyUsers[date].add(e.userId!);
    }

    // Total unique users
    const allUsers = new Set(filtered.map((e) => e.userId!));

    return {
      totalUnique: allUsers.size,
      daily: Object.entries(dailyUsers)
        .map(([date, users]) => ({ date, count: users.size }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});

/**
 * Get top features by usage count.
 */
export const getTopFeatures = query({
  args: {
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) return null;

    const days = args.days ?? 30;
    const limit = args.limit ?? 10;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analyticsEvents")
      .collect();

    const filtered = events.filter((e) => e.timestamp >= since);

    const counts: Record<string, number> = {};
    for (const e of filtered) {
      counts[e.eventName] = (counts[e.eventName] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
});
