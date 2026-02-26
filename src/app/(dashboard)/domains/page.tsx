"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { getCountryFlag, getLanguageFlag } from "@/lib/countryFlags";
import { EzIcon } from "@/components/foundations/ez-icon";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { BulkActionBar } from "@/components/patterns/BulkActionBar";

// Helper to format relative time
function formatRelativeTime(timestamp: number, t: (key: any, params?: any) => string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return t('relativeTimeToday');
  if (days === 1) return t('relativeTimeYesterday');
  if (days < 7) return t('relativeTimeDaysAgo', { days });
  if (days < 30) return t('relativeTimeWeeksAgo', { weeks: Math.floor(days / 7) });
  if (days < 365) return t('relativeTimeMonthsAgo', { months: Math.floor(days / 30) });
  return t('relativeTimeYearsAgo', { years: Math.floor(days / 365) });
}

export default function DomainsPage() {
  const t = useTranslations('domains');
  const router = useRouter();
  const domains = useQuery(api.domains.list);
  usePageTitle("Domains");
  const deleteDomain = useMutation(api.domains.remove);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "domain",
    direction: "ascending",
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

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
      toast.success(t('domainDeletedSuccess'));
    } catch (error) {
      toast.error(t('failedToDeleteDomain'));
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
    <div className="mx-auto flex w-full max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
      {domains.length === 0 ? (
        <EmptyState size="md">
          <EmptyState.Header>
            <EmptyState.FeaturedIcon color="gray" />
          </EmptyState.Header>

          <EmptyState.Content>
            <EmptyState.Title>{t('noDomains')}</EmptyState.Title>
            <EmptyState.Description>
              {t('noDomainsDescription')}
            </EmptyState.Description>
          </EmptyState.Content>

          <EmptyState.Footer>
            <PermissionGate permission="domains.create">
              <CreateDomainDialog>
                <Button size="md">
                  {t('addDomain')}
                </Button>
              </CreateDomainDialog>
            </PermissionGate>
          </EmptyState.Footer>
        </EmptyState>
      ) : (
        <>
        <div className="relative flex flex-col gap-5 bg-primary">
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:flex">
                <EzIcon name="globe" size={24} color="#2563eb" strokeColor="#2563eb" />
              </div>
              <div className="flex flex-col gap-0.5 lg:gap-1">
                <p className="text-xl font-semibold text-primary lg:text-display-xs">
                  {t('domains')}
                </p>
                <p className="text-sm text-tertiary sm:text-md">
                  {t('domainsDescription')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="flex items-start gap-3">
                <PermissionGate permission="domains.create">
                  <CreateDomainDialog>
                    <Button size="md">
                      {t('addDomain')}
                    </Button>
                  </CreateDomainDialog>
                </PermissionGate>
              </div>
            </div>
          </div>
        </div>

        <TableCard.Root>
          <TableCard.Header
            title={t('allDomains')}
            badge={`${filteredItems.length} ${filteredItems.length !== 1 ? t('domainsPlural') : t('domainSingular')}`}
          />

          {/* Filters section - inside TableCard */}
          <div className="border-b border-secondary px-4 py-3 lg:px-6">
            <div className="grid w-full grid-cols-1 gap-3 lg:w-auto lg:grid-cols-[minmax(0,296px)]">
              <InputBase
                size="sm"
                type="search"
                aria-label="Search"
                placeholder={t('searchDomains')}
                icon={SearchLg}
                value={searchQuery}
                onChange={(valueOrEvent: string | React.ChangeEvent<HTMLInputElement>) => {
                  const stringValue = typeof valueOrEvent === 'string'
                    ? valueOrEvent
                    : valueOrEvent?.target?.value ?? '';
                  setSearchQuery(stringValue);
                }}
              />
            </div>

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm text-secondary">
                  <Tag03 className="h-4 w-4" />
                  <span>{t('tagsFilter')}</span>
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
                    {t('clearFilters')}
                  </Button>
                )}
              </div>
            )}
          </div>

          {sortedItems.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-tertiary">
                {t('noDomainsMatch')}
              </p>
              <Button
                size="sm"
                color="tertiary"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                {t('clearSearch')}
              </Button>
            </div>
          ) : (
          <>
          {selectedKeys.size > 0 && (
            <div className="px-4 pb-3 lg:px-6">
              <BulkActionBar
                selectedCount={selectedKeys.size}
                selectedIds={selectedKeys}
                onClearSelection={() => setSelectedKeys(new Set())}
                actions={[
                  {
                    label: t('delete'),
                    variant: "destructive" as const,
                    icon: Trash01,
                    onClick: async (ids) => {
                      try {
                        for (const id of ids) {
                          await deleteDomain({ id: id as Id<"domains"> });
                        }
                        toast.success(t('bulkDeleteSuccess', { count: ids.size }));
                        setSelectedKeys(new Set());
                      } catch {
                        toast.error(t('failedToDeleteDomain'));
                      }
                    },
                  },
                ]}
              />
            </div>
          )}
          <Table
            aria-label="Domains"
            selectionMode="multiple"
            selectedKeys={selectedKeys}
            onSelectionChange={(keys) => {
              if (keys === "all") {
                setSelectedKeys(new Set(sortedItems.map(d => d._id)));
              } else {
                setSelectedKeys(keys as Set<string>);
              }
            }}
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
            onRowAction={(key) => router.push(`/domains/${key}`)}
          >
            <Table.Header>
              <Table.Head
                id="domain"
                label={t('colDomain')}
                isRowHeader
                allowsSorting
                className="w-full max-w-1/3"
              />
              <Table.Head id="project" label={t('colProject')} allowsSorting />
              <Table.Head id="tags" label={t('colTags')} />
              <Table.Head id="keywordCount" label={t('colKeywords')} allowsSorting />
              <Table.Head
                id="createdAt"
                label={t('colCreated')}
                allowsSorting
                className="md:hidden xl:table-cell"
              />
              <Table.Head id="status" label={t('colStatus')} />
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
                          {getCountryFlag(item.settings.location)} {item.settings.location} · {getLanguageFlag(item.settings.language)} {item.settings.language} · {item.settings.searchEngine}
                        </p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <FolderClosed className="h-4 w-4 text-fg-quaternary" />
                      <span className="text-sm font-medium text-primary">
                        {item.project?.name || t('unknown')}
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
                        {formatRelativeTime(item.createdAt, t)}
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
                      {t('active')}
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell className="px-4">
                    <div className="flex justify-end gap-0.5">
                      <PermissionGate permission="domains.edit">
                        <ButtonUtility
                          size="xs"
                          color="tertiary"
                          tooltip={t('edit')}
                          icon={Edit05}
                          isDisabled
                        />
                      </PermissionGate>
                      <PermissionGate permission="domains.delete">
                        <DeleteConfirmationDialog
                          title={t('deleteDomainTitle', { domain: item.domain })}
                          description={t('deleteDomainDescription')}
                          confirmLabel={t('deleteDomainConfirm')}
                          onConfirm={async () => {
                            await handleDelete(item._id);
                          }}
                        >
                          <ButtonUtility
                            size="xs"
                            color="tertiary"
                            tooltip={t('delete')}
                            icon={Trash01}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                            }}
                          />
                        </DeleteConfirmationDialog>
                      </PermissionGate>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
          </>
          )}
        </TableCard.Root>
        </>
      )}
    </div>
  );
}
