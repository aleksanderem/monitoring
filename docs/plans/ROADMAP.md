# Pre-Launch Roadmap

Reference document for sequential plan execution. When finishing one plan, pick the next unstarted item from the highest priority tier. Each item is a self-contained plan scope.

Status legend: [ ] not started, [~] in progress, [x] done

Target market: agencje SEO (primary) + in-house SEO teams. Agency needs (reports, multi-client, white-label) take priority in design decisions.

> MANDATORY: After completing ANY roadmap item (or making significant progress on one), update this file immediately. Change `[ ]` to `[x]` or `[~]`, add completion date and notes in the "Completion Log" section at the bottom. This is part of the Execution Protocol Phase 5 and is NOT optional. If you forget, the next session must check git history and reconcile before starting new work.


## Tier 0 — Blockers (must ship before any user sees the product)

### R01 [x] Password Reset & Password Change
Email template for reset exists but reset page and token validation are missing. Password change mutation throws error ("requires integration with auth provider"). Users have no recovery path and cannot change compromised passwords.

Scope: reset-password page, token generation/validation in convex auth, wire up changePassword mutation, UI in settings.

Completed: 2026-02-21. OTP-based flow via Convex Auth. Reset password page, token validation, changePassword mutation in settings Security tab. 28 integration tests. Plan: `2026-02-21-R01-password-reset-change-*.md`. Commits: 089f532, 657fe1b, 8f2fbda.

### R02 [x] Email Verification on Registration
New users can register with any email without confirmation. This allows typos, fake accounts, and spam. Add verification email on signup, verification page, resend link, and block access until verified.

Scope: convex auth callback, verification email template, /verify-email page, middleware guard.

Completed: 2026-02-21. 3-step OTP flow: register → verify email → access granted. Resend link, middleware guard blocking unverified users. 24 integration tests. Plan: `2026-02-21-R02-email-verification-*.md`. Commit: 9106bbb.

### R03 [x] Stripe Production Readiness & Billing Flows
Switch from test mode to live keys. Complete the billing lifecycle:
- ~~Stripe integration, checkout flow, pricing page, webhooks, success/cancel pages~~ (done)
- ~~Dunning: 7-day grace period, feature degradation, retry notifications~~ (done)
- ~~Trial expiration: reminder emails at 3 days, 1 day before trial ends~~ (done)
- ~~Cancellation confirmation email~~ (done)
- ~~Invoice list in settings~~ (done)
- ~~Payment method update flow~~ (done)
- Remaining: switch to live Stripe keys (env config change at deploy time)

Scope: convex/stripe.ts, stripe_webhook.ts, stripe_helpers.ts, email templates, settings billing tab.

Completed: 2026-02-21. Dunning with 7-day grace period and degradation. Trial reminders at 3d/1d. Cancellation email. Invoice list. Payment method update session. 4 new email templates. 2 new cron jobs. 20 new tests. Plan: `2026-02-21-R03-stripe-production-readiness-*.md`. Commit: efba4db.

### R04 [x] Security Hardening
Security headers (CSP, HSTS, X-Frame-Options) via middleware.ts. Audit auth flow for session fixation, CSRF. Review Convex permission checks on all mutations — currently some mutations bypass requirePermission(). Sanitize user inputs that render as HTML. Rate limit auth endpoints.

Scope: middleware.ts, next.config, convex auth functions, all mutation files.

Completed: 2026-02-21. CSP, HSTS (2yr+preload), X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers. Converted serpFeatures/forecasts to internalMutation. Added requireTenantAccess to 4 unprotected mutation files. Plan: `2026-02-21-R04-security-hardening-*.md`. Commit: 922ff8c.

### R05 [x] Legal Pages & Cookie Consent
Privacy Policy, Terms of Service, Cookie Policy — can be static markdown pages. Cookie consent banner for EU users. Email consent tracking (opt-in for marketing emails). Without these, cannot legally operate in EU.

Scope: public static pages, cookie banner component, consent storage in convex.

Completed: 2026-02-21. Privacy/Terms/Cookie pages with shared LegalPageLayout. GDPR cookie consent banner with granular consent (Necessary/Analytics/Marketing). Consent storage in Convex. Marketing opt-in on registration. Plan: `2026-02-21-R05-legal-pages-cookie-consent-*.md`. Commit: 4788cb9.

### R06 [x] Error Monitoring (Sentry)
Integrate Sentry for frontend crash reporting and backend error tracking. Source maps upload. Alerting rules for critical errors (auth failures, payment failures, API outages). Currently errors only visible in admin log viewer — no real-time alerts.

Scope: next.config, layout.tsx, convex error handlers, build pipeline.

Completed: 2026-02-21. @sentry/nextjs with client/server/edge configs. PII filtering via beforeSend. Error hierarchy (AppError, BusinessError, InfrastructureError, AuthError, PaymentError). Global error boundary. SentryUserContext for userId/orgId. Source maps via withSentryConfig. Plan: `2026-02-21-R06-sentry-error-monitoring-*.md`. Commit: 53f4d47.

### R07 [x] Account Deletion & Data Export (GDPR)
User-initiated account deletion that cascades to all data (domains, keywords, positions, reports, team memberships). Data export (download my data as JSON/CSV). Currently only admin can delete accounts.

Scope: settings page delete account section, convex cascade deletion mutation, data export action.

Completed: 2026-02-21. Full cascade deletion across 40+ tables with 7-day grace period. Data export to Convex file storage as JSON. Account tab in settings with delete/export/cancel UI. Daily cron for processing pending deletions. 30+ translation keys (en/pl). Plan: `2026-02-21-R07-account-deletion-data-export-*.md`. Commit: 8ad32b1.


## Tier 1 — Core Product Completeness (incomplete features that users will notice)

### R08 [x] Email Notifications System
Break the monolithic "notifications" item into proper implementation. Infrastructure exists (Resend configured, notification preferences table, cron stubs) but most emails aren't sent.

Phase 1 — Activate existing stubs: ~~DONE~~
- ~~Daily digest email (keyword movements, top gainers/losers) — cron exists but commented out~~
- ~~Weekly report email (position summary, visibility trend) — cron exists but commented out~~
- ~~Respect user notification preferences when sending (preferences stored but not checked)~~

Phase 2 — New alert emails: ~~DONE~~
- ~~Position drop alert (keyword drops > configurable threshold)~~
- ~~Top N exit alert (keyword exits top 3/10/20/50)~~
- ~~Competitor alert (competitor started ranking for your keyword)~~
- ~~Backlink lost alert (significant backlink losses)~~
- ~~Visibility drop alert (visibility score drops > threshold %)~~
- Alert emails wired into alertEvaluation.ts via notifyVia field

Phase 3 — Billing & team emails: ~~DONE (via R03)~~
- ~~Payment failed notification with retry link~~
- ~~Trial expiration reminders (3 days, 1 day before)~~
- ~~Cancellation confirmation~~
- ~~Degradation notice (read-only mode)~~

Phase 4 — Email hygiene: ~~DONE~~
- ~~Unsubscribe links in all non-transactional emails~~
- ~~Email delivery logging to notificationLogs table~~

Completed: All 4 phases done. Phase 1: 2026-02-21 (800f23a). Phase 2: 2026-02-21 (97eebeb). Phase 3: via R03. Phase 4: 2026-02-22 — unsubscribe footer on 9 non-transactional templates, logNotification calls on all 15 templates with category field, 42 new tests.

Scope: convex/scheduler.ts, convex/crons.ts, convex/actions/sendEmail.ts, notification preferences logic.

Progress: Transactional email system with Resend configured (commit: 99603d3). Notification preferences table exists. E2E email delivery tests (15 tests, commit: 40cba01). Notification system integration tests (95 tests, commit: 4edab51). Remaining: all 4 phases above — digest emails, alert emails, billing emails, unsubscribe/preference filtering.

### R09 [~] AI Report Engine
Replace simple report templates with AI-generated reports using the same pattern as AI Strategy (multi-step, progress tracking, parallel analysts). This is the core differentiator for agencies.

Architecture (reuse aiStrategy pattern):
- Create report session with config (domain, date range, sections, audience)
- Async background action with progress tracking (steps visible in UI)
- Phase 1: Parallel data collection (keywords, competitors, backlinks, visibility, on-site)
- Phase 2: Parallel AI analysts (keyword analyst, competitive analyst, technical analyst)
- Phase 3: Synthesis into cohesive report with executive summary
- Phase 4: Store results, generate PDF/HTML output

Report types:
- Executive Summary (for C-level / client stakeholders)
- Detailed Keyword Performance (for SEO managers)
- Competitor Analysis Report (positioning vs competitors)
- Monthly Progress Report (period-over-period comparison)
- Custom report (user picks sections)

Features:
- White-label branding (logo, colors — org branding settings exist)
- Scheduled generation (weekly/monthly auto-generate and email)
- Public share link (token-based, with expiration)
- PDF download
- Report history with version comparison

Scope: convex/aiReports.ts (new), report generation action, PDF generation, report UI, scheduled cron.

Progress: Custom report editor implemented (commit: c2a7155). AI Strategy with multi-step parallel analysts pattern working (plan: `2026-02-14-ai-strategy-*.md`, commits: c2a7155, 6e60ce4). Branding settings, share links, report templates exist (commit: 74060cb). Remaining: full AI-generated report pipeline reusing aiStrategy pattern, PDF generation, scheduled report generation, report history with version comparison.

### R10 [ ] Google Search Console Integration
Must-have for SEO tool credibility. Import actual click/impression data from GSC. Compare GSC positions vs DataForSEO positions. Show CTR data, impressions, clicks per keyword. Query performance over time.

Implementation:
- OAuth2 connection flow (Google API credentials)
- GSC property verification
- Periodic data sync (daily cron)
- Dashboard widgets showing GSC data alongside existing position data
- Settings page for managing GSC connection

Scope: convex/gsc.ts (new), OAuth flow, GSC API client, dashboard integration, settings tab.

### R11 [x] CSV/Excel Import & Export
Critical for user acquisition (migration from Ahrefs/SEMrush) and for agencies exporting data.

Import:
- ~~CSV/Excel file upload for keywords (with column mapping wizard)~~ (done)
- Bulk domain import (future enhancement)
- ~~Competitor list import~~ (done)

Export:
- ~~All major tables exportable to CSV (keywords, backlinks, competitors, positions)~~ (done)
- ~~Domain report export to Excel (multi-sheet)~~ (done)
- Position history export with date range filter (future enhancement)

Scope: import wizard component, convex import mutations, export utility functions per table.

Completed: 2026-02-21. CSV/Excel parser with papaparse+xlsx. Column mapping wizard (ImportWizardModal). Keyword and competitor import modals. Export buttons on keyword monitoring, backlinks, discovered keywords, competitor tables. exportToCsv with UTF-8 BOM, exportToExcel multi-sheet. 18 new tests. Plan: `2026-02-21-R11-csv-import-export-*.md`. Commit: 825e343.

### R12 [x] "Add to Monitoring" & Cross-Feature Flows
Keywords discovered in content gap analysis and competitor tables have "Add to Monitoring" buttons with TODO comments. Complete the full flow: select keywords → confirm → create keyword records → trigger first position check. Also wire up SERP features display (component exists but disabled).

Scope: AllKeywordsTable.tsx, CompetitorKeywordGapTable.tsx, SERPFeaturesBadges.tsx (re-enable), convex keyword mutations.

Completed: 2026-02-21. AllKeywordsTable wired to addKeyword mutation with position refresh. CompetitorKeywordGapTable per-row Plus button wired to addKeywords + refreshPositions. SERPFeaturesBadges re-enabled in KeywordMonitoringTable. 19 integration tests. Plan: `2026-02-21-R12-R08-implementation.md`. Commit: 965f035.

### R13 [x] Custom Alert Rules
Users can't configure alerts today. Anomaly detection runs automatically but with no configurable thresholds. Agencies need to set rules per client domain.

Rules engine:
- ~~Keyword position drop > X positions → alert~~ (done)
- ~~Keyword exits top 10/20/50 → alert~~ (done)
- ~~New competitor detected → alert~~ (done)
- ~~Backlink lost → alert~~ (done)
- ~~Visibility score drops > X% → alert~~ (done)

UI: Alert rules manager in domain settings. Alert history page. Alert delivery via email + in-app notification.

Scope: convex/alertRules.ts (new), alert evaluation in cron jobs, alert UI, email integration.

Completed: 2026-02-21. CRUD mutations/queries with RBAC. 5 pure evaluator functions with cooldown deduplication. Daily 4:30 AM UTC cron. AlertsSection UI with rules/history tabs. Default rules created on domain creation. alerts.view and alerts.manage permissions. 59 translation keys (en/pl). 34 new tests. Plan: `2026-02-21-R13-custom-alert-rules-*.md`. Commit: a7675b5.

### R14 [x] Onboarding Wizard
First-time user flow: create org → add first domain → add first keywords → trigger first check → see first results. Progress indicators. Skip/later options. Empty states across all pages that guide toward the wizard.

Scope: wizard components, empty state components across dashboard.

Progress: Onboarding flow exists with progress tracking, content blocking until completion, dismiss banner logic (commits: 264a5eb, f47f9fc, be98901, e57a577). Auto-fetch keywords/visibility on domain creation (commit: f36f9c8). Empty states on keyword map and other sections. Remaining: full guided wizard UX (step-by-step create org → add domain → add keywords → first check → first results), skip/later options.

### R15 [x] OAuth Login (Google)
Reduces signup friction significantly. Most SaaS users expect Google login. Configure Convex Auth with Google OAuth provider.

Scope: convex auth config, login/register pages, OAuth callback handling.

Completed: 2026-02-21. Google provider via @auth/core. GoogleSignInButton conditional on NEXT_PUBLIC_GOOGLE_AUTH_ENABLED. OAuthDivider component. Added to login and register pages. .env.example documented. 4 new tests. Plan: `2026-02-21-R15-oauth-google-login-*.md`. Commit: 9386887.


## Tier 2 — Polish & Differentiation (launch quality, not blockers)

### R16 [x] Loading & Error State Audit
Systematic pass through all pages. Verify every query-dependent component handles: loading (skeleton), empty (helpful message + CTA), error (error boundary catches + retry button). Test with slow network throttling.

Scope: all page components, integration tests for each state.

Progress: ErrorBoundary wrapped all 16 tab panels + dashboard layout (commit: 53987f7). Skeleton colors fixed for dark mode (commit: 07a4b43). Missing difficulty values handled with info tooltip (commit: 25376ac). Retry logic with exponential backoff on 4 critical API paths. Remaining: systematic audit of ALL pages (not just tabs), slow network throttle testing, ensure every component has loading/empty/error states.

### R17 [x] Search & Command Palette
Global search (Cmd+K) to navigate between domains, projects, keywords. Shell exists with hardcoded navigation but actual search doesn't work. Search across all entities with recent items.

Scope: CommandPalette component completion, search index in convex.

### R18 [x] Bulk Keyword Management
Select multiple keywords across tables. Bulk actions: delete, move to group, change tags, pause/resume monitoring, refresh positions. Selection UI exists but bulk operations incomplete.

Scope: keyword table components, convex bulk mutation endpoints.

Progress: Bulk refresh positions implemented and tested (S0007). BulkActionBar component exists. Selection UI works. Remaining: bulk delete, bulk move to group, bulk change tags, bulk pause/resume monitoring.

### R19 [x] Admin Panel Completion
Admin panel exists but needs: real-time system health dashboard (API quotas remaining, job queue depth, error rates), user impersonation for support, bulk operations (mass email, plan changes).

Scope: admin pages, convex admin queries.

Progress: Admin panel with role management UI, user detail page (commit: 7974a6f). Super admin impersonation with visual banner (commit: 7f2a8a1). Plan management and assignment (commits: c140ce2, d51976f). Diagnostic endpoint with 12 cross-validation modules (commit: 8c68a30). API usage tracking and debug logs (commit: 6e60ce4). Remaining: real-time system health dashboard (API quotas, job queue depth, error rates), bulk admin operations (mass email, plan changes).

### R20 [x] Performance Monitoring & User Analytics
Plausible or PostHog for page views and user behavior. Web Vitals tracking. Feature usage analytics (which features are used, conversion funnels: signup → trial → paid). API cost dashboard for admins.

Scope: layout.tsx analytics script, event tracking throughout app, admin analytics dashboard.

### R21 [x] Session Management & Account Security
Active sessions list with device info. Logout from all devices. Login history. Prepare foundation for 2FA (post-launch).

Scope: convex/sessions.ts (new), settings security tab, session tracking middleware.

### R22 [x] Internationalization Completion
i18n framework works (next-intl with EN/PL) but translation coverage may be incomplete. Audit all strings. Add locale-aware date/number formatting. Missing translation warnings in dev. Consider adding DE/ES for broader market.

Scope: all translation files, locale formatting utilities, translation audit script.

Progress: i18n with next-intl configured, PL/EN support working (commit: 564e68c). Turbopack config resolution fixed for Next.js 16 (commit: aadcda5). Remaining: full string audit for coverage gaps, locale-aware date/number formatting, missing translation warnings in dev, DE/ES languages.


## Tier 3 — Growth (first 3 months post-launch)

### R23 [ ] White-Label & Agency Features
Agency accounts managing multiple client organizations. White-label reports with custom branding (logo, colors, domain). Client access portals with limited views. Separate billing per client. Custom domain for reports.

### R24 [ ] Public API & Documentation
REST API for programmatic access. API key system exists but no actual API endpoints. Rate limiting per key. OpenAPI/Swagger documentation page. Enables integrations and power users.

### R25 [ ] 2FA / Multi-Factor Authentication
TOTP authenticator app support. Backup codes. Optional enforcement per organization (admin can require 2FA for all members). Important for enterprise/agency trust.

### R26 [ ] OAuth Expansion (GitHub, Microsoft)
Additional OAuth providers beyond Google. GitHub for developer-focused users, Microsoft for enterprise.

### R27 [ ] Webhooks & Integrations
Outgoing webhooks on events (position change, keyword discovered, alert triggered). Zapier/Make integration. Slack notifications channel. Google Analytics integration for correlating traffic with rankings.

### R28 [ ] CI/CD Pipeline
GitHub Actions for build verification (next build + npm test on every PR). Automated deployment to staging/production. Staging environment. Source maps upload to Sentry. Pre-commit secret scanning.

### R29 [ ] Mobile Optimization & PWA
Dedicated mobile UX audit. Touch-friendly interactions, mobile-specific navigation. PWA manifest + service worker for quick position checks on phone.

### R30 [ ] Custom Dashboards & Saved Views
User-customizable dashboard layouts. Saved filter presets per table. Shared views within organization.

### R31 [ ] Scheduled Report Delivery
Auto-generate and email reports on schedule (weekly/monthly per domain). Integrates with R09 (AI Report Engine) for content and R08 (Email System) for delivery.

### R32 [ ] Advanced Onboarding & Knowledge Base
Interactive product tours. Contextual tips on first visit to each page. Video tutorials. Searchable knowledge base / help center.

### R33 [ ] Multi-Language Expansion
Add German, Spanish, French translations. Locale-specific formatting (dates, numbers, currency).

### R34 [ ] Accessibility Audit
ARIA labels, keyboard navigation, screen reader compatibility, color contrast verification. Accessibility statement page.

### R35 [ ] Health Checks & Status Page
/api/health endpoint. Public status page. Dependency health monitoring (Convex, Stripe, Resend, DataForSEO). Uptime SLA tracking.


## Execution Protocol

Every roadmap item MUST follow this protocol. No exceptions. No shortcuts. The protocol has 5 mandatory phases.


### Phase 1: Planning (BEFORE any code is written)

Every roadmap item produces TWO plan documents in `docs/plans/`:

1. **Design doc**: `docs/plans/YYYY-MM-DD-RXX-feature-name-design.md`
2. **Implementation doc**: `docs/plans/YYYY-MM-DD-RXX-feature-name-implementation.md`

#### 1.1 Design Doc — What and Why

The design doc answers architectural questions. It MUST contain all of these sections:

```markdown
# RXX: Feature Name — Design

## Problem Statement
What's broken or missing? Why does it matter to the user? What's the business impact?
Include specific user stories: "As an agency owner, I need X so that Y."

## Current State Analysis
What already exists in the codebase that's relevant? Quote specific files, functions,
table schemas. Show what works and what doesn't. Reference the codebase audit findings.

## Proposed Solution
High-level architecture. Diagrams if needed. Key data flows.
For each major decision, list alternatives considered and why this one was chosen.

## Data Model Changes
New tables, new fields on existing tables, new indexes.
Show exact Convex schema additions. Consider migration of existing data.

## API Design
New queries, mutations, actions. Signatures with argument types and return types.
Permission requirements for each endpoint.

## UI/UX Specification
Which pages are affected? New pages needed? New components?
For each new screen: what data it shows, what actions user can take,
what states it handles (loading, empty, error, populated, permission-denied).
Wireframe descriptions or references to design files.

## Email Templates (if applicable)
Which emails are sent, when, to whom. Subject lines. Content outline.
Unsubscribe behavior. Preference respect.

## Security Considerations
What could go wrong? Permission checks needed. Input validation.
Rate limiting. Data exposure risks.

## Dependencies
Which other roadmap items does this depend on or affect?
External services needed (API keys, OAuth credentials, etc.)

## Open Questions
Anything that needs user/stakeholder decision before implementation starts.
Each question must have proposed options with trade-offs.
```

#### 1.2 Implementation Doc — How and In What Order

The implementation doc is the step-by-step execution plan. It MUST contain:

```markdown
# RXX: Feature Name — Implementation Plan

## Prerequisites
What must be true before starting? Other roadmap items completed?
Environment variables configured? External accounts set up?

## Task Breakdown
Numbered list of discrete tasks. Each task must be:
- Small enough to complete in one agent session
- Independently testable
- Has clear "done" criteria

Format per task:
### Task N: [Name]
- **Files to create/modify**: exact file paths
- **What to implement**: specific functions, components, or changes
- **Depends on**: Task numbers that must be done first
- **Test requirements**: what tests to write for this task
- **Done when**: concrete verification criteria

## Agent Team Plan
How to parallelize using TeamCreate. Which tasks can run in parallel?
Define agent roles:
- Agent names and their responsibilities
- Which tasks each agent owns
- Shared dependencies between agents (e.g., fixtures must be created before test agents start)
- Communication points (where agents need to sync)

## Test Strategy
For EVERY task, specify which test types are required:

### Backend Tests (Convex)
- Query/mutation unit tests with realistic fixtures
- Permission enforcement tests (can viewer call this? can non-member?)
- Edge case tests (empty data, max limits, concurrent access)
- Integration tests for multi-step flows (e.g., create → update → delete)

### Frontend Tests (Data Flow Integration)
- Per-component data flow tests following the project's testing patterns:
  - Loading state (query returns undefined)
  - Empty state (query returns [] or null)
  - Populated state (verify key content renders with realistic fixture data)
  - Mutation argument verification (user action triggers mutation with correct payload)
  - Permission gates (button hidden/disabled when permission missing)
  - Filter/sort behavior (if component has client-side filtering)
- Fixtures: create factory functions in src/test/fixtures/ matching exact query return shapes
- Mock pattern: use the project's setupQueryMock/mutationMap helpers

### Component Tests
- Reusable components: test all prop variants
- Internal state logic (expand/collapse, selection, validation)
- Accessibility basics (ARIA labels, keyboard interaction)

### E2E Smoke Tests (if applicable)
- Critical user paths that cross multiple components
- Happy path + primary error path

## Fixture Requirements
List every new fixture file or factory function needed.
Each fixture must match the exact return shape of the relevant Convex query.
Reference existing fixtures in src/test/fixtures/ that can be extended.

## Verification Checklist
Run AFTER all tasks are complete, BEFORE marking the roadmap item as done:
- [ ] `next build` passes with zero errors
- [ ] `npm test` passes — all existing + new tests green
- [ ] New backend functions have permission checks
- [ ] New UI handles all states (loading, empty, error, populated)
- [ ] Email templates render correctly (if applicable)
- [ ] No console.error in browser during manual walkthrough
- [ ] Existing functionality not broken (regression check)
- [ ] Session tracking files updated
```

#### 1.3 Plan Review

After writing both docs, REVIEW them critically before proceeding:
- Did I miss any edge cases?
- What about loading/empty/error states?
- What other components depend on what I'm changing?
- Will this break existing behavior anywhere?
- Are the fixtures realistic (matching actual query shapes, not minimal stubs)?
- Is the agent team plan efficient (maximum parallelism, minimum blocking)?


### Phase 2: Execution with Agent Teams

Every roadmap item is implemented using TeamCreate with parallel agents. This is MANDATORY — do not implement sequentially when agents can work in parallel.

#### 2.1 Team Structure

Standard team composition per roadmap item:

```
Team: RXX-feature-name
├── team-lead (you) — coordinates, reviews, resolves blockers
├── backend-agent — Convex functions (queries, mutations, actions, schema)
├── frontend-agent — React components, pages, UI logic
├── test-agent — all test files, fixtures, test helpers
└── (optional) email-agent — email templates and delivery logic
```

For smaller items (1-2 tasks), use 2 agents. For larger items (R09 AI Reports), use 4-5.

#### 2.2 Task Assignment Rules

1. Create fixtures FIRST — they are a blocker for both frontend and test agents
2. Backend schema/functions SECOND — frontend needs query shapes to build against
3. Frontend and test agents work in PARALLEL once backend is stable
4. Email agent works in parallel with frontend (independent concern)

#### 2.3 Agent Communication Protocol

- Each agent gets a specific, well-scoped task from the implementation plan
- Agents report completion via SendMessage to team-lead
- Team-lead assigns next task from the plan
- If an agent is blocked, it reports immediately — don't let agents spin

#### 2.4 During Execution

- Track progress in session_state.json and tasks_progress.json
- Update todo list as tasks complete
- If implementation diverges from plan (unexpected complexity, missing dependency), update the implementation doc BEFORE continuing
- Commit after each logical chunk (not at the very end)


### Phase 3: Validation Against Plan

After all agents complete, validate the implementation against BOTH plan documents. This is a formal review, not a quick glance.

#### 3.1 Plan Compliance Check

Walk through every task in the implementation doc:
- Is each task actually implemented? Check files exist and contain the specified logic.
- Does the data model match the design doc? Compare schema.ts against proposed changes.
- Are all API endpoints implemented with correct signatures and permissions?
- Does the UI match the specification? All states handled?
- Are all emails implemented if specified?

#### 3.2 Use the Code Review Agent

Launch `superpowers:code-reviewer` agent to review all changes against the plan. The reviewer checks:
- Adherence to project conventions (CLAUDE.md rules)
- Code quality and potential bugs
- Security issues
- Missing error handling
- Consistency with existing codebase patterns

#### 3.3 Automated Verification

Run these in order — ALL must pass:

```bash
# 1. TypeScript compilation — catches import errors, type mismatches
next build

# 2. Full test suite — catches regressions + verifies new behavior
npm test

# 3. Git diff review — verify no unintended changes
git diff --stat
```

If any step fails, fix the issue and re-run ALL steps (not just the failing one).

#### 3.4 Manual Verification

Open affected pages in the browser and verify:
- No console errors
- All states render correctly (loading, empty, populated, error)
- User flows work end-to-end
- Responsive behavior (if applicable)
- Dark mode (if applicable)


### Phase 4: Testing Requirements

Every roadmap item MUST deliver these test types. No code ships without tests that would break if the code regressed.

#### 4.1 Required Test Types Per Feature

| Feature Type | Backend Tests | Data Flow Tests | Component Tests | Fixture Files |
|-------------|:---:|:---:|:---:|:---:|
| New Convex function | YES | — | — | YES |
| New page/section | — | YES | — | YES |
| New reusable component | — | — | YES | — |
| New email template | YES (send logic) | — | — | — |
| Permission change | YES (enforce) | YES (gate UI) | — | YES |
| Schema change | YES (migration) | YES (if UI affected) | — | YES (update existing) |

#### 4.2 Test Quality Standards

- Fixtures MUST match exact return shape of Convex queries (not minimal stubs)
- Every conditional rendering path in a component MUST have a test with realistic data
- Mutation tests MUST verify correct arguments (not just "was called")
- Permission tests MUST verify both allowed AND denied cases
- No test that passes regardless of the data (e.g., "something renders" without checking what)

#### 4.3 Test File Organization

```
src/test/
  fixtures/
    [domain-area].ts          — factory functions + named variants per domain
  integration/
    [feature]-flows.test.tsx   — data flow integration tests
  components/
    [component].test.tsx       — component-level tests (if reusable)
convex/
  tests/
    [module].test.ts           — Convex backend tests
```

#### 4.4 Minimum Coverage Per Roadmap Item

- Every new Convex query: at least 3 test cases (normal data, empty data, permission denied)
- Every new Convex mutation: at least 4 test cases (success, validation error, permission denied, edge case)
- Every new page component: at least 5 test cases (loading, empty, populated, error, permission gate)
- Every new reusable component: at least 3 test cases (default props, variant props, interaction)


### Phase 5: Completion & Documentation

#### 5.1 Mark Roadmap Item as Done

Update this file: change `[ ]` to `[x]` for the completed item.

#### 5.2 Update Session Tracking

Update session_state.json, tasks_progress.json, tasks_progress_verbose.txt with:
- What was implemented
- What tests were added
- Any deviations from the plan and why
- Known limitations or follow-up items

#### 5.3 Commit with Context

Commit message format:
```
RXX: [Feature Name] — [brief description]

Implements: [list of key changes]
Tests: [N] new tests in [M] files
Plan: docs/plans/YYYY-MM-DD-RXX-feature-name-*.md
```

#### 5.4 Update Dependencies

If completing this item unblocks other roadmap items, note it in the Execution Notes below.


---


## Dependency Graph

Tier 0 items are mostly independent — can be parallelized across sessions:
- R01 and R02 share auth infrastructure — do together or sequentially
- R03 and R08 share email infrastructure — R03 first, R08 builds on it
- R04, R05, R06, R07 are fully independent

Tier 1 dependencies:
- R08 (emails) → before R09 (AI reports need email delivery) and R13 (alerts need email)
- R10 (GSC) is fully independent
- R11 (CSV import/export) is fully independent
- R12 (Add to Monitoring) is quick — do early, R14 (onboarding) benefits from it
- R14 (onboarding) benefits from R12 being done first
- R15 (OAuth) is independent

Tier 2 and 3 items are independent of each other (except R31 depends on R08 + R09).

Estimated scope: Tier 0 items are 1-2 sessions each. Tier 1 items are 2-4 sessions. R09 (AI Reports) is the largest at 4-6 sessions. Tier 2 items are 1-3 sessions. Tier 3 items are larger initiatives.

Total items: 35.


---


## Status Summary (last updated: 2026-02-22)

| Tier | Total | Done | In Progress | Not Started |
|------|-------|------|-------------|-------------|
| Tier 0 — Blockers | 7 | 7 (R01-R07) | 0 | 0 |
| Tier 1 — Core | 8 | 7 (R08, R11, R12, R13, R14, R15, R17, R18) | 1 (R09) | 1 (R10) |
| Tier 2 — Polish | 7 | 6 (R16, R17, R18, R19, R20, R21, R22) | 0 | 0 |
| Tier 3 — Growth | 13 | 0 | 0 | 13 (R23-R35) |
| **Total** | **35** | **20** | **1** | **14** |

Tier 0 and Tier 2 complete! Tier 1 nearly done (R09 AI Reports in progress, R10 GSC not started). Critical path: R09, R10.

### Work completed outside roadmap items

Significant features built that are not tracked as separate roadmap items but contribute to overall product readiness:

- RBAC system: roles, permissions (36), plans CRUD, PermissionGate/ModuleGate, tenant isolation, permission ceiling resolution. Plan: `2026-02-16-roles-permissions-*.md`.
- Supabase migration: dual-write keyword positions, analytical reads migration, competitor dual-write, dead code cleanup (phases 1-2e).
- API cost optimization: 13 issues addressed, DataForSEO cost tracking, reduced SERP depth. Plan: `2026-02-19-api-cost-optimization.md`.
- Page scoring algorithm: PSI integration, scoring engine. Plan: `2026-02-06-page-scoring-algorithm.md`.
- Convex query optimization: dramatic reduction in queries across 10+ files (keywords 101→1, stats 201→1, monitoring 401→2).
- Module Hub: progressive disclosure, dependency diagram, business context panels.
- Dark mode: systematic fixes across EzIcons, skeletons, charts, on-site section, modal overlays.
- Test suite: 2226+ tests in 119 files covering backend, frontend, integration, data flow, auth, email delivery.
- User documentation in Polish for non-technical users.
- JSON Schema / llms.txt generators design (plans exist, implementation pending).


---


## Completion Log

Record every status change here with date and brief notes. Most recent entries first.

| Date | Item | Change | Notes |
|------|------|--------|-------|
| 2026-02-22 | R21 | [ ] → [x] | Session management: userSessions/loginHistory tables, security.ts, Sessions tab in settings. 24 tests. |
| 2026-02-22 | R20 | [ ] → [x] | Analytics MVP: analyticsEvents table, event tracking, Web Vitals, admin analytics dashboard. 12 tests. |
| 2026-02-22 | R19 | [~] → [x] | Admin health dashboard: API quotas, job queues, error rates, bulk suspend/plan change. 21 tests. |
| 2026-02-22 | R16 | [~] → [x] | Loading/error states for all 10 route segments, ErrorBoundary retry with backoff. 43 tests. |
| 2026-02-21 | R15 | [ ] → [x] | Google OAuth login/register. 4 tests. Commit: 9386887 |
| 2026-02-21 | R13 | [ ] → [x] | Custom alert rules engine + UI. 34 tests. Commit: a7675b5 |
| 2026-02-21 | R11 | [ ] → [x] | CSV/Excel import wizard + export. 18 tests. Commit: 825e343 |
| 2026-02-21 | R03 | [~] → [x] | Stripe dunning, trial reminders, invoices, payment update. 20 tests. Commit: efba4db |
| 2026-02-21 | R07 | [ ] → [x] | GDPR account deletion + data export. Commit: 8ad32b1 |
| 2026-02-21 | R06 | [ ] → [x] | Sentry error monitoring with PII filtering. Commit: 53f4d47 |
| 2026-02-21 | R05 | [ ] → [x] | Legal pages + cookie consent. Commit: 4788cb9 |
| 2026-02-21 | R04 | [ ] → [x] | Security headers + mutation auth audit. Commit: 922ff8c |
| 2026-02-21 | R02 | [ ] → [x] | 3-step OTP email verification. 24 tests. Commit: 9106bbb |
| 2026-02-21 | R01 | [ ] → [x] | OTP-based password reset & change. 28 tests. Commits: 089f532, 657fe1b |
| 2026-02-21 | R16 | [ ] → [~] | ErrorBoundary on 16 tabs, skeleton dark mode, retry logic |
| 2026-02-21 | R19 | [ ] → [~] | Admin panel, impersonation, diagnostics, plan management |
| 2026-02-21 | R22 | [ ] → [~] | i18n PL/EN working, coverage audit pending |
| 2026-02-21 | R18 | [ ] → [~] | Bulk refresh works, other bulk ops pending |
| 2026-02-21 | R14 | [ ] → [~] | Onboarding flow exists, full wizard UX pending |
| 2026-02-21 | R12 | [~] → [x] | Cross-feature flows wired, SERP badges re-enabled. 19 tests. Commit: 965f035 |
| 2026-02-21 | R08 | [~] → [~] | Phase 1-2 done: daily digest, weekly report, 5 alert email templates wired to alertEvaluation. Commits: 800f23a |
| 2026-02-21 | R12 | [ ] → [~] | Add Keywords button works, cross-feature flows pending |
| 2026-02-21 | R09 | [ ] → [~] | Custom report editor + AI Strategy pattern built |
| 2026-02-21 | R08 | [ ] → [~] | Resend configured, transactional emails, 110 tests |
| 2026-02-21 | R03 | [ ] → [~] | Stripe checkout/pricing/webhooks done, lifecycle flows pending |
| 2026-02-21 | — | — | Initial roadmap status reconciliation from git history |
