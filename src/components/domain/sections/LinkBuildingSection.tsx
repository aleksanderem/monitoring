"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LinkBuildingStatsCards } from "../cards/LinkBuildingStatsCards";
import { LinkBuildingProspectsTable } from "../tables/LinkBuildingProspectsTable";
import { RefreshCw01 } from "@untitledui/icons";
import { EzIcon } from "@/components/foundations/ez-icon";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PermissionGate } from "@/components/auth/PermissionGate";

interface LinkBuildingSectionProps {
    domainId: Id<"domains">;
}

export function LinkBuildingSection({ domainId }: LinkBuildingSectionProps) {
    const t = useTranslations('backlinks');
    const generateReport = useMutation(api.linkBuilding_mutations.generateLinkBuildingReport);
    const [isGenerating, setIsGenerating] = useState(false);

    async function handleGenerate() {
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
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover disabled:opacity-50"
                    >
                        <RefreshCw01 className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                        {isGenerating ? t('generating') : t('generateReport')}
                    </button>
                </PermissionGate>
            </div>

            {/* Stats Cards */}
            <LinkBuildingStatsCards domainId={domainId} />

            {/* Prospects Table */}
            <LinkBuildingProspectsTable domainId={domainId} />
        </div>
    );
}
