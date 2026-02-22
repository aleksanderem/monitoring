"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL_KEYS: Record<string, string> = {
  initializing: "reportStatusInitializing",
  collecting: "reportStatusCollecting",
  analyzing: "reportStatusAnalyzing",
  synthesizing: "reportStatusSynthesizing",
  "generating-pdf": "reportStatusGenerating",
  completed: "reportStatusCompleted",
  failed: "reportStatusFailed",
};

interface ReportSessionProgressProps {
  sessionId: Id<"aiReportSessions">;
}

export function ReportSessionProgress({ sessionId }: ReportSessionProgressProps) {
  const t = useTranslations("domains");
  const session = useQuery(api.aiReports.getReportSession, { sessionId });
  const cancelSession = useMutation(api.aiReports.cancelReportSession);

  if (session === undefined) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3 rounded bg-secondary" />
          <div className="h-2 w-full rounded bg-secondary" />
        </div>
      </Card>
    );
  }

  if (!session) return null;

  const isInProgress =
    session.status !== "completed" && session.status !== "failed";

  const statusVariant =
    session.status === "completed"
      ? "default"
      : session.status === "failed"
        ? "destructive"
        : "secondary";

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-primary">
            {t("reportProgress")}
          </h3>
          <Badge variant={statusVariant}>
            {t(STATUS_LABEL_KEYS[session.status] ?? "reportStatusInitializing")}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-tertiary">
            <span>{session.currentStep ?? ""}</span>
            <span>{session.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                session.status === "failed"
                  ? "bg-utility-error-500"
                  : session.status === "completed"
                    ? "bg-utility-success-500"
                    : "bg-brand-500"
              }`}
              style={{ width: `${session.progress}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {session.status === "failed" && session.error && (
          <p className="text-sm text-utility-error-600">{session.error}</p>
        )}

        {/* Cancel button */}
        {isInProgress && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cancelSession({ sessionId })}
          >
            {t("reportCancel")}
          </Button>
        )}
      </div>
    </Card>
  );
}
