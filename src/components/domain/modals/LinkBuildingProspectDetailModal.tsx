"use client";

import { useMutation } from "convex/react";
import {
    XClose,
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
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEscapeClose } from "@/hooks/useEscapeClose";

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

const CHANNEL_INFO: Record<string, { label: string; bg: string; text: string; description: string }> = {
    broken_link: { label: "Broken Link", bg: "bg-utility-error-50", text: "text-utility-error-600", description: "Find broken outbound links on this domain and offer your content as a replacement." },
    guest_post: { label: "Guest Post", bg: "bg-utility-brand-50", text: "text-utility-brand-600", description: "This domain actively publishes third-party content — pitch a guest article relevant to their audience." },
    resource_page: { label: "Resource Page", bg: "bg-utility-blue-50", text: "text-utility-blue-600", description: "This domain has resource/link pages — submit your site as a valuable addition." },
    outreach: { label: "Outreach", bg: "bg-utility-warning-50", text: "text-utility-warning-600", description: "General outreach — this domain links to multiple competitors, indicating industry relevance." },
    content_mention: { label: "Content Mention", bg: "bg-utility-success-50", text: "text-utility-success-600", description: "This domain editorially mentions similar content — create something noteworthy for natural inclusion." },
};

const DIFFICULTY_INFO: Record<string, { label: string; bg: string; text: string }> = {
    easy: { label: "Easy", bg: "bg-utility-success-50", text: "text-utility-success-600" },
    medium: { label: "Medium", bg: "bg-utility-warning-50", text: "text-utility-warning-600" },
    hard: { label: "Hard", bg: "bg-utility-error-50", text: "text-utility-error-600" },
};

const STATUS_INFO: Record<string, { label: string; bg: string; text: string }> = {
    identified: { label: "Identified", bg: "bg-utility-gray-50", text: "text-utility-gray-600" },
    reviewing: { label: "Reviewing", bg: "bg-utility-brand-50", text: "text-utility-brand-600" },
    dismissed: { label: "Dismissed", bg: "bg-utility-error-50", text: "text-utility-error-600" },
};

export function LinkBuildingProspectDetailModal({ prospect, isOpen, onClose }: LinkBuildingProspectDetailModalProps) {
    const updateStatus = useMutation(api.linkBuilding_mutations.updateProspectStatus);
    useEscapeClose(onClose, isOpen);

    if (!isOpen || !prospect) return null;

    const channel = CHANNEL_INFO[prospect.suggestedChannel] || CHANNEL_INFO.outreach;
    const difficulty = DIFFICULTY_INFO[prospect.acquisitionDifficulty] || DIFFICULTY_INFO.medium;
    const status = STATUS_INFO[prospect.status] || STATUS_INFO.identified;

    async function handleStatusChange(newStatus: "identified" | "reviewing" | "dismissed") {
        await updateStatus({ prospectId: prospect!._id, status: newStatus });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[5vh]" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-2xl bg-primary shadow-xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-secondary px-6 py-5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-utility-brand-50">
                            <Globe01 className="h-5 w-5 text-utility-brand-600" />
                        </div>
                        <div className="min-w-0">
                            <a
                                href={`https://${prospect.referringDomain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-lg font-semibold text-primary hover:text-brand-primary"
                            >
                                {prospect.referringDomain}
                                <ArrowUpRight className="h-4 w-4 shrink-0" />
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                                    {status.label}
                                </span>
                                <span className="text-xs text-quaternary">
                                    Generated {new Date(prospect.generatedAt).toLocaleDateString()}
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
                        <OverviewCard icon={Target04} label="Prospect Score" value={`${prospect.prospectScore}/100`} color="text-utility-brand-600" />
                        <OverviewCard icon={TrendUp01} label="Est. Impact" value={`${prospect.estimatedImpact}/100`} color="text-utility-success-600" />
                        <OverviewCard icon={BarChart01} label="Domain Rank" value={prospect.domainRank ? prospect.domainRank.toString() : "—"} color="text-primary" />
                        <OverviewCard icon={LinkExternal01} label="Links to Competitors" value={prospect.linksToCompetitors.toString()} color="text-utility-warning-600" />
                    </div>

                    {/* Score bars */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-secondary">Prospect Score</span>
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
                                <span className="text-xs font-medium text-secondary">Estimated Impact</span>
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
                                <span className="text-xs font-medium text-tertiary">Suggested Channel</span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${channel.bg} ${channel.text}`}>
                                    {channel.label}
                                </span>
                            </div>
                            <p className="text-sm text-secondary">{channel.description}</p>
                        </div>
                        <div className="rounded-lg border border-secondary p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-tertiary">Acquisition Difficulty</span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>
                                    {difficulty.label}
                                </span>
                            </div>
                            <p className="text-sm text-secondary">
                                {prospect.acquisitionDifficulty === "easy" && "Lower authority domain — likely easier to secure a link through standard outreach."}
                                {prospect.acquisitionDifficulty === "medium" && "Moderate authority domain — may require a compelling pitch or high-value content."}
                                {prospect.acquisitionDifficulty === "hard" && "High authority domain — expect a longer process and need for exceptional content or relationships."}
                            </p>
                        </div>
                    </div>

                    {/* Competitors linking from this domain */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Users01 className="h-4 w-4 text-fg-tertiary" />
                            <h4 className="text-sm font-semibold text-primary">
                                Competitors with Links ({prospect.competitors.length})
                            </h4>
                        </div>
                        <div className="rounded-lg border border-secondary overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-secondary bg-secondary/30">
                                        <th className="px-4 py-2 text-left text-xs font-medium text-tertiary">Competitor Domain</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-tertiary">Link</th>
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
                                                    Visit <ArrowUpRight className="h-3 w-3" />
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
                            <h4 className="text-sm font-semibold text-primary mb-2">Analysis Reasoning</h4>
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
                            Generated {new Date(prospect.generatedAt).toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {prospect.status !== "reviewing" && (
                            <button
                                onClick={() => handleStatusChange("reviewing")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-utility-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-utility-brand-100"
                            >
                                <Eye className="h-4 w-4" />
                                Mark as Reviewing
                            </button>
                        )}
                        {prospect.status === "reviewing" && (
                            <button
                                onClick={() => handleStatusChange("identified")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary"
                            >
                                <CheckCircle className="h-4 w-4" />
                                Back to Identified
                            </button>
                        )}
                        {prospect.status !== "dismissed" && (
                            <button
                                onClick={() => handleStatusChange("dismissed")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-utility-error-300 bg-utility-error-50 px-3 py-1.5 text-sm font-medium text-utility-error-600 hover:bg-utility-error-100"
                            >
                                <XCircle className="h-4 w-4" />
                                Dismiss
                            </button>
                        )}
                        {prospect.status === "dismissed" && (
                            <button
                                onClick={() => handleStatusChange("identified")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary"
                            >
                                Restore
                            </button>
                        )}
                    </div>
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
