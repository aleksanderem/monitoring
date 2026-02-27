"use client";

import { useQuery } from "convex/react";
import { Link03, Globe01 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/formatting";

interface ProjectBacklinksOverviewProps {
    projectId: Id<"projects">;
}

export function ProjectBacklinksOverview({ projectId }: ProjectBacklinksOverviewProps) {
    const t = useTranslations("projects");
    const data = useQuery(api.projectDashboard_queries.getProjectBacklinksSummary, { projectId });

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-32 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
                <p className="text-sm text-tertiary">{t("noBacklinksData")}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="relative rounded-xl border border-secondary bg-primary p-4">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Link03 className="h-4 w-4" />
                        {t("backlinksTotalBacklinks")}
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(data.totalBacklinks)}</p>
                </div>
                <div className="relative rounded-xl border border-secondary bg-primary p-4">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Globe01 className="h-4 w-4" />
                        {t("backlinksReferringDomains")}
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(data.totalReferringDomains)}</p>
                </div>
                <div className="relative rounded-xl border border-secondary bg-primary p-4">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="flex items-center gap-2 text-sm text-tertiary">{t("backlinksDofollow")}</div>
                    <p className="mt-1 text-2xl font-semibold text-utility-success-600">{formatNumber(data.totalDofollow)}</p>
                    <p className="mt-0.5 text-xs text-tertiary">{t("backlinksOfTotal", { percent: data.dofollowPercent })}</p>
                </div>
                <div className="relative rounded-xl border border-secondary bg-primary p-4">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="flex items-center gap-2 text-sm text-tertiary">{t("backlinksNofollow")}</div>
                    <p className="mt-1 text-2xl font-semibold text-tertiary">{formatNumber(data.totalNofollow)}</p>
                </div>
            </div>

            {/* Per-domain breakdown */}
            {data.domainSummaries.length > 0 && (
                <div className="relative rounded-xl border border-secondary bg-primary p-6">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <h3 className="text-md font-semibold text-primary">{t("backlinksByDomain")}</h3>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-secondary">
                                    <th className="px-3 py-2.5 font-medium text-tertiary">{t("domainColumnDomain")}</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">{t("domainColumnBacklinks")}</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">{t("domainColumnRefDomains")}</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">{t("backlinksDofollow")}</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">{t("backlinksNofollow")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.domainSummaries.map((d) => (
                                    <tr key={d.domainId} className="border-b border-secondary last:border-0 hover:bg-primary-hover">
                                        <td className="px-3 py-2.5 font-medium text-primary">{d.domain}</td>
                                        <td className="px-3 py-2.5 text-right text-primary">{formatNumber(d.backlinks)}</td>
                                        <td className="px-3 py-2.5 text-right text-primary">{formatNumber(d.referringDomains)}</td>
                                        <td className="px-3 py-2.5 text-right text-utility-success-600">{formatNumber(d.dofollow)}</td>
                                        <td className="px-3 py-2.5 text-right text-tertiary">{formatNumber(d.nofollow)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
