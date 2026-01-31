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
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { useDateRange } from "@/hooks/useDateRange";

interface PositionHistoryChartProps {
  domainId: Id<"domains">;
}

export function PositionHistoryChart({ domainId }: PositionHistoryChartProps) {
  const { dateRange, setDateRange } = useDateRange({ initialPreset: "all" });
  const isDesktop = useBreakpoint("lg");

  // Convert preset to days for API
  const days = dateRange.preset === "all" ? undefined :
    dateRange.preset === "7d" ? 7 :
    dateRange.preset === "30d" ? 30 :
    dateRange.preset === "3m" ? 90 :
    dateRange.preset === "6m" ? 180 :
    dateRange.preset === "1y" ? 365 :
    undefined;

  const history = useQuery(
    api.domains.getVisibilityHistory,
    { domainId, days }
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
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
        />
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
