"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, PolarRadiusAxis } from "recharts";
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
  const radarColor = "#10b981"; // green
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

  // Convert object to array for radar chart
  const chartData = data
    ? Object.entries(data)
        .map(([name, value]) => ({
          attribute: name.charAt(0).toUpperCase() + name.slice(1),
          links: value,
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

  const chartConfig = {
    links: {
      label: "Links",
      color: radarColor,
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">Link Attributes</h3>
        <p className="text-sm text-tertiary">Nofollow, noopener, and other attributes</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <RadarChart data={chartData}>
          <PolarGrid strokeDasharray="3 3" opacity={0.3} />
          <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, "auto"]} tick={{ fontSize: 10 }} />
          <ChartTooltip
            content={<ChartTooltipContent />}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Radar
            name="Links"
            dataKey="links"
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
