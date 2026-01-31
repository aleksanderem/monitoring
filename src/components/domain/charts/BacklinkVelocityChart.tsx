"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, ComposedChart } from "recharts";
import { TrendUp01 } from "@untitledui/icons";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface VelocityData {
  date: string;
  newBacklinks: number;
  lostBacklinks: number;
  netChange: number;
}

interface BacklinkVelocityChartProps {
  data: VelocityData[];
  isLoading?: boolean;
}

export function BacklinkVelocityChart({
  data,
  isLoading,
}: BacklinkVelocityChartProps) {
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
          <h3 className="text-md font-semibold text-primary">Backlink Velocity</h3>
          <p className="text-sm text-tertiary">Daily new and lost backlinks</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <TrendUp01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No velocity data available yet</p>
          <p className="mt-1 text-xs text-quaternary">
            Velocity tracking starts after the first backlink refresh
          </p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    newBacklinks: {
      label: "New Backlinks",
      color: "hsl(var(--chart-2))", // Green
    },
    lostBacklinks: {
      label: "Lost Backlinks",
      color: "hsl(var(--chart-1))", // Red
    },
    netChange: {
      label: "Net Change",
      color: "hsl(var(--chart-3))", // Blue
    },
  } satisfies ChartConfig;

  const totalNew = data.reduce((sum, item) => sum + item.newBacklinks, 0);
  const totalLost = data.reduce((sum, item) => sum + item.lostBacklinks, 0);
  const netChange = totalNew - totalLost;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-primary">Backlink Velocity</h3>
          <p className="text-sm text-tertiary">
            {totalNew} gained, {totalLost} lost (
            <span className={netChange >= 0 ? "text-green-600" : "text-red-600"}>
              {netChange >= 0 ? "+" : ""}
              {netChange} net
            </span>
            )
          </p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ComposedChart data={data}>
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
                day: "numeric",
              });
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => `${value}`}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  return new Date(value).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                }}
                indicator="dot"
              />
            }
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Bar
            dataKey="newBacklinks"
            fill="var(--color-newBacklinks)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="lostBacklinks"
            fill="var(--color-lostBacklinks)"
            radius={[4, 4, 0, 0]}
          />
          <Line
            dataKey="netChange"
            type="monotone"
            stroke="var(--color-netChange)"
            strokeWidth={2}
            dot={{
              fill: "var(--color-netChange)",
              r: 3,
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
