"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Globe01 } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ProjectDomainsTableProps {
    projectId: Id<"projects">;
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function ProjectDomainsTable({ projectId }: ProjectDomainsTableProps) {
    const domains = useQuery(api.projectDashboard_queries.getProjectDomainsWithMetrics, { projectId });
    const router = useRouter();

    if (domains === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
                <div className="h-48 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!domains || domains.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary p-8">
                <Globe01 className="h-12 w-12 text-fg-quaternary" />
                <p className="mt-3 text-sm font-medium text-primary">No domains yet</p>
                <p className="text-sm text-tertiary">Add domains to this project to see metrics</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-secondary bg-primary p-6">
            <h3 className="text-md font-semibold text-primary">Domains</h3>
            <p className="mb-4 text-sm text-tertiary">{domains.length} domains in this project</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-secondary">
                            <th className="px-3 py-2.5 font-medium text-tertiary">Domain</th>
                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Monitored</th>
                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Discovered</th>
                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Avg Position</th>
                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Est. Traffic</th>
                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Backlinks</th>
                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Ref. Domains</th>
                        </tr>
                    </thead>
                    <tbody>
                        {domains.map((d) => (
                            <tr
                                key={d._id}
                                className="cursor-pointer border-b border-secondary last:border-0 hover:bg-primary-hover"
                                onClick={() => router.push(`/domains/${d._id}`)}
                            >
                                <td className="px-3 py-2.5 font-medium text-brand-primary">{d.domain}</td>
                                <td className="px-3 py-2.5 text-right text-primary">{d.monitoredKeywords}</td>
                                <td className="px-3 py-2.5 text-right text-primary">{formatNumber(d.discoveredKeywords)}</td>
                                <td className="px-3 py-2.5 text-right text-primary">{d.avgPosition ?? "—"}</td>
                                <td className="px-3 py-2.5 text-right text-primary">{formatNumber(d.estimatedTraffic)}</td>
                                <td className="px-3 py-2.5 text-right text-primary">{formatNumber(d.totalBacklinks)}</td>
                                <td className="px-3 py-2.5 text-right text-primary">{formatNumber(d.referringDomains)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
