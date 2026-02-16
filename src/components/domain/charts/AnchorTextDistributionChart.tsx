"use client";

import { useQuery } from "convex/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface AnchorTextDistributionChartProps {
    domainId: Id<"domains">;
}

const CATEGORY_COLORS: Record<string, string> = {
    branded: "#8b5cf6",
    exact_url: "#3b82f6",
    generic: "#f59e0b",
    other: "#6b7280",
};

const CATEGORY_LABEL_KEYS: Record<string, string> = {
    branded: "anchorCategoryBranded",
    exact_url: "anchorCategoryUrl",
    generic: "anchorCategoryGeneric",
    other: "anchorCategoryOther",
};

export function AnchorTextDistributionChart({ domainId }: AnchorTextDistributionChartProps) {
    const t = useTranslations('backlinks');
    const data = useQuery(api.backlinkAnalysis_queries.getAnchorTextDistribution, { domainId });

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
                <p className="text-sm text-tertiary">{t('anchorDistributionEmpty')}</p>
            </div>
        );
    }

    const chartData = data.categories.filter((c) => c.count > 0).map((c) => ({
        name: CATEGORY_LABEL_KEYS[c.name] ? t(CATEGORY_LABEL_KEYS[c.name]) : c.name,
        value: c.count,
        percentage: c.percentage,
        fill: CATEGORY_COLORS[c.name] || "#6b7280",
    }));

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div>
                <h3 className="text-md font-semibold text-primary">{t('anchorDistributionTitle')}</h3>
                <p className="text-sm text-tertiary">{t('anchorDistributionDescription', { total: data.total })}</p>
            </div>

            <div className="flex items-center gap-6">
                <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={2}>
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: any) => [`${value} links`, ""]}
                                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex flex-col gap-2">
                    {data.categories.map((cat) => (
                        <div key={cat.name} className="flex items-center gap-3">
                            <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.name] }} />
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-primary">{CATEGORY_LABEL_KEYS[cat.name] ? t(CATEGORY_LABEL_KEYS[cat.name]) : cat.name}</span>
                                <span className="text-xs text-tertiary">
                                    {cat.count} ({cat.percentage}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
