"use client";

import { useState, useRef, useEffect } from "react";
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
import { SitemapOverviewCard } from "./SitemapOverviewCard";
import { RobotsAnalysisCard } from "./RobotsAnalysisCard";
import { CrawlSummaryCards } from "../cards/CrawlSummaryCards";
import { CrawlAnalyticsSection } from "./CrawlAnalyticsSection";
import { AuditSectionsBreakdown } from "./AuditSectionsBreakdown";

interface OnSiteSectionProps {
  domainId: Id<"domains">;
}

export function OnSiteSection({ domainId }: OnSiteSectionProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showUrlSelection, setShowUrlSelection] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"critical" | "warning" | "recommendation" | null>(null);
  const issuesBreakdownRef = useRef<HTMLDivElement>(null);

  // Queries
  const latestScan = useQuery(api.seoAudit_queries.getLatestScan, { domainId });
  const latestAnalysis = useQuery(api.seoAudit_queries.getLatestAnalysis, { domainId });
  const isStale = useQuery(api.seoAudit_queries.isOnsiteDataStale, { domainId });
  const fullAuditData = useQuery(api.seoAudit_queries.getFullAuditSections, { domainId });
  const livePagesCount = useQuery(
    api.seoAudit_queries.getScanPagesCount,
    latestScan?._id ? { scanId: latestScan._id } : "skip"
  );

  // Mutations
  const triggerScan = useMutation(api.seoAudit_actions.triggerSeoAuditScan);
  const cancelScan = useMutation(api.seoAudit_actions.cancelSeoAuditScan);

  const handleStartScan = async () => {
    setIsScanning(true);
    try {
      const scanId = await triggerScan({ domainId });

      toast.success(
        "SEO audit scan started. This typically takes 1-5 minutes.",
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

  // Timer for elapsed time display
  const [tick, setTick] = useState(0);
  const isScanInProgress =
    latestScan?.status === "queued" ||
    latestScan?.status === "crawling" ||
    latestScan?.status === "processing";

  useEffect(() => {
    if (!isScanInProgress) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isScanInProgress]);

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
          Scan typically takes 1-5 minutes depending on site size
        </p>
      </div>
    );
  }

  // Show scan in progress state
  if (isScanInProgress) {
    const elapsedTime = Math.floor((Date.now() - latestScan.startedAt) / 1000);
    const elapsedMinutes = Math.floor(elapsedTime / 60);
    const elapsedSeconds = elapsedTime % 60;

    // Calculate progress percentage based on dual-job status + real progress data
    const bothDone =
      latestScan.seoAuditStatus === "completed" && latestScan.advertoolsCrawlStatus === "completed";
    const oneDone =
      latestScan.seoAuditStatus === "completed" || latestScan.advertoolsCrawlStatus === "completed";

    // Use real progress from audit job when available
    const auditProgress = latestScan.pagesScanned && latestScan.totalPagesToScan
      ? Math.min(95, Math.round((latestScan.pagesScanned / latestScan.totalPagesToScan) * 50))
      : null;

    const progressPercentage = bothDone
      ? 95
      : oneDone
        ? 65
        : auditProgress !== null
          ? auditProgress + 5 // 5-55% range for audit progress
          : latestScan.status === "queued"
            ? 5
            : latestScan.status === "crawling"
              ? 25
              : 80;

    // Descriptive status for each sub-job
    const auditStatus = latestScan.seoAuditStatus;
    const crawlStatus = latestScan.advertoolsCrawlStatus;

    const getJobLabel = (status: string | undefined) => {
      if (!status || status === "pending") return { label: "Waiting...", color: "text-tertiary", dot: "bg-gray-400" };
      if (status === "running") return { label: "Running", color: "text-warning-600", dot: "bg-warning-500 animate-pulse" };
      if (status === "completed") return { label: "Done", color: "text-success-600", dot: "bg-success-500" };
      if (status === "failed") return { label: "Failed", color: "text-error-600", dot: "bg-error-500" };
      return { label: status, color: "text-tertiary", dot: "bg-gray-400" };
    };

    const auditJob = getJobLabel(auditStatus);
    const crawlJob = getJobLabel(crawlStatus);

    // Overall description
    const overallDescription =
      latestScan.status === "queued"
        ? "Starting scan — queuing SEO audit and site crawl..."
        : auditStatus === "running" && crawlStatus === "running"
          ? "Two parallel jobs running: SEO audit (homepage checks) and site crawl (discovering all pages)..."
          : auditStatus === "completed" && crawlStatus === "running"
            ? "SEO audit finished. Site crawl still discovering and indexing pages — this takes 2-5 minutes..."
            : auditStatus === "running" && crawlStatus === "completed"
              ? "Site crawl finished. SEO audit still processing..."
              : latestScan.status === "processing"
                ? "Both jobs done. Running post-crawl analytics (links, images, redirects, word frequency, robots)..."
                : "Processing...";

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-warning-50 rounded-full p-4 mb-4 animate-pulse">
          <Play className="w-8 h-8 text-warning-600" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          Site Scan In Progress
        </h3>

        {/* Elapsed time */}
        <div className="text-sm text-tertiary mb-4">
          {elapsedMinutes}m {elapsedSeconds}s elapsed
        </div>

        {/* Overall description */}
        <p className="text-sm text-secondary mb-6 text-center max-w-md">
          {overallDescription}
        </p>

        {/* Dual-job status panel */}
        <div className="bg-secondary rounded-lg p-4 mb-6 w-full max-w-lg space-y-3">
          {/* Job 1: SEO Audit */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${auditJob.dot}`} />
              <span className="text-sm font-medium text-primary">SEO Audit</span>
            </div>
            <span className={`text-sm font-medium ${auditJob.color}`}>
              {auditJob.label}
            </span>
          </div>
          {/* Audit job ID */}
          {(latestScan.fullAuditJobId || latestScan.seoAuditJobId) && (
            <div className="text-[10px] text-quaternary pl-4 font-mono">
              job: {latestScan.fullAuditJobId || latestScan.seoAuditJobId}
            </div>
          )}
          <div className="text-xs text-quaternary pl-4">
            {auditStatus === "running" && (
              latestScan.pagesScanned && latestScan.totalPagesToScan
                ? `Auditing: ${latestScan.pagesScanned} of ${latestScan.totalPagesToScan} pages checked`
                : latestScan.pagesScanned
                  ? `Auditing: ${latestScan.pagesScanned} pages checked so far`
                  : "Starting full site audit (use_sitemap, max 100 pages)..."
            )}
            {auditStatus === "completed" && `Done — ${latestScan.pagesScanned ?? "?"} pages analyzed`}
            {auditStatus === "pending" && "Queued, waiting for sitemap/robots fetch to finish"}
            {auditStatus === "failed" && (latestScan.error || "An error occurred during the audit")}
            {!auditStatus && "Not started"}
          </div>

          <div className="border-t border-tertiary" />

          {/* Job 2: Site Crawl */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${crawlJob.dot}`} />
              <span className="text-sm font-medium text-primary">Site Crawl</span>
            </div>
            <span className={`text-sm font-medium ${crawlJob.color}`}>
              {crawlJob.label}
            </span>
          </div>
          {/* Crawl job ID */}
          {latestScan.advertoolsCrawlJobId && (
            <div className="text-[10px] text-quaternary pl-4 font-mono">
              job: {latestScan.advertoolsCrawlJobId}
            </div>
          )}
          <div className="text-xs text-quaternary pl-4">
            {crawlStatus === "running" && `Crawling site (depth 2, max 100 pages)... ${livePagesCount ? `${livePagesCount} pages found` : ""}`}
            {crawlStatus === "completed" && `Done — ${livePagesCount ?? 0} pages crawled and stored`}
            {crawlStatus === "pending" && "Queued, will start after audit kicks off"}
            {crawlStatus === "failed" && "Crawl failed (audit results still available)"}
            {!crawlStatus && "Not started"}
          </div>

          {/* Stats */}
          <div className="border-t border-tertiary pt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-tertiary">Pages in DB:</span>
              <span className="font-medium text-primary tabular-nums">{livePagesCount ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tertiary">Scan ID:</span>
              <span className="font-mono text-[10px] text-quaternary">{latestScan._id}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tertiary">Status:</span>
              <span className="font-medium text-primary">{latestScan.status}</span>
            </div>
            {latestScan.lastProgressUpdate && (
              <div className="flex justify-between text-xs">
                <span className="text-tertiary">Last update:</span>
                <span className="text-quaternary">{new Date(latestScan.lastProgressUpdate).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-6">
          <div className="h-2 bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
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
            <IssuesSummaryCards
              analysis={latestAnalysis}
              onShowIssues={(severity) => {
                setSeverityFilter(severity);
                setTimeout(() => {
                  issuesBreakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
            />
          </div>

          {/* Sitemap & Robots Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SitemapOverviewCard domainId={domainId} />
            <RobotsAnalysisCard domainId={domainId} />
          </div>

          {/* Crawl Summary Cards (avg word count, load time, links, etc.) */}
          <CrawlSummaryCards domainId={domainId} />

          {/* Lighthouse Scores and Core Web Vitals (Average from scanned pages) */}
          <InstantPagesMetrics domainId={domainId} scanId={latestScan?._id} />

          {/* Issues Breakdown — Full Audit sections or legacy */}
          <div ref={issuesBreakdownRef}>
            {fullAuditData?.sections ? (
              <AuditSectionsBreakdown
                sections={fullAuditData.sections}
                recommendations={fullAuditData.recommendations}
              />
            ) : (
              <IssuesBreakdownSection
                issues={latestAnalysis.issues}
                scanId={latestScan?._id}
                severityFilter={severityFilter}
                onClearFilter={() => setSeverityFilter(null)}
              />
            )}
          </div>

          {/* Pages Table */}
          <OnSitePagesTable
            domainId={domainId}
            scanId={latestScan?._id}
          />

          {/* Crawl Analytics (Links, Redirects, Images, Word Freq, Robots Test) */}
          <CrawlAnalyticsSection domainId={domainId} />
        </>
      )}
    </div>
  );
}
