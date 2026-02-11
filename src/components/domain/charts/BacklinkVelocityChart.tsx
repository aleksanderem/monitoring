"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, ComposedChart } from "recharts";
import { TrendUp01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
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
  const t = useTranslations('backlinks');
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-quaternary" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-quaternary" />
          </div>
        </div>
        <div className="h-[300px] animate-pulse rounded bg-secondary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">{t('velocityTitle')}</h3>
          <p className="text-sm text-tertiary">{t('velocitySubtitle')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <TrendUp01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">{t('velocityEmpty')}</p>
          <p className="mt-1 text-xs text-quaternary">
            {t('velocityEmptyHint')}
          </p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    newBacklinks: {
      label: t('velocityNewBacklinks'),
      color: "#22c55e",
    },
    lostBacklinks: {
      label: t('velocityLostBacklinks'),
      color: "#ef4444",
    },
    netChange: {
      label: t('velocityNetChange'),
      color: "#3b82f6",
    },
  } satisfies ChartConfig;

  const totalNew = data.reduce((sum, item) => sum + item.newBacklinks, 0);
  const totalLost = data.reduce((sum, item) => sum + item.lostBacklinks, 0);
  const netChange = totalNew - totalLost;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-primary">{t('velocityTitle')}</h3>
          <p className="text-sm text-tertiary">
            {t('velocityDescription', { gained: totalNew, lost: totalLost })} (
            <span className={netChange >= 0 ? "text-green-600" : "text-red-600"}>
              {netChange >= 0 ? "+" : ""}
              {netChange} {t('velocityNet')}
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
            fill="#22c55e"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="lostBacklinks"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
          />
          <Line
            dataKey="netChange"
            type="monotone"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{
              fill: "#3b82f6",
              r: 3,
            }}
          />
          <ChartLegend content={<ChartLegendContent payload={[]} />} />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
