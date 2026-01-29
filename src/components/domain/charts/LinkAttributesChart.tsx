"use client";

import { Pie, PieChart } from "recharts";
import { Settings01 } from "@untitledui/icons";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface LinkAttributesChartProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function LinkAttributesChart({ data, isLoading }: LinkAttributesChartProps) {
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
  const chartData = data
    ? Object.entries(data)
        .map(([name, value]) => ({
          attribute: name.charAt(0).toUpperCase() + name.slice(1),
          links: value,
          fill: `var(--color-${name})`,
        }))
        .sort((a, b) => b.links - a.links)
    : [];

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">Link Attributes</h3>
          <p className="text-sm text-tertiary">Distribution of link attributes</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Settings01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No attributes data available</p>
        </div>
      </div>
    );
  }

  // Create chart config with colors
  const chartConfig = data
    ? Object.entries(data).reduce((acc, [key], index) => {
        const colors = [
          "hsl(var(--chart-1))",
          "hsl(var(--chart-2))",
          "hsl(var(--chart-3))",
          "hsl(var(--chart-4))",
          "hsl(var(--chart-5))",
        ];
        acc[key] = {
          label: key.charAt(0).toUpperCase() + key.slice(1),
          color: colors[index % colors.length],
        };
        return acc;
      }, {} as ChartConfig)
    : {};

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">Link Attributes</h3>
        <p className="text-sm text-tertiary">Nofollow, noopener, and other attributes</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Pie
            data={chartData}
            dataKey="links"
            nameKey="attribute"
            innerRadius={60}
            strokeWidth={5}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
