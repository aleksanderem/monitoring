"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import {
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  SearchLg,
  Settings01,
  FilterLines,
  ChevronLeft,
  ChevronRight,
  ChevronDown as ExpandIcon,
  ChevronRight as CollapseIcon,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { KeywordDetailCard } from "../cards/KeywordDetailCard";
import { MonthlySearchTrendChart } from "../charts/MonthlySearchTrendChart";
import { KeywordTooltip } from "../tooltips/KeywordTooltip";
import { KeywordDetailModal } from "../modals/KeywordDetailModal";

interface DiscoveredKeywordsTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "keyword" | "position" | "volume" | "difficulty";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  keyword: boolean;
  position: boolean;
  volume: boolean;
  difficulty: boolean;
  cpc: boolean;
  etv: boolean;
  actions: boolean;
}

function getPositionBadgeClass(position: number | null): string {
  if (!position || position === 999) return "bg-utility-gray-50 text-utility-gray-600";
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

export function DiscoveredKeywordsTable({ domainId }: DiscoveredKeywordsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hoveredKeyword, setHoveredKeyword] = useState<{ keyword: any; position: { x: number; y: number } } | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<any | null>(null);

  // Column visibility state — persisted to localStorage
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("discoveredKeywords_columnVisibility");
      if (saved) {
        try { return JSON.parse(saved); } catch { /* use defaults */ }
      }
    }
    return {
      keyword: true,
      position: true,
      volume: true,
      difficulty: true,
      cpc: true,
      etv: true,
      actions: true,
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("discoveredKeywords_columnVisibility", JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Filter states
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

  const keywords = useQuery(api.dataforseo.getDiscoveredKeywords, { domainId });
  const addKeywordMutation = useMutation(api.keywords.addKeyword);

  const handleAddToMonitor = async (keyword: any) => {
    try {
      await addKeywordMutation({
        domainId,
        phrase: keyword.keyword,
      });
      toast.success(`Added "${keyword.keyword}" to monitoring`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add keyword");
    }
  };

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const toggleRowExpansion = (keywordId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keywordId)) {
        newSet.delete(keywordId);
      } else {
        newSet.add(keywordId);
      }
      return newSet;
    });
  };

  const handleMouseEnter = (keyword: any, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredKeyword({
      keyword,
      position: { x: rect.left, y: rect.top + rect.height / 2 },
    });
  };

  const handleMouseLeave = () => {
    setHoveredKeyword(null);
  };

  const sortedAndFilteredKeywords = useMemo(() => {
    if (!keywords) return [];

    let filtered = keywords.filter((kw: any) => {
      // Search filter
      const matchesSearch = !searchQuery || kw.keyword.toLowerCase().includes(searchQuery.toLowerCase());

      // Position filter
      let matchesPosition = true;
      if (positionFilter !== "all") {
        const pos = kw.bestPosition;
        if (pos === null || pos === undefined || pos === 999) {
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

      // Difficulty filter
      let matchesDifficulty = true;
      if (difficultyFilter !== "all" && kw.difficulty !== undefined) {
        if (difficultyFilter === "easy") {
          matchesDifficulty = kw.difficulty < 30;
        } else if (difficultyFilter === "medium") {
          matchesDifficulty = kw.difficulty >= 30 && kw.difficulty < 70;
        } else if (difficultyFilter === "hard") {
          matchesDifficulty = kw.difficulty >= 70;
        }
      }

      return matchesSearch && matchesPosition && matchesDifficulty;
    });

    return filtered.sort((a: any, b: any) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === "position") {
        aVal = a.bestPosition ?? 999;
        bVal = b.bestPosition ?? 999;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [keywords, sortColumn, sortDirection, searchQuery, positionFilter, difficultyFilter]);

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
        <p className="mt-4 text-sm text-tertiary">No keywords discovered yet</p>
        <p className="mt-2 text-xs text-tertiary">Keywords will appear here after domain visibility fetch</p>
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
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">Discovered Keywords</h3>
            <p className="text-sm text-tertiary">
              {sortedAndFilteredKeywords.length} keywords enriched with search volume, difficulty, CPC, and intent data.
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
                        <span className="text-primary capitalize">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info banner */}
        {keywords && keywords.length > 0 && (
          <div className="rounded-lg border border-utility-blue-200 bg-utility-blue-50 p-3">
            <div className="flex items-start gap-2">
              <svg className="h-5 w-5 text-utility-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-utility-blue-900">
                <p className="font-medium mb-1">Data Sources:</p>
                <p>Keywords with <strong>Position</strong> and <strong>Difficulty</strong> data come from the Ranked Keywords API (your domain ranks for these in top 100).</p>
                <p className="mt-1">Keywords showing "No rank" or "N/A" are suggestions from Google Ads API (high search volume keywords relevant to your domain, but you don't rank for them yet).</p>
              </div>
            </div>
          </div>
        )}

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

            {/* Difficulty filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">Difficulty:</label>
              <select
                value={difficultyFilter}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">All</option>
                <option value="easy">Easy (&lt; 30)</option>
                <option value="medium">Medium (30-70)</option>
                <option value="hard">Hard (&gt; 70)</option>
              </select>
            </div>

            {/* Clear filters */}
            {(positionFilter !== "all" || difficultyFilter !== "all" || searchQuery) && (
              <Button
                size="sm"
                color="secondary"
                onClick={() => {
                  setPositionFilter("all");
                  setDifficultyFilter("all");
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
                <th className="w-8 px-4 py-3"></th>
                {columnVisibility.keyword && (
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                    onClick={() => toggleSort("keyword")}
                  >
                    <div className="flex items-center gap-2">
                      Keyword
                      <SortIcon column="keyword" />
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
                {columnVisibility.difficulty && (
                  <th
                    className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                    onClick={() => toggleSort("difficulty")}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Difficulty
                      <SortIcon column="difficulty" />
                    </div>
                  </th>
                )}
                {columnVisibility.cpc && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    CPC
                  </th>
                )}
                {columnVisibility.etv && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    ETV
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
                const isExpanded = expandedRows.has(keyword._id);

                return (
                  <React.Fragment key={keyword._id}>
                    <tr
                      className="transition-colors hover:bg-primary_hover cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(keyword, e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => setSelectedKeyword(keyword)}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(keyword._id);
                          }}
                          className="text-tertiary hover:text-primary transition-colors"
                        >
                          {isExpanded ? (
                            <ExpandIcon className="h-4 w-4" />
                          ) : (
                            <CollapseIcon className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      {columnVisibility.keyword && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary">{keyword.keyword}</span>
                            {keyword.isNew && (
                              <span className="inline-flex items-center rounded-full bg-utility-blue-50 px-2 py-0.5 text-xs font-medium text-utility-blue-700">
                                New
                              </span>
                            )}
                            {keyword.isUp && (
                              <span className="inline-flex items-center rounded-full bg-utility-success-50 px-2 py-0.5 text-xs font-medium text-utility-success-700">
                                ↑
                              </span>
                            )}
                            {keyword.isDown && (
                              <span className="inline-flex items-center rounded-full bg-utility-error-50 px-2 py-0.5 text-xs font-medium text-utility-error-700">
                                ↓
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {columnVisibility.position && (
                        <td className="px-4 py-3 text-center">
                          {keyword.bestPosition && keyword.bestPosition !== 999 ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPositionBadgeClass(
                                keyword.bestPosition
                              )}`}
                            >
                              {keyword.bestPosition}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-tertiary" title="No ranking data - keyword suggestion from Google Ads">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              No rank
                            </span>
                          )}
                        </td>
                      )}
                      {columnVisibility.volume && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {keyword.searchVolume ? formatNumber(keyword.searchVolume) : "—"}
                        </td>
                      )}
                      {columnVisibility.difficulty && (
                        <td className="px-4 py-3 text-center">
                          {keyword.difficulty !== undefined ? (
                            <span
                              className={`text-sm font-medium ${
                                keyword.difficulty < 30 ? 'text-utility-success-600' :
                                keyword.difficulty < 70 ? 'text-utility-warning-600' :
                                'text-utility-error-600'
                              }`}
                            >
                              {keyword.difficulty}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-tertiary" title="Difficulty data not available from Google Ads API">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              N/A
                            </span>
                          )}
                        </td>
                      )}
                      {columnVisibility.cpc && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {keyword.cpc !== undefined ? `$${keyword.cpc.toFixed(2)}` : "—"}
                        </td>
                      )}
                      {columnVisibility.etv && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {keyword.etv !== undefined ? keyword.etv.toFixed(2) : "—"}
                        </td>
                      )}
                      {columnVisibility.actions && (
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            color="secondary"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleAddToMonitor(keyword);
                            }}
                          >
                            Add to Monitor
                          </Button>
                        </td>
                      )}
                    </tr>

                    {/* Expanded row content */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-secondary/20 p-6">
                          <div className="space-y-6">
                            {/* Monthly trend */}
                            {keyword.monthlySearches && keyword.monthlySearches.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-primary mb-3">Search Volume Trend</h4>
                                <MonthlySearchTrendChart monthlySearches={keyword.monthlySearches} />
                              </div>
                            )}

                            {/* Detail cards */}
                            <KeywordDetailCard keyword={keyword} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

      {/* Tooltip */}
      {hoveredKeyword && (
        <KeywordTooltip
          keyword={hoveredKeyword.keyword}
          position={hoveredKeyword.position}
        />
      )}

      {/* Detail Modal */}
      <KeywordDetailModal
        keyword={selectedKeyword}
        isOpen={!!selectedKeyword}
        onClose={() => setSelectedKeyword(null)}
      />
    </>
  );
}
