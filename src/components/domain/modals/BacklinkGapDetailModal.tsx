"use client";

import {
    ArrowUpRight,
    Target04,
    BarChart01,
    Link03,
    LinkExternal01,
    Users01,
    Tag01,
    ShieldTick,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { Heading as AriaHeading } from "react-aria-components";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";

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

    if (!gap) return null;

    const priority = getPriorityBadge(gap.priorityScore);

    return (
        <DialogTrigger isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <ModalOverlay isDismissable>
                <Modal className="max-w-4xl">
                    <Dialog>
                        <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-4xl">
                            <CloseButton onPress={onClose} theme="light" size="lg" className="absolute top-3 right-3 z-10" />

                            {/* Header with FeaturedIcon */}
                            <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                                <div className="relative w-max">
                                    <FeaturedIcon color="brand" size="lg" theme="light" icon={Link03} />
                                    <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                </div>
                                <div className="z-10 flex flex-col gap-0.5">
                                    <AriaHeading slot="title" className="text-md font-semibold text-primary">
                                        <a
                                            href={`https://${gap.domain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 hover:text-brand-primary"
                                        >
                                            {gap.domain}
                                            <ArrowUpRight className="h-4 w-4 shrink-0" />
                                        </a>
                                    </AriaHeading>
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

                            {/* Scrollable Content */}
                            <div className="max-h-[calc(90vh-10rem)] overflow-y-auto px-4 pt-4 pb-5 sm:px-6 flex flex-col gap-6">
                                {/* Overview cards */}
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <OverviewCard icon={Target04} label={t('gapPriorityScore')} value={`${gap.priorityScore}/100`} color={priority.text} />
                                    <OverviewCard icon={Users01} label={t('gapCompetitors')} value={gap.competitorCount.toString()} color="text-utility-warning-600" />
                                    <OverviewCard icon={LinkExternal01} label={t('gapTotalLinks')} value={gap.totalLinks.toString()} color="text-primary" />
                                    <OverviewCard icon={BarChart01} label={t('gapAvgDomainRank')} value={gap.avgDomainRank ? gap.avgDomainRank.toString() : "\u2014"} color="text-primary" />
                                </div>

                                {/* Score + Dofollow bars */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-medium text-secondary">{t('gapPriorityScore')}</span>
                                            <span className="text-xs font-semibold text-primary">{gap.priorityScore}/100</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
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
                                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
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
                                                <span className="text-sm font-medium text-primary">{gap.avgDomainRank || "\u2014"}</span>
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
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </DialogTrigger>
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
