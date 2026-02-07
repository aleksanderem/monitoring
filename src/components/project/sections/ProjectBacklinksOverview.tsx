"use client";

import { useQuery } from "convex/react";
import { Link03, Globe01 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ProjectBacklinksOverviewProps {
    projectId: Id<"projects">;
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function ProjectBacklinksOverview({ projectId }: ProjectBacklinksOverviewProps) {
    const data = useQuery(api.projectDashboard_queries.getProjectBacklinksSummary, { projectId });

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
                <div className="h-32 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex flex-col gap-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-secondary bg-primary p-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Link03 className="h-4 w-4" />
                        Total Backlinks
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(data.totalBacklinks)}</p>
                </div>
                <div className="rounded-xl border border-secondary bg-primary p-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        <Globe01 className="h-4 w-4" />
                        Referring Domains
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(data.totalReferringDomains)}</p>
                </div>
                <div className="rounded-xl border border-secondary bg-primary p-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">Dofollow</div>
                    <p className="mt-1 text-2xl font-semibold text-utility-success-600">{formatNumber(data.totalDofollow)}</p>
                    <p className="mt-0.5 text-xs text-tertiary">{data.dofollowPercent}% of total</p>
                </div>
                <div className="rounded-xl border border-secondary bg-primary p-4">
                    <div className="flex items-center gap-2 text-sm text-tertiary">Nofollow</div>
                    <p className="mt-1 text-2xl font-semibold text-tertiary">{formatNumber(data.totalNofollow)}</p>
                </div>
            </div>

            {/* Per-domain breakdown */}
            {data.domainSummaries.length > 0 && (
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary">Backlinks by Domain</h3>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-secondary">
                                    <th className="px-3 py-2.5 font-medium text-tertiary">Domain</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">Backlinks</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">Ref. Domains</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">Dofollow</th>
                                    <th className="px-3 py-2.5 text-right font-medium text-tertiary">Nofollow</th>
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
