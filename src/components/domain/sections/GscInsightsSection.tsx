"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GoogleIcon } from "@/components/shared/GoogleIcon";
import { formatNumber } from "@/lib/formatting";
import { Target04, AlertTriangle, TrendDown02 } from "@untitledui/icons";

export function GscInsightsSection({ domainId }: { domainId: Id<"domains"> }) {
  const t = useTranslations("domains");

  const connectionInfo = useQuery(api.gsc.getGscPropertiesForDomain, { domainId });
  const fetchQuickWins = useAction(api.actions.gscAnalytics.getQuickWins);
  const fetchCannibalization = useAction(api.actions.gscAnalytics.getCannibalization);
  const fetchContentDecay = useAction(api.actions.gscAnalytics.getContentDecay);

  const [quickWins, setQuickWins] = useState<any[] | undefined>(undefined);
  const [cannibalization, setCannibalization] = useState<any[] | undefined>(undefined);
  const [contentDecay, setContentDecay] = useState<any[] | undefined>(undefined);

  const isGscConnected = connectionInfo?.connected && connectionInfo?.selectedPropertyUrl;

  useEffect(() => {
    if (!isGscConnected) return;
    let cancelled = false;

    fetchQuickWins({ domainId, limit: 10, minImpressions: 50 })
      .then((data) => { if (!cancelled) setQuickWins(data ?? []); })
      .catch(() => { if (!cancelled) setQuickWins([]); });

    fetchCannibalization({ domainId, limit: 10 })
      .then((data) => { if (!cancelled) setCannibalization(data ?? []); })
      .catch(() => { if (!cancelled) setCannibalization([]); });

    fetchContentDecay({ domainId, limit: 10 })
      .then((data) => { if (!cancelled) setContentDecay(data ?? []); })
      .catch(() => { if (!cancelled) setContentDecay([]); });

    return () => { cancelled = true; };
  }, [isGscConnected, domainId, fetchQuickWins, fetchCannibalization, fetchContentDecay]);

  // Not loaded yet or not connected — render nothing (parent InsightsSection has its own content)
  if (connectionInfo === undefined || !isGscConnected) return null;

  // All 3 still loading — show skeleton
  if (quickWins === undefined && cannibalization === undefined && contentDecay === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <GoogleIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">{t("gscAnalyticsTitle")}</h2>
            <p className="text-sm text-tertiary">{t("gscAnalyticsDesc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // All 3 loaded but empty — nothing to show
  const qwList = quickWins ?? [];
  const canList = cannibalization ?? [];
  const cdList = contentDecay ?? [];
  if (qwList.length === 0 && canList.length === 0 && cdList.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
          <GoogleIcon className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-primary mb-1">{t("gscAnalyticsTitle")}</h2>
          <p className="text-sm text-tertiary">{t("gscAnalyticsDesc")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Wins Card */}
        <div className="relative rounded-xl border border-secondary bg-primary p-6">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <div className="flex items-center gap-2 mb-3">
            <Target04 className="h-4 w-4 text-utility-success-500" />
            <h3 className="text-md font-semibold text-primary">{t("gscQuickWins")}</h3>
            {qwList.length > 0 && (
              <span className="rounded-full bg-utility-success-50 px-2 py-0.5 text-xs font-medium text-utility-success-700">
                {qwList.length}
              </span>
            )}
          </div>
          <p className="text-xs text-tertiary mb-3">{t("gscQuickWinsDesc")}</p>
          {qwList.length === 0 ? (
            <p className="text-sm text-tertiary py-4 text-center">{t("gscNoQuickWins")}</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {qwList.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                  <span className="text-sm text-primary truncate max-w-[55%]" title={item.query}>
                    {item.query}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      #{item.position.toFixed(1)}
                    </span>
                    <span className="text-xs text-tertiary">{formatNumber(item.impressions)} {t("gscImpressions").toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cannibalization Card */}
        <div className="relative rounded-xl border border-secondary bg-primary p-6">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-utility-warning-500" />
            <h3 className="text-md font-semibold text-primary">{t("gscCannibalization")}</h3>
            {canList.length > 0 && (
              <span className="rounded-full bg-utility-warning-50 px-2 py-0.5 text-xs font-medium text-utility-warning-700">
                {canList.length}
              </span>
            )}
          </div>
          <p className="text-xs text-tertiary mb-3">{t("gscCannibalizationDesc")}</p>
          {canList.length === 0 ? (
            <p className="text-sm text-tertiary py-4 text-center">{t("gscNoCannibalization")}</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {canList.map((item: any, i: number) => {
                const pages = (item.competing_pages ?? [])
                  .map((p: string) => { try { return new URL(p).pathname; } catch { return p; } })
                  .join(", ");
                return (
                  <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-secondary p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-primary truncate max-w-[55%]" title={item.query}>
                        {item.query}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          {item.page_count} pages
                        </span>
                        <span className="text-xs text-tertiary">{formatNumber(item.total_impressions)} imp</span>
                      </div>
                    </div>
                    {pages && (
                      <p className="text-xs text-tertiary truncate" title={pages}>{pages}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Decay Card */}
        <div className="relative rounded-xl border border-secondary bg-primary p-6">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <div className="flex items-center gap-2 mb-3">
            <TrendDown02 className="h-4 w-4 text-utility-error-500" />
            <h3 className="text-md font-semibold text-primary">{t("gscContentDecay")}</h3>
            {cdList.length > 0 && (
              <span className="rounded-full bg-utility-error-50 px-2 py-0.5 text-xs font-medium text-utility-error-700">
                {cdList.length}
              </span>
            )}
          </div>
          <p className="text-xs text-tertiary mb-3">{t("gscContentDecayDesc")}</p>
          {cdList.length === 0 ? (
            <p className="text-sm text-tertiary py-4 text-center">{t("gscNoContentDecay")}</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {cdList.map((item: any, i: number) => {
                let pagePath: string;
                try { pagePath = new URL(item.page).pathname; } catch { pagePath = item.page; }
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                    <span className="text-sm text-primary truncate max-w-[50%]" title={item.page}>
                      {pagePath}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-tertiary">{formatNumber(item.recent_clicks)} clicks</span>
                      <span className="rounded-full bg-utility-error-50 px-1.5 py-0.5 text-xs font-medium text-utility-error-600 dark:bg-utility-error-950/30">
                        {item.pct_change.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
