"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { Hash01, ChevronUp, ChevronDown, ChevronSelectorVertical, RefreshCcw01, Trash01, Settings01, ArrowUp, ArrowDown } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BadgeWithDot, BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { MiniSparkline } from "@/components/domain/charts/MiniSparkline";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { DialogTrigger, Popover } from "react-aria-components";
import { cx } from "@/utils/cx";
import { toast } from "sonner";

interface KeywordMonitoringTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "phrase" | "currentPosition" | "change" | "status" | "potential" | "searchVolume" | "difficulty";
type SortDirection = "asc" | "desc";

type ColumnId = "position" | "previous" | "change" | "status" | "potential" | "volume" | "difficulty" | "lastUpdated";

const AVAILABLE_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "position", label: "Position" },
  { id: "previous", label: "Previous" },
  { id: "change", label: "Change" },
  { id: "status", label: "Status" },
  { id: "potential", label: "Potential" },
  { id: "volume", label: "Volume" },
  { id: "difficulty", label: "Difficulty" },
  { id: "lastUpdated", label: "Last Updated" },
];

// Helper: Format numbers with K/M abbreviations
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Helper: Get position badge styles
function getPositionBadgeClass(position: number | null): string {
  if (!position) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
  if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
  if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
  if (position <= 50) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 100) return "bg-utility-gray-25 text-utility-gray-500";
  return "bg-utility-error-50 text-utility-error-600";
}

// Helper: Get difficulty badge
function getDifficultyBadge(difficulty: number) {
  if (difficulty <= 30) return { label: "Easy", color: "success" as const };
  if (difficulty <= 60) return { label: "Medium", color: "warning" as const };
  return { label: "Hard", color: "error" as const };
}

// Helper: Get status badge
function getStatusBadge(status: string) {
  switch (status) {
    case "rising": return { label: "Rising", color: "success" as const };
    case "falling": return { label: "Falling", color: "error" as const };
    case "new": return { label: "New", color: "blue" as const };
    default: return { label: "Stable", color: "gray" as const };
  }
}

interface SortableHeaderProps {
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onClick: (column: SortColumn) => void;
  children: React.ReactNode;
  className?: string;
}

function SortableHeader({ column, currentColumn, direction, onClick, children, className }: SortableHeaderProps) {
  const isActive = column === currentColumn;

  return (
    <th
      onClick={() => onClick(column)}
      className={cx(
        "cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary hover:text-primary",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {children}
        {isActive ? (
          direction === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ChevronSelectorVertical className="h-4 w-4 opacity-0 group-hover:opacity-50" />
        )}
      </div>
    </th>
  );
}

export function KeywordMonitoringTable({ domainId }: KeywordMonitoringTableProps) {
  const keywords = useQuery(api.keywords.getKeywordMonitoring, { domainId });
  const refreshPositions = useMutation(api.keywords.refreshKeywordPositions as any);
  const deleteKeywords = useMutation(api.keywords.deleteKeywords);

  const [sortColumn, setSortColumn] = useState<SortColumn>("currentPosition");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRows, setSelectedRows] = useState<Set<Id<"keywords">>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(
    new Set(["position", "previous", "change", "status", "volume", "difficulty", "lastUpdated"])
  );

  // Handle column visibility toggle
  const toggleColumn = (columnId: ColumnId) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnId)) {
      newVisible.delete(columnId);
    } else {
      newVisible.add(columnId);
    }
    setVisibleColumns(newVisible);
  };

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedRows.size === paginatedKeywords.length && paginatedKeywords.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedKeywords.map((kw) => kw.keywordId)));
    }
  };

  // Handle row selection
  const handleRowSelect = (keywordId: Id<"keywords">) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(keywordId)) {
      newSelected.delete(keywordId);
    } else {
      newSelected.add(keywordId);
    }
    setSelectedRows(newSelected);
  };

  // Handle bulk refresh
  const handleBulkRefresh = async () => {
    if (selectedRows.size === 0) return;

    try {
      console.log("Calling refreshPositions with:", Array.from(selectedRows));
      const result = await refreshPositions({ keywordIds: Array.from(selectedRows) });
      console.log("Refresh result:", result);
      toast.success(`Odświeżanie pozycji dla ${selectedRows.size} słów kluczowych zostało zakolejkowane`);
      // Don't clear selection - let user see which keywords are being refreshed
    } catch (error) {
      console.error("Refresh error details:", error);
      const errorMessage = error instanceof Error ? error.message : "Nie udało się odświeżyć pozycji";
      toast.error(`Błąd: ${errorMessage}`);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;

    try {
      await deleteKeywords({ keywordIds: Array.from(selectedRows) });
      toast.success(`Usunięto ${selectedRows.size} słów kluczowych`);
      setSelectedRows(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Nie udało się usunąć słów kluczowych";
      toast.error(errorMessage);
      console.error("Delete error:", error);
    }
  };

  // Check if any keywords are currently being refreshed
  const hasRefreshingKeywords = useMemo(() => {
    if (!keywords) return false;
    return keywords.some(kw => kw.checkingStatus === "queued" || kw.checkingStatus === "checking");
  }, [keywords]);

  // Filter and sort keywords
  const filteredAndSortedKeywords = useMemo(() => {
    if (!keywords) return [];

    let filtered = keywords;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((kw) => kw.phrase.toLowerCase().includes(query));
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case "phrase":
          aVal = a.phrase.toLowerCase();
          bVal = b.phrase.toLowerCase();
          break;
        case "currentPosition":
          aVal = a.currentPosition || 999;
          bVal = b.currentPosition || 999;
          break;
        case "change":
          aVal = a.change;
          bVal = b.change;
          break;
        case "potential":
          aVal = a.potential;
          bVal = b.potential;
          break;
        case "searchVolume":
          aVal = a.searchVolume;
          bVal = b.searchVolume;
          break;
        case "difficulty":
          aVal = a.difficulty;
          bVal = b.difficulty;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [keywords, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedKeywords.length / pageSize);
  const paginatedKeywords = filteredAndSortedKeywords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (keywords === undefined) {
    return <LoadingState type="card" />;
  }

  if (!keywords || keywords.length === 0) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Hash01 className="h-10 w-10 text-fg-quaternary" />
          <p className="text-sm font-medium text-primary">No keywords being monitored</p>
          <p className="text-sm text-tertiary">Add keywords to start tracking their rankings</p>
        </div>
      </div>
    );
  }

  const allCurrentPageSelected = paginatedKeywords.length > 0 &&
    paginatedKeywords.every((kw) => selectedRows.has(kw.keywordId));
  const someCurrentPageSelected = paginatedKeywords.some((kw) => selectedRows.has(kw.keywordId));

  return (
    <div className="flex flex-col gap-6">
      {/* Bulk actions toolbar */}
      {selectedRows.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-secondary bg-primary p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              {selectedRows.size} zaznaczonych
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={RefreshCcw01}
              onClick={handleBulkRefresh}
              disabled={hasRefreshingKeywords}
              className={hasRefreshingKeywords ? "opacity-60" : ""}
            >
              <div className="flex items-center gap-2">
                <RefreshCcw01 className={cx("h-4 w-4", hasRefreshingKeywords && "animate-spin")} />
                <span>{hasRefreshingKeywords ? "Odświeżanie..." : "Odśwież pozycję"}</span>
              </div>
            </Button>
            <DeleteConfirmationDialog
              title={`Usuń ${selectedRows.size} słów kluczowych?`}
              description="Ta akcja spowoduje trwałe usunięcie zaznaczonych słów kluczowych i wszystkich powiązanych danych o rankingach. Nie można tej operacji cofnąć."
              confirmLabel="Usuń słowa kluczowe"
              onConfirm={handleBulkDelete}
            >
              <Button
                size="sm"
                color="secondary-destructive"
                iconLeading={Trash01}
              >
                Usuń
              </Button>
            </DeleteConfirmationDialog>
          </div>
        </div>
      )}

      {/* Search bar and column visibility */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Szukaj słów kluczowych..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm text-primary placeholder:text-tertiary focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <DialogTrigger>
          <Button size="sm" color="secondary" iconLeading={Settings01}>
            Kolumny
          </Button>
          <Popover
            placement="bottom end"
            className="w-56 origin-(--trigger-anchor-point) overflow-auto rounded-lg bg-primary shadow-lg ring-1 ring-secondary_alt will-change-transform entering:duration-150 entering:ease-out entering:animate-in entering:fade-in exiting:duration-100 exiting:ease-in exiting:animate-out exiting:fade-out"
          >
            <div className="flex flex-col gap-2 p-2">
              <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-tertiary">
                Widoczne kolumny
              </div>
              {AVAILABLE_COLUMNS.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary-subtle"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(column.id)}
                    onChange={() => toggleColumn(column.id)}
                    className="h-4 w-4 cursor-pointer rounded border-secondary text-brand-600 focus:ring-brand-600"
                  />
                  <span className="text-sm text-primary">{column.label}</span>
                </label>
              ))}
            </div>
          </Popover>
        </DialogTrigger>
      </div>

      {/* Table - Desktop view */}
      <div className="overflow-x-auto rounded-xl border border-secondary bg-primary">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b-2 border-secondary bg-primary backdrop-blur">
            <tr>
              {/* Checkbox column */}
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 cursor-pointer rounded border-secondary text-brand-600 focus:ring-brand-600"
                />
              </th>
              <SortableHeader column="phrase" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
                Keyword
              </SortableHeader>
              {visibleColumns.has("position") && (
                <SortableHeader column="currentPosition" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
                  Position
                </SortableHeader>
              )}
              {visibleColumns.has("previous") && (
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
                  Previous
                </th>
              )}
              {visibleColumns.has("change") && (
                <SortableHeader column="change" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
                  Change
                </SortableHeader>
              )}
              {visibleColumns.has("status") && (
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
                  Status
                </th>
              )}
              {visibleColumns.has("potential") && (
                <SortableHeader column="potential" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
                  Potential
                </SortableHeader>
              )}
              {visibleColumns.has("volume") && (
                <SortableHeader column="searchVolume" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
                  Volume
                </SortableHeader>
              )}
              {visibleColumns.has("difficulty") && (
                <SortableHeader column="difficulty" currentColumn={sortColumn} direction={sortDirection} onClick={handleSort}>
                  Difficulty
                </SortableHeader>
              )}
              {visibleColumns.has("lastUpdated") && (
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tertiary">
                  Last Updated
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedKeywords.map((keyword, index) => {
              const statusBadge = getStatusBadge(keyword.status);
              const difficultyBadge = getDifficultyBadge(keyword.difficulty);
              const isSelected = selectedRows.has(keyword.keywordId);
              // Show loading if keyword is queued or currently being checked
              const isBeingRefreshed = keyword.checkingStatus === "queued" || keyword.checkingStatus === "checking";

              return (
                <tr
                  key={keyword.keywordId}
                  className={cx(
                    "border-b border-secondary transition-colors hover:bg-secondary-subtle",
                    isSelected && "bg-brand-50",
                    !isSelected && (index % 2 === 0 ? "bg-primary" : "bg-secondary-subtle"),
                    isBeingRefreshed && "opacity-60"
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleRowSelect(keyword.keywordId)}
                      className="h-4 w-4 cursor-pointer rounded border-secondary text-brand-600 focus:ring-brand-600"
                    />
                  </td>

                  {/* Keyword */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-primary">{keyword.phrase}</span>
                        {keyword.url && (
                          <span className="font-mono text-xs text-tertiary" title={keyword.url}>
                            {(() => {
                              try {
                                return new URL(keyword.url).pathname.toLowerCase();
                              } catch {
                                return keyword.url.toLowerCase();
                              }
                            })()}
                          </span>
                        )}
                      </div>
                      {isBeingRefreshed && (
                        <RefreshCcw01 className="h-4 w-4 animate-spin text-brand-600" />
                      )}
                    </div>
                  </td>

                  {/* Current Position */}
                  {visibleColumns.has("position") && (
                    <td className="px-6 py-4">
                      {keyword.currentPosition ? (
                        <BadgeWithIcon type="pill-color" color="brand" size="md">
                          #{keyword.currentPosition}
                        </BadgeWithIcon>
                      ) : (
                        <span className="text-sm text-tertiary">—</span>
                      )}
                    </td>
                  )}

                  {/* Previous Position */}
                  {visibleColumns.has("previous") && (
                    <td className="px-6 py-4">
                      {keyword.previousPosition ? (
                        <BadgeWithIcon type="pill-color" color="brand" size="sm">
                          #{keyword.previousPosition}
                        </BadgeWithIcon>
                      ) : (
                        <span className="text-sm text-tertiary">—</span>
                      )}
                    </td>
                  )}

                  {/* Change with Sparkline */}
                  {visibleColumns.has("change") && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {keyword.change !== 0 ? (
                          <BadgeWithIcon
                            type="pill-color"
                            color={keyword.change > 0 ? "success" : "error"}
                            size="sm"
                            iconLeading={keyword.change > 0 ? ArrowUp : ArrowDown}
                          >
                            {Math.abs(keyword.change)}
                          </BadgeWithIcon>
                        ) : (
                          <span className="text-sm text-tertiary">—</span>
                        )}
                        <MiniSparkline data={keyword.positionHistory} className="text-utility-gray-400" />
                      </div>
                    </td>
                  )}

                  {/* Status */}
                  {visibleColumns.has("status") && (
                    <td className="px-6 py-4">
                      <BadgeWithDot size="sm" color={statusBadge.color} type="modern">
                        {statusBadge.label}
                      </BadgeWithDot>
                    </td>
                  )}

                  {/* Potential */}
                  {visibleColumns.has("potential") && (
                    <td className="px-6 py-4">
                      <span className="font-medium text-primary">
                        {formatNumber(keyword.potential)}
                      </span>
                    </td>
                  )}

                  {/* Search Volume */}
                  {visibleColumns.has("volume") && (
                    <td className="px-6 py-4">
                      <span className="text-sm text-secondary">
                        {formatNumber(keyword.searchVolume)}
                      </span>
                    </td>
                  )}

                  {/* Difficulty */}
                  {visibleColumns.has("difficulty") && (
                    <td className="px-6 py-4">
                      <BadgeWithDot size="sm" color={difficultyBadge.color} type="modern">
                        {keyword.difficulty} • {difficultyBadge.label}
                      </BadgeWithDot>
                    </td>
                  )}

                  {/* Last Updated */}
                  {visibleColumns.has("lastUpdated") && (
                    <td className="px-6 py-4">
                      <span className="text-sm text-tertiary">
                        {new Date(keyword.lastUpdated).toLocaleDateString()}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-tertiary">
          Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredAndSortedKeywords.length)} of {filteredAndSortedKeywords.length} keywords
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary-subtle disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary-subtle disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
