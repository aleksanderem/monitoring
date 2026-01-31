"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendUp01, TrendDown01, ArrowRight } from "@untitledui/icons";
import Link from "next/link";

interface ForecastSummaryCardProps {
  domainId: Id<"domains">;
}

export function ForecastSummaryCard({ domainId }: ForecastSummaryCardProps) {
  // Get domain visibility history to calculate projected ETV change
  const history = useQuery(api.domains.getVisibilityHistory, {
    domainId,
    days: 30,
  });

  if (history === undefined) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-primary">30-Day Forecast</h3>
        </div>
        <div className="h-24 animate-pulse bg-secondary rounded" />
      </Card>
    );
  }

  if (!history || history.length < 10) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-primary">30-Day Forecast</h3>
        </div>
        <p className="text-sm text-tertiary">Not enough data for forecasting</p>
        <p className="text-xs text-tertiary mt-1">Need at least 10 days of historical data</p>
      </Card>
    );
  }

  // Calculate simple linear trend from last 30 days
  // This is a simplified version - in production, we'd use the forecasts table
  const recentHistory = history.slice(-30);
  const etvValues = recentHistory.map((h) => h.metrics.etv || 0);
  const currentEtv = etvValues[etvValues.length - 1];
  const firstEtv = etvValues[0];
  const etvChange = currentEtv - firstEtv;
  const avgDailyChange = etvChange / recentHistory.length;
  const projected30DayChange = avgDailyChange * 30;

  // Determine trend
  let trend: "up" | "down" | "stable";
  let variant: "default" | "destructive" | "secondary";
  let icon;

  if (projected30DayChange > 100) {
    trend = "up";
    variant = "default";
    icon = <TrendUp01 className="h-5 w-5" />;
  } else if (projected30DayChange < -100) {
    trend = "down";
    variant = "destructive";
    icon = <TrendDown01 className="h-5 w-5" />;
  } else {
    trend = "stable";
    variant = "secondary";
    icon = <ArrowRight className="h-5 w-5" />;
  }

  // Simple confidence based on variance
  const mean = etvValues.reduce((sum, v) => sum + v, 0) / etvValues.length;
  const variance =
    etvValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / etvValues.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  let confidenceLevel: "high" | "medium" | "low";
  if (coefficientOfVariation < 0.2) {
    confidenceLevel = "high";
  } else if (coefficientOfVariation < 0.5) {
    confidenceLevel = "medium";
  } else {
    confidenceLevel = "low";
  }

  return (
    <Link href={`/domains/${domainId}/insights`}>
      <Card className="p-6 hover:border-primary-600 transition-colors cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-primary">30-Day Forecast</h3>
          <Badge variant={variant}>{confidenceLevel} confidence</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg p-2.5 ${
              trend === "up"
                ? "bg-utility-success-50 text-utility-success-600"
                : trend === "down"
                ? "bg-utility-error-50 text-utility-error-600"
                : "bg-utility-gray-50 text-utility-gray-600"
            }`}
          >
            {icon}
          </div>

          <div className="flex-1">
            <div className="text-2xl font-semibold text-primary">
              {projected30DayChange > 0 ? "+" : ""}
              {Math.round(projected30DayChange)}
            </div>
            <div className="text-xs text-tertiary">Projected ETV change</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-secondary">
          <p className="text-xs text-tertiary">
            Based on {recentHistory.length}-day trend analysis
          </p>
        </div>
      </Card>
    </Link>
  );
}
