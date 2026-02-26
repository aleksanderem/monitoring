# Browser-Tested UX Audit Report

Date: 2026-02-26
Session: S0123
Method: Real browser walkthrough (Chromium via preview tools)
Login: aleksander@kolaboit.pl
Device tested: Desktop (1280x800) + Mobile (375x812)

---

## Executive Summary

Full browser walkthrough from login through every page, tab, modal, and interactive element. Found 26 bugs across 6 categories. 3 are CRITICAL (data/cost impact), 4 are HIGH (broken functionality), the rest are MEDIUM/LOW polish issues.

---

## CRITICAL Bugs (3)

### BUG #7 — Header "Refresh Rankings" skips confirmation, refreshes ALL org keywords
- Location: Domain detail page header, refresh button
- Expected: Opens RefreshConfirmModal for this domain's keywords only
- Actual: Triggers immediately with NO confirmation dialog. Refreshes ALL 486 keywords across ALL domains instead of just this domain's 26 keywords.
- Impact: One accidental click burns the entire daily API credit limit. Notification confirmed "Checked 486 keywords, 426 failed" (87% failure rate).
- Severity: CRITICAL — financial impact (wasted API credits) + no undo

### BUG #9 / #14 — Statistics show org-wide data instead of domain-specific
- Location: Monitoring tab — Statistics cards + "Keyword Monitoring" subtitle
- Expected: "Total Monitored: 26" (this domain's keywords), domain-specific average position
- Actual: Shows "Total Monitored: 486" (all org keywords), "100 keywords being actively monitored", cross-domain average position 36.6
- Impact: Users see misleading metrics — every domain appears to have the same keyword count and average position
- Severity: CRITICAL — incorrect data displayed to users

### BUG #24 — Domain detail page unusable on mobile
- Location: Domain detail page at 375px viewport
- Issues:
  - Domain name truncated ("detoksv...")
  - Header action buttons (Share, Report, Refresh, Edit, Delete) completely hidden
  - 17 vertical tab list consumes entire screen — no content visible without scrolling past all tabs
  - Large blank teal area on left side — wasted space
  - Tab names like "Keyword Analysis" truncated at edge
- Impact: Mobile users cannot access any domain management features
- Severity: CRITICAL — entire feature set broken on mobile

---

## HIGH Bugs (4)

### BUG #11 — Edit Domain: Search Engine/Location/Language fields are editable
- Location: Edit Domain Settings modal (header Edit button)
- Expected: Search engine, location, and language should be read-only after creation (changing them invalidates all historical position data)
- Actual: All three fields are fully editable (`disabled: false, readOnly: false`)
- Impact: Users could accidentally change "google.pl" to something else, breaking all position tracking

### BUG #21 — Mobile header shows "Untitled UI" instead of app branding
- Location: Mobile viewport (375px) — top-left header
- Expected: "doseo" brand name and logo
- Actual: Shows "Untitled UI" with generic purple icon (the UI framework's default branding)
- Impact: Brand identity completely lost on mobile — looks like an unfinished template

### BUG #25 — Add Domain modal buttons clipped off-screen
- Location: "Add Domain" modal on domains page
- Expected: Cancel and "Add domain" buttons visible at modal bottom
- Actual: Modal height (837px) exceeds viewport (675px). Bottom action buttons are 194px below viewport with no way to scroll to them.
- Impact: Users cannot submit the Add Domain form — the button is unreachable

### BUG #20 — Settings "Limits" tab doesn't load its content
- Location: Settings page → Limits tab in left sidebar
- Expected: Shows limit configuration/usage data
- Actual: Clicking "Limits" doesn't switch content — continues showing Security tab content (Password + 2FA)
- Impact: Users cannot view or manage their usage limits through settings

---

## MEDIUM Bugs (8)

### BUG #3 — Domain count badge doesn't update with filters
- Location: Domains list page, "12 domains" badge
- When search filters to 2 results, badge still shows "12 domains"

### BUG #4 — Edit button on domains list shows "coming soon" toast
- Location: Domains list, row action edit button
- Visible, clickable button that only shows "Edit dialog coming soon" toast — should be hidden or disabled

### BUG #6 — No bulk action bar visible on domains list
- Location: Domains list, checkbox selection
- Selecting domain checkboxes shows visual selection but no bulk action bar appears (unlike the keyword table which has one)

### BUG #10 — "Custom" report type in Generate Report modal doesn't work
- Location: Generate SEO Report modal → Custom card
- Clicking "Custom" doesn't reveal section selection UI. Card text promises "Choose sections, sub-elements, and order" but nothing happens.

### BUG #16 — Calendar page hardcoded in Polish
- Location: /calendar page
- Calendar UI shows Polish text ("Inteligentny kalendarz SEO", "luty 2026", "Generuj plan", "Spadki pozycji") while rest of app is English
- Not following the app's locale settings

### BUG #17 — Keyword limit exceeded with no enforcement
- Location: Limits sidebar widget
- kolaboit.pl shows 153/100 keywords — 53% over limit with red progress bar
- System allows adding keywords beyond the plan limit without blocking or warning

### BUG #18 — Mixed Polish/English on Plan & Usage page
- Location: Settings → Plan & Usage
- Polish: "Trial kończy się za: 0 dni", "Cykl: Miesięczny", "Aktualny plan", "Zarządzaj subskrypcją"
- English: "Plan & Usage", header, description
- Inconsistent language mixing within same page

### BUG #22 — "12 domains" badge clipped on mobile
- Location: Domains list, mobile viewport
- Badge text "12 do..." truncated — should abbreviate or wrap properly

---

## LOW Bugs (5)

### BUG #5 — Toast persists too long
- Location: Domain list, after clicking Edit button
- "Edit dialog coming soon" toast lingers for many seconds

### BUG #12 — Position #1 missing from SERP Competitors
- Location: Keyword detail modal → SERP Competitors (Top 20)
- List starts at position #2 — position #1 competitor is absent

### BUG #13 — Keyword bulk action bar scrolls out of view
- Location: Monitoring tab keyword table, after selecting rows
- The "3 selected | Refresh selected | Fetch SERP..." bar exists but scrolls with the page. When table is scrolled into view, the bar may be above the viewport.
- Should use sticky positioning relative to table

### BUG #19 — Duplicate display names in Members list
- Location: Settings → Members
- Both members display "Alex" — users must read email to distinguish them

### BUG #23 — Description text wraps awkwardly on mobile
- Location: Domains page, mobile viewport
- "Manage domains and track their keyword rankings." renders one word per line due to icon+text layout

### BUG #26 — 87% keyword check failure rate
- Location: Notifications panel
- "Checked 486 keywords, 426 failed" — possibly related to BUG #7 (checking wrong scope) or DataForSEO rate limiting
- No retry or user notification about the mass failure beyond the notification panel

---

## What Works Well

These areas passed browser testing without issues:

1. Login flow — Clerk auth works smoothly, redirects to /domains
2. Domain list table — sorting, search filtering, tag filtering all functional
3. Delete confirmation modals — proper warning icons, domain names, clear descriptions
4. Share Monitoring Link — generates link, copies to clipboard, shows delete option
5. Generate Report modal — 4 report types with clear descriptions (except Custom)
6. Keyword Detail modal — comprehensive data: position history chart, search volume trend, keyword metrics (CPC, ETV, Competition, Intent), SERP features, competitor SERP data
7. Add Keywords modal — textarea input, "Suggest Keywords" AI feature works perfectly (populated 10 relevant keywords)
8. Keyword table — checkboxes, pagination, filters (Position, Status), column toggles, keyword search
9. Projects page — clean table with project stats, search, "New Project" modal
10. Jobs page — Active/Scheduled/History tabs, summary cards, scheduled jobs list, job history with duration and status
11. Calendar page — month view, navigation, domain selector, filter tabs (except language issue)
12. Settings — 13 tabs: Profile, Plan & Usage, Preferences, Notifications, API Keys, Members, Roles & Permissions, Limits, Sessions, Security, Integrations, Webhooks, White Label
13. API Keys — scoped permissions (Read/Write/Admin), clean generation form
14. Security — Password change and 2FA enable buttons
15. Notifications panel — sidebar overlay with timestamped notifications, expandable details, "Mark all read"
16. Sidebar navigation — all 6 main pages accessible, collapsible limits widget, hamburger menu on mobile

---

## Priority Fix Recommendations

### Sprint 1 (This Week) — CRITICAL
1. Fix refresh button to scope to current domain only + require confirmation modal
2. Fix monitoring stats to use domain-filtered queries instead of org-wide
3. Fix Add Domain modal overflow — add max-height with scroll, or reduce form height

### Sprint 2 (Next Week) — HIGH
4. Make Search Engine/Location/Language read-only in Edit Domain modal
5. Fix mobile branding ("Untitled UI" → "doseo")
6. Fix Settings Limits tab content rendering
7. Fix mobile domain detail layout — collapse tabs into horizontal scroll or dropdown

### Sprint 3 — MEDIUM
8. Fix Custom report type to show section picker
9. Fix Calendar localization to use app locale
10. Add bulk action bar to domains list
11. Enforce keyword limits (block adding beyond plan limit)
12. Fix language consistency on Plan & Usage page

### Sprint 4 — LOW
13. Fix badge overflow on mobile
14. Add sticky positioning to keyword bulk action bar
15. Reduce toast duration
16. Investigate and fix 87% keyword check failure rate
