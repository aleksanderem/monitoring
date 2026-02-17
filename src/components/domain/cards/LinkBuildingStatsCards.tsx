"use client";

import { useQuery } from "convex/react";
import { Target04, TrendUp02, Zap, BarChart03 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface LinkBuildingStatsCardsProps {
    domainId: Id<"domains">;
}

export function LinkBuildingStatsCards({ domainId }: LinkBuildingStatsCardsProps) {
    const t = useTranslations('backlinks');
    const stats = useQuery(api.linkBuilding_queries.getProspectStats, { domainId });

    if (stats === undefined) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Target04 className="h-4 w-4" />
                        {t('statsProspects')}
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">0</p>
                    <p className="mt-0.5 text-xs text-tertiary">{t('statsGenerateToFind')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <Target04 className="h-4 w-4" />
                    {t('statsActiveProspects')}
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{stats.activeProspects}</p>
                <p className="mt-0.5 text-xs text-tertiary">{t('statsUnderReview', { count: stats.reviewingCount })}</p>
            </div>
            <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <BarChart03 className="h-4 w-4" />
                    {t('statsAvgScore')}
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{stats.avgScore}</p>
                <p className="mt-0.5 text-xs text-tertiary">{t('statsOutOf100')}</p>
            </div>
            <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <TrendUp02 className="h-4 w-4" />
                    {t('statsAvgImpact')}
                </div>
                <p className="mt-1 text-2xl font-semibold text-utility-success-600">{stats.avgImpact}</p>
                <p className="mt-0.5 text-xs text-tertiary">{t('statsEstimatedSeoImpact')}</p>
            </div>
            <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2 text-sm text-tertiary">
                    <Zap className="h-4 w-4 text-fg-warning-primary" />
                    {t('statsEasyWins')}
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{stats.byDifficulty.easy}</p>
                <p className="mt-0.5 text-xs text-tertiary">
                    {t('statsDifficultyBreakdown', { medium: stats.byDifficulty.medium, hard: stats.byDifficulty.hard })}
                </p>
            </div>
        </div>
    );
}
