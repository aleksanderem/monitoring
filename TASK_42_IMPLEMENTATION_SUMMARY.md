# Task #42: Competitor Tracking Foundation - Implementation Summary

## Status: ✅ IMPLEMENTATION COMPLETE - Ready for Testing & Deployment

**Session**: S0013
**Date**: 2026-01-31
**Priority**: CRITICAL PATH (blocks Task #43 - Content Gap Analysis)
**Lines of Code**: ~1,500 new lines

---

## Implementation Overview

Implemented complete competitor tracking system that allows users to monitor competitor domains and compare keyword rankings. The system reuses 100% of existing DataForSEO infrastructure for position checking.

---

## Backend Implementation

### Schema Changes (`convex/schema.ts`)

Added 2 new tables with 5 indexes total:

**1. `competitors` table:**
```typescript
{
  domainId: Id<"domains">,        // Which domain tracks this competitor
  competitorDomain: string,       // The competitor's domain
  name: optional string,          // Friendly name
  status: "active" | "paused",
  addedAt: number,
  lastCheckedAt: optional number
}
```

Indexes:
- `by_domain` on `[domainId]`
- `by_domain_competitor` on `[domainId, competitorDomain]`

**2. `competitorKeywordPositions` table:**
```typescript
{
  competitorId: Id<"competitors">,
  keywordId: Id<"keywords">,
  date: string,                   // YYYY-MM-DD
  position: number | null,
  url: string | null,
  fetchedAt: number
}
```

Indexes:
- `by_competitor` on `[competitorId]`
- `by_keyword` on `[keywordId]`
- `by_competitor_keyword` on `[competitorId, keywordId]`
- `by_competitor_keyword_date` on `[competitorId, keywordId, date]`

### Queries (`convex/queries/competitors.ts` - 370 lines)

**1. `getCompetitorsByDomain(domainId)`**
- Lists all competitors for a domain
- Includes keyword count, average position, last checked timestamp
- Sorted by newest first

**2. `getCompetitorOverview(domainId, days?)`**
- Returns position comparison data for charts
- Aggregates own domain + all competitors
- Daily average positions for configurable timeframe (default 30 days)
- Includes competitor metadata for chart rendering

**3. `getKeywordOverlap(domainId, competitorId?)`**
- Calculates Venn diagram data
- Returns counts: only you, only competitor, both
- Useful for overlap analysis

**4. `getCompetitorKeywordGaps(domainId, competitorId, minPosition?, maxOwnPosition?)`**
- Finds keyword opportunities
- Filters: competitor ranks well (top 20) but you don't (below 50)
- Calculates opportunity score (0-100) based on:
  * Competitor position weight (30%)
  * Your position weight (25%)
  * Search volume weight (25%, logarithmic)
  * Difficulty weight (20%)
- Returns sorted by opportunity score descending

**Gap Score Algorithm:**
```typescript
function calculateGapScore(
  competitorPosition: number,
  ourPosition: number | null,
  searchVolume: number,
  difficulty: number
): number {
  const competitorFactor = (21 - min(competitorPosition, 20)) / 20;
  const ourPositionFactor = ourPosition === null ? 1 : min(ourPosition / 100, 1);
  const volumeFactor = log10(max(searchVolume, 10)) / 4;
  const difficultyFactor = (100 - difficulty) / 100;

  return (
    competitorFactor * 30 +
    ourPositionFactor * 25 +
    volumeFactor * 25 +
    difficultyFactor * 20
  );
}
```

### Mutations (`convex/mutations/competitors.ts` - 140 lines)

**1. `addCompetitor(domainId, competitorDomain, name?)`**
- Validates no duplicates
- Sets status to "active"
- Returns competitorId

**2. `updateCompetitor(competitorId, name?, status?)`**
- Partial update support
- Can update name and/or status

**3. `removeCompetitor(competitorId)`**
- Cascade deletes all competitorKeywordPositions
- Returns success confirmation

**4. `storeCompetitorPosition(competitorId, keywordId, date, position, url)` [internal]**
- Upsert logic (update if exists, insert if new)
- Updates fetchedAt timestamp

**5. `updateLastChecked(competitorId)` [internal]**
- Called after position check completes

### Actions (`convex/actions/competitorPositions.ts` - 200 lines)

**1. `checkCompetitorPositions(competitorId)`**
Main entry point for position checking:
- Gets competitor details and domain settings
- Gets all active keywords for the domain
- Processes keywords in batches of 10
- Calls DataForSEO API for each keyword
- Stores results via internal mutation
- Updates lastCheckedAt timestamp
- Returns stats: `{ success, checked, errors, total }`

**2. `checkSingleKeyword(...)` [internal]**
- Supports dev mode (mock data) and production (real API)
- Reuses exact same DataForSEO endpoint as regular keyword checks
- Parses response to find competitor domain in SERP results
- Stores position in competitorKeywordPositions table

### Internal Queries (`convex/queries/competitorsInternal.ts` - 30 lines)

Helper queries for actions:
- `getCompetitorById` - Fetch competitor by ID
- `getDomainById` - Fetch domain settings
- `getKeywordsByDomain` - Get active keywords for domain

---

## Frontend Implementation

### 1. CompetitorManagementSection (240 lines)

**Location**: `src/components/domain/sections/CompetitorManagementSection.tsx`

**Features**:
- Lists all competitors with status badges (active/paused)
- Displays keyword count, avg position, last checked date
- "Add Competitor" button opens dialog modal
- Add competitor dialog:
  * Domain input (required, validated)
  * Name input (optional, auto-fills from domain)
  * Form validation (no duplicates, valid domain format)
  * Success/error toasts
- Per-competitor actions:
  * Pause/Resume button (toggles status)
  * Delete button (confirmation dialog with warning)
- Empty state when no competitors
- Uses shadcn/ui: Dialog, Button, Input, Label, Badge

### 2. CompetitorOverviewChart (140 lines)

**Location**: `src/components/domain/charts/CompetitorOverviewChart.tsx`

**Features**:
- Multi-line chart comparing average positions over time
- Your domain: bold line, primary color
- Each competitor: different color from chart palette
- X-axis: dates (formatted "Jan 31")
- Y-axis: average position (inverted, position 1 at top)
- Legend showing all domains
- Hover tooltip displays all positions for that date
- Empty state when no competitors added
- Loading skeleton during data fetch
- Responsive design
- Uses shadcn/ui ChartContainer + recharts LineChart

### 3. CompetitorKeywordGapTable (340 lines)

**Location**: `src/components/domain/tables/CompetitorKeywordGapTable.tsx`

**Features**:
- Competitor selector dropdown (select which competitor to analyze)
- Search filter (real-time keyword search)
- Table columns:
  * Keyword phrase
  * Competitor position (badge)
  * Your position (badge or "Not ranking")
  * Gap (red badge showing position difference)
  * Search volume
  * Difficulty (color-coded: red=hard, yellow=medium, green=easy)
  * Opportunity score (color-coded: green=high, yellow=medium, gray=low)
- Sortable columns with sort indicators
- Sort by gap score, volume, or difficulty
- Ascending/descending toggle
- "Add to Monitoring" action button (placeholder for now)
- Empty states:
  * No competitors added yet
  * No competitor selected
  * No keyword gaps found
- Uses shadcn/ui: Table, Select, Input, Badge, Button

---

## Integration Points

### 1. DataForSEO API (100% Code Reuse)
- Reuses existing `dataforseo.ts` infrastructure
- Same API endpoint: `/serp/google/organic/live/advanced`
- Same response parsing logic
- Only difference: passes competitor domain instead of monitored domain
- Stores results in separate table (`competitorKeywordPositions` vs `keywordPositions`)

### 2. Component Patterns
- Follows existing chart component patterns (GroupPerformanceChart)
- Uses consistent shadcn/ui components
- Matches design system colors and styling

---

## Files Created/Modified

### Created (8 new files):
1. `convex/queries/competitors.ts` (370 lines)
2. `convex/queries/competitorsInternal.ts` (30 lines)
3. `convex/mutations/competitors.ts` (140 lines)
4. `convex/actions/competitorPositions.ts` (200 lines)
5. `src/components/domain/sections/CompetitorManagementSection.tsx` (240 lines)
6. `src/components/domain/charts/CompetitorOverviewChart.tsx` (140 lines)
7. `src/components/domain/tables/CompetitorKeywordGapTable.tsx` (340 lines)
8. `tasks/task-05-competitor-tracking/REQUIREMENTS.md` (documentation)

### Modified (1 file):
1. `convex/schema.ts` (added 2 tables with 5 indexes)

**Total**: ~1,500 lines of new code

---

## Next Steps (Before Marking as PASSING)

### 1. Deployment
```bash
npx convex deploy
```
- Verify schema tables created
- Check Convex dashboard for errors

### 2. Backend Testing
Test mutations in Convex dashboard:
```javascript
// Add competitor
await api.mutations.competitors.addCompetitor({
  domainId: "<domain-id>",
  competitorDomain: "competitor.com",
  name: "Main Competitor"
});

// List competitors
await api.queries.competitors.getCompetitorsByDomain({
  domainId: "<domain-id>"
});

// Check positions (manual trigger)
await api.actions.competitorPositions.checkCompetitorPositions({
  competitorId: "<competitor-id>"
});
```

### 3. Frontend Integration
- Add CompetitorManagementSection to domain settings page
- Create competitors tab/section for charts and gap table
- Test in browser with real data

### 4. End-to-End Testing
Follow `tasks/task-05-competitor-tracking/TESTING.md`:
- ✅ Add competitors via UI
- ✅ Trigger position checks
- ✅ View overview chart with multiple competitors
- ✅ Select competitor in gap table
- ✅ Verify keyword opportunities displayed
- ✅ Test CRUD operations (edit, pause, delete)
- ✅ Check for console errors
- ✅ Verify TypeScript compilation

### 5. Verification Checklist
- [ ] Schema deployed successfully
- [ ] Backend mutations work
- [ ] Position checking works (dev mode OR production)
- [ ] CompetitorManagementSection renders
- [ ] Can add/edit/delete competitors
- [ ] CompetitorOverviewChart displays correctly
- [ ] CompetitorKeywordGapTable shows opportunities
- [ ] Search/filter/sort work
- [ ] Zero TypeScript errors (`npm run build`)
- [ ] Zero console errors
- [ ] Data persists after page refresh

---

## Known Limitations (Documented for Future)

1. **No Automatic Scheduling**: Position checks must be triggered manually (can add cron job later)
2. **Bulk Actions Placeholder**: "Add to Monitoring" shows "Coming soon" toast
3. **Basic Gap Score**: Simple algorithm, can be enhanced in Task #6
4. **Dev Mode Mock Data**: Requires API keys for production data

---

## Success Criteria

This task is **PASSING** when:

✅ All backend functions work without errors
✅ All frontend components render correctly
✅ Can add/edit/delete competitors via UI
✅ Position checking successfully calls DataForSEO API
✅ Overview chart displays multiple competitors
✅ Gap table shows keyword opportunities with correct scoring
✅ Zero TypeScript compilation errors
✅ Zero browser console errors
✅ Data persists correctly across page refreshes
✅ Code committed to git with descriptive message

---

## Critical Path Impact

**This task BLOCKS**:
- Task #43: Content Gap Analysis

Task #43 depends on the competitor tracking infrastructure to provide advanced gap analysis features. Cannot proceed until this task is fully tested and working.

---

## Commit Message (When Ready)

```
feat: Task #42 - Competitor Tracking Foundation

Implement complete competitor tracking system:

Backend:
- Add competitors and competitorKeywordPositions tables to schema
- Create 4 queries: list, overview, overlap, gaps
- Create 5 mutations: add, update, remove, store position, update timestamp
- Create position checking action (reuses DataForSEO infrastructure)
- Implement gap scoring algorithm (0-100 scale)

Frontend:
- CompetitorManagementSection: CRUD interface for competitors
- CompetitorOverviewChart: multi-line position comparison chart
- CompetitorKeywordGapTable: keyword opportunity discovery

CRITICAL PATH: Unblocks Task #43 (Content Gap Analysis)

Files: 8 created, 1 modified, ~1,500 lines added
```

---

**Status**: ✅ Implementation complete, ready for deployment and testing
