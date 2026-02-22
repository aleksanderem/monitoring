"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { Badge } from "@/components/base/badges/badges";
import { EzIcon } from "@/components/foundations/ez-icon";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { PermissionGate } from "@/components/auth/PermissionGate";
import {
  Stars01,
  ChevronDown,
  ChevronUp,
  Trash01,
  Clock,
  Download01,
  CheckCircle,
  Edit01,
  XClose,
  Loading02,
  AlertCircle,
  MinusCircle,
} from "@untitledui/icons";
import { toast } from "sonner";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import {
  type Strategy,
  type StrategySession,
  SECTION_CONFIG,
  StrategySectionCard,
} from "./strategy/StrategyRenderers";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Step Progress Helpers ───────────────────────────────────────

type StepStatus = "pending" | "running" | "completed" | "skipped" | "failed";

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="size-4 text-success-500" />;
    case "running":
      return <Loading02 className="size-4 animate-spin text-brand-500" />;
    case "failed":
      return <AlertCircle className="size-4 text-error-500" />;
    case "skipped":
      return <MinusCircle className="size-4 text-tertiary" />;
    case "pending":
    default:
      return <Clock className="size-4 text-quaternary" />;
  }
}

const STEP_I18N_MAP: Record<string, string> = {
  "Loading domain data": "stepLoadingDomain",
  "Collecting keyword, competitor & extended data": "stepCollectingKeywords",
  "Analyzing competitors & keyword map": "stepAnalyzingCompetitors",
  "Processing collected data": "stepProcessingData",
  "Resolving AI configuration": "stepResolvingProvider",
  "Analyzing keywords, links & technical data": "stepPhase1Analysis",
  "Synthesizing strategy recommendations": "stepPhase2Synthesis",
  "Building action plan & executive summary": "stepPhase3ActionPlan",
  "Storing strategy results": "stepSavingStrategy",
};

function stepTextClass(status: StepStatus) {
  switch (status) {
    case "running": return "text-sm font-medium text-primary";
    case "completed": return "text-sm text-secondary";
    case "failed": return "text-sm text-error-500";
    case "skipped": return "text-sm text-quaternary";
    default: return "text-sm text-tertiary";
  }
}

// Phase groupings for the 9-step process
const STEP_PHASES = [
  { labelKey: "phaseDataCollection", stepIndices: [0, 1, 2, 3] },
  { labelKey: "phaseAIAnalysis", stepIndices: [4, 5, 6, 7] },
  { labelKey: "phaseFinalization", stepIndices: [8] },
];

function getPhaseStatus(steps: any[], indices: number[]): "pending" | "running" | "completed" | "failed" {
  const phaseSteps = indices.map((i) => steps[i]).filter(Boolean);
  if (phaseSteps.some((s) => s.status === "failed")) return "failed";
  if (phaseSteps.every((s) => s.status === "completed" || s.status === "skipped")) return "completed";
  if (phaseSteps.some((s) => s.status === "running" || s.status === "completed")) return "running";
  return "pending";
}

function PhaseHeader({ label, status }: { label: string; status: "pending" | "running" | "completed" | "failed" }) {
  const dotClass =
    status === "completed" ? "bg-success-500" :
    status === "running" ? "bg-brand-500 animate-pulse" :
    status === "failed" ? "bg-error-500" :
    "bg-disabled";
  const textClass =
    status === "running" ? "text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400" :
    status === "completed" ? "text-xs font-semibold uppercase tracking-wide text-success-600 dark:text-success-400" :
    status === "failed" ? "text-xs font-semibold uppercase tracking-wide text-error-600" :
    "text-xs font-semibold uppercase tracking-wide text-quaternary";
  return (
    <div className="flex items-center gap-2 pt-1.5 pb-0.5">
      <div className={`size-2 rounded-full ${dotClass}`} />
      <span className={textClass}>{label}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

interface AIStrategySectionProps {
  domainId: Id<"domains">;
}

export function AIStrategySection({ domainId }: AIStrategySectionProps) {
  const t = useTranslations("strategy");
  const history = useQuery(api.aiStrategy.getHistory, { domainId });
  const latest = useQuery(api.aiStrategy.getLatest, { domainId });
  const domain = useQuery(api.domains.getDomain, { domainId });
  const activeStrategy = useQuery(api.aiStrategy.getActiveStrategy, { domainId });
  const generateAction = useAction(api.actions.aiStrategy.generateDomainStrategy);
  const deleteSessionMutation = useMutation(api.aiStrategy.deleteSession);
  const setActiveStrategyMutation = useMutation(api.aiStrategy.setActiveStrategy);

  const [businessDescription, setBusinessDescription] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [focusKeywords, setFocusKeywords] = useState<string[]>([]);
  const [focusKeywordInput, setFocusKeywordInput] = useState("");
  const [generateBacklinkContent, setGenerateBacklinkContent] = useState(false);
  const [generateContentMockups, setGenerateContentMockups] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<Id<"aiStrategySessions"> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Auto-fill from domain record (saved by previous strategy/research generation)
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  useEffect(() => {
    if (hasAutoFilled) return;
    if (latest === undefined || domain === undefined) return;

    if (latest?.businessDescription) {
      setBusinessDescription(latest.businessDescription);
      setTargetCustomer(latest.targetCustomer ?? "");
      setFocusKeywords(latest.focusKeywords ?? []);
      setGenerateBacklinkContent(latest.generateBacklinkContent ?? false);
      setGenerateContentMockups(latest.generateContentMockups ?? false);
      setHasAutoFilled(true);
      return;
    }

    if (domain?.businessDescription) {
      setBusinessDescription(domain.businessDescription);
      setTargetCustomer(domain.targetCustomer ?? "");
      setHasAutoFilled(true);
      return;
    }

    setHasAutoFilled(true);
  }, [latest, domain, hasAutoFilled]);

  // Determine which session to display
  const displaySession: StrategySession | null = (() => {
    if (viewingSessionId && history) {
      return (history as any[]).find((s: any) => s._id === viewingSessionId) ?? null;
    }
    return latest as StrategySession | null;
  })();

  const currentStrategy = displaySession?.status === "completed" ? displaySession.strategy : null;
  const isCurrentlyGenerating =
    displaySession?.status === "initializing" ||
    displaySession?.status === "collecting" ||
    displaySession?.status === "analyzing" ||
    isGenerating;
  const isActiveSession = activeStrategy?._id === displaySession?._id;
  const hasAnyStrategy = !!currentStrategy;

  // Compute strategy number: history is sorted desc, so index 0 = latest = highest number
  const strategyNumber = (() => {
    if (!displaySession || !history) return 1;
    const idx = (history as any[]).findIndex((s: any) => s._id === displaySession._id);
    if (idx === -1) return (history as any[]).length + 1;
    return (history as any[]).length - idx;
  })();

  const handleGenerate = useCallback(async () => {
    if (!businessDescription.trim() || !targetCustomer.trim()) return;
    setIsGenerating(true);
    setError(null);
    setViewingSessionId(null);
    setShowForm(false);
    try {
      const result = await generateAction({
        domainId,
        businessDescription: businessDescription.trim(),
        targetCustomer: targetCustomer.trim(),
        focusKeywords: focusKeywords.length > 0 ? focusKeywords : undefined,
        generateBacklinkContent: generateBacklinkContent || undefined,
        generateContentMockups: generateContentMockups || undefined,
      });
      if (!result.success) {
        setError(result.error || t("unknownError"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unknownError"));
    } finally {
      setIsGenerating(false);
    }
  }, [businessDescription, targetCustomer, focusKeywords, generateBacklinkContent, generateContentMockups, domainId, generateAction]);

  const handleExportPdf = async () => {
    if (!currentStrategy || !displaySession) return;
    setIsExporting(true);
    try {
      const { generateStrategyPdf } = await import("@/lib/generateDomainReportPdf");
      const dateStr = new Date(displaySession.completedAt ?? displaySession.createdAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });
      const blob = await generateStrategyPdf(
        currentStrategy,
        domain?.domain ?? "",
        dateStr,
        {
          businessDescription: displaySession.businessDescription,
          targetCustomer: displaySession.targetCustomer,
          dataSnapshot: displaySession.dataSnapshot,
          drillDowns: displaySession.drillDowns,
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seo-strategy-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[PDF Export]", err);
      toast.error(t("failedToExportPdf"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSetActive = async (sessionId: Id<"aiStrategySessions">) => {
    try {
      await setActiveStrategyMutation({ domainId, sessionId });
      toast.success(t("strategyActivated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToActivateStrategy"));
    }
  };

  const canGenerate = businessDescription.trim().length > 0 && targetCustomer.trim().length > 0;
  const pastSessions = history?.filter((s: any) => s._id !== displaySession?._id) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Strategy Header — shown when a strategy exists */}
      {currentStrategy && displaySession && (
        <div className="relative rounded-xl border border-secondary bg-primary p-6 shadow-sm">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-primary">
                  {t("strategyNumber", { number: strategyNumber })}
                </h3>
                <span className="text-sm text-tertiary">
                  {new Date(displaySession.completedAt ?? displaySession.createdAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </span>
                {isActiveSession && (
                  <Badge size="sm" color="success">{t("activeStrategy")}</Badge>
                )}
              </div>
              {/* Business context as plain text */}
              <div className="space-y-1.5">
                <p className="text-sm text-secondary">
                  <span className="font-medium text-tertiary">{t("businessDescription")}:</span>{" "}
                  {displaySession.businessDescription}
                </p>
                <p className="text-sm text-secondary">
                  <span className="font-medium text-tertiary">{t("targetCustomer")}:</span>{" "}
                  {displaySession.targetCustomer}
                </p>
                {displaySession.focusKeywords && displaySession.focusKeywords.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-tertiary">{t("focusKeywords")}:</span>
                    {displaySession.focusKeywords.map((kw, i) => (
                      <Badge key={i} size="sm" color="brand">{kw}</Badge>
                    ))}
                  </div>
                )}
              </div>
              {/* Task progress indicator */}
              {(() => {
                const taskStatuses = displaySession.taskStatuses ?? [];
                const stepStatuses = displaySession.stepStatuses ?? [];
                const actionPlan = (currentStrategy as any).actionPlan ?? [];
                const actionableSteps = (currentStrategy as any).actionableSteps ?? [];
                const totalCount = actionPlan.length + actionableSteps.length;
                if (totalCount === 0) return null;
                const completed = taskStatuses.filter((ts: any) => ts.completed).length + stepStatuses.filter((ss: any) => ss.completed).length;
                const pct = Math.round((completed / totalCount) * 100);
                return (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-secondary">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-utility-success-500" : "bg-brand-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-tertiary whitespace-nowrap tabular-nums">
                      {t("tasksCompleted", { completed, total: totalCount })}
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isActiveSession && (
                <Button
                  size="sm"
                  color="secondary"
                  iconLeading={CheckCircle}
                  onClick={() => handleSetActive(displaySession._id)}
                >
                  {t("setAsActive")}
                </Button>
              )}
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
            </div>
          </div>
        </div>
      )}

      {/* Form — always shown when no strategy, collapsible when strategy exists */}
      {hasAnyStrategy && !showForm ? (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            color="secondary"
            iconLeading={Edit01}
            onClick={() => setShowForm(true)}
          >
            {t("editSettings")}
          </Button>
        </div>
      ) : (
        <div className="relative rounded-xl border border-secondary bg-primary p-6">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <div className="flex flex-col gap-4">
            <TextArea
              label={t("businessDescription")}
              placeholder={t("businessDescriptionPlaceholder")}
              value={businessDescription}
              onChange={setBusinessDescription}
              rows={3}
            />
            <TextArea
              label={t("targetCustomer")}
              placeholder={t("targetCustomerPlaceholder")}
              value={targetCustomer}
              onChange={setTargetCustomer}
              rows={3}
            />

            {/* Focus Keywords — tag input */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">{t("focusKeywords")}</label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-2 focus-within:ring-2 focus-within:ring-brand-500">
                {focusKeywords.map((kw, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">
                    {kw}
                    <button
                      type="button"
                      onClick={() => setFocusKeywords(focusKeywords.filter((_, j) => j !== i))}
                      className="ml-0.5 text-brand-400 hover:text-brand-600 dark:hover:text-brand-200"
                    >
                      <XClose className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={focusKeywordInput}
                  onChange={(e) => setFocusKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && focusKeywordInput.trim()) {
                      e.preventDefault();
                      const kw = focusKeywordInput.trim();
                      if (!focusKeywords.includes(kw)) {
                        setFocusKeywords([...focusKeywords, kw]);
                      }
                      setFocusKeywordInput("");
                    } else if (e.key === "Backspace" && !focusKeywordInput && focusKeywords.length > 0) {
                      setFocusKeywords(focusKeywords.slice(0, -1));
                    }
                  }}
                  placeholder={focusKeywords.length === 0 ? t("focusKeywordsPlaceholder") : ""}
                  className="flex-1 min-w-[120px] bg-transparent text-sm text-primary outline-none placeholder:text-quaternary"
                />
              </div>
              <p className="mt-1 text-xs text-tertiary">{t("focusKeywordsHint")}</p>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3 pt-1">
              <Toggle
                size="sm"
                label={t("generateBacklinkContent")}
                hint={t("generateBacklinkContentHint")}
                isSelected={generateBacklinkContent}
                onChange={setGenerateBacklinkContent}
              />
              <Toggle
                size="sm"
                label={t("generateContentMockups")}
                hint={t("generateContentMockupsHint")}
                isSelected={generateContentMockups}
                onChange={setGenerateContentMockups}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <PermissionGate permission="ai.strategy">
                <Button
                  color="primary"
                  size="md"
                  iconLeading={Stars01}
                  onClick={handleGenerate}
                  isDisabled={!canGenerate || isCurrentlyGenerating}
                  isLoading={isCurrentlyGenerating}
                >
                  {isCurrentlyGenerating ? t("generating") : currentStrategy ? t("refreshStrategy") : t("generateStrategy")}
                </Button>
              </PermissionGate>
              {hasAnyStrategy && (
                <Button
                  size="md"
                  color="secondary"
                  iconLeading={XClose}
                  onClick={() => setShowForm(false)}
                >
                  {t("collapseSettings")}
                </Button>
              )}
              {isCurrentlyGenerating && (
                <p className="text-sm text-tertiary">{t("generatingHint")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {(error || displaySession?.status === "failed") && (
        <div className="rounded-xl border border-utility-error-300 dark:border-utility-error-800 bg-utility-error-50 dark:bg-utility-error-950 p-4">
          <p className="text-sm font-medium text-utility-error-700 dark:text-utility-error-300">{t("errorGenerating")}</p>
          <p className="mt-1 text-sm text-utility-error-600 dark:text-utility-error-400">{error || displaySession?.error}</p>
        </div>
      )}

      {/* Progress state */}
      {isCurrentlyGenerating && !currentStrategy && displaySession && (
        <div className="relative rounded-xl border border-secondary bg-primary p-6 space-y-4">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">
                {displaySession.currentStep
                  ? (STEP_I18N_MAP[displaySession.currentStep.replace("...", "")]
                      ? t(STEP_I18N_MAP[displaySession.currentStep.replace("...", "")])
                      : displaySession.currentStep)
                  : t("initializing")}
              </span>
              <span className="font-medium text-primary">{displaySession.progress ?? 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${displaySession.progress ?? 0}%` }}
              />
            </div>
          </div>
          {/* Steps list — grouped by phase */}
          {displaySession.steps && (
            <div className="rounded-lg border border-secondary p-3 space-y-0.5">
              {(() => {
                const steps = displaySession.steps as any[];
                // For legacy sessions with fewer steps, render flat
                if (steps.length < 9) {
                  return steps.map((step: any, i: number) => (
                    <div key={i} className="flex items-center gap-2.5 py-1">
                      <StepIcon status={step.status as StepStatus} />
                      <span className={stepTextClass(step.status as StepStatus)}>
                        {STEP_I18N_MAP[step.name] ? t(STEP_I18N_MAP[step.name]) : step.name}
                      </span>
                    </div>
                  ));
                }
                // 9-step: group into phases
                return STEP_PHASES.map((phase, pi) => {
                  const phaseStatus = getPhaseStatus(steps, phase.stepIndices);
                  return (
                    <div key={pi} className={pi > 0 ? "pt-1.5 border-t border-secondary mt-1.5" : ""}>
                      <PhaseHeader label={t(phase.labelKey)} status={phaseStatus} />
                      {phase.stepIndices.map((si) => {
                        const step = steps[si];
                        if (!step) return null;
                        return (
                          <div key={si} className="flex items-center gap-2.5 py-0.5 pl-4">
                            <StepIcon status={step.status as StepStatus} />
                            <span className={stepTextClass(step.status as StepStatus)}>
                              {STEP_I18N_MAP[step.name] ? t(STEP_I18N_MAP[step.name]) : step.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Strategy Sections */}
      {currentStrategy && displaySession && (
        <div className="space-y-3">
          {SECTION_CONFIG.filter(({ key }) => {
            // Hide optional sections when no data
            if (key === "backlinkContentExamples" && !currentStrategy.backlinkContentExamples?.length) return false;
            return true;
          }).map(({ key, icon, countKey, getCount }) => (
            <StrategySectionCard
              key={key}
              sectionKey={key}
              icon={icon}
              strategy={currentStrategy}
              drillDowns={displaySession.drillDowns}
              sessionId={displaySession._id}
              t={t}
              countKey={countKey}
              getCount={getCount}
              stepStatuses={displaySession.stepStatuses}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!currentStrategy && !isCurrentlyGenerating && !error && displaySession?.status !== "failed" && (
        <div className="rounded-xl border border-dashed border-secondary bg-primary p-8 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <EzIcon name="strategy" size={40} color="#98a2b3" strokeColor="#98a2b3" />
          </div>
          <p className="text-sm font-medium text-primary mb-1">{t("noStrategyYet")}</p>
          <p className="text-sm text-tertiary max-w-md mx-auto">{t("noStrategyDescription")}</p>
        </div>
      )}

      {/* History Section */}
      {(pastSessions as any[]).length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-left"
          >
            {showHistory ? <ChevronUp className="h-4 w-4 text-tertiary" /> : <ChevronDown className="h-4 w-4 text-tertiary" />}
            <h3 className="text-lg font-semibold text-primary">
              {t("previousStrategies")} ({(pastSessions as any[]).length})
            </h3>
          </button>

          {showHistory && (
            <div className="space-y-3">
              {(pastSessions as any[]).map((session: any) => {
                const sessionDate = new Date(session.createdAt);
                const isSessionActive = activeStrategy?._id === session._id;
                const sessionIdx = (history as any[]).findIndex((s: any) => s._id === session._id);
                const sessionNum = sessionIdx === -1 ? "?" : (history as any[]).length - sessionIdx;
                return (
                  <div key={session._id} className="relative rounded-xl border border-secondary bg-primary">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-tertiary shrink-0" />
                          <span className="text-sm font-medium text-primary">
                            {t("strategyNumber", { number: sessionNum })} · {sessionDate.toLocaleDateString()} {sessionDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Badge size="sm" color={session.status === "completed" ? "success" : session.status === "failed" ? "error" : "gray"}>
                            {session.status}
                          </Badge>
                          {isSessionActive && (
                            <Badge size="sm" color="success">{t("activeStrategy")}</Badge>
                          )}
                        </div>
                        {session.dataSnapshot && (
                          <div className="flex flex-wrap gap-2 text-xs text-tertiary">
                            {session.dataSnapshot.keywordCount != null && (
                              <span>{session.dataSnapshot.keywordCount} {t("keywords")}</span>
                            )}
                            {session.dataSnapshot.contentGapCount != null && (
                              <span>{session.dataSnapshot.contentGapCount} {t("gaps")}</span>
                            )}
                            {session.dataSnapshot.competitorCount != null && (
                              <span>{session.dataSnapshot.competitorCount} {t("competitors")}</span>
                            )}
                            {session.dataSnapshot.backlinkCount != null && (
                              <span>{session.dataSnapshot.backlinkCount} {t("backlinks")}</span>
                            )}
                          </div>
                        )}
                        {/* Task progress for completed strategies */}
                        {session.status === "completed" && session.strategy && (() => {
                          const ts = session.taskStatuses ?? [];
                          const ss = session.stepStatuses ?? [];
                          const ap = session.strategy?.actionPlan ?? [];
                          const as_ = session.strategy?.actionableSteps ?? [];
                          const total = ap.length + as_.length;
                          if (total === 0) return null;
                          const done = ts.filter((x: any) => x.completed).length + ss.filter((x: any) => x.completed).length;
                          const pct = Math.round((done / total) * 100);
                          return (
                            <div className="flex items-center gap-2.5 mt-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden max-w-40">
                                <div
                                  className={`h-full rounded-full ${pct === 100 ? "bg-utility-success-500" : "bg-brand-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-tertiary tabular-nums">
                                {t("tasksCompleted", { completed: done, total })}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {session.status === "completed" && !isSessionActive && (
                          <Button
                            size="sm"
                            color="secondary"
                            iconLeading={CheckCircle}
                            onClick={() => handleSetActive(session._id)}
                          >
                            {t("setAsActive")}
                          </Button>
                        )}
                        {session.status === "completed" && (
                          <Button
                            size="sm"
                            color="secondary"
                            onClick={() => {
                              if (viewingSessionId === session._id) {
                                setViewingSessionId(null);
                              } else {
                                setViewingSessionId(session._id);
                              }
                            }}
                          >
                            {viewingSessionId === session._id ? t("hideStrategy") : t("viewStrategy")}
                          </Button>
                        )}
                        <DeleteConfirmationDialog
                          title={t("deleteSession")}
                          description={t("deleteConfirm")}
                          onConfirm={async () => {
                            await deleteSessionMutation({ id: session._id });
                            if (viewingSessionId === session._id) {
                              setViewingSessionId(null);
                            }
                            toast.success(t("deleteSession"));
                          }}
                        >
                          <ButtonUtility size="xs" color="tertiary" icon={Trash01} />
                        </DeleteConfirmationDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
