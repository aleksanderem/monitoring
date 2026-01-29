"use client";

import { Link03, Globe01, Server01, AlertCircle } from "@untitledui/icons";

interface BacklinksSummaryStatsProps {
  summary: {
    totalBacklinks: number;
    totalDomains: number;
    totalIps: number;
    dofollow: number;
    nofollow: number;
  } | null;
  isLoading?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  secondaryText,
}: {
  label: string;
  value: string | number;
  icon: any;
  iconColor: string;
  secondaryText?: string;
}) {
  const iconBgColors: Record<string, string> = {
    blue: "bg-blue-50",
    purple: "bg-purple-50",
    green: "bg-green-50",
    gray: "bg-gray-50",
  };

  const iconTextColors: Record<string, string> = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-green-600",
    gray: "text-gray-600",
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
        <span className="text-2xl font-semibold text-primary">{value.toLocaleString()}</span>
        {secondaryText && (
          <span className="text-sm text-tertiary">{secondaryText}</span>
        )}
      </div>
    </div>
  );
}

export function BacklinksSummaryStats({ summary, isLoading }: BacklinksSummaryStatsProps) {
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

  if (!summary) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-secondary bg-primary p-8">
        <AlertCircle className="h-12 w-12 text-fg-quaternary" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">No backlink data available</p>
          <p className="text-sm text-tertiary">Click "Fetch Backlinks" to load data</p>
        </div>
      </div>
    );
  }

  const dofollowPercent = summary.totalBacklinks > 0
    ? ((summary.dofollow / summary.totalBacklinks) * 100).toFixed(1)
    : "0";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Backlinks"
        value={summary.totalBacklinks}
        icon={Link03}
        iconColor="blue"
      />

      <StatCard
        label="Referring Domains"
        value={summary.totalDomains}
        icon={Globe01}
        iconColor="purple"
      />

      <StatCard
        label="Referring IPs"
        value={summary.totalIps}
        icon={Server01}
        iconColor="green"
      />

      <StatCard
        label="Dofollow Links"
        value={summary.dofollow}
        icon={Link03}
        iconColor="green"
        secondaryText={`${dofollowPercent}% of total backlinks`}
      />
    </div>
  );
}
