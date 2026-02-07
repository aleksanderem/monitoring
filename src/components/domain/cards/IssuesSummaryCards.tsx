"use client";

import { AlertCircle, AlertTriangle, InfoCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

interface IssuesSummaryCardsProps {
  analysis: {
    criticalIssues: number;
    warnings: number;
    recommendations: number;
  };
  onShowIssues?: (severity: "critical" | "warning" | "recommendation") => void;
}

export function IssuesSummaryCards({ analysis, onShowIssues }: IssuesSummaryCardsProps) {
  const cards = [
    {
      label: "Critical",
      severity: "critical" as const,
      value: analysis.criticalIssues,
      icon: AlertCircle,
      bgColor: "bg-error-50",
      textColor: "text-error-600",
      valueColor: "text-error-700",
    },
    {
      label: "Warnings",
      severity: "warning" as const,
      value: analysis.warnings,
      icon: AlertTriangle,
      bgColor: "bg-warning-50",
      textColor: "text-warning-600",
      valueColor: "text-warning-700",
    },
    {
      label: "Recommendations",
      severity: "recommendation" as const,
      value: analysis.recommendations,
      icon: InfoCircle,
      bgColor: "bg-primary-50",
      textColor: "text-primary-600",
      valueColor: "text-primary-700",
    },
  ];

  return (
    <>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-primary rounded-lg border border-secondary p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-tertiary">
                {card.label}
              </h3>
              <div className={`${card.bgColor} rounded-full p-2`}>
                <Icon className={`w-4 h-4 ${card.textColor}`} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${card.valueColor}`}>
                  {card.value}
                </span>
                <span className="text-sm text-tertiary">issues</span>
              </div>

              {card.value > 0 && onShowIssues && (
                <Button
                  size="sm"
                  color="secondary"
                  onClick={() => onShowIssues(card.severity)}
                  className="w-full"
                >
                  Show Issues
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
