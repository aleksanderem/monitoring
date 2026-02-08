"use client";

import { useQuery } from "convex/react";
import { Hash01, TrendUp02, TrendDown02, BarChart03, RefreshCw01 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { MetricCard } from "@/components/domain/cards/MetricCard";
import { LiveBadge } from "@/components/domain/badges/LiveBadge";
import { LoadingState } from "@/components/shared/LoadingState";

interface MonitoringStatsProps {
  domainId: Id<"domains">;
}

export function MonitoringStats({ domainId }: MonitoringStatsProps) {
  const t = useTranslations('keywords');
  const stats = useQuery(api.keywords.getMonitoringStats, { domainId });

  if (stats === undefined) {
    return <LoadingState type="card" />;
  }

  const { totalKeywords, avgPosition, avgPositionChange7d, estimatedMonthlyTraffic, movementBreakdown, netMovement7d } = stats;

  // Format traffic with K/M abbreviations
  const formatTraffic = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Determine trend icon for average position (lower is better)
  const avgPosTrendIcon = avgPositionChange7d > 0 ? TrendUp02 : avgPositionChange7d < 0 ? TrendDown02 : TrendUp02;
  const avgPosTrend = avgPositionChange7d > 0 ? "positive" : avgPositionChange7d < 0 ? "negative" : null;

  // Format movement breakdown
  const movementText = (
    <span className="flex items-center gap-2">
      <span className="text-utility-success-600">↑ {movementBreakdown.gainers}</span>
      <span className="text-tertiary">/</span>
      <span className="text-utility-error-600">↓ {movementBreakdown.losers}</span>
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-primary">{t('statistics')}</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('totalMonitored')}
          value={totalKeywords}
          subtitle={t('activeKeywords')}
          icon={Hash01}
          badge={<LiveBadge size="sm" />}
        />

        <MetricCard
          title={t('averagePosition')}
          value={avgPosition.toFixed(1)}
          icon={avgPosTrendIcon}
          trend={avgPosTrend}
          change={Math.abs(avgPositionChange7d).toFixed(1)}
          changeDescription={t('vsLastWeek')}
        />

        <MetricCard
          title={t('estMonthlyTraffic')}
          value={formatTraffic(estimatedMonthlyTraffic)}
          subtitle={t('potentialMonthlyVisitors')}
          icon={BarChart03}
        />

        <MetricCard
          title={t('positionChanges7d')}
          value={netMovement7d > 0 ? `+${netMovement7d}` : netMovement7d}
          subtitle={movementText}
          icon={RefreshCw01}
          trend={netMovement7d > 0 ? "positive" : netMovement7d < 0 ? "negative" : null}
        />
      </div>
    </div>
  );
}
