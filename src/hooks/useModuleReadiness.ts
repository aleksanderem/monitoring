import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { usePermissions } from "@/hooks/usePermissions";

export interface ModuleState {
  visible: boolean;
  locked: boolean;
  lockReason: string;
  status: "empty" | "in-progress" | "ready";
  metric?: string;
  metricValue?: number;
}

export type ModuleReadinessMap = Record<string, ModuleState>;

// Module-to-package mapping for visibility
const MODULE_PACKAGE_MAP: Record<string, string | null> = {
  overview: null, // always visible
  monitoring: null, // always visible (core positioning)
  "keyword-map": null,
  visibility: null,
  backlinks: "backlinks",
  "link-building": "link_building",
  competitors: "competitors",
  "content-gaps": "competitors",
  "keyword-analysis": null,
  "on-site": "seo_audit",
  insights: null,
  "ai-research": "ai_strategy",
  strategy: "ai_strategy",
  generators: null,
  settings: null,
};

export function useModuleReadiness(domainId: Id<"domains">): ModuleReadinessMap {
  const { hasModule } = usePermissions();

  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus, { domainId });

  // Conditional queries — only subscribe if the module is in the user's plan
  const backlinkSummary = useQuery(
    api.backlinks.getBacklinkSummary,
    hasModule("backlinks") ? { domainId } : "skip"
  );
  const latestScan = useQuery(
    api.seoAudit_queries.getLatestScan,
    hasModule("seo_audit") ? { domainId } : "skip"
  );

  const steps = onboardingStatus?.steps;
  const counts = onboardingStatus?.counts;

  // Determine visibility per tab
  function isVisible(tabId: string): boolean {
    const requiredModule = MODULE_PACKAGE_MAP[tabId];
    if (requiredModule === null || requiredModule === undefined) return true;
    return hasModule(requiredModule);
  }

  // Determine lock state and reason per tab
  function getLockInfo(tabId: string): { locked: boolean; lockReason: string } {
    if (!steps) return { locked: false, lockReason: "" };

    switch (tabId) {
      case "monitoring":
        if (!steps.keywordsMonitored || !steps.serpChecked) {
          return { locked: true, lockReason: "lockReasonAddKeywordsAndCheck" };
        }
        return { locked: false, lockReason: "" };

      case "keyword-map":
      case "visibility":
        if (!steps.serpChecked) {
          return { locked: true, lockReason: "lockReasonRunSerpCheck" };
        }
        return { locked: false, lockReason: "" };

      case "competitors":
        if (!steps.competitorsAdded) {
          return { locked: true, lockReason: "lockReasonAddCompetitors" };
        }
        return { locked: false, lockReason: "" };

      case "content-gaps":
        if (!steps.competitorsAdded || !steps.analysisComplete) {
          return { locked: true, lockReason: "lockReasonRunAnalysis" };
        }
        return { locked: false, lockReason: "" };

      case "link-building":
        if (!steps.competitorsAdded) {
          return { locked: true, lockReason: "lockReasonAddCompetitors" };
        }
        return { locked: false, lockReason: "" };

      case "backlinks":
        if (!backlinkSummary) {
          return { locked: true, lockReason: "lockReasonFetchBacklinks" };
        }
        return { locked: false, lockReason: "" };

      case "on-site":
        if (!latestScan) {
          return { locked: true, lockReason: "lockReasonRunAudit" };
        }
        return { locked: false, lockReason: "" };

      case "ai-research":
      case "strategy":
        if (!steps.businessContextSet) {
          return { locked: true, lockReason: "lockReasonSetContext" };
        }
        return { locked: false, lockReason: "" };

      case "insights":
        if (!steps.keywordsMonitored) {
          return { locked: true, lockReason: "lockReasonAddKeywords" };
        }
        return { locked: false, lockReason: "" };

      default:
        return { locked: false, lockReason: "" };
    }
  }

  // Compute status and metrics per tab
  function getStatusAndMetric(tabId: string): { status: ModuleState["status"]; metric?: string; metricValue?: number } {
    if (!counts) return { status: "empty" };

    switch (tabId) {
      case "monitoring":
        if (counts.monitoredKeywords > 0) {
          return {
            status: "ready",
            metric: `${counts.monitoredKeywords} keywords`,
            metricValue: counts.monitoredKeywords,
          };
        }
        return { status: "empty" };

      case "competitors":
        if (counts.activeCompetitors > 0) {
          return {
            status: "ready",
            metric: `${counts.activeCompetitors} competitors`,
            metricValue: counts.activeCompetitors,
          };
        }
        return { status: "empty" };

      case "content-gaps":
        if (counts.contentGaps > 0) {
          return {
            status: "ready",
            metric: `${counts.contentGaps} gaps`,
            metricValue: counts.contentGaps,
          };
        }
        return { status: "empty" };

      case "backlinks":
        if (backlinkSummary) {
          return {
            status: "ready",
            metric: `${backlinkSummary.totalBacklinks ?? 0} backlinks`,
            metricValue: backlinkSummary.totalBacklinks ?? 0,
          };
        }
        return { status: "empty" };

      case "keyword-map":
      case "visibility":
        if (steps?.serpChecked) return { status: "ready" };
        return { status: "empty" };

      case "on-site":
        if (latestScan) return { status: "ready" };
        return { status: "empty" };

      case "ai-research":
      case "strategy":
        if (steps?.businessContextSet) return { status: "ready" };
        return { status: "empty" };

      case "insights":
        if (steps?.keywordsMonitored) return { status: "ready" };
        return { status: "empty" };

      default:
        return { status: "ready" };
    }
  }

  // Build the full readiness map
  const result: ModuleReadinessMap = {};

  for (const tabId of Object.keys(MODULE_PACKAGE_MAP)) {
    const visible = isVisible(tabId);
    const { locked, lockReason } = visible ? getLockInfo(tabId) : { locked: false, lockReason: "" };
    const { status, metric, metricValue } = visible ? getStatusAndMetric(tabId) : { status: "empty" as const };

    result[tabId] = { visible, locked, lockReason, status, metric, metricValue };
  }

  return result;
}
