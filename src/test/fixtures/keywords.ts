/**
 * Test fixtures for keyword-related data.
 * Shapes match the return types of Convex queries.
 */

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

// Single keyword as returned by getKeywordMonitoring
export function makeKeyword(overrides: Record<string, unknown> = {}) {
  return {
    keywordId: "kw_1" as any,
    domainId: "domain_active_1" as any,
    phrase: "best seo tools",
    currentPosition: 5,
    previousPosition: 8,
    change: 3,
    status: "rising" as const,
    searchVolume: 2400,
    difficulty: 45,
    url: "https://example.com/seo-tools",
    positionHistory: [
      { date: now - 6 * day, position: 12 },
      { date: now - 5 * day, position: 10 },
      { date: now - 4 * day, position: 8 },
      { date: now - 3 * day, position: 8 },
      { date: now - 2 * day, position: 7 },
      { date: now - 1 * day, position: 6 },
      { date: now, position: 5 },
    ],
    lastUpdated: now - 2 * 60 * 60 * 1000,
    potential: 480,
    checkingStatus: undefined,
    cpc: 2.5,
    etv: 1200,
    competition: 0.35,
    competitionLevel: "medium",
    intent: "commercial",
    serpFeatures: ["featured_snippet", "people_also_ask"],
    estimatedPaidTrafficCost: 6000,
    monthlySearches: [
      { year: 2025, month: 1, search_volume: 2200 },
      { year: 2025, month: 2, search_volume: 2400 },
    ],
    isNew: false,
    isUp: true,
    isDown: false,
    proposedBy: null,
    ...overrides,
  };
}

// List of keywords for monitoring table
export const KEYWORD_MONITORING_LIST = [
  makeKeyword(),
  makeKeyword({
    keywordId: "kw_2" as any,
    phrase: "keyword research tool",
    currentPosition: 12,
    previousPosition: 10,
    change: -2,
    status: "falling",
    searchVolume: 1800,
    difficulty: 52,
    isUp: false,
    isDown: true,
  }),
  makeKeyword({
    keywordId: "kw_3" as any,
    phrase: "seo monitoring software",
    currentPosition: 1,
    previousPosition: 1,
    change: 0,
    status: "stable",
    searchVolume: 800,
    difficulty: 38,
    isUp: false,
    isDown: false,
  }),
  makeKeyword({
    keywordId: "kw_4" as any,
    phrase: "position tracker free",
    currentPosition: null,
    previousPosition: null,
    change: null,
    status: "new",
    searchVolume: 500,
    difficulty: 20,
    isNew: true,
    positionHistory: [],
  }),
];

// Monitoring stats shape (api.keywords.getMonitoringStats)
export const MONITORING_STATS = {
  totalKeywords: 45,
  avgPosition: 14.3,
  avgPositionChange7d: 2.1,
  estimatedMonthlyTraffic: 12500,
  movementBreakdown: { gainers: 18, losers: 7, stable: 20 },
  netMovement7d: 11,
};

export const MONITORING_STATS_EMPTY = {
  totalKeywords: 0,
  avgPosition: 0,
  avgPositionChange7d: 0,
  estimatedMonthlyTraffic: 0,
  movementBreakdown: { gainers: 0, losers: 0, stable: 0 },
  netMovement7d: 0,
};

// Generate a large keyword list for pagination testing (50+ items)
export const KEYWORD_MONITORING_LIST_LARGE = Array.from({ length: 52 }, (_, i) =>
  makeKeyword({
    keywordId: `kw_${i + 1}` as any,
    phrase: `keyword ${String(i + 1).padStart(3, "0")}`,
    currentPosition: Math.floor(Math.random() * 50) + 1,
    searchVolume: Math.floor(Math.random() * 5000) + 100,
  })
);

// Keyword currently being checked (spinner state)
export const KEYWORD_CHECKING = makeKeyword({
  keywordId: "kw_checking" as any,
  phrase: "checking keyword",
  checkingStatus: "checking",
  currentPosition: 15,
});

// Keyword queued for check
export const KEYWORD_QUEUED = makeKeyword({
  keywordId: "kw_queued" as any,
  phrase: "queued keyword",
  checkingStatus: "queued",
  currentPosition: 22,
});

// Keyword with null position (unknown/new)
export const KEYWORD_NULL_POSITION = makeKeyword({
  keywordId: "kw_null" as any,
  phrase: "unknown position keyword",
  currentPosition: null,
  previousPosition: null,
  change: null,
  status: "new",
  positionHistory: [],
  isNew: true,
  isUp: false,
  isDown: false,
});

// Keyword with high position (top 3)
export const KEYWORD_TOP3 = makeKeyword({
  keywordId: "kw_top3" as any,
  phrase: "top ranking keyword",
  currentPosition: 2,
  previousPosition: 4,
  change: 2,
  status: "rising",
  searchVolume: 8000,
  difficulty: 72,
});

// Keyword proposed by AI
export const KEYWORD_AI_PROPOSED = makeKeyword({
  keywordId: "kw_ai" as any,
  phrase: "ai suggested seo term",
  currentPosition: 18,
  previousPosition: null,
  change: null,
  status: "new",
  isNew: true,
  proposedBy: "ai",
});

// Keyword with sparkline data (recentPositions)
export const KEYWORD_WITH_SPARKLINE = makeKeyword({
  keywordId: "kw_sparkline" as any,
  phrase: "sparkline keyword",
  currentPosition: 7,
  positionHistory: Array.from({ length: 7 }, (_, i) => ({
    date: now - (6 - i) * day,
    position: 12 - i,
  })),
});

// Mixed list for filter/sort testing
export const KEYWORD_LIST_MIXED = [
  KEYWORD_TOP3,
  makeKeyword({
    keywordId: "kw_top10" as any,
    phrase: "seo analysis platform",
    currentPosition: 8,
    previousPosition: 12,
    change: 4,
    status: "rising",
    searchVolume: 3200,
  }),
  makeKeyword({
    keywordId: "kw_mid" as any,
    phrase: "SEO tools comparison",
    currentPosition: 25,
    previousPosition: 20,
    change: -5,
    status: "falling",
    searchVolume: 1500,
    isUp: false,
    isDown: true,
  }),
  makeKeyword({
    keywordId: "kw_low" as any,
    phrase: "best rank tracking software",
    currentPosition: 55,
    previousPosition: 55,
    change: 0,
    status: "stable",
    searchVolume: 600,
    isUp: false,
    isDown: false,
  }),
  KEYWORD_NULL_POSITION,
  KEYWORD_CHECKING,
];
