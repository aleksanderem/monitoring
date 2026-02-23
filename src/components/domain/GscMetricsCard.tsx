"use client";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";

interface GscMetricsCardProps {
  domainId: Id<"domains">;
}

export function GscMetricsCard({ domainId }: GscMetricsCardProps) {
  const t = useTranslations("domains");
  const metrics = useQuery(api.gsc.getGscMetrics, { domainId });

  if (metrics === undefined) {
    return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-500 mb-3">{t("gscMetricsTitle")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-bold">{metrics.totalClicks.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{t("gscClicks")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{metrics.totalImpressions.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{t("gscImpressions")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{(metrics.avgCtr * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500">{t("gscAvgCtr")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{metrics.avgPosition.toFixed(1)}</p>
          <p className="text-xs text-gray-500">{t("gscAvgPosition")}</p>
        </div>
      </div>
    </div>
  );
}
