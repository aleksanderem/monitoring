"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import {
  Link01,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  SearchLg,
  CheckCircle,
  Settings01,
  FilterLines,
  XClose,
} from "@untitledui/icons";

interface UrlSelectionTableProps {
  urls: string[];
  selectedUrls: Set<string>;
  onToggleUrl: (url: string) => void;
  onToggleAll: (urls: string[]) => void;
}

type SortColumn = "url" | "path" | "domain" | "pathSegment";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  url: boolean;
  domain: boolean;
  path: boolean;
  pathSegment: boolean;
}

function parseUrl(url: string) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const firstSegment = pathParts.length > 0 ? `/${pathParts[0]}/` : '/';

    return {
      domain: urlObj.hostname,
      path: urlObj.pathname,
      pathSegment: firstSegment,
      fullUrl: url,
    };
  } catch {
    return {
      domain: "",
      path: url,
      pathSegment: "/",
      fullUrl: url,
    };
  }
}

export function UrlSelectionTable({
  urls,
  selectedUrls,
  onToggleUrl,
  onToggleAll,
}: UrlSelectionTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("url");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pathSegmentFilters, setPathSegmentFilters] = useState<string[]>([]);
  const [pathFilterType, setPathFilterType] = useState<"contains" | "not_contains">("contains");
  const [pathInputValue, setPathInputValue] = useState("");

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    url: false, // Hidden by default since we have domain + path
    domain: true,
    path: true,
    pathSegment: true,
  });

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ChevronSelectorVertical className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  // Get unique path segments for filter
  const uniquePathSegments = useMemo(() => {
    const segments = new Set(urls.map((url) => parseUrl(url).pathSegment));
    return Array.from(segments).sort();
  }, [urls]);

  // Apply search, filter, and sort
  const filteredAndSortedUrls = useMemo(() => {
    let filtered = urls.filter((url) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || url.toLowerCase().includes(searchLower);

      // Path segment filter with tags (OR logic)
      const parsed = parseUrl(url);
      let matchesPathSegment = true;
      if (pathSegmentFilters.length > 0) {
        // Check if ANY tag matches (OR logic)
        const matchesAnyTag = pathSegmentFilters.some((tag) =>
          parsed.pathSegment.toLowerCase().includes(tag.toLowerCase())
        );
        matchesPathSegment = pathFilterType === "contains" ? matchesAnyTag : !matchesAnyTag;
      }

      return matchesSearch && matchesPathSegment;
    });

    // Sort
    filtered.sort((a, b) => {
      const aParsed = parseUrl(a);
      const bParsed = parseUrl(b);

      let aVal: string;
      let bVal: string;

      switch (sortColumn) {
        case "domain":
          aVal = aParsed.domain;
          bVal = bParsed.domain;
          break;
        case "path":
          aVal = aParsed.path;
          bVal = bParsed.path;
          break;
        case "pathSegment":
          aVal = aParsed.pathSegment;
          bVal = bParsed.pathSegment;
          break;
        case "url":
        default:
          aVal = a;
          bVal = b;
          break;
      }

      const comparison = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [urls, searchQuery, pathSegmentFilters, pathFilterType, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUrls.length / itemsPerPage);
  const paginatedUrls = filteredAndSortedUrls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const allCurrentPageSelected = paginatedUrls.every((url) => selectedUrls.has(url));
  const someCurrentPageSelected = paginatedUrls.some((url) => selectedUrls.has(url));

  const handleToggleCurrentPage = () => {
    // Use onToggleAll for batch operation instead of calling onToggleUrl multiple times
    onToggleAll(paginatedUrls);
  };

  const handleToggleAllFiltered = () => {
    onToggleAll(filteredAndSortedUrls);
  };

  if (urls.length === 0) {
    return (
      <div className="rounded-lg border border-secondary bg-primary p-8 text-center">
        <Link01 className="mx-auto h-12 w-12 text-fg-quaternary" />
        <p className="mt-4 text-sm text-tertiary">No URLs found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-tertiary">
            {selectedUrls.size} of {filteredAndSortedUrls.length} URLs selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="w-64">
            <Input
              placeholder="Search URLs..."
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
              <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
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
                        className="h-4 w-4 rounded bg-primary ring-1 ring-primary ring-inset text-brand-solid"
                      />
                      <span className="text-primary">
                        {key === "url"
                          ? "Full URL"
                          : key === "domain"
                            ? "Domain"
                            : key === "path"
                              ? "Path"
                              : "First Path Segment"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Select all filtered */}
          {filteredAndSortedUrls.length > 0 && (
            <Button size="sm" color="secondary" onClick={handleToggleAllFiltered}>
              {filteredAndSortedUrls.every((url) => selectedUrls.has(url))
                ? "Deselect All"
                : "Select All"}
            </Button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-col gap-3 rounded-lg border border-secondary bg-secondary/30 p-4">
          {/* Path segment filter with tags */}
          <div className="flex items-start gap-2">
            <label className="text-sm font-medium text-secondary mt-2">Path:</label>
            <select
              value={pathFilterType}
              onChange={(e) => {
                setPathFilterType(e.target.value as "contains" | "not_contains");
                setCurrentPage(1);
              }}
              className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
              <option value="contains">contains</option>
              <option value="not_contains">does not contain</option>
            </select>
            <div className="flex-1">
              {/* Tags display */}
              {pathSegmentFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pathSegmentFilters.map((tag, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-brand-100 text-brand-700 text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => {
                          setPathSegmentFilters((prev) => prev.filter((_, i) => i !== index));
                          setCurrentPage(1);
                        }}
                        className="hover:bg-brand-200 rounded p-0.5 transition-colors"
                      >
                        <XClose className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Input for adding tags */}
              <input
                type="text"
                placeholder="Type and press Enter to add filter (e.g. blog, blob, products)..."
                value={pathInputValue}
                onChange={(e) => setPathInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pathInputValue.trim()) {
                    e.preventDefault();
                    if (!pathSegmentFilters.includes(pathInputValue.trim())) {
                      setPathSegmentFilters((prev) => [...prev, pathInputValue.trim()]);
                      setPathInputValue("");
                      setCurrentPage(1);
                    }
                  }
                }}
                className="w-full px-3 py-1.5 border border-secondary bg-primary rounded-md text-sm text-primary placeholder:text-quaternary focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
              />
              <p className="text-xs text-quaternary mt-1">
                Press Enter to add. Multiple tags use OR logic.
              </p>
            </div>
          </div>

          {/* Quick filter suggestions */}
          {uniquePathSegments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-quaternary">Quick add:</span>
              {uniquePathSegments.slice(0, 6).map((segment) => (
                <button
                  key={segment}
                  onClick={() => {
                    if (!pathSegmentFilters.includes(segment)) {
                      setPathSegmentFilters((prev) => [...prev, segment]);
                      setCurrentPage(1);
                    }
                  }}
                  className="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/70 text-secondary transition-colors"
                >
                  {segment}
                </button>
              ))}
            </div>
          )}

          {/* Clear filters */}
          {(pathSegmentFilters.length > 0 || searchQuery) && (
            <Button
              size="sm"
              color="secondary"
              onClick={() => {
                setPathSegmentFilters([]);
                setPathInputValue("");
                setSearchQuery("");
                setCurrentPage(1);
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
                    }
                  }}
                  onChange={handleToggleCurrentPage}
                  className="h-4 w-4 rounded bg-primary ring-1 ring-primary ring-inset text-brand-solid focus:ring-2 focus:ring-brand-600 focus:ring-offset-0"
                />
              </th>
              {columnVisibility.url && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("url")}
                >
                  <div className="flex items-center gap-2">
                    Full URL
                    <SortIcon column="url" />
                  </div>
                </th>
              )}
              {columnVisibility.domain && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("domain")}
                >
                  <div className="flex items-center gap-2">
                    Domain
                    <SortIcon column="domain" />
                  </div>
                </th>
              )}
              {columnVisibility.pathSegment && (
                <th
                  className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("pathSegment")}
                >
                  <div className="flex items-center justify-center gap-2">
                    First Path Segment
                    <SortIcon column="pathSegment" />
                  </div>
                </th>
              )}
              {columnVisibility.path && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                  onClick={() => toggleSort("path")}
                >
                  <div className="flex items-center gap-2">
                    Full Path
                    <SortIcon column="path" />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {paginatedUrls.map((url) => {
              const isSelected = selectedUrls.has(url);
              const parsed = parseUrl(url);

              return (
                <tr
                  key={url}
                  className={`cursor-pointer transition-colors hover:bg-secondary/30 ${
                    isSelected ? "bg-primary-50" : ""
                  }`}
                  onClick={() => onToggleUrl(url)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleUrl(url)}
                      className="h-4 w-4 rounded bg-primary ring-1 ring-primary ring-inset text-brand-solid focus:ring-2 focus:ring-brand-600 focus:ring-offset-0"
                    />
                  </td>
                  {columnVisibility.url && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link01 className="h-4 w-4 flex-shrink-0 text-fg-quaternary" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:text-brand-600 truncate max-w-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>
                        {isSelected && (
                          <CheckCircle className="h-4 w-4 flex-shrink-0 text-brand-600" />
                        )}
                      </div>
                    </td>
                  )}
                  {columnVisibility.domain && (
                    <td className="px-4 py-3">
                      <Badge size="sm" color="gray">
                        {parsed.domain || "—"}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.pathSegment && (
                    <td className="px-4 py-3 text-center">
                      <Badge size="sm" color="brand">
                        {parsed.pathSegment}
                      </Badge>
                    </td>
                  )}
                  {columnVisibility.path && (
                    <td className="px-4 py-3">
                      <span className="text-sm text-secondary truncate max-w-xs block">
                        {parsed.path || "/"}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-secondary pt-4">
          <p className="text-sm text-secondary">
            Page {currentPage} of {totalPages} ({filteredAndSortedUrls.length} results)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="secondary"
              iconLeading={ChevronLeft}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              isDisabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconTrailing={ChevronRight}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              isDisabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
