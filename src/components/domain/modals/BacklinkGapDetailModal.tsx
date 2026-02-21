"use client";

import {
    XClose,
    ArrowUpRight,
    Target04,
    BarChart01,
    LinkExternal01,
    Users01,
    Tag01,
    ShieldTick,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface GapItem {
    domain: string;
    competitorCount: number;
    competitors: string[];
    totalLinks: number;
    avgDomainRank: number;
    dofollowPercent: number;
    topAnchors: Array<{ anchor: string; count: number }>;
    priorityScore: number;
}

interface BacklinkGapDetailModalProps {
    gap: GapItem | null;
    isOpen: boolean;
    onClose: () => void;
}

function getPriorityBadge(score: number): { bg: string; text: string; labelKey: string } {
    if (score >= 75) return { bg: "bg-utility-success-50", text: "text-utility-success-600", labelKey: "priorityHigh" };
    if (score >= 50) return { bg: "bg-utility-blue-50", text: "text-utility-blue-600", labelKey: "priorityMedium" };
    if (score >= 25) return { bg: "bg-utility-warning-50", text: "text-utility-warning-600", labelKey: "priorityLow" };
    return { bg: "bg-utility-gray-50", text: "text-utility-gray-600", labelKey: "priorityVeryLow" };
}

export function BacklinkGapDetailModal({ gap, isOpen, onClose }: BacklinkGapDetailModalProps) {
    const t = useTranslations('backlinks');
    useEscapeClose(onClose, isOpen);

    if (!isOpen || !gap) return null;

    const priority = getPriorityBadge(gap.priorityScore);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay/70 p-4 pt-[5vh]" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-2xl bg-primary dark:bg-[#1f2530] shadow-xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-secondary px-6 py-5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-utility-brand-50">
                            <Target04 className="h-5 w-5 text-utility-brand-600" />
                        </div>
                        <div className="min-w-0">
                            <a
                                href={`https://${gap.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-lg font-semibold text-primary hover:text-brand-primary"
                            >
                                {gap.domain}
                                <ArrowUpRight className="h-4 w-4 shrink-0" />
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priority.bg} ${priority.text}`}>
                                    {t(priority.labelKey)} {t('priority')}
                                </span>
                                <span className="text-xs text-quaternary">
                                    {t('gapLinksToCompetitors', { count: gap.competitorCount })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-fg-quaternary hover:bg-secondary hover:text-fg-primary">
                        <XClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-6 py-5 flex flex-col gap-6">
                    {/* Overview cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <OverviewCard icon={Target04} label={t('gapPriorityScore')} value={`${gap.priorityScore}/100`} color={priority.text} />
                        <OverviewCard icon={Users01} label={t('gapCompetitors')} value={gap.competitorCount.toString()} color="text-utility-warning-600" />
                        <OverviewCard icon={LinkExternal01} label={t('gapTotalLinks')} value={gap.totalLinks.toString()} color="text-primary" />
                        <OverviewCard icon={BarChart01} label={t('gapAvgDomainRank')} value={gap.avgDomainRank ? gap.avgDomainRank.toString() : "—"} color="text-primary" />
                    </div>

                    {/* Score + Dofollow bars */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-secondary">{t('gapPriorityScore')}</span>
                                <span className="text-xs font-semibold text-primary">{gap.priorityScore}/100</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${gap.priorityScore >= 75 ? "bg-utility-success-500" : gap.priorityScore >= 50 ? "bg-utility-blue-500" : gap.priorityScore >= 25 ? "bg-utility-warning-500" : "bg-utility-gray-500"}`}
                                    style={{ width: `${gap.priorityScore}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-secondary">{t('gapDofollowRatio')}</span>
                                <span className="text-xs font-semibold text-primary">{gap.dofollowPercent}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-utility-success-500"
                                    style={{ width: `${gap.dofollowPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Why this matters */}
                    <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                        <h4 className="text-sm font-semibold text-primary mb-2">{t('gapWhyMatters')}</h4>
                        <p className="text-sm text-secondary">
                            {t('gapWhyDescription', { domain: gap.domain, competitorCount: gap.competitorCount, totalLinks: gap.totalLinks })}
                            {gap.avgDomainRank > 0 && <> ({t('gapAvgRankNote', { rank: gap.avgDomainRank })})</>}.
                            {gap.dofollowPercent >= 75
                                ? ` ${t('gapDofollowHigh')}`
                                : gap.dofollowPercent >= 50
                                    ? ` ${t('gapDofollowMedium')}`
                                    : ` ${t('gapDofollowLow')}`}
                        </p>
                    </div>

                    {/* Competitors with links */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Users01 className="h-4 w-4 text-fg-tertiary" />
                            <h4 className="text-sm font-semibold text-primary">
                                {t('gapCompetitorsLinked', { count: gap.competitors.length })}
                            </h4>
                        </div>
                        <div className="rounded-lg border border-secondary overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-secondary bg-secondary/30">
                                        <th className="px-4 py-2 text-left text-xs font-medium text-tertiary">{t('columnCompetitorDomain')}</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-tertiary">{t('visit')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gap.competitors.map((comp) => (
                                        <tr key={comp} className="border-b border-secondary last:border-0">
                                            <td className="px-4 py-2 text-sm text-primary font-medium">{comp}</td>
                                            <td className="px-4 py-2 text-right">
                                                <a
                                                    href={`https://${comp}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                                >
                                                    {t('visit')} <ArrowUpRight className="h-3 w-3" />
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top Anchors */}
                    {gap.topAnchors.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Tag01 className="h-4 w-4 text-fg-tertiary" />
                                <h4 className="text-sm font-semibold text-primary">
                                    {t('gapTopAnchors', { count: gap.topAnchors.length })}
                                </h4>
                            </div>
                            <div className="rounded-lg border border-secondary overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-secondary bg-secondary/30">
                                            <th className="px-4 py-2 text-left text-xs font-medium text-tertiary">{t('columnAnchorText')}</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-tertiary">{t('columnCount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gap.topAnchors.map((a, i) => (
                                            <tr key={i} className="border-b border-secondary last:border-0">
                                                <td className="px-4 py-2 text-sm text-primary font-medium">{a.anchor || "(empty)"}</td>
                                                <td className="px-4 py-2 text-right text-sm text-tertiary">{a.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Dofollow info card */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-secondary p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldTick className="h-4 w-4 text-fg-tertiary" />
                                <span className="text-sm font-semibold text-primary">{t('gapLinkProfile')}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">{t('gapTotalLinks')}</span>
                                    <span className="text-sm font-medium text-primary">{gap.totalLinks}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-utility-success-600">{t('dofollow')}</span>
                                    <span className="text-sm font-medium text-utility-success-600">{gap.dofollowPercent}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-tertiary">{t('nofollow')}</span>
                                    <span className="text-sm font-medium text-tertiary">{100 - gap.dofollowPercent}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg border border-secondary p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart01 className="h-4 w-4 text-fg-tertiary" />
                                <span className="text-sm font-semibold text-primary">{t('gapAuthority')}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">{t('gapAvgDomainRank')}</span>
                                    <span className="text-sm font-medium text-primary">{gap.avgDomainRank || "—"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">{t('gapCompetitorOverlap')}</span>
                                    <span className="text-sm font-medium text-primary">{t('gapDomainsCount', { count: gap.competitorCount })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priority.bg} ${priority.text}`}>
                        {t('priority')}: {t(priority.labelKey)}
                    </span>
                    <a
                        href={`https://${gap.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-utility-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-utility-brand-100"
                    >
                        <ArrowUpRight className="h-4 w-4" />
                        {t('visitDomain')}
                    </a>
                </div>
            </div>
        </div>
    );
}

function OverviewCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
    return (
        <div className="rounded-lg border border-secondary p-3">
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3.5 w-3.5 text-fg-quaternary" />
                <span className="text-xs text-tertiary">{label}</span>
            </div>
            <p className={`text-lg font-semibold ${color}`}>{value}</p>
        </div>
    );
}
