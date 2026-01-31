"use client";

import { useState, useMemo } from "react";
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
} from "@untitledui/icons";

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

function getSpamBadge(score?: number): { label: string; color: "error" | "warning" | "success" | "gray" } {
  if (score === undefined || score === null) return { label: "—", color: "gray" };
  if (score >= 70) return { label: `${score}% High`, color: "error" };
  if (score >= 40) return { label: `${score}% Medium`, color: "warning" };
  return { label: `${score}% Low`, color: "success" };
}

export function BacklinksTable({ backlinks, isLoading }: BacklinksTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("lastSeen");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    domainFrom: true,
    anchor: true,
    itemType: true,
    linkType: true,
    rank: true,
    spamScore: true,
    lastSeen: true,
  });

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

  // Get unique values for filters
  const uniqueTypes = useMemo(() => {
    const types = new Set(backlinks?.items.map((b) => b.itemType).filter(Boolean));
    return Array.from(types);
  }, [backlinks]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!backlinks || backlinks.items.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <Link01 className="mx-auto h-12 w-12 text-fg-quaternary" />
        <p className="mt-4 text-sm text-tertiary">No backlinks found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">Backlinks</h3>
          <p className="text-sm text-tertiary">
            {filteredAndSortedBacklinks.length} of {backlinks.total} backlinks
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="w-64">
            <Input
              placeholder="Search backlinks..."
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
            Filters
          </Button>

          {/* Column picker */}
          <div className="relative">
            <Button
              size="sm"
              color="secondary"
              iconLeading={Settings01}
              onClick={() => setShowColumnPicker(!showColumnPicker)}
            >
              Columns
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
                          ? "Referring Domain"
                          : key === "anchor"
                            ? "Anchor Text"
                            : key === "itemType"
                              ? "Type"
                              : key === "linkType"
                                ? "Link Type"
                                : key === "rank"
                                  ? "Rank"
                                  : key === "spamScore"
                                    ? "Spam Score"
                                    : "Last Seen"}
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
            <label className="text-sm font-medium text-secondary">Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">All</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Link type filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">Link Type:</label>
            <select
              value={linkTypeFilter}
              onChange={(e) => {
                setLinkTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">All</option>
              <option value="dofollow">Dofollow</option>
              <option value="nofollow">Nofollow</option>
            </select>
          </div>

          {/* Spam score filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">Spam Score:</label>
            <select
              value={spamScoreFilter}
              onChange={(e) => {
                setSpamScoreFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">All</option>
              <option value="low">Low (&lt; 40%)</option>
              <option value="medium">Medium (40-69%)</option>
              <option value="high">High (&ge; 70%)</option>
              <option value="unknown">Unknown</option>
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
              Clear All
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              {columnVisibility.domainFrom && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("domainFrom")}
                >
                  <div className="flex items-center gap-2">
                    Referring Domain
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
                    Anchor Text
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
                    Type
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
                    Link Type
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
                    Rank
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
                    Spam Score
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
                    Last Seen
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
                <tr key={backlink._id} className="transition-colors hover:bg-secondary/30">
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
                        {backlink.dofollow ? "Dofollow" : "Nofollow"}
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
                        {spamBadge.label}
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
            Page {currentPage} of {totalPages} ({filteredAndSortedBacklinks.length} results)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={ChevronLeft}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconTrailing={ChevronRight}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
