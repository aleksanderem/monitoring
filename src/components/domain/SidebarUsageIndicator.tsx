"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";

export function SidebarUsageIndicator() {
  const t = useTranslations("common");
  const usage = useQuery(api.limits.getSidebarUsage);

  if (!usage || usage.domains.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-3">
      <span className="text-xs font-medium text-tertiary">{t("keywordUsage")}</span>
      {usage.domains.map((d) => {
        const pct = Math.round((d.currentCount / d.limit) * 100);
        const color =
          pct >= 90 ? "bg-error-500" : pct >= 70 ? "bg-warning-500" : "bg-success-500";

        return (
          <div key={d.domainId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-secondary" title={d.domainName}>
                {d.domainName}
              </span>
              <span className="shrink-0 tabular-nums text-tertiary">
                {d.currentCount}/{d.limit}
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-quaternary">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
