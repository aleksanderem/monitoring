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
  Plus,
  Trash01,
  MinusCircle,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { LoadingState } from "@/components/shared/LoadingState";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { KeywordDetailCard } from "../cards/KeywordDetailCard";
import { MonthlySearchTrendChart } from "../charts/MonthlySearchTrendChart";
import { KeywordTooltip } from "../tooltips/KeywordTooltip";
import { KeywordDetailModal } from "../modals/KeywordDetailModal";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/patterns/BulkActionBar";
import { GlowingEffect } from "@/components/ui/glowing-effect";

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
  const t = useTranslations('keywords');
  const tc = useTranslations('common');
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
  const monitoredKeywords = useQuery(api.keywords.getKeywords, { domainId });
  const addKeywordMutation = useMutation(api.keywords.addKeyword);
  const deleteKeywordMutation = useMutation(api.keywords.deleteKeyword);
  const deleteKeywordsBulk = useMutation(api.keywords.deleteKeywords);
  const addKeywordsBulk = useMutation(api.keywords.addKeywords);
  const deleteDiscoveredKeywords = useMutation(api.dataforseo.deleteDiscoveredKeywords);
  const selection = useRowSelection();

  // Build a map of monitored phrase → keyword _id for O(1) lookup
  const monitoredMap = useMemo(() => {
    if (!monitoredKeywords) return new Map<string, Id<"keywords">>();
    return new Map(monitoredKeywords.map((k: any) => [k.phrase.toLowerCase(), k._id]));
  }, [monitoredKeywords]);

  const handleAddToMonitor = async (keyword: any) => {
    try {
      await addKeywordMutation({
        domainId,
        phrase: keyword.keyword,
      });
      toast.success(t('addedToMonitoring', { keyword: keyword.keyword }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToAddKeyword'));
    }
  };

  const handleRemoveFromMonitor = async (keyword: any) => {
    const keywordId = monitoredMap.get(keyword.keyword.toLowerCase());
    if (!keywordId) return;
    try {
      await deleteKeywordMutation({ keywordId });
      toast.success(t('removedFromMonitoring', { keyword: keyword.keyword }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToRemoveKeyword'));
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
  const visibleIds = paginatedKeywords.map((kw: any) => kw._id as string);

  if (keywords === undefined) {
    return <LoadingState />;
  }

  if (keywords.length === 0) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-8 text-center">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <SearchLg className="mx-auto h-12 w-12 text-fg-quaternary" />
        <p className="mt-4 text-sm text-tertiary">{t('noKeywordsDiscovered')}</p>
        <p className="mt-2 text-xs text-tertiary">{t('keywordsAppearAfterFetch')}</p>
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
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">{t('discoveredKeywords')}</h3>
            <p className="text-sm text-tertiary">
              {t('discoveredKeywordsDescription', { count: sortedAndFilteredKeywords.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="w-64">
              <Input
                placeholder={t('searchKeywords')}
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
                <p className="font-medium mb-1">{t('dataSources')}:</p>
                <p>{t('dataSourcesRanked')}</p>
                <p className="mt-1">{t('dataSourcesSuggested')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters panel */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
            {/* Position filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('columnPosition')}:</label>
              <select
                value={positionFilter}
                onChange={(e) => {
                  setPositionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{tc('all')}</option>
                <option value="top3">{t('filterTop3')}</option>
                <option value="top10">{t('filterTop10')}</option>
                <option value="top20">{t('filterTop20')}</option>
                <option value="top50">{t('filterTop50')}</option>
                <option value="below50">{t('filterBelow50')}</option>
                <option value="unknown">{t('filterUnknown')}</option>
              </select>
            </div>

            {/* Difficulty filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('columnDifficulty')}:</label>
              <select
                value={difficultyFilter}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{tc('all')}</option>
                <option value="easy">{t('filterEasy')}</option>
                <option value="medium">{t('filterMedium')}</option>
                <option value="hard">{t('filterHard')}</option>
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
                {t('clearAll')}
              </Button>
            )}
          </div>
        )}

        <BulkActionBar
          selectedCount={selection.count}
          selectedIds={selection.selectedIds}
          onClearSelection={selection.clear}
          actions={[
            {
              label: tc('bulkAddToMonitoring'),
              icon: Plus,
              onClick: async (ids) => {
                const phrases = sortedAndFilteredKeywords
                  .filter((kw: any) => ids.has(kw._id))
                  .map((kw: any) => kw.keyword)
                  .filter((phrase: string) => !monitoredMap.has(phrase.toLowerCase()));
                if (phrases.length === 0) return;
                try {
                  await addKeywordsBulk({ domainId, phrases });
                  toast.success(tc('bulkActionSuccess', { count: phrases.length }));
                  selection.clear();
                } catch {
                  toast.error(tc('bulkActionFailed'));
                }
              },
            },
            {
              label: tc('bulkRemoveFromMonitoring'),
              icon: MinusCircle,
              variant: "destructive" as const,
              onClick: async (ids) => {
                const monitoredIds = sortedAndFilteredKeywords
                  .filter((kw: any) => ids.has(kw._id))
                  .map((kw: any) => monitoredMap.get(kw.keyword.toLowerCase()))
                  .filter((id): id is Id<"keywords"> => !!id);
                if (monitoredIds.length === 0) return;
                try {
                  await deleteKeywordsBulk({ keywordIds: monitoredIds });
                  toast.success(tc('bulkActionSuccess', { count: monitoredIds.length }));
                  selection.clear();
                } catch {
                  toast.error(tc('bulkActionFailed'));
                }
              },
            },
            {
              label: tc('bulkDelete'),
              icon: Trash01,
              variant: "destructive" as const,
              onClick: async (ids) => {
                const keywordIds = sortedAndFilteredKeywords
                  .filter((kw: any) => ids.has(kw._id))
                  .map((kw: any) => kw._id);
                if (keywordIds.length === 0) return;
                try {
                  await deleteDiscoveredKeywords({ keywordIds });
                  toast.success(tc('bulkActionSuccess', { count: keywordIds.length }));
                  selection.clear();
                } catch {
                  toast.error(tc('bulkActionFailed'));
                }
              },
            },
          ]}
        />

        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected(visibleIds)}
                    ref={(el) => { if (el) el.indeterminate = selection.isIndeterminate(visibleIds); }}
                    onChange={() => selection.toggleAll(visibleIds)}
                    className="h-4 w-4 rounded border-secondary"
                  />
                </th>
                <th className="w-8 px-4 py-3"></th>
                {columnVisibility.keyword && (
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                    onClick={() => toggleSort("keyword")}
                  >
                    <div className="flex items-center gap-2">
                      {t('columnKeyword')}
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
                      {t('columnPosition')}
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
                      {t('columnVolume')}
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
                      {t('columnDifficulty')}
                      <SortIcon column="difficulty" />
                    </div>
                  </th>
                )}
                {columnVisibility.cpc && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    {t('columnCpc')}
                  </th>
                )}
                {columnVisibility.etv && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    {t('columnEtv')}
                  </th>
                )}
                {columnVisibility.actions && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {tc('actions')}
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
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selection.isSelected(keyword._id)}
                          onChange={() => selection.toggle(keyword._id)}
                          className="h-4 w-4 rounded border-secondary"
                        />
                      </td>
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
                                {tc('new')}
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
                            <span className="inline-flex items-center gap-1 text-xs text-tertiary" title={t('noRankTooltip')}>
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t('noRank')}
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
                            <span className="inline-flex items-center gap-1 text-xs text-tertiary" title={t('difficultyNotAvailableTooltip')}>
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {tc('notAvailable')}
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
                          {monitoredMap.has(keyword.keyword.toLowerCase()) ? (
                            <Button
                              size="sm"
                              color="secondary-destructive"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleRemoveFromMonitor(keyword);
                              }}
                            >
                              {t('removeFromMonitor')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              color="secondary"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleAddToMonitor(keyword);
                              }}
                            >
                              {t('addToMonitor')}
                            </Button>
                          )}
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
                                <h4 className="text-sm font-semibold text-primary mb-3">{t('searchVolumeTrend')}</h4>
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
              {t('paginationInfo', { current: currentPage, total: totalPages, count: sortedAndFilteredKeywords.length })}
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
