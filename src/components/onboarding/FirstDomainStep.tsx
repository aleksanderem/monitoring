"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FirstDomainStepProps {
  onSubmit: (domainUrl: string) => void;
  onBack: () => void;
  onSkip: () => void;
  isSubmitting: boolean;
}

export function FirstDomainStep({
  onSubmit,
  onBack,
  onSkip,
  isSubmitting,
}: FirstDomainStepProps) {
  const t = useTranslations("onboarding");
  const [domainUrl, setDomainUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainUrl.trim()) return;
    onSubmit(domainUrl.trim());
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">
          {t("firstDomain.heading")}
        </h1>
        <p className="text-secondary mt-2">{t("firstDomain.description")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="domainUrl">{t("firstDomain.urlLabel")}</Label>
          <Input
            id="domainUrl"
            value={domainUrl}
            onChange={(e) => setDomainUrl(e.target.value)}
            placeholder={t("firstDomain.urlPlaceholder")}
            required
          />
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!domainUrl.trim() || isSubmitting}
          >
            {isSubmitting ? "..." : t("firstDomain.cta")}
          </Button>
          <div className="flex justify-between">
            <Button
              onClick={onBack}
              variant="ghost"
              size="sm"
              type="button"
              disabled={isSubmitting}
            >
              {t("back")}
            </Button>
            <Button
              onClick={onSkip}
              variant="ghost"
              size="sm"
              type="button"
              disabled={isSubmitting}
            >
              {t("skip")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
