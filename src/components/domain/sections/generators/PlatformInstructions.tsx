"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "shoper", label: "platformShoper" },
  { id: "wordpress", label: "platformWordpress" },
  { id: "woocommerce", label: "platformWoocommerce" },
  { id: "shopify", label: "platformShopify" },
  { id: "prestashop", label: "platformPrestashop" },
  { id: "custom", label: "platformCustom" },
] as const;

type Platform = (typeof PLATFORMS)[number]["id"];

interface PlatformInstructionsProps {
  domainId: Id<"domains">;
  outputId: Id<"generatorOutputs">;
  outputType: "jsonSchema" | "llmsTxt" | "llmsFullTxt";
}

export function PlatformInstructions({
  domainId,
  outputId,
  outputType,
}: PlatformInstructionsProps) {
  const t = useTranslations("generators");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [instructions, setInstructions] = useState<{
    snippet: string;
    steps: string[];
    verification: string;
    pitfalls: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInstructions = useAction(api.actions.generatePlatformInstructions.generatePlatformInstructions);

  const handlePlatformSelect = useCallback(
    async (platform: Platform) => {
      setSelectedPlatform(platform);
      setInstructions(null);
      setLoading(true);
      try {
        const result = await generateInstructions({
          domainId,
          outputId,
          platform,
          outputType,
        });
        setInstructions(result);
      } catch (err: any) {
        toast.error(err.message || t("failedToGenerateInstructions"));
      } finally {
        setLoading(false);
      }
    },
    [domainId, outputId, outputType, generateInstructions]
  );

  const handleCopySnippet = useCallback(async () => {
    if (instructions?.snippet) {
      await navigator.clipboard.writeText(instructions.snippet);
      toast.success(t("copied"));
    }
  }, [instructions, t]);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-primary">{t("platformInstructions")}</h4>

      {/* Platform selector */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePlatformSelect(p.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              selectedPlatform === p.id
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "border-secondary text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {t(p.label)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <div className="size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          {t("loadingInstructions")}
        </div>
      )}

      {/* Instructions display */}
      {instructions && !loading && (
        <div className="space-y-4 rounded-lg border border-secondary bg-secondary/30 p-4">
          {/* Snippet */}
          {instructions.snippet && (
            <div>
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                  {t("codeSnippet")}
                </h5>
                <button
                  onClick={handleCopySnippet}
                  className="text-xs text-brand-500 hover:text-brand-600"
                >
                  {t("copyToClipboard")}
                </button>
              </div>
              <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-primary p-3">
                <code className="whitespace-pre-wrap break-words font-mono text-xs text-primary">
                  {instructions.snippet}
                </code>
              </pre>
            </div>
          )}

          {/* Steps */}
          {instructions.steps?.length > 0 && (
            <div>
              <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                {t("implementationSteps")}
              </h5>
              <ol className="mt-2 space-y-2">
                {instructions.steps.map((step: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-secondary">
                    <span className="shrink-0 font-medium text-brand-500">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Verification */}
          {instructions.verification && (
            <div>
              <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                {t("verification")}
              </h5>
              <p className="mt-1 text-sm text-secondary">{instructions.verification}</p>
            </div>
          )}

          {/* Pitfalls */}
          {instructions.pitfalls?.length > 0 && (
            <div>
              <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                {t("commonPitfalls")}
              </h5>
              <ul className="mt-1 space-y-1">
                {instructions.pitfalls.map((p: string, i: number) => (
                  <li key={i} className="text-sm text-warning-600 dark:text-warning-400">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
