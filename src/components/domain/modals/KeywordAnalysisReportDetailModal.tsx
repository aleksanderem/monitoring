"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { XClose, ArrowUpRight, AlertCircle, FileSearch02, RefreshCw01 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { toast } from "sonner";
import { GlowingEffect } from "@/components/ui/glowing-effect";

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
  const t = useTranslations('keywords');
  const tc = useTranslations('common');
  const tComp = useTranslations('competitors');
  const translateStatus = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as any;
    try { return tc(key); } catch { return status; }
  };
  const translatePriority = (priority: string) => {
    const key = `priority${priority.charAt(0).toUpperCase()}${priority.slice(1)}` as any;
    try { return tc(key); } catch { return priority; }
  };
  const translateCategory = (category: string) => {
    const key = `category${category.charAt(0).toUpperCase()}${category.slice(1)}` as any;
    try { return tc(key); } catch { return category; }
  };

  // Map backend recommendation content to translation keys
  const REC_TITLE_MAP: Record<string, string> = {
    "Increase content length": "recIncreaseContentTitle",
    "Improve heading structure": "recImproveHeadingsTitle",
    "Add more images": "recAddImagesTitle",
    "Build quality backlinks": "recBuildBacklinksTitle",
  };
  const REC_STEPS_MAP: Record<string, string[]> = {
    "Increase content length": ["recIncreaseContentStep1", "recIncreaseContentStep2", "recIncreaseContentStep3", "recIncreaseContentStep4"],
    "Improve heading structure": ["recImproveHeadingsStep1", "recImproveHeadingsStep2", "recImproveHeadingsStep3"],
    "Add more images": ["recAddImagesStep1", "recAddImagesStep2", "recAddImagesStep3"],
    "Build quality backlinks": ["recBuildBacklinksStep1", "recBuildBacklinksStep2", "recBuildBacklinksStep3", "recBuildBacklinksStep4"],
  };
  const translateRecTitle = (title: string) => {
    const key = REC_TITLE_MAP[title];
    return key ? tComp(key as any) : title;
  };
  const translateRecSteps = (title: string, steps: string[]) => {
    const keys = REC_STEPS_MAP[title];
    return keys ? keys.map((k) => tComp(k as any)) : steps;
  };
  const translateRecDesc = (title: string, description: string, analysis: any) => {
    switch (title) {
      case "Increase content length": {
        const avgWords = Math.round(analysis?.avgCompetitorWordCount || 0);
        const gapMatch = description.match(/Add ~(\d+) more words/);
        return tComp('recIncreaseContentDesc' as any, {
          avgWords,
          gap: gapMatch ? "positive" : "other",
          gapWords: gapMatch ? gapMatch[1] : "0",
        });
      }
      case "Improve heading structure":
        return tComp('recImproveHeadingsDesc' as any, {
          count: Math.round(analysis?.avgCompetitorH2Count || 0),
        });
      case "Add more images":
        return tComp('recAddImagesDesc' as any, {
          count: Math.round(analysis?.avgCompetitorImagesCount || 0),
        });
      case "Build quality backlinks":
        return tComp('recBuildBacklinksDesc' as any);
      default:
        return description;
    }
  };
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
      toast.success(t('reAnalyzingReport'));
    } catch (error: any) {
      toast.error(error?.message || t('failedToRetryAnalysis'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteReport({ reportId });
      toast.success(t('reportDeleted'));
      onClose();
    } catch (error: any) {
      toast.error(error?.message || t('failedToDeleteReport'));
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
      <div className="fixed inset-0 bg-overlay/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-secondary bg-primary dark:bg-[#1f2530] shadow-xl mx-4">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-secondary bg-primary px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <FileSearch02 className="h-5 w-5 text-brand-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-primary truncate">
                {report?.keyword || tc("loading")}
              </h2>
              {report && (
                <Badge color={getStatusColor(report.status)} size="sm">
                  {translateStatus(report.status)}
                </Badge>
              )}
            </div>
            {report && (
              <p className="text-sm text-tertiary">
                {t('reportCreatedInfo', { date: new Date(report.createdAt).toLocaleDateString(), count: report.competitorPages.length })}
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
            <h3 className="text-md font-semibold text-primary mb-2">{t('analysisFailed')}</h3>
            <p className="text-sm text-tertiary mb-4">{report.error || tc('unexpectedError')}</p>
            <p className="text-xs text-quaternary">
              {t('failedAtTime', { time: report.completedAt ? new Date(report.completedAt).toLocaleString() : "—" })}
            </p>
          </div>
        )}

        {/* Analyzing state */}
        {report?.status === "analyzing" && (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4" />
            <h3 className="text-md font-semibold text-primary mb-2">{t('analysisInProgress')}</h3>
            <p className="text-sm text-tertiary">
              {t('analyzingCompetitorPages')}
            </p>
          </div>
        )}

        {/* Pending state */}
        {report?.status === "pending" && (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-pulse rounded-full h-12 w-12 bg-secondary mb-4" />
            <h3 className="text-md font-semibold text-primary mb-2">{t('queued')}</h3>
            <p className="text-sm text-tertiary">{t('reportWaitingToProcess')}</p>
          </div>
        )}

        {/* Completed report */}
        {report?.status === "completed" && (
          <div className="px-6 py-6 space-y-6">
            {/* User page info */}
            {report.userPage && (
              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <h3 className="text-sm font-semibold text-primary mb-2">{t('yourPage')}</h3>
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
              <h3 className="text-sm font-semibold text-primary mb-3">{t('analyzedCompetitors')}</h3>
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
                <h3 className="text-sm font-semibold text-primary mb-3">{t('competitorAverages')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs text-tertiary mb-1">{t('avgWordCount')}</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(report.analysis.avgCompetitorWordCount).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs text-tertiary mb-1">{t('avgH2Headings')}</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(report.analysis.avgCompetitorH2Count)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs text-tertiary mb-1">{t('avgImages')}</p>
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
                  {tc('recommendations')} ({report.recommendations.length})
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
                          <h4 className="text-sm font-semibold text-primary">{translateRecTitle(rec.title)}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge color={getCategoryColor(rec.category)} size="sm">
                              {translateCategory(rec.category)}
                            </Badge>
                            <Badge color={getPriorityColor(rec.priority)} size="sm">
                              {translatePriority(rec.priority)}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-tertiary mb-3">{translateRecDesc(rec.title, rec.description, report.analysis)}</p>
                        {rec.actionSteps && rec.actionSteps.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-tertiary mb-2">{t('actionSteps')}:</p>
                            <ul className="space-y-1">
                              {translateRecSteps(rec.title, rec.actionSteps).map((step, stepIdx) => (
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
            {t('deleteReport')}
          </Button>
          <div className="flex items-center gap-2">
            {report && (report.status === "completed" || report.status === "failed") && (
              <Button color="secondary" size="sm" iconLeading={RefreshCw01} onClick={handleRetry}>
                {t('reAnalyze')}
              </Button>
            )}
            <Button color="secondary" size="sm" onClick={onClose}>
              {tc('close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
