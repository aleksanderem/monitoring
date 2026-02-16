"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTranslations } from "next-intl";
import { ChevronRight } from "@untitledui/icons";

export function SidebarUsageIndicator() {
  const t = useTranslations("common");
  const usage = useQuery(api.limits.getSidebarUsage);
  const [expanded, setExpanded] = useState(false);

  if (!usage || usage.domains.length === 0) return null;

  // Compute average usage percentage across all domains
  const totalPct = usage.domains.reduce((sum, d) => {
    return sum + Math.round((d.currentCount / d.limit) * 100);
  }, 0);
  const avgPct = Math.round(totalPct / usage.domains.length);
  const avgColor =
    avgPct >= 90 ? "bg-error-500" : avgPct >= 70 ? "bg-warning-500" : "bg-success-500";

  return (
    <div className="flex flex-col gap-1 px-3">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-md py-1 text-xs font-medium text-tertiary transition-colors hover:text-secondary"
      >
        <span>{t("limits")}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Average bar — fades out when expanded */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          gridTemplateRows: expanded ? "0fr" : "1fr",
          opacity: expanded ? 0 : 1,
        }}
      >
        <div className="overflow-hidden">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-quaternary">
            <div
              className={`h-full rounded-full transition-all ${avgColor}`}
              style={{ width: `${Math.min(100, avgPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Domain list — animates open/closed */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="flex max-h-[240px] flex-col gap-2 overflow-y-auto scrollbar-autohide">
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
        </div>
      </div>
    </div>
  );
}
