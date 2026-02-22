"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  const t = useTranslations("onboarding");

  const features = [
    { key: "positioning" as const, emoji: "📊" },
    { key: "competitors" as const, emoji: "🔍" },
    { key: "audit" as const, emoji: "🛠" },
    { key: "strategy" as const, emoji: "🤖" },
  ];

  return (
    <div className="text-center space-y-6">
      <h1 className="text-3xl font-bold text-primary">
        {t("welcome.heading")}
      </h1>
      <p className="text-secondary max-w-md mx-auto">
        {t("welcome.description")}
      </p>

      <div className="grid gap-3 text-left max-w-md mx-auto">
        {features.map((feature) => (
          <div
            key={feature.key}
            className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
          >
            <span className="text-lg">{feature.emoji}</span>
            <span className="text-sm text-primary">
              {t(`welcome.features.${feature.key}`)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <Button onClick={onNext} size="lg" className="w-full">
          {t("welcome.cta")}
        </Button>
        <Button onClick={onSkip} variant="ghost" size="sm">
          {t("skip")}
        </Button>
      </div>
    </div>
  );
}
