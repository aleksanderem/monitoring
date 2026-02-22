"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { Stars01, Image01, VideoRecorder, MarkerPin01, InfoCircle } from "@untitledui/icons";

interface SERPFeaturesBadgesProps {
  keywordId: Id<"keywords">;
}

const FEATURE_CONFIG: Record<
  string,
  { label: string; color: "blue" | "green" | "purple" | "red" | "orange" | "cyan" | "gray"; icon: React.ElementType }
> = {
  featuredSnippet: { label: "Featured", color: "blue", icon: Stars01 },
  peopleAlsoAsk: { label: "PAA", color: "green", icon: InfoCircle },
  imagePack: { label: "Images", color: "purple", icon: Image01 },
  videoPack: { label: "Videos", color: "red", icon: VideoRecorder },
  localPack: { label: "Local", color: "orange", icon: MarkerPin01 },
  knowledgeGraph: { label: "KG", color: "cyan", icon: InfoCircle },
  sitelinks: { label: "Sitelinks", color: "gray", icon: InfoCircle },
  topStories: { label: "Top Stories", color: "gray", icon: InfoCircle },
  relatedSearches: { label: "Related", color: "gray", icon: InfoCircle },
};

export function SERPFeaturesBadges({ keywordId }: SERPFeaturesBadgesProps) {
  const currentFeatures = useQuery(
    api.serpFeatures_queries.getCurrentSerpFeatures,
    { keywordId }
  );

  if (currentFeatures === undefined) {
    return (
      <div className="flex items-center gap-1">
        <div className="h-5 w-12 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!currentFeatures || !currentFeatures.features) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const activeFeatures = Object.entries(currentFeatures.features)
    .filter(([, isActive]) => isActive === true)
    .map(([feature]) => feature);

  if (activeFeatures.length === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const firstFeature = activeFeatures[0];
  const remainingCount = activeFeatures.length - 1;
  const config = FEATURE_CONFIG[firstFeature];

  const allFeaturesText = activeFeatures
    .map((f) => FEATURE_CONFIG[f]?.label || f)
    .join(", ");

  return (
    <div className="flex items-center gap-1">
      <Tooltip
        title={`SERP Features: ${allFeaturesText}`}
        description={`Last checked: ${new Date(currentFeatures.fetchedAt).toLocaleDateString()}`}
      >
        <TooltipTrigger>
          <div className="flex items-center gap-1">
            <Badge color={config?.color || "gray"} size="sm">
              <div className="flex items-center gap-1">
                {config && <config.icon className="h-3 w-3" />}
                <span className="text-xs">{config?.label || firstFeature}</span>
              </div>
            </Badge>
            {remainingCount > 0 && (
              <Badge color="gray" size="sm">
                <span className="text-xs">+{remainingCount}</span>
              </Badge>
            )}
          </div>
        </TooltipTrigger>
      </Tooltip>
    </div>
  );
}
