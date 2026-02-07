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
  FileCheck02,
  Clock,
} from "@untitledui/icons";

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

export function GenerateReportModal({ isOpen, onClose, domainId, domainName }: GenerateReportModalProps) {
  const [reportId, setReportId] = useState<Id<"domainReports"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const generateReport = useAction(api.domainReports.generateDomainReport);
  const cancelReport = useAction(api.domainReports.cancelDomainReport);

  const report = useQuery(
    api.domainReports.getDomainReport,
    reportId ? { reportId } : "skip"
  );

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await generateReport({ domainId });
      setReportId(result.reportId);
    } catch (error) {
      console.error("Failed to generate report:", error);
      setIsGenerating(false);
    }
  }, [generateReport, domainId]);

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
      const blob = await generateDomainReportPdf(report.reportData, domainName);
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
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && handleClose()} isDismissable={!isInProgress}>
      <Modal>
        <Dialog className="overflow-hidden">
          <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-lg">
            <CloseButton
              onClick={handleClose}
              isDisabled={!!isInProgress}
              theme="light"
              size="lg"
              className="absolute top-3 right-3 z-10"
            />

            {/* Header */}
            <div className="border-b border-secondary px-6 py-4">
              <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                Generate SEO Report
              </AriaHeading>
              <p className="mt-1 text-sm text-tertiary">
                Full domain analysis for <span className="font-medium text-primary">{domainName}</span>
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* State 1: Confirmation */}
              {!reportId && !isGenerating && (
                <div className="space-y-4">
                  <p className="text-sm text-secondary">
                    This will run all analyses and collect data into a downloadable PDF:
                  </p>
                  <ul className="space-y-2 text-sm text-tertiary">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-success-500" />
                      Run competitor backlink analysis (if data is stale)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-success-500" />
                      Analyze content gaps with competitors
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-success-500" />
                      Generate link building prospects
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-success-500" />
                      Collect all metrics into a downloadable PDF
                    </li>
                  </ul>
                  <p className="text-xs text-quaternary">
                    Fresh data (less than 24h old) will be reused. This may take a few minutes.
                  </p>
                </div>
              )}

              {/* State 2: Progress */}
              {(isGenerating || isInProgress) && report && (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-secondary">{report.currentStep || "Processing..."}</span>
                      <span className="font-medium text-primary">{report.progress ?? 0}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
                        style={{ width: `${report.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps list */}
                  {report.steps && (
                    <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-lg border border-secondary p-3">
                      {report.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-1">
                          <StepIcon status={step.status as StepStatus} />
                          <span className={`text-sm ${step.status === "running" ? "font-medium text-primary" : step.status === "completed" ? "text-secondary" : step.status === "skipped" ? "text-quaternary" : step.status === "failed" ? "text-error-500" : "text-tertiary"}`}>
                            {step.name}
                          </span>
                          {step.status === "skipped" && (
                            <span className="text-xs text-quaternary">(fresh)</span>
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
                  <span className="text-sm text-secondary">Starting report generation...</span>
                </div>
              )}

              {/* State 3: Complete */}
              {isReady && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 p-4">
                    <CheckCircle className="size-5 text-success-600" />
                    <div>
                      <p className="text-sm font-medium text-success-700">Report ready!</p>
                      <p className="text-xs text-success-600">
                        Generated at {new Date(report.completedAt ?? Date.now()).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {report.reportData?.healthScore && (
                    <div className="flex items-center justify-between rounded-lg border border-secondary p-4">
                      <span className="text-sm text-secondary">Health Score</span>
                      <span className={`text-2xl font-bold ${report.reportData.healthScore.total >= 70 ? "text-success-600" : report.reportData.healthScore.total >= 40 ? "text-warning-600" : "text-error-600"}`}>
                        {report.reportData.healthScore.total}/100
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* State: Failed */}
              {isFailed && (
                <div className="flex items-center gap-3 rounded-lg border border-error-200 bg-error-50 p-4">
                  <AlertCircle className="size-5 text-error-600" />
                  <div>
                    <p className="text-sm font-medium text-error-700">Report generation failed</p>
                    <p className="text-xs text-error-600">{report.error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-secondary px-6 py-4">
              {!reportId && !isGenerating && (
                <>
                  <Button size="md" color="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button size="md" color="primary" onClick={handleGenerate}>
                    Generate Report
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
                  {isCancelling ? "Cancelling..." : "Stop"}
                </Button>
              )}

              {isReady && (
                <>
                  <Button size="md" color="secondary" onClick={handleClose}>
                    Close
                  </Button>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={isDownloading ? Loading02 : DownloadCloud02}
                    isDisabled={isDownloading}
                    onClick={handleDownloadPdf}
                  >
                    {isDownloading ? "Generating PDF..." : "Download PDF"}
                  </Button>
                </>
              )}

              {isFailed && (
                <>
                  <Button size="md" color="secondary" onClick={handleClose}>
                    Close
                  </Button>
                  <Button size="md" color="primary" onClick={handleGenerate}>
                    Retry
                  </Button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
