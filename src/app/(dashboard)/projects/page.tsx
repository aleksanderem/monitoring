"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Edit05, Trash01, SearchLg, Eye, FilterLines, Globe01, Hash01 } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { InputBase } from "@/components/base/input/input";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Avatar } from "@/components/base/avatar/avatar";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingState } from "@/components/shared/LoadingState";
import { CreateProjectDialog } from "@/components/application/modals/create-project-dialog";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { ProjectDetailsSlideout } from "@/components/application/slideout-menus/project-details-slideout";
import { toast } from "sonner";

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const deleteProject = useMutation(api.projects.remove);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });

  // Filter projects based on search query
  const filteredItems = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
      return projects;
    }

    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Sort filtered items
  const sortedItems = useMemo(() => {
    return filteredItems.toSorted((a, b) => {
      const first = a[sortDescriptor.column as keyof typeof a];
      const second = b[sortDescriptor.column as keyof typeof b];

      if (typeof first === "number" && typeof second === "number") {
        return sortDescriptor.direction === "descending"
          ? second - first
          : first - second;
      }

      if (typeof first === "string" && typeof second === "string") {
        const result = first.localeCompare(second);
        return sortDescriptor.direction === "descending" ? -result : result;
      }

      return 0;
    });
  }, [filteredItems, sortDescriptor]);

  const handleDelete = async (id: Id<"projects">) => {
    try {
      await deleteProject({ id });
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error("Failed to delete project");
      console.error(error);
    }
  };

  if (projects === undefined) {
    return (
      <div className="p-8">
        <LoadingState type="table" rows={5} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
      <div className="relative flex flex-col gap-5 bg-primary">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <div className="flex flex-col gap-0.5 lg:gap-1">
            <p className="text-xl font-semibold text-primary lg:text-display-xs">
              Projects
            </p>
            <p className="text-md text-tertiary">
              Manage your SEO monitoring projects and track keyword rankings.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex items-start gap-3">
              <CreateProjectDialog />
            </div>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState size="md">
          <EmptyState.Header>
            <EmptyState.FeaturedIcon color="gray" />
          </EmptyState.Header>

          <EmptyState.Content>
            <EmptyState.Title>No projects found</EmptyState.Title>
            <EmptyState.Description>
              Get started by creating your first project to track keywords and domains.
            </EmptyState.Description>
          </EmptyState.Content>

          <EmptyState.Footer>
            <CreateProjectDialog />
          </EmptyState.Footer>
        </EmptyState>
      ) : (
        <TableCard.Root>
          <TableCard.Header
            title="All Projects"
            badge={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          />

          {/* Filters section - inside TableCard */}
          <div className="flex justify-between gap-4 border-b border-secondary px-4 py-3 lg:px-6">
            <div className="grid w-full grid-cols-1 gap-3 lg:w-auto lg:grid-cols-[minmax(0,296px)_max-content]">
              <InputBase
                size="sm"
                type="search"
                aria-label="Search"
                placeholder="Search projects..."
                icon={SearchLg}
                value={searchQuery}
                onChange={(value) => {
                  // Handle both string and potential object/event cases
                  const stringValue = typeof value === 'string' ? value : '';
                  setSearchQuery(stringValue);
                }}
              />

              <Button iconLeading={FilterLines} color="secondary" size="md">
                Filters
              </Button>
            </div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-tertiary">
                No projects match your search &quot;{searchQuery}&quot;
              </p>
              <Button
                size="sm"
                color="tertiary"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                Clear search
              </Button>
            </div>
          ) : (
          <Table
            aria-label="Projects"
            selectionMode="multiple"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
          >
            <Table.Header>
              <Table.Head
                id="name"
                label="Project"
                isRowHeader
                allowsSorting
                className="w-full max-w-1/3"
              />
              <Table.Head id="status" label="Status" allowsSorting />
              <Table.Head id="domainCount" label="Domains" allowsSorting />
              <Table.Head id="keywordCount" label="Keywords" allowsSorting />
              <Table.Head
                id="createdAt"
                label="Created"
                allowsSorting
                className="md:hidden xl:table-cell"
              />
              <Table.Head
                id="owner"
                label="Owner"
                className="md:hidden xl:table-cell"
              />
              <Table.Head id="actions" />
            </Table.Header>

            <Table.Body items={sortedItems}>
              {(item) => (
                <Table.Row id={item._id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <span className="text-sm font-semibold">
                          {item.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {item.name}
                        </p>
                        <p className="text-sm text-tertiary">
                          {item.domainCount} domains · {item.keywordCount} keywords
                        </p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <BadgeWithDot
                      size="sm"
                      color="success"
                      type="modern"
                    >
                      Active
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Globe01 className="h-4 w-4 text-fg-quaternary" />
                      <span className="text-sm font-medium text-primary">
                        {item.domainCount}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Hash01 className="h-4 w-4 text-fg-quaternary" />
                      <span className="text-sm font-medium text-primary">
                        {item.keywordCount}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap md:hidden xl:table-cell">
                    <div className="flex flex-col">
                      <span className="text-sm text-primary">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      <span className="text-sm text-tertiary">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="md:hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar
                        size="sm"
                        initials="ME"
                        className="shrink-0"
                      />
                      <span className="text-sm text-primary">You</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-4">
                    <div className="flex justify-end gap-0.5">
                      <ProjectDetailsSlideout
                        projectId={item._id}
                        onDelete={() => {
                          // Will be handled by Delete button inside slideout
                        }}
                      >
                        <ButtonUtility
                          size="xs"
                          color="tertiary"
                          tooltip="View project"
                          icon={Eye}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                          }}
                        />
                      </ProjectDetailsSlideout>
                      <ButtonUtility
                        size="xs"
                        color="tertiary"
                        tooltip="Edit"
                        icon={Edit05}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          toast.info("Edit dialog coming soon");
                        }}
                      />
                      <DeleteConfirmationDialog
                        title={`Delete "${item.name}"?`}
                        description="This will permanently delete the project and all associated domains and keywords. This action cannot be undone."
                        confirmLabel="Delete project"
                        onConfirm={async () => {
                          await handleDelete(item._id);
                        }}
                      >
                        <ButtonUtility
                          size="xs"
                          color="tertiary"
                          tooltip="Delete"
                          icon={Trash01}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                          }}
                        />
                      </DeleteConfirmationDialog>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
          )}
        </TableCard.Root>
      )}
    </div>
  );
}
