"use client";

import { useQuery } from "convex/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { HelpCircle } from "@untitledui/icons";
import { Tooltip as InfoTooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ContentGapTrendsChartProps {
    domainId: Id<"domains">;
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function ContentGapTrendsChart({ domainId }: ContentGapTrendsChartProps) {
    const trends = useQuery(api.contentGaps_queries.getGapTrends, { domainId, days: 90 });

    if (trends === undefined) {
        return (
            <div className="rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 mb-4" />
                <div className="h-[220px] animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!trends || trends.length === 0) {
        return (
            <div className="rounded-xl border border-secondary bg-primary p-6">
                <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-primary">Gap Trends</h3>
                    <InfoTooltip title="Gap Trends" description="Shows how the number of content gap opportunities changes over time. Track whether new gaps appear faster than you can address them.">
                        <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                            <HelpCircle className="size-4" />
                        </TooltipTrigger>
                    </InfoTooltip>
                </div>
                <p className="text-sm text-tertiary mb-4">Content gap changes over time</p>
                <div className="flex h-[180px] items-center justify-center">
                    <p className="text-sm text-tertiary">No trend data yet. Run content gap analysis to start tracking.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-secondary bg-primary p-6">
            <div className="flex items-center gap-2">
                <h3 className="text-md font-semibold text-primary">Gap Trends</h3>
                <InfoTooltip title="Gap Trends" description="Shows how the number of content gap opportunities changes over time. Track whether new gaps appear faster than you can address them.">
                    <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                        <HelpCircle className="size-4" />
                    </TooltipTrigger>
                </InfoTooltip>
            </div>
            <p className="text-sm text-tertiary mb-4">Content gap changes over time</p>
            <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                            formatter={(value: any, name: any) => [
                                name === "estimatedValue" ? formatNumber(value) : value,
                                name === "totalGaps" ? "Total Gaps" :
                                name === "highPriorityGaps" ? "High Priority" :
                                name === "estimatedValue" ? "Est. Value" : name,
                            ]}
                            labelFormatter={(label: any) => `Date: ${label}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="totalGaps" name="Total Gaps" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="highPriorityGaps" name="High Priority" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
