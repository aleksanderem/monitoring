"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Zap,
  File01,
  File06,
  Link01,
  Image01,
  Code01,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  InfoCircle,
  Lightbulb01,
} from "@untitledui/icons";

interface AuditSection {
  score: number;
  grade: string;
  issues: Array<{
    issue: string;
    action: string;
    priority: string;
  }>;
}

interface AuditSectionsBreakdownProps {
  sections: Record<string, AuditSection>;
  recommendations?: string[];
}

const SECTION_CONFIG: Record<
  string,
  {
    labelKey: string;
    icon: React.ComponentType<{ className?: string }>;
    descKey: string;
  }
> = {
  technical: {
    labelKey: "sectionTechnical",
    icon: Zap,
    descKey: "sectionTechnicalDesc",
  },
  on_page: {
    labelKey: "sectionOnPage",
    icon: File01,
    descKey: "sectionOnPageDesc",
  },
  content: {
    labelKey: "sectionContent",
    icon: File06,
    descKey: "sectionContentDesc",
  },
  links: {
    labelKey: "sectionLinks",
    icon: Link01,
    descKey: "sectionLinksDesc",
  },
  images: {
    labelKey: "sectionImages",
    icon: Image01,
    descKey: "sectionImagesDesc",
  },
  structured_data: {
    labelKey: "sectionStructuredData",
    icon: Code01,
    descKey: "sectionStructuredDataDesc",
  },
};

function getGradeColor(grade: string) {
  switch (grade?.toUpperCase()) {
    case "A":
      return "bg-success-100 text-success-700";
    case "B":
      return "bg-success-50 text-success-600";
    case "C":
      return "bg-warning-50 text-warning-700";
    case "D":
      return "bg-orange-50 text-orange-700";
    case "F":
      return "bg-error-50 text-error-700";
    default:
      return "bg-secondary text-tertiary";
  }
}

function getScoreBarColor(score: number) {
  if (score >= 80) return "bg-success-500";
  if (score >= 60) return "bg-warning-500";
  return "bg-error-500";
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case "critical":
      return <AlertCircle className="w-3.5 h-3.5 text-error-600 flex-shrink-0" />;
    case "important":
      return <AlertTriangle className="w-3.5 h-3.5 text-warning-600 flex-shrink-0" />;
    default:
      return <InfoCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "critical":
      return "bg-error-50 text-error-700";
    case "important":
      return "bg-warning-50 text-warning-700";
    default:
      return "bg-blue-50 text-blue-700";
  }
}

export function AuditSectionsBreakdown({
  sections,
  recommendations,
}: AuditSectionsBreakdownProps) {
  const t = useTranslations('onsite');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sectionEntries = Object.entries(sections).filter(
    ([key]) => SECTION_CONFIG[key]
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">{t('auditSections')}</h3>

      {/* Section cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectionEntries.map(([key, section]) => {
          const config = SECTION_CONFIG[key];
          if (!config) return null;
          const Icon = config.icon;
          const isExpanded = expandedSections.has(key);
          const issueCount = section.issues?.length || 0;

          return (
            <div
              key={key}
              className="bg-primary rounded-lg border border-secondary overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggleSection(key)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary_hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-secondary rounded-lg p-2">
                    <Icon className="w-4 h-4 text-tertiary" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        {t(config.labelKey)}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${getGradeColor(section.grade)}`}
                      >
                        {section.grade}
                      </span>
                    </div>
                    <p className="text-xs text-quaternary mt-0.5">
                      {issueCount > 0
                        ? t('issueCount', { count: issueCount })
                        : t('noIssues')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    {section.score}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-quaternary" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-quaternary" />
                  )}
                </div>
              </button>

              {/* Score bar */}
              <div className="px-4 pb-2">
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${getScoreBarColor(section.score)}`}
                    style={{ width: `${section.score}%` }}
                  />
                </div>
              </div>

              {/* Expanded issues */}
              {isExpanded && section.issues?.length > 0 && (
                <div className="px-4 pb-3 space-y-2 border-t border-secondary pt-3">
                  {section.issues.map(
                    (
                      issue: { issue: string; action: string; priority: string },
                      idx: number
                    ) => (
                      <div
                        key={idx}
                        className="flex gap-2 text-sm"
                      >
                        {getPriorityIcon(issue.priority)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary font-medium">
                              {issue.issue}
                            </span>
                            <span
                              className={`inline-flex px-1.5 py-0 rounded text-[10px] font-medium ${getPriorityBadge(issue.priority)}`}
                            >
                              {issue.priority}
                            </span>
                          </div>
                          {issue.action && (
                            <p className="text-xs text-tertiary mt-0.5">
                              {issue.action}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-primary rounded-lg border border-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb01 className="w-4 h-4 text-warning-600" />
            <h4 className="text-sm font-medium text-primary">
              {t('recommendations')}
            </h4>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-tertiary"
              >
                <span className="text-quaternary mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
