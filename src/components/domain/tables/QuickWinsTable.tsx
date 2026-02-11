"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import {
    ChevronUp,
    ChevronDown,
    ChevronSelectorVertical,
    Zap,
    SearchLg,
    ArrowUpRight,
    ArrowDownRight,
    ChevronLeft,
    ChevronRight,
    FilterLines,
    Settings01,
    XClose,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { QuickWinDetailModal } from "../modals/QuickWinDetailModal";

interface QuickWinsTableProps {
    domainId: Id<"domains">;
}

function getPositionBadgeClass(position: number): string {
    if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
    if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
    if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
    return "bg-utility-gray-50 text-utility-gray-600";
}

function formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return "—";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

const INTENT_BADGES: Record<string, { bg: string; text: string; label: string }> = {
    commercial: { bg: "bg-utility-warning-50", text: "text-utility-warning-600", label: "Commercial" },
    informational: { bg: "bg-utility-blue-50", text: "text-utility-blue-600", label: "Informational" },
    navigational: { bg: "bg-utility-brand-50", text: "text-utility-brand-600", label: "Navigational" },
    transactional: { bg: "bg-utility-success-50", text: "text-utility-success-600", label: "Transactional" },
};

type SortColumn = "keyword" | "position" | "searchVolume" | "difficulty" | "cpc" | "quickWinScore" | "referringDomains";
type SortDirection = "asc" | "desc";

const POSITION_FILTERS = [
    { label: "All", value: "all" },
    { label: "4-10", value: "4-10" },
    { label: "11-20", value: "11-20" },
    { label: "21-30", value: "21-30" },
];

const DIFFICULTY_FILTERS = [
    { label: "All", value: "all" },
    { label: "Easy (<30)", value: "easy" },
    { label: "Medium (30-50)", value: "medium" },
];

const INTENT_FILTERS = [
    { label: "All", value: "all" },
    { label: "Commercial", value: "commercial" },
    { label: "Informational", value: "informational" },
    { label: "Transactional", value: "transactional" },
    { label: "Navigational", value: "navigational" },
];

const PAGE_SIZE = 25;

interface ColumnVisibility {
    keyword: boolean;
    position: boolean;
    volume: boolean;
    difficulty: boolean;
    cpc: boolean;
    intent: boolean;
    referringDomains: boolean;
    score: boolean;
}

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
    keyword: "Keyword",
    position: "Position",
    volume: "Volume",
    difficulty: "Difficulty",
    cpc: "CPC",
    intent: "Intent",
    referringDomains: "Ref. Domains",
    score: "Score",
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    keyword: true,
    position: true,
    volume: true,
    difficulty: true,
    cpc: true,
    intent: true,
    referringDomains: true,
    score: true,
};

export function QuickWinsTable({ domainId }: QuickWinsTableProps) {
    const t = useTranslations('onsite');
    const quickWins = useQuery(api.keywordMap_queries.getQuickWins, { domainId, limit: 200 });

    const [search, setSearch] = useState("");
    const [positionFilter, setPositionFilter] = useState("all");
    const [difficultyFilter, setDifficultyFilter] = useState("all");
    const [intentFilter, setIntentFilter] = useState("all");
    const [sortColumn, setSortColumn] = useState<SortColumn>("quickWinScore");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Column visibility with localStorage persistence
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("quickWins_columnVisibility");
            if (saved) {
                try { return JSON.parse(saved); } catch { /* use defaults */ }
            }
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("quickWins_columnVisibility", JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    const toggleColumn = (column: keyof ColumnVisibility) => {
        setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    // Modal state
    const [selectedKeywordId, setSelectedKeywordId] = useState<Id<"discoveredKeywords"> | null>(null);

    const hasActiveFilters = positionFilter !== "all" || difficultyFilter !== "all" || intentFilter !== "all" || search !== "";

    const filteredData = useMemo(() => {
        if (!quickWins) return [];

        let data = [...quickWins];

        // Search filter
        if (search) {
            const q = search.toLowerCase();
            data = data.filter((item) => item.keyword.toLowerCase().includes(q));
        }

        // Position filter
        if (positionFilter !== "all") {
            const [min, max] = positionFilter.split("-").map(Number);
            data = data.filter((item) => item.position >= min && item.position <= max);
        }

        // Difficulty filter
        if (difficultyFilter === "easy") {
            data = data.filter((item) => item.difficulty < 30);
        } else if (difficultyFilter === "medium") {
            data = data.filter((item) => item.difficulty >= 30 && item.difficulty < 50);
        }

        // Intent filter
        if (intentFilter !== "all") {
            data = data.filter((item) => item.intent === intentFilter);
        }

        // Sort
        data.sort((a, b) => {
            let aVal: number, bVal: number;
            switch (sortColumn) {
                case "keyword": return sortDirection === "asc" ? a.keyword.localeCompare(b.keyword) : b.keyword.localeCompare(a.keyword);
                case "position": aVal = a.position; bVal = b.position; break;
                case "searchVolume": aVal = a.searchVolume; bVal = b.searchVolume; break;
                case "difficulty": aVal = a.difficulty; bVal = b.difficulty; break;
                case "cpc": aVal = a.cpc ?? 0; bVal = b.cpc ?? 0; break;
                case "referringDomains":
                    aVal = (a.backlinksInfo as any)?.referringDomains ?? 0;
                    bVal = (b.backlinksInfo as any)?.referringDomains ?? 0;
                    break;
                case "quickWinScore": aVal = a.quickWinScore; bVal = b.quickWinScore; break;
                default: return 0;
            }
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });

        return data;
    }, [quickWins, search, positionFilter, difficultyFilter, intentFilter, sortColumn, sortDirection]);

    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const paginatedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Reset page when filters change
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
        return sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-fg-brand-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-fg-brand-primary" />;
    }

    function clearFilters() {
        setSearch("");
        setPositionFilter("all");
        setDifficultyFilter("all");
        setIntentFilter("all");
        resetPage();
    }

    if (quickWins === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />
                <div className="h-64 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-fg-warning-primary" />
                        <div>
                            <h3 className="text-md font-semibold text-primary">{t('quickWins')}</h3>
                            <p className="text-sm text-tertiary">{t('quickWinsDescription')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        {quickWins.length} {t('keywords')}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-quaternary" />
                        <input
                            type="text"
                            placeholder={t('searchKeywords')}
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
                                {[positionFilter !== "all", difficultyFilter !== "all", intentFilter !== "all"].filter(Boolean).length}
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
                            {t('columns')}
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
                                            <span className="text-primary">{COLUMN_LABELS[key]}</span>
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
                        <FilterSelect label="Position" value={positionFilter} options={POSITION_FILTERS} onChange={(v) => { setPositionFilter(v); resetPage(); }} />
                        <FilterSelect label="Difficulty" value={difficultyFilter} options={DIFFICULTY_FILTERS} onChange={(v) => { setDifficultyFilter(v); resetPage(); }} />
                        <FilterSelect label="Intent" value={intentFilter} options={INTENT_FILTERS} onChange={(v) => { setIntentFilter(v); resetPage(); }} />
                    </div>
                )}

                {/* Table */}
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Zap className="h-8 w-8 text-fg-quaternary mb-3" />
                        <p className="text-sm font-medium text-primary mb-1">{t('noQuickWinsFound')}</p>
                        <p className="text-xs text-tertiary text-center max-w-xs">
                            {hasActiveFilters
                                ? t('tryAdjustingFilters')
                                : t('noQuickWinsDescription')}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-secondary">
                                        {columnVisibility.keyword && (
                                            <th className="cursor-pointer px-3 py-2.5 font-medium text-tertiary" onClick={() => handleSort("keyword")}>
                                                <div className="flex items-center gap-1">{t('quickWinColKeyword')} <SortIcon column="keyword" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.position && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("position")}>
                                                <div className="flex items-center justify-end gap-1">{t('quickWinColPosition')} <SortIcon column="position" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.volume && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("searchVolume")}>
                                                <div className="flex items-center justify-end gap-1">{t('quickWinColVolume')} <SortIcon column="searchVolume" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.difficulty && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("difficulty")}>
                                                <div className="flex items-center justify-end gap-1">{t('quickWinColDifficulty')} <SortIcon column="difficulty" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.cpc && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("cpc")}>
                                                <div className="flex items-center justify-end gap-1">{t('quickWinColCpc')} <SortIcon column="cpc" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.intent && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('quickWinColIntent')}</th>
                                        )}
                                        {columnVisibility.referringDomains && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("referringDomains")}>
                                                <div className="flex items-center justify-end gap-1">{t('quickWinColRefDomains')} <SortIcon column="referringDomains" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.score && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("quickWinScore")}>
                                                <div className="flex items-center justify-end gap-1">{t('quickWinColScore')} <SortIcon column="quickWinScore" /></div>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((item) => {
                                        const intentBadge = item.intent ? INTENT_BADGES[item.intent] : null;
                                        const refDomains = (item.backlinksInfo as any)?.referringDomains;
                                        return (
                                            <tr
                                                key={item._id}
                                                className="border-b border-secondary last:border-0 hover:bg-primary_hover cursor-pointer"
                                                onClick={() => setSelectedKeywordId(item._id)}
                                            >
                                                {columnVisibility.keyword && (
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-primary">{item.keyword}</span>
                                                            {item.serpFeatures.length > 0 && (
                                                                <span className="text-[10px] text-tertiary bg-secondary rounded px-1 py-0.5">
                                                                    {item.serpFeatures.length} SERP
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.position && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPositionBadgeClass(item.position)}`}>
                                                                #{item.position}
                                                            </span>
                                                            {item.positionChange !== null && item.positionChange !== 0 && (
                                                                <span className={`inline-flex items-center text-[10px] font-medium ${item.positionChange > 0 ? "text-utility-success-600" : "text-utility-error-600"}`}>
                                                                    {item.positionChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                    {Math.abs(item.positionChange)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.volume && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{formatNumber(item.searchVolume)}</td>
                                                )}
                                                {columnVisibility.difficulty && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-12 bg-secondary rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${item.difficulty < 30 ? "bg-utility-success-500" : item.difficulty < 50 ? "bg-utility-warning-500" : "bg-utility-error-500"}`}
                                                                    style={{ width: `${item.difficulty}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-primary w-6 text-right">{item.difficulty}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.cpc && (
                                                    <td className="px-3 py-2.5 text-right text-primary">
                                                        {item.cpc !== null ? `$${item.cpc.toFixed(2)}` : "—"}
                                                    </td>
                                                )}
                                                {columnVisibility.intent && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        {intentBadge ? (
                                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${intentBadge.bg} ${intentBadge.text}`}>
                                                                {intentBadge.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-quaternary">—</span>
                                                        )}
                                                    </td>
                                                )}
                                                {columnVisibility.referringDomains && (
                                                    <td className="px-3 py-2.5 text-right text-primary">
                                                        {formatNumber(refDomains)}
                                                    </td>
                                                )}
                                                {columnVisibility.score && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-medium text-utility-success-600">{formatNumber(item.quickWinScore)}</span>
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
                                    {t('showingRange', { start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, filteredData.length), total: filteredData.length })}
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
            <QuickWinDetailModal
                domainId={domainId}
                discoveredKeywordId={selectedKeywordId!}
                isOpen={selectedKeywordId !== null}
                onClose={() => setSelectedKeywordId(null)}
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
