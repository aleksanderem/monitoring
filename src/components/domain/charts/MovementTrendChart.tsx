"use client";

import { useQuery } from "convex/react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { LoadingState } from "@/components/shared/LoadingState";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface MovementTrendChartProps {
  domainId: Id<"domains">;
}

export function MovementTrendChart({ domainId }: MovementTrendChartProps) {
  const t = useTranslations("keywords");
  const isDesktop = useBreakpoint("lg");
  const trend = useQuery(api.keywords.getMovementTrend, { domainId, days: 30 });

  if (trend === undefined) {
    return (
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <h3 className="text-sm font-semibold text-primary">{t("positionMovementTrend")}</h3>
        <LoadingState type="card" />
      </div>
    );
  }

  // Check if there's no historical data yet
  if (trend.length === 0) {
    return (
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <h3 className="text-sm font-semibold text-primary">{t("positionMovementTrend")}</h3>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="h-12 w-12 text-tertiary mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p className="text-sm font-medium text-primary">{t("noHistoricalDataYet")}</p>
          <p className="text-sm text-tertiary mt-1">{t("refreshToFetchHistory")}</p>
        </div>
      </div>
    );
  }

  const chartData = trend.map((point) => ({
    date: new Date(point.date),
    Gainers: point.gainers,
    Losers: point.losers,
  }));

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <h3 className="text-sm font-semibold text-primary">{t('positionMovementTrend')}</h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            className="text-tertiary [&_.recharts-text]:text-xs"
            margin={{ top: isDesktop ? 12 : 6, bottom: isDesktop ? 16 : 0, left: 0, right: 0 }}
          >
            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-gray-100" />

            <Legend
              align="right"
              verticalAlign="top"
              layout={isDesktop ? "vertical" : "horizontal"}
              content={<ChartLegendContent className="-translate-y-2" />}
            />

            <XAxis
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              dataKey="date"
              tickFormatter={(value) => value.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              padding={{ left: 10, right: 10 }}
            />

            <YAxis
              fill="currentColor"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => Number(value).toLocaleString()}
            />

            <Tooltip
              content={<ChartTooltipContent />}
              formatter={(value: any) => Number(value).toLocaleString()}
              labelFormatter={(value: any) => value.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            />

            <Line
              type="monotone"
              dataKey="Gainers"
              stroke="currentColor"
              strokeWidth={2}
              className="stroke-utility-success-600"
              dot={false}
              activeDot={{ className: "fill-bg-primary stroke-utility-success-600 stroke-2" }}
            />

            <Line
              type="monotone"
              dataKey="Losers"
              stroke="currentColor"
              strokeWidth={2}
              className="stroke-utility-error-600"
              dot={false}
              activeDot={{ className: "fill-bg-primary stroke-utility-error-600 stroke-2" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
