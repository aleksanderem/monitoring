"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { Badge } from "@/components/base/badges/badges";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Stars01, ChevronDown, ChevronUp, Trash01, Clock } from "@untitledui/icons";
import { EzIcon } from "@/components/foundations/ez-icon";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { toast } from "sonner";
import { PermissionGate } from "@/components/auth/PermissionGate";

interface AIKeywordIdea {
  keyword: string;
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  relevanceScore: number;
  rationale: string;
  category: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  difficulty: number;
}

const INTENT_COLORS = {
  informational: "success",
  commercial: "blue",
  transactional: "warning",
  navigational: "gray",
} as const;

const FOCUS_LABELS: Record<string, string> = {
  all: "focusAll",
  informational: "focusInformational",
  commercial: "focusCommercial",
  transactional: "focusTransactional",
};

function KeywordResultsTable({
  keywords,
  selectedKeywords,
  toggleKeyword,
  toggleAll,
  intentLabel,
  t,
}: {
  keywords: AIKeywordIdea[];
  selectedKeywords: Set<string>;
  toggleKeyword: (kw: string) => void;
  toggleAll: () => void;
  intentLabel: (intent: string) => string;
  t: (key: any, params?: any) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-secondary bg-secondary_subtle">
            <th className="w-10 px-6 py-3">
              <input
                type="checkbox"
                checked={selectedKeywords.size === keywords.length && keywords.length > 0}
                onChange={toggleAll}
                className="size-4 rounded border-gray-300"
              />
            </th>
            <th className="px-4 py-3 font-medium text-tertiary">{t("colKeyword")}</th>
            <th className="px-4 py-3 font-medium text-tertiary">{t("colIntent")}</th>
            <th className="px-4 py-3 font-medium text-tertiary">{t("colCategory")}</th>
            <th className="px-4 py-3 font-medium text-tertiary text-right">{t("colRelevance")}</th>
            <th className="px-4 py-3 font-medium text-tertiary text-right">{t("colVolume")}</th>
            <th className="px-4 py-3 font-medium text-tertiary text-right">{t("colCpc")}</th>
            <th className="px-4 py-3 font-medium text-tertiary text-right">{t("colDifficulty")}</th>
            <th className="px-4 py-3 font-medium text-tertiary">{t("colRationale")}</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((kw) => (
            <tr
              key={kw.keyword}
              className="border-b border-secondary last:border-b-0 hover:bg-secondary_subtle cursor-pointer"
              onClick={() => toggleKeyword(kw.keyword)}
            >
              <td className="px-6 py-3">
                <input
                  type="checkbox"
                  checked={selectedKeywords.has(kw.keyword)}
                  onChange={() => toggleKeyword(kw.keyword)}
                  onClick={(e) => e.stopPropagation()}
                  className="size-4 rounded border-gray-300"
                />
              </td>
              <td className="px-4 py-3 font-medium text-primary">{kw.keyword}</td>
              <td className="px-4 py-3">
                <Badge
                  size="sm"
                  type="color"
                  color={INTENT_COLORS[kw.searchIntent] || "gray"}
                >
                  {intentLabel(kw.searchIntent)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-tertiary capitalize">{kw.category}</td>
              <td className="px-4 py-3 text-right text-primary tabular-nums">{kw.relevanceScore}/10</td>
              <td className="px-4 py-3 text-right text-primary tabular-nums">
                {kw.searchVolume > 0 ? kw.searchVolume.toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3 text-right text-primary tabular-nums">
                {kw.cpc > 0 ? `$${kw.cpc.toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {kw.difficulty > 0 ? (
                  <span className={
                    kw.difficulty >= 70 ? "text-error-600" :
                    kw.difficulty >= 40 ? "text-warning-600" :
                    "text-success-600"
                  }>
                    {kw.difficulty}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-tertiary max-w-xs truncate" title={kw.rationale}>
                {kw.rationale}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistorySessionCard({
  session,
  domainId,
  t,
  intentLabel,
}: {
  session: {
    _id: Id<"aiResearchSessions">;
    businessDescription: string;
    targetCustomer: string;
    keywordCount: number;
    focusType: string;
    keywords: AIKeywordIdea[];
    createdAt: number;
  };
  domainId: Id<"domains">;
  t: (key: any, params?: any) => string;
  intentLabel: (intent: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const addKeywords = useMutation(api.keywords.addKeywords);
  const deleteSession = useMutation(api.aiResearch.deleteSession);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedKeywords.size === session.keywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(session.keywords.map((k) => k.keyword)));
    }
  };

  const handleAddSelected = async () => {
    if (selectedKeywords.size === 0) return;
    setIsAdding(true);
    try {
      await addKeywords({ domainId, phrases: Array.from(selectedKeywords), source: "ai" });
      toast.success(t("addedSuccess", { count: selectedKeywords.size }));
      setSelectedKeywords(new Set());
    } catch {
      toast.error(t("addedFailed"));
    } finally {
      setIsAdding(false);
    }
  };

  const date = new Date(session.createdAt);
  const focusLabel = FOCUS_LABELS[session.focusType] || session.focusType;

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Session header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-tertiary shrink-0" />
            <span className="text-sm font-medium text-primary">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Badge size="sm" color="gray">{t("historyKeywords", { count: session.keywords.length })}</Badge>
            <Badge size="sm" color="brand">{t(focusLabel)}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              <span className="font-medium text-tertiary">{t("historyBusiness")}:</span>{" "}
              <span className="text-primary">{session.businessDescription.length > 120 ? session.businessDescription.slice(0, 120) + "…" : session.businessDescription}</span>
            </p>
            <p className="text-sm text-secondary">
              <span className="font-medium text-tertiary">{t("historyCustomer")}:</span>{" "}
              <span className="text-primary">{session.targetCustomer.length > 120 ? session.targetCustomer.slice(0, 120) + "…" : session.targetCustomer}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            color="secondary"
            iconLeading={expanded ? ChevronUp : ChevronDown}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t("historyHideKeywords") : t("historyShowKeywords")}
          </Button>
          <DeleteConfirmationDialog
            title={t("historyDeleteConfirm")}
            description={t("historyDeleteDescription")}
            confirmLabel={t("historyDeleteButton")}
            onConfirm={async () => {
              await deleteSession({ id: session._id });
              toast.success(t("historyDeleted"));
            }}
          >
            <ButtonUtility
              size="xs"
              color="tertiary"
              icon={Trash01}
            />
          </DeleteConfirmationDialog>
        </div>
      </div>

      {/* Expanded keywords table */}
      {expanded && (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between border-t border-b border-secondary px-6 py-3">
            <p className="text-sm text-tertiary">
              {t("resultsCount", { count: session.keywords.length })}
            </p>
            <div className="flex items-center gap-3">
              {selectedKeywords.size > 0 && (
                <span className="text-sm text-tertiary">
                  {t("selected", { count: selectedKeywords.size })}
                </span>
              )}
              <Button size="sm" color="secondary" onClick={toggleAll}>
                {selectedKeywords.size === session.keywords.length ? t("deselectAll") : t("selectAll")}
              </Button>
              <Button
                size="sm"
                color="primary"
                onClick={handleAddSelected}
                isDisabled={selectedKeywords.size === 0 || isAdding}
                isLoading={isAdding}
              >
                {isAdding ? t("adding") : t("addSelected", { count: selectedKeywords.size })}
              </Button>
            </div>
          </div>
          <KeywordResultsTable
            keywords={session.keywords}
            selectedKeywords={selectedKeywords}
            toggleKeyword={toggleKeyword}
            toggleAll={toggleAll}
            intentLabel={intentLabel}
            t={t}
          />
        </>
      )}
    </div>
  );
}

export function AIKeywordResearchSection({ domainId }: { domainId: Id<"domains"> }) {
  const t = useTranslations("aiResearch");
  const generateAction = useAction(api.actions.aiKeywordResearch.generateKeywordIdeas);
  const addKeywords = useMutation(api.keywords.addKeywords);
  const history = useQuery(api.aiResearch.getHistory, { domainId });
  const domain = useQuery(api.domains.getDomain, { domainId });

  const [businessDescription, setBusinessDescription] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [keywordCount, setKeywordCount] = useState<number>(20);
  const [focusType, setFocusType] = useState<"all" | "informational" | "commercial" | "transactional">("all");
  const [results, setResults] = useState<AIKeywordIdea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill from domain record or latest research session
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  useEffect(() => {
    if (hasAutoFilled) return;
    if (domain === undefined || history === undefined) return;

    // Priority 1: latest research session
    const latestSession = history?.[0];
    if (latestSession?.businessDescription) {
      setBusinessDescription(latestSession.businessDescription);
      setTargetCustomer(latestSession.targetCustomer ?? "");
      setHasAutoFilled(true);
      return;
    }

    // Priority 2: domain-level business context
    if (domain?.businessDescription) {
      setBusinessDescription(domain.businessDescription);
      setTargetCustomer(domain.targetCustomer ?? "");
      setHasAutoFilled(true);
      return;
    }

    setHasAutoFilled(true);
  }, [domain, history, hasAutoFilled]);

  const handleGenerate = useCallback(async () => {
    if (!businessDescription.trim() || !targetCustomer.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResults([]);
    setSelectedKeywords(new Set());

    try {
      const result = await generateAction({
        domainId,
        businessDescription: businessDescription.trim(),
        targetCustomer: targetCustomer.trim(),
        keywordCount,
        focusType,
      });

      if (result.success && result.keywords) {
        setResults(result.keywords);
      } else {
        setError(result.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, [businessDescription, targetCustomer, keywordCount, focusType, domainId, generateAction]);

  const handleAddSelected = useCallback(async () => {
    if (selectedKeywords.size === 0) return;

    setIsAdding(true);
    try {
      await addKeywords({
        domainId,
        phrases: Array.from(selectedKeywords),
        source: "ai",
      });
      toast.success(t("addedSuccess", { count: selectedKeywords.size }));
      setResults((prev) => prev.filter((k) => !selectedKeywords.has(k.keyword)));
      setSelectedKeywords(new Set());
    } catch {
      toast.error(t("addedFailed"));
    } finally {
      setIsAdding(false);
    }
  }, [selectedKeywords, domainId, addKeywords, t]);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedKeywords.size === results.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(results.map((k) => k.keyword)));
    }
  };

  const intentLabel = (intent: string) => {
    switch (intent) {
      case "informational": return t("intentInformational");
      case "commercial": return t("intentCommercial");
      case "transactional": return t("intentTransactional");
      case "navigational": return t("intentNavigational");
      default: return intent;
    }
  };

  const canGenerate = businessDescription.trim().length > 0 && targetCustomer.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
          <EzIcon name="ai-magic" size={22} color="#7c3aed" strokeColor="#7c3aed" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-primary mb-1">{t("title")}</h2>
          <p className="text-sm text-tertiary">{t("description")}</p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="flex flex-col gap-4">
          <TextArea
            label={t("businessDescriptionLabel")}
            placeholder={t("businessDescriptionPlaceholder")}
            value={businessDescription}
            onChange={setBusinessDescription}
            rows={3}
          />

          <TextArea
            label={t("targetCustomerLabel")}
            placeholder={t("targetCustomerPlaceholder")}
            value={targetCustomer}
            onChange={setTargetCustomer}
            rows={3}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-secondary">{t("keywordCountLabel")}</label>
              <select
                value={keywordCount}
                onChange={(e) => setKeywordCount(Number(e.target.value))}
                className="w-full rounded-lg border border-secondary bg-primary px-3 py-2.5 text-sm text-primary shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              >
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-secondary">{t("focusTypeLabel")}</label>
              <select
                value={focusType}
                onChange={(e) => setFocusType(e.target.value as typeof focusType)}
                className="w-full rounded-lg border border-secondary bg-primary px-3 py-2.5 text-sm text-primary shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              >
                <option value="all">{t("focusAll")}</option>
                <option value="informational">{t("focusInformational")}</option>
                <option value="commercial">{t("focusCommercial")}</option>
                <option value="transactional">{t("focusTransactional")}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <PermissionGate permission="ai.research">
              <Button
                color="primary"
                size="md"
                iconLeading={Stars01}
                onClick={handleGenerate}
                isDisabled={!canGenerate || isGenerating}
                isLoading={isGenerating}
              >
                {isGenerating ? t("generating") : t("generateButton")}
              </Button>
            </PermissionGate>
            {isGenerating && (
              <p className="text-sm text-tertiary">{t("generatingHint")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-error-300 bg-error-25 p-4">
          <p className="text-sm font-medium text-error-700">{t("errorTitle")}</p>
          <p className="mt-1 text-sm text-error-600">{error}</p>
        </div>
      )}

      {/* Current generation results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-secondary bg-primary">
          <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
            <p className="text-sm font-medium text-secondary">
              {t("resultsCount", { count: results.length })}
            </p>
            <div className="flex items-center gap-3">
              {selectedKeywords.size > 0 && (
                <span className="text-sm text-tertiary">
                  {t("selected", { count: selectedKeywords.size })}
                </span>
              )}
              <Button color="secondary" size="sm" onClick={toggleAll}>
                {selectedKeywords.size === results.length ? t("deselectAll") : t("selectAll")}
              </Button>
              <Button
                color="primary"
                size="sm"
                onClick={handleAddSelected}
                isDisabled={selectedKeywords.size === 0 || isAdding}
                isLoading={isAdding}
              >
                {isAdding ? t("adding") : t("addSelected", { count: selectedKeywords.size })}
              </Button>
            </div>
          </div>
          <KeywordResultsTable
            keywords={results}
            selectedKeywords={selectedKeywords}
            toggleKeyword={toggleKeyword}
            toggleAll={toggleAll}
            intentLabel={intentLabel}
            t={t}
          />
        </div>
      )}

      {/* History */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-primary">{t("historyTitle")}</h3>

        {history === undefined ? (
          <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
            <p className="text-sm text-tertiary">...</p>
          </div>
        ) : history.length === 0 && results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-secondary bg-primary p-8 text-center">
            <div className="mx-auto mb-3 flex justify-center">
              <EzIcon name="artificial-intelligence-07" size={40} color="#98a2b3" strokeColor="#98a2b3" />
            </div>
            <p className="text-sm text-tertiary">{t("historyEmpty")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history?.map((session) => (
              <HistorySessionCard
                key={session._id}
                session={session as any}
                domainId={domainId}
                t={t}
                intentLabel={intentLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
