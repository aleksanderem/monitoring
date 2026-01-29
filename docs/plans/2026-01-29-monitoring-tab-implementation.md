# Monitoring Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Keywords tab into a comprehensive Monitoring dashboard with live indicator, charts, statistics, and a data-rich keyword performance table.

**Architecture:** Backend-first approach: Build Convex queries with CTR calculations, then create reusable chart/badge components, then statistics section, then comprehensive table with sorting/filtering, finally integrate into page and rename tab.

**Tech Stack:** Next.js 14, Convex React, Recharts (BarChart, LineChart), Untitled UI components, Tailwind CSS v4, React Aria Components

---

## Task 1: Backend Queries - CTR Helper and Position Distribution

**Files:**
- Modify: `convex/keywords.ts` (add after existing queries)

**Step 1: Add CTR calculation helper function**

Add this helper function at the top of the file after imports:

```typescript
// CTR curve based on organic search position (industry standard)
function getCTRForPosition(position: number): number {
  const ctrMap: Record<number, number> = {
    1: 0.285, 2: 0.157, 3: 0.110, 4: 0.080, 5: 0.072,
    6: 0.051, 7: 0.040, 8: 0.032, 9: 0.028, 10: 0.025,
  };

  if (position <= 10) return ctrMap[position] || 0;
  if (position <= 20) return 0.015;
  if (position <= 50) return 0.005;
  if (position <= 100) return 0.001;
  return 0;
}
```

**Step 2: Add getPositionDistribution query**

Add after the CTR helper:

```typescript
export const getPositionDistribution = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const distribution = {
      top3: 0,
      pos4_10: 0,
      pos11_20: 0,
      pos21_50: 0,
      pos51_100: 0,
      pos100plus: 0,
    };

    for (const keyword of keywords) {
      if (!keyword.position) continue;

      const pos = keyword.position;
      if (pos <= 3) distribution.top3++;
      else if (pos <= 10) distribution.pos4_10++;
      else if (pos <= 20) distribution.pos11_20++;
      else if (pos <= 50) distribution.pos21_50++;
      else if (pos <= 100) distribution.pos51_100++;
      else distribution.pos100plus++;
    }

    return distribution;
  },
});
```

**Step 3: Verify the query compiles**

Run: `npm run dev`
Expected: No TypeScript errors, dev server starts successfully

**Step 4: Commit**

```bash
git add convex/keywords.ts
git commit -m "feat(backend): Add CTR helper and position distribution query"
```

---

## Task 2: Backend Queries - Movement Trend

**Files:**
- Modify: `convex/keywords.ts` (add after getPositionDistribution)

**Step 1: Add getMovementTrend query**

```typescript
export const getMovementTrend = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const daysToFetch = args.days || 30;
    const cutoffDate = Date.now() - (daysToFetch * 24 * 60 * 60 * 1000);

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Build a map of date -> {gainers, losers}
    const trendMap = new Map<string, { gainers: number; losers: number }>();

    for (const keyword of keywords) {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .filter((q) => q.gte(q.field("date"), cutoffDate))
        .collect();

      // Sort by date to compare consecutive positions
      positions.sort((a, b) => a.date - b.date);

      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];
        const dateKey = new Date(curr.date).toISOString().split('T')[0];

        if (!trendMap.has(dateKey)) {
          trendMap.set(dateKey, { gainers: 0, losers: 0 });
        }

        const trend = trendMap.get(dateKey)!;

        if (curr.position < prev.position) {
          trend.gainers++;
        } else if (curr.position > prev.position) {
          trend.losers++;
        }
      }
    }

    // Convert map to array sorted by date
    return Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date: new Date(date).getTime(),
        gainers: data.gainers,
        losers: data.losers,
      }))
      .sort((a, b) => a.date - b.date);
  },
});
```

**Step 2: Verify query compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add convex/keywords.ts
git commit -m "feat(backend): Add movement trend query for 30-day analysis"
```

---

## Task 3: Backend Queries - Monitoring Statistics

**Files:**
- Modify: `convex/keywords.ts` (add after getMovementTrend)

**Step 1: Add getMonitoringStats query**

```typescript
export const getMonitoringStats = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    let totalPosition = 0;
    let positionCount = 0;
    let totalPositionSevenDaysAgo = 0;
    let positionCountSevenDaysAgo = 0;
    let estimatedMonthlyTraffic = 0;
    let gainers = 0;
    let losers = 0;
    let stable = 0;

    for (const keyword of keywords) {
      if (keyword.position) {
        totalPosition += keyword.position;
        positionCount++;

        // Calculate potential traffic for keywords in top 50
        if (keyword.position <= 50 && keyword.searchVolume) {
          const ctr = getCTRForPosition(keyword.position);
          estimatedMonthlyTraffic += keyword.searchVolume * ctr;
        }
      }

      // Get position from 7 days ago
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .filter((q) => q.gte(q.field("date"), sevenDaysAgo))
        .collect();

      if (positions.length >= 2) {
        // Sort by date
        positions.sort((a, b) => a.date - b.date);
        const oldPos = positions[0].position;
        const newPos = positions[positions.length - 1].position;

        if (oldPos) {
          totalPositionSevenDaysAgo += oldPos;
          positionCountSevenDaysAgo++;
        }

        // Determine movement status
        if (newPos < oldPos) {
          gainers++;
        } else if (newPos > oldPos) {
          losers++;
        } else {
          stable++;
        }
      }
    }

    const avgPosition = positionCount > 0 ? totalPosition / positionCount : 0;
    const avgPositionSevenDaysAgo = positionCountSevenDaysAgo > 0
      ? totalPositionSevenDaysAgo / positionCountSevenDaysAgo
      : 0;

    const avgPositionChange7d = avgPositionSevenDaysAgo > 0
      ? avgPositionSevenDaysAgo - avgPosition // Negative means improvement
      : 0;

    return {
      totalKeywords: keywords.length,
      avgPosition: Math.round(avgPosition * 10) / 10,
      avgPositionChange7d: Math.round(avgPositionChange7d * 10) / 10,
      estimatedMonthlyTraffic: Math.round(estimatedMonthlyTraffic),
      movementBreakdown: { gainers, losers, stable },
      netMovement7d: gainers - losers,
    };
  },
});
```

**Step 2: Verify query compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add convex/keywords.ts
git commit -m "feat(backend): Add monitoring statistics query with CTR calculations"
```

---

## Task 4: Backend Queries - Keyword Monitoring Table Data

**Files:**
- Modify: `convex/keywords.ts` (add after getMonitoringStats)

**Step 1: Add getKeywordMonitoring query**

```typescript
export const getKeywordMonitoring = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const results = [];

    for (const keyword of keywords) {
      // Get positions for the last 30 days for sparkline
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .filter((q) => q.gte(q.field("date"), thirtyDaysAgo))
        .collect();

      positions.sort((a, b) => a.date - b.date);

      // Find position from 7 days ago
      const sevenDaysAgoPositions = positions.filter(p => p.date <= sevenDaysAgo);
      const previousPosition = sevenDaysAgoPositions.length > 0
        ? sevenDaysAgoPositions[sevenDaysAgoPositions.length - 1].position
        : null;

      const currentPosition = keyword.position || null;
      const change = currentPosition && previousPosition
        ? previousPosition - currentPosition // Negative means dropped
        : 0;

      // Determine status
      let status: "rising" | "stable" | "falling" | "new" = "stable";
      if (previousPosition === null && currentPosition !== null) {
        status = "new";
      } else if (change > 0) {
        status = "rising"; // Improved (lower position number)
      } else if (change < 0) {
        status = "falling"; // Dropped (higher position number)
      }

      // Calculate potential
      const potential = currentPosition && keyword.searchVolume
        ? Math.round(keyword.searchVolume * getCTRForPosition(currentPosition))
        : 0;

      // Build position history array for sparkline (last 30 days)
      const positionHistory = positions.map(p => ({
        date: p.date,
        position: p.position,
      }));

      results.push({
        keywordId: keyword._id,
        phrase: keyword.phrase,
        currentPosition,
        previousPosition,
        change,
        status,
        searchVolume: keyword.searchVolume || 0,
        difficulty: keyword.difficulty || 0,
        url: keyword.url || "",
        positionHistory,
        lastUpdated: keyword._creationTime, // TODO: Add updatedAt field
        potential,
      });
    }

    return results;
  },
});
```

**Step 2: Verify query compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add convex/keywords.ts
git commit -m "feat(backend): Add keyword monitoring query with sparkline data"
```

---

## Task 5: LiveBadge Component

**Files:**
- Create: `src/components/domain/badges/LiveBadge.tsx`

**Step 1: Create LiveBadge component**

```typescript
import { cx } from "@/utils/cx";

interface LiveBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LiveBadge({ size = "md", className }: LiveBadgeProps) {
  const dotSizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-3 w-3",
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div className={cx("flex items-center gap-2", className)}>
      <span className={cx("relative flex", dotSizes[size])}>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error-solid opacity-75"></span>
        <span className={cx("relative inline-flex rounded-full bg-error-solid", dotSizes[size])}></span>
      </span>
      <span className={cx("font-semibold uppercase tracking-wide text-error-primary", textSizes[size])}>
        LIVE
      </span>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/badges/LiveBadge.tsx
git commit -m "feat(ui): Add LiveBadge component with pulsating animation"
```

---

## Task 6: PositionDistributionChart Component

**Files:**
- Create: `src/components/domain/charts/PositionDistributionChart.tsx`

**Step 1: Create PositionDistributionChart component**

```typescript
"use client";

import { useQuery } from "convex/react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";
import { LoadingState } from "@/components/shared/LoadingState";
import { cx } from "@/utils/cx";

interface PositionDistributionChartProps {
  domainId: Id<"domains">;
}

export function PositionDistributionChart({ domainId }: PositionDistributionChartProps) {
  const distribution = useQuery(api.keywords.getPositionDistribution, { domainId });

  if (distribution === undefined) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-sm font-semibold text-primary">Current Position Distribution</h3>
        <LoadingState type="card" />
      </div>
    );
  }

  const chartData = [
    { range: "Top 3", count: distribution.top3, color: "text-utility-success-600" },
    { range: "4-10", count: distribution.pos4_10, color: "text-utility-success-400" },
    { range: "11-20", count: distribution.pos11_20, color: "text-utility-warning-500" },
    { range: "21-50", count: distribution.pos21_50, color: "text-utility-gray-400" },
    { range: "51-100", count: distribution.pos51_100, color: "text-utility-gray-300" },
    { range: "100+", count: distribution.pos100plus, color: "text-utility-error-500" },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <h3 className="text-sm font-semibold text-primary">Current Position Distribution</h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            className="text-tertiary [&_.recharts-text]:text-xs"
            margin={{ top: 12, bottom: 16, left: 0, right: 0 }}
          >
            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-gray-100" />

            <XAxis
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              dataKey="range"
              padding={{ left: 10, right: 10 }}
            />

            <YAxis
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => Number(value).toLocaleString()}
            />

            <Tooltip
              content={<ChartTooltipContent />}
              formatter={(value) => [Number(value).toLocaleString(), "Keywords"]}
            />

            <Bar
              dataKey="count"
              fill="currentColor"
              className="fill-utility-brand-600"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/charts/PositionDistributionChart.tsx
git commit -m "feat(ui): Add position distribution bar chart"
```

---

## Task 7: MovementTrendChart Component

**Files:**
- Create: `src/components/domain/charts/MovementTrendChart.tsx`

**Step 1: Create MovementTrendChart component**

```typescript
"use client";

import { useQuery } from "convex/react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { LoadingState } from "@/components/shared/LoadingState";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface MovementTrendChartProps {
  domainId: Id<"domains">;
}

export function MovementTrendChart({ domainId }: MovementTrendChartProps) {
  const isDesktop = useBreakpoint("lg");
  const trend = useQuery(api.keywords.getMovementTrend, { domainId, days: 30 });

  if (trend === undefined) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-sm font-semibold text-primary">Position Movement Trend (30d)</h3>
        <LoadingState type="card" />
      </div>
    );
  }

  const chartData = trend.map((point) => ({
    date: new Date(point.date),
    Gainers: point.gainers,
    Losers: point.losers,
  }));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <h3 className="text-sm font-semibold text-primary">Position Movement Trend (30d)</h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            className="text-tertiary [&_.recharts-text]:text-xs"
            margin={{ top: isDesktop ? 12 : 6, bottom: isDesktop ? 16 : 0, left: 0, right: 0 }}
          >
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
            />

            <Tooltip
              content={<ChartTooltipContent />}
              formatter={(value) => Number(value).toLocaleString()}
              labelFormatter={(value) => value.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            />

            <Line
              type="monotone"
              dataKey="Gainers"
              stroke="currentColor"
              strokeWidth={2}
              className="stroke-utility-success-600"
              dot={false}
              activeDot={{ className: "fill-bg-primary stroke-utility-success-600 stroke-2" }}
            />

            <Line
              type="monotone"
              dataKey="Losers"
              stroke="currentColor"
              strokeWidth={2}
              className="stroke-utility-error-600"
              dot={false}
              activeDot={{ className: "fill-bg-primary stroke-utility-error-600 stroke-2" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/charts/MovementTrendChart.tsx
git commit -m "feat(ui): Add movement trend line chart with gainers/losers"
```

---

## Task 8: MonitoringStats Section Component

**Files:**
- Create: `src/components/domain/sections/MonitoringStats.tsx`

**Step 1: Create MonitoringStats component**

```typescript
"use client";

import { useQuery } from "convex/react";
import { Hash01, TrendUp02, TrendDown02, BarChart03, RefreshCcw01 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MetricCard } from "@/components/domain/cards/MetricCard";
import { LiveBadge } from "@/components/domain/badges/LiveBadge";
import { LoadingState } from "@/components/shared/LoadingState";

interface MonitoringStatsProps {
  domainId: Id<"domains">;
}

export function MonitoringStats({ domainId }: MonitoringStatsProps) {
  const stats = useQuery(api.keywords.getMonitoringStats, { domainId });

  if (stats === undefined) {
    return <LoadingState type="card" />;
  }

  const { totalKeywords, avgPosition, avgPositionChange7d, estimatedMonthlyTraffic, movementBreakdown, netMovement7d } = stats;

  // Format traffic with K/M abbreviations
  const formatTraffic = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Determine trend icon for average position (lower is better)
  const avgPosTrendIcon = avgPositionChange7d > 0 ? TrendUp02 : avgPositionChange7d < 0 ? TrendDown02 : TrendUp02;
  const avgPosTrend = avgPositionChange7d > 0 ? "positive" : avgPositionChange7d < 0 ? "negative" : null;

  // Format movement breakdown
  const movementText = (
    <span className="flex items-center gap-2">
      <span className="text-utility-success-600">↑ {movementBreakdown.gainers}</span>
      <span className="text-tertiary">/</span>
      <span className="text-utility-error-600">↓ {movementBreakdown.losers}</span>
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-primary">Statistics</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Monitored"
          value={totalKeywords}
          subtitle="Active keywords"
          icon={Hash01}
          badge={<LiveBadge size="sm" />}
        />

        <MetricCard
          title="Average Position"
          value={avgPosition.toFixed(1)}
          icon={avgPosTrendIcon}
          trend={avgPosTrend}
          change={Math.abs(avgPositionChange7d).toFixed(1)}
          changeDescription="vs. last week"
        />

        <MetricCard
          title="Est. Monthly Traffic"
          value={formatTraffic(estimatedMonthlyTraffic)}
          subtitle="Potential monthly visitors"
          icon={BarChart03}
        />

        <MetricCard
          title="Position Changes (7d)"
          value={netMovement7d > 0 ? `+${netMovement7d}` : netMovement7d}
          subtitle={movementText}
          icon={RefreshCcw01}
          trend={netMovement7d > 0 ? "positive" : netMovement7d < 0 ? "negative" : null}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/sections/MonitoringStats.tsx
git commit -m "feat(ui): Add monitoring statistics section with 4 metric cards"
```

---

## Task 9: MiniSparkline Component

**Files:**
- Create: `src/components/domain/charts/MiniSparkline.tsx`

**Step 1: Create MiniSparkline component**

```typescript
"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

interface MiniSparklineProps {
  data: Array<{ date: number; position: number }>;
  className?: string;
}

export function MiniSparkline({ data, className }: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return <div className={className} />;
  }

  const chartData = data.map(point => ({ value: point.position }));

  return (
    <ResponsiveContainer width={60} height={24} className={className}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="currentColor"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/charts/MiniSparkline.tsx
git commit -m "feat(ui): Add mini sparkline chart for position history"
```

---

## Task 10: KeywordMonitoringTable Component (Part 1: Structure & Helpers)

**Files:**
- Create: `src/components/domain/tables/KeywordMonitoringTable.tsx`

**Step 1: Create table component with TypeScript types and helper functions**

```typescript
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Hash01, ChevronUp, ChevronDown, ChevronsUpDown } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { MiniSparkline } from "@/components/domain/charts/MiniSparkline";
import { cx } from "@/utils/cx";

interface KeywordMonitoringTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "phrase" | "currentPosition" | "change" | "status" | "potential" | "searchVolume" | "difficulty";
type SortDirection = "asc" | "desc";

// Helper: Format numbers with K/M abbreviations
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Helper: Get position badge styles
function getPositionBadgeClass(position: number | null): string {
  if (!position) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
  if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
  if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
  if (position <= 50) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 100) return "bg-utility-gray-25 text-utility-gray-500";
  return "bg-utility-error-50 text-utility-error-600";
}

// Helper: Get difficulty badge
function getDifficultyBadge(difficulty: number) {
  if (difficulty <= 30) return { label: "Easy", color: "success" as const };
  if (difficulty <= 60) return { label: "Medium", color: "warning" as const };
  return { label: "Hard", color: "error" as const };
}

// Helper: Get status badge
function getStatusBadge(status: string) {
  switch (status) {
    case "rising": return { label: "Rising", color: "success" as const };
    case "falling": return { label: "Falling", color: "error" as const };
    case "new": return { label: "New", color: "blue" as const };
    default: return { label: "Stable", color: "gray" as const };
  }
}

export function KeywordMonitoringTable({ domainId }: KeywordMonitoringTableProps) {
  // Component implementation will be added in next step
  return <div>Table structure coming next</div>;
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/tables/KeywordMonitoringTable.tsx
git commit -m "feat(ui): Add keyword monitoring table structure and helpers"
```

---

## Task 11: KeywordMonitoringTable Component (Part 2: State & Sorting Logic)

**Files:**
- Modify: `src/components/domain/tables/KeywordMonitoringTable.tsx`

**Step 1: Replace component implementation with state management and sorting**

Replace the `export function KeywordMonitoringTable` with:

```typescript
export function KeywordMonitoringTable({ domainId }: KeywordMonitoringTableProps) {
  const keywords = useQuery(api.keywords.getKeywordMonitoring, { domainId });

  const [sortColumn, setSortColumn] = useState<SortColumn>("currentPosition");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter and sort keywords
  const filteredAndSortedKeywords = useMemo(() => {
    if (!keywords) return [];

    let filtered = keywords;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((kw) => kw.phrase.toLowerCase().includes(query));
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case "phrase":
          aVal = a.phrase.toLowerCase();
          bVal = b.phrase.toLowerCase();
          break;
        case "currentPosition":
          aVal = a.currentPosition || 999;
          bVal = b.currentPosition || 999;
          break;
        case "change":
          aVal = a.change;
          bVal = b.change;
          break;
        case "potential":
          aVal = a.potential;
          bVal = b.potential;
          break;
        case "searchVolume":
          aVal = a.searchVolume;
          bVal = b.searchVolume;
          break;
        case "difficulty":
          aVal = a.difficulty;
          bVal = b.difficulty;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [keywords, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedKeywords.length / pageSize);
  const paginatedKeywords = filteredAndSortedKeywords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Component render will be added in next step
  return <div>Rendering coming next</div>;
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/tables/KeywordMonitoringTable.tsx
git commit -m "feat(ui): Add table state management and sorting logic"
```

---

## Task 12: KeywordMonitoringTable Component (Part 3: Render with Loading/Empty States)

**Files:**
- Modify: `src/components/domain/tables/KeywordMonitoringTable.tsx`

**Step 1: Replace return statement with full component render**

Replace the `return <div>Rendering coming next</div>;` at the end of the component with:

```typescript
  if (keywords === undefined) {
    return <LoadingState type="card" />;
  }

  if (!keywords || keywords.length === 0) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Hash01 className="h-10 w-10 text-fg-quaternary" />
          <p className="text-sm font-medium text-primary">No keywords being monitored</p>
          <p className="text-sm text-tertiary">Add keywords to start tracking their rankings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm text-primary placeholder:text-tertiary focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      {/* Table - Desktop view */}
      <div className="overflow-x-auto rounded-xl border border-secondary bg-primary">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b-2 border-secondary bg-primary backdrop-blur">
            <tr>
              {/* Table headers will be added in next task */}
            </tr>
          </thead>
          <tbody>
            {/* Table rows will be added in next task */}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-tertiary">
          Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredAndSortedKeywords.length)} of {filteredAndSortedKeywords.length} keywords
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary-subtle disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary-subtle disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/domain/tables/KeywordMonitoringTable.tsx
git commit -m "feat(ui): Add table loading, empty states, and pagination"
```

---

## Task 13: KeywordMonitoringTable Component (Part 4: Table Headers)

**Files:**
- Modify: `src/components/domain/tables/KeywordMonitoringTable.tsx`

**Step 1: Add sortable header component before the main component**

Add this helper component before `export function KeywordMonitoringTable`:

```typescript
interface SortableHeaderProps {
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onClick: (column: SortColumn) => void;
  children: React.ReactNode;
  className?: string;
}

function SortableHeader({ column, currentColumn, direction, onClick, children, className }: SortableHeaderProps) {
  const isActive = column === currentColumn;

  return (
    <th
      onClick={() => onClick(column)}
      className={cx(
        "cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary hover:text-primary",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {children}
        {isActive ? (
          direction === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />
        )}
      </div>
    </th>
  );
}
```

**Step 2: Replace table header comment with actual headers**

Replace `{/* Table headers will be added in next task */}` with:

```typescript
<SortableHeader column="phrase" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
  Keyword
</SortableHeader>
<SortableHeader column="currentPosition" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
  Position
</SortableHeader>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
  Previous
</th>
<SortableHeader column="change" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
  Change
</SortableHeader>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
  Status
</th>
<SortableHeader column="potential" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
  Potential
</SortableHeader>
<SortableHeader column="searchVolume" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
  Volume
</SortableHeader>
<SortableHeader column="difficulty" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
  Difficulty
</SortableHeader>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
  URL
</th>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
  Last Updated
</th>
```

**Step 3: Verify component compiles**

Run: `npm run dev`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/domain/tables/KeywordMonitoringTable.tsx
git commit -m "feat(ui): Add sortable table headers with icons"
```

---

## Task 14: KeywordMonitoringTable Component (Part 5: Table Rows)

**Files:**
- Modify: `src/components/domain/tables/KeywordMonitoringTable.tsx`

**Step 1: Replace table body comment with row rendering**

Replace `{/* Table rows will be added in next task */}` with:

```typescript
{paginatedKeywords.map((keyword, index) => {
  const statusBadge = getStatusBadge(keyword.status);
  const difficultyBadge = getDifficultyBadge(keyword.difficulty);

  return (
    <tr
      key={keyword.keywordId}
      className={cx(
        "border-b border-secondary transition-colors hover:bg-secondary-subtle",
        index % 2 === 0 ? "bg-primary" : "bg-secondary-subtle"
      )}
    >
      {/* Keyword */}
      <td className="px-6 py-4">
        <span className="font-medium text-primary">{keyword.phrase}</span>
      </td>

      {/* Current Position */}
      <td className="px-6 py-4">
        {keyword.currentPosition ? (
          <span className={cx(
            "inline-flex items-center justify-center rounded-md px-3 py-1 text-lg font-semibold",
            getPositionBadgeClass(keyword.currentPosition)
          )}>
            {keyword.currentPosition}
          </span>
        ) : (
          <span className="text-sm text-tertiary">—</span>
        )}
      </td>

      {/* Previous Position */}
      <td className="px-6 py-4">
        <span className="text-sm text-secondary">
          {keyword.previousPosition || "—"}
        </span>
      </td>

      {/* Change with Sparkline */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {keyword.change !== 0 ? (
            <span className={cx(
              "flex items-center gap-1 text-sm font-medium",
              keyword.change > 0 ? "text-utility-success-600" : "text-utility-error-600"
            )}>
              {keyword.change > 0 ? "↑" : "↓"} {Math.abs(keyword.change)}
            </span>
          ) : (
            <span className="text-sm text-tertiary">→ 0</span>
          )}
          <MiniSparkline data={keyword.positionHistory} className="text-utility-gray-400" />
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <BadgeWithDot size="sm" color={statusBadge.color} type="modern">
          {statusBadge.label}
        </BadgeWithDot>
      </td>

      {/* Potential */}
      <td className="px-6 py-4">
        <span className="font-medium text-primary">
          {formatNumber(keyword.potential)}
        </span>
      </td>

      {/* Search Volume */}
      <td className="px-6 py-4">
        <span className="text-sm text-secondary">
          {formatNumber(keyword.searchVolume)}
        </span>
      </td>

      {/* Difficulty */}
      <td className="px-6 py-4">
        <BadgeWithDot size="sm" color={difficultyBadge.color} type="modern">
          {keyword.difficulty} • {difficultyBadge.label}
        </BadgeWithDot>
      </td>

      {/* URL */}
      <td className="px-6 py-4">
        <span className="truncate font-mono text-sm text-tertiary" title={keyword.url}>
          {keyword.url ? new URL(keyword.url).pathname : "—"}
        </span>
      </td>

      {/* Last Updated */}
      <td className="px-6 py-4">
        <span className="text-sm text-tertiary">
          {new Date(keyword.lastUpdated).toLocaleDateString()}
        </span>
      </td>
    </tr>
  );
})}
```

**Step 2: Verify component compiles and renders correctly**

Run: `npm run dev`
Expected: No TypeScript errors, table renders with all columns

**Step 3: Commit**

```bash
git add src/components/domain/tables/KeywordMonitoringTable.tsx
git commit -m "feat(ui): Add table row rendering with all 10 columns"
```

---

## Task 15: Integrate Monitoring Tab into Page

**Files:**
- Modify: `src/app/(dashboard)/domains/[domainId]/page.tsx`

**Step 1: Update imports section**

Add these imports after the existing imports (around line 31):

```typescript
import { PositionDistributionChart } from "@/components/domain/charts/PositionDistributionChart";
import { MovementTrendChart } from "@/components/domain/charts/MovementTrendChart";
import { MonitoringStats } from "@/components/domain/sections/MonitoringStats";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";
import { LiveBadge } from "@/components/domain/badges/LiveBadge";
import { Activity } from "@untitledui/icons";
```

**Step 2: Update tabs configuration**

Replace the `tabs` array (around line 53) to rename "keywords" to "monitoring":

```typescript
const tabs = [
  { id: "overview", label: "Overview", icon: BarChart03 },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "visibility", label: "Visibility", icon: TrendUp02 },
  { id: "backlinks", label: "Backlinks", icon: Link03 },
  { id: "settings", label: "Settings", icon: Settings01 },
];
```

**Step 3: Replace Monitoring TabPanel content**

Find the TabPanel with id="keywords" (around line 197) and replace entire TabPanel with:

```typescript
{/* Monitoring Tab */}
<TabPanel id="monitoring">
  <div className="flex flex-col gap-8">
    {/* Page Title with Live Badge */}
    <div className="flex items-center gap-3">
      <h2 className="text-lg font-semibold text-primary">Keyword Monitoring</h2>
      <LiveBadge size="md" />
    </div>

    {/* Charts Section */}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <PositionDistributionChart domainId={domainId} />
      <MovementTrendChart domainId={domainId} />
    </div>

    {/* Statistics Section */}
    <MonitoringStats domainId={domainId} />

    {/* Monitoring Table */}
    <KeywordMonitoringTable domainId={domainId} />
  </div>
</TabPanel>
```

**Step 4: Verify page compiles and renders**

Run: `npm run dev`
Expected: No TypeScript errors, Monitoring tab shows all sections

**Step 5: Test in browser**

Navigate to a domain detail page and click the Monitoring tab.
Expected: See live badge, charts, statistics, and table with sortable columns

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/domains/\[domainId\]/page.tsx
git commit -m "feat(ui): Integrate monitoring tab with all components"
```

---

## Task 16: Final Verification and Testing

**Files:**
- Test: Browser testing of all features

**Step 1: Start dev server and test all features**

Run: `npm run dev`

Test checklist:
- [ ] Navigate to domain detail page
- [ ] Click Monitoring tab
- [ ] Verify live badge animates (pulsating red dot)
- [ ] Verify Position Distribution chart renders with correct colors
- [ ] Verify Movement Trend chart shows gainers and losers lines
- [ ] Verify Statistics cards show correct data
- [ ] Verify table renders with all 10 columns
- [ ] Click column headers to sort
- [ ] Use search bar to filter keywords
- [ ] Verify pagination works
- [ ] Check sparklines display in Change column
- [ ] Verify position badges have correct colors
- [ ] Verify status badges show correct states
- [ ] Check empty state (if no keywords)

**Step 2: Fix any visual or functional issues found**

If issues found, fix them now before committing.

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: Verify monitoring tab functionality and polish"
```

**Step 4: Push to remote**

```bash
git push origin main
```

---

## Summary

This plan implements a comprehensive Monitoring tab with:

1. **Backend (Tasks 1-4):** Four new Convex queries providing position distribution, movement trends, statistics, and detailed keyword monitoring data with CTR-based potential calculations
2. **UI Components (Tasks 5-9):** Reusable LiveBadge, PositionDistributionChart, MovementTrendChart, MonitoringStats section, and MiniSparkline components
3. **Data Table (Tasks 10-14):** Full-featured KeywordMonitoringTable with 10 columns, sorting, search, pagination, and sparklines
4. **Integration (Tasks 15-16):** Tab renamed to "Monitoring", all components integrated, and comprehensive testing

The implementation follows DRY principles by reusing existing MetricCard and BadgeWithDot components, maintains consistent styling with the existing PositionHistoryChart, and provides a data-rich monitoring experience with live status indication.
