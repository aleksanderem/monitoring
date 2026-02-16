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

interface TLDDistributionChartProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function TLDDistributionChart({ data, isLoading }: TLDDistributionChartProps) {
  const t = useTranslations('backlinks');
  const barColor = "#3b82f6"; // Modern blue
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

  // Convert object to array, sort by value descending, take top 10
  const chartData = Object.entries(data)
    .map(([tld, count]) => ({
      tld: `.${tld}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">{t('tldTitle')}</h3>
          <p className="text-sm text-tertiary">{t('tldSubtitle')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Globe01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">{t('tldEmpty')}</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    count: {
      label: t('backlinks'),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">{t('tldTitle')}</h3>
        <p className="text-sm text-tertiary">{t('tldDescription')}</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <defs>
            <linearGradient id="barGradientTLD" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={barColor} stopOpacity={0.8} />
              <stop offset="100%" stopColor={barColor} stopOpacity={1} />
            </linearGradient>
          </defs>
          <XAxis type="number" dataKey="count" hide />
          <YAxis
            type="category"
            dataKey="tld"
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            cursor={false}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Bar dataKey="count" fill="url(#barGradientTLD)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
