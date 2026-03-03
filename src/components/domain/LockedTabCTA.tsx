"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { EzIcon } from "@/components/foundations/ez-icon";
import { toast } from "sonner";

interface LockedTabCTAProps {
  tabId: string;
  lockReason: string;
  domainId: Id<"domains">;
  onNavigateToTab?: (tabId: string) => void;
}

type ActionConfig =
  | { type: "api-action"; buttonKey: string }
  | { type: "navigate"; buttonKey: string; targetTab: string };

export function LockedTabCTA({ tabId, lockReason, domainId, onNavigateToTab }: LockedTabCTAProps) {
  const t = useTranslations("domains");
  const [isLoading, setIsLoading] = useState(false);

  const fetchBacklinks = useAction(api.backlinks.fetchBacklinksFromAPI);
  const triggerAudit = useMutation(api.seoAudit_actions.triggerSeoAuditScan);
  const refreshPositions = useMutation(api.keywords.refreshKeywordPositions);
  const keywords = useQuery(
    api.keywords.getKeywords,
    lockReason === "lockReasonRunSerpCheck" ? { domainId } : "skip"
  );

  const actionConfig = getActionConfig(lockReason);

  async function handleApiAction() {
    setIsLoading(true);
    try {
      if (lockReason === "lockReasonRunSerpCheck") {
        const ids = (keywords ?? []).map((k) => k._id);
        if (ids.length === 0) {
          toast.error(t("lockedTabNoKeywords"));
          return;
        }
        await refreshPositions({ keywordIds: ids });
        toast.success(t("lockedTabSerpCheckStarted"));
      } else if (lockReason === "lockReasonFetchBacklinks") {
        await fetchBacklinks({ domainId });
        toast.success(t("lockedTabBacklinksFetched"));
      } else if (lockReason === "lockReasonRunAudit") {
        await triggerAudit({ domainId });
        toast.success(t("lockedTabAuditStarted"));
      }
    } catch (error) {
      console.error(`[LockedTabCTA] Failed action for ${lockReason}:`, error);
      toast.error(t("lockedTabActionFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleClick() {
    if (!actionConfig) return;
    if (actionConfig.type === "api-action") {
      handleApiAction();
    } else if (actionConfig.type === "navigate" && onNavigateToTab) {
      onNavigateToTab(actionConfig.targetTab);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-secondary bg-primary py-20 px-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        <EzIcon name="lock" size={28} color="#9ca3af" strokeColor="#9ca3af" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-lg font-semibold text-primary">
          {t("lockedTabTitle")}
        </h3>
        <p className="max-w-md text-sm text-tertiary">
          {t(lockReason)}
        </p>
      </div>
      {actionConfig && (
        <Button
          color="primary"
          size="md"
          onClick={handleClick}
          isLoading={isLoading}
        >
          {t(actionConfig.buttonKey)}
        </Button>
      )}
    </div>
  );
}

function getActionConfig(lockReason: string): ActionConfig | null {
  switch (lockReason) {
    // Direct API actions
    case "lockReasonFetchBacklinks":
      return { type: "api-action", buttonKey: "lockedTabFetchBacklinks" };
    case "lockReasonRunAudit":
      return { type: "api-action", buttonKey: "lockedTabRunAudit" };

    case "lockReasonRunSerpCheck":
      return { type: "api-action", buttonKey: "lockedTabRunSerpCheck" };

    // Navigate to monitoring tab
    case "lockReasonAddKeywords":
      return { type: "navigate", buttonKey: "lockedTabGoToMonitoring", targetTab: "monitoring" };

    // Navigate to competitors tab
    case "lockReasonAddCompetitors":
    case "lockReasonRunAnalysis":
      return { type: "navigate", buttonKey: "lockedTabGoToCompetitors", targetTab: "competitors" };

    // Navigate to settings tab
    case "lockReasonSetContext":
      return { type: "navigate", buttonKey: "lockedTabGoToSettings", targetTab: "settings" };

    default:
      return null;
  }
}
