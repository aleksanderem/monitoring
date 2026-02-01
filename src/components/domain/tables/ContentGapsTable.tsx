"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  ArrowUpDown,
  Search,
  Download,
  Eye,
  EyeOff,
  Target,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ContentGapsTableProps {
  domainId: Id<"domains">;
}

export function ContentGapsTable({ domainId }: ContentGapsTableProps) {
  const [selectedGaps, setSelectedGaps] = useState<Set<Id<"contentGaps">>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "identified" | "monitoring" | "ranking" | "dismissed">("all");
  const [competitorFilter, setCompetitorFilter] = useState<Id<"competitors"> | "all">("all");
  const [sortBy, setSortBy] = useState<"opportunityScore" | "searchVolume" | "difficulty">("opportunityScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Queries
  const competitors = useQuery(api.competitors_queries.getCompetitorsByDomain, { domainId });

  const gaps = useQuery(api.contentGaps_queries.getContentGaps, {
    domainId,
    filters: {
      priority: priorityFilter === "all" ? undefined : priorityFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      competitorId: competitorFilter === "all" ? undefined : competitorFilter,
    },
  });

  // Mutations
  const updateGapStatus = useMutation(api.contentGaps_mutations.updateGapStatus);
  const updateGapPriority = useMutation(api.contentGaps_mutations.updateGapPriority);
  const dismissGap = useMutation(api.contentGaps_mutations.dismissGap);
  const addToMonitoring = useMutation(api.contentGaps_mutations.addGapsToMonitoring);
  const bulkUpdateStatus = useMutation(api.contentGaps_mutations.bulkUpdateGapStatus);
  const bulkUpdatePriority = useMutation(api.contentGaps_mutations.bulkUpdateGapPriority);

  // Filter and sort gaps
  const filteredGaps = gaps
    ?.filter((gap) => {
      if (!searchQuery) return true;
      return gap.keywordPhrase.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const multiplier = sortOrder === "asc" ? 1 : -1;
      switch (sortBy) {
        case "opportunityScore":
          return (a.opportunityScore - b.opportunityScore) * multiplier;
        case "searchVolume":
          return (a.searchVolume - b.searchVolume) * multiplier;
        case "difficulty":
          return (a.difficulty - b.difficulty) * multiplier;
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

  const toggleGapSelection = (gapId: Id<"contentGaps">) => {
    const newSelection = new Set(selectedGaps);
    if (newSelection.has(gapId)) {
      newSelection.delete(gapId);
    } else {
      newSelection.add(gapId);
    }
    setSelectedGaps(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedGaps.size === filteredGaps?.length) {
      setSelectedGaps(new Set());
    } else {
      setSelectedGaps(new Set(filteredGaps?.map((g) => g._id) || []));
    }
  };

  const handleBulkAddToMonitoring = async () => {
    if (selectedGaps.size === 0) return;

    try {
      await addToMonitoring({
        gapIds: Array.from(selectedGaps),
        addToActiveMonitoring: true,
      });
      toast.success(`Added ${selectedGaps.size} gaps to monitoring`);
      setSelectedGaps(new Set());
    } catch (error) {
      toast.error("Failed to add gaps to monitoring");
    }
  };

  const handleBulkStatusUpdate = async (status: "identified" | "monitoring" | "ranking" | "dismissed") => {
    if (selectedGaps.size === 0) return;

    try {
      await bulkUpdateStatus({
        gapIds: Array.from(selectedGaps),
        status,
      });
      toast.success(`Updated ${selectedGaps.size} gaps`);
      setSelectedGaps(new Set());
    } catch (error) {
      toast.error("Failed to update gaps");
    }
  };

  const handleBulkPriorityUpdate = async (priority: "high" | "medium" | "low") => {
    if (selectedGaps.size === 0) return;

    try {
      await bulkUpdatePriority({
        gapIds: Array.from(selectedGaps),
        priority,
      });
      toast.success(`Updated ${selectedGaps.size} gaps`);
      setSelectedGaps(new Set());
    } catch (error) {
      toast.error("Failed to update gaps");
    }
  };

  const handleExportCSV = () => {
    if (!filteredGaps || filteredGaps.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Keyword",
      "Competitor",
      "Their Position",
      "Your Position",
      "Search Volume",
      "Difficulty",
      "Opportunity Score",
      "Est. Traffic Value",
      "Priority",
      "Status",
    ];

    const rows = filteredGaps.map((gap) => [
      gap.keywordPhrase,
      gap.competitorDomain,
      gap.competitorPosition.toString(),
      gap.yourPosition?.toString() || "Not Ranking",
      gap.searchVolume.toString(),
      gap.difficulty.toString(),
      gap.opportunityScore.toString(),
      gap.estimatedTrafficValue.toString(),
      gap.priority,
      gap.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-gaps-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "identified":
        return "outline";
      case "monitoring":
        return "default";
      case "ranking":
        return "success";
      case "dismissed":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 70) return "success";
    if (score >= 40) return "secondary";
    return "outline";
  };

  if (gaps === undefined || competitors === undefined) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No competitors added yet</p>
          <p className="text-sm text-muted-foreground/75">
            Add competitors first to start analyzing content gaps
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={priorityFilter} onValueChange={(value: any) => setPriorityFilter(value)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="identified">Identified</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="ranking">Ranking</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={competitorFilter} onValueChange={(value: any) => setCompetitorFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Competitors</SelectItem>
              {competitors.map((comp) => (
                <SelectItem key={comp._id} value={comp._id}>
                  {comp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedGaps.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedGaps.size} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkAddToMonitoring}
          >
            <Eye className="h-4 w-4 mr-2" />
            Add to Monitoring
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Change Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkPriorityUpdate("high")}>
                High
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkPriorityUpdate("medium")}>
                Medium
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkPriorityUpdate("low")}>
                Low
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkStatusUpdate("identified")}>
                Identified
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStatusUpdate("monitoring")}>
                Monitoring
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStatusUpdate("ranking")}>
                Ranking
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStatusUpdate("dismissed")}>
                Dismissed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedGaps.size === filteredGaps?.length && filteredGaps.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Keyword</TableHead>
              <TableHead>Competitor</TableHead>
              <TableHead>Their Pos</TableHead>
              <TableHead>Your Pos</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("searchVolume")}>
                <div className="flex items-center gap-1">
                  Volume
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("difficulty")}>
                <div className="flex items-center gap-1">
                  Difficulty
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("opportunityScore")}>
                <div className="flex items-center gap-1">
                  Score
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Traffic</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGaps && filteredGaps.length > 0 ? (
              filteredGaps.map((gap) => (
                <TableRow key={gap._id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedGaps.has(gap._id)}
                      onCheckedChange={() => toggleGapSelection(gap._id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{gap.keywordPhrase}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{gap.competitorName}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{gap.competitorPosition}</Badge>
                  </TableCell>
                  <TableCell>
                    {gap.yourPosition ? (
                      <Badge variant="secondary">{gap.yourPosition}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>{gap.searchVolume.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${gap.difficulty}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{gap.difficulty}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getScoreBadgeVariant(gap.opportunityScore)}>
                      {gap.opportunityScore}
                    </Badge>
                  </TableCell>
                  <TableCell>{gap.estimatedTrafficValue.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadgeVariant(gap.priority)}>
                      {gap.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(gap.status)}>
                      {gap.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await addToMonitoring({ gapIds: [gap._id], addToActiveMonitoring: true });
                              toast.success("Added to monitoring");
                            } catch (error) {
                              toast.error("Failed to add to monitoring");
                            }
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Add to Monitoring
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async () => {
                            try {
                              await dismissGap({ gapId: gap._id });
                              toast.success("Gap dismissed");
                            } catch (error) {
                              toast.error("Failed to dismiss gap");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Dismiss
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No content gaps found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredGaps && filteredGaps.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredGaps.length} gap{filteredGaps.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
