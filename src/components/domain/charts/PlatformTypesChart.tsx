"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, PolarRadiusAxis } from "recharts";
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
  const radarColor = "#3b82f6"; // blue
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

  // Convert object to array for radar chart (take top 8 for readability)
  const chartData = Object.entries(data)
    .map(([name, value]) => ({
      platform: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "),
      backlinks: value,
    }))
    .sort((a, b) => b.backlinks - a.backlinks)
    .slice(0, 8);

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

  const chartConfig = {
    backlinks: {
      label: "Backlinks",
      color: radarColor,
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">Platform Types</h3>
        <p className="text-sm text-tertiary">Backlink sources by platform</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <RadarChart data={chartData}>
          <PolarGrid strokeDasharray="3 3" opacity={0.3} />
          <PolarAngleAxis dataKey="platform" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, "auto"]} tick={{ fontSize: 10 }} />
          <ChartTooltip
            content={<ChartTooltipContent />}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Radar
            name="Backlinks"
            dataKey="backlinks"
            stroke={radarColor}
            fill={radarColor}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}
