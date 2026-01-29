# Domain Overview Dashboard Design

**Date:** 2026-01-29
**Status:** Approved
**Implementation:** Phase 3 - Domain Detail Page

## Overview

Design for comprehensive, data-rich Overview tab on domain detail page combining three approaches:
1. Position history chart showing keyword distribution over time
2. Executive summary with metric cards and quick insights
3. Data-dense analytics with detailed metrics and performance tables

## Data Sources

All queries already exist in `convex/domains.ts`:
- `getVisibilityHistory` - Historical position distribution data
- `getLatestVisibilityMetrics` - Current snapshot with aggregated metrics and 7-day changes
- `getPositionDistribution` - Current keyword counts in position buckets
- Backend provides: domainVisibilityHistory table with pos_1, pos_2_3, pos_4_10, etc.

## Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  1. POSITION HISTORY CHART (full width)             │
│  Multi-line/area chart showing distribution over    │
│  time with date range selector                      │
└─────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬─────────┐
│  2. EXECUTIVE SUMMARY METRICS (4-6 cards)           │
│  Top 3  │  Top 10  │  Total  │  ETV  │  Movement   │
└──────────────┴──────────────┴──────────────┴─────────┘

┌─────────────────────────────┬───────────────────────┐
│  3. RECENT CHANGES          │  4. ALERTS            │
│  Top gainers/losers table   │  Critical movements   │
└─────────────────────────────┴───────────────────────┘

┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬────┐
│  5. COMPREHENSIVE METRICS GRID (8 cards, 4-col)     │
│  Detailed breakdowns of all position ranges          │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴────┘

┌─────────────────┬─────────────────┬─────────────────┐
│  6. MULTI-CHART ANALYTICS (3 side-by-side)          │
│  Distribution   │  Movement       │  Top Keywords  │
└─────────────────┴─────────────────┴─────────────────┘

┌─────────────────────────────┬───────────────────────┐
│  7. TOP GAINERS TABLE       │  8. TOP LOSERS TABLE  │
│  30-day improvements         │  30-day declines      │
└─────────────────────────────┴───────────────────────┘
```

## Component Specifications

### 1. Position History Chart

**Component:** Custom AreaChart based on Untitled UI LineChart01 pattern
**Data Query:** `getVisibilityHistory(domainId, days)`
**Chart Type:** Multi-line/stacked area chart using Recharts

**Data Structure:**
```typescript
interface VisibilityHistoryPoint {
  date: string;
  pos_1: number;
  pos_2_3: number;
  pos_4_10: number;
  pos_11_20: number;
  pos_21_30: number;
  pos_31_40: number;
  pos_41_50: number;
  pos_51_60: number;
  pos_61_70: number;
  pos_71_80: number;
  pos_81_90: number;
  pos_91_100: number;
}
```

**Visual Design:**
- X-axis: Date (formatted as "Jan", "Feb", etc.)
- Y-axis: Keyword count
- Multiple colored areas/lines for position ranges
- Color scheme:
  - Green shades (pos_1, pos_2_3, pos_4_10) - high value positions
  - Yellow/orange shades (pos_11_20 through pos_41_50) - medium value
  - Gray shades (pos_51_60 through pos_91_100) - lower value
- Interactive tooltips with exact counts and percentages
- Date range selector buttons: 30d / 90d / 180d / 365d / All
- Legend with color-coded position ranges
- Responsive: Full height chart on desktop, condensed on mobile

**Implementation Notes:**
- Use Recharts AreaChart with ResponsiveContainer
- Follow Untitled UI chart styling patterns
- Use ChartTooltipContent and ChartLegendContent components
- Add gradient fills for top position ranges

### 2. Executive Summary Metric Cards

**Component:** Grid of MetricCard components
**Data Query:** `getLatestVisibilityMetrics(domainId)`
**Layout:** Responsive grid (3 cols on desktop, 2 on tablet, 1 on mobile)

**Six Metric Cards:**

1. **Top 3 Positions**
   - Title: "Top 3 Positions"
   - Value: `top3` (pos_1 + pos_2_3)
   - Trend: `change.top10` with trend arrow
   - Badge: Green if positive, red if negative
   - Icon: TrendUp02

2. **Top 10 Positions**
   - Title: "Top 10 Positions"
   - Value: `top10`
   - Change: Percentage vs 7 days ago
   - Badge: Success/error based on direction
   - Icon: BarChart03

3. **Total Keywords**
   - Title: "Total Keywords"
   - Value: `total`
   - Subtitle: "New: {isNew} | Lost: {isLost}"
   - Movement summary badge
   - Icon: Hash01

4. **Estimated Traffic Value**
   - Title: "Traffic Value"
   - Value: `etv` (formatted as currency or number)
   - Trend: Calculate from historical data
   - Badge: With percentage change
   - Icon: CurrencyDollar (or similar)

5. **Keyword Movement**
   - Title: "Movement"
   - Split display:
     - Up: `isUp` count with green up arrow
     - Down: `isDown` count with red down arrow
   - Visual: Two-column layout within card
   - Icons: TrendUp02 / TrendDown02

6. **New Opportunities**
   - Title: "New Rankings"
   - Value: `isNew` count
   - Link: "View keywords →" (navigates to Keywords tab)
   - Badge: "New" with brand color
   - Icon: Star01

**Styling:**
- Card: Rounded borders, padding, shadow
- Large prominent numbers (text-2xl or text-3xl font-semibold)
- Small subtitle text (text-sm text-tertiary)
- Trend indicators with colored badges
- Icons: 20x20px in colored background circle

### 3. Recent Changes Table

**Component:** Compact data table
**Data:** Derived from keyword positions, compare current vs 7 days ago
**Layout:** Left column of 2-column section

**Columns:**
- Keyword phrase
- Old position → New position
- Change (with colored arrow and delta)
- Search volume (optional, if available)

**Content:**
- Top 5 biggest improvements
- Top 5 biggest declines
- Sorted by absolute change magnitude
- Clickable rows navigate to keyword detail (future)

**Styling:**
- Compact rows (py-2)
- Green text/icons for improvements
- Red text/icons for declines
- Neutral gray for stable
- Alternating row backgrounds for readability

### 4. Alerts & Notifications

**Component:** Alert/notification list
**Layout:** Right column of 2-column section
**Data:** Derived from `isUp`, `isDown`, `isNew`, `isLost` and position thresholds

**Alert Types:**

1. **Critical Losses**
   - Triggered when: Keywords drop from positions 1-10 to 11+
   - Badge: Error/warning color
   - Format: "⚠️ 'keyword' dropped out of top 10 (pos 12)"

2. **Major Wins**
   - Triggered when: Keywords enter positions 1-3
   - Badge: Success color
   - Format: "🎉 'keyword' reached position 2"

3. **High-Value Opportunities**
   - Triggered when: High search volume keywords in positions 11-20
   - Badge: Info/brand color
   - Format: "💡 'keyword' (vol: 5,000) at position 15 - opportunity!"

**Styling:**
- List with icons and colored badges
- Most critical alerts at top
- Limit to 5-8 most important alerts
- Link to Keywords tab for full details

### 5. Comprehensive Metrics Grid

**Component:** 8-card grid (4 columns on desktop)
**Data Query:** `getLatestVisibilityMetrics(domainId)`
**Layout:** Grid layout, responsive to 2 cols on tablet, 1 on mobile

**Eight Metric Cards:**

1. Top 20 Keywords - `top20` count
2. Top 50 Keywords - `top50` count
3. Positions 51-100 - Calculate from distribution
4. Lost Keywords - `isLost` count
5. Average Position - Calculate weighted average from distribution
6. Visibility Trend - 30-day percentage change
7. Impressions ETV - `impressions_etv` (if available)
8. Position Score - Weighted score favoring top positions (custom formula)

**Styling:**
- Smaller cards than executive summary
- Simpler layout: title, large number, optional small trend
- Consistent spacing and alignment

### 6. Multi-Chart Analytics Section

**Component:** Three side-by-side chart cards
**Layout:** 3-column grid (stacks to 1 column on mobile)

#### Chart 6A: Position Distribution Histogram

**Data Query:** `getPositionDistribution(domainId)`
**Chart Type:** Bar chart (Recharts BarChart)

**Data Structure:**
```typescript
interface PositionBucket {
  range: "1-3" | "4-10" | "11-20" | "21-50" | "51-100" | "100+";
  count: number;
}
```

**Visual Design:**
- X-axis: Position range buckets
- Y-axis: Keyword count
- Color gradient: Green (1-3) → Gray (100+)
- Tooltip: Shows exact count and percentage of total
- Responsive height: 280px

#### Chart 6B: Movement Trends (7-day)

**Data Query:** Last 7 entries from `getVisibilityHistory(domainId, 7)`
**Chart Type:** Stacked bar or multi-line chart

**Data Series:**
- isUp (green line)
- isDown (red line)
- isNew (blue line)
- isLost (gray line)

**Visual Design:**
- X-axis: Last 7 days
- Y-axis: Count of keywords in each category
- Different colored lines for each movement type
- Shows ranking volatility and dynamics
- Responsive height: 280px

#### Chart 6C: Top Keywords Performance

**Component:** Hybrid table/chart
**Data:** Top 10 keywords by search volume from keywords table
**Layout:** Compact table with inline sparklines

**Columns:**
- Keyword phrase (truncated if long)
- Current position
- Search volume
- 7-day trend (small inline sparkline or arrow)

**Styling:**
- Sortable columns
- Clickable rows (navigate to Keywords tab)
- Alternating row backgrounds
- Compact spacing (max-h-[280px] with scroll)

### 7 & 8. Performance Tables (Gainers/Losers)

**Component:** Two side-by-side tables
**Data:** Compare keyword positions over 30 days
**Layout:** 2-column grid (stacks on mobile)

#### Left: Top Gainers (30 days)

**Columns:**
- Keyword phrase
- Old position (30 days ago)
- New position (current)
- Change (delta with green arrow)
- Search volume (if available)

**Data:**
- Limited to top 10 gainers
- Sorted by biggest improvement (old position - new position, descending)

#### Right: Top Losers (30 days)

**Columns:**
- Keyword phrase
- Old position (30 days ago)
- New position (current)
- Change (delta with red arrow)
- Search volume (if available)

**Data:**
- Limited to top 10 losers
- Sorted by biggest decline (new position - old position, descending)

**Styling (both tables):**
- Table component from Untitled UI
- Compact rows
- Color-coded change indicators
- Scrollable if > 10 rows
- Loading states

## Technical Implementation

### New Components to Create

1. **PositionHistoryChart.tsx**
   - Wraps Recharts AreaChart
   - Handles data fetching with `useQuery(api.domains.getVisibilityHistory, { domainId, days })`
   - Date range selector state
   - Responsive container

2. **MetricCard.tsx** (reusable)
   - Props: title, value, trend, badge, icon, subtitle
   - Variant support for different card styles
   - Trend arrow logic

3. **PositionDistributionChart.tsx**
   - Bar chart component
   - Uses `useQuery(api.domains.getPositionDistribution, { domainId })`

4. **KeywordMovementChart.tsx**
   - Multi-line chart for movement trends
   - Processes visibility history data

5. **TopKeywordsTable.tsx**
   - Small table component
   - Fetches keywords with positions

6. **PerformanceTable.tsx** (reusable)
   - Generic table for gainers/losers
   - Props: data, type (gainer/loser), columns

### Data Queries

All queries already exist:
- `api.domains.getVisibilityHistory` ✅
- `api.domains.getLatestVisibilityMetrics` ✅
- `api.domains.getPositionDistribution` ✅

May need new queries:
- `api.keywords.getRecentChanges` - For recent changes table
- `api.keywords.getTopPerformers` - For gainers/losers tables

### Responsive Behavior

**Desktop (lg+):**
- Full 4-column metric grids
- Side-by-side charts and tables
- Vertical tabs visible in sidebar

**Tablet (md):**
- 2-column metric grids
- Charts stack to 2 columns
- Tables remain side-by-side

**Mobile (sm):**
- 1-column layout throughout
- Condensed chart heights
- Horizontal scrolling for tables
- Collapsed/accordion sections for dense data

## Color Scheme

**Position Ranges:**
- Positions 1-3: `utility-success-600` (dark green)
- Positions 4-10: `utility-success-400` (light green)
- Positions 11-20: `utility-warning-500` (yellow/orange)
- Positions 21-50: `utility-gray-400` (light gray)
- Positions 51-100: `utility-gray-200` (very light gray)

**Trends:**
- Positive: `utility-success-*` (green)
- Negative: `utility-error-*` (red)
- Neutral: `utility-gray-*` (gray)
- New: `utility-brand-*` (blue/brand)

## Empty States

When no data available:
- Position history chart: "No historical data yet. Check back after the first ranking update."
- Metrics: Show "0" or "—" with explanatory text
- Tables: Empty state with icon and message: "No keyword movements in this period"

## Loading States

- Skeleton loaders for metric cards (shimmer effect)
- Chart placeholders with loading spinner
- Table row skeletons

## Future Enhancements

- Export functionality (CSV, PDF)
- Custom date range picker
- Keyword comparison mode (compare 2+ keywords)
- Annotations for major SEO events
- Forecasting/predictions based on trends
- Competitor comparison overlay
