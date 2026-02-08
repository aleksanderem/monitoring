"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  InfoCircle,
  Link01,
  File01,
  Image01,
  Zap,
  Eye,
  ShieldTick,
  Phone01,
  Tag01,
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { PagesIssueModal } from "../modals/PagesIssueModal";
import type { Id } from "../../../../convex/_generated/dataModel";

interface IssuesBreakdownSectionProps {
  scanId?: Id<"onSiteScans">;
  severityFilter?: "critical" | "warning" | "recommendation" | null;
  onClearFilter?: () => void;
  issues: {
    // Legacy DataForSEO fields
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
    // SEO Audit API fields
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
}

// Each entry maps a check type to its display config and the issues field it reads from
const SEO_AUDIT_ISSUES = [
  { checkType: "HTTPS_CHECK", labelKey: "issueMissingHttps", field: "missingHttps" as const, severity: "critical", icon: ShieldTick, descKey: "issueMissingHttpsDesc" },
  { checkType: "H1_FOUND", labelKey: "issueMissingH1", field: "missingH1" as const, severity: "critical", icon: File01, descKey: "issueMissingH1Desc" },
  { checkType: "CANONICAL_FOUND", labelKey: "issueMissingCanonical", field: "missingCanonical" as const, severity: "critical", icon: Link01, descKey: "issueMissingCanonicalDesc" },
  { checkType: "TITLE_REPETITION", labelKey: "issueDuplicateTitles", field: "missingTitles" as const, severity: "warning", icon: File01, descKey: "issueDuplicateTitlesDesc" },
  { checkType: "META_DESCRIPTION_REPETITION", labelKey: "issueDuplicateDescriptions", field: "missingMetaDescriptions" as const, severity: "warning", icon: File01, descKey: "issueDuplicateDescriptionsDesc" },
  { checkType: "ROBOTS_META_FOUND", labelKey: "issueMissingRobotsMeta", field: "missingRobotsMeta" as const, severity: "warning", icon: Eye, descKey: "issueMissingRobotsMetaDesc" },
  { checkType: "IMAGE_ALT_FOUND", labelKey: "issueMissingAltText", field: "missingAltText" as const, severity: "warning", icon: Image01, descKey: "issueMissingAltTextDesc" },
  { checkType: "MOBILE_FRIENDLY", labelKey: "issueNotMobileFriendly", field: "notMobileFriendly" as const, severity: "warning", icon: Phone01, descKey: "issueNotMobileFriendlyDesc" },
  { checkType: "TEXT_TO_CODE_RATIO", labelKey: "issueLowTextToCode", field: "lowTextToCodeRatio" as const, severity: "recommendation", icon: File01, descKey: "issueLowTextToCodeDesc" },
  { checkType: "DOM_SIZE", labelKey: "issueLargeDom", field: "largeDomSize" as const, severity: "recommendation", icon: Zap, descKey: "issueLargeDomDesc" },
  { checkType: "ELEMENTS_SIMILARITY", labelKey: "issueHighSimilarity", field: "highElementSimilarity" as const, severity: "recommendation", icon: File01, descKey: "issueHighSimilarityDesc" },
  { checkType: "ELEMENTS_COUNT", labelKey: "issueTooManyElements", field: "tooManyElements" as const, severity: "recommendation", icon: Zap, descKey: "issueTooManyElementsDesc" },
  { checkType: "STRUCTURED_DATA_FOUND", labelKey: "issueMissingStructuredData", field: "missingStructuredData" as const, severity: "recommendation", icon: Tag01, descKey: "issueMissingStructuredDataDesc" },
] as const;

export function IssuesBreakdownSection({
  issues,
  scanId,
  severityFilter,
  onClearFilter,
}: IssuesBreakdownSectionProps) {
  const t = useTranslations('onsite');
  const [activeCheckType, setActiveCheckType] = useState<string | null>(null);

  // Build visible issues list from the 13 SEO Audit check types
  const allIssues = SEO_AUDIT_ISSUES.map((item) => {
    const count = (issues as any)[item.field] ?? 0;
    return { ...item, label: t(item.labelKey), description: t(item.descKey), count };
  }).filter((item) => item.count > 0);

  const issuesList = severityFilter
    ? allIssues.filter((item) => item.severity === severityFilter)
    : allIssues;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-error-50",
          text: "text-error-700",
          icon: AlertCircle,
          badge: "bg-error-100 text-error-700",
        };
      case "warning":
        return {
          bg: "bg-warning-50",
          text: "text-warning-700",
          icon: AlertTriangle,
          badge: "bg-warning-100 text-warning-700",
        };
      default:
        return {
          bg: "bg-primary-50",
          text: "text-primary-700",
          icon: InfoCircle,
          badge: "bg-primary-100 text-primary-700",
        };
    }
  };

  if (allIssues.length === 0) {
    return (
      <div className="bg-primary rounded-lg border border-secondary p-6">
        <div className="text-center py-8">
          <div className="bg-success-50 rounded-full p-4 mb-4 inline-block">
            <AlertCircle className="w-8 h-8 text-success-600" />
          </div>
          <h3 className="text-sm font-semibold text-primary mb-2">
            {t('noIssuesFound')}
          </h3>
          <p className="text-sm text-tertiary">
            {t('noIssuesFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  const activeIssue = activeCheckType
    ? SEO_AUDIT_ISSUES.find((i) => i.checkType === activeCheckType)
    : null;

  const filterLabel = severityFilter === "critical"
    ? t('severityCritical')
    : severityFilter === "warning"
      ? t('severityWarnings')
      : severityFilter === "recommendation"
        ? t('severityRecommendations')
        : null;

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-semibold text-primary">
          {t('issuesBreakdown')}
        </h3>
        {filterLabel && onClearFilter && (
          <button
            onClick={onClearFilter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary hover:bg-tertiary transition-colors"
          >
            {t('showing')}: {filterLabel}
            <span className="text-quaternary">&times;</span>
          </button>
        )}
      </div>
      <div className="space-y-3">
        {issuesList.map((issue) => {
          const colors = getSeverityColor(issue.severity);
          const IssueIcon = issue.icon;

          return (
            <div
              key={issue.checkType}
              className="flex items-start gap-3 p-3 rounded-lg border border-secondary hover:bg-secondary transition-colors"
            >
              <div
                className={`${colors.bg} rounded-full p-2 flex-shrink-0`}
              >
                <IssueIcon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-medium text-primary">
                    {issue.label}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge} flex-shrink-0`}
                    >
                      {issue.count}
                    </span>
                    {scanId && (
                      <Button
                        size="sm"
                        color="secondary"
                        iconLeading={Eye}
                        onClick={() =>
                          setActiveCheckType(issue.checkType)
                        }
                      >
                        {t('viewDetails')}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-tertiary">{issue.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pages Issue Modal */}
      {scanId && activeCheckType && activeIssue && (
        <PagesIssueModal
          scanId={scanId}
          isOpen={true}
          onClose={() => setActiveCheckType(null)}
          checkType={activeCheckType}
          title={t(activeIssue.labelKey)}
          description={t('pagesFailingCheck', { check: t(activeIssue.labelKey) })}
        />
      )}
    </div>
  );
}
