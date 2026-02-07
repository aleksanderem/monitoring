"use client";

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
  // Critical
  {
    checkType: "HTTPS_CHECK",
    label: "Missing HTTPS",
    field: "missingHttps" as const,
    severity: "critical",
    icon: ShieldTick,
    description: "Pages not served over HTTPS",
  },
  {
    checkType: "H1_FOUND",
    label: "Missing H1 Tags",
    field: "missingH1" as const,
    severity: "critical",
    icon: File01,
    description: "Pages without primary headings",
  },
  {
    checkType: "CANONICAL_FOUND",
    label: "Missing Canonical Tag",
    field: "missingCanonical" as const,
    severity: "critical",
    icon: Link01,
    description: "Pages without canonical URL tag",
  },
  // Warning
  {
    checkType: "TITLE_REPETITION",
    label: "Duplicate Titles",
    field: "missingTitles" as const,
    severity: "warning",
    icon: File01,
    description: "Pages with repeated title tags",
  },
  {
    checkType: "META_DESCRIPTION_REPETITION",
    label: "Duplicate Descriptions",
    field: "missingMetaDescriptions" as const,
    severity: "warning",
    icon: File01,
    description: "Pages with repeated meta descriptions",
  },
  {
    checkType: "ROBOTS_META_FOUND",
    label: "Missing Robots Meta",
    field: "missingRobotsMeta" as const,
    severity: "warning",
    icon: Eye,
    description: "Pages without robots meta tag",
  },
  {
    checkType: "IMAGE_ALT_FOUND",
    label: "Missing Image Alt Text",
    field: "missingAltText" as const,
    severity: "warning",
    icon: Image01,
    description: "Images without alt attributes",
  },
  {
    checkType: "MOBILE_FRIENDLY",
    label: "Not Mobile Friendly",
    field: "notMobileFriendly" as const,
    severity: "warning",
    icon: Phone01,
    description: "Pages not optimized for mobile",
  },
  // Recommendation
  {
    checkType: "TEXT_TO_CODE_RATIO",
    label: "Low Text-to-Code Ratio",
    field: "lowTextToCodeRatio" as const,
    severity: "recommendation",
    icon: File01,
    description: "Text-to-code ratio below recommended threshold",
  },
  {
    checkType: "DOM_SIZE",
    label: "Large DOM Size",
    field: "largeDomSize" as const,
    severity: "recommendation",
    icon: Zap,
    description: "DOM size exceeds recommended limit",
  },
  {
    checkType: "ELEMENTS_SIMILARITY",
    label: "High Element Similarity",
    field: "highElementSimilarity" as const,
    severity: "recommendation",
    icon: File01,
    description: "Multiple elements with very similar content",
  },
  {
    checkType: "ELEMENTS_COUNT",
    label: "Too Many DOM Elements",
    field: "tooManyElements" as const,
    severity: "recommendation",
    icon: Zap,
    description: "Page has excessive number of DOM elements",
  },
  {
    checkType: "STRUCTURED_DATA_FOUND",
    label: "Missing Structured Data",
    field: "missingStructuredData" as const,
    severity: "recommendation",
    icon: Tag01,
    description: "No Schema.org structured data found",
  },
] as const;

export function IssuesBreakdownSection({
  issues,
  scanId,
  severityFilter,
  onClearFilter,
}: IssuesBreakdownSectionProps) {
  const [activeCheckType, setActiveCheckType] = useState<string | null>(null);

  // Build visible issues list from the 13 SEO Audit check types
  const allIssues = SEO_AUDIT_ISSUES.map((item) => {
    const count = (issues as any)[item.field] ?? 0;
    return { ...item, count };
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
            No Issues Found
          </h3>
          <p className="text-sm text-tertiary">
            Your website has no detected SEO issues!
          </p>
        </div>
      </div>
    );
  }

  const activeIssue = activeCheckType
    ? SEO_AUDIT_ISSUES.find((i) => i.checkType === activeCheckType)
    : null;

  const filterLabel = severityFilter === "critical"
    ? "Critical"
    : severityFilter === "warning"
      ? "Warnings"
      : severityFilter === "recommendation"
        ? "Recommendations"
        : null;

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-semibold text-primary">
          Issues Breakdown
        </h3>
        {filterLabel && onClearFilter && (
          <button
            onClick={onClearFilter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary hover:bg-tertiary transition-colors"
          >
            Showing: {filterLabel}
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
                        View Details
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
          title={activeIssue.label}
          description={`Pages failing the ${activeIssue.label} check`}
        />
      )}
    </div>
  );
}
