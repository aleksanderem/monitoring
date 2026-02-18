"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import {
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  ChevronLeft,
  ChevronRight,
  SearchLg,
  FilterLines,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  InfoCircle,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { PageDetailModal } from "../modals/PageDetailModal";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface OnSitePagesTableProps {
  domainId: Id<"domains">;
  scanId?: Id<"onSiteScans">;
}

type SortColumn = "url" | "score" | "statusCode" | "wordCount" | "performance" | "issueCount";
type SortDirection = "asc" | "desc";

function getGradeBg(grade: string) {
  switch (grade) {
    case "A": return "bg-utility-success-50 text-utility-success-700";
    case "B": return "bg-utility-success-50 text-utility-success-600";
    case "C": return "bg-utility-warning-50 text-utility-warning-700";
    case "D": return "bg-utility-warning-50 text-utility-warning-600";
    default: return "bg-utility-error-50 text-utility-error-700";
  }
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-utility-success-50 text-utility-success-600";
  if (score >= 60) return "bg-utility-warning-50 text-utility-warning-600";
  return "bg-utility-error-50 text-utility-error-600";
}

function getStatusCodeColor(code: number) {
  if (code >= 200 && code < 300) return "bg-utility-success-50 text-utility-success-600";
  if (code >= 300 && code < 400) return "bg-utility-warning-50 text-utility-warning-600";
  return "bg-utility-error-50 text-utility-error-600";
}

function getEffectiveScore(page: any): number {
  return page.pageScore?.composite ?? page.onpageScore ?? -1;
}

function getEffectiveGrade(page: any): string | null {
  return page.pageScore?.grade ?? null;
}

export function OnSitePagesTable({ domainId, scanId }: OnSitePagesTableProps) {
  const t = useTranslations('onsite');
  const [sortColumn, setSortColumn] = useState<SortColumn>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);

  // Filters
  const [issuesFilter, setIssuesFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  const pagesData = useQuery(api.seoAudit_queries.getPagesList, {
    domainId,
    scanId,
    limit: 500,
    offset: 0,
  });

  const allPages = pagesData?.pages || [];

  const sortedAndFiltered = useMemo(() => {
    let result = [...allPages];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.url.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q)
      );
    }

    // Issues filter
    if (issuesFilter === "has_issues") {
      result = result.filter((p) => p.issueCount > 0);
    } else if (issuesFilter === "no_issues") {
      result = result.filter((p) => p.issueCount === 0);
    } else if (issuesFilter === "critical") {
      result = result.filter((p) =>
        ((p.issues || []) as Array<{ type: string }>).some((i) => i.type === "critical")
      );
    } else if (issuesFilter === "warning") {
      result = result.filter((p) =>
        ((p.issues || []) as Array<{ type: string }>).some((i) => i.type === "warning")
      );
    }

    // Score filter (uses composite)
    if (scoreFilter === "good") {
      result = result.filter((p) => getEffectiveScore(p) >= 80);
    } else if (scoreFilter === "needs_work") {
      result = result.filter((p) => {
        const s = getEffectiveScore(p);
        return s >= 50 && s < 80;
      });
    } else if (scoreFilter === "poor") {
      result = result.filter((p) => {
        const s = getEffectiveScore(p);
        return s >= 0 && s < 50;
      });
    }

    // Grade filter
    if (gradeFilter !== "all") {
      result = result.filter((p) => getEffectiveGrade(p) === gradeFilter);
    }

    // Status code filter
    if (statusFilter === "2xx") {
      result = result.filter((p) => p.statusCode >= 200 && p.statusCode < 300);
    } else if (statusFilter === "3xx") {
      result = result.filter((p) => p.statusCode >= 300 && p.statusCode < 400);
    } else if (statusFilter === "4xx") {
      result = result.filter((p) => p.statusCode >= 400 && p.statusCode < 500);
    } else if (statusFilter === "5xx") {
      result = result.filter((p) => p.statusCode >= 500);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number;
      let bVal: number;
      switch (sortColumn) {
        case "url":
          return sortDirection === "asc"
            ? a.url.localeCompare(b.url)
            : b.url.localeCompare(a.url);
        case "score":
          aVal = getEffectiveScore(a);
          bVal = getEffectiveScore(b);
          break;
        case "statusCode":
          aVal = a.statusCode;
          bVal = b.statusCode;
          break;
        case "wordCount":
          aVal = a.wordCount ?? 0;
          bVal = b.wordCount ?? 0;
          break;
        case "performance":
          aVal = a.lighthouseScores?.performance ?? -1;
          bVal = b.lighthouseScores?.performance ?? -1;
          break;
        case "issueCount":
          aVal = a.issueCount ?? 0;
          bVal = b.issueCount ?? 0;
          break;
        default:
          return 0;
      }
      const cmp = aVal - bVal;
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [allPages, searchQuery, issuesFilter, scoreFilter, gradeFilter, statusFilter, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage);
  const paginatedPages = sortedAndFiltered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const hasActiveFilters =
    searchQuery !== "" || issuesFilter !== "all" || scoreFilter !== "all" || statusFilter !== "all" || gradeFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setIssuesFilter("all");
    setScoreFilter("all");
    setGradeFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ChevronSelectorVertical className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  if (pagesData === undefined) {
    return <LoadingState />;
  }

  if (allPages.length === 0) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-8 text-center">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <AlertCircle className="mx-auto h-12 w-12 text-fg-quaternary" />
        <h3 className="mt-4 text-sm font-semibold text-primary">{t('noPageDataAvailable')}</h3>
        <p className="mt-1 text-sm text-tertiary">
          {t('noPageDataDescription')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">{t('analyzedPages')}</h3>
            <p className="text-sm text-tertiary">
              {sortedAndFiltered.length} of {allPages.length} pages
              {hasActiveFilters && ` (${t('filtered')})`} — {t('clickRowForDetails')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Input
                placeholder={t('searchUrlOrTitle')}
                value={searchQuery}
                onChange={(value) => { setSearchQuery(value); setCurrentPage(1); }}
                icon={SearchLg}
              />
            </div>
            <Button
              size="sm"
              color={showFilters ? "primary" : "secondary"}
              iconLeading={FilterLines}
              onClick={() => setShowFilters(!showFilters)}
            >
              {t('filters')}
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('filterIssues')}:</label>
              <select
                value={issuesFilter}
                onChange={(e) => { setIssuesFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{t('filterAll')}</option>
                <option value="has_issues">{t('filterHasIssues')}</option>
                <option value="no_issues">{t('filterNoIssues')}</option>
                <option value="critical">{t('filterCriticalOnly')}</option>
                <option value="warning">{t('filterWarningsOnly')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('filterGrade')}:</label>
              <select
                value={gradeFilter}
                onChange={(e) => { setGradeFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{t('filterAll')}</option>
                <option value="A">{t('filterGradeA')}</option>
                <option value="B">{t('filterGradeB')}</option>
                <option value="C">{t('filterGradeC')}</option>
                <option value="D">{t('filterGradeD')}</option>
                <option value="F">{t('filterGradeF')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('filterScore')}:</label>
              <select
                value={scoreFilter}
                onChange={(e) => { setScoreFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{t('filterAll')}</option>
                <option value="good">{t('filterGood80')}</option>
                <option value="needs_work">{t('filterNeedsWork50')}</option>
                <option value="poor">{t('filterPoorBelow50')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">{t('filterStatus')}:</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">{t('filterAll')}</option>
                <option value="2xx">{t('filter2xxOk')}</option>
                <option value="3xx">{t('filter3xxRedirect')}</option>
                <option value="4xx">{t('filter4xxError')}</option>
                <option value="5xx">{t('filter5xxServer')}</option>
              </select>
            </div>

            {hasActiveFilters && (
              <Button size="sm" color="secondary" onClick={clearFilters}>
                {t('clearAll')}
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("url")}
                >
                  <div className="flex items-center gap-2">
                    {t('colPage')}
                    <SortIcon column="url" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-24"
                  onClick={() => toggleSort("score")}
                >
                  <div className="flex items-center justify-center gap-2">
                    {t('colScore')}
                    <SortIcon column="score" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-20"
                  onClick={() => toggleSort("statusCode")}
                >
                  <div className="flex items-center justify-center gap-2">
                    {t('colStatus')}
                    <SortIcon column="statusCode" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-24"
                  onClick={() => toggleSort("wordCount")}
                >
                  <div className="flex items-center justify-end gap-2">
                    {t('colWords')}
                    <SortIcon column="wordCount" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-24"
                  onClick={() => toggleSort("performance")}
                >
                  <div className="flex items-center justify-center gap-2">
                    {t('colPerf')}
                    <SortIcon column="performance" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-36"
                  onClick={() => toggleSort("issueCount")}
                >
                  <div className="flex items-center gap-2">
                    {t('colIssues')}
                    <SortIcon column="issueCount" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {paginatedPages.map((page) => {
                const score = getEffectiveScore(page);
                const grade = getEffectiveGrade(page);
                const hasScore = score >= 0;
                const issues = (page.issues || []) as Array<{
                  type: string;
                  category: string;
                  message: string;
                }>;
                const criticalCount = issues.filter((i) => i.type === "critical").length;
                const warningCount = issues.filter((i) => i.type === "warning").length;
                const recCount = issues.length - criticalCount - warningCount;

                let displayUrl = page.url;
                try {
                  const u = new URL(page.url);
                  displayUrl = u.pathname === "/" ? u.hostname : u.pathname;
                } catch { /* keep original */ }

                return (
                  <tr
                    key={page._id}
                    className="cursor-pointer transition-colors hover:bg-primary_hover"
                    onClick={() => setSelectedPage(page)}
                  >
                    {/* Page URL + Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-primary truncate max-w-[320px]" title={page.url}>
                          {displayUrl}
                        </span>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 text-fg-quaternary hover:text-fg-primary transition-colors"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {page.title && (
                        <p className="text-xs text-tertiary truncate max-w-[320px] mt-0.5" title={page.title}>
                          {page.title}
                        </p>
                      )}
                    </td>

                    {/* Score + Grade */}
                    <td className="px-4 py-3 text-center">
                      {hasScore ? (
                        <div className="flex items-center justify-center gap-1.5">
                          {grade && (
                            <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-bold ${getGradeBg(grade)}`}>
                              {grade}
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${getScoreBg(score)}`}>
                            {score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-tertiary">—</span>
                      )}
                    </td>

                    {/* Status Code */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusCodeColor(page.statusCode)}`}>
                        {page.statusCode}
                      </span>
                    </td>

                    {/* Word Count */}
                    <td className="px-4 py-3 text-right">
                      {page.wordCount > 0 ? (
                        <span className={`text-sm tabular-nums ${page.wordCount < 300 ? "text-utility-warning-600 font-medium" : "text-primary"}`}>
                          {page.wordCount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-tertiary">—</span>
                      )}
                    </td>

                    {/* PSI Performance */}
                    <td className="px-4 py-3 text-center">
                      {page.lighthouseScores?.performance != null ? (
                        <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${
                          page.lighthouseScores.performance >= 90
                            ? "bg-utility-success-50 text-utility-success-600"
                            : page.lighthouseScores.performance >= 50
                              ? "bg-utility-warning-50 text-utility-warning-600"
                              : "bg-utility-error-50 text-utility-error-600"
                        }`}>
                          {page.lighthouseScores.performance}
                        </span>
                      ) : (
                        <span className="text-sm text-tertiary">—</span>
                      )}
                    </td>

                    {/* Issues */}
                    <td className="px-4 py-3">
                      {issues.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-utility-success-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t('noIssues')}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {criticalCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-utility-error-50 text-utility-error-600">
                              <AlertCircle className="w-3 h-3" />
                              {criticalCount}
                            </span>
                          )}
                          {warningCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-utility-warning-50 text-utility-warning-600">
                              <AlertTriangle className="w-3 h-3" />
                              {warningCount}
                            </span>
                          )}
                          {recCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-utility-blue-50 text-utility-blue-600">
                              <InfoCircle className="w-3 h-3" />
                              {recCount}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {paginatedPages.length === 0 && (
            <div className="p-8 text-center">
              {hasActiveFilters ? (
                <>
                  <FilterLines className="mx-auto h-10 w-10 text-fg-quaternary" />
                  <h3 className="mt-3 text-sm font-semibold text-primary">{t('noMatchingPages')}</h3>
                  <p className="mt-1 text-sm text-tertiary">{t('tryAdjustingFilters')}</p>
                  <Button size="sm" color="secondary" onClick={clearFilters} className="mt-3">
                    {t('clearAllFilters')}
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="mx-auto h-10 w-10 text-fg-quaternary" />
                  <h3 className="mt-3 text-sm font-semibold text-primary">{t('noPageDataAvailable')}</h3>
                  <p className="mt-1 text-sm text-tertiary">{t('noPageDataDescription')}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-secondary pt-4">
            <p className="text-sm text-secondary">
              {t('paginationInfo', { current: currentPage, total: totalPages, count: sortedAndFiltered.length })}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                color="secondary"
                iconLeading={ChevronLeft}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {t('previous')}
              </Button>
              <Button
                size="sm"
                color="secondary"
                iconTrailing={ChevronRight}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Page Detail Modal */}
      <PageDetailModal
        page={selectedPage}
        isOpen={selectedPage !== null}
        onClose={() => setSelectedPage(null)}
      />
    </>
  );
}
