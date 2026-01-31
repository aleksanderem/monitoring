# Task #5: Competitor Tracking Foundation

## Overview
Build comprehensive competitor tracking system to monitor competitor rankings for the same keywords and enable content gap analysis. This is a CRITICAL PATH feature that blocks Task #6 (Content Gap Analysis).

## Status
- **Task ID**: #42 (in tasks_progress.json) / #5 (in TASK_DEPENDENCIES.md)
- **Status**: In Progress
- **Session**: S0013
- **Priority**: HIGH (Critical Path)
- **Blocks**: Task #43 (Content Gap Analysis)

## Objectives

### Backend Schema
1. **competitors** table:
   - domainId: reference to domains table
   - competitorDomain: string (the competitor's domain)
   - name: string (optional friendly name)
   - status: "active" | "paused"
   - createdAt: timestamp
   - lastCheckedAt: optional timestamp

2. **competitorKeywordPositions** table:
   - competitorId: reference to competitors
   - keywordId: reference to keywords
   - date: string (YYYY-MM-DD)
   - position: number | null
   - url: string | null
   - fetchedAt: timestamp

### Backend Queries (convex/competitors_queries.ts)
1. **getCompetitorsByDomain(domainId)**: List all competitors for a domain
2. **getCompetitorPositions(competitorId, keywordId)**: Get position history for specific competitor/keyword pair
3. **getCompetitorOverview(domainId, days)**: Get average positions for all competitors over time
4. **getKeywordGaps(domainId, competitorId)**: Find keywords competitor ranks for but we don't (or rank poorly)

### Backend Mutations (convex/competitors_mutations.ts)
1. **addCompetitor(domainId, domain, name)**: Add new competitor
2. **updateCompetitor(competitorId, updates)**: Update competitor name/status
3. **removeCompetitor(competitorId)**: Delete competitor and associated data
4. **pauseCompetitor(competitorId)**: Pause position checks
5. **resumeCompetitor(competitorId)**: Resume position checks

### Backend Actions (convex/competitors_actions.ts)
1. **checkCompetitorPositions(competitorId)**: Check positions for all keywords for a competitor
   - Reuses existing DataForSEO integration (100% code reuse!)
   - Calls same API endpoint as regular keyword position checking
   - Stores results in competitorKeywordPositions table
   - Handles batching for large keyword lists
   - Background job scheduling

### Frontend Components

#### 1. CompetitorManagement Component (Settings Page)
Location: `src/components/domain/sections/CompetitorManagement.tsx`

Features:
- List of competitors with status badges
- Add competitor button (opens modal)
- Edit/pause/resume/delete actions per competitor
- Last checked timestamp
- Total keywords being tracked

#### 2. AddCompetitorModal Component
Location: `src/components/domain/modals/AddCompetitorModal.tsx`

Features:
- Domain input with validation
- Optional name field (auto-fills from domain)
- Validation: no duplicates, valid domain format
- Success/error handling

#### 3. CompetitorOverviewChart Component
Location: `src/components/domain/charts/CompetitorOverviewChart.tsx`

Features:
- Line chart comparing average positions
- Your domain (bold line) vs competitors (different colors)
- X-axis: dates (last 30 days default)
- Y-axis: average position (inverted, 1 at top)
- Legend with toggle capability
- Hover tooltip showing all domains' positions
- Empty state when no competitor data

#### 4. CompetitorKeywordGapTable Component
Location: `src/components/domain/tables/CompetitorKeywordGapTable.tsx`

Features:
- Shows keywords competitor ranks for but you don't
- Columns: Keyword, Competitor Position, Your Position, Search Volume, Difficulty, Gap Score
- Sortable by gap score (calculated opportunity metric)
- Filters: competitor selector, position range, volume range
- Bulk actions: Add to monitoring, Export list
- Pagination

#### 5. Competitors Tab (New Tab in Domain Detail)
Location: `src/app/(dashboard)/domains/[domainId]/competitors/page.tsx`

Structure:
- Overview section with competitor count cards
- CompetitorOverviewChart
- CompetitorKeywordGapTable
- Quick actions toolbar

### Integration Points

1. **Keyword Position Checking System** (100% Reuse)
   - Use existing `fetchSinglePositionInternal` action
   - Pass competitor domain instead of monitored domain
   - Store results in separate table (competitorKeywordPositions)
   - Same DataForSEO API, same response parsing

2. **Scheduler/Cron Jobs**
   - Add cron job: `checkActiveCompetitors` (daily)
   - Iterate through active competitors
   - Check positions for all keywords per competitor
   - Respect API rate limits

3. **Settings Page**
   - Add "Competitors" section after "Keywords" section
   - CompetitorManagement component

## Success Criteria

### Backend
- ✅ Schema tables deployed to Convex
- ✅ All queries return correct data
- ✅ All mutations work without errors
- ✅ Position checking action successfully calls DataForSEO API
- ✅ Competitor positions stored correctly in database
- ✅ Cron job scheduled and runs successfully
- ✅ No N+1 query problems
- ✅ Proper error handling and logging

### Frontend
- ✅ Can add competitors via modal
- ✅ Competitors list displays correctly
- ✅ Can edit/pause/resume/delete competitors
- ✅ CompetitorOverviewChart renders with correct data
- ✅ Chart shows your domain vs competitors clearly
- ✅ CompetitorKeywordGapTable shows opportunities
- ✅ Gap scoring algorithm works correctly
- ✅ All filters and sorting work
- ✅ Bulk actions function
- ✅ Zero console errors
- ✅ Zero TypeScript errors
- ✅ Responsive on mobile and desktop

### Data Integrity
- ✅ Competitor data persists correctly
- ✅ Position history tracks accurately
- ✅ Deleting competitor cleans up associated data
- ✅ Pausing competitor stops position checks
- ✅ No duplicate competitors allowed
- ✅ API usage logged correctly

## Technical Architecture

### Database Schema Design
```typescript
// competitors table
{
  domainId: Id<"domains">,
  competitorDomain: string,
  name: string,
  status: "active" | "paused",
  createdAt: number,
  lastCheckedAt?: number
}

// competitorKeywordPositions table
{
  competitorId: Id<"competitors">,
  keywordId: Id<"keywords">,
  date: string, // YYYY-MM-DD
  position: number | null,
  url: string | null,
  fetchedAt: number
}
```

### Query Patterns
- Get competitors: Index by_domain on domainId
- Get positions: Index by_competitor_keyword on [competitorId, keywordId]
- Get historical data: Index by_competitor_keyword_date on [competitorId, keywordId, date]
- Get gaps: JOIN competitors + competitorKeywordPositions + keywordPositions

### Gap Score Algorithm
```
gapScore = (competitorAvgPos / yourPos) × log(volume) × (1 - difficulty/100)

Where:
- Higher score = better opportunity
- Normalized to 0-100 range
- NULL position (not ranking) treated as 100+
```

## Implementation Steps

### Phase 1: Backend Foundation (2-3 hours)
1. Update convex/schema.ts with competitors and competitorKeywordPositions tables
2. Deploy schema changes
3. Create convex/competitors_queries.ts with 4 queries
4. Create convex/competitors_mutations.ts with 5 mutations
5. Test queries and mutations in Convex dashboard

### Phase 2: Position Checking Integration (1-2 hours)
1. Create convex/competitors_actions.ts
2. Implement checkCompetitorPositions action
3. Reuse existing DataForSEO integration logic
4. Add batch processing for large keyword lists
5. Test with manual API calls

### Phase 3: Cron Job Scheduler (1 hour)
1. Add checkActiveCompetitors to convex/scheduler.ts
2. Add cron schedule to convex/crons.ts (daily at 3 AM UTC)
3. Test manual execution

### Phase 4: Frontend - Competitor Management (2-3 hours)
1. Create AddCompetitorModal component
2. Create CompetitorManagement component
3. Integrate into Settings page
4. Test add/edit/delete workflows

### Phase 5: Frontend - Overview Chart (2 hours)
1. Create CompetitorOverviewChart component
2. Implement multi-line chart with shadcn/ui
3. Add legend and tooltip
4. Test with multiple competitors

### Phase 6: Frontend - Gap Table (2-3 hours)
1. Create CompetitorKeywordGapTable component
2. Implement gap score calculation
3. Add filters and sorting
4. Add bulk actions
5. Test with various data scenarios

### Phase 7: Frontend - Competitors Tab (1-2 hours)
1. Create new tab route: /domains/[domainId]/competitors/page.tsx
2. Integrate all components
3. Add summary cards
4. Test navigation and layout

### Phase 8: Testing & Polish (2-3 hours)
1. End-to-end testing with real data
2. Test with multiple competitors
3. Test edge cases (no competitors, no overlap, etc.)
4. Fix any bugs
5. Verify TypeScript compilation
6. Check for console errors
7. Test responsive design

**Total Estimated Time**: 14-19 hours

## Dependencies

### Required Libraries
- All existing (shadcn/ui, recharts, Convex)
- No new dependencies needed

### Existing Code to Reuse
- convex/dataforseo.ts: fetchSinglePositionInternal action
- src/components/domain/tables/*: Table patterns
- src/components/domain/charts/*: Chart patterns
- shadcn/ui components: Button, Modal, Input, Table, Badge

## Risk Mitigation

### High Risk: API Rate Limiting
- **Risk**: Checking many competitors × many keywords could hit DataForSEO rate limits
- **Mitigation**: Implement batch processing, add delays between requests, queue system

### Medium Risk: Performance with Many Competitors
- **Risk**: Queries could be slow with 10+ competitors and 100+ keywords
- **Mitigation**: Proper indexing, query optimization, pagination

### Low Risk: Data Consistency
- **Risk**: Competitor data could get out of sync
- **Mitigation**: Proper error handling, transaction-like mutations, retry logic

## Future Enhancements (Not in Scope)
- Competitor alerts (email when competitor gains/loses position)
- Competitor SERP features tracking
- Competitor backlink monitoring
- Competitor content analysis
- Historical competitor comparison (before/after)

## Notes
- This task MUST be completed before Task #6 (Content Gap Analysis) can start
- Gap score algorithm will be refined in Task #6
- Position checking reuses 100% of existing DataForSEO integration
- Same API endpoint, same response format, just different domain parameter
