# Stripe Billing & Upgrade Flow — Design

## Goal

Add Stripe-powered subscription billing so users can upgrade from Free to Pro (monthly/yearly with 7-day trial), manage their subscription, and get downgraded gracefully when a subscription ends.

## Decisions

- Payment provider: Stripe
- Checkout: Stripe Checkout (hosted) — no embedded forms, no PCI scope
- Billing cycles: monthly + yearly (with ~20% yearly discount)
- Trial: 7 days on Pro plan
- Enterprise: "Skontaktuj się" (contact sales), no self-serve checkout
- Downgrade behavior: soft lock — data stays, user cannot add new resources above limit
- Pricing page: public `/pricing` page + upgrade button in Settings
- UI template: Untitled UI `pricing-pages/04`

## Architecture

### Data Flow

```
User clicks "Upgrade to Pro"
  → Convex action: createCheckoutSession(planKey, billingCycle)
  → Action calls Stripe API, creates Checkout Session (with 7-day trial)
  → Returns checkout URL
  → Frontend redirects to Stripe Checkout
  → User pays (or starts trial)
  → Stripe fires webhook → POST /api/stripe/webhook (Next.js route)
  → Route verifies signature, parses event
  → Calls Convex httpAction or mutation: handleSubscriptionEvent
  → Mutation: assignPlanToOrganization + saves Stripe fields on org
```

### Schema Changes

Add to `organizations` table:

```
stripeCustomerId: v.optional(v.string())        // Stripe Customer ID
stripeSubscriptionId: v.optional(v.string())     // active subscription
subscriptionStatus: v.optional(v.string())       // "active" | "trialing" | "past_due" | "canceled"
subscriptionPeriodEnd: v.optional(v.number())    // timestamp when subscription ends
billingCycle: v.optional(v.string())             // "monthly" | "yearly"
```

No separate subscriptions table — one org = one subscription.

### Backend

Convex actions (call Stripe API):
- `createCheckoutSession(planKey, billingCycle)` — creates Stripe Checkout Session, returns URL
- `createBillingPortalSession()` — Stripe Customer Portal for managing subscription/invoices

Next.js API route:
- `POST /api/stripe/webhook` — receives Stripe events, verifies signature, calls Convex mutations

Convex mutations (called by webhook):
- `handleSubscriptionEvent(event)` — handles:
  - `checkout.session.completed` → assign Pro plan, set subscription fields
  - `customer.subscription.updated` → sync status (trialing→active, past_due, etc.)
  - `customer.subscription.deleted` → downgrade to Free (soft lock)
  - `invoice.payment_failed` → set status "past_due"

### Frontend

Public `/pricing` page:
- Based on Untitled UI `pricing-pages/04` template
- 3 columns: Free / Pro / Enterprise
- Monthly/yearly toggle with visible discount
- Free: "Current plan" or "Get started"
- Pro: "Start 7-day trial" with price
- Enterprise: "Skontaktuj się"
- Feature comparison table

Settings > Plan i użycie:
- Existing view stays (badge, usage bars, modules)
- Add "Upgrade" button → redirects to /pricing or opens modal
- For paying users: "Manage subscription" → Stripe Customer Portal
- Subscription status display: "Trial (5 days left)", "Active", "Past due"

Redirect pages:
- `/pricing/success` — upgrade confirmation
- `/pricing/cancel` — checkout canceled, link back

### Downgrade (Soft Lock)

When subscription ends or user downgrades:
- `assignPlanToOrganization` with Free plan — copies lower limits
- Data is NOT deleted
- Existing keywords/domains/projects remain readable
- Adding new resources blocked when usage > limit (already works via `checkKeywordLimit` etc.)
- Banner in UI: "You've exceeded Free plan limits. Upgrade or remove excess resources."

### Stripe Products

- Product "Pro Plan" — two Prices: monthly and yearly
- Monthly product: `prod_TznkTT05Tn229P`
- Yearly product: `prod_TznlqN2X3TDdav`
- Price IDs to be fetched from these products and stored in env vars
- Trial: 7 days, configured at Checkout Session level

### Environment Variables

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

For local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
