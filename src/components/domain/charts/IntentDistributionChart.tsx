"use client";

import { useQuery } from "convex/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

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

const INTENT_LABELS: Record<string, string> = {
    commercial: "Commercial",
    informational: "Informational",
    navigational: "Navigational",
    transactional: "Transactional",
    unknown: "Unknown",
};

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function IntentDistributionChart({ domainId }: IntentDistributionChartProps) {
    const intentData = useQuery(api.keywordMap_queries.getIntentDistribution, { domainId });

    if (intentData === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
                <div className="h-[250px] animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    const chartData = Object.entries(intentData)
        .filter(([, data]) => data.count > 0)
        .map(([intent, data]) => ({
            name: INTENT_LABELS[intent] || intent,
            value: data.count,
            volume: data.totalVolume,
            avgPosition: data.avgPosition,
            fill: INTENT_COLORS[intent] || INTENT_COLORS.unknown,
        }));

    if (chartData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-secondary bg-primary p-6 py-12">
                <p className="text-sm text-tertiary">No intent data available</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div>
                <h3 className="text-md font-semibold text-primary">Search Intent Distribution</h3>
                <p className="text-sm text-tertiary">Breakdown of keywords by user search intent — informational, commercial, transactional, or navigational.</p>
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
                            formatter={(value: any, name: any, props: any) => [
                                `${value} keywords (${formatNumber(props.payload.volume)} vol)`,
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
                                <span className="text-xs text-tertiary">{formatNumber(item.volume)} vol</span>
                                <span className="text-xs text-quaternary">avg #{item.avgPosition}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
