"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { GradientChartTooltip } from "@/components/application/charts/charts-base";

interface KeywordPositionChartProps {
  positionHistory: Array<{ date: number; position: number }>;
}

export function KeywordPositionChart({ positionHistory }: KeywordPositionChartProps) {
  const t = useTranslations("keywords");
  const chartData = useMemo(() => {
    if (!positionHistory || positionHistory.length === 0) return [];

    return [...positionHistory]
      .sort((a, b) => a.date - b.date)
      .map((item) => ({
        date: item.date,
        position: item.position,
      }));
  }, [positionHistory]);

  // Auto-scale Y-axis: pad the range around actual data instead of hardcoding [1, 100]
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [1, 20];
    const positions = chartData.map((d) => d.position);
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const range = Math.max(maxPos - minPos, 5);
    const padding = Math.max(Math.ceil(range * 0.2), 2);
    return [Math.max(1, minPos - padding), maxPos + padding];
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-secondary bg-secondary/20">
        <p className="text-sm text-tertiary">{t("noPositionHistoryAvailable")}</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          className="text-tertiary [&_.recharts-text]:text-xs"
          margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
        >
          <defs>
            <linearGradient id="positionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" className="text-utility-brand-600" stopOpacity={0.3} />
              <stop offset="95%" stopColor="currentColor" className="text-utility-brand-600" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="currentColor" className="text-secondary" strokeOpacity={0.3} />

          <XAxis
            fill="currentColor"
            axisLine={false}
            tickLine={false}
            dataKey="date"
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            padding={{ left: 10, right: 10 }}
          />

          <YAxis
            fill="currentColor"
            axisLine={false}
            tickLine={false}
            reversed
            domain={yDomain}
            width={40}
          />

          <Tooltip
            content={<GradientChartTooltip />}
            formatter={(value: number | undefined) =>
              value !== undefined ? [`#${value}`, t("columnPosition")] : ["-", t("columnPosition")]
            }
            labelFormatter={(value: any) =>
              new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            }
            cursor={{
              className: "stroke-utility-brand-600 stroke-1",
            }}
          />

          <Area
            isAnimationActive={false}
            className="text-utility-brand-600"
            dataKey="position"
            name={t("columnPosition")}
            type="monotone"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#positionGradient)"
            fillOpacity={1}
            baseValue={yDomain[1]}
            dot={chartData.length <= 30 ? {
              r: 3,
              fill: "currentColor",
              className: "text-utility-brand-600",
              strokeWidth: 0,
            } : false}
            activeDot={{
              className: "fill-bg-primary stroke-utility-brand-600 stroke-2",
              r: 5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
