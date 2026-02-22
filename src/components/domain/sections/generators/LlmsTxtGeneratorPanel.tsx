"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CodePreview } from "./CodePreview";
import { GeneratorHistoryList } from "./GeneratorHistoryList";
import { PlatformInstructions } from "./PlatformInstructions";
import { Button } from "@/components/base/buttons/button";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface LlmsTxtGeneratorPanelProps {
  domainId: Id<"domains">;
}

export function LlmsTxtGeneratorPanel({ domainId }: LlmsTxtGeneratorPanelProps) {
  const t = useTranslations("generators");
  const [activeSubTab, setActiveSubTab] = useState<"llmsTxt" | "llmsFullTxt">("llmsTxt");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const latestShort = useQuery(api.generators.getLatestOutput, {
    domainId,
    type: "llmsTxt",
  });
  const latestFull = useQuery(api.generators.getLatestOutput, {
    domainId,
    type: "llmsFullTxt",
  });
  const historyShort = useQuery(api.generators.getGeneratorOutputs, {
    domainId,
    type: "llmsTxt",
  });

  const generateLlmsTxt = useAction(api.actions.generateLlmsTxt.generateLlmsTxt);

  const isGenerating =
    latestShort?.status === "pending" ||
    latestShort?.status === "generating" ||
    latestFull?.status === "pending" ||
    latestFull?.status === "generating";

  const handleGenerate = useCallback(async () => {
    try {
      await generateLlmsTxt({ domainId });
    } catch (err: any) {
      toast.error(err.message || t("failedToGenerateOutput"));
    }
  }, [domainId, generateLlmsTxt]);

  const latest = activeSubTab === "llmsTxt" ? latestShort : latestFull;
  const displayOutput = selectedHistoryId
    ? historyShort?.find((h) => h._id === selectedHistoryId)
    : latest;

  const hasOutput = latestShort?.status === "completed" || latestFull?.status === "completed";
  const sections = (displayOutput?.metadata as any)?.sections ?? [];
  const pagesAnalyzed = (displayOutput?.metadata as any)?.pagesAnalyzed ?? 0;

  return (
    <div className="relative rounded-xl border border-secondary bg-primary">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("llmsGeneratorTitle")}</h3>
          <p className="text-sm text-tertiary">{t("llmsGeneratorDesc")}</p>
        </div>
        <Button
          size="md"
          color="primary"
          onClick={handleGenerate}
          isDisabled={isGenerating}
        >
          {isGenerating ? t("generating") : hasOutput ? t("regenerate") : t("generateLlmsTxt")}
        </Button>
      </div>

      <div className="p-6">
        {/* Generation progress */}
        {isGenerating && (
          <div className="space-y-3 py-8 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">{t("generating")}</p>
              <p className="text-xs text-tertiary">{t("stepGenerating")}</p>
            </div>
          </div>
        )}

        {/* Failed state */}
        {displayOutput?.status === "failed" && (
          <div className="rounded-lg border border-error-300 bg-error-50 p-4 dark:border-error-800 dark:bg-error-950">
            <p className="text-sm font-medium text-error-700 dark:text-error-300">{t("generationFailed")}</p>
            <p className="mt-1 text-xs text-error-600 dark:text-error-400">{displayOutput.error}</p>
          </div>
        )}

        {/* Completed output */}
        {hasOutput && !isGenerating && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              <button
                onClick={() => { setActiveSubTab("llmsTxt"); setSelectedHistoryId(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSubTab === "llmsTxt"
                    ? "bg-primary text-primary shadow-sm"
                    : "text-tertiary hover:text-primary"
                }`}
              >
                {t("llmsTxtTab")}
              </button>
              <button
                onClick={() => { setActiveSubTab("llmsFullTxt"); setSelectedHistoryId(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSubTab === "llmsFullTxt"
                    ? "bg-primary text-primary shadow-sm"
                    : "text-tertiary hover:text-primary"
                }`}
              >
                {t("llmsFullTxtTab")}
              </button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-tertiary">{t("pagesAnalyzed", { count: pagesAnalyzed })}</span>
              </div>
              {sections.length > 0 && (
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-xs text-tertiary">
                    {t("sectionsGenerated", { count: sections.length })}
                  </span>
                </div>
              )}
            </div>

            {/* Code preview */}
            {displayOutput?.content && (
              <CodePreview
                code={displayOutput.content}
                language="markdown"
                filename={activeSubTab === "llmsTxt" ? "llms.txt" : "llms-full.txt"}
              />
            )}

            {/* Platform instructions */}
            {displayOutput?.content && (
              <PlatformInstructions
                domainId={domainId}
                outputId={displayOutput._id as Id<"generatorOutputs">}
                outputType={activeSubTab}
              />
            )}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !hasOutput && (
          <div className="py-12 text-center">
            <p className="text-sm text-tertiary">{t("notGenerated")}</p>
          </div>
        )}

        {/* History */}
        {historyShort && historyShort.length > 1 && (
          <div className="mt-6 border-t border-secondary pt-4">
            <GeneratorHistoryList
              items={historyShort.map((h) => ({
                _id: h._id,
                version: h.version,
                status: h.status,
                createdAt: h.createdAt,
                metadata: h.metadata,
              }))}
              selectedId={selectedHistoryId ?? latestShort?._id}
              onSelect={(id) => setSelectedHistoryId(id === latestShort?._id ? null : id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
