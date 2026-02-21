"use client";

import {
    XClose,
    ArrowUpRight,
    Globe01,
    LinkExternal01,
    ShieldTick,
    BarChart01,
    Calendar,
    Tag01,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface DomainData {
    domain: string;
    linkCount: number;
    dofollow: number;
    nofollow: number;
    dofollowPercent: number;
    avgDomainRank: number;
    avgSpamScore: number | null;
    qualityScore: number;
    topAnchors: Array<{ anchor: string; count: number }>;
    firstSeen: string | null;
    lastSeen: string | null;
    country: string | null;
}

interface ReferringDomainDetailModalProps {
    domain: DomainData | null;
    isOpen: boolean;
    onClose: () => void;
}

function getQualityBadge(score: number): { bg: string; text: string; labelKey: string } {
    if (score >= 70) return { bg: "bg-utility-success-50", text: "text-utility-success-600", labelKey: "refDomainQualityBadgeExcellent" };
    if (score >= 40) return { bg: "bg-utility-blue-50", text: "text-utility-blue-600", labelKey: "refDomainQualityBadgeGood" };
    if (score >= 20) return { bg: "bg-utility-warning-50", text: "text-utility-warning-600", labelKey: "refDomainQualityBadgeAverage" };
    return { bg: "bg-utility-gray-50", text: "text-utility-gray-600", labelKey: "refDomainQualityBadgePoor" };
}

function getSpamBadge(score: number): { bg: string; text: string; labelKey: string } {
    if (score <= 10) return { bg: "bg-utility-success-50", text: "text-utility-success-600", labelKey: "refDomainSpamBadgeSafe" };
    if (score <= 30) return { bg: "bg-utility-warning-50", text: "text-utility-warning-600", labelKey: "refDomainSpamBadgeSuspicious" };
    return { bg: "bg-utility-error-50", text: "text-utility-error-600", labelKey: "refDomainSpamBadgeDangerous" };
}

export function ReferringDomainDetailModal({ domain, isOpen, onClose }: ReferringDomainDetailModalProps) {
    const t = useTranslations('backlinks');
    useEscapeClose(onClose, isOpen);

    if (!isOpen || !domain) return null;

    const quality = getQualityBadge(domain.qualityScore);
    const spamScore = domain.avgSpamScore ?? 0;
    const spam = getSpamBadge(spamScore);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay/70 p-4 pt-[5vh]" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-2xl bg-primary dark:bg-[#1f2530] shadow-xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-secondary px-6 py-5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-utility-brand-50">
                            <Globe01 className="h-5 w-5 text-utility-brand-600" />
                        </div>
                        <div className="min-w-0">
                            <a
                                href={`https://${domain.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-lg font-semibold text-primary hover:text-brand-primary"
                            >
                                {domain.domain}
                                <ArrowUpRight className="h-4 w-4 shrink-0" />
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${quality.bg} ${quality.text}`}>
                                    {t(quality.labelKey)}
                                </span>
                                {domain.country && (
                                    <span className="text-xs text-quaternary">{domain.country}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-fg-quaternary hover:bg-secondary hover:text-fg-primary">
                        <XClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-6 py-5 flex flex-col gap-6">
                    {/* Overview cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <OverviewCard icon={LinkExternal01} label={t('refDomainTotalLinks')} value={domain.linkCount.toString()} color="text-primary" />
                        <OverviewCard icon={ShieldTick} label={t('refDomainDofollow')} value={`${domain.dofollowPercent}%`} color="text-utility-success-600" />
                        <OverviewCard icon={BarChart01} label={t('refDomainDomainRank')} value={domain.avgDomainRank ? domain.avgDomainRank.toString() : "—"} color="text-primary" />
                        <OverviewCard icon={ShieldTick} label={t('refDomainQualityScore')} value={`${domain.qualityScore}/100`} color={quality.text} />
                        <OverviewCard icon={ShieldTick} label={t('refDomainSpamScore')} value={domain.avgSpamScore !== null ? `${domain.avgSpamScore}/100` : "—"} color={spam.text} />
                    </div>

                    {/* Score bars */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-secondary">{t('refDomainQualityScore')}</span>
                                <span className="text-xs font-semibold text-primary">{domain.qualityScore}/100</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${domain.qualityScore >= 70 ? "bg-utility-success-500" : domain.qualityScore >= 40 ? "bg-utility-blue-500" : domain.qualityScore >= 20 ? "bg-utility-warning-500" : "bg-utility-gray-500"}`}
                                    style={{ width: `${domain.qualityScore}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-secondary">{t('refDomainSpamScore')}</span>
                                <span className="text-xs font-semibold text-primary">{spamScore}/100</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${spamScore <= 10 ? "bg-utility-success-500" : spamScore <= 30 ? "bg-utility-warning-500" : "bg-utility-error-500"}`}
                                    style={{ width: `${spamScore}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Link breakdown */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-secondary p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <LinkExternal01 className="h-4 w-4 text-fg-tertiary" />
                                <span className="text-sm font-semibold text-primary">{t('refDomainLinkBreakdown')}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">{t('refDomainTotalLinks')}</span>
                                    <span className="text-sm font-medium text-primary">{domain.linkCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-utility-success-600">{t('dofollow')}</span>
                                    <span className="text-sm font-medium text-utility-success-600">{domain.dofollow}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-tertiary">{t('nofollow')}</span>
                                    <span className="text-sm font-medium text-tertiary">{domain.nofollow}</span>
                                </div>
                                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-utility-success-500"
                                        style={{ width: `${domain.dofollowPercent}%` }}
                                    />
                                </div>
                                <p className="text-xs text-quaternary">{domain.dofollowPercent}% dofollow ratio</p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-secondary p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar className="h-4 w-4 text-fg-tertiary" />
                                <span className="text-sm font-semibold text-primary">{t('refDomainTimeline')}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">{t('refDomainFirstSeen')}</span>
                                    <span className="text-sm font-medium text-primary">
                                        {domain.firstSeen ? new Date(domain.firstSeen).toLocaleDateString() : "—"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">{t('refDomainLastSeen')}</span>
                                    <span className="text-sm font-medium text-primary">
                                        {domain.lastSeen ? new Date(domain.lastSeen).toLocaleDateString() : "—"}
                                    </span>
                                </div>
                                {domain.country && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-secondary">{t('refDomainCountry')}</span>
                                        <span className="text-sm font-medium text-primary">{domain.country}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Anchors */}
                    {domain.topAnchors.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Tag01 className="h-4 w-4 text-fg-tertiary" />
                                <h4 className="text-sm font-semibold text-primary">
                                    {t('refDomainTopAnchors', { count: domain.topAnchors.length })}
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
                                        {domain.topAnchors.map((a, i) => (
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
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${spam.bg} ${spam.text}`}>
                            {t('refDomainSpamScore')}: {t(spam.labelKey)}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${quality.bg} ${quality.text}`}>
                            {t('refDomainQualityScore')}: {t(quality.labelKey)}
                        </span>
                    </div>
                    <a
                        href={`https://${domain.domain}`}
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
