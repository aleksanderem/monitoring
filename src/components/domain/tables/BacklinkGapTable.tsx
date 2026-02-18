"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import {
    ChevronUp,
    ChevronDown,
    ChevronSelectorVertical,
    ChevronLeft,
    ChevronRight,
    SearchLg,
    FilterLines,
    Settings01,
    XClose,
    Target04,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { BacklinkGapDetailModal } from "../modals/BacklinkGapDetailModal";

interface BacklinkGapTableProps {
    domainId: Id<"domains">;
}

interface GapItem {
    domain: string;
    competitorCount: number;
    competitors: string[];
    totalLinks: number;
    avgDomainRank: number;
    dofollowPercent: number;
    topAnchors: Array<{ anchor: string; count: number }>;
    priorityScore: number;
}

function getPriorityBadge(score: number): { bg: string; text: string; labelKey: string } {
    if (score >= 75) return { bg: "bg-utility-success-50", text: "text-utility-success-600", labelKey: "priorityHigh" };
    if (score >= 50) return { bg: "bg-utility-blue-50", text: "text-utility-blue-600", labelKey: "priorityMedium" };
    if (score >= 25) return { bg: "bg-utility-warning-50", text: "text-utility-warning-600", labelKey: "priorityLow" };
    return { bg: "bg-utility-gray-50", text: "text-utility-gray-600", labelKey: "priorityVeryLow" };
}

type SortColumn = "domain" | "competitorCount" | "totalLinks" | "avgDomainRank" | "dofollowPercent" | "priorityScore";
type SortDirection = "asc" | "desc";

const PRIORITY_FILTERS = [
    { labelKey: "gapFilterPriorityAll", value: "all" },
    { labelKey: "gapFilterPriorityHigh", value: "high" },
    { labelKey: "gapFilterPriorityMedium", value: "medium" },
    { labelKey: "gapFilterPriorityLow", value: "low" },
    { labelKey: "gapFilterPriorityVeryLow", value: "very_low" },
];

const COMPETITOR_COUNT_FILTERS = [
    { labelKey: "gapFilterPriorityAll", value: "all" },
    { labelKey: "gapFilterComp3plus", value: "3+" },
    { labelKey: "gapFilterComp2", value: "2" },
    { labelKey: "gapFilterComp1", value: "1" },
];

const DR_FILTERS = [
    { labelKey: "gapFilterPriorityAll", value: "all" },
    { labelKey: "gapFilterDrHigh", value: "high" },
    { labelKey: "gapFilterDrMedium", value: "medium" },
    { labelKey: "gapFilterDrLow", value: "low" },
];

const LINK_COUNT_FILTERS = [
    { labelKey: "gapFilterPriorityAll", value: "all" },
    { labelKey: "gapFilterLinks1", value: "1" },
    { labelKey: "gapFilterLinks2to5", value: "2-5" },
    { labelKey: "gapFilterLinks6to20", value: "6-20" },
    { labelKey: "gapFilterLinks20plus", value: "20+" },
];

const DOFOLLOW_FILTERS = [
    { labelKey: "gapFilterPriorityAll", value: "all" },
    { labelKey: "gapFilterDfAll", value: "all_df" },
    { labelKey: "gapFilterDfMostly", value: "mostly_df" },
    { labelKey: "gapFilterDfMixed", value: "mixed" },
    { labelKey: "gapFilterNfMostly", value: "mostly_nf" },
];

const PAGE_SIZE = 25;

// Column visibility
interface ColumnVisibility {
    domain: boolean;
    competitorCount: boolean;
    competitors: boolean;
    totalLinks: boolean;
    domainRank: boolean;
    dofollowPercent: boolean;
    topAnchors: boolean;
    priority: boolean;
}

const COLUMN_LABEL_KEYS: Record<keyof ColumnVisibility, string> = {
    domain: "columnDomain",
    competitorCount: "gapColumnLabelCompCount",
    competitors: "gapColumnLabelCompetitors",
    totalLinks: "gapColumnLabelLinks",
    domainRank: "gapColumnLabelDomainRank",
    dofollowPercent: "gapColumnLabelDfPercent",
    topAnchors: "gapColumnLabelTopAnchors",
    priority: "gapColumnLabelPriority",
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    domain: true,
    competitorCount: true,
    competitors: false,
    totalLinks: true,
    domainRank: true,
    dofollowPercent: true,
    topAnchors: true,
    priority: true,
};

export function BacklinkGapTable({ domainId }: BacklinkGapTableProps) {
    const t = useTranslations('backlinks');
    const data = useQuery(api.backlinkAnalysis_queries.getBacklinkGap, { domainId });

    const [search, setSearch] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [compCountFilter, setCompCountFilter] = useState("all");
    const [drFilter, setDrFilter] = useState("all");
    const [linkCountFilter, setLinkCountFilter] = useState("all");
    const [dofollowFilter, setDofollowFilter] = useState("all");
    const [sortColumn, setSortColumn] = useState<SortColumn>("priorityScore");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Detail modal
    const [selectedGap, setSelectedGap] = useState<GapItem | null>(null);

    // Column visibility with localStorage
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("backlinkGap_columnVisibility");
            if (saved) {
                try { return JSON.parse(saved); } catch { /* use defaults */ }
            }
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("backlinkGap_columnVisibility", JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    const toggleColumn = (column: keyof ColumnVisibility) => {
        setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    const hasActiveFilters = priorityFilter !== "all" || compCountFilter !== "all" || drFilter !== "all" || linkCountFilter !== "all" || dofollowFilter !== "all" || search !== "";

    const filteredData = useMemo(() => {
        if (!data?.gaps) return [];

        let gaps = [...data.gaps];

        // Search
        if (search) {
            const q = search.toLowerCase();
            gaps = gaps.filter((item) =>
                item.domain.toLowerCase().includes(q) ||
                item.competitors.some((c) => c.toLowerCase().includes(q)) ||
                item.topAnchors.some((a) => a.anchor.toLowerCase().includes(q))
            );
        }

        // Priority filter
        if (priorityFilter !== "all") {
            gaps = gaps.filter((item) => {
                const s = item.priorityScore;
                switch (priorityFilter) {
                    case "high": return s >= 75;
                    case "medium": return s >= 50 && s < 75;
                    case "low": return s >= 25 && s < 50;
                    case "very_low": return s < 25;
                    default: return true;
                }
            });
        }

        // Competitor count filter
        if (compCountFilter !== "all") {
            gaps = gaps.filter((item) => {
                switch (compCountFilter) {
                    case "3+": return item.competitorCount >= 3;
                    case "2": return item.competitorCount === 2;
                    case "1": return item.competitorCount === 1;
                    default: return true;
                }
            });
        }

        // Domain Rank filter
        if (drFilter !== "all") {
            gaps = gaps.filter((item) => {
                const dr = item.avgDomainRank;
                switch (drFilter) {
                    case "high": return dr >= 70;
                    case "medium": return dr >= 30 && dr < 70;
                    case "low": return dr < 30;
                    default: return true;
                }
            });
        }

        // Link count filter
        if (linkCountFilter !== "all") {
            gaps = gaps.filter((item) => {
                switch (linkCountFilter) {
                    case "1": return item.totalLinks === 1;
                    case "2-5": return item.totalLinks >= 2 && item.totalLinks <= 5;
                    case "6-20": return item.totalLinks >= 6 && item.totalLinks <= 20;
                    case "20+": return item.totalLinks > 20;
                    default: return true;
                }
            });
        }

        // Dofollow filter
        if (dofollowFilter !== "all") {
            gaps = gaps.filter((item) => {
                const dfPct = item.dofollowPercent;
                switch (dofollowFilter) {
                    case "all_df": return dfPct === 100;
                    case "mostly_df": return dfPct > 75;
                    case "mixed": return dfPct >= 25 && dfPct <= 75;
                    case "mostly_nf": return dfPct < 25;
                    default: return true;
                }
            });
        }

        // Sort
        gaps.sort((a, b) => {
            if (sortColumn === "domain") {
                return sortDirection === "asc" ? a.domain.localeCompare(b.domain) : b.domain.localeCompare(a.domain);
            }
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });

        return gaps;
    }, [data?.gaps, search, priorityFilter, compCountFilter, drFilter, linkCountFilter, dofollowFilter, sortColumn, sortDirection]);

    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const paginatedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const resetPage = () => setPage(0);

    function handleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortColumn(column);
            setSortDirection(column === "domain" ? "asc" : "desc");
        }
    }

    function SortIcon({ column }: { column: SortColumn }) {
        if (sortColumn !== column) return <ChevronSelectorVertical className="h-3.5 w-3.5 text-fg-quaternary" />;
        return sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-fg-brand-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-fg-brand-primary" />;
    }

    function clearFilters() {
        setSearch("");
        setPriorityFilter("all");
        setCompCountFilter("all");
        setDrFilter("all");
        setLinkCountFilter("all");
        setDofollowFilter("all");
        resetPage();
    }

    if (data === undefined) {
        return (
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-64 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!data || data.gaps.length === 0) {
        return (
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2">
                    <Target04 className="h-5 w-5 text-fg-brand-primary" />
                    <h3 className="text-md font-semibold text-primary">{t('backlinkGapTitle')}</h3>
                </div>
                <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-tertiary">{t('backlinkGapEmpty')}</p>
                    <p className="mt-1 text-xs text-quaternary">{t('backlinkGapEmptyHint')}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Target04 className="h-5 w-5 text-fg-brand-primary" />
                        <div>
                            <h3 className="text-md font-semibold text-primary">{t('backlinkGapTitle')}</h3>
                            <p className="text-sm text-tertiary">
                                {t('gapSubtitle', { totalGapDomains: data.totalGapDomains, competitorCount: data.competitorCount })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        {t('gapDomainsCount', { count: filteredData.length })}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-quaternary" />
                        <input
                            type="text"
                            placeholder={t('searchGap')}
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
                        {t('filters')}
                        {hasActiveFilters && !showFilters && (
                            <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-medium text-white">
                                {[priorityFilter !== "all", compCountFilter !== "all", drFilter !== "all", linkCountFilter !== "all", dofollowFilter !== "all"].filter(Boolean).length}
                            </span>
                        )}
                    </button>

                    {/* Column picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${showColumnPicker ? "border-brand-600 bg-utility-brand-50 text-brand-600" : "border-primary bg-primary text-tertiary hover:bg-secondary"}`}
                        >
                            <Settings01 className="h-4 w-4" />
                            {t('refColumns')}
                        </button>
                        {showColumnPicker && (
                            <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
                                <div className="flex flex-col gap-1">
                                    {(Object.keys(columnVisibility) as Array<keyof ColumnVisibility>).map((key) => (
                                        <label
                                            key={key}
                                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-secondary/50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={columnVisibility[key]}
                                                onChange={() => toggleColumn(key)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className="text-primary">{t(COLUMN_LABEL_KEYS[key])}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 text-sm text-tertiary hover:text-primary"
                        >
                            <XClose className="h-3.5 w-3.5" />
                            {t('clear')}
                        </button>
                    )}
                </div>

                {/* Filters row */}
                {showFilters && (
                    <div className="flex flex-wrap gap-3">
                        <FilterSelect label={t('gapFilterPriorityLabel')} value={priorityFilter} options={PRIORITY_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setPriorityFilter(v); resetPage(); }} />
                        <FilterSelect label={t('gapFilterCompCountLabel')} value={compCountFilter} options={COMPETITOR_COUNT_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setCompCountFilter(v); resetPage(); }} />
                        <FilterSelect label={t('gapFilterDrLabel')} value={drFilter} options={DR_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setDrFilter(v); resetPage(); }} />
                        <FilterSelect label={t('gapFilterLinksLabel')} value={linkCountFilter} options={LINK_COUNT_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setLinkCountFilter(v); resetPage(); }} />
                        <FilterSelect label={t('gapFilterDfLabel')} value={dofollowFilter} options={DOFOLLOW_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setDofollowFilter(v); resetPage(); }} />
                    </div>
                )}

                {/* Table */}
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Target04 className="h-8 w-8 text-fg-quaternary mb-3" />
                        <p className="text-sm font-medium text-primary mb-1">{t('gapNoMatch')}</p>
                        <p className="text-xs text-tertiary text-center max-w-xs">
                            {t('noDomainsMatchHint')}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-secondary">
                                        {columnVisibility.domain && (
                                            <th className="cursor-pointer px-3 py-2.5 font-medium text-tertiary" onClick={() => handleSort("domain")}>
                                                <div className="flex items-center gap-1">{t('columnDomain')} <SortIcon column="domain" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.competitorCount && (
                                            <th className="cursor-pointer px-3 py-2.5 text-center font-medium text-tertiary" onClick={() => handleSort("competitorCount")}>
                                                <div className="flex items-center justify-center gap-1">{t('gapColCompCount')} <SortIcon column="competitorCount" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.competitors && (
                                            <th className="px-3 py-2.5 font-medium text-tertiary">{t('gapColCompetitors')}</th>
                                        )}
                                        {columnVisibility.totalLinks && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("totalLinks")}>
                                                <div className="flex items-center justify-end gap-1">{t('gapColLinks')} <SortIcon column="totalLinks" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.domainRank && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("avgDomainRank")}>
                                                <div className="flex items-center justify-end gap-1">{t('gapColDr')} <SortIcon column="avgDomainRank" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.dofollowPercent && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("dofollowPercent")}>
                                                <div className="flex items-center justify-end gap-1">{t('gapColDfPercent')} <SortIcon column="dofollowPercent" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.topAnchors && (
                                            <th className="px-3 py-2.5 font-medium text-tertiary">{t('gapColTopAnchors')}</th>
                                        )}
                                        {columnVisibility.priority && (
                                            <th className="cursor-pointer px-3 py-2.5 text-center font-medium text-tertiary" onClick={() => handleSort("priorityScore")}>
                                                <div className="flex items-center justify-center gap-1">{t('gapColPriority')} <SortIcon column="priorityScore" /></div>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((item) => {
                                        const badge = getPriorityBadge(item.priorityScore);
                                        return (
                                            <tr
                                                key={item.domain}
                                                className="border-b border-secondary last:border-0 hover:bg-primary_hover cursor-pointer"
                                                onClick={() => setSelectedGap(item)}
                                            >
                                                {columnVisibility.domain && (
                                                    <td className="px-3 py-2.5">
                                                        <span className="font-medium text-primary">{item.domain}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.competitorCount && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className="font-medium text-primary">{item.competitorCount}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.competitors && (
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.competitors.slice(0, 3).map((comp) => (
                                                                <span key={comp} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary">
                                                                    {comp.length > 20 ? comp.slice(0, 17) + "..." : comp}
                                                                </span>
                                                            ))}
                                                            {item.competitors.length > 3 && (
                                                                <span className="text-xs text-quaternary">+{item.competitors.length - 3}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.totalLinks && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{item.totalLinks}</td>
                                                )}
                                                {columnVisibility.domainRank && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{item.avgDomainRank || "—"}</td>
                                                )}
                                                {columnVisibility.dofollowPercent && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-8 bg-secondary rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-utility-success-500"
                                                                    style={{ width: `${item.dofollowPercent}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-primary w-8 text-right">{item.dofollowPercent}%</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.topAnchors && (
                                                    <td className="max-w-[180px] px-3 py-2.5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.topAnchors.slice(0, 3).map((a, j) => (
                                                                <span key={j} className="inline-flex truncate rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary">
                                                                    {a.anchor.length > 20 ? a.anchor.slice(0, 17) + "..." : a.anchor}
                                                                </span>
                                                            ))}
                                                            {item.topAnchors.length > 3 && (
                                                                <span className="text-xs text-quaternary">+{item.topAnchors.length - 3}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.priority && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                                                            {t(badge.labelKey)}
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
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-sm text-tertiary">
                                    {t('paginationShowing', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, filteredData.length), total: filteredData.length })}
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
            </div>

            {/* Detail Modal */}
            <BacklinkGapDetailModal
                gap={selectedGap}
                isOpen={selectedGap !== null}
                onClose={() => setSelectedGap(null)}
            />
        </>
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
