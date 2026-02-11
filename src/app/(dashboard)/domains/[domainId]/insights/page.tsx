"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/shared/LoadingState";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: Promise<{
    domainId: Id<"domains">;
  }>;
}

export default function InsightsPage({ params }: PageProps) {
  const { domainId } = use(params);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");

  // Get anomaly summary
  const summary = useQuery(api.forecasts_queries.getAnomalySummary, {
    domainId,
  });

  // Get anomalies with filters
  const anomalies = useQuery(api.forecasts_queries.getAnomalies, {
    domainId,
    severity: severityFilter === "all" ? undefined : severityFilter,
    resolved: statusFilter === "all" ? undefined : statusFilter === "resolved",
  });

  if (summary === undefined || anomalies === undefined) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Insights & Anomalies</h1>
          <p className="mt-1 text-sm text-tertiary">
            Statistical anomalies detected in your ranking data
          </p>
        </div>
        <LoadingState type="list" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary">Insights & Anomalies</h1>
        <p className="mt-1 text-sm text-tertiary">
          Statistical anomalies detected in your ranking data
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-tertiary">Total Anomalies</span>
            <Badge variant="secondary">{summary.total}</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-primary">{summary.total}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-tertiary">High Severity</span>
            <Badge variant="destructive">{summary.high}</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-utility-error-600">{summary.high}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-tertiary">Medium Severity</span>
            <Badge variant="destructive">{summary.medium}</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-utility-warning-600">{summary.medium}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-tertiary">Low Severity</span>
            <Badge variant="secondary">{summary.low}</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-utility-gray-600">{summary.low}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Select
            value={severityFilter}
            onValueChange={(value) => setSeverityFilter(value as any)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as any)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Anomalies List */}
      {anomalies.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-primary">No anomalies found</p>
          <p className="mt-1 text-sm text-tertiary">
            {statusFilter === "unresolved"
              ? "All anomalies have been resolved"
              : "Your ranking data looks normal"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <AnomalyCard key={anomaly._id} anomaly={anomaly} />
          ))}
        </div>
      )}
    </div>
  );
}

// Anomaly Card Component
function AnomalyCard({ anomaly }: { anomaly: any }) {
  const [isResolving, setIsResolving] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive" as const;
      case "medium":
        return "outline" as const;
      case "low":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "spike":
        return "📈 Spike";
      case "drop":
        return "📉 Drop";
      case "pattern_change":
        return "🔄 Pattern Change";
      default:
        return type;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getSeverityColor(anomaly.severity)}>
              {anomaly.severity}
            </Badge>
            <Badge variant="secondary">{getTypeLabel(anomaly.type)}</Badge>
            <span className="text-xs text-tertiary">
              {new Date(anomaly.detectedAt).toLocaleDateString()}
            </span>
            {anomaly.resolved && (
              <Badge variant="default">Resolved</Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-primary">{anomaly.description}</p>

          {/* Metrics */}
          <div className="flex flex-wrap gap-4 text-xs text-tertiary">
            <div>
              <span className="font-medium">Actual:</span> {anomaly.value.toFixed(1)}
            </div>
            <div>
              <span className="font-medium">Expected:</span> {anomaly.expectedValue.toFixed(1)}
            </div>
            <div>
              <span className="font-medium">Z-Score:</span> {anomaly.zScore.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Metric:</span> {anomaly.metric}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!anomaly.resolved && (
          <div>
            <Button
              size="sm"
              variant="secondary"
              disabled={isResolving}
              onClick={async () => {
                setIsResolving(true);
                // This will be implemented when we add the mutation
                // await resolveAnomaly({ anomalyId: anomaly._id });
                setIsResolving(false);
              }}
            >
              {isResolving ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
