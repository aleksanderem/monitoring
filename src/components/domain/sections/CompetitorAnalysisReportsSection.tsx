"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { FileSearch02, Trash01, Eye, Target04, RefreshCcw01 } from "@untitledui/icons";
import { toast } from "sonner";

interface CompetitorAnalysisReportsSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorAnalysisReportsSection({ domainId }: CompetitorAnalysisReportsSectionProps) {
  const [selectedReport, setSelectedReport] = useState<Id<"competitorAnalysisReports"> | null>(null);

  const reports = useQuery(api.competitorAnalysisReports.getReportsForDomain, { domainId });
  const reportDetails = useQuery(
    api.competitorAnalysisReports.getReport,
    selectedReport ? { reportId: selectedReport } : "skip"
  );
  const deleteReport = useMutation(api.competitorAnalysisReports.deleteReport);

  const handleDelete = async (reportId: Id<"competitorAnalysisReports">, keyword: string) => {
    if (!confirm(`Delete report for "${keyword}"?`)) return;

    try {
      await deleteReport({ reportId });
      if (selectedReport === reportId) {
        setSelectedReport(null);
      }
      toast.success("Report deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete report");
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "analyzing": return "brand";
      case "failed": return "error";
      default: return "gray";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "error";
      case "medium": return "warning";
      default: return "gray";
    }
  };

  if (reports === undefined) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-8 text-tertiary">Loading...</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-12">
          <FileSearch02 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="text-tertiary mb-2">No competitor analysis reports yet</p>
          <p className="text-sm text-quaternary">
            Create a report from keyword monitoring to analyze what competitors do well
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Header */}
      <div className="border-b border-secondary p-6">
        <h3 className="text-lg font-semibold text-primary">Keyword Analysis Reports</h3>
        <p className="text-sm text-tertiary">
          Deep-dive competitor analysis with actionable recommendations
        </p>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-x divide-secondary">
        {/* Reports List */}
        <div className="lg:col-span-1 max-h-[600px] overflow-y-auto">
          <div className="divide-y divide-secondary">
            {reports.map((report) => (
              <div
                key={report._id}
                onClick={() => setSelectedReport(report._id)}
                className={`
                  p-4 cursor-pointer transition-colors
                  ${selectedReport === report._id
                    ? 'bg-brand-subtle/20 border-l-4 border-l-brand-primary'
                    : 'hover:bg-secondary/50'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-primary text-sm line-clamp-2">
                    {report.keyword}
                  </h4>
                  <Badge color={getStatusBadgeColor(report.status)} size="sm">
                    {report.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-tertiary mb-2">
                  <Target04 className="h-3 w-3" />
                  <span>{report.competitorPages.length} competitors analyzed</span>
                </div>

                {report.status === "completed" && report.recommendations && (
                  <div className="text-xs text-tertiary">
                    {report.recommendations.length} recommendations
                  </div>
                )}

                <div className="text-xs text-quaternary mt-2">
                  {new Date(report.createdAt).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Button
                    color="tertiary-destructive"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleDelete(report._id, report.keyword);
                    }}
                    iconLeading={Trash01}
                    title="Delete report"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Details */}
        <div className="lg:col-span-2 p-6 max-h-[600px] overflow-y-auto">
          {!selectedReport ? (
            <div className="text-center py-12 text-tertiary">
              <Eye className="h-12 w-12 text-quaternary mx-auto mb-4" />
              <p>Select a report to view details</p>
            </div>
          ) : !reportDetails ? (
            <div className="text-center py-12 text-tertiary">
              <RefreshCcw01 className="h-12 w-12 text-quaternary mx-auto mb-4 animate-spin" />
              <p>Loading report...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Report Header */}
              <div>
                <h2 className="text-xl font-semibold text-primary mb-2">{reportDetails.keyword}</h2>
                <div className="flex items-center gap-2">
                  <Badge color={getStatusBadgeColor(reportDetails.status)} size="sm">
                    {reportDetails.status}
                  </Badge>
                  {reportDetails.status === "analyzing" && (
                    <span className="text-sm text-tertiary">Analysis in progress...</span>
                  )}
                  {reportDetails.status === "failed" && reportDetails.error && (
                    <span className="text-sm text-utility-error-600">{reportDetails.error}</span>
                  )}
                </div>
              </div>

              {reportDetails.status === "completed" && (
                <>
                  {/* Analyzed Competitors */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3">Analyzed Competitors</h3>
                    <div className="space-y-2">
                      {reportDetails.competitorPages.map((comp, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-secondary rounded-lg bg-secondary/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-primary">{comp.domain}</span>
                              <Badge color="gray" size="sm">#{comp.position}</Badge>
                            </div>
                            <a
                              href={comp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-utility-blue-600 hover:underline break-all"
                            >
                              {comp.url}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Analysis Summary */}
                  {reportDetails.analysis && (
                    <div>
                      <h3 className="text-sm font-semibold text-primary mb-3">Competitor Averages</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 border border-secondary rounded-lg bg-secondary/30">
                          <p className="text-xs text-tertiary mb-1">Avg Word Count</p>
                          <p className="text-2xl font-bold text-primary">
                            {!reportDetails.analysis.avgCompetitorWordCount || isNaN(reportDetails.analysis.avgCompetitorWordCount)
                              ? "—"
                              : Math.round(reportDetails.analysis.avgCompetitorWordCount).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 border border-secondary rounded-lg bg-secondary/30">
                          <p className="text-xs text-tertiary mb-1">Avg H2 Headings</p>
                          <p className="text-2xl font-bold text-primary">
                            {!reportDetails.analysis.avgCompetitorH2Count || isNaN(reportDetails.analysis.avgCompetitorH2Count)
                              ? "—"
                              : Math.round(reportDetails.analysis.avgCompetitorH2Count)}
                          </p>
                        </div>
                        <div className="p-4 border border-secondary rounded-lg bg-secondary/30">
                          <p className="text-xs text-tertiary mb-1">Avg Images</p>
                          <p className="text-2xl font-bold text-primary">
                            {!reportDetails.analysis.avgCompetitorImagesCount || isNaN(reportDetails.analysis.avgCompetitorImagesCount)
                              ? "—"
                              : Math.round(reportDetails.analysis.avgCompetitorImagesCount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {reportDetails.recommendations && reportDetails.recommendations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-primary mb-3">
                        Actionable Recommendations ({reportDetails.recommendations.length})
                      </h3>
                      <div className="space-y-4">
                        {reportDetails.recommendations
                          .sort((a, b) => {
                            const priorityOrder = { high: 0, medium: 1, low: 2 };
                            return priorityOrder[a.priority] - priorityOrder[b.priority];
                          })
                          .map((rec, idx) => (
                            <div key={idx} className="p-4 border border-secondary rounded-lg bg-secondary/30">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-primary">{rec.title}</h4>
                                <Badge color={getPriorityColor(rec.priority)} size="sm">
                                  {rec.priority}
                                </Badge>
                              </div>

                              <p className="text-sm text-tertiary mb-3">{rec.description}</p>

                              {rec.actionSteps && rec.actionSteps.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-tertiary mb-2">Action Steps:</p>
                                  <ul className="space-y-1">
                                    {rec.actionSteps.map((step, stepIdx) => (
                                      <li key={stepIdx} className="text-xs text-tertiary flex items-start gap-2">
                                        <span className="text-brand-primary mt-0.5">•</span>
                                        <span>{step}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="mt-3 pt-3 border-t border-secondary">
                                <Badge color="gray" size="sm">{rec.category}</Badge>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
