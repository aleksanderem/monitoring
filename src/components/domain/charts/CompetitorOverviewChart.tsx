"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { cx } from "@/utils/cx";

interface CompetitorOverviewChartProps {
  domainId: Id<"domains">;
  days?: number;
}

const CHART_COLORS = [
  { className: "text-utility-brand-600", color: "#2563eb" },      // blue
  { className: "text-utility-success-500", color: "#10b981" },    // green
  { className: "text-utility-warning-500", color: "#f59e0b" },    // orange
  { className: "text-utility-error-500", color: "#ef4444" },      // red
  { className: "text-utility-purple-500", color: "#a855f7" },     // purple
];

const OWN_DOMAIN_COLOR = { className: "text-utility-gray-700", color: "#374151" };

export function CompetitorOverviewChart({ domainId, days = 30 }: CompetitorOverviewChartProps) {
  const overview = useQuery(api.queries.competitors.getCompetitorOverview, {
    domainId,
    days,
  });

  if (overview === undefined) {
    return <LoadingState type="card" />;
  }

  if (!overview || !overview.competitors || overview.competitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary bg-secondary/50 p-12">
        <p className="text-sm font-medium text-tertiary">No competitors added yet</p>
        <p className="mt-1 text-sm text-quaternary">
          Add competitors to compare rankings over time
        </p>
      </div>
    );
  }

  // Filter out any undefined competitors
  const validCompetitors = overview.competitors.filter((c) => c && c.id && c.name);

  if (validCompetitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary bg-secondary/50 p-12">
        <p className="text-sm font-medium text-tertiary">No competitor data available</p>
        <p className="mt-1 text-sm text-quaternary">
          Check competitor positions to populate the chart
        </p>
      </div>
    );
  }

  // Transform data for chart
  const chartData = (overview.data || []).map((day) => {
    const dataPoint: any = {
      date: day.date,
      own: day.ownAvgPosition,
    };

    if (day.competitors) {
      day.competitors.forEach((comp) => {
        const competitor = validCompetitors.find((c) => c.id === comp.competitorId);
        if (competitor && competitor.name) {
          dataPoint[competitor.name] = comp.avgPosition;
        }
      });
    }

    return dataPoint;
  });

  // Chart config for ChartContainer with className-based colors
  const chartConfig: any = {
    own: {
      label: "Your Domain",
      className: OWN_DOMAIN_COLOR.className,
      color: OWN_DOMAIN_COLOR.color,
    },
  };

  validCompetitors.forEach((competitor, index) => {
    if (competitor && competitor.name) {
      const colorInfo = CHART_COLORS[index % CHART_COLORS.length];
      chartConfig[competitor.name] = {
        label: competitor.name,
        className: colorInfo.className,
        color: colorInfo.color,
      };
    }
  });

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">Competitor Position Comparison</h3>
        <p className="text-sm text-tertiary">
          Average keyword rankings compared to competitors over the last {days} days
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} className="text-tertiary [&_.recharts-text]:text-xs">
            <defs>
              <linearGradient id="gradient-own" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={OWN_DOMAIN_COLOR.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={OWN_DOMAIN_COLOR.color} stopOpacity={0} />
              </linearGradient>
              {validCompetitors.map((competitor, index) => {
                const colorInfo = CHART_COLORS[index % CHART_COLORS.length];
                return (
                  <linearGradient key={competitor.id} id={`gradient-${competitor.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colorInfo.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={colorInfo.color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-gray-100" />

            <Legend />

            <XAxis
              dataKey="date"
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              reversed
              domain={[1, "auto"]}
              fill="currentColor"
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="backdrop-blur-md bg-gray-900/90 border-white/20 shadow-2xl"
                />
              }
              cursor={{ className: "stroke-utility-brand-600 stroke-2" }}
            />

            {/* Own domain area */}
            <Area
              isAnimationActive={false}
              className={cx(chartConfig.own.className)}
              dataKey="own"
              name={chartConfig.own.label}
              type="monotone"
              stroke="currentColor"
              strokeWidth={2}
              fill="url(#gradient-own)"
              fillOpacity={1}
              connectNulls
            />

            {/* Competitor areas */}
            {validCompetitors.map((competitor, index) => {
              const colorInfo = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <Area
                  key={competitor.id}
                  isAnimationActive={false}
                  className={cx(colorInfo.className)}
                  dataKey={competitor.name}
                  name={competitor.name}
                  type="monotone"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill={`url(#gradient-${competitor.id})`}
                  fillOpacity={1}
                  connectNulls
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
