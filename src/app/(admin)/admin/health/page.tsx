"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useState } from "react";

export default function AdminHealthPage() {
  const t = useTranslations("admin");
  usePageTitle("Admin", "System Health");

  const health = useQuery(api.adminHealth.getSystemHealth);
  const failedJobs = useQuery(api.adminHealth.getFailedJobsDetail, { limit: 20 });
  const errorTimeline = useQuery(api.adminHealth.getErrorTimeline, { days: 7 });
  const apiCostStatus = useQuery(api.apiUsage.getDailyApiCostStatus);

  if (!health) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-solid" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">{t("breadcrumbHome")}</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
          <Breadcrumbs.Item>{t("navHealth")}</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{t("healthTitle")}</h1>
        <p className="mt-1 text-sm text-tertiary">{t("healthDescription")}</p>
      </div>

      {/* Overall Status Banner */}
      <HealthStatusBanner status={health.overallStatus} />

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <HealthMetricCard
          label={t("healthActiveJobs")}
          value={health.jobQueue.totalActive}
          subtitle={t("healthFailedLast24h", { count: health.jobQueue.totalFailedLast24h })}
          status={health.jobQueue.totalFailedLast24h > 5 ? "warning" : "ok"}
        />
        <HealthMetricCard
          label={t("healthErrorsLast24h")}
          value={health.errors.last24h}
          subtitle={t("healthErrorsLastHour", { count: health.errors.lastHour })}
          status={health.errors.lastHour > 10 ? "critical" : health.errors.last24h > 20 ? "warning" : "ok"}
        />
        <HealthMetricCard
          label={t("healthApiCostToday")}
          value={`$${health.apiUsage.todayCost.toFixed(4)}`}
          subtitle={t("healthApiCallsToday", { count: health.apiUsage.todayCalls })}
          status="ok"
        />
        <HealthMetricCard
          label={t("healthNotifications")}
          value={health.notifications.sentLast24h}
          subtitle={t("healthNotifFailed", { count: health.notifications.failedLast24h })}
          status={health.notifications.failedLast24h > 5 ? "warning" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Job Queue Status */}
        <JobQueueStatus
          keywordCheck={health.jobQueue.keywordCheck}
          keywordSerp={health.jobQueue.keywordSerp}
          onSiteScan={health.jobQueue.onSiteScan}
        />

        {/* API Quota Widget */}
        <ApiQuotaWidget costStatus={apiCostStatus} />
      </div>

      {/* Error Rate Chart */}
      <ErrorRateChart timeline={errorTimeline ?? []} />

      {/* Failed Jobs Detail */}
      <FailedJobsTable jobs={failedJobs ?? []} />

      {/* Bulk Operations Panel */}
      <BulkOperationsPanel />
    </div>
  );
}

// =================================================================
// Sub-components
// =================================================================

function HealthStatusBanner({ status }: { status: "healthy" | "degraded" | "critical" }) {
  const t = useTranslations("admin");

  const config = {
    healthy: {
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-800 dark:text-green-200",
      dot: "bg-green-500",
      label: t("healthStatusHealthy"),
    },
    degraded: {
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      border: "border-yellow-200 dark:border-yellow-800",
      text: "text-yellow-800 dark:text-yellow-200",
      dot: "bg-yellow-500",
      label: t("healthStatusDegraded"),
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-800 dark:text-red-200",
      dot: "bg-red-500",
      label: t("healthStatusCritical"),
    },
  }[status];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 mb-6 rounded-lg border ${config.bg} ${config.border}`} data-testid="health-status-banner">
      <span className={`w-3 h-3 rounded-full ${config.dot} animate-pulse`} />
      <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}

function HealthMetricCard({
  label,
  value,
  subtitle,
  status,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  status: "ok" | "warning" | "critical";
}) {
  const borderColor = {
    ok: "border-secondary",
    warning: "border-yellow-300 dark:border-yellow-700",
    critical: "border-red-300 dark:border-red-700",
  }[status];

  return (
    <div className={`rounded-xl border ${borderColor} bg-primary p-5`} data-testid="health-metric-card">
      <p className="text-sm font-medium text-tertiary">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
      <p className="mt-1 text-xs text-tertiary">{subtitle}</p>
    </div>
  );
}

function JobQueueStatus({
  keywordCheck,
  keywordSerp,
  onSiteScan,
}: {
  keywordCheck: { pending: number; processing: number; failedLast24h: number };
  keywordSerp: { pending: number; processing: number; failedLast24h: number };
  onSiteScan: { pending: number; processing: number; failedLast24h: number };
}) {
  const t = useTranslations("admin");

  const queues = [
    { name: t("healthQueueKeywordCheck"), ...keywordCheck },
    { name: t("healthQueueKeywordSerp"), ...keywordSerp },
    { name: t("healthQueueOnSiteScan"), ...onSiteScan },
  ];

  return (
    <div className="rounded-xl border border-secondary bg-primary overflow-hidden" data-testid="job-queue-status">
      <div className="px-6 py-4 border-b border-secondary">
        <h2 className="text-lg font-semibold text-primary">{t("healthJobQueues")}</h2>
      </div>
      <div className="divide-y divide-secondary">
        {queues.map((queue) => (
          <div key={queue.name} className="px-6 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-primary">{queue.name}</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-yellow-600 dark:text-yellow-400" data-testid="queue-pending">
                {queue.pending} {t("healthPending")}
              </span>
              <span className="text-blue-600 dark:text-blue-400" data-testid="queue-processing">
                {queue.processing} {t("healthProcessing")}
              </span>
              <span className={`${queue.failedLast24h > 0 ? "text-red-600 dark:text-red-400" : "text-tertiary"}`} data-testid="queue-failed">
                {queue.failedLast24h} {t("healthFailed")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiQuotaWidget({
  costStatus,
}: {
  costStatus: { todayCost: number; defaultCap: number; pace24h: number; callsToday: number } | undefined;
}) {
  const t = useTranslations("admin");

  if (!costStatus) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6" data-testid="api-quota-widget">
        <h2 className="text-lg font-semibold text-primary mb-4">{t("healthApiQuota")}</h2>
        <p className="text-sm text-tertiary">{t("healthLoading")}</p>
      </div>
    );
  }

  const usagePercent = costStatus.defaultCap > 0
    ? Math.min(100, Math.round((costStatus.todayCost / costStatus.defaultCap) * 100))
    : 0;
  const barColor = usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6" data-testid="api-quota-widget">
      <h2 className="text-lg font-semibold text-primary mb-4">{t("healthApiQuota")}</h2>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-tertiary">{t("healthDailyCost")}</span>
          <span className="font-medium text-primary">${costStatus.todayCost.toFixed(4)} / ${costStatus.defaultCap.toFixed(2)}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${usagePercent}%` }} />
        </div>
        <div className="flex justify-between text-xs text-tertiary">
          <span>{t("healthPace24h")}: ${costStatus.pace24h.toFixed(2)}</span>
          <span>{costStatus.callsToday} {t("healthCalls")}</span>
        </div>
      </div>
    </div>
  );
}

function ErrorRateChart({ timeline }: { timeline: Array<{ date: string; errors: number; warnings: number }> }) {
  const t = useTranslations("admin");

  if (timeline.length === 0) return null;

  const maxCount = Math.max(...timeline.map((d) => d.errors + d.warnings), 1);

  return (
    <div className="rounded-xl border border-secondary bg-primary overflow-hidden mb-6" data-testid="error-rate-chart">
      <div className="px-6 py-4 border-b border-secondary">
        <h2 className="text-lg font-semibold text-primary">{t("healthErrorTimeline")}</h2>
      </div>
      <div className="px-6 py-4">
        <div className="flex items-end gap-2 h-40">
          {timeline.map((day) => {
            const errorHeight = (day.errors / maxCount) * 100;
            const warningHeight = (day.warnings / maxCount) * 100;
            const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center justify-end" style={{ height: "128px" }}>
                  {day.warnings > 0 && (
                    <div
                      className="w-full bg-yellow-400 dark:bg-yellow-600 rounded-t"
                      style={{ height: `${warningHeight}%`, minHeight: day.warnings > 0 ? "2px" : 0 }}
                      title={`${day.warnings} warnings`}
                    />
                  )}
                  {day.errors > 0 && (
                    <div
                      className="w-full bg-red-500 dark:bg-red-600 rounded-t"
                      style={{ height: `${errorHeight}%`, minHeight: day.errors > 0 ? "2px" : 0 }}
                      title={`${day.errors} errors`}
                    />
                  )}
                </div>
                <span className="text-[10px] text-tertiary">{dateLabel}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-tertiary">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>{t("healthErrors")}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span>{t("healthWarnings")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FailedJobsTable({
  jobs,
}: {
  jobs: Array<{
    id: string;
    type: string;
    domainName: string;
    error: string | undefined;
    failedAt: number | undefined;
    createdAt: number;
  }>;
}) {
  const t = useTranslations("admin");

  return (
    <div className="rounded-xl border border-secondary bg-primary overflow-hidden mb-6" data-testid="failed-jobs-table">
      <div className="px-6 py-4 border-b border-secondary">
        <h2 className="text-lg font-semibold text-primary">{t("healthFailedJobs")}</h2>
      </div>
      {jobs.length === 0 ? (
        <div className="px-6 py-8 text-center text-tertiary">{t("healthNoFailedJobs")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary bg-secondary/50">
                <th className="px-6 py-3 text-left font-medium text-tertiary">{t("healthJobType")}</th>
                <th className="px-6 py-3 text-left font-medium text-tertiary">{t("healthJobDomain")}</th>
                <th className="px-6 py-3 text-left font-medium text-tertiary">{t("healthJobError")}</th>
                <th className="px-6 py-3 text-left font-medium text-tertiary">{t("healthJobFailedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-3 text-primary">{job.type}</td>
                  <td className="px-6 py-3 text-primary">{job.domainName}</td>
                  <td className="px-6 py-3 text-red-600 dark:text-red-400 max-w-xs truncate">{job.error ?? "Unknown error"}</td>
                  <td className="px-6 py-3 text-tertiary whitespace-nowrap">
                    {job.failedAt ? new Date(job.failedAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BulkOperationsPanel() {
  const t = useTranslations("admin");
  const bulkSuspend = useMutation(api.admin.bulkSuspendUsers);
  const bulkChangePlan = useMutation(api.admin.bulkChangePlan);
  const plans = useQuery(api.admin.getSystemStats); // reuse to check if admin

  const [suspendUserIds, setSuspendUserIds] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendResult, setSuspendResult] = useState<string | null>(null);

  const handleBulkSuspend = async () => {
    setSuspendResult(null);
    const ids = suspendUserIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    try {
      const result = await bulkSuspend({
        userIds: ids as any[],
        reason: suspendReason || undefined,
      });
      setSuspendResult(t("healthBulkSuspendResult", { suspended: result.suspended, skipped: result.skipped }));
      setSuspendUserIds("");
      setSuspendReason("");
    } catch (e) {
      setSuspendResult(t("healthBulkOperationFailed"));
    }
  };

  return (
    <div className="rounded-xl border border-secondary bg-primary overflow-hidden" data-testid="bulk-operations-panel">
      <div className="px-6 py-4 border-b border-secondary">
        <h2 className="text-lg font-semibold text-primary">{t("healthBulkOperations")}</h2>
        <p className="text-sm text-tertiary mt-1">{t("healthBulkOperationsDescription")}</p>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">{t("healthBulkSuspendUsers")}</label>
          <input
            type="text"
            className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary dark:bg-gray-800 dark:border-gray-700"
            placeholder={t("healthBulkSuspendPlaceholder")}
            value={suspendUserIds}
            onChange={(e) => setSuspendUserIds(e.target.value)}
          />
          <input
            type="text"
            className="w-full mt-2 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary dark:bg-gray-800 dark:border-gray-700"
            placeholder={t("healthBulkSuspendReasonPlaceholder")}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <button
            onClick={handleBulkSuspend}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            {t("healthBulkSuspendButton")}
          </button>
          {suspendResult && (
            <p className="mt-2 text-sm text-tertiary">{suspendResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}
