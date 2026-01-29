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
