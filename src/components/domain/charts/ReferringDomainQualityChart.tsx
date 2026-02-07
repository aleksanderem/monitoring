"use client";

import { useQuery } from "convex/react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ReferringDomainQualityChartProps {
    domainId: Id<"domains">;
}

const TIER_CONFIG: Record<string, { color: string; label: string; description: string }> = {
    excellent: { color: "#22c55e", label: "Excellent", description: "Score 70-100" },
    good: { color: "#3b82f6", label: "Good", description: "Score 40-69" },
    average: { color: "#f59e0b", label: "Average", description: "Score 20-39" },
    poor: { color: "#ef4444", label: "Poor", description: "Score 0-19" },
};

export function ReferringDomainQualityChart({ domainId }: ReferringDomainQualityChartProps) {
    const data = useQuery(api.backlinkAnalysis_queries.getLinkQualityScores, { domainId });

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
                <div className="h-48 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary p-6 py-8">
                <p className="text-sm text-tertiary">No quality data available</p>
            </div>
        );
    }

    const chartData = data.distribution.map((d) => ({
        name: TIER_CONFIG[d.tier]?.label || d.tier,
        value: d.count,
        percentage: d.percentage,
        color: TIER_CONFIG[d.tier]?.color || "#6b7280",
    }));

    const total = data.distribution.reduce((sum, d) => sum + d.count, 0);

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div>
                <h3 className="text-md font-semibold text-primary">Referring Domain Quality</h3>
                <p className="text-sm text-tertiary">
                    Quality distribution across {total} backlinks. Avg score: <span className="font-medium text-primary">{data.avgScore}/100</span>
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
                    const config = TIER_CONFIG[d.tier];
                    if (!config) return null;
                    return (
                        <div key={d.tier} className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-medium text-primary">{config.label}</span>
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
