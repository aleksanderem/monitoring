"use client";

import { api } from "../../../../convex/_generated/api";
import { useAnalyticsQuery } from "@/hooks/useAnalyticsQuery";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { LoadingState } from "@/components/shared/LoadingState";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

interface GroupPerformanceChartProps {
  domainId: Id<"domains">;
  days?: number;
}

export function GroupPerformanceChart({ domainId, days = 30 }: GroupPerformanceChartProps) {
  const t = useTranslations('keywords');
  const { data: groupsPerformance, isLoading } = useAnalyticsQuery<
    Array<{
      groupId: string;
      name: string;
      color: string | undefined;
      history: Array<{ date: number; avgPosition: number }>;
    }>
  >(api.keywordGroups_queries.getAllGroupsPerformance, { domainId, days });

  if (isLoading) {
    return <LoadingState type="card" />;
  }

  if (!groupsPerformance || groupsPerformance.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary p-12">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <p className="text-sm font-medium text-tertiary">{t('noGroupsCreatedYet')}</p>
        <p className="mt-1 text-sm text-quaternary">{t('createGroupsToSeePerformance')}</p>
      </div>
    );
  }

  // Combine all group histories into a single dataset
  const allDates = new Set<number>();
  groupsPerformance.forEach((group: any) => {
    group.history.forEach((point: any) => {
      allDates.add(point.date);
    });
  });

  const chartData = Array.from(allDates)
    .sort((a, b) => a - b)
    .map((date) => {
      const dataPoint: any = { date };
      groupsPerformance.forEach((group: any) => {
        const point = group.history.find((p: any) => p.date === date);
        dataPoint[group.name] = point?.avgPosition || null;
      });
      return dataPoint;
    });

  // Chart config for ChartContainer
  const chartConfig: any = {};
  groupsPerformance.forEach((group: any, index: number) => {
    chartConfig[group.name] = {
      label: group.name,
      color: group.color,
    };
  });

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">{t('groupPerformanceComparison')}</h3>
        <p className="text-sm text-tertiary">{t('groupPerformanceDescription')}</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              reversed
              domain={[1, "auto"]}
              className="text-xs text-muted-foreground"
              label={{ value: t('positionLowerIsBetter'), angle: -90, position: "insideLeft" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            {groupsPerformance.map((group: any) => (
              <Line
                key={group.groupId}
                type="monotone"
                dataKey={group.name}
                stroke={group.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
