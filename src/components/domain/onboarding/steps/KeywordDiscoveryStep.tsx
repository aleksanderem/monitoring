"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { SearchLg, Stars01, ArrowRight } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";

interface KeywordDiscoveryStepProps {
  domainId: Id<"domains">;
  onComplete: (keywordIds: Id<"keywords">[]) => void;
  onSkip: () => void;
}

export function KeywordDiscoveryStep({
  domainId,
  onComplete,
  onSkip,
}: KeywordDiscoveryStepProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [promoting, setPromoting] = useState(false);

  // Keywords with "discovered" status (not yet promoted)
  const discoveredKeywords = useQuery(api.dataforseo.getDiscoveredKeywords, {
    domainId,
    status: "discovered",
  });

  // ALL discovered keywords (any status) — used to detect if discovery has ever completed
  const allDiscoveredKeywords = useQuery(api.dataforseo.getDiscoveredKeywords, {
    domainId,
  });

  const promoteKeywords = useMutation(api.domains.promoteDiscoveredKeywords);

  const filteredKeywords = useMemo(() => {
    if (!discoveredKeywords) return [];
    if (!searchQuery) return discoveredKeywords;
    return discoveredKeywords.filter((k) =>
      k.keyword.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [discoveredKeywords, searchQuery]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredKeywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredKeywords.map((k) => k._id)));
    }
  };

  const selectRecommended = () => {
    // Score by position * volume, pick top 10
    const scored = [...(discoveredKeywords || [])].map((k) => ({
      ...k,
      score:
        (k.searchVolume || 0) *
        (k.bestPosition <= 20 ? 100 - k.bestPosition : 10),
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 10);
    setSelectedIds(new Set(top.map((k) => k._id)));
  };

  const handlePromote = async () => {
    if (selectedIds.size === 0) return;
    setPromoting(true);
    try {
      const addedIds = await promoteKeywords({
        domainId,
        keywordIds: Array.from(selectedIds) as Id<"discoveredKeywords">[],
      });
      onComplete(addedIds as unknown as Id<"keywords">[]);
    } catch (error: any) {
      console.error("Failed to promote keywords:", error);
    } finally {
      setPromoting(false);
    }
  };

  // Loading state (queries still loading)
  if (discoveredKeywords === undefined || allDiscoveredKeywords === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            Discovering your keyword rankings...
          </p>
          <p className="text-xs text-tertiary mt-1">
            This may take a moment
          </p>
        </div>
      </div>
    );
  }

  // Discovery still in progress: no keywords of ANY status means initializeDomainData hasn't completed
  if (discoveredKeywords.length === 0 && allDiscoveredKeywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            Searching for keyword rankings for your domain...
          </p>
          <p className="text-xs text-tertiary mt-1 max-w-sm">
            We&apos;re analyzing search engines to find keywords your domain
            already ranks for. This usually takes 15-30 seconds.
          </p>
        </div>
        <button
          onClick={onSkip}
          className="text-sm text-tertiary hover:text-primary transition-colors mt-2"
        >
          Skip and add keywords manually
        </button>
      </div>
    );
  }

  // Discovery completed but no "discovered" keywords left (all already promoted)
  if (discoveredKeywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <SearchLg className="h-12 w-12 text-quaternary" />
        <div className="text-center">
          <p className="text-sm font-medium text-primary">
            No new keywords to add
          </p>
          <p className="text-xs text-tertiary mt-1 max-w-sm">
            All discovered keywords have been added to monitoring, or no
            rankings were found. You can add keywords manually later.
          </p>
        </div>
        <Button color="secondary" size="md" onClick={onSkip}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search keywords..."
            value={searchQuery}
            onChange={(value: string) => setSearchQuery(value)}
            icon={SearchLg}
            size="md"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            color="tertiary"
            size="sm"
            iconLeading={Stars01}
            onClick={selectRecommended}
          >
            Select Recommended
          </Button>
          <Badge color="gray" size="md">
            {selectedIds.size} selected
          </Badge>
        </div>
      </div>

      {/* Keywords table */}
      <div className="rounded-lg border border-secondary overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-secondary/50 sticky top-0">
            <tr>
              <th className="px-3 py-2.5 text-left w-8">
                <Checkbox
                  isSelected={
                    filteredKeywords.length > 0 &&
                    selectedIds.size === filteredKeywords.length
                  }
                  isIndeterminate={
                    selectedIds.size > 0 &&
                    selectedIds.size < filteredKeywords.length
                  }
                  onChange={selectAll}
                  size="sm"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-tertiary">
                Keyword
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                Position
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                Volume
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                Difficulty
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-tertiary">
                Traffic
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {filteredKeywords.map((kw) => (
              <tr
                key={kw._id}
                className="hover:bg-primary_hover transition-colors cursor-pointer"
                onClick={() => toggleSelected(kw._id)}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    isSelected={selectedIds.has(kw._id)}
                    onChange={() => toggleSelected(kw._id)}
                    size="sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <span className="text-sm font-medium text-primary">
                    {kw.keyword}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge
                    color={
                      kw.bestPosition <= 3
                        ? "success"
                        : kw.bestPosition <= 10
                        ? "blue"
                        : kw.bestPosition <= 20
                        ? "warning"
                        : "gray"
                    }
                    size="sm"
                  >
                    #{kw.bestPosition}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center text-sm text-primary">
                  {kw.searchVolume?.toLocaleString() || "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  {kw.difficulty !== undefined ? (
                    <Badge
                      color={
                        kw.difficulty > 70
                          ? "error"
                          : kw.difficulty > 40
                          ? "warning"
                          : "success"
                      }
                      size="sm"
                    >
                      {Math.round(kw.difficulty)}
                    </Badge>
                  ) : (
                    <span className="text-sm text-tertiary">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-sm text-primary">
                  {kw.traffic?.toLocaleString() || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-tertiary hover:text-primary transition-colors"
        >
          Skip this step
        </button>
        <Button
          color="primary"
          size="md"
          iconTrailing={ArrowRight}
          onClick={handlePromote}
          isDisabled={selectedIds.size === 0 || promoting}
        >
          {promoting
            ? "Adding..."
            : `Add to Monitoring (${selectedIds.size})`}
        </Button>
      </div>
    </div>
  );
}
