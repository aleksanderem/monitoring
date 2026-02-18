"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";

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
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        position: item.position,
      }));
  }, [positionHistory]);

  // Auto-scale Y-axis: pad the range around actual data instead of hardcoding [1, 100]
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [1, 20];
    const positions = chartData.map((d) => d.position);
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    // Pad by ~20% on each side, minimum range of 5
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
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            fontSize={12}
            tickLine={false}
            reversed
            domain={yDomain}
            label={{ value: t("columnPosition"), angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: 12 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#F9FAFB',
            }}
            labelStyle={{ color: '#F9FAFB' }}
            formatter={(value: number | undefined) => value !== undefined ? [`#${value}`, t("columnPosition")] : ['-', t("columnPosition")]}
          />
          <Line
            type="monotone"
            dataKey="position"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
