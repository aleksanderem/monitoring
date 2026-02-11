# Task #2: Keyword Grouping System - Testing Instructions

## Pre-Testing Setup

**Required:**
- ✅ Dev servers running (Convex + Next.js)
- ✅ Schema deployed to Convex
- ✅ User logged in with access to at least one domain
- ✅ Domain has at least 10 keywords for testing

**Check servers:**
```bash
ps aux | grep -E "convex dev|next dev" | grep -v grep
```

**Navigate to:**
```
http://localhost:3000/domains/[domainId]
```
Replace `[domainId]` with an actual domain ID from your database.

---

## Test 1: Group Management Modal

### Steps:
1. Click on the "Monitoring" tab
2. Look for "Manage Groups" button in the toolbar (usually top-right area)
3. Click "Manage Groups" button

### Expected Results:
- ✅ Modal opens smoothly (no lag)
- ✅ Modal has backdrop (darkens background)
- ✅ Modal shows title "Manage Keyword Groups"
- ✅ If no groups exist, shows empty state with "Create your first group" message
- ✅ Form visible with fields:
  - Name input (required)
  - Description textarea (optional)
  - Color picker with 8 color options
  - "Create Group" button

### Test 1a: Create New Group

**Steps:**
1. In the modal, enter group name: "Brand Keywords"
2. Enter description: "Keywords containing our brand name"
3. Select a color (e.g., blue)
4. Click "Create Group" button

**Expected Results:**
- ✅ Button shows loading state briefly
- ✅ Success toast/notification appears: "Group created successfully"
- ✅ New group appears in the list below the form
- ✅ Group shows:
  - Name: "Brand Keywords"
  - Description: "Keywords containing our brand name"
  - Color badge matching selected color
  - Keyword count: 0 (initially)
  - Edit and Delete icons

**Failure Scenarios to Check:**
- ❌ Try creating group with empty name → Should show validation error
- ❌ Try creating group with duplicate name → Should show error
- ❌ Check browser console (F12) → Should have ZERO errors

### Test 1b: Edit Existing Group

**Steps:**
1. Click the edit icon (pencil) next to "Brand Keywords" group
2. Change name to "Brand & Product Keywords"
3. Change description to "All brand and product-related keywords"
4. Change color to green
5. Click "Save" or confirm button

**Expected Results:**
- ✅ Group updates immediately
- ✅ Success notification appears
- ✅ New name and color visible in list
- ✅ Data persists (refresh page and check)

### Test 1c: Delete Group

**Steps:**
1. Click the delete icon (trash) next to a group
2. Observe confirmation dialog

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Dialog warns: "Are you sure? This will remove X keywords from this group"
- ✅ Dialog has "Cancel" and "Delete" buttons
- ✅ Click "Cancel" → Dialog closes, group remains
- ✅ Click "Delete" → Group removed from list
- ✅ Success notification appears

**Console Check:**
- Open F12 → Console tab
- ✅ Should have ZERO errors after all operations

---

## Test 2: Assigning Keywords to Groups

### Steps:
1. Close the Group Management Modal (if still open)
2. In the KeywordMonitoringTable, find checkboxes on the left of each row
3. Select 5 keywords by checking their checkboxes
4. Look for bulk actions toolbar (appears at top when keywords selected)
5. Click "Add to Group" button in bulk actions

**Expected Results:**
- ✅ Dropdown appears showing all available groups
- ✅ Dropdown includes the "Brand Keywords" group created earlier
- ✅ Select "Brand Keywords" from dropdown
- ✅ Button shows loading state briefly
- ✅ Success notification: "5 keywords added to Brand Keywords"
- ✅ Checkboxes are cleared (selection reset)

### Test 2a: Verify Assignment Persisted

**Steps:**
1. Open "Manage Groups" modal again
2. Find "Brand Keywords" group

**Expected Results:**
- ✅ Keyword count shows "5" (or number you added)
- ✅ Refresh page (F5)
- ✅ Open modal again
- ✅ Count still shows "5" (data persisted)

### Test 2b: Remove Keywords from Group

**Steps:**
1. Select the same 5 keywords again
2. In bulk actions, click "Remove from Group"
3. Select "Brand Keywords"

**Expected Results:**
- ✅ Success notification appears
- ✅ Keywords removed from group
- ✅ Group keyword count decreases to 0

**Console Check:**
- ✅ Zero errors during bulk operations

---

## Test 3: Group Filtering

### Pre-requisite:
Ensure at least one group has keywords assigned (repeat Test 2 if needed).

### Steps:
1. In KeywordMonitoringTable toolbar, find "Group" filter dropdown
2. Click the dropdown

**Expected Results:**
- ✅ Dropdown opens
- ✅ Shows option: "All Groups"
- ✅ Shows all created groups (e.g., "Brand Keywords")
- ✅ Each group shows with its color badge

### Test 3a: Filter by Specific Group

**Steps:**
1. Select "Brand Keywords" from dropdown
2. Observe table

**Expected Results:**
- ✅ Table immediately filters to show only keywords in "Brand Keywords" group
- ✅ Row count updates (e.g., "Showing 5 of 120 keywords")
- ✅ Pagination resets to page 1
- ✅ All visible rows belong to selected group
- ✅ "Clear filter" button or similar appears

### Test 3b: Clear Filter

**Steps:**
1. Click "Clear filter" or select "All Groups" from dropdown

**Expected Results:**
- ✅ Table shows all keywords again
- ✅ Count returns to full total (e.g., "Showing 1-10 of 120")

### Test 3c: Filter with Search

**Steps:**
1. Select a group filter
2. Use the search box to search for a keyword phrase

**Expected Results:**
- ✅ Both filters apply (AND logic)
- ✅ Shows only keywords matching BOTH group AND search query
- ✅ Empty state if no matches

**Console Check:**
- ✅ Zero errors during filtering

---

## Test 4: Group Performance Chart

### Steps:
1. Scroll down to find "Group Performance" chart section
2. Observe the chart

**Expected Results:**
- ✅ Chart renders without errors
- ✅ Chart shows line(s) for each group with historical data
- ✅ Each line uses the group's custom color
- ✅ X-axis shows dates (last 30 days)
- ✅ Y-axis shows position (inverted: 1 at top, 100 at bottom)
- ✅ Legend shows group names with color indicators
- ✅ Hover tooltip works:
  - Shows date
  - Shows group name
  - Shows average position on that date

### Test 4a: Empty State

**Steps:**
1. If groups have no historical data (newly created)

**Expected Results:**
- ✅ Chart shows empty state message
- ✅ Message: "No performance data yet" or similar
- ✅ No chart render errors

### Test 4b: Legend Interaction

**Steps:**
1. If chart has multiple groups, click on a legend item

**Expected Results:**
- ✅ Clicking legend toggles that group's line visibility
- ✅ Line disappears/reappears smoothly
- ✅ Other lines remain visible

**Console Check:**
- ✅ Zero errors during chart interaction

---

## Test 5: Bulk Tagging

### Steps:
1. Select 3-5 keywords in the table
2. Click "Add Tags" button in bulk actions toolbar
3. Modal or input appears for tag entry

**Expected Results:**
- ✅ Modal/input opens
- ✅ Placeholder text explains format: "Enter tags separated by commas"
- ✅ Enter tags: "high-priority, conversion, competitor"
- ✅ Click "Apply" or "Add Tags"
- ✅ Success notification: "Tags added to 5 keywords"

### Test 5a: Verify Tags (Future Enhancement)

**Note:** Tag display on keyword rows may not be implemented yet. Check:
- ✅ Tags are saved to database (can verify in Convex dashboard)
- ✅ No errors in console

---

## Test 6: Responsive Design

### Steps:
1. Resize browser window to mobile size (375px width)
2. Test all features again

**Expected Results:**
- ✅ Modal is still usable (not cut off)
- ✅ Group Management Modal scrolls if content too tall
- ✅ Table remains functional (may have horizontal scroll)
- ✅ Bulk actions toolbar adapts to mobile
- ✅ Chart remains visible and functional

---

## Test 7: Performance & Data Persistence

### Performance Test:
**Steps:**
1. Open DevTools → Network tab
2. Open "Manage Groups" modal
3. Create a new group
4. Observe network requests

**Expected Results:**
- ✅ Mutation completes in < 1 second
- ✅ Only necessary requests made (no redundant fetches)
- ✅ Response status: 200 OK

### Persistence Test:
**Steps:**
1. Create a group, assign keywords, apply filters
2. Refresh page (F5)
3. Check if state is preserved

**Expected Results:**
- ✅ Groups still exist
- ✅ Keyword assignments still exist
- ✅ Filter state may reset (expected)
- ✅ All data intact after refresh

---

## Final Verification Checklist

Before marking Task #2 as PASSING, verify:

**Functionality:**
- ✅ Can create groups with all fields
- ✅ Can edit groups (name, description, color)
- ✅ Can delete groups with confirmation
- ✅ Can assign keywords to groups (bulk)
- ✅ Can remove keywords from groups
- ✅ Can filter table by group
- ✅ Can add tags to keywords (bulk)
- ✅ Group performance chart renders

**Quality:**
- ✅ Zero console errors throughout all tests
- ✅ Zero TypeScript compilation errors (`npm run build`)
- ✅ All mutations complete successfully
- ✅ All data persists after page refresh
- ✅ Loading states appear appropriately
- ✅ Success notifications appear for all actions
- ✅ Error handling works (try edge cases)

**UX:**
- ✅ Modals open/close smoothly
- ✅ Buttons respond immediately
- ✅ No layout breaks at any screen size
- ✅ Tooltips work on charts
- ✅ Hover states work on interactive elements

**Performance:**
- ✅ Modal opens < 200ms
- ✅ Mutations complete < 1s
- ✅ Chart renders < 2s
- ✅ Filter applies < 200ms

---

## Known Issues to Document

If any of the following don't work, document them but they're not blockers:

**Expected Limitations:**
- Tag badges not shown on keyword rows yet (structure ready, UI pending)
- Inline tag editing not implemented (bulk only works)
- Multi-group filtering not supported (single group only)
- Group performance chart uses fixed 30-day range (will integrate with Task #3)

**Unexpected Issues:**
- Document any bugs found during testing
- Note reproduction steps
- Check browser console for error messages
- Take screenshots if UI issues

---

## Reporting Results

After testing, update `tasks_progress.json`:

**If all tests pass:**
```json
{
  "id": 39,
  "name": "keyword_grouping_system",
  "status": "passing",
  "last_updated_session": "S00XX"
}
```

**If issues found:**
```json
{
  "id": 39,
  "name": "keyword_grouping_system",
  "status": "failing",
  "last_updated_session": "S00XX"
}
```

Add notes to `tasks_progress_verbose.txt`:
```
S00XX. Task #2 Testing Results:
- Test 1: PASSING ✅
- Test 2: PASSING ✅
- Test 3: FAILING ❌ - Group filter dropdown not showing groups
- Test 4: PASSING ✅
- Test 5: PASSING ✅
- Test 6: PASSING ✅
- Test 7: PASSING ✅

Issues found:
1. Group filter dropdown empty - needs investigation
2. Console error: "Cannot read property 'map' of undefined" in GroupFilter component

Recommendation: Fix dropdown data fetching before marking as complete.
```
