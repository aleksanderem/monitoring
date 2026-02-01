# Task #5: Competitor Tracking - Testing Guide

## Backend Testing

### Phase 1: Schema Deployment
```bash
# Deploy schema changes
npx convex dev

# Verify tables created
npx convex function-spec | grep competitors

# Expected output:
# - competitors table
# - competitorKeywordPositions table
```

### Phase 2: Test Mutations

```bash
# Test 1: Add a competitor
npx convex run competitors_mutations:addCompetitor '{
  "domainId": "<your-domain-id>",
  "competitorDomain": "example.com",
  "name": "Example Competitor"
}'

# Expected: Returns competitor ID
# Should fail with: "This competitor is already being tracked" if duplicate
# Should fail with: "Cannot add your own domain as a competitor" if same domain

# Test 2: Get competitors list
npx convex run competitors_queries:getCompetitorsByDomain '{
  "domainId": "<your-domain-id>"
}'

# Expected: Returns array with the competitor just added

# Test 3: Pause competitor
npx convex run competitors_mutations:pauseCompetitor '{
  "competitorId": "<competitor-id>"
}'

# Expected: {success: true}

# Test 4: Resume competitor
npx convex run competitors_mutations:resumeCompetitor '{
  "competitorId": "<competitor-id>"
}'

# Expected: {success: true}

# Test 5: Update competitor
npx convex run competitors_mutations:updateCompetitor '{
  "competitorId": "<competitor-id>",
  "name": "Updated Competitor Name"
}'

# Expected: {success: true}
```

### Phase 3: Test Position Checking

```bash
# Test manual position check for a competitor
npx convex run competitors_actions:checkCompetitorPositions '{
  "competitorId": "<competitor-id>",
  "batchSize": 5,
  "delayMs": 500
}'

# Expected output:
# {
#   "success": true,
#   "message": "Processed X of Y keywords",
#   "processedCount": X,
#   "errorCount": 0,
#   "totalKeywords": Y,
#   "errors": []
# }

# Check if positions were stored
npx convex run competitors_queries:getCompetitorPositions '{
  "competitorId": "<competitor-id>",
  "keywordId": "<keyword-id>",
  "days": 7
}'

# Expected: Returns array of positions with dates
```

### Phase 4: Test Queries

```bash
# Test competitor overview
npx convex run competitors_queries:getCompetitorOverview '{
  "domainId": "<domain-id>",
  "days": 30
}'

# Expected: Returns your domain positions + competitor positions over time

# Test keyword gaps
npx convex run competitors_queries:getKeywordGaps '{
  "domainId": "<domain-id>",
  "competitorId": "<competitor-id>",
  "minGapScore": 50
}'

# Expected: Returns array of gap opportunities sorted by score

# Test competitor stats
npx convex run competitors_queries:getCompetitorStats '{
  "domainId": "<domain-id>"
}'

# Expected:
# {
#   "totalCompetitors": 1,
#   "activeCompetitors": 1,
#   "pausedCompetitors": 0,
#   "totalKeywords": X,
#   "totalGaps": Y,
#   "highPriorityGaps": Z
# }
```

### Phase 5: Test Deletion

```bash
# Test remove competitor (deletes competitor and all positions)
npx convex run competitors_mutations:removeCompetitor '{
  "competitorId": "<competitor-id>"
}'

# Expected: {success: true, deletedPositions: X}

# Verify competitor deleted
npx convex run competitors_queries:getCompetitorsByDomain '{
  "domainId": "<domain-id>"
}'

# Expected: Empty array or array without the deleted competitor
```

## Frontend Testing

### Test 1: Competitor Management (Settings Page)
1. Navigate to `/domains/[domainId]/settings`
2. Scroll to "Competitors" section
3. Click "Add Competitor" button
4. Modal should open

**Success Criteria:**
- ✅ Modal opens smoothly
- ✅ Form has domain input and optional name field
- ✅ Domain input validates format
- ✅ Can submit form
- ✅ Success message appears
- ✅ Competitor appears in list immediately
- ✅ No console errors

**Test Cases:**
- Add valid competitor: "competitor.com"
- Try to add duplicate: Should show error
- Try to add own domain: Should show error
- Try to add invalid domain: "not a domain" - Should show validation error

### Test 2: Competitor List Display
**Success Criteria:**
- ✅ Shows all competitors for domain
- ✅ Each competitor row shows:
  - Name/Domain
  - Status badge (Active/Paused)
  - Last checked timestamp
  - Action buttons (Edit/Pause/Resume/Delete)
- ✅ Status badges have correct colors (green for active, gray for paused)
- ✅ Timestamps formatted correctly

### Test 3: Edit Competitor
1. Click edit icon on competitor row
2. Modal/inline edit should open
3. Change name
4. Save

**Success Criteria:**
- ✅ Edit UI appears
- ✅ Name field pre-filled with current name
- ✅ Can update name
- ✅ Changes save immediately
- ✅ UI updates without page refresh

### Test 4: Pause/Resume Competitor
1. Click pause button on active competitor
2. Status should change to "Paused"
3. Click resume button
4. Status should change back to "Active"

**Success Criteria:**
- ✅ Pause action works
- ✅ Resume action works
- ✅ Status badge updates immediately
- ✅ No page refresh needed
- ✅ Last checked timestamp preserved

### Test 5: Delete Competitor
1. Click delete button
2. Confirmation dialog should appear
3. Confirm deletion

**Success Criteria:**
- ✅ Confirmation dialog shows
- ✅ Dialog warns about data deletion
- ✅ Delete action removes competitor from list
- ✅ Competitor disappears immediately
- ✅ No console errors

### Test 6: Manual Position Check
1. Find "Check Positions" button on competitor row
2. Click button
3. Loading indicator should appear

**Success Criteria:**
- ✅ Button shows loading state
- ✅ Button disabled during check
- ✅ Success message when complete
- ✅ Last checked timestamp updates
- ✅ Position data appears in charts/tables

### Test 7: Competitor Overview Chart
1. Navigate to `/domains/[domainId]/competitors`
2. CompetitorOverviewChart should render

**Success Criteria:**
- ✅ Chart renders within 3 seconds
- ✅ Your domain line is bold/distinctive
- ✅ Each competitor has different colored line
- ✅ Lines don't overlap unreadably (use transparency)
- ✅ X-axis shows dates
- ✅ Y-axis shows positions (inverted, 1 at top)
- ✅ Legend shows all domains with colors
- ✅ Click legend toggles line visibility
- ✅ Hover tooltip shows all domains' positions for that date
- ✅ Empty state if no competitor data
- ✅ Loading skeleton during data fetch
- ✅ No console errors
- ✅ Responsive on mobile/desktop

**Test Data Scenarios:**
- 0 competitors: Shows empty state
- 1 competitor: Shows 2 lines (yours + competitor)
- 5 competitors: Shows 6 lines (readable)
- 10+ competitors: Consider adding competitor selector

### Test 8: Keyword Gap Table
1. Scroll to CompetitorKeywordGapTable
2. Should show gap opportunities

**Success Criteria:**
- ✅ Table renders within 2 seconds
- ✅ Columns display correctly:
  - Keyword
  - Competitor Position
  - Your Position (or "Not Ranking")
  - Search Volume
  - Difficulty
  - Gap Score
- ✅ Sorted by gap score descending (best first)
- ✅ Gap score calculation correct
- ✅ Color coding by score:
  - High (70-100): Green
  - Medium (40-69): Yellow
  - Low (0-39): Gray
- ✅ Search box filters keywords
- ✅ All columns sortable
- ✅ Pagination works (25 per page)
- ✅ Total count shown
- ✅ Empty state if no gaps

### Test 9: Gap Table Filters
1. Test competitor selector dropdown
2. Test position range filter
3. Test volume range filter
4. Test difficulty filter

**Success Criteria:**
- ✅ Competitor selector shows all competitors
- ✅ Selecting competitor filters to that competitor's gaps
- ✅ Position filter works (e.g., "Competitor ranks 1-10")
- ✅ Volume filter works (e.g., "Volume > 1000")
- ✅ Difficulty filter works (e.g., "Difficulty < 50")
- ✅ Multiple filters work together (AND logic)
- ✅ Clear filters button resets all
- ✅ URL updates with filter params
- ✅ Back button preserves filters

### Test 10: Bulk Actions
1. Select multiple keywords from gap table
2. Test "Add to Monitoring" action
3. Test "Export List" action

**Success Criteria:**
- ✅ Can select multiple keywords via checkboxes
- ✅ Bulk action toolbar appears when >0 selected
- ✅ "Add to Monitoring" button enabled
- ✅ Click adds keywords to active monitoring
- ✅ Success message shows count
- ✅ Keywords appear in Monitoring tab
- ✅ Export button downloads CSV
- ✅ CSV includes all selected keywords with gap data
- ✅ CSV filename includes domain and date

### Test 11: Competitors Tab Layout
1. Navigate to `/domains/[domainId]/competitors`
2. Check overall page layout

**Success Criteria:**
- ✅ Tab navigation works (shows "Competitors" tab)
- ✅ Summary cards at top:
  - Total Competitors
  - Active Competitors
  - Total Gaps
  - High Priority Gaps
- ✅ Cards show correct counts
- ✅ CompetitorOverviewChart section
- ✅ CompetitorKeywordGapTable section
- ✅ Quick actions toolbar (Add Competitor, Refresh Data)
- ✅ Responsive layout (stacks on mobile)
- ✅ No layout shifts during load
- ✅ Loading skeletons for all sections

## Integration Testing

### Test 1: End-to-End Workflow
1. Add a competitor
2. Manually check positions
3. View overview chart
4. Find gaps in gap table
5. Add gap keyword to monitoring
6. Verify keyword appears in monitoring

**Success Criteria:**
- ✅ All steps complete without errors
- ✅ Data flows correctly through all components
- ✅ No data loss
- ✅ No console errors at any step

### Test 2: Multi-Competitor Scenario
1. Add 3-5 competitors
2. Check positions for all
3. View overview chart (should show all lines)
4. View gap table (should show gaps from all competitors)
5. Filter by specific competitor

**Success Criteria:**
- ✅ Chart handles multiple competitors well
- ✅ Lines distinguishable by color
- ✅ Gap table shows gaps from all competitors
- ✅ Filtering works correctly
- ✅ Performance remains good

### Test 3: No Data Scenarios
1. View competitors tab with 0 competitors
2. View overview chart with competitor but no position data
3. View gap table with no gaps

**Success Criteria:**
- ✅ Empty states show helpful messages
- ✅ No crashes or errors
- ✅ Clear call-to-action (e.g., "Add your first competitor")

## Performance Testing

### Test 1: Large Dataset
- Add competitor with 100+ keywords
- Check positions
- View overview chart
- View gap table

**Success Criteria:**
- ✅ Position check completes in <5 minutes
- ✅ Chart renders in <5 seconds
- ✅ Table renders in <3 seconds
- ✅ No browser freezing
- ✅ No memory leaks

### Test 2: API Rate Limiting
- Trigger position check with large batch size
- Monitor network requests

**Success Criteria:**
- ✅ Batch processing works (delays between batches)
- ✅ No 429 rate limit errors
- ✅ Error handling if rate limited
- ✅ Retry logic (if implemented)

## Edge Cases

### Test 1: Competitor With No Rankings
- Add competitor that doesn't rank for any keywords
- Check positions

**Success Criteria:**
- ✅ Position check completes without errors
- ✅ All positions stored as null
- ✅ Overview chart shows no line for competitor (or flat at bottom)
- ✅ Gap table empty or shows "No opportunities"

### Test 2: Competitor Ranks Better For All Keywords
- Add competitor that dominates all keywords
- Check positions
- View gap table

**Success Criteria:**
- ✅ Gap table shows all keywords as gaps
- ✅ Gap scores calculated correctly
- ✅ No crashes

### Test 3: Special Characters in Competitor Domain
- Try to add competitor with special characters
- Try to add competitor with spaces

**Success Criteria:**
- ✅ Validation prevents invalid domains
- ✅ Error messages clear
- ✅ Valid internationalized domains accepted (e.g., "café.com")

### Test 4: Delete Competitor With Historical Data
- Add competitor
- Check positions multiple times (build history)
- Delete competitor

**Success Criteria:**
- ✅ Confirmation dialog warns about data loss
- ✅ All competitor positions deleted
- ✅ No orphaned data
- ✅ Deletion completes in reasonable time

### Test 5: Concurrent Position Checks
- Have multiple competitors
- Trigger position check for all at once

**Success Criteria:**
- ✅ Checks run sequentially or with proper rate limiting
- ✅ No race conditions
- ✅ All checks complete successfully
- ✅ No data corruption

## Browser Compatibility

### Test in Multiple Browsers
- Chrome (primary)
- Safari
- Firefox (if required)
- Edge (if required)

**Success Criteria:**
- ✅ All features work in all browsers
- ✅ Charts render correctly
- ✅ No layout issues
- ✅ No JavaScript errors

## Accessibility

### Test Keyboard Navigation
- Navigate entire competitor flow using only keyboard
- Tab through all interactive elements

**Success Criteria:**
- ✅ Can add competitor with keyboard only
- ✅ Can edit/delete with keyboard
- ✅ Focus visible on all elements
- ✅ Logical tab order

### Test Screen Reader
- Use VoiceOver (Mac) or NVDA (Windows)
- Navigate competitor management

**Success Criteria:**
- ✅ All buttons have labels
- ✅ Form inputs have labels
- ✅ Tables have headers
- ✅ Status communicated (loading, success, error)

## Regression Testing

### Verify Existing Features Still Work
- Keyword monitoring table
- Position checking for your domain
- Other tabs (Backlinks, Visibility, etc.)

**Success Criteria:**
- ✅ No regressions in existing functionality
- ✅ No console errors on other pages
- ✅ Performance remains good

## Sign-Off Checklist

Before marking task as PASSING:
- ✅ All backend tests pass
- ✅ All frontend components render correctly
- ✅ All user workflows complete successfully
- ✅ Zero console errors
- ✅ Zero TypeScript compilation errors
- ✅ Zero network errors (except expected)
- ✅ Data persists correctly
- ✅ Performance acceptable
- ✅ Responsive on mobile and desktop
- ✅ At least 5 edge cases tested
- ✅ Documentation complete (REQUIREMENTS.md, TESTING.md)
- ✅ Code committed with descriptive message

## Known Issues (Document Here)
- None yet

## Future Improvements (Out of Scope)
- Competitor SERP features tracking
- Competitor backlink monitoring
- Automated alerts when competitor gains/loses position
- Historical competitor comparison
