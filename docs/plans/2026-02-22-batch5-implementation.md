# Batch 5 Implementation Plan — R25 (2FA), R28 (CI/CD), R34 (Accessibility), R35 (Health)

> **For Claude:** Each task is a standalone worktree agent. Agent must implement code + tests + commit.

**Goal:** Complete 4 Tier 3 items. R25 adds TOTP 2FA setup UI. R28 adds GitHub Actions CI. R34 adds accessibility improvements. R35 adds health endpoint and status page.

**Architecture:** All 4 items are fully independent — no cross-dependencies.

---

## Task 1: R25 — 2FA / TOTP Setup

**Goal:** Add TOTP-based 2FA setup and management to the security settings. Store TOTP secrets, generate QR codes, verify codes, manage backup codes.

### Files to Create
- `convex/mfa.ts` — MFA settings management, TOTP verification
- `src/components/settings/TwoFactorSetup.tsx` — 2FA setup/management UI
- `src/test/integration/r25-two-factor.test.tsx`

### Files to Modify
- `convex/schema.ts` — add userMfaSettings table
- `src/messages/en/settings.json` — 2FA translations
- `src/messages/pl/settings.json` — 2FA translations

### Schema Addition
```typescript
userMfaSettings: defineTable({
  userId: v.id("users"),
  totpSecret: v.optional(v.string()),
  isEnabled: v.boolean(),
  backupCodes: v.optional(v.array(v.object({
    code: v.string(),
    usedAt: v.optional(v.number()),
  }))),
  enabledAt: v.optional(v.number()),
  lastVerifiedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"]),
```

### Backend (convex/mfa.ts)
- `getMfaStatus` query — returns { isEnabled, hasBackupCodes, enabledAt } for current user
- `initializeTotpSetup` mutation — generates random TOTP secret (32-char base32), stores on userMfaSettings with isEnabled=false, returns { secret, otpauthUrl } (otpauthUrl format: `otpauth://totp/DSEO:{email}?secret={secret}&issuer=DSEO`)
- `confirmTotpSetup` mutation — takes code, verifies against stored secret using time-based algorithm, sets isEnabled=true, generates 10 backup codes
- `disableTotp` mutation — sets isEnabled=false, clears secret
- `regenerateBackupCodes` mutation — generates new 10 codes, replaces existing
- `getBackupCodes` query — returns backup codes for current user (with used status)

Note: For TOTP verification, implement a simple time-based check: generate expected code = HMAC-SHA1(secret, floor(time/30)) and compare. Use built-in crypto APIs.

### Frontend (TwoFactorSetup.tsx)
- Shows current 2FA status (enabled/disabled)
- "Enable 2FA" button → shows QR code (encode otpauthUrl) + manual secret display
- Verification input (6-digit code)
- After verification: show backup codes (one-time display, prompt to save)
- "Disable 2FA" button with confirmation
- "Regenerate backup codes" button

### Tests (12+)
- getMfaStatus returns disabled for new user
- initializeTotpSetup generates secret
- confirmTotpSetup with wrong code fails
- disableTotp clears enabled status
- regenerateBackupCodes creates new codes
- TwoFactorSetup renders disabled state
- TwoFactorSetup shows QR code section after enable click
- TwoFactorSetup shows verification input
- TwoFactorSetup shows backup codes after verification
- TwoFactorSetup shows disable button when enabled
- TwoFactorSetup renders enabled state correctly

---

## Task 2: R28 — CI/CD Pipeline

**Goal:** Add GitHub Actions workflows for PR verification (build + test) and basic deployment readiness.

### Files to Create
- `.github/workflows/ci.yml` — PR and push workflow
- `.github/workflows/deploy.yml` — production deploy trigger (placeholder)
- `src/test/integration/r28-ci-cd.test.tsx` — tests for CI config validation

### CI Workflow (.github/workflows/ci.yml)
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx next build
      - run: npm test
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: coverage/
```

### Deploy Workflow (.github/workflows/deploy.yml)
```yaml
name: Deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy placeholder
        run: echo "Deploy to ${{ inputs.environment }} would happen here"
```

### Tests (6+)
- CI workflow YAML is valid (parse and check structure)
- CI workflow triggers on PR to main
- CI workflow triggers on push to main
- CI workflow has build step
- CI workflow has test step
- Deploy workflow has environment input

---

## Task 3: R34 — Accessibility Improvements

**Goal:** Add axe-core accessibility testing, fix common accessibility issues, add ARIA labels to key components, create accessibility statement page.

### Files to Create
- `src/app/(public)/accessibility/page.tsx` — accessibility statement
- `src/test/integration/r34-accessibility.test.tsx`

### Files to Modify
- `src/messages/en/common.json` — accessibility translations
- `src/messages/pl/common.json` — accessibility translations

### Accessibility Statement Page
Simple public page with:
- WCAG 2.1 AA compliance statement
- Known limitations
- Contact information for accessibility issues
- Technology list (React Aria, semantic HTML)

### Tests (10+)
- Accessibility statement page renders
- Key heading structure is correct
- ARIA landmarks present (main, nav, banner)
- Interactive elements have accessible names
- Form inputs have associated labels
- Modal dialogs have proper ARIA roles
- Loading states have aria-live regions
- Color contrast assertions (text colors)
- Keyboard navigation basics
- Screen reader content helpers

---

## Task 4: R35 — Health Checks & Status Page

**Goal:** Add /api/health endpoint, public status page showing service status, and basic uptime tracking.

### Files to Create
- `src/app/api/health/route.ts` — health check API endpoint
- `src/app/(public)/status/page.tsx` — public status page
- `convex/health.ts` — health queries
- `src/test/integration/r35-health-checks.test.tsx`

### Files to Modify
- `convex/schema.ts` — add healthChecks table
- `src/messages/en/common.json` — status page translations
- `src/messages/pl/common.json` — status page translations

### Schema Addition
```typescript
healthChecks: defineTable({
  timestamp: v.number(),
  status: v.string(), // "healthy", "degraded", "down"
  services: v.object({
    database: v.string(), // "up", "down"
    email: v.string(),
    api: v.string(),
    auth: v.string(),
  }),
  responseTimeMs: v.optional(v.number()),
})
  .index("by_timestamp", ["timestamp"]),
```

### Health Endpoint (src/app/api/health/route.ts)
```typescript
export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    uptime: process.uptime(),
    services: {
      app: "up",
    },
  };
  return Response.json(health);
}
```

### Backend (convex/health.ts)
- `getPublicHealth` query (no auth required) — returns latest health status
- `getHealthHistory` query (admin) — returns last 24h of health checks
- `recordHealthCheck` internalMutation — stores health check result

### Status Page
- Overall status indicator (green/yellow/red)
- Service status list (App, Database, Email, API)
- Last updated timestamp
- Simple, clean design

### Tests (10+)
- Health endpoint returns 200
- Health endpoint returns correct JSON structure
- Health endpoint has status field
- Health endpoint has timestamp
- Status page renders overall status
- Status page shows service list
- Status page renders healthy state
- Status page renders degraded state
- convex/health.ts getPublicHealth returns data
- convex/health.ts getHealthHistory returns array

---

## Agent Team Plan

All 4 tasks are independent:

| Agent | Task | Scope |
|-------|------|-------|
| r25-agent | R25 2FA/TOTP | mfa.ts, TwoFactorSetup, tests |
| r28-agent | R28 CI/CD | GitHub Actions workflows, tests |
| r34-agent | R34 Accessibility | Statement page, a11y tests |
| r35-agent | R35 Health Checks | Health endpoint, status page, tests |

No cross-dependencies.
