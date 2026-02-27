"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import {
    Users01,
    SearchLg,
    ChevronUp,
    ChevronDown,
    ChevronSelectorVertical,
    ChevronLeft,
    ChevronRight,
    FilterLines,
    XClose,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { getPositionBadgeClass } from "@/lib/formatting";

interface CompetitorOverlapTableProps {
    domainId: Id<"domains">;
}

function getPositionCellClass(position: number | null): string {
    if (!position) return "text-quaternary";
    if (position <= 3) return "font-medium text-utility-success-600";
    if (position <= 10) return "text-utility-success-500";
    if (position <= 20) return "text-utility-warning-600";
    return "text-tertiary";
}

type SortColumn = "keyword" | "yourPosition" | string; // string for competitor domains
type SortDirection = "asc" | "desc";

const YOUR_POSITION_FILTERS = [
    { labelKey: "overlapFilterAll", value: "all" },
    { labelKey: "overlapFilterRanking", value: "ranking" },
    { labelKey: "overlapFilterNotRanking", value: "not-ranking" },
    { labelKey: "overlapFilterTop10", value: "top10" },
    { labelKey: "overlapFilterTop20", value: "top20" },
];

const OVERLAP_FILTERS = [
    { labelKey: "overlapFilterAll", value: "all" },
    { labelKey: "overlapFilterBothRanking", value: "both" },
    { labelKey: "overlapFilterYouAhead", value: "you-ahead" },
    { labelKey: "overlapFilterCompetitorAhead", value: "comp-ahead" },
];

const PAGE_SIZE = 25;

// First column width for sticky positioning
const COL1_WIDTH = 200; // keyword column
const COL2_WIDTH = 80;  // your position column

export function CompetitorOverlapTable({ domainId }: CompetitorOverlapTableProps) {
    const t = useTranslations('competitors');
    const overlapData = useQuery(api.keywordMap_queries.getCompetitorOverlapMatrix, { domainId });

    const [search, setSearch] = useState("");
    const [yourPositionFilter, setYourPositionFilter] = useState("all");
    const [overlapFilter, setOverlapFilter] = useState("all");
    const [sortColumn, setSortColumn] = useState<SortColumn>("keyword");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);

    const hasActiveFilters = yourPositionFilter !== "all" || overlapFilter !== "all" || search !== "";

    const filteredData = useMemo(() => {
        if (!overlapData || overlapData.matrix.length === 0) return [];

        let data = [...overlapData.matrix];

        // Search
        if (search) {
            const q = search.toLowerCase();
            data = data.filter((row) => row.keyword.toLowerCase().includes(q));
        }

        // Your position filter
        if (yourPositionFilter === "ranking") {
            data = data.filter((row) => row.yourPosition !== null);
        } else if (yourPositionFilter === "not-ranking") {
            data = data.filter((row) => row.yourPosition === null);
        } else if (yourPositionFilter === "top10") {
            data = data.filter((row) => row.yourPosition !== null && row.yourPosition <= 10);
        } else if (yourPositionFilter === "top20") {
            data = data.filter((row) => row.yourPosition !== null && row.yourPosition <= 20);
        }

        // Overlap filter
        if (overlapFilter === "both") {
            data = data.filter((row) =>
                row.yourPosition !== null && row.competitors.some((c) => c.position !== null)
            );
        } else if (overlapFilter === "you-ahead") {
            data = data.filter((row) =>
                row.yourPosition !== null &&
                row.competitors.some((c) => c.position !== null && row.yourPosition! < c.position)
            );
        } else if (overlapFilter === "comp-ahead") {
            data = data.filter((row) =>
                row.competitors.some((c) =>
                    c.position !== null && (row.yourPosition === null || c.position < row.yourPosition)
                )
            );
        }

        // Sort
        data.sort((a, b) => {
            if (sortColumn === "keyword") {
                return sortDirection === "asc"
                    ? a.keyword.localeCompare(b.keyword)
                    : b.keyword.localeCompare(a.keyword);
            }
            if (sortColumn === "yourPosition") {
                const aVal = a.yourPosition ?? 999;
                const bVal = b.yourPosition ?? 999;
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }
            // Competitor column sort
            const aComp = a.competitors.find((c) => c.domain === sortColumn);
            const bComp = b.competitors.find((c) => c.domain === sortColumn);
            const aVal = aComp?.position ?? 999;
            const bVal = bComp?.position ?? 999;
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });

        return data;
    }, [overlapData, search, yourPositionFilter, overlapFilter, sortColumn, sortDirection]);

    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const paginatedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const resetPage = () => setPage(0);

    function handleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortColumn(column);
            setSortDirection(column === "keyword" ? "asc" : "desc");
        }
    }

    function SortIcon({ column }: { column: SortColumn }) {
        if (sortColumn !== column) return <ChevronSelectorVertical className="h-3.5 w-3.5 text-fg-quaternary" />;
        return sortDirection === "asc"
            ? <ChevronUp className="h-3.5 w-3.5 text-fg-brand-primary" />
            : <ChevronDown className="h-3.5 w-3.5 text-fg-brand-primary" />;
    }

    function clearFilters() {
        setSearch("");
        setYourPositionFilter("all");
        setOverlapFilter("all");
        resetPage();
    }

    function shortDomain(domain: string): string {
        return domain.length > 18 ? domain.slice(0, 15) + "..." : domain;
    }

    if (overlapData === undefined) {
        return (
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-44 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-64 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!overlapData || overlapData.competitors.length === 0 || overlapData.matrix.length === 0) {
        return (
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2">
                    <Users01 className="h-5 w-5 text-fg-quaternary" />
                    <div>
                        <h3 className="text-md font-semibold text-primary">{t('overlapTitle')}</h3>
                        <p className="text-sm text-tertiary">{t('overlapSubtitle')}</p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-tertiary">{t('overlapEmpty')}</p>
                </div>
            </div>
        );
    }

    // Compute summary stats
    const totalKeywords = overlapData.matrix.length;
    const youRanking = overlapData.matrix.filter((r) => r.yourPosition !== null).length;

    return (
        <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Users01 className="h-5 w-5 text-fg-brand-primary" />
                    <div>
                        <h3 className="text-md font-semibold text-primary">{t('overlapTitle')}</h3>
                        <p className="text-sm text-tertiary">
                            {t('overlapSummary', { totalKeywords, competitorCount: overlapData.competitors.length, youRanking })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-quaternary" />
                    <input
                        type="text"
                        placeholder={t('overlapSearchKeywords')}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                        className="w-full rounded-lg border border-primary bg-primary pl-9 pr-3 py-2 text-sm text-primary placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${showFilters || hasActiveFilters ? "border-brand-600 bg-utility-brand-50 text-brand-600" : "border-primary bg-primary text-tertiary hover:bg-secondary"}`}
                >
                    <FilterLines className="h-4 w-4" />
                    {t('overlapFilters')}
                    {hasActiveFilters && !showFilters && (
                        <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-medium text-white">
                            {[yourPositionFilter !== "all", overlapFilter !== "all"].filter(Boolean).length}
                        </span>
                    )}
                </button>

                {hasActiveFilters && (
                    <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-tertiary hover:text-primary">
                        <XClose className="h-3.5 w-3.5" />
                        {t('overlapClear')}
                    </button>
                )}
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-3">
                    <FilterSelect label={t('overlapFilterYourPositionLabel')} value={yourPositionFilter} options={YOUR_POSITION_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setYourPositionFilter(v); resetPage(); }} />
                    <FilterSelect label={t('overlapFilterOverlapLabel')} value={overlapFilter} options={OVERLAP_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setOverlapFilter(v); resetPage(); }} />
                </div>
            )}

            {/* Table with frozen columns */}
            {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Users01 className="h-8 w-8 text-fg-quaternary mb-3" />
                    <p className="text-sm font-medium text-primary mb-1">{t('overlapNoMatch')}</p>
                    <p className="text-xs text-tertiary">{t('overlapNoMatchHint')}</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border border-secondary">
                        <table className="text-sm" style={{ minWidth: COL1_WIDTH + COL2_WIDTH + overlapData.competitors.length * 100 }}>
                            <thead>
                                <tr className="border-b border-secondary bg-secondary">
                                    {/* Frozen: Keyword */}
                                    <th
                                        className="cursor-pointer px-3 py-2.5 font-medium text-tertiary bg-secondary sticky left-0 z-20 border-r border-secondary"
                                        style={{ width: COL1_WIDTH, minWidth: COL1_WIDTH }}
                                        onClick={() => handleSort("keyword")}
                                    >
                                        <div className="flex items-center gap-1">{t('columnKeyword')} <SortIcon column="keyword" /></div>
                                    </th>
                                    {/* Frozen: You */}
                                    <th
                                        className="cursor-pointer px-3 py-2.5 text-center font-medium text-tertiary bg-secondary sticky z-20 border-r border-secondary"
                                        style={{ width: COL2_WIDTH, minWidth: COL2_WIDTH, left: COL1_WIDTH }}
                                        onClick={() => handleSort("yourPosition")}
                                    >
                                        <div className="flex items-center justify-center gap-1">{t('columnYou')} <SortIcon column="yourPosition" /></div>
                                    </th>
                                    {/* Competitor columns */}
                                    {overlapData.competitors.map((comp) => (
                                        <th
                                            key={comp}
                                            className="cursor-pointer px-3 py-2.5 text-center font-medium text-tertiary bg-secondary"
                                            style={{ minWidth: 100 }}
                                            title={comp}
                                            onClick={() => handleSort(comp)}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                {shortDomain(comp)} <SortIcon column={comp} />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((row) => {
                                    // Color-code: highlight rows where competitor beats you
                                    const anyCompAhead = row.competitors.some(
                                        (c) => c.position !== null && (row.yourPosition === null || c.position < row.yourPosition)
                                    );
                                    return (
                                        <tr key={row.keywordId} className={`border-b border-secondary last:border-0 hover:bg-primary_hover ${anyCompAhead ? "" : ""}`}>
                                            {/* Frozen: Keyword */}
                                            <td
                                                className="px-3 py-2 font-medium text-primary bg-primary sticky left-0 z-10 border-r border-secondary truncate"
                                                style={{ maxWidth: COL1_WIDTH, width: COL1_WIDTH }}
                                                title={row.keyword}
                                            >
                                                {row.keyword}
                                            </td>
                                            {/* Frozen: Your position */}
                                            <td
                                                className="px-3 py-2 text-center bg-primary sticky z-10 border-r border-secondary"
                                                style={{ left: COL1_WIDTH, width: COL2_WIDTH }}
                                            >
                                                {row.yourPosition ? (
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPositionBadgeClass(row.yourPosition)}`}>
                                                        #{row.yourPosition}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-quaternary">—</span>
                                                )}
                                            </td>
                                            {/* Competitor positions */}
                                            {row.competitors.map((comp) => {
                                                const isAhead = comp.position !== null && row.yourPosition !== null && comp.position < row.yourPosition;
                                                const isBehind = comp.position !== null && row.yourPosition !== null && comp.position > row.yourPosition;
                                                return (
                                                    <td
                                                        key={comp.domain}
                                                        className={`px-3 py-2 text-center ${isAhead ? "bg-utility-error-50/30 dark:bg-utility-error-500/10" : isBehind ? "bg-utility-success-50/30 dark:bg-utility-success-500/10" : ""}`}
                                                    >
                                                        <span className={getPositionCellClass(comp.position)}>
                                                            {comp.position ? `#${comp.position}` : "—"}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-sm text-tertiary">
                                {t('contentGapPagination', { currentPage: page + 1, totalPages, total: filteredData.length })}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="rounded-lg p-1.5 text-tertiary hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) {
                                        pageNum = i;
                                    } else if (page < 3) {
                                        pageNum = i;
                                    } else if (page > totalPages - 4) {
                                        pageNum = totalPages - 5 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`rounded-lg px-3 py-1 text-sm ${page === pageNum ? "bg-brand-600 text-white" : "text-tertiary hover:bg-secondary"}`}
                                        >
                                            {pageNum + 1}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="rounded-lg p-1.5 text-tertiary hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-tertiary">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded bg-utility-error-500 dark:bg-utility-error-400" />
                    {t('overlapLegendCompetitorAhead')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded bg-utility-success-500 dark:bg-utility-success-400" />
                    {t('overlapLegendYouAhead')}
                </span>
            </div>
        </div>
    );
}

// Helper component
function FilterSelect({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: Array<{ label: string; value: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-tertiary">{label}:</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-lg border border-primary bg-primary px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
