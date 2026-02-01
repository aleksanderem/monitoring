"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

interface CompetitorOverviewChartProps {
  domainId: Id<"domains">;
  days?: number;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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

  // Chart config for ChartContainer
  const chartConfig: any = {
    own: {
      label: "Your Domain",
      color: "hsl(var(--primary))",
    },
  };

  validCompetitors.forEach((competitor, index) => {
    if (competitor && competitor.name) {
      chartConfig[competitor.name] = {
        label: competitor.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
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
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              reversed
              domain={[1, "auto"]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              label={{
                value: "Position (lower is better)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
              }}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            />
            <Legend />

            {/* Own domain line - bold and distinctive */}
            <Line
              type="monotone"
              dataKey="own"
              stroke={chartConfig.own.color}
              strokeWidth={3}
              dot={{ r: 4 }}
              connectNulls
              name={chartConfig.own.label}
            />

            {/* Competitor lines */}
            {validCompetitors.map((competitor, index) => (
              <Line
                key={competitor.id}
                type="monotone"
                dataKey={competitor.name}
                stroke={chartConfig[competitor.name]?.color || CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                name={competitor.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
