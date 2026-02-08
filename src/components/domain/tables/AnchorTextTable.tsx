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
    Type01,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";

interface AnchorTextTableProps {
    domainId: Id<"domains">;
}

const CATEGORY_BADGES: Record<string, { bg: string; text: string; labelKey: string }> = {
    branded: { bg: "bg-utility-brand-50", text: "text-utility-brand-600", labelKey: "anchorCategoryBrandedBadge" },
    exact_url: { bg: "bg-utility-blue-50", text: "text-utility-blue-600", labelKey: "anchorCategoryUrlBadge" },
    generic: { bg: "bg-utility-warning-50", text: "text-utility-warning-600", labelKey: "anchorCategoryGenericBadge" },
    other: { bg: "bg-utility-gray-50", text: "text-utility-gray-600", labelKey: "anchorCategoryOtherBadge" },
};

type SortColumn = "anchor" | "count" | "percentage" | "dofollow" | "nofollow";
type SortDirection = "asc" | "desc";

const CATEGORY_FILTERS = [
    { labelKey: "filterAll", value: "all" },
    { labelKey: "anchorFilterCategoryBranded", value: "branded" },
    { labelKey: "anchorFilterCategoryUrl", value: "exact_url" },
    { labelKey: "anchorFilterCategoryGeneric", value: "generic" },
    { labelKey: "anchorFilterCategoryOther", value: "other" },
];

const MIN_COUNT_FILTERS = [
    { labelKey: "anchorFilterAny", value: "0" },
    { labelKey: "anchorFilterMinCount2", value: "2" },
    { labelKey: "anchorFilterMinCount5", value: "5" },
    { labelKey: "anchorFilterMinCount10", value: "10" },
    { labelKey: "anchorFilterMinCount25", value: "25" },
    { labelKey: "anchorFilterMinCount50", value: "50" },
];

const SHARE_FILTERS = [
    { labelKey: "filterAll", value: "all" },
    { labelKey: "anchorFilterShareAbove05", value: "0.5" },
    { labelKey: "anchorFilterShareAbove1", value: "1" },
    { labelKey: "anchorFilterShareAbove3", value: "3" },
    { labelKey: "anchorFilterShareAbove5", value: "5" },
    { labelKey: "anchorFilterShareAbove10", value: "10" },
];

const DOFOLLOW_RATIO_FILTERS = [
    { labelKey: "filterAll", value: "all" },
    { labelKey: "anchorFilterDfAll", value: "all_df" },
    { labelKey: "anchorFilterDfMostly", value: "mostly_df" },
    { labelKey: "anchorFilterDfMixed", value: "mixed" },
    { labelKey: "anchorFilterNfMostly", value: "mostly_nf" },
];

const PAGE_SIZE = 25;

// Column visibility
interface ColumnVisibility {
    anchor: boolean;
    category: boolean;
    count: boolean;
    dofollow: boolean;
    nofollow: boolean;
    share: boolean;
}

const COLUMN_LABEL_KEYS: Record<keyof ColumnVisibility, string> = {
    anchor: "anchorColumnLabelAnchor",
    category: "anchorColumnLabelCategory",
    count: "anchorColumnLabelCount",
    dofollow: "anchorColumnLabelDofollow",
    nofollow: "anchorColumnLabelNofollow",
    share: "anchorColumnLabelShare",
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    anchor: true,
    category: true,
    count: true,
    dofollow: true,
    nofollow: true,
    share: true,
};

export function AnchorTextTable({ domainId }: AnchorTextTableProps) {
    const t = useTranslations('backlinks');
    const data = useQuery(api.backlinkAnalysis_queries.getAnchorTextDistribution, { domainId });

    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [minCountFilter, setMinCountFilter] = useState("0");
    const [shareFilter, setShareFilter] = useState("all");
    const [dofollowRatioFilter, setDofollowRatioFilter] = useState("all");
    const [sortColumn, setSortColumn] = useState<SortColumn>("count");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Column visibility with localStorage
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("anchorText_columnVisibility");
            if (saved) {
                try { return JSON.parse(saved); } catch { /* use defaults */ }
            }
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("anchorText_columnVisibility", JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    const toggleColumn = (column: keyof ColumnVisibility) => {
        setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    const hasActiveFilters = categoryFilter !== "all" || minCountFilter !== "0" || shareFilter !== "all" || dofollowRatioFilter !== "all" || search !== "";

    const filteredData = useMemo(() => {
        if (!data?.topAnchors) return [];

        let items = [...data.topAnchors];

        // Search
        if (search) {
            const q = search.toLowerCase();
            items = items.filter((item) => item.anchor.toLowerCase().includes(q));
        }

        // Category filter
        if (categoryFilter !== "all") {
            items = items.filter((item) => item.category === categoryFilter);
        }

        // Min count filter
        if (minCountFilter !== "0") {
            const minCount = parseInt(minCountFilter, 10);
            items = items.filter((item) => item.count >= minCount);
        }

        // Share % filter
        if (shareFilter !== "all") {
            const minShare = parseFloat(shareFilter);
            items = items.filter((item) => item.percentage > minShare);
        }

        // Dofollow ratio filter
        if (dofollowRatioFilter !== "all") {
            items = items.filter((item) => {
                const total = item.dofollow + item.nofollow;
                if (total === 0) return dofollowRatioFilter === "mixed";
                const dfPercent = (item.dofollow / total) * 100;
                switch (dofollowRatioFilter) {
                    case "all_df": return dfPercent === 100;
                    case "mostly_df": return dfPercent > 75;
                    case "mixed": return dfPercent >= 25 && dfPercent <= 75;
                    case "mostly_nf": return dfPercent < 25;
                    default: return true;
                }
            });
        }

        // Sort
        items.sort((a, b) => {
            let aVal: number, bVal: number;
            switch (sortColumn) {
                case "anchor":
                    return sortDirection === "asc" ? a.anchor.localeCompare(b.anchor) : b.anchor.localeCompare(a.anchor);
                case "count": aVal = a.count; bVal = b.count; break;
                case "percentage": aVal = a.percentage; bVal = b.percentage; break;
                case "dofollow": aVal = a.dofollow; bVal = b.dofollow; break;
                case "nofollow": aVal = a.nofollow; bVal = b.nofollow; break;
                default: return 0;
            }
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });

        return items;
    }, [data?.topAnchors, search, categoryFilter, minCountFilter, shareFilter, dofollowRatioFilter, sortColumn, sortDirection]);

    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const paginatedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const resetPage = () => setPage(0);

    function handleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortColumn(column);
            setSortDirection(column === "anchor" ? "asc" : "desc");
        }
    }

    function SortIcon({ column }: { column: SortColumn }) {
        if (sortColumn !== column) return <ChevronSelectorVertical className="h-3.5 w-3.5 text-fg-quaternary" />;
        return sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-fg-brand-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-fg-brand-primary" />;
    }

    function clearFilters() {
        setSearch("");
        setCategoryFilter("all");
        setMinCountFilter("0");
        setShareFilter("all");
        setDofollowRatioFilter("all");
        resetPage();
    }

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-36 animate-pulse rounded bg-gray-100" />
                <div className="h-64 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!data || data.topAnchors.length === 0) return null;

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Type01 className="h-5 w-5 text-fg-brand-primary" />
                    <div>
                        <h3 className="text-md font-semibold text-primary">{t('anchorTextsTitle')}</h3>
                        <p className="text-sm text-tertiary">{t('anchorTextsSubtitle')}</p>
                    </div>
                </div>
                <div className="text-sm text-tertiary">
                    {t('anchorAnchorsCount', { count: filteredData.length })}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-quaternary" />
                    <input
                        type="text"
                        placeholder={t('searchAnchors')}
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
                            {[categoryFilter !== "all", minCountFilter !== "0", shareFilter !== "all", dofollowRatioFilter !== "all"].filter(Boolean).length}
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
                    <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-tertiary hover:text-primary">
                        <XClose className="h-3.5 w-3.5" />
                        {t('clear')}
                    </button>
                )}
            </div>

            {/* Filters row */}
            {showFilters && (
                <div className="flex flex-wrap gap-3">
                    <FilterSelect label={t('anchorFilterCategoryLabel')} value={categoryFilter} options={CATEGORY_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setCategoryFilter(v); resetPage(); }} />
                    <FilterSelect label={t('anchorFilterMinCountLabel')} value={minCountFilter} options={MIN_COUNT_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setMinCountFilter(v); resetPage(); }} />
                    <FilterSelect label={t('anchorFilterShareLabel')} value={shareFilter} options={SHARE_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setShareFilter(v); resetPage(); }} />
                    <FilterSelect label={t('anchorFilterDfLabel')} value={dofollowRatioFilter} options={DOFOLLOW_RATIO_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setDofollowRatioFilter(v); resetPage(); }} />
                </div>
            )}

            {/* Table */}
            {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Type01 className="h-8 w-8 text-fg-quaternary mb-3" />
                    <p className="text-sm font-medium text-primary mb-1">{t('noAnchorsMatch')}</p>
                    <p className="text-xs text-tertiary">{t('anchorNoMatchHint')}</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-secondary">
                                    {columnVisibility.anchor && (
                                        <th className="cursor-pointer px-3 py-2.5 font-medium text-tertiary" onClick={() => handleSort("anchor")}>
                                            <div className="flex items-center gap-1">{t('anchorColAnchorText')} <SortIcon column="anchor" /></div>
                                        </th>
                                    )}
                                    {columnVisibility.category && (
                                        <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('anchorColCategory')}</th>
                                    )}
                                    {columnVisibility.count && (
                                        <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("count")}>
                                            <div className="flex items-center justify-end gap-1">{t('anchorColCount')} <SortIcon column="count" /></div>
                                        </th>
                                    )}
                                    {columnVisibility.dofollow && (
                                        <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("dofollow")}>
                                            <div className="flex items-center justify-end gap-1">{t('anchorColDofollow')} <SortIcon column="dofollow" /></div>
                                        </th>
                                    )}
                                    {columnVisibility.nofollow && (
                                        <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("nofollow")}>
                                            <div className="flex items-center justify-end gap-1">{t('anchorColNofollow')} <SortIcon column="nofollow" /></div>
                                        </th>
                                    )}
                                    {columnVisibility.share && (
                                        <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("percentage")}>
                                            <div className="flex items-center justify-end gap-1">{t('anchorColShare')} <SortIcon column="percentage" /></div>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, i) => {
                                    const badge = CATEGORY_BADGES[item.category] || CATEGORY_BADGES.other;
                                    return (
                                        <tr key={i} className="border-b border-secondary last:border-0 hover:bg-primary_hover">
                                            {columnVisibility.anchor && (
                                                <td className="max-w-[400px] truncate px-3 py-2.5 font-medium text-primary">{item.anchor}</td>
                                            )}
                                            {columnVisibility.category && (
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>{t(badge.labelKey)}</span>
                                                </td>
                                            )}
                                            {columnVisibility.count && (
                                                <td className="px-3 py-2.5 text-right text-primary">{item.count}</td>
                                            )}
                                            {columnVisibility.dofollow && (
                                                <td className="px-3 py-2.5 text-right text-utility-success-600">{item.dofollow}</td>
                                            )}
                                            {columnVisibility.nofollow && (
                                                <td className="px-3 py-2.5 text-right text-tertiary">{item.nofollow}</td>
                                            )}
                                            {columnVisibility.share && (
                                                <td className="px-3 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                                                            <div className="h-full rounded-full bg-utility-brand-500" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs text-tertiary w-10 text-right">{item.percentage}%</span>
                                                    </div>
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
