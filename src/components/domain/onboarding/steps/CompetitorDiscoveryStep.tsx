"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Globe01, ArrowRight } from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface CompetitorDiscoveryStepProps {
  domainId: Id<"domains">;
  serpJobId: Id<"keywordSerpJobs"> | null;
  onComplete: (competitorIds: Id<"competitors">[]) => void;
  onSkip: () => void;
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

  // Reactive: auto-updates when job status changes
  const serpJob = useQuery(
    api.keywordSerpJobs.getJob,
    serpJobId ? { jobId: serpJobId } : "skip"
  );

  const serpDone =
    !serpJobId || serpJob?.status === "completed" || serpJob?.status === "failed";

  // Once SERP is done, get competitor suggestions
  const suggestions = useQuery(
    api.competitors.getCompetitorSuggestionsFromSerp,
    serpDone ? { domainId } : "skip"
  );

  const addCompetitor = useMutation(api.competitors.addCompetitor);

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
        // Skip already-tracked competitors
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
        {/* Progress bar */}
        <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-solid rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // SERP failed
  if (serpJob?.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Globe01 className="h-12 w-12 text-utility-error-500" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            {t("onboardingSerpError")}
          </p>
          <p className="text-xs text-tertiary mt-1">
            {serpJob.error || t("onboardingUnexpectedError")}
          </p>
        </div>
        <Button color="secondary" size="md" onClick={onSkip}>
          {t("onboardingSkipAddCompetitorsLater")}
        </Button>
      </div>
    );
  }

  // No suggestions
  if (suggestions && suggestions.length === 0) {
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
        <Button color="secondary" size="md" onClick={onSkip}>
          {t("onboardingSkipForNow")}
        </Button>
      </div>
    );
  }

  // Loading suggestions
  if (!suggestions) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />
        <p className="text-sm text-tertiary">
          {t("onboardingFindingSuggestions")}
        </p>
      </div>
    );
  }

  // Show suggestions
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tertiary">
        {t("onboardingFoundCompetitors", { count: suggestions.length })}
      </p>

      {/* Competitor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {suggestions.map((suggestion) => {
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
                <p className="text-sm font-medium text-primary truncate">
                  {suggestion.domain}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color="blue" size="sm">
                    {t("onboardingKeywordsCount", { count: suggestion.keywordOverlap })}
                  </Badge>
                  <span className="text-xs text-tertiary">
                    avg #{Math.round(suggestion.avgPosition)}
                  </span>
                </div>
                {suggestion.sampleKeywords.length > 0 && (
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
