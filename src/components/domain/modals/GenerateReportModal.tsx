"use client";

import { useState, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { Heading as AriaHeading } from "react-aria-components";
import {
  CheckCircle,
  Loading02,
  AlertCircle,
  MinusCircle,
  DownloadCloud02,
  Clock,
  Lightning01,
  BarChart01,
  File06,
  Settings01,
  Edit05,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { AlertFloating } from "@/components/application/alerts/alerts";
import {
  type ReportProfile,
  type ReportConfig,
  configFromPreset,
} from "@/lib/reportSections";
import { ReportSectionEditorModal } from "./ReportSectionEditorModal";

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: Id<"domains">;
  domainName: string;
}

type StepStatus = "pending" | "running" | "completed" | "skipped" | "failed";

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="size-4 text-success-500" />;
    case "running":
      return <Loading02 className="size-4 animate-spin text-brand-500" />;
    case "failed":
      return <AlertCircle className="size-4 text-error-500" />;
    case "skipped":
      return <MinusCircle className="size-4 text-tertiary" />;
    case "pending":
    default:
      return <Clock className="size-4 text-quaternary" />;
  }
}

const STEP_NAME_MAP: Record<string, string> = {
  "Fetching competitor backlinks": "reportStepFetchCompetitorBacklinks",
  "Analyzing content gaps": "reportStepAnalyzeContentGaps",
  "Generating link building prospects": "reportStepGenerateProspects",
  "Checking on-site data": "reportStepCheckOnSiteData",
  "Collecting keyword data": "reportStepCollectKeywordData",
  "Collecting backlink data": "reportStepCollectBacklinkData",
  "Collecting competitor data": "reportStepCollectCompetitorData",
  "Collecting content gap data": "reportStepCollectContentGapData",
  "Collecting on-site data": "reportStepCollectOnSiteData",
  "Collecting insights & recommendations": "reportStepCollectInsights",
};

const CURRENT_STEP_MAP: Record<string, string> = {
  "Initializing...": "reportCurrentStepInitializing",
  "Checking data freshness...": "reportCurrentStepCheckingFreshness",
  "Fetching competitor backlinks...": "reportCurrentStepFetchingBacklinks",
  "Analyzing content gaps...": "reportCurrentStepAnalyzingGaps",
  "Generating link building prospects...": "reportCurrentStepGeneratingProspects",
  "Checking on-site data...": "reportCurrentStepCheckingOnSite",
  "Collecting report data...": "reportCurrentStepCollectingData",
  "Finalizing report...": "reportCurrentStepFinalizing",
  "Report ready!": "reportCurrentStepReady",
};

export function GenerateReportModal({ isOpen, onClose, domainId, domainName }: GenerateReportModalProps) {
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const translateStepName = (name: string) => {
    const key = STEP_NAME_MAP[name];
    return key ? t(key as any) : name;
  };
  const translateCurrentStep = (step: string) => {
    const key = CURRENT_STEP_MAP[step];
    return key ? t(key as any) : step;
  };
  const [reportId, setReportId] = useState<Id<"domainReports"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [profile, setProfile] = useState<ReportProfile>("full");
  const [customConfig, setCustomConfig] = useState<ReportConfig>(() => configFromPreset("full"));
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const enabledCustomCount = customConfig.sections.filter(s => s.enabled).length;

  const PROFILE_OPTIONS: { id: ReportProfile; icon: typeof Lightning01; sectionCount: number }[] = [
    { id: "quick", icon: Lightning01, sectionCount: 1 },
    { id: "standard", icon: BarChart01, sectionCount: 4 },
    { id: "full", icon: File06, sectionCount: 7 },
    { id: "custom", icon: Settings01, sectionCount: enabledCustomCount },
  ];

  const generateReport = useAction(api.domainReports.generateDomainReport);
  const cancelReport = useAction(api.domainReports.cancelDomainReport);

  const report = useQuery(
    api.domainReports.getDomainReport,
    reportId ? { reportId } : "skip"
  );

  const handleProfileChange = useCallback((newProfile: ReportProfile) => {
    if (newProfile === "custom") {
      setProfile("custom");
      setIsEditorOpen(true);
    } else {
      setProfile(newProfile);
      setCustomConfig(configFromPreset(newProfile));
    }
  }, []);

  const handleEditorSave = useCallback((config: ReportConfig) => {
    setCustomConfig(config);
    setProfile("custom");
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await generateReport({
        domainId,
        profile,
        ...(profile === "custom" ? { reportConfig: customConfig } : {}),
      });
      setReportId(result.reportId);
    } catch (error) {
      console.error("Failed to generate report:", error);
      setIsGenerating(false);
    }
  }, [generateReport, domainId, profile, customConfig]);

  const handleCancel = useCallback(async () => {
    if (!reportId) return;
    setIsCancelling(true);
    try {
      await cancelReport({ reportId });
    } catch (error) {
      console.error("Failed to cancel report:", error);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelReport, reportId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!report?.reportData) return;
    setIsDownloading(true);
    try {
      const { generateDomainReportPdf } = await import("@/lib/generateDomainReportPdf");
      const reportProfile = (report as any).profile ?? "full";
      const reportCfg = (report as any).reportConfig ?? undefined;
      const blob = await generateDomainReportPdf(report.reportData, domainName, reportProfile, reportCfg);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SEO-Report-${domainName}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [report, domainName]);

  const handleClose = useCallback(() => {
    if (report?.status === "ready" || report?.status === "failed" || !reportId) {
      setReportId(null);
      setIsGenerating(false);
      onClose();
    }
  }, [report, reportId, onClose]);

  const isInProgress = report && report.status !== "ready" && report.status !== "failed";
  const isReady = report?.status === "ready";
  const isFailed = report?.status === "failed";

  return (
    <>
      <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && handleClose()} isDismissable={!isInProgress}>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-lg">
              <CloseButton
                onPress={handleClose}
                isDisabled={!!isInProgress}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={File06} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t('generateReportTitle')}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {t('generateReportSubtitle', { domain: domainName })}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5">
                {/* State 1: Confirmation */}
                {!reportId && !isGenerating && (
                  <div className="space-y-4">
                    <p className="text-sm text-secondary">
                      {t('generateReportConfirmation')}
                    </p>

                    {/* Profile Selector — 4 cards */}
                    <div>
                      <p className="mb-2 text-xs font-medium text-secondary">{t('reportProfileLabel')}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {PROFILE_OPTIONS.map(({ id, icon: Icon, sectionCount }) => {
                          const isSelected = profile === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => handleProfileChange(id)}
                              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                                isSelected
                                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                                  : "border-secondary bg-primary hover:border-tertiary"
                              }`}
                            >
                              <Icon className={`size-5 ${isSelected ? "text-brand-600" : "text-quaternary"}`} />
                              <span className={`text-sm font-medium ${isSelected ? "text-brand-700 dark:text-brand-400" : "text-primary"}`}>
                                {t(`reportProfile${id.charAt(0).toUpperCase() + id.slice(1)}` as any)}
                              </span>
                              <span className="text-[11px] leading-tight text-tertiary">
                                {t(`reportProfile${id.charAt(0).toUpperCase() + id.slice(1)}Desc` as any)}
                              </span>
                              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isSelected
                                  ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                                  : "bg-tertiary text-secondary"
                              }`}>
                                {t('reportProfileSections', { count: sectionCount })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom config summary + edit button */}
                    {profile === "custom" && (
                      <div className="flex items-center justify-between rounded-lg border border-secondary bg-secondary_subtle px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-primary">
                            {t('reportProfileSections', { count: enabledCustomCount })}
                          </p>
                          <p className="text-xs text-tertiary">
                            {customConfig.sections
                              .filter(s => s.enabled)
                              .map(s => t((`section${s.id.charAt(0).toUpperCase() + s.id.slice(1)}`) as any))
                              .join(", ")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          color="secondary"
                          iconLeading={Edit05}
                          onClick={() => setIsEditorOpen(true)}
                        >
                          {t('reportEditorExpandSection' as any)}
                        </Button>
                      </div>
                    )}

                    <p className="text-xs text-quaternary">
                      {t('generateReportFreshDataNote')}
                    </p>
                  </div>
                )}

                {/* State 2: Progress */}
                {(isGenerating || isInProgress) && report && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary">{report.currentStep ? translateCurrentStep(report.currentStep) : t('generateReportProcessing')}</span>
                        <span className="font-medium text-primary">{report.progress ?? 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
                          style={{ width: `${report.progress ?? 0}%` }}
                        />
                      </div>
                    </div>

                    {report.steps && (
                      <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-lg border border-secondary p-3">
                        {report.steps.map((step, i) => (
                          <div key={i} className="flex items-center gap-2.5 py-1">
                            <StepIcon status={step.status as StepStatus} />
                            <span className={`text-sm ${step.status === "running" ? "font-medium text-primary" : step.status === "completed" ? "text-secondary" : step.status === "skipped" ? "text-quaternary" : step.status === "failed" ? "text-error-500" : "text-tertiary"}`}>
                              {translateStepName(step.name)}
                            </span>
                            {step.status === "skipped" && (
                              <span className="text-xs text-quaternary">{t('generateReportStepFresh')}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Waiting for report to load */}
                {isGenerating && !report && (
                  <div className="flex items-center gap-3 py-8">
                    <Loading02 className="size-5 animate-spin text-brand-500" />
                    <span className="text-sm text-secondary">{t('generateReportStarting')}</span>
                  </div>
                )}

                {/* State 3: Complete */}
                {isReady && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 p-4">
                      <CheckCircle className="size-5 text-success-600" />
                      <div>
                        <p className="text-sm font-medium text-success-700">{t('generateReportReady')}</p>
                        <p className="text-xs text-success-600">
                          {t('generateReportGeneratedAt', { time: new Date(report.completedAt ?? Date.now()).toLocaleTimeString() })}
                        </p>
                      </div>
                    </div>

                    {report.reportData?.healthScore && (
                      <div className="flex items-center justify-between rounded-lg border border-secondary p-4">
                        <span className="text-sm text-secondary">{t('generateReportHealthScore')}</span>
                        <span className={`text-2xl font-bold ${report.reportData.healthScore.total >= 70 ? "text-success-600" : report.reportData.healthScore.total >= 40 ? "text-warning-600" : "text-error-600"}`}>
                          {report.reportData.healthScore.total}/100
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* State: Failed */}
                {isFailed && (
                  <AlertFloating
                    color="error"
                    title={t('generateReportFailed')}
                    description={report?.error || tc('unexpectedError')}
                    confirmLabel=""
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-secondary px-6 py-4">
                {!reportId && !isGenerating && (
                  <>
                    <Button size="md" color="secondary" onClick={onClose}>
                      {tc('cancel')}
                    </Button>
                    <Button size="md" color="primary" onClick={handleGenerate}>
                      {t('generateReportButton')}
                    </Button>
                  </>
                )}

                {(isInProgress || (isGenerating && !report)) && (
                  <Button
                    size="md"
                    color="secondary-destructive"
                    isDisabled={isCancelling}
                    onClick={handleCancel}
                  >
                    {isCancelling ? t('generateReportCancelling') : t('generateReportStop')}
                  </Button>
                )}

                {isReady && (
                  <>
                    <Button size="md" color="secondary" onClick={handleClose}>
                      {tc('close')}
                    </Button>
                    <Button
                      size="md"
                      color="primary"
                      iconLeading={isDownloading ? Loading02 : DownloadCloud02}
                      isDisabled={isDownloading}
                      onClick={handleDownloadPdf}
                    >
                      {isDownloading ? t('generateReportGeneratingPdf') : t('generateReportDownloadPdf')}
                    </Button>
                  </>
                )}

                {isFailed && (
                  <>
                    <Button size="md" color="secondary" onClick={handleClose}>
                      {tc('close')}
                    </Button>
                    <Button size="md" color="primary" onClick={handleGenerate}>
                      {t('generateReportRetry')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Section Editor — separate modal */}
      <ReportSectionEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        config={customConfig}
        onSave={handleEditorSave}
      />
    </>
  );
}
