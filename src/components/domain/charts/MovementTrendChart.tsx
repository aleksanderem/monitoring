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
