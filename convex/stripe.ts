"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

/**
 * Diagnostic action — test Stripe config without auth.
 * Remove after debugging.
 */
export const debugStripeConfig = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const results: string[] = [];

    // Check env vars
    const hasSecret = !!process.env.STRIPE_SECRET_KEY;
    const monthlyPrice = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const yearlyPrice = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
    results.push(`STRIPE_SECRET_KEY: ${hasSecret ? "SET" : "MISSING"}`);
    results.push(`MONTHLY_PRICE_ID: ${monthlyPrice || "MISSING"}`);
    results.push(`YEARLY_PRICE_ID: ${yearlyPrice || "MISSING"}`);

    // Check auth
    const userId = await auth.getUserId(ctx);
    results.push(`userId: ${userId || "NOT AUTHENTICATED"}`);

    if (userId) {
      // Check org
      const orgData = await ctx.runQuery(
        internal.stripe_helpers.getUserOrgForBilling,
        {}
      );
      results.push(`orgData: ${orgData ? JSON.stringify(orgData) : "NULL"}`);
    }

    // Test Stripe connection
    if (hasSecret) {
      try {
        const stripe = getStripe();
        const balance = await stripe.balance.retrieve();
        results.push(`Stripe connection: OK (${balance.available[0]?.currency})`);
      } catch (e: any) {
        results.push(`Stripe connection: FAILED - ${e.message}`);
      }
    }

    return results.join("\n");
  },
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

/**
 * Create a Stripe Checkout Session for upgrading to Pro.
 * Returns the checkout URL to redirect the user to.
 */
export const createCheckoutSession = action({
  args: {
    billingCycle: v.union(v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, args): Promise<string> => {
    console.log("[checkout] Starting createCheckoutSession, billingCycle:", args.billingCycle);

    const userId = await auth.getUserId(ctx);
    console.log("[checkout] userId:", userId);
    if (!userId) throw new Error("Not authenticated");

    // Get user's org
    const orgData = await ctx.runQuery(
      internal.stripe_helpers.getUserOrgForBilling,
      {}
    );
    console.log("[checkout] orgData:", JSON.stringify(orgData));
    if (!orgData) throw new Error("No organization found");
    const { orgId, orgName, stripeCustomerId, email } = orgData;

    const stripe = getStripe();

    // Create or reuse Stripe customer
    let customerId = stripeCustomerId;
    if (!customerId) {
      console.log("[checkout] Creating new Stripe customer...");
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        name: orgName,
        metadata: { convexOrgId: orgId },
      });
      customerId = customer.id;
      console.log("[checkout] Created customer:", customerId);

      // Save customer ID on org
      await ctx.runMutation(internal.stripe_helpers.setStripeCustomerId, {
        organizationId: orgId,
        stripeCustomerId: customerId,
      });
    } else {
      console.log("[checkout] Reusing customer:", customerId);
    }

    // Resolve price ID
    const priceId =
      args.billingCycle === "monthly"
        ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
        : process.env.STRIPE_PRO_YEARLY_PRICE_ID;

    console.log("[checkout] priceId:", priceId);
    if (!priceId) throw new Error(`Missing price ID for ${args.billingCycle}`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    console.log("[checkout] appUrl:", appUrl);

    // Create checkout session with 7-day trial
    console.log("[checkout] Creating Stripe checkout session...");
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { convexOrgId: orgId },
      },
      success_url: `${appUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing/cancel`,
      metadata: { convexOrgId: orgId },
    });

    console.log("[checkout] Session created, url:", session.url);
    if (!session.url) throw new Error("Failed to create checkout session");
    return session.url;
  },
});

/**
 * Create a Stripe Billing Portal session for managing subscription.
 * Returns the portal URL.
 */
export const createBillingPortalSession = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const orgs = await ctx.runQuery(
      internal.stripe_helpers.getUserOrgForBilling,
      {}
    );
    if (!orgs || !orgs.stripeCustomerId) {
      throw new Error("No billing account found");
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: orgs.stripeCustomerId,
      return_url: `${appUrl}/settings?tab=plan`,
    });

    return session.url;
  },
});
