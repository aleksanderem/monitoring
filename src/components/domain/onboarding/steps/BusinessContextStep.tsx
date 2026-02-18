"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { ArrowRight, Stars01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface BusinessContextStepProps {
  domainId: Id<"domains">;
  onComplete: (ctx: {
    businessDescription: string;
    targetCustomer: string;
  }) => void;
  onSkip: () => void;
}

export function BusinessContextStep({
  domainId,
  onComplete,
  onSkip,
}: BusinessContextStepProps) {
  const t = useTranslations("domains");
  const [businessDescription, setBusinessDescription] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const domain = useQuery(api.domains.getDomain, { domainId });
  const generateContext = useAction(api.actions.aiBusinessContext.generateBusinessContext);
  const saveContext = useMutation(api.domains.saveBusinessContextPublic);

  // Pre-populate from existing domain data
  useEffect(() => {
    if (domain) {
      if (domain.businessDescription) setBusinessDescription(domain.businessDescription);
      if (domain.targetCustomer) setTargetCustomer(domain.targetCustomer);
    }
  }, [domain]);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateContext({ domainId });
      if (result.businessDescription) {
        setBusinessDescription(result.businessDescription);
      }
      if (result.targetCustomer) {
        setTargetCustomer(result.targetCustomer);
      }
      if (result.businessDescription || result.targetCustomer) {
        toast.success(t("autoGenerateSuccess"));
      } else {
        toast.error(t("autoGenerateFailed"));
      }
    } catch (error) {
      console.error("Auto-generate failed:", error);
      toast.error(t("autoGenerateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      if (businessDescription.trim() || targetCustomer.trim()) {
        await saveContext({
          domainId,
          businessDescription: businessDescription.trim(),
          targetCustomer: targetCustomer.trim(),
        });
      }
      onComplete({
        businessDescription: businessDescription.trim(),
        targetCustomer: targetCustomer.trim(),
      });
    } catch (error) {
      console.error("Failed to save business context:", error);
      // Still proceed even if save fails
      onComplete({
        businessDescription: businessDescription.trim(),
        targetCustomer: targetCustomer.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-base font-semibold text-primary">
          {t("businessContextTitle")}
        </h3>
        <p className="text-sm text-tertiary mt-1">
          {t("businessContextDescription")}
        </p>
      </div>

      {/* Auto-generate button */}
      <div className="flex justify-center">
        <Button
          color="secondary"
          size="md"
          iconLeading={Stars01}
          onClick={handleAutoGenerate}
          isDisabled={generating}
        >
          {generating ? t("autoGenerating") : t("autoGenerateAI")}
        </Button>
      </div>

      {/* Business Description textarea */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-primary">
          {t("businessDescriptionLabel")}
        </label>
        <textarea
          className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-solid focus:border-transparent resize-none dark:bg-gray-900 dark:border-gray-700"
          rows={4}
          placeholder={t("businessDescriptionPlaceholder")}
          value={businessDescription}
          onChange={(e) => setBusinessDescription(e.target.value)}
          disabled={generating}
        />
      </div>

      {/* Target Customer textarea */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-primary">
          {t("targetCustomerLabel")}
        </label>
        <textarea
          className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-solid focus:border-transparent resize-none dark:bg-gray-900 dark:border-gray-700"
          rows={3}
          placeholder={t("targetCustomerPlaceholder")}
          value={targetCustomer}
          onChange={(e) => setTargetCustomer(e.target.value)}
          disabled={generating}
        />
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
          onClick={handleContinue}
          isDisabled={saving || generating}
        >
          {saving ? t("onboardingAdding") : t("onboardingContinue")}
        </Button>
      </div>
    </div>
  );
}
