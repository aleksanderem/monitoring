"use client";

import { useState, useMemo } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { AIKeywordIdea } from "../../../../../convex/actions/aiKeywordResearch";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { ArrowRight, Stars01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface AIKeywordStepProps {
  domainId: Id<"domains">;
  businessDescription: string;
  targetCustomer: string;
  onComplete: (keywordIds: Id<"keywords">[]) => void;
  onSkip: () => void;
}

export function AIKeywordStep({
  domainId,
  businessDescription,
  targetCustomer,
  onComplete,
  onSkip,
}: AIKeywordStepProps) {
  const t = useTranslations("domains");
  const [keywords, setKeywords] = useState<AIKeywordIdea[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusType, setFocusType] = useState<
    "all" | "informational" | "commercial" | "transactional"
  >("all");
  const [keywordCount, setKeywordCount] = useState(20);

  const generateKeywordIdeas = useAction(
    api.actions.aiKeywordResearch.generateKeywordIdeas
  );
  const addKeywords = useMutation(api.keywords.addKeywords);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateKeywordIdeas({
        domainId,
        businessDescription,
        targetCustomer,
        keywordCount,
        focusType,
      });

      if (result.success && result.keywords) {
        setKeywords(result.keywords);
        setGenerated(true);
        // Auto-select all by default
        setSelectedIds(
          new Set(result.keywords.map((_, idx) => idx))
        );
      } else {
        setError(result.error || t("aiKeywordsError"));
      }
    } catch (err) {
      console.error("Failed to generate keywords:", err);
      setError(t("aiKeywordsError"));
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelected = (idx: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === keywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keywords.map((_, idx) => idx)));
    }
  };

  const selectedKeywords = useMemo(
    () => keywords.filter((_, idx) => selectedIds.has(idx)),
    [keywords, selectedIds]
  );

  const handleAddAndContinue = async () => {
    if (selectedKeywords.length === 0) return;
    setAdding(true);
    try {
      const phrases = selectedKeywords.map((k) => k.keyword);
      const addedIds = await addKeywords({ domainId, phrases, source: "ai" });
      onComplete(addedIds as Id<"keywords">[]);
    } catch (err) {
      console.error("Failed to add keywords:", err);
      toast.error(t("aiKeywordsError"));
    } finally {
      setAdding(false);
    }
  };

  const intentColor = (intent: string) => {
    switch (intent) {
      case "informational":
        return "blue";
      case "commercial":
        return "purple";
      case "transactional":
        return "success";
      case "navigational":
        return "gray";
      default:
        return "gray";
    }
  };

  // Pre-generation state: show controls + generate button
  if (!generated) {
    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-base font-semibold text-primary">
            {t("aiKeywordsTitle")}
          </h3>
          <p className="text-sm text-tertiary mt-1">
            {t("aiKeywordsDescription")}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tertiary">
              {t("focusTypeLabel")}
            </label>
            <select
              className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm text-primary dark:bg-gray-900 dark:border-gray-700"
              value={focusType}
              onChange={(e) => setFocusType(e.target.value as typeof focusType)}
            >
              <option value="all">{t("focusTypeAll")}</option>
              <option value="informational">
                {t("focusTypeInformational")}
              </option>
              <option value="commercial">{t("focusTypeCommercial")}</option>
              <option value="transactional">
                {t("focusTypeTransactional")}
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-tertiary">
              {t("keywordCountLabel")}
            </label>
            <select
              className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm text-primary dark:bg-gray-900 dark:border-gray-700"
              value={keywordCount}
              onChange={(e) => setKeywordCount(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
        </div>

        {/* Generate button */}
        <div className="flex justify-center">
          <Button
            color="primary"
            size="lg"
            iconLeading={Stars01}
            onClick={handleGenerate}
            isDisabled={generating}
          >
            {generating ? t("generatingKeywords") : t("generateKeywords")}
          </Button>
        </div>

        {generating && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />
            <p className="text-sm text-tertiary">{t("generatingKeywords")}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-error-primary text-center">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onSkip}
            className="text-sm text-tertiary hover:text-primary transition-colors"
          >
            {t("onboardingSkipStep")}
          </button>
          <div />
        </div>
      </div>
    );
  }

  // Post-generation: show keyword results
  if (keywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Stars01 className="h-12 w-12 text-quaternary" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            {t("noAIKeywordsGenerated")}
          </p>
        </div>
        <Button color="secondary" size="md" onClick={() => setGenerated(false)}>
          {t("tryAgain")}
        </Button>
        <button
          onClick={onSkip}
          className="text-sm text-tertiary hover:text-primary transition-colors"
        >
          {t("onboardingSkipStep")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-primary">
          {t("aiKeywordsTitle")}
        </h3>
        <Badge color="gray" size="md">
          {t("onboardingSelectedCount", { count: selectedIds.size })}
        </Badge>
      </div>

      {/* Keywords table */}
      <div className="rounded-lg border border-secondary overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-secondary/50 sticky top-0">
            <tr>
              <th className="px-3 py-2.5 text-left w-8">
                <Checkbox
                  isSelected={
                    keywords.length > 0 &&
                    selectedIds.size === keywords.length
                  }
                  isIndeterminate={
                    selectedIds.size > 0 &&
                    selectedIds.size < keywords.length
                  }
                  onChange={selectAll}
                  size="sm"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-tertiary">
                {t("aiKeywordColKeyword")}
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                {t("aiKeywordColIntent")}
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                {t("aiKeywordColVolume")}
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                {t("aiKeywordColRelevance")}
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-tertiary">
                {t("aiKeywordColCategory")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {keywords.map((kw, idx) => (
              <tr
                key={idx}
                className="hover:bg-primary_hover transition-colors cursor-pointer"
                onClick={() => toggleSelected(idx)}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    isSelected={selectedIds.has(idx)}
                    onChange={() => toggleSelected(idx)}
                    size="sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <span className="text-sm font-medium text-primary">
                    {kw.keyword}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge color={intentColor(kw.searchIntent)} size="sm">
                    {kw.searchIntent}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center text-sm text-primary">
                  {kw.searchVolume?.toLocaleString() || "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge
                    color={
                      kw.relevanceScore >= 8
                        ? "success"
                        : kw.relevanceScore >= 5
                        ? "warning"
                        : "gray"
                    }
                    size="sm"
                  >
                    {kw.relevanceScore}/10
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-tertiary">{kw.category}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          onClick={handleAddAndContinue}
          isDisabled={selectedIds.size === 0 || adding}
        >
          {adding
            ? t("addingKeywords")
            : t("addSelectedAndContinue")}
        </Button>
      </div>
    </div>
  );
}
