# Batch 2 Implementation Plan: R08p4, R14, R17, R18, R22

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete 5 roadmap items in parallel using worktree agents.

**Architecture:** Each item is independent — no shared state, no cross-dependencies. Each agent works in an isolated worktree. Results cherry-picked to main worktree after verification.

---

## Task A: R08 Phase 4 — Email Hygiene

**Scope:** Add unsubscribe links to non-transactional emails + delivery logging to notificationLogs.

**Files to modify:**
- `convex/actions/sendEmail.ts` — add unsubscribe footer to: sendDailyDigest, sendWeeklyReport, sendPositionDropAlert, sendTopNExitAlert, sendNewCompetitorAlert, sendBacklinkLostAlert, sendVisibilityDropAlert, sendTrialReminder, sendPaymentFailedNotice
- `convex/schema.ts` — add optional `category` field to notificationLogs table
- `convex/scheduler.ts` — add logNotification calls after each email send in triggerDailyDigests/triggerWeeklyReports (already has logNotification mutation)
- `convex/alertEvaluation.ts` — add logNotification calls after email scheduling

**Unsubscribe link format:**
```html
<a href="${appUrl}/settings?tab=notifications" style="color:#98a2b3;font-size:12px;">
  Zarządzaj preferencjami email
</a>
```
Add to ALL non-transactional email footers (digest, weekly, alerts, billing reminders). Do NOT add to: sendWelcome, sendPasswordResetCode, sendTeamInvitation, sendSubscriptionConfirmation.

**Delivery logging pattern:**
After each `resend.emails.send()` call, log to notificationLogs via `ctx.scheduler.runAfter(0, internal.scheduler.logNotification, {...})` (for actions) or direct `ctx.db.insert("notificationLogs", {...})` (for mutations).

Fields: `{ type: "email", recipient, subject, status: "sent"|"failed", error?, category: "digest"|"alert"|"billing"|"transactional", metadata: { templateName }, createdAt: Date.now() }`

**Schema change:**
```typescript
// Add to notificationLogs table definition:
category: v.optional(v.union(
  v.literal("transactional"),
  v.literal("digest"),
  v.literal("alert"),
  v.literal("billing")
)),
```

**Acceptance criteria:**
1. All 7 non-transactional email templates have unsubscribe link in footer
2. All 15 email templates log delivery to notificationLogs (success and failure)
3. notificationLogs has category field for filtering
4. Existing tests still pass
5. New tests: verify unsubscribe link presence in HTML, verify logging calls

**Tests required:**
- Convex unit tests: logNotification mutation with category field
- Integration tests: mock sendEmail functions, verify logging side-effects
- E2E test: send one real email via Resend, verify notificationLogs entry created

---

## Task B: R14 — Onboarding Wizard (App-Level Welcome Flow)

**Scope:** Create first-time user welcome flow: detect new user → show welcome page → guide through org setup → first domain → trigger existing DomainSetupWizard.

**Files to create:**
- `src/app/[locale]/(authenticated)/onboarding/page.tsx` — first-time user welcome page
- `src/app/[locale]/(authenticated)/onboarding/layout.tsx` — minimal layout without sidebar
- `src/components/onboarding/FirstTimeFlow.tsx` — 3-step flow container
- `src/components/onboarding/WelcomeStep.tsx` — step 1: welcome message, platform intro
- `src/components/onboarding/OrgSetupStep.tsx` — step 2: customize org name (auto-created org)
- `src/components/onboarding/FirstDomainStep.tsx` — step 3: add first domain URL + name

**Files to modify:**
- `convex/schema.ts` — add `hasCompletedOnboarding: v.optional(v.boolean())` to users table
- `convex/onboarding.ts` — add `getUserOnboardingStatus` query and `completeUserOnboarding` mutation
- `src/app/[locale]/(authenticated)/layout.tsx` — add redirect: if !hasCompletedOnboarding → /onboarding
- `src/messages/en/onboarding.json` — English translations (~30 keys)
- `src/messages/pl/onboarding.json` — Polish translations (~30 keys)

**Flow:**
1. User registers → auto-create org → redirect to /onboarding
2. WelcomeStep: "Witaj w doseo!" with platform features overview, "Zacznij" button
3. OrgSetupStep: Edit org name, optional industry field
4. FirstDomainStep: Enter domain URL, click "Dodaj domenę" → creates domain → marks onboarding complete → redirects to domain page (which triggers existing DomainSetupWizard)

**Acceptance criteria:**
1. New users see /onboarding after first login
2. Returning users (hasCompletedOnboarding=true) go directly to dashboard
3. Skip button available on each step
4. Polish and English translations complete
5. After completion, user lands on domain page with DomainSetupWizard auto-opening

**Tests required:**
- Convex unit tests: getUserOnboardingStatus, completeUserOnboarding
- Component tests: render each step, verify buttons/inputs work
- Integration test: full flow mock (welcome → org → domain → complete)
- E2E Playwright test: register new user → verify onboarding page loads → complete flow → verify dashboard

---

## Task C: R17 — Search & Command Palette

**Scope:** Wire up existing CommandPalette shell with backend search + Cmd+K hotkey.

**Files to create:**
- `convex/search.ts` — search queries for domains, keywords, projects
- `src/hooks/useCommandPalette.ts` — global Cmd+K listener hook

**Files to modify:**
- `src/components/application/command-menus/command-palette.tsx` — wire search input to backend, render results
- `src/app/[locale]/(authenticated)/layout.tsx` — mount useCommandPalette hook
- `src/messages/en/search.json` and `src/messages/pl/search.json` — translations

**Backend search queries (convex/search.ts):**
```typescript
export const searchAll = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Permission check: user must be authenticated
    // Search domains by name (case-insensitive prefix match)
    // Search keywords by phrase (prefix match)
    // Search projects by name
    // Return grouped results: { domains: [], keywords: [], projects: [] }
    // Limit to 5 per category, 15 total
  }
});
```

Use `.filter()` with string comparison since Convex doesn't have full-text search. Filter in-memory after collecting by user's accessible teams/projects.

**Cmd+K implementation:**
```typescript
// useCommandPalette.ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(prev => !prev);
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

**Acceptance criteria:**
1. Cmd+K opens command palette
2. Typing filters results across domains, keywords, projects
3. Clicking result navigates to the item
4. Empty state: "Brak wyników"
5. Escape closes palette
6. Results grouped by category with icons

**Tests required:**
- Convex unit tests: searchAll query with various inputs
- Component tests: CommandPalette renders, input filters, keyboard navigation
- Integration test: search returns results, click navigates
- E2E Playwright test: Cmd+K opens palette → type query → select result → verify navigation

---

## Task D: R18 — Bulk Keyword Management

**Scope:** Add 4 bulk operations: delete, move to group, change tags, pause/resume.

**Files to modify:**
- `convex/keywords.ts` — add 4 mutations: bulkDeleteKeywords, bulkMoveToGroup, bulkChangeTags, bulkToggleStatus
- `src/components/domain/tables/KeywordMonitoringTable.tsx` — wire BulkActionBar actions
- `src/components/patterns/BulkActionBar.tsx` — verify it supports the actions array pattern

**Files to create:**
- `src/components/domain/modals/BulkDeleteConfirmModal.tsx`
- `src/components/domain/modals/BulkMoveToGroupModal.tsx`
- `src/components/domain/modals/BulkChangeTagsModal.tsx`

**Backend mutations (convex/keywords.ts):**

```typescript
// bulkDeleteKeywords — delete keywords and their position history
export const bulkDeleteKeywords = mutation({
  args: { keywordIds: v.array(v.id("keywords")), domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.domainId, "keywords.delete");
    for (const id of args.keywordIds) {
      // Delete position history for this keyword
      const positions = await ctx.db.query("keywordPositions")
        .withIndex("by_keyword", q => q.eq("keywordId", id)).collect();
      for (const p of positions) await ctx.db.delete(p._id);
      await ctx.db.delete(id);
    }
    return args.keywordIds.length;
  }
});

// bulkMoveToGroup — move keywords to a different group
export const bulkMoveToGroup = mutation({
  args: { keywordIds: v.array(v.id("keywords")), groupId: v.optional(v.id("keywordGroups")), domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.domainId, "keywords.edit");
    for (const id of args.keywordIds) {
      await ctx.db.patch(id, { groupId: args.groupId ?? undefined });
    }
    return args.keywordIds.length;
  }
});

// bulkChangeTags — set/add/remove tags on keywords
export const bulkChangeTags = mutation({
  args: { keywordIds: v.array(v.id("keywords")), tags: v.array(v.string()), operation: v.union(v.literal("set"), v.literal("add"), v.literal("remove")), domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.domainId, "keywords.edit");
    for (const id of args.keywordIds) {
      const kw = await ctx.db.get(id);
      if (!kw) continue;
      let newTags: string[];
      if (args.operation === "set") newTags = args.tags;
      else if (args.operation === "add") newTags = [...new Set([...(kw.tags ?? []), ...args.tags])];
      else newTags = (kw.tags ?? []).filter(t => !args.tags.includes(t));
      await ctx.db.patch(id, { tags: newTags });
    }
    return args.keywordIds.length;
  }
});

// bulkToggleStatus — pause or resume keyword monitoring
export const bulkToggleStatus = mutation({
  args: { keywordIds: v.array(v.id("keywords")), status: v.union(v.literal("active"), v.literal("paused")), domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.domainId, "keywords.edit");
    for (const id of args.keywordIds) {
      await ctx.db.patch(id, { status: args.status });
    }
    return args.keywordIds.length;
  }
});
```

**Acceptance criteria:**
1. Bulk delete with confirmation modal, cascades to position history
2. Bulk move to group with group selector dropdown
3. Bulk tags with add/remove/set modes
4. Bulk pause/resume toggles keyword status
5. All operations check permissions (keywords.edit/keywords.delete)
6. Toast feedback after each operation with count
7. Table refreshes after bulk action

**Tests required:**
- Convex unit tests: 4 mutations with permission checks, edge cases (empty array, missing keywords)
- Integration tests: table selection → bulk action → verify mutation called with correct args
- E2E Playwright test: select keywords in table → click bulk delete → confirm → verify keywords removed

---

## Task E: R22 — i18n Completion

**Scope:** Audit translation coverage, add locale-aware formatting, validate key parity.

**Files to create:**
- `src/lib/locale-formatting.ts` — formatDate, formatNumber, formatCurrency utilities
- `src/test/i18n-audit.test.ts` — automated string audit + parity validation

**Files to modify:**
- `src/messages/en/*.json` and `src/messages/pl/*.json` — add missing keys found during audit
- Components with hardcoded strings — wrap in t() calls

**Locale formatting utilities (src/lib/locale-formatting.ts):**
```typescript
export function formatDate(date: Date | number, locale: string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = style === 'short'
    ? { day: 'numeric', month: 'numeric', year: 'numeric' }
    : style === 'medium'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatNumber(num: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(num);
}

export function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
```

**i18n audit test (src/test/i18n-audit.test.ts):**
```typescript
// 1. Load all EN and PL message files
// 2. Flatten to dot-notation keys
// 3. Compare: every EN key must have PL equivalent and vice versa
// 4. Report missing keys with file:key format
// 5. Scan src/components/**/*.tsx for hardcoded strings not wrapped in t() or useTranslations()
```

**Acceptance criteria:**
1. All EN keys have PL equivalents (zero orphaned keys)
2. formatDate/formatNumber/formatCurrency work correctly for both locales
3. Automated test validates key parity on every test run
4. At least 20 hardcoded strings found and wrapped in t()
5. No untranslated keys in production UI

**Tests required:**
- Unit tests: formatDate, formatNumber, formatCurrency for PL and EN locales
- i18n parity test: automated validation of EN/PL key match
- Integration test: render component with PL locale, verify Polish strings appear
- E2E Playwright test: switch locale to PL → verify page renders in Polish → switch to EN → verify English
