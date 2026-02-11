"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/base/badges/badges";
import { ArrowUp, ArrowDown } from "@untitledui/icons";
import { useTranslations } from "next-intl";

interface SERPFeaturesSectionProps {
  domainId: Id<"domains">;
  days?: number;
}

const FEATURE_LABEL_KEYS: Record<string, string> = {
  featuredSnippet: "serpFeatureLabelFeaturedSnippetSimple",
  peopleAlsoAsk: "serpFeatureLabelPeopleAlsoAskSimple",
  imagePack: "serpFeatureLabelImagePackSimple",
  videoPack: "serpFeatureLabelVideoPackSimple",
  localPack: "serpFeatureLabelLocalPackSimple",
  knowledgeGraph: "serpFeatureLabelKnowledgeGraphSimple",
  sitelinks: "serpFeatureLabelSitelinksSimple",
  topStories: "serpFeatureLabelTopStoriesSimple",
  relatedSearches: "serpFeatureLabelRelatedSearchesSimple",
};

export function SERPFeaturesSection({
  domainId,
  days = 30,
}: SERPFeaturesSectionProps) {
  const t = useTranslations("keywords");
  const summary = useQuery(api.serpFeatures_queries.getSerpFeaturesSummary, {
    domainId,
    days,
  });

  if (summary === undefined) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-gray-200" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (summary.totalDataPoints === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">{t("serpFeatures")}</h3>
          <p className="text-sm text-gray-500">
            {t("noSerpFeaturesDataAvailable")}
          </p>
        </div>
      </Card>
    );
  }

  // Sort features by percentage (descending)
  const sortedFeatures = Object.entries(summary.featurePercentages)
    .map(([feature, percentage]) => ({
      feature,
      percentage,
      count: summary.featureCounts?.[feature as keyof typeof summary.featureCounts] || 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const topFeature = sortedFeatures[0];

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t("serpFeaturesOverview")}</h3>
          <p className="text-sm text-gray-500">{t("lastNDays", { days })}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {t("serpKeywordsTracked", { count: summary.totalKeywords })}
          </p>
          <p className="text-xs text-gray-500">
            {t("serpDataPointsAnalyzed", { count: summary.totalDataPoints })}
          </p>
        </div>
      </div>

      {topFeature && topFeature.percentage > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">{t("mostCommonFeature")}</p>
              <p className="text-lg font-bold text-blue-700">
                {t(FEATURE_LABEL_KEYS[topFeature.feature] as any)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {Math.round(topFeature.percentage)}%
              </p>
              <p className="text-xs text-blue-600">
                {t("serpFeatureCountOfTotal", { count: topFeature.count, total: summary.totalKeywords })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {sortedFeatures.map(({ feature, percentage, count }) => {
          const isHigh = percentage > 50;
          const isMedium = percentage > 20 && percentage <= 50;

          return (
            <div
              key={feature}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {t(FEATURE_LABEL_KEYS[feature] as any)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge size="sm">
                    {Math.round(percentage)}%
                  </Badge>
                  <span className="text-xs text-gray-500">{t("serpFeatureKeywordsCount", { count })}</span>
                </div>
              </div>
              {percentage > 0 && (
                <div className="flex items-center">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-lg bg-gray-50 p-4">
        <p className="text-xs text-gray-600">
          {t("serpFeaturesExplanation")}
        </p>
      </div>
    </Card>
  );
}
