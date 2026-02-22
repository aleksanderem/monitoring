"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// =================================================================
// Analytics Dashboard Page
// =================================================================

export default function AnalyticsDashboardPage() {
  const t = useTranslations("admin");
  usePageTitle("Admin", "Analytics");

  return (
    <div className="p-6">
      <div className="mb-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">{t("breadcrumbHome")}</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
          <Breadcrumbs.Item>{t("navAnalytics")}</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{t("navAnalytics")}</h1>
        <p className="mt-1 text-sm text-tertiary">{t("analyticsDescription")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionFunnelChart />
        <ActiveUsersPanel />
        <FeatureUsageChart />
        <WebVitalsPanel />
      </div>
    </div>
  );
}

// =================================================================
// Conversion Funnel
// =================================================================

function ConversionFunnelChart() {
  const t = useTranslations("admin");
  const funnel = useQuery(api.analytics.getConversionFunnel);

  if (!funnel) {
    return <PanelSkeleton title={t("analyticsFunnel")} />;
  }

  const steps = [
    { label: t("analyticsFunnelRegistered"), value: funnel.registered },
    { label: t("analyticsFunnelDomain"), value: funnel.added_domain },
    { label: t("analyticsFunnelKeywords"), value: funnel.added_keywords },
    { label: t("analyticsFunnelSubscribed"), value: funnel.subscribed },
  ];

  const maxValue = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-5">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <h3 className="text-lg font-semibold text-primary mb-4">{t("analyticsFunnel")}</h3>
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-secondary">{step.label}</span>
              <span className="font-medium text-primary">{step.value}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-brand-solid h-2 rounded-full transition-all"
                style={{ width: `${(step.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =================================================================
// Active Users Panel
// =================================================================

function ActiveUsersPanel() {
  const t = useTranslations("admin");
  const activeUsers = useQuery(api.analytics.getActiveUsers, { days: 30 });

  if (!activeUsers) {
    return <PanelSkeleton title={t("analyticsActiveUsers")} />;
  }

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-5">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <h3 className="text-lg font-semibold text-primary mb-4">{t("analyticsActiveUsers")}</h3>
      <div className="mb-4">
        <p className="text-3xl font-semibold text-primary">{activeUsers.totalUnique}</p>
        <p className="text-sm text-tertiary">{t("analyticsUniqueUsers30d")}</p>
      </div>
      {activeUsers.daily.length > 0 ? (
        <div className="space-y-1">
          {activeUsers.daily.slice(-7).map((day) => (
            <div key={day.date} className="flex justify-between text-sm">
              <span className="text-tertiary">{day.date}</span>
              <span className="font-medium text-primary">{day.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-tertiary">{t("analyticsNoData")}</p>
      )}
    </div>
  );
}

// =================================================================
// Feature Usage Chart
// =================================================================

function FeatureUsageChart() {
  const t = useTranslations("admin");
  const features = useQuery(api.analytics.getTopFeatures, { days: 30, limit: 10 });

  if (!features) {
    return <PanelSkeleton title={t("analyticsTopFeatures")} />;
  }

  const maxCount = Math.max(...features.map((f) => f.count), 1);

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-5">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <h3 className="text-lg font-semibold text-primary mb-4">{t("analyticsTopFeatures")}</h3>
      {features.length > 0 ? (
        <div className="space-y-2">
          {features.map((feature) => (
            <div key={feature.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-secondary truncate">{feature.name}</span>
                <span className="font-medium text-primary ml-2">{feature.count}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-utility-brand-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(feature.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-tertiary">{t("analyticsNoData")}</p>
      )}
    </div>
  );
}

// =================================================================
// Web Vitals Panel
// =================================================================

function WebVitalsPanel() {
  const t = useTranslations("admin");
  const vitals = useQuery(api.analytics.getWebVitals, { days: 7 });

  if (!vitals) {
    return <PanelSkeleton title={t("analyticsWebVitals")} />;
  }

  const metrics = ["LCP", "FID", "CLS", "FCP", "TTFB"] as const;
  const thresholds: Record<string, { good: number; poor: number; unit: string }> = {
    LCP: { good: 2500, poor: 4000, unit: "ms" },
    FID: { good: 100, poor: 300, unit: "ms" },
    CLS: { good: 0.1, poor: 0.25, unit: "" },
    FCP: { good: 1800, poor: 3000, unit: "ms" },
    TTFB: { good: 800, poor: 1800, unit: "ms" },
  };

  function getStatus(metric: string, value: number): "good" | "needs-improvement" | "poor" {
    const t = thresholds[metric];
    if (!t) return "needs-improvement";
    if (value <= t.good) return "good";
    if (value <= t.poor) return "needs-improvement";
    return "poor";
  }

  const statusColors = {
    good: "text-green-600 dark:text-green-400",
    "needs-improvement": "text-yellow-600 dark:text-yellow-400",
    poor: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-5">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <h3 className="text-lg font-semibold text-primary mb-4">{t("analyticsWebVitals")}</h3>
      {Object.keys(vitals).length > 0 ? (
        <div className="space-y-3">
          {metrics.map((m) => {
            const data = vitals[m];
            if (!data) return null;
            const status = getStatus(m, data.p75);
            const th = thresholds[m];
            return (
              <div key={m} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-primary">{m}</span>
                  <span className="ml-2 text-xs text-tertiary">
                    (p75: {data.p75.toFixed(m === "CLS" ? 3 : 0)}{th.unit})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${statusColors[status]}`}>
                    {data.avg.toFixed(m === "CLS" ? 3 : 0)}{th.unit}
                  </span>
                  <span className="text-xs text-tertiary">({data.count})</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-tertiary">{t("analyticsNoData")}</p>
      )}
    </div>
  );
}

// =================================================================
// Shared Skeleton
// =================================================================

function PanelSkeleton({ title }: { title: string }) {
  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-5">
      <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-solid" />
      </div>
    </div>
  );
}
