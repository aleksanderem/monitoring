# Investigation: Competitor Tracking Not Functional

## Bug Summary

The Competitor Tracking tab allows adding competitors (domain + display name) but the feature is essentially non-functional afterward. The user reports three issues:

1. Cannot add keywords to a competitor (shows "0 keywords tracked")
2. Cannot edit an already-added competitor
3. Unclear how the feature is supposed to work

## Root Cause Analysis

This is not a single bug but rather an incomplete feature with multiple missing pieces.

### Issue 1: "Cannot add keywords" — by design, but never explained

The architecture tracks competitors against ALL domain keywords automatically. There is no per-competitor keyword assignment — the `competitorKeywordPositions` table links competitors to the domain's `keywords` table. When position checking runs via `checkCompetitorPositions`, it iterates through every active keyword in the domain and checks where the competitor ranks.

The "0 keywords tracked" display (`CompetitorManagementSection.tsx:120`) reports the count of unique `keywordId` entries found in `competitorKeywordPositions` for that competitor. Since position checking has never run, this is correctly zero.

The actual problem: there is no UI to trigger position checking. The `checkCompetitorPositions` action exists in `convex/competitors_actions.ts` but is never called from the frontend. There is no "Check Positions" or "Refresh" button in `CompetitorManagementSection`.

### Issue 2: "Cannot edit competitor" — missing edit UI

The backend mutation `updateCompetitor` (in `convex/mutations/competitors.ts:43-57`) supports updating both `name` and `status`. The UI has a pause/resume button (status toggle) but NO edit dialog for renaming. There's also no way to change the competitor domain after creation.

### Issue 3: Feature feels broken — key components not integrated

Two important components exist but are NOT rendered in the Competitors tab:

- `CompetitorOverviewChart` (`src/components/domain/charts/CompetitorOverviewChart.tsx`) — position comparison line chart
- `CompetitorKeywordGapTable` (`src/components/domain/tables/CompetitorKeywordGapTable.tsx`) — keyword gap analysis table

The Competitors tab (`[domainId]/page.tsx:553-564`) only renders `CompetitorManagementSection`. The chart and gap table were built but never wired into the page.

### Additional Bug: Query sort error

In `convex/queries/competitors.ts:46`:
```typescript
return competitorsWithStats.sort((a, b) => b.addedAt - a.addedAt);
```
The field `addedAt` does not exist in the competitors schema. The correct field is `createdAt`. This will cause a runtime sort error (comparing `undefined - undefined` = `NaN`), resulting in unstable sort order.

### Additional Bug: CompetitorOverviewChart uses shadcn/ui

`CompetitorOverviewChart.tsx` imports from `@/components/ui/chart` (shadcn/ui) and `@/components/shared/LoadingState`. The codebase uses Untitled UI (`@/components/base/*`). This will likely cause import errors or style inconsistencies.

## Affected Components

### Frontend (files to modify)
| File | Issue |
|------|-------|
| `src/components/domain/sections/CompetitorManagementSection.tsx` | Missing: edit dialog, check positions button, keyword count explanation |
| `src/app/(dashboard)/domains/[domainId]/page.tsx` | Missing: CompetitorOverviewChart and CompetitorKeywordGapTable not integrated |
| `src/components/domain/charts/CompetitorOverviewChart.tsx` | Uses shadcn/ui imports instead of Untitled UI |

### Backend (files to modify)
| File | Issue |
|------|-------|
| `convex/queries/competitors.ts` | Line 46: `addedAt` should be `createdAt` |

## Proposed Solution

### Fix 1: Add "Check Positions" button to CompetitorManagementSection

Add a button per competitor that calls `checkCompetitorPositions` action. This is the critical missing piece — without it, no position data ever gets fetched, making the entire feature non-functional.

Implementation:
- Import `useAction` from `convex/react`
- Add an action reference to `api.competitors_actions.checkCompetitorPositions`
- Add a "Refresh" / "Check Positions" button next to each competitor (with loading state)
- Show progress toast during the check

### Fix 2: Add Edit Competitor dialog

Create an edit dialog (reuse the add dialog pattern) that allows:
- Editing the display name
- The competitor domain should NOT be editable (changing it would invalidate all historical position data)

Implementation:
- Add `editingCompetitor` state to track which competitor is being edited
- Add an "Edit" button to each competitor row
- Show a dialog pre-populated with current name
- Call `updateCompetitor` mutation on save

### Fix 3: Integrate CompetitorOverviewChart and CompetitorKeywordGapTable

Add both components to the Competitors tab in `page.tsx`, below CompetitorManagementSection.

Implementation:
- Import both components
- Render them inside the competitors TabPanel after CompetitorManagementSection
- CompetitorOverviewChart shows position comparison over time
- CompetitorKeywordGapTable shows keyword gap analysis with competitor selector

### Fix 4: Fix the `addedAt` → `createdAt` bug

In `convex/queries/competitors.ts:46`, change `b.addedAt - a.addedAt` to `b.createdAt - a.createdAt`.

### Fix 5: Fix CompetitorOverviewChart imports

Replace shadcn/ui `ChartContainer`/`ChartTooltip` and `LoadingState` imports with Untitled UI equivalents or plain recharts. The chart should use the same patterns as other charts in the codebase.

### Fix 6: Add explanatory text about how keyword tracking works

Add a small info/help text in the CompetitorManagementSection explaining that competitors are tracked against all domain keywords automatically, and that users need to trigger a position check to populate data.

## Priority Order

1. Fix `addedAt` bug (trivial, prevents runtime error)
2. Add "Check Positions" button (critical — makes feature functional)
3. Add edit competitor dialog (user-reported issue)
4. Integrate chart and gap table (completes the feature)
5. Fix CompetitorOverviewChart imports (prevents runtime errors)
6. Add explanatory UX text (nice-to-have, reduces confusion)

## Edge Cases

- What if domain has zero keywords? The "Check Positions" action returns immediately with "No keywords to check". The UI should handle this gracefully with a message like "Add keywords to your domain first".
- What if DataForSEO credentials are not configured? The action falls back to mock data in dev mode. This is fine for testing.
- What if a position check is already in progress? Currently no guard against concurrent checks. Consider adding a loading state per competitor.
- The `removeCompetitor` mutation deletes all position data. The existing `confirm()` dialog warns about this, which is adequate.
