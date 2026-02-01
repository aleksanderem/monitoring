"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CheckCircle, XCircle, AlertCircle } from "@untitledui/icons";

interface OnSitePagesTableProps {
  domainId: Id<"domains">;
  scanId?: Id<"onSiteScans">;
}

export function OnSitePagesTable({ domainId, scanId }: OnSitePagesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [issuesFilter, setIssuesFilter] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  const pageSize = 25;

  const pagesData = useQuery(api.onSite_queries.getPagesList, {
    domainId,
    scanId,
    statusCode: statusFilter,
    hasIssues: issuesFilter,
    searchQuery: searchQuery || undefined,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });

  const pages = pagesData?.pages || [];
  const total = pagesData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (statusCode: number) => {
    if (statusCode === 200) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">
          200
        </span>
      );
    }
    if (statusCode === 301 || statusCode === 302) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
          {statusCode}
        </span>
      );
    }
    if (statusCode === 404) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-error-50 text-error-700">
          404
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
        {statusCode}
      </span>
    );
  };

  const getTitleLengthIndicator = (title?: string) => {
    if (!title) return <XCircle className="w-4 h-4 text-error-600" />;
    const length = title.length;
    if (length >= 30 && length <= 60) {
      return <CheckCircle className="w-4 h-4 text-success-600" />;
    }
    return <AlertCircle className="w-4 h-4 text-warning-600" />;
  };

  const getLoadTimeColor = (loadTime?: number) => {
    if (!loadTime) return "text-gray-600";
    if (loadTime < 2) return "text-success-600";
    if (loadTime < 4) return "text-warning-600";
    return "text-error-600";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search by URL or title..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />

        <select
          value={statusFilter || ""}
          onChange={(e) => {
            setStatusFilter(e.target.value ? Number(e.target.value) : undefined);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Status Codes</option>
          <option value="200">200 OK</option>
          <option value="301">301 Redirect</option>
          <option value="404">404 Not Found</option>
          <option value="500">500 Error</option>
        </select>

        <select
          value={issuesFilter === undefined ? "" : issuesFilter ? "yes" : "no"}
          onChange={(e) => {
            if (e.target.value === "") {
              setIssuesFilter(undefined);
            } else {
              setIssuesFilter(e.target.value === "yes");
            }
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Pages</option>
          <option value="yes">Has Issues</option>
          <option value="no">No Issues</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                H1
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Load Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Words
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issues
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pages.map((page) => (
              <tr key={page._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 hover:underline"
                    title={page.url}
                  >
                    {page.url}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm">
                  {getStatusBadge(page.statusCode)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {getTitleLengthIndicator(page.title)}
                    <span className="truncate max-w-[200px]" title={page.title}>
                      {page.title || "—"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {page.h1 ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-success-600" />
                      Yes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-error-600" />
                      No
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={getLoadTimeColor(page.loadTime)}>
                    {page.loadTime ? `${page.loadTime.toFixed(2)}s` : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {page.wordCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {page.issueCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-error-50 text-error-700">
                      {page.issueCount}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No pages found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, total)} of {total} pages
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
