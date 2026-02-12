"use client";

import { useQuery } from "convex/react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CompetitorBacklinkRadarChartProps {
  domainId: Id<"domains">;
}

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];
const OWN_DOMAIN_COLOR = "#374151";

const METRIC_LABEL_KEYS: Record<string, string> = {
  totalBacklinks: "backlinkRadarTotalBacklinks",
  referringDomains: "backlinkRadarRefDomains",
  dofollowRatio: "backlinkRadarDofollow",
  avgDomainRank: "backlinkRadarDomainRank",
  freshBacklinksRatio: "backlinkRadarFreshLinks",
};

export function CompetitorBacklinkRadarChart({
  domainId,
}: CompetitorBacklinkRadarChartProps) {
  const t = useTranslations("competitors");
  const data = useQuery(
    api.competitorComparison_queries.getBacklinkRadarData,
    { domainId }
  );

  if (data === undefined) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-[350px] animate-pulse rounded bg-gray-50" />
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

  // Transform data for RadarChart: each metric becomes a data point
  const competitorNames =
    data[0]?.competitors?.map((c) => c.name) ?? [];

  const chartData = data.map((item) => {
    const point: Record<string, string | number> = {
      metric: t(METRIC_LABEL_KEYS[item.metric] ?? item.metric),
    };
    point[t("chartYourDomain")] = item.yourValue;
    for (const comp of item.competitors) {
      point[comp.name] = comp.value;
    }
    return point;
  });

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("backlinkRadarTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("backlinkRadarDescription")}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid strokeOpacity={0.2} />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border-secondary)",
              backgroundColor: "var(--color-bg-primary)",
            }}
          />
          <Legend />
          <Radar
            name={t("chartYourDomain")}
            dataKey={t("chartYourDomain")}
            stroke={OWN_DOMAIN_COLOR}
            fill={OWN_DOMAIN_COLOR}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          {competitorNames.map((name, i) => (
            <Radar
              key={name}
              name={name}
              dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
