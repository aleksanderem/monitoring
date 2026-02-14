"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { useTranslations } from "next-intl";

type Period = "today" | "week" | "month";

function getPeriodRange(period: Period): { startDate: number; endDate: number } {
  const now = Date.now();
  const endDate = now;
  let startDate: number;

  switch (period) {
    case "today": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today.getTime();
      break;
    }
    case "week": {
      startDate = now - 7 * 24 * 60 * 60 * 1000;
      break;
    }
    case "month": {
      startDate = now - 30 * 24 * 60 * 60 * 1000;
      break;
    }
  }

  return { startDate, endDate };
}

export default function AdminApiUsagePage() {
  const t = useTranslations("admin");
  const [period, setPeriod] = useState<Period>("today");

  const { startDate, endDate } = useMemo(() => getPeriodRange(period), [period]);
  const summary = useQuery(api.apiUsage.getUsageSummary, { startDate, endDate });
  const recentLogs = useQuery(api.apiUsage.getRecentLogs, { limit: 50 });

  const endpointEntries = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byEndpoint)
      .sort(([, a], [, b]) => b.cost - a.cost);
  }, [summary]);

  const callerEntries = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byCaller)
      .sort(([, a], [, b]) => b.cost - a.cost);
  }, [summary]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("navApiUsage")}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{t("navApiUsage")}</h1>
        <p className="mt-1 text-sm text-tertiary">{t("apiUsageDescription")}</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === p
                ? "bg-brand-600 text-white"
                : "bg-primary border border-secondary text-secondary hover:bg-secondary/50"
            }`}
          >
            {p === "today" ? t("apiUsageToday") : p === "week" ? t("apiUsageThisWeek") : t("apiUsageThisMonth")}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <p className="text-sm text-tertiary">{t("apiUsageTotalCost")}</p>
          <p className="text-3xl font-semibold text-primary mt-1">
            ${summary ? summary.totalCost.toFixed(4) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <p className="text-sm text-tertiary">{t("apiUsageTotalTasks")}</p>
          <p className="text-3xl font-semibold text-primary mt-1">
            {summary ? summary.totalTasks.toLocaleString() : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <p className="text-sm text-tertiary">{t("apiUsageTotalCalls")}</p>
          <p className="text-3xl font-semibold text-primary mt-1">
            {summary ? summary.totalCalls.toLocaleString() : "—"}
          </p>
        </div>
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* By Endpoint */}
        <div className="rounded-xl border border-secondary bg-primary">
          <div className="px-6 py-4 border-b border-secondary">
            <h3 className="text-sm font-semibold text-primary">{t("apiUsageByEndpoint")}</h3>
          </div>
          {endpointEntries.length > 0 ? (
            <div className="divide-y divide-secondary">
              {endpointEntries.map(([endpoint, data]) => (
                <div key={endpoint} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary font-mono truncate max-w-[280px]" title={endpoint}>
                      {endpoint.split("/").slice(-3).join("/")}
                    </p>
                    <p className="text-xs text-tertiary">
                      {data.calls} calls, {data.taskCount} tasks
                    </p>
                  </div>
                  <p className="text-sm font-medium text-primary">${data.cost.toFixed(4)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-tertiary text-center">{t("apiUsageNoData")}</p>
          )}
        </div>

        {/* By Caller */}
        <div className="rounded-xl border border-secondary bg-primary">
          <div className="px-6 py-4 border-b border-secondary">
            <h3 className="text-sm font-semibold text-primary">{t("apiUsageByCaller")}</h3>
          </div>
          {callerEntries.length > 0 ? (
            <div className="divide-y divide-secondary">
              {callerEntries.map(([caller, data]) => (
                <div key={caller} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary font-mono">{caller}</p>
                    <p className="text-xs text-tertiary">
                      {data.calls} calls, {data.taskCount} tasks
                    </p>
                  </div>
                  <p className="text-sm font-medium text-primary">${data.cost.toFixed(4)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-tertiary text-center">{t("apiUsageNoData")}</p>
          )}
        </div>
      </div>

      {/* Recent logs */}
      <div className="rounded-xl border border-secondary bg-primary overflow-hidden">
        <div className="px-6 py-4 border-b border-secondary">
          <h3 className="text-sm font-semibold text-primary">{t("apiUsageRecentLogs")}</h3>
        </div>
        {recentLogs && recentLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/30">
                <tr className="border-b border-secondary">
                  <th className="px-6 py-3 text-left text-xs font-medium text-tertiary">{t("apiUsageTime")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-tertiary">{t("apiUsageEndpoint")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-tertiary">{t("apiUsageCaller")}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-tertiary">{t("apiUsageTasks")}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-tertiary">{t("apiUsageCost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {recentLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-primary_hover transition-colors">
                    <td className="px-6 py-3 text-sm text-tertiary whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-primary font-mono truncate max-w-[240px]" title={log.endpoint}>
                      {log.endpoint.split("/").slice(-3).join("/")}
                    </td>
                    <td className="px-6 py-3 text-sm text-primary font-mono">
                      {log.caller}
                    </td>
                    <td className="px-6 py-3 text-sm text-primary text-right">
                      {log.taskCount}
                    </td>
                    <td className="px-6 py-3 text-sm text-primary text-right">
                      ${log.estimatedCost.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-12 text-sm text-tertiary text-center">{t("apiUsageNoData")}</p>
        )}
      </div>
    </div>
  );
}
