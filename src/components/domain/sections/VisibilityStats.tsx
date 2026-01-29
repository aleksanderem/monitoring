"use client";

import { TrendUp02, TrendDown02, Eye, Target04, Hash01 } from "@untitledui/icons";

interface VisibilityStatsProps {
  stats: {
    totalKeywords: number;
    avgPosition: number;
    top3Count: number;
    top10Count: number;
    top100Count: number;
    visibilityScore: number;
    visibilityChange: number;
  };
  isLoading?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  trend,
  trendValue,
  secondaryText
}: {
  label: string;
  value: string | number;
  icon: any;
  iconColor: string;
  trend?: "up" | "down";
  trendValue?: string;
  secondaryText?: string;
}) {
  const iconBgColors: Record<string, string> = {
    blue: "bg-blue-50",
    purple: "bg-purple-50",
    green: "bg-green-50",
  };

  const iconTextColors: Record<string, string> = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-green-600",
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-secondary bg-primary p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-secondary">{label}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBgColors[iconColor] || "bg-gray-50"}`}>
          <Icon className={`h-5 w-5 ${iconTextColors[iconColor] || "text-gray-600"}`} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold text-primary">{value}</span>
        {trend && trendValue && (
          <div className="flex items-center gap-1">
            {trend === "up" ? (
              <TrendUp02 className="h-4 w-4 text-success-600" />
            ) : (
              <TrendDown02 className="h-4 w-4 text-error-600" />
            )}
            <span className={`text-sm font-medium ${trend === "up" ? "text-success-600" : "text-error-600"}`}>
              {trendValue}%
            </span>
          </div>
        )}
        {secondaryText && (
          <span className="text-sm text-tertiary">{secondaryText}</span>
        )}
      </div>
    </div>
  );
}

export function VisibilityStats({ stats, isLoading }: VisibilityStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-secondary bg-primary p-4"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Visibility Score"
        value={stats.visibilityScore.toFixed(0)}
        icon={Eye}
        iconColor="blue"
        trend={stats.visibilityChange > 0 ? "up" : stats.visibilityChange < 0 ? "down" : undefined}
        trendValue={stats.visibilityChange !== 0 ? Math.abs(stats.visibilityChange).toFixed(1) : undefined}
      />

      <StatCard
        label="Average Position"
        value={stats.avgPosition.toFixed(1)}
        icon={Target04}
        iconColor="purple"
      />

      <StatCard
        label="Top 3 Rankings"
        value={stats.top3Count}
        icon={TrendUp02}
        iconColor="green"
        secondaryText={`${((stats.top3Count / stats.totalKeywords) * 100).toFixed(1)}% of keywords`}
      />

      <StatCard
        label="Top 10 Rankings"
        value={stats.top10Count}
        icon={Hash01}
        iconColor="blue"
        secondaryText={`${((stats.top10Count / stats.totalKeywords) * 100).toFixed(1)}% of keywords`}
      />
    </div>
  );
}
