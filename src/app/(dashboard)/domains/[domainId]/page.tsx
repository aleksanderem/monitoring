"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ArrowLeft,
  Globe01,
  Hash01,
  Edit01,
  Trash01,
  RefreshCw01,
  BarChart03,
  Settings01,
  Link03,
  TrendUp02,
  HomeLine,
  Save01,
  FileCheck02,
  FileSearch02,
  Lightbulb02,
  Users01,
  Lightning01
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading, type Key } from "react-aria-components";
import { Tag, TagGroup, type TagItem, TagList } from "@/components/base/tags/tags";
import { Plus } from "@untitledui/icons";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { MetricsChart04 } from "@/components/application/metrics/metrics";
import { toast } from "sonner";
import { PositionHistoryChart } from "@/components/domain/charts/PositionHistoryChart";
import { ExecutiveSummary } from "@/components/domain/sections/ExecutiveSummary";
import { PositionDistributionChart } from "@/components/domain/charts/PositionDistributionChart";
import { MovementTrendChart } from "@/components/domain/charts/MovementTrendChart";
import { MonitoringStats } from "@/components/domain/sections/MonitoringStats";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";
import { LiveBadge } from "@/components/domain/badges/LiveBadge";
import { Activity } from "@untitledui/icons";
import { VisibilityStats } from "@/components/domain/sections/VisibilityStats";
import { TopKeywordsTable } from "@/components/domain/tables/TopKeywordsTable";
import { AllKeywordsTable } from "@/components/domain/tables/AllKeywordsTable";
import { DiscoveredKeywordsTable } from "@/components/domain/tables/DiscoveredKeywordsTable";
import { Top10KeywordsSection } from "@/components/domain/sections/Top10KeywordsSection";
import { BacklinksSummaryStats } from "@/components/domain/sections/BacklinksSummaryStats";
import { PlatformTypesChart } from "@/components/domain/charts/PlatformTypesChart";
import { LinkAttributesChart } from "@/components/domain/charts/LinkAttributesChart";
import { BacklinksHistoryChart } from "@/components/domain/charts/BacklinksHistoryChart";
import { TLDDistributionTable } from "@/components/domain/tables/TLDDistributionTable";
import { CountriesDistributionTable } from "@/components/domain/tables/CountriesDistributionTable";
import { BacklinksTable } from "@/components/domain/tables/BacklinksTable";
import { BacklinkVelocityChart } from "@/components/domain/charts/BacklinkVelocityChart";
import { VelocityMetricsCards } from "@/components/domain/cards/VelocityMetricsCards";
import { OnSiteSection } from "@/components/domain/sections/OnSiteSection";
import { CompetitorManagementSection } from "@/components/domain/sections/CompetitorManagementSection";
import { CompetitorBacklinksSection } from "@/components/domain/sections/CompetitorBacklinksSection";
import { CompetitorContentAnalysisSection } from "@/components/domain/sections/CompetitorContentAnalysisSection";
import { AddKeywordsModal } from "@/components/domain/modals/AddKeywordsModal";
import { CompetitorOverviewChart } from "@/components/domain/charts/CompetitorOverviewChart";
import { CompetitorKeywordGapTable } from "@/components/domain/tables/CompetitorKeywordGapTable";
import { ForecastSummaryCard } from "@/components/domain/cards/ForecastSummaryCard";
import { CompetitorAnalysisReportsSection } from "@/components/domain/sections/CompetitorAnalysisReportsSection";
import { KeywordMapSection } from "@/components/domain/sections/KeywordMapSection";
import { BacklinkProfileSection } from "@/components/domain/sections/BacklinkProfileSection";
import { LinkBuildingSection } from "@/components/domain/sections/LinkBuildingSection";
import { ContentGapSection } from "@/components/domain/sections/ContentGapSection";
import { InsightsSection } from "@/components/domain/sections/InsightsSection";
import { Target04, LinkExternal02 } from "@untitledui/icons";
import { GenerateReportModal } from "@/components/domain/modals/GenerateReportModal";
import { DomainSetupWizard } from "@/components/domain/onboarding/DomainSetupWizard";
import { OnboardingChecklist } from "@/components/domain/onboarding/OnboardingChecklist";

// Helper to format date
function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Helper to format relative time
function formatRelativeTime(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default function DomainDetailPage() {
  const t = useTranslations('domains');

  const tabs = [
    { id: "overview", label: t('tabOverview'), icon: BarChart03 },
    { id: "monitoring", label: t('tabMonitoring'), icon: Activity },
    { id: "keyword-map", label: t('tabKeywordMap'), icon: Target04 },
    { id: "visibility", label: t('tabVisibility'), icon: TrendUp02 },
    { id: "backlinks", label: t('tabBacklinks'), icon: Link03 },
    { id: "link-building", label: t('tabLinkBuilding'), icon: LinkExternal02 },
    { id: "competitors", label: t('tabCompetitors'), icon: Users01 },
    { id: "keyword-analysis", label: t('tabKeywordAnalysis'), icon: FileSearch02 },
    { id: "on-site", label: t('tabOnSite'), icon: FileCheck02 },
    { id: "content-gaps", label: t('tabContentGaps'), icon: Lightbulb02 },
    { id: "insights", label: t('tabInsights'), icon: Lightning01 },
    { id: "settings", label: t('tabSettings'), icon: Settings01 },
  ];
  const params = useParams();
  const router = useRouter();
  const domainId = params.domainId as Id<"domains">;

  const domain = useQuery(api.domains.getDomain, { domainId });
  const keywords = useQuery(api.keywords.getKeywords, { domainId });
  const projects = useQuery(api.projects.list);
  const deleteDomain = useMutation(api.domains.remove);
  const refreshKeywords = useMutation(api.keywords.refreshKeywordPositions);
  const updateDomain = useMutation(api.domains.updateDomain);

  // Visibility tab queries
  const visibilityStats = useQuery(api.domains.getVisibilityStats, { domainId });
  const top3Keywords = useQuery(api.domains.getTopKeywords, {
    domainId,
    limit: 10,
    positionRange: { min: 1, max: 3 }
  });
  const top10Keywords = useQuery(api.domains.getTopKeywords, {
    domainId,
    limit: 10,
    positionRange: { min: 4, max: 10 }
  });

  // Backlinks tab queries and state
  const backlinksSummary = useQuery(api.backlinks.getBacklinkSummary, { domainId });
  const isBacklinkDataStale = useQuery(api.backlinks.isBacklinkDataStale, { domainId });
  const backlinksDistributions = useQuery(api.backlinks.getBacklinkDistributions, { domainId });
  const fetchBacklinksAction = useAction(api.backlinks.fetchBacklinksFromAPI);

  // Backlink velocity queries
  const velocityHistory = useQuery(api.backlinkVelocity.getVelocityHistory, { domainId, days: 30 });
  const velocityStats = useQuery(api.backlinkVelocity.getVelocityStats, { domainId, days: 30 });
  const velocity7Day = useQuery(api.backlinkVelocity.getVelocityStats, { domainId, days: 7 });

  // Content gaps queries (now handled inside ContentGapSection)

  // Visibility data fetching actions
  const fetchVisibilityAction = useAction(api.dataforseo.fetchAndStoreVisibility);
  const fetchVisibilityHistoryAction = useAction(api.dataforseo.fetchAndStoreVisibilityHistory);

  // Onboarding
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus, { domainId });
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardAutoOpened, setWizardAutoOpened] = useState(false);

  // Auto-open wizard for new domains that haven't completed onboarding
  useEffect(() => {
    if (
      onboardingStatus &&
      !onboardingStatus.isCompleted &&
      !onboardingStatus.isDismissed &&
      !wizardAutoOpened
    ) {
      setIsWizardOpen(true);
      setWizardAutoOpened(true);
    }
  }, [onboardingStatus, wizardAutoOpened]);

  const [isFetchingBacklinks, setIsFetchingBacklinks] = useState(false);
  const [isFetchingVisibility, setIsFetchingVisibility] = useState(false);
  const [isAddKeywordsModalOpen, setIsAddKeywordsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [backlinksPage, setBacklinksPage] = useState(1);
  const backlinksPageSize = 50;

  const backlinksData = useQuery(api.backlinks.getBacklinks, {
    domainId,
    limit: backlinksPageSize,
    offset: (backlinksPage - 1) * backlinksPageSize,
  });

  const handleFetchBacklinks = async () => {
    try {
      setIsFetchingBacklinks(true);
      const result = await fetchBacklinksAction({ domainId });
      toast.success(t('fetchedBacklinks', { count: result.backlinksCount }));
      setBacklinksPage(1); // Reset to first page
    } catch (error) {
      toast.error(t('failedToFetchBacklinks'));
      console.error(error);
    } finally {
      setIsFetchingBacklinks(false);
    }
  };

  const handleFetchVisibility = async () => {
    if (!domain) return;

    try {
      setIsFetchingVisibility(true);
      toast.info(t('fetchingVisibilityData'));

      // Fetch both discovered keywords and visibility history in parallel
      const [visibilityResult, historyResult] = await Promise.all([
        fetchVisibilityAction({
          domainId,
          domain: domain.domain,
          location: domain.settings.location,
          language: domain.settings.language,
        }),
        fetchVisibilityHistoryAction({
          domainId,
          domain: domain.domain,
          location: domain.settings.location,
          language: domain.settings.language,
        }),
      ]);

      const messages: string[] = [];
      if (visibilityResult.success) {
        messages.push(t('discoveredKeywords', { count: visibilityResult.count || 0 }));
      }
      if (historyResult.success) {
        messages.push(t('monthsHistory', { count: historyResult.datesStored || 0 }));
      }

      if (messages.length > 0) {
        toast.success(t('fetchedData', { data: messages.join(", ") }));
      } else {
        toast.error(t('failedToFetchVisibility'));
      }
    } catch (error) {
      toast.error(t('failedToFetchVisibility'));
      console.error(error);
    } finally {
      setIsFetchingVisibility(false);
    }
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    projectId: "" as Id<"projects"> | "",
    tags: [] as TagItem[],
    refreshFrequency: "",
    searchEngine: "",
    location: "",
    language: "",
  });
  const [newTagInput, setNewTagInput] = useState("");

  const handleDelete = async () => {
    try {
      await deleteDomain({ id: domainId });
      toast.success(t('domainDeletedSuccess'));
      router.push("/domains");
    } catch (error) {
      toast.error(t('failedToDeleteDomain'));
      console.error(error);
    }
  };

  const handleRefresh = async () => {
    try {
      if (!keywords || keywords.length === 0) {
        toast.error(t('noKeywordsToRefresh'));
        return;
      }

      const keywordIds = keywords.map(k => k._id);
      await refreshKeywords({ keywordIds });
      toast.success(t('refreshingKeywords', { count: keywords.length }));
    } catch (error) {
      toast.error(t('failedToStartRefresh'));
      console.error(error);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !editForm.tags.some(t => t.label === trimmed)) {
      setEditForm({
        ...editForm,
        tags: [...editForm.tags, { id: `tag-${Date.now()}`, label: trimmed }],
      });
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (keys: Set<Key>) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter(tag => !keys.has(tag.id)),
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDomain({
        domainId,
        projectId: editForm.projectId || undefined,
        tags: editForm.tags.length > 0 ? editForm.tags.map(t => t.label) : undefined,
        settings: {
          refreshFrequency: editForm.refreshFrequency as "daily" | "weekly" | "on_demand",
          searchEngine: editForm.searchEngine,
          location: editForm.location,
          language: editForm.language,
        },
      });
      toast.success(t('domainUpdatedSuccess'));
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error(t('failedToUpdateDomain'));
      console.error(error);
    }
  };

  // Populate form when modal opens
  useEffect(() => {
    if (isEditModalOpen && domain) {
      const tags = (domain.tags || []).map((tag, idx) => ({
        id: `tag-${idx}`,
        label: tag,
      }));
      setEditForm({
        projectId: domain.projectId,
        tags,
        refreshFrequency: domain.settings.refreshFrequency,
        searchEngine: domain.settings.searchEngine,
        location: domain.settings.location,
        language: domain.settings.language,
      });
      setNewTagInput("");
    }
  }, [isEditModalOpen, domain]);

  if (domain === undefined) {
    return (
      <div className="p-8">
        <LoadingState type="card" />
      </div>
    );
  }

  if (domain === null) {
    return (
      <div className="mx-auto flex max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">{t('domainNotFound')}</p>
          <Button size="md" color="secondary" onClick={() => router.push("/domains")} className="mt-4">
            {t('backToDomains')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-3 bg-secondary_subtle pt-8 pb-12 shadow-none lg:gap-8 lg:bg-primary lg:pt-12 lg:pb-24">
      <div className="mx-auto flex w-full max-w-container flex-col gap-5 px-4 lg:px-8">
        {/* Breadcrumbs / Back button */}
        <div className="relative flex flex-col gap-4 border-b border-secondary pb-4">
          <div className="max-lg:hidden">
            <Breadcrumbs type="button">
              <Breadcrumbs.Item href="/" icon={HomeLine} />
              <Breadcrumbs.Item href="/domains">{t('domains')}</Breadcrumbs.Item>
              <Breadcrumbs.Item href="#">{domain.domain}</Breadcrumbs.Item>
            </Breadcrumbs>
          </div>
          <div className="flex lg:hidden">
            <Button href="/domains" color="link-gray" size="md" iconLeading={ArrowLeft}>
              {t('back')}
            </Button>
          </div>

          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Globe01 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-primary lg:text-display-xs">
                  {domain.domain}
                </h1>
                <p className="text-md text-tertiary">
                  {domain.settings.searchEngine} · {domain.settings.refreshFrequency}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip={t('generateFullReport')}
                icon={FileCheck02}
                onClick={() => setIsReportModalOpen(true)}
              />
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip={t('refreshRankings')}
                icon={RefreshCw01}
                onClick={handleRefresh}
              />
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip={t('edit')}
                icon={Edit01}
                onClick={() => setIsEditModalOpen(true)}
              />
              <DeleteConfirmationDialog
                title={`Delete "${domain.domain}"?`}
                description="This will permanently delete the domain and all associated keywords and ranking data. This action cannot be undone."
                confirmLabel="Delete domain"
                onConfirm={handleDelete}
              >
                <ButtonUtility
                  size="sm"
                  color="tertiary"
                  tooltip={t('delete')}
                  icon={Trash01}
                />
              </DeleteConfirmationDialog>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Checklist Banner */}
      <div className="mx-auto w-full max-w-container px-4 lg:px-8">
        <OnboardingChecklist
          domainId={domainId}
          onOpenWizard={() => setIsWizardOpen(true)}
        />
      </div>

      {/* Main content with vertical tabs */}
      <div className="mx-auto w-full max-w-container px-4 lg:px-8">
        <Tabs orientation="vertical" defaultSelectedKey="overview">
          <div className="flex w-full gap-8 lg:gap-16">
            {/* Desktop Sidebar Navigation */}
            <TabList size="sm" type="line" items={tabs} className="w-auto items-start max-lg:hidden" />

            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {/* Mobile Horizontal Navigation */}
              <TabList size="sm" type="line" items={tabs} className="lg:hidden" />

            {/* Overview Tab */}
            <TabPanel id="overview">
              <div className="flex flex-col gap-8">
                {/* Position History Chart */}
                <PositionHistoryChart domainId={domainId} />

                {/* Executive Summary Metrics */}
                <ExecutiveSummary domainId={domainId} />

                {/* Forecast Summary Card */}
                <ForecastSummaryCard domainId={domainId} />

                {/* Placeholder for future sections */}
                <div className="rounded-xl border border-secondary bg-primary p-6">
                  <p className="text-sm text-tertiary">
                    {t('additionalAnalytics')}
                  </p>
                </div>
              </div>
            </TabPanel>

            {/* Monitoring Tab */}
            <TabPanel id="monitoring">
              <div className="flex flex-col gap-8">
                {/* Header with Add Keywords Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-primary">{t('keywordMonitoring')}</h2>
                    <LiveBadge size="md" />
                  </div>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={Plus}
                    onClick={() => setIsAddKeywordsModalOpen(true)}
                  >
                    {t('addKeywords')}
                  </Button>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <PositionDistributionChart domainId={domainId} />
                  <MovementTrendChart domainId={domainId} />
                </div>

                {/* Statistics Section */}
                <MonitoringStats domainId={domainId} />

                {/* Monitoring Table */}
                <KeywordMonitoringTable domainId={domainId} />
              </div>
            </TabPanel>

            {/* Keyword Map Tab */}
            <TabPanel id="keyword-map">
              <KeywordMapSection domainId={domainId} />
            </TabPanel>

            {/* Visibility Tab */}
            <TabPanel id="visibility">
              <div className="flex flex-col gap-6">
                {/* Header with Fetch Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">{t('domainVisibility')}</h2>
                    <p className="text-sm text-tertiary">
                      {t('trackVisibilityDescription')}
                    </p>
                  </div>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={RefreshCw01}
                    onClick={handleFetchVisibility}
                    disabled={isFetchingVisibility || !domain}
                    title={t('fetchCurrentRankings')}
                  >
                    {isFetchingVisibility ? t('fetching') : t('refreshKeywords')}
                  </Button>
                </div>

                {/* Visibility Statistics */}
                <VisibilityStats
                  stats={visibilityStats || {
                    totalKeywords: 0,
                    avgPosition: 0,
                    top3Count: 0,
                    top10Count: 0,
                    top100Count: 0,
                    visibilityScore: 0,
                    visibilityChange: 0,
                  }}
                  isLoading={visibilityStats === undefined}
                />

                {/* Discovered Keywords Table with Rich Data - Full Width */}
                <DiscoveredKeywordsTable domainId={domainId} />

                {/* Top 10 Keywords Section - Full Width */}
                <Top10KeywordsSection
                  keywords={top10Keywords || []}
                  isLoading={top10Keywords === undefined}
                />

                {/* Position Distribution & Movement Trend */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <PositionDistributionChart domainId={domainId} />
                  <MovementTrendChart domainId={domainId} />
                </div>
              </div>
            </TabPanel>

            {/* Backlinks Tab */}
            <TabPanel id="backlinks">
              <div className="flex flex-col gap-6">
                {/* Header with Fetch Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">{t('backlinksAnalysis')}</h2>
                    <p className="text-sm text-tertiary">
                      {backlinksSummary
                        ? `${t('lastUpdated')} ${new Date(backlinksSummary.fetchedAt).toLocaleDateString()}`
                        : t('noDataAvailable')}
                    </p>
                  </div>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={RefreshCw01}
                    onClick={handleFetchBacklinks}
                    disabled={isFetchingBacklinks}
                  >
                    {isFetchingBacklinks ? t('fetching') : t('fetchBacklinks')}
                  </Button>
                </div>

                {/* Summary Statistics */}
                <BacklinksSummaryStats
                  summary={backlinksSummary || null}
                  isLoading={backlinksSummary === undefined}
                />

                {/* Backlinks History Chart */}
                {backlinksSummary && (
                  <BacklinksHistoryChart domainId={domainId} />
                )}

                {/* Backlink Velocity Section */}
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{t('backlinkVelocity')}</h3>
                    <p className="text-sm text-tertiary">
                      {t('trackBacklinkAcquisition')}
                    </p>
                  </div>

                  {/* Velocity Metrics Cards */}
                  <VelocityMetricsCards
                    stats={velocityStats || {
                      avgNewPerDay: 0,
                      avgLostPerDay: 0,
                      avgNetChange: 0,
                      totalNew: 0,
                      totalLost: 0,
                      netChange: 0,
                      daysTracked: 0,
                    }}
                    isLoading={velocityStats === undefined}
                    recentVelocity={velocity7Day?.avgNetChange}
                  />

                  {/* Velocity Chart */}
                  <BacklinkVelocityChart
                    data={velocityHistory || []}
                    isLoading={velocityHistory === undefined}
                  />
                </div>

                {/* Distribution Charts & Tables - 2x2 Grid */}
                {backlinksSummary && backlinksDistributions && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <TLDDistributionTable
                      data={backlinksDistributions.tldDistribution}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <CountriesDistributionTable
                      data={backlinksDistributions.countries}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <LinkAttributesChart
                      data={backlinksDistributions.linkAttributes}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <PlatformTypesChart
                      data={backlinksDistributions.platformTypes}
                      isLoading={backlinksDistributions === undefined}
                    />
                  </div>
                )}

                {/* Individual Backlinks Table */}
                {backlinksSummary && (
                  <BacklinksTable
                    backlinks={
                      backlinksData || {
                        total: 0,
                        items: [],
                        stats: {
                          totalDofollow: 0,
                          totalNofollow: 0,
                          avgRank: 0,
                          avgSpamScore: 0,
                        },
                      }
                    }
                    isLoading={backlinksData === undefined}
                  />
                )}

                {/* Backlink Profile Analysis */}
                <BacklinkProfileSection domainId={domainId} />
              </div>
            </TabPanel>

            {/* Link Building Tab */}
            <TabPanel id="link-building">
              <LinkBuildingSection domainId={domainId} />
            </TabPanel>

            {/* Competitors Tab */}
            <TabPanel id="competitors">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-primary mb-1">{t('competitorTracking')}</h2>
                  <p className="text-sm text-tertiary">
                    {t('monitorCompetitorOpportunities')}
                  </p>
                </div>

                <CompetitorManagementSection domainId={domainId} />

                <CompetitorBacklinksSection domainId={domainId} />

                <CompetitorContentAnalysisSection domainId={domainId} />

                <CompetitorOverviewChart domainId={domainId} />

                <CompetitorKeywordGapTable domainId={domainId} />
              </div>
            </TabPanel>

            {/* Keyword Analysis Tab */}
            <TabPanel id="keyword-analysis">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-primary mb-1">{t('keywordAnalysis')}</h2>
                  <p className="text-sm text-tertiary">
                    {t('deepDiveAnalysisDescription')}
                  </p>
                </div>

                <CompetitorAnalysisReportsSection domainId={domainId} />
              </div>
            </TabPanel>

            {/* On-Site Tab */}
            <TabPanel id="on-site">
              <OnSiteSection domainId={domainId} />
            </TabPanel>

            {/* Content Gaps Tab */}
            <TabPanel id="content-gaps">
              <ContentGapSection domainId={domainId} />
            </TabPanel>

            {/* Insights Tab */}
            <TabPanel id="insights">
              <InsightsSection domainId={domainId} />
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel id="settings">
              <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
                <h2 className="text-lg font-semibold text-primary">{t('settings')}</h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">{t('searchEngine')}</p>
                    <p className="text-sm text-primary">{domain.settings.searchEngine}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">{t('refreshFrequency')}</p>
                    <BadgeWithDot size="sm" color="gray" type="modern">
                      {domain.settings.refreshFrequency}
                    </BadgeWithDot>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">{t('location')}</p>
                    <p className="text-sm text-primary">{domain.settings.location}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">{t('language')}</p>
                    <p className="text-sm text-primary">{domain.settings.language}</p>
                  </div>
                </div>
              </div>
            </TabPanel>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Edit Domain Modal */}
      <ModalOverlay isOpen={isEditModalOpen} onOpenChange={setIsEditModalOpen} isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-160">
              <CloseButton
                onClick={() => setIsEditModalOpen(false)}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max max-sm:hidden">
                  <FeaturedIcon color="gray" size="lg" theme="modern" icon={Settings01} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>

                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t('editDomainSettingsModal')}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">{t('updateSearchSettings', { domain: domain.domain })}</p>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="flex flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('project')}
                    </label>
                    <select
                      value={editForm.projectId}
                      onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value as Id<"projects"> })}
                      className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                    >
                      {projects?.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('tags')}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        size="md"
                        value={newTagInput}
                        onChange={(value) => setNewTagInput(value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder={t('addATag')}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        color="secondary"
                        size="md"
                        iconLeading={Plus}
                        onClick={handleAddTag}
                      >
                        {t('add')}
                      </Button>
                    </div>
                    {editForm.tags.length > 0 && (
                      <div className="mt-3">
                        <TagGroup
                          label="Domain tags"
                          size="md"
                          onRemove={handleRemoveTag}
                        >
                          <TagList className="flex flex-wrap gap-2" items={editForm.tags}>
                            {(item) => <Tag {...item}>{item.label}</Tag>}
                          </TagList>
                        </TagGroup>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('refreshFrequency')}
                    </label>
                    <select
                      value={editForm.refreshFrequency}
                      onChange={(e) => setEditForm({ ...editForm, refreshFrequency: e.target.value })}
                      className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                    >
                      <option value="daily">{t('daily')}</option>
                      <option value="weekly">{t('weekly')}</option>
                      <option value="on_demand">{t('onDemand')}</option>
                    </select>
                  </div>

                  <Input
                    label={t('searchEngine')}
                    size="md"
                    value={editForm.searchEngine}
                    onChange={(value) => setEditForm({ ...editForm, searchEngine: value })}
                    placeholder="google.pl"
                    className="sm:col-span-1"
                  />

                  <Input
                    label={t('location')}
                    size="md"
                    value={editForm.location}
                    onChange={(value) => setEditForm({ ...editForm, location: value })}
                    placeholder="Poland"
                    className="sm:col-span-1"
                  />

                  <Input
                    label={t('language')}
                    size="md"
                    value={editForm.language}
                    onChange={(value) => setEditForm({ ...editForm, language: value })}
                    placeholder="pl"
                    className="sm:col-span-2"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-secondary pt-5">
                  <Button type="button" color="secondary" size="lg" onClick={() => setIsEditModalOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" color="primary" size="lg" iconLeading={Save01}>
                    {t('saveChanges')}
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Add Keywords Modal */}
      <AddKeywordsModal
        domainId={domainId}
        isOpen={isAddKeywordsModalOpen}
        onClose={() => setIsAddKeywordsModalOpen(false)}
      />

      {/* Generate Report Modal */}
      {domain && (
        <GenerateReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          domainId={domainId}
          domainName={domain.domain}
        />
      )}

      {/* Domain Setup Wizard */}
      <DomainSetupWizard
        domainId={domainId}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </main>
  );
}
