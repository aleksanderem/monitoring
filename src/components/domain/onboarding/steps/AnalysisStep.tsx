"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import {
  CheckCircle,
  BarChart03,
  Link03,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";

interface AnalysisStepProps {
  domainId: Id<"domains">;
  gapJobIds: Id<"competitorContentGapJobs">[];
  backlinkJobIds: Id<"competitorBacklinksJobs">[];
  onComplete: () => void;
  onSkip: () => void;
}

export function AnalysisStep({
  domainId,
  gapJobIds,
  backlinkJobIds,
  onComplete,
  onSkip,
}: AnalysisStepProps) {
  const t = useTranslations("domains");
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  // Reactively poll each job — Convex auto-updates when status changes
  const gapJob0 = useQuery(
    api.competitorContentGapJobs.getJob,
    gapJobIds[0] ? { jobId: gapJobIds[0] } : "skip"
  );
  const gapJob1 = useQuery(
    api.competitorContentGapJobs.getJob,
    gapJobIds[1] ? { jobId: gapJobIds[1] } : "skip"
  );
  const gapJob2 = useQuery(
    api.competitorContentGapJobs.getJob,
    gapJobIds[2] ? { jobId: gapJobIds[2] } : "skip"
  );

  const blJob0 = useQuery(
    api.competitorBacklinksJobs.getJob,
    backlinkJobIds[0] ? { jobId: backlinkJobIds[0] } : "skip"
  );
  const blJob1 = useQuery(
    api.competitorBacklinksJobs.getJob,
    backlinkJobIds[1] ? { jobId: backlinkJobIds[1] } : "skip"
  );
  const blJob2 = useQuery(
    api.competitorBacklinksJobs.getJob,
    backlinkJobIds[2] ? { jobId: backlinkJobIds[2] } : "skip"
  );

  const gapJobs = [gapJob0, gapJob1, gapJob2].filter(Boolean);
  const blJobs = [blJob0, blJob1, blJob2].filter(Boolean);

  // Check if all jobs are done
  const allGapsDone =
    gapJobIds.length === 0 ||
    gapJobs.every(
      (j) => j?.status === "completed" || j?.status === "failed"
    );
  const allBlDone =
    backlinkJobIds.length === 0 ||
    blJobs.every(
      (j) => j?.status === "completed" || j?.status === "failed"
    );
  const allDone = allGapsDone && allBlDone;

  // Count results
  const gapOpportunities = gapJobs.reduce(
    (sum, j) => sum + (j?.opportunitiesFound || 0),
    0
  );
  const backlinkResults = blJobs.reduce(
    (sum, j) => sum + (j?.backlinksFound || 0),
    0
  );

  // Get onboarding status for counts
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus, {
    domainId,
  });

  const handleComplete = async () => {
    await completeOnboarding({ domainId });
    onComplete();
  };

  // No jobs were created (skipped competitor step)
  if (gapJobIds.length === 0 && backlinkJobIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <CheckCircle className="h-16 w-16 text-utility-success-500" />
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">
            {t("onboardingSetupComplete")}
          </p>
          <p className="text-sm text-tertiary mt-1 max-w-md">
            {t("onboardingSetupCompleteDesc")}
          </p>
        </div>
        <Button color="primary" size="lg" onClick={handleComplete}>
          {t("onboardingGoToDashboard")}
        </Button>
      </div>
    );
  }

  // Jobs still running
  if (!allDone) {
    const totalJobs = gapJobIds.length + backlinkJobIds.length;
    const completedJobs =
      gapJobs.filter(
        (j) => j?.status === "completed" || j?.status === "failed"
      ).length +
      blJobs.filter(
        (j) => j?.status === "completed" || j?.status === "failed"
      ).length;
    const progress =
      totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="h-12 w-12 animate-spin rounded-full border-3 border-brand-solid border-t-transparent" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            {t("onboardingAnalyzingCompetitorData")}
          </p>
          <p className="text-xs text-tertiary mt-1">
            {t("onboardingAnalysesCompleted", { completed: completedJobs, total: totalJobs })}
          </p>
        </div>
        {/* Progress bar */}
        <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-solid rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          onClick={onSkip}
          className="text-sm text-tertiary hover:text-primary transition-colors"
        >
          {t("onboardingSkipToDashboard")}
        </button>
      </div>
    );
  }

  // All done — show summary
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-8">
      <CheckCircle className="h-16 w-16 text-utility-success-500" />
      <div className="text-center">
        <p className="text-lg font-semibold text-primary">
          {t("onboardingDomainFullySetup")}
        </p>
        <p className="text-sm text-tertiary mt-1">
          {t("onboardingSummaryOfFindings")}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <div className="rounded-lg border border-secondary bg-secondary/30 p-5 text-center">
          <BarChart03 className="h-8 w-8 text-brand-secondary mx-auto mb-2" />
          <p className="text-2xl font-bold text-primary">
            {gapOpportunities}
          </p>
          <p className="text-xs text-tertiary mt-1">
            {t("onboardingContentGapOpportunities")}
          </p>
        </div>
        <div className="rounded-lg border border-secondary bg-secondary/30 p-5 text-center">
          <Link03 className="h-8 w-8 text-brand-secondary mx-auto mb-2" />
          <p className="text-2xl font-bold text-primary">
            {backlinkResults}
          </p>
          <p className="text-xs text-tertiary mt-1">
            {t("onboardingCompetitorBacklinksAnalyzed")}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      {onboardingStatus && (
        <div className="flex items-center gap-4 text-sm text-tertiary">
          <Badge color="blue" size="md">
            {t("onboardingKeywordsMonitored", { count: onboardingStatus.counts.monitoredKeywords })}
          </Badge>
          <Badge color="blue" size="md">
            {t("onboardingCompetitorsTracked", { count: onboardingStatus.counts.activeCompetitors })}
          </Badge>
        </div>
      )}

      <Button color="primary" size="lg" onClick={handleComplete}>
        Go to Dashboard
      </Button>
    </div>
  );
}
