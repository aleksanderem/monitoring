"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { RefreshCw01, Plus } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SectionLabel } from "@/components/application/section-headers/section-label";
import { AddCompetitorModal } from "../modals/AddCompetitorModal";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { GapSummaryCards } from "../cards/GapSummaryCards";
import { ContentGapOpportunitiesTable } from "../tables/ContentGapOpportunitiesTable";
import { ContentGapTrendsChart } from "../charts/ContentGapTrendsChart";
import { ContentGapBubbleChart } from "../charts/ContentGapBubbleChart";
import { TopicClustersCard } from "../cards/TopicClustersCard";
import { CompetitorGapComparisonCard } from "../cards/CompetitorGapComparisonCard";

interface ContentGapSectionProps {
    domainId: Id<"domains">;
}

export function ContentGapSection({ domainId }: ContentGapSectionProps) {
    const t = useTranslations('competitors');
    const gapSummary = useQuery(api.contentGaps_queries.getGapSummary, { domainId });
    const competitors = useQuery(api.competitors.getCompetitors, { domainId });
    const createJob = useMutation(api.competitorContentGapJobs.createContentGapJob);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);

    const activeCompetitors = competitors?.filter(c => c.status === "active") ?? [];

    async function handleCompetitorAdded(competitorId: Id<"competitors">, domain: string) {
        try {
            toast.success(t('contentGapToastRefreshed'));
            await createJob({ domainId, competitorId });
        } catch (error: any) {
            toast.error(error?.message || t('contentGapToastRefreshFailed'));
        }
    }

    async function handleRefresh() {
        if (activeCompetitors.length === 0) {
            toast.error(t('contentGapToastRefreshFailed'));
            return;
        }
        setIsRefreshing(true);
        try {
            await Promise.all(
                activeCompetitors.map(c =>
                    createJob({ domainId, competitorId: c._id })
                )
            );
            toast.success(t('contentGapToastRefreshed'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('contentGapToastRefreshFailed'));
        } finally {
            setIsRefreshing(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <SectionLabel.Root
                    size="md"
                    title={t('contentGapSectionTitle')}
                    description={t('contentGapSectionSubtitle')}
                    tooltip={t('contentGapSectionTitle')}
                    tooltipDescription={t('contentGapSectionTooltip')}
                />
                <div className="flex shrink-0 items-center gap-2">
                    <PermissionGate permission="competitors.add">
                        <button
                            onClick={() => setShowAddDialog(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover"
                        >
                            <Plus className="h-4 w-4" />
                            {t('contentGapAddCompetitor')}
                        </button>
                    </PermissionGate>
                    <PermissionGate permission="competitors.analyze">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing || activeCompetitors.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover disabled:opacity-50"
                        >
                            <RefreshCw01 className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            {isRefreshing ? t('contentGapAnalyzing') : t('contentGapRefreshAnalysis')}
                        </button>
                    </PermissionGate>
                </div>
            </div>

            {/* Summary Cards */}
            {gapSummary === undefined ? (
                <GapSummaryCards
                    summary={{ totalGaps: 0, highPriority: 0, totalEstimatedValue: 0, competitorsAnalyzed: 0, lastAnalyzedAt: null }}
                    isLoading
                />
            ) : gapSummary ? (
                <GapSummaryCards summary={gapSummary} />
            ) : null}

            {/* Trends + Competitor Comparison */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ContentGapTrendsChart domainId={domainId} />
                <CompetitorGapComparisonCard domainId={domainId} />
            </div>

            {/* Content Gap Bubble Chart */}
            <ContentGapBubbleChart domainId={domainId} />

            {/* Topic Clusters */}
            <TopicClustersCard domainId={domainId} />

            {/* Opportunities Table */}
            <ContentGapOpportunitiesTable domainId={domainId} />

            {/* Add Competitor Dialog */}
            <AddCompetitorModal
                domainId={domainId}
                isOpen={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                onCompetitorAdded={handleCompetitorAdded}
            />
        </div>
    );
}
