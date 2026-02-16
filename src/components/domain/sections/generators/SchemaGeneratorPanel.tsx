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

interface SchemaGeneratorPanelProps {
  domainId: Id<"domains">;
}

export function SchemaGeneratorPanel({ domainId }: SchemaGeneratorPanelProps) {
  const t = useTranslations("generators");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const latest = useQuery(api.generators.getLatestOutput, {
    domainId,
    type: "jsonSchema",
  });
  const history = useQuery(api.generators.getGeneratorOutputs, {
    domainId,
    type: "jsonSchema",
  });

  const generateSchema = useAction(api.actions.generateSchema.generateJsonSchema);

  const isGenerating = latest?.status === "pending" || latest?.status === "generating";

  const handleGenerate = useCallback(async () => {
    try {
      await generateSchema({ domainId });
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    }
  }, [domainId, generateSchema]);

  // Determine which output to display
  const displayOutput = selectedHistoryId
    ? history?.find((h) => h._id === selectedHistoryId)
    : latest;

  const schemaTypes = (displayOutput?.metadata as any)?.schemaTypes ?? [];
  const schemasGenerated = (displayOutput?.metadata as any)?.schemasGenerated ?? 0;
  const pagesAnalyzed = (displayOutput?.metadata as any)?.pagesAnalyzed ?? 0;

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("schemaGeneratorTitle")}</h3>
          <p className="text-sm text-tertiary">{t("schemaGeneratorDesc")}</p>
        </div>
        <Button
          size="md"
          color="primary"
          onClick={handleGenerate}
          isDisabled={isGenerating}
        >
          {isGenerating ? t("generating") : displayOutput?.content ? t("regenerate") : t("generateSchema")}
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
        {displayOutput?.status === "completed" && displayOutput.content && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-tertiary">{t("pagesAnalyzed", { count: pagesAnalyzed })}</span>
              </div>
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-tertiary">{t("schemasGenerated", { count: schemasGenerated })}</span>
              </div>
              {schemaTypes.length > 0 && (
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-xs text-tertiary">
                    {t("schemaTypes")}: {schemaTypes.join(", ")}
                  </span>
                </div>
              )}
            </div>

            {/* Code preview */}
            <CodePreview
              code={displayOutput.content}
              language="json"
              filename="schema.json"
            />

            {/* Platform instructions */}
            <PlatformInstructions
              domainId={domainId}
              outputId={displayOutput._id as Id<"generatorOutputs">}
              outputType="jsonSchema"
            />
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !displayOutput && (
          <div className="py-12 text-center">
            <p className="text-sm text-tertiary">{t("notGenerated")}</p>
          </div>
        )}

        {/* History sidebar */}
        {history && history.length > 1 && (
          <div className="mt-6 border-t border-secondary pt-4">
            <GeneratorHistoryList
              items={history.map((h) => ({
                _id: h._id,
                version: h.version,
                status: h.status,
                createdAt: h.createdAt,
                metadata: h.metadata,
              }))}
              selectedId={selectedHistoryId ?? latest?._id}
              onSelect={(id) => setSelectedHistoryId(id === latest?._id ? null : id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
