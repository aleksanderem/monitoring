import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

// =================================================================
// Queries
// =================================================================

export const getWebhookEndpoints = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookEndpoints")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const getWebhookDeliveries = query({
  args: {
    endpointId: v.id("webhookEndpoints"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_endpoint_created", (q) =>
        q.eq("webhookEndpointId", args.endpointId)
      )
      .order("desc")
      .take(limit);
  },
});

export const getWebhookStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const endpoints = await ctx.db
      .query("webhookEndpoints")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    let totalDeliveries = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const ep of endpoints) {
      const deliveries = await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_endpoint", (q) =>
          q.eq("webhookEndpointId", ep._id)
        )
        .collect();

      totalDeliveries += deliveries.length;
      for (const d of deliveries) {
        if (d.statusCode && d.statusCode >= 200 && d.statusCode < 300) {
          successCount++;
        } else if (d.statusCode) {
          failureCount++;
        }
      }
    }

    return {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter((e) => e.status === "active").length,
      totalDeliveries,
      successCount,
      failureCount,
    };
  },
});

export const getEndpointInternal = internalQuery({
  args: { endpointId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.endpointId);
  },
});

// =================================================================
// Mutations
// =================================================================

export const createWebhook = mutation({
  args: {
    orgId: v.id("organizations"),
    url: v.string(),
    secret: v.string(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("webhookEndpoints", {
      orgId: args.orgId,
      url: args.url,
      secret: args.secret,
      events: args.events,
      status: "active",
      createdAt: Date.now(),
      failureCount: 0,
    });
  },
});

export const updateWebhook = mutation({
  args: {
    webhookId: v.id("webhookEndpoints"),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("failed"))
    ),
  },
  handler: async (ctx, args) => {
    const { webhookId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.url !== undefined) patch.url = updates.url;
    if (updates.events !== undefined) patch.events = updates.events;
    if (updates.status !== undefined) {
      patch.status = updates.status;
      if (updates.status === "active") {
        patch.failureCount = 0;
      }
    }
    await ctx.db.patch(webhookId, patch);
  },
});

export const deleteWebhook = mutation({
  args: { webhookId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_endpoint", (q) =>
        q.eq("webhookEndpointId", args.webhookId)
      )
      .collect();
    for (const d of deliveries) {
      await ctx.db.delete(d._id);
    }
    await ctx.db.delete(args.webhookId);
  },
});

export const insertDelivery = internalMutation({
  args: {
    webhookEndpointId: v.id("webhookEndpoints"),
    event: v.string(),
    payload: v.string(),
    statusCode: v.optional(v.number()),
    response: v.optional(v.string()),
    attemptNumber: v.number(),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveries", args);
  },
});

export const markEndpointFailed = internalMutation({
  args: {
    endpointId: v.id("webhookEndpoints"),
    failureCount: v.number(),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { failureCount: args.failureCount };
    if (args.failureCount >= 3) {
      patch.status = "failed";
    }
    await ctx.db.patch(args.endpointId, patch);
  },
});

export const markEndpointTriggered = internalMutation({
  args: { endpointId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.endpointId, {
      lastTriggeredAt: Date.now(),
      failureCount: 0,
    });
  },
});
