"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
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
  HomeLine
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
  const deleteDomain = useMutation(api.domains.remove);
  const refreshKeywords = useMutation(api.keywords.refreshKeywordPositions);
  const updateDomain = useMutation(api.domains.updateDomain);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    refreshFrequency: "",
    searchEngine: "",
    location: "",
    language: "",
  });

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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDomain({
        domainId,
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
      setEditForm({
        refreshFrequency: domain.settings.refreshFrequency,
        searchEngine: domain.settings.searchEngine,
        location: domain.settings.location,
        language: domain.settings.language,
      });
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
              <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
                <h2 className="text-lg font-semibold text-primary">Visibility Analysis</h2>
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <TrendUp02 className="h-10 w-10 text-fg-quaternary" />
                  <p className="text-sm font-medium text-primary">Visibility tracking coming soon</p>
                  <p className="text-sm text-tertiary">Track your domain's overall search visibility</p>
                </div>
              </div>
            </TabPanel>

            {/* Backlinks Tab */}
            <TabPanel id="backlinks">
              <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
                <h2 className="text-lg font-semibold text-primary">Backlinks</h2>
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Link03 className="h-10 w-10 text-fg-quaternary" />
                  <p className="text-sm font-medium text-primary">Backlink analysis coming soon</p>
                  <p className="text-sm text-tertiary">Monitor your domain's backlink profile</p>
                </div>
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
      <ModalOverlay isOpen={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <Modal>
          <Dialog>
            {({ close }) => (
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">Edit Domain Settings</h2>
                    <p className="mt-1 text-sm text-tertiary">Update refresh frequency and search settings</p>
                  </div>
                  <CloseButton onPress={close} />
                </div>

                <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                  <div>
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

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      Search Engine
                    </label>
                    <Input
                      value={editForm.searchEngine}
                      onChange={(e) => setEditForm({ ...editForm, searchEngine: e.target.value })}
                      placeholder="google.pl"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      Location
                    </label>
                    <Input
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      placeholder="Poland"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      Language
                    </label>
                    <Input
                      value={editForm.language}
                      onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                      placeholder="pl"
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-secondary pt-4">
                    <Button type="button" color="secondary" onClick={close}>
                      Cancel
                    </Button>
                    <Button type="submit" color="primary">
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </main>
  );
}
