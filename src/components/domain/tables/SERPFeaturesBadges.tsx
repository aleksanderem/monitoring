"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/base/tooltip/tooltip";
import { Sparkles, Image, Video, MapPin, Info } from "@untitledui/icons";

interface SERPFeaturesBadgesProps {
  keywordId: Id<"keywords">;
}

const FEATURE_CONFIG: Record<
  string,
  { label: string; color: "blue" | "green" | "purple" | "red" | "orange" | "cyan" | "gray"; icon: React.ElementType }
> = {
  featuredSnippet: { label: "Featured", color: "blue", icon: Sparkles },
  peopleAlsoAsk: { label: "PAA", color: "green", icon: Info },
  imagePack: { label: "Images", color: "purple", icon: Image },
  videoPack: { label: "Videos", color: "red", icon: Video },
  localPack: { label: "Local", color: "orange", icon: MapPin },
  knowledgeGraph: { label: "KG", color: "cyan", icon: Info },
  sitelinks: { label: "Sitelinks", color: "gray", icon: Info },
  topStories: { label: "Top Stories", color: "gray", icon: Info },
  relatedSearches: { label: "Related", color: "gray", icon: Info },
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

  // Get all active features
  const activeFeatures = Object.entries(currentFeatures.features)
    .filter(([, isActive]) => isActive === true)
    .map(([feature]) => feature);

  if (activeFeatures.length === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  // Show first badge + count of others
  const firstFeature = activeFeatures[0];
  const remainingCount = activeFeatures.length - 1;
  const config = FEATURE_CONFIG[firstFeature];

  const allFeaturesText = activeFeatures
    .map((f) => FEATURE_CONFIG[f]?.label || f)
    .join(", ");

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
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
          <TooltipContent>
            <div className="space-y-1">
              <p className="text-xs font-medium">SERP Features Present:</p>
              <p className="text-xs text-gray-600">{allFeaturesText}</p>
              <p className="text-xs text-gray-500">
                Last checked: {new Date(currentFeatures.fetchedAt).toLocaleDateString()}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
