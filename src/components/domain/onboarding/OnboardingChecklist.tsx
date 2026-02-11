"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import {
  Check,
  X,
  Target04,
  Globe01,
  BarChart03,
} from "@untitledui/icons";

interface OnboardingChecklistProps {
  domainId: Id<"domains">;
  onOpenWizard: () => void;
}

interface ChecklistStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
  actionLabel?: string;
}

export function OnboardingChecklist({
  domainId,
  onOpenWizard,
}: OnboardingChecklistProps) {
  const t = useTranslations('domains');
  const status = useQuery(api.onboarding.getOnboardingStatus, { domainId });
  const dismissOnboarding = useMutation(api.onboarding.dismissOnboarding);

  if (!status) return null;
  if (status.isCompleted || status.isDismissed) return null;

  const steps: ChecklistStep[] = [
    {
      key: "keywords",
      label: t('addKeywordsToMonitor'),
      description: `${status.counts.monitoredKeywords} keywords monitored`,
      completed: status.steps.keywordsMonitored,
      icon: Target04,
    },
    {
      key: "competitors",
      label: t('addCompetitors'),
      description: `${status.counts.activeCompetitors} competitors tracked`,
      completed: status.steps.competitorsAdded,
      icon: Globe01,
    },
    {
      key: "analysis",
      label: t('runCompetitiveAnalysis'),
      description: `${status.counts.contentGaps} opportunities found`,
      completed: status.steps.analysisComplete,
      icon: BarChart03,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  // All steps done -> auto-complete
  if (completedCount === steps.length) return null;

  const handleDismiss = async () => {
    await dismissOnboarding({ domainId });
  };

  return (
    <div className="rounded-xl border border-utility-blue-200 bg-utility-blue-50 p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-primary">
              {t('completeYourSetup')}
            </h3>
            <span className="text-xs text-tertiary">
              {completedCount}/{steps.length} {t('steps')}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-utility-blue-200 rounded-full overflow-hidden mb-3 max-w-xs">
            <div
              className="h-full bg-utility-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Steps */}
          <div className="flex flex-wrap gap-3">
            {steps
              .filter((s) => !s.completed)
              .map((step) => (
                <button
                  key={step.key}
                  onClick={onOpenWizard}
                  className="flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary hover:bg-primary_hover transition-colors"
                >
                  <step.icon className="h-4 w-4 text-utility-blue-600" />
                  <span>{step.label}</span>
                </button>
              ))}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-quaternary hover:text-primary hover:bg-primary_hover transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
