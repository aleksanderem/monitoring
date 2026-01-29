"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Edit05, Trash01, SearchLg, FilterLines, Globe01, Hash01, FolderClosed, Tag03, XClose } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { InputBase } from "@/components/base/input/input";
import { BadgeWithDot, Badge } from "@/components/base/badges/badges";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingState } from "@/components/shared/LoadingState";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { CreateDomainDialog } from "@/components/application/modals/create-domain-dialog";
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

export default function DomainsPage() {
  const router = useRouter();
  const domains = useQuery(api.domains.list);
  const deleteDomain = useMutation(api.domains.remove);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "domain",
    direction: "ascending",
  });

  // Get all unique tags from domains
  const allTags = useMemo(() => {
    if (!domains) return [];
    const tagSet = new Set<string>();
    domains.forEach(domain => {
      domain.tags?.forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [domains]);

  // Filter domains based on search query and selected tags
  const filteredItems = useMemo(() => {
    if (!domains) return [];

    let filtered = domains;

    // Filter by search query
    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((domain) =>
        domain.domain.toLowerCase().includes(query) ||
        domain.project?.name.toLowerCase().includes(query)
      );
    }

    // Filter by selected tags
    if (selectedTags.size > 0) {
      filtered = filtered.filter((domain) => {
        if (!domain.tags || domain.tags.length === 0) return false;
        return Array.from(selectedTags).some(selectedTag =>
          domain.tags?.includes(selectedTag)
        );
      });
    }

    return filtered;
  }, [domains, searchQuery, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedTags(new Set());
  };

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

  const handleDelete = async (id: Id<"domains">) => {
    try {
      await deleteDomain({ id });
      toast.success("Domain deleted successfully");
    } catch (error) {
      toast.error("Failed to delete domain");
      console.error(error);
    }
  };

  if (domains === undefined) {
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
              Domains
            </p>
            <p className="text-md text-tertiary">
              Manage domains and track their keyword rankings.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex items-start gap-3">
              <CreateDomainDialog>
                <Button size="md">
                  Add Domain
                </Button>
              </CreateDomainDialog>
            </div>
          </div>
        </div>
      </div>

      {domains.length === 0 ? (
        <EmptyState size="md">
          <EmptyState.Header>
            <EmptyState.FeaturedIcon color="gray" />
          </EmptyState.Header>

          <EmptyState.Content>
            <EmptyState.Title>No domains found</EmptyState.Title>
            <EmptyState.Description>
              Get started by adding your first domain to track keywords.
            </EmptyState.Description>
          </EmptyState.Content>

          <EmptyState.Footer>
            <CreateDomainDialog>
              <Button size="md">
                Add Domain
              </Button>
            </CreateDomainDialog>
          </EmptyState.Footer>
        </EmptyState>
      ) : (
        <TableCard.Root>
          <TableCard.Header
            title="All Domains"
            badge={`${domains.length} domain${domains.length !== 1 ? "s" : ""}`}
          />

          {/* Filters section - inside TableCard */}
          <div className="border-b border-secondary px-4 py-3 lg:px-6">
            <div className="grid w-full grid-cols-1 gap-3 lg:w-auto lg:grid-cols-[minmax(0,296px)]">
              <InputBase
                size="sm"
                type="search"
                aria-label="Search"
                placeholder="Search domains..."
                icon={SearchLg}
                value={searchQuery}
                onChange={(value) => {
                  // Handle both string and potential object/event cases
                  const stringValue = typeof value === 'string' ? value : '';
                  setSearchQuery(stringValue);
                }}
              />
            </div>

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm text-secondary">
                  <Tag03 className="h-4 w-4" />
                  <span>Tags:</span>
                </div>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="cursor-pointer transition-all hover:ring-2 hover:ring-brand-200"
                  >
                    <Badge
                      size="sm"
                      color={selectedTags.has(tag) ? "brand" : "gray"}
                    >
                      {tag}
                    </Badge>
                  </button>
                ))}
                {(selectedTags.size > 0 || searchQuery) && (
                  <Button
                    size="sm"
                    color="tertiary"
                    iconLeading={XClose}
                    onClick={clearAllFilters}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>

          {sortedItems.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-tertiary">
                No domains match your search &quot;{searchQuery}&quot;
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
            aria-label="Domains"
            selectionMode="multiple"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
            onRowAction={(key) => router.push(`/domains/${key}`)}
          >
            <Table.Header>
              <Table.Head
                id="domain"
                label="Domain"
                isRowHeader
                allowsSorting
                className="w-full max-w-1/3"
              />
              <Table.Head id="project" label="Project" allowsSorting />
              <Table.Head id="tags" label="Tags" />
              <Table.Head id="keywordCount" label="Keywords" allowsSorting />
              <Table.Head
                id="createdAt"
                label="Created"
                allowsSorting
                className="md:hidden xl:table-cell"
              />
              <Table.Head id="status" label="Status" />
              <Table.Head id="actions" />
            </Table.Header>

            <Table.Body items={sortedItems}>
              {(item) => (
                <Table.Row id={item._id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Globe01 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {item.domain}
                        </p>
                        <p className="text-sm text-tertiary">
                          {item.settings.searchEngine} · {item.settings.refreshFrequency}
                        </p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <FolderClosed className="h-4 w-4 text-fg-quaternary" />
                      <span className="text-sm font-medium text-primary">
                        {item.project?.name || "Unknown"}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {item.tags && item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            size="sm"
                            color="gray"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-tertiary">—</span>
                    )}
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
                  <Table.Cell>
                    <BadgeWithDot
                      size="sm"
                      color="success"
                      type="modern"
                    >
                      Active
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell className="px-4">
                    <div className="flex justify-end gap-0.5">
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
                        title={`Delete "${item.domain}"?`}
                        description="This will permanently delete the domain and all associated keywords and ranking data. This action cannot be undone."
                        confirmLabel="Delete domain"
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
