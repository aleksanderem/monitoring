"use client";

import { useTranslations } from "next-intl";
import { CheckCircle, AlertCircle, AlertTriangle } from "@untitledui/icons";

interface OnSiteHealthCardProps {
  analysis: {
    healthScore: number;
    totalPages: number;
    criticalIssues: number;
    warnings: number;
    recommendations: number;
    grade?: string;
    pagesAnalyzed?: number;
    avgPageScore?: number;
    pageScoreDistribution?: {
      A: number;
      B: number;
      C: number;
      D: number;
      F: number;
    };
  };
}

function getGradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

function getGradeColor(grade: string) {
  switch (grade.toUpperCase()) {
    case "A": return "bg-success-100 text-success-700 border-success-200";
    case "B": return "bg-success-50 text-success-600 border-success-100";
    case "C": return "bg-warning-50 text-warning-700 border-warning-200";
    case "D": return "bg-orange-50 text-orange-700 border-orange-200";
    case "F": return "bg-error-50 text-error-700 border-error-200";
    default: return "bg-secondary text-tertiary border-secondary";
  }
}

function getDistBarColor(grade: string) {
  switch (grade) {
    case "A": return "bg-utility-success-500";
    case "B": return "bg-utility-success-400";
    case "C": return "bg-utility-warning-500";
    case "D": return "bg-utility-warning-400";
    case "F": return "bg-utility-error-500";
    default: return "bg-fg-quaternary";
  }
}

export function OnSiteHealthCard({ analysis }: OnSiteHealthCardProps) {
  const t = useTranslations('onsite');
  const { healthScore, totalPages, criticalIssues, pagesAnalyzed, avgPageScore, pageScoreDistribution } = analysis;

  // Use avgPageScore (from page scoring engine) when available, fallback to healthScore
  const displayScore = avgPageScore ?? healthScore;
  const displayGrade = avgPageScore != null
    ? getGradeFromScore(avgPageScore)
    : (analysis.grade ?? getGradeFromScore(healthScore));

  // Determine color and status based on score AND critical issues
  let status: string;
  let statusColor: string;
  let bgColor: string;
  let textColor: string;
  let icon: React.ComponentType<{ className?: string }>;

  const criticalIssueRatio = totalPages > 0 ? criticalIssues / totalPages : 0;
  const hasManyIssues = criticalIssues > 50 || criticalIssueRatio > 0.5;

  if (displayScore >= 90 && !hasManyIssues) {
    status = t('statusExcellent');
    statusColor = "text-success-700";
    bgColor = "bg-success-50";
    textColor = "text-success-600";
    icon = CheckCircle;
  } else if (displayScore >= 70 && criticalIssues < 20) {
    status = t('statusGood');
    statusColor = "text-success-700";
    bgColor = "bg-success-50";
    textColor = "text-success-600";
    icon = CheckCircle;
  } else if (displayScore >= 50 || (displayScore >= 40 && criticalIssues < 10)) {
    status = t('statusNeedsWork');
    statusColor = "text-warning-700";
    bgColor = "bg-warning-50";
    textColor = "text-warning-600";
    icon = AlertTriangle;
  } else {
    status = t('statusCritical');
    statusColor = "text-error-700";
    bgColor = "bg-error-50";
    textColor = "text-error-600";
    icon = AlertCircle;
  }

  const Icon = icon;

  // Grade distribution bar
  const dist = pageScoreDistribution;
  const distTotal = dist ? dist.A + dist.B + dist.C + dist.D + dist.F : 0;

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-tertiary">{t('overallHealth')}</h3>
        <div className={`${bgColor} rounded-full p-2`}>
          <Icon className={`w-4 h-4 ${textColor}`} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-primary">
            {displayScore}
          </span>
          <span className="text-sm text-tertiary">/ 100</span>
          <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold border ${getGradeColor(displayGrade)}`}>
            {displayGrade}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${statusColor}`}>
            {status}
          </span>
        </div>

        {/* Grade distribution mini-bar */}
        {dist && distTotal > 0 && (
          <div className="pt-2">
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              {(["A", "B", "C", "D", "F"] as const).map((g) => {
                const count = dist[g];
                if (count === 0) return null;
                const pct = (count / distTotal) * 100;
                return (
                  <div
                    key={g}
                    className={`${getDistBarColor(g)} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${g}: ${count} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              {(["A", "B", "C", "D", "F"] as const).map((g) => (
                <span key={g} className="text-[9px] text-quaternary tabular-nums">
                  {g}:{dist[g]}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-secondary">
          <span className="text-xs text-tertiary">
            {t('pagesAnalyzed', { count: pagesAnalyzed ?? totalPages })}
          </span>
        </div>
      </div>
    </div>
  );
}
