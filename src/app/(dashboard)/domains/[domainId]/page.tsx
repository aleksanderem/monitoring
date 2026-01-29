"use client";

import { useState, useEffect } from "react";
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
  RefreshCcw01,
  BarChart03,
  Settings01,
  Link03,
  TrendUp02,
  HomeLine,
  Save01
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
import { BacklinksSummaryStats } from "@/components/domain/sections/BacklinksSummaryStats";
import { TLDDistributionChart } from "@/components/domain/charts/TLDDistributionChart";
import { PlatformTypesChart } from "@/components/domain/charts/PlatformTypesChart";
import { CountriesDistributionChart } from "@/components/domain/charts/CountriesDistributionChart";
import { LinkAttributesChart } from "@/components/domain/charts/LinkAttributesChart";
import { BacklinksTable } from "@/components/domain/tables/BacklinksTable";

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

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart03 },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "visibility", label: "Visibility", icon: TrendUp02 },
  { id: "backlinks", label: "Backlinks", icon: Link03 },
  { id: "settings", label: "Settings", icon: Settings01 },
];

export default function DomainDetailPage() {
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

  const [isFetchingBacklinks, setIsFetchingBacklinks] = useState(false);
  const [backlinksPage, setBacklinksPage] = useState(1);
  const backlinksPageSize = 50;

  const backlinksData = useQuery(api.backlinks.getBacklinks, {
    domainId,
    limit: backlinksPageSize,
    offset: (backlinksPage - 1) * backlinksPageSize,
    sortBy: "rank",
  });

  const handleFetchBacklinks = async () => {
    try {
      setIsFetchingBacklinks(true);
      const result = await fetchBacklinksAction({ domainId });
      toast.success(`Fetched ${result.backlinksCount} backlinks successfully`);
      setBacklinksPage(1); // Reset to first page
    } catch (error) {
      toast.error("Failed to fetch backlinks data");
      console.error(error);
    } finally {
      setIsFetchingBacklinks(false);
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
      toast.success("Domain deleted successfully");
      router.push("/domains");
    } catch (error) {
      toast.error("Failed to delete domain");
      console.error(error);
    }
  };

  const handleRefresh = async () => {
    try {
      if (!keywords || keywords.length === 0) {
        toast.error("No keywords to refresh");
        return;
      }

      const keywordIds = keywords.map(k => k._id);
      await refreshKeywords({ keywordIds });
      toast.success(`Refreshing ${keywords.length} keywords...`);
    } catch (error) {
      toast.error("Failed to start refresh");
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
      toast.success("Domain updated successfully");
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error("Failed to update domain");
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
          <p className="text-lg font-semibold text-primary">Domain not found</p>
          <Button size="md" color="secondary" onClick={() => router.push("/domains")} className="mt-4">
            Back to Domains
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
              <Breadcrumbs.Item href="/domains">Domains</Breadcrumbs.Item>
              <Breadcrumbs.Item href="#">{domain.domain}</Breadcrumbs.Item>
            </Breadcrumbs>
          </div>
          <div className="flex lg:hidden">
            <Button href="/domains" color="link-gray" size="md" iconLeading={ArrowLeft}>
              Back
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
                tooltip="Refresh rankings"
                icon={RefreshCcw01}
                onClick={handleRefresh}
              />
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip="Edit"
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
                  tooltip="Delete"
                  icon={Trash01}
                />
              </DeleteConfirmationDialog>
            </div>
          </div>
        </div>
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

                {/* Placeholder for future sections */}
                <div className="rounded-xl border border-secondary bg-primary p-6">
                  <p className="text-sm text-tertiary">
                    Additional analytics coming soon: Recent changes, alerts, performance tables
                  </p>
                </div>
              </div>
            </TabPanel>

            {/* Monitoring Tab */}
            <TabPanel id="monitoring">
              <div className="flex flex-col gap-8">
                {/* Page Title with Live Badge */}
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-primary">Keyword Monitoring</h2>
                  <LiveBadge size="md" />
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

            {/* Visibility Tab */}
            <TabPanel id="visibility">
              <div className="flex flex-col gap-6">
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

                {/* Top Keywords Tables */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <TopKeywordsTable
                    keywords={top3Keywords || []}
                    title="Top 3 Rankings"
                    description="Keywords ranking in positions 1-3"
                    isLoading={top3Keywords === undefined}
                  />
                  <TopKeywordsTable
                    keywords={top10Keywords || []}
                    title="Top 10 Rankings"
                    description="Keywords ranking in positions 4-10"
                    isLoading={top10Keywords === undefined}
                  />
                </div>

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
                    <h2 className="text-lg font-semibold text-primary">Backlinks Analysis</h2>
                    <p className="text-sm text-tertiary">
                      {backlinksSummary
                        ? `Last updated: ${new Date(backlinksSummary.fetchedAt).toLocaleDateString()}`
                        : "No data available"}
                    </p>
                  </div>
                  <Button
                    size="md"
                    iconLeading={RefreshCcw01}
                    onClick={handleFetchBacklinks}
                    disabled={isFetchingBacklinks}
                  >
                    {isFetchingBacklinks ? "Fetching..." : "Fetch Backlinks"}
                  </Button>
                </div>

                {/* Summary Statistics */}
                <BacklinksSummaryStats
                  summary={backlinksSummary || null}
                  isLoading={backlinksSummary === undefined}
                />

                {/* Distribution Charts - 2x2 Grid */}
                {backlinksSummary && backlinksDistributions && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <TLDDistributionChart
                      data={backlinksDistributions.tldDistribution}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <PlatformTypesChart
                      data={backlinksDistributions.platformTypes}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <CountriesDistributionChart
                      data={backlinksDistributions.countries}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <LinkAttributesChart
                      data={backlinksDistributions.linkAttributes}
                      isLoading={backlinksDistributions === undefined}
                    />
                  </div>
                )}

                {/* Individual Backlinks Table */}
                {backlinksSummary && (
                  <BacklinksTable
                    backlinks={backlinksData || null}
                    isLoading={backlinksData === undefined}
                    currentPage={backlinksPage}
                    pageSize={backlinksPageSize}
                    onPageChange={setBacklinksPage}
                  />
                )}
              </div>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel id="settings">
              <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
                <h2 className="text-lg font-semibold text-primary">Settings</h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Search Engine</p>
                    <p className="text-sm text-primary">{domain.settings.searchEngine}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Refresh Frequency</p>
                    <BadgeWithDot size="sm" color="gray" type="modern">
                      {domain.settings.refreshFrequency}
                    </BadgeWithDot>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Location</p>
                    <p className="text-sm text-primary">{domain.settings.location}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Language</p>
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
                    Edit Domain Settings
                  </AriaHeading>
                  <p className="text-sm text-tertiary">Update refresh frequency and search settings for {domain.domain}</p>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="flex flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      Project
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
                      Tags
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
                        placeholder="Add a tag..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        color="secondary"
                        size="md"
                        iconLeading={Plus}
                        onClick={handleAddTag}
                      >
                        Add
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
                      Refresh Frequency
                    </label>
                    <select
                      value={editForm.refreshFrequency}
                      onChange={(e) => setEditForm({ ...editForm, refreshFrequency: e.target.value })}
                      className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="on_demand">On Demand</option>
                    </select>
                  </div>

                  <Input
                    label="Search Engine"
                    size="md"
                    value={editForm.searchEngine}
                    onChange={(value) => setEditForm({ ...editForm, searchEngine: value })}
                    placeholder="google.pl"
                    className="sm:col-span-1"
                  />

                  <Input
                    label="Location"
                    size="md"
                    value={editForm.location}
                    onChange={(value) => setEditForm({ ...editForm, location: value })}
                    placeholder="Poland"
                    className="sm:col-span-1"
                  />

                  <Input
                    label="Language"
                    size="md"
                    value={editForm.language}
                    onChange={(value) => setEditForm({ ...editForm, language: value })}
                    placeholder="pl"
                    className="sm:col-span-2"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-secondary pt-5">
                  <Button type="button" color="secondary" size="lg" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" color="primary" size="lg" iconLeading={Save01}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </main>
  );
}
