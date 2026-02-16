"use client";

import { useQuery } from "convex/react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ReferringDomainQualityChartProps {
    domainId: Id<"domains">;
}

const TIER_COLORS: Record<string, string> = {
    excellent: "#22c55e",
    good: "#3b82f6",
    average: "#f59e0b",
    poor: "#ef4444",
};

const TIER_LABEL_KEYS: Record<string, string> = {
    excellent: "qualityTierExcellent",
    good: "qualityTierGood",
    average: "qualityTierAverage",
    poor: "qualityTierPoor",
};

export function ReferringDomainQualityChart({ domainId }: ReferringDomainQualityChartProps) {
    const t = useTranslations('backlinks');
    const data = useQuery(api.backlinkAnalysis_queries.getLinkQualityScores, { domainId });

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-48 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary p-6 py-8">
                <p className="text-sm text-tertiary">{t('qualityEmpty')}</p>
            </div>
        );
    }

    const chartData = data.distribution.map((d) => ({
        name: TIER_LABEL_KEYS[d.tier] ? t(TIER_LABEL_KEYS[d.tier]) : d.tier,
        value: d.count,
        percentage: d.percentage,
        color: TIER_COLORS[d.tier] || "#6b7280",
    }));

    const total = data.distribution.reduce((sum, d) => sum + d.count, 0);

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div>
                <h3 className="text-md font-semibold text-primary">{t('qualityTitle')}</h3>
                <p className="text-sm text-tertiary">
                    {t('qualityDescription', { total, avgScore: data.avgScore })}
                </p>
            </div>

            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={70}
                            tick={{ fontSize: 12, fill: "var(--text-tertiary, #6b7280)" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            formatter={(value: any, _name: any, props: any) => [`${value} links (${props.payload.percentage}%)`, ""]}
                            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                            {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Score breakdown */}
            <div className="grid grid-cols-2 gap-3">
                {data.distribution.map((d) => {
                    const color = TIER_COLORS[d.tier];
                    const labelKey = TIER_LABEL_KEYS[d.tier];
                    if (!color || !labelKey) return null;
                    return (
                        <div key={d.tier} className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-medium text-primary">{t(labelKey)}</span>
                                <span className="text-xs text-tertiary">
                                    {d.count} ({d.percentage}%)
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
