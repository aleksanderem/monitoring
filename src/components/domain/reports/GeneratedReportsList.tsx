"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
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

const REPORT_TYPE_KEYS: Record<string, string> = {
  "executive-summary": "reportTypeExecutive",
  "detailed-keyword": "reportTypeKeyword",
  "competitor-analysis": "reportTypeCompetitor",
  "progress-report": "reportTypeProgress",
};

interface GeneratedReportsListProps {
  domainId: Id<"domains">;
}

export function GeneratedReportsList({ domainId }: GeneratedReportsListProps) {
  const t = useTranslations("domains");
  const sessions = useQuery(api.aiReports.getReportSessions, { domainId });

  if (sessions === undefined) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/4 rounded bg-secondary" />
          <div className="h-8 w-full rounded bg-secondary" />
          <div className="h-8 w-full rounded bg-secondary" />
        </div>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-tertiary">{t("noReports")}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-primary bg-secondary">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-tertiary">
              {t("reportType")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-tertiary">
              {t("reportStatus")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-tertiary">
              {t("reportProgress")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-tertiary">
              {t("reportCreated")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const statusVariant =
              session.status === "completed"
                ? "default"
                : session.status === "failed"
                  ? "destructive"
                  : "secondary";

            return (
              <tr key={session._id} className="border-b border-primary last:border-0">
                <td className="px-4 py-3 text-sm text-primary">
                  {t(REPORT_TYPE_KEYS[session.reportType] ?? "reportTypeExecutive")}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant}>
                    {t(STATUS_LABEL_KEYS[session.status] ?? "reportStatusInitializing")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-tertiary">
                  {session.progress}%
                </td>
                <td className="px-4 py-3 text-sm text-tertiary">
                  {new Date(session.createdAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
