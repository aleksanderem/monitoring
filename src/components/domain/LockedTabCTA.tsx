"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { EzIcon } from "@/components/foundations/ez-icon";
import { toast } from "sonner";

interface LockedTabCTAProps {
  tabId: string;
  lockReason: string;
  domainId: Id<"domains">;
}

export function LockedTabCTA({ tabId, lockReason, domainId }: LockedTabCTAProps) {
  const t = useTranslations("domains");
  const [isLoading, setIsLoading] = useState(false);

  const fetchBacklinks = useAction(api.backlinks.fetchBacklinksFromAPI);
  const triggerAudit = useMutation(api.seoAudit_actions.triggerSeoAuditScan);

  const actionConfig = getActionConfig(tabId);

  async function handleAction() {
    if (!actionConfig) return;
    setIsLoading(true);
    try {
      if (tabId === "backlinks") {
        await fetchBacklinks({ domainId });
        toast.success(t("lockedTabBacklinksFetched"));
      } else if (tabId === "on-site") {
        await triggerAudit({ domainId });
        toast.success(t("lockedTabAuditStarted"));
      }
    } catch (error) {
      console.error(`[LockedTabCTA] Failed action for ${tabId}:`, error);
      toast.error(t("lockedTabActionFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-secondary bg-primary py-20 px-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        <EzIcon name="lock-01" size={28} color="#9ca3af" strokeColor="#9ca3af" />
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
          onClick={handleAction}
          isLoading={isLoading}
        >
          {t(actionConfig.buttonKey)}
        </Button>
      )}
    </div>
  );
}

function getActionConfig(tabId: string): { buttonKey: string } | null {
  switch (tabId) {
    case "backlinks":
      return { buttonKey: "lockedTabFetchBacklinks" };
    case "on-site":
      return { buttonKey: "lockedTabRunAudit" };
    default:
      return null;
  }
}
