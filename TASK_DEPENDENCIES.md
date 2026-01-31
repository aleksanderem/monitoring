# Task Dependencies & Execution Order

## Visual Dependency Graph

```
Phase 1: Quick Wins (Independent - Can Run in Parallel)
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Task #1                Task #2                Task #3       │
│  ┌─────────────┐       ┌─────────────┐       ┌──────────┐  │
│  │ SERP        │       │ Keyword     │       │ Date     │  │
│  │ Features    │       │ Grouping    │       │ Range    │  │
│  │ Tracking    │       │ System      │       │ Picker   │  │
│  └─────────────┘       └─────────────┘       └──────────┘  │
│                                                               │
│  Task #4                                                     │
│  ┌─────────────┐                                            │
│  │ Backlink    │                                            │
│  │ Velocity    │                                            │
│  │ Tracking    │                                            │
│  └─────────────┘                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│ Phase 2: Core Enhancements (Sequential Dependencies)         │
│                                                               │
│  Task #5                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │ Competitor Tracking Foundation          │                │
│  │ (Required for Task #6)                  │                │
│  └─────────────────────────────────────────┘                │
│                      │                                       │
│                      │ BLOCKS                                │
│                      ▼                                       │
│  Task #6                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │ Content Gap Analysis                    │                │
│  │ (Requires Task #5 data)                 │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                       │
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│ Phase 3: Advanced Features (Can Start Anytime)               │
│                                                               │
│  Task #7                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │ Forecasting & Predictive Analytics      │                │
│  │ (Independent - uses existing data)      │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Critical Path Analysis

### Path 1: SERP Features (Independent)
```
Task #1: SERP Features Tracking
├─ Duration: 2-3 days
├─ Dependencies: NONE
└─ Blocking: NONE
```

### Path 2: Keyword Organization (Independent)
```
Task #2: Keyword Grouping System
├─ Duration: 2-3 days
├─ Dependencies: NONE
├─ Blocking: NONE
└─ Enhances: Tasks #1, #6, #7 (grouping makes analysis better)
```

### Path 3: Date Picker (Independent, Broad Impact)
```
Task #3: Enhanced Date Range Picker
├─ Duration: 2-3 days
├─ Dependencies: NONE
├─ Blocking: NONE
└─ Enhances: ALL chart components immediately
```

### Path 4: Backlink Velocity (Independent)
```
Task #4: Backlink Velocity Tracking
├─ Duration: 2-3 days
├─ Dependencies: NONE
└─ Blocking: NONE
```

### Path 5: Competitor Analysis (Critical Path)
```
Task #5: Competitor Tracking Foundation
├─ Duration: 5-7 days (LONGEST)
├─ Dependencies: NONE
├─ BLOCKS: Task #6 (Content Gap Analysis)
└─ Critical Path Item: YES ⚠️

         ↓ BLOCKS ↓

Task #6: Content Gap Analysis
├─ Duration: 3-4 days
├─ Dependencies: Task #5 MUST be completed
├─ Blocking: NONE
└─ Cannot start until: Task #5 complete
```

### Path 6: Forecasting (Independent)
```
Task #7: Forecasting & Predictive Analytics
├─ Duration: 5-7 days
├─ Dependencies: NONE (uses existing data)
└─ Blocking: NONE
```

### Path 7: On-Site SEO Reports (Independent)
```
Task #8: Comprehensive On-Site SEO Reports
├─ Duration: 4-5 days
├─ Dependencies: NONE (new feature area)
├─ Blocking: NONE
└─ New Tab: "On-Site" in domain detail page
```

## Execution Strategies

### Strategy A: Parallel Maximum (Fastest)
**Timeline: ~7-10 days total**

```
Week 1 (Days 1-5):
  Day 1-3:  ┌─ Task #2: Keyword Grouping
            ├─ Task #3: Date Range Picker    } PARALLEL
            └─ Task #4: Backlink Velocity

  Day 4-5:  ┌─ Task #1: SERP Features
            └─ Start Task #5: Competitor Tracking

Week 2 (Days 6-10):
  Day 6-10:  ── Task #5: Competitor Tracking (continues)
  Day 9-10:  ── Task #6: Content Gap (starts when #5 done)

Later:
  Week 3:    ── Task #7: Forecasting (can start anytime)
```

### Strategy B: Sequential Safe (Most Stable)
**Timeline: ~18-24 days total**

```
Day 1-3:   Task #2: Keyword Grouping
Day 4-6:   Task #3: Date Range Picker
Day 7-9:   Task #1: SERP Features
Day 10-12: Task #4: Backlink Velocity
Day 13-19: Task #5: Competitor Tracking ⚠️ CRITICAL
Day 20-23: Task #6: Content Gap Analysis
Day 24-30: Task #7: Forecasting
```

### Strategy C: Value-First (Recommended)
**Timeline: ~10-14 days for high-value features**

```
Week 1:
  Day 1-3:  Task #2: Keyword Grouping (immediate value)
  Day 4-6:  Task #3: Date Range Picker (enhances all charts)
  Day 7-9:  Task #4: Backlink Velocity (new insights)

Week 2:
  Day 10-16: Task #5: Competitor Tracking (strategic value)
  Day 17-20: Task #6: Content Gap Analysis (builds on #5)

Later (as needed):
  Week 3-4:  Task #1: SERP Features
  Week 4-5:  Task #7: Forecasting
```

## Dependency Matrix

| Task | Depends On | Blocks | Can Run Parallel With |
|------|-----------|--------|----------------------|
| #1 SERP Features | NONE | NONE | #2, #3, #4, #7 |
| #2 Keyword Grouping | NONE | NONE | #1, #3, #4, #7 |
| #3 Date Range Picker | NONE | NONE | #1, #2, #4, #7 |
| #4 Backlink Velocity | NONE | NONE | #1, #2, #3, #7 |
| #5 Competitor Tracking | NONE | **#6** ⚠️ | #1, #2, #3, #4, #7 |
| #6 Content Gap | **#5** ⚠️ | NONE | NONE until #5 done |
| #7 Forecasting | NONE | NONE | #1, #2, #3, #4 |
| #8 On-Site Reports | NONE | NONE | #1, #2, #3, #4, #7 |

## Resource Allocation (If Multiple Developers)

### 2 Developers
```
Developer A:
  Week 1: Tasks #2 → #3 → #4
  Week 2: Task #6 (wait for #5)

Developer B:
  Week 1: Task #5 (longest task)
  Week 2: Task #1
  Week 3: Task #7
```

### 1 Developer (Solo)
```
Recommended order: #2 → #3 → #4 → #5 → #6 → #1 → #7
```

## Risk Assessment

### High Risk Items
- ⚠️ **Task #5**: Competitor Tracking (longest duration, blocks #6)
- ⚠️ **Task #7**: Forecasting (complex statistics, may need iteration)

### Low Risk Items
- ✅ **Task #3**: Date Range Picker (UI only, no backend complexity)
- ✅ **Task #2**: Keyword Grouping (clear requirements, standard CRUD)

### Medium Risk Items
- 🔶 **Task #1**: SERP Features (API integration complexity)
- 🔶 **Task #4**: Backlink Velocity (cron job + calculations)
- 🔶 **Task #6**: Content Gap (depends on #5 quality)

## Integration Points

```
┌─────────────────────────────────────────────────────┐
│                  Existing System                     │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Keywords     │  │ Backlinks    │  │ Domains  │  │
│  │ (1649 items) │  │ (working)    │  │ (tags)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │
└─────────┼──────────────────┼───────────────┼────────┘
          │                  │               │
          ▼                  ▼               ▼
┌─────────────────────────────────────────────────────┐
│                   New Features                       │
│                                                       │
│  Task #1 │ Task #2 │ Task #3 │ Task #4 │ Task #5    │
│  SERP    │ Groups  │ Dates   │ Velocity│ Competitors│
│  ↓       │ ↓       │ ↓       │ ↓       │ ↓          │
│  Keywords│ Keywords│ Charts  │ Backlinks│ Keywords  │
│          │         │ (All)   │         │            │
│          │         │         │         │ ↓          │
│          │         │         │         │ Task #6    │
│          │         │         │         │ Gaps       │
│                                                       │
│  Task #7 → Forecasting (uses all data sources)      │
└─────────────────────────────────────────────────────┘
```

## Component Reuse Map

```
Task #1: SERP Features
├─ Reuses: DataForSEO API integration
└─ Creates: New table + chart components

Task #2: Keyword Grouping
├─ Reuses: Badge components, table infrastructure
└─ Creates: Group management UI

Task #3: Date Range Picker
├─ Reuses: shadcn/ui Calendar, Popover
└─ Enhances: ALL existing chart components

Task #4: Backlink Velocity
├─ Reuses: Backlink infrastructure, chart components
└─ Creates: Velocity calculation logic

Task #5: Competitor Tracking
├─ Reuses: Position checking system (100% reuse!)
└─ Creates: Competitor management UI

Task #6: Content Gap
├─ Reuses: Task #5 competitor data, keyword tables
└─ Creates: Opportunity scoring algorithm

Task #7: Forecasting
├─ Reuses: ALL existing data tables
└─ Creates: Statistical analysis engine
```

## Recommended Execution Order

### 🥇 Priority 1: Foundation (Days 1-9)
1. **Task #2** - Keyword Grouping (Day 1-3)
2. **Task #3** - Date Range Picker (Day 4-6)
3. **Task #4** - Backlink Velocity (Day 7-9)

### 🥈 Priority 2: Strategic (Days 10-20)
4. **Task #5** - Competitor Tracking (Day 10-16) ⚠️ CRITICAL PATH
5. **Task #6** - Content Gap Analysis (Day 17-20)

### 🥉 Priority 3: Advanced (Days 21+)
6. **Task #1** - SERP Features (Day 21-23)
7. **Task #8** - On-Site SEO Reports (Day 24-28)
8. **Task #7** - Forecasting (Day 29-35)

---

**Total Timeline: 35 days for all features**
**Quick Wins: 9 days for Tasks #2-4**
**Strategic Value: 20 days for Tasks #2-6**
**Complete Suite: 35 days for all 8 tasks**

## Notes

- Task #5 (Competitor Tracking) is on the **critical path** - delays here block Task #6
- Tasks #1-4 can all run in parallel with sufficient resources
- Task #3 (Date Picker) has immediate impact across entire application
- Task #7 (Forecasting) is independent and can be delayed without blocking others

---

# Manual Testing & Verification Protocol

## Pre-Testing Checklist

**Before testing ANY feature, ALWAYS:**

```bash
# 1. Check both servers are running
ps aux | grep "convex dev"    # Convex backend
ps aux | grep "next dev"      # Next.js frontend

# 2. Open browser with DevTools
# - Chrome DevTools: Cmd+Option+I (Mac) / F12 (Windows)
# - Network tab: Clear and set to "Preserve log"
# - Console tab: Clear console, enable all log levels

# 3. Check initial state
# - No errors in console on page load
# - No failed network requests (red in Network tab)
# - Page renders without blank screens or infinite loading
```

**Browser Testing Requirements:**
- ✅ Chrome (primary)
- ✅ Safari (secondary)
- ⚠️ Check both desktop AND mobile viewport

## Task #1: SERP Features Tracking System

### Testing Locations
1. `/domains/[domainId]/monitoring` - Keyword Monitoring table
2. `/domains/[domainId]/visibility` - SERP Features dashboard

### Step-by-Step Verification

#### Phase 1: Schema & Backend
```bash
# 1. Check Convex schema deployed
npx convex function-spec | grep serpFeatures
# ✅ Should show: serpFeatures table functions

# 2. Verify queries exist
npx convex function-spec | grep "getSerpFeatures"
# ✅ Should show: getSerpFeaturesByKeyword, getSerpFeaturesSummary
```

#### Phase 2: Data Population
```
1. Navigate to: /domains/[domainId]/monitoring
2. Open Console (F12 → Console tab)
3. Open Network tab (F12 → Network tab)
4. Trigger position refresh for a keyword (if manual refresh button exists)
5. Wait for completion (watch Network tab for API calls)

✅ SUCCESS CRITERIA:
- No errors in console
- API call to DataForSEO completes (status 200)
- Console shows: "SERP features captured: [count]"
- Database insert succeeds (check Convex dashboard)

❌ FAILURE SCENARIOS:
- Console error: "serpFeatures table not found" → Schema not deployed
- Network error 500 → API integration broken
- No data saved → Check internal mutation call
```

#### Phase 3: UI Rendering - SERP Features Chart
```
1. Navigate to: /domains/[domainId]/visibility
2. Scroll to SERP Features Chart section
3. Check loading state appears briefly
4. Wait for chart to render

✅ SUCCESS CRITERIA:
- Loading skeleton shows (pulsing gray boxes)
- Chart renders within 2-3 seconds
- Legend shows: Featured Snippet, PAA, Image Pack, Video, Local Pack
- Bars display with correct colors
- Hover tooltip works on each bar
- X-axis shows dates correctly formatted
- Y-axis shows percentage (0-100%)
- No console errors during render
- Chart is responsive (resize window, chart adapts)

❌ FAILURE SCENARIOS:
- Chart stuck on loading → Query not returning data
- Console error: "Cannot read property 'map'" → Data format mismatch
- Empty state shows when data exists → Query filter too strict
- Chart crashes on hover → Tooltip component bug
- Bars don't render → Check data.length > 0
```

#### Phase 4: UI Rendering - SERP Badges in Table
```
1. Navigate to: /domains/[domainId]/monitoring
2. Find KeywordMonitoringTable
3. Check for new SERP Features column (after Position column)

✅ SUCCESS CRITERIA:
- Column header shows: "SERP Features"
- Each row shows badges for present features
- Badge colors match feature type:
  * Featured Snippet: Blue
  * PAA: Green
  * Image Pack: Purple
  * Video: Red
  * Local Pack: Orange
- Badges show count (e.g., "Featured +2 more")
- Hover shows tooltip with all features
- Empty state shows "—" when no features

❌ FAILURE SCENARIOS:
- Column missing → Component not updated
- All badges show "—" → Data not joined correctly
- Badges overlap/break layout → CSS issue
- Hover tooltip doesn't appear → Tooltip props missing
```

#### Phase 5: Timeline Component (If Implemented)
```
1. Click on a keyword row in monitoring table
2. Slideout/detail view should open
3. Scroll to SERP Features Timeline section

✅ SUCCESS CRITERIA:
- Timeline renders with vertical line
- Events show as dots on timeline
- Each event shows: date, feature gained/lost, icon
- Click event shows details
- Timeline scrolls if many events
- Loading state during data fetch

❌ FAILURE SCENARIOS:
- Timeline empty when features exist → Query missing keywordId filter
- Events out of order → Sort by date missing
- Timeline doesn't scroll → CSS overflow issue
```

### Performance Checks
```
1. Open Performance tab in DevTools
2. Start recording
3. Navigate to Visibility tab
4. Stop recording after chart loads

✅ SUCCESS CRITERIA:
- Total load time < 3 seconds
- No layout shifts (CLS = 0)
- Frame rate stays above 30 FPS during render
- Memory usage stable (no leaks)

❌ FAILURE SCENARIOS:
- Load time > 5 seconds → Query optimization needed
- Layout shifts during render → Missing skeleton dimensions
- FPS drops below 20 → Too many re-renders
```

### Edge Cases to Test
```
1. Keyword with NO SERP features
   → Should show "—" or empty state

2. Keyword with ALL SERP features
   → Badges should wrap or show "+X more"

3. Domain with 0 keywords
   → Chart shows empty state message

4. Very old keyword (no recent SERP data)
   → Should show last known state or "No recent data"

5. API timeout during refresh
   → Should show error message, not crash
```

---

## Task #2: Keyword Grouping and Tagging System

### Testing Locations
1. `/domains/[domainId]/monitoring` - Table with group filters
2. `/domains/[domainId]/settings` - Group management (if separate page)

### Step-by-Step Verification

#### Phase 1: Group Management Modal
```
1. Navigate to: /domains/[domainId]/monitoring
2. Click "Manage Groups" button (usually in toolbar)
3. Modal should open

✅ SUCCESS CRITERIA:
- Modal opens smoothly (no lag)
- Modal backdrop darkens background
- Close button (X) works
- Click outside modal closes it (if designed that way)
- Form has fields: Name, Description, Color
- Color picker shows palette or color input
- "Create Group" button is disabled when name empty
- Character limit shown for description (if any)

❌ FAILURE SCENARIOS:
- Modal doesn't open → Button onClick missing
- Modal opens behind content → z-index issue
- Modal can't be closed → Close handlers missing
- Form submits with empty name → Validation missing
```

#### Phase 2: Create New Group
```
1. In Group Management Modal:
2. Enter group name: "Brand Keywords"
3. Add description: "Keywords containing brand name"
4. Select color: Blue (#3B82F6)
5. Click "Create Group"

✅ SUCCESS CRITERIA:
- Form submits without errors
- Modal closes after success
- Console shows: "Group created: [groupId]"
- Toast/notification appears: "Group created successfully"
- New group appears in filter dropdown immediately
- Network tab shows successful mutation (200 OK)

❌ FAILURE SCENARIOS:
- Console error: "Validation failed" → Schema mismatch
- Modal doesn't close → Success callback missing
- Group not in dropdown → Cache not invalidated
- Duplicate name allowed → Uniqueness validation missing
- Network error 500 → Backend mutation broken
```

#### Phase 3: Assign Keywords to Group
```
Method A: Bulk Assignment
1. In KeywordMonitoringTable, select 5 keywords (checkboxes)
2. Click "Add to Group" in bulk actions toolbar
3. Select "Brand Keywords" from dropdown
4. Click "Apply"

✅ SUCCESS CRITERIA:
- Bulk action button appears when >0 keywords selected
- Dropdown shows all available groups
- Assignment happens immediately (no page reload)
- Success message: "5 keywords added to Brand Keywords"
- Group badge appears on keyword rows
- Selection cleared after success
- Mutation completes in < 1 second

❌ FAILURE SCENARIOS:
- Button stays disabled → State not updating
- Dropdown empty → Query not fetching groups
- Assignment fails silently → No error handling
- Page reloads → Optimistic update missing
- Mutation times out → Database write issue

Method B: Inline Assignment
1. Find keyword row in table
2. Click group badge area (or dropdown icon)
3. Select group from dropdown
4. Group badge appears immediately

✅ SUCCESS CRITERIA:
- Click target is obvious (cursor changes)
- Dropdown opens on click
- Current group is highlighted
- Can select multiple groups (if multi-select enabled)
- Badge updates immediately (optimistic)
- Change persists after page refresh

❌ FAILURE SCENARIOS:
- Dropdown doesn't open → Event listener missing
- Badge doesn't update → UI state not updating
- Refresh loses changes → Mutation didn't complete
```

#### Phase 4: Filter by Group
```
1. In KeywordMonitoringTable toolbar
2. Find "Group" filter dropdown
3. Select "Brand Keywords"
4. Table should filter

✅ SUCCESS CRITERIA:
- Dropdown shows all groups + "All Groups" option
- Selecting group filters table immediately
- Filtered count updates (e.g., "Showing 5 of 120")
- Empty state if no keywords in group
- "Clear filter" button appears
- URL updates with filter param (e.g., ?group=xyz)
- Back button preserves filter
- Filter works with search query (both filters apply)

❌ FAILURE SCENARIOS:
- Table doesn't filter → Filter logic broken
- Shows wrong keywords → Query filter incorrect
- Count doesn't update → Calculation missing
- Empty state when group has keywords → Data not joined
- URL doesn't update → Router.push missing
- Filter breaks pagination → Pagination calc wrong
```

#### Phase 5: Group Performance Chart
```
1. Navigate to section with GroupPerformanceChart
2. Chart should show average position per group

✅ SUCCESS CRITERIA:
- Chart renders within 2 seconds
- Legend shows all groups with colors matching their badges
- Lines are different colors (not all the same)
- X-axis shows dates
- Y-axis inverted (position 1 at top)
- Hover tooltip shows group name + position
- Click legend item toggles line visibility
- Chart handles groups with no data (shows flat line or excluded)

❌ FAILURE SCENARIOS:
- Chart empty when groups exist → Query not grouping correctly
- All lines same color → Color mapping missing
- Lines overlapping unreadably → Need transparency or line style variation
- Tooltip shows NaN → Data format issue
- Legend click doesn't toggle → Interactive handler missing
```

#### Phase 6: Tagging System
```
1. In KeywordMonitoringTable, find keyword row
2. Click tag icon or tag area
3. Type tag name: "competitor"
4. Press Enter
5. Tag badge should appear

✅ SUCCESS CRITERIA:
- Tag input appears on click
- Autocomplete suggests existing tags
- Tag saves on Enter key
- Tag appears as small badge
- Multiple tags can be added
- Tags wrap to new line if many
- Click X on tag removes it
- Removal is immediate (optimistic)
- Tags persist after page refresh

❌ FAILURE SCENARIOS:
- Input doesn't appear → Event handler missing
- Enter key doesn't save → onKeyDown missing
- Tag doesn't appear → UI state not updating
- Can add duplicate tags → Validation missing
- Deletion doesn't work → Mutation broken
- Tags disappear on refresh → Not saving to DB
```

#### Phase 7: Bulk Tagging
```
1. Select 10 keywords
2. Click "Add Tags" in bulk toolbar
3. Enter tags: "high-priority, conversion"
4. Click Apply

✅ SUCCESS CRITERIA:
- Modal/input opens for bulk tagging
- Can enter multiple tags (comma-separated)
- Tags added to all selected keywords
- Progress indicator if many keywords
- Success message shows count
- Deselects keywords after success

❌ FAILURE SCENARIOS:
- Modal doesn't open → Button broken
- Only first keyword gets tags → Loop broken in mutation
- Mutation times out with many keywords → Batch size too large
- No feedback during operation → Loading state missing
```

### Edge Cases to Test
```
1. Group with 0 keywords
   → Chart excludes or shows as flat line

2. Keyword in multiple groups
   → Shows multiple badges, all filters work

3. Delete group with assigned keywords
   → Keywords keep other groups, confirmation dialog appears

4. Very long group name (50+ chars)
   → Truncates in dropdown with tooltip

5. Special characters in tag names
   → Sanitized properly, no XSS

6. 50+ groups
   → Dropdown scrolls, search within dropdown
```

---

## Task #3: Enhanced Date Range Picker Component

### Testing Locations
1. ALL pages with time-series charts (Backlinks History, Movement Trend, Position History)

### Step-by-Step Verification

#### Phase 1: Component Rendering
```
1. Navigate to: /domains/[domainId]/backlinks
2. Find BacklinksHistoryChart
3. Look for date range controls (usually above chart)

✅ SUCCESS CRITERIA:
- Date range button visible (shows current range)
- Button label clear (e.g., "Last 30 days" or "Jan 1 - Jan 31")
- Click button opens popover/dropdown
- Popover positioned correctly (not cut off)
- Popover has backdrop (darkens background)
- Close button works

❌ FAILURE SCENARIOS:
- Button missing → Component not integrated
- Popover doesn't open → Trigger props missing
- Popover off-screen → Positioning issue
- Can't close popover → onClose handler missing
```

#### Phase 2: Preset Ranges
```
1. Open date range picker
2. Check preset buttons: Last 7 days, 30 days, 3M, 6M, 1Y, All time

✅ SUCCESS CRITERIA:
- All presets visible without scrolling
- Click preset closes picker and updates chart
- Chart re-fetches data with new date range
- Loading indicator appears during fetch
- Chart renders new data correctly
- Preset button shows active state
- URL updates with date params (?from=...&to=...)
- Back button works (restores previous range)

❌ FAILURE SCENARIOS:
- Preset doesn't apply → onClick handler missing
- Chart doesn't update → Query params not updating
- No loading state → Suspense missing
- Wrong data shown → Query filter broken
- URL doesn't update → Router.push missing
```

#### Phase 3: Custom Date Range - Calendar Picker
```
1. Open date range picker
2. Click "Custom Range" tab/button
3. Calendar should appear

✅ SUCCESS CRITERIA:
- Calendar shows current month
- Can navigate to previous/next months
- Today's date highlighted
- Start date selection:
  * Click date → Highlights as start
  * Start date badge appears
- End date selection:
  * Click second date → Highlights range
  * Range between dates shaded
  * End date badge appears
- Can change start date (click different date)
- Can clear selection
- "Apply" button enabled when both dates selected
- "Cancel" button reverts changes
- Apply closes picker and updates chart

❌ FAILURE SCENARIOS:
- Calendar doesn't render → Component import missing
- Can't select dates → onClick handler missing
- End date before start date allowed → Validation missing
- Range highlighting broken → CSS issue
- Apply doesn't update chart → Query not responding to state
- Cancel doesn't revert → Previous state not saved
```

#### Phase 4: Comparison Mode
```
1. Open date range picker
2. Toggle "Compare" switch/checkbox
3. Second date range selector should appear

✅ SUCCESS CRITERIA:
- Compare toggle is obvious and accessible
- Toggle shows on/off state clearly
- Second date range selector appears smoothly
- Can select "Previous period" (auto-calculates)
- Can select "Custom comparison range"
- Chart updates to show both series:
  * Primary range (solid line)
  * Comparison range (dashed line or different color)
- Legend clearly labels both series
- Tooltip shows both values when hovering
- Comparison range validated (not overlapping with primary)

❌ FAILURE SCENARIOS:
- Toggle doesn't work → State not updating
- Second selector doesn't appear → Conditional render missing
- Previous period calculates wrong dates → Date math broken
- Chart doesn't show comparison → Data not formatted correctly
- Lines indistinguishable → Color/style not different enough
- Tooltip shows only primary → Comparison data not in tooltip
```

#### Phase 5: Integration with All Charts
```
Test EVERY chart component:

1. BacklinksHistoryChart
2. MovementTrendChart
3. PositionHistoryChart
4. (Any other time-series chart)

For EACH chart:
✅ SUCCESS CRITERIA:
- Date picker appears above chart
- Picker state syncs with chart data
- Query includes startDate and endDate params
- Chart re-renders when dates change
- No flash of empty state during transition
- Loading skeleton matches chart dimensions
- Date range persists when navigating away and back
- Multiple charts on same page can have independent ranges (if designed that way)

❌ FAILURE SCENARIOS:
- Picker missing from some charts → Integration incomplete
- Date change doesn't affect chart → Query not using params
- Flash of old data → Optimistic rendering issue
- Loading state has wrong dimensions → Skeleton size mismatch
- Date range resets on navigation → State not persisted
```

#### Phase 6: Query Performance
```
1. Select "All time" range (largest dataset)
2. Monitor Network tab and Console

✅ SUCCESS CRITERIA:
- Query completes in < 3 seconds
- No timeout errors
- Data paginated if very large (>1000 points)
- Chart renders without lag
- No memory spike in DevTools Memory profiler

❌ FAILURE SCENARIOS:
- Query times out → Need pagination or data limits
- Browser freezes → Too much data rendering at once
- Memory increases continuously → Memory leak
- Chart takes >5 seconds to render → Optimization needed
```

### Edge Cases to Test
```
1. Same start and end date (single day)
   → Chart shows single data point or message

2. Very wide range (5+ years)
   → Data aggregated by month/year, not daily

3. Future dates selected
   → Validation prevents or shows empty state

4. Invalid range (end before start)
   → Validation swaps dates or shows error

5. Comparison range overlaps primary
   → Validation error or warning

6. Chart with no data in selected range
   → Empty state message, not crash
```

---

## Task #4: Backlink Velocity Tracking

### Testing Locations
1. `/domains/[domainId]/backlinks` - Velocity chart and metrics

### Step-by-Step Verification

#### Phase 1: Backend Calculation (Cron Job)
```
# 1. Check cron job is scheduled
npx convex function-spec | grep "calculateBacklinkVelocity"
# ✅ Should show: crons.js:calculateBacklinkVelocity

# 2. Trigger manually (for testing)
npx convex run crons:calculateBacklinkVelocity

✅ SUCCESS CRITERIA:
- Console shows: "Calculating velocity for [count] domains"
- No errors during execution
- backlinkVelocityHistory table has new records
- Calculation completes in < 30 seconds

❌ FAILURE SCENARIOS:
- Function not found → Not deployed
- Timeout error → Query too slow
- No records inserted → Mutation broken
```

#### Phase 2: Velocity Metrics Cards
```
1. Navigate to: /domains/[domainId]/backlinks
2. Find velocity metrics section (usually near top)
3. Check 4 metric cards

✅ SUCCESS CRITERIA:
- Card 1: "Avg New/Day" shows number (e.g., "+12.5")
- Card 2: "Avg Lost/Day" shows number (e.g., "-3.2")
- Card 3: "Net Growth" shows trend (e.g., "+9.3/day" with up arrow)
- Card 4: "7-Day Velocity" shows recent trend
- Numbers formatted with decimals (1 decimal place)
- Positive numbers show green, negative show red
- Trend arrows point correct direction
- Loading skeletons appear during data fetch
- Cards responsive (stack on mobile)

❌ FAILURE SCENARIOS:
- Cards show "0" when data exists → Query not returning data
- Numbers show "NaN" → Calculation error
- Colors wrong (negative shown as green) → Condition inverted
- Cards don't load → Query failed silently
- Layout breaks on mobile → CSS issue
```

#### Phase 3: Backlink Velocity Chart
```
1. Scroll to BacklinkVelocityChart component
2. Chart should have dual-axis: bars for new/lost, line for net change

✅ SUCCESS CRITERIA:
- Chart renders within 2 seconds
- X-axis shows dates (last 30 days default)
- Left Y-axis shows count (for bars)
- Right Y-axis shows net change (for line, if dual-axis)
- Green bars for "New Backlinks"
- Red bars for "Lost Backlinks"
- Bars grouped by date (side-by-side or stacked)
- Blue line for "Net Change" (overlaid)
- Legend clearly labels all series
- Hover tooltip shows:
  * Date
  * New: [count]
  * Lost: [count]
  * Net: [±count]
- Grid lines visible but subtle
- Zero line emphasized (for net change)
- Responsive (adjusts to container width)

❌ FAILURE SCENARIOS:
- Chart empty when data exists → Query filter too strict
- Bars overlap/unreadable → Bar width calculation wrong
- Line hidden behind bars → Z-index issue
- Tooltip shows wrong data → Data mapping broken
- Colors not matching legend → Color assignment issue
- Chart breaks on mobile → ResponsiveContainer missing
```

#### Phase 4: Anomaly Detection
```
1. Check for anomaly alerts section (if UI implemented)
2. Trigger anomaly by simulating data spike (if possible in dev)

✅ SUCCESS CRITERIA:
- Alert appears when velocity >2 standard deviations
- Alert shows:
  * Date of anomaly
  * Type: "Spike" or "Drop"
  * Severity: "High", "Medium", "Low"
  * Count: "+50 backlinks" or "-30 backlinks"
  * Icon: Warning or Info
- Click alert navigates to detailed view
- Alert can be dismissed
- Dismissed alerts don't reappear (until new anomaly)

❌ FAILURE SCENARIOS:
- No alerts when anomaly exists → Detection logic broken
- Alert shows for normal variation → Threshold too low
- Alert can't be dismissed → onClick handler missing
- Alert reappears after dismissal → Dismiss state not saved
```

#### Phase 5: Historical Data Accuracy
```
1. Navigate through different date ranges using date picker
2. Compare chart data with raw database records (if access available)

✅ SUCCESS CRITERIA:
- Chart data matches database records
- No missing dates in range
- Calculations correct:
  * Net = New - Lost
  * Percentages accurate
  * Averages calculated over correct period
- Time zone consistent (no off-by-one date errors)
- Data aggregated correctly (daily, not hourly)

❌ FAILURE SCENARIOS:
- Data doesn't match database → Query aggregation wrong
- Missing dates → Data join issue
- Net calculation wrong → Formula error
- Dates shifted by 1 day → Timezone problem
```

#### Phase 6: Velocity Trend Sparkline (If in Domain List)
```
1. Navigate to: /domains (domains list page)
2. Check for velocity sparkline column

✅ SUCCESS CRITERIA:
- Sparkline shows in table row for each domain
- Line represents last 7 or 30 days of net velocity
- Color indicates overall trend:
  * Green if mostly positive
  * Red if mostly negative
  * Gray if stable
- Sparkline updates when velocity data changes
- Hover shows mini tooltip (optional)
- Sparkline renders even with limited data

❌ FAILURE SCENARIOS:
- Sparklines missing → Component not integrated
- All show flat line → Data not loading
- Wrong colors → Trend calculation inverted
- Sparkline rendering is slow → Too many DOM elements
```

### Edge Cases to Test
```
1. Domain with no backlink history
   → Shows "No velocity data" empty state

2. Domain with only 1 day of data
   → Shows message "Need more data" or single bar

3. Large spike (e.g., 500 new backlinks in one day)
   → Chart scales Y-axis appropriately, doesn't cut off

4. All days have 0 new/lost
   → Chart shows flat line at zero, not empty

5. Negative net change for extended period
   → Chart clearly shows decline, alerts if severe
```

---

## Task #5: Competitor Tracking Foundation

### Testing Locations
1. `/domains/[domainId]/settings` - Competitor management
2. `/domains/[domainId]/competitors` - Competitor overview (new tab)

### Step-by-Step Verification

#### Phase 1: Add Competitor
```
1. Navigate to: /domains/[domainId]/settings
2. Find "Competitors" section
3. Click "Add Competitor" button

✅ SUCCESS CRITERIA:
- Modal/form opens
- Form fields:
  * Domain URL input (required)
  * Name input (optional, auto-fills from domain)
  * Add button
- Domain URL validates (must be valid domain format)
- Submit button disabled when invalid
- Can add competitor
- Success message appears
- Competitor appears in list immediately
- Background job scheduled to check positions

❌ FAILURE SCENARIOS:
- Form doesn't open → Button broken
- Can add invalid domain → Validation missing
- Duplicate competitor allowed → Uniqueness check missing
- Success message doesn't show → Toast missing
- Competitor not in list → Cache not updated
- Position check job not scheduled → Scheduler missing
```

#### Phase 2: Competitor Position Checking (Backend)
```
# 1. Trigger manual position check
npx convex run competitors:checkCompetitorPositions '{"competitorId": "..."}'

✅ SUCCESS CRITERIA:
- Console shows: "Checking positions for [competitor]"
- API calls to DataForSEO complete
- competitorKeywordPositions table gets new records
- Check completes within reasonable time (2-5 min for 100 keywords)
- No timeout errors
- Handles keywords competitor doesn't rank for (NULL position)

❌ FAILURE SCENARIOS:
- Function not found → Not deployed
- API error → DataForSEO integration broken
- Timeout → Too many keywords at once (need batching)
- No records saved → Mutation failed
```

#### Phase 3: Competitor Overview Chart
```
1. Navigate to: /domains/[domainId]/competitors (new tab)
2. Find CompetitorOverviewChart

✅ SUCCESS CRITERIA:
- Chart shows multiple lines:
  * Your domain (bold, distinctive color)
  * Each competitor (different colors)
- X-axis: dates (last 30 days default)
- Y-axis: average position (inverted, 1 at top)
- Legend shows domain names with colors
- Click legend toggles line visibility
- Hover tooltip shows:
  * Date
  * Each domain's position on that date
- Lines don't overlap unreadably (use transparency)
- Chart loads within 3 seconds
- No flash of empty state

❌ FAILURE SCENARIOS:
- Only your domain shows → Competitor data not fetched
- All lines same color → Color assignment broken
- Chart very cluttered → Too many competitors (>5), need UI to select subset
- Tooltip shows "undefined" → Data format mismatch
- Legend click doesn't work → Handler missing
```

#### Phase 4: Competitor Columns in Keyword Table (Optional)
```
1. Navigate to: /domains/[domainId]/monitoring
2. Look for competitor position columns (if implemented)
3. Or find toggle to show/hide competitor data

✅ SUCCESS CRITERIA:
- Toggle button/checkbox to show competitor columns
- When enabled, columns appear for each competitor
- Shows their position for same keyword
- Position badge styled same as your position
- Empty state "—" when competitor doesn't rank
- Columns sortable (optional)
- Table doesn't break layout with many competitors
- Toggle state persists (localStorage)

❌ FAILURE SCENARIOS:
- Columns don't appear → Query not joining competitor data
- Shows wrong positions → JOIN condition incorrect
- Layout breaks with >3 competitors → Need horizontal scroll
- Toggle doesn't persist → State not saved
```

#### Phase 5: Competitor Keyword Gap Table
```
1. Find CompetitorKeywordGapTable component
2. Should show keywords competitor ranks for, but you don't (or rank poorly)

✅ SUCCESS CRITERIA:
- Table columns:
  * Keyword
  * Competitor Position
  * Your Position (or "Not Ranking")
  * Search Volume
  * Difficulty
  * Gap Score (calculated)
- Sorted by gap score descending (best opportunities first)
- Can filter by:
  * Competitor
  * Position range
  * Volume range
  * Difficulty
- Bulk actions:
  * "Add to Monitoring"
  * "Export List"
- Pagination works
- Search works

❌ FAILURE SCENARIOS:
- Table shows keywords you both rank for equally → Gap logic wrong
- Gap score always 0 → Calculation broken
- Filters don't work → Query filters not applied
- Bulk action fails → Mutation error
```

#### Phase 6: Competitor Management
```
1. Navigate to competitor list
2. Test editing and removing competitors

Edit:
✅ SUCCESS CRITERIA:
- Click edit icon opens form
- Can change name
- Can pause competitor (stops position checks)
- Can resume competitor
- Changes save immediately
- Status badge updates (Active/Paused)

Remove:
✅ SUCCESS CRITERIA:
- Click remove button shows confirmation dialog
- Dialog warns about data deletion
- Confirm removes competitor
- Associated data cleaned up (or marked as deleted)
- Competitor disappears from lists immediately

❌ FAILURE SCENARIOS:
- Edit doesn't save → Mutation failed
- Remove without confirmation → No safety check
- Remove leaves orphaned data → Cascade delete missing
- Can remove only competitor → Should allow (but maybe warn)
```

### Edge Cases to Test
```
1. Add competitor that doesn't rank for any of your keywords
   → Shows in list but gap table empty or shows "No overlap"

2. Competitor ranks better than you for all keywords
   → Gap table shows all opportunities, no "easy wins"

3. Remove competitor with historical data
   → Confirm dialog explains data will be deleted/archived

4. Competitor domain that doesn't exist
   → Domain validation fails, or position check handles gracefully

5. Same keyword both rank #1
   → Gap score is 0 or low, filtered out of gap table
```

---

## Task #6: Content Gap Analysis

### Testing Locations
1. `/domains/[domainId]/visibility` - Content Gap dashboard section
2. `/domains/[domainId]/opportunities` - Dedicated opportunities page (if created)

### Step-by-Step Verification

#### Phase 1: Content Gap Dashboard
```
1. Navigate to: /domains/[domainId]/visibility
2. Scroll to Content Gap section
3. Check metrics cards

✅ SUCCESS CRITERIA:
- 4 metric cards:
  * Total Gaps: count of keywords
  * High Priority: gaps with high opportunity score
  * Est. Traffic Opportunity: sum of potential traffic
  * Avg. Difficulty: average keyword difficulty
- Numbers update when filters applied
- Loading skeletons during data fetch
- Metrics link to filtered gap table

❌ FAILURE SCENARIOS:
- Cards show "0" when gaps exist → Query broken
- Numbers don't update with filters → Not reactive
- Est. Traffic shows "NaN" → Calculation error
```

#### Phase 2: Content Gap Table
```
1. Find ContentGapTable component
2. Should show all keyword opportunities

✅ SUCCESS CRITERIA:
- Table columns:
  * Keyword
  * Your Position (or "Not Ranking")
  * Competitor Avg Position
  * Gap Size (difference)
  * Opportunity Score (0-100)
  * Search Volume
  * Difficulty
  * Topic Cluster
  * Actions
- Sorted by opportunity score descending (default)
- Each column sortable
- Search box filters keywords
- Color coding:
  * High opportunity (score >70): green
  * Medium (40-70): yellow
  * Low (<40): gray
- Pagination: 25 items per page
- Empty state if no gaps

❌ FAILURE SCENARIOS:
- Shows keywords you rank well for → Gap filter too loose
- Opportunity score wrong → Formula incorrect
- Sorting broken → onClick handler missing
- Search doesn't work → Filter logic broken
- Pagination doesn't update count → Calculation missing
```

#### Phase 3: Opportunity Score Calculation
```
1. Check opportunity scores make sense
2. Compare formula output with manual calculation

Formula: (competitorAvgPos / yourPos) × log(volume) × (1 - difficulty/100)

✅ SUCCESS CRITERIA:
- High volume keywords with low difficulty score highest
- Keywords competitor ranks #1 for score very high
- Keywords you rank #15+ for score higher than #5
- Score is 0 when you rank better than competitors
- Score handles NULL positions (you don't rank) by treating as 100+
- Score normalized to 0-100 range

❌ FAILURE SCENARIOS:
- All scores same → Formula not differentiating
- Negative scores → Math error
- Scores >100 → Not normalized
- Low volume high difficulty scores high → Weight wrong
```

#### Phase 4: Topic Clustering
```
1. Check if keywords grouped by topic cluster
2. Find topic cluster filter/grouping

✅ SUCCESS CRITERIA:
- Clusters have meaningful names (not "Cluster 1")
- Keywords in same cluster semantically related
- Filter by cluster shows only those keywords
- Cluster badge on each keyword row
- Cluster summary shows:
  * Keyword count
  * Avg opportunity score
  * Total volume
- Can view cluster details (all keywords in cluster)

❌ FAILURE SCENARIOS:
- Clusters random → Clustering algorithm not semantic
- Clusters too broad (all keywords in one) → Parameters wrong
- Clusters too narrow (one keyword per cluster) → Too sensitive
- Cluster names generic → Need better naming logic
```

#### Phase 5: Opportunity Score Chart (Scatter Plot)
```
1. Find OpportunityScoreChart
2. Should be scatter plot: X=volume, Y=difficulty

✅ SUCCESS CRITERIA:
- Each dot represents a keyword
- X-axis: search volume (logarithmic scale)
- Y-axis: keyword difficulty (0-100)
- Dot color: opportunity score (gradient green→red)
- Dot size: gap size (bigger = larger gap)
- Hover shows:
  * Keyword
  * Volume, difficulty, score
  * Your position vs competitor
- Click dot navigates to keyword detail (optional)
- Can zoom/pan chart
- Quadrants clearly labeled:
  * Top-left: High vol, high diff (hard)
  * Top-right: High vol, low diff (best opportunities)
  * Bottom-left: Low vol, high diff (ignore)
  * Bottom-right: Low vol, low diff (easy but low value)

❌ FAILURE SCENARIOS:
- All dots same color → Score not mapped to color
- Dots overlapping unreadably → Need jitter or clustering
- Hover doesn't work → Tooltip component missing
- Logarithmic scale broken → X-axis misconfigured
- Can't read dot labels → Font too small
```

#### Phase 6: Bulk Actions on Gaps
```
1. Select multiple gap keywords
2. Test bulk actions

Action: "Add to Monitoring"
✅ SUCCESS CRITERIA:
- Selected keywords added to active monitoring
- Status changes from "discovered" to "monitoring"
- Success message shows count
- Keywords appear in Monitoring tab
- Position check job scheduled

Action: "Ignore Gap"
✅ SUCCESS CRITERIA:
- Keywords removed from gap table
- Status set to "ignored"
- Can be un-ignored later (if UI exists)
- Doesn't delete keyword, just hides from gaps

Action: "Export Gaps"
✅ SUCCESS CRITERIA:
- CSV downloads with gap data
- Includes all table columns
- Filename includes domain and date
- Opens without corruption

❌ FAILURE SCENARIOS:
- Bulk action fails on some keywords → Partial success not handled
- No loading indicator → Appears frozen
- Keywords not added to monitoring → Mutation failed
- Export CSV empty → Data serialization broken
```

### Edge Cases to Test
```
1. No competitors added
   → Gap analysis disabled, shows message "Add competitors first"

2. Zero keyword overlap with competitors
   → Shows "No gaps found" with suggestion to add more competitors

3. You rank better than all competitors for all keywords
   → Gap table empty, shows "You're winning!" message

4. Very large gap (you #100, competitor #1)
   → Score maxes out at 100, doesn't overflow

5. Keyword with 0 volume
   → Shows in gaps but opportunity score very low
```

---

## Task #7: Forecasting and Predictive Analytics

### Testing Locations
1. ALL chart pages - Forecast overlay toggle
2. `/domains/[domainId]/insights` - Anomaly dashboard (new page)

### Step-by-Step Verification

#### Phase 1: Forecast Generation (Backend)
```
# 1. Trigger forecast generation manually
npx convex run forecasts:generateForecast '{"entityType": "keyword", "entityId": "...", "metric": "position"}'

✅ SUCCESS CRITERIA:
- Console shows: "Generating forecast for [entity]"
- Calculates linear regression from historical data
- Generates 30/60/90 day predictions
- Calculates confidence intervals (±1.96 SE)
- Saves to forecasts table
- Completes in < 5 seconds
- Handles insufficient data gracefully (need 10+ points)

❌ FAILURE SCENARIOS:
- Function not found → Not deployed
- Math error (NaN, Infinity) → Regression calculation broken
- No forecast saved → Insert failed
- Timeout → Calculation too slow
- Confidence interval wrong → SE calculation error
```

#### Phase 2: Forecast Chart Overlay
```
1. Navigate to: /domains/[domainId]/monitoring
2. Find PositionHistoryChart or MovementTrendChart
3. Click "Show Forecast" toggle

✅ SUCCESS CRITERIA:
- Toggle button visible and accessible
- Click toggle shows forecast overlay
- Forecast appears as:
  * Dashed line (different style from actual data)
  * Different color (e.g., light blue)
  * Confidence interval shaded area
- Vertical line separates historical vs forecast
- Forecast extends 30 days into future (default)
- Forecast updates when date range changes
- Tooltip distinguishes actual vs predicted values
- Toggle state persists (session or localStorage)

❌ FAILURE SCENARIOS:
- Toggle doesn't work → State not updating
- Forecast doesn't appear → Query not fetching forecast data
- Forecast overlaps historical data → Data filtering wrong
- Confidence interval missing → Not rendering shaded area
- Line styles identical → Can't tell actual from forecast
```

#### Phase 3: Prediction Badges in Table
```
1. Navigate to: /domains/[domainId]/monitoring
2. Check KeywordMonitoringTable for prediction badges

✅ SUCCESS CRITERIA:
- Badge appears next to keywords with predictions:
  * ⬆️ "Trending Up" (green) if forecast improves >5 positions
  * ⬇️ "Trending Down" (red) if forecast worsens >5 positions
  * ➡️ "Stable" (gray) if forecast ±5 positions
- Badge shows confidence level:
  * "High confidence" if CI narrow
  * "Medium confidence" if CI moderate
  * "Low confidence" if CI wide
- Hover badge shows tooltip with predicted position and date
- Badge only on keywords with sufficient history (10+ data points)

❌ FAILURE SCENARIOS:
- All badges say "Stable" → Threshold too high
- Badge shows on new keywords → No historical data check
- Wrong trend direction → Forecast calculation inverted
- Confidence always "High" → CI calculation wrong
```

#### Phase 4: Forecast Summary Card
```
1. Find ForecastSummaryCard component (usually in overview)
2. Should show projected ETV change

✅ SUCCESS CRITERIA:
- Card shows:
  * Current ETV: $X,XXX
  * Projected ETV (30 days): $X,XXX
  * Change: +$XXX (+X%)
  * Confidence: High/Medium/Low
- Color-coded:
  * Green if ETV increasing
  * Red if ETV decreasing
  * Gray if stable
- Trend arrow points correct direction
- Click card navigates to detailed forecast view
- Updates when domain data changes

❌ FAILURE SCENARIOS:
- Shows "$0" when data exists → ETV calculation broken
- Percent change wrong → Formula error
- Negative ETV → Validation missing
- Color doesn't match trend → Condition inverted
```

#### Phase 5: Anomaly Detection
```
1. Navigate to: /domains/[domainId]/insights (or anomaly section)
2. Check AnomalyAlertsList component

✅ SUCCESS CRITERIA:
- List shows recent anomalies (last 30 days)
- Each anomaly card shows:
  * Entity (keyword or domain)
  * Metric (position, traffic, backlinks)
  * Date detected
  * Anomaly type: Spike/Drop/Pattern Change
  * Severity: High/Medium/Low
  * Description: "+50 positions in 1 day"
  * Z-score or deviation magnitude
- Sorted by date descending (newest first)
- Can filter by:
  * Severity
  * Anomaly type
  * Date range
- Can mark as "Resolved"
- Empty state if no anomalies

❌ FAILURE SCENARIOS:
- List empty when anomalies exist → Query broken
- Shows normal variations → Threshold too low (z-score <2)
- Severity always "Low" → Severity calculation wrong
- Can't resolve anomalies → Mutation missing
- Description unclear → Need better messaging
```

#### Phase 6: Anomaly Detection Accuracy (Cron Job)
```
# 1. Check cron job running
npx convex function-spec | grep "detectAnomalies"

# 2. Trigger manually
npx convex run crons:detectAnomalies

✅ SUCCESS CRITERIA:
- Runs daily at midnight
- Checks all active keywords/domains
- Calculates z-score: (current - mean) / stdDev
- Detects anomaly if |z-score| > 2.5
- Inserts into anomalies table
- Sends notifications (if implemented)
- Completes within time limit (< 5 minutes)
- Handles domains with insufficient data (need 10+ points)

❌ FAILURE SCENARIOS:
- Doesn't run → Cron schedule wrong
- Detects too many false positives → Threshold too low
- Misses obvious anomalies → Threshold too high
- Timeout with many domains → Need batching
- Z-score is NaN → StdDev calculation broken
```

#### Phase 7: Statistical Accuracy
```
1. Manually verify forecast accuracy with known data
2. Test regression calculation

✅ SUCCESS CRITERIA:
- Linear regression slope calculation correct
- Intercept calculation correct
- Standard error calculation correct
- Confidence intervals symmetrical
- Predictions don't extrapolate unreasonably (e.g., position -5)
- Validation bounds predictions (position 1-100)

❌ FAILURE SCENARIOS:
- Forecast predicts position 0 → No lower bound
- Forecast predicts position 200 → No upper bound
- Confidence interval asymmetric → Calculation error
- Slope wrong sign → Regression broken
```

### Edge Cases to Test
```
1. Keyword with only 5 data points
   → Shows "Insufficient data for forecast" message

2. Keyword with perfect linear trend
   → Forecast is very confident (narrow CI)

3. Keyword with random fluctuations
   → Forecast has wide confidence interval, marked "Low confidence"

4. Keyword drops from #3 to #50 in one day (anomaly)
   → Anomaly detected with "High" severity

5. All positions within 1-2 of each other (stable)
   → Forecast shows flat line, marked "Stable"
```

---

## Task #8: Comprehensive On-Site SEO Reports

### Testing Locations
1. `/domains/[domainId]/on-site` - New On-Site tab (primary location)
2. `/domains/[domainId]/settings` - Scan configuration (if separate)

### Step-by-Step Verification

#### Phase 1: Initiate On-Site Scan
```
1. Navigate to: /domains/[domainId]/on-site
2. First visit shows empty state: "No scan data yet"
3. Click "Run On-Site Scan" button

✅ SUCCESS CRITERIA:
- Button is prominent and clearly labeled
- Click shows confirmation modal/loading state
- Modal explains what will be scanned
- Estimated time shown (e.g., "5-30 minutes depending on site size")
- "Start Scan" button in modal
- Click starts scan, modal closes
- Scan status card appears showing:
  * Status: "Queued" or "Crawling"
  * Progress indicator (if crawl started)
  * Estimated completion time
  * Cancel button (if crawl can be stopped)
- Network tab shows successful API call to backend action
- Console shows: "Scan initiated: [scanId]"

❌ FAILURE SCENARIOS:
- Button doesn't work → onClick handler missing
- No loading feedback → User doesn't know scan started
- Modal doesn't close → onClose handler missing
- Scan status not updating → Polling not working
- Console error → Backend action failed
- Network error 500 → DataForSEO API integration broken
```

#### Phase 2: Monitor Scan Progress
```
1. While scan is in progress, check status updates
2. Refresh page to ensure status persists

✅ SUCCESS CRITERIA:
- Status updates automatically (polling every 10-30 seconds)
- Progress bar shows completion percentage (if available from API)
- Status text changes: "Queued" → "Crawling" → "Processing" → "Complete"
- Estimated time updates as scan progresses
- Can refresh page without losing scan state
- If scan fails, shows error message with details
- Retry button appears on failure
- Notifications (toast/alert) when scan completes (if user still on page)

❌ FAILURE SCENARIOS:
- Status stuck on "Queued" → API not processing
- Progress bar doesn't update → Polling interval too long or not working
- Refresh loses state → scanId not stored in URL/state
- No error message on failure → Error handling missing
- Retry button broken → Action not wired up
```

#### Phase 3: Technical Health Dashboard
```
1. After scan completes, Technical Health section should render
2. Check overall health score card

✅ SUCCESS CRITERIA:
- Overall score card shows 0-100 score
- Score color-coded:
  * 80-100: Green (Excellent)
  * 60-79: Yellow (Good)
  * 40-59: Orange (Needs Work)
  * 0-39: Red (Critical)
- Score has trend indicator (vs. previous scan)
- 3 issue summary cards:
  * Critical Issues: count + red badge
  * Warnings: count + yellow badge
  * Recommendations: count + blue badge
- Click card filters issues table by severity
- Loading skeletons during data fetch
- Empty state if no issues (celebration message)

❌ FAILURE SCENARIOS:
- Score shows "NaN" → Calculation broken
- Score >100 or <0 → Validation missing
- Wrong color for score → Thresholds incorrect
- Cards show "0" when issues exist → Query not returning data
- Click doesn't filter → Event handler missing
```

#### Phase 4: Issues Breakdown Chart
```
1. Find IssuesBreakdownChart (stacked bar or pie chart)
2. Should show issues grouped by category

✅ SUCCESS CRITERIA:
- Chart shows categories:
  * Meta Tags
  * Headings
  * Images
  * Links
  * Performance
  * Mobile
  * Indexability
  * Security
- Each category color-coded consistently
- Bars stacked showing Critical/Warning/Recommendation split
- Hover tooltip shows:
  * Category name
  * Issue count by severity
  * Percentage of total
- Click bar/segment filters issues table
- Legend toggles category visibility
- Chart responsive (adjusts to screen size)

❌ FAILURE SCENARIOS:
- Chart empty when issues exist → Data mapping wrong
- All one color → Severity not distinguished
- Tooltip doesn't show → Component props missing
- Click doesn't filter → Integration with table broken
- Chart breaks on mobile → ResponsiveContainer missing
```

#### Phase 5: Top Issues Table
```
1. Scroll to TopIssuesTable
2. Should show top 10 critical issues

✅ SUCCESS CRITERIA:
- Table columns:
  * Issue Title (clear description)
  * Category (badge)
  * Severity (Critical/Warning/Recommendation badge)
  * Affected Pages (count with link)
  * Priority Score (if calculated)
- Sorted by priority/severity
- Click row expands to show:
  * Detailed description
  * How to fix instructions
  * List of affected page URLs
- "View All Issues" link to full table
- Empty state if no critical issues

❌ FAILURE SCENARIOS:
- Table empty when issues exist → Query filtering too strict
- Generic issue titles → Need better descriptions
- Affected pages count wrong → Aggregation broken
- Expand doesn't work → Accordion component missing
- "View All" link broken → Route not configured
```

#### Phase 6: Pages Analysis Table
```
1. Navigate to Pages section (tab or scroll)
2. Find OnSitePagesTable component

✅ SUCCESS CRITERIA:
- Table columns:
  * URL (truncated, full URL in tooltip)
  * Status Code (badge: 200 green, 301 blue, 404 red, 500 red)
  * Title (with length: "45 chars" green if 30-60, red if <30 or >60)
  * Meta Description (with length indicator)
  * H1 (validation icon: checkmark if present, X if missing/multiple)
  * Load Time (color: <2s green, 2-4s yellow, >4s red)
  * Page Size (in KB)
  * Word Count
  * Issues (badge with count)
- All columns sortable
- Search box filters by URL or title
- Filters dropdown:
  * Status Code: 200/301/404/500/All
  * Has Issues: Yes/No/All
  * Load Time: <2s / 2-4s / >4s / All
  * Word Count: <300 / 300-1000 / >1000 / All
- Pagination: 25 items per page
- Total count shown: "Showing 1-25 of 342 pages"
- Click row opens page detail slideout/modal

❌ FAILURE SCENARIOS:
- Table empty when pages exist → Query not returning data
- URLs not truncated → Layout breaks with long URLs
- Status code colors wrong → Badge color mapping incorrect
- Sort doesn't work → onClick handler missing
- Search doesn't filter → Filter logic broken
- Filters don't apply → Query parameters not updating
- Pagination count wrong → Calculation error
- Click row does nothing → Event handler missing
```

#### Phase 7: Page Detail View
```
1. Click a page row in OnSitePagesTable
2. Detail slideout/modal should open

✅ SUCCESS CRITERIA:
- Slideout slides in from right (or modal appears)
- Shows comprehensive page data:
  * Full URL (with "Open in new tab" link)
  * Status code with badge
  * Last crawled date
  * Full title (with character count)
  * Full meta description (with character count)
  * H1 tag(s) - all H1s if multiple
  * Load time breakdown (TTFB, DOM load, full load)
  * Page size breakdown (HTML, CSS, JS, Images)
  * Word count and reading time
  * Internal links (count + list)
  * External links (count + list)
  * Images (count + list with alt text status)
  * Issues on this page (categorized list)
- "Recheck Page" button to re-crawl this specific page
- "View in Site" button opens page in new tab
- Close button (X) works
- Backdrop click closes slideout

❌ FAILURE SCENARIOS:
- Slideout doesn't open → Component not wired up
- Data missing → Query not fetching detail level
- "Open" button has wrong URL → URL construction broken
- Recheck button doesn't work → Action not connected
- Can't close slideout → Close handler missing
- Scroll doesn't work if content long → CSS overflow issue
```

#### Phase 8: Core Web Vitals Section
```
1. Navigate to Core Web Vitals section
2. Check metric cards

✅ SUCCESS CRITERIA:
- 4 metric cards:
  * LCP (Largest Contentful Paint)
    - Value in seconds (e.g., "2.3s")
    - Target: <2.5s (green), 2.5-4s (yellow), >4s (red)
    - Pass/Fail badge
  * FID (First Input Delay)
    - Value in milliseconds (e.g., "85ms")
    - Target: <100ms (green), 100-300ms (yellow), >300ms (red)
  * CLS (Cumulative Layout Shift)
    - Value (e.g., "0.08")
    - Target: <0.1 (green), 0.1-0.25 (yellow), >0.25 (red)
  * Performance Score
    - 0-100 scale
    - Lighthouse score equivalent
- Device toggle: Mobile / Desktop
- Click toggle re-fetches data for that device
- Metric cards update smoothly (no flash)
- Cards show trend vs. previous scan (if available)

❌ FAILURE SCENARIOS:
- Metrics show "0" → Data not fetched
- All metrics green when site is slow → Thresholds wrong
- Device toggle doesn't change data → Query not responding
- Trend indicator wrong direction → Calculation inverted
```

#### Phase 9: Core Web Vitals Chart
```
1. Find CoreWebVitalsChart (line chart with trends)

✅ SUCCESS CRITERIA:
- Chart shows 3 lines (LCP, FID, CLS) over time
- X-axis: dates of scans (last 10 scans or date range)
- Y-axis: metric values (dual-axis if needed)
- Reference lines showing Google thresholds:
  * Green zone (Good)
  * Yellow zone (Needs Improvement)
  * Red zone (Poor)
- Legend labels each metric clearly
- Hover tooltip shows:
  * Date
  * All 3 metric values
  * Pass/Fail for each
- Can toggle device (Mobile/Desktop)
- Date range selector (if many scans)
- Responsive (adjusts to screen)

❌ FAILURE SCENARIOS:
- Chart empty when data exists → Query not returning historical data
- Lines all flat → Need multiple scans to show trend
- Thresholds wrong → Reference lines misplaced
- Tooltip missing values → Data format mismatch
- Device toggle doesn't update chart → State not connected
```

#### Phase 10: Content Quality Metrics
```
1. Navigate to Content Quality section
2. Check summary cards

✅ SUCCESS CRITERIA:
- 4 summary cards:
  * Avg Word Count: number (e.g., "847")
  * Thin Content Pages: count of pages <300 words
  * Duplicate Content: count of pages with duplicates
  * Readability Score: average (if calculated)
- Cards link to filtered tables
- WordCountDistributionChart shows histogram:
  * X-axis: word count ranges (0-300, 300-600, 600-1000, etc.)
  * Y-axis: page count
  * Bars color-coded: red for <300, green for 300+
- ThinContentTable shows pages with <300 words:
  * URL
  * Word count
  * Priority (based on traffic/importance)
  * Actions: "View Page", "Expand Content"
- DuplicateContentTable shows duplicate pairs:
  * Page 1 URL
  * Page 2 URL
  * Similarity % (e.g., "85% similar")
  * Actions: "Compare", "Canonicalize"

❌ FAILURE SCENARIOS:
- Avg word count is 0 → Calculation broken
- Thin content shows high word count pages → Filter wrong
- Duplicate table empty when duplicates exist → Detection algorithm not working
- Histogram has wrong ranges → Bucketing logic broken
- Actions don't work → Event handlers missing
```

#### Phase 11: Schema & Structured Data
```
1. Navigate to Schema section
2. Check schema overview cards

✅ SUCCESS CRITERIA:
- Overview cards:
  * Pages with Schema: count
  * Schema Types Found: count (e.g., "5 types")
  * Validation Errors: count
  * Validation Warnings: count
- SchemaTypesList shows all types found:
  * Type name (Article, Product, Organization, etc.)
  * Page count using this type
  * Icon for each type
  * Click to filter pages with this type
- SchemaValidationTable:
  * URL
  * Schema Types (badges for each)
  * Validation Status (Valid/Errors/Warnings badge)
  * Error Count
  * Warning Count
  * Actions: "View Errors", "Test in Google"
- Click "View Errors" shows detailed errors:
  * Error message from validator
  * JSON path where error occurred
  * Suggested fix
- "Test in Google" opens Google Rich Results Test in new tab

❌ FAILURE SCENARIOS:
- Cards show "0" when schema exists → Detection not working
- Schema types not recognized → Parser needs update
- Validation always passes → Not actually validating
- Errors unclear → Need better error messages
- "Test in Google" link broken → URL construction wrong
```

#### Phase 12: Scan History & Comparison
```
1. Find ScanHistoryTimeline
2. Should show past scans

✅ SUCCESS CRITERIA:
- Timeline shows scans in reverse chronological order
- Each scan entry shows:
  * Date & time
  * Status badge (Complete/Failed)
  * Summary: "342 pages, 27 issues"
  * Duration: "Completed in 12 minutes"
  * Actions: "View", "Compare"
- Click "View" loads that scan's data
- Click "Compare" opens comparison tool
- Comparison tool:
  * Select two scans from dropdowns
  * Side-by-side metric cards showing changes
  * Issues comparison: "3 new issues, 5 resolved"
  * Pages comparison: "15 new pages, 2 removed"
  * Delta indicators (↑ improved, ↓ worsened, → same)
- Can export comparison report

❌ FAILURE SCENARIOS:
- Timeline shows wrong order → Sort by date broken
- "View" loads current data, not historical → Query not filtering by scanId
- Comparison tool doesn't show changes → Delta calculation broken
- Can compare same scan twice → Validation missing
- Export fails → CSV generation broken
```

#### Phase 13: Performance & Rate Limiting
```
1. Try to trigger multiple scans rapidly
2. Check rate limiting behavior

✅ SUCCESS CRITERIA:
- Can only trigger 1 scan per hour per domain
- If scan already running, button disabled with message: "Scan in progress"
- If triggered too soon, shows message: "Please wait X minutes before next scan"
- Countdown timer shows time until next scan allowed
- Queue scans if multiple domains need scanning
- Rate limit shown clearly (e.g., "1 scan per hour")

❌ FAILURE SCENARIOS:
- Can trigger unlimited scans → Rate limiting not implemented
- Button stays disabled forever → State not resetting
- Countdown timer wrong → Time calculation broken
- Can start scan while one running → Concurrent scan prevention missing
```

#### Phase 14: Data Accuracy Verification
```
1. Compare scan results with actual website
2. Manually verify a sample of findings

✅ SUCCESS CRITERIA:
- Page count matches actual site (±5% for dynamic sites)
- Issue detection accurate:
  * Missing titles actually missing
  * Duplicate content actually duplicate
  * Broken links actually 404
  * Load times reasonable (±20% variance)
- Status codes correct (200/301/404/500)
- Meta descriptions match actual pages
- Word counts approximately correct (±10%)
- Internal/external link counts reasonable

❌ FAILURE SCENARIOS:
- Page count way off → Crawler not finding all pages
- False positive issues → Detection too sensitive
- Missing obvious issues → Detection not comprehensive enough
- Load times wildly inaccurate → Measurement method wrong
- Status codes wrong → Crawler interpreting redirects incorrectly
```

### Edge Cases to Test
```
1. Very small site (1-5 pages)
   → Scan completes quickly, all sections still render

2. Very large site (10,000+ pages)
   → Scan may timeout, should handle gracefully with partial results

3. Site with robots.txt blocking crawl
   → Shows error message explaining why scan failed

4. Site that's down (all 500 errors)
   → Handles gracefully, shows appropriate error message

5. Site with no issues (perfect score)
   → Shows celebration message, doesn't hide UI

6. Scan during domain DNS changes
   → Handles DNS errors gracefully

7. API rate limit exceeded
   → Shows message to user, queues scan for later

8. Multiple users scanning same domain
   → Uses existing scan data if recent, doesn't duplicate
```

### DataForSEO API Response Verification
```
# Check API responses match expected format
1. Open Network tab during scan initiation
2. Monitor API calls to DataForSEO

✅ SUCCESS CRITERIA:
- POST to /on_page/task_post returns task_id
- Polling gets task status correctly
- All endpoint responses parse without errors
- Data types match schema expectations
- Null/undefined values handled gracefully
- Large responses don't timeout
- Pagination works for large result sets

❌ FAILURE SCENARIOS:
- API returns 429 (rate limit) → Need retry logic
- Response format changed → Parser breaks
- Null values cause crashes → Need null checks
- Large response times out → Need longer timeout
- JSON parse error → Response validation missing
```

---

## General Testing Checklist (Apply to ALL Tasks)

### Before Marking Task as Complete

```
✅ Functionality
  ☐ All primary features work
  ☐ All secondary features work
  ☐ Loading states appear and disappear correctly
  ☐ Empty states show when appropriate
  ☐ Error states handled gracefully

✅ UI/UX
  ☐ No layout shifts during load
  ☐ Responsive on mobile (test iPhone/Android size)
  ☐ Responsive on tablet
  ☐ Responsive on desktop (various widths)
  ☐ All buttons have hover states
  ☐ All interactive elements have focus states (accessibility)
  ☐ Loading indicators don't block interaction (when avoidable)
  ☐ Tooltips don't overflow screen
  ☐ Modals center correctly
  ☐ Forms have proper validation feedback

✅ Performance
  ☐ Initial load < 3 seconds
  ☐ Interactions respond < 100ms
  ☐ Charts render < 2 seconds
  ☐ No memory leaks (check DevTools Memory tab)
  ☐ No infinite loops (CPU stays normal)
  ☐ Network requests minimized (check Network tab)
  ☐ No unnecessary re-renders (React DevTools Profiler)

✅ Errors & Edge Cases
  ☐ No console errors
  ☐ No console warnings (or documented/acceptable)
  ☐ No 404 errors in Network tab
  ☐ No 500 errors in Network tab
  ☐ Handles empty data gracefully
  ☐ Handles null/undefined values
  ☐ Handles very large numbers (1,000,000+)
  ☐ Handles very small numbers (0.001)
  ☐ Handles special characters in text
  ☐ Handles very long text (truncates or wraps)
  ☐ Handles API timeouts
  ☐ Handles offline mode (if applicable)

✅ Data Integrity
  ☐ Data persists after page refresh
  ☐ Data survives navigation (back/forward buttons)
  ☐ Optimistic updates revert on error
  ☐ No data loss on error
  ☐ Concurrent updates handled (if multi-user)
  ☐ URL state reflects UI state
  ☐ Browser history works correctly

✅ Accessibility (Basic)
  ☐ All images have alt text
  ☐ Form inputs have labels
  ☐ Tab navigation works (keyboard only)
  ☐ Focus visible on all interactive elements
  ☐ Color contrast sufficient (WCAG AA minimum)
  ☐ No flashing content (seizure risk)

✅ Cross-Browser (If Required)
  ☐ Chrome works
  ☐ Safari works
  ☐ Firefox works (if required)
  ☐ Edge works (if required)

✅ Backend
  ☐ All queries return correct data
  ☐ All mutations succeed
  ☐ Schema deployed and validated
  ☐ Indexes created for common queries
  ☐ No N+1 query problems
  ☐ Background jobs scheduled correctly
  ☐ Cron jobs run on schedule

✅ Security (Basic)
  ☐ No API keys in frontend code
  ☐ No SQL injection risks (Convex handles this)
  ☐ No XSS risks (sanitize user input)
  ☐ Authentication required where appropriate
  ☐ Authorization checks prevent unauthorized access
  ☐ Sensitive data not logged to console
```

### Performance Benchmarks

```
ACCEPTABLE:
- Page load: 1-3 seconds
- Interaction response: 50-100ms
- Chart render: 1-2 seconds
- API query: 500ms - 2 seconds
- Mutation: 100-500ms

NEEDS OPTIMIZATION:
- Page load: >5 seconds
- Interaction response: >200ms
- Chart render: >5 seconds
- API query: >5 seconds
- Mutation: >2 seconds
```

### When to Mark Task as PASSING

```
✅ PASSING Criteria:
  1. All primary functionality works
  2. Zero console errors
  3. Zero network errors (except expected 404s)
  4. All success criteria met
  5. At least 3 edge cases tested successfully
  6. Performance within acceptable ranges
  7. Responsive on mobile + desktop
  8. Data persists correctly
  9. User-facing text clear and helpful
  10. Code committed to git with descriptive message

⚠️ CONDITIONAL PASS (document issues):
  - Minor UI glitches that don't block use
  - Performance slightly slow but functional
  - Console warnings (not errors)
  - Known limitations documented

❌ FAILING (do not mark passing):
  - Console errors present
  - Core functionality broken
  - Data loss or corruption
  - Crashes or freezes
  - Security vulnerabilities
  - Terrible performance (>10s loads)
```
