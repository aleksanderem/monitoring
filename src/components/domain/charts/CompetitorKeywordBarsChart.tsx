"use client";

import { useQuery } from "convex/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CompetitorKeywordBarsChartProps {
  domainId: Id<"domains">;
}

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];
const OWN_DOMAIN_COLOR = "#374151";

export function CompetitorKeywordBarsChart({
  domainId,
}: CompetitorKeywordBarsChartProps) {
  const t = useTranslations("competitors");
  const data = useQuery(
    api.competitorComparison_queries.getKeywordPositionBars,
    { domainId }
  );

  if (data === undefined) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-[400px] animate-pulse rounded bg-gray-50" />
      </div>
    );
  }

  if (!data || data.keywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary bg-secondary/50 p-12">
        <p className="text-sm font-medium text-tertiary">
          {t("chartNoData")}
        </p>
      </div>
    );
  }

  // Convert positions to ranking scores: 101 - position (higher = better)
  // Null positions become 0 (not ranking)
  const chartData = data.keywords.map((keyword, i) => {
    const point: Record<string, string | number> = { keyword };
    for (const s of data.series) {
      const label =
        s.name === "__own__" ? t("chartYourDomain") : s.name;
      const pos = s.positions[i];
      point[label] = pos != null ? 101 - pos : 0;
    }
    return point;
  });

  const entityNames = data.series.map((s) =>
    s.name === "__own__" ? t("chartYourDomain") : s.name
  );

  // Dynamic height: 40px per keyword + padding
  const chartHeight = Math.max(300, data.keywords.length * 40 + 60);

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("keywordBarsTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("keywordBarsDescription")}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            opacity={0.15}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `#${101 - v}`}
            label={{
              value: t("chartPosition"),
              position: "insideBottom",
              offset: -5,
              style: { fontSize: 11 },
            }}
          />
          <YAxis
            type="category"
            dataKey="keyword"
            width={120}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border-secondary)",
              backgroundColor: "var(--color-bg-primary)",
            }}
            formatter={(value: any) => {
              if (value === 0) return t("keywordGapNotRanking");
              const pos = 101 - (value as number);
              return `#${pos}`;
            }}
          />
          <Legend />
          {entityNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              fill={
                i === 0
                  ? OWN_DOMAIN_COLOR
                  : CHART_COLORS[(i - 1) % CHART_COLORS.length]
              }
              radius={[0, 4, 4, 0]}
              barSize={8}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
