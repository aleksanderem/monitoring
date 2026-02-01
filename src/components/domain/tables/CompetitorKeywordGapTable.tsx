"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { Input } from "@/components/base/input/input";
import { Plus, ChevronSelectorVertical, SearchLg } from "@untitledui/icons";
import { toast } from "sonner";

interface CompetitorKeywordGapTableProps {
  domainId: Id<"domains">;
}

export function CompetitorKeywordGapTable({ domainId }: CompetitorKeywordGapTableProps) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<Id<"competitors"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"gapScore" | "volume" | "difficulty">("gapScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const competitors = useQuery(api.queries.competitors.getCompetitorsByDomain, { domainId });
  const gaps = useQuery(
    api.queries.competitors.getCompetitorKeywordGaps,
    selectedCompetitor
      ? {
          domainId,
          competitorId: selectedCompetitor,
          minPosition: 20,
          maxOwnPosition: 50,
        }
      : "skip"
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

  const getScoreBadgeColor = (score: number): "success" | "warning" | "gray" => {
    if (score >= 70) return "success"; // High opportunity - green
    if (score >= 40) return "warning"; // Medium opportunity - yellow
    return "gray"; // Low opportunity - gray
  };

  // Transform competitors to SelectItemType format
  const competitorItems: SelectItemType[] = competitors
    ?.filter((competitor) => competitor && competitor._id)
    .map((competitor) => ({
      id: competitor._id,
      label: competitor.name || competitor.competitorDomain,
    })) || [];

  const isLoadingCompetitors = competitors === undefined;
  const isLoadingGaps = selectedCompetitor !== null && gaps === undefined;

  if (isLoadingCompetitors) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-8 text-tertiary">Loading...</div>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-12">
          <p className="text-tertiary mb-4">No competitors added yet</p>
          <p className="text-sm text-quaternary">
            Add competitors to discover keyword opportunities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-primary">Keyword Gap Analysis</h3>
        <p className="text-sm text-tertiary">
          Find keywords your competitors rank for that you don&apos;t
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-[250px]">
          <Select
            items={competitorItems}
            selectedKey={selectedCompetitor || null}
            onSelectionChange={(key) => setSelectedCompetitor(key as Id<"competitors">)}
            placeholder="Select competitor"
            size="md"
          >
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        </div>

        <div className="flex-1">
          <Input
            placeholder="Search keywords..."
            value={searchQuery}
            onChange={(value: string) => setSearchQuery(value)}
            icon={SearchLg}
            size="md"
          />
        </div>
      </div>

      {!selectedCompetitor ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary">Select a competitor to view keyword gaps</p>
        </div>
      ) : isLoadingGaps ? (
        <div className="text-center py-8 text-tertiary">Loading keyword gaps...</div>
      ) : filteredGaps && filteredGaps.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary">
            No keyword gaps found
            {searchQuery && " matching your search"}
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-tertiary">
            Found {filteredGaps?.length} keyword opportunities
          </div>

          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">
                    Keyword
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    Competitor Position
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    Your Position
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-tertiary">
                    Gap
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => toggleSort("volume")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Volume
                      <ChevronSelectorVertical className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => toggleSort("difficulty")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Difficulty
                      <ChevronSelectorVertical className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-tertiary cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => toggleSort("gapScore")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Opportunity Score
                      <ChevronSelectorVertical className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {filteredGaps?.map((gap) => (
                  <tr key={gap.keywordId} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary">{gap.phrase}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge color="gray" size="sm">#{gap.competitorPosition}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {gap.ourPosition ? (
                        <Badge color="gray-blue" size="sm">#{gap.ourPosition}</Badge>
                      ) : (
                        <span className="text-tertiary text-sm">Not ranking</span>
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
                        <span className="text-sm text-tertiary">—</span>
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
                        onClick={() => {
                          // TODO: Implement add to monitoring
                          toast.info("Bulk actions will be available soon");
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
