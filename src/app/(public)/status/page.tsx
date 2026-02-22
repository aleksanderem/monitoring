"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useTranslations } from "next-intl";

function StatusBadge({ status }: { status: string }) {
  const colors = {
    up: "bg-green-500",
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    down: "bg-red-500",
    unknown: "bg-gray-400",
  };
  const color = colors[status as keyof typeof colors] || colors.unknown;
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${color}`} aria-label={`Status: ${status}`} />
  );
}

export default function StatusPage() {
  const t = useTranslations("common");
  const health = useQuery(api.health.getPublicHealth);

  const overallStatus = health?.status || "loading";
  const services = health?.services || {};

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-2">{t("statusTitle")}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{t("statusDescription")}</p>

        {/* Overall Status */}
        <div className={`rounded-lg p-6 mb-8 ${
          overallStatus === "healthy" ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800" :
          overallStatus === "degraded" ? "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800" :
          overallStatus === "down" ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800" :
          "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
        }`}>
          <div className="flex items-center gap-3">
            <StatusBadge status={overallStatus} />
            <span className="text-lg font-semibold">
              {overallStatus === "healthy" ? t("statusAllOperational") :
               overallStatus === "degraded" ? t("statusDegraded") :
               overallStatus === "down" ? t("statusDown") :
               t("statusChecking")}
            </span>
          </div>
        </div>

        {/* Service List */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800">
          {Object.entries(services).map(([name, status]) => (
            <div key={name} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium capitalize">{name}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={status as string} />
                <span className="text-sm text-gray-500 capitalize">{status as string}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Last Updated */}
        {health?.timestamp && (
          <p className="text-sm text-gray-400 mt-4">
            {t("statusLastUpdated")}: {new Date(health.timestamp).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
