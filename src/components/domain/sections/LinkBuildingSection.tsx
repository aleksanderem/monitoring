"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LinkBuildingStatsCards } from "../cards/LinkBuildingStatsCards";
import { LinkBuildingProspectsTable } from "../tables/LinkBuildingProspectsTable";
import { RefreshCw01, Download01 } from "@untitledui/icons";
import { EzIcon } from "@/components/foundations/ez-icon";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { generateLinkBuildingReportPdf } from "@/lib/generateLinkBuildingReportPdf";

interface LinkBuildingSectionProps {
    domainId: Id<"domains">;
    domainName: string;
}

export function LinkBuildingSection({ domainId, domainName }: LinkBuildingSectionProps) {
    const t = useTranslations('backlinks');
    const generateReport = useMutation(api.linkBuilding_mutations.generateLinkBuildingReport);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const stats = useQuery(api.linkBuilding_queries.getProspectStats, { domainId });
    const prospects = useQuery(api.linkBuilding_queries.getTopProspects, { domainId, limit: 200 });
    const channels = useQuery(api.linkBuilding_queries.getProspectsByChannel, { domainId });

    async function handleRefreshProspects() {
        setIsGenerating(true);
        try {
            const result = await generateReport({ domainId });
            toast.success(result.message);
        } catch (err) {
            toast.error(t('toastGenerateReportFailed'));
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleDownloadReport() {
        if (!stats || !prospects || !channels) {
            toast.error(t('downloadReportNoData'));
            return;
        }
        setIsDownloading(true);
        try {
            const blob = await generateLinkBuildingReportPdf({
                stats,
                prospects,
                channels,
                domainName,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `link-building-report-${domainName}-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t('downloadReportSuccess'));
        } catch (err) {
            console.error("PDF generation error:", err);
            toast.error(t('downloadReportFailed'));
        } finally {
            setIsDownloading(false);
        }
    }

    const hasProspects = stats && stats.activeProspects > 0;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                        <EzIcon name="link-06" size={22} color="#4f46e5" strokeColor="#4f46e5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-primary">{t('linkBuildingTitle')}</h2>
                        <p className="text-sm text-tertiary">{t('linkBuildingSubtitle')}</p>
                    </div>
                </div>
                <PermissionGate permission="links.manage">
                    <div className="flex items-center gap-2">
                        {hasProspects && (
                            <button
                                onClick={handleDownloadReport}
                                disabled={isDownloading}
                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Download01 className={`h-4 w-4 ${isDownloading ? "animate-pulse" : ""}`} />
                                {isDownloading ? t('downloadingReport') : t('downloadReport')}
                            </button>
                        )}
                        <button
                            onClick={handleRefreshProspects}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover disabled:opacity-50"
                        >
                            <RefreshCw01 className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                            {isGenerating ? t('refreshingProspects') : t('refreshProspects')}
                        </button>
                    </div>
                </PermissionGate>
            </div>

            {/* Stats Cards */}
            <LinkBuildingStatsCards domainId={domainId} />

            {/* Prospects Table */}
            <LinkBuildingProspectsTable domainId={domainId} />
        </div>
    );
}
