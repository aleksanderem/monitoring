"use client";

import { AlertCircle, AlertTriangle, InfoCircle } from "@untitledui/icons";

interface IssuesSummaryCardsProps {
  analysis: {
    criticalIssues: number;
    warnings: number;
    recommendations: number;
  };
}

export function IssuesSummaryCards({ analysis }: IssuesSummaryCardsProps) {
  const cards = [
    {
      label: "Critical",
      value: analysis.criticalIssues,
      icon: AlertCircle,
      bgColor: "bg-error-50",
      textColor: "text-error-600",
      valueColor: "text-error-700",
    },
    {
      label: "Warnings",
      value: analysis.warnings,
      icon: AlertTriangle,
      bgColor: "bg-warning-50",
      textColor: "text-warning-600",
      valueColor: "text-warning-700",
    },
    {
      label: "Recommendations",
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
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">
                {card.label}
              </h3>
              <div className={`${card.bgColor} rounded-full p-2`}>
                <Icon className={`w-4 h-4 ${card.textColor}`} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${card.valueColor}`}>
                  {card.value}
                </span>
                <span className="text-sm text-gray-600">issues</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
