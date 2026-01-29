# Monitoring Tab Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan from this design.

**Goal:** Transform the Keywords tab into a comprehensive Monitoring dashboard with live status indicator, rich visualizations, detailed statistics, and a data-dense keyword performance table.

**Architecture:** The Monitoring tab replaces the current Keywords tab with a three-section layout: (1) Live indicator + charts showing position distribution and movement trends, (2) Statistics grid with key monitoring metrics, (3) Comprehensive sortable table with 10+ columns showing detailed keyword performance data including position changes, status, potential, difficulty, and historical trends.

**Tech Stack:** Next.js 14, Convex React, Recharts (BarChart, LineChart), Untitled UI components, Tailwind CSS v4, React Aria Components

---

## Section 1: Live Monitoring Indicator & Tab Rename

### Navigation Changes

**Rename tab from "Keywords" to "Monitoring":**
- Update tab configuration in `src/app/(dashboard)/domains/[domainId]/page.tsx`
- Change tab ID from "keywords" to "monitoring"
- Update icon to a more monitoring-focused icon (e.g., `Monitor` or `Activity`)

### Live Indicator Component

**Visual Design:**
- Pulsating red dot with "LIVE" text badge
- Positioned next to the "Monitoring" heading at top of tab content
- Animation: continuous ping effect on outer circle

**Implementation:**
```typescript
<div className="flex items-center gap-2">
  <span className="relative flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error-solid opacity-75"></span>
    <span className="relative inline-flex h-2 w-2 rounded-full bg-error-solid"></span>
  </span>
  <span className="text-xs font-semibold uppercase tracking-wide text-error-primary">LIVE</span>
</div>
```

**Location:** Next to the "Monitoring" h2 heading, using flex layout to align with title.

---

## Section 2: Charts and Statistics

### Chart Section Layout

**Two-column chart grid at top of tab:**

#### Position Distribution Chart (Left Column)
- **Type:** BarChart from Recharts
- **Data:** Current snapshot of keyword distribution across position ranges
- **X-Axis:** Position ranges (Top 3, 4-10, 11-20, 21-50, 51-100, 100+)
- **Y-Axis:** Keyword count
- **Colors:** Match PositionHistoryChart palette
  - Top 3: `text-utility-success-600`
  - 4-10: `text-utility-success-400`
  - 11-20: `text-utility-warning-500`
  - 21-50: `text-utility-gray-400`
  - 51-100: `text-utility-gray-300`
  - 100+: `text-utility-error-500`
- **Title:** "Current Position Distribution"
- **Height:** 320px

#### Movement Trend Chart (Right Column)
- **Type:** LineChart from Recharts
- **Data:** 30-day daily aggregation of keyword movements
- **Lines:**
  - Gainers (green): Count of keywords that improved position that day
  - Losers (red): Count of keywords that declined position that day
- **X-Axis:** Date (last 30 days)
- **Y-Axis:** Count of keywords
- **Colors:**
  - Gainers: `text-utility-success-600`
  - Losers: `text-utility-error-600`
- **Title:** "Position Movement Trend (30d)"
- **Height:** 320px

**Layout:**
```typescript
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <PositionDistributionChart domainId={domainId} />
  <MovementTrendChart domainId={domainId} />
</div>
```

### Statistics Grid

**Four-column metrics grid below charts:**

#### Metric Cards (using existing MetricCard component)

1. **Total Monitored**
   - Icon: `Hash01`
   - Value: Total count of keywords being tracked
   - Badge: Live indicator (small version)
   - Subtitle: "Active keywords"

2. **Average Position**
   - Icon: `TrendUp02` or `TrendDown02` (based on trend)
   - Value: Mean position across all keywords (rounded to 1 decimal)
   - Change: 7-day trend indicator
   - ChangeDescription: "vs. last week"

3. **Est. Monthly Traffic**
   - Icon: `BarChart03`
   - Value: Sum of (search volume × CTR) for all ranking keywords (in top 50)
   - Subtitle: "Potential monthly visitors"
   - Color coding based on total

4. **Position Changes (7d)**
   - Icon: `RefreshCcw01`
   - Value: Net movement count
   - Subtitle: Custom with icons: "↑ {gainers} / ↓ {losers}"
   - Color: Green if net positive, red if net negative, gray if zero

**Layout:**
```typescript
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
  <MetricCard title="Total Monitored" value={totalKeywords} icon={Hash01} badge={<LiveBadge size="sm" />} />
  <MetricCard title="Average Position" value={avgPosition} icon={TrendUp02} change={change} changeDescription="vs. last week" />
  <MetricCard title="Est. Monthly Traffic" value={estimatedTraffic} icon={BarChart03} subtitle="Potential monthly visitors" />
  <MetricCard title="Position Changes (7d)" value={netMovement} icon={RefreshCcw01} subtitle={movementBreakdown} />
</div>
```

---

## Section 3: Data-Rich Monitoring Table

### Table Component Structure

**Use Untitled UI Table component pattern** from `informational-02/04` example:
- Sticky header with sort controls
- Responsive design (collapses to cards on mobile)
- Pagination controls at bottom
- Search/filter bar above table

### Table Columns (10 columns)

#### 1. Keyword (Primary Column)
- **Width:** Flexible, minimum 200px
- **Content:** Full keyword phrase
- **Style:** Font-medium, text-primary
- **Interactions:** Clickable to view keyword detail modal
- **Mobile:** Always visible

#### 2. Current Position
- **Width:** 80px
- **Content:** Position number (1-100+)
- **Style:** Font-semibold, large text (text-lg)
- **Color Coding:**
  - 1-3: `text-utility-success-600 bg-utility-success-50`
  - 4-10: `text-utility-success-500 bg-utility-success-25`
  - 11-20: `text-utility-warning-600 bg-utility-warning-50`
  - 21-50: `text-utility-gray-600 bg-utility-gray-50`
  - 51-100: `text-utility-gray-500 bg-utility-gray-25`
  - 100+: `text-utility-error-600 bg-utility-error-50`
- **Format:** Badge style with rounded background
- **Mobile:** Always visible

#### 3. Previous Position
- **Width:** 80px
- **Content:** Previous position number
- **Style:** Font-normal, text-secondary, smaller text (text-sm)
- **Format:** Plain text, right-aligned
- **Mobile:** Hidden, shown in expanded card view

#### 4. Change (Delta)
- **Width:** 100px
- **Content:** Position delta + mini sparkline
- **Style:**
  - Number with arrow icon (↑/↓/→)
  - Color: Green for improvements, red for drops, gray for no change
  - Mini sparkline chart showing 30-day position trend
- **Format:** `↑ 5` or `↓ 3` or `→ 0`
- **Mobile:** Always visible (without sparkline)

#### 5. Status
- **Width:** 100px
- **Content:** Keyword health status badge
- **Options:**
  - "Rising" (green badge) - improved in last 7 days
  - "Stable" (gray badge) - no significant change
  - "Falling" (red badge) - declined in last 7 days
  - "New" (blue badge) - first time ranking
- **Style:** BadgeWithDot component with appropriate colors
- **Mobile:** Always visible

#### 6. Potential
- **Width:** 120px
- **Content:** Estimated monthly visitors based on search volume × CTR for current position
- **Style:** Font-medium, text-primary
- **Format:** Number with abbreviation (e.g., "1.2K", "450")
- **Tooltip:** Shows calculation breakdown
- **Mobile:** Hidden

#### 7. Search Volume
- **Width:** 100px
- **Content:** Monthly search volume
- **Style:** Font-normal, text-secondary
- **Format:** Number with K/M abbreviations (e.g., "12.5K", "1.2M")
- **Mobile:** Hidden

#### 8. Difficulty
- **Width:** 100px
- **Content:** SEO difficulty score (1-100)
- **Style:** Badge with color coding
  - 0-30: "Easy" (green badge)
  - 31-60: "Medium" (yellow badge)
  - 61-100: "Hard" (red badge)
- **Format:** Score number + difficulty label
- **Mobile:** Hidden

#### 9. URL
- **Width:** 200px (truncated)
- **Content:** Ranking URL path
- **Style:** Font-mono, text-sm, text-tertiary, truncated
- **Interactions:**
  - Hover shows full URL in tooltip
  - Copy button appears on hover
- **Mobile:** Hidden

#### 10. Last Updated
- **Width:** 120px
- **Content:** Relative time since last position check
- **Style:** Font-normal, text-sm, text-tertiary
- **Format:** "2h ago", "1d ago", "3w ago"
- **Tooltip:** Shows exact timestamp on hover
- **Mobile:** Hidden, shown in expanded card view

### Table Features

#### Sorting
- Click column headers to sort ascending/descending
- Default sort: Current Position (ascending - best positions first)
- Visual indicator (arrow icon) shows active sort column and direction
- Multi-column sort: Shift+click to add secondary sort

#### Filtering & Search
- Search bar above table filters by keyword phrase
- Filter dropdowns for:
  - Status (Rising/Stable/Falling/New)
  - Position range (Top 3, 4-10, 11-20, etc.)
  - Difficulty (Easy/Medium/Hard)
- Active filters shown as removable badges

#### Pagination
- 50 keywords per page (default)
- Page size selector: 25/50/100/All
- Pagination controls at bottom
- Shows "Showing X-Y of Z keywords"

#### Row Interactions
- Hover highlights row with subtle background color
- Hover reveals action buttons on right:
  - View History icon → Opens position history modal
  - Add Note icon → Quick note dialog
  - Remove icon → Remove from monitoring (with confirmation)

#### Responsive Behavior
- **Desktop (>1024px):** Full table with all columns
- **Tablet (768-1024px):** Hide URL, Difficulty, hide Search Volume, collapse to essential columns
- **Mobile (<768px):** Card view showing:
  - Keyword (primary text)
  - Current Position + Change badge
  - Status badge
  - "View Details" button → expands to show all data

### Visual Treatment

#### Row Styling
- Alternating row backgrounds: `bg-primary` and `bg-secondary-subtle`
- Border between rows: `border-b border-secondary`
- Row height: 64px (comfortable spacing)

#### Header Styling
- Sticky positioning: `sticky top-0`
- Background: `bg-primary` with blur backdrop
- Border: `border-b-2 border-secondary`
- Font: `text-xs font-semibold uppercase tracking-wide text-tertiary`
- Z-index: Ensures header stays above row content when scrolling

#### Empty State
- Icon: `Hash01` (large, gray)
- Primary text: "No keywords being monitored"
- Secondary text: "Add keywords to start tracking their rankings"
- CTA button: "Add Keywords" → Opens add keywords dialog

---

## Backend Data Requirements

### New Convex Queries Needed

#### 1. `getKeywordMonitoring` (main table data)
```typescript
export const getKeywordMonitoring = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Returns array of keywords with:
    // - keywordId, phrase, currentPosition, previousPosition (from 7 days ago)
    // - change (delta), status (rising/stable/falling/new)
    // - searchVolume, difficulty, url
    // - positionHistory (array of last 30 days for sparkline)
    // - lastUpdated (timestamp)
    // - potential (calculated: searchVolume × CTR for current position)
  }
});
```

#### 2. `getPositionDistribution` (for bar chart)
```typescript
export const getPositionDistribution = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Returns object with current counts:
    // { top3: N, pos4_10: N, pos11_20: N, pos21_50: N, pos51_100: N, pos100plus: N }
  }
});
```

#### 3. `getMovementTrend` (for line chart)
```typescript
export const getMovementTrend = query({
  args: { domainId: v.id("domains"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Returns array of daily aggregates for last 30 days:
    // [{ date: timestamp, gainers: N, losers: N }]
  }
});
```

#### 4. `getMonitoringStats` (for statistics cards)
```typescript
export const getMonitoringStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Returns object with:
    // {
    //   totalKeywords: N,
    //   avgPosition: X.X,
    //   avgPositionChange7d: +/-N,
    //   estimatedMonthlyTraffic: N,
    //   movementBreakdown: { gainers: N, losers: N, stable: N },
    //   netMovement7d: +/-N
    // }
  }
});
```

---

## CTR Assumptions for Potential Calculation

Use standard organic CTR curve based on position:
- Position 1: 28.5%
- Position 2: 15.7%
- Position 3: 11.0%
- Position 4: 8.0%
- Position 5: 7.2%
- Position 6: 5.1%
- Position 7: 4.0%
- Position 8: 3.2%
- Position 9: 2.8%
- Position 10: 2.5%
- Position 11-20: 1.5%
- Position 21-50: 0.5%
- Position 51-100: 0.1%
- Position 100+: 0.0%

Formula: `potential = searchVolume × CTR`

---

## Component File Structure

### New Components to Create

1. **`src/components/domain/charts/PositionDistributionChart.tsx`**
   - Bar chart component for current position distribution
   - Uses Recharts BarChart
   - Reuses color scheme from PositionHistoryChart

2. **`src/components/domain/charts/MovementTrendChart.tsx`**
   - Line chart component for 30-day movement trend
   - Uses Recharts LineChart
   - Two lines: gainers (green) and losers (red)

3. **`src/components/domain/sections/MonitoringStats.tsx`**
   - Statistics grid section with 4 MetricCards
   - Queries monitoring stats data
   - Displays live badge on Total Monitored card

4. **`src/components/domain/tables/KeywordMonitoringTable.tsx`**
   - Main comprehensive table component
   - Handles sorting, filtering, pagination
   - Responsive card view for mobile
   - Row action buttons

5. **`src/components/domain/badges/LiveBadge.tsx`**
   - Reusable live indicator component
   - Pulsating red dot with "LIVE" text
   - Size variants: sm, md, lg

6. **`src/components/domain/charts/MiniSparkline.tsx`**
   - Tiny inline sparkline chart for position history
   - Shows 30-day trend in table cell
   - Uses Recharts LineChart with minimal styling

### Modified Components

1. **`src/app/(dashboard)/domains/[domainId]/page.tsx`**
   - Update tabs array: Change "keywords" to "monitoring"
   - Replace TabPanel content for monitoring tab
   - Add new chart + stats + table components

---

## Testing Checklist

- [ ] Live indicator animates continuously (ping effect)
- [ ] Charts load with correct data and colors
- [ ] Statistics cards show accurate calculations
- [ ] Table sorts correctly by all columns
- [ ] Search filters keywords by phrase
- [ ] Filter dropdowns work (Status, Position, Difficulty)
- [ ] Pagination controls work correctly
- [ ] Row hover reveals action buttons
- [ ] Sparklines display in table cells
- [ ] Mobile view collapses to card layout
- [ ] Empty state shows when no keywords
- [ ] Copy URL button works on hover
- [ ] Tooltips show on truncated content
- [ ] Color coding matches position ranges
- [ ] CTR calculations are correct for potential
