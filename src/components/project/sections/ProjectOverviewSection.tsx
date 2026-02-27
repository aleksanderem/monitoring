"use client";

import { useQuery } from "convex/react";
import { Globe01, Hash01, TrendUp02, Link03, BarChart03, Target04 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/formatting";

interface ProjectOverviewSectionProps {
    projectId: Id<"projects">;
}

export function ProjectOverviewSection({ projectId }: ProjectOverviewSectionProps) {
    const t = useTranslations("projects");
    const overview = useQuery(api.projectDashboard_queries.getProjectOverview, { projectId });

    if (overview === undefined) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                        <div className="mt-2 h-8 w-12 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                    </div>
                ))}
            </div>
        );
    }

    if (!overview) {
        return (
            <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
                <p className="text-sm text-tertiary">{t("noOverviewData")}</p>
            </div>
        );
    }

    const cards = [
        { label: t("overviewDomains"), value: overview.totalDomains, icon: Globe01, subtext: null },
        { label: t("overviewMonitoredKeywords"), value: formatNumber(overview.totalMonitored), icon: Hash01, subtext: t("overviewDiscovered", { count: formatNumber(overview.totalDiscoveredKeywords) }) },
        { label: t("overviewAvgPosition"), value: overview.avgPosition ?? "—", icon: Target04, subtext: null },
        { label: t("overviewEstTraffic"), value: formatNumber(overview.totalEstimatedTraffic), icon: TrendUp02, subtext: t("overviewMonthlyEtv") },
        { label: t("overviewTotalBacklinks"), value: formatNumber(overview.totalBacklinks), icon: Link03, subtext: t("overviewRefDomains", { count: formatNumber(overview.totalReferringDomains) }) },
        { label: t("overviewDiscoveredKws"), value: formatNumber(overview.totalDiscoveredKeywords), icon: BarChart03, subtext: null },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {cards.map((card) => (
                <div key={card.label} className="relative rounded-xl border border-secondary bg-primary p-4">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
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
