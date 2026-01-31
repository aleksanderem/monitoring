"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { LineChartUp01 } from "@untitledui/icons";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DateRangePicker, type DateRangeValue } from "@/components/common/DateRangePicker";
import { useDateRange } from "@/hooks/useDateRange";

interface BacklinksHistoryChartProps {
  data: Array<{ date: string; backlinks: number }>;
  isLoading?: boolean;
}

export function BacklinksHistoryChart({
  data,
  isLoading,
}: BacklinksHistoryChartProps) {
  const chartColor = "#3b82f6"; // Modern blue
  const comparisonColor = "#94a3b8"; // Slate for comparison
  const { dateRange, setDateRange, comparisonRange, setComparisonRange } = useDateRange({ initialPreset: "1y" });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-[300px] animate-pulse rounded bg-gray-50" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">Backlinks Over Time</h3>
          <p className="text-sm text-tertiary">Monthly backlink growth</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <LineChartUp01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No historical data available</p>
        </div>
      </div>
    );
  }

  // Filter data based on date range
  const filteredData = (() => {
    if (data.length === 0) return [];
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= dateRange.from && itemDate <= dateRange.to;
    });
  })();

  // Filter comparison data if comparison is enabled
  const comparisonData = comparisonRange ? (() => {
    if (data.length === 0) return [];
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= comparisonRange.from && itemDate <= comparisonRange.to;
    }).map((item) => ({
      ...item,
      comparison: item.backlinks,
    }));
  })() : [];

  // Merge data for comparison view
  const chartData = comparisonRange ?
    filteredData.map((item, index) => ({
      ...item,
      comparison: comparisonData[index]?.comparison,
    })) :
    filteredData;

  const chartConfig: ChartConfig = comparisonRange ? {
    backlinks: {
      label: "Current Period",
      color: chartColor,
    },
    comparison: {
      label: "Comparison Period",
      color: comparisonColor,
    },
  } : {
    backlinks: {
      label: "Backlinks",
      color: chartColor,
    },
  };

  const totalBacklinks = filteredData.reduce((sum, item) => sum + item.backlinks, 0);
  const totalComparisonBacklinks = comparisonData.reduce((sum, item) => sum + (item.comparison || 0), 0);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-primary">Backlinks Over Time</h3>
          <p className="text-sm text-tertiary">
            {totalBacklinks.toLocaleString()} total backlinks discovered
            {comparisonRange && totalComparisonBacklinks > 0 && (
              <span className="ml-2">
                (vs. {totalComparisonBacklinks.toLocaleString()} in comparison period)
              </span>
            )}
          </p>
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          comparisonEnabled
          comparisonValue={comparisonRange}
          onComparisonChange={setComparisonRange}
        />
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="fillBacklinks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
            </linearGradient>
            {comparisonRange && (
              <linearGradient id="fillComparison" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={comparisonColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={comparisonColor} stopOpacity={0.02} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
              });
            }}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  return new Date(value).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  });
                }}
                indicator="dot"
              />
            }
            wrapperStyle={{ zIndex: 1000 }}
          />
          {comparisonRange && (
            <Area
              dataKey="comparison"
              type="monotone"
              fill="url(#fillComparison)"
              stroke={comparisonColor}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          <Area
            dataKey="backlinks"
            type="monotone"
            fill="url(#fillBacklinks)"
            stroke={chartColor}
            strokeWidth={2}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
