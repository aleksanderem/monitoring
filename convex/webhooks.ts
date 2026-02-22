"use node";

import { v } from "convex/values";
import { query, mutation, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as crypto from "crypto";

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
      // Reset failure count when reactivating
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
    // Delete associated deliveries
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

export const testWebhook = action({
  args: { webhookId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.webhooks.deliverWebhook, {
      endpointId: args.webhookId,
      event: "test",
      payload: JSON.stringify({
        event: "test",
        timestamp: new Date().toISOString(),
        data: { message: "This is a test webhook delivery." },
      }),
    });
  },
});

// =================================================================
// Internal Actions
// =================================================================

/** Record a delivery attempt in the database. */
const recordDelivery = async (
  ctx: any,
  endpointId: any,
  event: string,
  payload: string,
  attemptNumber: number,
  statusCode: number | undefined,
  response: string | undefined
) => {
  await ctx.runMutation(internal.webhooks.insertDelivery, {
    webhookEndpointId: endpointId,
    event,
    payload,
    statusCode,
    response,
    attemptNumber,
    createdAt: Date.now(),
    deliveredAt: statusCode && statusCode >= 200 && statusCode < 300 ? Date.now() : undefined,
  });
};

export const insertDelivery = mutation({
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

export const markEndpointFailed = mutation({
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

export const markEndpointTriggered = mutation({
  args: { endpointId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.endpointId, {
      lastTriggeredAt: Date.now(),
      failureCount: 0,
    });
  },
});

export const deliverWebhook = internalAction({
  args: {
    endpointId: v.id("webhookEndpoints"),
    event: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch endpoint details via a query
    const endpoint = await ctx.runQuery(internal.webhooks.getEndpointInternal, {
      endpointId: args.endpointId,
    });
    if (!endpoint) {
      console.error("[webhook] Endpoint not found:", args.endpointId);
      return;
    }
    if (endpoint.status === "paused") {
      console.log("[webhook] Endpoint paused, skipping:", args.endpointId);
      return;
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Compute HMAC signature
        const signature = crypto
          .createHmac("sha256", endpoint.secret)
          .update(args.payload)
          .digest("hex");

        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": args.event,
          },
          body: args.payload,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        const responseText = await response.text().catch(() => "");

        await recordDelivery(
          ctx,
          args.endpointId,
          args.event,
          args.payload,
          attempt,
          response.status,
          responseText.slice(0, 1000)
        );

        if (response.ok) {
          await ctx.runMutation(internal.webhooks.markEndpointTriggered, {
            endpointId: args.endpointId,
          });
          return;
        }

        // Non-2xx response - retry with backoff
        console.warn(
          `[webhook] Attempt ${attempt}/${maxAttempts} failed with ${response.status}`
        );
      } catch (error: any) {
        await recordDelivery(
          ctx,
          args.endpointId,
          args.event,
          args.payload,
          attempt,
          undefined,
          error.message?.slice(0, 1000)
        );
        console.warn(
          `[webhook] Attempt ${attempt}/${maxAttempts} error:`,
          error.message
        );
      }

      // Exponential backoff: 1s, 4s, 9s
      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * attempt * 1000)
        );
      }
    }

    // All attempts failed
    await ctx.runMutation(internal.webhooks.markEndpointFailed, {
      endpointId: args.endpointId,
      failureCount: (endpoint.failureCount || 0) + 1,
    });
  },
});

export const getEndpointInternal = query({
  args: { endpointId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.endpointId);
  },
});
