import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

const MAX_PAYLOAD_LENGTH = 8000;

function truncate(data: unknown): string {
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 0);
  return str.length > MAX_PAYLOAD_LENGTH
    ? str.slice(0, MAX_PAYLOAD_LENGTH) + "...[truncated]"
    : str;
}

// ─── Internal (called from actions) ───

export const isEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "debug_logging"))
      .first();
    return setting?.value === "true";
  },
});

export const saveLog = internalMutation({
  args: {
    domainId: v.optional(v.id("domains")),
    action: v.string(),
    step: v.string(),
    request: v.string(),
    response: v.string(),
    durationMs: v.number(),
    status: v.union(v.literal("success"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("debugLogs", {
      ...args,
      request: truncate(args.request),
      response: truncate(args.response),
      createdAt: Date.now(),
    });
  },
});

// ─── Admin queries ───

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "debug_logging"))
      .first();
    return setting?.value === "true";
  },
});

export const toggle = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "debug_logging"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.enabled ? "true" : "false" });
    } else {
      await ctx.db.insert("appSettings", {
        key: "debug_logging",
        value: args.enabled ? "true" : "false",
      });
    }
  },
});

export const getLogs = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.action) {
      return await ctx.db
        .query("debugLogs")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("debugLogs")
      .withIndex("by_created")
      .order("desc")
      .take(limit);
  },
});

export const clearLogs = mutation({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("debugLogs")
      .withIndex("by_created")
      .order("desc")
      .take(500);

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    return { deleted: logs.length };
  },
});
