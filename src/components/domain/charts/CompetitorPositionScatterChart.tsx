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

interface CompetitorPositionScatterChartProps {
  domainId: Id<"domains">;
}

function CustomTooltip({ active, payload, t }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  const total = data.youLead + data.tied + data.theyLead;
  return (
    <div className="rounded-lg border border-secondary bg-primary px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-primary">{data.competitor}</p>
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-tertiary">
          {t("winRateYouLead")}:{" "}
          <span className="font-medium text-green-600">
            {data.youLead} ({total > 0 ? Math.round((data.youLead / total) * 100) : 0}%)
          </span>
        </p>
        <p className="text-xs text-tertiary">
          {t("winRateTied")}:{" "}
          <span className="font-medium text-primary">{data.tied}</span>
        </p>
        <p className="text-xs text-tertiary">
          {t("winRateTheyLead")}:{" "}
          <span className="font-medium text-red-500">
            {data.theyLead} ({total > 0 ? Math.round((data.theyLead / total) * 100) : 0}%)
          </span>
        </p>
        <p className="mt-1 text-xs text-quaternary">
          {t("winRateTotal")}: {total}
        </p>
      </div>
    </div>
  );
}

export function CompetitorPositionScatterChart({
  domainId,
}: CompetitorPositionScatterChartProps) {
  const t = useTranslations("competitors");
  const data = useQuery(
    api.competitorComparison_queries.getPositionScatterData,
    { domainId }
  );

  if (data === undefined) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-[300px] animate-pulse rounded bg-gray-50" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary bg-secondary/50 p-12">
        <p className="text-sm font-medium text-tertiary">
          {t("chartNoData")}
        </p>
      </div>
    );
  }

  // Aggregate: for each competitor, count wins / ties / losses
  const TIED_THRESHOLD = 3; // positions within 3 = tied
  const competitorStats = new Map<
    string,
    { youLead: number; tied: number; theyLead: number }
  >();

  for (const point of data) {
    const stats = competitorStats.get(point.competitorName) || {
      youLead: 0,
      tied: 0,
      theyLead: 0,
    };
    const diff = point.competitorPosition - point.yourPosition;
    if (diff > TIED_THRESHOLD) {
      stats.youLead++;
    } else if (diff < -TIED_THRESHOLD) {
      stats.theyLead++;
    } else {
      stats.tied++;
    }
    competitorStats.set(point.competitorName, stats);
  }

  const chartData = Array.from(competitorStats.entries()).map(
    ([competitor, stats]) => ({
      competitor,
      ...stats,
    })
  );

  const chartHeight = Math.max(200, chartData.length * 60 + 80);

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("winRateTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("winRateDescription")}
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
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="competitor"
            width={120}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip t={t} />} />
          <Legend />
          <Bar
            dataKey="youLead"
            name={t("winRateYouLead")}
            stackId="stack"
            fill="#10b981"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="tied"
            name={t("winRateTied")}
            stackId="stack"
            fill="#d1d5db"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="theyLead"
            name={t("winRateTheyLead")}
            stackId="stack"
            fill="#ef4444"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
