# Batch 3 Implementation Plan — R16, R19, R20, R21

> **For Claude:** Each task is a standalone worktree agent. Agent must implement code + tests + commit.

**Goal:** Complete 4 Tier 2 roadmap items: loading/error state audit, admin panel completion, analytics infrastructure, session management.

**Architecture:** Each item is scoped to deliverable chunks that an agent can complete independently. Heavy greenfield items (R20, R21) are scoped to MVP.

---

## Task 1: R16 — Loading & Error State Audit

**Goal:** Every route segment and query-dependent component has proper loading, empty, and error states.

### Files to Create
- `src/app/(dashboard)/domains/error.tsx`
- `src/app/(dashboard)/domains/loading.tsx`
- `src/app/(dashboard)/domains/[domainId]/error.tsx`
- `src/app/(dashboard)/domains/[domainId]/loading.tsx`
- `src/app/(dashboard)/domains/[domainId]/insights/error.tsx`
- `src/app/(dashboard)/domains/[domainId]/insights/loading.tsx`
- `src/app/(dashboard)/projects/error.tsx`
- `src/app/(dashboard)/projects/loading.tsx`
- `src/app/(dashboard)/projects/[projectId]/error.tsx`
- `src/app/(dashboard)/projects/[projectId]/loading.tsx`
- `src/app/(dashboard)/calendar/error.tsx`
- `src/app/(dashboard)/calendar/loading.tsx`
- `src/app/(dashboard)/jobs/error.tsx`
- `src/app/(dashboard)/jobs/loading.tsx`
- `src/app/(dashboard)/settings/error.tsx`
- `src/app/(dashboard)/settings/loading.tsx`
- `src/test/integration/r16-error-states.test.tsx`

### Files to Modify
- `src/components/ErrorBoundary.tsx` — add retry with exponential backoff, error categorization
- `src/components/shared/LoadingState.tsx` — add "detail" variant for domain/project detail pages with section skeletons
- `src/messages/en/common.json` — add error/empty state translations
- `src/messages/pl/common.json` — add error/empty state translations

### Implementation Details

**error.tsx pattern** (same for all route segments):
```tsx
"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "@untitledui/icons";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertTriangle className="w-12 h-12 text-utility-error-500" />
      <h2 className="text-lg font-semibold">{t("errorTitle")}</h2>
      <p className="text-sm text-tertiary">{error.message || t("errorGeneric")}</p>
      <button onClick={reset} className="btn-primary">{t("tryAgain")}</button>
    </div>
  );
}
```

**loading.tsx pattern** — use LoadingState with appropriate variant:
```tsx
import { LoadingState } from "@/components/shared/LoadingState";
// For list pages:
export default function Loading() { return <LoadingState type="table" rows={8} />; }
// For detail pages:
export default function Loading() { return <LoadingState type="detail" />; }
```

**LoadingState "detail" variant** — skeleton for detail pages with:
- Header skeleton (title + stats row)
- Tab bar skeleton
- Content area with 3 card skeletons + table skeleton

**ErrorBoundary upgrade:**
- Add `retryCount` state, max 3 retries with exponential backoff (1s, 2s, 4s)
- After max retries, show permanent error with "Report Issue" link
- Categorize errors: network (retry-able), auth (redirect to login), other (show message)

### Test Requirements (r16-error-states.test.tsx)
- Test ErrorBoundary renders error UI when child throws
- Test ErrorBoundary retry button resets state
- Test ErrorBoundary stops retrying after max attempts
- Test LoadingState renders table variant correctly
- Test LoadingState renders detail variant correctly
- Test each error.tsx component renders with error message and reset button

### Acceptance Criteria
- Every route segment in (dashboard) has error.tsx and loading.tsx
- ErrorBoundary has retry with backoff (max 3 retries)
- LoadingState has "detail" variant for complex pages
- All error/loading translations exist in EN and PL
- 10+ tests passing

---

## Task 2: R19 — Admin Panel: System Health Dashboard

**Goal:** Add system health dashboard showing API quotas, job queue status, error rates, and bulk operations.

### Files to Create
- `convex/adminHealth.ts` — health queries
- `src/app/(admin)/admin/health/page.tsx` — system health page
- `src/components/admin/SystemHealthDashboard.tsx` — main dashboard component
- `src/components/admin/HealthMetricCard.tsx` — reusable metric card
- `src/components/admin/JobQueueStatus.tsx` — job queue widget
- `src/components/admin/ErrorRateChart.tsx` — error rates widget
- `src/components/admin/ApiQuotaWidget.tsx` — API quota status
- `src/components/admin/BulkOperationsPanel.tsx` — bulk admin actions
- `src/test/integration/r19-admin-health.test.tsx`

### Files to Modify
- `convex/admin.ts` — add bulk mutations (bulkSuspendUsers, bulkChangePlan)
- `src/components/admin/admin-sidebar.tsx` — add Health nav item
- `src/messages/en/admin.json` — health dashboard translations
- `src/messages/pl/admin.json` — health dashboard translations

### Backend Implementation (convex/adminHealth.ts)

```typescript
// Queries:
getSystemHealth: query — returns:
  - apiQuota: { dailyCostCap: number, currentDailySpend: number, percentUsed: number }
  - jobQueue: { active: number, pending: number, failedLast24h: number, completedLast24h: number, byType: Record<string, number> }
  - errorRates: { last1h: number, last24h: number, byType: { api: number, job: number, email: number } }
  - services: { dataForSEO: "healthy"|"degraded"|"down", resend: "healthy"|"degraded"|"down" }
  - systemLoad: { totalUsers: number, activeUsersLast24h: number, totalDomains: number, totalKeywords: number }

getFailedJobsDetail: query({ limit: v.optional(v.number()) }) — returns recent failed jobs with error messages

getErrorTimeline: query({ hours: v.number() }) — returns hourly error counts for timeline chart
```

**Bulk mutations in admin.ts:**
```typescript
bulkSuspendUsers: mutation({ userIds: v.array(v.id("users")), reason: v.string() })
  — loop userIds, create suspensions, log admin action

bulkChangePlan: mutation({ organizationIds: v.array(v.id("organizations")), planId: v.id("plans") })
  — loop orgIds, update plan assignment, log admin action
```

### Frontend Implementation

**SystemHealthDashboard** — grid layout:
- Top row: 4 HealthMetricCards (API spend, active jobs, error rate 24h, active users)
- Middle row: ApiQuotaWidget (gauge) + JobQueueStatus (bar chart by type) + ErrorRateChart (line chart 24h)
- Bottom row: Services status indicators + recent failed jobs table
- Sidebar: BulkOperationsPanel with user/org search + bulk action buttons

**HealthMetricCard** — shows value, label, trend indicator (up/down arrow + color), sparkline optional

### Test Requirements (r19-admin-health.test.tsx)
- Test getSystemHealth query returns expected shape
- Test getFailedJobsDetail returns failed jobs
- Test bulkSuspendUsers creates suspensions for all provided users
- Test bulkChangePlan updates all org plans
- Test SystemHealthDashboard renders all metric cards
- Test BulkOperationsPanel renders action buttons
- 10+ tests passing

### Acceptance Criteria
- `/admin/health` page loads with real data
- API quota widget shows current spend vs cap
- Job queue shows active/pending/failed counts by type
- Error rate timeline shows last 24h
- Bulk suspend and bulk plan change work
- All translations in EN and PL
- 10+ tests passing

---

## Task 3: R20 — Performance Monitoring & User Analytics (MVP)

**Goal:** Add PostHog-compatible analytics event tracking, Web Vitals reporting, and a feature usage analytics dashboard for admins.

### Files to Create
- `src/lib/analytics.ts` — analytics abstraction layer (PostHog-ready but works standalone)
- `src/hooks/useAnalytics.ts` — React hook for event tracking
- `src/hooks/useWebVitals.ts` — Web Vitals reporting hook
- `convex/analytics.ts` — analytics event storage + queries
- `src/app/(admin)/admin/analytics/page.tsx` — analytics dashboard
- `src/components/admin/AnalyticsDashboard.tsx` — main dashboard
- `src/components/admin/FeatureUsageChart.tsx` — feature usage bars
- `src/components/admin/UserFunnelChart.tsx` — conversion funnel
- `src/components/admin/WebVitalsPanel.tsx` — Web Vitals display
- `src/test/integration/r20-analytics.test.tsx`

### Files to Modify
- `src/app/layout.tsx` — add Web Vitals hook
- `src/components/admin/admin-sidebar.tsx` — add Analytics nav item
- `convex/schema.ts` — add analyticsEvents table
- `src/messages/en/admin.json` — analytics translations
- `src/messages/pl/admin.json` — analytics translations

### Schema Addition
```typescript
analyticsEvents: defineTable({
  eventName: v.string(),           // e.g. "page_view", "keyword_added", "report_generated"
  userId: v.optional(v.id("users")),
  organizationId: v.optional(v.id("organizations")),
  properties: v.optional(v.any()), // event-specific metadata
  sessionId: v.optional(v.string()),
  timestamp: v.number(),
  // Web Vitals specific
  vitals: v.optional(v.object({
    metric: v.string(),            // "LCP", "FID", "CLS", "TTFB", "INP"
    value: v.number(),
    rating: v.string(),            // "good", "needs-improvement", "poor"
  })),
})
  .index("by_name_time", ["eventName", "timestamp"])
  .index("by_user", ["userId", "timestamp"])
  .index("by_org", ["organizationId", "timestamp"])
```

### Backend Implementation (convex/analytics.ts)

```typescript
// Internal mutation — called from frontend via action
trackEvent: internalMutation({
  args: { eventName, userId, organizationId, properties, sessionId, timestamp, vitals },
  handler: async (ctx, args) => { await ctx.db.insert("analyticsEvents", args); }
})

// Action — public endpoint for frontend tracking
track: action({
  args: { eventName: v.string(), properties: v.optional(v.any()), vitals: v.optional(...) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    // Get userId and orgId from identity
    await ctx.runMutation(internal.analytics.trackEvent, { ...args, userId, organizationId, timestamp: Date.now() });
  }
})

// Admin queries
getFeatureUsage: query({ days: v.number() }) — aggregate event counts by eventName for last N days
getConversionFunnel: query({}) — count users at each stage (registered, verified, added_domain, added_keywords, subscribed)
getWebVitals: query({ days: v.number() }) — aggregate Web Vitals with p50/p75/p95 percentiles
getActiveUsers: query({ days: v.number() }) — unique users per day from analyticsEvents
getTopFeatures: query({ days: v.number() }) — most used features ranked by count
```

### Frontend Implementation

**analytics.ts** — thin abstraction:
```typescript
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  // Fire-and-forget to Convex action
  // In future, can also pipe to PostHog
}

export const EVENTS = {
  PAGE_VIEW: "page_view",
  KEYWORD_ADDED: "keyword_added",
  KEYWORD_DELETED: "keyword_deleted",
  DOMAIN_ADDED: "domain_added",
  REPORT_GENERATED: "report_generated",
  EXPORT_CSV: "export_csv",
  IMPORT_CSV: "import_csv",
  SEARCH_USED: "command_palette_search",
  ALERT_CREATED: "alert_created",
  SUBSCRIPTION_STARTED: "subscription_started",
} as const;
```

**useWebVitals.ts** — uses `web-vitals` npm package to report LCP, CLS, FID, TTFB, INP to the track action.

**AnalyticsDashboard** — admin page with:
- Top row: active users today, total events today, avg LCP, avg CLS
- Feature usage bar chart (horizontal bars, sorted by count)
- Conversion funnel (vertical steps with dropout %)
- Web Vitals panel with colored indicators (green/yellow/red)

### Test Requirements (r20-analytics.test.tsx)
- Test trackEvent stores event with correct shape
- Test getFeatureUsage aggregates correctly
- Test getConversionFunnel returns stage counts
- Test getWebVitals computes percentiles
- Test analytics abstraction exports EVENTS constants
- Test useWebVitals hook initializes (mock web-vitals)
- Test AnalyticsDashboard renders metric cards
- 10+ tests passing

### Acceptance Criteria
- analyticsEvents table created in schema
- track action stores events
- Admin analytics page at /admin/analytics shows feature usage, funnel, web vitals
- useWebVitals hook reports to Convex
- Event constants defined for key user actions
- All translations in EN and PL
- 10+ tests passing

---

## Task 4: R21 — Session Management & Account Security

**Goal:** Add active session tracking, login history, and a Security tab in settings.

### Files to Create
- `convex/security.ts` — session and login history queries/mutations
- `src/components/settings/SecurityTab.tsx` — security settings tab (expand existing or create new)
- `src/components/settings/ActiveSessionsList.tsx` — active sessions table
- `src/components/settings/LoginHistoryTable.tsx` — login history table
- `src/test/integration/r21-session-management.test.tsx`

### Files to Modify
- `convex/schema.ts` — add userSessions and loginHistory tables
- `convex/auth.ts` — hook into afterUserCreated/afterLogin callbacks to track sessions
- `src/app/(dashboard)/settings/page.tsx` — add Security tab
- `src/messages/en/settings.json` — security tab translations
- `src/messages/pl/settings.json` — security tab translations

### Schema Additions
```typescript
userSessions: defineTable({
  userId: v.id("users"),
  deviceInfo: v.object({
    userAgent: v.string(),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    deviceType: v.string(),  // "desktop", "mobile", "tablet"
  }),
  ipAddress: v.optional(v.string()),
  location: v.optional(v.string()),  // "Country, City" (simplified)
  status: v.string(),  // "active", "revoked", "expired"
  isCurrent: v.optional(v.boolean()),
  loginAt: v.number(),
  lastActivityAt: v.number(),
  revokedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])

loginHistory: defineTable({
  userId: v.id("users"),
  loginMethod: v.string(),  // "password", "google"
  deviceInfo: v.object({
    userAgent: v.string(),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
  }),
  ipAddress: v.optional(v.string()),
  status: v.string(),  // "success", "failed"
  failureReason: v.optional(v.string()),
  loginAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_date", ["userId", "loginAt"])
```

### Backend Implementation (convex/security.ts)

```typescript
// Queries
getActiveSessions: query — returns all active sessions for current user, sorted by lastActivityAt desc
getLoginHistory: query({ limit: v.optional(v.number()) }) — returns last N login attempts (default 50)

// Mutations
trackSession: internalMutation({ userId, deviceInfo, ipAddress }) — creates new session record
updateSessionActivity: internalMutation({ sessionId }) — updates lastActivityAt
revokeSession: mutation({ sessionId }) — marks session as revoked, verifies ownership
revokeAllOtherSessions: mutation({}) — revokes all sessions except current
trackLoginAttempt: internalMutation({ userId, loginMethod, deviceInfo, ipAddress, status, failureReason })

// Cron helper
cleanExpiredSessions: internalMutation — marks sessions older than 30 days as expired
```

### Auth Integration
In `convex/auth.ts`, add callbacks:
```typescript
// After successful login — track session and login history
afterUserCreatedOrSignedIn: async (ctx, { userId }) => {
  await ctx.runMutation(internal.security.trackSession, {
    userId, deviceInfo: { userAgent: "...", deviceType: "desktop" }, ipAddress: ""
  });
  await ctx.runMutation(internal.security.trackLoginAttempt, {
    userId, loginMethod: "password", status: "success", ...
  });
}
```
Note: Convex Auth may have limited access to request headers. Use what's available; for IP/UA, may need to track from frontend via an action.

### Frontend Implementation

**SecurityTab** — added to settings page tabs:
- Section 1: Active Sessions — table showing device, location, last active, with "Revoke" button per row and "Revoke All Other Sessions" button
- Section 2: Login History — table showing date, method, device, status (success/failed), location
- Section 3: Password (move existing password change form here if not already in security tab)

**ActiveSessionsList:**
- Table columns: Device (browser+OS icon), Location, Last Active (relative time), Status
- Current session highlighted with badge
- Revoke button (with confirmation dialog)

**LoginHistoryTable:**
- Table columns: Date, Method (password/google icon), Device, IP, Status (green check / red x)
- Paginated, last 30 days by default

### Test Requirements (r21-session-management.test.tsx)
- Test trackSession creates session record
- Test revokeSession marks session as revoked
- Test revokeAllOtherSessions keeps current session active
- Test trackLoginAttempt records success and failure
- Test getActiveSessions returns only active sessions for user
- Test getLoginHistory returns attempts sorted by date
- Test ActiveSessionsList renders sessions with revoke buttons
- Test LoginHistoryTable renders history entries
- 10+ tests passing

### Acceptance Criteria
- userSessions and loginHistory tables in schema
- Sessions tracked on login
- Security tab in settings shows active sessions and login history
- Users can revoke individual sessions and all other sessions
- Login attempts (success/fail) recorded
- All translations in EN and PL
- 10+ tests passing

---

## Agent Team Plan

All 4 tasks are independent and run in parallel worktrees:

| Agent | Task | Scope |
|-------|------|-------|
| r16-agent | R16 Loading & Error States | error.tsx/loading.tsx for all routes, ErrorBoundary upgrade, tests |
| r19-agent | R19 Admin Health Dashboard | adminHealth.ts, health page, bulk ops, tests |
| r20-agent | R20 Analytics MVP | analytics schema/tracking, admin dashboard, web vitals, tests |
| r21-agent | R21 Session Management | security.ts, session/login tables, Security tab, tests |

No cross-dependencies. Each agent commits independently.

## Verification Checklist (post-merge)
- [ ] `next build` passes
- [ ] `npm test` passes (all existing + new)
- [ ] All 4 admin pages accessible (/admin/health, /admin/analytics)
- [ ] Settings Security tab visible
- [ ] All route segments have error.tsx and loading.tsx
- [ ] EN and PL translations complete
