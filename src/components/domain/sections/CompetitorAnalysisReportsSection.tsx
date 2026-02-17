"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  FileSearch02,
  Trash01,
  RefreshCw01,
  SearchLg,
  ChevronSelectorVertical,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  FilterLines,
} from "@untitledui/icons";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { KeywordAnalysisReportDetailModal } from "../modals/KeywordAnalysisReportDetailModal";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface CompetitorAnalysisReportsSectionProps {
  domainId: Id<"domains">;
}

type SortColumn = "keyword" | "status" | "competitors" | "avgWords" | "recommendations" | "createdAt";
type SortDirection = "asc" | "desc";

function SortIcon({ column, currentSort, currentDirection }: {
  column: SortColumn;
  currentSort: SortColumn;
  currentDirection: SortDirection;
}) {
  if (currentSort !== column) {
    return <ChevronSelectorVertical className="h-3.5 w-3.5 text-quaternary" />;
  }
  return currentDirection === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 text-brand-600" />
    : <ArrowDown className="h-3.5 w-3.5 text-brand-600" />;
}

function ColumnTooltip({ text }: { text: string }) {
  return (
    <Tooltip title={text} delay={200}>
      <TooltipTrigger className="ml-1 inline-flex text-fg-quaternary hover:text-fg-quaternary_hover">
        <HelpCircle className="h-3.5 w-3.5" />
      </TooltipTrigger>
    </Tooltip>
  );
}

export function CompetitorAnalysisReportsSection({ domainId }: CompetitorAnalysisReportsSectionProps) {
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const translateStatus = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as any;
    try { return tc(key); } catch { return status; }
  };
  const [selectedReportId, setSelectedReportId] = useState<Id<"competitorAnalysisReports"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [isGenerating, setIsGenerating] = useState(false);

  const reports = useQuery(api.competitorAnalysisReports.getReportsForDomain, { domainId });
  const deleteReport = useMutation(api.competitorAnalysisReports.deleteReport);
  const retryAnalysis = useMutation(api.competitorAnalysisReports.retryAnalysis);
  const generateAll = useMutation(api.competitorAnalysisReports.generateAllKeywordReports);

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    try {
      const result = await generateAll({ domainId });
      if (result.created > 0) {
        toast.success(result.skipped > 0
          ? t('reportsToastGeneratedSkipped', { created: result.created, skipped: result.skipped })
          : t('reportsToastGenerated', { created: result.created }));
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.info(t('reportsToastAllAlready'));
      }
    } catch (error: any) {
      toast.error(error.message || t('reportsToastGenerateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    if (!reports) return [];

    let filtered = [...reports];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.keyword.toLowerCase().includes(q) ||
          r.competitorPages.some((c) => c.domain.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const mul = sortDirection === "asc" ? 1 : -1;
      switch (sortColumn) {
        case "keyword":
          return a.keyword.localeCompare(b.keyword) * mul;
        case "status": {
          const order = { completed: 0, analyzing: 1, pending: 2, failed: 3 };
          return ((order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4)) * mul;
        }
        case "competitors":
          return (a.competitorPages.length - b.competitorPages.length) * mul;
        case "avgWords": {
          const aW = a.analysis?.avgCompetitorWordCount ?? 0;
          const bW = b.analysis?.avgCompetitorWordCount ?? 0;
          return (aW - bW) * mul;
        }
        case "recommendations": {
          const aR = a.recommendations?.length ?? 0;
          const bR = b.recommendations?.length ?? 0;
          return (aR - bR) * mul;
        }
        case "createdAt":
          return (a.createdAt - b.createdAt) * mul;
        default:
          return 0;
      }
    });

    return filtered;
  }, [reports, searchQuery, statusFilter, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);
  const paginatedReports = filteredAndSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleRetry = async (e: React.MouseEvent, reportId: Id<"competitorAnalysisReports">) => {
    e.stopPropagation();
    try {
      await retryAnalysis({ reportId });
      toast.success(t('reportsToastRetrying'));
    } catch (error: any) {
      toast.error(error?.message || t('reportsToastRetryFailed'));
    }
  };

  const handleDelete = async (e: React.MouseEvent, reportId: Id<"competitorAnalysisReports">) => {
    e.stopPropagation();
    try {
      await deleteReport({ reportId });
      if (selectedReportId === reportId) setSelectedReportId(null);
      toast.success(t('reportsToastDeleted'));
    } catch (error: any) {
      toast.error(error?.message || t('reportsToastDeleteFailed'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "analyzing": return "brand";
      case "failed": return "error";
      default: return "gray";
    }
  };

  if (reports === undefined) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="text-center py-8 text-tertiary">{t('reportsLoading')}</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="text-center py-12">
          <FileSearch02 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <h3 className="text-md font-semibold text-primary mb-2">{t('reportsEmpty')}</h3>
          <p className="text-sm text-quaternary max-w-md mx-auto mb-4">
            {t('reportsEmptyDesc')}
          </p>
          <Button
            color="primary"
            size="md"
            onClick={handleGenerateAll}
            isDisabled={isGenerating}
            iconLeading={isGenerating ? RefreshCw01 : FileSearch02}
          >
            {isGenerating ? t('reportsGenerating') : t('reportsGenerateAll')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-primary">{t('reportsTitle')}</h3>
          <Badge color="gray" size="sm">
            {filteredAndSorted.length}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-quaternary pointer-events-none" />
            <input
              type="text"
              placeholder={t('reportsSearchKeywords')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-64 pl-9 pr-3 py-2 border border-secondary rounded-lg text-sm bg-primary text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600"
            />
          </div>

          {/* Generate + Refresh */}
          <Button
            color="secondary"
            size="sm"
            onClick={handleGenerateAll}
            isDisabled={isGenerating}
            iconLeading={isGenerating ? RefreshCw01 : FileSearch02}
          >
            {isGenerating ? t('reportsGenerating') : t('reportsGenerateMissing')}
          </Button>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-secondary text-tertiary hover:text-primary hover:bg-secondary"
            }`}
          >
            <FilterLines className="h-4 w-4" />
            {t('reportsFilters')}
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-secondary bg-secondary/30">
          <div>
            <label className="block text-xs font-medium text-tertiary mb-1">{t('reportsFilterStatus')}</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-secondary rounded-lg text-sm bg-primary"
            >
              <option value="all">{t('reportsFilterAll')}</option>
              <option value="completed">{t('reportsFilterCompleted')}</option>
              <option value="analyzing">{t('reportsFilterAnalyzing')}</option>
              <option value="pending">{t('reportsFilterPending')}</option>
              <option value="failed">{t('reportsFilterFailed')}</option>
            </select>
          </div>
          {(statusFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="text-xs text-brand-600 hover:text-brand-700 mt-4"
            >
              {t('reportsClearAll')}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => toggleSort("keyword")}
              >
                <div className="flex items-center gap-1">
                  {t('reportsColKeyword')}
                  <SortIcon column="keyword" currentSort={sortColumn} currentDirection={sortDirection} />
                  <ColumnTooltip text={t('reportsTooltipKeyword')} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => toggleSort("status")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColStatus')}
                  <SortIcon column="status" currentSort={sortColumn} currentDirection={sortDirection} />
                  <ColumnTooltip text={t('reportsTooltipStatus')} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => toggleSort("competitors")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColCompetitors')}
                  <SortIcon column="competitors" currentSort={sortColumn} currentDirection={sortDirection} />
                  <ColumnTooltip text={t('reportsTooltipCompetitors')} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => toggleSort("avgWords")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColAvgWords')}
                  <SortIcon column="avgWords" currentSort={sortColumn} currentDirection={sortDirection} />
                  <ColumnTooltip text={t('reportsTooltipAvgWords')} />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColAvgH2')}
                  <ColumnTooltip text={t('reportsTooltipAvgH2')} />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColAvgImages')}
                  <ColumnTooltip text={t('reportsTooltipAvgImages')} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => toggleSort("recommendations")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColRecs')}
                  <SortIcon column="recommendations" currentSort={sortColumn} currentDirection={sortDirection} />
                  <ColumnTooltip text={t('reportsTooltipRecs')} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => toggleSort("createdAt")}
              >
                <div className="flex items-center justify-center gap-1">
                  {t('reportsColCreated')}
                  <SortIcon column="createdAt" currentSort={sortColumn} currentDirection={sortDirection} />
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                {t('reportsColActions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {paginatedReports.map((report) => (
              <tr
                key={report._id}
                onClick={() => setSelectedReportId(report._id)}
                className="hover:bg-primary_hover transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-primary">{report.keyword}</span>
                  {report.competitorPages.length > 0 && (
                    <span className="block text-xs text-quaternary truncate max-w-[250px]">
                      vs {report.competitorPages.map((c) => c.domain).join(", ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge color={getStatusColor(report.status)} size="sm">
                    {translateStatus(report.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center text-sm text-primary">
                  {report.competitorPages.length}
                </td>
                <td className="px-4 py-3 text-center text-sm text-primary">
                  {report.analysis?.avgCompetitorWordCount
                    ? Math.round(report.analysis.avgCompetitorWordCount).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center text-sm text-primary">
                  {report.analysis?.avgCompetitorH2Count
                    ? Math.round(report.analysis.avgCompetitorH2Count)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center text-sm text-primary">
                  {report.analysis?.avgCompetitorImagesCount
                    ? Math.round(report.analysis.avgCompetitorImagesCount)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {report.recommendations && report.recommendations.length > 0 ? (
                    <Badge color="brand" size="sm">
                      {report.recommendations.length}
                    </Badge>
                  ) : (
                    <span className="text-sm text-quaternary">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-xs text-tertiary whitespace-nowrap">
                  {new Date(report.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {(report.status === "completed" || report.status === "failed") && (
                      <Button
                        color="tertiary"
                        size="sm"
                        iconLeading={RefreshCw01}
                        onClick={(e: React.MouseEvent) => handleRetry(e, report._id)}
                        title={t('reportsActionRerun')}
                      />
                    )}
                    <Button
                      color="tertiary-destructive"
                      size="sm"
                      iconLeading={Trash01}
                      onClick={(e: React.MouseEvent) => handleDelete(e, report._id)}
                      title={t('reportsActionDelete')}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedReports.length === 0 && (
          <div className="text-center py-12 text-tertiary">
            {t('reportsNoMatch')}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-tertiary">
            {t('reportsPagination', { currentPage, totalPages, total: filteredAndSorted.length })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-secondary rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary"
            >
              {t('reportsPrevious')}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-secondary rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary"
            >
              {t('reportsNext')}
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReportId && (
        <KeywordAnalysisReportDetailModal
          reportId={selectedReportId}
          isOpen={!!selectedReportId}
          onClose={() => setSelectedReportId(null)}
        />
      )}
    </div>
  );
}
