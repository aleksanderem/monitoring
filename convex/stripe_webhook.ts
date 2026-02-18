"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Process a Stripe webhook event.
 * Called from the Next.js API route after signature verification.
 */
export const handleWebhookEvent = action({
  args: {
    type: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    const obj = JSON.parse(args.data);

    switch (args.type) {
      case "checkout.session.completed": {
        const subscription = obj.subscription as string;
        const customerId = obj.customer as string;

        // Fetch subscription details to get billing cycle
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const sub = await stripe.subscriptions.retrieve(subscription);

        await ctx.runMutation(internal.stripe_helpers.activateSubscription, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription,
          status: sub.status,
          periodEnd: (sub as any).current_period_end,
          billingCycle: sub.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly",
        });
        break;
      }

      case "customer.subscription.updated": {
        await ctx.runMutation(internal.stripe_helpers.updateSubscriptionStatus, {
          stripeSubscriptionId: obj.id,
          status: obj.status,
          periodEnd: obj.current_period_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        await ctx.runMutation(internal.stripe_helpers.cancelSubscription, {
          stripeSubscriptionId: obj.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const subscriptionId = obj.subscription as string;
        if (subscriptionId) {
          await ctx.runMutation(internal.stripe_helpers.updateSubscriptionStatus, {
            stripeSubscriptionId: subscriptionId,
            status: "past_due",
            periodEnd: obj.lines?.data?.[0]?.period?.end ?? 0,
          });
        }
        break;
      }

      default:
        console.log("[stripe webhook] Unhandled event type:", args.type);
    }
  },
});
