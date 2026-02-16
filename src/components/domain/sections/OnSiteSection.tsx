"use client";

import { useTranslations } from "next-intl";
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
import { PermissionGate } from "@/components/auth/PermissionGate";
import { InstantPagesMetrics } from "./InstantPagesMetrics";
import { SitemapOverviewCard } from "./SitemapOverviewCard";
import { RobotsAnalysisCard } from "./RobotsAnalysisCard";
import { CrawlSummaryCards } from "../cards/CrawlSummaryCards";
import { CrawlAnalyticsSection } from "./CrawlAnalyticsSection";
import { AuditSectionsBreakdown } from "./AuditSectionsBreakdown";
import { PageScoreOverviewSection } from "./PageScoreOverviewSection";

interface OnSiteSectionProps {
  domainId: Id<"domains">;
}

export function OnSiteSection({ domainId }: OnSiteSectionProps) {
  const t = useTranslations('onsite');
  const tc = useTranslations('common');
  const translateStatus = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as any;
    try { return tc(key); } catch { return status; }
  };
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
        t('scanStarted'),
        {
          description: t('scanStartedDescription')
        }
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t('failedToStartScan'));
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
      toast.success(t('scanCancelled'));
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(t('failedToCancelScan'));
      }
      console.error(error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefreshStatus = () => {
    toast.success(t('refreshingScanStatus'));
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
          {t('noScanData')}
        </h3>
        <p className="text-sm text-tertiary mb-6 text-center max-w-md">
          {t('noScanDataDescription')}
        </p>
        <PermissionGate permission="audit.run">
          <Button
            size="md"
            color="primary"
            iconLeading={Play}
            onClick={handleStartScan}
            isDisabled={isScanning}
          >
            {isScanning ? t('startingScan') : t('runOnSiteScan')}
          </Button>
        </PermissionGate>
        <p className="text-xs text-quaternary mt-3">
          {t('scanTypicalTime')}
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
      if (!status || status === "pending") return { label: t('jobWaiting'), color: "text-tertiary", dot: "bg-gray-400" };
      if (status === "running") return { label: t('jobRunning'), color: "text-warning-600", dot: "bg-warning-500 animate-pulse" };
      if (status === "completed") return { label: t('jobDone'), color: "text-success-600", dot: "bg-success-500" };
      if (status === "failed") return { label: t('jobFailed'), color: "text-error-600", dot: "bg-error-500" };
      return { label: status, color: "text-tertiary", dot: "bg-gray-400" };
    };

    const auditJob = getJobLabel(auditStatus);
    const crawlJob = getJobLabel(crawlStatus);

    // Overall description
    const overallDescription =
      latestScan.status === "queued"
        ? t('scanDescQueued')
        : auditStatus === "running" && crawlStatus === "running"
          ? t('scanDescBothRunning')
          : auditStatus === "completed" && crawlStatus === "running"
            ? t('scanDescAuditDoneCrawling')
            : auditStatus === "running" && crawlStatus === "completed"
              ? t('scanDescCrawlDoneAuditing')
              : latestScan.status === "processing"
                ? t('scanDescProcessing')
                : t('scanDescDefault');

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-warning-50 rounded-full p-4 mb-4 animate-pulse">
          <Play className="w-8 h-8 text-warning-600" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          {t('scanInProgress')}
        </h3>

        {/* Elapsed time */}
        <div className="text-sm text-tertiary mb-4">
          {tc('elapsedTime', { minutes: elapsedMinutes, seconds: elapsedSeconds })}
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
              <span className="text-sm font-medium text-primary">{t('seoAudit')}</span>
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
                ? t('auditProgressFull', { scanned: latestScan.pagesScanned, total: latestScan.totalPagesToScan })
                : latestScan.pagesScanned
                  ? t('auditProgressPartial', { scanned: latestScan.pagesScanned })
                  : t('auditStarting')
            )}
            {auditStatus === "completed" && t('auditDone', { pages: latestScan.pagesScanned ?? "?" })}
            {auditStatus === "pending" && t('auditQueued')}
            {auditStatus === "failed" && (latestScan.error || t('auditErrorOccurred'))}
            {!auditStatus && t('auditNotStarted')}
          </div>

          <div className="border-t border-tertiary" />

          {/* Job 2: Site Crawl */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${crawlJob.dot}`} />
              <span className="text-sm font-medium text-primary">{t('siteCrawl')}</span>
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
            {crawlStatus === "running" && t('crawlRunning', { pages: livePagesCount ?? 0 })}
            {crawlStatus === "completed" && t('crawlDone', { pages: livePagesCount ?? 0 })}
            {crawlStatus === "pending" && t('crawlQueued')}
            {crawlStatus === "failed" && t('crawlFailed')}
            {!crawlStatus && t('auditNotStarted')}
          </div>

          {/* Stats */}
          <div className="border-t border-tertiary pt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-tertiary">{tc('pagesInDb')}</span>
              <span className="font-medium text-primary tabular-nums">{livePagesCount ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tertiary">{tc('scanIdLabel')}</span>
              <span className="font-mono text-[10px] text-quaternary">{latestScan._id}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tertiary">{tc('statusLabel')}</span>
              <span className="font-medium text-primary">{translateStatus(latestScan.status)}</span>
            </div>
            {latestScan.lastProgressUpdate && (
              <div className="flex justify-between text-xs">
                <span className="text-tertiary">{tc('lastUpdate')}</span>
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
            {t('refreshStatus')}
          </Button>
          <Button
            size="sm"
            color="tertiary"
            iconLeading={XCircle}
            onClick={handleCancelScan}
            isDisabled={isCancelling}
          >
            {isCancelling ? t('cancelling') : t('cancelScan')}
          </Button>
        </div>
        <p className="text-xs text-quaternary mt-3">
          {tc('autoUpdateNote')}
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
          {t('lastScanFailed')}
        </h3>
        <p className="text-sm text-tertiary mb-2 text-center max-w-md">
          {latestScan.error || t('scanEncounteredError')}
        </p>
        <p className="text-xs text-quaternary mb-6">
          {t('failedAt', { time: new Date(latestScan.completedAt!).toLocaleString() })}
        </p>
        <PermissionGate permission="audit.run">
          <div className="flex gap-2">
            <Button
              size="md"
              color="primary"
              iconLeading={Zap}
              onClick={handleStartInstantPagesScan}
              isDisabled={isScanning}
            >
              {t('scanSelectedPages')}
            </Button>
            <Button
              size="md"
              color="secondary"
              iconLeading={Play}
              onClick={handleStartScan}
              isDisabled={isScanning}
            >
              {t('fullSiteScan')}
            </Button>
          </div>
        </PermissionGate>
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
                {t('lastScanFailedLower')}
              </h4>
              <p className="text-sm text-error-700">
                {latestScan.error || t('scanEncounteredError')}
              </p>
              <p className="text-xs text-error-600 mt-1">
                {t('failedAt', { time: new Date(latestScan.completedAt!).toLocaleString() })}
              </p>
            </div>
            <Button
              size="sm"
              color="secondary"
              onClick={handleStartScan}
              isDisabled={isScanning}
            >
              {t('retry')}
            </Button>
          </div>
        </div>
      )}

      {/* Header with scan actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {t('onSiteSeoAnalysis')}
          </h2>
          <p className="text-sm text-tertiary">
            {t('lastScanned')}{" "}
            {latestAnalysis
              ? new Date(latestAnalysis.fetchedAt).toLocaleDateString()
              : t('never')}
            {isStale && (
              <span className="text-warning-600 ml-2">({t('dataMayBeOutdated')})</span>
            )}
          </p>
        </div>
        <PermissionGate permission="audit.run">
          <div className="flex gap-2">
            <Button
              size="sm"
              color="primary"
              iconLeading={Zap}
              onClick={handleStartInstantPagesScan}
              isDisabled={isScanning || isScanInProgress}
            >
              {isScanning ? t('initializing') : t('scanSelectedPages')}
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconLeading={Play}
              onClick={handleStartScan}
              isDisabled={isScanning || isScanInProgress}
            >
              {t('fullSiteScan')}
            </Button>
          </div>
        </PermissionGate>
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

          {/* Page Scoring Overview (4-axis breakdown with charts) */}
          <PageScoreOverviewSection analysis={latestAnalysis} />

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
