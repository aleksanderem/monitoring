"use client";

import { useState } from "react";
import { Globe01, Hash01, Edit01, Trash01, Settings01, RefreshCcw01 } from "@untitledui/icons";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface DomainDetailsSlideoutProps {
  domainId: Id<"domains">;
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
    id: "keywords",
    value: "keywords",
    label: "Keywords",
  },
  {
    id: "settings",
    value: "settings",
    label: "Settings",
  },
];

export function DomainDetailsSlideout({
  domainId,
  children,
  onEdit,
  onDelete,
}: DomainDetailsSlideoutProps) {
  const [isOpen, setIsOpen] = useState(false);

  const domain = useQuery(api.domains.getDomain, { domainId });
  // TODO: Add keywords query
  const keywords: any[] = [];

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
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Globe01 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-md font-semibold text-primary md:text-lg">
                {domain?.domain || "Loading..."}
              </h1>
              <p className="text-sm text-tertiary">
                {domain?.settings.searchEngine} · {domain?.settings.refreshFrequency}
              </p>
            </div>
            <span className="flex gap-0.5">
              <ButtonUtility
                size="xs"
                color="tertiary"
                tooltip="Refresh rankings"
                icon={RefreshCcw01}
                onClick={() => {
                  toast.info("Refresh coming soon");
                }}
              />
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
          {domain && (
            <Tabs defaultSelectedKey="overview">
              <TabPanel id="overview">
                {/* Summary section */}
                <section className="flex items-center justify-between">
                  <BadgeWithDot size="md" type="modern" color="success">
                    Active
                  </BadgeWithDot>
                  <div className="flex flex-col items-end">
                    <p className="text-sm font-medium text-secondary">Keywords</p>
                    <p className="text-xl font-semibold text-primary">{keywords.length}</p>
                  </div>
                </section>

                <span className="h-px w-full bg-border-secondary" />

                {/* Details section */}
                <section className="flex flex-col gap-4">
                  <p className="text-sm font-semibold text-primary">Domain Details</p>

                  <span className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Created</p>
                    <div className="flex flex-col items-end">
                      <p className="text-sm text-primary">{formatRelativeTime(domain.createdAt)}</p>
                      <p className="text-sm text-tertiary">{formatDate(domain.createdAt)}</p>
                    </div>
                  </span>

                  {domain.lastRefreshedAt && (
                    <span className="flex items-center justify-between">
                      <p className="text-sm font-medium text-secondary">Last Refreshed</p>
                      <div className="flex flex-col items-end">
                        <p className="text-sm text-primary">{formatRelativeTime(domain.lastRefreshedAt)}</p>
                        <p className="text-sm text-tertiary">{formatDate(domain.lastRefreshedAt)}</p>
                      </div>
                    </span>
                  )}
                </section>
              </TabPanel>

              <TabPanel id="keywords">
                {keywords.length > 0 ? (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">Keywords</p>
                      <BadgeWithDot size="sm" type="modern" color="gray">
                        {keywords.length} {keywords.length === 1 ? 'keyword' : 'keywords'}
                      </BadgeWithDot>
                    </div>

                    <span className="h-px w-full bg-border-secondary" />

                    {keywords.map((keyword, index) => (
                      <div key={keyword._id}>
                        <span className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Hash01 className="h-5 w-5 text-fg-quaternary" />
                            <p className="text-sm font-medium text-primary">{keyword.phrase}</p>
                          </div>
                          <p className="text-sm font-medium text-secondary">#{keyword.position || "—"}</p>
                        </span>
                        {index < keywords.length - 1 && <span className="h-px w-full bg-border-secondary mt-4" />}
                      </div>
                    ))}
                  </section>
                ) : (
                  <section className="flex flex-col items-center gap-2 py-8 text-center">
                    <Hash01 className="h-10 w-10 text-fg-quaternary" />
                    <p className="text-sm font-medium text-primary">No keywords yet</p>
                    <p className="text-sm text-tertiary">Add keywords to start tracking rankings</p>
                  </section>
                )}
              </TabPanel>

              <TabPanel id="settings">
                <section className="flex flex-col gap-4">
                  <p className="text-sm font-semibold text-primary">Domain Settings</p>

                  <span className="h-px w-full bg-border-secondary" />

                  <span className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Search Engine</p>
                    <p className="text-sm text-primary">{domain.settings.searchEngine}</p>
                  </span>

                  <span className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Refresh Frequency</p>
                    <BadgeWithDot size="sm" color="gray" type="modern">
                      {domain.settings.refreshFrequency}
                    </BadgeWithDot>
                  </span>

                  <span className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Location</p>
                    <p className="text-sm text-primary">{domain.settings.location}</p>
                  </span>

                  <span className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary">Language</p>
                    <p className="text-sm text-primary">{domain.settings.language}</p>
                  </span>
                </section>
              </TabPanel>
            </Tabs>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  );
}
