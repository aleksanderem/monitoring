"use client";

import { useQuery } from "convex/react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface KeywordMapBubbleChartProps {
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

function CustomTooltip({ active, payload }: any) {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
        <div className="rounded-lg border border-secondary bg-primary px-3 py-2 shadow-lg">
            <p className="text-sm font-medium text-primary">{data.keyword}</p>
            <div className="mt-1 space-y-0.5">
                <p className="text-xs text-tertiary">Position: <span className="font-medium text-primary">{data.position}</span></p>
                <p className="text-xs text-tertiary">Volume: <span className="font-medium text-primary">{data.searchVolume?.toLocaleString()}</span></p>
                <p className="text-xs text-tertiary">Difficulty: <span className="font-medium text-primary">{data.difficulty}</span></p>
                <p className="text-xs text-tertiary">ETV: <span className="font-medium text-primary">{data.etv?.toLocaleString()}</span></p>
                <p className="text-xs text-tertiary">Intent: <span className="font-medium text-primary">{INTENT_LABELS[data.intent] || data.intent}</span></p>
            </div>
        </div>
    );
}

export function KeywordMapBubbleChart({ domainId }: KeywordMapBubbleChartProps) {
    const bubbleData = useQuery(api.keywordMap_queries.getKeywordMapBubbleData, { domainId });

    if (bubbleData === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
                <div className="h-[400px] animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!bubbleData || bubbleData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-secondary bg-primary p-6 py-12">
                <p className="text-sm text-tertiary">No keyword data available for bubble chart</p>
            </div>
        );
    }

    // Group by intent for legend
    const intentGroups = Object.keys(INTENT_COLORS);

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div>
                <h3 className="text-md font-semibold text-primary">Keyword Map</h3>
                <p className="text-sm text-tertiary">Volume vs Difficulty — bubble size = ETV, color = intent</p>
            </div>

            <div className="flex flex-wrap gap-3">
                {intentGroups.map((intent) => {
                    const count = bubbleData.filter((d) => d.intent === intent).length;
                    if (count === 0) return null;
                    return (
                        <div key={intent} className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INTENT_COLORS[intent] }} />
                            <span className="text-xs text-tertiary">{INTENT_LABELS[intent]} ({count})</span>
                        </div>
                    );
                })}
            </div>

            <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" dataKey="difficulty" name="Difficulty" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: "Difficulty", position: "insideBottom", offset: -5, style: { fontSize: 11 } }} />
                    <YAxis type="number" dataKey="searchVolume" name="Search Volume" scale="log" domain={["auto", "auto"]} tick={{ fontSize: 11 }} label={{ value: "Search Volume", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                    <ZAxis type="number" dataKey="etv" range={[20, 400]} name="ETV" />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter data={bubbleData} fillOpacity={0.7}>
                        {bubbleData.map((entry, index) => (
                            <Cell key={index} fill={INTENT_COLORS[entry.intent] || INTENT_COLORS.unknown} />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
}
