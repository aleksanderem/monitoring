"use client";

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

interface OnSitePagesTableProps {
  domainId: Id<"domains">;
  scanId?: Id<"onSiteScans">;
}

type SortColumn = "url" | "score" | "statusCode" | "wordCount" | "performance" | "issueCount";
type SortDirection = "asc" | "desc";

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

export function OnSitePagesTable({ domainId, scanId }: OnSitePagesTableProps) {
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

    // Score filter
    if (scoreFilter === "good") {
      result = result.filter((p) => (p.onpageScore ?? 0) >= 80);
    } else if (scoreFilter === "needs_work") {
      result = result.filter((p) => {
        const s = p.onpageScore ?? 0;
        return s >= 50 && s < 80;
      });
    } else if (scoreFilter === "poor") {
      result = result.filter((p) => (p.onpageScore ?? 100) < 50);
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
          aVal = a.onpageScore ?? -1;
          bVal = b.onpageScore ?? -1;
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
  }, [allPages, searchQuery, issuesFilter, scoreFilter, statusFilter, sortColumn, sortDirection]);

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
    searchQuery !== "" || issuesFilter !== "all" || scoreFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setIssuesFilter("all");
    setScoreFilter("all");
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
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-fg-quaternary" />
        <h3 className="mt-4 text-sm font-semibold text-primary">No Page Data Available</h3>
        <p className="mt-1 text-sm text-tertiary">
          Run a full site scan to see page-level SEO audit results.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">Analyzed Pages</h3>
            <p className="text-sm text-tertiary">
              {sortedAndFiltered.length} of {allPages.length} pages
              {hasActiveFilters && " (filtered)"} — click a row for full details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Input
                placeholder="Search URL or title..."
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
              Filters
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">Issues:</label>
              <select
                value={issuesFilter}
                onChange={(e) => { setIssuesFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">All</option>
                <option value="has_issues">Has Issues</option>
                <option value="no_issues">No Issues</option>
                <option value="critical">Critical Only</option>
                <option value="warning">Warnings Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">Score:</label>
              <select
                value={scoreFilter}
                onChange={(e) => { setScoreFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">All</option>
                <option value="good">Good (80+)</option>
                <option value="needs_work">Needs Work (50-79)</option>
                <option value="poor">Poor (&lt;50)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-secondary">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
              >
                <option value="all">All</option>
                <option value="2xx">2xx OK</option>
                <option value="3xx">3xx Redirect</option>
                <option value="4xx">4xx Error</option>
                <option value="5xx">5xx Server</option>
              </select>
            </div>

            {hasActiveFilters && (
              <Button size="sm" color="secondary" onClick={clearFilters}>
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
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("url")}
                >
                  <div className="flex items-center gap-2">
                    Page
                    <SortIcon column="url" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-20"
                  onClick={() => toggleSort("score")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Score
                    <SortIcon column="score" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-20"
                  onClick={() => toggleSort("statusCode")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Status
                    <SortIcon column="statusCode" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-24"
                  onClick={() => toggleSort("wordCount")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Words
                    <SortIcon column="wordCount" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-24"
                  onClick={() => toggleSort("performance")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Perf.
                    <SortIcon column="performance" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70 w-36"
                  onClick={() => toggleSort("issueCount")}
                >
                  <div className="flex items-center gap-2">
                    Issues
                    <SortIcon column="issueCount" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {paginatedPages.map((page) => {
                const hasScore = page.onpageScore != null;
                const score = page.onpageScore ?? 0;
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

                    {/* Score */}
                    <td className="px-4 py-3 text-center">
                      {hasScore ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getScoreBg(score)}`}>
                          {score}
                        </span>
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
                          No issues
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
                  <h3 className="mt-3 text-sm font-semibold text-primary">No matching pages</h3>
                  <p className="mt-1 text-sm text-tertiary">Try adjusting your filters.</p>
                  <Button size="sm" color="secondary" onClick={clearFilters} className="mt-3">
                    Clear All Filters
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="mx-auto h-10 w-10 text-fg-quaternary" />
                  <h3 className="mt-3 text-sm font-semibold text-primary">No Page Data Available</h3>
                  <p className="mt-1 text-sm text-tertiary">Run a full site scan to see page-level SEO audit results.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-secondary pt-4">
            <p className="text-sm text-secondary">
              Page {currentPage} of {totalPages} ({sortedAndFiltered.length} results)
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

      {/* Page Detail Modal */}
      <PageDetailModal
        page={selectedPage}
        isOpen={selectedPage !== null}
        onClose={() => setSelectedPage(null)}
      />
    </>
  );
}
