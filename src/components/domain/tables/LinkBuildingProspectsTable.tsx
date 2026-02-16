"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import {
    ChevronUp,
    ChevronDown,
    ChevronSelectorVertical,
    ChevronLeft,
    ChevronRight,
    ArrowUpRight,
    CheckCircle,
    XCircle,
    Eye,
    SearchLg,
    FilterLines,
    Settings01,
    XClose,
    LinkExternal01,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LinkBuildingProspectDetailModal } from "../modals/LinkBuildingProspectDetailModal";
import { useTranslations } from "next-intl";

interface LinkBuildingProspectsTableProps {
    domainId: Id<"domains">;
}

const CHANNEL_LABELS: Record<string, { labelKey: string; bg: string; text: string }> = {
    broken_link: { labelKey: "prospectChannelBrokenLink", bg: "bg-utility-error-50", text: "text-utility-error-600" },
    guest_post: { labelKey: "prospectChannelGuestPost", bg: "bg-utility-brand-50", text: "text-utility-brand-600" },
    resource_page: { labelKey: "prospectChannelResourcePage", bg: "bg-utility-blue-50", text: "text-utility-blue-600" },
    outreach: { labelKey: "prospectChannelOutreach", bg: "bg-utility-warning-50", text: "text-utility-warning-600" },
    content_mention: { labelKey: "prospectChannelContentMention", bg: "bg-utility-success-50", text: "text-utility-success-600" },
};

const DIFFICULTY_BADGES: Record<string, { labelKey: string; bg: string; text: string }> = {
    easy: { labelKey: "prospectDiffBadgeEasy", bg: "bg-utility-success-50", text: "text-utility-success-600" },
    medium: { labelKey: "prospectDiffBadgeMedium", bg: "bg-utility-warning-50", text: "text-utility-warning-600" },
    hard: { labelKey: "prospectDiffBadgeHard", bg: "bg-utility-error-50", text: "text-utility-error-600" },
};

const STATUS_BADGES: Record<string, { labelKey: string; bg: string; text: string }> = {
    identified: { labelKey: "prospectStatusBadgeIdentified", bg: "bg-utility-gray-50", text: "text-utility-gray-600" },
    reviewing: { labelKey: "prospectStatusBadgeReviewing", bg: "bg-utility-brand-50", text: "text-utility-brand-600" },
    dismissed: { labelKey: "prospectStatusBadgeDismissed", bg: "bg-utility-error-50", text: "text-utility-error-600" },
};

type SortColumn = "referringDomain" | "prospectScore" | "estimatedImpact" | "domainRank" | "linksToCompetitors" | "competitors";
type SortDirection = "asc" | "desc";

const CHANNEL_FILTERS = [
    { labelKey: "prospectFilterChannelAll", value: "all" },
    { labelKey: "prospectFilterChannelBrokenLink", value: "broken_link" },
    { labelKey: "prospectFilterChannelGuestPost", value: "guest_post" },
    { labelKey: "prospectFilterChannelResourcePage", value: "resource_page" },
    { labelKey: "prospectFilterChannelOutreach", value: "outreach" },
    { labelKey: "prospectFilterChannelContentMention", value: "content_mention" },
];

const DIFFICULTY_FILTERS = [
    { labelKey: "prospectFilterDifficultyAll", value: "all" },
    { labelKey: "prospectFilterDifficultyEasy", value: "easy" },
    { labelKey: "prospectFilterDifficultyMedium", value: "medium" },
    { labelKey: "prospectFilterDifficultyHard", value: "hard" },
];

const STATUS_FILTERS = [
    { labelKey: "prospectFilterStatusAll", value: "all" },
    { labelKey: "prospectFilterStatusIdentified", value: "identified" },
    { labelKey: "prospectFilterStatusReviewing", value: "reviewing" },
    { labelKey: "prospectFilterStatusDismissed", value: "dismissed" },
];

const PAGE_SIZE = 25;

// Column visibility
interface ColumnVisibility {
    domain: boolean;
    score: boolean;
    channel: boolean;
    difficulty: boolean;
    impact: boolean;
    domainRank: boolean;
    compLinks: boolean;
    competitors: boolean;
    status: boolean;
    actions: boolean;
}

const COLUMN_LABEL_KEYS: Record<keyof ColumnVisibility, string> = {
    domain: "prospectColumnLabelDomain",
    score: "prospectColumnLabelScore",
    channel: "prospectColumnLabelChannel",
    difficulty: "prospectColumnLabelDifficulty",
    impact: "prospectColumnLabelImpact",
    domainRank: "prospectColumnLabelDr",
    compLinks: "prospectColumnLabelCompLinks",
    competitors: "prospectColumnLabelCompetitors",
    status: "prospectColumnLabelStatus",
    actions: "prospectColumnLabelActions",
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    domain: true,
    score: true,
    channel: true,
    difficulty: true,
    impact: true,
    domainRank: true,
    compLinks: true,
    competitors: false,
    status: true,
    actions: true,
};

export function LinkBuildingProspectsTable({ domainId }: LinkBuildingProspectsTableProps) {
    const t = useTranslations('backlinks');
    const prospects = useQuery(api.linkBuilding_queries.getTopProspects, { domainId, limit: 200 });
    const updateStatus = useMutation(api.linkBuilding_mutations.updateProspectStatus);

    const [search, setSearch] = useState("");
    const [channelFilter, setChannelFilter] = useState("all");
    const [difficultyFilter, setDifficultyFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortColumn, setSortColumn] = useState<SortColumn>("prospectScore");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Detail modal state
    const [selectedProspect, setSelectedProspect] = useState<(typeof prospects extends (infer T)[] | undefined ? T : never) | null>(null);

    // Column visibility with localStorage
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("linkBuildingProspects_columnVisibility");
            if (saved) {
                try { return JSON.parse(saved); } catch { /* use defaults */ }
            }
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("linkBuildingProspects_columnVisibility", JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    const toggleColumn = (column: keyof ColumnVisibility) => {
        setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    const hasActiveFilters = channelFilter !== "all" || difficultyFilter !== "all" || statusFilter !== "all" || search !== "";

    const filteredData = useMemo(() => {
        if (!prospects) return [];

        let data = [...prospects];

        // Search
        if (search) {
            const q = search.toLowerCase();
            data = data.filter((item) =>
                item.referringDomain.toLowerCase().includes(q) ||
                item.competitors.some((c) => c.toLowerCase().includes(q))
            );
        }

        // Channel filter
        if (channelFilter !== "all") {
            data = data.filter((item) => item.suggestedChannel === channelFilter);
        }

        // Difficulty filter
        if (difficultyFilter !== "all") {
            data = data.filter((item) => item.acquisitionDifficulty === difficultyFilter);
        }

        // Status filter
        if (statusFilter !== "all") {
            data = data.filter((item) => item.status === statusFilter);
        }

        // Sort
        data.sort((a, b) => {
            let aVal: number, bVal: number;
            switch (sortColumn) {
                case "referringDomain":
                    return sortDirection === "asc" ? a.referringDomain.localeCompare(b.referringDomain) : b.referringDomain.localeCompare(a.referringDomain);
                case "prospectScore": aVal = a.prospectScore; bVal = b.prospectScore; break;
                case "estimatedImpact": aVal = a.estimatedImpact; bVal = b.estimatedImpact; break;
                case "domainRank": aVal = a.domainRank; bVal = b.domainRank; break;
                case "linksToCompetitors": aVal = a.linksToCompetitors; bVal = b.linksToCompetitors; break;
                case "competitors": aVal = a.competitors.length; bVal = b.competitors.length; break;
                default: return 0;
            }
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });

        return data;
    }, [prospects, search, channelFilter, difficultyFilter, statusFilter, sortColumn, sortDirection]);

    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const paginatedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const resetPage = () => setPage(0);

    function handleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortColumn(column);
            setSortDirection(column === "referringDomain" ? "asc" : "desc");
        }
    }

    function SortIcon({ column }: { column: SortColumn }) {
        if (sortColumn !== column) return <ChevronSelectorVertical className="h-3.5 w-3.5 text-fg-quaternary" />;
        return sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-fg-brand-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-fg-brand-primary" />;
    }

    function clearFilters() {
        setSearch("");
        setChannelFilter("all");
        setDifficultyFilter("all");
        setStatusFilter("all");
        resetPage();
    }

    if (prospects === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-44 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-64 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    if (!prospects || prospects.length === 0) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <h3 className="text-md font-semibold text-primary">{t('prospectTableTitle')}</h3>
                <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-tertiary">{t('prospectEmpty')}</p>
                    <p className="mt-1 text-xs text-quaternary">{t('prospectEmptyHint')}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <LinkExternal01 className="h-5 w-5 text-fg-brand-primary" />
                        <div>
                            <h3 className="text-md font-semibold text-primary">{t('prospectTableTitle')}</h3>
                            <p className="text-sm text-tertiary">{t('prospectSubtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        {t('prospectProspectsCount', { count: filteredData.length })}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-quaternary" />
                        <input
                            type="text"
                            placeholder={t('searchProspects')}
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
                                {[channelFilter !== "all", difficultyFilter !== "all", statusFilter !== "all"].filter(Boolean).length}
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
                        <FilterSelect label={t('prospectFilterChannelLabel')} value={channelFilter} options={CHANNEL_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setChannelFilter(v); resetPage(); }} />
                        <FilterSelect label={t('prospectFilterDifficultyLabel')} value={difficultyFilter} options={DIFFICULTY_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setDifficultyFilter(v); resetPage(); }} />
                        <FilterSelect label={t('prospectFilterStatusLabel')} value={statusFilter} options={STATUS_FILTERS.map(f => ({ label: t(f.labelKey), value: f.value }))} onChange={(v) => { setStatusFilter(v); resetPage(); }} />
                    </div>
                )}

                {/* Table */}
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <LinkExternal01 className="h-8 w-8 text-fg-quaternary mb-3" />
                        <p className="text-sm font-medium text-primary mb-1">{t('prospectNoMatch')}</p>
                        <p className="text-xs text-tertiary text-center max-w-xs">
                            {t('prospectNoMatchHint')}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-secondary">
                                        {columnVisibility.domain && (
                                            <th className="cursor-pointer px-3 py-2.5 font-medium text-tertiary" onClick={() => handleSort("referringDomain")}>
                                                <div className="flex items-center gap-1">{t('prospectColDomain')} <SortIcon column="referringDomain" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.score && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("prospectScore")}>
                                                <div className="flex items-center justify-end gap-1">{t('prospectColScore')} <SortIcon column="prospectScore" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.channel && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('prospectColChannel')}</th>
                                        )}
                                        {columnVisibility.difficulty && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('prospectColDifficulty')}</th>
                                        )}
                                        {columnVisibility.impact && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("estimatedImpact")}>
                                                <div className="flex items-center justify-end gap-1">{t('prospectColImpact')} <SortIcon column="estimatedImpact" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.domainRank && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("domainRank")}>
                                                <div className="flex items-center justify-end gap-1">{t('prospectColDr')} <SortIcon column="domainRank" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.compLinks && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("linksToCompetitors")}>
                                                <div className="flex items-center justify-end gap-1">{t('prospectColCompLinks')} <SortIcon column="linksToCompetitors" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.competitors && (
                                            <th className="cursor-pointer px-3 py-2.5 text-left font-medium text-tertiary" onClick={() => handleSort("competitors")}>
                                                <div className="flex items-center gap-1">{t('prospectColCompetitors')} <SortIcon column="competitors" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.status && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('prospectColStatus')}</th>
                                        )}
                                        {columnVisibility.actions && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">{t('prospectColActions')}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((item) => {
                                        const channel = CHANNEL_LABELS[item.suggestedChannel] || CHANNEL_LABELS.outreach;
                                        const difficulty = DIFFICULTY_BADGES[item.acquisitionDifficulty] || DIFFICULTY_BADGES.medium;
                                        const statusBadge = STATUS_BADGES[item.status] || STATUS_BADGES.identified;

                                        return (
                                            <tr
                                                key={item._id}
                                                className="border-b border-secondary last:border-0 hover:bg-primary_hover cursor-pointer"
                                                onClick={() => setSelectedProspect(item)}
                                            >
                                                {columnVisibility.domain && (
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-medium text-primary">{item.referringDomain}</span>
                                                            <a
                                                                href={`https://${item.referringDomain}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-fg-quaternary hover:text-fg-brand-primary"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ArrowUpRight className="h-3 w-3" />
                                                            </a>
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.score && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-10 bg-secondary rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${item.prospectScore >= 70 ? "bg-utility-success-500" : item.prospectScore >= 40 ? "bg-utility-warning-500" : "bg-utility-error-500"}`}
                                                                    style={{ width: `${item.prospectScore}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-semibold text-primary w-6 text-right">{item.prospectScore}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.channel && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${channel.bg} ${channel.text}`}>{t(channel.labelKey)}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.difficulty && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>{t(difficulty.labelKey)}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.impact && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-medium text-utility-success-600">{item.estimatedImpact}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.domainRank && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{item.domainRank || "—"}</td>
                                                )}
                                                {columnVisibility.compLinks && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{item.linksToCompetitors}</td>
                                                )}
                                                {columnVisibility.competitors && (
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.competitors.slice(0, 2).map((c) => (
                                                                <span key={c} className="text-xs text-tertiary bg-secondary rounded px-1.5 py-0.5">
                                                                    {c.length > 20 ? c.slice(0, 17) + "..." : c}
                                                                </span>
                                                            ))}
                                                            {item.competitors.length > 2 && (
                                                                <span className="text-xs text-quaternary">+{item.competitors.length - 2}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.status && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>{t(statusBadge.labelKey)}</span>
                                                    </td>
                                                )}
                                                {columnVisibility.actions && (
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                            {item.status === "identified" && (
                                                                <button
                                                                    onClick={() => updateStatus({ prospectId: item._id, status: "reviewing" })}
                                                                    className="rounded p-1 text-fg-quaternary hover:bg-secondary hover:text-fg-brand-primary"
                                                                    title={t('prospectActionMarkReviewing')}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {item.status === "reviewing" && (
                                                                <button
                                                                    onClick={() => updateStatus({ prospectId: item._id, status: "identified" })}
                                                                    className="rounded p-1 text-fg-brand-primary hover:bg-secondary"
                                                                    title={t('prospectActionBackToIdentified')}
                                                                >
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => updateStatus({ prospectId: item._id, status: "dismissed" })}
                                                                className="rounded p-1 text-fg-quaternary hover:bg-secondary hover:text-fg-error-primary"
                                                                title={t('prospectActionDismiss')}
                                                            >
                                                                <XCircle className="h-4 w-4" />
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
            <LinkBuildingProspectDetailModal
                prospect={selectedProspect}
                isOpen={selectedProspect !== null}
                onClose={() => setSelectedProspect(null)}
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
