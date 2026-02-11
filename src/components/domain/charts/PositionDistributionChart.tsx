"use client";

import { useQuery } from "convex/react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, PolarRadiusAxis } from "recharts";
import { BarChart04 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface PositionDistributionChartProps {
  domainId: Id<"domains">;
}

export function PositionDistributionChart({ domainId }: PositionDistributionChartProps) {
  const t = useTranslations('keywords');
  const radarColor = "#f97316"; // orange
  const distribution = useQuery(api.keywords.getPositionDistribution, { domainId });

  if (distribution === undefined) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-[300px] animate-pulse rounded bg-gray-50" />
      </div>
    );
  }

  const chartData = [
    { range: "Top 3", keywords: distribution.top3 },
    { range: "4-10", keywords: distribution.pos4_10 },
    { range: "11-20", keywords: distribution.pos11_20 },
    { range: "21-50", keywords: distribution.pos21_50 },
    { range: "51-100", keywords: distribution.pos51_100 },
    { range: "100+", keywords: distribution.pos100plus },
  ];

  if (chartData.every((d) => d.keywords === 0)) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">{t('currentPositionDistribution')}</h3>
          <p className="text-sm text-tertiary">{t('positionDistributionDescription')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <BarChart04 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">{t('noPositionDataAvailable')}</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    keywords: {
      label: t('keywordsLabel'),
      color: radarColor,
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">{t('currentPositionDistribution')}</h3>
        <p className="text-sm text-tertiary">{t('positionDistributionDescription')}</p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <RadarChart data={chartData}>
          <PolarGrid strokeDasharray="3 3" opacity={0.3} />
          <PolarAngleAxis dataKey="range" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, "auto"]} tick={{ fontSize: 10 }} />
          <ChartTooltip
            content={<ChartTooltipContent />}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <Radar
            name={t('keywordsLabel')}
            dataKey="keywords"
            stroke={radarColor}
            fill={radarColor}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <ChartLegend content={<ChartLegendContent payload={[]} />} />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}
