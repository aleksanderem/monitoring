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

        // If subscription becomes active again, clear any degraded/grace period state
        if (obj.status === "active") {
          await ctx.runMutation(internal.stripe_helpers.clearDegradedStatus, {
            stripeSubscriptionId: obj.id,
          });
        }
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

          // Set grace period (idempotent — won't reset if already set)
          const graceResult = await ctx.runMutation(internal.stripe_helpers.setGracePeriod, {
            stripeSubscriptionId: subscriptionId,
          });

          // Send payment failed notification email (only on first failure)
          if (graceResult && !graceResult.alreadySet) {
            try {
              const ownerEmail = await ctx.runQuery(internal.stripe_helpers.getOrgOwnerEmail, {
                organizationId: graceResult.orgId as any,
              });

              if (ownerEmail) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                let portalUrl = `${appUrl}/settings?tab=plan`;

                // Try to generate billing portal URL for the email
                const stripeKey = process.env.STRIPE_SECRET_KEY;
                const customerId = obj.customer as string;
                if (stripeKey && customerId) {
                  try {
                    const Stripe = (await import("stripe")).default;
                    const stripe = new Stripe(stripeKey);
                    const portalSession = await stripe.billingPortal.sessions.create({
                      customer: customerId,
                      return_url: `${appUrl}/settings?tab=plan`,
                    });
                    portalUrl = portalSession.url;
                  } catch (e) {
                    console.error("[billing] Failed to create portal session for payment failed email:", e);
                  }
                }

                await ctx.runAction(internal.actions.sendEmail.sendPaymentFailedNotice, {
                  to: ownerEmail,
                  orgName: graceResult.orgName,
                  portalUrl,
                });
              }
            } catch (e) {
              // Email sending should not block the webhook response
              console.error("[billing] Failed to send payment failed notification:", e);
            }
          }
        }
        break;
      }

      default:
        console.log("[stripe webhook] Unhandled event type:", args.type);
    }
  },
});
