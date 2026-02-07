"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
    AlertTriangle,
    TrendUp02,
    TrendDown02,
    Target04,
    Link03,
    FileCheck02,
    Lightbulb02,
    ArrowRight,
    CheckCircle,
    AlertCircle,
} from "@untitledui/icons";

interface InsightsSectionProps {
    domainId: Id<"domains">;
}

function HealthScoreRing({ score, max }: { score: number; max: number }) {
    const percentage = Math.round((score / max) * 100);
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const color =
        percentage >= 70 ? "#10b981" :
        percentage >= 40 ? "#f59e0b" :
        "#ef4444";

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width="132" height="132" viewBox="0 0 132 132">
                <circle cx="66" cy="66" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="10" />
                <circle
                    cx="66"
                    cy="66"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 66 66)"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold text-primary">{score}</span>
                <span className="text-xs text-tertiary">/ {max}</span>
            </div>
        </div>
    );
}

const CATEGORY_ICONS: Record<string, typeof AlertTriangle> = {
    keywords: Target04,
    backlinks: Link03,
    onsite: FileCheck02,
    content: Lightbulb02,
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    high: { bg: "bg-utility-error-50", text: "text-utility-error-700", dot: "bg-utility-error-500" },
    medium: { bg: "bg-utility-warning-50", text: "text-utility-warning-700", dot: "bg-utility-warning-500" },
    low: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
};

export function InsightsSection({ domainId }: InsightsSectionProps) {
    const healthScore = useQuery(api.insights_queries.getDomainHealthScore, { domainId });
    const keywordInsights = useQuery(api.insights_queries.getKeywordInsights, { domainId });
    const backlinkInsights = useQuery(api.insights_queries.getBacklinkInsights, { domainId });
    const recommendations = useQuery(api.insights_queries.getRecommendations, { domainId });

    const isLoading = healthScore === undefined || keywordInsights === undefined ||
        backlinkInsights === undefined || recommendations === undefined;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold text-primary mb-1">Insights & Recommendations</h2>
                    <p className="text-sm text-tertiary">AI-powered analysis of your SEO performance</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 animate-pulse rounded-xl border border-secondary bg-gray-50" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-primary mb-1">Insights & Recommendations</h2>
                <p className="text-sm text-tertiary">
                    Aggregated intelligence from keywords, backlinks, content, and technical SEO
                </p>
            </div>

            {/* Health Score + Breakdown */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Score Ring */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary mb-3">Domain Health</h3>
                    {healthScore ? (
                        <>
                            <HealthScoreRing score={healthScore.totalScore} max={healthScore.maxScore} />
                            <p className="mt-2 text-sm text-tertiary">
                                {healthScore.totalScore >= 70 ? "Good overall health" :
                                 healthScore.totalScore >= 40 ? "Room for improvement" :
                                 "Needs attention"}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-tertiary">No data available</p>
                    )}
                </div>

                {/* Score Breakdown */}
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary mb-4">Score Breakdown</h3>
                    {healthScore ? (
                        <div className="space-y-3">
                            {Object.entries(healthScore.breakdown).map(([key, data]) => {
                                const percentage = Math.round((data.score / data.max) * 100);
                                const color =
                                    percentage >= 70 ? "bg-utility-success-500" :
                                    percentage >= 40 ? "bg-utility-warning-500" :
                                    "bg-utility-error-500";
                                return (
                                    <div key={key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-primary">{data.label}</span>
                                            <span className="text-sm font-medium text-primary">{data.score}/{data.max}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-secondary">
                                            <div
                                                className={`h-full rounded-full ${color}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-tertiary">No data available</p>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary mb-4">Key Metrics</h3>
                    {healthScore?.stats ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-tertiary">Tracked Keywords</span>
                                <span className="text-sm font-medium text-primary">{healthScore.stats.totalKeywords}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-tertiary">Avg. Position</span>
                                <span className="text-sm font-medium text-primary">
                                    {healthScore.stats.avgPosition ?? "—"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-tertiary">7d Movement</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-utility-success-600">{healthScore.stats.improving} up</span>
                                    <span className="text-xs text-utility-error-600">{healthScore.stats.declining} down</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-tertiary">Backlinks</span>
                                <span className="text-sm font-medium text-primary">
                                    {healthScore.stats.totalBacklinks.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-tertiary">Referring Domains</span>
                                <span className="text-sm font-medium text-primary">
                                    {healthScore.stats.referringDomains}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-tertiary">Content Gaps</span>
                                <span className="text-sm font-medium text-primary">{healthScore.stats.contentGaps}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-tertiary">No data available</p>
                    )}
                </div>
            </div>

            {/* Keyword Insights */}
            {keywordInsights && (keywordInsights.atRisk.length > 0 || keywordInsights.opportunities.length > 0 || keywordInsights.nearPage1.length > 0) && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* At Risk */}
                    {keywordInsights.atRisk.length > 0 && (
                        <div className="rounded-xl border border-secondary bg-primary p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendDown02 className="h-4 w-4 text-utility-error-500" />
                                <h3 className="text-md font-semibold text-utility-error-600">At Risk ({keywordInsights.atRisk.length})</h3>
                            </div>
                            <p className="text-xs text-tertiary mb-3">Keywords that dropped 5+ positions this week</p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {keywordInsights.atRisk.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                                        <span className="text-sm text-primary truncate max-w-[60%]">{item.keyword}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-tertiary">#{item.previousPosition}</span>
                                            <ArrowRight className="h-3 w-3 text-tertiary" />
                                            <span className="text-sm font-medium text-primary">#{item.currentPosition}</span>
                                            <span className="rounded-full bg-utility-error-50 px-1.5 py-0.5 text-xs font-medium text-utility-error-600">
                                                -{item.drop}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Opportunities */}
                    {keywordInsights.opportunities.length > 0 && (
                        <div className="rounded-xl border border-secondary bg-primary p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendUp02 className="h-4 w-4 text-utility-success-500" />
                                <h3 className="text-md font-semibold text-utility-success-600">Rising ({keywordInsights.opportunities.length})</h3>
                            </div>
                            <p className="text-xs text-tertiary mb-3">Keywords that gained 5+ positions this week</p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {keywordInsights.opportunities.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                                        <span className="text-sm text-primary truncate max-w-[60%]">{item.keyword}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-tertiary">#{item.previousPosition}</span>
                                            <ArrowRight className="h-3 w-3 text-tertiary" />
                                            <span className="text-sm font-medium text-primary">#{item.currentPosition}</span>
                                            <span className="rounded-full bg-utility-success-50 px-1.5 py-0.5 text-xs font-medium text-utility-success-600">
                                                +{item.gain}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Near Page 1 */}
                    {keywordInsights.nearPage1.length > 0 && (
                        <div className="rounded-xl border border-secondary bg-primary p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Target04 className="h-4 w-4 text-brand-primary" />
                                <h3 className="text-md font-semibold text-primary">Near Page 1 ({keywordInsights.nearPage1.length})</h3>
                            </div>
                            <p className="text-xs text-tertiary mb-3">Keywords on page 2 that could reach page 1</p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {keywordInsights.nearPage1.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                                        <span className="text-sm text-primary truncate max-w-[60%]">{item.keyword}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-primary">#{item.position}</span>
                                            {item.searchVolume && (
                                                <span className="text-xs text-tertiary">{item.searchVolume.toLocaleString()} vol</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Backlink Summary */}
            {backlinkInsights && (
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary mb-4">Backlink Health</h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">Total</span>
                            <span className="text-lg font-semibold text-primary">{backlinkInsights.totalBacklinks.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">Ref. Domains</span>
                            <span className="text-lg font-semibold text-primary">{backlinkInsights.referringDomains}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">Dofollow</span>
                            <span className="text-lg font-semibold text-primary">{backlinkInsights.dofollowRatio}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">Toxic</span>
                            <span className={`text-lg font-semibold ${backlinkInsights.toxicCount > 10 ? "text-utility-error-600" : "text-primary"}`}>
                                {backlinkInsights.toxicCount}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">Toxic %</span>
                            <span className={`text-lg font-semibold ${backlinkInsights.toxicPercentage > 10 ? "text-utility-error-600" : "text-primary"}`}>
                                {backlinkInsights.toxicPercentage}%
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">New</span>
                            <span className="text-lg font-semibold text-utility-success-600">+{backlinkInsights.newBacklinks}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-tertiary">Prospects</span>
                            <span className="text-lg font-semibold text-brand-secondary">{backlinkInsights.activeProspects}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Actionable Recommendations */}
            {recommendations && recommendations.length > 0 && (
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary mb-4">Actionable Recommendations</h3>
                    <div className="space-y-3">
                        {recommendations.map((rec, i) => {
                            const Icon = CATEGORY_ICONS[rec.category] || Lightbulb02;
                            const style = PRIORITY_STYLES[rec.priority];
                            return (
                                <div key={i} className="flex items-start gap-3 rounded-lg border border-secondary p-4">
                                    <div className={`rounded-lg p-2 ${style.bg}`}>
                                        <Icon className={`h-4 w-4 ${style.text}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-medium text-primary">{rec.title}</span>
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                                                {rec.priority}
                                            </span>
                                        </div>
                                        <p className="text-sm text-tertiary">{rec.description}</p>
                                    </div>
                                    {rec.metric && (
                                        <span className="shrink-0 text-sm font-medium text-tertiary">{rec.metric}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {(!recommendations || recommendations.length === 0) && !keywordInsights?.atRisk.length && !keywordInsights?.opportunities.length && (
                <div className="rounded-xl border border-secondary bg-primary p-12 text-center">
                    <CheckCircle className="h-12 w-12 text-utility-success-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-primary mb-1">Looking good!</p>
                    <p className="text-sm text-tertiary">
                        No critical issues detected. Keep monitoring for changes.
                    </p>
                </div>
            )}
        </div>
    );
}
