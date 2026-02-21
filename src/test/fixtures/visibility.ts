/**
 * Test fixtures for visibility-related data.
 * Shapes match api.domains.getVisibilityStats and api.domains.getTopKeywords return types.
 */

// api.domains.getVisibilityStats
export const VISIBILITY_STATS = {
  totalKeywords: 125,
  avgPosition: 18.4,
  top3Count: 5,
  top10Count: 22,
  top100Count: 98,
  visibilityScore: 34.2,
  visibilityChange: 2.8,
};

export const VISIBILITY_STATS_EMPTY = {
  totalKeywords: 0,
  avgPosition: 0,
  top3Count: 0,
  top10Count: 0,
  top100Count: 0,
  visibilityScore: 0,
  visibilityChange: 0,
};

export const VISIBILITY_STATS_STRONG = {
  totalKeywords: 200,
  avgPosition: 8.2,
  top3Count: 25,
  top10Count: 80,
  top100Count: 190,
  visibilityScore: 72.5,
  visibilityChange: 5.3,
};

// api.domains.getTopKeywords
export const TOP_KEYWORDS = [
  {
    _id: "dk_1" as any,
    phrase: "seo monitoring tool",
    position: 1,
    previousPosition: 2,
    change: 1,
    volume: 3200,
    difficulty: 55,
  },
  {
    _id: "dk_2" as any,
    phrase: "rank tracker",
    position: 2,
    previousPosition: 3,
    change: 1,
    volume: 5400,
    difficulty: 68,
  },
  {
    _id: "dk_3" as any,
    phrase: "keyword position checker",
    position: 3,
    previousPosition: 1,
    change: -2,
    volume: 1800,
    difficulty: 42,
  },
  {
    _id: "dk_4" as any,
    phrase: "serp tracker free",
    position: 7,
    previousPosition: 9,
    change: 2,
    volume: 900,
    difficulty: 28,
  },
  {
    _id: "dk_5" as any,
    phrase: "google rank monitor",
    position: 15,
    previousPosition: null,
    change: null,
    volume: 2100,
    difficulty: 60,
  },
];

export const TOP_KEYWORDS_EMPTY: typeof TOP_KEYWORDS = [];
