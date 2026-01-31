"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import {
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  SearchLg,
  Settings01,
  FilterLines,
  ChevronLeft,
  ChevronRight,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";

interface AllKeywordsTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "phrase" | "position" | "change" | "volume";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  phrase: boolean;
  position: boolean;
  change: boolean;
  volume: boolean;
  actions: boolean;
}

function getPositionBadgeClass(position: number | null): string {
  if (!position) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
  if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
  if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
  if (position <= 50) return "bg-utility-gray-50 text-utility-gray-600";
  return "bg-utility-gray-25 text-utility-gray-500";
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function AllKeywordsTable({ domainId }: AllKeywordsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    phrase: true,
    position: true,
    change: true,
    volume: true,
    actions: true,
  });

  // Filter states
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [changeFilter, setChangeFilter] = useState<string>("all");

  const keywords = useQuery(api.keywords.getKeywords, { domainId });

  // Create a Set of monitored keyword phrases for quick lookup
  const monitoredPhrases = useMemo(() => {
    if (!keywords) return new Set<string>();
    return new Set(keywords.map((kw: any) => kw.phrase.toLowerCase().trim()));
  }, [keywords]);

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const isAlreadyMonitored = (phrase: string): boolean => {
    return monitoredPhrases.has(phrase.toLowerCase().trim());
  };

  const handleAddToMonitoring = (keyword: any) => {
    if (isAlreadyMonitored(keyword.phrase)) {
      console.log("Keyword already monitored:", keyword.phrase);
      return;
    }
    // TODO: Implement add to monitoring functionality
    console.log("Adding to monitoring:", keyword.phrase);
    // This will be connected to a Convex mutation later
  };

  const sortedAndFilteredKeywords = useMemo(() => {
    if (!keywords) return [];

    let filtered = keywords.filter((kw: any) => {
      // Search filter
      const matchesSearch = !searchQuery || kw.phrase.toLowerCase().includes(searchQuery.toLowerCase());

      // Position filter
      let matchesPosition = true;
      if (positionFilter !== "all") {
        const pos = kw.currentPosition;
        if (pos === null || pos === undefined) {
          matchesPosition = positionFilter === "unknown";
        } else if (positionFilter === "top3") {
          matchesPosition = pos <= 3;
        } else if (positionFilter === "top10") {
          matchesPosition = pos <= 10;
        } else if (positionFilter === "top20") {
          matchesPosition = pos <= 20;
        } else if (positionFilter === "top50") {
          matchesPosition = pos <= 50;
        } else if (positionFilter === "below50") {
          matchesPosition = pos > 50;
        }
      }

      // Change filter
      let matchesChange = true;
      if (changeFilter !== "all") {
        const change =
          kw.currentPosition && kw.previousPosition ? kw.previousPosition - kw.currentPosition : 0;
        if (changeFilter === "improved") {
          matchesChange = change > 0;
        } else if (changeFilter === "declined") {
          matchesChange = change < 0;
        } else if (changeFilter === "nochange") {
          matchesChange = change === 0;
        }
      }

      return matchesSearch && matchesPosition && matchesChange;
    });

    return filtered.sort((a: any, b: any) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === "change") {
        aVal = (a.currentPosition || 999) - (a.previousPosition || 999);
        bVal = (b.currentPosition || 999) - (b.previousPosition || 999);
      } else if (sortColumn === "position") {
        aVal = a.currentPosition || 999;
        bVal = b.currentPosition || 999;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [keywords, sortColumn, sortDirection, searchQuery, positionFilter, changeFilter]);

  // Pagination
  const totalPages = Math.ceil(sortedAndFilteredKeywords.length / itemsPerPage);
  const paginatedKeywords = sortedAndFilteredKeywords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (keywords === undefined) {
    return <LoadingState />;
  }

  if (keywords.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <SearchLg className="mx-auto h-12 w-12 text-fg-quaternary" />
        <p className="mt-4 text-sm text-tertiary">No keywords found for this domain</p>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">All Keywords</h3>
          <p className="text-sm text-tertiary">
            {sortedAndFilteredKeywords.length} keywords found
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="w-64">
            <Input
              placeholder="Search keywords..."
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
              <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
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
                        {key === "phrase"
                          ? "Keyword"
                          : key === "position"
                            ? "Position"
                            : key === "change"
                              ? "Change"
                              : key === "volume"
                                ? "Volume"
                                : "Actions"}
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
          {/* Position filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">Position:</label>
            <select
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">All</option>
              <option value="top3">Top 3</option>
              <option value="top10">Top 10</option>
              <option value="top20">Top 20</option>
              <option value="top50">Top 50</option>
              <option value="below50">Below 50</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {/* Change filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary">Change:</label>
            <select
              value={changeFilter}
              onChange={(e) => {
                setChangeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="all">All</option>
              <option value="improved">Improved</option>
              <option value="declined">Declined</option>
              <option value="nochange">No Change</option>
            </select>
          </div>

          {/* Clear filters */}
          {(positionFilter !== "all" || changeFilter !== "all" || searchQuery) && (
            <Button
              size="sm"
              color="secondary"
              onClick={() => {
                setPositionFilter("all");
                setChangeFilter("all");
                setSearchQuery("");
                setCurrentPage(1);
              }}
            >
              Clear All
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              {columnVisibility.phrase && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("phrase")}
                >
                  <div className="flex items-center gap-2">
                    Keyword
                    <SortIcon column="phrase" />
                  </div>
                </th>
              )}
              {columnVisibility.position && (
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("position")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Position
                    <SortIcon column="position" />
                  </div>
                </th>
              )}
              {columnVisibility.change && (
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("change")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Change
                    <SortIcon column="change" />
                  </div>
                </th>
              )}
              {columnVisibility.volume && (
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("volume")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Volume
                    <SortIcon column="volume" />
                  </div>
                </th>
              )}
              {columnVisibility.actions && (
                <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {paginatedKeywords.map((keyword: any) => {
              const change =
                keyword.currentPosition && keyword.previousPosition
                  ? keyword.previousPosition - keyword.currentPosition
                  : 0;

              return (
                <tr key={keyword._id} className="transition-colors hover:bg-secondary/30">
                  {columnVisibility.phrase && (
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-primary">{keyword.phrase}</span>
                    </td>
                  )}
                  {columnVisibility.position && (
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPositionBadgeClass(
                          keyword.currentPosition
                        )}`}
                      >
                        {keyword.currentPosition || "—"}
                      </span>
                    </td>
                  )}
                  {columnVisibility.change && (
                    <td className="px-4 py-3 text-center">
                      {change !== 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium ${
                            change > 0 ? "text-utility-success-600" : "text-utility-error-600"
                          }`}
                        >
                          {change > 0 ? "+" : ""}
                          {change}
                        </span>
                      ) : (
                        <span className="text-sm text-tertiary">—</span>
                      )}
                    </td>
                  )}
                  {columnVisibility.volume && (
                    <td className="px-4 py-3 text-right text-sm text-primary">
                      {keyword.searchVolume ? formatNumber(keyword.searchVolume) : "—"}
                    </td>
                  )}
                  {columnVisibility.actions && (
                    <td className="px-4 py-3 text-center">
                      {isAlreadyMonitored(keyword.phrase) ? (
                        <Button size="sm" color="secondary" disabled>
                          W monitoringu
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          color="secondary"
                          onClick={() => handleAddToMonitoring(keyword)}
                        >
                          Dodaj do monitoringu
                        </Button>
                      )}
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
            Page {currentPage} of {totalPages} ({sortedAndFilteredKeywords.length} results)
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
