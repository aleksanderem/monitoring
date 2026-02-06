"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { Link03, TrendUp02, TrendDown02, Globe01, CheckCircle, XCircle } from "@untitledui/icons";

interface CompetitorBacklinksSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorBacklinksSection({ domainId }: CompetitorBacklinksSectionProps) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<Id<"competitors"> | null>(null);

  const competitors = useQuery(api.competitors.getCompetitors, { domainId });
  const ownBacklinksSummary = useQuery(api.backlinks.getBacklinkSummary, { domainId });
  const competitorBacklinksSummary = useQuery(
    api.backlinks.getCompetitorBacklinkSummary,
    selectedCompetitor ? { competitorId: selectedCompetitor } : "skip"
  );
  const competitorBacklinks = useQuery(
    api.backlinks.getCompetitorBacklinks,
    selectedCompetitor ? { competitorId: selectedCompetitor, limit: 20 } : "skip"
  );

  // Transform competitors to SelectItemType format
  const competitorItems: SelectItemType[] = competitors
    ?.filter((competitor) => competitor && competitor._id)
    .map((competitor) => ({
      id: competitor._id,
      label: competitor.name || competitor.competitorDomain,
    })) || [];

  const calculateDiff = (own: number, competitor: number) => {
    const diff = own - competitor;
    const percentDiff = competitor > 0 ? ((diff / competitor) * 100).toFixed(1) : "—";
    return { diff, percentDiff };
  };

  if (competitors === undefined) {
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
          <Link03 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="text-tertiary mb-2">No competitors added yet</p>
          <p className="text-sm text-quaternary">
            Add competitors above to compare backlink profiles
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Header */}
      <div className="border-b border-secondary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">Backlinks Comparison</h3>
            <p className="text-sm text-tertiary">
              Compare your backlink profile with competitors
            </p>
          </div>
        </div>

        {/* Competitor Selection */}
        <div className="w-64">
          <Select
            size="md"
            items={competitorItems}
            selectedKey={selectedCompetitor}
            onSelectionChange={(key) => setSelectedCompetitor(key as Id<"competitors">)}
            placeholder="Select a competitor"
          >
            {(item) => <span>{item.label}</span>}
          </Select>
        </div>
      </div>

      {/* Comparison */}
      {selectedCompetitor && competitorBacklinksSummary ? (
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Backlinks */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-tertiary">Total Backlinks</p>
                <Link03 className="h-4 w-4 text-quaternary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-semibold text-primary">
                    {ownBacklinksSummary?.totalBacklinks.toLocaleString() || "—"}
                  </p>
                  <span className="text-xs text-tertiary">you</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-medium text-tertiary">
                    {competitorBacklinksSummary.totalBacklinks.toLocaleString()}
                  </p>
                  <span className="text-xs text-quaternary">them</span>
                </div>
                {ownBacklinksSummary && (
                  <div className="flex items-center gap-1 mt-1">
                    {ownBacklinksSummary.totalBacklinks > competitorBacklinksSummary.totalBacklinks ? (
                      <>
                        <TrendUp02 className="h-3 w-3 text-utility-success-500" />
                        <span className="text-xs text-utility-success-600">
                          +{calculateDiff(ownBacklinksSummary.totalBacklinks, competitorBacklinksSummary.totalBacklinks).percentDiff}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendDown02 className="h-3 w-3 text-utility-error-500" />
                        <span className="text-xs text-utility-error-600">
                          {calculateDiff(ownBacklinksSummary.totalBacklinks, competitorBacklinksSummary.totalBacklinks).percentDiff}%
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Referring Domains */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-tertiary">Referring Domains</p>
                <Globe01 className="h-4 w-4 text-quaternary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-semibold text-primary">
                    {ownBacklinksSummary?.totalDomains.toLocaleString() || "—"}
                  </p>
                  <span className="text-xs text-tertiary">you</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-medium text-tertiary">
                    {competitorBacklinksSummary.totalDomains.toLocaleString()}
                  </p>
                  <span className="text-xs text-quaternary">them</span>
                </div>
                {ownBacklinksSummary && (
                  <div className="flex items-center gap-1 mt-1">
                    {ownBacklinksSummary.totalDomains > competitorBacklinksSummary.totalDomains ? (
                      <>
                        <TrendUp02 className="h-3 w-3 text-utility-success-500" />
                        <span className="text-xs text-utility-success-600">
                          +{calculateDiff(ownBacklinksSummary.totalDomains, competitorBacklinksSummary.totalDomains).percentDiff}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendDown02 className="h-3 w-3 text-utility-error-500" />
                        <span className="text-xs text-utility-error-600">
                          {calculateDiff(ownBacklinksSummary.totalDomains, competitorBacklinksSummary.totalDomains).percentDiff}%
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dofollow Links */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-tertiary">Dofollow Links</p>
                <CheckCircle className="h-4 w-4 text-quaternary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-semibold text-primary">
                    {ownBacklinksSummary?.dofollow.toLocaleString() || "—"}
                  </p>
                  <span className="text-xs text-tertiary">you</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-medium text-tertiary">
                    {competitorBacklinksSummary.dofollow.toLocaleString()}
                  </p>
                  <span className="text-xs text-quaternary">them</span>
                </div>
              </div>
            </div>

            {/* Nofollow Links */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-tertiary">Nofollow Links</p>
                <XCircle className="h-4 w-4 text-quaternary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-semibold text-primary">
                    {ownBacklinksSummary?.nofollow.toLocaleString() || "—"}
                  </p>
                  <span className="text-xs text-tertiary">you</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-medium text-tertiary">
                    {competitorBacklinksSummary.nofollow.toLocaleString()}
                  </p>
                  <span className="text-xs text-quaternary">them</span>
                </div>
              </div>
            </div>
          </div>

          {/* Competitor Backlinks List */}
          {competitorBacklinks && competitorBacklinks.items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-primary mb-3">Top Competitor Backlinks</h4>
              <div className="rounded-lg border border-secondary overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-secondary bg-secondary/30">
                      <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-4 py-3">
                        From Domain
                      </th>
                      <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-4 py-3">
                        Anchor
                      </th>
                      <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-4 py-3">
                        Type
                      </th>
                      <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-4 py-3">
                        Rank
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary">
                    {competitorBacklinks.items.map((backlink: any, idx: number) => (
                      <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-primary truncate max-w-xs">
                            {backlink.domainFrom || "—"}
                          </div>
                          <div className="text-xs text-tertiary truncate max-w-xs">
                            {backlink.urlFrom}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-primary truncate max-w-xs block">
                            {backlink.anchor || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={backlink.dofollow ? "success" : "gray"} size="sm">
                            {backlink.dofollow ? "Dofollow" : "Nofollow"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-primary">
                            {backlink.rank?.toFixed(1) || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-tertiary mt-2">
                Showing top {competitorBacklinks.items.length} of {competitorBacklinks.total.toLocaleString()} backlinks
              </p>
            </div>
          )}

          {competitorBacklinks && competitorBacklinks.items.length === 0 && (
            <div className="text-center py-8 text-tertiary">
              <p>No backlinks data available for this competitor</p>
              <p className="text-sm text-quaternary mt-1">
                Click "Backlinks" button above to fetch backlinks
              </p>
            </div>
          )}
        </div>
      ) : selectedCompetitor && !competitorBacklinksSummary ? (
        <div className="text-center py-12 text-tertiary">
          <Link03 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="mb-2">No backlinks data available</p>
          <p className="text-sm text-quaternary">
            Click "Backlinks" button in the competitor list above to fetch backlinks
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-tertiary">
          <p>Select a competitor to view backlinks comparison</p>
        </div>
      )}
    </div>
  );
}
