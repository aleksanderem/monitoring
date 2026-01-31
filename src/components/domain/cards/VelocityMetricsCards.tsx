"use client";

import { TrendUp01, TrendDown01, ArrowsRight } from "@untitledui/icons";

interface VelocityStats {
  avgNewPerDay: number;
  avgLostPerDay: number;
  avgNetChange: number;
  totalNew: number;
  totalLost: number;
  netChange: number;
  daysTracked: number;
}

interface VelocityMetricsCardsProps {
  stats: VelocityStats;
  isLoading?: boolean;
  recentVelocity?: number; // 7-day velocity for recent trend
}

export function VelocityMetricsCards({
  stats,
  isLoading,
  recentVelocity,
}: VelocityMetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-secondary bg-primary p-4"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: "Avg New/Day",
      value: stats.avgNewPerDay.toFixed(1),
      trend: stats.avgNewPerDay > 0 ? "up" : "neutral",
      icon: TrendUp01,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Avg Lost/Day",
      value: stats.avgLostPerDay.toFixed(1),
      trend: stats.avgLostPerDay > 0 ? "down" : "neutral",
      icon: TrendDown01,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Net Growth",
      value: `${stats.avgNetChange >= 0 ? "+" : ""}${stats.avgNetChange.toFixed(1)}/day`,
      trend: stats.avgNetChange > 0 ? "up" : stats.avgNetChange < 0 ? "down" : "neutral",
      icon: stats.avgNetChange > 0 ? TrendUp01 : stats.avgNetChange < 0 ? TrendDown01 : ArrowsRight,
      color: stats.avgNetChange > 0 ? "text-green-600" : stats.avgNetChange < 0 ? "text-red-600" : "text-gray-600",
      bgColor: stats.avgNetChange > 0 ? "bg-green-50" : stats.avgNetChange < 0 ? "bg-red-50" : "bg-gray-50",
    },
    {
      title: "7-Day Velocity",
      value: recentVelocity !== undefined
        ? `${recentVelocity >= 0 ? "+" : ""}${recentVelocity.toFixed(1)}`
        : `${stats.avgNetChange >= 0 ? "+" : ""}${stats.avgNetChange.toFixed(1)}`,
      trend: (recentVelocity ?? stats.avgNetChange) > 0
        ? "up"
        : (recentVelocity ?? stats.avgNetChange) < 0
        ? "down"
        : "neutral",
      icon: (recentVelocity ?? stats.avgNetChange) > 0
        ? TrendUp01
        : (recentVelocity ?? stats.avgNetChange) < 0
        ? TrendDown01
        : ArrowsRight,
      color: (recentVelocity ?? stats.avgNetChange) > 0
        ? "text-green-600"
        : (recentVelocity ?? stats.avgNetChange) < 0
        ? "text-red-600"
        : "text-gray-600",
      bgColor: (recentVelocity ?? stats.avgNetChange) > 0
        ? "bg-green-50"
        : (recentVelocity ?? stats.avgNetChange) < 0
        ? "bg-red-50"
        : "bg-gray-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-xl border border-secondary bg-primary p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-tertiary">
                {metric.title}
              </span>
              <div className={`rounded-full p-2 ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold ${metric.color}`}>
                {metric.value}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-quaternary">
                Last {stats.daysTracked} days
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
