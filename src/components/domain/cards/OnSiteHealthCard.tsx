"use client";

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
  };
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

export function OnSiteHealthCard({ analysis }: OnSiteHealthCardProps) {
  const { healthScore, totalPages, criticalIssues, grade, pagesAnalyzed } = analysis;

  // Determine color and status based on health score AND critical issues
  let status: string;
  let statusColor: string;
  let bgColor: string;
  let textColor: string;
  let icon: React.ComponentType<{ className?: string }>;

  // If there are many critical issues, downgrade the status
  const criticalIssueRatio = totalPages > 0 ? criticalIssues / totalPages : 0;
  const hasManyIssues = criticalIssues > 50 || criticalIssueRatio > 0.5;

  if (healthScore >= 90 && !hasManyIssues) {
    status = "Excellent";
    statusColor = "text-success-700";
    bgColor = "bg-success-50";
    textColor = "text-success-600";
    icon = CheckCircle;
  } else if (healthScore >= 70 && criticalIssues < 20) {
    status = "Good";
    statusColor = "text-success-700";
    bgColor = "bg-success-50";
    textColor = "text-success-600";
    icon = CheckCircle;
  } else if (healthScore >= 50 || (healthScore >= 40 && criticalIssues < 10)) {
    status = "Needs Work";
    statusColor = "text-warning-700";
    bgColor = "bg-warning-50";
    textColor = "text-warning-600";
    icon = AlertTriangle;
  } else {
    status = "Critical";
    statusColor = "text-error-700";
    bgColor = "bg-error-50";
    textColor = "text-error-600";
    icon = AlertCircle;
  }

  const Icon = icon;

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-tertiary">Overall Health</h3>
        <div className={`${bgColor} rounded-full p-2`}>
          <Icon className={`w-4 h-4 ${textColor}`} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-primary">
            {healthScore}
          </span>
          <span className="text-sm text-tertiary">/ 100</span>
          {grade && (
            <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold border ${getGradeColor(grade)}`}>
              {grade.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${statusColor}`}>
            {status}
          </span>
        </div>

        <div className="pt-4 border-t border-secondary">
          <span className="text-xs text-tertiary">
            {pagesAnalyzed ?? totalPages} pages analyzed
          </span>
        </div>
      </div>
    </div>
  );
}
