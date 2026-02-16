"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  SearchLg,
  Settings01,
  FilterLines,
  ChevronLeft,
  ChevronRight,
  Eye,
  XClose,
  TrendUp02,
  HelpCircle,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { toast } from "sonner";
import { ContentGapDetailModal } from "../modals/ContentGapDetailModal";
import { useTranslations } from "next-intl";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/patterns/BulkActionBar";

interface ContentGapOpportunitiesTableProps {
  domainId: Id<"domains">;
}

type SortColumn =
  | "keywordPhrase"
  | "opportunityScore"
  | "searchVolume"
  | "difficulty"
  | "competitorPosition"
  | "estimatedTrafficValue";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  keyword: boolean;
  competitor: boolean;
  score: boolean;
  volume: boolean;
  difficulty: boolean;
  competitorPosition: boolean;
  estTraffic: boolean;
  status: boolean;
  priority: boolean;
  actions: boolean;
}

function formatNumber(num: number | null | undefined): string {
  if (!num && num !== 0) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getPriorityBadgeColor(priority: string): "success" | "warning" | "gray" {
  if (priority === "high") return "success";
  if (priority === "medium") return "warning";
  return "gray";
}

function getStatusBadgeColor(status: string): "success" | "warning" | "gray" | "brand" {
  if (status === "ranking") return "success";
  if (status === "monitoring") return "brand";
  if (status === "identified") return "warning";
  return "gray";
}

const COLUMN_TOOLTIP_KEYS: Record<string, { titleKey: string; descriptionKey: string }> = {
  keyword: { titleKey: "tooltipKeywordTitle", descriptionKey: "tooltipKeywordDesc" },
  competitor: { titleKey: "tooltipCompetitorTitle", descriptionKey: "tooltipCompetitorDesc" },
  score: { titleKey: "tooltipScoreFullTitle", descriptionKey: "tooltipScoreFullDesc" },
  volume: { titleKey: "tooltipVolumeTitle", descriptionKey: "tooltipVolumeDesc" },
  difficulty: { titleKey: "tooltipDifficultyFullTitle", descriptionKey: "tooltipDifficultyFullDesc" },
  competitorPosition: { titleKey: "tooltipCompPosTitle", descriptionKey: "tooltipCompPosDesc" },
  estTraffic: { titleKey: "tooltipEstTrafficTitle", descriptionKey: "tooltipEstTrafficDesc" },
  status: { titleKey: "tooltipStatusFullTitle", descriptionKey: "tooltipStatusFullDesc" },
  priority: { titleKey: "tooltipPriorityFullTitle", descriptionKey: "tooltipPriorityFullDesc" },
};

export function ContentGapOpportunitiesTable({ domainId }: ContentGapOpportunitiesTableProps) {
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const translateStatus = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as any;
    try { return tc(key); } catch { return status; }
  };
  const translatePriority = (priority: string) => {
    const key = `priority${priority.charAt(0).toUpperCase()}${priority.slice(1)}` as any;
    try { return tc(key); } catch { return priority; }
  };
  // Sort & search state
  const [sortColumn, setSortColumn] = useState<SortColumn>("opportunityScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);

  // UI toggles
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(null);

  // Filter states
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [difficultyMin, setDifficultyMin] = useState<string>("");
  const [difficultyMax, setDifficultyMax] = useState<string>("");
  const [competitorFilter, setCompetitorFilter] = useState<string>("all");

  // Column visibility - persisted to localStorage
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("contentGap_columnVisibility");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // use defaults
        }
      }
    }
    return {
      keyword: true,
      competitor: true,
      score: true,
      volume: true,
      difficulty: true,
      competitorPosition: true,
      estTraffic: true,
      status: false,
      priority: true,
      actions: true,
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("contentGap_columnVisibility", JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  // Build server-side filters
  const serverFilters = useMemo(() => {
    const f: Record<string, any> = {};
    if (priorityFilter !== "all") f.priority = priorityFilter;
    if (statusFilter !== "all") f.status = statusFilter;
    if (difficultyMin) f.minDifficulty = Number(difficultyMin);
    if (difficultyMax) f.maxDifficulty = Number(difficultyMax);
    if (competitorFilter !== "all") f.competitorId = competitorFilter;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [priorityFilter, statusFilter, difficultyMin, difficultyMax, competitorFilter]);

  // Queries
  const opportunities = useQuery(api.contentGaps_queries.getContentGaps, {
    domainId,
    filters: serverFilters,
  });
  const competitors = useQuery(api.competitors.getCompetitors, { domainId });

  // Mutations
  const markAsMonitoring = useMutation(api.contentGap.markOpportunityAsMonitoring);
  const dismissOpportunity = useMutation(api.contentGap.dismissOpportunity);
  const dismissOpportunities = useMutation(api.contentGap.dismissOpportunities);
  const selection = useRowSelection();

  // Sort & filter logic
  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column)
      return <ChevronSelectorVertical className="h-3.5 w-3.5 text-quaternary" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  const sortedAndFiltered = useMemo(() => {
    if (!opportunities) return [];

    let filtered = opportunities.filter((opp: any) => {
      if (!searchQuery) return true;
      return (
        opp.keywordPhrase?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.competitorDomain?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    filtered.sort((a: any, b: any) => {
      const aVal = a[sortColumn] ?? 0;
      const bVal = b[sortColumn] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [opportunities, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage);
  const paginated = sortedAndFiltered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const visibleIds = paginated.map((opp: any) => opp._id as string);

  // Handlers
  const handleMarkAsMonitoring = async (e: React.MouseEvent, gapId: Id<"contentGaps">, keyword: string) => {
    e.stopPropagation();
    try {
      await markAsMonitoring({ gapId });
      toast.success(t('toastMonitoringStarted', { keyword }));
    } catch (error: any) {
      toast.error(error.message || t('toastMonitoringFailed'));
    }
  };

  const handleDismiss = async (e: React.MouseEvent, gapId: Id<"contentGaps">, keyword: string) => {
    e.stopPropagation();
    try {
      await dismissOpportunity({ gapId });
      toast.success(t('toastDismissed', { keyword }));
    } catch (error: any) {
      toast.error(error.message || t('toastDismissFailed'));
    }
  };

  const hasActiveFilters =
    priorityFilter !== "all" ||
    statusFilter !== "all" ||
    difficultyMin !== "" ||
    difficultyMax !== "" ||
    competitorFilter !== "all" ||
    searchQuery !== "";

  const clearAllFilters = () => {
    setPriorityFilter("all");
    setStatusFilter("all");
    setDifficultyMin("");
    setDifficultyMax("");
    setCompetitorFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Column header helper with tooltip
  const ColumnHeader = ({
    id,
    label,
    sortable,
    sortKey,
    align = "left",
  }: {
    id: string;
    label: string;
    sortable?: boolean;
    sortKey?: SortColumn;
    align?: "left" | "center" | "right";
  }) => {
    const tooltipKeys = COLUMN_TOOLTIP_KEYS[id];
    const alignCls =
      align === "center" ? "justify-center text-center" : align === "right" ? "justify-end text-right" : "text-left";

    if (sortable && sortKey) {
      return (
        <th
          className={`cursor-pointer px-4 py-3 text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 ${alignCls}`}
          onClick={() => toggleSort(sortKey)}
        >
          <div className={`flex items-center gap-1 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
            {label}
            {tooltipKeys && (
              <Tooltip title={t(tooltipKeys.titleKey)} description={t(tooltipKeys.descriptionKey)}>
                <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                  <HelpCircle className="size-3" />
                </TooltipTrigger>
              </Tooltip>
            )}
            <SortIcon column={sortKey} />
          </div>
        </th>
      );
    }

    return (
      <th className={`px-4 py-3 text-xs font-medium text-tertiary ${alignCls}`}>
        <div className={`flex items-center gap-1 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
          {label}
          {tooltipKeys && (
            <Tooltip title={t(tooltipKeys.titleKey)} description={t(tooltipKeys.descriptionKey)}>
              <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                <HelpCircle className="size-3" />
              </TooltipTrigger>
            </Tooltip>
          )}
        </div>
      </th>
    );
  };

  // Loading state
  if (opportunities === undefined) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!competitors || competitors.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-12">
          <SearchLg className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="text-tertiary mb-2">{t('contentGapNoCompetitors')}</p>
          <p className="text-sm text-quaternary">
            {t('contentGapNoCompetitorsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Toolbar */}
      <div className="border-b border-secondary p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-primary">{t('contentGapTitle')}</h3>
              <Badge color="gray" size="sm">
                {t('contentGapResultsCount', { count: sortedAndFiltered.length })}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-tertiary">
              {t('contentGapDescription')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="w-64">
              <Input
                placeholder={t('contentGapSearchKeywords')}
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
              {hasActiveFilters ? t('contentGapFiltersActive') : t('contentGapFilters')}
            </Button>

            {/* Column picker */}
            <div className="relative">
              <Button
                size="sm"
                color="secondary"
                iconLeading={Settings01}
                onClick={() => setShowColumnPicker(!showColumnPicker)}
              >
                {t('contentGapColumns')}
              </Button>
              {showColumnPicker && (
                <div className="absolute right-0 top-full z-10 mt-2 w-52 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
                  <div className="flex flex-col gap-1">
                    {(Object.entries(columnVisibility) as [keyof ColumnVisibility, boolean][]).map(
                      ([key, value]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-secondary/50"
                        >
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={() => toggleColumn(key)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-primary capitalize">{key}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
            {/* Priority filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('contentGapFilterPriority')}</label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{tc('all')}</option>
                <option value="high">{tc('priorityHigh')}</option>
                <option value="medium">{tc('priorityMedium')}</option>
                <option value="low">{tc('priorityLow')}</option>
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('contentGapFilterStatus')}</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{tc('all')}</option>
                <option value="identified">{tc('statusIdentified')}</option>
                <option value="monitoring">{tc('statusMonitoring')}</option>
                <option value="ranking">{tc('statusRanking')}</option>
                <option value="dismissed">{tc('statusDismissed')}</option>
              </select>
            </div>

            {/* Difficulty range */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('contentGapFilterDifficulty')}</label>
              <select
                value={difficultyMin}
                onChange={(e) => {
                  setDifficultyMin(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="">{t('contentGapFilterMin')}</option>
                {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="text-tertiary">—</span>
              <select
                value={difficultyMax}
                onChange={(e) => {
                  setDifficultyMax(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="">{t('contentGapFilterMax')}</option>
                {[10, 20, 30, 40, 50, 60, 70, 80, 100].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Competitor filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('contentGapFilterCompetitor')}</label>
              <select
                value={competitorFilter}
                onChange={(e) => {
                  setCompetitorFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{tc('all')}</option>
                {competitors?.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.competitorDomain || c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear all */}
            {hasActiveFilters && (
              <Button size="sm" color="secondary" onClick={clearAllFilters}>
                {t('contentGapClearAll')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="text-center py-12 text-tertiary">
          <p className="mb-2">{t('contentGapNoOpportunities')}</p>
          <p className="text-sm text-quaternary">
            {hasActiveFilters
              ? t('contentGapAdjustFilters')
              : t('contentGapNoOpportunitiesHint')}
          </p>
        </div>
      ) : (
        <>
        <BulkActionBar
          selectedCount={selection.count}
          selectedIds={selection.selectedIds}
          onClearSelection={selection.clear}
          actions={[
            {
              label: tc('bulkMarkAsMonitoring'),
              icon: Eye,
              onClick: async (ids) => {
                const identifiedGaps = sortedAndFiltered
                  .filter((opp: any) => ids.has(opp._id) && opp.status === "identified");
                let successCount = 0;
                for (const gap of identifiedGaps) {
                  try {
                    await markAsMonitoring({ gapId: gap._id });
                    successCount++;
                  } catch { /* skip individual errors */ }
                }
                if (successCount > 0) {
                  toast.success(tc('bulkActionSuccess', { count: successCount }));
                }
                selection.clear();
              },
            },
            {
              label: tc('bulkDismiss'),
              icon: XClose,
              variant: "destructive" as const,
              onClick: async (ids) => {
                const gapIds = sortedAndFiltered
                  .filter((opp: any) => ids.has(opp._id) && opp.status === "identified")
                  .map((opp: any) => opp._id);
                if (gapIds.length === 0) return;
                try {
                  await dismissOpportunities({ gapIds });
                  toast.success(tc('bulkActionSuccess', { count: gapIds.length }));
                  selection.clear();
                } catch {
                  toast.error(tc('bulkActionFailed'));
                }
              },
            },
          ]}
        />

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/30">
              <tr className="border-b border-secondary">
                <th className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected(visibleIds)}
                    ref={(el) => { if (el) el.indeterminate = selection.isIndeterminate(visibleIds); }}
                    onChange={() => selection.toggleAll(visibleIds)}
                    className="h-4 w-4 rounded border-secondary"
                  />
                </th>
                {columnVisibility.keyword && (
                  <ColumnHeader id="keyword" label={t('columnKeywordPhrase')} sortable sortKey="keywordPhrase" />
                )}
                {columnVisibility.competitor && (
                  <ColumnHeader id="competitor" label={t('columnCompetitors')} />
                )}
                {columnVisibility.score && (
                  <ColumnHeader id="score" label={t('columnOpportunityScore')} sortable sortKey="opportunityScore" align="center" />
                )}
                {columnVisibility.volume && (
                  <ColumnHeader id="volume" label={t('columnSearchVolume')} sortable sortKey="searchVolume" align="right" />
                )}
                {columnVisibility.difficulty && (
                  <ColumnHeader id="difficulty" label={t('columnDifficulty')} sortable sortKey="difficulty" align="center" />
                )}
                {columnVisibility.competitorPosition && (
                  <ColumnHeader id="competitorPosition" label={t('columnCompetitorPosition')} sortable sortKey="competitorPosition" align="center" />
                )}
                {columnVisibility.estTraffic && (
                  <ColumnHeader id="estTraffic" label={t('columnEstTraffic')} sortable sortKey="estimatedTrafficValue" align="right" />
                )}
                {columnVisibility.status && (
                  <ColumnHeader id="status" label={t('columnReportStatus')} align="center" />
                )}
                {columnVisibility.priority && (
                  <ColumnHeader id="priority" label={t('columnPriority')} align="center" />
                )}
                {columnVisibility.actions && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    {t('columnActions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {paginated.map((opp: any) => (
                <tr
                  key={opp._id}
                  className="cursor-pointer transition-colors hover:bg-primary_hover"
                  onClick={() => setSelectedOpportunity(opp)}
                >
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selection.isSelected(opp._id)}
                      onChange={() => selection.toggle(opp._id)}
                      className="h-4 w-4 rounded border-secondary"
                    />
                  </td>
                  {columnVisibility.keyword && (
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-primary">
                        {opp.keywordPhrase || "Unknown"}
                      </span>
                    </td>
                  )}
                  {columnVisibility.competitor && (
                    <td className="px-4 py-3">
                      <span className="text-sm text-tertiary truncate max-w-[160px] block">
                        {opp.competitorDomain || "Unknown"}
                      </span>
                    </td>
                  )}
                  {columnVisibility.score && (
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-sm font-semibold ${
                          opp.opportunityScore >= 70
                            ? "text-utility-success-600"
                            : opp.opportunityScore >= 40
                              ? "text-utility-warning-600"
                              : "text-tertiary"
                        }`}
                      >
                        {Math.round(opp.opportunityScore)}
                      </span>
                    </td>
                  )}
                  {columnVisibility.volume && (
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-primary">
                        {formatNumber(opp.searchVolume)}
                      </span>
                    </td>
                  )}
                  {columnVisibility.difficulty && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              opp.difficulty >= 70
                                ? "bg-utility-error-500"
                                : opp.difficulty >= 40
                                  ? "bg-utility-warning-500"
                                  : "bg-utility-success-500"
                            }`}
                            style={{ width: `${Math.min(opp.difficulty, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-tertiary w-6 text-right">{opp.difficulty}</span>
                      </div>
                    </td>
                  )}
                  {columnVisibility.competitorPosition && (
                    <td className="px-4 py-3 text-center">
                      <Badge color="gray" size="sm">
                        #{opp.competitorPosition}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.estTraffic && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-sm text-primary">
                        <TrendUp02 className="h-3 w-3 text-utility-success-500" />
                        {formatNumber(opp.estimatedTrafficValue)}
                      </div>
                    </td>
                  )}
                  {columnVisibility.status && (
                    <td className="px-4 py-3 text-center">
                      <Badge color={getStatusBadgeColor(opp.status)} size="sm">
                        {translateStatus(opp.status)}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.priority && (
                    <td className="px-4 py-3 text-center">
                      <Badge color={getPriorityBadgeColor(opp.priority)} size="sm">
                        {translatePriority(opp.priority)}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.actions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {opp.status === "identified" && (
                          <Button
                            size="sm"
                            color="secondary"
                            onClick={(e: React.MouseEvent) => handleMarkAsMonitoring(e, opp._id, opp.keywordPhrase)}
                            iconLeading={Eye}
                            title={t('contentGapStartMonitoring')}
                          />
                        )}
                        {opp.status !== "dismissed" && (
                          <Button
                            size="sm"
                            color="tertiary"
                            onClick={(e: React.MouseEvent) => handleDismiss(e, opp._id, opp.keywordPhrase)}
                            iconLeading={XClose}
                            title={t('contentGapDismiss')}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-secondary px-4 py-3">
          <span className="text-sm text-tertiary">
            {t('contentGapPagination', { currentPage, totalPages, total: sortedAndFiltered.length })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={ChevronLeft}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {t('contentGapPrevious')}
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconLeading={ChevronRight}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {t('contentGapNext')}
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ContentGapDetailModal
        opportunity={selectedOpportunity}
        isOpen={!!selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        domainId={domainId}
      />
    </div>
  );
}
