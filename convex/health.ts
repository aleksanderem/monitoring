import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getPublicHealth = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("healthChecks")
      .withIndex("by_timestamp")
      .order("desc")
      .first();

    if (!latest) {
      return {
        status: "healthy",
        timestamp: Date.now(),
        services: {
          database: "up",
          email: "unknown",
          api: "unknown",
          auth: "up",
        },
      };
    }

    return {
      status: latest.status,
      timestamp: latest.timestamp,
      services: latest.services,
    };
  },
});

export const getHealthHistory = query({
  args: { hours: v.optional(v.number()) },
  handler: async (ctx, { hours = 24 }) => {
    const since = Date.now() - hours * 60 * 60 * 1000;
    const checks = await ctx.db
      .query("healthChecks")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", since))
      .order("desc")
      .collect();
    return checks;
  },
});

export const recordHealthCheck = internalMutation({
  args: {
    status: v.string(),
    services: v.object({
      database: v.string(),
      email: v.string(),
      api: v.string(),
      auth: v.string(),
    }),
    responseTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("healthChecks", {
      timestamp: Date.now(),
      status: args.status,
      services: args.services,
      responseTimeMs: args.responseTimeMs,
    });
  },
});
