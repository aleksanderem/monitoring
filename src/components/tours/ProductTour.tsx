"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TourStep } from "./TourStep";
import type { TourStepDef } from "./tourDefinitions";

interface ProductTourProps {
  tourId: string;
  steps: TourStepDef[];
  /** If true, auto-start on mount when tour is not yet completed/dismissed. */
  autoStart?: boolean;
}

export function ProductTour({ tourId, steps, autoStart = true }: ProductTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const progress = useQuery(api.tours.getTourProgress, { tourId });
  const startTourMut = useMutation(api.tours.startTour);
  const completeStepMut = useMutation(api.tours.completeStep);
  const completeTourMut = useMutation(api.tours.completeTour);
  const dismissTourMut = useMutation(api.tours.dismissTour);

  // Auto-start logic: show tour if not completed and not dismissed
  useEffect(() => {
    if (!autoStart) return;
    if (progress === undefined) return; // still loading
    if (progress === null) {
      // Never started — start it
      setIsActive(true);
      startTourMut({ tourId });
      return;
    }
    if (!progress.isCompleted && !progress.dismissedAt) {
      // Resume from last completed step
      const lastCompleted = progress.completedSteps.length;
      setCurrentStepIndex(Math.min(lastCompleted, steps.length - 1));
      setIsActive(true);
    }
  }, [progress, autoStart, tourId, startTourMut, steps.length]);

  const handleNext = useCallback(async () => {
    const step = steps[currentStepIndex];
    if (step) {
      await completeStepMut({ tourId, stepId: step.id });
    }

    if (currentStepIndex >= steps.length - 1) {
      // Last step — complete tour
      await completeTourMut({ tourId });
      setIsActive(false);
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, steps, tourId, completeStepMut, completeTourMut]);

  const handlePrev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleSkip = useCallback(async () => {
    await dismissTourMut({ tourId });
    setIsActive(false);
  }, [tourId, dismissTourMut]);

  const handleClose = useCallback(async () => {
    await dismissTourMut({ tourId });
    setIsActive(false);
  }, [tourId, dismissTourMut]);

  if (!isActive || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  if (!currentStep) return null;

  return (
    <TourStep
      step={currentStep}
      currentIndex={currentStepIndex}
      totalSteps={steps.length}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkip={handleSkip}
      onClose={handleClose}
    />
  );
}
