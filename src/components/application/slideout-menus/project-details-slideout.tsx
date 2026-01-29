"use client";

import { useState } from "react";
import { Folder, Globe01, Hash01, Edit01, Trash01, Settings01, FileCheck02, Send01 } from "@untitledui/icons";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { MetricsChart04 } from "@/components/application/metrics/metrics";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface ProjectDetailsSlideoutProps {
  projectId: Id<"projects">;
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}

const tabs = [
  {
    id: "overview",
    value: "overview",
    label: "Overview",
  },
  {
    id: "domains",
    value: "domains",
    label: "Domains",
  },
  {
    id: "activity",
    value: "activity",
    label: "Activity",
  },
];

export function ProjectDetailsSlideout({
  projectId,
  children,
  onEdit,
  onDelete,
}: ProjectDetailsSlideoutProps) {
  const [isOpen, setIsOpen] = useState(false);

  const project = useQuery(api.projects.getProject, { projectId });
  const domains = useQuery(api.projects.getDomains, { projectId });

  // TODO: Check if reports are configured
  const hasConfiguredReports = false;

  // Helper to format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper to format relative time
  const formatRelativeTime = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <SlideoutMenu.Trigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children}

      <SlideoutMenu isDismissable dialogClassName="gap-0">
        <SlideoutMenu.Header
          onClose={() => setIsOpen(false)}
          className="relative flex w-full flex-col gap-5 p-4 pt-6 shadow-[0px_1px_0px_0px] shadow-border-secondary_alt md:pr-3 md:pl-6"
        >
          <section className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Folder className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-md font-semibold text-primary md:text-lg">
                {project?.name || "Loading..."}
              </h1>
              <p className="text-sm text-tertiary">
                Created {project ? formatRelativeTime(project.createdAt) : ""}
              </p>
            </div>
            <span className="flex gap-0.5">
              <ButtonUtility
                size="xs"
                color="tertiary"
                tooltip="Edit"
                icon={Edit01}
                onClick={() => {
                  toast.info("Edit dialog coming soon");
                  onEdit?.();
                }}
              />
              <ButtonUtility
                size="xs"
                color="tertiary"
                tooltip="Delete"
                icon={Trash01}
                onClick={() => {
                  onDelete?.();
                }}
              />
            </span>
          </section>

          <Tabs defaultSelectedKey="overview">
            <TabList items={tabs} size="sm" fullWidth type="button-minimal" />
          </Tabs>
        </SlideoutMenu.Header>

        <SlideoutMenu.Content>
          {project && (
            <Tabs defaultSelectedKey="overview">
              <TabPanel id="overview">
                {/* Summary section with icons */}
                <section className="flex items-center justify-between py-[15px]">
                  <BadgeWithDot size="md" type="modern" color="success">
                    Active
                  </BadgeWithDot>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Globe01 className="h-5 w-5 text-fg-quaternary" />
                      <p className="text-2xl font-semibold text-primary">{project.domainCount}</p>
                    </div>
                    <span className="h-10 border-l border-secondary" />
                    <div className="flex items-center gap-2">
                      <Hash01 className="h-5 w-5 text-fg-quaternary" />
                      <p className="text-2xl font-semibold text-primary">{project.keywordCount}</p>
                    </div>
                  </div>
                </section>

                <span className="h-px w-full bg-border-secondary" />

                {/* Domain statistics cards - one per domain */}
                <section className="flex flex-col gap-3">
                  {domains && domains.length > 0 ? (
                    domains.map((domain) => (
                      <MetricsChart04
                        key={domain._id}
                        title={domain.keywordCount.toString()}
                        subtitle={domain.domain}
                        change="+12%"
                        changeTrend="positive"
                        changeDescription="vs last month"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-tertiary">No domains added yet</p>
                  )}
                </section>

                <span className="h-px w-full bg-border-secondary" />

                {/* Reports section */}
                <section className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-primary">Reports</p>
                  {hasConfiguredReports ? (
                    <div className="flex gap-3">
                      <Button size="md" color="secondary" iconLeading={FileCheck02} className="flex-1">
                        Wygeneruj raport
                      </Button>
                      <Button size="md" color="secondary" iconLeading={Send01} className="flex-1">
                        Wyślij raport
                      </Button>
                    </div>
                  ) : (
                    <Button size="md" color="secondary">
                      Skonfiguruj raporty
                    </Button>
                  )}
                </section>
              </TabPanel>

              <TabPanel id="domains">
                {domains && domains.length > 0 ? (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">Domains</p>
                      <BadgeWithDot size="sm" type="modern" color="gray">
                        {domains.length} {domains.length === 1 ? 'domain' : 'domains'}
                      </BadgeWithDot>
                    </div>

                    <span className="h-px w-full bg-border-secondary" />

                    {domains.map((domain, index) => (
                      <div key={domain._id}>
                        <span className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Globe01 className="h-5 w-5 text-fg-quaternary" />
                            <div>
                              <p className="text-sm font-medium text-primary">{domain.domain}</p>
                              <p className="text-sm text-tertiary">{domain.settings.searchEngine}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Hash01 className="h-4 w-4 text-fg-quaternary" />
                            <p className="text-sm font-medium text-secondary">{domain.keywordCount}</p>
                          </div>
                        </span>
                        {index < domains.length - 1 && <span className="h-px w-full bg-border-secondary mt-4" />}
                      </div>
                    ))}
                  </section>
                ) : (
                  <section className="flex flex-col items-center gap-2 py-8 text-center">
                    <Globe01 className="h-10 w-10 text-fg-quaternary" />
                    <p className="text-sm font-medium text-primary">No domains yet</p>
                    <p className="text-sm text-tertiary">Add domains to start tracking keywords</p>
                  </section>
                )}
              </TabPanel>

              <TabPanel id="activity">
                <section className="flex flex-col items-center gap-2 py-8 text-center">
                  <Hash01 className="h-10 w-10 text-fg-quaternary" />
                  <p className="text-sm font-medium text-primary">Activity Timeline</p>
                  <p className="text-sm text-tertiary">Activity tracking coming soon</p>
                </section>
              </TabPanel>
            </Tabs>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  );
}
