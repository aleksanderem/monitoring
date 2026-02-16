"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  PolarRadiusAxis,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Settings01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
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
  const t = useTranslations('backlinks');
  const radarColor = "#10b981"; // green
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        </div>
        <div className="h-[300px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
      </div>
    );
  }

  // Convert object to array for chart
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
          <h3 className="text-md font-semibold text-primary">{t('linkAttributesTitle')}</h3>
          <p className="text-sm text-tertiary">{t('linkAttributesSubtitle')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Settings01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">{t('linkAttributesEmpty')}</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    links: {
      label: t('links'),
      color: radarColor,
    },
  } satisfies ChartConfig;

  // Use bar chart when fewer than 3 attributes (radar chart needs >=3 axes)
  const useBarChart = chartData.length < 3;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">{t('linkAttributesTitle')}</h3>
        <p className="text-sm text-tertiary">{t('linkAttributesDescription')}</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        {useBarChart ? (
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="attribute" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip
              content={<ChartTooltipContent />}
              wrapperStyle={{ zIndex: 1000 }}
            />
            <Bar
              dataKey="links"
              fill={radarColor}
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        ) : (
          <RadarChart data={chartData}>
            <PolarGrid strokeDasharray="3 3" opacity={0.3} />
            <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, "auto"]} tick={{ fontSize: 10 }} />
            <ChartTooltip
              content={<ChartTooltipContent />}
              wrapperStyle={{ zIndex: 1000 }}
            />
            <Radar
              name={t('links')}
              dataKey="links"
              stroke={radarColor}
              fill={radarColor}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        )}
      </ChartContainer>

      <ChartLegend content={<ChartLegendContent payload={[]} />} />
    </div>
  );
}
