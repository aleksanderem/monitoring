import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { auth } from "./auth";

/**
 * Get the current user's org billing info.
 * Used by Stripe actions to get org context.
 */
export const getUserOrgForBilling = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (memberships.length === 0) return null;

    const org = await ctx.db.get(memberships[0].organizationId);
    if (!org) return null;

    return {
      orgId: org._id,
      orgName: org.name,
      stripeCustomerId: org.stripeCustomerId ?? null,
      email: user.email ?? null,
    };
  },
});

/**
 * Save Stripe customer ID on organization.
 */
export const setStripeCustomerId = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.organizationId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

/**
 * Handle successful checkout — assign Pro plan and save subscription data.
 */
export const activateSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    periodEnd: v.number(),
    billingCycle: v.string(),
  },
  handler: async (ctx, args) => {
    // Find org by Stripe customer ID
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((o) => o.stripeCustomerId === args.stripeCustomerId);
    if (!org) {
      console.error("[billing] No org found for Stripe customer:", args.stripeCustomerId);
      return;
    }

    // Find Pro plan
    const proPlan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", "pro"))
      .unique();
    if (!proPlan) {
      console.error("[billing] Pro plan not found in database");
      return;
    }

    // Assign plan + subscription fields
    await ctx.db.patch(org._id, {
      planId: proPlan._id,
      limits: proPlan.limits,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionStatus: args.status,
      subscriptionPeriodEnd: args.periodEnd,
      billingCycle: args.billingCycle,
    });

    console.log("[billing] Activated Pro for org:", org.name);
  },
});

/**
 * Update subscription status (trialing → active, past_due, etc.)
 */
export const updateSubscriptionStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((o) => o.stripeSubscriptionId === args.stripeSubscriptionId);
    if (!org) return;

    await ctx.db.patch(org._id, {
      subscriptionStatus: args.status,
      subscriptionPeriodEnd: args.periodEnd,
    });
  },
});

/**
 * Handle subscription cancellation — downgrade to Free plan (soft lock).
 */
export const cancelSubscription = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((o) => o.stripeSubscriptionId === args.stripeSubscriptionId);
    if (!org) return;

    // Find Free (default) plan
    const freePlan = await ctx.db
      .query("plans")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    await ctx.db.patch(org._id, {
      planId: freePlan?._id,
      limits: freePlan?.limits,
      stripeSubscriptionId: undefined,
      subscriptionStatus: "canceled",
      subscriptionPeriodEnd: undefined,
      billingCycle: undefined,
    });

    console.log("[billing] Downgraded to Free:", org.name);
  },
});

