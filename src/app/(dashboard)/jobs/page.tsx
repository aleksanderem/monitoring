"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  Activity,
  Clock,
  Calendar,
  XCircle,
  CheckCircle,
  AlertCircle,
  RefreshCw01,
  MinusCircle,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatTimeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  const tc = useTranslations("common");
  const translateStatus = (s: string) => {
    const key = `status${s.charAt(0).toUpperCase()}${s.slice(1)}` as any;
    try { return tc(key); } catch { return s; }
  };
  const colorMap: Record<string, "brand" | "success" | "error" | "gray"> = {
    processing: "brand",
    pending: "gray",
    completed: "success",
    failed: "error",
    cancelled: "error",
  };
  return (
    <Badge type="pill-color" size="sm" color={colorMap[status] ?? "gray"}>
      {translateStatus(status)}
    </Badge>
  );
}

function JobTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "Keyword Check":
    case "SERP Fetch":
      return <RefreshCw01 className="size-4 text-brand-500" />;
    case "On-Site Scan":
      return <Activity className="size-4 text-purple-500" />;
    case "Competitor Backlinks":
    case "Content Gap Analysis":
      return <Activity className="size-4 text-orange-500" />;
    case "Report Generation":
    case "Domain SEO Report":
      return <Calendar className="size-4 text-success-500" />;
    default:
      return <Clock className="size-4 text-quaternary" />;
  }
}

// --- Active Jobs Tab ---
function ActiveJobsTab() {
  const t = useTranslations("jobs");
  const activeJobs = useQuery(api.jobs_queries.getAllJobs, { filter: "active" });
  const cancelAnyJob = useMutation(api.jobs_queries.cancelAnyJob);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const handleCancel = async (table: string, jobId: string) => {
    setCancellingIds((prev) => new Set(prev).add(jobId));
    try {
      await cancelAnyJob({ table, jobId });
      toast.success(t("jobCancelled"));
    } catch {
      toast.error(t("failedCancelJob"));
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  if (activeJobs === undefined) return <LoadingState type="list" rows={3} />;

  if (activeJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary py-16">
        <CheckCircle className="size-10 text-success-400" />
        <p className="mt-3 text-sm font-medium text-primary">{t("noActiveJobs")}</p>
        <p className="mt-1 text-xs text-tertiary">{t("allTasksCompleted")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeJobs.map((job) => (
        <div
          key={job.id}
          className="rounded-xl border border-secondary bg-primary p-4 shadow-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-secondary-subtle">
                <JobTypeIcon type={job.type} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">{job.type}</span>
                  <StatusBadge status={job.status} />
                </div>
                <div className="mt-0.5 text-xs text-tertiary">{job.domainName}</div>
                {job.currentStep && (
                  <div className="mt-1 text-xs text-quaternary">{job.currentStep}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-quaternary">
                {job.startedAt ? formatTimeAgo(job.startedAt) : formatTimeAgo(job.createdAt)}
              </span>
              <Button
                size="sm"
                color="tertiary-destructive"
                iconLeading={XCircle}
                onClick={() => handleCancel(job.table, job.id)}
                isDisabled={cancellingIds.has(job.id)}
              >
                {cancellingIds.has(job.id) ? t("stopping") : t("stop")}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {job.progress != null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-tertiary">{job.currentStep}</span>
                <span className="font-medium text-primary">{job.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Scheduled Jobs Tab ---
function ScheduledJobsTab() {
  const tc = useTranslations("common");
  const scheduledJobs = useQuery(api.jobs_queries.getScheduledJobs);

  if (scheduledJobs === undefined) return <LoadingState type="list" rows={6} />;

  return (
    <div className="space-y-3">
      {scheduledJobs.map((job) => (
        <div
          key={job.name}
          className="flex items-center justify-between rounded-xl border border-secondary bg-primary p-4 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-secondary-subtle">
              <Clock className="size-4 text-quaternary" />
            </div>
            <div>
              <div className="text-sm font-medium text-primary">{job.name}</div>
              <div className="mt-0.5 text-xs text-tertiary">{job.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-quaternary">{job.schedule}</span>
            <Badge type="pill-color" size="sm" color="success">
              {tc("statusActive")}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- History Tab ---
function HistoryTab() {
  const t = useTranslations("jobs");
  const [historyFilter, setHistoryFilter] = useState<"completed" | "failed" | "all">("all");
  const completedJobs = useQuery(api.jobs_queries.getAllJobs, { filter: historyFilter === "all" ? "all" : historyFilter, limit: 100 });

  if (completedJobs === undefined) return <LoadingState rows={8} />;

  // For "all" filter, exclude active jobs from the list
  const historyJobs = historyFilter === "all"
    ? completedJobs.filter((j) => j.status !== "pending" && j.status !== "processing")
    : completedJobs;

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2">
        {(["all", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setHistoryFilter(f)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              historyFilter === f
                ? "bg-active text-secondary"
                : "text-quaternary hover:bg-primary_hover hover:text-secondary"
            )}
          >
            {f === "all" ? t("filterAll") : f === "completed" ? t("filterCompleted") : t("filterFailed")}
          </button>
        ))}
      </div>

      {historyJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary py-16">
          <MinusCircle className="size-10 text-quaternary" />
          <p className="mt-3 text-sm font-medium text-primary">{t("noJobsFound")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-secondary shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary bg-secondary-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">{t("columnType")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">{t("columnDomain")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">{t("columnStatus")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">{t("columnDuration")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">{t("columnCreated")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">{t("columnError")}</th>
              </tr>
            </thead>
            <tbody>
              {historyJobs.map((job) => {
                const duration =
                  job.completedAt && job.startedAt
                    ? formatDuration(job.completedAt - job.startedAt)
                    : job.completedAt && job.createdAt
                      ? formatDuration(job.completedAt - job.createdAt)
                      : "—";

                return (
                  <tr key={job.id} className="border-b border-secondary last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <JobTypeIcon type={job.type} />
                        <span className="text-sm text-primary">{job.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">{job.domainName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-tertiary">{duration}</td>
                    <td className="px-4 py-3 text-sm text-tertiary">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      {job.error ? (
                        <span className="truncate text-xs text-error-600" title={job.error}>
                          {job.error}
                        </span>
                      ) : (
                        <span className="text-xs text-quaternary">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function JobsPage() {
  const t = useTranslations("jobs");
  usePageTitle("Jobs");
  const stats = useQuery(api.jobs_queries.getJobStats);

  const tabs = [
    { id: "active", label: t("tabActive") },
    { id: "scheduled", label: t("tabScheduled") },
    { id: "history", label: t("tabHistory") },
  ];

  return (
    <div className="mx-auto flex max-w-container flex-col gap-6 px-4 py-8 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-tertiary">
          {t("description")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
              <Activity className="size-5 text-brand-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-primary">
                {stats?.activeCount ?? "—"}
              </div>
              <div className="text-xs text-tertiary">{t("activeNow")}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-success-50">
              <CheckCircle className="size-5 text-success-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-primary">
                {stats?.completedToday ?? "—"}
              </div>
              <div className="text-xs text-tertiary">{t("completedToday")}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-error-50">
              <AlertCircle className="size-5 text-error-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-primary">
                {stats?.failedToday ?? "—"}
              </div>
              <div className="text-xs text-tertiary">{t("failedToday")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs>
        <TabList size="sm" type="underline" items={tabs} />

        <TabPanel id="active" className="pt-4">
          <ActiveJobsTab />
        </TabPanel>

        <TabPanel id="scheduled" className="pt-4">
          <ScheduledJobsTab />
        </TabPanel>

        <TabPanel id="history" className="pt-4">
          <HistoryTab />
        </TabPanel>
      </Tabs>
    </div>
  );
}
