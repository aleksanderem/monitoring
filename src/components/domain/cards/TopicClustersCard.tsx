"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import {
    ChevronUp,
    ChevronDown,
    ChevronSelectorVertical,
    SearchLg,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    Settings01,
    FilterLines,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { TopicClusterDetailModal } from "../modals/TopicClusterDetailModal";
import { formatNumber } from "@/lib/formatting";

interface TopicClustersCardProps {
    domainId: Id<"domains">;
}

type SortColumn = "topic" | "gapCount" | "avgOpportunityScore" | "totalSearchVolume" | "avgDifficulty" | "totalEstimatedValue";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
    keywords: boolean;
    avgScore: boolean;
    totalVolume: boolean;
    avgDifficulty: boolean;
    estTraffic: boolean;
}

const COLUMN_LABEL_KEYS: Record<keyof ColumnVisibility, string> = {
    keywords: "columnKeywordsLabel",
    avgScore: "columnAvgScore",
    totalVolume: "columnTotalVolume",
    avgDifficulty: "columnAvgDifficulty",
    estTraffic: "columnEstTraffic",
};

function getDifficultyBadge(d: number): { color: "success" | "warning" | "orange" | "error"; labelKey: string } {
    if (d < 30) return { color: "success", labelKey: "difficultyLabelEasy" };
    if (d < 50) return { color: "warning", labelKey: "difficultyLabelModerate" };
    if (d < 70) return { color: "orange", labelKey: "difficultyLabelHard" };
    return { color: "error", labelKey: "difficultyLabelVeryHard" };
}

function getScoreBadgeColor(score: number): "success" | "warning" | "gray" {
    if (score >= 70) return "success";
    if (score >= 40) return "warning";
    return "gray";
}

const COLUMN_TOOLTIP_KEYS: Record<string, { titleKey: string; descriptionKey: string }> = {
    topic: {
        titleKey: "tooltipTopicTitle",
        descriptionKey: "tooltipTopicDescription",
    },
    gapCount: {
        titleKey: "tooltipKeywordsTitle",
        descriptionKey: "tooltipKeywordsDescription",
    },
    avgOpportunityScore: {
        titleKey: "tooltipAvgScoreTitle",
        descriptionKey: "tooltipAvgScoreDescription",
    },
    totalSearchVolume: {
        titleKey: "tooltipTotalVolumeTitle",
        descriptionKey: "tooltipTotalVolumeDescription",
    },
    avgDifficulty: {
        titleKey: "tooltipAvgDifficultyTitle",
        descriptionKey: "tooltipAvgDifficultyDescription",
    },
    totalEstimatedValue: {
        titleKey: "tooltipEstTrafficTitle",
        descriptionKey: "tooltipEstTrafficDescription",
    },
};

function SortIcon({ column, sortColumn, sortDirection }: { column: SortColumn; sortColumn: SortColumn; sortDirection: SortDirection }) {
    if (column !== sortColumn) {
        return <ChevronSelectorVertical className="h-3.5 w-3.5 text-quaternary" />;
    }
    return sortDirection === "asc"
        ? <ChevronUp className="h-3.5 w-3.5 text-brand-600" />
        : <ChevronDown className="h-3.5 w-3.5 text-brand-600" />;
}

export function TopicClustersCard({ domainId }: TopicClustersCardProps) {
    const t = useTranslations('keywords');
    const tc = useTranslations('common');
    const clusters = useQuery(api.contentGaps_queries.getTopicClusters, { domainId });

    const [sortColumn, setSortColumn] = useState<SortColumn>("totalEstimatedValue");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCluster, setSelectedCluster] = useState<any | null>(null);
    const itemsPerPage = 15;

    // UI toggles
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Filter states
    const [difficultyMin, setDifficultyMin] = useState<string>("");
    const [difficultyMax, setDifficultyMax] = useState<string>("");
    const [scoreMin, setScoreMin] = useState<string>("");
    const [scoreMax, setScoreMax] = useState<string>("");
    const [minKeywords, setMinKeywords] = useState<string>("");

    // Column visibility - persisted to localStorage
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("topicClusters_columnVisibility");
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch {
                    // use defaults
                }
            }
        }
        return {
            keywords: true,
            avgScore: true,
            totalVolume: true,
            avgDifficulty: true,
            estTraffic: true,
        };
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("topicClusters_columnVisibility", JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    const toggleColumn = (column: keyof ColumnVisibility) => {
        setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    function toggleSort(col: SortColumn) {
        if (sortColumn === col) {
            setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortColumn(col);
            setSortDirection("desc");
        }
        setCurrentPage(1);
    }

    const hasActiveFilters =
        difficultyMin !== "" ||
        difficultyMax !== "" ||
        scoreMin !== "" ||
        scoreMax !== "" ||
        minKeywords !== "" ||
        searchQuery !== "";

    const clearAllFilters = () => {
        setDifficultyMin("");
        setDifficultyMax("");
        setScoreMin("");
        setScoreMax("");
        setMinKeywords("");
        setSearchQuery("");
        setCurrentPage(1);
    };

    const filteredAndSorted = useMemo(() => {
        if (!clusters) return [];

        let filtered = clusters;

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter((c) =>
                c.topic.toLowerCase().includes(q) ||
                c.topKeywords.some((kw) => kw.toLowerCase().includes(q))
            );
        }

        // Filters
        if (difficultyMin) {
            const min = Number(difficultyMin);
            filtered = filtered.filter((c) => c.avgDifficulty >= min);
        }
        if (difficultyMax) {
            const max = Number(difficultyMax);
            filtered = filtered.filter((c) => c.avgDifficulty <= max);
        }
        if (scoreMin) {
            const min = Number(scoreMin);
            filtered = filtered.filter((c) => c.avgOpportunityScore >= min);
        }
        if (scoreMax) {
            const max = Number(scoreMax);
            filtered = filtered.filter((c) => c.avgOpportunityScore <= max);
        }
        if (minKeywords) {
            const min = Number(minKeywords);
            filtered = filtered.filter((c) => c.gapCount >= min);
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: number | string = 0;
            let bVal: number | string = 0;
            switch (sortColumn) {
                case "topic":
                    aVal = a.topic.toLowerCase();
                    bVal = b.topic.toLowerCase();
                    break;
                case "gapCount":
                    aVal = a.gapCount;
                    bVal = b.gapCount;
                    break;
                case "avgOpportunityScore":
                    aVal = a.avgOpportunityScore;
                    bVal = b.avgOpportunityScore;
                    break;
                case "totalSearchVolume":
                    aVal = a.totalSearchVolume;
                    bVal = b.totalSearchVolume;
                    break;
                case "avgDifficulty":
                    aVal = a.avgDifficulty;
                    bVal = b.avgDifficulty;
                    break;
                case "totalEstimatedValue":
                    aVal = a.totalEstimatedValue;
                    bVal = b.totalEstimatedValue;
                    break;
            }
            if (typeof aVal === "string" && typeof bVal === "string") {
                return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        });

        return sorted;
    }, [clusters, searchQuery, sortColumn, sortDirection, difficultyMin, difficultyMax, scoreMin, scoreMax, minKeywords]);

    const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
    const paginatedData = filteredAndSorted.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Loading
    if (clusters === undefined) {
        return (
            <div className="relative rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700 mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
                    ))}
                </div>
            </div>
        );
    }

    // Empty
    if (!clusters || clusters.length === 0) {
        return (
            <div className="relative rounded-xl border border-secondary bg-primary p-6">
                <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-md font-semibold text-primary">{t('topicClusters')}</h3>
                    <Tooltip title={t('topicClusters')} description={t('topicClustersTooltip')}>
                        <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                            <HelpCircle className="size-4" />
                        </TooltipTrigger>
                    </Tooltip>
                </div>
                <div className="flex h-32 items-center justify-center">
                    <p className="text-sm text-tertiary">{t('noClustersFound')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative rounded-xl border border-secondary bg-primary">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            {/* Toolbar */}
            <div className="border-b border-secondary p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-md font-semibold text-primary">{t('topicClusters')}</h3>
                            <Tooltip title={t('topicClusters')} description={t('topicClustersTooltip')}>
                                <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                    <HelpCircle className="size-4" />
                                </TooltipTrigger>
                            </Tooltip>
                            <Badge color="gray" size="sm">{filteredAndSorted.length}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-tertiary">
                            {t('topicClustersDescription')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative w-full sm:w-64">
                            <SearchLg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-quaternary" />
                            <input
                                type="text"
                                placeholder={t('searchClustersPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="h-9 w-full rounded-lg border border-secondary bg-primary pl-9 pr-3 text-sm text-primary placeholder:text-quaternary focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                            />
                        </div>

                        {/* Filters toggle */}
                        <Button
                            size="sm"
                            color={showFilters ? "primary" : "secondary"}
                            iconLeading={FilterLines}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            {t('filters')}{hasActiveFilters ? ` (${t('active')})` : ""}
                        </Button>

                        {/* Column picker */}
                        <div className="relative">
                            <Button
                                size="sm"
                                color="secondary"
                                iconLeading={Settings01}
                                onClick={() => setShowColumnPicker(!showColumnPicker)}
                            >
                                {tc('columns')}
                            </Button>
                            {showColumnPicker && (
                                <div className="absolute right-0 top-full z-10 mt-2 w-52 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
                                    <div className="flex flex-col gap-1">
                                        {(Object.entries(columnVisibility) as [keyof ColumnVisibility, boolean][]).map(
                                            ([key, value]) => (
                                                <label
                                                    key={key}
                                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-secondary/50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={value}
                                                        onChange={() => toggleColumn(key)}
                                                        className="h-4 w-4 rounded border-gray-300"
                                                    />
                                                    <span className="text-primary">{t(COLUMN_LABEL_KEYS[key])}</span>
                                                </label>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters panel */}
                {showFilters && (
                    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-secondary/30 p-4">
                        {/* Difficulty range */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-secondary">{t('filterDifficulty')}:</label>
                            <select
                                value={difficultyMin}
                                onChange={(e) => { setDifficultyMin(e.target.value); setCurrentPage(1); }}
                                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
                            >
                                <option value="">{t('filterMin')}</option>
                                {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                            <span className="text-tertiary">—</span>
                            <select
                                value={difficultyMax}
                                onChange={(e) => { setDifficultyMax(e.target.value); setCurrentPage(1); }}
                                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
                            >
                                <option value="">{t('filterMax')}</option>
                                {[10, 20, 30, 40, 50, 60, 70, 80, 100].map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>

                        {/* Score range */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-secondary">{t('filterAvgScore')}:</label>
                            <select
                                value={scoreMin}
                                onChange={(e) => { setScoreMin(e.target.value); setCurrentPage(1); }}
                                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
                            >
                                <option value="">{t('filterMin')}</option>
                                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                            <span className="text-tertiary">—</span>
                            <select
                                value={scoreMax}
                                onChange={(e) => { setScoreMax(e.target.value); setCurrentPage(1); }}
                                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
                            >
                                <option value="">{t('filterMax')}</option>
                                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>

                        {/* Min keywords */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-secondary">{t('filterMinKeywords')}:</label>
                            <select
                                value={minKeywords}
                                onChange={(e) => { setMinKeywords(e.target.value); setCurrentPage(1); }}
                                className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
                            >
                                <option value="">{t('filterAny')}</option>
                                {[2, 3, 5, 10, 15, 20].map((v) => (
                                    <option key={v} value={v}>{v}+</option>
                                ))}
                            </select>
                        </div>

                        {/* Clear all */}
                        {hasActiveFilters && (
                            <Button size="sm" color="secondary" onClick={clearAllFilters}>
                                {t('clearAll')}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-secondary bg-secondary/30">
                            {/* Topic - always visible */}
                            <th
                                className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-tertiary hover:text-secondary"
                                onClick={() => toggleSort("topic")}
                            >
                                <div className="flex items-center gap-1">
                                    <span>{t(COLUMN_TOOLTIP_KEYS.topic.titleKey)}</span>
                                    <Tooltip title={t(COLUMN_TOOLTIP_KEYS.topic.titleKey)} description={t(COLUMN_TOOLTIP_KEYS.topic.descriptionKey)}>
                                        <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                            <HelpCircle className="size-3.5" />
                                        </TooltipTrigger>
                                    </Tooltip>
                                    <SortIcon column="topic" sortColumn={sortColumn} sortDirection={sortDirection} />
                                </div>
                            </th>
                            {columnVisibility.keywords && (
                                <th
                                    className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-tertiary hover:text-secondary"
                                    onClick={() => toggleSort("gapCount")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>{t(COLUMN_TOOLTIP_KEYS.gapCount.titleKey)}</span>
                                        <Tooltip title={t(COLUMN_TOOLTIP_KEYS.gapCount.titleKey)} description={t(COLUMN_TOOLTIP_KEYS.gapCount.descriptionKey)}>
                                            <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                                <HelpCircle className="size-3.5" />
                                            </TooltipTrigger>
                                        </Tooltip>
                                        <SortIcon column="gapCount" sortColumn={sortColumn} sortDirection={sortDirection} />
                                    </div>
                                </th>
                            )}
                            {columnVisibility.avgScore && (
                                <th
                                    className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-tertiary hover:text-secondary"
                                    onClick={() => toggleSort("avgOpportunityScore")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>{t(COLUMN_TOOLTIP_KEYS.avgOpportunityScore.titleKey)}</span>
                                        <Tooltip title={t(COLUMN_TOOLTIP_KEYS.avgOpportunityScore.titleKey)} description={t(COLUMN_TOOLTIP_KEYS.avgOpportunityScore.descriptionKey)}>
                                            <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                                <HelpCircle className="size-3.5" />
                                            </TooltipTrigger>
                                        </Tooltip>
                                        <SortIcon column="avgOpportunityScore" sortColumn={sortColumn} sortDirection={sortDirection} />
                                    </div>
                                </th>
                            )}
                            {columnVisibility.totalVolume && (
                                <th
                                    className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-tertiary hover:text-secondary"
                                    onClick={() => toggleSort("totalSearchVolume")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>{t(COLUMN_TOOLTIP_KEYS.totalSearchVolume.titleKey)}</span>
                                        <Tooltip title={t(COLUMN_TOOLTIP_KEYS.totalSearchVolume.titleKey)} description={t(COLUMN_TOOLTIP_KEYS.totalSearchVolume.descriptionKey)}>
                                            <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                                <HelpCircle className="size-3.5" />
                                            </TooltipTrigger>
                                        </Tooltip>
                                        <SortIcon column="totalSearchVolume" sortColumn={sortColumn} sortDirection={sortDirection} />
                                    </div>
                                </th>
                            )}
                            {columnVisibility.avgDifficulty && (
                                <th
                                    className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-tertiary hover:text-secondary"
                                    onClick={() => toggleSort("avgDifficulty")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>{t(COLUMN_TOOLTIP_KEYS.avgDifficulty.titleKey)}</span>
                                        <Tooltip title={t(COLUMN_TOOLTIP_KEYS.avgDifficulty.titleKey)} description={t(COLUMN_TOOLTIP_KEYS.avgDifficulty.descriptionKey)}>
                                            <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                                <HelpCircle className="size-3.5" />
                                            </TooltipTrigger>
                                        </Tooltip>
                                        <SortIcon column="avgDifficulty" sortColumn={sortColumn} sortDirection={sortDirection} />
                                    </div>
                                </th>
                            )}
                            {columnVisibility.estTraffic && (
                                <th
                                    className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-tertiary hover:text-secondary"
                                    onClick={() => toggleSort("totalEstimatedValue")}
                                >
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>{t(COLUMN_TOOLTIP_KEYS.totalEstimatedValue.titleKey)}</span>
                                        <Tooltip title={t(COLUMN_TOOLTIP_KEYS.totalEstimatedValue.titleKey)} description={t(COLUMN_TOOLTIP_KEYS.totalEstimatedValue.descriptionKey)}>
                                            <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                                                <HelpCircle className="size-3.5" />
                                            </TooltipTrigger>
                                        </Tooltip>
                                        <SortIcon column="totalEstimatedValue" sortColumn={sortColumn} sortDirection={sortDirection} />
                                    </div>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary">
                        {paginatedData.map((cluster) => {
                            const diffBadge = getDifficultyBadge(cluster.avgDifficulty);
                            return (
                                <tr
                                    key={cluster.topic}
                                    className="cursor-pointer transition-colors hover:bg-primary_hover"
                                    onClick={() => setSelectedCluster(cluster)}
                                >
                                    <td className="px-4 py-3">
                                        <div>
                                            <span className="font-medium text-primary">{cluster.topic}</span>
                                            <div className="mt-0.5 flex flex-wrap gap-1">
                                                {cluster.topKeywords.slice(0, 3).map((kw, i) => (
                                                    <Badge key={i} color="blue" size="sm">
                                                        {kw}
                                                    </Badge>
                                                ))}
                                                {cluster.gapCount > 3 && (
                                                    <span className="text-xs text-quaternary">{t('plusMore', { count: cluster.gapCount - 3 })}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {columnVisibility.keywords && (
                                        <td className="px-4 py-3 text-right text-secondary">{cluster.gapCount}</td>
                                    )}
                                    {columnVisibility.avgScore && (
                                        <td className="px-4 py-3 text-right">
                                            <Badge color={getScoreBadgeColor(cluster.avgOpportunityScore)} size="sm">
                                                {Math.round(cluster.avgOpportunityScore)}
                                            </Badge>
                                        </td>
                                    )}
                                    {columnVisibility.totalVolume && (
                                        <td className="px-4 py-3 text-right text-secondary">{formatNumber(cluster.totalSearchVolume)}</td>
                                    )}
                                    {columnVisibility.avgDifficulty && (
                                        <td className="px-4 py-3 text-right">
                                            <Badge color={diffBadge.color} size="sm">
                                                {cluster.avgDifficulty} — {t(diffBadge.labelKey)}
                                            </Badge>
                                        </td>
                                    )}
                                    {columnVisibility.estTraffic && (
                                        <td className="px-4 py-3 text-right font-medium text-primary">{formatNumber(cluster.totalEstimatedValue)}</td>
                                    )}
                                </tr>
                            );
                        })}
                        {paginatedData.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-tertiary">
                                    {hasActiveFilters
                                        ? t('noClustersMatchFilters')
                                        : t('noClustersMatchSearch')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-secondary px-4 py-3">
                    <span className="text-xs text-tertiary">
                        {t('paginationClusters', { current: currentPage, total: totalPages, count: filteredAndSorted.length })}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="rounded-md p-1.5 text-fg-quaternary hover:bg-primary_hover disabled:opacity-40"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-md p-1.5 text-fg-quaternary hover:bg-primary_hover disabled:opacity-40"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedCluster && (
                <TopicClusterDetailModal
                    cluster={selectedCluster}
                    onClose={() => setSelectedCluster(null)}
                />
            )}
        </div>
    );
}
