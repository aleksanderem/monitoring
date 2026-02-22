"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrgSetupStepProps {
  initialOrgName: string;
  onNext: (orgName: string) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function OrgSetupStep({
  initialOrgName,
  onNext,
  onBack,
  onSkip,
}: OrgSetupStepProps) {
  const t = useTranslations("onboarding");
  const [orgName, setOrgName] = useState(initialOrgName);
  const [industry, setIndustry] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(orgName.trim() || initialOrgName);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">
          {t("orgSetup.heading")}
        </h1>
        <p className="text-secondary mt-2">{t("orgSetup.description")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="orgName">{t("orgSetup.nameLabel")}</Label>
          <Input
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder={t("orgSetup.namePlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">{t("orgSetup.industryLabel")}</Label>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder={t("orgSetup.industryPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button type="submit" size="lg" className="w-full">
            {t("orgSetup.cta")}
          </Button>
          <div className="flex justify-between">
            <Button type="button" onClick={onBack} variant="ghost" size="sm">
              {t("back")}
            </Button>
            <Button type="button" onClick={onSkip} variant="ghost" size="sm">
              {t("skip")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
