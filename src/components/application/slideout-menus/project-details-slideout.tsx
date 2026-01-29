"use client";

import { useState } from "react";
import { Folder, Globe01, Hash01, Edit01, Trash01, Settings01 } from "@untitledui/icons";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
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
    id: "settings",
    value: "settings",
    label: "Settings",
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
                {project?.domainCount || 0} domains · {project?.keywordCount || 0} keywords
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
                <div className="flex flex-col gap-6 py-6">
                  <section className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-primary">Details</p>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-tertiary">Status</p>
                      <BadgeWithDot size="sm" color="success" type="modern">
                        Active
                      </BadgeWithDot>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-tertiary">Created</p>
                      <div className="flex flex-col items-end">
                        <p className="text-sm font-medium text-primary">
                          {formatRelativeTime(project.createdAt)}
                        </p>
                        <p className="text-sm text-tertiary">
                          {formatDate(project.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-tertiary">Domains</p>
                      <div className="flex items-center gap-2">
                        <Globe01 className="h-4 w-4 text-fg-quaternary" />
                        <p className="text-sm font-medium text-primary">
                          {project.domainCount}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-tertiary">Keywords</p>
                      <div className="flex items-center gap-2">
                        <Hash01 className="h-4 w-4 text-fg-quaternary" />
                        <p className="text-sm font-medium text-primary">
                          {project.keywordCount}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </TabPanel>

              <TabPanel id="domains">
                <div className="flex flex-col gap-4 py-6">
                  {domains && domains.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-primary">
                          All Domains ({domains.length})
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {domains.map((domain) => (
                          <div
                            key={domain._id}
                            className="flex items-center justify-between rounded-lg border border-secondary p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Globe01 className="h-5 w-5 text-fg-quaternary" />
                              <div>
                                <p className="text-sm font-medium text-primary">
                                  {domain.domain}
                                </p>
                                <p className="text-sm text-tertiary">
                                  {domain.keywordCount} keywords
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <section className="flex flex-col items-center gap-2 rounded-lg border border-secondary p-6 text-center">
                      <Globe01 className="h-10 w-10 text-fg-quaternary" />
                      <p className="text-sm font-medium text-primary">
                        No domains yet
                      </p>
                      <p className="text-sm text-tertiary">
                        Add domains to start tracking keywords
                      </p>
                    </section>
                  )}
                </div>
              </TabPanel>

              <TabPanel id="settings">
                <div className="flex flex-col gap-4 py-6">
                  <section className="flex flex-col items-center gap-2 rounded-lg border border-secondary p-6 text-center">
                    <Settings01 className="h-10 w-10 text-fg-quaternary" />
                    <p className="text-sm font-medium text-primary">
                      Project Settings
                    </p>
                    <p className="text-sm text-tertiary">
                      Project settings coming soon
                    </p>
                  </section>
                </div>
              </TabPanel>
            </Tabs>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  );
}
