"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Globe01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface CountriesDistributionChartProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function CountriesDistributionChart({
  data,
  isLoading,
}: CountriesDistributionChartProps) {
  const t = useTranslations('backlinks');
  const barColor = "#10b981"; // Modern green
  if (isLoading) {
    return (
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
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
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div>
          <h3 className="text-md font-semibold text-primary">{t('countriesTitle')}</h3>
          <p className="text-sm text-tertiary">{t('countriesSubtitle')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Globe01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">{t('countriesEmpty')}</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    count: {
      label: t('backlinks'),
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div>
        <h3 className="text-md font-semibold text-primary">{t('countriesTitle')}</h3>
        <p className="text-sm text-tertiary">{t('countriesDescription')}</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 30 }}>
          <defs>
            <linearGradient id="barGradientCountry" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={barColor} stopOpacity={0.8} />
              <stop offset="100%" stopColor={barColor} stopOpacity={1} />
            </linearGradient>
          </defs>
          <XAxis type="number" dataKey="count" hide />
          <YAxis
            type="category"
            dataKey="country"
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            cursor={false}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Bar dataKey="count" fill="url(#barGradientCountry)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
