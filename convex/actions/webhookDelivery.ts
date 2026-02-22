"use node";

import { v } from "convex/values";
import { internalAction, action } from "../_generated/server";
import { internal } from "../_generated/api";
import * as crypto from "crypto";

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

export const testWebhook = action({
  args: { webhookId: v.id("webhookEndpoints") },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.actions.webhookDelivery.deliverWebhook, {
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

export const deliverWebhook = internalAction({
  args: {
    endpointId: v.id("webhookEndpoints"),
    event: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
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
          signal: AbortSignal.timeout(10000),
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

      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * attempt * 1000)
        );
      }
    }

    await ctx.runMutation(internal.webhooks.markEndpointFailed, {
      endpointId: args.endpointId,
      failureCount: (endpoint.failureCount || 0) + 1,
    });
  },
});
