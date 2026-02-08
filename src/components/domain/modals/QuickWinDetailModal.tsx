"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
    XClose,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Link01,
    FileSearch02,
    Target04,
    Lightbulb02,
    ChevronRight,
    Globe01,
    TrendUp01,
    AlertCircle,
} from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface QuickWinDetailModalProps {
    domainId: Id<"domains">;
    discoveredKeywordId: Id<"discoveredKeywords">;
    isOpen: boolean;
    onClose: () => void;
}

function formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return "—";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

function getPositionBadgeClass(position: number): string {
    if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
    if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
    if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
    return "bg-utility-gray-50 text-utility-gray-600";
}

const INTENT_LABEL_KEYS: Record<string, string> = {
    commercial: "intentCommercial",
    informational: "intentInformational",
    navigational: "intentNavigational",
    transactional: "intentTransactional",
};

type BadgeColor = "gray" | "brand" | "error" | "warning" | "success" | "gray-blue" | "blue-light" | "blue" | "indigo" | "purple" | "pink" | "orange";

const CATEGORY_COLORS: Record<string, BadgeColor> = {
    links: "success",
    content: "brand",
    serp_features: "warning",
    technical: "gray-blue",
};

const CATEGORY_LABEL_KEYS: Record<string, string> = {
    links: "quickWinCategoryLinks",
    content: "quickWinCategoryContent",
    serp_features: "quickWinCategorySerpFeatures",
    technical: "quickWinCategoryTechnical",
};

const PRIORITY_COLORS: Record<string, BadgeColor> = {
    high: "error",
    medium: "warning",
    low: "gray",
};

export function QuickWinDetailModal({
    domainId,
    discoveredKeywordId,
    isOpen,
    onClose,
}: QuickWinDetailModalProps) {
    const t = useTranslations('onsite');
    const tc = useTranslations('common');
    const tk = useTranslations('keywords');
    const translatePriority = (priority: string) => {
        const key = `priority${priority.charAt(0).toUpperCase()}${priority.slice(1)}` as any;
        try { return tc(key); } catch { return priority; }
    };
    useEscapeClose(onClose, isOpen);

    const plan = useQuery(
        api.keywordMap_queries.getQuickWinActionPlan,
        isOpen ? { domainId, discoveredKeywordId } : "skip"
    );

    if (!isOpen) return null;

    const kw = plan?.keyword;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-secondary bg-primary shadow-xl mx-4">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-secondary bg-primary px-6 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <Zap className="h-5 w-5 text-fg-warning-primary flex-shrink-0" />
                            <h2 className="text-lg font-semibold text-primary truncate">
                                {kw?.keyword || t('loading')}
                            </h2>
                            {kw && (
                                <>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPositionBadgeClass(kw.position)}`}>
                                        #{kw.position}
                                    </span>
                                    {kw.positionChange !== null && kw.positionChange !== 0 && (
                                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${kw.positionChange > 0 ? "text-utility-success-600" : "text-utility-error-600"}`}>
                                            {kw.positionChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                            {Math.abs(kw.positionChange)}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        {kw?.url && (
                            <p className="text-sm text-tertiary truncate">{kw.url}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-quaternary hover:text-primary hover:bg-secondary transition-colors flex-shrink-0"
                    >
                        <XClose className="h-5 w-5" />
                    </button>
                </div>

                {/* Loading */}
                {!plan && (
                    <div className="flex items-center justify-center py-20">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
                    </div>
                )}

                {plan && kw && (
                    <div className="px-6 py-6 space-y-6">
                        {/* Overview Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <OverviewCard label={t('labelPosition')} value={`#${kw.position}`} subValue={kw.positionChange !== null && kw.positionChange !== 0 ? `${kw.positionChange > 0 ? "+" : ""}${kw.positionChange}` : undefined} subColor={kw.positionChange && kw.positionChange > 0 ? "text-utility-success-600" : "text-utility-error-600"} />
                            <OverviewCard label={t('labelVolume')} value={formatNumber(kw.searchVolume)} />
                            <OverviewCard label={t('labelDifficulty')} value={kw.difficulty !== null ? `${kw.difficulty}` : "—"} subValue={kw.difficulty !== null ? (kw.difficulty < 30 ? t('difficultySimpleEasy') : kw.difficulty < 50 ? t('difficultySimpleMedium') : t('difficultySimpleHard')) : undefined} subColor={kw.difficulty !== null ? (kw.difficulty < 30 ? "text-utility-success-600" : kw.difficulty < 50 ? "text-utility-warning-600" : "text-utility-error-600") : undefined} />
                            <OverviewCard label={t('labelCpc')} value={kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : "—"} />
                            <OverviewCard label={t('labelEtv')} value={formatNumber(kw.etv)} />
                            <OverviewCard label={t('labelIntent')} value={kw.intent ? (INTENT_LABEL_KEYS[kw.intent] ? tk(INTENT_LABEL_KEYS[kw.intent] as any) : kw.intent) : "—"} />
                            <OverviewCard label={t('labelRefDomains')} value={formatNumber((kw.backlinksInfo as any)?.referringDomains)} />
                            <OverviewCard label={t('labelDomainRank')} value={kw.mainDomainRank !== null ? `${kw.mainDomainRank}` : "—"} />
                        </div>

                        {/* Your Page */}
                        {kw.url && (
                            <div className="rounded-lg border border-secondary p-4">
                                <h3 className="text-sm font-semibold text-primary mb-2">{t('yourPage')}</h3>
                                <a
                                    href={kw.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-brand-600 hover:underline flex items-center gap-1 mb-1"
                                >
                                    {kw.url} <ArrowUpRight className="h-3 w-3" />
                                </a>
                                {kw.title && <p className="text-sm text-primary">{kw.title}</p>}
                                {kw.description && <p className="text-xs text-tertiary mt-1 line-clamp-2">{kw.description}</p>}
                            </div>
                        )}

                        {/* SERP Competitors */}
                        {plan.serpCompetitors ? (
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                    <FileSearch02 className="h-4 w-4 text-fg-brand-primary" />
                                    {t('serpCompetitors')}
                                </h3>
                                <div className="overflow-x-auto rounded-lg border border-secondary">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-secondary bg-secondary">
                                                <th className="px-3 py-2 text-left font-medium text-tertiary">{t('serpColPos')}</th>
                                                <th className="px-3 py-2 text-left font-medium text-tertiary">{t('serpColDomain')}</th>
                                                <th className="px-3 py-2 text-left font-medium text-tertiary">{t('serpColTitle')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {plan.serpCompetitors.map((s, i) => (
                                                <tr key={i} className={`border-b border-secondary last:border-0 ${s.isYourDomain ? "bg-utility-brand-50/30" : ""}`}>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPositionBadgeClass(s.position)}`}>
                                                            #{s.position}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-primary">
                                                        {s.domain}
                                                        {s.isYourDomain && <Badge color="brand" size="sm" className="ml-2">{t('you')}</Badge>}
                                                    </td>
                                                    <td className="px-3 py-2 text-tertiary truncate max-w-xs">{s.title || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-secondary p-4 flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-fg-warning-primary flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-primary">{t('serpDataNotAvailable')}</p>
                                    <p className="text-xs text-tertiary">
                                        {plan.isMonitored
                                            ? t('serpNotFetchedYet')
                                            : t('addKeywordToMonitoring')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Link Profile Comparison */}
                        {plan.competitorProfiles.length > 0 && plan.yourBacklinkProfile && (
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                    <Link01 className="h-4 w-4 text-fg-success-primary" />
                                    {t('linkProfileComparison')}
                                </h3>
                                <div className="space-y-2">
                                    <LinkProfileBar
                                        label={t('yourSite')}
                                        value={plan.yourBacklinkProfile.referringDomains}
                                        maxValue={Math.max(
                                            plan.yourBacklinkProfile.referringDomains,
                                            ...plan.competitorProfiles.map((c) => c.referringDomains)
                                        )}
                                        color="bg-brand-600"
                                        isYou
                                        youLabel={t('you')}
                                    />
                                    {plan.competitorProfiles.map((cp) => (
                                        <LinkProfileBar
                                            key={cp.domain}
                                            label={cp.domain}
                                            value={cp.referringDomains}
                                            maxValue={Math.max(
                                                plan.yourBacklinkProfile!.referringDomains,
                                                ...plan.competitorProfiles.map((c) => c.referringDomains)
                                            )}
                                            color="bg-gray-400"
                                            position={cp.position}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Plan / Recommendations */}
                        {plan.recommendations.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                    <Lightbulb02 className="h-4 w-4 text-fg-warning-primary" />
                                    {t('actionPlan')}
                                </h3>
                                <div className="space-y-3">
                                    {plan.recommendations.map((rec, i) => (
                                        <div key={i} className="rounded-lg border border-secondary p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge color={PRIORITY_COLORS[rec.priority] || "gray"} size="sm">{translatePriority(rec.priority)}</Badge>
                                                <Badge color={CATEGORY_COLORS[rec.category] || "gray"} size="sm">{CATEGORY_LABEL_KEYS[rec.category] ? t(CATEGORY_LABEL_KEYS[rec.category] as any) : rec.category}</Badge>
                                                <span className="text-sm font-medium text-primary">{t(rec.titleKey as any, rec.params)}</span>
                                            </div>
                                            <p className="text-sm text-tertiary mb-3">{t(rec.descriptionKey as any, rec.params)}</p>
                                            <ul className="space-y-1.5">
                                                {rec.actionStepKeys.map((stepKey, j) => (
                                                    <li key={j} className="flex items-start gap-2 text-sm text-primary">
                                                        <ChevronRight className="h-4 w-4 text-fg-brand-primary flex-shrink-0 mt-0.5" />
                                                        {t(stepKey as any, rec.params)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Link Building Targets */}
                        {plan.backlinkGapTargets.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                    <Target04 className="h-4 w-4 text-fg-error-primary" />
                                    {t('linkBuildingTargets')} ({plan.backlinkGapTargets.length})
                                </h3>
                                <div className="overflow-x-auto rounded-lg border border-secondary">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-secondary bg-secondary">
                                                <th className="px-3 py-2 text-left font-medium text-tertiary">{t('lbtColDomain')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-tertiary">{t('lbtColPriority')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-tertiary">{t('lbtColCompetitors')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-tertiary">{t('lbtColDr')}</th>
                                                <th className="px-3 py-2 text-right font-medium text-tertiary">{t('lbtColDofollow')}</th>
                                                <th className="px-3 py-2 text-left font-medium text-tertiary">{t('lbtColTopAnchors')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {plan.backlinkGapTargets.map((target) => (
                                                <tr key={target.domain} className="border-b border-secondary last:border-0 hover:bg-primary_hover">
                                                    <td className="px-3 py-2">
                                                        <a
                                                            href={`https://${target.domain}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-brand-600 hover:underline flex items-center gap-1"
                                                        >
                                                            <Globe01 className="h-3.5 w-3.5" />
                                                            {target.domain}
                                                        </a>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${target.priorityScore >= 75 ? "bg-utility-error-50 text-utility-error-600" : target.priorityScore >= 50 ? "bg-utility-warning-50 text-utility-warning-600" : "bg-utility-gray-50 text-utility-gray-600"}`}>
                                                            {target.priorityScore}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-primary">{target.competitorCount}</td>
                                                    <td className="px-3 py-2 text-right text-primary">{target.avgDomainRank}</td>
                                                    <td className="px-3 py-2 text-right text-primary">{target.dofollowPercent}%</td>
                                                    <td className="px-3 py-2 text-tertiary truncate max-w-[200px]">
                                                        {target.topAnchors.slice(0, 2).join(", ") || "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* No data state */}
                        {plan.competitorProfiles.length === 0 && plan.backlinkGapTargets.length === 0 && plan.recommendations.length === 0 && (
                            <div className="rounded-lg border border-dashed border-secondary p-8 flex flex-col items-center gap-3 text-center">
                                <TrendUp01 className="h-8 w-8 text-fg-quaternary" />
                                <p className="text-sm font-medium text-primary">{t('limitedDataAvailable')}</p>
                                <p className="text-xs text-tertiary max-w-md">
                                    {t('addCompetitorsAndRunBacklinks')}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                {plan && (
                    <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-secondary bg-primary px-6 py-3">
                        <div className="text-xs text-tertiary">
                            {plan.isMonitored ? (
                                <span className="text-utility-success-600">{t('monitored')}</span>
                            ) : (
                                <span>{t('notMonitored')}</span>
                            )}
                            {plan.serpCompetitors && ` · ${t('serpResultsCount', { count: plan.serpCompetitors.length })}`}
                            {plan.backlinkGapTargets.length > 0 && ` · ${t('linkTargetsCount', { count: plan.backlinkGapTargets.length })}`}
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-primary hover:bg-secondary_hover transition-colors"
                        >
                            {t('close')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper components

function OverviewCard({ label, value, subValue, subColor }: {
    label: string;
    value: string;
    subValue?: string;
    subColor?: string;
}) {
    return (
        <div className="rounded-lg border border-secondary p-3">
            <p className="text-xs text-tertiary mb-1">{label}</p>
            <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-semibold text-primary">{value}</p>
                {subValue && <span className={`text-xs font-medium ${subColor || "text-tertiary"}`}>{subValue}</span>}
            </div>
        </div>
    );
}

function LinkProfileBar({ label, value, maxValue, color, isYou, youLabel, position }: {
    label: string;
    value: number;
    maxValue: number;
    color: string;
    isYou?: boolean;
    youLabel?: string;
    position?: number | null;
}) {
    const pct = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 2;
    return (
        <div className="flex items-center gap-3">
            <div className="w-32 truncate text-sm text-primary flex items-center gap-1.5">
                {label}
                {isYou && <Badge color="brand" size="sm">{youLabel}</Badge>}
                {position !== null && position !== undefined && (
                    <span className="text-xs text-tertiary">#{position}</span>
                )}
            </div>
            <div className="flex-1 bg-secondary rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium text-primary w-16 text-right">{formatNumber(value)}</span>
        </div>
    );
}
