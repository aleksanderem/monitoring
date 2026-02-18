"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { LineChartUp01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { useDateRange } from "@/hooks/useDateRange";

interface BacklinksHistoryChartProps {
  domainId: Id<"domains">;
}

export function BacklinksHistoryChart({ domainId }: BacklinksHistoryChartProps) {
  const t = useTranslations("backlinks");
  const chartColor = "#3b82f6";
  const comparisonColor = "#94a3b8";
  const { dateRange, setDateRange, comparisonRange, setComparisonRange } =
    useDateRange({ initialPreset: "1y" });

  // Determine granularity from range span
  const rangeDays = Math.ceil(
    (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
  );
  const granularity: "daily" | "monthly" = rangeDays <= 90 ? "daily" : "monthly";

  const data = useQuery(api.backlinks.getBacklinksHistory, {
    domainId,
    granularity,
  });

  if (data === undefined) {
    return (
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
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
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div>
          <h3 className="text-md font-semibold text-primary">
            {t("historyTitle")}
          </h3>
          <p className="text-sm text-tertiary">{t("historySubtitle")}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <LineChartUp01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">{t("historyEmpty")}</p>
        </div>
      </div>
    );
  }

  // Filter data based on date range
  const filteredData = data.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= dateRange.from && itemDate <= dateRange.to;
  });

  // Filter comparison data if comparison is enabled
  const comparisonData = comparisonRange
    ? data
        .filter((item) => {
          const itemDate = new Date(item.date);
          return (
            itemDate >= comparisonRange.from && itemDate <= comparisonRange.to
          );
        })
        .map((item) => ({ ...item, comparison: item.backlinks }))
    : [];

  // Merge data for comparison view
  const chartData = comparisonRange
    ? filteredData.map((item, index) => ({
        ...item,
        comparison: comparisonData[index]?.comparison,
      }))
    : filteredData;

  const chartConfig: ChartConfig = comparisonRange
    ? {
        backlinks: {
          label: t("historyCurrentPeriod"),
          color: chartColor,
        },
        comparison: {
          label: t("historyComparisonPeriod"),
          color: comparisonColor,
        },
      }
    : {
        backlinks: {
          label: t("backlinks"),
          color: chartColor,
        },
      };

  const totalBacklinks = filteredData.reduce(
    (sum, item) => sum + item.backlinks,
    0
  );
  const totalComparisonBacklinks = comparisonData.reduce(
    (sum, item) => sum + (item.comparison || 0),
    0
  );

  // Adapt tick formatter to granularity
  const tickFormatter = (value: string) => {
    const date = new Date(value);
    if (granularity === "daily") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  const tooltipLabelFormatter = (value: string) => {
    const date = new Date(value);
    if (granularity === "daily") {
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-primary">
            {t("historyTitle")}
          </h3>
          <p className="text-sm text-tertiary">
            {t("historyDescription", {
              total: totalBacklinks.toLocaleString(),
            })}
            {comparisonRange && totalComparisonBacklinks > 0 && (
              <span className="ml-2">
                {t("historyComparison", {
                  total: totalComparisonBacklinks.toLocaleString(),
                })}
              </span>
            )}
          </p>
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          comparisonEnabled
          comparisonValue={comparisonRange}
          onComparisonChange={setComparisonRange}
        />
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="fillBacklinks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
            </linearGradient>
            {comparisonRange && (
              <linearGradient
                id="fillComparison"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={comparisonColor}
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor={comparisonColor}
                  stopOpacity={0.02}
                />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            opacity={0.3}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={tickFormatter}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={tooltipLabelFormatter}
                indicator="dot"
              />
            }
            wrapperStyle={{ zIndex: 1000 }}
          />
          {comparisonRange && (
            <Area
              dataKey="comparison"
              type="monotone"
              fill="url(#fillComparison)"
              stroke={comparisonColor}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          <Area
            dataKey="backlinks"
            type="monotone"
            fill="url(#fillBacklinks)"
            stroke={chartColor}
            strokeWidth={2}
          />
          <ChartLegend content={<ChartLegendContent payload={[]} />} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
