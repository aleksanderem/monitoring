"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { TrendUp01, TrendDown01, ArrowRight } from "@untitledui/icons";

interface PredictionBadgeProps {
  keywordId: Id<"keywords">;
  currentPosition: number | null;
}

export function PredictionBadge({ keywordId, currentPosition }: PredictionBadgeProps) {
  // Get forecast for this keyword
  const forecast = useQuery(api.forecasts_queries.getForecast, {
    entityType: "keyword",
    entityId: keywordId,
    metric: "position",
  });

  // Don't show badge if no forecast or no current position
  if (!forecast || !currentPosition || forecast.predictions.length === 0) {
    return null;
  }

  // Get prediction for 30 days from now
  const prediction = forecast.predictions[forecast.predictions.length - 1];
  const predictedPosition = Math.round(prediction.value);
  const positionChange = currentPosition - predictedPosition; // Negative means improving (lower position number)

  // Determine trend
  let variant: "default" | "destructive" | "secondary";
  let icon;
  let label: string;

  if (positionChange < -5) {
    // Worsening (position number increasing)
    variant = "destructive";
    icon = <TrendDown01 className="h-3 w-3" />;
    label = "Trending Down";
  } else if (positionChange > 5) {
    // Improving (position number decreasing)
    variant = "default";
    icon = <TrendUp01 className="h-3 w-3" />;
    label = "Trending Up";
  } else {
    // Stable (within ±5 positions)
    variant = "secondary";
    icon = <ArrowRight className="h-3 w-3" />;
    label = "Stable";
  }

  // Format confidence level
  const confidenceLabel =
    forecast.accuracy.confidenceLevel === "high"
      ? "High confidence"
      : forecast.accuracy.confidenceLevel === "medium"
      ? "Medium confidence"
      : "Low confidence";

  // Build tooltip content
  const tooltipContent = `Position Forecast\nCurrent: #${currentPosition}\nPredicted (30d): #${predictedPosition}\nChange: ${positionChange > 0 ? "+" : ""}${positionChange.toFixed(0)} positions\n${confidenceLabel} (R² = ${forecast.accuracy.r2.toFixed(2)})`;

  return (
    <Tooltip title={tooltipContent} placement="top">
      <TooltipTrigger>
        <Badge variant={variant} className="flex items-center gap-1">
          {icon}
          <span className="text-xs">{label}</span>
        </Badge>
      </TooltipTrigger>
    </Tooltip>
  );
}
