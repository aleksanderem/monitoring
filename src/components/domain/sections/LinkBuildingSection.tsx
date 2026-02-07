"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LinkBuildingStatsCards } from "../cards/LinkBuildingStatsCards";
import { LinkBuildingProspectsTable } from "../tables/LinkBuildingProspectsTable";
import { RefreshCw01 } from "@untitledui/icons";
import { useState } from "react";
import { toast } from "sonner";

interface LinkBuildingSectionProps {
    domainId: Id<"domains">;
}

export function LinkBuildingSection({ domainId }: LinkBuildingSectionProps) {
    const generateReport = useMutation(api.linkBuilding_mutations.generateLinkBuildingReport);
    const [isGenerating, setIsGenerating] = useState(false);

    async function handleGenerate() {
        setIsGenerating(true);
        try {
            const result = await generateReport({ domainId });
            toast.success(result.message);
        } catch (err) {
            toast.error("Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-primary">Link Building Intelligence</h2>
                    <p className="text-sm text-tertiary">Identify and prioritize link building opportunities from competitor analysis</p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-medium text-primary shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                    <RefreshCw01 className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                    {isGenerating ? "Generating..." : "Generate Report"}
                </button>
            </div>

            {/* Stats Cards */}
            <LinkBuildingStatsCards domainId={domainId} />

            {/* Prospects Table */}
            <LinkBuildingProspectsTable domainId={domainId} />
        </div>
    );
}
