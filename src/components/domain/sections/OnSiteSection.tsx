"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Play, AlertCircle, CheckCircle } from "@untitledui/icons";
import { toast } from "sonner";
import { OnSiteHealthCard } from "../cards/OnSiteHealthCard";
import { OnSitePagesTable } from "../tables/OnSitePagesTable";
import { IssuesSummaryCards } from "../cards/IssuesSummaryCards";

interface OnSiteSectionProps {
  domainId: Id<"domains">;
}

export function OnSiteSection({ domainId }: OnSiteSectionProps) {
  const [isScanning, setIsScanning] = useState(false);

  // Queries
  const latestScan = useQuery(api.onSite_queries.getLatestScan, { domainId });
  const latestAnalysis = useQuery(api.onSite_queries.getLatestAnalysis, { domainId });
  const isStale = useQuery(api.onSite_queries.isOnsiteDataStale, { domainId });

  // Action
  const triggerScan = useAction(api.onSite_actions.triggerOnSiteScan);

  const handleStartScan = async () => {
    setIsScanning(true);
    try {
      const result = await triggerScan({ domainId });

      if (result.success) {
        toast.success(
          result.mock
            ? "Mock scan completed (dev mode)"
            : "On-site scan started. This may take 5-30 minutes."
        );
      } else {
        toast.error(result.error || "Failed to start scan");
      }
    } catch (error) {
      toast.error("Failed to start scan");
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  // Show scan in progress state
  const isScanInProgress =
    latestScan?.status === "queued" ||
    latestScan?.status === "crawling" ||
    latestScan?.status === "processing";

  // Show empty state if no data
  if (!latestAnalysis && !isScanInProgress) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-primary-50 rounded-full p-4 mb-4">
          <AlertCircle className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No On-Site Scan Data
        </h3>
        <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
          Run your first on-site SEO audit to analyze technical health, page
          performance, and identify optimization opportunities.
        </p>
        <Button
          size="md"
          hierarchy="primary"
          onClick={handleStartScan}
          disabled={isScanning}
        >
          <Play className="w-4 h-4" />
          {isScanning ? "Starting Scan..." : "Run On-Site Scan"}
        </Button>
        <p className="text-xs text-gray-500 mt-3">
          Scan typically takes 5-30 minutes depending on site size
        </p>
      </div>
    );
  }

  // Show scan in progress state
  if (isScanInProgress) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-warning-50 rounded-full p-4 mb-4 animate-pulse">
          <Play className="w-8 h-8 text-warning-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Scan In Progress
        </h3>
        <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
          {latestScan.status === "queued" && "Your scan is queued and will start shortly."}
          {latestScan.status === "crawling" && "Crawling your website..."}
          {latestScan.status === "processing" && "Processing scan results..."}
        </p>
        <div className="w-full max-w-md">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          This page will update automatically when the scan completes
        </p>
      </div>
    );
  }

  // Show scan failed state
  if (latestScan?.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-error-50 rounded-full p-4 mb-4">
          <AlertCircle className="w-8 h-8 text-error-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Scan Failed
        </h3>
        <p className="text-sm text-gray-600 mb-2 text-center max-w-md">
          {latestScan.error || "The scan encountered an error"}
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Completed at: {new Date(latestScan.completedAt!).toLocaleString()}
        </p>
        <Button
          size="md"
          hierarchy="primary"
          onClick={handleStartScan}
          disabled={isScanning}
        >
          <Play className="w-4 h-4" />
          Retry Scan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with scan action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            On-Site SEO Analysis
          </h2>
          <p className="text-sm text-gray-600">
            Last scanned:{" "}
            {latestAnalysis
              ? new Date(latestAnalysis.fetchedAt).toLocaleDateString()
              : "Never"}
            {isStale && (
              <span className="text-warning-600 ml-2">(Data may be outdated)</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          hierarchy="secondary"
          onClick={handleStartScan}
          disabled={isScanning || isScanInProgress}
        >
          <Play className="w-4 h-4" />
          {isScanning ? "Starting..." : "Run New Scan"}
        </Button>
      </div>

      {/* Health Score and Issue Summary */}
      {latestAnalysis && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <OnSiteHealthCard analysis={latestAnalysis} />
            <IssuesSummaryCards analysis={latestAnalysis} />
          </div>

          {/* Pages Table */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">
              Analyzed Pages
            </h3>
            <OnSitePagesTable
              domainId={domainId}
              scanId={latestScan?._id}
            />
          </div>
        </>
      )}
    </div>
  );
}
