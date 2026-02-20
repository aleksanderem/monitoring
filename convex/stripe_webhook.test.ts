import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a user
async function createUser(t: any, email = "user@test.com") {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("users", { email, emailVerificationTime: Date.now() });
  });
}

// Helper: create an org with stripe fields and make user the owner
async function createOrgWithStripe(
  t: any,
  userId: any,
  stripeFields: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPeriodEnd?: number;
    billingCycle?: string;
  } = {}
) {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
      ...stripeFields,
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner" as const,
      joinedAt: Date.now(),
    });
  });

  return orgId;
}

// Helper: seed a Pro plan
async function seedProPlan(t: any) {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("plans", {
      name: "Pro",
      key: "pro",
      description: "Professional plan",
      permissions: ["keywords.view", "keywords.add"],
      modules: ["positioning", "backlinks"],
      limits: { maxKeywords: 500, maxDomains: 20, maxProjects: 10 },
      isDefault: false,
      createdAt: Date.now(),
    });
  });
}

// Helper: seed a Free (default) plan
async function seedFreePlan(t: any) {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("plans", {
      name: "Free",
      key: "free",
      description: "Free plan",
      permissions: ["keywords.view"],
      modules: ["positioning"],
      limits: { maxKeywords: 50, maxDomains: 3, maxProjects: 1 },
      isDefault: true,
      createdAt: Date.now(),
    });
  });
}

// ─── customer.subscription.updated ──────────────────────────────────

describe("handleWebhookEvent - customer.subscription.updated", () => {
  test("updates subscription status via webhook", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const orgId = await createOrgWithStripe(t, userId, {
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_updated",
      subscriptionStatus: "trialing",
      subscriptionPeriodEnd: 1690000000,
    });

    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "customer.subscription.updated",
      data: JSON.stringify({
        id: "sub_updated",
        status: "active",
        current_period_end: 1700000000,
      }),
    });

    const org = await t.run(async (ctx: any) => ctx.db.get(orgId));
    expect(org.subscriptionStatus).toBe("active");
    expect(org.subscriptionPeriodEnd).toBe(1700000000);
  });

  test("handles non-existent subscription gracefully", async () => {
    const t = convexTest(schema, modules);

    // Should not throw even when org not found
    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "customer.subscription.updated",
      data: JSON.stringify({
        id: "sub_nonexistent",
        status: "active",
        current_period_end: 1700000000,
      }),
    });
  });
});

// ─── customer.subscription.deleted ──────────────────────────────────

describe("handleWebhookEvent - customer.subscription.deleted", () => {
  test("cancels subscription and downgrades to Free plan", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const proPlanId = await seedProPlan(t);
    const freePlanId = await seedFreePlan(t);
    const orgId = await createOrgWithStripe(t, userId, {
      stripeCustomerId: "cus_del",
      stripeSubscriptionId: "sub_deleted",
      subscriptionStatus: "active",
      subscriptionPeriodEnd: 1700000000,
      billingCycle: "monthly",
    });

    // Also assign the Pro plan
    await t.run(async (ctx: any) => {
      await ctx.db.patch(orgId, { planId: proPlanId, limits: { maxKeywords: 500, maxDomains: 20, maxProjects: 10 } });
    });

    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "customer.subscription.deleted",
      data: JSON.stringify({
        id: "sub_deleted",
      }),
    });

    const org = await t.run(async (ctx: any) => ctx.db.get(orgId));
    expect(org.planId).toBe(freePlanId);
    expect(org.subscriptionStatus).toBe("canceled");
    expect(org.stripeSubscriptionId).toBeUndefined();
    expect(org.subscriptionPeriodEnd).toBeUndefined();
    expect(org.billingCycle).toBeUndefined();
  });

  test("handles non-existent subscription gracefully", async () => {
    const t = convexTest(schema, modules);
    await seedFreePlan(t);

    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "customer.subscription.deleted",
      data: JSON.stringify({
        id: "sub_ghost",
      }),
    });
  });
});

// ─── invoice.payment_failed ─────────────────────────────────────────

describe("handleWebhookEvent - invoice.payment_failed", () => {
  test("sets subscription status to past_due", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const orgId = await createOrgWithStripe(t, userId, {
      stripeCustomerId: "cus_fail",
      stripeSubscriptionId: "sub_pastdue",
      subscriptionStatus: "active",
      subscriptionPeriodEnd: 1700000000,
    });

    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "invoice.payment_failed",
      data: JSON.stringify({
        subscription: "sub_pastdue",
        lines: {
          data: [{ period: { end: 1710000000 } }],
        },
      }),
    });

    const org = await t.run(async (ctx: any) => ctx.db.get(orgId));
    expect(org.subscriptionStatus).toBe("past_due");
    expect(org.subscriptionPeriodEnd).toBe(1710000000);
  });

  test("does nothing when invoice has no subscription ID", async () => {
    const t = convexTest(schema, modules);

    // Should not throw
    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "invoice.payment_failed",
      data: JSON.stringify({
        // No subscription field
        lines: { data: [{ period: { end: 1710000000 } }] },
      }),
    });
  });

  test("falls back to period end 0 when lines data is missing", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const orgId = await createOrgWithStripe(t, userId, {
      stripeCustomerId: "cus_nolines",
      stripeSubscriptionId: "sub_nolines",
      subscriptionStatus: "active",
      subscriptionPeriodEnd: 1700000000,
    });

    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "invoice.payment_failed",
      data: JSON.stringify({
        subscription: "sub_nolines",
        // No lines data
      }),
    });

    const org = await t.run(async (ctx: any) => ctx.db.get(orgId));
    expect(org.subscriptionStatus).toBe("past_due");
    expect(org.subscriptionPeriodEnd).toBe(0);
  });
});

// ─── checkout.session.completed ─────────────────────────────────────

describe("handleWebhookEvent - checkout.session.completed", () => {
  test("fails without STRIPE_SECRET_KEY (expected in test environment)", async () => {
    const t = convexTest(schema, modules);

    // checkout.session.completed uses the Stripe SDK which needs STRIPE_SECRET_KEY.
    // In the test environment this env var is not set, so it should throw.
    await expect(
      t.action(api.stripe_webhook.handleWebhookEvent, {
        type: "checkout.session.completed",
        data: JSON.stringify({
          subscription: "sub_checkout",
          customer: "cus_checkout",
        }),
      })
    ).rejects.toThrow();
  });
});

// ─── unhandled event types ──────────────────────────────────────────

describe("handleWebhookEvent - unhandled event type", () => {
  test("does not throw for unknown event types", async () => {
    const t = convexTest(schema, modules);

    // Should complete without error
    await t.action(api.stripe_webhook.handleWebhookEvent, {
      type: "some.unknown.event",
      data: JSON.stringify({ foo: "bar" }),
    });
  });
});
