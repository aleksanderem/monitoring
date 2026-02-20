import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { api } from "../../convex/_generated/api";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

let mockHasModule = vi.fn(() => true);
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
    hasModule: (...args: any[]) => mockHasModule(...args),
  }),
}));

import { useModuleReadiness } from "./useModuleReadiness";
import type { Id } from "../../convex/_generated/dataModel";

const DOMAIN_ID = "domain123" as Id<"domains">;

// ── Fixtures ──────────────────────────────────────────────────────────────

const FULL_ONBOARDING = {
  steps: {
    keywordsMonitored: true,
    serpChecked: true,
    competitorsAdded: true,
    analysisComplete: true,
    businessContextSet: true,
  },
  counts: {
    monitoredKeywords: 45,
    activeCompetitors: 3,
    contentGaps: 12,
  },
};

const EMPTY_ONBOARDING = {
  steps: {
    keywordsMonitored: false,
    serpChecked: false,
    competitorsAdded: false,
    analysisComplete: false,
    businessContextSet: false,
  },
  counts: {
    monitoredKeywords: 0,
    activeCompetitors: 0,
    contentGaps: 0,
  },
};

const BACKLINK_SUMMARY = {
  totalBacklinks: 1250,
  referringDomains: 80,
};

const LATEST_SCAN = {
  _id: "scan1" as any,
  status: "complete",
  pagesScanned: 120,
};

// ── Query key helpers ─────────────────────────────────────────────────────

const onboardingKey = getFunctionName(api.onboarding.getOnboardingStatus);
const backlinkKey = getFunctionName(api.backlinks.getBacklinkSummary);
const scanKey = getFunctionName(api.seoAudit_queries.getLatestScan);

function refToKey(ref: unknown): string {
  try {
    return getFunctionName(ref as any);
  } catch {
    return String(ref);
  }
}

type QueryMap = Map<string, unknown>;

function setupQueries(overrides: Record<string, unknown> = {}) {
  const map: QueryMap = new Map();
  // defaults: full onboarding, backlink summary, latest scan
  map.set(onboardingKey, FULL_ONBOARDING);
  map.set(backlinkKey, BACKLINK_SUMMARY);
  map.set(scanKey, LATEST_SCAN);

  for (const [k, v] of Object.entries(overrides)) {
    map.set(k, v);
  }

  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    if (map.has(key)) return map.get(key);
    return undefined;
  }) as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useModuleReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasModule = vi.fn(() => true);
  });

  // ── VISIBILITY ──────────────────────────────────────────────────────────

  describe("visibility", () => {
    it("all modules visible when hasModule returns true for all", () => {
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      for (const key of Object.keys(result.current)) {
        expect(result.current[key].visible).toBe(true);
      }
    });

    it("backlinks hidden when hasModule('backlinks') returns false", () => {
      mockHasModule = vi.fn((mod: string) => mod !== "backlinks");
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["backlinks"].visible).toBe(false);
    });

    it("competitors and content-gaps hidden when hasModule('competitors') returns false", () => {
      mockHasModule = vi.fn((mod: string) => mod !== "competitors");
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["competitors"].visible).toBe(false);
      expect(result.current["content-gaps"].visible).toBe(false);
    });

    it("on-site hidden when hasModule('seo_audit') returns false", () => {
      mockHasModule = vi.fn((mod: string) => mod !== "seo_audit");
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["on-site"].visible).toBe(false);
    });

    it("ai-research and strategy hidden when hasModule('ai_strategy') returns false", () => {
      mockHasModule = vi.fn((mod: string) => mod !== "ai_strategy");
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["ai-research"].visible).toBe(false);
      expect(result.current["strategy"].visible).toBe(false);
    });

    it("overview and monitoring always visible regardless of hasModule", () => {
      mockHasModule = vi.fn(() => false);
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["overview"].visible).toBe(true);
      expect(result.current["monitoring"].visible).toBe(true);
    });
  });

  // ── LOCK STATE ──────────────────────────────────────────────────────────

  describe("lock state", () => {
    it("monitoring locked when keywordsMonitored=false or serpChecked=false", () => {
      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, keywordsMonitored: false },
        },
      });
      const { result: r1 } = renderHook(() => useModuleReadiness(DOMAIN_ID));
      expect(r1.current["monitoring"].locked).toBe(true);
      expect(r1.current["monitoring"].lockReason).toBe("lockReasonAddKeywordsAndCheck");

      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, serpChecked: false },
        },
      });
      const { result: r2 } = renderHook(() => useModuleReadiness(DOMAIN_ID));
      expect(r2.current["monitoring"].locked).toBe(true);
    });

    it("monitoring unlocked when both keywordsMonitored=true and serpChecked=true", () => {
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["monitoring"].locked).toBe(false);
      expect(result.current["monitoring"].lockReason).toBe("");
    });

    it("competitors locked when competitorsAdded=false", () => {
      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, competitorsAdded: false },
        },
      });
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["competitors"].locked).toBe(true);
      expect(result.current["competitors"].lockReason).toBe("lockReasonAddCompetitors");
    });

    it("content-gaps locked when competitorsAdded=false or analysisComplete=false", () => {
      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, analysisComplete: false },
        },
      });
      const { result: r1 } = renderHook(() => useModuleReadiness(DOMAIN_ID));
      expect(r1.current["content-gaps"].locked).toBe(true);
      expect(r1.current["content-gaps"].lockReason).toBe("lockReasonRunAnalysis");

      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, competitorsAdded: false },
        },
      });
      const { result: r2 } = renderHook(() => useModuleReadiness(DOMAIN_ID));
      expect(r2.current["content-gaps"].locked).toBe(true);
    });

    it("backlinks locked when backlinkSummary is null/undefined", () => {
      setupQueries({ [backlinkKey]: null });
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["backlinks"].locked).toBe(true);
      expect(result.current["backlinks"].lockReason).toBe("lockReasonFetchBacklinks");
    });

    it("on-site locked when latestScan is null/undefined", () => {
      setupQueries({ [scanKey]: null });
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["on-site"].locked).toBe(true);
      expect(result.current["on-site"].lockReason).toBe("lockReasonRunAudit");
    });

    it("ai-research locked when businessContextSet=false", () => {
      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, businessContextSet: false },
        },
      });
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["ai-research"].locked).toBe(true);
      expect(result.current["ai-research"].lockReason).toBe("lockReasonSetContext");
    });

    it("insights locked when keywordsMonitored=false", () => {
      setupQueries({
        [onboardingKey]: {
          ...FULL_ONBOARDING,
          steps: { ...FULL_ONBOARDING.steps, keywordsMonitored: false },
        },
      });
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["insights"].locked).toBe(true);
      expect(result.current["insights"].lockReason).toBe("lockReasonAddKeywords");
    });
  });

  // ── STATUS / METRICS ────────────────────────────────────────────────────

  describe("status and metrics", () => {
    it("monitoring status='ready' with metric when monitoredKeywords > 0", () => {
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["monitoring"].status).toBe("ready");
      expect(result.current["monitoring"].metric).toBe("45 keywords");
      expect(result.current["monitoring"].metricValue).toBe(45);
    });

    it("competitors status='ready' with metric when activeCompetitors > 0", () => {
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["competitors"].status).toBe("ready");
      expect(result.current["competitors"].metric).toBe("3 competitors");
      expect(result.current["competitors"].metricValue).toBe(3);
    });

    it("backlinks status='ready' with backlink count metric when backlinkSummary exists", () => {
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["backlinks"].status).toBe("ready");
      expect(result.current["backlinks"].metric).toBe("1250 backlinks");
      expect(result.current["backlinks"].metricValue).toBe(1250);
    });

    it("overview always status='ready'", () => {
      setupQueries();
      const { result } = renderHook(() => useModuleReadiness(DOMAIN_ID));

      expect(result.current["overview"].status).toBe("ready");
    });
  });
});
