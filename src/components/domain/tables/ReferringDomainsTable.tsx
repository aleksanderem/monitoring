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
    Globe01,
} from "@untitledui/icons";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ReferringDomainDetailModal } from "../modals/ReferringDomainDetailModal";

interface ReferringDomainsTableProps {
    domainId: Id<"domains">;
}

interface DomainItem {
    domain: string;
    linkCount: number;
    dofollow: number;
    nofollow: number;
    dofollowPercent: number;
    avgDomainRank: number;
    avgSpamScore: number | null;
    qualityScore: number;
    topAnchors: Array<{ anchor: string; count: number }>;
    firstSeen: string | null;
    lastSeen: string | null;
    country: string | null;
}

function getQualityBadge(score: number): { bg: string; text: string; label: string } {
    if (score >= 70) return { bg: "bg-utility-success-50", text: "text-utility-success-600", label: "Excellent" };
    if (score >= 40) return { bg: "bg-utility-blue-50", text: "text-utility-blue-600", label: "Good" };
    if (score >= 20) return { bg: "bg-utility-warning-50", text: "text-utility-warning-600", label: "Average" };
    return { bg: "bg-utility-gray-50", text: "text-utility-gray-600", label: "Poor" };
}

type SortColumn = "domain" | "linkCount" | "dofollowPercent" | "avgDomainRank" | "avgSpamScore" | "qualityScore";
type SortDirection = "asc" | "desc";

const QUALITY_FILTERS = [
    { label: "All", value: "all" },
    { label: "Excellent (70+)", value: "excellent" },
    { label: "Good (40-69)", value: "good" },
    { label: "Average (20-39)", value: "average" },
    { label: "Poor (<20)", value: "poor" },
];

const SPAM_FILTERS = [
    { label: "All", value: "all" },
    { label: "Clean (0-10)", value: "clean" },
    { label: "Moderate (11-30)", value: "moderate" },
    { label: "High Risk (31+)", value: "high" },
];

const DR_FILTERS = [
    { label: "All", value: "all" },
    { label: "High (70+)", value: "high" },
    { label: "Medium (30-69)", value: "medium" },
    { label: "Low (<30)", value: "low" },
];

const LINK_COUNT_FILTERS = [
    { label: "All", value: "all" },
    { label: "1 link", value: "1" },
    { label: "2-5 links", value: "2-5" },
    { label: "6-20 links", value: "6-20" },
    { label: "20+ links", value: "20+" },
];

const DOFOLLOW_RATIO_FILTERS = [
    { label: "All", value: "all" },
    { label: "All Dofollow (100%)", value: "all_df" },
    { label: "Mostly Dofollow (>75%)", value: "mostly_df" },
    { label: "Mixed (25-75%)", value: "mixed" },
    { label: "Mostly Nofollow (<25%)", value: "mostly_nf" },
];

const PAGE_SIZE = 25;

// Column visibility
interface ColumnVisibility {
    domain: boolean;
    linkCount: boolean;
    dofollow: boolean;
    dofollowPercent: boolean;
    domainRank: boolean;
    spamScore: boolean;
    quality: boolean;
    topAnchors: boolean;
    country: boolean;
    firstSeen: boolean;
    lastSeen: boolean;
}

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
    domain: "Domain",
    linkCount: "Links",
    dofollow: "Dofollow",
    dofollowPercent: "Dofollow %",
    domainRank: "Domain Rank",
    spamScore: "Spam Score",
    quality: "Quality",
    topAnchors: "Top Anchors",
    country: "Country",
    firstSeen: "First Seen",
    lastSeen: "Last Seen",
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    domain: true,
    linkCount: true,
    dofollow: false,
    dofollowPercent: true,
    domainRank: true,
    spamScore: false,
    quality: true,
    topAnchors: true,
    country: false,
    firstSeen: false,
    lastSeen: false,
};

export function ReferringDomainsTable({ domainId }: ReferringDomainsTableProps) {
    const data = useQuery(api.backlinkAnalysis_queries.getReferringDomainIntelligence, { domainId });

    const [search, setSearch] = useState("");
    const [qualityFilter, setQualityFilter] = useState("all");
    const [spamFilter, setSpamFilter] = useState("all");
    const [drFilter, setDrFilter] = useState("all");
    const [linkCountFilter, setLinkCountFilter] = useState("all");
    const [dofollowRatioFilter, setDofollowRatioFilter] = useState("all");
    const [sortColumn, setSortColumn] = useState<SortColumn>("qualityScore");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Detail modal
    const [selectedDomain, setSelectedDomain] = useState<DomainItem | null>(null);

    // Column visibility with localStorage
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("referringDomains_columnVisibility");
            if (saved) {
                try { return JSON.parse(saved); } catch { /* use defaults */ }
            }
        }
        return DEFAULT_COLUMN_VISIBILITY;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("referringDomains_columnVisibility", JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    const toggleColumn = (column: keyof ColumnVisibility) => {
        setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    const hasActiveFilters = qualityFilter !== "all" || spamFilter !== "all" || drFilter !== "all" || linkCountFilter !== "all" || dofollowRatioFilter !== "all" || search !== "";

    const filteredData = useMemo(() => {
        if (!data?.domains) return [];

        let domains = [...data.domains];

        // Search
        if (search) {
            const q = search.toLowerCase();
            domains = domains.filter((item) =>
                item.domain.toLowerCase().includes(q) ||
                item.topAnchors.some((a) => a.anchor.toLowerCase().includes(q))
            );
        }

        // Quality filter
        if (qualityFilter !== "all") {
            domains = domains.filter((item) => {
                const s = item.qualityScore;
                switch (qualityFilter) {
                    case "excellent": return s >= 70;
                    case "good": return s >= 40 && s < 70;
                    case "average": return s >= 20 && s < 40;
                    case "poor": return s < 20;
                    default: return true;
                }
            });
        }

        // Spam filter
        if (spamFilter !== "all") {
            domains = domains.filter((item) => {
                const s = item.avgSpamScore ?? 0;
                switch (spamFilter) {
                    case "clean": return s <= 10;
                    case "moderate": return s > 10 && s <= 30;
                    case "high": return s > 30;
                    default: return true;
                }
            });
        }

        // Domain Rank filter
        if (drFilter !== "all") {
            domains = domains.filter((item) => {
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
            domains = domains.filter((item) => {
                switch (linkCountFilter) {
                    case "1": return item.linkCount === 1;
                    case "2-5": return item.linkCount >= 2 && item.linkCount <= 5;
                    case "6-20": return item.linkCount >= 6 && item.linkCount <= 20;
                    case "20+": return item.linkCount > 20;
                    default: return true;
                }
            });
        }

        // Dofollow ratio filter
        if (dofollowRatioFilter !== "all") {
            domains = domains.filter((item) => {
                const dfPct = item.dofollowPercent;
                switch (dofollowRatioFilter) {
                    case "all_df": return dfPct === 100;
                    case "mostly_df": return dfPct > 75;
                    case "mixed": return dfPct >= 25 && dfPct <= 75;
                    case "mostly_nf": return dfPct < 25;
                    default: return true;
                }
            });
        }

        // Sort
        domains.sort((a, b) => {
            if (sortColumn === "domain") {
                return sortDirection === "asc" ? a.domain.localeCompare(b.domain) : b.domain.localeCompare(a.domain);
            }
            const aVal = (a[sortColumn] as number | null) ?? 0;
            const bVal = (b[sortColumn] as number | null) ?? 0;
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        });

        return domains;
    }, [data?.domains, search, qualityFilter, spamFilter, drFilter, linkCountFilter, dofollowRatioFilter, sortColumn, sortDirection]);

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
        setQualityFilter("all");
        setSpamFilter("all");
        setDrFilter("all");
        setLinkCountFilter("all");
        setDofollowRatioFilter("all");
        resetPage();
    }

    if (data === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-44 animate-pulse rounded bg-gray-100" />
                <div className="h-64 animate-pulse rounded bg-gray-50" />
            </div>
        );
    }

    if (!data || data.domains.length === 0) return null;

    return (
        <>
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Globe01 className="h-5 w-5 text-fg-brand-primary" />
                        <div>
                            <h3 className="text-md font-semibold text-primary">Referring Domains</h3>
                            <p className="text-sm text-tertiary">{data.totalDomains} unique domains linking to your site.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-tertiary">
                        {filteredData.length} domains
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-quaternary" />
                        <input
                            type="text"
                            placeholder="Search domains or anchors..."
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
                        Filters
                        {hasActiveFilters && !showFilters && (
                            <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-medium text-white">
                                {[qualityFilter !== "all", spamFilter !== "all", drFilter !== "all", linkCountFilter !== "all", dofollowRatioFilter !== "all"].filter(Boolean).length}
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
                            Columns
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
                            Clear
                        </button>
                    )}
                </div>

                {/* Filters row */}
                {showFilters && (
                    <div className="flex flex-wrap gap-3">
                        <FilterSelect label="Quality" value={qualityFilter} options={QUALITY_FILTERS} onChange={(v) => { setQualityFilter(v); resetPage(); }} />
                        <FilterSelect label="Spam Risk" value={spamFilter} options={SPAM_FILTERS} onChange={(v) => { setSpamFilter(v); resetPage(); }} />
                        <FilterSelect label="Domain Rank" value={drFilter} options={DR_FILTERS} onChange={(v) => { setDrFilter(v); resetPage(); }} />
                        <FilterSelect label="Link Count" value={linkCountFilter} options={LINK_COUNT_FILTERS} onChange={(v) => { setLinkCountFilter(v); resetPage(); }} />
                        <FilterSelect label="Dofollow" value={dofollowRatioFilter} options={DOFOLLOW_RATIO_FILTERS} onChange={(v) => { setDofollowRatioFilter(v); resetPage(); }} />
                    </div>
                )}

                {/* Table */}
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Globe01 className="h-8 w-8 text-fg-quaternary mb-3" />
                        <p className="text-sm font-medium text-primary mb-1">No domains match your filters</p>
                        <p className="text-xs text-tertiary text-center max-w-xs">
                            Try adjusting your search or filter criteria to see more results.
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
                                                <div className="flex items-center gap-1">Domain <SortIcon column="domain" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.linkCount && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("linkCount")}>
                                                <div className="flex items-center justify-end gap-1">Links <SortIcon column="linkCount" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.dofollow && (
                                            <th className="px-3 py-2.5 text-right font-medium text-tertiary">Dofollow</th>
                                        )}
                                        {columnVisibility.dofollowPercent && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("dofollowPercent")}>
                                                <div className="flex items-center justify-end gap-1">DF% <SortIcon column="dofollowPercent" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.domainRank && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("avgDomainRank")}>
                                                <div className="flex items-center justify-end gap-1">DR <SortIcon column="avgDomainRank" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.spamScore && (
                                            <th className="cursor-pointer px-3 py-2.5 text-right font-medium text-tertiary" onClick={() => handleSort("avgSpamScore")}>
                                                <div className="flex items-center justify-end gap-1">Spam <SortIcon column="avgSpamScore" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.quality && (
                                            <th className="cursor-pointer px-3 py-2.5 text-center font-medium text-tertiary" onClick={() => handleSort("qualityScore")}>
                                                <div className="flex items-center justify-center gap-1">Quality <SortIcon column="qualityScore" /></div>
                                            </th>
                                        )}
                                        {columnVisibility.topAnchors && (
                                            <th className="px-3 py-2.5 font-medium text-tertiary">Top Anchors</th>
                                        )}
                                        {columnVisibility.country && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">Country</th>
                                        )}
                                        {columnVisibility.firstSeen && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">First Seen</th>
                                        )}
                                        {columnVisibility.lastSeen && (
                                            <th className="px-3 py-2.5 text-center font-medium text-tertiary">Last Seen</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((item) => {
                                        const badge = getQualityBadge(item.qualityScore);
                                        return (
                                            <tr
                                                key={item.domain}
                                                className="border-b border-secondary last:border-0 hover:bg-primary_hover cursor-pointer"
                                                onClick={() => setSelectedDomain(item)}
                                            >
                                                {columnVisibility.domain && (
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-primary">{item.domain}</span>
                                                            {item.country && columnVisibility.domain && !columnVisibility.country && (
                                                                <span className="text-xs text-tertiary">{item.country}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {columnVisibility.linkCount && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{item.linkCount}</td>
                                                )}
                                                {columnVisibility.dofollow && (
                                                    <td className="px-3 py-2.5 text-right text-utility-success-600">{item.dofollow}</td>
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
                                                {columnVisibility.domainRank && (
                                                    <td className="px-3 py-2.5 text-right text-primary">{item.avgDomainRank || "—"}</td>
                                                )}
                                                {columnVisibility.spamScore && (
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className={(item.avgSpamScore ?? 0) > 30 ? "text-utility-error-600 font-medium" : "text-primary"}>
                                                            {item.avgSpamScore ?? "—"}
                                                        </span>
                                                    </td>
                                                )}
                                                {columnVisibility.quality && (
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                )}
                                                {columnVisibility.topAnchors && (
                                                    <td className="max-w-[200px] px-3 py-2.5">
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
                                                {columnVisibility.country && (
                                                    <td className="px-3 py-2.5 text-center text-sm text-tertiary">{item.country || "—"}</td>
                                                )}
                                                {columnVisibility.firstSeen && (
                                                    <td className="px-3 py-2.5 text-center text-xs text-tertiary">
                                                        {item.firstSeen ? new Date(item.firstSeen).toLocaleDateString() : "—"}
                                                    </td>
                                                )}
                                                {columnVisibility.lastSeen && (
                                                    <td className="px-3 py-2.5 text-center text-xs text-tertiary">
                                                        {item.lastSeen ? new Date(item.lastSeen).toLocaleDateString() : "—"}
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
                                    Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredData.length)} of {filteredData.length}
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
            <ReferringDomainDetailModal
                domain={selectedDomain}
                isOpen={selectedDomain !== null}
                onClose={() => setSelectedDomain(null)}
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
