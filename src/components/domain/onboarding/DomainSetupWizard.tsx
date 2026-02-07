"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StepIndicator } from "./StepIndicator";
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
  const [currentStep, setCurrentStep] = useState(0);
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
  const [initialStepComputed, setInitialStepComputed] = useState(false);

  useEffect(() => {
    if (onboardingStatus && !initialStepComputed) {
      if (onboardingStatus.steps.competitorsAdded) {
        setCurrentStep(2);
      } else if (onboardingStatus.steps.keywordsMonitored) {
        setCurrentStep(1);
      }
      setInitialStepComputed(true);
    }
  }, [onboardingStatus, initialStepComputed]);

  const createSerpJob = useMutation(api.keywordSerpJobs.createSerpFetchJob);
  const createGapJob = useMutation(
    api.competitorContentGapJobs.createContentGapJob
  );
  const createBlJob = useMutation(
    api.competitorBacklinksJobs.createBacklinksJob
  );
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  // Step 1 complete -> auto-create SERP job -> move to step 2
  const handleKeywordsComplete = useCallback(
    async (keywordIds: Id<"keywords">[]) => {
      if (keywordIds.length > 0) {
        try {
          const jobId = await createSerpJob({ domainId, keywordIds });
          setSerpJobId(jobId);
        } catch (error: any) {
          toast.error("Failed to start SERP analysis");
          console.error(error);
        }
      }
      setCurrentStep(1);
    },
    [domainId, createSerpJob]
  );

  // Step 2 complete -> auto-create gap + backlink jobs -> move to step 3
  const handleCompetitorsComplete = useCallback(
    async (competitorIds: Id<"competitors">[]) => {
      setAddedCompetitorIds(competitorIds);

      const newGapIds: Id<"competitorContentGapJobs">[] = [];
      const newBlIds: Id<"competitorBacklinksJobs">[] = [];

      for (const competitorId of competitorIds) {
        try {
          const gapId = await createGapJob({ domainId, competitorId });
          newGapIds.push(gapId);
        } catch (error: any) {
          console.error("Failed to create gap job:", error);
        }
        try {
          const blId = await createBlJob({ domainId, competitorId });
          newBlIds.push(blId);
        } catch (error: any) {
          console.error("Failed to create backlinks job:", error);
        }
      }

      setGapJobIds(newGapIds);
      setBacklinkJobIds(newBlIds);
      setCurrentStep(2);
    },
    [domainId, createGapJob, createBlJob]
  );

  // Step 3 complete -> mark onboarding done -> close
  const handleAnalysisComplete = useCallback(() => {
    onClose();
  }, [onClose]);

  // Skip handlers
  const handleSkipKeywords = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const handleSkipCompetitors = useCallback(() => {
    setCurrentStep(2);
  }, []);

  const handleSkipAnalysis = useCallback(async () => {
    await completeOnboarding({ domainId });
    onClose();
  }, [domainId, completeOnboarding, onClose]);

  if (!isOpen) return null;

  const steps = [
    { label: "Keywords", completed: currentStep > 0 },
    { label: "Competitors", completed: currentStep > 1 },
    { label: "Analysis", completed: false },
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
        <div className="relative w-full max-w-4xl rounded-xl bg-primary shadow-xl ring-1 ring-primary">
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
              Domain Setup
            </h2>
            <p className="text-sm text-tertiary text-center mb-5">
              Let&apos;s set up monitoring for your domain
            </p>
            <StepIndicator steps={steps} currentStep={currentStep} />
          </div>

          {/* Step content */}
          <div className="px-6 py-6">
            {currentStep === 0 && (
              <KeywordDiscoveryStep
                domainId={domainId}
                onComplete={handleKeywordsComplete}
                onSkip={handleSkipKeywords}
              />
            )}
            {currentStep === 1 && (
              <CompetitorDiscoveryStep
                domainId={domainId}
                serpJobId={serpJobId}
                onComplete={handleCompetitorsComplete}
                onSkip={handleSkipCompetitors}
              />
            )}
            {currentStep === 2 && (
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
