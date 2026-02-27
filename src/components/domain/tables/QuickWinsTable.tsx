"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
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
    Plus,
    Trash01,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { QuickWinDetailModal } from "../modals/QuickWinDetailModal";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/patterns/BulkActionBar";
import { formatNumber, getPositionBadgeClass } from "@/lib/formatting";

interface QuickWinsTableProps {
    domainId: Id<"domains">;
}

const INTENT_BADGES: Record<string, { bg: string; text: string; label: string }> = {
    commercial: { bg: "bg-utility-warning-50", text: "text-utility-warning-600", label: "Commercial" },
    informational: { bg: "bg-utility-blue-50", text: "text-utility-blue-600", label: "Informational" },
    navigational: { bg: "bg-utility-brand-50", text: "text-utility-brand-600", label: "Navigational" },
    transactional: { bg: "bg-utility-success-50", text: "text-utility-success-600", label: "Transactional" },
};

type SortColumn = "keyword" | "serp" | "position" | "searchVolume" | "difficulty" | "cpc" | "quickWinScore" | "referringDomains";
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
    serp: boolean;
    position: boolean;
    volume: boolean;
    difficulty: boolean;
    cpc: boolean;
    intent: boolean;
    referringDomains: boolean;
    score: boolean;
    actions: boolean;
}

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
    keyword: "Keyword",
    serp: "SERP",
    position: "Position",
    volume: "Volume",
    difficulty: "Difficulty",
    cpc: "CPC",
    intent: "Intent",
    referringDomains: "Ref. Domains",
    score: "Score",
    actions: "Actions",
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    keyword: true,
    serp: true,
    position: true,
    volume: true,
    difficulty: true,
    cpc: true,
    intent: true,
    referringDomains: true,
    score: true,
    actions: true,
};

export function QuickWinsTable({ domainId }: QuickWinsTableProps) {
    const t = useTranslations('onsite');
    const tc = useTranslations('common');
    const quickWins = useQuery(api.keywordMap_queries.getQuickWins, { domainId, limit: 200 });
    const addKeywords = useMutation(api.keywords.addKeywords);
    const deleteDiscoveredKeywords = useMutation(api.dataforseo.deleteDiscoveredKeywords);
    const [addingKeywords, setAddingKeywords] = useState<Set<string>>(new Set());
    const selection = useRowSelection();

    const handleAddToMonitoring = async (keyword: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAddingKeywords((prev) => new Set(prev).add(keyword));
        try {
            await addKeywords({ domainId, phrases: [keyword] });
            toast.success(t('addedToMonitoring', { keyword }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('failedToAdd'));
        } finally {
            setAddingKeywords((prev) => {
                const next = new Set(prev);
                next.delete(keyword);
                return next;
            });
        }
    };

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
                case "serp": aVal = a.serpFeatures.length; bVal = b.serpFeatures.length; break;
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
    const visibleIds = paginatedData.map((item: any) => item._id as string);

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
        if (sortColumn !== column) return <ChevronSelectorVertical className="h-4 w-4" />;
        return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
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
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-64 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    return (
        <>
            <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                {/* Header */}
                <div className="mb-3">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-fg-warning-primary" />
                        <h3 className="text-lg font-semibold text-primary">{t('quickWins')}</h3>
                    </div>
                    <p className="text-sm text-tertiary">
                        {t('quickWinsDescription')} ({filteredData.length} {t('keywords')})
                    </p>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="w-64">
                            <Input
                                placeholder={t('searchKeywords')}
                                value={search}
                                onChange={(value) => { setSearch(value); resetPage(); }}
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
                            {t('filters')}
                        </Button>

                        {/* Column picker */}
                        <div className="relative">
                            <Button
                                size="sm"
                                color="secondary"
                                iconLeading={Settings01}
                                onClick={() => setShowColumnPicker(!showColumnPicker)}
                            >
                                {t('columns')}
                            </Button>
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
                                                <span className="text-primary capitalize">{COLUMN_LABELS[key]}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters panel */}
                {showFilters && (
                    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
                        <FilterSelect label="Position" value={positionFilter} options={POSITION_FILTERS} onChange={(v) => { setPositionFilter(v); resetPage(); }} />
                        <FilterSelect label="Difficulty" value={difficultyFilter} options={DIFFICULTY_FILTERS} onChange={(v) => { setDifficultyFilter(v); resetPage(); }} />
                        <FilterSelect label="Intent" value={intentFilter} options={INTENT_FILTERS} onChange={(v) => { setIntentFilter(v); resetPage(); }} />

                        {hasActiveFilters && (
                            <Button
                                size="sm"
                                color="secondary"
                                onClick={clearFilters}
                            >
                                {t('clear')}
                            </Button>
                        )}
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
                        <BulkActionBar
                            selectedCount={selection.count}
                            selectedIds={selection.selectedIds}
                            onClearSelection={selection.clear}
                            actions={[
                                {
                                    label: tc('bulkAddToMonitoring'),
                                    icon: Plus,
                                    onClick: async (ids) => {
                                        const phrases = filteredData
                                            .filter((item: any) => ids.has(item._id))
                                            .map((item: any) => item.keyword);
                                        if (phrases.length === 0) return;
                                        try {
                                            await addKeywords({ domainId, phrases });
                                            toast.success(tc('bulkActionSuccess', { count: phrases.length }));
                                            selection.clear();
                                        } catch {
                                            toast.error(tc('bulkActionFailed'));
                                        }
                                    },
                                },
                                {
                                    label: tc('bulkDelete'),
                                    icon: Trash01,
                                    variant: "destructive" as const,
                                    onClick: async (ids) => {
                                        const keywordIds = filteredData
                                            .filter((item: any) => ids.has(item._id))
                                            .map((item: any) => item._id);
                                        if (keywordIds.length === 0) return;
                                        try {
                                            await deleteDiscoveredKeywords({ keywordIds });
                                            toast.success(tc('bulkActionSuccess', { count: keywordIds.length }));
                                            selection.clear();
                                        } catch {
                                            toast.error(tc('bulkActionFailed'));
                                        }
                                    },
                                },
                            ]}
                        />

                        <div className="overflow-x-auto rounded-lg border border-secondary">
                            <table className="w-full">
                                <thead className="bg-secondary/50">
                                    <tr>
                                        <th className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selection.isAllSelected(visibleIds)}
                                                ref={(el) => { if (el) el.indeterminate = selection.isIndeterminate(visibleIds); }}
                                                onChange={() => selection.toggleAll(visibleIds)}
                                                className="h-4 w-4 rounded border-secondary"
                                            />
                                        </th>
                                        {columnVisibility.keyword && (
                                            <th
                                                className="sticky left-0 z-20 bg-secondary cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary border-r border-secondary transition-colors hover:bg-secondary/70"
                                                onClick={() => handleSort("keyword")}
                                            >
                                                <div className="flex items-center gap-2">{t('quickWinColKeyword')} <SortIcon column="keyword" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.serp && (
                                            <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("serp")}>
                                                <div className="flex items-center justify-center gap-2">SERP <SortIcon column="serp" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.position && (
                                            <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("position")}>
                                                <div className="flex items-center justify-center gap-2">{t('quickWinColPosition')} <SortIcon column="position" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.volume && (
                                            <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("searchVolume")}>
                                                <div className="flex items-center justify-end gap-2">{t('quickWinColVolume')} <SortIcon column="searchVolume" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.difficulty && (
                                            <th className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("difficulty")}>
                                                <div className="flex items-center justify-center gap-2">{t('quickWinColDifficulty')} <SortIcon column="difficulty" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.cpc && (
                                            <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("cpc")}>
                                                <div className="flex items-center justify-end gap-2">{t('quickWinColCpc')} <SortIcon column="cpc" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.intent && (
                                            <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">{t('quickWinColIntent')}</th>
                                        )}
                                        {columnVisibility.referringDomains && (
                                            <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("referringDomains")}>
                                                <div className="flex items-center justify-end gap-2">{t('quickWinColRefDomains')} <SortIcon column="referringDomains" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.score && (
                                            <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70" onClick={() => handleSort("quickWinScore")}>
                                                <div className="flex items-center justify-end gap-2">{t('quickWinColScore')} <SortIcon column="quickWinScore" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.actions && (
                                            <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                                                {tc('actions')}
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary">
                                    {paginatedData.map((item) => {
                                        const intentBadge = item.intent ? INTENT_BADGES[item.intent] : null;
                                        const refDomains = (item.backlinksInfo as any)?.referringDomains;
                                        return (
                                            <tr
                                                key={item._id}
                                                className="group transition-colors hover:bg-primary_hover cursor-pointer"
                                                onClick={() => setSelectedKeywordId(item._id)}
                                            >
                                                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selection.isSelected(item._id)}
                                                        onChange={() => selection.toggle(item._id)}
                                                        className="h-4 w-4 rounded border-secondary"
                                                    />
                                                </td>
                                                {columnVisibility.keyword && (
                                                    <td className="sticky left-0 z-10 bg-primary group-hover:bg-primary_hover border-r border-secondary px-4 py-3 transition-colors">
                                                        <span className="text-sm font-medium text-primary whitespace-nowrap">{item.keyword}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.serp && (
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                                        {item.serpFeatures.length > 0 ? (
                                                            <span className="inline-flex items-center rounded-full bg-utility-gray-50 px-2.5 py-0.5 text-xs font-medium text-utility-gray-600">
                                                                {item.serpFeatures.length}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-tertiary">—</span>
                                                        )}
                                                    </td>
                                                )}
                                                {columnVisibility.position && (
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPositionBadgeClass(item.position)}`}>
                                                                #{item.position}
                                                            </span>
                                                            {item.positionChange !== null && item.positionChange !== 0 && (
                                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${item.positionChange > 0 ? "bg-utility-success-50 text-utility-success-700" : "bg-utility-error-50 text-utility-error-700"}`}>
                                                                    {item.positionChange > 0 ? "↑" : "↓"} {Math.abs(item.positionChange)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.volume && (
                                                    <td className="px-4 py-3 text-right text-sm text-primary">{formatNumber(item.searchVolume)}</td>
                                                )}
                                                {columnVisibility.difficulty && (
                                                    <td className="px-4 py-3 text-center">
                                                        {item.difficulty !== undefined && item.difficulty !== null ? (
                                                        <span
                                                            className={`text-sm font-medium ${
                                                                item.difficulty < 30 ? 'text-utility-success-600' :
                                                                item.difficulty < 70 ? 'text-utility-warning-600' :
                                                                'text-utility-error-600'
                                                            }`}
                                                        >
                                                            {item.difficulty}
                                                        </span>
                                                        ) : (
                                                        <span className="text-xs text-tertiary" title={tc('notAvailable')}>—</span>
                                                        )}
                                                    </td>
                                                )}
                                                {columnVisibility.cpc && (
                                                    <td className="px-4 py-3 text-right text-sm text-primary">
                                                        {item.cpc !== null ? `$${item.cpc.toFixed(2)}` : "—"}
                                                    </td>
                                                )}
                                                {columnVisibility.intent && (
                                                    <td className="px-4 py-3 text-center">
                                                        {intentBadge ? (
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${intentBadge.bg} ${intentBadge.text}`}>
                                                                {intentBadge.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-tertiary">—</span>
                                                        )}
                                                    </td>
                                                )}
                                                {columnVisibility.referringDomains && (
                                                    <td className="px-4 py-3 text-right text-sm text-primary">
                                                        {formatNumber(refDomains)}
                                                    </td>
                                                )}
                                                {columnVisibility.score && (
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-sm font-medium text-utility-success-600">{formatNumber(item.quickWinScore)}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.actions && (
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center">
                                                            <button
                                                                onClick={(e) => handleAddToMonitoring(item.keyword, e)}
                                                                disabled={addingKeywords.has(item.keyword)}
                                                                className="text-tertiary hover:text-brand-600 transition-colors disabled:opacity-50"
                                                                title={t('addToMonitoring')}
                                                            >
                                                                <Plus className={`h-4 w-4 ${addingKeywords.has(item.keyword) ? 'animate-pulse' : ''}`} />
                                                            </button>
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
                            <div className="flex items-center justify-between border-t border-secondary pt-4">
                                <p className="text-sm text-secondary">
                                    {t('showingRange', { start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, filteredData.length), total: filteredData.length })}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        iconLeading={ChevronLeft}
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                    >
                                        {t('previous')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        iconTrailing={ChevronRight}
                                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                    >
                                        {t('next')}
                                    </Button>
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
            <label className="text-sm font-medium text-secondary">{label}:</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
