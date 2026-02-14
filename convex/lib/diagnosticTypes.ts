/**
 * Shared types for diagnostic helper modules.
 * This file serves as the contract between all diagnostic helper files
 * and the main diagnostic.ts integration point.
 */

import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ─── Input context passed to all diagnostic helper functions ───

export interface DiagnosticInput {
  ctx: QueryCtx;
  domain: Doc<"domains">;
  // Pre-loaded collections
  activeKws: Doc<"keywords">[];
  allKeywords: Doc<"keywords">[];
  discovered: Doc<"discoveredKeywords">[];
  rankedDiscovered: Doc<"discoveredKeywords">[];
  gaps: Doc<"contentGaps">[];
  competitors: Doc<"competitors">[];
  backlinks: Doc<"domainBacklinks">[];
  backlinkSummary: Doc<"domainBacklinksSummary"> | null;
  visHistory: Doc<"domainVisibilityHistory"> | null;
  // Pre-computed monitoring values (from existing diagnostic loop)
  monitoringComputed: {
    top3: number;
    top10: number;
    avgPosition: number;
    totalWithPosition: number;
    gainers7d: number;
    losers7d: number;
  };
  // Pre-computed visibility values (from existing diagnostic loop)
  visibilityComputed: {
    top3: number;
    top10: number;
    avgPosition: number;
    totalKeywords: number;
  };
  // Existing content gap stats (from existing diagnostic loop)
  contentGapComputed: {
    storedHighPriority: number;
    recalcHighPriority: number;
    nanScores: number;
    nanDifficulty: number;
  };
  now: number;
}

// ─── Output types for each diagnostic module ───

/** Module 1: Overview (Przegląd) */
export interface OverviewDiagnostic {
  visibilityMetrics: {
    total: number;
    top3: number;
    top10: number;
    etv: number;
    isUp: number;
    isDown: number;
  } | null;
  actualDiscoveredCounts: { total: number; top3: number; top10: number };
  metricsVsActualDivergence: {
    totalPct: number | null;
    top3Pct: number | null;
    top10Pct: number | null;
  };
  contradictions: string[];
}

/** Module 2 extension: Monitoring position distribution + recentPositions health */
export interface MonitoringExtDiagnostic {
  positionDistribution: Record<string, number>;
  distributionSumMatchesTotal: boolean;
  recentPositionsHealth: { fresh: number; stale7d: number; empty: number };
}

/** Module 3: Keyword Map */
export interface KeywordMapDiagnostic {
  discoveredKeywordsTotal: number;
  discoveredWithNaN: { difficulty: number; searchVolume: number; position: number };
  quickWinCandidates: number;
  quickWinExcludedByNaN: number;
  cannibalizationUrlCount: number;
  monitoredMatchCount: number;
  monitoredNoMatchCount: number;
  contradictions: string[];
}

/** Module 4: Visibility cross-source */
export interface VisibilityDiagnostic {
  fromDiscoveredKeywords: { total: number; top3: number; top10: number; avgPosition: number };
  fromVisibilityHistory: { total: number; top3: number; top10: number } | null;
  divergence: { totalPct: number | null; top3Pct: number | null; top10Pct: number | null };
  contradictions: string[];
}

/** Module 5 extension: Backlinks data quality */
export interface BacklinksExtDiagnostic {
  nullSpamScore: number;
  nullDofollow: number;
  anchorTypeDistribution: Record<string, number>;
  toxicCount: number;
  contradictions: string[];
}

/** Module 6: Link Building */
export interface LinkBuildingDiagnostic {
  totalProspects: number;
  activeProspects: number;
  identifiedProspects: number;
  reviewingProspects: number;
  nanScoring: number;
  insightsVsLinkBuildingNote: string;
  contradictions: string[];
}

/** Module 7 extension: Competitors */
export interface CompetitorsExtDiagnostic {
  perCompetitor: Array<{
    domain: string;
    keywordsCovered: number;
    keywordsTotal: number;
    coveragePct: number;
    latestPositionDate: string | null;
  }>;
  gapDataQuality: {
    nanSearchVolume: number;
    nanDifficulty: number;
    nanOpportunityScore: number;
  };
  contradictions: string[];
}

/** Module 8: On-Site */
export interface OnSiteDiagnostic {
  hasAnalysis: boolean;
  healthScore: number | null;
  lastScanAge: number | null;
  scanStatus: string | null;
  issuesSummary: { critical: number; warning: number; info: number } | null;
  insightsOnsiteScore: number;
  contradictions: string[];
}

/** Module 9 extension: Content Gaps */
export interface ContentGapsExtDiagnostic {
  nanEstimatedTrafficValue: number;
  orphanedGaps: number;
  orphanedCompetitorRefs: number;
  clusterScoreSum: number;
  allGapsScoreSum: number;
  clusterVsAllMatch: boolean;
  contradictions: string[];
}

/** Module 10: Insights */
export interface InsightsDiagnostic {
  healthScore: {
    total: number;
    breakdown: { keywords: number; backlinks: number; onsite: number; content: number };
    mathCorrect: boolean;
    withinBounds: boolean;
  };
  keywordInsightsVsMonitoring: {
    insightsAtRisk: number;
    insightsOpportunities: number;
    monitoringGainers: number;
    monitoringLosers: number;
    note: string;
  };
  backlinkInsightsCrossCheck: {
    toxicCount: number;
    dofollowRatio: number;
    activeProspects: number;
    matchesBacklinksTab: boolean;
    matchesLinkBuildingTab: boolean;
  };
  recommendationsCheck: {
    expectedHighPriority: string[];
    actualHighPriority: string[];
    missingRecommendations: string[];
    unexpectedRecommendations: string[];
  };
  contradictions: string[];
}

/** Module 11: AI Research */
export interface AIResearchDiagnostic {
  totalSessions: number;
  stuckSessions: number;
}

/** Cross-tab contradictions */
export interface CrossTabDiagnostic {
  ct1KeywordCountConsistency: {
    monitoring: number;
    insights: number;
    competitors: number;
    allMatch: boolean;
  };
  ct2ContentGapsHighPriority: {
    contentGapsTab: number;
    insightsTab: number;
    allMatch: boolean;
  };
  ct3ToxicBacklinks: {
    backlinksTab: number;
    insightsTab: number;
    allMatch: boolean;
  };
  ct4LinkBuildingProspects: {
    linkBuildingTab: number;
    insightsTab: number;
    allMatch: boolean;
  };
  contradictions: string[];
}

// ─── Helper: safe percentage divergence calculation ───

export function pctDivergence(a: number, b: number): number | null {
  if (a === 0 && b === 0) return null;
  const max = Math.max(a, b);
  if (max === 0) return null;
  return Math.round((Math.abs(a - b) / max) * 100);
}

export function safeNumber(val: unknown): number {
  if (typeof val !== "number" || isNaN(val)) return 0;
  return val;
}
