"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { WelcomeStep } from "./WelcomeStep";
import { OrgSetupStep } from "./OrgSetupStep";
import { FirstDomainStep } from "./FirstDomainStep";
import { GscOnboardingStep } from "./GscOnboardingStep";

type Step = "welcome" | "orgSetup" | "firstDomain" | "gscConnect";

export function FirstTimeFlow() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDomainId, setCreatedDomainId] = useState<Id<"domains"> | null>(null);

  const userOrgs = useQuery(api.organizations.getUserOrganizations);
  const completeOnboarding = useMutation(api.onboarding.completeUserOnboarding);
  const updateOrganization = useMutation(api.organizations.updateOrganization);
  const createDomain = useMutation(api.domains.createDomain);

  const activeOrg = userOrgs?.[0];

  // Resolve org -> team -> project chain for domain creation
  const teams = useQuery(
    api.teams.getTeams,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );
  const firstTeam = teams?.[0];
  const projects = useQuery(
    api.projects.getProjects,
    firstTeam ? { teamId: firstTeam._id } : "skip"
  );
  const firstProject = projects?.[0];

  const stepNumber =
    currentStep === "welcome" ? 1 :
    currentStep === "orgSetup" ? 2 :
    currentStep === "firstDomain" ? 3 : 4;
  const totalSteps = 4;

  const handleFinish = async () => {
    await completeOnboarding();
    router.push(createdDomainId ? `/domains/${createdDomainId}` : "/domains");
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.push("/domains");
  };

  const handleOrgNext = async (orgName: string) => {
    if (activeOrg && orgName !== activeOrg.name) {
      await updateOrganization({
        organizationId: activeOrg._id,
        name: orgName,
      });
    }
    setCurrentStep("firstDomain");
  };

  const handleDomainSubmit = async (domainUrl: string) => {
    if (!activeOrg || !firstProject) return;

    setIsSubmitting(true);
    try {
      const domainId = await createDomain({
        projectId: firstProject._id,
        domain: domainUrl.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
        settings: {
          refreshFrequency: "weekly",
          searchEngine: "google",
          location: "Poland",
          language: "pl",
        },
      });

      setCreatedDomainId(domainId);
      setIsSubmitting(false);
      // After domain creation, show GSC connect step
      setCurrentStep("gscConnect");
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-primary rounded-2xl shadow-xl border border-primary p-8">
        {/* Step indicator */}
        <div className="text-center text-sm text-tertiary mb-6">
          {t("stepOf", { current: stepNumber, total: totalSteps })}
        </div>

        {currentStep === "welcome" && (
          <WelcomeStep
            onNext={() => setCurrentStep("orgSetup")}
            onSkip={handleSkip}
          />
        )}

        {currentStep === "orgSetup" && (
          <OrgSetupStep
            initialOrgName={activeOrg?.name ?? ""}
            onNext={handleOrgNext}
            onBack={() => setCurrentStep("welcome")}
            onSkip={handleSkip}
          />
        )}

        {currentStep === "firstDomain" && (
          <FirstDomainStep
            onSubmit={handleDomainSubmit}
            onBack={() => setCurrentStep("orgSetup")}
            onSkip={handleSkip}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === "gscConnect" && activeOrg && (
          <GscOnboardingStep
            organizationId={activeOrg._id}
            onComplete={handleFinish}
            onSkip={handleFinish}
          />
        )}
      </div>
    </div>
  );
}
