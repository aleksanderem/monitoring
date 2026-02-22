"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportSessionProgress } from "./ReportSessionProgress";

const REPORT_TYPES = [
  { value: "executive-summary", labelKey: "reportTypeExecutive" },
  { value: "detailed-keyword", labelKey: "reportTypeKeyword" },
  { value: "competitor-analysis", labelKey: "reportTypeCompetitor" },
  { value: "progress-report", labelKey: "reportTypeProgress" },
] as const;

const DATE_RANGES = [
  { days: 7, labelKey: "reportLast7" },
  { days: 14, labelKey: "reportLast14" },
  { days: 30, labelKey: "reportLast30" },
  { days: 90, labelKey: "reportLast90" },
] as const;

interface ReportGenerationWizardProps {
  domainId: Id<"domains">;
}

export function ReportGenerationWizard({ domainId }: ReportGenerationWizardProps) {
  const t = useTranslations("domains");
  const createSession = useMutation(api.aiReports.createReportSession);

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<Id<"aiReportSessions"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedType || !selectedDays) return;

    setIsGenerating(true);
    try {
      const now = Date.now();
      const sessionId = await createSession({
        domainId,
        reportType: selectedType,
        config: {
          dateRange: {
            start: now - selectedDays * 24 * 60 * 60 * 1000,
            end: now,
          },
          sections: ["overview", "keywords", "competitors", "recommendations"],
        },
      });
      setActiveSessionId(sessionId);
    } catch {
      // Error handling - reset state
      setIsGenerating(false);
    }
  };

  if (activeSessionId) {
    return <ReportSessionProgress sessionId={activeSessionId} />;
  }

  return (
    <Card className="p-6">
      {/* Step indicators */}
      <div className="mb-6 flex items-center gap-4">
        <StepIndicator number={1} active={step === 1} completed={step > 1} label={t("reportSelectType")} />
        <StepIndicator number={2} active={step === 2} completed={step > 2} label={t("reportConfigureRange")} />
        <StepIndicator number={3} active={step === 3} completed={false} label={t("reportReview")} />
      </div>

      {/* Step 1: Select report type */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary">{t("reportSelectType")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setSelectedType(type.value);
                  setStep(2);
                }}
                className={`rounded-lg border p-4 text-left transition-colors hover:border-brand-500 ${
                  selectedType === type.value
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                    : "border-primary"
                }`}
              >
                <span className="text-sm font-medium text-primary">
                  {t(type.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Configure date range */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary">{t("reportConfigureRange")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {DATE_RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => {
                  setSelectedDays(range.days);
                  setStep(3);
                }}
                className={`rounded-lg border p-4 text-left transition-colors hover:border-brand-500 ${
                  selectedDays === range.days
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                    : "border-primary"
                }`}
              >
                <span className="text-sm font-medium text-primary">
                  {t(range.labelKey)}
                </span>
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setStep(1)}>
            {t("back")}
          </Button>
        </div>
      )}

      {/* Step 3: Review and generate */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary">{t("reportReview")}</h3>
          <div className="space-y-2 text-sm text-secondary">
            <p>
              <span className="font-medium">{t("reportType")}:</span>{" "}
              {selectedType && t(REPORT_TYPES.find((rt) => rt.value === selectedType)?.labelKey ?? "reportTypeExecutive")}
            </p>
            <p>
              <span className="font-medium">{t("reportDateRange")}:</span>{" "}
              {selectedDays && t(DATE_RANGES.find((dr) => dr.days === selectedDays)?.labelKey ?? "reportLast30")}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(2)}>
              {t("back")}
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {t("reportGenerate")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StepIndicator({
  number,
  active,
  completed,
  label,
}: {
  number: number;
  active: boolean;
  completed: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
          completed
            ? "bg-brand-500 text-white"
            : active
              ? "border-2 border-brand-500 text-brand-500"
              : "border border-secondary text-tertiary"
        }`}
      >
        {completed ? "✓" : number}
      </div>
      <span className={`hidden text-sm sm:inline ${active ? "font-medium text-primary" : "text-tertiary"}`}>
        {label}
      </span>
    </div>
  );
}
