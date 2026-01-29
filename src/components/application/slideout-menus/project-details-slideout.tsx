"use client";

import { useState } from "react";
import { Folder, Globe01, Hash01, Edit01, Trash01 } from "@untitledui/icons";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
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

      <SlideoutMenu dialogClassName="gap-0" isDismissable>
        <SlideoutMenu.Header
          onClose={() => setIsOpen(false)}
          className="relative flex w-full flex-col items-start gap-3 px-4 pt-5 md:px-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Folder className="h-6 w-6" />
          </div>
          <h1 className="text-md font-semibold text-primary md:text-lg">
            {project?.name || "Loading..."}
          </h1>
        </SlideoutMenu.Header>

        <SlideoutMenu.Content className="px-4 py-6 md:px-6">
          {project && (
            <>
              <div className="flex flex-col gap-4">
                <section className="flex w-full justify-between">
                  <p className="text-sm font-semibold text-primary">Details</p>
                  <span className="-mt-2 -mb-1 flex gap-0.5">
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

                <section className="flex flex-col gap-3">
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

              {domains && domains.length > 0 && (
                <section className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-primary">
                    Domains ({domains.length})
                  </p>
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
                </section>
              )}

              {domains && domains.length === 0 && (
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
            </>
          )}
        </SlideoutMenu.Content>
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  );
}
