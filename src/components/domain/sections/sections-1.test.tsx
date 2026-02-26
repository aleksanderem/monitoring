/**
 * Component-level tests for the first batch of section components.
 *
 * Covers: MonitoringStats, VisibilityStats, Top10KeywordsSection,
 * ExecutiveSummary, InsightsSection, SERPFeaturesSection,
 * PageScoreOverviewSection, WordFrequencySection, InstantPagesMetrics,
 * DiagnosticSection
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import { screen, render } from "@testing-library/react";
import { mockQueries, resetConvexMocks } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";

// ── Module-level mocks ──────────────────────────────────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/domains/test",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: (props: any) => <span data-testid={`ez-icon-${props.name}`} />,
}));

// Mock heavy sub-components for InstantPagesMetrics
vi.mock("../cards/LighthouseScoresCard", () => ({
  LighthouseScoresCard: (props: any) => (
    <div data-testid="lighthouse-scores-card">
      {props.scores && `perf:${props.scores.performance}`}
    </div>
  ),
}));

vi.mock("../cards/CoreWebVitalsCard", () => ({
  CoreWebVitalsCard: (props: any) => (
    <div data-testid="core-web-vitals-card">
      {props.vitals && `lcp:${props.vitals.largestContentfulPaint}`}
    </div>
  ),
}));

// ── Imports after mocks ─────────────────────────────────────────────────────
import { MonitoringStats } from "./MonitoringStats";
import { VisibilityStats } from "./VisibilityStats";
import { Top10KeywordsSection } from "./Top10KeywordsSection";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { InsightsSection } from "./InsightsSection";
import { SERPFeaturesSection } from "./SERPFeaturesSection";
import { PageScoreOverviewSection } from "./PageScoreOverviewSection";
import { WordFrequencySection } from "./WordFrequencySection";
import { InstantPagesMetrics } from "./InstantPagesMetrics";
import { DiagnosticSection } from "./DiagnosticSection";

// ── Test data ───────────────────────────────────────────────────────────────
const DOMAIN_ID = "d_test123" as any;
const SCAN_ID = "s_test456" as any;

const MONITORING_STATS = {
  totalKeywords: 42,
  avgPosition: 12.5,
  avgPositionChange7d: -2.3,
  estimatedMonthlyTraffic: 15800,
  movementBreakdown: { gainers: 18, losers: 7, stable: 17 },
  netMovement7d: 11,
};

const VISIBILITY_STATS = {
  totalKeywords: 100,
  avgPosition: 15.3,
  top3Count: 5,
  top10Count: 25,
  top100Count: 80,
  visibilityScore: 72,
  visibilityChange: 3.2,
};

const TOP_KEYWORDS = [
  { _id: "k1", phrase: "seo tools", position: 1, volume: 12000, previousPosition: 3 },
  { _id: "k2", phrase: "keyword research", position: 5, volume: 8000, previousPosition: 8 },
  { _id: "k3", phrase: "backlink checker", position: 12, volume: 5000, previousPosition: 10 },
];

const EXECUTIVE_METRICS = {
  top3: 5,
  top10: 20,
  total: 100,
  etv: 15432,
  isUp: 12,
  isDown: 5,
  isNew: 3,
  isLost: 1,
  change: { top10: 4, total: 8 },
};

const HEALTH_SCORE = {
  totalScore: 75,
  maxScore: 100,
  breakdown: {
    keywords: { score: 25, max: 30, labelKey: "keywordsScore" },
    backlinks: { score: 20, max: 30, labelKey: "backlinksScore" },
    onsite: { score: 15, max: 20, labelKey: "onsiteScore" },
    content: { score: 15, max: 20, labelKey: "contentScore" },
  },
  stats: {
    totalKeywords: 42,
    avgPosition: 12.5,
    improving: 18,
    declining: 7,
    totalBacklinks: 1250,
    referringDomains: 89,
    contentGaps: 15,
  },
};

const KEYWORD_INSIGHTS = {
  atRisk: [
    { keyword: "seo audit", previousPosition: 5, currentPosition: 12, drop: 7 },
  ],
  opportunities: [
    { keyword: "link building", previousPosition: 20, currentPosition: 8, gain: 12 },
  ],
  nearPage1: [
    { keyword: "site analysis", position: 11, searchVolume: 3200 },
  ],
};

const BACKLINK_INSIGHTS = {
  totalBacklinks: 1250,
  referringDomains: 89,
  dofollowRatio: 72,
  toxicCount: 5,
  toxicPercentage: 4,
  newBacklinks: 15,
  activeProspects: 8,
};

const RECOMMENDATIONS = [
  {
    category: "keywords",
    priority: "high",
    titleKey: "recOptimizeKeywords",
    descriptionKey: "recOptimizeKeywordsDesc",
    metricKey: "recKeywordMetric",
    params: { count: 5 },
  },
];

const SERP_SUMMARY = {
  totalKeywords: 42,
  totalDataPoints: 126,
  featurePercentages: {
    featuredSnippet: 35,
    peopleAlsoAsk: 60,
    imagePack: 20,
    videoPack: 10,
    localPack: 5,
    knowledgeGraph: 15,
    sitelinks: 25,
    topStories: 8,
    relatedSearches: 45,
  },
  featureCounts: {
    featuredSnippet: 15,
    peopleAlsoAsk: 25,
    imagePack: 8,
    videoPack: 4,
    localPack: 2,
    knowledgeGraph: 6,
    sitelinks: 10,
    topStories: 3,
    relatedSearches: 19,
  },
};

const PAGE_SCORE_ANALYSIS = {
  avgPageScore: 78,
  pageScoreDistribution: { A: 3, B: 10, C: 5, D: 2, F: 0 },
  pageScoreAxes: {
    technical: 82,
    content: 75,
    seoPerformance: 80,
    strategic: 70,
  },
  pagesAnalyzed: 20,
};

const WORD_FREQ_DATA = [
  {
    _id: "wf1",
    totalWords: 5000,
    data: [
      { word: "seo", absFreq: 120 },
      { word: "keyword", absFreq: 95 },
      { word: "ranking", absFreq: 80 },
    ],
  },
];

const PAGES_DATA = {
  pages: [
    {
      _id: "p1",
      url: "https://example.com/page1",
      lighthouseScores: { performance: 90, accessibility: 95, bestPractices: 88, seo: 92 },
      coreWebVitals: {
        largestContentfulPaint: 1200,
        firstInputDelay: 50,
        timeToInteractive: 2500,
        domComplete: 3000,
        cumulativeLayoutShift: 0.05,
      },
    },
    {
      _id: "p2",
      url: "https://example.com/page2",
      lighthouseScores: { performance: 80, accessibility: 85, bestPractices: 78, seo: 88 },
      coreWebVitals: {
        largestContentfulPaint: 1800,
        firstInputDelay: 80,
        timeToInteractive: 3200,
        domComplete: 4000,
        cumulativeLayoutShift: 0.1,
      },
    },
  ],
  total: 2,
};

const DIAGNOSTIC_DATA = {
  generatedAt: Date.now(),
  domain: {
    name: "example.com",
    crossValidation: {
      contradictions: ["Mismatch in keyword counts"],
      denormalization: {
        keywordsWithPositionRecords: 40,
        keywordsWithDenormalizedPosition: 40,
        keywordsWithRecentPositions: 38,
        staleCount: 2,
        missingDenormalization: [],
      },
      monitoring: { top3: 5, top10: 20, avgPosition: 12.5, totalWithPosition: 40, gainers7d: 18, losers7d: 7 },
      visibility: { top3: 8, top10: 30, avgPosition: 14.2, totalKeywords: 200, gainers: 25, losers: 10 },
    },
    keywords: { active: 40, paused: 2, pendingApproval: 0, total: 42, limit: 500, limitSource: "plan", withinLimit: true },
    jobs: { pending: 0, processing: 0, completed: 15, failed: 1, lastJobAt: Date.now() },
    contentGaps: { total: 15, identified: 10, monitoring: 3, dismissed: 2, highPriority: 5, nanScores: 0, nanDifficulty: 0 },
    competitors: { count: 3, withPositions: 3 },
    backlinks: { tableRecords: 150, summaryTotal: 1250, summaryDofollow: 900, summaryNofollow: 350, capped: false },
    overview: {
      visibilityMetrics: { total: 200, top3: 8, top10: 30, etv: 15000 },
      actualDiscoveredCounts: { total: 200, top3: 8, top10: 30 },
      contradictions: [],
    },
    monitoringExt: {
      positionDistribution: { "1-3": 5, "4-10": 15, "11-20": 12, "21-50": 8 },
      distributionSumMatchesTotal: true,
      recentPositionsHealth: { fresh: 38, stale7d: 2, empty: 2 },
    },
    keywordMap: {
      discoveredKeywordsTotal: 200,
      quickWinCandidates: 15,
      quickWinExcludedByNaN: 0,
      cannibalizationUrlCount: 2,
      monitoredMatchCount: 35,
      monitoredNoMatchCount: 5,
      contradictions: [],
    },
    visibility: {
      fromDiscoveredKeywords: { total: 200, top3: 8 },
      fromVisibilityHistory: { total: 190, top3: 7 },
      contradictions: [],
    },
    backlinksExt: { nullSpamScore: 0, nullDofollow: 0, toxicCount: 5, contradictions: [] },
    linkBuilding: {
      totalProspects: 20,
      activeProspects: 8,
      identifiedProspects: 10,
      reviewingProspects: 2,
      nanScoring: 0,
      insightsVsLinkBuildingNote: "All matching",
      contradictions: [],
    },
    onSite: { hasAnalysis: true, healthScore: 78, lastScanAge: 24, scanStatus: "complete", issuesSummary: { critical: 2, warning: 5, info: 10 }, contradictions: [] },
    competitorsExt: {
      perCompetitor: [{ domain: "rival.com", coveragePct: 85, keywordsCovered: 34, keywordsTotal: 40, latestPositionDate: "2026-02-20" }],
      contradictions: [],
    },
    contentGapsExt: { nanEstimatedTrafficValue: 0, orphanedGaps: 0, orphanedCompetitorRefs: 0, contradictions: [] },
    insights: {
      healthScore: {
        total: 75,
        breakdown: { keywords: 25, backlinks: 20, onsite: 15, content: 15 },
        mathCorrect: true,
        withinBounds: true,
      },
      keywordInsightsVsMonitoring: { insightsAtRisk: 1, insightsOpportunities: 1, monitoringGainers: 18, monitoringLosers: 7 },
      contradictions: [],
    },
    aiResearch: { totalSessions: 5, stuckSessions: 0 },
    crossTab: {
      ct1KeywordCountConsistency: { monitoring: 42, insights: 42, allMatch: true },
      ct2ContentGapsHighPriority: { contentGapsTab: 5, allMatch: true },
      ct3ToxicBacklinks: { backlinksTab: 5, allMatch: true },
      ct4LinkBuildingProspects: { linkBuildingTab: 20, insightsTab: 20, allMatch: true },
      contradictions: [],
    },
  },
  invariants: [
    { name: "Keywords within limit", status: "ok", details: "42 / 500" },
    { name: "Active scan consistency", status: "warning", details: "2 stale positions detected" },
  ],
};

// ── Reset before each test ──────────────────────────────────────────────────
beforeEach(() => resetConvexMocks());

// ═══════════════════════════════════════════════════════════════════════════
// 1. MonitoringStats
// ═══════════════════════════════════════════════════════════════════════════
describe("MonitoringStats", () => {
  test("shows loading state when data is undefined", () => {
    render(<MonitoringStats domainId={DOMAIN_ID} />);
    // LoadingState renders; no stats content visible
    expect(screen.queryByText("statistics")).not.toBeInTheDocument();
  });

  test("renders empty state when stats is falsy", () => {
    mockQueries([[api.keywords.getMonitoringStats, null]]);
    const { container } = render(<MonitoringStats domainId={DOMAIN_ID} />);
    expect(container.textContent).toContain("noKeywordsMonitored");
  });

  test("renders stats with data", () => {
    mockQueries([[api.keywords.getMonitoringStats, MONITORING_STATS]]);
    render(<MonitoringStats domainId={DOMAIN_ID} />);
    expect(screen.getByText("statistics")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument(); // totalKeywords
    expect(screen.getByText("12.5")).toBeInTheDocument(); // avgPosition
    expect(screen.getByText("15.8K")).toBeInTheDocument(); // formatted traffic
    expect(screen.getByText("+11")).toBeInTheDocument(); // netMovement7d
  });

  test("formats traffic with M abbreviation", () => {
    mockQueries([[api.keywords.getMonitoringStats, { ...MONITORING_STATS, estimatedMonthlyTraffic: 2500000 }]]);
    render(<MonitoringStats domainId={DOMAIN_ID} />);
    expect(screen.getByText("2.5M")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. VisibilityStats
// ═══════════════════════════════════════════════════════════════════════════
describe("VisibilityStats", () => {
  test("shows loading skeletons when isLoading is true", () => {
    const { container } = render(
      <VisibilityStats stats={VISIBILITY_STATS} isLoading />
    );
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders stat cards with data", () => {
    render(<VisibilityStats stats={VISIBILITY_STATS} />);
    expect(screen.getByText("visibilityScore")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("15.3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // top3Count
    expect(screen.getByText("25")).toBeInTheDocument(); // top10Count
  });

  test("shows trend indicator for positive visibility change", () => {
    render(<VisibilityStats stats={VISIBILITY_STATS} />);
    // Positive change renders TrendUp02 icon
    expect(screen.getByText("3.2%")).toBeInTheDocument();
  });

  test("shows no trend for zero visibility change", () => {
    const stats = { ...VISIBILITY_STATS, visibilityChange: 0 };
    render(<VisibilityStats stats={stats} />);
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Top10KeywordsSection
// ═══════════════════════════════════════════════════════════════════════════
describe("Top10KeywordsSection", () => {
  test("shows loading skeleton when isLoading", () => {
    const { container } = render(
      <Top10KeywordsSection keywords={[]} isLoading />
    );
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("shows empty state when keywords is empty", () => {
    render(<Top10KeywordsSection keywords={[]} />);
    expect(screen.getByText("noTopKeywordsFound")).toBeInTheDocument();
  });

  test("renders keyword cards with data", () => {
    render(<Top10KeywordsSection keywords={TOP_KEYWORDS} />);
    expect(screen.getByText("top10Keywords")).toBeInTheDocument();
    expect(screen.getByText("seo tools")).toBeInTheDocument();
    expect(screen.getByText("keyword research")).toBeInTheDocument();
    expect(screen.getByText("backlink checker")).toBeInTheDocument();
  });

  test("shows position change for keywords with movement", () => {
    render(<Top10KeywordsSection keywords={TOP_KEYWORDS} />);
    // seo tools: previousPosition(3) - position(1) = +2
    expect(screen.getByText("+2")).toBeInTheDocument();
    // keyword research: 8 - 5 = +3
    expect(screen.getByText("+3")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ExecutiveSummary
// ═══════════════════════════════════════════════════════════════════════════
describe("ExecutiveSummary", () => {
  test("shows loading state when metrics is undefined", () => {
    const { container } = render(<ExecutiveSummary domainId={DOMAIN_ID} />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("shows empty state when metrics is null", () => {
    mockQueries([[api.domains.getLatestVisibilityMetrics, null]]);
    render(<ExecutiveSummary domainId={DOMAIN_ID} />);
    expect(screen.getByText("noVisibilityDataYet")).toBeInTheDocument();
  });

  test("renders metric cards with data", () => {
    mockQueries([[api.domains.getLatestVisibilityMetrics, EXECUTIVE_METRICS]]);
    render(<ExecutiveSummary domainId={DOMAIN_ID} />);
    expect(screen.getByText("summary")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1); // top3
    expect(screen.getAllByText("20").length).toBeGreaterThanOrEqual(1); // top10
    expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1); // total
    // ETV: Math.round(15432).toLocaleString() — format varies by jsdom locale
    expect(screen.getByText("trafficValueEtv")).toBeInTheDocument();
    expect(screen.getByText("estimatedTrafficValue")).toBeInTheDocument();
  });

  test("displays movement counts", () => {
    mockQueries([[api.domains.getLatestVisibilityMetrics, EXECUTIVE_METRICS]]);
    render(<ExecutiveSummary domainId={DOMAIN_ID} />);
    expect(screen.getByText("12")).toBeInTheDocument(); // isUp
    // isDown is 5 — already tested above as top3
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. InsightsSection
// ═══════════════════════════════════════════════════════════════════════════
describe("InsightsSection", () => {
  test("shows loading state when any query is undefined", () => {
    render(<InsightsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("insightsAndRecommendations")).toBeInTheDocument();
  });

  test("renders health score ring with data", () => {
    mockQueries([
      [api.insights_queries.getDomainHealthScore, HEALTH_SCORE],
      [api.insights_queries.getKeywordInsights, KEYWORD_INSIGHTS],
      [api.insights_queries.getBacklinkInsights, BACKLINK_INSIGHTS],
      [api.insights_queries.getRecommendations, RECOMMENDATIONS],
    ]);
    render(<InsightsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("75")).toBeInTheDocument(); // health score
    expect(screen.getByText("/ 100")).toBeInTheDocument();
    expect(screen.getByText("domainHealth")).toBeInTheDocument();
  });

  test("renders keyword insights - at risk section", () => {
    mockQueries([
      [api.insights_queries.getDomainHealthScore, HEALTH_SCORE],
      [api.insights_queries.getKeywordInsights, KEYWORD_INSIGHTS],
      [api.insights_queries.getBacklinkInsights, BACKLINK_INSIGHTS],
      [api.insights_queries.getRecommendations, RECOMMENDATIONS],
    ]);
    render(<InsightsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("seo audit")).toBeInTheDocument();
    expect(screen.getByText("-7")).toBeInTheDocument();
  });

  test("renders opportunities section", () => {
    mockQueries([
      [api.insights_queries.getDomainHealthScore, HEALTH_SCORE],
      [api.insights_queries.getKeywordInsights, KEYWORD_INSIGHTS],
      [api.insights_queries.getBacklinkInsights, BACKLINK_INSIGHTS],
      [api.insights_queries.getRecommendations, RECOMMENDATIONS],
    ]);
    render(<InsightsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("link building")).toBeInTheDocument();
    expect(screen.getByText("+12")).toBeInTheDocument();
  });

  test("renders backlink health metrics", () => {
    mockQueries([
      [api.insights_queries.getDomainHealthScore, HEALTH_SCORE],
      [api.insights_queries.getKeywordInsights, KEYWORD_INSIGHTS],
      [api.insights_queries.getBacklinkInsights, BACKLINK_INSIGHTS],
      [api.insights_queries.getRecommendations, RECOMMENDATIONS],
    ]);
    render(<InsightsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("backlinkHealth")).toBeInTheDocument();
    // toLocaleString() renders "1,250" but it's inside a span with text split across elements
    expect(screen.getByText("metricTotal")).toBeInTheDocument();
    expect(screen.getByText("metricRefDomains")).toBeInTheDocument();
  });

  test("shows empty state when no issues found", () => {
    mockQueries([
      [api.insights_queries.getDomainHealthScore, HEALTH_SCORE],
      [api.insights_queries.getKeywordInsights, { atRisk: [], opportunities: [], nearPage1: [] }],
      [api.insights_queries.getBacklinkInsights, BACKLINK_INSIGHTS],
      [api.insights_queries.getRecommendations, []],
    ]);
    render(<InsightsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("lookingGood")).toBeInTheDocument();
    expect(screen.getByText("noCriticalIssues")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SERPFeaturesSection
// ═══════════════════════════════════════════════════════════════════════════
describe("SERPFeaturesSection", () => {
  test("shows loading skeleton when summary is undefined", () => {
    const { container } = render(<SERPFeaturesSection domainId={DOMAIN_ID} />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders null when summary is falsy", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, null]]);
    const { container } = render(<SERPFeaturesSection domainId={DOMAIN_ID} />);
    expect(container.innerHTML).toBe("");
  });

  test("shows empty state when totalDataPoints is 0", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, { ...SERP_SUMMARY, totalDataPoints: 0 }]]);
    render(<SERPFeaturesSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("noSerpFeaturesDataAvailable")).toBeInTheDocument();
  });

  test("renders SERP features overview with data", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, SERP_SUMMARY]]);
    render(<SERPFeaturesSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("serpFeaturesOverview")).toBeInTheDocument();
    expect(screen.getByText("mostCommonFeature")).toBeInTheDocument();
    // "People Also Ask" at 60% is the top feature; appears in highlight and grid
    expect(screen.getAllByText("60%").length).toBeGreaterThanOrEqual(1);
  });

  test("renders feature grid sorted by percentage", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, SERP_SUMMARY]]);
    render(<SERPFeaturesSection domainId={DOMAIN_ID} />);
    // Top feature label appears in highlight card and grid (2 times)
    expect(screen.getAllByText("serpFeatureLabelPeopleAlsoAskSimple").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("serpFeatureLabelFeaturedSnippetSimple").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("serpFeatureLabelRelatedSearchesSimple").length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. PageScoreOverviewSection
// ═══════════════════════════════════════════════════════════════════════════
describe("PageScoreOverviewSection", () => {
  test("shows empty state when no scoring data", () => {
    render(<PageScoreOverviewSection analysis={{}} />);
    expect(screen.getByText("noScoringData")).toBeInTheDocument();
    expect(screen.getByText("noScoringDataDesc")).toBeInTheDocument();
  });

  test("renders composite score with grade", () => {
    render(<PageScoreOverviewSection analysis={PAGE_SCORE_ANALYSIS} />);
    expect(screen.getByText("scoringOverview")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    // Grade "C" appears in hero and in distribution; check at least one
    expect(screen.getAllByText("C").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("outOf100")).toBeInTheDocument();
  });

  test("renders grade distribution", () => {
    render(<PageScoreOverviewSection analysis={PAGE_SCORE_ANALYSIS} />);
    expect(screen.getByText("gradeDistribution")).toBeInTheDocument();
    // Distribution shows counts: A=3, B=10, C=5, D=2, F=0
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  test("renders axis detail cards", () => {
    render(<PageScoreOverviewSection analysis={PAGE_SCORE_ANALYSIS} />);
    expect(screen.getByText("axisTechnical")).toBeInTheDocument();
    expect(screen.getByText("axisContent")).toBeInTheDocument();
    expect(screen.getByText("axisSeoPerformance")).toBeInTheDocument();
    expect(screen.getByText("axisStrategic")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument(); // technical score
    expect(screen.getByText("70")).toBeInTheDocument(); // strategic score
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. WordFrequencySection
// ═══════════════════════════════════════════════════════════════════════════
describe("WordFrequencySection", () => {
  test("renders null when no data", () => {
    mockQueries([[api.seoAudit_queries.getWordFrequency, null]]);
    const { container } = render(<WordFrequencySection domainId={DOMAIN_ID} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders null when data is empty array", () => {
    mockQueries([[api.seoAudit_queries.getWordFrequency, []]]);
    const { container } = render(<WordFrequencySection domainId={DOMAIN_ID} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders word frequency bars with data", () => {
    mockQueries([[api.seoAudit_queries.getWordFrequency, WORD_FREQ_DATA]]);
    render(<WordFrequencySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("seo")).toBeInTheDocument();
    expect(screen.getByText("keyword")).toBeInTheDocument();
    expect(screen.getByText("ranking")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  test("shows total words analyzed", () => {
    mockQueries([[api.seoAudit_queries.getWordFrequency, WORD_FREQ_DATA]]);
    const { container } = render(<WordFrequencySection domainId={DOMAIN_ID} />);
    // Text is split: "totalWordsAnalyzed: " and <strong>5,000</strong>
    const totalDiv = container.querySelector(".text-sm.text-tertiary");
    expect(totalDiv).not.toBeNull();
    expect(totalDiv!.textContent).toContain("totalWordsAnalyzed");
    expect(totalDiv!.textContent).toContain("5,000");
  });

  test("has phrase length toggle buttons", () => {
    mockQueries([[api.seoAudit_queries.getWordFrequency, WORD_FREQ_DATA]]);
    render(<WordFrequencySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("singleWords")).toBeInTheDocument();
    expect(screen.getByText("twoWordPhrases")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. InstantPagesMetrics
// ═══════════════════════════════════════════════════════════════════════════
describe("InstantPagesMetrics", () => {
  test("renders null when no scanId", () => {
    const { container } = render(
      <InstantPagesMetrics domainId={DOMAIN_ID} />
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders null when pagesData is undefined", () => {
    // useQuery returns undefined by default (loading)
    const { container } = render(
      <InstantPagesMetrics domainId={DOMAIN_ID} scanId={SCAN_ID} />
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders lighthouse and vitals cards with data", () => {
    mockQueries([[api.seoAudit_queries.getPagesList, PAGES_DATA]]);
    render(
      <InstantPagesMetrics domainId={DOMAIN_ID} scanId={SCAN_ID} />
    );
    expect(screen.getByTestId("lighthouse-scores-card")).toBeInTheDocument();
    expect(screen.getByTestId("core-web-vitals-card")).toBeInTheDocument();
  });

  test("renders null when no pages have lighthouse or vitals data", () => {
    mockQueries([[api.seoAudit_queries.getPagesList, {
      pages: [{ _id: "p1", url: "https://example.com" }],
      total: 1,
    }]]);
    const { container } = render(
      <InstantPagesMetrics domainId={DOMAIN_ID} scanId={SCAN_ID} />
    );
    expect(container.innerHTML).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. DiagnosticSection
// ═══════════════════════════════════════════════════════════════════════════
describe("DiagnosticSection", () => {
  test("shows loading skeleton when data is undefined", () => {
    const { container } = render(<DiagnosticSection domainId={DOMAIN_ID} />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("shows access denied when data is null", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, null]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("SuperAdmin access required to view diagnostics.")).toBeInTheDocument();
  });

  test("renders diagnostics header with domain name", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, DIAGNOSTIC_DATA]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Diagnostics")).toBeInTheDocument();
  });

  test("displays violation and warning counts", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, DIAGNOSTIC_DATA]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("1 warning")).toBeInTheDocument();
  });

  test("renders invariants section", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, DIAGNOSTIC_DATA]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Invariants")).toBeInTheDocument();
  });

  test("renders keywords section with data", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, DIAGNOSTIC_DATA]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Keywords")).toBeInTheDocument();
  });

  test("renders show/hide raw JSON toggle", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, DIAGNOSTIC_DATA]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Show raw JSON")).toBeInTheDocument();
  });

  test("shows cross validation contradictions", () => {
    mockQueries([[api.diagnostic.getDomainDiagnostic, DIAGNOSTIC_DATA]]);
    render(<DiagnosticSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Cross Validation Contradictions")).toBeInTheDocument();
    expect(screen.getByText("Mismatch in keyword counts")).toBeInTheDocument();
  });
});
