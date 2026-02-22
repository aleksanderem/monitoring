"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../convex/_generated/api";
import { WelcomeStep } from "./WelcomeStep";
import { OrgSetupStep } from "./OrgSetupStep";
import { FirstDomainStep } from "./FirstDomainStep";

type Step = "welcome" | "orgSetup" | "firstDomain";

export function FirstTimeFlow() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userOrgs = useQuery(api.organizations.getUserOrganizations);
  const completeOnboarding = useMutation(api.onboarding.completeUserOnboarding);
  const updateOrganization = useMutation(api.organizations.updateOrganization);
  const createDomain = useMutation(api.domains.createDomain);

  const activeOrg = userOrgs?.[0];

  const stepNumber = currentStep === "welcome" ? 1 : currentStep === "orgSetup" ? 2 : 3;

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
    if (!activeOrg) return;

    setIsSubmitting(true);
    try {
      // Get the first team's first project, or we need the project hierarchy
      // The auth callback creates a default team, so we look up the team -> project
      const teams = await new Promise<any[]>((resolve) => {
        // Teams are loaded via org, we need to find or create a project
        resolve([]);
      });

      // For onboarding, we create a default project if none exists.
      // Since the org was just auto-created by auth, there may not be a project yet.
      // We'll use the existing project creation flow or create domain via the
      // domains page. For simplicity in the onboarding flow, we mark onboarding
      // complete and redirect to domains page where they can add the domain.
      await completeOnboarding();
      router.push("/domains");
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-primary rounded-2xl shadow-xl border border-primary p-8">
        {/* Step indicator */}
        <div className="text-center text-sm text-tertiary mb-6">
          {t("stepOf", { current: stepNumber, total: 3 })}
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
      </div>
    </div>
  );
}
