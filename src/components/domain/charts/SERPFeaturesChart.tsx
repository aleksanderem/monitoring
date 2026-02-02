"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface SERPFeaturesChartProps {
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

const chartConfig = {
  featuredSnippet: {
    label: "Featured Snippet",
    color: "#3b82f6", // blue
  },
  peopleAlsoAsk: {
    label: "People Also Ask",
    color: "#10b981", // green
  },
  imagePack: {
    label: "Image Pack",
    color: "#8b5cf6", // purple
  },
  videoPack: {
    label: "Video Pack",
    color: "#ef4444", // red
  },
  localPack: {
    label: "Local Pack",
    color: "#f59e0b", // orange
  },
  knowledgeGraph: {
    label: "Knowledge Graph",
    color: "#06b6d4", // cyan
  },
  sitelinks: {
    label: "Sitelinks",
    color: "#ec4899", // pink
  },
  topStories: {
    label: "Top Stories",
    color: "#14b8a6", // teal
  },
  relatedSearches: {
    label: "Related Searches",
    color: "#64748b", // slate
  },
} satisfies ChartConfig;

export function SERPFeaturesChart({
  domainId,
  days = 30,
}: SERPFeaturesChartProps) {
  const summary = useQuery(api.serpFeatures_queries.getSerpFeaturesSummary, {
    domainId,
    days,
  });

  if (summary === undefined) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="animate-pulse text-sm text-gray-500">
          Loading SERP features...
        </div>
      </div>
    );
  }

  if (summary.totalDataPoints === 0) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-2">
        <p className="text-sm text-gray-500">No SERP features data yet</p>
        <p className="text-xs text-gray-400">
          SERP features will appear here after keyword position checks
        </p>
      </div>
    );
  }

  // Transform data for chart
  const chartData = Object.entries(summary.featurePercentages).map(
    ([feature, percentage]) => ({
      feature: FEATURE_LABELS[feature] || feature,
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
      fill: `var(--color-${feature})`,
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SERP Features Presence</h3>
          <p className="text-sm text-gray-500">
            Percentage of keywords showing each feature
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {summary.totalKeywords} keywords tracked
          </p>
          <p className="text-xs text-gray-400">
            {summary.totalDataPoints} data points
          </p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="feature"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis
              label={{ value: "% of Keywords", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: any) => `${value}%`}
                  labelFormatter={(label: any) => `${label}`}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar
              dataKey="percentage"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              name="Presence %"
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="grid grid-cols-3 gap-3 pt-2">
        {Object.entries(summary.featureCounts || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([feature, count]) => (
            <div
              key={feature}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span className="text-xs font-medium text-gray-700">
                {FEATURE_LABELS[feature]}
              </span>
              <span className="text-xs font-bold text-gray-900">{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
