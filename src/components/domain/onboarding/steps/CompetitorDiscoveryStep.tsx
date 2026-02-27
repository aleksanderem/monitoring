"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Globe01, ArrowRight, Stars01 } from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface CompetitorDiscoveryStepProps {
  domainId: Id<"domains">;
  serpJobId: Id<"keywordSerpJobs"> | null;
  onComplete: (competitorIds: Id<"competitors">[]) => void;
  onSkip: () => void;
}

interface MergedSuggestion {
  domain: string;
  source: "serp" | "ai" | "both";
  // SERP data
  keywordOverlap?: number;
  avgPosition?: number;
  sampleKeywords?: string[];
  // AI data
  reason?: string;
  similarity?: number;
}

export function CompetitorDiscoveryStep({
  domainId,
  serpJobId,
  onComplete,
  onSkip,
}: CompetitorDiscoveryStepProps) {
  const t = useTranslations("domains");
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    new Set()
  );
  const [adding, setAdding] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<
    Array<{ domain: string; reason: string; similarity: number }> | null
  >(null);
  const [aiSearchTriggered, setAiSearchTriggered] = useState(false);

  // Reactive: auto-updates when job status changes
  const serpJob = useQuery(
    api.keywordSerpJobs.getJob,
    serpJobId ? { jobId: serpJobId } : "skip"
  );

  const serpDone =
    !serpJobId || serpJob?.status === "completed" || serpJob?.status === "failed";

  // Once SERP is done, get competitor suggestions
  const serpSuggestions = useQuery(
    api.competitors.getCompetitorSuggestionsFromSerp,
    serpDone ? { domainId } : "skip"
  );

  const searchCompetitorsWithAI = useAction(
    api.actions.aiCompetitorSearch.searchCompetitorsWithAI
  );
  const addCompetitor = useMutation(api.competitors.addCompetitor);

  // Auto-trigger AI search when SERP suggestions are empty or SERP is not available
  useEffect(() => {
    if (aiSearchTriggered) return;
    if (!serpDone) return;

    const serpEmpty = serpSuggestions !== undefined && serpSuggestions.length === 0;
    const noSerpJob = !serpJobId;

    if (serpEmpty || noSerpJob) {
      let cancelled = false;
      setAiSearchTriggered(true);

      (async () => {
        setAiSearching(true);
        try {
          const result = await searchCompetitorsWithAI({ domainId });
          if (cancelled) return;
          if (result.success && result.competitors) {
            setAiResults(result.competitors);
          } else {
            console.error("AI competitor search failed:", result.error);
            toast.error(t("aiSearchFailed"));
          }
        } catch (error) {
          if (cancelled) return;
          console.error("AI competitor search error:", error);
          toast.error(t("aiSearchFailed"));
        } finally {
          if (!cancelled) {
            setAiSearching(false);
          }
        }
      })();

      return () => { cancelled = true; };
    }
  }, [serpDone, serpSuggestions, serpJobId, aiSearchTriggered]);

  const handleAISearch = async () => {
    setAiSearching(true);
    try {
      const result = await searchCompetitorsWithAI({ domainId });
      if (result.success && result.competitors) {
        setAiResults(result.competitors);
      } else {
        console.error("AI competitor search failed:", result.error);
        toast.error(t("aiSearchFailed"));
      }
    } catch (error) {
      console.error("AI competitor search error:", error);
      toast.error(t("aiSearchFailed"));
    } finally {
      setAiSearching(false);
    }
  };

  // Merge SERP + AI suggestions
  const mergedSuggestions: MergedSuggestion[] = (() => {
    const map = new Map<string, MergedSuggestion>();

    // Add SERP suggestions
    if (serpSuggestions) {
      for (const s of serpSuggestions) {
        map.set(s.domain, {
          domain: s.domain,
          source: "serp",
          keywordOverlap: s.keywordOverlap,
          avgPosition: s.avgPosition,
          sampleKeywords: s.sampleKeywords,
        });
      }
    }

    // Add/merge AI suggestions
    if (aiResults) {
      for (const a of aiResults) {
        const existing = map.get(a.domain);
        if (existing) {
          existing.source = "both";
          existing.reason = a.reason;
          existing.similarity = a.similarity;
        } else {
          map.set(a.domain, {
            domain: a.domain,
            source: "ai",
            reason: a.reason,
            similarity: a.similarity,
          });
        }
      }
    }

    // Sort: "both" first, then by overlap/similarity
    return Array.from(map.values()).sort((a, b) => {
      const sourceOrder = { both: 0, serp: 1, ai: 2 };
      const aOrder = sourceOrder[a.source];
      const bOrder = sourceOrder[b.source];
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Within same source, sort by relevance
      if (a.keywordOverlap && b.keywordOverlap) return b.keywordOverlap - a.keywordOverlap;
      if (a.similarity && b.similarity) return b.similarity - a.similarity;
      return 0;
    });
  })();

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const handleAddCompetitors = async () => {
    if (selectedDomains.size === 0) return;
    setAdding(true);
    const addedIds: Id<"competitors">[] = [];

    for (const domain of selectedDomains) {
      try {
        const id = await addCompetitor({
          domainId,
          competitorDomain: domain,
        });
        addedIds.push(id);
      } catch (error: any) {
        if (!error.message?.includes("already being tracked")) {
          toast.error(t("failedToAddCompetitor", { domain }));
        }
      }
    }

    setAdding(false);
    onComplete(addedIds);
  };

  // SERP still running
  if (!serpDone && serpJob) {
    const progress =
      serpJob.totalKeywords > 0
        ? Math.round(
            (serpJob.processedKeywords / serpJob.totalKeywords) * 100
          )
        : 0;

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="h-12 w-12 animate-spin rounded-full border-3 border-brand-solid border-t-transparent" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            {t("onboardingAnalyzingSerp")}
          </p>
          <p className="text-xs text-tertiary mt-1">
            {t("onboardingSerpProgress", { processed: serpJob.processedKeywords, total: serpJob.totalKeywords })}
          </p>
        </div>
        <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-solid rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Loading state: SERP done but suggestions not loaded yet, or AI searching
  const isLoading = (serpDone && serpSuggestions === undefined) || aiSearching;

  if (isLoading && mergedSuggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />
        <p className="text-sm text-tertiary">
          {aiSearching ? t("aiSearchingCompetitors") : t("onboardingFindingSuggestions")}
        </p>
      </div>
    );
  }

  // No suggestions at all
  if (!isLoading && mergedSuggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Globe01 className="h-12 w-12 text-quaternary" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            {t("onboardingNoCompetitorSuggestions")}
          </p>
          <p className="text-xs text-tertiary mt-1 max-w-sm">
            {t("onboardingNoCompetitorSuggestionsDesc")}
          </p>
        </div>
        {!aiResults && !aiSearching && (
          <Button
            color="secondary"
            size="md"
            iconLeading={Stars01}
            onClick={handleAISearch}
            isDisabled={aiSearching}
          >
            {t("aiSearchCompetitors")}
          </Button>
        )}
        <button
          onClick={onSkip}
          className="text-sm text-tertiary hover:text-primary transition-colors"
        >
          {t("onboardingSkipForNow")}
        </button>
      </div>
    );
  }

  // Show merged suggestions
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-tertiary">
          {t("onboardingFoundCompetitors", { count: mergedSuggestions.length })}
        </p>
        {!aiResults && !aiSearching && (
          <Button
            color="secondary"
            size="sm"
            iconLeading={Stars01}
            onClick={handleAISearch}
          >
            {t("aiSearchCompetitors")}
          </Button>
        )}
        {aiSearching && (
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <div className="h-3 w-3 animate-spin rounded-full border border-brand-solid border-t-transparent" />
            {t("aiSearchingCompetitors")}
          </div>
        )}
      </div>

      {/* Competitor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {mergedSuggestions.map((suggestion) => {
          const isSelected = selectedDomains.has(suggestion.domain);
          return (
            <div
              key={suggestion.domain}
              onClick={() => toggleDomain(suggestion.domain)}
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                isSelected
                  ? "border-brand-primary bg-brand-subtle/10"
                  : "border-secondary hover:border-primary_hover"
              }`}
            >
              <Checkbox
                isSelected={isSelected}
                onChange={() => toggleDomain(suggestion.domain)}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary truncate">
                    {suggestion.domain}
                  </p>
                  {(suggestion.source === "ai" || suggestion.source === "both") && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-subtle/20 px-1.5 py-0.5 text-[10px] font-medium text-brand-primary flex-shrink-0">
                      <Stars01 className="h-3 w-3" />
                      AI
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {suggestion.keywordOverlap != null && suggestion.keywordOverlap > 0 && (
                    <Badge color="blue" size="sm">
                      {t("onboardingKeywordsCount", { count: suggestion.keywordOverlap })}
                    </Badge>
                  )}
                  {suggestion.avgPosition != null && (
                    <span className="text-xs text-tertiary">
                      avg #{Math.round(suggestion.avgPosition)}
                    </span>
                  )}
                  {suggestion.similarity != null && (
                    <Badge color={suggestion.similarity >= 7 ? "success" : suggestion.similarity >= 4 ? "warning" : "gray"} size="sm">
                      {suggestion.similarity}/10
                    </Badge>
                  )}
                </div>
                {suggestion.reason && (
                  <p className="text-xs text-quaternary mt-1.5 line-clamp-2">
                    {suggestion.reason}
                  </p>
                )}
                {suggestion.sampleKeywords && suggestion.sampleKeywords.length > 0 && !suggestion.reason && (
                  <p className="text-xs text-quaternary mt-1.5 truncate">
                    {suggestion.sampleKeywords.join(", ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-tertiary hover:text-primary transition-colors"
        >
          {t("onboardingSkipStep")}
        </button>
        <Button
          color="primary"
          size="md"
          iconTrailing={ArrowRight}
          onClick={handleAddCompetitors}
          isDisabled={selectedDomains.size === 0 || adding}
        >
          {adding
            ? t("onboardingAdding")
            : t("onboardingAddCompetitorsCount", { count: selectedDomains.size })}
        </Button>
      </div>
    </div>
  );
}
