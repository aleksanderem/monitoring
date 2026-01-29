"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Hash01, TrendUp02, TrendDown02, BarChart03, Star01, Zap } from "@untitledui/icons";
import { MetricCard } from "../cards/MetricCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { BadgeWithDot } from "@/components/base/badges/badges";

interface ExecutiveSummaryProps {
  domainId: Id<"domains">;
}

export function ExecutiveSummary({ domainId }: ExecutiveSummaryProps) {
  const metrics = useQuery(api.domains.getLatestVisibilityMetrics, { domainId });

  if (metrics === undefined) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl bg-primary p-6">
            <LoadingState type="card" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <p className="text-sm text-tertiary">No visibility data available yet</p>
      </div>
    );
  }

  const top3Change = metrics.change?.top10 || 0;
  const totalChange = metrics.change?.total || 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-primary">Summary</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Top 3 Positions"
          value={metrics.top3}
          icon={TrendUp02}
          trend={top3Change > 0 ? "positive" : top3Change < 0 ? "negative" : null}
          change={top3Change > 0 ? `+${top3Change}` : top3Change < 0 ? `${top3Change}` : undefined}
          changeDescription="vs 7 days ago"
        />

        <MetricCard
          title="Top 10 Positions"
          value={metrics.top10}
          icon={BarChart03}
          trend={top3Change > 0 ? "positive" : top3Change < 0 ? "negative" : null}
          change={top3Change > 0 ? `+${top3Change}` : top3Change < 0 ? `${top3Change}` : undefined}
          changeDescription="vs 7 days ago"
        />

        <MetricCard
          title="Total Keywords"
          value={metrics.total}
          icon={Hash01}
          subtitle={`New: ${metrics.isNew || 0} | Lost: ${metrics.isLost || 0}`}
        />

        <MetricCard
          title="Traffic Value (ETV)"
          value={metrics.etv ? Math.round(metrics.etv).toLocaleString() : "—"}
          icon={Zap}
          subtitle="Estimated traffic value"
        />

        <MetricCard
          title="Keyword Movement"
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
          title="New Rankings"
          value={metrics.isNew || 0}
          icon={Star01}
          badge={
            <BadgeWithDot size="sm" color="brand" type="modern">
              New
            </BadgeWithDot>
          }
        />
      </div>
    </div>
  );
}
