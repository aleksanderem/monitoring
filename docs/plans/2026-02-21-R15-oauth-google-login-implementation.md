# R15: OAuth Login (Google) - Implementation Plan

## Task 1: Install @auth/core dependency

`@auth/core` provides the Google OAuth provider used by Convex Auth. Install it as a dependency.

## Task 2: Add Google OAuth provider to convex/auth.ts

Import `Google` from `@auth/core/providers/google` and add it to the providers array alongside the existing `Password` provider. The `afterUserCreatedOrUpdated` callback remains unchanged - it already handles both new and existing users correctly.

## Task 3: Create GoogleSignInButton component

A thin wrapper that calls `signIn("google")` using the existing `SocialButton` component. Only renders when `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"`.

## Task 4: Create OAuthDivider component

A simple "OR" divider with horizontal lines on each side: `─── OR ───`. Used between the Google button and the email form.

## Task 5: Update login page

Add GoogleSignInButton + OAuthDivider above the email/password form. When Google is not configured, page renders exactly as before.

## Task 6: Update register page

Add GoogleSignInButton + OAuthDivider above the email/name/password form in the right panel. Same conditional rendering.

## Task 7: Add translation keys

Add `orContinueWith` key to en/pl auth translation files for the divider text.

## Task 8: Update .env.example files

Add `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` to example env files.

## Task 9: Tests

- Test GoogleSignInButton renders when env var is set
- Test GoogleSignInButton does not render when env var is unset
- Test login page renders without Google button by default
- Test register page renders without Google button by default
- Test divider component renders correctly
