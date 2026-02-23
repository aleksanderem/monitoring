"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Hash01, TrendUp02, TrendDown02, BarChart03, Star01, Zap } from "@untitledui/icons";
import { MetricCard } from "../cards/MetricCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface ExecutiveSummaryProps {
  domainId: Id<"domains">;
}

export function ExecutiveSummary({ domainId }: ExecutiveSummaryProps) {
  const t = useTranslations("keywords");
  const metrics = useQuery(api.domains.getLatestVisibilityMetrics, { domainId });

  if (metrics === undefined) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="relative rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <LoadingState type="card" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <p className="text-sm text-tertiary">{t("noVisibilityDataYet")}</p>
      </div>
    );
  }

  const top10Change = metrics.change?.top10 || 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-primary">{t("summary")}</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title={t("top3Positions")}
          value={metrics.top3}
          icon={TrendUp02}
        />

        <MetricCard
          title={t("top10Positions")}
          value={metrics.top10}
          icon={BarChart03}
          trend={top10Change > 0 ? "positive" : top10Change < 0 ? "negative" : null}
          change={top10Change > 0 ? `+${top10Change}` : top10Change < 0 ? `${top10Change}` : undefined}
          changeDescription={t("vs7DaysAgo")}
        />

        <MetricCard
          title={t("totalKeywords")}
          value={metrics.total}
          icon={Hash01}
          subtitle={t("newAndLost", { newCount: metrics.isNew || 0, lostCount: metrics.isLost || 0 })}
        />

        <MetricCard
          title={t("trafficValueEtv")}
          value={metrics.etv ? Math.round(metrics.etv).toLocaleString() : "—"}
          icon={Zap}
          subtitle={t("estimatedTrafficValue")}
        />

        <MetricCard
          title={t("keywordMovement")}
          value=""
          icon={TrendUp02}
          subtitle={
            <div className="flex gap-4">
              <div className="flex items-center gap-1">
                <TrendUp02 className="h-4 w-4 text-fg-success-secondary" />
                <span className="text-sm font-medium text-success-primary">
                  {metrics.isUp || 0}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendDown02 className="h-4 w-4 text-fg-error-secondary" />
                <span className="text-sm font-medium text-error-primary">
                  {metrics.isDown || 0}
                </span>
              </div>
            </div>
          }
        />

        <MetricCard
          title={t("newRankings")}
          value={metrics.isNew || 0}
          icon={Star01}
          badge={
            <BadgeWithDot size="sm" color="brand" type="modern">
              {t("newLabel")}
            </BadgeWithDot>
          }
        />
      </div>
    </div>
  );
}
