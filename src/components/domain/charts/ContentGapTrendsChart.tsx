"use client";

import { useQuery } from "convex/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { HelpCircle } from "@untitledui/icons";
import { Tooltip as InfoTooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GradientChartTooltip } from "@/components/application/charts/charts-base";
import { formatNumber } from "@/lib/formatting";

interface ContentGapTrendsChartProps {
    domainId: Id<"domains">;
}

export function ContentGapTrendsChart({ domainId }: ContentGapTrendsChartProps) {
    const t = useTranslations('competitors');
    const trends = useQuery(api.contentGaps_queries.getGapTrends, { domainId, days: 90 });

    if (trends === undefined) {
        return (
            <div className="relative rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700 mb-4" />
                <div className="h-[220px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!trends || trends.length === 0) {
        return (
            <div className="relative rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-primary">{t('gapTrendsTitle')}</h3>
                    <InfoTooltip title={t('gapTrendsTitle')} description="Shows how the number of content gap opportunities changes over time. Track whether new gaps appear faster than you can address them.">
                        <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                            <HelpCircle className="size-4" />
                        </TooltipTrigger>
                    </InfoTooltip>
                </div>
                <p className="text-sm text-tertiary mb-4">{t('gapTrendsSubtitle')}</p>
                <div className="flex h-[180px] items-center justify-center">
                    <p className="text-sm text-tertiary">{t('gapTrendsEmpty')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <div className="flex items-center gap-2">
                <h3 className="text-md font-semibold text-primary">{t('gapTrendsTitle')}</h3>
                <InfoTooltip title={t('gapTrendsTitle')} description="Shows how the number of content gap opportunities changes over time. Track whether new gaps appear faster than you can address them.">
                    <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                        <HelpCircle className="size-4" />
                    </TooltipTrigger>
                </InfoTooltip>
            </div>
            <p className="text-sm text-tertiary mb-4">{t('gapTrendsSubtitle')}</p>
            <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            content={<GradientChartTooltip />}
                            formatter={(value: any, name: any) => [
                                name === "estimatedValue" ? formatNumber(value) : value,
                                name === "totalGaps" ? t('gapTrendsTotalGaps') :
                                name === "highPriorityGaps" ? t('gapTrendsHighPriority') :
                                name === "estimatedValue" ? t('gapTrendsEstValue') : name,
                            ]}
                            labelFormatter={(label: any) => `Date: ${label}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="totalGaps" name={t('gapTrendsTotalGaps')} stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="highPriorityGaps" name={t('gapTrendsHighPriority')} stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
