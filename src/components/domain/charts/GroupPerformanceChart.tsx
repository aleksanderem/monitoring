"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

interface GroupPerformanceChartProps {
  domainId: Id<"domains">;
  days?: number;
}

export function GroupPerformanceChart({ domainId, days = 30 }: GroupPerformanceChartProps) {
  const groupsPerformance = useQuery(api.keywordGroups_queries.getAllGroupsPerformance, {
    domainId,
    days,
  });

  if (groupsPerformance === undefined) {
    return <LoadingState type="card" />;
  }

  if (!groupsPerformance || groupsPerformance.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary p-12">
        <p className="text-sm font-medium text-tertiary">No groups created yet</p>
        <p className="mt-1 text-sm text-quaternary">Create keyword groups to see performance comparison</p>
      </div>
    );
  }

  // Combine all group histories into a single dataset
  const allDates = new Set<number>();
  groupsPerformance.forEach((group: any) => {
    group.history.forEach((point: any) => {
      allDates.add(point.date);
    });
  });

  const chartData = Array.from(allDates)
    .sort((a, b) => a - b)
    .map((date) => {
      const dataPoint: any = { date };
      groupsPerformance.forEach((group: any) => {
        const point = group.history.find((p: any) => p.date === date);
        dataPoint[group.name] = point?.avgPosition || null;
      });
      return dataPoint;
    });

  // Chart config for ChartContainer
  const chartConfig: any = {};
  groupsPerformance.forEach((group: any, index: number) => {
    chartConfig[group.name] = {
      label: group.name,
      color: group.color,
    };
  });

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">Group Performance Comparison</h3>
        <p className="text-sm text-tertiary">Average position over time for each group</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              reversed
              domain={[1, "auto"]}
              className="text-xs text-muted-foreground"
              label={{ value: "Position (lower is better)", angle: -90, position: "insideLeft" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            {groupsPerformance.map((group: any) => (
              <Line
                key={group.groupId}
                type="monotone"
                dataKey={group.name}
                stroke={group.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
