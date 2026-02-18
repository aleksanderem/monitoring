"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface CompetitorBacklinkRadarChartProps {
  domainId: Id<"domains">;
}

const DOMAIN_COLORS = [
  "#6366f1", // own — indigo
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
];

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
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        <div className="mt-4 h-[350px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
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

  // Build entity list: own domain + competitors
  const competitorNames = data[0]?.competitors?.map((c) => c.name) ?? [];
  const entities = [
    { name: t("chartYourDomain"), isOwn: true },
    ...competitorNames.map((name) => ({ name, isOwn: false })),
  ];

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-primary">
          {t("backlinkRadarTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("backlinkRadarDescription")}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {entities.map((entity, i) => (
          <span key={entity.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }}
            />
            <span className={entity.isOwn ? "font-semibold text-primary" : "text-secondary"}>
              {entity.name}
            </span>
          </span>
        ))}
      </div>

      {/* Metric comparison rows */}
      <div className="flex flex-col gap-5">
        {data.map((item) => {
          const label = t(METRIC_LABEL_KEYS[item.metric] ?? item.metric);
          const allValues = [item.yourValue, ...item.competitors.map((c) => c.value)];
          const maxValue = Math.max(...allValues, 1);

          return (
            <div key={item.metric}>
              <div className="mb-2 text-xs font-medium text-secondary">{label}</div>
              <div className="flex flex-col gap-1.5">
                {/* Own domain */}
                <MetricBar
                  name={t("chartYourDomain")}
                  value={item.yourValue}
                  max={maxValue}
                  color={DOMAIN_COLORS[0]}
                  isOwn
                />
                {/* Competitors */}
                {item.competitors.map((comp, ci) => (
                  <MetricBar
                    key={comp.name}
                    name={comp.name}
                    value={comp.value}
                    max={maxValue}
                    color={DOMAIN_COLORS[(ci + 1) % DOMAIN_COLORS.length]}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricBar({
  name,
  value,
  max,
  color,
  isOwn,
}: {
  name: string;
  value: number;
  max: number;
  color: string;
  isOwn?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-28 shrink-0 truncate text-right text-[11px] ${
          isOwn ? "font-semibold text-primary" : "text-tertiary"
        }`}
        title={name}
      >
        {name}
      </div>
      <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-secondary/30">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{
            width: `${Math.max(pct, 0.5)}%`,
            backgroundColor: color,
            opacity: isOwn ? 1 : 0.7,
          }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-[11px] tabular-nums text-tertiary">
        {Math.round(value)}
      </div>
    </div>
  );
}
