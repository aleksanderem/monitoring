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
  RefreshCw01,
  Trash01,
  Edit05,
  Plus,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { LoadingState } from "@/components/shared/LoadingState";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { KeywordPositionChart } from "../charts/KeywordPositionChart";
import { AddKeywordsModal } from "../modals/AddKeywordsModal";
import { KeywordMonitoringDetailModal } from "../modals/KeywordMonitoringDetailModal";

interface KeywordMonitoringTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "phrase" | "currentPosition" | "searchVolume" | "difficulty";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  keyword: boolean;
  position: boolean;
  previous: boolean;
  change: boolean;
  volume: boolean;
  difficulty: boolean;
  cpc: boolean;
  etv: boolean;
  competition: boolean;
  intent: boolean;
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

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function KeywordMonitoringTable({ domainId }: KeywordMonitoringTableProps) {
  const t = useTranslations('keywords');
  const tc = useTranslations('common');
  const [sortColumn, setSortColumn] = useState<SortColumn>("currentPosition");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [addKeywordsModalOpen, setAddKeywordsModalOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<any | null>(null);

  // Column visibility state - load from localStorage on mount
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('keywordMonitoring_columnVisibility');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // If parsing fails, use defaults
        }
      }
    }
    return {
      keyword: true,
      position: true,
      previous: true,
      change: true,
      volume: true,
      difficulty: true,
      cpc: true,
      etv: true,
      competition: false,
      intent: false,
      actions: true,
    };
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('keywordMonitoring_columnVisibility', JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Filter states
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Queries and mutations
  const keywords = useQuery(api.keywords.getKeywordMonitoring, { domainId });
  const refreshPositions = useMutation(api.keywords.refreshKeywordPositions);
  const deleteKeyword = useMutation(api.keywords.deleteKeywords);
  const createSerpFetchJob = useMutation(api.keywordSerpJobs.createSerpFetchJob);
  const activeSerpJob = useQuery(api.keywordSerpJobs.getActiveJobForDomain, { domainId });

  // Track SERP job completion and show notification
  const [lastSerpJobId, setLastSerpJobId] = useState<string | null>(null);
  useEffect(() => {
    if (activeSerpJob) {
      // Track the current job
      if (lastSerpJobId !== activeSerpJob._id) {
        setLastSerpJobId(activeSerpJob._id);
      }
    } else if (lastSerpJobId) {
      // Job just completed (no longer active)
      // Wait a moment and show completion toast
      const timer = setTimeout(() => {
        toast.success(t('serpFetchCompleted'));
        setLastSerpJobId(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeSerpJob, lastSerpJobId]);

  const handleRefresh = async (keywordId: Id<"keywords">) => {
    try {
      await refreshPositions({ keywordIds: [keywordId] });
      toast.success(t('positionRefreshQueued'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToRefreshPosition'));
    }
  };

  const handleDelete = async (keywordId: Id<"keywords">, phrase: string) => {
    try {
      await deleteKeyword({ keywordIds: [keywordId] });
      toast.success(t('deletedKeyword', { phrase }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToDeleteKeyword'));
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

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = kw.status === statusFilter;
      }

      return matchesSearch && matchesPosition && matchesStatus;
    });

    return filtered.sort((a: any, b: any) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === "currentPosition") {
        aVal = a.currentPosition ?? 999;
        bVal = b.currentPosition ?? 999;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [keywords, sortColumn, sortDirection, searchQuery, positionFilter, statusFilter]);

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
        <p className="mt-4 text-sm text-primary font-medium">{t('noKeywordsMonitored')}</p>
        <p className="mt-2 text-xs text-tertiary">{t('addKeywordsToStartTracking')}</p>
        <Button
          size="md"
          color="primary"
          iconLeading={Plus}
          onClick={() => setAddKeywordsModalOpen(true)}
          className="mt-4"
        >
          {t('addKeywords')}
        </Button>
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
        {/* SERP Fetch Job Progress */}
        {activeSerpJob && activeSerpJob.status !== "completed" && (
          <div className="rounded-lg border border-utility-blue-200 bg-utility-blue-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-utility-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-utility-blue-900">
                  {t('fetchingSerpData')}
                </span>
              </div>
              <span className="text-sm text-utility-blue-700">
                {t('serpProgress', { processed: activeSerpJob.processedKeywords, total: activeSerpJob.totalKeywords })}
              </span>
            </div>
            <div className="w-full bg-utility-blue-200 rounded-full h-2">
              <div
                className="bg-utility-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(activeSerpJob.processedKeywords / activeSerpJob.totalKeywords) * 100}%`,
                }}
              />
            </div>
            {activeSerpJob.failedKeywords > 0 && (
              <p className="text-xs text-utility-error-600 mt-2">
                {t('serpFailed', { count: activeSerpJob.failedKeywords })}
              </p>
            )}
          </div>
        )}

        <div className="mb-3">
          <h3 className="text-lg font-semibold text-primary">{t('keywordMonitoring')}</h3>
          <p className="text-sm text-tertiary">
            {t('keywordMonitoringDescription', { count: sortedAndFilteredKeywords.length })}
          </p>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* Add Keywords Button */}
            <Button
              size="sm"
              color="primary"
              iconLeading={Plus}
              onClick={() => setAddKeywordsModalOpen(true)}
            >
              {t('addKeywords')}
            </Button>

            {/* Refresh All Button */}
            <Button
              size="sm"
              color="secondary"
              iconLeading={RefreshCw01}
              onClick={async () => {
                if (!keywords || keywords.length === 0) return;
                try {
                  const allKeywordIds = keywords.map(kw => kw.keywordId);
                  await refreshPositions({ keywordIds: allKeywordIds });
                  toast.success(t('queuedRefreshForKeywords', { count: keywords.length }));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t('failedToRefreshPositions'));
                }
              }}
              disabled={!keywords || keywords.length === 0}
            >
              {t('refreshAll')}
            </Button>

            {/* Fetch SERP Data Button */}
            <Button
              size="sm"
              color="secondary"
              onClick={async () => {
                if (!keywords || keywords.length === 0) return;
                try {
                  const allKeywordIds = keywords.map(kw => kw.keywordId);
                  await createSerpFetchJob({
                    domainId,
                    keywordIds: allKeywordIds
                  });
                  toast.success(t('serpFetchJobQueued', { count: keywords.length }));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t('failedToQueueSerpFetch'));
                }
              }}
              disabled={!keywords || keywords.length === 0 || (!!activeSerpJob && activeSerpJob.status !== "completed")}
            >
              {activeSerpJob && activeSerpJob.status !== "completed" ? t('fetching') : t('fetchSerpData')}
            </Button>

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

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{tc('status')}:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{tc('all')}</option>
                <option value="rising">{t('statusRising')}</option>
                <option value="falling">{t('statusFalling')}</option>
                <option value="stable">{t('statusStable')}</option>
                <option value="new">{tc('new')}</option>
              </select>
            </div>

            {/* Clear filters */}
            {(positionFilter !== "all" || statusFilter !== "all" || searchQuery) && (
              <Button
                size="sm"
                color="secondary"
                onClick={() => {
                  setPositionFilter("all");
                  setStatusFilter("all");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
              >
                {t('clearAll')}
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
                    onClick={() => toggleSort("phrase")}
                  >
                    <div className="flex items-center gap-2">
                      {t('columnKeyword')}
                      <SortIcon column="phrase" />
                    </div>
                  </th>
                )}
                {columnVisibility.position && (
                  <th
                    className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                    onClick={() => toggleSort("currentPosition")}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {t('columnPosition')}
                      <SortIcon column="currentPosition" />
                    </div>
                  </th>
                )}
                {columnVisibility.previous && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnPrevious')}
                  </th>
                )}
                {columnVisibility.change && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnChange')}
                  </th>
                )}
                {columnVisibility.volume && (
                  <th
                    className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                    onClick={() => toggleSort("searchVolume")}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {t('columnVolume')}
                      <SortIcon column="searchVolume" />
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
                {columnVisibility.competition && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnCompetition')}
                  </th>
                )}
                {columnVisibility.intent && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnIntent')}
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
                const isExpanded = expandedRows.has(keyword.keywordId);
                const isRefreshing = keyword.checkingStatus === "queued" || keyword.checkingStatus === "checking";

                return (
                  <React.Fragment key={keyword.keywordId}>
                    <tr
                      className="transition-colors hover:bg-primary_hover cursor-pointer"
                      onClick={() => setSelectedKeyword(keyword)}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(keyword.keywordId);
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
                            <span className="text-sm font-medium text-primary">{keyword.phrase}</span>
                            {keyword.status === "new" && (
                              <span className="inline-flex items-center rounded-full bg-utility-blue-50 px-2 py-0.5 text-xs font-medium text-utility-blue-700">
                                {tc('new')}
                              </span>
                            )}
                            {keyword.status === "rising" && (
                              <span className="inline-flex items-center rounded-full bg-utility-success-50 px-2 py-0.5 text-xs font-medium text-utility-success-700">
                                ↑
                              </span>
                            )}
                            {keyword.status === "falling" && (
                              <span className="inline-flex items-center rounded-full bg-utility-error-50 px-2 py-0.5 text-xs font-medium text-utility-error-700">
                                ↓
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {columnVisibility.position && (
                        <td className="px-4 py-3 text-center">
                          {isRefreshing ? (
                            <RefreshCw01 className="h-4 w-4 animate-spin text-brand-600 inline-block" />
                          ) : keyword.currentPosition ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPositionBadgeClass(
                                keyword.currentPosition
                              )}`}
                            >
                              {keyword.currentPosition}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.previous && (
                        <td className="px-4 py-3 text-center">
                          {keyword.previousPosition ? (
                            <span className="inline-flex items-center rounded-full bg-utility-gray-50 px-2.5 py-0.5 text-xs font-medium text-utility-gray-600">
                              {keyword.previousPosition}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.change && (
                        <td className="px-4 py-3 text-center">
                          {keyword.change !== null && keyword.change !== 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                keyword.change > 0
                                  ? "bg-utility-success-50 text-utility-success-700"
                                  : "bg-utility-error-50 text-utility-error-700"
                              }`}
                            >
                              {keyword.change > 0 ? "↑" : "↓"} {Math.abs(keyword.change)}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.volume && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {formatNumber(keyword.searchVolume)}
                        </td>
                      )}
                      {columnVisibility.difficulty && (
                        <td className="px-4 py-3 text-center">
                          {keyword.difficulty !== undefined && keyword.difficulty !== null ? (
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
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.cpc && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {keyword.cpc !== undefined && keyword.cpc !== null ? `$${keyword.cpc.toFixed(2)}` : "—"}
                        </td>
                      )}
                      {columnVisibility.etv && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {keyword.etv !== undefined && keyword.etv !== null ? keyword.etv.toFixed(2) : "—"}
                        </td>
                      )}
                      {columnVisibility.competition && (
                        <td className="px-4 py-3 text-center text-sm text-primary">
                          {keyword.competition !== undefined && keyword.competition !== null ? (
                            `${(keyword.competition * 100).toFixed(0)}%`
                          ) : keyword.competitionLevel ? (
                            <span className="text-xs text-tertiary">{keyword.competitionLevel}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      {columnVisibility.intent && (
                        <td className="px-4 py-3 text-center">
                          {keyword.intent ? (
                            <span className="inline-flex items-center rounded-full bg-utility-gray-50 px-2 py-0.5 text-xs font-medium text-utility-gray-700">
                              {keyword.intent}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.actions && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefresh(keyword.keywordId);
                              }}
                              disabled={isRefreshing}
                              className="text-tertiary hover:text-primary transition-colors disabled:opacity-50"
                              title={t('refreshPosition')}
                            >
                              <RefreshCw01 className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(keyword.keywordId, keyword.phrase);
                              }}
                              className="text-tertiary hover:text-utility-error-600 transition-colors"
                              title={t('deleteKeyword')}
                            >
                              <Trash01 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Expanded row content */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={12} className="bg-secondary/20 p-6">
                          <div className="space-y-6">
                            {/* Position History Chart */}
                            {keyword.positionHistory && keyword.positionHistory.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-primary mb-3">{t('positionHistory')}</h4>
                                <KeywordPositionChart positionHistory={keyword.positionHistory} />
                              </div>
                            )}

                            {/* Additional details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="rounded-lg border border-secondary bg-primary p-4">
                                <p className="text-xs text-tertiary mb-1">{t('url')}</p>
                                <p className="text-sm text-primary font-medium truncate" title={keyword.url}>
                                  {keyword.url || "—"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-secondary bg-primary p-4">
                                <p className="text-xs text-tertiary mb-1">{t('potential')}</p>
                                <p className="text-sm text-primary font-medium">
                                  {keyword.potential ? formatNumber(keyword.potential) : "—"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-secondary bg-primary p-4">
                                <p className="text-xs text-tertiary mb-1">{t('lastUpdated')}</p>
                                <p className="text-sm text-primary font-medium">
                                  {keyword.lastUpdated ? new Date(keyword.lastUpdated).toLocaleDateString() : "—"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-secondary bg-primary p-4">
                                <p className="text-xs text-tertiary mb-1">{tc('status')}</p>
                                <p className="text-sm text-primary font-medium capitalize">
                                  {keyword.status || "—"}
                                </p>
                              </div>
                            </div>
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

      {/* Add Keywords Modal */}
      <AddKeywordsModal
        domainId={domainId}
        isOpen={addKeywordsModalOpen}
        onClose={() => setAddKeywordsModalOpen(false)}
      />

      {/* Keyword Detail Modal */}
      <KeywordMonitoringDetailModal
        keyword={selectedKeyword}
        isOpen={!!selectedKeyword}
        onClose={() => setSelectedKeyword(null)}
      />
    </>
  );
}
