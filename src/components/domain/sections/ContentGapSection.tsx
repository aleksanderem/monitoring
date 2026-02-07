"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { RefreshCw01, Plus } from "@untitledui/icons";
import { toast } from "sonner";
import { SectionLabel } from "@/components/application/section-headers/section-label";
import { AddCompetitorModal } from "../modals/AddCompetitorModal";
import { GapSummaryCards } from "../cards/GapSummaryCards";
import { ContentGapOpportunitiesTable } from "../tables/ContentGapOpportunitiesTable";
import { ContentGapTrendsChart } from "../charts/ContentGapTrendsChart";
import { TopicClustersCard } from "../cards/TopicClustersCard";
import { CompetitorGapComparisonCard } from "../cards/CompetitorGapComparisonCard";

interface ContentGapSectionProps {
    domainId: Id<"domains">;
}

export function ContentGapSection({ domainId }: ContentGapSectionProps) {
    const gapSummary = useQuery(api.contentGaps_queries.getGapSummary, { domainId });
    const competitors = useQuery(api.competitors.getCompetitors, { domainId });
    const createJob = useMutation(api.competitorContentGapJobs.createContentGapJob);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);

    const activeCompetitors = competitors?.filter(c => c.status === "active") ?? [];

    async function handleCompetitorAdded(competitorId: Id<"competitors">, domain: string) {
        try {
            toast.success(`${domain} added — starting content gap analysis...`);
            await createJob({ domainId, competitorId });
        } catch (error: any) {
            toast.error(error?.message || "Failed to start analysis");
        }
    }

    async function handleRefresh() {
        if (activeCompetitors.length === 0) {
            toast.error("No active competitors to analyze. Activate competitors first.");
            return;
        }
        setIsRefreshing(true);
        try {
            await Promise.all(
                activeCompetitors.map(c =>
                    createJob({ domainId, competitorId: c._id })
                )
            );
            toast.success(`Content gap analysis queued for ${activeCompetitors.length} competitor${activeCompetitors.length > 1 ? "s" : ""}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to trigger content gap analysis");
        } finally {
            setIsRefreshing(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <SectionLabel.Root
                    size="md"
                    title="Content Gap Analysis"
                    description="Identify keyword opportunities where competitors rank but you don't"
                    tooltip="Content Gap Analysis"
                    tooltipDescription="Analyzes keywords where your competitors rank in search results but your site does not. These represent opportunities to create new content and capture additional organic traffic."
                />
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        onClick={() => setShowAddDialog(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover"
                    >
                        <Plus className="h-4 w-4" />
                        Add Competitor
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || activeCompetitors.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover disabled:opacity-50"
                    >
                        <RefreshCw01 className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        {isRefreshing ? "Analyzing..." : "Refresh Analysis"}
                    </button>
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
