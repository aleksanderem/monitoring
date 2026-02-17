"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface BacklinkQualityComparisonChartProps {
  domainId: Id<"domains">;
}

const TIER_COLORS = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

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
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        <div className="mt-4 h-[300px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
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

  // Build per-domain rows: [highDR, mediumDR, lowDR]
  const rows = data.series.map((s) => {
    const name = s.name === "__own__" ? t("chartYourDomain") : s.name;
    const high = s.data[0] ?? 0;
    const medium = s.data[1] ?? 0;
    const low = s.data[2] ?? 0;
    const total = high + medium + low;
    return { name, high, medium, low, total, isOwn: s.name === "__own__" };
  });

  // Sort by total descending, own domain always first
  rows.sort((a, b) => {
    if (a.isOwn) return -1;
    if (b.isOwn) return 1;
    return b.total - a.total;
  });

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-primary">
          {t("backlinkQualityTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("backlinkQualityDescription")}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-5 text-xs text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TIER_COLORS.high }} />
          {t("backlinkQualityHigh")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TIER_COLORS.medium }} />
          {t("backlinkQualityMedium")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TIER_COLORS.low }} />
          {t("backlinkQualityLow")}
        </span>
      </div>

      {/* Stacked horizontal bars */}
      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const pctHigh = row.total > 0 ? (row.high / row.total) * 100 : 0;
          const pctMedium = row.total > 0 ? (row.medium / row.total) * 100 : 0;
          const pctLow = row.total > 0 ? (row.low / row.total) * 100 : 0;
          const barWidth = (row.total / maxTotal) * 100;

          return (
            <div key={row.name} className="group flex items-center gap-3">
              {/* Label */}
              <div
                className={`w-36 shrink-0 truncate text-right text-xs ${
                  row.isOwn ? "font-semibold text-primary" : "text-secondary"
                }`}
                title={row.name}
              >
                {row.name}
              </div>

              {/* Bar container */}
              <div className="relative flex-1">
                <div
                  className="flex h-6 overflow-hidden rounded-md transition-all"
                  style={{ width: `${Math.max(barWidth, 2)}%` }}
                >
                  {pctHigh > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pctHigh}%`, backgroundColor: TIER_COLORS.high }}
                      title={`${t("backlinkQualityHigh")}: ${row.high}`}
                    />
                  )}
                  {pctMedium > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pctMedium}%`, backgroundColor: TIER_COLORS.medium }}
                      title={`${t("backlinkQualityMedium")}: ${row.medium}`}
                    />
                  )}
                  {pctLow > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pctLow}%`, backgroundColor: TIER_COLORS.low }}
                      title={`${t("backlinkQualityLow")}: ${row.low}`}
                    />
                  )}
                </div>
              </div>

              {/* Total count */}
              <div className="w-16 shrink-0 text-right text-xs tabular-nums text-tertiary">
                {row.total.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
