"use client";

import { useQuery } from "convex/react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ContentGapBubbleChartProps {
  domainId: Id<"domains">;
}

function opportunityColor(score: number): string {
  if (score >= 70) return "#10b981"; // green – high opportunity
  if (score >= 40) return "#f59e0b"; // orange – medium
  return "#ef4444"; // red – low
}

function CustomTooltip({ active, payload, t }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-secondary bg-primary px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-primary">{data.phrase}</p>
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-tertiary">
          {t("tooltipDifficultyTitle")}:{" "}
          <span className="font-medium text-primary">{data.difficulty}</span>
        </p>
        <p className="text-xs text-tertiary">
          {t("tooltipVolumeTitle")}:{" "}
          <span className="font-medium text-primary">
            {data.searchVolume?.toLocaleString()}
          </span>
        </p>
        <p className="text-xs text-tertiary">
          {t("contentGapBubbleCompetitors")}:{" "}
          <span className="font-medium text-primary">
            {data.competitorCount}
          </span>
        </p>
        <p className="text-xs text-tertiary">
          {t("tooltipScoreTitle")}:{" "}
          <span className="font-medium text-primary">
            {data.opportunityScore}
          </span>
        </p>
      </div>
    </div>
  );
}

export function ContentGapBubbleChart({
  domainId,
}: ContentGapBubbleChartProps) {
  const t = useTranslations("competitors");
  const gaps = useQuery(api.contentGaps_queries.getContentGaps, {
    domainId,
    filters: { status: "identified" },
  });

  if (gaps === undefined) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        <div className="mt-4 h-[350px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
      </div>
    );
  }

  // Transform content gap data into bubble chart points
  // Group by keyword to count how many competitors rank for each
  const keywordMap = new Map<
    string,
    {
      phrase: string;
      difficulty: number;
      searchVolume: number;
      competitorCount: number;
      opportunityScore: number;
    }
  >();

  const gapItems = gaps ?? [];
  for (const gap of gapItems) {
    const existing = keywordMap.get(gap.keywordPhrase);
    if (existing) {
      existing.competitorCount++;
      existing.opportunityScore = Math.max(
        existing.opportunityScore,
        gap.opportunityScore
      );
    } else {
      keywordMap.set(gap.keywordPhrase, {
        phrase: gap.keywordPhrase,
        difficulty: gap.difficulty,
        searchVolume: gap.searchVolume,
        competitorCount: 1,
        opportunityScore: gap.opportunityScore,
      });
    }
  }

  const bubbleData = Array.from(keywordMap.values());

  if (bubbleData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary bg-secondary/50 p-12">
        <p className="text-sm font-medium text-tertiary">
          {t("chartNoData")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">
          {t("contentGapBubbleTitle")}
        </h3>
        <p className="text-sm text-tertiary">
          {t("contentGapBubbleDescription")}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
          <span className="text-xs text-tertiary">
            {t("contentGapBubbleHighOpp")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
          <span className="text-xs text-tertiary">
            {t("contentGapBubbleMedOpp")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
          <span className="text-xs text-tertiary">
            {t("contentGapBubbleLowOpp")}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis
            type="number"
            dataKey="difficulty"
            name={t("tooltipDifficultyTitle")}
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{
              value: t("tooltipDifficultyTitle"),
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 11 },
            }}
          />
          <YAxis
            type="number"
            dataKey="searchVolume"
            name={t("tooltipVolumeTitle")}
            scale="log"
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            label={{
              value: t("tooltipVolumeTitle"),
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11 },
            }}
          />
          <ZAxis
            type="number"
            dataKey="competitorCount"
            range={[40, 400]}
          />
          <Tooltip content={<CustomTooltip t={t} />} />
          <Scatter data={bubbleData} fillOpacity={0.7}>
            {bubbleData.map((entry, index) => (
              <Cell
                key={index}
                fill={opportunityColor(entry.opportunityScore)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
