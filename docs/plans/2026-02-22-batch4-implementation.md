# Batch 4 Implementation Plan — R09 (AI Reports), R10 (GSC Integration)

> **For Claude:** Each task is a standalone worktree agent. Agent must implement code + tests + commit.

**Goal:** Complete the last 2 Tier 1 items. R09 builds the AI report generation pipeline reusing the aiStrategy pattern. R10 adds Google Search Console data import.

**Architecture:** R09 is scoped to the generation pipeline (not the full public viewer which already exists). R10 is scoped to the connection flow and data sync (dashboard widgets already partially exist through domain pages).

---

## Task 1: R09 — AI Report Engine

**Goal:** Build the AI-powered report generation pipeline that collects data, runs parallel AI analysts, synthesizes results, and generates PDF reports with scheduled delivery.

### Files to Create
- `convex/aiReports.ts` — report session management, progress tracking, admin queries
- `convex/actions/aiReportGeneration.ts` — main generation action with multi-phase pipeline
- `src/app/(dashboard)/domains/[domainId]/reports/page.tsx` — reports tab/page for domain
- `src/components/domain/reports/ReportGenerationWizard.tsx` — config + launch UI
- `src/components/domain/reports/ReportSessionProgress.tsx` — real-time progress display
- `src/components/domain/reports/GeneratedReportsList.tsx` — list of completed reports
- `src/test/integration/r09-ai-reports.test.tsx`

### Files to Modify
- `convex/schema.ts` — add aiReportSessions table
- `convex/crons.ts` — add scheduled report generation cron
- `src/messages/en/domain.json` — report translations
- `src/messages/pl/domain.json` — report translations

### Schema Addition
```typescript
aiReportSessions: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  createdBy: v.id("users"),
  reportType: v.string(), // "executive-summary", "detailed-keyword", "competitor-analysis", "progress-report", "custom"
  config: v.object({
    dateRange: v.object({ start: v.number(), end: v.number() }),
    sections: v.array(v.string()),
    audience: v.optional(v.string()),
    language: v.optional(v.string()),
  }),
  status: v.string(), // "initializing", "collecting", "analyzing", "synthesizing", "generating-pdf", "completed", "failed"
  progress: v.number(), // 0-100
  currentStep: v.optional(v.string()),
  // Phase results stored incrementally
  collectedData: v.optional(v.any()),
  analysisResults: v.optional(v.any()),
  synthesisResult: v.optional(v.any()),
  // Output
  generatedReportId: v.optional(v.id("generatedReports")),
  error: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_domain", ["domainId"])
  .index("by_org", ["organizationId"])
  .index("by_status", ["status"])
```

### Backend Implementation

**convex/aiReports.ts:**
```typescript
// Queries
getReportSessions: query({ domainId }) — returns sessions for domain, sorted by createdAt desc
getReportSession: query({ sessionId }) — returns single session with progress details
getScheduledReports: query({ organizationId }) — returns reports with auto-generation config

// Mutations
createReportSession: mutation({ domainId, reportType, config }) — creates session, kicks off generation action
cancelReportSession: mutation({ sessionId }) — cancels in-progress session
updateSessionProgress: internalMutation({ sessionId, status, progress, currentStep, data }) — progress updates
completeSession: internalMutation({ sessionId, generatedReportId }) — mark as completed
failSession: internalMutation({ sessionId, error }) — mark as failed
```

**convex/actions/aiReportGeneration.ts:**
Follow aiStrategy.ts pattern with these phases:

Phase 1 — Data Collection (progress 0-30%):
- Reuse aiStrategy's internal queries: keywords, competitors, backlinks, on-site scores, visibility
- Collect domain metrics, position history, SERP features
- Store collected data on session

Phase 2 — AI Analysis (progress 30-70%):
- Use existing AI settings (org.aiSettings or defaults)
- Parallel AI calls via ctx.runAction:
  - Keyword Performance Analyst: analyze position trends, identify winners/losers, group patterns
  - Competitive Analyst: compare vs competitors, identify gaps, benchmark
  - Technical Analyst: on-site issues, page speed, indexation
- Each analyst returns structured JSON with findings + recommendations

Phase 3 — Synthesis (progress 70-85%):
- Combine analyst outputs into cohesive narrative
- Generate executive summary
- Prioritize recommendations
- Create actionable next steps

Phase 4 — PDF Generation (progress 85-100%):
- Use existing generateDomainReportPdf infrastructure
- Pass synthesis results to PDF renderer
- Store in generatedReports table
- If scheduled: send via email using R08's sendEmail

### Frontend Implementation

**ReportGenerationWizard:**
- Step 1: Select report type (4 presets + custom)
- Step 2: Configure date range and sections
- Step 3: Review and generate
- Uses existing reportSections.ts registry for section configs

**ReportSessionProgress:**
- Real-time progress bar using useQuery subscription
- Shows current phase and step description
- Shows partial results as they come in (analyst findings preview)

**GeneratedReportsList:**
- Table of completed reports with: type, date range, created date, status
- Download PDF button
- Share link button (uses existing report sharing)
- Delete button

### Test Requirements (r09-ai-reports.test.tsx)
- Test createReportSession creates session with correct config
- Test updateSessionProgress updates progress correctly
- Test completeSession links to generatedReports
- Test failSession records error
- Test getReportSessions returns sessions sorted by date
- Test ReportGenerationWizard renders type selection
- Test ReportSessionProgress shows progress bar
- Test GeneratedReportsList renders completed reports
- 12+ tests passing

### Acceptance Criteria
- Users can generate AI reports from domain page
- Progress tracking shows real-time updates
- Completed reports appear in list with download
- Report types: executive, keyword, competitor, progress, custom
- All translations in EN and PL
- 12+ tests passing

---

## Task 2: R10 — Google Search Console Integration

**Goal:** OAuth2 connection flow, GSC property verification, periodic data sync, and dashboard display of GSC metrics alongside existing position data.

### Files to Create
- `convex/gsc.ts` — GSC connection management, data queries, sync mutations
- `convex/actions/gscSync.ts` — GSC API client and sync action
- `src/components/settings/GscConnectionPanel.tsx` — connect/disconnect UI
- `src/app/auth/gsc-callback/page.tsx` — OAuth callback handler
- `src/components/domain/GscMetricsCard.tsx` — GSC data display widget
- `src/test/integration/r10-gsc-integration.test.tsx`

### Files to Modify
- `convex/schema.ts` — add gscConnections and gscKeywordMetrics tables
- `convex/crons.ts` — add daily GSC sync cron
- `src/app/(dashboard)/settings/page.tsx` — add Integrations tab
- `src/messages/en/settings.json` — GSC translations
- `src/messages/pl/settings.json` — GSC translations

### Schema Additions
```typescript
gscConnections: defineTable({
  organizationId: v.id("organizations"),
  googleEmail: v.string(),
  accessToken: v.string(),
  refreshToken: v.string(),
  tokenExpiresAt: v.number(),
  properties: v.array(v.object({
    url: v.string(),
    type: v.string(), // "domain" or "url_prefix"
  })),
  selectedPropertyUrl: v.optional(v.string()),
  lastSyncAt: v.optional(v.number()),
  status: v.string(), // "active", "expired", "disconnected"
  connectedAt: v.number(),
})
  .index("by_org", ["organizationId"])

gscKeywordMetrics: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  keyword: v.string(),
  date: v.string(), // "2026-02-22"
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
  url: v.optional(v.string()),
})
  .index("by_domain_date", ["domainId", "date"])
  .index("by_domain_keyword", ["domainId", "keyword"])
```

### Backend Implementation

**convex/gsc.ts:**
```typescript
// Queries
getGscConnection: query({ organizationId }) — returns connection status and properties
getGscMetrics: query({ domainId, startDate, endDate }) — returns aggregated metrics
getGscKeywordComparison: query({ domainId, limit }) — compares GSC position vs DataForSEO position per keyword

// Mutations
initiateGscConnection: mutation({ organizationId }) — generates OAuth URL with state token
completeGscConnection: mutation({ organizationId, code, state }) — exchanges code for tokens, fetches properties
disconnectGsc: mutation({ organizationId }) — revokes tokens, marks as disconnected
selectGscProperty: mutation({ organizationId, propertyUrl }) — selects property for sync
refreshGscToken: internalMutation({ connectionId }) — refreshes expired access token

// Internal
syncGscData: internalAction({ organizationId }) — fetches latest GSC data and stores
storeGscMetrics: internalMutation({ metrics }) — batch inserts daily metrics
```

**convex/actions/gscSync.ts:**
- Google Search Console API client using REST API
- OAuth2 token exchange and refresh
- Search Analytics query: last 28 days of data (clicks, impressions, ctr, position) per query
- Rate limit: max 100 requests/batch, pause between batches
- Error handling: token expiry → auto-refresh, API errors → log and retry

### Frontend Implementation

**GscConnectionPanel (in Settings > Integrations tab):**
- "Connect Google Search Console" button → opens Google OAuth popup
- Shows connected email and available properties
- Property selector dropdown
- "Disconnect" button with confirmation
- Last sync timestamp display

**OAuth Callback Page:**
- Receives authorization code from Google redirect
- Calls completeGscConnection mutation
- Redirects back to settings/integrations

**GscMetricsCard:**
- Small card showing: total clicks, impressions, avg CTR, avg position (last 28 days)
- Comparison: GSC position vs DataForSEO position for matched keywords
- Used on domain detail page

### Test Requirements (r10-gsc-integration.test.tsx)
- Test initiateGscConnection generates OAuth URL
- Test completeGscConnection stores tokens and properties
- Test disconnectGsc clears connection
- Test selectGscProperty updates selected property
- Test getGscConnection returns connection status
- Test getGscMetrics aggregates metrics correctly
- Test getGscKeywordComparison matches keywords
- Test GscConnectionPanel renders connect/disconnect states
- Test GscMetricsCard renders metrics
- 10+ tests passing

### Acceptance Criteria
- Users can connect GSC via OAuth from Settings > Integrations
- Property selection works
- Daily sync fetches keyword metrics from GSC
- Domain page shows GSC metrics card
- Keyword comparison (GSC vs DataForSEO position) available
- All translations in EN and PL
- 10+ tests passing

---

## Agent Team Plan

Both tasks are independent:

| Agent | Task | Scope |
|-------|------|-------|
| r09-agent | R09 AI Report Engine | aiReports.ts, generation action, report UI, tests |
| r10-agent | R10 GSC Integration | gsc.ts, sync action, connection UI, OAuth callback, tests |

No cross-dependencies.

## Verification Checklist (post-merge)
- [ ] `next build` passes
- [ ] `npm test` passes
- [ ] Report generation wizard accessible from domain page
- [ ] GSC connection flow in Settings > Integrations
- [ ] EN and PL translations complete
