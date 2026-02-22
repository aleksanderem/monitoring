# R01: Password Reset & Password Change — Design

## Problem Statement

Users have no way to recover their accounts if they forget their password, and no way to change their password if it's compromised. The login page has a "Forgot password?" button that links to nothing. The `changePassword` mutation in users.ts throws an error. The `sendPasswordReset` email template exists and works, but nothing in the app calls it.

User stories:
- "As a user who forgot my password, I need to reset it via email so I can regain access to my account."
- "As a logged-in user, I need to change my password from settings so I can secure my account after a potential breach."
- "As an agency admin, I need my team members to be able to self-service password resets without contacting me."

Business impact: Without password reset, any locked-out user requires manual admin intervention or is permanently lost.


## Current State Analysis

### What works
- Login (`/login`) and register (`/register`) pages work via `@convex-dev/auth` Password provider
- `signIn("password", { email, password, flow: "signIn" })` authenticates users
- `sendPasswordReset` action in `convex/actions/sendEmail.ts` can send a styled HTML email with a reset link
- Forgot password UI component exists at `src/components/shared-assets/forgot-password/step-sidebar-version.tsx` (mockup, not integrated)
- Translation keys exist: `forgotPassword` in both EN and PL

### What's broken or missing
- `changePassword` mutation (convex/users.ts:74-102) validates new password format but throws: "Password change functionality requires integration with authentication provider"
- No `/forgot-password` route exists
- No `/reset-password` route exists (but email template links to it)
- Login page "Forgot password?" button has no working href
- No password reset token generation or validation
- No password change UI in settings page
- Password provider configured without `reset` EmailConfig — built-in reset flow not activated

### Key discovery
`@convex-dev/auth` Password provider natively supports:
- `flow: "reset"` — generates OTP, calls `sendVerificationRequest` from `reset` EmailConfig
- `flow: "reset-verification"` — verifies OTP code + sets new password
- `reset: EmailConfig` config option — plug in email sending function

This means we configure the library, not build token management from scratch.


## Proposed Solution

### Architecture: Use Convex Auth's built-in reset flows

Configure Password provider with `reset` EmailConfig that sends OTP codes via Resend. The library handles token generation, storage, expiry, and verification. We provide the email delivery function.

### Password Reset Flow (forgot password, unauthenticated)

```
User clicks "Forgot password?" on login page
  → Navigates to /forgot-password
  → User enters email, clicks "Send reset code"
  → Frontend calls: signIn("password", { email, flow: "reset" })
  → Convex Auth generates 8-char OTP code
  → Convex Auth calls our sendVerificationRequest(email, code)
  → We send styled email via Resend with the OTP code
  → User receives email, enters code + new password on /reset-password
  → Frontend calls: signIn("password", { email, code, newPassword, flow: "reset-verification" })
  → Convex Auth verifies code, hashes new password, updates auth record
  → User is signed in automatically
  → Redirect to /domains
```

### Password Change Flow (logged in, from settings)

```
User navigates to Settings → Security tab
  → User clicks "Change password"
  → Frontend calls: signIn("password", { email: currentUserEmail, flow: "reset" })
  → Same OTP flow as above — code sent to user's email
  → User enters code + new password in modal/inline form
  → Frontend calls: signIn("password", { email, code, newPassword, flow: "reset-verification" })
  → Password updated
  → Show success toast
```

This approach is intentional: even for logged-in password changes, we verify via email. This is more secure than "enter current password" because it proves email ownership. Many modern apps (GitHub, Notion) use this pattern.

### Alternative considered: Direct password update for logged-in users
Rejected because:
- Would require accessing Convex Auth internal tables (fragile, breaks on library updates)
- Current password verification would need custom crypto integration
- Less secure — someone with physical access to unlocked browser could change password without email proof


## Data Model Changes

No schema changes needed. Convex Auth manages verification tokens internally in its `authVerificationCodes` and `authSessions` tables (part of `authTables`).


## API Design

### Backend changes

**convex/auth.ts** — Configure Password provider with reset:
```typescript
Password({
  reset: Resend({ from: process.env.EMAIL_FROM }),
  // or custom EmailConfig with sendVerificationRequest
})
```

Actually, we'll use a custom EmailConfig since we want our branded email template:
```typescript
Password({
  reset: {
    sendVerificationRequest: async ({ identifier, token }) => {
      // Send branded email via our Resend action
    }
  }
})
```

**convex/users.ts** — Remove or replace `changePassword` mutation:
- Delete the broken stubbed mutation
- Password change now happens via the reset flow (client-side, using signIn)

### Frontend changes

No new Convex queries or mutations needed — the reset flows use `signIn()` from `@convex-dev/auth/react` with different flow parameters.


## UI/UX Specification

### Page: /forgot-password

Route: `src/app/(auth)/forgot-password/page.tsx`

States:
1. **Initial**: Email input form + "Send reset code" button + "Back to login" link
2. **Loading**: Button shows spinner while sending code
3. **Code sent**: Show "Check your email" message with code input + new password input + confirm password input + "Reset password" button. Show email address where code was sent. "Resend code" link with cooldown timer (60s).
4. **Success**: "Password reset successfully" message + auto-redirect to /domains (user is signed in)
5. **Error states**:
   - Invalid email: "No account found with this email" (or generic "If an account exists, we sent a code" for security)
   - Invalid/expired code: "Invalid or expired code. Please request a new one."
   - Password too weak: Show requirements (8+ chars, uppercase, lowercase, number)
   - Rate limited: "Too many attempts. Please try again later."

Design: Match login/register page layout (auth layout with striped background).

### Settings: Security/Password section

Location: New tab or section in `src/app/(dashboard)/settings/page.tsx`

States:
1. **Default**: "Change password" button/section
2. **Code request**: "We'll send a verification code to your email (user@example.com)" + "Send code" button
3. **Code input**: Code input + new password + confirm password + "Update password" button
4. **Success**: Toast "Password changed successfully"
5. **Error states**: Same as forgot-password

### Login page update

Add working link to forgot-password page:
- "Forgot password?" text/button → links to `/forgot-password`


## Email Templates

### Password Reset Code Email

Rewrite existing `sendPasswordReset` to send an OTP code instead of a link:

- **When**: User triggers reset flow (forgot password or settings password change)
- **To**: User's email address
- **Subject**: "Kod resetowania hasła — doseo" / "Password reset code — doseo"
- **Content**:
  - Heading: "Reset hasła" / "Password reset"
  - Body: "Your verification code is:"
  - Code display: Large, monospace, centered: `ABCD1234`
  - Disclaimer: "This code expires in 1 hour. If you didn't request this, ignore this email."
- **Style**: Match existing email template (purple #7f56d9 brand, responsive HTML)
- **i18n**: Both PL and EN versions


## Security Considerations

- OTP codes managed by Convex Auth — automatic expiry, rate limiting at library level
- Use generic error messages for email not found (prevent user enumeration)
- Resend code cooldown (60s client-side, library handles server-side)
- New password validation: minimum 8 chars, uppercase, lowercase, number (matches existing register validation)
- Logged-in password change requires email verification (prevents unauthorized changes from shared/stolen sessions)
- No password reset tokens stored in our schema — library handles cleanup


## Dependencies

- No dependency on other roadmap items
- Resend API already configured and working
- `@convex-dev/auth` Password provider already installed
- Translation files already have `forgotPassword` key


## Open Questions

None — all architectural decisions are made. The Convex Auth built-in flow handles the complex parts (token management, expiry, verification). We provide email delivery and UI.
