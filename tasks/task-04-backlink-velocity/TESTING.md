# Task #4: Backlink Velocity Tracking - Testing Instructions

## Pre-Testing Setup

**Required:**
- ✅ Dev servers running (Convex + Next.js)
- ✅ Schema deployed with `backlinkVelocityHistory` table
- ✅ Domain with existing backlinks data
- ✅ Cron job executed at least once to populate velocity data

**Verify schema:**
```bash
# Check Convex dashboard or run:
npx convex function-spec | grep backlinkVelocity
```

**Populate test data:**
```bash
# Run cron manually to generate velocity data:
npx convex run scheduler:calculateDailyBacklinkVelocity
```

**Expected output:**
```json
{
  "errors": 0,
  "processed": 1
}
```

**Navigate to:**
```
http://localhost:3000/domains/[domainId]/backlinks
```

---

## Test 1: Velocity Metrics Cards

### Steps:
1. Navigate to Backlinks tab
2. Scroll down past BacklinksHistoryChart
3. Find "Backlink Velocity" section
4. Observe the 4 metric cards at top of section

**Expected Results:**

**Card 1: Avg New/Day**
- ✅ Shows number with 1 decimal place (e.g., "+12.5")
- ✅ Green color scheme
- ✅ Up arrow icon (TrendUp01)
- ✅ Label: "Avg New/Day"
- ✅ Number is positive or zero

**Card 2: Avg Lost/Day**
- ✅ Shows number with 1 decimal place (e.g., "-3.2")
- ✅ Red color scheme
- ✅ Down arrow icon (TrendDown01)
- ✅ Label: "Avg Lost/Day"
- ✅ Number format consistent

**Card 3: Net Growth**
- ✅ Shows number with 1 decimal place (e.g., "+9.3/day")
- ✅ Color based on value:
  - Green if positive (net gain)
  - Red if negative (net loss)
  - Gray if zero
- ✅ Appropriate icon (up arrow if positive, down if negative)
- ✅ Label: "Net Growth"
- ✅ Shows "/day" suffix

**Card 4: 7-Day Velocity**
- ✅ Shows recent 7-day trend
- ✅ Number with 1 decimal place
- ✅ Color-coded by trend
- ✅ Label: "7-Day Velocity"

**General Checks:**
- ✅ All 4 cards in responsive grid (2x2 on desktop, stacks on mobile)
- ✅ Cards have consistent styling (white background, border, padding)
- ✅ No cards show "NaN" or undefined
- ✅ Loading skeletons appear briefly on initial load
- ✅ Zero console errors

### Test 1a: Verify Calculations

**Steps:**
1. Note the "Avg New/Day" value (e.g., 12.5)
2. Open Convex dashboard
3. Query `backlinkVelocityHistory` for the domain
4. Manually calculate: sum(newBacklinks) / daysTracked
5. Compare with displayed value

**Expected Results:**
- ✅ Manual calculation matches displayed value (±0.1)
- ✅ Net Growth = Avg New/Day - Avg Lost/Day

---

## Test 2: Backlink Velocity Chart

### Steps:
1. In the same "Backlink Velocity" section
2. Scroll to find BacklinkVelocityChart component

**Expected Results:**

**Chart Structure:**
- ✅ Chart renders without errors
- ✅ Chart title or description visible
- ✅ Chart has summary statistics above/below (optional)

**Visual Elements:**
- ✅ **Green bars**: New backlinks (left side of each date)
- ✅ **Red bars**: Lost backlinks (right side of each date)
- ✅ **Blue line**: Net change (overlays bars)
- ✅ Bars and line clearly distinguishable
- ✅ Grid lines subtle but visible

**Axes:**
- ✅ **X-axis**: Shows dates (last 30 days by default)
- ✅ Date format readable (e.g., "Jan 15" or "1/15")
- ✅ Dates in chronological order (left to right)
- ✅ All dates labeled (or subset if crowded)
- ✅ **Y-axis**: Shows count (0 to max value)
- ✅ Y-axis starts at 0
- ✅ Y-axis max scales to data (not hardcoded)
- ✅ Y-axis labels clear

**Legend:**
- ✅ Legend visible (top-right or bottom)
- ✅ 3 legend items:
  - "New Backlinks" (green)
  - "Lost Backlinks" (red)
  - "Net Change" (blue)
- ✅ Legend colors match chart elements
- ✅ Click legend items toggles visibility (if interactive)

### Test 2a: Chart Interactions

**Hover/Tooltip:**

**Steps:**
1. Hover mouse over a date on the chart

**Expected Results:**
- ✅ Tooltip appears near mouse cursor
- ✅ Tooltip shows date
- ✅ Tooltip shows all 3 values:
  - New: [count]
  - Lost: [count]
  - Net: [±count]
- ✅ Tooltip values match chart visuals
- ✅ Tooltip formatted clearly
- ✅ Tooltip follows mouse as you move across dates

**Responsive Design:**

**Steps:**
1. Resize browser to mobile width (375px)
2. Check chart

**Expected Results:**
- ✅ Chart shrinks but remains readable
- ✅ Bars still distinguishable
- ✅ X-axis labels may rotate or reduce count
- ✅ Legend adapts (may move below chart)
- ✅ Tooltip still works on touch

### Test 2b: Data Accuracy

**Steps:**
1. Pick a specific date on the chart
2. Note the green bar height (e.g., 15 new backlinks)
3. Open Convex dashboard
4. Query `backlinkVelocityHistory` for that date
5. Compare `newBacklinks` value

**Expected Results:**
- ✅ Chart bar height matches database value
- ✅ All 3 metrics (new, lost, net) match database

---

## Test 3: Empty State

### Steps:
1. Test with a domain that has NO velocity data yet
2. OR truncate velocity history table for testing
3. Navigate to Backlinks tab

**Expected Results:**

**Metrics Cards:**
- ✅ All show "0" or "0.0"
- ✅ No "NaN" or errors
- ✅ Cards still render correctly

**Chart:**
- ✅ Chart shows empty state message
- ✅ Message: "No velocity data available yet" or similar
- ✅ Helpful text: "Run daily cron job to populate data"
- ✅ Icon (optional) indicating empty state
- ✅ No chart render errors

**Console Check:**
- ✅ Zero errors even with no data

---

## Test 4: Cron Job - Daily Velocity Calculation

### Test 4a: Manual Execution

**Steps:**
```bash
npx convex run scheduler:calculateDailyBacklinkVelocity
```

**Expected Results:**
- ✅ Command completes without errors
- ✅ Console output shows:
  - "Calculating backlink velocity for X domains"
  - "Backlink velocity calculation complete: X processed, 0 errors"
- ✅ Returns JSON: `{"errors": 0, "processed": X}`

**Verify Data Stored:**

**Steps:**
1. Open Convex dashboard
2. Browse `backlinkVelocityHistory` table
3. Check for new records with today's date

**Expected Results:**
- ✅ New records exist for each processed domain
- ✅ Record has fields:
  - `domainId` (valid ID)
  - `date` (YYYY-MM-DD format, today)
  - `newBacklinks` (number ≥ 0)
  - `lostBacklinks` (number ≥ 0)
  - `netChange` (new - lost, can be negative)
  - `totalBacklinks` (snapshot count)
  - `createdAt` (timestamp)
- ✅ Calculations correct: netChange = newBacklinks - lostBacklinks

### Test 4b: Multiple Executions

**Steps:**
1. Run cron job twice in succession:
```bash
npx convex run scheduler:calculateDailyBacklinkVelocity
npx convex run scheduler:calculateDailyBacklinkVelocity
```

**Expected Results:**
- ✅ Second execution doesn't create duplicate records for same date
- ✅ OR overwrites previous record (idempotent)
- ✅ No errors from duplicate constraints

### Test 4c: Error Handling

**Steps:**
1. Temporarily break something (e.g., simulate missing backlinks)
2. Run cron job

**Expected Results:**
- ✅ Cron continues processing other domains if one fails
- ✅ Error count increments: `{"errors": 1, "processed": 2}`
- ✅ Error logged to console with domain ID
- ✅ Doesn't crash entire job

---

## Test 5: Anomaly Detection

### Test 5a: Detect Spike

**Steps:**
1. Simulate a spike by manually adding velocity record with high value:
```javascript
// In Convex dashboard or mutation:
{
  domainId: "[your domain]",
  date: "2026-01-30",
  newBacklinks: 500, // Abnormally high
  lostBacklinks: 5,
  netChange: 495,
  totalBacklinks: 2000
}
```
2. Run anomaly detection query:
```bash
npx convex run backlinkVelocity:detectVelocityAnomalies '{"domainId": "..."}'
```

**Expected Results:**
- ✅ Query returns anomaly for date "2026-01-30"
- ✅ Anomaly object includes:
  - `date` (YYYY-MM-DD)
  - `type` ("spike" or "drop")
  - `severity` ("high", "medium", or "low")
  - `zScore` (number, e.g., 3.5)
  - `value` (495 in this case)

### Test 5b: Statistical Threshold

**Verify z-score calculation:**
- ✅ Spike with z-score > 2.5 marked as "high" severity
- ✅ Spike with z-score 2.0-2.5 marked as "medium"
- ✅ Normal variation (z-score < 2) NOT flagged as anomaly

### Test 5c: Anomaly UI (If Implemented)

**Steps:**
1. If AnomalyAlert component exists, check for alert display
2. Alert should show for detected anomalies

**Expected Results:**
- ✅ Alert visible with warning icon
- ✅ Shows date, type, severity, count
- ✅ Can be dismissed
- ✅ Dismissed state persists

---

## Test 6: Integration with Backlinks Tab

### Steps:
1. Navigate through entire Backlinks tab
2. Check layout and positioning

**Expected Results:**

**Layout:**
- ✅ Velocity section positioned below BacklinksHistoryChart
- ✅ Clear visual separation (heading, padding)
- ✅ Section heading: "Backlink Velocity"
- ✅ Metrics cards appear first
- ✅ Chart appears below metrics
- ✅ No layout breaks or overlaps

**Spacing:**
- ✅ Appropriate whitespace between sections
- ✅ Consistent with rest of page
- ✅ No excessive scroll required

**Responsive:**
- ✅ On mobile, metrics cards stack (2 columns or 1 column)
- ✅ Chart shrinks appropriately
- ✅ Everything remains accessible

---

## Test 7: Performance

### Test 7a: Query Performance

**Steps:**
1. Open DevTools → Network tab
2. Navigate to Backlinks tab
3. Monitor API calls for velocity data

**Expected Results:**
- ✅ `getVelocityHistory` completes < 1 second
- ✅ `getVelocityStats` (30-day) completes < 500ms
- ✅ `getVelocityStats` (7-day) completes < 300ms
- ✅ No timeout errors
- ✅ Queries run in parallel (not sequential)

### Test 7b: Chart Render Performance

**Steps:**
1. Open DevTools → Performance tab
2. Start recording
3. Navigate to Backlinks tab
4. Stop recording when chart renders

**Expected Results:**
- ✅ Chart renders within 1-2 seconds
- ✅ No frame drops during render
- ✅ No excessive re-renders
- ✅ Smooth animations (if any)

### Test 7c: Memory

**Steps:**
1. Navigate to Backlinks tab
2. Leave page open for 5 minutes
3. Check DevTools → Memory

**Expected Results:**
- ✅ No continuous memory growth
- ✅ No memory leaks from chart component
- ✅ Stable memory usage

---

## Test 8: Edge Cases

### Test 8a: Domain with Zero Backlinks

**Steps:**
1. Test with domain that has 0 backlinks

**Expected Results:**
- ✅ Metrics cards show all zeros
- ✅ Chart shows flat line at 0
- ✅ No errors or crashes

### Test 8b: All New Backlinks (No Losses)

**Steps:**
1. Test scenario where only new backlinks exist (no losses)

**Expected Results:**
- ✅ Red bars (lost) are absent or height 0
- ✅ Green bars (new) visible
- ✅ Blue line (net) matches green bars
- ✅ "Avg Lost/Day" shows "0.0"

### Test 8c: All Lost Backlinks (No Gains)

**Steps:**
1. Test scenario where only lost backlinks exist

**Expected Results:**
- ✅ Green bars (new) are absent or height 0
- ✅ Red bars (lost) visible
- ✅ Blue line (net) is negative
- ✅ "Avg New/Day" shows "0.0"
- ✅ Net Growth card is red (negative)

### Test 8d: Very Large Numbers

**Steps:**
1. Test with domain that gains/loses 1000+ backlinks/day

**Expected Results:**
- ✅ Numbers formatted with commas (e.g., "1,234")
- ✅ Chart Y-axis scales appropriately
- ✅ Bars don't overflow chart bounds
- ✅ Tooltip shows formatted numbers

---

## Final Verification Checklist

Before marking Task #4 as PASSING, verify:

**Functionality:**
- ✅ Cron job executes successfully
- ✅ Velocity data stored in database
- ✅ Metrics cards display correct averages
- ✅ Chart shows new/lost/net change
- ✅ Anomaly detection works (>2 std dev)
- ✅ All data persists correctly

**Quality:**
- ✅ Zero console errors
- ✅ Zero TypeScript errors (`npm run build`)
- ✅ Cron job handles errors gracefully
- ✅ Queries return data within performance targets
- ✅ No memory leaks

**UX:**
- ✅ Section integrates smoothly into Backlinks tab
- ✅ Loading states appear appropriately
- ✅ Empty states handled gracefully
- ✅ Chart tooltip works correctly
- ✅ Responsive on mobile, tablet, desktop
- ✅ Visual distinction between bars and line

**Performance:**
- ✅ Queries complete < 1 second
- ✅ Chart renders < 2 seconds
- ✅ No frame drops

**Data Accuracy:**
- ✅ Calculations match manual verification
- ✅ Net change = new - lost
- ✅ Averages calculated correctly
- ✅ Z-scores accurate for anomalies

---

## Known Issues to Document

**Expected Limitations:**
- Anomaly alert UI not implemented (detection works, display pending)
- Velocity sparkline in domain list not implemented
- Historical backfill not automated (only forward tracking)
- Cron schedule assumes backlink refresh runs first

**Unexpected Issues:**
- Document any bugs found
- Note reproduction steps
- Check console for errors
- Take screenshots

---

## Reporting Results

Update `tasks_progress.json`:

**If all tests pass:**
```json
{
  "id": 41,
  "name": "backlink_velocity_tracking",
  "status": "passing"
}
```

**If issues found:**
```json
{
  "id": 41,
  "name": "backlink_velocity_tracking",
  "status": "failing"
}
```

Add to `tasks_progress_verbose.txt`:
```
S00XX. Task #4 Testing Results:
- Test 1: PASSING ✅ (Metrics cards display correctly)
- Test 2: PASSING ✅ (Chart renders with bars and line)
- Test 3: PASSING ✅ (Empty state handled)
- Test 4: PASSING ✅ (Cron job executes successfully)
- Test 5: PASSING ✅ (Anomaly detection works)
- Test 6: PASSING ✅ (Integration smooth)
- Test 7: PASSING ✅ (Performance acceptable)
- Test 8: PASSING ✅ (Edge cases handled)

All success criteria met. Ready for production.
```
