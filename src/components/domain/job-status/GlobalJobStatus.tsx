"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RefreshCw01, ChevronDown, ChevronUp, XCircle } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Job type icons / colors — keys match backend job.type values
const JOB_TYPE_CONFIG: Record<string, { color: string; bgColor: string; labelKey: string }> = {
  "Keyword Check": { color: "text-brand-700", bgColor: "bg-brand-50", labelKey: "jobTypeKeywordCheck" },
  "SERP Fetch": { color: "text-purple-700", bgColor: "bg-purple-50", labelKey: "jobTypeSerpFetch" },
  "On-Site Scan": { color: "text-orange-700", bgColor: "bg-orange-50", labelKey: "jobTypeOnSiteScan" },
  "Competitor Backlinks": { color: "text-emerald-700", bgColor: "bg-emerald-50", labelKey: "jobTypeCompetitorBacklinks" },
  "Content Gap Analysis": { color: "text-blue-700", bgColor: "bg-blue-50", labelKey: "jobTypeContentGapAnalysis" },
  "Report Generation": { color: "text-pink-700", bgColor: "bg-pink-50", labelKey: "jobTypeReportGeneration" },
  "Domain SEO Report": { color: "text-indigo-700", bgColor: "bg-indigo-50", labelKey: "jobTypeDomainSeoReport" },
};

export function GlobalJobStatus() {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const tk = useTranslations("keywords");
  const translateStatus = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as any;
    try { return tc(key); } catch { return status; }
  };
  const [isExpanded, setIsExpanded] = useState(true);
  const [cancellingJobIds, setCancellingJobIds] = useState<Set<string>>(new Set());
  const notifiedFailuresRef = useRef<Set<string>>(new Set());

  const activeJobs = useQuery(api.jobs_queries.getAllJobs, { filter: "active" });
  const recentlyFailed = useQuery(api.jobs_queries.getAllJobs, { filter: "recentlyFailed" });
  const cancelAnyJob = useMutation(api.jobs_queries.cancelAnyJob);

  // Show toast for newly failed jobs
  useEffect(() => {
    if (!recentlyFailed) return;
    for (const job of recentlyFailed) {
      if (!notifiedFailuresRef.current.has(job.id)) {
        notifiedFailuresRef.current.add(job.id);
        const errorMsg = job.error || tc("unexpectedError");
        const jobLabel = JOB_TYPE_CONFIG[job.type]?.labelKey ? tk(JOB_TYPE_CONFIG[job.type].labelKey as any) : job.type;
        toast.error(tk("jobFailedToast", { type: jobLabel, domain: job.domainName }), {
          description: errorMsg.length > 100 ? errorMsg.slice(0, 100) + "..." : errorMsg,
          duration: 8000,
        });
      }
    }
  }, [recentlyFailed]);

  const handleCancelJob = async (table: string, jobId: string) => {
    setCancellingJobIds((prev) => new Set(prev).add(jobId));
    try {
      await cancelAnyJob({ table, jobId });
      toast.success(t("jobCancelled"));
    } catch (error) {
      toast.error(t("failedCancelJob"));
      console.error(error);
    } finally {
      setCancellingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  // Don't render if no active jobs
  if (!activeJobs || activeJobs.length === 0) {
    return null;
  }

  const totalJobs = activeJobs.length;
  const processingJobs = activeJobs.filter((j) => j.status === "processing");

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 rounded-lg border border-secondary bg-primary shadow-xl">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 rounded-t-lg border-b border-secondary bg-secondary-subtle px-4 py-3 text-left transition-colors hover:bg-primary_hover"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50">
          <RefreshCw01 className="h-4 w-4 animate-spin text-brand-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-primary">
            {t("jobsRunning", { count: totalJobs })}
          </div>
          <div className="text-xs text-tertiary">
            {t("processingPending", { processing: processingJobs.length, pending: totalJobs - processingJobs.length })}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-quaternary" />
        ) : (
          <ChevronUp className="h-5 w-5 text-quaternary" />
        )}
      </button>

      {/* Expanded view with job details */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto p-3">
          <div className="space-y-2">
            {activeJobs.map((job) => {
              const config = JOB_TYPE_CONFIG[job.type] ?? {
                color: "text-gray-700",
                bgColor: "bg-gray-50",
              };
              const isCancelling = cancellingJobIds.has(job.id);

              return (
                <div
                  key={job.id}
                  className="rounded-lg border border-secondary bg-primary p-3"
                >
                  {/* Top row: type badge + domain + stop button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cx(
                            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            config.bgColor,
                            config.color
                          )}
                        >
                          {config.labelKey ? tk(config.labelKey as any) : job.type}
                        </span>
                        <span className="text-sm font-medium text-primary truncate">
                          {job.domainName}
                        </span>
                      </div>
                      {job.currentStep && (
                        <div className="mt-1 text-xs text-tertiary truncate">
                          {job.currentStep}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleCancelJob(job.table, job.id)}
                      disabled={isCancelling}
                      className="shrink-0 rounded-md p-1.5 text-fg-quaternary transition-colors hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
                      title={t("stopJob")}
                    >
                      {isCancelling ? (
                        <RefreshCw01 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Progress bar (only if we have progress data) */}
                  {job.progress != null && (
                    <div className="mt-2">
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-brand-600 transition-all duration-300"
                          style={{ width: `${Math.min(job.progress, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-quaternary">
                        <span>{job.progress}%</span>
                        <span
                          className={cx(
                            job.status === "processing"
                              ? "text-brand-600"
                              : "text-quaternary"
                          )}
                        >
                          {translateStatus(job.status)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Status indicator when no progress */}
                  {job.progress == null && (
                    <div className="mt-2 flex items-center gap-2">
                      <RefreshCw01
                        className={cx(
                          "h-3 w-3",
                          job.status === "processing"
                            ? "animate-spin text-brand-600"
                            : "text-quaternary"
                        )}
                      />
                      <span className="text-xs text-tertiary">
                        {translateStatus(job.status)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
