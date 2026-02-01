"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/base/cards/card";
import { Badge } from "@/components/base/badges/badges";
import { ArrowUp, ArrowDown } from "@untitledui/icons";

interface SERPFeaturesSectionProps {
  domainId: Id<"domains">;
  days?: number;
}

const FEATURE_LABELS: Record<string, string> = {
  featuredSnippet: "Featured Snippet",
  peopleAlsoAsk: "People Also Ask",
  imagePack: "Image Pack",
  videoPack: "Video Pack",
  localPack: "Local Pack",
  knowledgeGraph: "Knowledge Graph",
  sitelinks: "Sitelinks",
  topStories: "Top Stories",
  relatedSearches: "Related Searches",
};

export function SERPFeaturesSection({
  domainId,
  days = 30,
}: SERPFeaturesSectionProps) {
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
          <h3 className="mb-2 text-lg font-semibold">SERP Features</h3>
          <p className="text-sm text-gray-500">
            No SERP features data available yet. Features will be tracked during keyword
            position checks.
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
      count: summary.featureCounts[feature as keyof typeof summary.featureCounts],
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const topFeature = sortedFeatures[0];

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SERP Features Overview</h3>
          <p className="text-sm text-gray-500">Last {days} days</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {summary.totalKeywords} Keywords Tracked
          </p>
          <p className="text-xs text-gray-500">
            {summary.totalDataPoints} data points analyzed
          </p>
        </div>
      </div>

      {topFeature && topFeature.percentage > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Most Common Feature</p>
              <p className="text-lg font-bold text-blue-700">
                {FEATURE_LABELS[topFeature.feature]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {Math.round(topFeature.percentage)}%
              </p>
              <p className="text-xs text-blue-600">
                {topFeature.count} of {summary.totalKeywords} keywords
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
                  {FEATURE_LABELS[feature]}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    color={isHigh ? "green" : isMedium ? "blue" : "gray"}
                    size="sm"
                  >
                    {Math.round(percentage)}%
                  </Badge>
                  <span className="text-xs text-gray-500">{count} keywords</span>
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
          SERP features are special elements that appear in Google search results, such as
          featured snippets, image packs, and local results. Tracking these helps identify
          opportunities to appear in enhanced search results.
        </p>
      </div>
    </Card>
  );
}
