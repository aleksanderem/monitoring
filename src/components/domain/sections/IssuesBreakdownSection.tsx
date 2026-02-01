"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, InfoCircle, Link01, File01, Image01, Zap, Eye } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { PagesIssueModal } from "../modals/PagesIssueModal";
import type { Id } from "../../../../convex/_generated/dataModel";

interface IssuesBreakdownSectionProps {
  scanId?: Id<"onSiteScans">;
  issues: {
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
  };
}

type IssueModalType = "brokenLinks" | "missingTitles" | "missingMetaDescriptions" | "missingH1" | "slowPages" | "duplicateContent" | "thinContent" | null;

export function IssuesBreakdownSection({ issues, scanId }: IssuesBreakdownSectionProps) {
  const [activeIssueModal, setActiveIssueModal] = useState<IssueModalType>(null);
  const issuesList = [
    {
      label: "Broken Links",
      count: issues.brokenLinks,
      severity: "critical",
      icon: Link01,
      description: "Pages with broken outbound links",
      modalType: "brokenLinks" as const,
    },
    {
      label: "Missing Titles",
      count: issues.missingTitles,
      severity: "critical",
      icon: File01,
      description: "Pages without title tags",
      modalType: "missingTitles" as const,
    },
    {
      label: "Missing H1 Tags",
      count: issues.missingH1,
      severity: "critical",
      icon: File01,
      description: "Pages without primary headings",
      modalType: "missingH1" as const,
    },
    {
      label: "Missing Meta Descriptions",
      count: issues.missingMetaDescriptions,
      severity: "warning",
      icon: File01,
      description: "Pages without meta descriptions",
      modalType: "missingMetaDescriptions" as const,
    },
    {
      label: "Slow Pages",
      count: issues.slowPages,
      severity: "warning",
      icon: Zap,
      description: "Pages with high loading time",
      modalType: "slowPages" as const,
    },
    {
      label: "Duplicate Content",
      count: issues.duplicateContent,
      severity: "warning",
      icon: File01,
      description: "Pages with duplicate content",
      modalType: "duplicateContent" as const,
    },
    {
      label: "Thin Content",
      count: issues.thinContent,
      severity: "recommendation",
      icon: File01,
      description: "Pages with low content rate",
      modalType: "thinContent" as const,
    },
    {
      label: "Suboptimal Titles",
      count: issues.suboptimalTitles,
      severity: "recommendation",
      icon: File01,
      description: "Titles too long or too short",
      modalType: null,
    },
    {
      label: "Missing Alt Text",
      count: issues.missingAltText,
      severity: "recommendation",
      icon: Image01,
      description: "Images without alt attributes",
      modalType: null,
    },
    {
      label: "Large Images",
      count: issues.largeImages,
      severity: "recommendation",
      icon: Image01,
      description: "Images larger than 3MB",
      modalType: null,
    },
  ].filter((issue) => issue.count > 0); // Only show issues that exist

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

  if (issuesList.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="bg-success-50 rounded-full p-4 mb-4 inline-block">
            <AlertCircle className="w-8 h-8 text-success-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            No Issues Found
          </h3>
          <p className="text-sm text-gray-600">
            Your website has no detected SEO issues!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4">
        Issues Breakdown
      </h3>
      <div className="space-y-3">
        {issuesList.map((issue) => {
          const colors = getSeverityColor(issue.severity);
          const SeverityIcon = colors.icon;
          const IssueIcon = issue.icon;

          const hasModal = issue.modalType && scanId;

          return (
            <div
              key={issue.label}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className={`${colors.bg} rounded-full p-2 flex-shrink-0`}>
                <IssueIcon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {issue.label}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge} flex-shrink-0`}>
                      {issue.count}
                    </span>
                    {hasModal && (
                      <Button
                        size="sm"
                        color="secondary"
                        iconLeading={Eye}
                        onClick={() => setActiveIssueModal(issue.modalType as IssueModalType)}
                      >
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600">{issue.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pages Issue Modal */}
      {scanId && activeIssueModal && (
        <PagesIssueModal
          scanId={scanId}
          isOpen={true}
          onClose={() => setActiveIssueModal(null)}
          issueType={activeIssueModal}
          title={
            activeIssueModal === "brokenLinks" ? "Pages with Broken Links" :
            activeIssueModal === "missingTitles" ? "Missing Titles" :
            activeIssueModal === "missingMetaDescriptions" ? "Missing Meta Descriptions" :
            activeIssueModal === "missingH1" ? "Missing H1 Tags" :
            activeIssueModal === "slowPages" ? "Slow Pages" :
            activeIssueModal === "duplicateContent" ? "Duplicate Content" :
            "Thin Content"
          }
          description={
            activeIssueModal === "brokenLinks" ? "List of pages that have broken outbound links" :
            activeIssueModal === "missingTitles" ? "List of pages without title tags" :
            activeIssueModal === "missingMetaDescriptions" ? "List of pages without meta descriptions" :
            activeIssueModal === "missingH1" ? "List of pages without H1 tags" :
            activeIssueModal === "slowPages" ? "List of pages with high loading time (>3s)" :
            activeIssueModal === "duplicateContent" ? "List of pages with duplicate content" :
            "List of pages with low content rate (<300 words)"
          }
        />
      )}
    </div>
  );
}
