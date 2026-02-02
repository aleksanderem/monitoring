"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Play, AlertCircle, XCircle, RefreshCw05, Zap } from "@untitledui/icons";
import { toast } from "sonner";
import { OnSiteHealthCard } from "../cards/OnSiteHealthCard";
import { OnSitePagesTable } from "../tables/OnSitePagesTable";
import { IssuesSummaryCards } from "../cards/IssuesSummaryCards";
import { IssuesBreakdownSection } from "./IssuesBreakdownSection";
import { UrlSelectionModal } from "../modals/UrlSelectionModal";
import { InstantPagesMetrics } from "./InstantPagesMetrics";

interface OnSiteSectionProps {
  domainId: Id<"domains">;
}

export function OnSiteSection({ domainId }: OnSiteSectionProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showUrlSelection, setShowUrlSelection] = useState(false);

  // Queries
  const latestScan = useQuery(api.onSite_queries.getLatestScan, { domainId });
  const latestAnalysis = useQuery(api.onSite_queries.getLatestAnalysis, { domainId });
  const isStale = useQuery(api.onSite_queries.isOnsiteDataStale, { domainId });

  // Mutations
  const triggerScan = useMutation(api.onSite_actions.triggerOnSiteScan);
  const cancelScan = useMutation(api.onSite_actions.cancelOnSiteScan);

  const handleStartScan = async () => {
    setIsScanning(true);
    try {
      const scanId = await triggerScan({ domainId });

      toast.success(
        "On-site scan started. This may take 5-30 minutes.",
        {
          description: "The page will update automatically when the scan completes."
        }
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to start scan");
      }
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCancelScan = async () => {
    if (!latestScan?._id) return;

    setIsCancelling(true);
    try {
      await cancelScan({ scanId: latestScan._id });
      toast.success("Scan cancelled");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to cancel scan");
      }
      console.error(error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefreshStatus = () => {
    toast.success("Refreshing scan status...");
    // Convex queries auto-refresh, this just provides user feedback
  };

  const handleStartInstantPagesScan = () => {
    // Just open the modal - the scan will be created when user confirms URL selection
    console.log("[OnSiteSection] Opening URL selection modal");
    setShowUrlSelection(true);
  };

  const handleUrlSelectionClose = () => {
    setShowUrlSelection(false);
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
        <h3 className="text-lg font-semibold text-primary mb-2">
          No On-Site Scan Data
        </h3>
        <p className="text-sm text-tertiary mb-6 text-center max-w-md">
          Run your first on-site SEO audit to analyze technical health, page
          performance, and identify optimization opportunities.
        </p>
        <Button
          size="md"
          color="primary"
          iconLeading={Play}
          onClick={handleStartScan}
          isDisabled={isScanning}
        >
          {isScanning ? "Starting Scan..." : "Run On-Site Scan"}
        </Button>
        <p className="text-xs text-quaternary mt-3">
          Scan typically takes 5-30 minutes depending on site size
        </p>
      </div>
    );
  }

  // Show scan in progress state
  if (isScanInProgress) {
    // Don't show mock mode warning - if scan exists, credentials are configured
    const isMockMode = false;
    const elapsedTime = Math.floor((Date.now() - latestScan.startedAt) / 1000);
    const elapsedMinutes = Math.floor(elapsedTime / 60);
    const elapsedSeconds = elapsedTime % 60;

    // Calculate progress percentage
    const progressPercentage =
      latestScan.pagesScanned !== undefined && latestScan.totalPagesToScan
        ? Math.round((latestScan.pagesScanned / latestScan.totalPagesToScan) * 100)
        : latestScan.status === "queued"
          ? 5
          : latestScan.status === "crawling"
            ? 50
            : 90;

    // Determine current stage
    const currentStage =
      latestScan.status === "queued"
        ? "1/3"
        : latestScan.status === "crawling"
          ? "2/3"
          : "3/3";

    const stageDescription =
      latestScan.status === "queued"
        ? "Queued - Waiting to start"
        : latestScan.status === "crawling"
          ? "Crawling - Analyzing pages"
          : "Processing - Calculating scores";

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-warning-50 rounded-full p-4 mb-4 animate-pulse">
          <Play className="w-8 h-8 text-warning-600" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          {isMockMode ? "Development Scan In Progress" : "On-Site Audit In Progress"}
        </h3>

        {/* Stage indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-brand-600">Stage {currentStage}</span>
          <span className="text-sm text-tertiary">•</span>
          <span className="text-sm text-secondary">{stageDescription}</span>
        </div>

        <p className="text-sm text-tertiary mb-2 text-center max-w-md">
          {latestScan.status === "queued" && "Your scan is queued and will start shortly."}
          {latestScan.status === "crawling" && (
            isMockMode
              ? "Simulating website crawl (development mode)..."
              : "DataForSEO is crawling your website and analyzing SEO issues..."
          )}
          {latestScan.status === "processing" && "Processing scan results and calculating health score..."}
        </p>

        {/* Scan Details */}
        <div className="bg-secondary rounded-lg p-4 mb-6 w-full max-w-md space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-tertiary">Status:</span>
            <span className="font-medium text-primary capitalize">
              {latestScan.status}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-tertiary">Elapsed Time:</span>
            <span className="font-medium text-primary">
              {elapsedMinutes}m {elapsedSeconds}s
            </span>
          </div>
          {latestScan.pagesScanned !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Pages Crawled:</span>
              <span className="font-medium text-primary">
                {latestScan.pagesScanned}
                {latestScan.totalPagesToScan && ` / ${latestScan.totalPagesToScan}`}
              </span>
            </div>
          )}
          {latestScan.lastProgressUpdate && (
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Last Update:</span>
              <span className="font-medium text-primary">
                {Math.floor((Date.now() - latestScan.lastProgressUpdate) / 1000)}s ago
              </span>
            </div>
          )}
          {latestScan.taskId && (
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Task ID:</span>
              <span className="font-mono text-xs text-secondary">
                {latestScan.taskId}
              </span>
            </div>
          )}
          {latestScan.summary?.totalPages && (
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Pages Found:</span>
              <span className="font-medium text-primary">
                {latestScan.summary.totalPages}
              </span>
            </div>
          )}
          {isMockMode && (
            <div className="text-xs text-warning-600 mt-2 pt-2 border-t border-warning-200">
              ⚠️ Running in mock mode (no DataForSEO credentials)
            </div>
          )}
        </div>

        {/* Progress bar with actual percentage */}
        <div className="w-full max-w-md mb-4">
          <div className="flex items-center justify-between text-xs text-tertiary mb-2">
            <span>Progress</span>
            <span className="font-semibold text-brand-600">{progressPercentage}%</span>
          </div>
          <div className="h-2 bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Page counter - ALWAYS VISIBLE */}
        <div className="text-lg font-semibold text-primary mb-6">
          <span className="text-brand-600">
            {latestScan.pagesScanned ?? latestScan.summary?.totalPages ?? 0}
          </span>
          {latestScan.totalPagesToScan && (
            <>
              <span className="text-tertiary mx-2">/</span>
              <span className="text-secondary">{latestScan.totalPagesToScan}</span>
            </>
          )}
          <span className="text-sm text-tertiary ml-2">pages scanned</span>
        </div>
        <div className="flex gap-3">
          <Button
            size="sm"
            color="secondary"
            iconLeading={RefreshCw05}
            onClick={handleRefreshStatus}
          >
            Refresh Status
          </Button>
          <Button
            size="sm"
            color="tertiary"
            iconLeading={XCircle}
            onClick={handleCancelScan}
            isDisabled={isCancelling}
          >
            {isCancelling ? "Cancelling..." : "Cancel Scan"}
          </Button>
        </div>
        <p className="text-xs text-quaternary mt-3">
          This page will update automatically when the scan completes
        </p>
      </div>
    );
  }

  // Show failed scan banner (but don't block the UI if we have previous data)
  const showFailedBanner = latestScan?.status === "failed" && latestAnalysis;
  const showFailedEmptyState = latestScan?.status === "failed" && !latestAnalysis;

  // Show empty failed state only if no previous data
  if (showFailedEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-error-50 rounded-full p-4 mb-4">
          <AlertCircle className="w-8 h-8 text-error-600" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          Last Scan Failed
        </h3>
        <p className="text-sm text-tertiary mb-2 text-center max-w-md">
          {latestScan.error || "The scan encountered an error"}
        </p>
        <p className="text-xs text-quaternary mb-6">
          Failed at: {new Date(latestScan.completedAt!).toLocaleString()}
        </p>
        <div className="flex gap-2">
          <Button
            size="md"
            color="primary"
            iconLeading={Zap}
            onClick={handleStartInstantPagesScan}
            isDisabled={isScanning}
          >
            Scan Selected Pages
          </Button>
          <Button
            size="md"
            color="secondary"
            iconLeading={Play}
            onClick={handleStartScan}
            isDisabled={isScanning}
          >
            Full Site Scan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Failed scan banner */}
      {showFailedBanner && (
        <div className="bg-error-50 border border-error-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-error-900 mb-1">
                Last scan failed
              </h4>
              <p className="text-sm text-error-700">
                {latestScan.error || "The scan encountered an error"}
              </p>
              <p className="text-xs text-error-600 mt-1">
                Failed at: {new Date(latestScan.completedAt!).toLocaleString()}
              </p>
            </div>
            <Button
              size="sm"
              color="secondary"
              onClick={handleStartScan}
              isDisabled={isScanning}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Header with scan actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            On-Site SEO Analysis
          </h2>
          <p className="text-sm text-tertiary">
            Last scanned:{" "}
            {latestAnalysis
              ? new Date(latestAnalysis.fetchedAt).toLocaleDateString()
              : "Never"}
            {isStale && (
              <span className="text-warning-600 ml-2">(Data may be outdated)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            color="primary"
            iconLeading={Zap}
            onClick={handleStartInstantPagesScan}
            isDisabled={isScanning || isScanInProgress}
          >
            {isScanning ? "Initializing..." : "Scan Selected Pages"}
          </Button>
          <Button
            size="sm"
            color="secondary"
            iconLeading={Play}
            onClick={handleStartScan}
            isDisabled={isScanning || isScanInProgress}
          >
            Full Site Scan
          </Button>
        </div>
      </div>

      {/* URL Selection Modal */}
      {showUrlSelection && (
        <UrlSelectionModal
          domainId={domainId}
          isOpen={showUrlSelection}
          onClose={handleUrlSelectionClose}
          onScanStarted={() => {
            setShowUrlSelection(false);
          }}
        />
      )}


      {/* Health Score and Issue Summary */}
      {latestAnalysis && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <OnSiteHealthCard analysis={latestAnalysis} />
            <IssuesSummaryCards analysis={latestAnalysis} />
          </div>

          {/* Lighthouse Scores and Core Web Vitals (Average from scanned pages) */}
          <InstantPagesMetrics domainId={domainId} scanId={latestScan?._id} />

          {/* Issues Breakdown */}
          <IssuesBreakdownSection
            issues={latestAnalysis.issues}
            scanId={latestScan?._id}
          />

          {/* Pages Table */}
          <div className="bg-primary rounded-lg border border-secondary p-6">
            <h3 className="text-md font-semibold text-primary mb-4">
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
