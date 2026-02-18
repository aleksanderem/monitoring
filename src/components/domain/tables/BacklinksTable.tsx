"use client";

import { useState, useMemo, useEffect } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import {
  Link01,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  SearchLg,
  Settings01,
  FilterLines,
  Download01,
  Trash01,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/patterns/BulkActionBar";

interface Backlink {
  _id: string;
  domainFrom?: string;
  urlFrom: string;
  urlTo: string;
  anchor?: string;
  dofollow?: boolean;
  rank?: number;
  domainFromRank?: number;
  backlink_spam_score?: number;
  itemType?: string;
  firstSeen?: string;
  lastSeen?: string;
  domainFromCountry?: string;
  tldFrom?: string;
}

interface BacklinksTableProps {
  backlinks: {
    total: number;
    items: Backlink[];
    stats: {
      totalDofollow: number;
      totalNofollow: number;
      avgRank: number;
      avgSpamScore: number;
    };
  };
  isLoading?: boolean;
}

type SortColumn = "domainFrom" | "anchor" | "itemType" | "linkType" | "rank" | "spamScore" | "lastSeen";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  domainFrom: boolean;
  anchor: boolean;
  itemType: boolean;
  linkType: boolean;
  rank: boolean;
  spamScore: boolean;
  lastSeen: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getSpamBadge(score?: number): { score: number | null; labelKey: string; color: "error" | "warning" | "success" | "gray" } {
  if (score === undefined || score === null) return { score: null, labelKey: "", color: "gray" };
  if (score >= 70) return { score, labelKey: "spamBadgeHigh", color: "error" };
  if (score >= 40) return { score, labelKey: "spamBadgeMedium", color: "warning" };
  return { score, labelKey: "spamBadgeLow", color: "success" };
}

export function BacklinksTable({ backlinks, isLoading }: BacklinksTableProps) {
  const t = useTranslations('backlinks');
  const tc = useTranslations('common');
  const deleteBacklinks = useMutation(api.backlinks.deleteBacklinks);
  const [sortColumn, setSortColumn] = useState<SortColumn>("lastSeen");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const selection = useRowSelection();

  // Column visibility state — persisted to localStorage
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("backlinks_columnVisibility");
      if (saved) {
        try { return JSON.parse(saved); } catch { /* use defaults */ }
      }
    }
    return {
      domainFrom: true,
      anchor: true,
      itemType: true,
      linkType: true,
      rank: true,
      spamScore: true,
      lastSeen: true,
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("backlinks_columnVisibility", JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [linkTypeFilter, setLinkTypeFilter] = useState<string>("all");
  const [spamScoreFilter, setSpamScoreFilter] = useState<string>("all");

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ChevronSelectorVertical className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  // Apply search, filter, and sort
  const filteredAndSortedBacklinks = useMemo(() => {
    if (!backlinks?.items) return [];

    let filtered = backlinks.items.filter((backlink) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        backlink.domainFrom?.toLowerCase().includes(searchLower) ||
        backlink.anchor?.toLowerCase().includes(searchLower) ||
        backlink.urlFrom.toLowerCase().includes(searchLower) ||
        backlink.itemType?.toLowerCase().includes(searchLower);

      // Type filter
      const matchesType = typeFilter === "all" || backlink.itemType === typeFilter;

      // Link type filter
      const matchesLinkType =
        linkTypeFilter === "all" ||
        (linkTypeFilter === "dofollow" && backlink.dofollow) ||
        (linkTypeFilter === "nofollow" && !backlink.dofollow);

      // Spam score filter
      let matchesSpamScore = true;
      if (spamScoreFilter !== "all") {
        const score = backlink.backlink_spam_score;
        if (score === undefined || score === null) {
          matchesSpamScore = spamScoreFilter === "unknown";
        } else if (spamScoreFilter === "low") {
          matchesSpamScore = score < 40;
        } else if (spamScoreFilter === "medium") {
          matchesSpamScore = score >= 40 && score < 70;
        } else if (spamScoreFilter === "high") {
          matchesSpamScore = score >= 70;
        }
      }

      return matchesSearch && matchesType && matchesLinkType && matchesSpamScore;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case "domainFrom":
          aVal = a.domainFrom || "";
          bVal = b.domainFrom || "";
          break;
        case "anchor":
          aVal = a.anchor || "";
          bVal = b.anchor || "";
          break;
        case "itemType":
          aVal = a.itemType || "";
          bVal = b.itemType || "";
          break;
        case "linkType":
          aVal = a.dofollow ? "dofollow" : "nofollow";
          bVal = b.dofollow ? "dofollow" : "nofollow";
          break;
        case "rank":
          aVal = a.rank || 999999;
          bVal = b.rank || 999999;
          break;
        case "spamScore":
          aVal = a.backlink_spam_score || 0;
          bVal = b.backlink_spam_score || 0;
          break;
        case "lastSeen":
          aVal = a.lastSeen || "";
          bVal = b.lastSeen || "";
          break;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [backlinks, searchQuery, typeFilter, linkTypeFilter, spamScoreFilter, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedBacklinks.length / itemsPerPage);
  const paginatedBacklinks = filteredAndSortedBacklinks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const visibleIds = useMemo(
    () => paginatedBacklinks.map((b) => b._id),
    [paginatedBacklinks]
  );

  const exportSelectedAsCsv = () => {
    const selected = filteredAndSortedBacklinks.filter((b) =>
      selection.selectedIds.has(b._id)
    );
    if (selected.length === 0) return;
    const headers = ["Referring Domain", "URL From", "URL To", "Anchor", "Type", "Link Type", "Rank", "Spam Score", "Last Seen"];
    const rows = selected.map((b) => [
      b.domainFrom || "",
      b.urlFrom,
      b.urlTo,
      (b.anchor || "").replace(/"/g, '""'),
      b.itemType || "",
      b.dofollow ? "dofollow" : "nofollow",
      b.rank?.toString() || "",
      b.backlink_spam_score?.toString() || "",
      b.lastSeen || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backlinks-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    selection.clear();
  };

  // Get unique values for filters
  const uniqueTypes = useMemo(() => {
    const types = new Set(backlinks?.items.map((b) => b.itemType).filter(Boolean));
    return Array.from(types);
  }, [backlinks]);

  if (isLoading) {
    return (
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-64 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    );
  }

  if (!backlinks || backlinks.items.length === 0) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-8 text-center">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <Link01 className="mx-auto h-12 w-12 text-fg-quaternary" />
        <p className="mt-4 text-sm text-tertiary">{t('noBacklinksFound')}</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">{t('backlinksTitle')}</h3>
          <p className="text-sm text-tertiary">
            {t('backlinksSubtitle', { total: backlinks.total, domains: backlinks.stats?.totalDofollow ?? 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="w-64">
            <Input
              placeholder={t('searchBacklinks')}
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setCurrentPage(1);
              }}
              icon={SearchLg}
            />
          </div>

          {/* Filters toggle */}
          <Button
            size="sm"
            color={showFilters ? "primary" : "secondary"}
            iconLeading={FilterLines}
            onClick={() => setShowFilters(!showFilters)}
          >
            {t('filters')}
          </Button>

          {/* Column picker */}
          <div className="relative">
            <Button
              size="sm"
              color="secondary"
              iconLeading={Settings01}
              onClick={() => setShowColumnPicker(!showColumnPicker)}
            >
              {tc('columns')}
            </Button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
                <div className="flex flex-col gap-1">
                  {Object.entries(columnVisibility).map(([key, value]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-secondary/50"
                    >
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => toggleColumn(key as keyof ColumnVisibility)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-primary">
                        {key === "domainFrom"
                          ? t('columnReferringDomain')
                          : key === "anchor"
                            ? t('columnAnchorText')
                            : key === "itemType"
                              ? t('columnType')
                              : key === "linkType"
                                ? t('columnLinkType')
                                : key === "rank"
                                  ? t('columnRank')
                                  : key === "spamScore"
                                    ? t('columnSpamScore')
                                    : t('columnLastSeen')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">{t('columnType')}:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">{t('filterAll')}</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Link type filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">{t('columnLinkType')}:</label>
            <select
              value={linkTypeFilter}
              onChange={(e) => {
                setLinkTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">{t('filterAll')}</option>
              <option value="dofollow">{t('filterDofollow')}</option>
              <option value="nofollow">{t('filterNofollow')}</option>
            </select>
          </div>

          {/* Spam score filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">{t('columnSpamScore')}:</label>
            <select
              value={spamScoreFilter}
              onChange={(e) => {
                setSpamScoreFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">{t('filterAll')}</option>
              <option value="low">{t('filterSpamLow')}</option>
              <option value="medium">{t('filterSpamMedium')}</option>
              <option value="high">{t('filterSpamHigh')}</option>
              <option value="unknown">{t('filterSpamUnknown')}</option>
            </select>
          </div>

          {/* Clear filters */}
          {(typeFilter !== "all" || linkTypeFilter !== "all" || spamScoreFilter !== "all" || searchQuery) && (
            <Button
              size="sm"
              color="secondary"
              onClick={() => {
                setTypeFilter("all");
                setLinkTypeFilter("all");
                setSpamScoreFilter("all");
                setSearchQuery("");
                setCurrentPage(1);
              }}
            >
              {t('clearAll')}
            </Button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selection.count > 0 && (
        <BulkActionBar
          selectedCount={selection.count}
          selectedIds={selection.selectedIds}
          onClearSelection={selection.clear}
          actions={[
            {
              label: tc('bulkExport'),
              icon: Download01,
              onClick: exportSelectedAsCsv,
            },
            {
              label: tc('bulkDelete'),
              icon: Trash01,
              variant: "destructive" as const,
              onClick: async (ids) => {
                const backlinkIds = filteredAndSortedBacklinks
                  .filter((b) => ids.has(b._id))
                  .map((b) => b._id as Id<"domainBacklinks">);
                if (backlinkIds.length === 0) return;
                try {
                  await deleteBacklinks({ backlinkIds });
                  toast.success(tc('bulkActionSuccess', { count: backlinkIds.length }));
                  selection.clear();
                } catch {
                  toast.error(tc('bulkActionFailed'));
                }
              },
            },
          ]}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={selection.isAllSelected(visibleIds)}
                  ref={(el) => { if (el) el.indeterminate = selection.isIndeterminate(visibleIds); }}
                  onChange={() => selection.toggleAll(visibleIds)}
                />
              </th>
              {columnVisibility.domainFrom && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("domainFrom")}
                >
                  <div className="flex items-center gap-2">
                    {t('columnReferringDomain')}
                    <SortIcon column="domainFrom" />
                  </div>
                </th>
              )}
              {columnVisibility.anchor && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("anchor")}
                >
                  <div className="flex items-center gap-2">
                    {t('columnAnchorText')}
                    <SortIcon column="anchor" />
                  </div>
                </th>
              )}
              {columnVisibility.itemType && (
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("itemType")}
                >
                  <div className="flex items-center justify-center gap-2">
                    {t('columnType')}
                    <SortIcon column="itemType" />
                  </div>
                </th>
              )}
              {columnVisibility.linkType && (
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("linkType")}
                >
                  <div className="flex items-center justify-center gap-2">
                    {t('columnLinkType')}
                    <SortIcon column="linkType" />
                  </div>
                </th>
              )}
              {columnVisibility.rank && (
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("rank")}
                >
                  <div className="flex items-center justify-end gap-2">
                    {t('columnRank')}
                    <SortIcon column="rank" />
                  </div>
                </th>
              )}
              {columnVisibility.spamScore && (
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("spamScore")}
                >
                  <div className="flex items-center justify-center gap-2">
                    {t('columnSpamScore')}
                    <SortIcon column="spamScore" />
                  </div>
                </th>
              )}
              {columnVisibility.lastSeen && (
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("lastSeen")}
                >
                  <div className="flex items-center justify-end gap-2">
                    {t('columnLastSeen')}
                    <SortIcon column="lastSeen" />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {paginatedBacklinks.map((backlink) => {
              const referringDomain = backlink.domainFrom || new URL(backlink.urlFrom).hostname;
              const spamBadge = getSpamBadge(backlink.backlink_spam_score);

              return (
                <tr key={backlink._id} className="transition-colors hover:bg-primary_hover">
                  <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={selection.isSelected(backlink._id)}
                      onChange={() => selection.toggle(backlink._id)}
                    />
                  </td>
                  {columnVisibility.domainFrom && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link01 className="h-4 w-4 text-fg-quaternary" />
                        <a
                          href={backlink.urlFrom}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:text-brand-600"
                        >
                          {referringDomain}
                        </a>
                      </div>
                    </td>
                  )}
                  {columnVisibility.anchor && (
                    <td className="px-4 py-3">
                      <span className="text-sm text-secondary line-clamp-2">
                        {backlink.anchor || "—"}
                      </span>
                    </td>
                  )}
                  {columnVisibility.itemType && (
                    <td className="px-4 py-3 text-center">
                      <Badge size="sm" color="gray">
                        {backlink.itemType || "—"}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.linkType && (
                    <td className="px-4 py-3 text-center">
                      <Badge size="sm" color={backlink.dofollow ? "success" : "gray"}>
                        {backlink.dofollow ? t('dofollow') : t('nofollow')}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.rank && (
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-primary">
                        {backlink.rank?.toLocaleString() || "—"}
                      </span>
                    </td>
                  )}
                  {columnVisibility.spamScore && (
                    <td className="px-4 py-3 text-center">
                      <Badge size="sm" color={spamBadge.color}>
                        {spamBadge.score !== null ? `${spamBadge.score}% ${t(spamBadge.labelKey)}` : "—"}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.lastSeen && (
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-secondary">{formatDate(backlink.lastSeen)}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-secondary pt-4">
          <p className="text-sm text-secondary">
            {tc('pageOf', { current: currentPage, total: totalPages })} ({filteredAndSortedBacklinks.length} {tc('results')})
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={ChevronLeft}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {tc('previous')}
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconTrailing={ChevronRight}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {tc('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
