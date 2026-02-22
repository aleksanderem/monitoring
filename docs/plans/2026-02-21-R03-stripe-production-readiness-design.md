# R03: Stripe Production Readiness — Design

## Current State

Stripe billing core is implemented and working in test mode:
- Checkout flow (createCheckoutSession) with 7-day trial
- Billing portal (createBillingPortalSession) for subscription management
- Webhook handlers: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
- Subscription confirmation email on activation
- PlanUsageSection in Settings shows plan status, trial countdown, past_due warning
- Success/cancel pages for checkout redirect

## What's Missing

1. Dunning (failed payment handling with grace period and degradation)
2. Trial expiration reminders (3 days and 1 day before trial ends)
3. Auto-downgrade on trial end
4. Cancellation confirmation email
5. Invoice/receipt list in-app
6. Payment method update flow (dedicated, not just portal redirect)

## Design Decisions

### Dunning Strategy

When `invoice.payment_failed` fires:
1. Set org subscriptionStatus to "past_due" (already done)
2. Store `gracePeriodEnd` = now + 7 days on org
3. Send failed payment email with link to update payment method (Stripe billing portal URL)
4. After grace period (7 days), if still past_due: degrade org to read-only mode

Grace period enforcement: a daily cron checks orgs with subscriptionStatus="past_due" and gracePeriodEnd < now. For those, set a new field `degraded: true` on the org. The app checks `degraded` to block write operations.

Stripe handles retry logic automatically (Smart Retries). We just need to handle the status transitions.

### Schema Changes

Add to organizations table:
- `gracePeriodEnd: v.optional(v.number())` — timestamp when grace period expires after payment failure
- `degraded: v.optional(v.boolean())` — true when org is in read-only mode due to billing issues
- `trialRemindersSent: v.optional(v.object({ threeDays: v.optional(v.boolean()), oneDay: v.optional(v.boolean()) }))` — track which trial reminders have been sent

### Trial Reminder Flow

Daily cron job at 7 AM UTC:
1. Query all orgs where subscriptionStatus = "trialing"
2. Calculate days until subscriptionPeriodEnd
3. If 3 days left and threeDays reminder not sent: send email, mark sent
4. If 1 day left and oneDay reminder not sent: send email, mark sent

The auto-downgrade happens via existing webhook handler for customer.subscription.deleted (Stripe fires this when trial ends without payment method).

Note: Stripe also fires `customer.subscription.updated` with status change when trial converts to active. The existing handler already updates the status.

### Cancellation Confirmation Email

When `customer.subscription.deleted` webhook fires (in cancelSubscription helper):
- Look up org owner email
- Send cancellation confirmation email
- Email includes: plan name, effective date, link to re-subscribe

### Invoice List

Convex action `getInvoices` calls Stripe API:
- `stripe.invoices.list({ customer: stripeCustomerId, limit: 12 })`
- Returns: invoice number, date, amount, status, hosted_invoice_url (for PDF)

UI: new section in PlanUsageSection showing last 12 invoices in a table.

### Payment Method Update

Two approaches:
1. Stripe Billing Portal redirect (already available via createBillingPortalSession) — simplest
2. Stripe SetupIntent + Elements — more integrated but more complex

Decision: Use Stripe Billing Portal with a dedicated "Update payment method" button. The portal already supports this. We don't need a custom form. Add a distinct button in the billing UI separate from "Manage subscription" to make the payment update action more discoverable.

For dunning emails, include a direct link to the billing portal for updating payment method.

### Email Templates

New emails to add to `convex/actions/sendEmail.ts`:
1. `sendPaymentFailedNotice` — payment failed, grace period, update payment link
2. `sendTrialReminder` — trial ending in N days, upgrade prompt
3. `sendCancellationConfirmation` — subscription canceled, data preserved, re-subscribe link
4. `sendDegradationNotice` — grace period expired, account degraded to read-only

All emails follow the existing template pattern (branded HTML, Polish language).
