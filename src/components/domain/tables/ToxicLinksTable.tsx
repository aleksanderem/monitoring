"use client";

import { useQuery } from "convex/react";
import { AlertTriangle, ShieldOff } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ToxicLinksTableProps {
    domainId: Id<"domains">;
}

function getSpamBadgeClass(score: number): string {
    if (score >= 90) return "bg-utility-error-50 text-utility-error-700";
    if (score >= 80) return "bg-utility-error-50 text-utility-error-600";
    return "bg-utility-warning-50 text-utility-warning-600";
}

export function ToxicLinksTable({ domainId }: ToxicLinksTableProps) {
    const data = useQuery(api.backlinkAnalysis_queries.getToxicLinks, { domainId });

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
                <div className="h-48 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldOff className="h-5 w-5 text-fg-error-primary" />
                    <div>
                        <h3 className="text-md font-semibold text-primary">Toxic Links</h3>
                        <p className="text-sm text-tertiary">
                            {data.toxicCount} toxic links detected ({data.toxicPercentage}% of analyzed)
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                        <span className="text-tertiary">Avg spam score:</span>
                        <span className="font-medium text-primary">{data.avgSpamScore}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-tertiary">Analyzed:</span>
                        <span className="font-medium text-primary">{data.totalAnalyzed}</span>
                    </div>
                </div>
            </div>

            {data.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-utility-success-600">No toxic links detected above threshold</p>
                    <p className="mt-1 text-xs text-tertiary">Links with spam score 70+ are flagged as toxic</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-secondary">
                                <th className="px-3 py-2.5 font-medium text-tertiary">Source URL</th>
                                <th className="px-3 py-2.5 font-medium text-tertiary">Domain</th>
                                <th className="px-3 py-2.5 font-medium text-tertiary">Anchor</th>
                                <th className="px-3 py-2.5 text-center font-medium text-tertiary">Spam Score</th>
                                <th className="px-3 py-2.5 text-center font-medium text-tertiary">Type</th>
                                <th className="px-3 py-2.5 text-right font-medium text-tertiary">Domain Rank</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.slice(0, 50).map((item) => (
                                <tr key={item._id} className="border-b border-secondary last:border-0 hover:bg-primary_hover">
                                    <td className="max-w-[250px] truncate px-3 py-2.5">
                                        <a href={item.urlFrom} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
                                            {item.urlFrom}
                                        </a>
                                    </td>
                                    <td className="px-3 py-2.5 text-sm text-primary">{item.domainFrom || "—"}</td>
                                    <td className="max-w-[150px] truncate px-3 py-2.5 text-sm text-tertiary">{item.anchor || "—"}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getSpamBadgeClass(item.spamScore)}`}>
                                            <AlertTriangle className="h-3 w-3" />
                                            {item.spamScore}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {item.dofollow ? (
                                            <span className="rounded-full bg-utility-success-50 px-2 py-0.5 text-xs font-medium text-utility-success-600">dofollow</span>
                                        ) : (
                                            <span className="rounded-full bg-utility-gray-50 px-2 py-0.5 text-xs font-medium text-utility-gray-600">nofollow</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm text-primary">{item.domainFromRank ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
