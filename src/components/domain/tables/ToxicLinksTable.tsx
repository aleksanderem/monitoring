"use client";

import { useQuery } from "convex/react";
import { AlertTriangle, ShieldOff } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";
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
    const t = useTranslations('backlinks');
    const data = useQuery(api.backlinkAnalysis_queries.getToxicLinks, { domainId });

    if (data === undefined) {
        return (
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-48 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldOff className="h-5 w-5 text-fg-error-primary" />
                    <div>
                        <h3 className="text-md font-semibold text-primary">{t('toxicLinksTitle')}</h3>
                        <p className="text-sm text-tertiary">
                            {t('toxicLinksSubtitle', { toxicCount: data.toxicCount, toxicPercentage: data.toxicPercentage })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-tertiary">{t('toxicAvgSpamScore', { score: data.avgSpamScore })}</span>
                    <span className="text-tertiary">{t('toxicAnalyzed', { count: data.totalAnalyzed })}</span>
                </div>
            </div>

            {data.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-utility-success-600">{t('toxicEmpty')}</p>
                    <p className="mt-1 text-xs text-tertiary">{t('toxicEmptyHint')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-secondary">
                                <th className="px-3 py-2.5 font-medium text-tertiary">{t('columnSourceUrl')}</th>
                                <th className="px-3 py-2.5 font-medium text-tertiary">{t('columnDomain')}</th>
                                <th className="px-3 py-2.5 font-medium text-tertiary">{t('columnAnchorText')}</th>
                                <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('columnSpamScore')}</th>
                                <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('columnType')}</th>
                                <th className="px-3 py-2.5 text-right font-medium text-tertiary">{t('columnDomainRank')}</th>
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
                                            <span className="rounded-full bg-utility-success-50 px-2 py-0.5 text-xs font-medium text-utility-success-600">{t('dofollow')}</span>
                                        ) : (
                                            <span className="rounded-full bg-utility-gray-50 px-2 py-0.5 text-xs font-medium text-utility-gray-600">{t('nofollow')}</span>
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
