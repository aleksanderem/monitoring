"use client";

import { useQuery } from "convex/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GradientChartTooltip } from "@/components/application/charts/charts-base";
import { formatNumber } from "@/lib/formatting";

interface IntentDistributionChartProps {
    domainId: Id<"domains">;
}

const INTENT_COLORS: Record<string, string> = {
    commercial: "#f59e0b",
    informational: "#3b82f6",
    navigational: "#8b5cf6",
    transactional: "#10b981",
    unknown: "#9ca3af",
};

const INTENT_LABEL_KEYS: Record<string, string> = {
    commercial: "intentCommercial",
    informational: "intentInformational",
    navigational: "intentNavigational",
    transactional: "intentTransactional",
    unknown: "intentUnknown",
};

export function IntentDistributionChart({ domainId }: IntentDistributionChartProps) {
    const t = useTranslations('keywords');
    const intentData = useQuery(api.keywordMap_queries.getIntentDistribution, { domainId });

    if (intentData === undefined) {
        return (
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-[250px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    const chartData = Object.entries(intentData)
        .filter(([, data]) => data.count > 0)
        .map(([intent, data]) => ({
            name: INTENT_LABEL_KEYS[intent] ? t(INTENT_LABEL_KEYS[intent]) : intent,
            value: data.count,
            volume: data.totalVolume,
            avgPosition: data.avgPosition,
            fill: INTENT_COLORS[intent] || INTENT_COLORS.unknown,
        }));

    if (chartData.length === 0) {
        return (
            <div className="relative flex flex-col items-center justify-center gap-4 rounded-xl border border-secondary bg-primary p-6 py-12">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <p className="text-sm text-tertiary">{t('noIntentDataAvailable')}</p>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <div>
                <h3 className="text-md font-semibold text-primary">{t('searchIntentDistribution')}</h3>
                <p className="text-sm text-tertiary">{t('searchIntentDistributionDescription')}</p>
            </div>

            <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={220}>
                    <PieChart>
                        <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                            {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={<GradientChartTooltip />}
                            formatter={(value: any, name: any, props: any) => [
                                t('intentTooltip', { count: value, volume: formatNumber(props.payload.volume) }),
                                name,
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-1 flex-col gap-2">
                    {chartData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                <span className="text-sm text-primary">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-primary">{item.value}</span>
                                <span className="text-xs text-tertiary">{formatNumber(item.volume)} {t('vol')}</span>
                                <span className="text-xs text-quaternary">{t('avgHash', { position: item.avgPosition })}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
