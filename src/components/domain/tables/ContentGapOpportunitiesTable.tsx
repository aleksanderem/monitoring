"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { Eye, XClose, TrendUp02, SearchLg, Target04 } from "@untitledui/icons";
import { toast } from "sonner";

interface ContentGapOpportunitiesTableProps {
  domainId: Id<"domains">;
}

export function ContentGapOpportunitiesTable({ domainId }: ContentGapOpportunitiesTableProps) {
  const [selectedPriority, setSelectedPriority] = useState<"all" | "high" | "medium" | "low">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const competitors = useQuery(api.competitors.getCompetitors, { domainId });
  const opportunities = useQuery(api.contentGap.getContentGapOpportunities, {
    domainId,
    limit: 100,
    priority: selectedPriority === "all" ? undefined : selectedPriority,
  });

  const markAsMonitoring = useMutation(api.contentGap.markOpportunityAsMonitoring);
  const dismissOpportunity = useMutation(api.contentGap.dismissOpportunity);

  // Filter opportunities by search query
  const filteredOpportunities = opportunities?.filter((opp: any) => {
    if (!searchQuery) return true;
    return opp.keyword && opp.keyword.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleMarkAsMonitoring = async (gapId: Id<"contentGaps">, keyword: string) => {
    try {
      await markAsMonitoring({ gapId });
      toast.success(`Now monitoring "${keyword}"`);
    } catch (error: any) {
      toast.error(error.message || "Failed to start monitoring");
    }
  };

  const handleDismiss = async (gapId: Id<"contentGaps">, keyword: string) => {
    try {
      await dismissOpportunity({ gapId });
      toast.success(`Dismissed "${keyword}"`);
    } catch (error: any) {
      toast.error(error.message || "Failed to dismiss opportunity");
    }
  };

  const getPriorityBadgeColor = (priority: string): "success" | "warning" | "gray" => {
    if (priority === "high") return "success";
    if (priority === "medium") return "warning";
    return "gray";
  };

  const priorityOptions: SelectItemType[] = [
    { id: "all", label: "All Priorities" },
    { id: "high", label: "High Priority" },
    { id: "medium", label: "Medium Priority" },
    { id: "low", label: "Low Priority" },
  ];

  if (competitors === undefined || opportunities === undefined) {
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
          <Target04 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="text-tertiary mb-2">No competitors added yet</p>
          <p className="text-sm text-quaternary">
            Add competitors above to discover content gap opportunities
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
            <h3 className="text-lg font-semibold text-primary">Content Gap Opportunities</h3>
            <p className="text-sm text-tertiary">
              Keywords where competitors rank but you don't
            </p>
          </div>
          <Badge color="gray" size="lg">
            {filteredOpportunities?.length || 0} opportunities
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <SearchLg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-quaternary" />
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-secondary rounded-lg bg-primary text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-48">
            <Select
              size="md"
              items={priorityOptions}
              selectedKey={selectedPriority}
              onSelectionChange={(key) => setSelectedPriority(key as typeof selectedPriority)}
            >
              {(item) => <span>{item.label}</span>}
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredOpportunities && filteredOpportunities.length === 0 ? (
        <div className="text-center py-12 text-tertiary">
          <p className="mb-2">No opportunities found</p>
          <p className="text-sm text-quaternary">
            {searchQuery ? "Try different search terms" : "Run content gap analysis to find opportunities"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary bg-secondary/30">
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Keyword
                </th>
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Priority
                </th>
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Score
                </th>
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Search Volume
                </th>
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Difficulty
                </th>
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Comp. Position
                </th>
                <th className="text-left text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Est. Traffic
                </th>
                <th className="text-right text-xs font-medium text-tertiary uppercase tracking-wider px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {filteredOpportunities?.map((opportunity: any) => (
                <tr key={opportunity._id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-primary text-sm">
                      {opportunity.keyword || "Unknown"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge color={getPriorityBadgeColor(opportunity.priority)} size="sm">
                      {opportunity.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-brand-secondary">
                      {Math.round(opportunity.opportunityScore)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-primary">
                      {opportunity.searchVolume?.toLocaleString() || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            opportunity.difficulty >= 70 ? "bg-utility-error-500" :
                            opportunity.difficulty >= 40 ? "bg-utility-warning-500" :
                            "bg-utility-success-500"
                          }`}
                          style={{ width: `${opportunity.difficulty}%` }}
                        />
                      </div>
                      <span className="text-sm text-tertiary">{opportunity.difficulty}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge color="gray" size="sm">
                      #{opportunity.competitorPosition}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-primary">
                      <TrendUp02 className="h-3 w-3 text-utility-success-500" />
                      {opportunity.estimatedTrafficValue?.toLocaleString() || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        color="secondary"
                        onClick={() => handleMarkAsMonitoring(opportunity._id, opportunity.keyword)}
                        iconLeading={Eye}
                        title="Start monitoring this keyword"
                      >
                        Monitor
                      </Button>
                      <Button
                        size="sm"
                        color="tertiary"
                        onClick={() => handleDismiss(opportunity._id, opportunity.keyword)}
                        iconLeading={XClose}
                        title="Dismiss this opportunity"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
