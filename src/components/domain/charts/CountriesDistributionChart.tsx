"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Globe01 } from "@untitledui/icons";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface CountriesDistributionChartProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function CountriesDistributionChart({
  data,
  isLoading,
}: CountriesDistributionChartProps) {
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

  // Convert object to array, filter out empty strings, sort by value descending, take top 10
  const chartData = Object.entries(data)
    .filter(([country]) => country && country.trim() !== "")
    .map(([country, count]) => ({
      country: country === "WW" ? "Worldwide" : country,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">Countries Distribution</h3>
          <p className="text-sm text-tertiary">Geographic distribution of backlinks</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Globe01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No country data available</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    count: {
      label: "Backlinks",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">Countries Distribution</h3>
        <p className="text-sm text-tertiary">Top 10 countries by backlink count</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 30 }}>
          <XAxis type="number" dataKey="count" hide />
          <YAxis
            type="category"
            dataKey="country"
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
