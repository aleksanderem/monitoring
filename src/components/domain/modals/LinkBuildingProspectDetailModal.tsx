"use client";

import { useMutation } from "convex/react";
import {
    ArrowUpRight,
    CheckCircle,
    Eye,
    XCircle,
    Globe01,
    Target04,
    TrendUp01,
    BarChart01,
    LinkExternal01,
    Users01,
    Clock,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { Heading as AriaHeading } from "react-aria-components";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";

interface ProspectData {
    _id: Id<"linkBuildingProspects">;
    referringDomain: string;
    domainRank: number;
    linksToCompetitors: number;
    competitors: string[];
    prospectScore: number;
    acquisitionDifficulty: "easy" | "medium" | "hard";
    suggestedChannel: string;
    estimatedImpact: number;
    status: "identified" | "reviewing" | "dismissed";
    reasoning?: string;
    generatedAt: number;
}

interface LinkBuildingProspectDetailModalProps {
    prospect: ProspectData | null;
    isOpen: boolean;
    onClose: () => void;
}

const CHANNEL_INFO: Record<string, { labelKey: string; bg: string; text: string; descriptionKey: string }> = {
    broken_link: { labelKey: "channelBrokenLink", bg: "bg-utility-error-50", text: "text-utility-error-600", descriptionKey: "channelBrokenLinkDesc" },
    guest_post: { labelKey: "channelGuestPost", bg: "bg-utility-brand-50", text: "text-utility-brand-600", descriptionKey: "channelGuestPostDesc" },
    resource_page: { labelKey: "channelResourcePage", bg: "bg-utility-blue-50", text: "text-utility-blue-600", descriptionKey: "channelResourcePageDesc" },
    outreach: { labelKey: "channelOutreach", bg: "bg-utility-warning-50", text: "text-utility-warning-600", descriptionKey: "channelOutreachDesc" },
    content_mention: { labelKey: "channelContentMention", bg: "bg-utility-success-50", text: "text-utility-success-600", descriptionKey: "channelContentMentionDesc" },
};

const DIFFICULTY_INFO: Record<string, { labelKey: string; bg: string; text: string }> = {
    easy: { labelKey: "difficultyEasy", bg: "bg-utility-success-50", text: "text-utility-success-600" },
    medium: { labelKey: "difficultyMedium", bg: "bg-utility-warning-50", text: "text-utility-warning-600" },
    hard: { labelKey: "difficultyHard", bg: "bg-utility-error-50", text: "text-utility-error-600" },
};

const STATUS_INFO: Record<string, { labelKey: string; bg: string; text: string }> = {
    identified: { labelKey: "statusIdentified", bg: "bg-utility-gray-50", text: "text-utility-gray-600" },
    reviewing: { labelKey: "statusReviewing", bg: "bg-utility-brand-50", text: "text-utility-brand-600" },
    dismissed: { labelKey: "statusDismissed", bg: "bg-utility-error-50", text: "text-utility-error-600" },
};

export function LinkBuildingProspectDetailModal({ prospect, isOpen, onClose }: LinkBuildingProspectDetailModalProps) {
    const t = useTranslations('backlinks');
    const updateStatus = useMutation(api.linkBuilding_mutations.updateProspectStatus);

    if (!prospect) return null;

    const channel = CHANNEL_INFO[prospect.suggestedChannel] || CHANNEL_INFO.outreach;
    const difficulty = DIFFICULTY_INFO[prospect.acquisitionDifficulty] || DIFFICULTY_INFO.medium;
    const status = STATUS_INFO[prospect.status] || STATUS_INFO.identified;

    async function handleStatusChange(newStatus: "identified" | "reviewing" | "dismissed") {
        await updateStatus({ prospectId: prospect!._id, status: newStatus });
    }

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
                                    <FeaturedIcon color="success" size="lg" theme="light" icon={LinkExternal01} />
                                    <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                </div>
                                <div className="z-10 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                                            {prospect.referringDomain}
                                        </AriaHeading>
                                        <a
                                            href={`https://${prospect.referringDomain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand-primary hover:text-brand-primary_hover"
                                        >
                                            <ArrowUpRight className="h-4 w-4 shrink-0" />
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                                            {t(status.labelKey)}
                                        </span>
                                        <span className="text-xs text-quaternary">
                                            {new Date(prospect.generatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable content */}
                            <div className="max-h-[75vh] overflow-y-auto px-4 py-5 sm:px-6 flex flex-col gap-6">
                                {/* Overview cards */}
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <OverviewCard icon={Target04} label={t('prospectScore')} value={`${prospect.prospectScore}/100`} color="text-utility-brand-600" />
                                    <OverviewCard icon={TrendUp01} label={t('prospectEstImpact')} value={`${prospect.estimatedImpact}/100`} color="text-utility-success-600" />
                                    <OverviewCard icon={BarChart01} label={t('prospectDomainRank')} value={prospect.domainRank ? prospect.domainRank.toString() : "—"} color="text-primary" />
                                    <OverviewCard icon={LinkExternal01} label={t('prospectLinksToCompetitors')} value={prospect.linksToCompetitors.toString()} color="text-utility-warning-600" />
                                </div>

                                {/* Score bars */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-medium text-secondary">{t('prospectScore')}</span>
                                            <span className="text-xs font-semibold text-primary">{prospect.prospectScore}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${prospect.prospectScore >= 70 ? "bg-utility-success-500" : prospect.prospectScore >= 40 ? "bg-utility-warning-500" : "bg-utility-error-500"}`}
                                                style={{ width: `${prospect.prospectScore}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-medium text-secondary">{t('prospectEstImpact')}</span>
                                            <span className="text-xs font-semibold text-primary">{prospect.estimatedImpact}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${prospect.estimatedImpact >= 70 ? "bg-utility-success-500" : prospect.estimatedImpact >= 40 ? "bg-utility-warning-500" : "bg-utility-error-500"}`}
                                                style={{ width: `${prospect.estimatedImpact}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Channel & Difficulty */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="rounded-lg border border-secondary p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-medium text-tertiary">{t('prospectSuggestedChannel')}</span>
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${channel.bg} ${channel.text}`}>
                                                {t(channel.labelKey)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-secondary">{t(channel.descriptionKey)}</p>
                                    </div>
                                    <div className="rounded-lg border border-secondary p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-medium text-tertiary">{t('prospectAcquisitionDifficulty')}</span>
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>
                                                {t(difficulty.labelKey)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-secondary">
                                            {prospect.acquisitionDifficulty === "easy" && t('difficultyEasyDesc')}
                                            {prospect.acquisitionDifficulty === "medium" && t('difficultyMediumDesc')}
                                            {prospect.acquisitionDifficulty === "hard" && t('difficultyHardDesc')}
                                        </p>
                                    </div>
                                </div>

                                {/* Competitors linking from this domain */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users01 className="h-4 w-4 text-fg-tertiary" />
                                        <h4 className="text-sm font-semibold text-primary">
                                            {t('prospectCompetitorsWithLinks', { count: prospect.competitors.length })}
                                        </h4>
                                    </div>
                                    <div className="rounded-lg border border-secondary overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-secondary bg-secondary/30">
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-tertiary">{t('columnCompetitorDomain')}</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-tertiary">{t('links')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {prospect.competitors.map((comp) => (
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

                                {/* Reasoning */}
                                {prospect.reasoning && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-primary mb-2">{t('prospectAnalysisReasoning')}</h4>
                                        <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                                            <p className="text-sm text-secondary whitespace-pre-wrap">{prospect.reasoning}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer with status actions */}
                            <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-fg-quaternary" />
                                    <span className="text-xs text-tertiary">
                                        {new Date(prospect.generatedAt).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {prospect.status !== "reviewing" && (
                                        <button
                                            onClick={() => handleStatusChange("reviewing")}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-utility-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-utility-brand-100"
                                        >
                                            <Eye className="h-4 w-4" />
                                            {t('prospectMarkAsReviewing')}
                                        </button>
                                    )}
                                    {prospect.status === "reviewing" && (
                                        <button
                                            onClick={() => handleStatusChange("identified")}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary"
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                            {t('prospectBackToIdentified')}
                                        </button>
                                    )}
                                    {prospect.status !== "dismissed" && (
                                        <button
                                            onClick={() => handleStatusChange("dismissed")}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-utility-error-300 bg-utility-error-50 px-3 py-1.5 text-sm font-medium text-utility-error-600 hover:bg-utility-error-100"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            {t('prospectDismiss')}
                                        </button>
                                    )}
                                    {prospect.status === "dismissed" && (
                                        <button
                                            onClick={() => handleStatusChange("identified")}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary"
                                        >
                                            {t('prospectRestore')}
                                        </button>
                                    )}
                                </div>
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
