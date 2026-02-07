"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { XClose, ArrowUpRight, AlertCircle, FileSearch02, RefreshCw01 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { toast } from "sonner";

interface KeywordAnalysisReportDetailModalProps {
  reportId: Id<"competitorAnalysisReports">;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordAnalysisReportDetailModal({
  reportId,
  isOpen,
  onClose,
}: KeywordAnalysisReportDetailModalProps) {
  useEscapeClose(onClose, isOpen);

  const report = useQuery(
    api.competitorAnalysisReports.getReport,
    isOpen ? { reportId } : "skip"
  );
  const deleteReport = useMutation(api.competitorAnalysisReports.deleteReport);
  const retryAnalysis = useMutation(api.competitorAnalysisReports.retryAnalysis);

  if (!isOpen) return null;

  const handleRetry = async () => {
    try {
      await retryAnalysis({ reportId });
      toast.success("Re-analyzing report...");
    } catch (error: any) {
      toast.error(error?.message || "Failed to retry analysis");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteReport({ reportId });
      toast.success("Report deleted");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete report");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "analyzing": return "brand";
      case "failed": return "error";
      case "pending": return "gray";
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "content": return "brand";
      case "onpage": return "warning";
      case "backlinks": return "success";
      case "technical": return "gray-blue";
      default: return "gray";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-secondary bg-primary shadow-xl mx-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-secondary bg-primary px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <FileSearch02 className="h-5 w-5 text-brand-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-primary truncate">
                {report?.keyword || "Loading..."}
              </h2>
              {report && (
                <Badge color={getStatusColor(report.status)} size="sm">
                  {report.status}
                </Badge>
              )}
            </div>
            {report && (
              <p className="text-sm text-tertiary">
                Created {new Date(report.createdAt).toLocaleDateString()} · {report.competitorPages.length} competitors analyzed
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-quaternary hover:text-primary hover:bg-secondary transition-colors flex-shrink-0"
          >
            <XClose className="h-5 w-5" />
          </button>
        </div>

        {/* Loading */}
        {!report && (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        )}

        {/* Failed state */}
        {report?.status === "failed" && (
          <div className="px-6 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-error-600 mx-auto mb-4" />
            <h3 className="text-md font-semibold text-primary mb-2">Analysis Failed</h3>
            <p className="text-sm text-tertiary mb-4">{report.error || "Unknown error occurred"}</p>
            <p className="text-xs text-quaternary">
              Failed at: {report.completedAt ? new Date(report.completedAt).toLocaleString() : "—"}
            </p>
          </div>
        )}

        {/* Analyzing state */}
        {report?.status === "analyzing" && (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4" />
            <h3 className="text-md font-semibold text-primary mb-2">Analysis In Progress</h3>
            <p className="text-sm text-tertiary">
              Analyzing competitor pages and generating recommendations...
            </p>
          </div>
        )}

        {/* Pending state */}
        {report?.status === "pending" && (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-pulse rounded-full h-12 w-12 bg-secondary mb-4" />
            <h3 className="text-md font-semibold text-primary mb-2">Queued</h3>
            <p className="text-sm text-tertiary">This report is waiting to be processed.</p>
          </div>
        )}

        {/* Completed report */}
        {report?.status === "completed" && (
          <div className="px-6 py-6 space-y-6">
            {/* User page info */}
            {report.userPage && (
              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <h3 className="text-sm font-semibold text-primary mb-2">Your Page</h3>
                <div className="flex items-center gap-3">
                  <Badge color="brand" size="sm">#{report.userPage.position}</Badge>
                  <a
                    href={report.userPage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline truncate flex items-center gap-1"
                  >
                    {report.userPage.url}
                    <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            )}

            {/* Analyzed Competitors */}
            <div>
              <h3 className="text-sm font-semibold text-primary mb-3">Analyzed Competitors</h3>
              <div className="space-y-2">
                {report.competitorPages.map((comp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border border-secondary bg-secondary/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge color="gray" size="sm">#{comp.position}</Badge>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-primary">{comp.domain}</span>
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-brand-600 hover:underline truncate"
                        >
                          {comp.url}
                        </a>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-quaternary flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis Summary — only show when we have real data (not all zeros) */}
            {report.analysis && (
              report.analysis.avgCompetitorWordCount > 0 ||
              report.analysis.avgCompetitorH2Count > 0 ||
              report.analysis.avgCompetitorImagesCount > 0
            ) && (
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Competitor Averages</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs text-tertiary mb-1">Avg Word Count</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(report.analysis.avgCompetitorWordCount).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs text-tertiary mb-1">Avg H2 Headings</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(report.analysis.avgCompetitorH2Count)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs text-tertiary mb-1">Avg Images</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(report.analysis.avgCompetitorImagesCount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">
                  Recommendations ({report.recommendations.length})
                </h3>
                <div className="space-y-3">
                  {report.recommendations
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.priority] - order[b.priority];
                    })
                    .map((rec, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-secondary bg-secondary/30 p-4"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-primary">{rec.title}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge color={getCategoryColor(rec.category)} size="sm">
                              {rec.category}
                            </Badge>
                            <Badge color={getPriorityColor(rec.priority)} size="sm">
                              {rec.priority}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-tertiary mb-3">{rec.description}</p>
                        {rec.actionSteps && rec.actionSteps.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-tertiary mb-2">Action Steps:</p>
                            <ul className="space-y-1">
                              {rec.actionSteps.map((step, stepIdx) => (
                                <li
                                  key={stepIdx}
                                  className="text-xs text-tertiary flex items-start gap-2"
                                >
                                  <span className="text-brand-primary mt-0.5">•</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-secondary bg-primary px-6 py-4">
          <Button color="tertiary-destructive" size="sm" onClick={handleDelete}>
            Delete Report
          </Button>
          <div className="flex items-center gap-2">
            {report && (report.status === "completed" || report.status === "failed") && (
              <Button color="secondary" size="sm" iconLeading={RefreshCw01} onClick={handleRetry}>
                Re-analyze
              </Button>
            )}
            <Button color="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
