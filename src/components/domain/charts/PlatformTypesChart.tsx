"use client";

import { Pie, PieChart } from "recharts";
import { Dataflow03 } from "@untitledui/icons";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface PlatformTypesChartProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function PlatformTypesChart({ data, isLoading }: PlatformTypesChartProps) {
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

  // Convert object to array and sort
  const chartData = Object.entries(data)
    .map(([name, value]) => ({
      platform: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "),
      backlinks: value,
      fill: `var(--color-${name})`,
    }))
    .sort((a, b) => b.backlinks - a.backlinks);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">Platform Types</h3>
          <p className="text-sm text-tertiary">Distribution by website platform</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Dataflow03 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No platform data available</p>
        </div>
      </div>
    );
  }

  // Create chart config with colors using chart CSS variables
  const chartConfig = Object.entries(data).reduce((acc, [key], index) => {
    const colorVars = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
    acc[key] = {
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " "),
      color: `var(--${colorVars[index % colorVars.length]})`,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">Platform Types</h3>
        <p className="text-sm text-tertiary">Backlink sources by platform</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Pie
            data={chartData}
            dataKey="backlinks"
            nameKey="platform"
            innerRadius={60}
            strokeWidth={5}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
