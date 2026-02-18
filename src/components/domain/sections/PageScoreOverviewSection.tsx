"use client";

import { useTranslations } from "next-intl";
import {
  RadarChart,
  Radar,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Star01 } from "@untitledui/icons";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PageScoreOverviewSectionProps {
  analysis: {
    avgPageScore?: number;
    pageScoreDistribution?: {
      A: number;
      B: number;
      C: number;
      D: number;
      F: number;
    };
    pageScoreAxes?: {
      technical: number;
      content: number;
      seoPerformance: number;
      strategic: number;
    };
    pagesAnalyzed?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getGradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

function getGradeColor(grade: string) {
  switch (grade) {
    case "A": return "bg-success-100 text-success-700 border-success-200";
    case "B": return "bg-success-50 text-success-600 border-success-100";
    case "C": return "bg-warning-50 text-warning-700 border-warning-200";
    case "D": return "bg-orange-50 text-orange-700 border-orange-200";
    case "F": return "bg-error-50 text-error-700 border-error-200";
    default: return "bg-secondary text-tertiary border-secondary";
  }
}

const GRADE_BAR_COLORS: Record<string, string> = {
  A: "#12b76a",
  B: "#6ce9a6",
  C: "#f79009",
  D: "#f97316",
  F: "#f04438",
};

const AXIS_COLORS: Record<string, string> = {
  technical: "#6366f1", // indigo
  content: "#f59e0b", // amber
  seoPerformance: "#06b6d4", // cyan
  strategic: "#8b5cf6", // violet
};

const AXIS_KEYS = ["technical", "content", "seoPerformance", "strategic"] as const;
const AXIS_WEIGHTS: Record<string, number> = {
  technical: 10,
  content: 35,
  seoPerformance: 35,
  strategic: 20,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PageScoreOverviewSection({ analysis }: PageScoreOverviewSectionProps) {
  const t = useTranslations("onsite");

  const { avgPageScore, pageScoreDistribution: dist, pageScoreAxes: axes } = analysis;

  // If no scoring data at all, show empty state
  if (avgPageScore == null && !dist && !axes) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="flex flex-col items-center justify-center py-8">
          <Star01 className="h-8 w-8 text-fg-quaternary mb-2" />
          <p className="text-sm font-medium text-secondary">{t("noScoringData")}</p>
          <p className="text-xs text-tertiary mt-1">{t("noScoringDataDesc")}</p>
        </div>
      </div>
    );
  }

  const compositeScore = avgPageScore ?? 0;
  const grade = getGradeFromScore(compositeScore);
  const totalScored = dist ? dist.A + dist.B + dist.C + dist.D + dist.F : 0;

  // i18n label map for axes
  const axisLabel: Record<string, string> = {
    technical: t("axisTechnical"),
    content: t("axisContent"),
    seoPerformance: t("axisSeoPerformance"),
    strategic: t("axisStrategic"),
  };

  const axisDetail: Record<string, string> = {
    technical: t("axisDetailTechnical"),
    content: t("axisDetailContent"),
    seoPerformance: t("axisDetailSeoPerformance"),
    strategic: t("axisDetailStrategic"),
  };

  // ── Radar data ──
  const radarData = AXIS_KEYS.map((key) => ({
    axis: axisLabel[key],
    score: axes?.[key] ?? 0,
    fullMark: 100,
  }));

  const radarConfig: ChartConfig = {
    score: { label: t("compositeScore"), color: "#6366f1" },
  };

  // ── Grade distribution data ──
  const gradeEntries = dist
    ? (["A", "B", "C", "D", "F"] as const).map((g) => ({
        grade: g,
        count: dist[g],
        pct: totalScored > 0 ? Math.round((dist[g] / totalScored) * 100) : 0,
        color: GRADE_BAR_COLORS[g],
      }))
    : [];

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6 space-y-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      {/* Header */}
      <div>
        <h3 className="text-md font-semibold text-primary">{t("scoringOverview")}</h3>
        <p className="text-sm text-tertiary">{t("scoringOverviewDesc")}</p>
      </div>

      {/* Top row: Composite hero + Radar chart + Grade distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Composite hero */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center rounded-lg border border-secondary bg-secondary/30 p-6">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide mb-2">
            {t("avgComposite")}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-bold text-primary tabular-nums">
              {compositeScore}
            </span>
            <span className="text-sm text-tertiary">{t("outOf100")}</span>
          </div>
          <span
            className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold border ${getGradeColor(grade)}`}
          >
            {grade}
          </span>
          {totalScored > 0 && (
            <span className="text-xs text-quaternary mt-3">
              {t("pagesScored", { count: totalScored })}
            </span>
          )}
        </div>

        {/* Radar chart */}
        <div className="lg:col-span-5">
          <div className="mb-2">
            <h4 className="text-sm font-medium text-primary">{t("radarTitle")}</h4>
            <p className="text-xs text-tertiary">{t("radarDesc")}</p>
          </div>
          <ChartContainer config={radarConfig} className="h-[260px] w-full">
            <RadarChart data={radarData}>
              <PolarGrid strokeDasharray="3 3" opacity={0.3} />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Radar
                name={t("compositeScore")}
                dataKey="score"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>
        </div>

        {/* Grade distribution */}
        <div className="lg:col-span-4">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-primary">{t("gradeDistribution")}</h4>
            <p className="text-xs text-tertiary">
              {totalScored > 0
                ? t("pagesScored", { count: totalScored })
                : ""}
            </p>
          </div>
          {dist && totalScored > 0 ? (
            <div className="space-y-2.5">
              {/* Stacked bar overview */}
              <div className="flex h-4 rounded-full overflow-hidden gap-px">
                {gradeEntries.map(({ grade: g, pct, color }) =>
                  pct > 0 ? (
                    <div
                      key={g}
                      className="transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      title={`${g}: ${pct}%`}
                    />
                  ) : null
                )}
              </div>

              {/* Per-grade rows */}
              <div className="space-y-1.5 pt-1">
                {gradeEntries.map(({ grade: g, count, pct, color }) => (
                  <div key={g} className="flex items-center gap-3">
                    <span
                      className="w-7 text-center text-xs font-bold rounded py-0.5"
                      style={{
                        backgroundColor: count > 0 ? `${color}20` : undefined,
                        color: count > 0 ? color : undefined,
                      }}
                    >
                      {g}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-xs text-primary tabular-nums font-medium w-10 text-right">
                      {count}
                    </span>
                    <span className="text-[10px] text-quaternary tabular-nums w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-tertiary">
              {t("noScoringData")}
            </div>
          )}
        </div>
      </div>

      {/* Axis detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {AXIS_KEYS.map((key) => {
          const score = axes?.[key] ?? 0;
          const color = AXIS_COLORS[key];
          const weight = AXIS_WEIGHTS[key];

          return (
            <div
              key={key}
              className="rounded-lg border border-secondary p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary">
                  {axisLabel[key]}
                </span>
                <span className="text-[10px] text-quaternary font-medium">
                  {t("axisWeight", { weight })}
                </span>
              </div>

              {/* Score bar */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {score}
                  </span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded border ${getGradeColor(getGradeFromScore(score))}`}
                  >
                    {getGradeFromScore(score)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${score}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-tertiary leading-relaxed">
                {axisDetail[key]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
