# Task #3: Enhanced Date Range Picker - Testing Instructions

## Pre-Testing Setup

**Required:**
- ✅ Dev servers running (Convex + Next.js)
- ✅ `@radix-ui/react-popover` package installed
- ✅ User logged in with access to at least one domain
- ✅ Domain has historical data (keywords, backlinks over time)

**Check installation:**
```bash
npm list @radix-ui/react-popover
# Should show: @radix-ui/react-popover@1.x.x
```

**Navigate to:**
```
http://localhost:3000/domains/[domainId]
```

---

## Test 1: DateRangePicker Component - Backlinks Tab

### Steps:
1. Click on the "Backlinks" tab
2. Look for the date range picker button (should have calendar icon)
3. Button should show current selection (e.g., "Last 30 days")

**Expected Results:**
- ✅ Date range button is visible (top-right area near chart)
- ✅ Button has calendar icon
- ✅ Button label shows current range
- ✅ Button has hover state (changes color on hover)

### Test 1a: Open Popover

**Steps:**
1. Click the date range picker button

**Expected Results:**
- ✅ Popover opens smoothly
- ✅ Popover positioned correctly (below button, not cut off)
- ✅ Popover has backdrop (darker background)
- ✅ Popover shows preset buttons in grid layout:
  - Last 7 days
  - Last 30 days
  - Last 3 months
  - Last 6 months
  - Last 1 year
  - All time
- ✅ Currently selected preset is highlighted/active
- ✅ "Compare" toggle visible at bottom
- ✅ Close button (X) visible

**Failure Checks:**
- ❌ Console errors? (F12 → Console)
- ❌ Popover cut off screen?
- ❌ Preset buttons overlapping or misaligned?

### Test 1b: Select Preset Ranges

**For each preset (7d, 30d, 3M, 6M, 1Y, All):**

**Steps:**
1. Click "Last 7 days" preset

**Expected Results:**
- ✅ Popover closes immediately
- ✅ Button label updates to "Last 7 days"
- ✅ Chart shows loading state briefly
- ✅ Chart re-renders with new data
- ✅ X-axis shows correct date range (last 7 days)
- ✅ Data points match the selected range

**Repeat for each preset:**
2. Open popover again
3. Click "Last 30 days" → Verify chart updates
4. Click "Last 3 months" → Verify chart updates
5. Click "Last 6 months" → Verify chart updates
6. Click "Last 1 year" → Verify chart updates
7. Click "All time" → Verify chart shows all available data

**Verification:**
- ✅ Each preset triggers chart update
- ✅ Chart data matches selected range
- ✅ No errors in console for any preset
- ✅ Chart doesn't flash or flicker during transition

---

## Test 2: Comparison Mode - Backlinks Tab

### Test 2a: Enable Comparison

**Steps:**
1. Open date range picker popover
2. Select "Last 30 days" preset (if not already selected)
3. Find "Compare" toggle at bottom of popover
4. Click toggle to enable comparison mode

**Expected Results:**
- ✅ Toggle switches to "on" state
- ✅ Comparison period info appears below toggle
- ✅ Info text shows: "Comparing with: [previous 30 days date range]"
- ✅ Info clearly states the comparison period dates

### Test 2b: Chart Updates with Comparison

**Steps:**
1. Click outside popover to close (or it closes automatically)
2. Observe the BacklinksHistoryChart

**Expected Results:**
- ✅ Chart now shows TWO data series:
  - **Current period**: Solid blue line with blue gradient fill
  - **Comparison period**: Dashed gray line with gray gradient fill
- ✅ Legend shows both periods clearly labeled:
  - "Total Backlinks" (current)
  - "Comparison Period" (previous)
- ✅ Both lines are clearly distinguishable (different styles, colors)
- ✅ Lines don't overlap confusingly

### Test 2c: Tooltip with Comparison

**Steps:**
1. Hover over the chart where both periods have data

**Expected Results:**
- ✅ Tooltip appears
- ✅ Tooltip shows BOTH values:
  - Current period date and value
  - Comparison period date and value (if applicable)
- ✅ Tooltip clearly labels which is which
- ✅ Tooltip positioned correctly (not cut off)

**Example tooltip:**
```
Jan 15, 2026
Total Backlinks: 1,649
Comparison: 1,598 (Jan 15, 2025)
```

### Test 2d: Disable Comparison

**Steps:**
1. Open date range picker again
2. Click "Compare" toggle to disable

**Expected Results:**
- ✅ Comparison line disappears from chart
- ✅ Chart returns to single data series
- ✅ Legend updates (removes comparison entry)
- ✅ Smooth transition (no flicker)

**Console Check:**
- ✅ Zero errors during comparison mode toggle

---

## Test 3: Different Presets with Comparison

### Steps:
1. Enable comparison mode
2. Test each preset with comparison:
   - Last 7 days (compare with previous 7 days)
   - Last 30 days (compare with previous 30 days)
   - Last 3 months (compare with previous 3 months)
   - Last 6 months (compare with previous 6 months)
   - Last 1 year (compare with previous 1 year)

**For each preset:**

**Expected Results:**
- ✅ Comparison period auto-calculates correctly
  - Example: "Last 30 days" compares with "Previous 30 days"
- ✅ Info text shows correct comparison dates
- ✅ Chart shows both periods
- ✅ Data makes sense (comparison period is older dates)
- ✅ Both lines render without errors

**Verification:**
- ✅ Comparison period dates are contiguous (no gap between periods)
- ✅ Both periods have same duration
- ✅ Older period shown as comparison

---

## Test 4: Position History Chart Integration

### Steps:
1. Navigate to "Overview" or "Monitoring" tab (wherever PositionHistoryChart is located)
2. Find the Position History chart
3. Look for date range picker button

**Expected Results:**
- ✅ Date range picker button present on Position History chart
- ✅ Button works same as Backlinks chart
- ✅ Popover opens with same presets
- ✅ Selecting preset updates Position History chart
- ✅ Chart data matches selected date range

### Test 4a: Comparison Mode on Position History

**Steps:**
1. Enable comparison mode on Position History chart

**Expected Results:**
- ✅ Chart shows two data series (current vs comparison)
- ✅ Visual distinction clear (solid vs dashed, different colors)
- ✅ Tooltip shows both periods
- ✅ Legend labels both periods
- ✅ Y-axis still inverted (position 1 at top)

**Note:** Position charts should invert Y-axis (lower position = higher on chart) for both periods.

**Console Check:**
- ✅ Zero errors on Position History chart

---

## Test 5: Responsive Design

### Test 5a: Desktop (1920px)

**Steps:**
1. Set browser width to 1920px
2. Test date range picker

**Expected Results:**
- ✅ Popover not cut off
- ✅ Chart fully visible
- ✅ Button positioned correctly
- ✅ All interactions work

### Test 5b: Tablet (768px)

**Steps:**
1. Resize browser to 768px width
2. Test date range picker

**Expected Results:**
- ✅ Popover adapts to smaller screen
- ✅ Preset buttons still in grid (may stack)
- ✅ Chart remains readable
- ✅ No horizontal scroll issues

### Test 5c: Mobile (375px)

**Steps:**
1. Resize browser to 375px width (iPhone size)
2. Test date range picker

**Expected Results:**
- ✅ Popover width adapts to screen
- ✅ Preset buttons stack vertically or smaller grid
- ✅ Toggle still accessible
- ✅ Chart shrinks but remains functional
- ✅ Tooltip still works on touch

---

## Test 6: Edge Cases

### Test 6a: All Time with Limited Data

**Steps:**
1. Select "All time" preset
2. Observe chart

**Expected Results:**
- ✅ If domain has data for only 30 days, chart shows 30 days
- ✅ No errors when data range is shorter than preset
- ✅ Chart handles gracefully

### Test 6b: Comparison with Insufficient Data

**Steps:**
1. Select "Last 1 year" with comparison
2. If domain doesn't have 2 years of data

**Expected Results:**
- ✅ Current period shows available data
- ✅ Comparison period shows partial data or empty
- ✅ No crashes or errors
- ✅ Message if comparison data unavailable (optional)

### Test 6c: Rapid Preset Changes

**Steps:**
1. Rapidly click different presets (7d → 30d → 3M → 6M → 1Y)
2. Don't wait for chart to fully render between clicks

**Expected Results:**
- ✅ Chart handles rapid changes gracefully
- ✅ Latest selection wins (no race conditions)
- ✅ No errors or crashes
- ✅ Chart eventually settles on last selection

### Test 6d: Network Errors

**Steps:**
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Change date preset

**Expected Results:**
- ✅ Loading state persists (shows loading skeleton)
- ✅ Error message appears (network error or similar)
- ✅ Chart doesn't crash
- ✅ Can retry when back online

---

## Test 7: Performance

### Test 7a: Initial Load

**Steps:**
1. Clear cache and reload page
2. Measure time to first chart render

**Expected Results:**
- ✅ Chart renders within 2-3 seconds
- ✅ Loading skeleton appears immediately
- ✅ No flash of unstyled content

### Test 7b: Date Range Change Performance

**Steps:**
1. Open DevTools → Performance tab
2. Start recording
3. Change date preset
4. Stop recording when chart renders

**Expected Results:**
- ✅ State change: < 50ms
- ✅ Query execution: < 1 second
- ✅ Chart re-render: < 500ms
- ✅ Total time: < 2 seconds

### Test 7c: Memory Usage

**Steps:**
1. Open DevTools → Memory tab
2. Take heap snapshot
3. Change presets 20 times
4. Take another heap snapshot
5. Compare

**Expected Results:**
- ✅ Memory increase < 10MB
- ✅ No significant memory leaks
- ✅ Garbage collection working

---

## Test 8: Data Accuracy

### Test 8a: Verify Date Ranges

**Steps:**
1. Select "Last 7 days"
2. Check X-axis dates on chart
3. Manually count dates

**Expected Results:**
- ✅ X-axis shows exactly 7 days of data
- ✅ Latest date is today or yesterday
- ✅ Dates are contiguous (no gaps)

### Test 8b: Verify Comparison Dates

**Steps:**
1. Select "Last 30 days" with comparison
2. Note the current period dates (e.g., Jan 1-30)
3. Check comparison period

**Expected Results:**
- ✅ Comparison period is previous 30 days (e.g., Dec 2-31)
- ✅ No overlap between periods
- ✅ No gap between periods
- ✅ Both periods same duration

### Test 8c: Compare with Backend Data

**Steps:**
1. Open Convex dashboard
2. Check raw data for domain
3. Compare with chart display

**Expected Results:**
- ✅ Chart data matches database
- ✅ Date filtering works correctly
- ✅ No data missing or duplicated

---

## Final Verification Checklist

Before marking Task #3 as PASSING, verify:

**Functionality:**
- ✅ All 6 presets work (7d, 30d, 3M, 6M, 1Y, All)
- ✅ Charts update when preset selected
- ✅ Comparison mode toggles on/off
- ✅ Comparison shows two distinct data series
- ✅ Tooltip shows both periods in comparison mode
- ✅ Works on BacklinksHistoryChart
- ✅ Works on PositionHistoryChart

**Quality:**
- ✅ Zero console errors
- ✅ Zero TypeScript errors (`npm run build`)
- ✅ All chart queries return correct data
- ✅ Date calculations accurate
- ✅ No memory leaks

**UX:**
- ✅ Popover opens/closes smoothly
- ✅ Button label updates to reflect selection
- ✅ Loading states appear appropriately
- ✅ Comparison periods clearly distinguished
- ✅ Works on mobile, tablet, desktop

**Performance:**
- ✅ Popover opens < 100ms
- ✅ Chart updates < 2 seconds
- ✅ No frame drops during transitions

---

## Known Issues to Document

**Expected Limitations:**
- Full calendar picker not implemented (presets only)
- URL synchronization not implemented
- Not integrated with MovementTrendChart yet
- Custom comparison range not available

**Unexpected Issues:**
- Document any bugs found
- Note reproduction steps
- Check console for error messages
- Take screenshots

---

## Reporting Results

Update `tasks_progress.json`:

**If all tests pass:**
```json
{
  "id": 40,
  "name": "enhanced_date_range_picker",
  "status": "passing"
}
```

**If issues found:**
```json
{
  "id": 40,
  "name": "enhanced_date_range_picker",
  "status": "failing"
}
```

Add to `tasks_progress_verbose.txt`:
```
S00XX. Task #3 Testing Results:
- Test 1: PASSING ✅ (Popover and presets work)
- Test 2: PASSING ✅ (Comparison mode functional)
- Test 3: PASSING ✅ (All presets with comparison)
- Test 4: PASSING ✅ (Position History integration)
- Test 5: PASSING ✅ (Responsive on all sizes)
- Test 6: PASSING ✅ (Edge cases handled)
- Test 7: PASSING ✅ (Performance acceptable)
- Test 8: PASSING ✅ (Data accuracy verified)

All success criteria met. Ready for production.
```
