"use client";

import { XClose, HelpCircle, TrendUp02, SearchLg, Target04 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface KeywordItem {
    phrase: string;
    searchVolume: number;
    opportunityScore: number;
    difficulty: number;
    estimatedTrafficValue: number;
    competitorPosition: number | null;
    status: string;
}

interface ClusterData {
    topic: string;
    gapCount: number;
    totalOpportunityScore: number;
    avgOpportunityScore: number;
    totalEstimatedValue: number;
    totalSearchVolume: number;
    avgDifficulty: number;
    keywords: KeywordItem[];
}

interface TopicClusterDetailModalProps {
    cluster: ClusterData;
    onClose: () => void;
}

function formatNumber(num: number | null | undefined): string {
    if (num == null) return "—";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
}

function getDifficultyColor(d: number): string {
    if (d < 30) return "text-utility-success-600";
    if (d < 50) return "text-utility-warning-600";
    if (d < 70) return "text-utility-orange-600";
    return "text-utility-error-600";
}

function getDifficultyBg(d: number): string {
    if (d < 30) return "bg-utility-success-50";
    if (d < 50) return "bg-utility-warning-50";
    if (d < 70) return "bg-utility-orange-50";
    return "bg-utility-error-50";
}

function getDifficultyLabel(d: number): string {
    if (d < 30) return "Easy";
    if (d < 50) return "Moderate";
    if (d < 70) return "Hard";
    return "Very Hard";
}

function getScoreColor(score: number): "success" | "warning" | "gray" {
    if (score >= 70) return "success";
    if (score >= 40) return "warning";
    return "gray";
}

export function TopicClusterDetailModal({ cluster, onClose }: TopicClusterDetailModalProps) {
    useEscapeClose(onClose);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-secondary bg-primary shadow-xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-secondary bg-primary px-6 py-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-primary">{cluster.topic}</h2>
                            <Badge color="brand" size="sm">{cluster.gapCount} keywords</Badge>
                        </div>
                        <p className="mt-1 text-sm text-tertiary">
                            Topic cluster with {cluster.gapCount} content gap opportunities
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover"
                    >
                        <XClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Summary metrics */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <MetricCard
                            label="Total Volume"
                            value={formatNumber(cluster.totalSearchVolume)}
                            tooltip="Combined monthly search volume across all keywords in this cluster"
                        />
                        <MetricCard
                            label="Est. Traffic"
                            value={formatNumber(cluster.totalEstimatedValue)}
                            tooltip="Estimated monthly visits if you ranked for these keywords (~30% CTR assumed)"
                        />
                        <MetricCard
                            label="Avg Score"
                            value={Math.round(cluster.avgOpportunityScore).toString()}
                            tooltip="Average opportunity score: higher means better ROI potential"
                            badge={<Badge color={getScoreColor(cluster.avgOpportunityScore)} size="sm">{cluster.avgOpportunityScore >= 70 ? "High" : cluster.avgOpportunityScore >= 40 ? "Medium" : "Low"}</Badge>}
                        />
                        <MetricCard
                            label="Avg Difficulty"
                            value={cluster.avgDifficulty.toString()}
                            tooltip="Average keyword difficulty (0-100). Lower is easier to rank for"
                            badge={
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyBg(cluster.avgDifficulty)} ${getDifficultyColor(cluster.avgDifficulty)}`}>
                                    {getDifficultyLabel(cluster.avgDifficulty)}
                                </span>
                            }
                        />
                    </div>

                    {/* Strategy recommendation */}
                    <div className="rounded-lg border border-brand-200 bg-brand-25 p-4">
                        <h4 className="text-sm font-semibold text-brand-700 mb-1">
                            Recommended Strategy
                        </h4>
                        <p className="text-sm text-brand-600">
                            {getClusterStrategy(cluster)}
                        </p>
                    </div>

                    {/* Keywords table */}
                    <div>
                        <h3 className="text-sm font-semibold text-primary mb-3">
                            Keywords in this cluster ({cluster.keywords.length}{cluster.keywords.length < cluster.gapCount ? ` of ${cluster.gapCount}` : ""})
                        </h3>
                        <div className="overflow-x-auto rounded-lg border border-secondary">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-secondary bg-secondary-subtle">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">Keyword</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">Score</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">Volume</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">Difficulty</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">Comp. Pos.</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">Est. Traffic</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary">
                                    {cluster.keywords.map((kw, idx) => (
                                        <tr key={idx} className="hover:bg-primary_hover">
                                            <td className="px-4 py-3 font-medium text-primary">{kw.phrase}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Badge color={getScoreColor(kw.opportunityScore)} size="sm">
                                                    {kw.opportunityScore}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right text-secondary">{formatNumber(kw.searchVolume)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyBg(kw.difficulty)} ${getDifficultyColor(kw.difficulty)}`}>
                                                    {kw.difficulty}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-secondary">
                                                {kw.competitorPosition && kw.competitorPosition > 0
                                                    ? `#${kw.competitorPosition}`
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right text-secondary">{formatNumber(kw.estimatedTrafficValue)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    color={kw.status === "monitoring" ? "brand" : kw.status === "ranking" ? "success" : "gray"}
                                                    size="sm"
                                                >
                                                    {kw.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    tooltip,
    badge,
}: {
    label: string;
    value: string;
    tooltip: string;
    badge?: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
            <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-tertiary">{label}</span>
                <Tooltip title={label} description={tooltip}>
                    <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                        <HelpCircle className="size-3.5" />
                    </TooltipTrigger>
                </Tooltip>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xl font-semibold text-primary">{value}</span>
                {badge}
            </div>
        </div>
    );
}

function getClusterStrategy(cluster: ClusterData): string {
    const { avgDifficulty, gapCount, avgOpportunityScore, totalSearchVolume } = cluster;

    if (avgDifficulty < 30 && gapCount >= 5) {
        return `This is a low-competition cluster with ${gapCount} easy keywords. Create a pillar page covering "${cluster.topic}" broadly, then interlink ${gapCount} supporting articles targeting each keyword. Quick wins with high topical authority potential.`;
    }
    if (avgDifficulty < 30) {
        return `Low difficulty keywords — create targeted content for each. Start with the highest-volume keywords and work down. Internal linking between pieces will boost rankings.`;
    }
    if (avgDifficulty < 50 && totalSearchVolume > 5000) {
        return `Moderate difficulty with strong search volume (${formatNumber(totalSearchVolume)}/mo). Build a comprehensive content hub: one authority pillar page + supporting cluster articles. Focus on long-tail variations first to build momentum.`;
    }
    if (avgDifficulty < 50) {
        return `Moderate competition. Prioritize keywords with the highest opportunity scores. Create detailed, well-researched content and ensure strong internal linking between related pages.`;
    }
    if (avgOpportunityScore >= 70) {
        return `High-value cluster despite competition. Build topical authority gradually: start with easier long-tail keywords, create expert-level content, and pursue backlinks. The traffic potential justifies the investment.`;
    }
    return `Competitive cluster — approach strategically. Identify the 2-3 easiest keywords to start with, build authority content, then tackle harder terms as your domain gains strength in this topic.`;
}
