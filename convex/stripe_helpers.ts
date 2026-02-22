import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const GRACE_PERIOD_DAYS = 7;

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

    // Send subscription confirmation email to org owner
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();
    const owner = members.find((m) => m.role === "owner");
    if (owner) {
      const ownerUser = await ctx.db.get(owner.userId);
      const ownerEmail = (ownerUser as any)?.email;
      if (ownerEmail) {
        await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendSubscriptionConfirmation, {
          to: ownerEmail,
          planName: proPlan.name,
          billingCycle: args.billingCycle,
        });
      }
    }
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

    // Get the plan name before we overwrite it
    const currentPlan = org.planId ? await ctx.db.get(org.planId) : null;
    const planName = currentPlan?.name ?? "Pro";

    await ctx.db.patch(org._id, {
      planId: freePlan?._id,
      limits: freePlan?.limits,
      stripeSubscriptionId: undefined,
      subscriptionStatus: "canceled",
      subscriptionPeriodEnd: undefined,
      billingCycle: undefined,
      gracePeriodEnd: undefined,
      degraded: undefined,
      trialRemindersSent: undefined,
    });

    console.log("[billing] Downgraded to Free:", org.name);

    // Send cancellation confirmation email to org owner
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();
    const owner = members.find((m) => m.role === "owner");
    if (owner) {
      const ownerUser = await ctx.db.get(owner.userId);
      const ownerEmail = (ownerUser as any)?.email;
      if (ownerEmail) {
        await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendCancellationConfirmation, {
          to: ownerEmail,
          orgName: org.name,
          planName,
        });
      }
    }
  },
});

/**
 * Set grace period on an org after payment failure.
 */
export const setGracePeriod = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((o) => o.stripeSubscriptionId === args.stripeSubscriptionId);
    if (!org) return null;

    // Don't reset grace period if already set (idempotent)
    if (org.gracePeriodEnd) return { orgId: org._id, orgName: org.name, alreadySet: true };

    const gracePeriodEnd = Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    await ctx.db.patch(org._id, {
      gracePeriodEnd,
    });

    return { orgId: org._id, orgName: org.name, alreadySet: false };
  },
});

/**
 * Get the owner email for an organization.
 */
export const getOrgOwnerEmail = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    const owner = members.find((m) => m.role === "owner");
    if (!owner) return null;

    const ownerUser = await ctx.db.get(owner.userId);
    return (ownerUser as any)?.email ?? null;
  },
});

/**
 * Check all orgs with expired grace periods and degrade them.
 * Called daily by cron.
 */
export const checkGracePeriods = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const now = Date.now();
    let degradedCount = 0;

    for (const org of orgs) {
      if (
        org.subscriptionStatus === "past_due" &&
        org.gracePeriodEnd &&
        org.gracePeriodEnd < now &&
        !org.degraded
      ) {
        await ctx.db.patch(org._id, { degraded: true });
        degradedCount++;

        // Schedule degradation notice email
        const members = await ctx.db
          .query("organizationMembers")
          .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
          .collect();
        const owner = members.find((m) => m.role === "owner");
        if (owner) {
          const ownerUser = await ctx.db.get(owner.userId);
          const ownerEmail = (ownerUser as any)?.email;
          if (ownerEmail && org.stripeCustomerId) {
            // We'll pass the settings URL since we can't generate portal URL from a mutation
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendDegradationNotice, {
              to: ownerEmail,
              orgName: org.name,
              portalUrl: `${appUrl}/settings?tab=plan`,
            });
          }
        }
      }
    }

    if (degradedCount > 0) {
      console.log(`[billing] Degraded ${degradedCount} orgs with expired grace periods`);
    }
  },
});

/**
 * Clear degraded status when subscription becomes active again.
 * Called when subscription.updated webhook sets status to "active".
 */
export const clearDegradedStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgs.find((o) => o.stripeSubscriptionId === args.stripeSubscriptionId);
    if (!org) return;

    if (org.degraded || org.gracePeriodEnd) {
      await ctx.db.patch(org._id, {
        degraded: undefined,
        gracePeriodEnd: undefined,
      });
      console.log("[billing] Cleared degraded status for org:", org.name);
    }
  },
});

/**
 * Get trialing orgs that need reminder emails.
 */
export const getTrialingOrgs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const now = Date.now();
    const results: Array<{
      orgId: string;
      orgName: string;
      daysLeft: number;
      needsThreeDayReminder: boolean;
      needsOneDayReminder: boolean;
    }> = [];

    for (const org of orgs) {
      if (org.subscriptionStatus !== "trialing" || !org.subscriptionPeriodEnd) continue;

      // subscriptionPeriodEnd is in seconds (Stripe timestamps)
      const endMs = org.subscriptionPeriodEnd * 1000;
      const daysLeft = Math.ceil((endMs - now) / (1000 * 60 * 60 * 24));

      if (daysLeft > 3 || daysLeft < 0) continue;

      const reminders = org.trialRemindersSent ?? {};
      const needsThreeDayReminder = daysLeft <= 3 && daysLeft > 1 && !reminders.threeDays;
      const needsOneDayReminder = daysLeft <= 1 && !reminders.oneDay;

      if (needsThreeDayReminder || needsOneDayReminder) {
        results.push({
          orgId: org._id,
          orgName: org.name,
          daysLeft,
          needsThreeDayReminder,
          needsOneDayReminder,
        });
      }
    }

    return results;
  },
});

/**
 * Mark trial reminder as sent for an org.
 */
export const markTrialReminderSent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    reminderType: v.union(v.literal("threeDays"), v.literal("oneDay")),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return;

    const current = org.trialRemindersSent ?? {};
    await ctx.db.patch(args.organizationId, {
      trialRemindersSent: {
        ...current,
        [args.reminderType]: true,
      },
    });
  },
});

/**
 * Check trialing orgs and send reminder emails.
 * Called daily by cron.
 */
export const checkTrialReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const orgsNeedingReminders = await ctx.runQuery(internal.stripe_helpers.getTrialingOrgs, {});

    for (const orgData of orgsNeedingReminders) {
      // Get org owner email
      const ownerEmail = await ctx.runQuery(internal.stripe_helpers.getOrgOwnerEmail, {
        organizationId: orgData.orgId as any,
      });
      if (!ownerEmail) continue;

      if (orgData.needsThreeDayReminder) {
        await ctx.runAction(internal.actions.sendEmail.sendTrialReminder, {
          to: ownerEmail,
          orgName: orgData.orgName,
          daysLeft: 3,
        });
        await ctx.runMutation(internal.stripe_helpers.markTrialReminderSent, {
          organizationId: orgData.orgId as any,
          reminderType: "threeDays",
        });
        console.log("[billing] Sent 3-day trial reminder for org:", orgData.orgName);
      }

      if (orgData.needsOneDayReminder) {
        await ctx.runAction(internal.actions.sendEmail.sendTrialReminder, {
          to: ownerEmail,
          orgName: orgData.orgName,
          daysLeft: 1,
        });
        await ctx.runMutation(internal.stripe_helpers.markTrialReminderSent, {
          organizationId: orgData.orgId as any,
          reminderType: "oneDay",
        });
        console.log("[billing] Sent 1-day trial reminder for org:", orgData.orgName);
      }
    }
  },
});

