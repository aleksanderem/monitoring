"use client";

import { Lightbulb02, Target03, TrendUp01, Users01, HelpCircle } from "@untitledui/icons";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";

interface GapSummary {
  totalGaps: number;
  highPriority: number;
  totalEstimatedValue: number;
  competitorsAnalyzed: number;
  lastAnalyzedAt: number | null;
}

interface GapSummaryCardsProps {
  summary: GapSummary;
  isLoading?: boolean;
}

export function GapSummaryCards({ summary, isLoading }: GapSummaryCardsProps) {
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

  const highPriorityPercentage =
    summary.totalGaps > 0
      ? Math.round((summary.highPriority / summary.totalGaps) * 100)
      : 0;

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  };

  const metrics = [
    {
      title: "Total Gaps",
      value: summary.totalGaps.toString(),
      subtitle: formatDate(summary.lastAnalyzedAt),
      icon: Lightbulb02,
      color: "text-primary-600",
      bgColor: "bg-primary-50",
      tooltip: "Total keywords where at least one competitor ranks but you don't. More gaps = more untapped opportunities.",
    },
    {
      title: "High Priority",
      value: summary.highPriority.toString(),
      subtitle: `${highPriorityPercentage}% of total`,
      icon: Target03,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      tooltip: "Gaps scored 70+ out of 100, indicating high search volume, low difficulty, or competitor ranking in top positions. Best opportunities to pursue first.",
    },
    {
      title: "Est. Traffic Value",
      value: formatValue(summary.totalEstimatedValue),
      subtitle: "monthly visits",
      icon: TrendUp01,
      color: "text-green-600",
      bgColor: "bg-green-50",
      tooltip: "Estimated monthly visits you could gain by ranking for all gap keywords. Calculated assuming ~30% click-through rate for top positions.",
    },
    {
      title: "Competitors",
      value: summary.competitorsAnalyzed.toString(),
      subtitle: "analyzed",
      icon: Users01,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      tooltip: "Number of unique competitor domains analyzed in the content gap comparison.",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.title}
            className="flex flex-col gap-2 rounded-xl border border-secondary bg-primary p-4"
          >
            <div className="flex items-center gap-2">
              <div className={`rounded-lg ${metric.bgColor} p-2`}>
                <Icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <p className="text-sm font-medium text-secondary">{metric.title}</p>
              <Tooltip title={metric.title} description={metric.tooltip}>
                <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                  <HelpCircle className="size-3.5" />
                </TooltipTrigger>
              </Tooltip>
            </div>
            <div className="flex flex-col">
              <p className="text-3xl font-semibold text-primary">{metric.value}</p>
              <p className="text-xs text-tertiary">{metric.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
