"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, AlertTriangle, InfoCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

interface IssuesSummaryCardsProps {
  analysis: {
    criticalIssues: number;
    warnings: number;
    recommendations: number;
    issues?: {
      missingTitles: number;
      missingMetaDescriptions: number;
      duplicateContent: number;
      brokenLinks: number;
      slowPages: number;
      suboptimalTitles: number;
      thinContent: number;
      missingH1: number;
      largeImages: number;
      missingAltText: number;
      missingHttps?: number;
      missingCanonical?: number;
      missingRobotsMeta?: number;
      notMobileFriendly?: number;
      missingStructuredData?: number;
      largeDomSize?: number;
      tooManyElements?: number;
      highElementSimilarity?: number;
      lowTextToCodeRatio?: number;
    };
    totalPages: number;
  };
  onShowIssues?: (severity: "critical" | "warning" | "recommendation") => void;
}

// Map issue keys to i18n keys and severity classification
const ISSUE_META: {
  key: string;
  i18nKey: string;
  severity: "critical" | "warning" | "recommendation";
}[] = [
  { key: "missingHttps", i18nKey: "issueMissingHttps", severity: "critical" },
  { key: "brokenLinks", i18nKey: "issueBrokenLinks", severity: "critical" },
  { key: "slowPages", i18nKey: "issueSlowPages", severity: "critical" },
  { key: "missingTitles", i18nKey: "issueMissingTitles", severity: "warning" },
  { key: "missingMetaDescriptions", i18nKey: "issueMissingMetaDesc", severity: "warning" },
  { key: "missingH1", i18nKey: "issueMissingH1Short", severity: "warning" },
  { key: "missingCanonical", i18nKey: "issueMissingCanonical", severity: "warning" },
  { key: "missingAltText", i18nKey: "issueMissingAlt", severity: "warning" },
  { key: "duplicateContent", i18nKey: "issueDuplicateContent", severity: "warning" },
  { key: "thinContent", i18nKey: "issueThinContent", severity: "recommendation" },
  { key: "missingStructuredData", i18nKey: "issueMissingSchema", severity: "recommendation" },
  { key: "largeDomSize", i18nKey: "issueLargeDom", severity: "recommendation" },
  { key: "missingRobotsMeta", i18nKey: "issueMissingRobots", severity: "recommendation" },
];

export function IssuesSummaryCards({ analysis, onShowIssues }: IssuesSummaryCardsProps) {
  const t = useTranslations("onsite");

  const issues = analysis.issues;

  // Build top issues per severity
  function getTopIssues(severity: "critical" | "warning" | "recommendation", max = 3) {
    if (!issues) return [];
    return ISSUE_META
      .filter((m) => m.severity === severity)
      .map((m) => ({ label: m.i18nKey, count: (issues as any)[m.key] ?? 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, max);
  }

  const cards = [
    {
      label: t("critical"),
      severity: "critical" as const,
      value: analysis.criticalIssues,
      icon: AlertCircle,
      bgColor: "bg-error-50",
      textColor: "text-error-600",
      valueColor: "text-error-700",
      topIssues: getTopIssues("critical"),
    },
    {
      label: t("warnings"),
      severity: "warning" as const,
      value: analysis.warnings,
      icon: AlertTriangle,
      bgColor: "bg-warning-50",
      textColor: "text-warning-600",
      valueColor: "text-warning-700",
      topIssues: getTopIssues("warning"),
    },
    {
      label: t("recommendations"),
      severity: "recommendation" as const,
      value: analysis.recommendations,
      icon: InfoCircle,
      bgColor: "bg-primary-50",
      textColor: "text-primary-600",
      valueColor: "text-primary-700",
      topIssues: getTopIssues("recommendation"),
    },
  ];

  return (
    <>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.severity}
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
                <span className="text-sm text-tertiary">{t("issues")}</span>
              </div>

              {/* Top issues breakdown */}
              {card.topIssues.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-secondary">
                  {card.topIssues.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-tertiary truncate pr-2">
                        {t(item.label as any)}
                      </span>
                      <span className={`text-xs font-medium tabular-nums ${card.valueColor}`}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {card.value > 0 && onShowIssues && (
                <Button
                  size="sm"
                  color="secondary"
                  onClick={() => onShowIssues(card.severity)}
                  className="w-full"
                >
                  {t("showIssues")}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
