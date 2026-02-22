"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAnalyticsQuery } from "@/hooks/useAnalyticsQuery";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { Input } from "@/components/base/input/input";
import { Plus, ChevronSelectorVertical, SearchLg } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/patterns/BulkActionBar";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface CompetitorKeywordGapTableProps {
  domainId: Id<"domains">;
}

export function CompetitorKeywordGapTable({ domainId }: CompetitorKeywordGapTableProps) {
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const [selectedCompetitor, setSelectedCompetitor] = useState<Id<"competitors"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"gapScore" | "volume" | "difficulty">("gapScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const addKeywords = useMutation(api.keywords.addKeywords);
  const refreshPositions = useMutation(api.keywords.refreshKeywordPositions);
  const [addingKeywords, setAddingKeywords] = useState<Set<string>>(new Set());
  const selection = useRowSelection();

  const { data: competitors } = useAnalyticsQuery<Array<{
    _id: Id<"competitors">;
    competitorDomain: string;
    name: string;
    status: string;
    keywordCount: number;
    avgPosition: number | null;
    lastChecked: number | undefined;
    createdAt: number;
  }>>(api.queries.competitors.getCompetitorsByDomain, { domainId });
  const { data: gaps } = useAnalyticsQuery<Array<{
    keywordId: string;
    phrase: string;
    competitorPosition: number;
    competitorUrl: string | null;
    ourPosition: number | null;
    gap: number;
    searchVolume: number | undefined;
    difficulty: number | undefined;
    gapScore: number;
  }>>(
    api.queries.competitors.getCompetitorKeywordGaps,
    {
      domainId,
      competitorId: selectedCompetitor!,
      minPosition: 20,
      maxOwnPosition: 50,
    },
    { enabled: !!selectedCompetitor }
  );

  // Filter and sort gaps
  const filteredGaps = gaps
    ?.filter((gap) => {
      if (!searchQuery) return true;
      return gap.phrase.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const multiplier = sortOrder === "asc" ? 1 : -1;
      switch (sortBy) {
        case "gapScore":
          return (a.gapScore - b.gapScore) * multiplier;
        case "volume":
          return ((a.searchVolume || 0) - (b.searchVolume || 0)) * multiplier;
        case "difficulty":
          return ((a.difficulty || 0) - (b.difficulty || 0)) * multiplier;
        default:
          return 0;
      }
    });

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const visibleIds = useMemo(
    () => (filteredGaps ?? []).map((g) => g.keywordId),
    [filteredGaps]
  );

  const getScoreBadgeColor = (score: number): "success" | "warning" | "gray" => {
    if (score >= 70) return "success"; // High opportunity - green
    if (score >= 40) return "warning"; // Medium opportunity - yellow
    return "gray"; // Low opportunity - gray
  };

  // Only show active competitors
  const activeCompetitors = competitors?.filter(c => c.status === "active") ?? [];

  // Transform competitors to SelectItemType format
  const competitorItems: SelectItemType[] = activeCompetitors
    .map((competitor) => ({
      id: competitor._id,
      label: competitor.name || competitor.competitorDomain,
    }));

  const isLoadingCompetitors = competitors === undefined;
  const isLoadingGaps = selectedCompetitor !== null && gaps === undefined;

  if (isLoadingCompetitors) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="text-center py-8 text-tertiary">{t('keywordGapLoading')}</div>
      </div>
    );
  }

  if (activeCompetitors.length === 0) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="text-center py-12">
          <p className="text-tertiary mb-4">{t('keywordGapNoCompetitors')}</p>
          <p className="text-sm text-quaternary">
            {t('keywordGapNoCompetitorsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6 space-y-4">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div>
        <h3 className="text-lg font-semibold text-primary">{t('keywordGapTitle')}</h3>
        <p className="text-sm text-tertiary">
          {t('keywordGapSubtitle')}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-[250px]">
          <Select
            items={competitorItems}
            selectedKey={selectedCompetitor || null}
            onSelectionChange={(key) => setSelectedCompetitor(key as Id<"competitors">)}
            placeholder={t('keywordGapSelectCompetitor')}
            size="md"
          >
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        </div>

        <div className="flex-1">
          <Input
            placeholder={t('keywordGapSearchKeywords')}
            value={searchQuery}
            onChange={(value: string) => setSearchQuery(value)}
            icon={SearchLg}
            size="md"
          />
        </div>
      </div>

      {!selectedCompetitor ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary">{t('keywordGapSelectPrompt')}</p>
        </div>
      ) : isLoadingGaps ? (
        <div className="text-center py-8 text-tertiary">{t('keywordGapLoading')}</div>
      ) : filteredGaps && filteredGaps.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary">
            {t('keywordGapEmpty')}
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-tertiary">
            {filteredGaps?.length} {t('keywordGapTitle')}
          </div>

          {selection.count > 0 && (
            <BulkActionBar
              selectedCount={selection.count}
              selectedIds={selection.selectedIds}
              onClearSelection={selection.clear}
              actions={[
                {
                  label: tc('bulkAddToMonitoring'),
                  icon: Plus,
                  onClick: async () => {
                    const phrases = (filteredGaps ?? [])
                      .filter((g) => selection.selectedIds.has(g.keywordId))
                      .map((g) => g.phrase);
                    if (phrases.length === 0) return;
                    try {
                      const ids = await addKeywords({ domainId, phrases });
                      if (ids && ids.length > 0) {
                        await refreshPositions({ keywordIds: ids });
                      }
                      toast.success(tc('bulkActionSuccess', { count: phrases.length }));
                      selection.clear();
                    } catch {
                      toast.error(tc('bulkActionFailed'));
                    }
                  },
                },
              ]}
            />
          )}

          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={selection.isAllSelected(visibleIds)}
                      ref={(el) => { if (el) el.indeterminate = selection.isIndeterminate(visibleIds); }}
                      onChange={() => selection.toggleAll(visibleIds)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">
                    {t('columnKeyword')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnCompPosition')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnYourPosition')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    {t('columnOverlap')}
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => toggleSort("volume")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {t('columnSearchVolume')}
                      <ChevronSelectorVertical className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => toggleSort("difficulty")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {t('columnDifficulty')}
                      <ChevronSelectorVertical className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => toggleSort("gapScore")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {t('columnOpportunityScore')}
                      <ChevronSelectorVertical className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    {t('columnActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {filteredGaps?.map((gap) => (
                  <tr key={gap.keywordId} className="hover:bg-primary_hover transition-colors">
                    <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={selection.isSelected(gap.keywordId)}
                        onChange={() => selection.toggle(gap.keywordId)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">{gap.phrase}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge color="gray" size="sm">#{gap.competitorPosition}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {gap.ourPosition ? (
                        <Badge color="gray-blue" size="sm">#{gap.ourPosition}</Badge>
                      ) : (
                        <span className="text-tertiary text-sm">{t('keywordGapNotRanking')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge color="error" size="sm">
                        +{!isNaN(gap.gap) ? Math.round(gap.gap) : "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-primary">
                      {gap.searchVolume?.toLocaleString() || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {gap.difficulty !== undefined && !isNaN(gap.difficulty) ? (
                        <Badge
                          color={
                            gap.difficulty > 70
                              ? "error"
                              : gap.difficulty > 40
                              ? "warning"
                              : "success"
                          }
                          size="sm"
                        >
                          {Math.round(gap.difficulty)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-tertiary" title={tc('notAvailable')}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={getScoreBadgeColor(gap.gapScore)} size="sm">
                        {!isNaN(gap.gapScore) ? Math.round(gap.gapScore * 10) / 10 : "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        color="tertiary"
                        size="sm"
                        iconLeading={Plus}
                        isLoading={addingKeywords.has(gap.phrase)}
                        isDisabled={addingKeywords.has(gap.phrase)}
                        onClick={async () => {
                          setAddingKeywords(prev => new Set(prev).add(gap.phrase));
                          try {
                            const ids = await addKeywords({ domainId, phrases: [gap.phrase] });
                            if (ids && ids.length > 0) {
                              await refreshPositions({ keywordIds: ids });
                            }
                            toast.success(tc('bulkActionSuccess', { count: 1 }));
                          } catch {
                            toast.error(tc('bulkActionFailed'));
                          } finally {
                            setAddingKeywords(prev => { const next = new Set(prev); next.delete(gap.phrase); return next; });
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
