# Pre-Launch Roadmap

Reference document for sequential plan execution. When finishing one plan, pick the next unstarted item from the highest priority tier. Each item is a self-contained plan scope.

Status legend: [ ] not started, [~] in progress, [x] done

Target market: agencje SEO (primary) + in-house SEO teams. Agency needs (reports, multi-client, white-label) take priority in design decisions.


## Tier 0 — Blockers (must ship before any user sees the product)

### R01 [ ] Password Reset & Password Change
Email template for reset exists but reset page and token validation are missing. Password change mutation throws error ("requires integration with auth provider"). Users have no recovery path and cannot change compromised passwords.

Scope: reset-password page, token generation/validation in convex auth, wire up changePassword mutation, UI in settings.

### R02 [ ] Email Verification on Registration
New users can register with any email without confirmation. This allows typos, fake accounts, and spam. Add verification email on signup, verification page, resend link, and block access until verified.

Scope: convex auth callback, verification email template, /verify-email page, middleware guard.

### R03 [ ] Stripe Production Readiness & Billing Flows
Switch from test mode to live keys. Complete the billing lifecycle:
- Dunning: what happens on failed payment (grace period, feature degradation vs full block, retry notifications)
- Trial expiration: reminder emails at 3 days, 1 day before trial ends; auto-downgrade flow
- Cancellation confirmation email
- Invoice/receipt access (Stripe portal link exists, but no in-app invoice list)
- Payment method update flow (separate from full portal redirect)

Scope: convex/stripe.ts, stripe_webhook.ts, stripe_helpers.ts, email templates, settings billing tab.

### R04 [ ] Security Hardening
Security headers (CSP, HSTS, X-Frame-Options) via middleware.ts. Audit auth flow for session fixation, CSRF. Review Convex permission checks on all mutations — currently some mutations bypass requirePermission(). Sanitize user inputs that render as HTML. Rate limit auth endpoints.

Scope: middleware.ts, next.config, convex auth functions, all mutation files.

### R05 [ ] Legal Pages & Cookie Consent
Privacy Policy, Terms of Service, Cookie Policy — can be static markdown pages. Cookie consent banner for EU users. Email consent tracking (opt-in for marketing emails). Without these, cannot legally operate in EU.

Scope: public static pages, cookie banner component, consent storage in convex.

### R06 [ ] Error Monitoring (Sentry)
Integrate Sentry for frontend crash reporting and backend error tracking. Source maps upload. Alerting rules for critical errors (auth failures, payment failures, API outages). Currently errors only visible in admin log viewer — no real-time alerts.

Scope: next.config, layout.tsx, convex error handlers, build pipeline.

### R07 [ ] Account Deletion & Data Export (GDPR)
User-initiated account deletion that cascades to all data (domains, keywords, positions, reports, team memberships). Data export (download my data as JSON/CSV). Currently only admin can delete accounts.

Scope: settings page delete account section, convex cascade deletion mutation, data export action.


## Tier 1 — Core Product Completeness (incomplete features that users will notice)

### R08 [ ] Email Notifications System
Break the monolithic "notifications" item into proper implementation. Infrastructure exists (Resend configured, notification preferences table, cron stubs) but most emails aren't sent.

Phase 1 — Activate existing stubs:
- Daily digest email (keyword movements, top gainers/losers) — cron exists but commented out
- Weekly report email (position summary, visibility trend) — cron exists but commented out
- Respect user notification preferences when sending (preferences stored but not checked)

Phase 2 — New alert emails:
- Position drop alert (keyword drops > configurable threshold)
- Limit/quota warning (approaching keyword/domain/API limits at 80%)
- Competitor alert (competitor started ranking for your keyword)
- Calendar event reminders (events system exists, no email on due date)

Phase 3 — Billing & team emails:
- Payment failed notification with retry link
- Invoice/receipt email after successful charge
- Trial expiration reminders (3 days, 1 day before)
- Member joined organization notification
- Role changed notification

Phase 4 — Email hygiene:
- Unsubscribe links in all non-transactional emails
- Preference-based filtering (check user prefs before sending)
- Email delivery logging to notificationLogs table

Scope: convex/scheduler.ts, convex/crons.ts, convex/actions/sendEmail.ts, notification preferences logic.

### R09 [ ] AI Report Engine
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

### R10 [ ] Google Search Console Integration
Must-have for SEO tool credibility. Import actual click/impression data from GSC. Compare GSC positions vs DataForSEO positions. Show CTR data, impressions, clicks per keyword. Query performance over time.

Implementation:
- OAuth2 connection flow (Google API credentials)
- GSC property verification
- Periodic data sync (daily cron)
- Dashboard widgets showing GSC data alongside existing position data
- Settings page for managing GSC connection

Scope: convex/gsc.ts (new), OAuth flow, GSC API client, dashboard integration, settings tab.

### R11 [ ] CSV/Excel Import & Export
Critical for user acquisition (migration from Ahrefs/SEMrush) and for agencies exporting data.

Import:
- CSV/Excel file upload for keywords (with column mapping wizard)
- Bulk domain import
- Competitor list import

Export:
- All major tables exportable to CSV (keywords, backlinks, competitors, positions)
- Domain report export to Excel (multi-sheet)
- Position history export with date range filter

Scope: import wizard component, convex import mutations, export utility functions per table.

### R12 [ ] "Add to Monitoring" & Cross-Feature Flows
Keywords discovered in content gap analysis and competitor tables have "Add to Monitoring" buttons with TODO comments. Complete the full flow: select keywords → confirm → create keyword records → trigger first position check. Also wire up SERP features display (component exists but disabled).

Scope: AllKeywordsTable.tsx, CompetitorKeywordGapTable.tsx, SERPFeaturesBadges.tsx (re-enable), convex keyword mutations.

### R13 [ ] Custom Alert Rules
Users can't configure alerts today. Anomaly detection runs automatically but with no configurable thresholds. Agencies need to set rules per client domain.

Rules engine:
- Keyword position drop > X positions → alert
- Keyword exits top 10/20/50 → alert
- New competitor detected → alert
- Backlink lost → alert
- Visibility score drops > X% → alert

UI: Alert rules manager in domain settings. Alert history page. Alert delivery via email + in-app notification.

Scope: convex/alertRules.ts (new), alert evaluation in cron jobs, alert UI, email integration.

### R14 [ ] Onboarding Wizard
First-time user flow: create org → add first domain → add first keywords → trigger first check → see first results. Progress indicators. Skip/later options. Empty states across all pages that guide toward the wizard.

Scope: wizard components, empty state components across dashboard.

### R15 [ ] OAuth Login (Google)
Reduces signup friction significantly. Most SaaS users expect Google login. Configure Convex Auth with Google OAuth provider.

Scope: convex auth config, login/register pages, OAuth callback handling.


## Tier 2 — Polish & Differentiation (launch quality, not blockers)

### R16 [ ] Loading & Error State Audit
Systematic pass through all pages. Verify every query-dependent component handles: loading (skeleton), empty (helpful message + CTA), error (error boundary catches + retry button). Test with slow network throttling.

Scope: all page components, integration tests for each state.

### R17 [ ] Search & Command Palette
Global search (Cmd+K) to navigate between domains, projects, keywords. Shell exists with hardcoded navigation but actual search doesn't work. Search across all entities with recent items.

Scope: CommandPalette component completion, search index in convex.

### R18 [ ] Bulk Keyword Management
Select multiple keywords across tables. Bulk actions: delete, move to group, change tags, pause/resume monitoring, refresh positions. Selection UI exists but bulk operations incomplete.

Scope: keyword table components, convex bulk mutation endpoints.

### R19 [ ] Admin Panel Completion
Admin panel exists but needs: real-time system health dashboard (API quotas remaining, job queue depth, error rates), user impersonation for support, bulk operations (mass email, plan changes).

Scope: admin pages, convex admin queries.

### R20 [ ] Performance Monitoring & User Analytics
Plausible or PostHog for page views and user behavior. Web Vitals tracking. Feature usage analytics (which features are used, conversion funnels: signup → trial → paid). API cost dashboard for admins.

Scope: layout.tsx analytics script, event tracking throughout app, admin analytics dashboard.

### R21 [ ] Session Management & Account Security
Active sessions list with device info. Logout from all devices. Login history. Prepare foundation for 2FA (post-launch).

Scope: convex/sessions.ts (new), settings security tab, session tracking middleware.

### R22 [ ] Internationalization Completion
i18n framework works (next-intl with EN/PL) but translation coverage may be incomplete. Audit all strings. Add locale-aware date/number formatting. Missing translation warnings in dev. Consider adding DE/ES for broader market.

Scope: all translation files, locale formatting utilities, translation audit script.


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
