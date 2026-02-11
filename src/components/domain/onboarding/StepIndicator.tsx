"use client";

import { Check } from "@untitledui/icons";

interface Step {
  label: string;
  completed: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 0-indexed
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = step.completed || idx < currentStep;

        return (
          <div key={idx} className="flex items-center">
            {/* Connector line before (skip first) */}
            {idx > 0 && (
              <div
                className={`h-0.5 w-12 ${
                  isCompleted || isActive
                    ? "bg-brand-solid"
                    : "bg-secondary"
                }`}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isCompleted
                    ? "bg-brand-solid text-fg-white"
                    : isActive
                    ? "bg-brand-solid text-fg-white ring-4 ring-brand-subtle"
                    : "bg-secondary text-tertiary"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? "text-brand-primary"
                    : isCompleted
                    ? "text-primary"
                    : "text-quaternary"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
