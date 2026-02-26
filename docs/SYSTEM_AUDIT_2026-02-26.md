# System Audit Report — 2026-02-26

## Executive Summary

Deep scan of the entire monitoring platform. 8 parallel audit agents scanned backend (125+ files), frontend (40+ components), i18n (5 locales x 23 namespaces), data transport, typing, and UX quality.

### Critical Findings At a Glance

| Category | Finding | Severity | Count |
|----------|---------|----------|-------|
| UX | FirstDomain onboarding step silently discards URL — domain never created | CRITICAL | 1 bug |
| UX | No tab deep linking — URL never reflects active tab | POOR | 1 structural issue |
| UX | No redirect after domain creation — user stranded on list | HIGH | 1 flow issue |
| UX | Onboarding dismiss permanently hides re-entry to setup wizard | MEDIUM | 1 flow issue |
| UX | window.confirm() used instead of design system modal | POOR | 2 locations |
| UX | Sidebar not collapsible (296px fixed) | POOR | 1 layout issue |
| UX | Chart accessibility — zero aria-labels on 20+ charts | POOR | systemic |
| UX | Icon-only buttons without aria-labels | POOR | ~10 buttons |
| Security | Public endpoints with ZERO auth checks | CRITICAL | ~115 endpoints across 39 files |
| Security | Debug log endpoint exposes API credentials | CRITICAL | 1 (convex/debugLog.ts) |
| Security | Unauthenticated AI/LLM action calls (cost exposure) | CRITICAL | 6 actions in convex/actions/ai*.ts |
| Security | Cross-tenant data leak (getAllActiveJobs) | CRITICAL | 2 endpoints in keywordCheckJobs.ts |
| Performance | N+1 queries in limits.ts (getSidebarUsage) | HIGH | ~116 DB queries per page load |
| Performance | N+1 queries in limits.ts (getRefreshLimitStatus) | HIGH | ~132 DB queries per refresh |
| Performance | 10 of 16 domain page queries run unconditionally | MEDIUM | 10 queries (7 backlinks + 3 visibility) |
| Data Integrity | Supabase dual-write: zero retry logic, silent failures | HIGH | 11 write locations |
| Data Integrity | Race conditions in mutations (createDomain, etc.) | HIGH | 10 patterns found |
| Frontend | Silent error handling (no user notification) | HIGH | 10 catch blocks |
| Frontend | Missing loading/error states in components | MEDIUM | 4-6 components |
| Frontend | useEffect without cleanup (race condition) | MEDIUM | 2 components |
| i18n | Hardcoded English strings in components | HIGH | 24 locations found |
| i18n | Hardcoded Polish strings in settings/admin | HIGH | 5 locations |
| Typing | v.any() loose typing on mutations | MEDIUM | 16 parameters |
| Typing | Arrays without size limits on mutations | MEDIUM | 6 mutations |
| Testing | Backlinks fixture field names don't match schema | HIGH | ~40% accuracy |

---

## 1. Security Audit (F1)

### P0 — Fix Before Any Deployment

1. `convex/debugLog.ts` — getLogs exposes ALL debug logs globally (includes base64-encoded DataForSEO credentials in Authorization headers). toggle/clearLogs allow global state manipulation. ZERO auth.

2. `convex/actions/ai*.ts` (6 files) — All AI actions (generateBusinessContext, searchCompetitorsWithAI, generateKeywordIdeas, runStrategist, generateDomainStrategy, drillDownSection) make LLM API calls with ZERO auth. Any anonymous user can burn LLM budget.

3. `convex/keywordCheckJobs.ts` — getAllActiveJobs and getRecentCompletedJobs return jobs across ALL organizations. Cross-tenant info disclosure: any user sees what domains all other orgs are checking.

### P1 — Fix Before Production

| File | Unprotected Endpoints | Highest Risk |
|------|----------------------|-------------|
| convex/backlinks.ts | 13 | CRITICAL (deleteBacklinks, fetchBacklinksFromAPI) |
| convex/webhooks.ts | 6 | CRITICAL (createWebhook — redirects to attacker URL) |
| convex/seoAudit_actions.ts | 6 | CRITICAL (cancelSeoAuditScan) |
| convex/competitorAnalysisReports.ts | 6 | CRITICAL (deleteReport, retryAnalysis) |
| convex/dashboards.ts | 9 | CRITICAL (deleteDashboardLayout, deleteView) |
| convex/calendarEvents.ts | 6 | CRITICAL (deleteEvent) |
| convex/contentGap.ts | 5 | CRITICAL (triggerContentGapAnalysis) |
| convex/contentGaps_actions.ts | 2 | CRITICAL (analyzeContentGaps) |
| convex/contentGaps_mutations.ts | 6 | HIGH |
| convex/linkBuilding_mutations.ts | 2 | CRITICAL (generateLinkBuildingReport — destructive) |
| convex/aiResearch.ts | 2 | CRITICAL (deleteSession) |
| convex/domainReports.ts | 4 | CRITICAL (generateDomainReport) |
| convex/competitorBacklinksJobs.ts | 5 | HIGH |
| convex/competitorContentGapJobs.ts | 5 | HIGH |
| convex/serpFeatures_mutations.ts | 2 | HIGH |
| convex/backlinkVelocity.ts | 3 | HIGH |
| convex/keywordSerpJobs.ts | 3 of 4 | HIGH |
| convex/keywordMap_mutations.ts | 2 | HIGH |
| convex/forecasts_mutations.ts | 3 | HIGH |
| convex/forecasts_actions.ts | 4 of 5 | HIGH |
| convex/generators.ts | 3 | HIGH |
| convex/onsite.ts | 3 | HIGH |
| convex/seranking.ts | 5 | HIGH (API cost exposure) |
| convex/linkBuilding_queries.ts | 3 | HIGH |
| convex/apiUsage.ts | 1 | HIGH (getUsageSummary — cross-tenant) |
| convex/admin.ts | 3 | HIGH (logApiUsage, testConnections) |
| convex/actions/webhookDelivery.ts | 1 | HIGH (testWebhook sends to arbitrary URLs) |
| convex/actions/generateLlmsTxt.ts | 1 | HIGH |
| convex/actions/generatePlatformInstructions.ts | 1 | HIGH |

**Total: ~115 unprotected public endpoints across 39 files.**

### Fix Pattern
Use existing `requirePermission(ctx, domainId, "module.action")` from convex/permissions.ts. For non-domain endpoints, at minimum: `const userId = await auth.getUserId(ctx); if (!userId) throw new ConvexError("Not authenticated");`

---

## 2. Performance Audit (D1, D2, D3)

### N+1 Query Patterns

| Function | Nesting | Est. Queries (50 domains) | Frequency |
|----------|---------|--------------------------|-----------|
| limits.ts: getSidebarUsage | org→teams→projects→domains→keywords | ~116 | Every page load |
| limits.ts: getRefreshLimitStatus | org→domains + 2 collects/domain | ~132 | Every refresh button |
| limits.ts: countOrgKeywords | org→teams→projects→domains→count | ~66 | Every keyword add |
| domains.ts: list | teams→projects→domains→keywords | ~50+ | Sidebar |
| domains.ts: getDomains | domains→keywords per domain | ~N domains | Project dashboard |

### .collect() Hotspots (loading full tables into memory)

| Function | Table | Max Rows | Issue |
|----------|-------|----------|-------|
| backlinks.ts: getBacklinks | domainBacklinks | 1,000 | Sort/filter in memory |
| backlinks.ts: getBacklinksHistory | domainBacklinks | 1,000 | Group by date in memory |
| limits.ts: countJobsTodayForDomains | keywordCheckJobs/serpJobs | Unbounded | 2 collects per domain |
| scheduler.ts: getDailyDomains | domains | Unbounded | Full table scan, filter in memory |
| backlinks.ts: deleteAllBacklinks | domainBacklinks | Unbounded | Full table scan |

### Domain Page Query Loading (skip optimization)

10 of 16 queries should use `"skip"` when their tab is not active:
- 7 backlinks queries (getBacklinkSummary, isBacklinkDataStale, getBacklinkDistributions, getVelocityHistory, getVelocityStats x2, getBacklinks)
- 3 visibility queries (getVisibilityStats, getTopKeywords x2)

---

## 3. Data Integrity Audit (A2)

### Supabase Dual-Write

11 write locations, ALL fire-and-forget with `.catch(console.error)`. Zero retry logic. `writeKeywordPositions` in convex/lib/supabase.ts internally swallows errors (log + no re-throw).

Impact: MovementTrendChart, PositionHistoryChart, and competitor comparison queries read from Supabase. Transient Supabase failures = permanent data gaps with no recovery path except manual backfill.

### Race Conditions

| Pattern | File | Risk |
|---------|------|------|
| createDomain uniqueness (filter, not index) | domains.ts:112 | High — duplicate domains |
| createDomainInternal same pattern | domains.ts:921 | High |
| addCompetitor uniqueness check | competitors.ts:46 | Medium — duplicate competitors |
| trackCompetitorsBatch in loop | keywordSerpJobs.ts:632 | Medium |
| triggerSeoAuditScan active check | seoAudit_actions.ts:118 | Medium |
| createSerpFetchJob no active-job check | keywordSerpJobs.ts:14 | Medium |
| promoteDiscoveredKeywords per-keyword check | domains.ts:387 | Low |

---

## 4. Frontend Rendering Audit (B1, E1)

### Components Missing States

| Component | Missing |
|-----------|---------|
| CrawlAnalyticsSection | No loading state (renders blank) |
| WordFrequencySection | No loading state (renders blank) |
| SitemapOverviewCard | Loading collapsed with null (no skeleton) |
| StrategySection | May flash generator view while loading |
| PositionDistributionChart | No error state |
| DifficultyDistributionChart | No error state |
| SERPFeaturesChart/Section | No error state |

### Silent Error Handling (no user notification)

| File | Operation | Issue |
|------|-----------|-------|
| GenerateReportModal | handleGenerate | console.error only, spinner stops silently |
| GenerateReportModal | handleDownloadPdf | console.error only, download fails silently |
| ShareLinkDialog | handleCreate | console.error only |
| ShareLinkDialog | handleDelete | No try/catch at all |
| CompetitorDiscoveryStep | handleAISearch | console.error, no toast |

### useEffect Race Conditions

| Component | Issue |
|-----------|-------|
| UrlSelectionModal | No cleanup on isOpen change, stale data risk |
| CompetitorDiscoveryStep | No cleanup on dependency change, stale AI results |

### Hard Crash Risk

BacklinksTable line 626: `new URL(backlink.urlFrom).hostname` — throws TypeError on malformed URLs. Needs try/catch.

---

## 5. i18n Audit (G1, G2)

### Translation Parity
All 23 namespaces have IDENTICAL key counts across all 5 locales. No missing keys found. Polish uses ICU plural syntax which is correct.

### Hardcoded Strings (24 locations found)

HIGH severity (user-facing):
1. formatRelativeTime() duplicated 3x, 2 copies hardcoded English (domains/[domainId]/page.tsx, projects/page.tsx)
2. SessionManagement.tsx — "Just now", "Xm ago", "Xh ago"
3. Settings page — Stripe error in English, billing errors in Polish
4. ErrorBoundary.tsx — "Something went wrong" (class component, can't use hooks)
5. KeywordImportModal.tsx — 6 validation messages
6. CompetitorImportModal.tsx — 3 validation messages

MEDIUM severity:
7. CSV export headers hardcoded in English (KeywordMonitoringTable, DiscoveredKeywordsTable, BacklinksTable, CompetitorManagement)
8. ImportWizardModal — "Please map all required fields..."
9. ScheduleManager — 5 error toasts (success translated, errors not)
10. WhiteLabelTab — "Failed to save branding"
11. ClientManagement — 3 error toasts
12. Admin plans page — 6 Polish strings

LOW severity:
13. date-range-picker — "Today", "This week", preset labels
14. ModuleHubCard — ~40 English labels (2254-line component, no i18n)
15. QuickWinsTable — column labels
16. Insights page — filter placeholders

---

## 6. Typing Audit (C2)

### Loose Types (v.any())

16 parameters use v.any() — most are on internal mutations (lower risk) but backlinks.ts uses v.array(v.any()) on saveBacklinkData which writes directly to DB.

### Missing Array Size Limits

6 mutations accept unbounded arrays:
- keywords.ts: addKeywords (phrases array)
- keywords.ts: deleteKeywords (keywordIds)
- domains.ts: promoteDiscoveredKeywords, ignoreDiscoveredKeywords
- backlinks.ts: deleteBacklinks (backlinkIds)

### Fixture Accuracy

Most fixtures are accurate (90-100%), except:
- `BACKLINKS_LIST` fixture — ~40% accuracy. Field names (sourceUrl, isDofollow, etc.) don't match actual schema (urlFrom, dofollow). Tests pass but don't catch real rendering issues.
- `DOMAIN_DETAIL` fixture — ~80%. Missing gscPropertyUrl, onboardingDismissed. Has extra `limits` field.
- `CURRENT_USER` fixture — ~70%. Minimal stub, missing fields.

---

## Prioritized Fix List

### Sprint 1 (CRITICAL — before deployment)

1. **debugLog.ts**: Convert all 4 exports to internalQuery/internalMutation or add requireSuperAdmin()
2. **AI actions**: Add auth to all 6 convex/actions/ai*.ts files
3. **keywordCheckJobs.ts**: Fix getAllActiveJobs/getRecentCompletedJobs cross-tenant leak
4. **Auth sweep**: Add requirePermission() to all 39 files with gaps (batch this)

### Sprint 2 (HIGH — first two weeks)

5. **limits.ts**: Denormalize keyword/domain counts to eliminate N+1
6. **Domain page**: Add "skip" to 10 tab-gated queries
7. **Supabase dual-write**: Add retry queue or reconciliation job
8. **Race conditions**: Add unique indexes for createDomain, addCompetitor

### Sprint 3 (MEDIUM — month 1)

9. **Silent errors**: Add toast.error() to 5 catch blocks in modals
10. **BacklinksTable**: Wrap new URL() in try/catch
11. **useEffect cleanup**: Add cancelled flags in UrlSelectionModal, CompetitorDiscoveryStep
12. **Backlinks fixture**: Fix field names to match schema
13. **.collect() hotspots**: Add .take() limits and index filters

### Sprint 4 (LOW — month 2)

14. **Hardcoded strings**: Wire up translations for 24 locations
15. **Loose typing**: Replace v.any() with typed schemas
16. **Array size limits**: Add validator-level caps
17. **Missing loading states**: Add skeletons to 4 components
18. **ErrorBoundary i18n**: Accept translated strings as props

---

## 7. UX Audit

### 7a. Critical User Flow Issues

| ID | Issue | Severity | File |
|----|-------|----------|------|
| D1 | FirstDomain onboarding step silently discards the domain URL — `handleDomainSubmit` resolves an empty Promise and calls `completeOnboarding()` without ever calling `createDomain`. Users who fill in their domain on step 3 are dropped to an empty domains list. | CRITICAL | FirstTimeFlow.tsx:44-65 |
| A1 | No redirect after domain creation — user stays on the domains list and must manually click the new row | HIGH | CreateDomainDialog |
| A6 | After adding first keywords, user sees empty table with no ETA. No "positions will appear after first check" message. GlobalJobStatus only shows if a job is immediately queued. | HIGH | KeywordMonitoringTable, GlobalJobStatus |
| B2 | Page-level refresh button bypasses RefreshConfirmModal (limit preview). Table's "Refresh All" correctly opens the modal. Same action, different patterns. | MEDIUM | domains/[domainId]/page.tsx |
| A3/D3 | Dismissing onboarding checklist (X button) permanently hides the only re-entry to the setup wizard. No "Resume Setup" anywhere after dismissal. | MEDIUM | OnboardingChecklist |
| B1 | Overview tab is pure navigation (module hub cards), not a dashboard. Daily users must click through to Monitoring every time — no "X keywords changed today" summary. | MEDIUM | domains/[domainId]/page.tsx |
| B5 | No "show only movers" or "changed since last check" filter in keyword table — the single most useful daily feature for power users. | MEDIUM | KeywordMonitoringTable |
| A4 | CSV import hidden in three-dots overflow menu. Users migrating from other rank trackers won't find it. | MEDIUM | KeywordMonitoringTable |
| A2 | Edit button on domains list fires `toast.info("coming soon")` — a visible clickable button that does nothing. | MEDIUM | domains list page |
| Tour | Product tour `data-tour` CSS selectors don't exist on any real elements — tour would silently fail. | MEDIUM | Tour system |

### 7b. Navigation & Information Architecture

| Aspect | Rating | Detail |
|--------|--------|--------|
| Tab count (17 tabs) | NEEDS_IMPROVEMENT | Exceeds cognitive limit (7-9 recommended). Module-gating helps but power users see 14+. |
| Tab URL deep linking | POOR | `useState` only — no URL sync. Refresh resets to Overview. URLs not shareable. No browser back support. |
| Tab state on re-navigation | POOR | Navigate away and back = always reset to Overview. No sessionStorage backup. |
| Tab ordering | ACCEPTABLE | Most-used first (Monitoring, Visibility). Minor: Keyword Analysis between Insights and Content Gaps. |
| Sidebar active state | GOOD | Correctly indicated via pathname. |
| Breadcrumbs | ACCEPTABLE | Present on desktop, hidden on mobile (replaced with back button). |
| Sidebar collapsibility | POOR | Fixed 296px, no collapse toggle. Takes 29% of 1024px viewport. |
| Mobile tab overflow | NEEDS_IMPROVEMENT | 17 tabs in horizontal list overflow phones with no scroll container. |

### 7c. Loading State Quality

| Component | Rating | Issue |
|-----------|--------|-------|
| MonitoringStats skeleton | POOR | 3-col/5-box skeleton vs actual 4-col/4-card layout. Visible layout shift. |
| InsightsSection skeleton | POOR | 4 gray rectangles vs complex layout (health ring, bars, cards). No resemblance. |
| ExecutiveSummary skeleton | POOR | Full 3-col nested grid per cell vs single stat figure. Excessive visual weight. |
| Domain page loading.tsx | POOR | Generic detail skeleton vs full tabbed dashboard. Completely unrelated layout. |
| KeywordMonitoringTable | NEEDS_IMPROVEMENT | Skeleton without table header — user loses column context. |
| CompetitorManagementSection | POOR | Plain text "Loading..." — no skeleton, no animation. Jarring jump on data arrival. |
| AlertsSection (AlertRulesManager) | POOR | Hardcoded "Loading..." text, gray-500 color. No skeleton. |
| VisibilityStats | GOOD | 4 skeleton cards matching exact 4-column grid. Best example in codebase. |
| MovementTrendChart | GOOD | LoadingState inside card frame, card chrome preserved. |

### 7d. Empty State Quality

| Component | Rating | Issue |
|-----------|--------|-------|
| MonitoringStats | POOR | Text only "No keywords monitored yet" — no icon, no CTA. |
| AlertsSection | POOR | Faint centered text, no icon, no CTA. Virtually invisible. |
| KeywordMonitoringTable | GOOD | SearchLg icon, descriptive text, "Add Keywords" CTA button. |
| OnSiteSection | GOOD | CTA with PermissionGate — scan button or upgrade message. |
| InsightsSection | GOOD | CheckCircle icon, "Looking good" positive framing. |
| TopicClusterDetailModal | NEEDS_IMPROVEMENT | No empty state for empty keywords array — table with headers only. |

### 7e. Error State Quality

| Component | Rating | Issue |
|-----------|--------|-------|
| MovementTrendChart | NEEDS_IMPROVEMENT | Shows raw `err.message` (may expose internals). No retry button. |
| error.tsx (dashboard boundary) | NEEDS_IMPROVEMENT | Exponential backoff auto-retry (good), but displays raw error.message. |
| ContentGapSection | NEEDS_IMPROVEMENT | No section-level error state. 5 sub-queries fail independently. |
| AlertsSection toggle | NEEDS_IMPROVEMENT | Toggle mutation failure silently reverts, no explanation. |
| GenerateReportModal | GOOD | Error panel with retry, preserves context. Best error handling in codebase. |

### 7f. Transition States & Double-Submit Protection

| Component | Rating | Issue |
|-----------|--------|-------|
| CompetitorManagement — delete | POOR | Uses `window.confirm()` instead of design system modal. Blocks main thread, inaccessible. |
| CompetitorManagement — edit Save | POOR | No `isSubmitting` guard. Double-click fires mutation twice. |
| KeywordAnalysisReport — Retry/Delete | NEEDS_IMPROVEMENT | No disabled state during async. Double-click fires multiple mutations. |
| KeywordMonitoringTable — per-row delete | NEEDS_IMPROVEMENT | Fires without confirmation and without loading indicator. |
| RefreshConfirmModal | ACCEPTABLE | Buttons disabled during submission. |
| BulkDeleteConfirmModal | GOOD | "Deleting..." text, both buttons disabled. |
| AddKeywordsModal | GOOD | Full form lockdown: submit, cancel, textarea all disabled. |

### 7g. Visual Consistency Issues

| Area | Rating | Issue |
|------|--------|-------|
| Chart library | NEEDS_IMPROVEMENT | Two styles: bare Recharts vs shadcn ChartContainer. Different tooltip styling on same page. |
| Chart colors | NEEDS_IMPROVEMENT | Not centralized. Orange hardcoded in one chart, green/red in another, brand-600 in third. |
| Modal widths | NEEDS_IMPROVEMENT | Mix of `sm:max-w-160`, `max-w-4xl`, and no max-width. No standard tokens. |
| Native select vs design system | NEEDS_IMPROVEMENT | Tables use raw `<select>`, modals use design system Select. |
| Number formatting | NEEDS_IMPROVEMENT | `formatNumber` copy-pasted in 4 files independently. |
| Position badge colors | GOOD | Consistent semantic color mapping across all 3 keyword tables. |
| Date formatting | NEEDS_IMPROVEMENT | Mixed locales: some `en-US` hardcoded, some browser default, some no locale. |
| Duplicated helpers | NEEDS_IMPROVEMENT | `formatNumber` and `getPositionBadgeClass` duplicated in 3-4 files each. |

### 7h. Accessibility

| Area | Rating | Issue |
|------|--------|-------|
| Chart accessibility | POOR | Zero charts have aria-label, role="img", or SVG title. Invisible to screen readers. |
| Icon-only button labels | POOR | Header action buttons (share, report, refresh, edit, delete) have tooltip only — no aria-label. |
| Color-only indicators | NEEDS_IMPROVEMENT | Difficulty column is color-only (green/yellow/red) with no supplemental text. Position badges: color + number but no text label like "Top 3". |
| Modal keyboard navigation | GOOD | react-aria-components handles focus trapping correctly. |
| Form labels | ACCEPTABLE | Wrapping label pattern used consistently. |
| Focus ring on raw buttons | NEEDS_IMPROVEMENT | Table row expand buttons have no focus-visible styles. |
| aria-label count | POOR | Only 7 instances across entire domain components directory. |

### 7i. Responsiveness

| Area | Rating | Issue |
|------|--------|-------|
| Table horizontal scroll | ACCEPTABLE | `overflow-x-auto` applied consistently. Keyword column sticky. |
| Modal responsive behavior | GOOD | Sheet-from-bottom on mobile, centered on desktop. |
| Mobile navigation | GOOD | Sidebar switches to drawer overlay on mobile. |
| Mobile tab overflow | NEEDS_IMPROVEMENT | 17 tabs overflow without scroll container on phones. |
| Sidebar width | POOR | Fixed 296px, not collapsible. |

### 7j. Notification & Feedback Patterns

| Area | Rating | Issue |
|------|--------|-------|
| Toast consistency | ACCEPTABLE | ~185 error + ~162 success toasts. richColors via Sonner. Ad-hoc duration overrides (4s/5s/7s/8s). |
| Job completion | GOOD | GlobalJobStatus widget + JobCompletionNotifier toasts. Potential double-notification for overlapping job types. |
| Notification center | POOR | None — all feedback is ephemeral toasts. If user is on another page when job completes and toast expires, outcome is lost. |
| Limit pre-communication | NEEDS_IMPROVEMENT | Keyword counts shown in sidebar, but daily refresh quota NOT shown until user hits the limit. |
| RefreshConfirmModal limit preview | GOOD | Shows detailed breakdown of all 6 limit types with green/red indicators. Best limit UX in the app. |

---

## Updated Prioritized Fix List (with UX items)

### Sprint 0 (CRITICAL — immediate)

1. **D1: FirstDomain onboarding bug** — handleDomainSubmit silently discards domain URL. Fix the function to actually call createDomain.
2. **debugLog.ts** — Convert all 4 exports to internal or add requireSuperAdmin()
3. **AI actions auth** — Add auth to all 6 convex/actions/ai*.ts files
4. **keywordCheckJobs cross-tenant** — Fix getAllActiveJobs/getRecentCompletedJobs

### Sprint 1 (HIGH — before launch)

5. **Auth sweep** — Add requirePermission() to all 39 files with gaps (~115 endpoints)
6. **Tab deep linking** — Sync active tab to URL search params (useSearchParams)
7. **Post-creation redirect** — After domain creation, navigate to the new domain page
8. **limits.ts N+1** — Denormalize keyword/domain counts
9. **Domain page query skip** — Add "skip" to 10 tab-gated queries
10. **Supabase dual-write retry** — Add retry queue or reconciliation job

### Sprint 2 (MEDIUM — first month)

11. **window.confirm() replacement** — CompetitorManagement: use BulkDeleteConfirmModal
12. **Double-submit protection** — Add isSubmitting guards to CompetitorManagement Save, KeywordAnalysisReport Retry/Delete
13. **Silent errors** — Add toast.error() to 5 catch blocks in modals
14. **Loading skeleton accuracy** — Fix MonitoringStats, InsightsSection, ExecutiveSummary, domain loading.tsx
15. **Onboarding re-entry** — Add "Resume Setup" link somewhere in domain UI after checklist dismissal
16. **Overview dashboard** — Add "keywords changed today" summary to Overview tab
17. **Sidebar collapsibility** — Add collapse/expand toggle
18. **Race conditions** — Add unique indexes for createDomain, addCompetitor
19. **.collect() hotspots** — Add .take() limits and index filters

### Sprint 3 (LOW — month 2)

20. **Chart accessibility** — Add aria-labels to all 20+ charts
21. **Icon button aria-labels** — Add to all header action buttons
22. **"Changed today" filter** — Add movers filter to KeywordMonitoringTable
23. **CSV import discoverability** — Promote from overflow menu to visible button
24. **Hardcoded strings i18n** — Wire up translations for 24 locations
25. **Chart visual consistency** — Centralize color palette, standardize ChartContainer usage
26. **Notification center** — Persist job outcomes beyond ephemeral toasts
27. **Duplicate helpers** — Extract formatNumber, getPositionBadgeClass to shared utils
28. **Loose typing** — Replace v.any() with typed schemas
29. **Mobile tab overflow** — Add horizontal scroll or dropdown for 17 tabs
