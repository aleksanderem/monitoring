"use client";

import { useQuery } from "convex/react";
import { Target04, TrendUp02, Zap, BarChart03 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface LinkBuildingStatsCardsProps {
    domainId: Id<"domains">;
}

export function LinkBuildingStatsCards({ domainId }: LinkBuildingStatsCardsProps) {
    const stats = useQuery(api.linkBuilding_queries.getProspectStats, { domainId });

    if (stats === undefined) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-100" />
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-secondary bg-primary p-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Target04 className="h-4 w-4" />
                        Prospects
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">0</p>
                    <p className="mt-0.5 text-xs text-tertiary">Generate report to find prospects</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-secondary bg-primary p-4">
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <Target04 className="h-4 w-4" />
                    Active Prospects
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{stats.activeProspects}</p>
                <p className="mt-0.5 text-xs text-tertiary">{stats.reviewingCount} under review</p>
            </div>
            <div className="rounded-xl border border-secondary bg-primary p-4">
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <BarChart03 className="h-4 w-4" />
                    Avg Score
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{stats.avgScore}</p>
                <p className="mt-0.5 text-xs text-tertiary">out of 100</p>
            </div>
            <div className="rounded-xl border border-secondary bg-primary p-4">
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <TrendUp02 className="h-4 w-4" />
                    Avg Impact
                </div>
                <p className="mt-1 text-2xl font-semibold text-utility-success-600">{stats.avgImpact}</p>
                <p className="mt-0.5 text-xs text-tertiary">estimated SEO impact</p>
            </div>
            <div className="rounded-xl border border-secondary bg-primary p-4">
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <Zap className="h-4 w-4 text-fg-warning-primary" />
                    Easy Wins
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{stats.byDifficulty.easy}</p>
                <p className="mt-0.5 text-xs text-tertiary">
                    {stats.byDifficulty.medium} medium, {stats.byDifficulty.hard} hard
                </p>
            </div>
        </div>
    );
}
