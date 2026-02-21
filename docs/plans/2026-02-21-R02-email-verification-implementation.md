# R02: Email Verification on Registration — Implementation Plan

## Prerequisites

- R01 (Password Reset) is complete — Password provider with `reset` config works
- Resend API key configured in Convex environment
- `SITE_URL` env var set in Convex deployment
- `input-otp` package installed (dependency of PinInput)
- UntitledUI CLI available (`npx untitledui@latest`)

## Task Breakdown

### Task 1: Install UntitledUI Templates

- **Files to create**: UntitledUI template files in `src/components/`
- **What to implement**:
  ```bash
  npx untitledui@latest add step-1-check-email -y
  npx untitledui@latest add step-2-enter-code-manually -y
  npx untitledui@latest add step-3-success -y
  npx untitledui@latest add simple-verification -y
  ```
  After install, review the generated files to understand their structure, props, and styling. These are reference templates — we will adapt their design language into our auth card style, not use them as-is in separate routes.
- **Depends on**: Nothing
- **Test requirements**: None (installation step)
- **Done when**: Templates installed, files exist, no import errors

### Task 2: Add `verify` EmailConfig to Password Provider

- **Files to modify**: `convex/auth.ts`
- **What to implement**:
  1. Create `buildEmailVerificationHtml(code: string): string` function — branded HTML email template matching existing password reset template style. Review the installed `simple-verification` UntitledUI email template for design cues.
  2. Add `verify` option to Password provider:
     ```typescript
     Password({
       verify: Email({
         id: "email-verification",
         sendVerificationRequest: async ({ identifier, token }) => {
           const key = process.env.RESEND_API_KEY;
           if (!key) throw new Error("RESEND_API_KEY not configured");
           const resend = new Resend(key);
           await resend.emails.send({
             from: "doseo <noreply@kolabogroup.pl>",
             to: identifier,
             subject: "Kod weryfikacyjny — doseo",
             html: buildEmailVerificationHtml(token),
           });
         },
       }),
       reset: Email({ ... }), // keep existing
       validatePasswordRequirements: (password) => { ... }, // keep existing
     })
     ```
  3. Optionally configure `generateVerificationToken` for 8-digit numeric codes using `@oslojs/crypto/random` (if default isn't 8 digits).
- **Depends on**: Nothing (can run in parallel with Task 1)
- **Test requirements**: Backend test verifying the provider config doesn't break existing auth flows
- **Done when**: `npx convex dev` starts without errors, sending a signUp request triggers a verification email

### Task 3: Add i18n Translation Keys

- **Files to modify**: `src/messages/en/auth.json`, `src/messages/pl/auth.json`
- **What to implement**: Add translation keys for the verification flow:

  **English keys:**
  ```json
  {
    "checkYourEmail": "Check your email",
    "verificationCodeSent": "We sent a verification code to",
    "enterVerificationCode": "Enter verification code",
    "verifyEmail": "Verify email",
    "verifying": "Verifying...",
    "didntReceiveEmail": "Didn't receive the email?",
    "clickToResend": "Click to resend",
    "resendingCode": "Resending...",
    "codeSentAgain": "Verification code sent again",
    "invalidVerificationCode": "Invalid verification code. Please try again.",
    "codeExpired": "Code has expired. Please request a new one.",
    "emailVerified": "Email verified",
    "accountCreatedSuccess": "Your account has been created successfully.",
    "continueToDashboard": "Continue to dashboard",
    "redirectingIn": "Redirecting in",
    "seconds": "seconds",
    "backToRegistration": "Back to registration"
  }
  ```

  **Polish keys:** matching translations.

- **Depends on**: Nothing (can run in parallel)
- **Test requirements**: None (translation keys)
- **Done when**: Both locale files have all required keys, `next build` passes

### Task 4: Refactor Register Page to Multi-Step Flow

- **Files to modify**: `src/app/(auth)/register/page.tsx`
- **What to implement**:

  This is the main implementation task. Transform the single-step register page into a 3-step flow.

  **State machine:**
  ```typescript
  type Step =
    | { type: "register" }                    // Step 1: form
    | { type: "verify"; email: string }       // Step 2: enter code
    | { type: "success" }                     // Step 3: done
  ```

  **Step 1 changes (registration form):**
  - Keep existing layout (left panel features, right panel form)
  - Modify `handleSubmit`: after `signIn("password", { flow: "signUp" })` resolves, check if user was immediately signed in (already verified) → redirect to `/domains`. Otherwise → transition to step 2 with email in state.
  - Handle errors: display in error banner (existing pattern)

  **Step 2 (check email + enter code):**
  - Adapt design from installed `step-1-check-email` and `step-2-enter-code-manually` templates
  - Switch to narrower single-column layout (drop the left features panel)
  - Components:
    - `FeaturedIcon` with `Mail01` icon (from `@untitledui/icons`)
    - Heading: t("checkYourEmail")
    - Description: t("verificationCodeSent") + ` ${email}`
    - `PinInput` with 8 slots for code entry
    - Submit button: t("verifyEmail")
    - Resend link with 60-second cooldown timer (reuse pattern from forgot-password)
    - Back link: t("backToRegistration") → return to step 1
  - On submit: `signIn("password", { email, code: pinValue, flow: "email-verification" })`
  - On success → transition to step 3
  - On error → show error below PinInput, keep state

  **Step 3 (success):**
  - Adapt design from installed `step-3-success` template
  - Narrower single-column layout
  - Components:
    - `FeaturedIcon` with `CheckCircle` icon (success color)
    - Heading: t("emailVerified")
    - Description: t("accountCreatedSuccess")
    - Auto-redirect countdown: "Redirecting in X seconds..."
    - Button: t("continueToDashboard") → `/domains`
  - `useEffect` with 3-second countdown → `router.push("/domains")`

  **Styling rules:**
  - Steps 2 and 3 use: `max-w-md rounded-xl border border-white/10 bg-gray-900/80 p-8 backdrop-blur-sm`
  - Step 1 keeps current wider layout with features panel
  - All text uses existing design tokens (`text-primary`, `text-tertiary`, etc.)
  - Dark mode only (auth pages are always dark)

- **Depends on**: Task 1 (templates for reference), Task 2 (verify config must be active), Task 3 (translation keys)
- **Test requirements**: Integration tests for all 3 steps (see Task 5)
- **Done when**: Registration flow works end-to-end: form → email sent → code entry → verified → redirect

### Task 5: Write Integration Tests

- **Files to create**:
  - `src/test/integration/R02-email-verification-flows.test.tsx`
  - `src/test/fixtures/email-verification.ts` (if needed — may reuse existing auth fixtures)

- **What to implement**:

  **Test cases for Step 1 (register form):**
  1. Renders registration form with name, email, password fields
  2. Shows password strength indicator
  3. On successful signUp (returns without signing in) → transitions to step 2
  4. On signUp error → shows error message, stays on step 1
  5. Features panel renders on desktop (lg breakpoint)

  **Test cases for Step 2 (verification):**
  6. Shows "Check your email" heading with user's email
  7. Renders PinInput with 8 slots
  8. On valid code submission → calls signIn with flow "email-verification"
  9. On invalid code → shows error message, stays on step 2
  10. Resend link has 60-second cooldown
  11. "Back to registration" returns to step 1

  **Test cases for Step 3 (success):**
  12. Shows "Email verified" heading
  13. Shows "Continue to dashboard" button
  14. Auto-redirects after countdown

  **Mock setup:**
  - Mock `useAuthActions` → `signIn` returns appropriate values per flow
  - Mock `useRouter` → track `push` calls
  - Mock `useTranslations` → return key as value

- **Depends on**: Task 4 (component must exist to test)
- **Test requirements**: All 13+ test cases pass
- **Done when**: `npm test -- R02` passes with all cases green

### Task 6: Verify Build & Existing Tests

- **Files**: None (verification step)
- **What to implement**:
  1. Run `next build` — must pass with zero errors
  2. Run `npm test` — ALL existing tests must still pass (no regressions)
  3. Manual verification: open `/register` in browser, complete full flow
- **Depends on**: Tasks 1-5
- **Test requirements**: Green build, green test suite
- **Done when**: Build passes, all tests pass, manual flow works

## Agent Team Plan

### Team Structure

```
Team: R02-email-verification
├── team-lead (coordinator) — reviews, resolves blockers, runs final verification
├── backend-agent — Task 2 (auth.ts verify config)
├── frontend-agent — Task 1 (install templates) → Task 4 (register page refactor)
├── test-agent — Task 3 (translations) → Task 5 (integration tests)
```

### Execution Order

```
Phase 1 (parallel):
  ├── backend-agent: Task 2 (add verify EmailConfig to auth.ts)
  ├── frontend-agent: Task 1 (install UntitledUI templates)
  └── test-agent: Task 3 (add i18n keys to en/pl)

Phase 2 (after Phase 1):
  └── frontend-agent: Task 4 (refactor register page to multi-step)

Phase 3 (after Phase 2):
  └── test-agent: Task 5 (write integration tests)

Phase 4 (after Phase 3):
  └── team-lead: Task 6 (build + test verification)
```

### Communication Points

- After Task 1: frontend-agent reports template file locations and component APIs found
- After Task 2: backend-agent confirms verify config works, reports any surprises
- After Task 4: frontend-agent signals test-agent to start writing tests
- After Task 5: test-agent reports test results, team-lead runs final verification

## Test Strategy

### Backend Tests

No separate Convex backend tests needed — the `verify` config uses Convex Auth's built-in flow, which is tested by the library. Our test surface is:
- The `sendVerificationRequest` callback sends email (verified by manual test and existing Resend integration)
- The OTP generation works (verified by the email-verification flow end-to-end)

### Frontend Tests (Data Flow Integration)

Per-step testing as described in Task 5. Key patterns:
- Mock `signIn` to return different results per flow:
  - `signUp` flow: resolves successfully (triggers step 2 transition)
  - `email-verification` flow: resolves successfully (triggers step 3 transition)
  - Error cases: rejects with Error (stays on current step, shows message)
- Mock `useRouter` to verify redirects
- Test PinInput interaction (entering digits, form submission)

### Component Tests

PinInput already has its own component — no new component tests needed. The register page steps are tested via integration tests.

## Fixture Requirements

Minimal fixtures needed — the registration flow primarily uses `signIn` which is mocked, not Convex queries. If needed:

```typescript
// src/test/fixtures/email-verification.ts
export const MOCK_VERIFICATION_EMAIL = "test@example.com";
export const MOCK_VERIFICATION_CODE = "12345678";
export const MOCK_USER_NAME = "Test User";
```

## Verification Checklist

Run AFTER all tasks are complete, BEFORE marking R02 as done:

- [ ] `next build` passes with zero errors
- [ ] `npm test` passes — all existing + new tests green
- [ ] Password provider has both `verify` and `reset` EmailConfig
- [ ] Registration flow: form → email sent → code entry → verified → redirect works
- [ ] Verification email arrives with branded template and correct code
- [ ] Invalid code shows error, doesn't sign in
- [ ] Resend cooldown works (60 seconds)
- [ ] "Back to registration" returns to form with state preserved
- [ ] Auto-redirect on success step works
- [ ] Login still works for already-verified users (no extra step)
- [ ] Login for unverified users triggers verification flow
- [ ] Password reset (R01) still works unchanged
- [ ] No console.error in browser during full flow
- [ ] Translations work in both EN and PL
