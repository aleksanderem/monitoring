# Domain Overview Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build comprehensive, data-rich Overview tab for domain detail page with position history chart, executive summary metrics, and data-dense analytics

**Architecture:** React components using Recharts for visualizations, Convex queries for real-time data, Untitled UI component patterns for consistent styling

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Recharts, Convex React, Tailwind CSS v4, Untitled UI PRO

---

## Task 1: Add Backend Queries for Keyword Performance

**Files:**
- Modify: `convex/keywords.ts`

**Step 1: Add getRecentChanges query**

Add after the `getKeywordWithHistory` query (around line 100):

```typescript
// Get recent keyword position changes (for recent changes table)
export const getRecentChanges = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = args.days || 7;
    const limit = args.limit || 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const changesPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(50);

      if (positions.length < 2) return null;

      const current = positions[0];
      const oldPosition = positions.find(p => p.date <= cutoffStr);

      if (!current.position || !oldPosition?.position) return null;

      const change = oldPosition.position - current.position;
      if (change === 0) return null;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPosition.position,
        newPosition: current.position,
        change,
        searchVolume: current.searchVolume,
        url: current.url,
      };
    });

    const changes = (await Promise.all(changesPromises)).filter(c => c !== null);

    // Sort by absolute change, biggest first
    changes.sort((a, b) => Math.abs(b!.change) - Math.abs(a!.change));

    return changes.slice(0, limit);
  },
});
```

**Step 2: Add getTopPerformers query**

Add after `getRecentChanges`:

```typescript
// Get top gainers and losers (for performance tables)
export const getTopPerformers = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = args.days || 30;
    const limit = args.limit || 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const changesPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(100);

      if (positions.length < 2) return null;

      const current = positions[0];
      const oldPosition = positions.find(p => p.date <= cutoffStr);

      if (!current.position || !oldPosition?.position) return null;

      const change = oldPosition.position - current.position;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPosition.position,
        newPosition: current.position,
        change,
        searchVolume: current.searchVolume,
        url: current.url,
      };
    });

    const allChanges = (await Promise.all(changesPromises)).filter(c => c !== null);

    const gainers = allChanges.filter(c => c!.change > 0).sort((a, b) => b!.change - a!.change).slice(0, limit);
    const losers = allChanges.filter(c => c!.change < 0).sort((a, b) => a!.change - b!.change).slice(0, limit);

    return { gainers, losers };
  },
});
```

**Step 3: Add getTopKeywordsByVolume query**

Add after `getTopPerformers`:

```typescript
// Get top keywords by search volume (for top keywords table)
export const getTopKeywordsByVolume = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const keywordsWithDataPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(8);

      if (positions.length === 0) return null;

      const current = positions[0];
      if (!current.searchVolume) return null;

      const previous = positions.find(p => p.date !== current.date);
      const change = previous?.position && current.position
        ? previous.position - current.position
        : null;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        position: current.position,
        searchVolume: current.searchVolume,
        url: current.url,
        change,
        history: positions.slice(0, 7).reverse(),
      };
    });

    const keywordsWithData = (await Promise.all(keywordsWithDataPromises))
      .filter(k => k !== null)
      .sort((a, b) => b!.searchVolume! - a!.searchVolume!);

    return keywordsWithData.slice(0, limit);
  },
});
```

**Step 4: Commit backend queries**

```bash
git add convex/keywords.ts
git commit -m "feat: add keyword performance queries for dashboard

- getRecentChanges: fetch keywords with biggest position changes
- getTopPerformers: get top gainers and losers over time period
- getTopKeywordsByVolume: get highest volume keywords with trends"
```

---

## Task 2: Create PositionHistoryChart Component

**Files:**
- Create: `src/components/domain/charts/PositionHistoryChart.tsx`

**Step 1: Create component file with imports and types**

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Label } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";
import { LoadingState } from "@/components/shared/LoadingState";

interface PositionHistoryChartProps {
  domainId: Id<"domains">;
}

type DateRange = 30 | 90 | 180 | 365 | "all";
```

**Step 2: Add chart component implementation**

Add after the types:

```typescript
export function PositionHistoryChart({ domainId }: PositionHistoryChartProps) {
  const [dateRange, setDateRange] = useState<DateRange>(90);
  const isDesktop = useBreakpoint("lg");

  const history = useQuery(
    api.domains.getVisibilityHistory,
    { domainId, days: dateRange === "all" ? undefined : dateRange }
  );

  if (history === undefined) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Position History</h2>
        </div>
        <LoadingState type="card" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Position History</h2>
        </div>
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm font-medium text-primary">No historical data yet</p>
          <p className="text-sm text-tertiary">Check back after the first ranking update</p>
        </div>
      </div>
    );
  }

  // Transform data for chart - group top positions for cleaner visualization
  const chartData = history.map((point) => ({
    date: new Date(point.date),
    "Top 3": (point.metrics.pos_1 || 0) + (point.metrics.pos_2_3 || 0),
    "4-10": point.metrics.pos_4_10 || 0,
    "11-20": point.metrics.pos_11_20 || 0,
    "21-50": (point.metrics.pos_21_30 || 0) + (point.metrics.pos_31_40 || 0) + (point.metrics.pos_41_50 || 0),
    "51-100": (point.metrics.pos_51_60 || 0) + (point.metrics.pos_61_70 || 0) +
              (point.metrics.pos_71_80 || 0) + (point.metrics.pos_81_90 || 0) +
              (point.metrics.pos_91_100 || 0),
  }));

  const colors = {
    "Top 3": "text-utility-success-600",
    "4-10": "text-utility-success-400",
    "11-20": "text-utility-warning-500",
    "21-50": "text-utility-gray-400",
    "51-100": "text-utility-gray-300",
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-semibold text-primary">Position History</h2>
        <ButtonGroup size="sm">
          <ButtonGroupItem isSelected={dateRange === 30} onClick={() => setDateRange(30)}>
            30d
          </ButtonGroupItem>
          <ButtonGroupItem isSelected={dateRange === 90} onClick={() => setDateRange(90)}>
            90d
          </ButtonGroupItem>
          <ButtonGroupItem isSelected={dateRange === 180} onClick={() => setDateRange(180)}>
            180d
          </ButtonGroupItem>
          <ButtonGroupItem isSelected={dateRange === 365} onClick={() => setDateRange(365)}>
            1y
          </ButtonGroupItem>
          <ButtonGroupItem isSelected={dateRange === "all"} onClick={() => setDateRange("all")}>
            All
          </ButtonGroupItem>
        </ButtonGroup>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            className="text-tertiary [&_.recharts-text]:text-xs"
            margin={{
              top: isDesktop ? 12 : 6,
              bottom: isDesktop ? 16 : 0,
              left: 0,
              right: 0,
            }}
          >
            <defs>
              {Object.entries(colors).map(([key, color]) => (
                <linearGradient key={key} id={`gradient-${key.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="currentColor" className={color} stopOpacity="0.4" />
                  <stop offset="95%" stopColor="currentColor" className={color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-gray-100" />

            <Legend
              align="right"
              verticalAlign="top"
              layout={isDesktop ? "vertical" : "horizontal"}
              content={<ChartLegendContent className="-translate-y-2" />}
            />

            <XAxis
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              dataKey="date"
              tickFormatter={(value) => value.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              padding={{ left: 10, right: 10 }}
            />

            <YAxis
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => Number(value).toLocaleString()}
            >
              <Label
                value="Keywords"
                fill="currentColor"
                className="!text-xs font-medium"
                style={{ textAnchor: "middle" }}
                angle={-90}
                position="insideLeft"
              />
            </YAxis>

            <Tooltip
              content={<ChartTooltipContent />}
              formatter={(value) => Number(value).toLocaleString()}
              labelFormatter={(value) => value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              cursor={{
                className: "stroke-utility-brand-600 stroke-2",
              }}
            />

            <Area
              isAnimationActive={false}
              className={cx(colors["Top 3"])}
              dataKey="Top 3"
              name="Top 3"
              type="monotone"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#gradient-Top-3)"
              fillOpacity={1}
              activeDot={{
                className: "fill-bg-primary stroke-utility-success-600 stroke-2",
              }}
            />

            <Area
              isAnimationActive={false}
              className={cx(colors["4-10"])}
              dataKey="4-10"
              name="4-10"
              type="monotone"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#gradient-4-10)"
              fillOpacity={1}
              activeDot={{
                className: "fill-bg-primary stroke-utility-success-400 stroke-2",
              }}
            />

            <Area
              isAnimationActive={false}
              className={cx(colors["11-20"])}
              dataKey="11-20"
              name="11-20"
              type="monotone"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#gradient-11-20)"
              fillOpacity={1}
              activeDot={{
                className: "fill-bg-primary stroke-utility-warning-500 stroke-2",
              }}
            />

            <Area
              isAnimationActive={false}
              className={cx(colors["21-50"])}
              dataKey="21-50"
              name="21-50"
              type="monotone"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#gradient-21-50)"
              fillOpacity={1}
              activeDot={{
                className: "fill-bg-primary stroke-utility-gray-400 stroke-2",
              }}
            />

            <Area
              isAnimationActive={false}
              className={cx(colors["51-100"])}
              dataKey="51-100"
              name="51-100"
              type="monotone"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#gradient-51-100)"
              fillOpacity={1}
              activeDot={{
                className: "fill-bg-primary stroke-utility-gray-300 stroke-2",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Step 3: Commit PositionHistoryChart component**

```bash
git add src/components/domain/charts/PositionHistoryChart.tsx
git commit -m "feat: add PositionHistoryChart component

- Multi-area chart showing keyword distribution over time
- Date range selector (30d/90d/180d/1y/All)
- Color-coded position ranges (green for top, gray for lower)
- Uses Recharts with Untitled UI styling
- Handles loading and empty states"
```

---

## Task 3: Create MetricCard Component

**Files:**
- Create: `src/components/domain/cards/MetricCard.tsx`

**Step 1: Create MetricCard component**

```typescript
"use client";

import type { FC, ReactNode } from "react";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { MetricChangeIndicator } from "@/components/application/metrics/metrics";
import { cx } from "@/utils/cx";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: FC<{ className?: string }>;
  trend?: "positive" | "negative" | null;
  change?: string;
  changeDescription?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  change,
  changeDescription,
  badge,
  actions,
  className,
}: MetricCardProps) {
  return (
    <div className={cx("rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset", className)}>
      <div className="relative flex flex-col gap-4 px-4 py-5 md:gap-5 md:px-5">
        {icon && (
          <FeaturedIcon
            color="gray"
            theme="modern"
            icon={icon}
            size="lg"
          />
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-tertiary">{title}</h3>
            {badge}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-2xl font-semibold text-primary lg:text-3xl">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {trend && change && (
              <MetricChangeIndicator type="modern" trend={trend} value={change} />
            )}
          </div>

          {(subtitle || changeDescription) && (
            <div className="flex gap-2">
              {trend && change && changeDescription && (
                <span className="text-sm font-medium text-tertiary">{changeDescription}</span>
              )}
              {subtitle && !changeDescription && (
                <p className="text-sm text-tertiary">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {actions && (
          <div className="absolute top-4 right-4 md:top-5 md:right-5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit MetricCard component**

```bash
git add src/components/domain/cards/MetricCard.tsx
git commit -m "feat: add reusable MetricCard component

- Displays metric with title, value, and optional trend
- Supports icons, badges, and actions
- Responsive font sizes
- Uses Untitled UI FeaturedIcon and MetricChangeIndicator"
```

---

## Task 4: Create Executive Summary Section

**Files:**
- Create: `src/components/domain/sections/ExecutiveSummary.tsx`

**Step 1: Create component with metric cards**

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Hash01, TrendUp02, TrendDown02, BarChart03, Star01, Zap } from "@untitledui/icons";
import { MetricCard } from "../cards/MetricCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { BadgeWithDot } from "@/components/base/badges/badges";

interface ExecutiveSummaryProps {
  domainId: Id<"domains">;
}

export function ExecutiveSummary({ domainId }: ExecutiveSummaryProps) {
  const metrics = useQuery(api.domains.getLatestVisibilityMetrics, { domainId });

  if (metrics === undefined) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl bg-primary p-6">
            <LoadingState type="card" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <p className="text-sm text-tertiary">No visibility data available yet</p>
      </div>
    );
  }

  const top3Change = metrics.change?.top10 || 0;
  const totalChange = metrics.change?.total || 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-primary">Summary</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Top 3 Positions"
          value={metrics.top3}
          icon={TrendUp02}
          trend={top3Change > 0 ? "positive" : top3Change < 0 ? "negative" : null}
          change={top3Change > 0 ? `+${top3Change}` : top3Change < 0 ? `${top3Change}` : undefined}
          changeDescription="vs 7 days ago"
        />

        <MetricCard
          title="Top 10 Positions"
          value={metrics.top10}
          icon={BarChart03}
          trend={top3Change > 0 ? "positive" : top3Change < 0 ? "negative" : null}
          change={top3Change > 0 ? `+${top3Change}` : top3Change < 0 ? `${top3Change}` : undefined}
          changeDescription="vs 7 days ago"
        />

        <MetricCard
          title="Total Keywords"
          value={metrics.total}
          icon={Hash01}
          subtitle={`New: ${metrics.isNew || 0} | Lost: ${metrics.isLost || 0}`}
        />

        <MetricCard
          title="Traffic Value (ETV)"
          value={metrics.etv ? Math.round(metrics.etv).toLocaleString() : "—"}
          icon={Zap}
          subtitle="Estimated traffic value"
        />

        <MetricCard
          title="Keyword Movement"
          value=""
          icon={TrendUp02}
          subtitle={
            <div className="flex gap-4">
              <div className="flex items-center gap-1">
                <TrendUp02 className="h-4 w-4 text-fg-success-secondary" />
                <span className="text-sm font-medium text-success-primary">
                  {metrics.isUp || 0}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendDown02 className="h-4 w-4 text-fg-error-secondary" />
                <span className="text-sm font-medium text-error-primary">
                  {metrics.isDown || 0}
                </span>
              </div>
            </div>
          }
        />

        <MetricCard
          title="New Rankings"
          value={metrics.isNew || 0}
          icon={Star01}
          badge={
            <BadgeWithDot size="sm" color="brand" type="modern">
              New
            </BadgeWithDot>
          }
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit Executive Summary component**

```bash
git add src/components/domain/sections/ExecutiveSummary.tsx
git commit -m "feat: add ExecutiveSummary section with 6 metric cards

- Top 3, Top 10, Total Keywords metrics
- Traffic Value (ETV) display
- Keyword Movement (up/down counts)
- New Rankings with badge
- Uses getLatestVisibilityMetrics query
- Handles loading and empty states"
```

---

## Task 5: Integrate Components into Domain Detail Page

**Files:**
- Modify: `src/app/(dashboard)/domains/[domainId]/page.tsx:178-226`

**Step 1: Add imports at top of file**

Replace existing imports section with:

```typescript
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ArrowLeft,
  Globe01,
  Hash01,
  Edit01,
  Trash01,
  RefreshCcw01,
  BarChart03,
  Settings01,
  Link03,
  TrendUp02,
  HomeLine
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { toast } from "sonner";
import { PositionHistoryChart } from "@/components/domain/charts/PositionHistoryChart";
import { ExecutiveSummary } from "@/components/domain/sections/ExecutiveSummary";
```

**Step 2: Replace Overview TabPanel content**

Find the Overview TabPanel (around line 178) and replace it with:

```typescript
            <TabPanel id="overview">
              <div className="flex flex-col gap-8">
                {/* Position History Chart */}
                <PositionHistoryChart domainId={domainId} />

                {/* Executive Summary Metrics */}
                <ExecutiveSummary domainId={domainId} />

                {/* Placeholder for future sections */}
                <div className="rounded-xl border border-secondary bg-primary p-6">
                  <p className="text-sm text-tertiary">
                    Additional analytics coming soon: Recent changes, alerts, performance tables
                  </p>
                </div>
              </div>
            </TabPanel>
```

**Step 3: Commit integration**

```bash
git add src/app/\(dashboard\)/domains/\[domainId\]/page.tsx
git commit -m "feat: integrate PositionHistoryChart and ExecutiveSummary into Overview tab

- Add position history chart at top
- Add executive summary metrics below
- Placeholder for remaining sections
- Import new components"
```

---

## Task 6: Test and Verify

**Step 1: Start dev server and test**

Run: `npm run dev`

Expected: Server starts without errors

**Step 2: Navigate to domain detail page**

1. Open http://localhost:3000
2. Click on any domain from the domains list
3. Verify Overview tab loads

Expected:
- Position history chart renders with date range selector
- 6 metric cards display with correct data
- No console errors

**Step 3: Test date range selector**

Click through different date ranges (30d, 90d, 180d, 1y, All)

Expected: Chart updates to show different time periods

**Step 4: Test loading states**

Refresh page and observe loading states

Expected: Skeleton loaders appear then resolve to data

**Step 5: Commit verification notes**

```bash
echo "## Verification

Tested on: $(date)
- Position history chart renders correctly
- Executive summary metrics display
- Date range selector works
- Loading states function properly
- No console errors

Next steps: Implement remaining sections (recent changes, alerts, performance tables)" >> docs/plans/2026-01-29-domain-overview-implementation.md

git add docs/plans/2026-01-29-domain-overview-implementation.md
git commit -m "docs: add verification notes for completed dashboard sections"
```

---

## Remaining Tasks (Future Implementation)

The following sections are designed but not yet implemented:

### Task 7: Recent Changes Table
- Component: `RecentChangesTable.tsx`
- Query: Already implemented `api.keywords.getRecentChanges`
- Shows top 5 biggest improvements and declines

### Task 8: Alerts Section
- Component: `AlertsList.tsx`
- Derives alerts from visibility metrics
- Critical losses, major wins, high-value opportunities

### Task 9: Comprehensive Metrics Grid
- Component: `ComprehensiveMetrics.tsx`
- 8-card grid with detailed breakdowns
- Uses `getLatestVisibilityMetrics` data

### Task 10: Multi-Chart Analytics
- Component: `PositionDistributionChart.tsx` (bar chart)
- Component: `MovementTrendsChart.tsx` (multi-line)
- Component: `TopKeywordsTable.tsx`
- Queries: Already implemented

### Task 11: Performance Tables
- Component: `PerformanceTable.tsx`
- Uses `api.keywords.getTopPerformers`
- Side-by-side gainers and losers

---

## Implementation Notes

**DRY Principles:**
- MetricCard component is reusable across all metric displays
- Chart components follow Untitled UI patterns
- All queries centralized in Convex

**YAGNI Principles:**
- No premature abstractions
- Each component handles its own loading states
- No complex state management until needed

**Testing:**
- Manual testing in browser
- Verify data loads correctly
- Check responsive behavior
- Confirm loading/empty states work

**Commit Frequency:**
- Commit after each task completion
- Clear, descriptive commit messages
- Separate backend and frontend changes
