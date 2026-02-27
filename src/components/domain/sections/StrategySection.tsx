"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EzIcon } from "@/components/foundations/ez-icon";
import { AIStrategySection } from "./AIStrategySection";
import { ActiveStrategyDashboard } from "./strategy/ActiveStrategyDashboard";
import type { StrategySession } from "./strategy/StrategyRenderers";

interface StrategySectionProps {
  domainId: Id<"domains">;
}

export function StrategySection({ domainId }: StrategySectionProps) {
  const t = useTranslations("strategy");
  const activeStrategy = useQuery(api.aiStrategy.getActiveStrategy, { domainId });
  const hasActive = activeStrategy != null && activeStrategy.status === "completed";

  // Default to dashboard — effectiveView forces "generator" when no active strategy anyway
  const [view, setView] = useState<"dashboard" | "generator">("dashboard");

  // Auto-switch to dashboard when an active strategy appears
  const effectiveView = hasActive ? view : "generator";

  return (
    <div className="flex flex-col gap-6">
      {/* Header with view toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <EzIcon name="strategy" size={22} color="#7c3aed" strokeColor="#7c3aed" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">{t("aiStrategy")}</h2>
            <p className="text-sm text-tertiary">{t("aiStrategySubtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="flex items-center gap-1.5 rounded-lg border border-secondary px-3 py-1.5 text-sm font-medium text-secondary hover:bg-primary-hover transition-colors"
          >
            <EzIcon name="calendar-03" size={16} color="currentColor" strokeColor="currentColor" />
            {t("viewCalendar")}
          </Link>
        {hasActive && (
          <div className="flex items-center rounded-lg border border-secondary bg-primary p-0.5">
            <button
              onClick={() => setView("dashboard")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                effectiveView === "dashboard"
                  ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
                  : "text-tertiary hover:text-primary"
              }`}
            >
              {t("dashboard")}
            </button>
            <button
              onClick={() => setView("generator")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                effectiveView === "generator"
                  ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
                  : "text-tertiary hover:text-primary"
              }`}
            >
              {t("generator")}
            </button>
          </div>
        )}
        </div>
      </div>

      {/* View content */}
      {effectiveView === "dashboard" && hasActive ? (
        <ActiveStrategyDashboard
          session={activeStrategy as StrategySession}
          domainId={domainId}
        />
      ) : (
        <AIStrategySection domainId={domainId} />
      )}
    </div>
  );
}
