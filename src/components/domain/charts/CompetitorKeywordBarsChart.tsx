"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CompetitorKeywordBarsChartProps {
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
  "#84cc16",
  "#14b8a6",
];

function getPositionStyle(pos: number | null): { bg: string; text: string } {
  if (pos == null) return { bg: "bg-transparent", text: "text-quaternary" };
  if (pos <= 3) return { bg: "bg-utility-success-50", text: "text-utility-success-700" };
  if (pos <= 10) return { bg: "bg-utility-success-50/60", text: "text-utility-success-600" };
  if (pos <= 20) return { bg: "bg-utility-warning-50", text: "text-utility-warning-700" };
  if (pos <= 50) return { bg: "bg-utility-gray-50", text: "text-utility-gray-600" };
  return { bg: "bg-utility-error-50/60", text: "text-utility-error-600" };
}

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
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        <div className="mt-4 h-[400px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
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

  const entities = data.series.map((s, i) => ({
    name: s.name === "__own__" ? t("chartYourDomain") : s.name,
    isOwn: s.name === "__own__",
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
    positions: s.positions,
  }));

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-primary">
          {t("keywordBarsTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("keywordBarsDescription")}
        </p>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-secondary">
              <th className="sticky left-0 z-10 bg-primary px-3 py-2.5 text-left font-medium text-tertiary">
                {t("chartKeyword") ?? "Keyword"}
              </th>
              {entities.map((entity) => (
                <th
                  key={entity.name}
                  className="px-2 py-2.5 text-center font-medium whitespace-nowrap"
                  style={{ color: entity.color }}
                  title={entity.name}
                >
                  <span className="inline-block max-w-[140px] truncate">
                    {entity.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.keywords.map((keyword, ki) => (
              <tr
                key={keyword}
                className="border-b border-secondary/50 transition-colors hover:bg-primary_hover"
              >
                <td className="sticky left-0 z-10 bg-primary px-3 py-2 font-medium text-primary max-w-[180px] truncate">
                  {keyword}
                </td>
                {entities.map((entity) => {
                  const pos = entity.positions[ki];
                  const style = getPositionStyle(pos);

                  return (
                    <td key={entity.name} className="px-2 py-2 text-center">
                      {pos != null ? (
                        <span
                          className={`inline-flex min-w-[32px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${style.bg} ${style.text}`}
                        >
                          {pos}
                        </span>
                      ) : (
                        <span className="text-quaternary">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Color scale legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-tertiary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-utility-success-50" />
          Top 10
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-utility-warning-50" />
          11–20
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-utility-gray-50" />
          21–50
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-utility-error-50/60" />
          50+
        </span>
        <span>— = {t("keywordGapNotRanking")}</span>
      </div>
    </div>
  );
}
