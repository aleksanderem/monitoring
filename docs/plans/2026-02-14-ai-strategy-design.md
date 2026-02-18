# AI SEO Strategy Generator — Design Document

Date: 2026-02-14
Session: S0073

## Overview

Expand the Insights tab with an AI-powered, data-driven SEO strategy generator. The feature collects ALL available domain data (keywords, positions, content gaps, competitors, backlinks, on-site health, visibility trends, job status, link building prospects), feeds it to Claude as structured context, and generates a comprehensive 10-section strategy with drill-down capabilities per section.

## Architecture: Hybrid (Raport + Drill-down)

One-shot generation of the full strategy via a single Claude API call. Each of the 10 sections supports optional drill-down: user clicks "Pogłęb" or asks a custom question, and the system makes an additional Claude call with the section's raw data + original strategy context.

### Data Flow

```
User clicks "Generate Strategy"
  → Convex action: collectDomainData()
    → 13 + C queries (C = competitor count)
    → Compress to structured summary (~2-4k tokens)
  → Convex action: generateStrategy()
    → Build prompt: system + business context + data summary + output instructions
    → Claude Sonnet 4.5 call (max_tokens: 12000, temperature: 0.3)
    → Parse JSON response
    → Store as aiStrategySessions record (status: "completed")
  → Frontend renders 10-section accordion with drill-down buttons

User clicks "Pogłęb" on a section
  → Convex action: drillDownSection()
    → Load original session + fresh raw data for that section
    → Claude call with section context + optional user question
    → Append to session.drillDowns array
  → Frontend shows drill-down result inline below section
```

## Data Collection Layer

### Queries per domain (fixed count, no per-keyword queries)

| # | Table | Index | Method | Purpose |
|---|-------|-------|--------|---------|
| 1 | keywords | by_domain | collect | Active/paused keywords with denormalized positions |
| 2 | discoveredKeywords | by_domain | collect | Visibility, quick wins, cannibalization |
| 3 | contentGaps | by_domain | collect | Opportunities, scores, traffic value |
| 4 | competitors | by_domain | collect | Competitor list |
| 5-5+C | competitorKeywordPositions | by_competitor | collect | Per-competitor coverage (C queries) |
| 6 | domainBacklinks | by_domain | collect | Link profile |
| 7 | domainBacklinksSummary | by_domain | unique | Summary totals |
| 8-9 | domainVisibilityHistory | by_domain | take(2) | Trend comparison |
| 10 | domainOnsiteAnalysis | by_domain | first | Health score |
| 11 | linkBuildingProspects | by_domain | collect | Prospect pipeline |
| 12 | aiResearchSessions | by_domain | order desc, first | Re-use business context |
| 13 | keywordCheckJobs | by_domain | collect | Job health |
| 14 | keywordSerpJobs | by_domain | collect | Job health |

Total: ~16 + C queries. For 5 competitors = 21 queries. (vs diagnostic: 125+)

### Data Summary Structure

Data is compressed in-memory to a strategy-relevant summary:

- **Keywords**: top 20 by position (best performers), top 20 by position drop (at risk), top 20 quick wins (pos 4-30, diff <50, sorted by searchVolume), position distribution buckets, avg position, gainer/loser counts
- **Content Gaps**: top 20 by opportunityScore, total counts by status, sum of estimatedTrafficValue
- **Competitors**: per-competitor: domain, keyword coverage %, top phrases they rank for that we don't
- **Backlinks**: dofollow ratio, toxic count/%, anchor type distribution, total vs stored, new/lost velocity
- **On-Site**: healthScore, criticalIssues, warnings, scan freshness
- **Visibility**: current ETV, position distribution, trend vs previous snapshot
- **Jobs**: pending/processing/stuck counts, last job timestamp
- **Link Building**: prospect count by status, NaN scoring count

## Claude Prompt Structure

### System Message

```
You are a senior SEO strategist analyzing comprehensive domain data. Generate a detailed,
data-driven SEO strategy based ONLY on the provided metrics. Every recommendation MUST reference
specific numbers from the data. Do not give generic SEO advice — only actionable items backed
by the provided metrics. Generate output as valid JSON matching the specified schema.
```

### User Message

4 blocks:
1. Business context (domain, description, target customer, location, language)
2. Data summary (structured JSON, all sections)
3. Output format specification (10-section JSON schema)
4. Language instruction (generate in user's UI language)

### Model Parameters

- Model: claude-sonnet-4-5-20250929
- Max tokens: 12000
- Temperature: 0.3

## Strategy Output: 10 Sections

### 1. executiveSummary
- Type: string (3-5 sentence overview)
- Content: Current state, key strengths, critical gaps, overall trajectory

### 2. quickWins
- Type: array of objects
- Per item: keyword, currentPosition, targetPosition, difficulty, searchVolume, estimatedTrafficGain, actionItems (string[])
- Sort: by ROI (searchVolume / difficulty)
- Max: 10 items

### 3. contentStrategy
- Type: array of objects
- Per item: targetKeyword, opportunityScore, searchVolume, suggestedContentType, competitorsCovering, estimatedImpact
- Max: 10 items

### 4. competitorAnalysis
- Type: array of objects (per competitor)
- Per item: domain, strengths (string[]), weaknesses (string[]), threatsToUs (string[]), opportunitiesAgainstThem (string[])

### 5. backlinkStrategy
- Type: object
- Fields: profileAssessment (string), toxicCleanup ({ description, priority, count }), linkBuildingPriorities (string[]), prospectRecommendations (string)

### 6. technicalSEO
- Type: object
- Fields: healthScore, criticalFixes (string[]), warnings (string[]), healthScoreTarget, improvementSteps (string[])

### 7. riskAssessment
- Type: array of objects
- Per item: risk (string), severity (high/medium/low), impact (string), mitigation (string)

### 8. keywordClustering
- Type: array of objects
- Per item: clusterName, theme, keywords (string[]), suggestedContentPiece, totalSearchVolume, avgDifficulty

### 9. roiForecast
- Type: object
- Fields: currentEstimatedTraffic, projectedTraffic30d, projectedTraffic90d, keyDrivers (string[]), assumptions (string[])

### 10. actionPlan
- Type: array of objects
- Per item: priority (1-5), action (string), category (content/technical/links/keywords), expectedImpact (string), effort (low/medium/high), timeframe (immediate/short-term/long-term)
- Sort: by priority asc
- Max: 15 items

## Drill-Down System

### Trigger
User clicks "Pogłęb tę sekcję" button or types custom question in text input below a section.

### Process
1. Load original `aiStrategySessions` record
2. Re-query raw domain data for that section (fresh data)
3. Build prompt: system message + business context + RAW data (not summary — full data for the section) + original section output + user question (if custom)
4. Claude call (max_tokens: 8000, temperature: 0.3)
5. Append result to `session.drillDowns` array via mutation

### Storage
```typescript
drillDowns: [{
  sectionKey: "quickWins",
  question: "Jak zoptymalizować te frazy pod mobile?", // optional
  response: "...", // markdown or structured text
  createdAt: 1707900000000,
}]
```

## Database Schema

### New table: aiStrategySessions

```typescript
aiStrategySessions: defineTable({
  domainId: v.id("domains"),
  businessDescription: v.string(),
  targetCustomer: v.string(),
  dataSnapshot: v.any(), // summary stats at time of generation
  strategy: v.any(),     // 10-section JSON, runtime-validated
  drillDowns: v.array(v.object({
    sectionKey: v.string(),
    question: v.optional(v.string()),
    response: v.string(),
    createdAt: v.number(),
  })),
  status: v.union(v.literal("generating"), v.literal("completed"), v.literal("failed")),
  error: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
})
.index("by_domain", ["domainId"])
```

Note: `strategy` uses `v.any()` for flexibility — same pattern as `aiResearchSessions.keywords`. Runtime TypeScript types enforce structure.

## Frontend Design

### Location
New section in InsightsSection.tsx, below existing "Actionable Recommendations" section.

### Components

**AIStrategySection** — main container
- Form: business description + target customer textareas (auto-fill from last session)
- Generate button with loading state
- Strategy display (accordion sections)
- History (collapsible past sessions)
- Export PDF button

**StrategySectionCard** — reusable card per strategy section
- Header: icon + title + priority badge + summary stat
- Body: section-specific content rendering
- Footer: "Pogłęb" button + custom question text input
- Drill-down results displayed inline below

**Section-specific renderers**:
- QuickWinsRenderer: table (keyword, pos, target, difficulty, volume, actions)
- ContentStrategyRenderer: cards with content type badges
- CompetitorRenderer: per-competitor cards with strengths/weaknesses
- ActionPlanRenderer: prioritized list with category/effort/timeframe tags
- RiskRenderer: severity-colored risk cards
- ClusterRenderer: grouped keyword lists with cluster metadata
- ForecastRenderer: stat cards with current vs projected values
- GenericTextRenderer: for executiveSummary, backlinkStrategy, technicalSEO

### Export PDF
Reuse existing `generateDomainReportPdf.tsx` patterns. Add strategy sections to PDF:
- Executive summary as header
- Action plan as numbered list
- Quick wins as table
- Key metrics as stat cards

### i18n
- UI labels: new keys in en/pl translation files under "strategy" namespace
- Strategy content: Claude generates in user's language (language param in prompt)

## Files to Create/Modify

### New files:
1. `convex/actions/aiStrategy.ts` — main action: collectDomainData + generateStrategy + drillDownSection
2. `convex/aiStrategy.ts` — queries (getHistory, getLatest) + mutations (createSession, updateStrategy, appendDrillDown)
3. `src/components/domain/sections/AIStrategySection.tsx` — main section component
4. `src/components/domain/strategy/` — section renderers (QuickWinsRenderer, etc.)
5. `src/messages/en/strategy.json` — English translations
6. `src/messages/pl/strategy.json` — Polish translations

### Modified files:
7. `convex/schema.ts` — add aiStrategySessions table
8. `src/components/domain/sections/InsightsSection.tsx` — add AIStrategySection import/render
9. `src/lib/generateDomainReportPdf.tsx` — add strategy PDF section
10. `src/i18n/request.ts` — register strategy namespace (if needed)

## Acceptance Criteria

1. User can generate a full 10-section strategy for any domain with data
2. Strategy references actual numbers from the domain's data (not generic advice)
3. Each section supports drill-down (button + custom question)
4. Full history of strategy sessions is preserved and browsable
5. Business context auto-fills from previous sessions
6. Strategy content is in user's UI language
7. Export to PDF works with all sections
8. Loading states, error handling, and empty states are polished
9. TypeScript compiles cleanly
10. i18n keys exist for both EN and PL
