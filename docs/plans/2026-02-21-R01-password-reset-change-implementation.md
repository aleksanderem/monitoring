# R01: Password Reset & Password Change — Implementation Plan

## Prerequisites

- Resend API configured (already done — RESEND_API_KEY env var)
- `@convex-dev/auth` installed with Password provider (already done)
- Login and register pages working (already done)

## Task Breakdown

### Task 1: Configure Password provider with reset EmailConfig

- **Files to modify**: `convex/auth.ts`, `convex/actions/sendEmail.ts`
- **What to implement**:
  - Update `Password` provider in `convex/auth.ts` to include `reset` config with `sendVerificationRequest`
  - The `sendVerificationRequest` function receives `{ identifier (email), token (OTP code) }` and sends email via Resend
  - Rewrite `sendPasswordReset` in sendEmail.ts to accept an OTP code instead of a link-based token. The email shows the code prominently (large monospace text) instead of a button linking to a URL.
  - Add `validatePasswordRequirements` to Password config (min 8 chars, uppercase, lowercase, number — matching register page validation)
- **Depends on**: Nothing
- **Test requirements**: Backend test that Password provider is configured with reset config (unit test verifying config shape)
- **Done when**: `signIn("password", { email, flow: "reset" })` triggers an email send with OTP code

### Task 2: Create /forgot-password page

- **Files to create**: `src/app/(auth)/forgot-password/page.tsx`
- **What to implement**:
  - Two-step form within one page (no separate route for code entry):
    - Step 1: Email input + "Send reset code" button
    - Step 2 (shown after code sent): OTP code input + new password input + confirm password input + "Reset password" button
  - Use `useAuthActions().signIn("password", { email, flow: "reset" })` for step 1
  - Use `signIn("password", { email, code, newPassword, flow: "reset-verification" })` for step 2
  - On success: user is auto-signed-in, redirect to `/domains`
  - Resend code link with 60s client-side cooldown timer
  - Error handling: invalid email (generic message), invalid/expired code, weak password
  - Match existing auth page layout (dark bg, centered card, AppLogo, same width/padding as login)
  - Password strength requirements displayed (same as register page: 8+ chars indicator)
- **Depends on**: Task 1
- **Test requirements**: Frontend data flow test — renders step 1, simulates submit, shows step 2, simulates reset-verification
- **Done when**: User can navigate to /forgot-password, enter email, receive code, enter code + new password, get signed in

### Task 3: Add "Forgot password?" link to login page

- **Files to modify**: `src/app/(auth)/login/page.tsx`
- **What to implement**:
  - Add a "Forgot password?" link between the password field and the submit button (or below the form, matching common placement)
  - Use existing translation key `t("forgotPassword")` which already exists in both EN and PL
  - Link to `/forgot-password` using Next.js `<Link>` or the Button component with `href`
- **Depends on**: Task 2
- **Test requirements**: Smoke test that link renders and points to correct href
- **Done when**: Login page shows clickable "Forgot password?" that navigates to /forgot-password

### Task 4: Add Security/Password section in Settings

- **Files to modify**: `src/app/(dashboard)/settings/page.tsx`, `src/messages/en/settings.json`, `src/messages/pl/settings.json`
- **What to implement**:
  - Add new "Security" tab to the settings tabs array (id: "security", icon: Lock01 or Shield01)
  - Create `SecuritySection` component within the settings page
  - SecuritySection has a "Change password" flow:
    - Initial state: Description text + "Change password" button
    - Step 1 (after click): "We'll send a verification code to [user email]" + "Send code" button
    - Step 2 (after code sent): Code input + new password + confirm password + "Update password" button
    - Success: toast "Password changed successfully", reset to initial state
  - Uses same `signIn("password", { email, flow: "reset" })` and `signIn("password", { email, code, newPassword, flow: "reset-verification" })` as forgot-password
  - Get current user email via `useQuery(api.auth.getCurrentUser)`
  - Error handling: expired code, weak password, same as forgot-password
- **Depends on**: Task 1
- **Test requirements**: Data flow integration test — SecuritySection renders, shows change password flow states
- **Done when**: Settings > Security tab shows working password change flow

### Task 5: Remove broken changePassword mutation

- **Files to modify**: `convex/users.ts`
- **What to implement**:
  - Delete the `changePassword` mutation (lines 74-102) — it's a broken stub that throws an error
  - Password change now happens client-side via the Convex Auth reset flow
  - Check if anything imports/calls `changePassword` and remove those references
- **Depends on**: Task 4 (to verify nothing needs it)
- **Test requirements**: Verify no imports reference the deleted mutation
- **Done when**: `changePassword` mutation is gone, no broken references, `next build` passes

### Task 6: Add translation keys

- **Files to modify**: `src/messages/en/auth.json`, `src/messages/pl/auth.json`, `src/messages/en/settings.json`, `src/messages/pl/settings.json`
- **What to implement**:
  - Auth translations (for forgot-password page):
    - `forgotPasswordTitle`: "Reset your password" / "Zresetuj hasło"
    - `forgotPasswordDescription`: "Enter your email and we'll send you a verification code." / "Podaj swój email, a wyślemy Ci kod weryfikacyjny."
    - `sendResetCode`: "Send reset code" / "Wyślij kod"
    - `resetCode`: "Verification code" / "Kod weryfikacyjny"
    - `enterResetCode`: "Enter the code from your email" / "Wpisz kod z maila"
    - `newPassword`: "New password" / "Nowe hasło"
    - `confirmPassword`: "Confirm password" / "Potwierdź hasło"
    - `resetPassword`: "Reset password" / "Zresetuj hasło"
    - `resetSuccess`: "Password reset successfully" / "Hasło zostało zresetowane"
    - `codeSent`: "Code sent to {email}" / "Kod wysłany na {email}"
    - `resendCode`: "Resend code" / "Wyślij ponownie"
    - `resendIn`: "Resend in {seconds}s" / "Wyślij ponownie za {seconds}s"
    - `invalidCode`: "Invalid or expired code" / "Nieprawidłowy lub wygasły kod"
    - `passwordsDoNotMatch`: "Passwords do not match" / "Hasła się nie zgadzają"
    - `backToLogin`: "Back to login" / "Wróć do logowania"
  - Settings translations (for security tab):
    - `tabSecurity`: "Security" / "Bezpieczeństwo"
    - `securityTitle`: "Password" / "Hasło"
    - `securityDescription`: "Change your account password" / "Zmień hasło do konta"
    - `changePassword`: "Change password" / "Zmień hasło"
    - `changePasswordDescription`: "We'll send a verification code to your email to confirm the change." / "Wyślemy kod weryfikacyjny na Twój email, aby potwierdzić zmianę."
    - `passwordChanged`: "Password changed successfully" / "Hasło zostało zmienione"
- **Depends on**: Nothing (can be done in parallel with Task 1)
- **Test requirements**: i18n validation test covers new keys
- **Done when**: All keys present in both EN and PL files

### Task 7: Update email template for OTP code

- **Files to modify**: `convex/actions/sendEmail.ts`
- **What to implement**:
  - Rewrite `sendPasswordReset` to show OTP code instead of link:
    - Subject: "Kod resetowania hasła — doseo" / keep polish for now
    - Body: "Twój kod weryfikacyjny:" + large code display
    - Code display: centered, large font (32px), monospace, letter-spacing for readability, background highlight
    - Keep 1-hour expiry notice
    - Keep "if you didn't request this" disclaimer
    - Same brand style as other emails (purple header, white body, gray footer)
  - Rename to `sendPasswordResetCode` for clarity (update all references)
  - This function will be called from the Password provider's `sendVerificationRequest` config
- **Depends on**: Nothing (can be done in parallel)
- **Test requirements**: Unit test that email HTML contains the code and correct structure
- **Done when**: Email template renders OTP code prominently


## Agent Team Plan

```
Team: R01-password-reset
├── team-lead (you) — coordinates, creates session tracking, final verification
├── backend-agent — Task 1 (auth config), Task 5 (remove mutation), Task 7 (email template)
├── frontend-agent — Task 2 (forgot-password page), Task 3 (login link), Task 4 (settings security), Task 6 (translations)
└── test-agent — all test files after Tasks 1-4 complete
```

### Execution order:
1. **Parallel wave 1**: backend-agent (Task 1 + Task 7), frontend-agent (Task 6 — translations)
2. **Parallel wave 2**: frontend-agent (Task 2 + Task 3 + Task 4), backend-agent (Task 5)
3. **Wave 3**: test-agent writes all tests once implementation is stable
4. **Final**: team-lead runs verification checklist


## Test Strategy

### Backend Tests

File: `convex/tests/auth-password-reset.test.ts` (new)
- Test that Password provider config includes reset EmailConfig
- Test that sendPasswordResetCode action sends email with code (mock Resend, verify HTML contains code)
- Test that changePassword mutation is removed (import should fail or not exist)

### Frontend Tests — Forgot Password Page

File: `src/test/integration/forgot-password-flows.test.tsx` (new)

Fixtures needed: user fixture with email (exists in `src/test/fixtures/user.ts`)

Test cases:
1. **Renders step 1**: email input and send button visible
2. **Step 1 → Step 2 transition**: after signIn("reset") call, shows code input + password fields
3. **Successful reset**: signIn("reset-verification") called with correct args (email, code, newPassword), redirects to /domains
4. **Invalid code error**: signIn throws, error message displayed
5. **Password mismatch**: confirm password doesn't match, button disabled or error shown
6. **Resend cooldown**: after sending code, resend link shows countdown timer
7. **Back to login link**: navigates to /login

Mock pattern:
- Mock `useAuthActions` to return a controlled `signIn` function
- First call (reset) resolves successfully
- Second call (reset-verification) resolves or rejects based on test

### Frontend Tests — Settings Security Section

File: `src/test/integration/settings-security-flows.test.tsx` (new)

Test cases:
1. **Renders security tab**: tab visible in settings, click shows SecuritySection
2. **Initial state**: shows "Change password" button, no form
3. **Send code flow**: click button → shows "sending to [email]" → code input appears
4. **Successful password change**: toast success, form resets
5. **Error handling**: invalid code shows error message

### Frontend Tests — Login Page Link

Add to existing settings test or create minimal test:
1. **Forgot password link renders**: link with href="/forgot-password" is in the DOM

### Component Tests

No new reusable components — all UI is page-specific.


## Fixture Requirements

Extend existing `src/test/fixtures/user.ts`:
- Ensure `USER_AUTHENTICATED` fixture has `email` field for testing email display in settings security section

No new fixture files needed — password reset is client-side auth flow, no new Convex queries to mock.


## Verification Checklist

- [ ] `next build` passes with zero errors
- [ ] `npm test` passes — all existing + new tests green
- [ ] `/forgot-password` page works: enter email → receive code → enter code + new password → signed in
- [ ] Login page "Forgot password?" link navigates to /forgot-password
- [ ] Settings > Security tab shows working password change flow
- [ ] Email template shows OTP code prominently (not a link)
- [ ] Error states handled: invalid code, weak password, password mismatch
- [ ] `changePassword` mutation removed from users.ts, no broken imports
- [ ] Translation keys present in both EN and PL
- [ ] No console.error in browser during manual walkthrough
- [ ] Existing auth flows (login, register) still work
