# R03: Stripe Production Readiness — Implementation Plan

## Task 1: Schema changes for dunning and trial tracking

Add to organizations table in convex/schema.ts:
- `gracePeriodEnd: v.optional(v.number())`
- `degraded: v.optional(v.boolean())`
- `trialRemindersSent: v.optional(v.object({ threeDays: v.optional(v.boolean()), oneDay: v.optional(v.boolean()) }))`

## Task 2: Email templates

Add to convex/actions/sendEmail.ts:
- `sendPaymentFailedNotice(to, orgName, portalUrl)` — payment failed, 7-day grace period, update payment link
- `sendTrialReminder(to, orgName, daysLeft, upgradeUrl)` — trial ending reminder
- `sendCancellationConfirmation(to, orgName, planName)` — subscription canceled
- `sendDegradationNotice(to, orgName, portalUrl)` — account degraded to read-only

## Task 3: Dunning webhook enhancement

Modify invoice.payment_failed handler in stripe_webhook.ts:
- Set gracePeriodEnd = now + 7 days on the org
- Look up org owner email
- Send failed payment email with billing portal link

Add new helper: `setGracePeriod` in stripe_helpers.ts

## Task 4: Grace period enforcement cron

Add to convex/stripe_helpers.ts:
- `checkGracePeriods` internal mutation: query orgs with past_due status and gracePeriodEnd < now, set degraded=true, send degradation notice email

Add to convex/crons.ts:
- Daily cron at 5 AM UTC calling checkGracePeriods

## Task 5: Trial reminder cron

Add to convex/stripe_helpers.ts:
- `checkTrialReminders` internal action: query trialing orgs, calculate days left, send reminders, mark sent

Add to convex/crons.ts:
- Daily cron at 7 AM UTC calling checkTrialReminders

## Task 6: Cancellation confirmation email

Modify `cancelSubscription` in stripe_helpers.ts:
- After downgrading to Free, look up org owner email
- Schedule cancellation confirmation email

## Task 7: Invoice list

Add to convex/stripe.ts:
- `getInvoices` action: calls Stripe API, returns last 12 invoices

Add to settings/page.tsx PlanUsageSection:
- Invoice table section with date, amount, status, PDF link

## Task 8: Payment method update button

Add to settings/page.tsx PlanUsageSection:
- "Update payment method" button that opens billing portal

## Task 9: Tests

Add tests to:
- convex/stripe_helpers.test.ts: setGracePeriod, checkGracePeriods, checkTrialReminders, cancellation email scheduling
- convex/stripe_webhook.test.ts: enhanced invoice.payment_failed handler
