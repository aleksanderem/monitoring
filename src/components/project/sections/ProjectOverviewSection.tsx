"use client";

import { useQuery } from "convex/react";
import { Globe01, Hash01, TrendUp02, Link03, BarChart03, Target04 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ProjectOverviewSectionProps {
    projectId: Id<"projects">;
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function ProjectOverviewSection({ projectId }: ProjectOverviewSectionProps) {
    const overview = useQuery(api.projectDashboard_queries.getProjectOverview, { projectId });

    if (overview === undefined) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                        <div className="mt-2 h-8 w-12 animate-pulse rounded bg-gray-100" />
                    </div>
                ))}
            </div>
        );
    }

    if (!overview) return null;

    const cards = [
        { label: "Domains", value: overview.totalDomains, icon: Globe01, subtext: null },
        { label: "Monitored Keywords", value: formatNumber(overview.totalMonitored), icon: Hash01, subtext: `${formatNumber(overview.totalDiscoveredKeywords)} discovered` },
        { label: "Avg Position", value: overview.avgPosition ?? "—", icon: Target04, subtext: null },
        { label: "Est. Traffic", value: formatNumber(overview.totalEstimatedTraffic), icon: TrendUp02, subtext: "monthly ETV" },
        { label: "Total Backlinks", value: formatNumber(overview.totalBacklinks), icon: Link03, subtext: `${formatNumber(overview.totalReferringDomains)} domains` },
        { label: "Discovered KWs", value: formatNumber(overview.totalDiscoveredKeywords), icon: BarChart03, subtext: null },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {cards.map((card) => (
                <div key={card.label} className="rounded-xl border border-secondary bg-primary p-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <card.icon className="h-4 w-4" />
                        {card.label}
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">{card.value}</p>
                    {card.subtext && <p className="mt-0.5 text-xs text-tertiary">{card.subtext}</p>}
                </div>
            ))}
        </div>
    );
}
