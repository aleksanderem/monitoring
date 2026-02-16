"use client";

import { useQuery } from "convex/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { HelpCircle } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { Tooltip as InfoTooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CompetitorGapComparisonCardProps {
    domainId: Id<"domains">;
}

export function CompetitorGapComparisonCard({ domainId }: CompetitorGapComparisonCardProps) {
    const t = useTranslations('competitors');
    const comparison = useQuery(api.contentGaps_queries.getCompetitorGapComparison, { domainId });

    if (comparison === undefined) {
        return (
            <div className="rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700 mb-4" />
                <div className="h-[200px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!comparison || comparison.length === 0) {
        return (
            <div className="rounded-xl border border-secondary bg-primary p-6">
                <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-primary">{t('gapComparisonTitle')}</h3>
                    <InfoTooltip title={t('gapComparisonTitle')} description={t('gapComparisonTooltip')}>
                        <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                            <HelpCircle className="size-4" />
                        </TooltipTrigger>
                    </InfoTooltip>
                </div>
                <p className="text-sm text-tertiary mb-4">{t('gapComparisonSubtitle')}</p>
                <div className="flex h-32 items-center justify-center">
                    <p className="text-sm text-tertiary">{t('gapComparisonEmpty')}</p>
                </div>
            </div>
        );
    }

    const chartData = comparison.map((c) => ({
        name: c.competitorDomain.replace(/^www\./, "").slice(0, 20),
        totalGaps: c.totalGaps,
        highPriority: c.highPriorityGaps,
        avgScore: Math.round(c.avgOpportunityScore),
    }));

    return (
        <div className="rounded-xl border border-secondary bg-primary p-6">
            <div className="flex items-center gap-2">
                <h3 className="text-md font-semibold text-primary">{t('gapComparisonTitle')}</h3>
                <InfoTooltip title={t('gapComparisonTitle')} description={t('gapComparisonTooltip')}>
                    <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                        <HelpCircle className="size-4" />
                    </TooltipTrigger>
                </InfoTooltip>
            </div>
            <p className="text-sm text-tertiary mb-4">{t('gapComparisonDistribution')}</p>
            {chartData.length <= 6 ? (
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                            <Tooltip
                                formatter={(value: any, name: any) => [
                                    value,
                                    name === "totalGaps" ? t('gapComparisonTotalGaps') :
                                    name === "highPriority" ? t('gapComparisonHighPriority') : name,
                                ]}
                            />
                            <Bar dataKey="totalGaps" name={t('gapComparisonTotalGaps')} fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="highPriority" name={t('gapComparisonHighPriority')} fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="space-y-2">
                    {chartData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between rounded-lg border border-secondary p-3">
                            <span className="text-sm font-medium text-primary">{item.name}</span>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-primary">{item.totalGaps}</span>
                                    <span className="text-xs text-tertiary">{t('gapComparisonGaps')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-utility-error-600">{item.highPriority}</span>
                                    <span className="text-xs text-tertiary">{t('gapComparisonHigh')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-tertiary">{t('gapComparisonAvgScore')}</span>
                                    <span className="text-sm font-medium text-brand-secondary">{item.avgScore}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
