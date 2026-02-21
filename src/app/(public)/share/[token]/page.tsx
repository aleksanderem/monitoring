"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAnalyticsQuery } from "@/hooks/useAnalyticsQuery";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StripedPattern } from "@/components/ui/striped-pattern";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { useDateRange } from "@/hooks/useDateRange";
import { cx } from "@/utils/cx";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import {
  SearchLg,
  ChevronUp,
  ChevronDown,
  ChevronSelectorVertical,
  ChevronLeft,
  ChevronRight,
  FilterLines,
  Settings01,
  Calendar,
} from "@untitledui/icons";

function getPositionBadgeClass(position: number | null): string {
  if (!position) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
  if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
  if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
  if (position <= 50) return "bg-utility-gray-50 text-utility-gray-600";
  return "bg-utility-gray-25 text-utility-gray-500";
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function PublicSharePage() {
  const t = useTranslations("share");
  usePageTitle("Share");
  const params = useParams();
  const token = params.token as string;

  const { dateRange, setDateRange } = useDateRange({ initialPreset: "1y" });

  const reportData = useQuery(api.reports.getPublicReportData, {
    token,
  });

  // Fetch historical chart data from Supabase via action
  const fromStr = dateRange.from.toISOString().split("T")[0];
  const toStr = dateRange.to.toISOString().split("T")[0];
  const { data: chartDataResult } = useAnalyticsQuery<{
    domains: Array<{
      domainId: string;
      chartData: Array<{ date: string; avgPosition: number; keywordCount: number }>;
    }>;
  }>(api.reports.getPublicReportChartData, { token, from: fromStr, to: toStr });

  // Loading state
  if (reportData === undefined) {
    return (
      <div className="dark-mode relative flex min-h-screen items-center justify-center bg-gray-950">
        <StripedPattern className="text-white/[0.03]" />
        <div className="relative z-10 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-white/40 border-r-transparent" />
          <p className="mt-4 text-sm text-gray-400">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // Not found
  if (reportData === null) {
    return (
      <div className="dark-mode relative flex min-h-screen items-center justify-center bg-gray-950">
        <StripedPattern className="text-white/[0.03]" />
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-800">
            <SearchLg className="h-6 w-6 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">{t("reportNotFound")}</h1>
          <p className="mt-2 text-sm text-gray-400">{t("reportNotFoundDescription")}</p>
        </div>
      </div>
    );
  }

  // Expired
  if ("expired" in reportData) {
    return (
      <div className="dark-mode relative flex min-h-screen items-center justify-center bg-gray-950">
        <StripedPattern className="text-white/[0.03]" />
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-800">
            <SearchLg className="h-6 w-6 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">{t("reportExpired")}</h1>
          <p className="mt-2 text-sm text-gray-400">{t("reportExpiredDescription")}</p>
        </div>
      </div>
    );
  }

  const rawDomain = reportData.domains[0];
  if (!rawDomain) return null;

  // Merge Supabase chart data if available, fall back to recentPositions-based chart from query
  const supabaseChart = chartDataResult?.domains?.find(
    (d) => d.domainId === rawDomain._id
  )?.chartData;
  const domain = {
    ...rawDomain,
    chartData: supabaseChart && supabaseChart.length > 0
      ? supabaseChart
      : rawDomain.chartData,
  };

  const orgLogoUrl = reportData.orgLogoUrl || null;

  return (
    <PublicReportView
      reportName={reportData.name}
      domain={domain}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      orgLogoUrl={orgLogoUrl}
    />
  );
}

interface DomainData {
  _id: string;
  domain: string;
  settings: { searchEngine: string; location: string; language: string };
  keywords: Array<{
    _id: string;
    phrase: string;
    position: number | null;
    previousPosition: number | null;
    change: number | null;
    url: string | null;
    searchVolume: number | null;
    difficulty: number | null;
    updatedAt: number | null;
  }>;
  chartData: Array<{
    date: string;
    avgPosition: number;
    keywordCount: number;
  }>;
  trackingSince: number | null;
}

type SortColumn = "phrase" | "position" | "change" | "volume" | "difficulty";
type SortDirection = "asc" | "desc";

interface ColumnVisibility {
  keyword: boolean;
  position: boolean;
  change: boolean;
  volume: boolean;
  difficulty: boolean;
  url: boolean;
}

function PublicReportView({
  reportName,
  domain,
  dateRange,
  onDateRangeChange,
  orgLogoUrl,
}: {
  reportName: string;
  domain: DomainData;
  dateRange: any;
  onDateRangeChange: (v: any) => void;
  orgLogoUrl: string | null;
}) {
  const t = useTranslations("share");

  // Table state
  const [sortColumn, setSortColumn] = useState<SortColumn>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [positionFilter, setPositionFilter] = useState<string>("all");

  const hasVolume = domain.keywords.some((k) => k.searchVolume !== null);
  const hasDifficulty = domain.keywords.some(
    (k) => k.difficulty !== null && Number.isFinite(k.difficulty),
  );

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    keyword: true,
    position: true,
    change: true,
    volume: hasVolume,
    difficulty: hasDifficulty,
    url: true,
  });

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const filteredKeywords = useMemo(() => {
    let kws = domain.keywords;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      kws = kws.filter((k) => k.phrase.toLowerCase().includes(q));
    }

    // Position filter
    if (positionFilter !== "all") {
      kws = kws.filter((k) => {
        const pos = k.position;
        if (pos === null) return positionFilter === "unknown";
        if (positionFilter === "top3") return pos <= 3;
        if (positionFilter === "top10") return pos <= 10;
        if (positionFilter === "top20") return pos <= 20;
        if (positionFilter === "top50") return pos <= 50;
        if (positionFilter === "below50") return pos > 50;
        return true;
      });
    }

    // Sort
    return kws.toSorted((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;
      switch (sortColumn) {
        case "phrase":
          aVal = a.phrase;
          bVal = b.phrase;
          break;
        case "position":
          aVal = a.position ?? 999;
          bVal = b.position ?? 999;
          break;
        case "change":
          aVal = a.change ?? 0;
          bVal = b.change ?? 0;
          break;
        case "volume":
          aVal = a.searchVolume ?? 0;
          bVal = b.searchVolume ?? 0;
          break;
        case "difficulty":
          aVal = a.difficulty ?? 999;
          bVal = b.difficulty ?? 999;
          break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDirection === "asc" ? diff : -diff;
    });
  }, [domain.keywords, searchQuery, positionFilter, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredKeywords.length / itemsPerPage);
  const paginatedKeywords = filteredKeywords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const stats = useMemo(() => {
    const positions = domain.keywords
      .map((k) => k.position)
      .filter((p): p is number => p !== null);
    const avg =
      positions.length > 0
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : null;
    const top3 = positions.filter((p) => p <= 3).length;
    const top10 = positions.filter((p) => p <= 10).length;
    const improved = domain.keywords.filter(
      (k) => k.change !== null && k.change > 0,
    ).length;
    const declined = domain.keywords.filter(
      (k) => k.change !== null && k.change < 0,
    ).length;
    return { avg, top3, top10, improved, declined, total: domain.keywords.length };
  }, [domain.keywords]);

  const trackingSinceFormatted = domain.trackingSince
    ? new Date(domain.trackingSince).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column)
      return <ChevronSelectorVertical className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  return (
    <div className="dark-mode relative min-h-screen bg-gray-950">
      <StripedPattern className="text-white/[0.03]" />
      {/* Subtle radial gradient — lighter center */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

      {/* Top header bar */}
      <header className="sticky top-0 z-30 border-b border-secondary bg-gray-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center">
            <img
              alt={orgLogoUrl ? "Company logo" : "DSE.O"}
              width="auto"
              height="50"
              decoding="async"
              src={orgLogoUrl || "/logo-white.svg"}
              className="max-h-[50px] max-w-[180px] object-contain"
              style={{ color: "transparent" }}
            />
          </div>
          <div className="flex items-center gap-3">
            {trackingSinceFormatted && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-tertiary" />
                <span className="text-xs text-tertiary">
                  {t("trackingSince")}{" "}
                  <span className="font-medium text-primary">
                    {trackingSinceFormatted}
                  </span>
                </span>
              </div>
            )}
            <DateRangePicker
              value={dateRange}
              onChange={onDateRangeChange}
              excludePresets={["7d", "30d"]}
            />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Domain info */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary">{domain.domain}</h1>
          <p className="mt-1 text-sm text-tertiary">{reportName}</p>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label={t("keywords")} value={stats.total} />
          <StatCard
            label={t("avgPosition")}
            value={stats.avg !== null ? stats.avg.toFixed(1) : "—"}
          />
          <StatCard label="Top 3" value={stats.top3} accent="success" />
          <StatCard label="Top 10" value={stats.top10} accent="success" />
          <StatCard
            label={t("change")}
            value={`↑${stats.improved} ↓${stats.declined}`}
          />
        </div>

        {/* Position history chart */}
        {domain.chartData.length > 0 && (
          <div className="relative mb-8 rounded-xl border border-secondary bg-primary p-6">
            <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <h2 className="mb-4 text-lg font-semibold text-primary">
              {t("positionHistory")}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={domain.chartData}>
                <defs>
                  <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#374151" }}
                />
                <YAxis
                  reversed
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#374151" }}
                  domain={["dataMin - 2", "dataMax + 2"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value) => [`${value}`, t("avgPosition")]}
                />
                <Area
                  type="monotone"
                  dataKey="avgPosition"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#posGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Keyword DataTable */}
        <div className="relative flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          {/* Table header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-primary">
                {t("keywords")}
              </h3>
              <p className="text-sm text-tertiary">
                {t("keywordsCount", { count: filteredKeywords.length })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-64">
                <Input
                  placeholder={t("searchKeywords")}
                  value={searchQuery}
                  onChange={(value) => {
                    setSearchQuery(value);
                    setCurrentPage(1);
                  }}
                  icon={SearchLg}
                />
              </div>

              <Button
                size="sm"
                color={showFilters ? "primary" : "secondary"}
                iconLeading={FilterLines}
                onClick={() => setShowFilters(!showFilters)}
              >
                {t("filters")}
              </Button>

              <div className="relative">
                <Button
                  size="sm"
                  color="secondary"
                  iconLeading={Settings01}
                  onClick={() => setShowColumnPicker(!showColumnPicker)}
                >
                  {t("columns")}
                </Button>
                {showColumnPicker && (
                  <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-secondary bg-primary p-2 shadow-lg">
                    <div className="flex flex-col gap-1">
                      {(
                        Object.entries(columnVisibility) as [
                          keyof ColumnVisibility,
                          boolean,
                        ][]
                      ).map(([key, value]) => (
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
                          <span className="text-primary capitalize">
                            {t(key === "keyword" ? "keyword" : key)}
                          </span>
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
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-secondary">
                  {t("position")}:
                </label>
                <select
                  value={positionFilter}
                  onChange={(e) => {
                    setPositionFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-secondary bg-primary px-3 py-1.5 text-sm text-primary"
                >
                  <option value="all">{t("filterAll")}</option>
                  <option value="top3">Top 3</option>
                  <option value="top10">Top 10</option>
                  <option value="top20">Top 20</option>
                  <option value="top50">Top 50</option>
                  <option value="below50">{t("filterBelow50")}</option>
                  <option value="unknown">{t("filterUnknown")}</option>
                </select>
              </div>

              {(positionFilter !== "all" || searchQuery) && (
                <Button
                  size="sm"
                  color="secondary"
                  onClick={() => {
                    setPositionFilter("all");
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                >
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  {columnVisibility.keyword && (
                    <th
                      className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                      onClick={() => toggleSort("phrase")}
                    >
                      <div className="flex items-center gap-2">
                        {t("keyword")}
                        <SortIcon column="phrase" />
                      </div>
                    </th>
                  )}
                  {columnVisibility.position && (
                    <th
                      className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                      onClick={() => toggleSort("position")}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {t("position")}
                        <SortIcon column="position" />
                      </div>
                    </th>
                  )}
                  {columnVisibility.change && (
                    <th
                      className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                      onClick={() => toggleSort("change")}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {t("change")}
                        <SortIcon column="change" />
                      </div>
                    </th>
                  )}
                  {columnVisibility.volume && hasVolume && (
                    <th
                      className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                      onClick={() => toggleSort("volume")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {t("volume")}
                        <SortIcon column="volume" />
                      </div>
                    </th>
                  )}
                  {columnVisibility.difficulty && hasDifficulty && (
                    <th
                      className="cursor-pointer px-4 py-3 text-center text-xs font-medium text-tertiary transition-colors hover:bg-secondary/70"
                      onClick={() => toggleSort("difficulty")}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {t("difficulty")}
                        <SortIcon column="difficulty" />
                      </div>
                    </th>
                  )}
                  {columnVisibility.url && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">
                      {t("url")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {paginatedKeywords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-tertiary"
                    >
                      {t("noKeywords")}
                    </td>
                  </tr>
                ) : (
                  paginatedKeywords.map((keyword) => (
                    <tr
                      key={keyword._id}
                      className="transition-colors hover:bg-primary_hover"
                    >
                      {columnVisibility.keyword && (
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-primary">
                            {keyword.phrase}
                          </span>
                        </td>
                      )}
                      {columnVisibility.position && (
                        <td className="px-4 py-3 text-center">
                          {keyword.position !== null ? (
                            <span
                              className={cx(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                getPositionBadgeClass(keyword.position),
                              )}
                            >
                              {keyword.position}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.change && (
                        <td className="px-4 py-3 text-center">
                          {keyword.change !== null && keyword.change !== 0 ? (
                            <span
                              className={cx(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                keyword.change > 0
                                  ? "bg-utility-success-50 text-utility-success-700"
                                  : "bg-utility-error-50 text-utility-error-700",
                              )}
                            >
                              {keyword.change > 0 ? "↑" : "↓"}{" "}
                              {Math.abs(keyword.change)}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.volume && hasVolume && (
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {formatNumber(keyword.searchVolume)}
                        </td>
                      )}
                      {columnVisibility.difficulty && hasDifficulty && (
                        <td className="px-4 py-3 text-center">
                          {keyword.difficulty !== null &&
                          Number.isFinite(keyword.difficulty) ? (
                            <span
                              className={cx(
                                "text-sm font-medium",
                                keyword.difficulty < 30
                                  ? "text-utility-success-600"
                                  : keyword.difficulty < 70
                                    ? "text-utility-warning-600"
                                    : "text-utility-error-600",
                              )}
                            >
                              {keyword.difficulty}
                            </span>
                          ) : (
                            <span className="text-xs text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      {columnVisibility.url && (
                        <td className="max-w-[200px] truncate px-4 py-3 text-sm text-tertiary">
                          {keyword.url || "—"}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-secondary pt-4">
              <p className="text-sm text-secondary">
                {t("paginationInfo", {
                  current: currentPage,
                  total: totalPages,
                  count: filteredKeywords.length,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  color="secondary"
                  iconLeading={ChevronLeft}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t("previous")}
                </Button>
                <Button
                  size="sm"
                  color="secondary"
                  iconTrailing={ChevronRight}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-3 text-sm text-quaternary">
          <span>{t("poweredBy")}</span>
          <img alt="DSE.O" width="auto" height="32" decoding="async" src="/logo-white.svg" style={{ color: "transparent" }} />
          <span className="text-quaternary/40">|</span>
          <img alt="alexem" height="37" decoding="async" src="https://v5w1.c17.e2-5.dev/alexem/overgrossly_spectropolariscope_uncontrol.svg" style={{ color: "transparent", height: "37px" }} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success";
}) {
  return (
    <div className="relative rounded-xl border border-secondary bg-primary px-4 py-3">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <p className="text-xs text-tertiary">{label}</p>
      <p
        className={cx(
          "mt-1 text-xl font-semibold",
          accent === "success" ? "text-utility-success-500" : "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
