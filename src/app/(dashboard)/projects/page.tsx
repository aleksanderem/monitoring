"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Plus, Edit05, Trash01, SearchSm, Eye } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { InputBase } from "@/components/base/input/input";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingState } from "@/components/shared/LoadingState";
import { toast } from "sonner";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const deleteProject = useMutation(api.projects.remove);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });

  // Filter projects based on search query
  const filteredItems = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;

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
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-primary">
            Projects
          </h1>
          <p className="text-md text-tertiary mt-1">
            Manage your SEO monitoring projects
          </p>
        </div>

        <Button iconLeading={Plus} size="md">
          New Project
        </Button>
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
            <Button size="md" iconLeading={Plus}>
              New Project
            </Button>
          </EmptyState.Footer>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {/* Search input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <SearchSm className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-quaternary" />
              <InputBase
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
                className="pl-10"
              />
            </div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
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
            <TableCard.Root>
              <TableCard.Header
                title="All Projects"
                badge={`${sortedItems.length} project${sortedItems.length !== 1 ? "s" : ""}`}
              />
          <Table
            aria-label="Projects"
            selectionMode="multiple"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
          >
            <Table.Header>
              <Table.Head
                id="name"
                label="Project Name"
                isRowHeader
                allowsSorting
                className="w-full max-w-1/4"
              />
              <Table.Head id="domainCount" label="Domains" allowsSorting />
              <Table.Head id="keywordCount" label="Keywords" allowsSorting />
              <Table.Head
                id="createdAt"
                label="Created"
                allowsSorting
                className="md:hidden xl:table-cell"
              />
              <Table.Head id="actions" />
            </Table.Header>

            <Table.Body items={sortedItems}>
              {(item) => (
                <Table.Row id={item._id}>
                  <Table.Cell>
                    <div className="whitespace-nowrap">
                      <p className="text-sm font-medium text-primary">
                        {item.name}
                      </p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-primary">
                      {item.domainCount}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-primary">
                      {item.keywordCount}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap md:hidden xl:table-cell">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell className="px-4">
                    <div className="flex justify-end gap-0.5">
                      <ButtonUtility
                        size="xs"
                        color="tertiary"
                        tooltip="View project"
                        icon={Eye}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          toast.info("Project details coming soon");
                        }}
                      />
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
                      <ButtonUtility
                        size="xs"
                        color="tertiary"
                        tooltip="Delete"
                        icon={Trash01}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Are you sure you want to delete "${item.name}"? This will also delete all domains and keywords in this project.`
                            )
                          ) {
                            handleDelete(item._id);
                          }
                        }}
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </TableCard.Root>
          )}
        </div>
      )}
    </div>
  );
}
