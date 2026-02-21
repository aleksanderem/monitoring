# R15: OAuth Login (Google) - Design Document

## Current State

The application uses `@convex-dev/auth` with the `Password` provider for email/password authentication. The auth flow is:

1. User visits `/login` or `/register`
2. Submits email + password via `useAuthActions().signIn("password", { ... })`
3. Convex Auth validates credentials and creates session
4. On new user signup, `afterUserCreatedOrUpdated` callback creates organization, team, default plan assignment, and sends welcome email

Key files:
- `convex/auth.ts` - Password provider + afterUserCreatedOrUpdated callback
- `convex/auth.config.ts` - Basic provider config with CONVEX_SITE_URL
- `convex/http.ts` - HTTP router with auth routes
- `src/app/(auth)/login/page.tsx` - Login form (email/password only)
- `src/app/(auth)/register/page.tsx` - Register form with features panel

Existing assets that support this feature:
- `SocialButton` component with Google variant already exists
- `GoogleLogo` SVG component with colorful mode exists
- Translation keys `signInWithGoogle` already defined in en/pl

## Google OAuth Integration with Convex Auth

Convex Auth supports OAuth providers from `@auth/core/providers`. For Google:

1. Import `Google` from `@auth/core/providers/google`
2. Add to the `providers` array in `convexAuth()`
3. Set environment variables `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` on the Convex backend
4. Frontend calls `signIn("google")` which triggers the OAuth redirect flow
5. Callback URL: `https://{deployment}.convex.site/api/auth/callback/google`

## Account Linking

When a user registers with email/password and later tries Google OAuth with the same email (or vice versa), Convex Auth handles this through its `authAccounts` table. Each auth method creates a separate `authAccount` record linked to the same `users` record via the email address. The `afterUserCreatedOrUpdated` callback receives `existingUserId` when the user already exists, so no duplicate organization is created.

## New User Flow via Google

When a brand-new user signs in with Google:
1. Convex Auth creates user record with email/name from Google profile
2. `afterUserCreatedOrUpdated` fires with `existingUserId = undefined`
3. Same org/team/plan creation logic runs as for password signups
4. User is redirected to `/domains` (same as current flow)

No separate onboarding step is needed - the existing callback handles everything.

## UI Changes

Both login and register pages get a Google button above the email form, separated by an "OR" divider with horizontal lines.

Layout:
```
[Google Sign-In Button]
─────── OR ───────
[Email/Password Form]
```

The Google button uses the existing `SocialButton` component with `social="google"`. It only renders when the `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` env var is set to "true" (a client-side flag indicating Google OAuth is configured on the backend).

## Environment Variables

Backend (Convex dashboard):
- `AUTH_GOOGLE_ID` - Google OAuth Client ID
- `AUTH_GOOGLE_SECRET` - Google OAuth Client Secret

Frontend (Next.js .env.local):
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` - "true" to show Google button (defaults to hidden)

## Security

- OAuth state parameter: Handled automatically by Convex Auth / Auth.js
- PKCE: Handled by Auth.js OAuth flow
- Nonce: Standard Auth.js implementation
- CSRF: Convex Auth handles token verification
- No credentials stored client-side - OAuth tokens managed server-side by Convex
