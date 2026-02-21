"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StepIndicator } from "./StepIndicator";
import { BusinessContextStep } from "./steps/BusinessContextStep";
import { AIKeywordStep } from "./steps/AIKeywordStep";
import { KeywordDiscoveryStep } from "./steps/KeywordDiscoveryStep";
import { CompetitorDiscoveryStep } from "./steps/CompetitorDiscoveryStep";
import { AnalysisStep } from "./steps/AnalysisStep";
import { X } from "@untitledui/icons";
import { toast } from "sonner";

interface DomainSetupWizardProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function DomainSetupWizard({
  domainId,
  isOpen,
  onClose,
}: DomainSetupWizardProps) {
  const t = useTranslations('domains');
  const [currentStep, setCurrentStep] = useState(0);
  const [businessContext, setBusinessContext] = useState<{
    businessDescription: string;
    targetCustomer: string;
  }>({ businessDescription: "", targetCustomer: "" });
  const [serpJobId, setSerpJobId] = useState<Id<"keywordSerpJobs"> | null>(
    null
  );
  const [addedCompetitorIds, setAddedCompetitorIds] = useState<
    Id<"competitors">[]
  >([]);
  const [gapJobIds, setGapJobIds] = useState<
    Id<"competitorContentGapJobs">[]
  >([]);
  const [backlinkJobIds, setBacklinkJobIds] = useState<
    Id<"competitorBacklinksJobs">[]
  >([]);

  // Derive initial step from actual data so wizard resumes where user left off
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus, {
    domainId,
  });
  const domain = useQuery(api.domains.getDomain, { domainId });
  const [initialStepComputed, setInitialStepComputed] = useState(false);

  useEffect(() => {
    if (onboardingStatus && !initialStepComputed) {
      // Step mapping: 0=BusinessContext, 1=AIKeywords, 2=KeywordDiscovery, 3=Competitors, 4=Analysis
      if (onboardingStatus.steps.competitorsAdded) {
        setCurrentStep(4); // Jump to Analysis
      } else if (onboardingStatus.steps.keywordsMonitored) {
        setCurrentStep(3); // Jump to Competitors
      } else if (onboardingStatus.steps.businessContextSet) {
        setCurrentStep(1); // Jump to AI Keywords (business context done)
      }
      setInitialStepComputed(true);
    }
  }, [onboardingStatus, initialStepComputed]);

  // Pre-populate business context from domain if it exists
  useEffect(() => {
    if (domain && domain.businessDescription) {
      setBusinessContext({
        businessDescription: domain.businessDescription || "",
        targetCustomer: domain.targetCustomer || "",
      });
    }
  }, [domain]);

  const createSerpJob = useMutation(api.keywordSerpJobs.createSerpFetchJob);
  const createGapJob = useMutation(
    api.competitorContentGapJobs.createContentGapJob
  );
  const createBlJob = useMutation(
    api.competitorBacklinksJobs.createBacklinksJob
  );
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  // Step 0 complete -> save business context -> move to step 1
  const handleBusinessContextComplete = useCallback(
    (ctx: { businessDescription: string; targetCustomer: string }) => {
      setBusinessContext(ctx);
      setCurrentStep(1);
    },
    []
  );

  // Step 1 complete -> AI keywords added -> move to step 2
  const handleAIKeywordsComplete = useCallback(
    (keywordIds: Id<"keywords">[]) => {
      // AI keywords added, move to keyword discovery
      setCurrentStep(2);
    },
    []
  );

  // Step 2 complete -> auto-create SERP job -> move to step 3
  const handleKeywordsComplete = useCallback(
    async (keywordIds: Id<"keywords">[]) => {
      if (keywordIds.length > 0) {
        try {
          const jobId = await createSerpJob({ domainId, keywordIds });
          setSerpJobId(jobId);
        } catch (error: any) {
          toast.error(t('failedToStartSerp'));
          console.error(error);
          // SERP job is non-blocking — still advance to competitors step
        }
      }
      setCurrentStep(3);
    },
    [domainId, createSerpJob, t]
  );

  // Step 3 complete -> auto-create gap + backlink jobs -> move to step 4
  const handleCompetitorsComplete = useCallback(
    async (competitorIds: Id<"competitors">[]) => {
      setAddedCompetitorIds(competitorIds);

      const newGapIds: Id<"competitorContentGapJobs">[] = [];
      const newBlIds: Id<"competitorBacklinksJobs">[] = [];
      const errors: string[] = [];

      for (const competitorId of competitorIds) {
        try {
          const gapId = await createGapJob({ domainId, competitorId });
          newGapIds.push(gapId);
        } catch (error: any) {
          console.error("Failed to create gap job:", error);
          errors.push(`Content gap: ${error.message || "unknown error"}`);
        }
        try {
          const blId = await createBlJob({ domainId, competitorId });
          newBlIds.push(blId);
        } catch (error: any) {
          console.error("Failed to create backlinks job:", error);
          errors.push(`Backlinks: ${error.message || "unknown error"}`);
        }
      }

      if (errors.length > 0 && newGapIds.length === 0 && newBlIds.length === 0) {
        // All jobs failed — don't advance, show error
        toast.error(t('wizard.allJobsFailed'));
        return;
      }

      if (errors.length > 0) {
        // Partial failure — advance but warn
        toast.warning(t('wizard.someJobsFailed', { count: errors.length }));
      }

      setGapJobIds(newGapIds);
      setBacklinkJobIds(newBlIds);
      setCurrentStep(4);
    },
    [domainId, createGapJob, createBlJob, t]
  );

  // Step 4 complete -> mark onboarding done -> close
  const handleAnalysisComplete = useCallback(() => {
    onClose();
  }, [onClose]);

  // Skip handlers
  const handleSkipBusinessContext = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const handleSkipAIKeywords = useCallback(() => {
    setCurrentStep(2);
  }, []);

  const handleSkipKeywords = useCallback(() => {
    setCurrentStep(3);
  }, []);

  const handleSkipCompetitors = useCallback(() => {
    setCurrentStep(4);
  }, []);

  const handleSkipAnalysis = useCallback(async () => {
    await completeOnboarding({ domainId });
    onClose();
  }, [domainId, completeOnboarding, onClose]);

  if (!isOpen) return null;

  const steps = [
    { label: t('stepBusinessContext'), completed: currentStep > 0 },
    { label: t('stepAIKeywords'), completed: currentStep > 1 },
    { label: t('stepKeywords'), completed: currentStep > 2 },
    { label: t('stepCompetitors'), completed: currentStep > 3 },
    { label: t('stepAnalysis'), completed: false },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-primary/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Wizard container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl rounded-xl bg-primary dark:bg-[#1f2530] shadow-xl ring-1 ring-primary">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-quaternary hover:text-primary hover:bg-primary_hover transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header with step indicator */}
          <div className="border-b border-secondary px-6 py-5">
            <h2 className="text-lg font-semibold text-primary text-center mb-1">
              {t('domainSetup')}
            </h2>
            <p className="text-sm text-tertiary text-center mb-5">
              {t('letsSetUp')}
            </p>
            <StepIndicator steps={steps} currentStep={currentStep} />
          </div>

          {/* Step content */}
          <div className="px-6 py-6">
            {currentStep === 0 && (
              <BusinessContextStep
                domainId={domainId}
                onComplete={handleBusinessContextComplete}
                onSkip={handleSkipBusinessContext}
              />
            )}
            {currentStep === 1 && (
              <AIKeywordStep
                domainId={domainId}
                businessDescription={businessContext.businessDescription}
                targetCustomer={businessContext.targetCustomer}
                onComplete={handleAIKeywordsComplete}
                onSkip={handleSkipAIKeywords}
              />
            )}
            {currentStep === 2 && (
              <KeywordDiscoveryStep
                domainId={domainId}
                onComplete={handleKeywordsComplete}
                onSkip={handleSkipKeywords}
              />
            )}
            {currentStep === 3 && (
              <CompetitorDiscoveryStep
                domainId={domainId}
                serpJobId={serpJobId}
                onComplete={handleCompetitorsComplete}
                onSkip={handleSkipCompetitors}
              />
            )}
            {currentStep === 4 && (
              <AnalysisStep
                domainId={domainId}
                gapJobIds={gapJobIds}
                backlinkJobIds={backlinkJobIds}
                onComplete={handleAnalysisComplete}
                onSkip={handleSkipAnalysis}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
