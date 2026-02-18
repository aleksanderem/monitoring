# Stripe Billing & Upgrade Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Stripe subscription billing with checkout, webhooks, pricing page, and soft-lock downgrade.

**Architecture:** Stripe Checkout (hosted) for payment. Convex actions call Stripe API for checkout/portal sessions. Next.js API route receives webhooks, verifies signature, calls Convex mutation. Frontend: Untitled UI pricing template + upgrade UI in Settings.

**Tech Stack:** Stripe SDK, Convex (actions + mutations), Next.js API routes, Untitled UI components

---

### Task 1: Add Stripe fields to organizations schema

**Files:**
- Modify: `convex/schema.ts:32-65` (organizations table)

**Step 1: Add Stripe billing fields to organizations table**

In `convex/schema.ts`, add these optional fields to the organizations `defineTable()` block, after the `aiSettings` field (line ~63):

```typescript
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    subscriptionPeriodEnd: v.optional(v.number()),
    billingCycle: v.optional(v.string()),
```

**Step 2: Verify Convex pushes schema without errors**

Run: `npx convex dev` — check that it syncs without schema errors. If `convex dev` is already running, it auto-syncs.

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(billing): add Stripe subscription fields to organizations schema"
```

---

### Task 2: Set up environment variables

**Files:**
- Modify: `.env.local`

**Step 1: Add Stripe env vars to `.env.local`**

```
STRIPE_SECRET_KEY=sk_test_***REDACTED***
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_***REDACTED***
STRIPE_PRO_MONTHLY_PRODUCT_ID=prod_***REDACTED***
STRIPE_PRO_YEARLY_PRODUCT_ID=prod_***REDACTED***
```

Note: `STRIPE_WEBHOOK_SECRET` will be added later after setting up the Stripe CLI or webhook endpoint.

**Step 2: Install Stripe SDK**

```bash
npm install stripe
```

**Step 3: Fetch Price IDs from Stripe products**

Run this one-time script to get the price IDs for the products:

```bash
npx tsx -e "
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
async function main() {
  for (const prodId of [process.env.STRIPE_PRO_MONTHLY_PRODUCT_ID, process.env.STRIPE_PRO_YEARLY_PRODUCT_ID]) {
    const prices = await stripe.prices.list({ product: prodId, active: true });
    console.log(prodId, '=>', prices.data.map(p => ({ id: p.id, interval: p.recurring?.interval, amount: p.unit_amount })));
  }
}
main();
"
```

Add the returned price IDs to `.env.local`:

```
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

Also add these env vars to Convex dashboard (Settings > Environment Variables) so Convex actions can access them:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`

**Step 4: Commit** (only package.json and lock file — NOT .env.local)

```bash
git add package.json package-lock.json
git commit -m "feat(billing): install stripe SDK"
```

---

### Task 3: Create Stripe checkout & portal actions

**Files:**
- Create: `convex/stripe.ts`

**Step 1: Create `convex/stripe.ts`**

This file contains Convex actions that call the Stripe API. Actions use `"use node"` to access npm packages and `process.env`.

```typescript
"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

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
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user's org
    const orgs = await ctx.runQuery(
      internal.stripe_helpers.getUserOrgForBilling,
      {}
    );
    if (!orgs) throw new Error("No organization found");
    const { orgId, orgName, stripeCustomerId, email } = orgs;

    const stripe = getStripe();

    // Create or reuse Stripe customer
    let customerId = stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: orgName,
        metadata: { convexOrgId: orgId },
      });
      customerId = customer.id;

      // Save customer ID on org
      await ctx.runMutation(internal.stripe_helpers.setStripeCustomerId, {
        organizationId: orgId,
        stripeCustomerId: customerId,
      });
    }

    // Resolve price ID
    const priceId =
      args.billingCycle === "monthly"
        ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
        : process.env.STRIPE_PRO_YEARLY_PRICE_ID;

    if (!priceId) throw new Error(`Missing price ID for ${args.billingCycle}`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create checkout session with 7-day trial
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p convex/tsconfig.json` (or check Convex dev sync)

**Step 3: Commit**

```bash
git add convex/stripe.ts
git commit -m "feat(billing): add Stripe checkout and portal actions"
```

---

### Task 4: Create internal helper queries/mutations for Stripe

**Files:**
- Create: `convex/stripe_helpers.ts`

**Step 1: Create `convex/stripe_helpers.ts`**

These are internal functions only callable from other Convex functions (not from the client). They handle reading/writing org billing data.

```typescript
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
```

**Step 2: Verify Convex syncs**

Check `npx convex dev` output — no errors.

**Step 3: Commit**

```bash
git add convex/stripe_helpers.ts
git commit -m "feat(billing): add internal billing helper mutations"
```

---

### Task 5: Create Stripe webhook endpoint

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Step 1: Create the webhook route**

This Next.js API route receives Stripe webhook events, verifies the signature, and calls Convex mutations.

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../../convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// We can't call internal mutations from ConvexHttpClient,
// so we use a regular action that wraps the internal calls.
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await convex.action(api.stripe_webhook.handleWebhookEvent, {
      type: event.type,
      data: JSON.stringify(event.data.object),
    });
  } catch (err) {
    console.error("[stripe webhook] Failed to process event:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Create the Convex webhook action**

Create `convex/stripe_webhook.ts` — a public action that the webhook route calls, which then dispatches to internal mutations:

```typescript
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
          periodEnd: sub.current_period_end,
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
```

**Step 3: Set up Stripe CLI for local webhook testing**

```bash
# Install Stripe CLI (if not installed)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret from `stripe listen` output and add to `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Step 4: Verify build passes**

Run: `npx next build` — check for no TypeScript errors.

**Step 5: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts convex/stripe_webhook.ts
git commit -m "feat(billing): add Stripe webhook endpoint and event handler"
```

---

### Task 6: Create public /pricing page

**Files:**
- Create: `src/app/(public)/pricing/page.tsx`

**Step 1: Scaffold the Untitled UI pricing template**

Run: `npx untitledui@latest example pricing-pages/04`

Check what files are created and where. If it scaffolds into a separate directory, move/adapt the pricing page component into `src/app/(public)/pricing/page.tsx`.

**Step 2: Adapt the template into the project**

Create `src/app/(public)/pricing/page.tsx`. The page should:

1. Show 3 plan columns (Free / Pro / Enterprise)
2. Toggle between monthly and yearly billing (yearly shows ~20% discount)
3. Free column: feature list + "Get started" (link to /register)
4. Pro column: feature list + price + "Start 7-day trial" button that calls `createCheckoutSession`
5. Enterprise column: feature list + "Skontaktuj się" (contact link/mailto)
6. Feature comparison table below

Key implementation notes:
- The page must be wrapped in `ConvexProvider` since it calls actions. Check if the root layout already wraps all pages.
- Use `useAction(api.stripe.createCheckoutSession)` to get the checkout URL
- On click: call action, then `window.location.href = url` to redirect to Stripe
- Monthly/yearly toggle uses `useState<"monthly" | "yearly">`

Pricing data (from seeded plans):

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Keywords | 50 | 500 | Unlimited |
| Domains | 3 | 20 | Unlimited |
| Projects | 1 | 10 | Unlimited |
| Modules | Tracking, Reports | + Backlinks, Audit, Competitors, Link Building | All (+ AI Strategy, Forecasts) |

Prices: use the amounts from Stripe products (fetch dynamically or hardcode for MVP).

**Step 3: Verify page renders**

Run dev server, navigate to `/pricing`. Check:
- 3 columns render
- Toggle switches between monthly/yearly
- "Start 7-day trial" button is clickable (will fail if Stripe not set up yet — that's OK)

**Step 4: Commit**

```bash
git add src/app/(public)/pricing/
git commit -m "feat(billing): add public pricing page"
```

---

### Task 7: Create success and cancel pages

**Files:**
- Create: `src/app/(public)/pricing/success/page.tsx`
- Create: `src/app/(public)/pricing/cancel/page.tsx`

**Step 1: Create success page**

```typescript
"use client";

import Link from "next/link";
import { AppLogo } from "@/components/shared/AppLogo";

export default function PricingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-white/10 bg-gray-900/80 p-8 text-center backdrop-blur-sm">
        <AppLogo variant="white" className="h-9" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            Upgrade successful!
          </h1>
          <p className="text-sm text-gray-400">
            Your Pro plan is now active. Your 7-day trial has started.
          </p>
        </div>
        <Link
          href="/domains"
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Create cancel page**

```typescript
"use client";

import Link from "next/link";
import { AppLogo } from "@/components/shared/AppLogo";

export default function PricingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-white/10 bg-gray-900/80 p-8 text-center backdrop-blur-sm">
        <AppLogo variant="white" className="h-9" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            Checkout canceled
          </h1>
          <p className="text-sm text-gray-400">
            No worries — you can upgrade anytime from your settings.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/5"
          >
            Back to pricing
          </Link>
          <Link
            href="/domains"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify both pages render**

Run dev server, navigate to `/pricing/success` and `/pricing/cancel`.

**Step 4: Commit**

```bash
git add src/app/(public)/pricing/success/ src/app/(public)/pricing/cancel/
git commit -m "feat(billing): add checkout success and cancel pages"
```

---

### Task 8: Add upgrade button and subscription status to Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (PlanUsageSection component)

**Step 1: Add subscription status and upgrade/manage buttons**

In the `PlanUsageSection` component, after the plan badge section, add:

1. Import `useAction` from `"convex/react"`:
   ```typescript
   import { useQuery, useMutation, useAction } from "convex/react";
   ```

2. Add action hooks inside PlanUsageSection:
   ```typescript
   const createCheckout = useAction(api.stripe.createCheckoutSession);
   const createPortal = useAction(api.stripe.createBillingPortalSession);
   const [upgradeLoading, setUpgradeLoading] = useState(false);
   ```

3. Read subscription status from org:
   ```typescript
   const subscriptionStatus = firstOrg?.subscriptionStatus;
   const subscriptionEnd = firstOrg?.subscriptionPeriodEnd;
   const isSubscribed = subscriptionStatus === "active" || subscriptionStatus === "trialing";
   ```

4. After the plan badge `<div>`, add conditional buttons:

   For free users (no subscription):
   ```tsx
   <Button onClick={handleUpgrade} loading={upgradeLoading}>
     Upgrade to Pro
   </Button>
   ```

   For subscribed users:
   ```tsx
   <Button variant="secondary" onClick={handleManage}>
     Manage subscription
   </Button>
   ```

   With subscription status text:
   ```tsx
   {subscriptionStatus === "trialing" && subscriptionEnd && (
     <span className="text-sm text-tertiary">
       Trial ends {new Date(subscriptionEnd * 1000).toLocaleDateString()}
     </span>
   )}
   {subscriptionStatus === "past_due" && (
     <span className="text-sm text-fg-warning-primary">
       Payment past due — please update your payment method
     </span>
   )}
   ```

5. Handler functions:
   ```typescript
   async function handleUpgrade() {
     setUpgradeLoading(true);
     try {
       const url = await createCheckout({ billingCycle: "monthly" });
       window.location.href = url;
     } catch (err) {
       toast.error("Failed to start checkout");
       setUpgradeLoading(false);
     }
   }

   async function handleManage() {
     try {
       const url = await createPortal();
       window.location.href = url;
     } catch (err) {
       toast.error("Failed to open billing portal");
     }
   }
   ```

Note: the `useAction` import requires that `api.stripe` types are generated. Convex auto-generates these when `convex/stripe.ts` is created.

**Step 2: Also expose subscription fields in getUserOrganizations query**

In `convex/organizations.ts`, the `getUserOrganizations` query already returns `...org`. Since the new fields are on the org document, they'll be included automatically. Verify by checking the return type includes `stripeCustomerId`, `subscriptionStatus`, etc.

**Step 3: Verify build passes**

Run: `npx next build`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat(billing): add upgrade button and subscription status to Settings"
```

---

### Task 9: Add over-limit soft lock banner

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` (dashboard layout)

**Step 1: Add an over-limit banner to the dashboard layout**

The banner should appear when the user's usage exceeds their plan limits (soft lock state). Use the existing `AlertFullWidth` component from `src/components/application/alerts/alerts.tsx`.

In the dashboard layout, after the main content area wrapper, add a query that checks if the user is over limit:

```typescript
// In dashboard layout or a shared component
const orgs = useQuery(api.organizations.getUserOrganizations);
const orgId = orgs?.[0]?._id;
const usage = useQuery(api.limits.getUsageStats, orgId ? { organizationId: orgId } : "skip");

const isOverLimit = usage && (
  (usage.keywords.limit !== null && usage.keywords.current > usage.keywords.limit) ||
  (usage.domains.limit !== null && usage.domains.current > usage.domains.limit) ||
  (usage.projects.limit !== null && usage.projects.current > usage.projects.limit)
);
```

Render the banner conditionally:
```tsx
{isOverLimit && (
  <AlertFullWidth
    color="warning"
    title="Plan limit exceeded"
    description="You've exceeded your plan limits. Upgrade your plan or remove excess resources to continue adding new items."
    confirmLabel="Upgrade plan"
    onConfirm={() => router.push("/pricing")}
    actionType="button"
  />
)}
```

Note: use plan limits as fallback (same pattern from the PlanUsageSection fix applied in this session). The banner should use the effective plan limits, not just org limits.

**Step 2: Verify the banner only shows when over limit**

This requires having a free plan with limits lower than current usage — which is the current state of the app (305 keywords, limit 50).

**Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat(billing): add over-limit soft lock banner"
```

---

### Task 10: End-to-end test with Stripe CLI

**No files to create — manual verification.**

**Step 1: Start Stripe CLI listener**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` signing secret and add to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

**Step 2: Test checkout flow**

1. Navigate to `/pricing`
2. Click "Start 7-day trial" on Pro plan
3. Should redirect to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC
5. Complete checkout
6. Should redirect to `/pricing/success`
7. Check Settings > Plan i użycie — should show "Pro" badge

**Step 3: Test webhook events**

```bash
# Trigger a test event
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

Verify each event updates the org correctly in the Convex dashboard.

**Step 4: Test billing portal**

1. In Settings > Plan i użycie, click "Manage subscription"
2. Should redirect to Stripe Customer Portal
3. Verify you can see invoices, update payment method, cancel

**Step 5: Test downgrade**

1. Cancel subscription via Stripe portal
2. Verify org downgrades to Free plan in Settings
3. Verify over-limit banner appears (if usage > free limits)
4. Verify user cannot add new keywords/domains above limit

---

## Summary of files

| File | Action | Purpose |
|------|--------|---------|
| `convex/schema.ts` | Modify | Add Stripe fields to organizations |
| `convex/stripe.ts` | Create | Checkout + portal actions |
| `convex/stripe_helpers.ts` | Create | Internal billing mutations |
| `convex/stripe_webhook.ts` | Create | Webhook event processor action |
| `src/app/api/stripe/webhook/route.ts` | Create | Webhook HTTP endpoint |
| `src/app/(public)/pricing/page.tsx` | Create | Public pricing page |
| `src/app/(public)/pricing/success/page.tsx` | Create | Checkout success page |
| `src/app/(public)/pricing/cancel/page.tsx` | Create | Checkout cancel page |
| `src/app/(dashboard)/settings/page.tsx` | Modify | Upgrade button + subscription status |
| `src/app/(dashboard)/layout.tsx` | Modify | Over-limit banner |
| `.env.local` | Modify | Stripe keys (not committed) |
