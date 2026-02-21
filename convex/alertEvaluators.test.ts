import { describe, it, expect } from "vitest";
import {
  evaluatePositionDrop,
  evaluateTopNExit,
  evaluateNewCompetitor,
  evaluateBacklinkLost,
  evaluateVisibilityDrop,
} from "./alertEvaluators";
import type { Doc, Id } from "./_generated/dataModel";

// ============================================================
// Test helpers — minimal Doc stubs for pure evaluator testing
// ============================================================

function makeRule(overrides: Partial<Doc<"alertRules">> = {}): Doc<"alertRules"> {
  return {
    _id: "rule_1" as Id<"alertRules">,
    _creationTime: Date.now(),
    domainId: "domain_1" as Id<"domains">,
    name: "Test Rule",
    ruleType: "position_drop",
    isActive: true,
    threshold: 5,
    cooldownMinutes: 1440,
    notifyVia: ["in_app"],
    createdBy: "user_1" as Id<"users">,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Doc<"alertRules">;
}

function makeKeyword(overrides: Partial<Doc<"keywords">> = {}): Doc<"keywords"> {
  return {
    _id: "kw_1" as Id<"keywords">,
    _creationTime: Date.now(),
    domainId: "domain_1" as Id<"domains">,
    phrase: "best seo tools",
    currentPosition: 10,
    previousPosition: 5,
    positionChange: -5,
    status: "active",
    ...overrides,
  } as Doc<"keywords">;
}

// ============================================================
// evaluatePositionDrop
// ============================================================

describe("evaluatePositionDrop", () => {
  const rule = makeRule({ threshold: 5, ruleType: "position_drop" });

  it("triggers when position drops by more than threshold", () => {
    const keywords = [
      makeKeyword({ previousPosition: 3, currentPosition: 15 }), // drop = 12 > 5
    ];
    const triggers = evaluatePositionDrop(rule, keywords);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].previousValue).toBe(3);
    expect(triggers[0].currentValue).toBe(15);
    expect(triggers[0].keywordPhrase).toBe("best seo tools");
  });

  it("does not trigger when drop equals threshold (must exceed)", () => {
    const keywords = [
      makeKeyword({ previousPosition: 5, currentPosition: 10 }), // drop = 5 == threshold
    ];
    const triggers = evaluatePositionDrop(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("does not trigger when position improves", () => {
    const keywords = [
      makeKeyword({ previousPosition: 10, currentPosition: 3 }), // improved
    ];
    const triggers = evaluatePositionDrop(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("does not trigger when currentPosition is null", () => {
    const keywords = [
      makeKeyword({ previousPosition: 5, currentPosition: null as any }),
    ];
    const triggers = evaluatePositionDrop(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("does not trigger when previousPosition is null", () => {
    const keywords = [
      makeKeyword({ previousPosition: null as any, currentPosition: 20 }),
    ];
    const triggers = evaluatePositionDrop(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("returns multiple triggers for multiple affected keywords", () => {
    const keywords = [
      makeKeyword({ _id: "kw_1" as Id<"keywords">, phrase: "seo tools", previousPosition: 2, currentPosition: 20 }),
      makeKeyword({ _id: "kw_2" as Id<"keywords">, phrase: "seo software", previousPosition: 3, currentPosition: 3 }),
      makeKeyword({ _id: "kw_3" as Id<"keywords">, phrase: "seo audit", previousPosition: 1, currentPosition: 50 }),
    ];
    const triggers = evaluatePositionDrop(rule, keywords);
    expect(triggers).toHaveLength(2);
    expect(triggers.map((t) => t.keywordPhrase)).toEqual(["seo tools", "seo audit"]);
  });

  it("returns empty array for empty keywords list", () => {
    const triggers = evaluatePositionDrop(rule, []);
    expect(triggers).toHaveLength(0);
  });
});

// ============================================================
// evaluateTopNExit
// ============================================================

describe("evaluateTopNExit", () => {
  const rule = makeRule({ threshold: 10, topN: 10, ruleType: "top_n_exit" });

  it("triggers when keyword exits top N", () => {
    const keywords = [
      makeKeyword({ previousPosition: 8, currentPosition: 15 }),
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].previousValue).toBe(8);
    expect(triggers[0].currentValue).toBe(15);
  });

  it("triggers when keyword falls out of ranking (currentPosition null)", () => {
    const keywords = [
      makeKeyword({ previousPosition: 5, currentPosition: null as any }),
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].details).toContain("not ranking");
  });

  it("does not trigger when keyword was already outside top N", () => {
    const keywords = [
      makeKeyword({ previousPosition: 15, currentPosition: 30 }),
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("does not trigger when keyword stays in top N", () => {
    const keywords = [
      makeKeyword({ previousPosition: 3, currentPosition: 7 }),
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("does not trigger when keyword is exactly at top N boundary", () => {
    const keywords = [
      makeKeyword({ previousPosition: 10, currentPosition: 10 }), // still at boundary
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(0);
  });

  it("triggers when keyword was at boundary and exits", () => {
    const keywords = [
      makeKeyword({ previousPosition: 10, currentPosition: 11 }),
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(1);
  });

  it("falls back to threshold when topN is not set", () => {
    const ruleNoTopN = makeRule({ threshold: 3, ruleType: "top_n_exit" });
    const keywords = [
      makeKeyword({ previousPosition: 2, currentPosition: 5 }),
    ];
    const triggers = evaluateTopNExit(ruleNoTopN, keywords);
    expect(triggers).toHaveLength(1);
  });

  it("does not trigger when previousPosition is null", () => {
    const keywords = [
      makeKeyword({ previousPosition: null as any, currentPosition: 15 }),
    ];
    const triggers = evaluateTopNExit(rule, keywords);
    expect(triggers).toHaveLength(0);
  });
});

// ============================================================
// evaluateNewCompetitor
// ============================================================

describe("evaluateNewCompetitor", () => {
  const rule = makeRule({ ruleType: "new_competitor", threshold: 0 });

  it("detects new domains in SERP results", () => {
    const today = new Set(["competitor-a.com", "competitor-b.com", "newguy.com"]);
    const yesterday = new Set(["competitor-a.com", "competitor-b.com"]);
    const triggers = evaluateNewCompetitor(rule, today, yesterday, "mysite.com");
    expect(triggers).toHaveLength(1);
    expect(triggers[0].competitorDomain).toBe("newguy.com");
  });

  it("excludes own domain from results", () => {
    const today = new Set(["mysite.com", "newguy.com"]);
    const yesterday = new Set<string>();
    const triggers = evaluateNewCompetitor(rule, today, yesterday, "mysite.com");
    expect(triggers).toHaveLength(1);
    expect(triggers[0].competitorDomain).toBe("newguy.com");
  });

  it("returns empty when no new domains", () => {
    const today = new Set(["competitor-a.com"]);
    const yesterday = new Set(["competitor-a.com"]);
    const triggers = evaluateNewCompetitor(rule, today, yesterday, "mysite.com");
    expect(triggers).toHaveLength(0);
  });

  it("returns empty when today SERP is empty", () => {
    const today = new Set<string>();
    const yesterday = new Set(["competitor-a.com"]);
    const triggers = evaluateNewCompetitor(rule, today, yesterday, "mysite.com");
    expect(triggers).toHaveLength(0);
  });

  it("detects multiple new competitors", () => {
    const today = new Set(["a.com", "b.com", "c.com"]);
    const yesterday = new Set(["a.com"]);
    const triggers = evaluateNewCompetitor(rule, today, yesterday, "mysite.com");
    expect(triggers).toHaveLength(2);
    expect(triggers.map((t) => t.competitorDomain).sort()).toEqual(["b.com", "c.com"]);
  });
});

// ============================================================
// evaluateBacklinkLost
// ============================================================

describe("evaluateBacklinkLost", () => {
  const rule = makeRule({ threshold: 10, ruleType: "backlink_lost" });

  it("triggers when lost backlinks exceed threshold", () => {
    const result = evaluateBacklinkLost(rule, { lostBacklinks: 15, date: "2026-02-21" });
    expect(result).not.toBeNull();
    expect(result!.currentValue).toBe(15);
    expect(result!.details).toContain("Lost 15 backlinks");
  });

  it("does not trigger when lost backlinks equal threshold (must exceed)", () => {
    const result = evaluateBacklinkLost(rule, { lostBacklinks: 10, date: "2026-02-21" });
    expect(result).toBeNull();
  });

  it("does not trigger when lost backlinks below threshold", () => {
    const result = evaluateBacklinkLost(rule, { lostBacklinks: 3, date: "2026-02-21" });
    expect(result).toBeNull();
  });

  it("returns null when velocity data is null", () => {
    const result = evaluateBacklinkLost(rule, null);
    expect(result).toBeNull();
  });

  it("does not trigger when zero backlinks lost", () => {
    const result = evaluateBacklinkLost(rule, { lostBacklinks: 0, date: "2026-02-21" });
    expect(result).toBeNull();
  });
});

// ============================================================
// evaluateVisibilityDrop
// ============================================================

describe("evaluateVisibilityDrop", () => {
  const rule = makeRule({ threshold: 20, ruleType: "visibility_drop" });

  it("triggers when ETV drops more than threshold %", () => {
    const result = evaluateVisibilityDrop(rule, { etv: 60 }, { etv: 100 });
    expect(result).not.toBeNull();
    expect(result!.previousValue).toBe(100);
    expect(result!.currentValue).toBe(60);
    expect(result!.details).toContain("40.0%");
  });

  it("does not trigger when drop equals threshold exactly", () => {
    // 20% drop: 100 -> 80
    const result = evaluateVisibilityDrop(rule, { etv: 80 }, { etv: 100 });
    expect(result).toBeNull();
  });

  it("does not trigger when visibility improves", () => {
    const result = evaluateVisibilityDrop(rule, { etv: 120 }, { etv: 100 });
    expect(result).toBeNull();
  });

  it("falls back to count when etv is not available", () => {
    const result = evaluateVisibilityDrop(rule, { count: 40 }, { count: 100 });
    expect(result).not.toBeNull();
    expect(result!.details).toContain("60.0%");
  });

  it("returns null when current data is null", () => {
    const result = evaluateVisibilityDrop(rule, null, { etv: 100 });
    expect(result).toBeNull();
  });

  it("returns null when previous data is null", () => {
    const result = evaluateVisibilityDrop(rule, { etv: 80 }, null);
    expect(result).toBeNull();
  });

  it("returns null when previous value is zero (avoids division by zero)", () => {
    const result = evaluateVisibilityDrop(rule, { etv: 50 }, { etv: 0 });
    expect(result).toBeNull();
  });

  it("prefers etv over count when both available", () => {
    // etv shows 10% drop (< 20% threshold), count shows 50% drop (> 20% threshold)
    // Should use etv and NOT trigger
    const result = evaluateVisibilityDrop(
      rule,
      { etv: 90, count: 50 },
      { etv: 100, count: 100 }
    );
    expect(result).toBeNull();
  });

  it("rounds values in the result", () => {
    const result = evaluateVisibilityDrop(rule, { etv: 33.3 }, { etv: 100 });
    expect(result).not.toBeNull();
    expect(result!.currentValue).toBe(33);
    expect(result!.previousValue).toBe(100);
  });
});
