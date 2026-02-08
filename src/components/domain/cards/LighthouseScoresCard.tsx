"use client";

import { useTranslations } from "next-intl";

interface LighthouseScoresCardProps {
  scores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
}

export function LighthouseScoresCard({ scores }: LighthouseScoresCardProps) {
  const t = useTranslations('onsite');
  if (!scores) {
    return (
      <div className="bg-primary rounded-lg border border-secondary p-6">
        <h3 className="text-md font-semibold text-primary mb-4">
          {t('lighthouseScores')}
        </h3>
        <p className="text-sm text-tertiary">
          {t('noLighthouseData')}
        </p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-utility-success-600";
    if (score >= 50) return "text-utility-warning-600";
    return "text-utility-error-600";
  };

  const getRingColor = (score: number) => {
    if (score >= 90) return "stroke-utility-success-500";
    if (score >= 50) return "stroke-utility-warning-500";
    return "stroke-utility-error-500";
  };

  const categories = [
    { name: t('categoryPerformance'), key: "performance" as const },
    { name: t('categoryAccessibility'), key: "accessibility" as const },
    { name: t('categoryBestPractices'), key: "bestPractices" as const },
    { name: t('categorySeo'), key: "seo" as const },
  ];

  return (
    <div className="flex flex-col bg-primary rounded-lg border border-secondary p-6">
      <h3 className="text-md font-semibold text-primary mb-6">
        {t('lighthouseScores')}
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((category) => {
          const score = scores[category.key];
          const radius = 40;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (score / 100) * circumference;

          return (
            <div key={category.key} className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-3">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-quaternary opacity-40"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={getRingColor(score)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                    {score}
                  </span>
                </div>
              </div>

              <div className="text-xs text-tertiary">{category.name}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-secondary">
        <p className="text-xs font-medium text-tertiary mb-2">{t('statusGuide')}</p>
        <div className="flex flex-wrap gap-4 text-xs text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-utility-success-500" />
            {t('statusGood')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-utility-warning-500" />
            {t('statusNeedsImprovement')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-utility-error-500" />
            {t('statusPoor')}
          </span>
        </div>
      </div>
    </div>
  );
}
