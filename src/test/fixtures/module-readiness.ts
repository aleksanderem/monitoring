/**
 * Test fixtures for useModuleReadiness hook return data.
 * Shape matches ModuleReadinessMap from useModuleReadiness.
 */

type ModuleState = {
  visible: boolean;
  locked: boolean;
  lockReason: string;
  status: "empty" | "in-progress" | "ready";
  metric?: string;
  metricValue?: number;
};

type ModuleReadinessMap = Record<string, ModuleState>;

const MODULE_KEYS = [
  "overview", "monitoring", "keyword-map", "visibility", "backlinks",
  "link-building", "competitors", "content-gaps", "keyword-analysis",
  "on-site", "insights", "ai-research", "strategy", "generators", "settings",
] as const;

function makeModule(overrides: Partial<ModuleState> = {}): ModuleState {
  return {
    visible: true,
    locked: false,
    lockReason: "",
    status: "ready",
    ...overrides,
  };
}

// All modules unlocked and ready
export const MODULES_ALL_READY: ModuleReadinessMap = Object.fromEntries(
  MODULE_KEYS.map((key) => [
    key,
    makeModule({
      metric: key === "monitoring" ? "45 keywords" : key === "competitors" ? "3 competitors" : undefined,
      metricValue: key === "monitoring" ? 45 : key === "competitors" ? 3 : undefined,
    }),
  ])
);

// All modules locked (fresh domain, nothing done)
export const MODULES_ALL_LOCKED: ModuleReadinessMap = Object.fromEntries(
  MODULE_KEYS.map((key) => [
    key,
    key === "overview" || key === "settings"
      ? makeModule()
      : makeModule({
          locked: true,
          lockReason: "lockReasonAddKeywordsAndCheck",
          status: "empty",
        }),
  ])
);

// Partial — keywords added but not checked, competitors not added
export const MODULES_PARTIAL_KEYWORDS_ONLY: ModuleReadinessMap = Object.fromEntries(
  MODULE_KEYS.map((key) => {
    if (key === "overview" || key === "settings") return [key, makeModule()];
    if (key === "monitoring") return [key, makeModule({ status: "in-progress", metric: "10 keywords", metricValue: 10 })];
    if (key === "keyword-map" || key === "keyword-analysis") return [key, makeModule({ locked: true, lockReason: "lockReasonRunFirstCheck", status: "empty" })];
    if (key === "competitors" || key === "content-gaps") return [key, makeModule({ locked: true, lockReason: "lockReasonAddCompetitors", status: "empty" })];
    if (key === "backlinks" || key === "link-building") return [key, makeModule({ locked: true, lockReason: "lockReasonFetchBacklinks", status: "empty" })];
    if (key === "visibility") return [key, makeModule({ locked: true, lockReason: "lockReasonFetchVisibility", status: "empty" })];
    return [key, makeModule({ locked: true, lockReason: "lockReasonAddKeywordsAndCheck", status: "empty" })];
  })
);

// Keywords checked, competitors added, analysis running
export const MODULES_PARTIAL_ANALYSIS_RUNNING: ModuleReadinessMap = Object.fromEntries(
  MODULE_KEYS.map((key) => {
    if (key === "overview" || key === "settings") return [key, makeModule()];
    if (key === "monitoring") return [key, makeModule({ status: "ready", metric: "30 keywords", metricValue: 30 })];
    if (key === "keyword-map" || key === "keyword-analysis") return [key, makeModule({ status: "ready" })];
    if (key === "competitors") return [key, makeModule({ status: "ready", metric: "3 competitors", metricValue: 3 })];
    if (key === "content-gaps") return [key, makeModule({ status: "in-progress" })];
    if (key === "visibility") return [key, makeModule({ status: "ready" })];
    if (key === "backlinks" || key === "link-building") return [key, makeModule({ locked: true, lockReason: "lockReasonFetchBacklinks", status: "empty" })];
    return [key, makeModule({ status: "ready" })];
  })
);
