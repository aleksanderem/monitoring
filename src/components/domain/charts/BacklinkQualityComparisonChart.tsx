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

interface BacklinkQualityComparisonChartProps {
  domainId: Id<"domains">;
}

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];
const OWN_DOMAIN_COLOR = "#374151";

export function BacklinkQualityComparisonChart({
  domainId,
}: BacklinkQualityComparisonChartProps) {
  const t = useTranslations("competitors");
  const data = useQuery(
    api.competitorComparison_queries.getBacklinkQualityComparison,
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

  if (!data || data.series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary bg-secondary/50 p-12">
        <p className="text-sm font-medium text-tertiary">
          {t("chartNoData")}
        </p>
      </div>
    );
  }

  const tierLabelKeys: Record<string, string> = {
    "High DR (60+)": "backlinkQualityHigh",
    "Medium DR (30-59)": "backlinkQualityMedium",
    "Low DR (0-29)": "backlinkQualityLow",
  };

  // Transform: each tier is a data point with bars for each entity
  const chartData = data.tiers.map((tier, i) => {
    const point: Record<string, string | number> = {
      tier: t(tierLabelKeys[tier] ?? tier),
    };
    for (const s of data.series) {
      const label =
        s.name === "__own__" ? t("chartYourDomain") : s.name;
      point[label] = s.data[i];
    }
    return point;
  });

  const entityNames = data.series.map((s) =>
    s.name === "__own__" ? t("chartYourDomain") : s.name
  );

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("backlinkQualityTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("backlinkQualityDescription")}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border-secondary)",
              backgroundColor: "var(--color-bg-primary)",
            }}
          />
          <Legend />
          {entityNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              fill={
                i === 0 ? OWN_DOMAIN_COLOR : CHART_COLORS[(i - 1) % CHART_COLORS.length]
              }
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
