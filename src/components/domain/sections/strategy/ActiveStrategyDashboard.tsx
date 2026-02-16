"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import {
  Download01,
  XClose,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "@untitledui/icons";
import { EzIcon } from "@/components/foundations/ez-icon";
import { toast } from "sonner";
import { useState } from "react";
import {
  type Strategy,
  type StrategySession,
  type ActionPlanItem,
  type ActionableStep,
  SECTION_CONFIG,
  StrategySectionCard,
  StrategyCallout,
  ActionPlanGantt,
  EFFORT_STYLES,
  TIMEFRAME_STYLES,
} from "./StrategyRenderers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STEP_TYPE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  landing:   { bg: "bg-brand-50 dark:bg-brand-950",                    text: "text-brand-700 dark:text-brand-300",                     icon: "target-01" },
  blog:      { bg: "bg-blue-50 dark:bg-blue-950",                     text: "text-blue-700 dark:text-blue-300",                       icon: "pencil-edit-02" },
  guide:     { bg: "bg-purple-50 dark:bg-purple-950",                 text: "text-purple-700 dark:text-purple-300",                   icon: "book-open-01" },
  technical: { bg: "bg-utility-warning-50 dark:bg-utility-warning-950", text: "text-utility-warning-700 dark:text-utility-warning-300", icon: "settings-01" },
  outreach:  { bg: "bg-utility-success-50 dark:bg-utility-success-950", text: "text-utility-success-700 dark:text-utility-success-300", icon: "link-05" },
  cleanup:   { bg: "bg-utility-error-50 dark:bg-utility-error-950",   text: "text-utility-error-700 dark:text-utility-error-300",     icon: "clean" },
  optimize:  { bg: "bg-amber-50 dark:bg-amber-950",                   text: "text-amber-700 dark:text-amber-300",                     icon: "magic-wand-03" },
};

const SPEC_LABELS: Record<string, string> = {
  minWordCount:     "Min. Words",
  targetKeywords:   "Keywords",
  keywordDensity:   "Density",
  internalLinks:    "Internal Links",
  externalLinks:    "External Links",
  headingStructure: "Headings",
  metaTitle:        "Meta Title",
  metaDescription:  "Meta Description",
  callToAction:     "CTA",
};

interface ActiveStrategyDashboardProps {
  session: StrategySession;
  domainId: Id<"domains">;
}

export function ActiveStrategyDashboard({ session, domainId }: ActiveStrategyDashboardProps) {
  const t = useTranslations("strategy");
  const domain = useQuery(api.domains.getDomain, { domainId });
  const updateTaskStatus = useMutation(api.aiStrategy.updateTaskStatus);
  const updateStepStatus = useMutation(api.aiStrategy.updateStepStatus);
  const setActiveStrategy = useMutation(api.aiStrategy.setActiveStrategy);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [dashboardTab, setDashboardTab] = useState<"gantt" | "plan" | "tasks">("gantt");

  const strategy = session.strategy as Strategy | null;
  if (!strategy) return null;

  const actionPlan = strategy.actionPlan ?? [];
  const actionableSteps = strategy.actionableSteps ?? [];
  const taskStatuses = session.taskStatuses ?? [];
  const stepStatuses = session.stepStatuses ?? [];

  // Combined progress: action plan + actionable steps
  const taskCompleted = taskStatuses.filter((t) => t.completed).length;
  const stepCompleted = stepStatuses.filter((s) => s.completed).length;
  const totalCompleted = taskCompleted + stepCompleted;
  const totalCount = actionPlan.length + actionableSteps.length;
  const progressPercent = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

  const handleToggleTask = async (index: number) => {
    const current = taskStatuses.find((t) => t.index === index);
    await updateTaskStatus({
      sessionId: session._id,
      taskIndex: index,
      completed: !(current?.completed ?? false),
    });
  };

  const handleToggleStep = async (index: number) => {
    const current = stepStatuses.find((s) => s.index === index);
    await updateStepStatus({
      sessionId: session._id,
      stepIndex: index,
      completed: !(current?.completed ?? false),
    });
  };

  const toggleExpanded = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleDeactivate = async () => {
    await setActiveStrategy({ domainId, sessionId: undefined });
    toast.success(t("strategyDeactivated"));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const { generateStrategyPdf } = await import("@/lib/generateDomainReportPdf");
      const dateStr = new Date(session.completedAt ?? session.createdAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });
      const blob = await generateStrategyPdf(
        strategy,
        domain?.domain ?? "",
        dateStr,
        {
          businessDescription: session.businessDescription,
          targetCustomer: session.targetCustomer,
          dataSnapshot: session.dataSnapshot,
          drillDowns: session.drillDowns,
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seo-strategy-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const sorted = [...actionPlan].sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex flex-col gap-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge size="md" color="success">{t("activeBadge")}</Badge>
          <span className="text-sm text-tertiary">
            {new Date(session.completedAt ?? session.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            color="secondary"
            iconLeading={Download01}
            onClick={handleExportPdf}
            isDisabled={isExporting}
            isLoading={isExporting}
          >
            {t("exportPdf")}
          </Button>
          <Button
            size="sm"
            color="secondary"
            iconLeading={XClose}
            onClick={handleDeactivate}
          >
            {t("removeActive")}
          </Button>
        </div>
      </div>

      {/* Combined Progress bar */}
      {totalCount > 0 && (
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">{t("taskProgress")}</h3>
            <span className="text-sm font-medium text-primary tabular-nums">
              {t("tasksCompleted", { completed: totalCompleted, total: totalCount })}
            </span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100
                  ? "bg-utility-success-500"
                  : progressPercent >= 50
                    ? "bg-brand-500"
                    : "bg-brand-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1 text-right">
            <span className="text-xs font-bold tabular-nums text-tertiary">{progressPercent}%</span>
          </div>
        </div>
      )}

      {/* Tabbed section: Timeline | Action Plan | Tasks */}
      {(sorted.length > 0 || actionableSteps.length > 0) && (
        <div>
          {/* Tab switcher */}
          <div className="flex items-center rounded-lg border border-secondary bg-primary p-0.5 mb-4 w-fit">
            {(["gantt", "plan", "tasks"] as const).map((tab) => {
              const label = tab === "gantt" ? t("dashboardTabTimeline")
                : tab === "plan" ? t("dashboardTabActionPlan")
                : t("dashboardTabTasks");
              const count = tab === "plan" ? `${taskCompleted}/${actionPlan.length}`
                : tab === "tasks" ? `${stepCompleted}/${actionableSteps.length}`
                : null;
              return (
                <button
                  key={tab}
                  onClick={() => setDashboardTab(tab)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    dashboardTab === tab
                      ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
                      : "text-tertiary hover:text-primary"
                  }`}
                >
                  {label}{count && <span className="ml-1.5 text-xs tabular-nums opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {dashboardTab === "gantt" && sorted.length > 0 && (
            <ActionPlanGantt data={sorted} t={t} />
          )}

          {dashboardTab === "plan" && sorted.length > 0 && (
            <div className="rounded-xl border border-secondary bg-primary overflow-hidden">
              <div className="px-6 py-4 border-b border-secondary flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">{t("actionPlan")}</h3>
                <span className="text-xs text-tertiary tabular-nums">{taskCompleted}/{actionPlan.length}</span>
              </div>
              <div className="divide-y divide-secondary">
                {sorted.map((item: ActionPlanItem, i: number) => {
                  const taskStatus = taskStatuses.find((t) => t.index === i);
                  const isCompleted = taskStatus?.completed ?? false;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                        isCompleted ? "bg-utility-success-50/50 dark:bg-utility-success-950/30" : ""
                      }`}
                    >
                      <button
                        onClick={() => handleToggleTask(i)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                          isCompleted
                            ? "border-utility-success-500 bg-utility-success-500 text-white"
                            : "border-gray-300 dark:border-gray-600 hover:border-brand-500"
                        }`}
                      >
                        {isCompleted && <CheckCircle className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          isCompleted ? "text-tertiary line-through" : "text-primary"
                        }`}>
                          {item.action}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_STYLES[item.effort] ?? EFFORT_STYLES.medium}`}>
                            {t("effort")}: {item.effort}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIMEFRAME_STYLES[item.timeframe] ?? TIMEFRAME_STYLES["short-term"]}`}>
                            {item.timeframe}
                          </span>
                          <Badge size="sm" color="gray">{item.category}</Badge>
                        </div>
                        {item.expectedImpact && (
                          <p className={`text-xs mt-1.5 ${isCompleted ? "text-tertiary" : "text-secondary"}`}>
                            {item.expectedImpact}
                          </p>
                        )}
                      </div>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isCompleted
                          ? "bg-utility-success-100 dark:bg-utility-success-900 text-utility-success-700 dark:text-utility-success-300"
                          : "bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300"
                      }`}>
                        #{item.priority}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dashboardTab === "tasks" && actionableSteps.length > 0 && (
            <div className="rounded-xl border border-secondary bg-primary overflow-hidden">
              <div className="px-6 py-4 border-b border-secondary flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary">{t("actionableSteps")}</h3>
                  <Badge size="sm" color="brand">{t("actionableStepsCount", { count: actionableSteps.length })}</Badge>
                </div>
                <span className="text-xs text-tertiary tabular-nums">{stepCompleted}/{actionableSteps.length}</span>
              </div>
              <div className="divide-y divide-secondary">
                {actionableSteps.map((step: ActionableStep, i: number) => {
                  const stepStatus = stepStatuses.find((s) => s.index === i);
                  const isCompleted = stepStatus?.completed ?? false;
                  const isExpanded = expandedSteps.has(i);
                  const typeStyle = STEP_TYPE_STYLES[step.type] ?? STEP_TYPE_STYLES.landing;
                  const specs = step.specs ?? {};
                  const specEntries = Object.entries(specs).filter(
                    ([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
                  );

                  return (
                    <div
                      key={i}
                      className={`transition-colors ${
                        isCompleted ? "bg-utility-success-50/50 dark:bg-utility-success-950/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-4 px-6 py-4">
                        <button
                          onClick={() => handleToggleStep(i)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                            isCompleted
                              ? "border-utility-success-500 bg-utility-success-500 text-white"
                              : "border-gray-300 dark:border-gray-600 hover:border-brand-500"
                          }`}
                        >
                          {isCompleted && <CheckCircle className="h-3.5 w-3.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => toggleExpanded(i)}
                            className="w-full text-left group"
                          >
                            <p className={`text-sm font-semibold leading-snug ${
                              isCompleted ? "text-tertiary line-through" : "text-primary"
                            }`}>
                              {step.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                                <EzIcon name={typeStyle.icon} size={12} /> {step.type}
                              </span>
                              {step.goal && (
                                <span className="text-xs text-secondary truncate max-w-xs">
                                  {step.goal}
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            isCompleted
                              ? "bg-utility-success-100 dark:bg-utility-success-900 text-utility-success-700 dark:text-utility-success-300"
                              : "bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300"
                          }`}>
                            {i + 1}
                          </span>
                          <button
                            onClick={() => toggleExpanded(i)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-tertiary hover:bg-secondary_subtle transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-6 pb-5 pt-0 ml-9">
                          {step.goal && (
                            <div className="rounded-lg border border-secondary p-3 mb-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1">{t("stepGoal")}</p>
                              <p className="text-sm text-primary">{step.goal}</p>
                            </div>
                          )}

                          {specEntries.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-2">{t("stepSpecs")}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {specEntries.map(([key, value]) => {
                                  const displayLabel = SPEC_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim();
                                  const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
                                  return (
                                    <div key={key} className="rounded-lg bg-secondary_subtle px-3 py-2">
                                      <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{displayLabel}</p>
                                      <p className="text-xs text-primary mt-0.5 font-medium leading-snug">{displayValue}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {step.notes && (
                            <StrategyCallout color="gray">
                              <p className="text-xs text-primary leading-relaxed">{step.notes}</p>
                            </StrategyCallout>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Strategy Sections */}
      <div className="space-y-3">
        {SECTION_CONFIG.map(({ key, icon, countKey, getCount }) => (
          <StrategySectionCard
            key={key}
            sectionKey={key}
            icon={icon}
            strategy={strategy}
            drillDowns={session.drillDowns}
            sessionId={session._id}
            t={t}
            countKey={countKey}
            getCount={getCount}
            stepStatuses={session.stepStatuses}
          />
        ))}
      </div>
    </div>
  );
}
