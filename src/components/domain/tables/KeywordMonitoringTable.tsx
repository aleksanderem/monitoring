"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Hash01, ChevronUp, ChevronDown, ChevronsUpDown } from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { MiniSparkline } from "@/components/domain/charts/MiniSparkline";
import { cx } from "@/utils/cx";

interface KeywordMonitoringTableProps {
  domainId: Id<"domains">;
}

type SortColumn = "phrase" | "currentPosition" | "change" | "status" | "potential" | "searchVolume" | "difficulty";
type SortDirection = "asc" | "desc";

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

export function KeywordMonitoringTable({ domainId }: KeywordMonitoringTableProps) {
  const keywords = useQuery(api.keywords.getKeywordMonitoring, { domainId });

  const [sortColumn, setSortColumn] = useState<SortColumn>("currentPosition");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

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

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm text-primary placeholder:text-tertiary focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      {/* Table - Desktop view */}
      <div className="overflow-x-auto rounded-xl border border-secondary bg-primary">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b-2 border-secondary bg-primary backdrop-blur">
            <tr>
              {/* Table headers will be added in next task */}
            </tr>
          </thead>
          <tbody>
            {/* Table rows will be added in next task */}
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
