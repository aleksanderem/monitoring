"use client";

import { useQuery } from "convex/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface DifficultyDistributionChartProps {
    domainId: Id<"domains">;
}

const TIER_CONFIG = [
    { key: "easy", labelKey: "difficultyEasy", color: "#22c55e" },
    { key: "medium", labelKey: "difficultyMedium", color: "#f59e0b" },
    { key: "hard", labelKey: "difficultyHard", color: "#f97316" },
    { key: "very_hard", labelKey: "difficultyVeryHard", color: "#ef4444" },
] as const;

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function DifficultyDistributionChart({ domainId }: DifficultyDistributionChartProps) {
    const t = useTranslations('keywords');
    const data = useQuery(api.keywordMap_queries.getDifficultyDistribution, { domainId });

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-44 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-[250px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    const chartData = TIER_CONFIG.map((tier) => ({
        name: t(tier.labelKey),
        keywords: data.distribution[tier.key],
        volume: data.volumeByTier[tier.key],
        color: tier.color,
    }));

    if (data.total === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-secondary bg-primary p-6 py-12">
                <p className="text-sm text-tertiary">{t('noDifficultyDataAvailable')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div>
                <h3 className="text-md font-semibold text-primary">{t('difficultyDistribution')}</h3>
                <p className="text-sm text-tertiary">{t('difficultyDistributionDescription', { total: data.total })}</p>
            </div>

            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                        formatter={(value: any, name: any, props: any) => [
                            t('difficultyTooltip', { count: value, volume: formatNumber(props.payload.volume) }),
                            t('count'),
                        ]}
                        contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="keywords" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
