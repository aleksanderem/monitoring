# R02: Email Verification on Registration — Design

## Problem Statement

New users can register with any email without confirmation. This allows typos (user registers with `john@gmial.com`, never receives emails, gets frustrated), fake/disposable accounts (spam bots, competitors scraping), and impersonation (registering with someone else's email). Users have no feedback that their email is wrong until they try to use email-dependent features (password reset, notifications, reports).

As an agency owner, I need confidence that team members registered with real email addresses so that billing notifications, report delivery, and account recovery all work reliably.

Business impact: unverified emails mean broken password reset (R01), broken email notifications (R08), broken report delivery (R09), and potential abuse of trial accounts.

## Current State Analysis

### Auth Configuration (`convex/auth.ts`)

Password provider is configured with `reset` EmailConfig for password reset (R01), but no `verify` option:

```typescript
Password({
  reset: Email({ id: "password-reset", sendVerificationRequest: async ({ identifier, token }) => { ... } }),
  validatePasswordRequirements: (password) => { ... },
})
```

Convex Auth's Password provider supports a `verify` option that takes the exact same `Email()` pattern. When enabled, `signIn("password", { flow: "signUp" })` sends a verification code instead of immediately signing in. The user must then call `signIn("password", { flow: "email-verification", code, email })` to complete registration.

### Registration Flow (`src/app/(auth)/register/page.tsx`)

Current flow is single-step: form submission calls `signIn("password", { email, password, name, flow: "signUp" })` and immediately redirects to `/domains`. No verification step exists.

### Email Infrastructure (`convex/actions/sendEmail.ts`)

Resend is configured and working. Five email actions exist (send, sendWelcome, sendTeamInvitation, sendPasswordResetCode, sendSubscriptionConfirmation). The password reset email template uses branded HTML with OTP code display. This pattern can be reused for verification emails.

### Existing UI Components

- `PinInput` component (`src/components/base/pin-input/pin-input.tsx`) — OTP input with slots, built on `input-otp` library. Already installed and ready.
- `Progress` step components (`src/components/application/progress-steps/`) — multi-step indicators.
- `FeaturedIcon` component for decorative icons.
- `BackgroundPattern` for visual interest.

### UntitledUI Templates Available

The user has identified these pre-built templates to install and adapt:
- `step-1-check-email` — "Check your email" screen after code is sent
- `step-2-enter-code-manually` — OTP code entry screen
- `step-3-success` — Success confirmation screen
- `simple-verification` — Email template for verification codes

These provide production-quality UI that matches our existing auth page patterns and should be adapted to our dark-mode glassmorphism card style.

## Proposed Solution

### Architecture

Add the `verify` EmailConfig to the existing Password provider. This is the minimal change — Convex Auth handles token generation, storage, validation, and expiration internally. No custom token tables or verification logic needed.

The registration flow becomes a 3-step process:

1. **Register** — User fills out name, email, password → backend sends OTP code → UI transitions to step 2
2. **Enter Code** — User enters 8-digit OTP from email → backend validates → user signed in → UI transitions to step 3
3. **Success** — Confirmation screen with redirect to `/domains`

### Why OTP (not magic link)?

- Consistent with R01 (password reset uses OTP)
- Works better cross-device (user may register on desktop, check email on phone)
- PinInput component already installed
- Convex Auth Password `verify` generates OTP codes, not links

### Why not a separate `/verify-email` page?

The verification step happens inline on the register page as a multi-step form. Reasons:
- User context is preserved (email is in state, no URL params needed)
- Simpler — no new route, no token-in-URL security concerns
- Consistent with R01 (forgot-password handles both steps on one page)
- UntitledUI templates are designed as inline steps, not separate pages

### Alternative considered: Blocking middleware guard

Could add middleware that redirects unverified users to a verification page. Rejected because Convex Auth handles this at the `signIn` level — if `verify` is configured, the user simply isn't signed in until verification completes. No session exists to guard against.

## Data Model Changes

### No schema changes needed

Convex Auth manages email verification state internally via the `emailVerificationTime` field on the users table (already exists in the auth schema). When a user verifies their email, Convex Auth sets this timestamp. No custom tables, no migration.

### Password provider configuration change

```typescript
// convex/auth.ts — add verify alongside existing reset
Password({
  verify: Email({
    id: "email-verification",
    sendVerificationRequest: async ({ identifier, token }) => {
      // Send branded verification email via Resend
    },
  }),
  reset: Email({ ... }), // existing R01 config
  validatePasswordRequirements: (password) => { ... }, // existing
})
```

## API Design

### No new Convex functions needed

The entire flow uses Convex Auth's built-in `signIn` function with different `flow` values:

| Step | Client Call | What Happens |
|------|------------|--------------|
| Register | `signIn("password", { email, password, name, flow: "signUp" })` | Creates user, sends OTP, returns without signing in |
| Verify | `signIn("password", { email, code, flow: "email-verification" })` | Validates OTP, signs user in, sets emailVerificationTime |
| Resend | `signIn("password", { email, password, flow: "signUp" })` | Re-sends OTP (same call as step 1) |

The `signIn` function with `verify` enabled returns a `{ signingIn: false }` result when verification is needed (signUp flow), and `{ signingIn: true }` when verification succeeds (email-verification flow).

### New email action (optional, for template reuse)

A `sendEmailVerification` function in sendEmail.ts is NOT needed — the `verify` EmailConfig's `sendVerificationRequest` callback handles sending directly. The email HTML template is defined inline in the config (same pattern as password reset).

## UI/UX Specification

### Modified page: `/register` (3-step inline flow)

**Step 1: Registration Form** (current behavior, minimal changes)
- Same layout: left panel features, right panel form
- Same fields: name, email, password with strength indicator
- Change: on submit, if `signIn` returns without signing in, transition to step 2 instead of redirecting
- Change: store email in state for step 2

**Step 2: Check Email + Enter Code** (new, using UntitledUI templates)
- Install `step-1-check-email` and `step-2-enter-code-manually` templates as reference
- Show: Mail icon (FeaturedIcon), "Check your email" heading, "We sent a verification code to {email}" description
- PinInput with 8 digit slots for OTP entry
- "Didn't receive the email? Click to resend" with 60-second cooldown (same pattern as R01)
- "Back to registration" link to go back to step 1
- Submit button validates code via `signIn("password", { flow: "email-verification", code, email })`
- On success → transition to step 3

**Step 3: Success** (new, using UntitledUI template)
- Install `step-3-success` template as reference
- Show: checkmark icon (FeaturedIcon), "Email verified" heading, "Your account has been created successfully" description
- Auto-redirect to `/domains` after 2 seconds
- "Continue to dashboard" button for immediate navigation

**States handled:**
- Loading (spinner on submit button during each step)
- Error — invalid code (error message below PinInput, keep form state)
- Error — expired code (error message suggesting resend)
- Error — registration failed (show error in step 1)
- Resend cooldown (60s timer, disabled resend link)

### Styling

All steps use the existing dark-mode auth card pattern:
```
max-w-md, rounded-xl, border-white/10, bg-gray-900/80, backdrop-blur-sm, p-8
```

Step 2 and 3 use the narrower single-column layout (like login/forgot-password) since they don't need the features panel.

## Email Template

### Verification Code Email

Subject: `Kod weryfikacyjny — doseo` / `Verification code — doseo`

Template follows the exact same pattern as the password reset email (branded header, code display, footer). Content differences:
- Heading: "Weryfikacja email" / "Email Verification"
- Body: "Twój kod weryfikacyjny:" / "Your verification code:"
- Footer note: "Kod jest ważny przez 1 godzinę. Jeśli nie zakładałeś konta w doseo, zignoruj tego maila."

The `simple-verification` UntitledUI email template should be reviewed for design inspiration, but the actual HTML will match our existing email template style (purple #7f56d9 header, white card body, monospace code display).

## Security Considerations

- OTP codes generated by Convex Auth (cryptographically random)
- Codes expire after configurable period (default 1 hour, matching R01)
- Rate limiting: 60-second resend cooldown on client side. Convex Auth has built-in server-side rate limiting for verification requests.
- No user enumeration: if email already exists, Convex Auth returns a generic error (same behavior as current signUp)
- Code validation happens server-side (Convex Auth handles comparison, invalidation after use)
- Welcome email still sent after successful verification (via afterUserCreatedOrUpdated callback — this fires when the user record is created during signUp, before verification)

### Consideration: Welcome email timing

Currently the welcome email fires in `afterUserCreatedOrUpdated` which triggers during signUp (before verification). With `verify` enabled, the user record is still created during signUp, so the welcome email will fire before the email is verified. This is acceptable — the welcome email is informational, not transactional. If we want to delay it until after verification, we'd need to check `emailVerificationTime` in the callback, but that adds complexity for minimal benefit.

## Dependencies

- R01 (Password Reset) — DONE. Shares the same Password provider config and email infrastructure.
- Resend API key — already configured.
- `input-otp` package — already installed (used by PinInput component).
- UntitledUI templates: `step-1-check-email`, `step-2-enter-code-manually`, `step-3-success`, `simple-verification` — to be installed during implementation.

## Open Questions

1. **Code length: 6 digits or 8 digits?**
   - R01 uses whatever Convex Auth generates by default
   - Convex Auth docs example shows 8-digit OTP
   - Recommendation: 8 digits for consistency with the docs example, using the `@oslojs/crypto` random generator pattern
   - Can be configured in the Email provider's `generateVerificationToken`

2. **Should existing unverified users be forced to verify on next login?**
   - With `verify` on Password provider, ALL sign-ins (not just sign-ups) will require verification if email isn't verified yet
   - This is the correct behavior — it gradually verifies all existing users
   - No migration needed, Convex Auth handles this automatically

3. **Email language: Polish only or detect locale?**
   - Current password reset email is Polish-only
   - Recommendation: Keep Polish for now (matches R01), add locale detection in R22 (i18n completion)
