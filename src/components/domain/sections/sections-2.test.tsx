/**
 * Component-level tests for section components batch 2:
 * BacklinkProfileSection, BacklinksSummaryStats, ContentGapSection,
 * CrawlAnalyticsSection, IssuesBreakdownSection, KeywordMapSection,
 * LinkBuildingSection, OnSiteSection, AuditSectionsBreakdown, RobotsAnalysisCard
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { mockQueries, resetConvexMocks } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";

// ── Component imports ────────────────────────────────────────────────
import { BacklinkProfileSection } from "./BacklinkProfileSection";
import { BacklinksSummaryStats } from "./BacklinksSummaryStats";
import { ContentGapSection } from "./ContentGapSection";
import { CrawlAnalyticsSection } from "./CrawlAnalyticsSection";
import { IssuesBreakdownSection } from "./IssuesBreakdownSection";
import { KeywordMapSection } from "./KeywordMapSection";
import { LinkBuildingSection } from "./LinkBuildingSection";
import { OnSiteSection } from "./OnSiteSection";
import { AuditSectionsBreakdown } from "./AuditSectionsBreakdown";
import { RobotsAnalysisCard } from "./RobotsAnalysisCard";

// ── Override next-intl mock ──────────────────────────────────────────
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}(${JSON.stringify(params)})`;
      return key;
    },
    useLocale: () => "en",
    useFormatter: () => ({
      number: (v: number) => String(v),
      dateTime: (v: Date) => v.toISOString(),
    }),
  };
});

// ── Convex mock ──────────────────────────────────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/domains/test-domain-id",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "test-domain-id" }),
}));

// ── Permissions mock (all allowed) ───────────────────────────────────
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: [
      "domains.create", "domains.edit", "domains.delete",
      "keywords.add", "keywords.refresh",
      "competitors.add", "competitors.analyze",
      "audit.run", "links.manage",
    ],
    modules: ["positioning", "backlinks", "seo_audit", "competitors", "link_building"],
    can: () => true,
    hasModule: () => true,
    isLoading: false,
  }),
}));

// ── UI / third-party mocks ───────────────────────────────────────────
vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: () => <span data-testid="ez-icon" />,
}));

vi.mock("@/components/base/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-aria-components", () => {
  const R = require("react");
  const passthrough = ({ children }: any) => R.createElement("div", null, children);
  return {
    Tooltip: passthrough,
    TooltipTrigger: passthrough,
    Button: ({ children, onPress, ...props }: any) =>
      R.createElement("button", { onClick: onPress, ...props }, children),
  };
});

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({ children, onClick, onPress, isDisabled, ...rest }: any) =>
    React.createElement(
      "button",
      { onClick: onClick || onPress, disabled: isDisabled, "data-testid": "btn" },
      children
    ),
}));

vi.mock("@/components/application/section-headers/section-label", () => ({
  SectionLabel: {
    Root: ({ title, description }: any) => (
      <div data-testid="section-label">
        <span>{title}</span>
        <span>{description}</span>
      </div>
    ),
  },
}));

vi.mock("@/lib/generateLinkBuildingReportPdf", () => ({
  generateLinkBuildingReportPdf: vi.fn(() => Promise.resolve(new Blob())),
}));

// ── Mock heavy child components to avoid deep import chains ──────────
// BacklinkProfileSection children
vi.mock("../charts/AnchorTextDistributionChart", () => ({
  AnchorTextDistributionChart: () => <div data-testid="anchor-text-chart" />,
}));
vi.mock("../charts/ReferringDomainQualityChart", () => ({
  ReferringDomainQualityChart: () => <div data-testid="referring-domain-chart" />,
}));
vi.mock("../tables/AnchorTextTable", () => ({
  AnchorTextTable: () => <div data-testid="anchor-text-table" />,
}));
vi.mock("../tables/ToxicLinksTable", () => ({
  ToxicLinksTable: () => <div data-testid="toxic-links-table" />,
}));
vi.mock("../tables/ReferringDomainsTable", () => ({
  ReferringDomainsTable: () => <div data-testid="referring-domains-table" />,
}));
vi.mock("../tables/BacklinkGapTable", () => ({
  BacklinkGapTable: () => <div data-testid="backlink-gap-table" />,
}));

// ContentGapSection children
vi.mock("../cards/GapSummaryCards", () => ({
  GapSummaryCards: ({ isLoading }: any) => (
    <div data-testid="gap-summary-cards" data-loading={isLoading ? "true" : "false"} />
  ),
}));
vi.mock("../tables/ContentGapOpportunitiesTable", () => ({
  ContentGapOpportunitiesTable: () => <div data-testid="gap-opportunities-table" />,
}));
vi.mock("../charts/ContentGapTrendsChart", () => ({
  ContentGapTrendsChart: () => <div data-testid="gap-trends-chart" />,
}));
vi.mock("../charts/ContentGapBubbleChart", () => ({
  ContentGapBubbleChart: () => <div data-testid="gap-bubble-chart" />,
}));
vi.mock("../cards/TopicClustersCard", () => ({
  TopicClustersCard: () => <div data-testid="topic-clusters-card" />,
}));
vi.mock("../cards/CompetitorGapComparisonCard", () => ({
  CompetitorGapComparisonCard: () => <div data-testid="competitor-gap-card" />,
}));
vi.mock("../modals/AddCompetitorModal", () => ({
  AddCompetitorModal: ({ isOpen }: any) => (
    isOpen ? <div data-testid="add-competitor-modal" /> : null
  ),
}));

// CrawlAnalyticsSection children
vi.mock("../tables/CrawlLinksTable", () => ({
  CrawlLinksTable: () => <div data-testid="crawl-links-table" />,
}));
vi.mock("../tables/RedirectChainsTable", () => ({
  RedirectChainsTable: () => <div data-testid="redirect-chains-table" />,
}));
vi.mock("../tables/ImageAnalysisTable", () => ({
  ImageAnalysisTable: () => <div data-testid="image-analysis-table" />,
}));
vi.mock("./WordFrequencySection", () => ({
  WordFrequencySection: () => <div data-testid="word-frequency-section" />,
}));
vi.mock("../cards/RobotsTestResultsCard", () => ({
  RobotsTestResultsCard: () => <div data-testid="robots-test-card" />,
}));
vi.mock("../tables/PageSpeedTab", () => ({
  PageSpeedTab: () => <div data-testid="page-speed-tab" />,
}));

// KeywordMapSection children
vi.mock("../charts/KeywordMapBubbleChart", () => ({
  KeywordMapBubbleChart: () => <div data-testid="keyword-map-bubble-chart" />,
}));
vi.mock("../charts/IntentDistributionChart", () => ({
  IntentDistributionChart: () => <div data-testid="intent-distribution-chart" />,
}));
vi.mock("../charts/DifficultyDistributionChart", () => ({
  DifficultyDistributionChart: () => <div data-testid="difficulty-distribution-chart" />,
}));
vi.mock("../tables/QuickWinsTable", () => ({
  QuickWinsTable: () => <div data-testid="quick-wins-table" />,
}));
vi.mock("../tables/CompetitorOverlapTable", () => ({
  CompetitorOverlapTable: () => <div data-testid="competitor-overlap-table" />,
}));
vi.mock("../tables/CannibalizationTable", () => ({
  CannibalizationTable: () => <div data-testid="cannibalization-table" />,
}));

// LinkBuildingSection children
vi.mock("../cards/LinkBuildingStatsCards", () => ({
  LinkBuildingStatsCards: () => <div data-testid="link-building-stats-cards" />,
}));
vi.mock("../tables/LinkBuildingProspectsTable", () => ({
  LinkBuildingProspectsTable: () => <div data-testid="link-building-prospects-table" />,
}));

// OnSiteSection children
vi.mock("../cards/OnSiteHealthCard", () => ({
  OnSiteHealthCard: () => <div data-testid="on-site-health-card" />,
}));
vi.mock("../tables/OnSitePagesTable", () => ({
  OnSitePagesTable: () => <div data-testid="on-site-pages-table" />,
}));
vi.mock("../cards/IssuesSummaryCards", () => ({
  IssuesSummaryCards: () => <div data-testid="issues-summary-cards" />,
}));
vi.mock("./IssuesBreakdownSection", () => ({
  IssuesBreakdownSection: () => <div data-testid="issues-breakdown-mock" />,
}));
vi.mock("../modals/UrlSelectionModal", () => ({
  UrlSelectionModal: ({ isOpen }: any) => (
    isOpen ? <div data-testid="url-selection-modal" /> : null
  ),
}));
vi.mock("./InstantPagesMetrics", () => ({
  InstantPagesMetrics: () => <div data-testid="instant-pages-metrics" />,
}));
vi.mock("./SitemapOverviewCard", () => ({
  SitemapOverviewCard: () => <div data-testid="sitemap-overview-card" />,
}));
// RobotsAnalysisCard is imported directly in OnSiteSection but we test it separately
// so we mock it only for OnSiteSection by mocking the import path used there
vi.mock("./RobotsAnalysisCard", () => ({
  RobotsAnalysisCard: () => <div data-testid="robots-analysis-card-mock" />,
}));
vi.mock("../cards/CrawlSummaryCards", () => ({
  CrawlSummaryCards: () => <div data-testid="crawl-summary-cards" />,
}));
vi.mock("./CrawlAnalyticsSection", () => ({
  CrawlAnalyticsSection: () => <div data-testid="crawl-analytics-mock" />,
}));
vi.mock("./AuditSectionsBreakdown", () => ({
  AuditSectionsBreakdown: () => <div data-testid="audit-sections-mock" />,
}));
vi.mock("./PageScoreOverviewSection", () => ({
  PageScoreOverviewSection: () => <div data-testid="page-score-overview" />,
}));

// IssuesBreakdownSection children
vi.mock("../modals/PagesIssueModal", () => ({
  PagesIssueModal: ({ isOpen }: any) => (
    isOpen ? <div data-testid="pages-issue-modal" /> : null
  ),
}));

beforeEach(() => resetConvexMocks());

// ═════════════════════════════════════════════════════════════════════
// 1. BacklinkProfileSection
// ═════════════════════════════════════════════════════════════════════
describe("BacklinkProfileSection", () => {
  test("renders all child chart and table components", () => {
    renderWithProviders(
      <BacklinkProfileSection domainId={"d1" as any} />
    );
    expect(screen.getByTestId("anchor-text-chart")).toBeDefined();
    expect(screen.getByTestId("referring-domain-chart")).toBeDefined();
    expect(screen.getByTestId("anchor-text-table")).toBeDefined();
    expect(screen.getByTestId("referring-domains-table")).toBeDefined();
    expect(screen.getByTestId("toxic-links-table")).toBeDefined();
    expect(screen.getByTestId("backlink-gap-table")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 2. BacklinksSummaryStats
// ═════════════════════════════════════════════════════════════════════
describe("BacklinksSummaryStats", () => {
  test("renders loading skeleton when isLoading=true", () => {
    const { container } = renderWithProviders(
      <BacklinksSummaryStats summary={null} isLoading />
    );
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(4);
  });

  test("renders empty state when summary is null and not loading", () => {
    renderWithProviders(
      <BacklinksSummaryStats summary={null} isLoading={false} />
    );
    expect(screen.getByText("noBacklinkDataAvailable")).toBeDefined();
    expect(screen.getByText("clickFetchBacklinks")).toBeDefined();
  });

  test("renders stat cards when summary data is provided", () => {
    const summary = {
      totalBacklinks: 5000,
      totalDomains: 120,
      totalIps: 80,
      dofollow: 4000,
      nofollow: 1000,
    };
    renderWithProviders(
      <BacklinksSummaryStats summary={summary} />
    );
    expect(screen.getByText("summaryTotalBacklinks")).toBeDefined();
    expect(screen.getByText("summaryReferringDomains")).toBeDefined();
    expect(screen.getByText("summaryReferringIPs")).toBeDefined();
    expect(screen.getByText("summaryDofollowLinks")).toBeDefined();
    // Values rendered via toLocaleString (jsdom may not format with commas)
    expect(screen.getByText(/5.?000/)).toBeDefined();
    expect(screen.getByText("120")).toBeDefined();
    expect(screen.getByText("80")).toBeDefined();
    expect(screen.getByText(/4.?000/)).toBeDefined();
  });

  test("calculates dofollow percentage correctly", () => {
    const summary = {
      totalBacklinks: 200,
      totalDomains: 10,
      totalIps: 5,
      dofollow: 150,
      nofollow: 50,
    };
    renderWithProviders(
      <BacklinksSummaryStats summary={summary} />
    );
    // 150/200 = 75.0%, nofollow = 50
    expect(
      screen.getByText(
        'summaryDofollowPercent({"percent":"75.0","nofollow":"50"})'
      )
    ).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 3. ContentGapSection
// ═════════════════════════════════════════════════════════════════════
describe("ContentGapSection", () => {
  test("renders section label and child components with undefined queries (loading)", () => {
    renderWithProviders(
      <ContentGapSection domainId={"d1" as any} />
    );
    expect(screen.getByTestId("section-label")).toBeDefined();
    // While gapSummary is undefined, GapSummaryCards gets isLoading
    expect(screen.getByTestId("gap-summary-cards")).toBeDefined();
    expect(screen.getByTestId("gap-trends-chart")).toBeDefined();
    expect(screen.getByTestId("gap-bubble-chart")).toBeDefined();
    expect(screen.getByTestId("topic-clusters-card")).toBeDefined();
    expect(screen.getByTestId("gap-opportunities-table")).toBeDefined();
  });

  test("renders GapSummaryCards with data when query resolves", () => {
    mockQueries([
      [api.contentGaps_queries.getGapSummary, {
        totalGaps: 25,
        highPriority: 5,
        totalEstimatedValue: 1000,
        competitorsAnalyzed: 3,
        lastAnalyzedAt: Date.now(),
      }],
      [api.competitors.getCompetitors, [
        { _id: "c1", domain: "rival.com", status: "active" },
      ]],
    ]);
    renderWithProviders(
      <ContentGapSection domainId={"d1" as any} />
    );
    const cards = screen.getByTestId("gap-summary-cards");
    expect(cards.getAttribute("data-loading")).toBe("false");
  });

  test("shows add competitor and refresh buttons", () => {
    mockQueries([
      [api.competitors.getCompetitors, [
        { _id: "c1", domain: "rival.com", status: "active" },
      ]],
    ]);
    renderWithProviders(
      <ContentGapSection domainId={"d1" as any} />
    );
    expect(screen.getByText("contentGapAddCompetitor")).toBeDefined();
    expect(screen.getByText("contentGapRefreshAnalysis")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 4. CrawlAnalyticsSection
// ═════════════════════════════════════════════════════════════════════
describe("CrawlAnalyticsSection", () => {
  test("returns null when availability query is undefined", async () => {
    const mod = await vi.importActual<typeof import("./CrawlAnalyticsSection")>(
      "./CrawlAnalyticsSection"
    );
    const RealComponent = mod.CrawlAnalyticsSection;
    const { container } = renderWithProviders(
      <RealComponent domainId={"d1" as any} />
    );
    expect(container.querySelector(".bg-primary")).toBeNull();
  });

  test("returns null when no data is available", async () => {
    const mod = await vi.importActual<typeof import("./CrawlAnalyticsSection")>(
      "./CrawlAnalyticsSection"
    );
    const RealComponent = mod.CrawlAnalyticsSection;
    mockQueries([
      [api.seoAudit_queries.getCrawlAnalyticsAvailability, {
        hasLinks: false,
        hasRedirects: false,
        hasImages: false,
        hasPageSpeed: false,
        hasWordFreq: false,
        hasRobotsTest: false,
      }],
    ]);
    const { container } = renderWithProviders(
      <RealComponent domainId={"d1" as any} />
    );
    expect(container.querySelector(".bg-primary")).toBeNull();
  });

  test("renders tab navigation and default tab content when data available", async () => {
    const mod = await vi.importActual<typeof import("./CrawlAnalyticsSection")>(
      "./CrawlAnalyticsSection"
    );
    const RealComponent = mod.CrawlAnalyticsSection;
    mockQueries([
      [api.seoAudit_queries.getCrawlAnalyticsAvailability, {
        hasLinks: true,
        hasRedirects: true,
        hasImages: false,
        hasPageSpeed: false,
        hasWordFreq: false,
        hasRobotsTest: false,
      }],
    ]);
    renderWithProviders(
      <RealComponent domainId={"d1" as any} />
    );
    expect(screen.getByText("crawlAnalytics")).toBeDefined();
    expect(screen.getByText("tabLinkAnalysis")).toBeDefined();
    expect(screen.getByText("tabRedirectChains")).toBeDefined();
    expect(screen.getByTestId("crawl-links-table")).toBeDefined();
  });

  test("switches tabs on click", async () => {
    const mod = await vi.importActual<typeof import("./CrawlAnalyticsSection")>(
      "./CrawlAnalyticsSection"
    );
    const RealComponent = mod.CrawlAnalyticsSection;
    mockQueries([
      [api.seoAudit_queries.getCrawlAnalyticsAvailability, {
        hasLinks: true,
        hasRedirects: true,
        hasImages: false,
        hasPageSpeed: false,
        hasWordFreq: false,
        hasRobotsTest: false,
      }],
    ]);
    renderWithProviders(
      <RealComponent domainId={"d1" as any} />
    );
    fireEvent.click(screen.getByText("tabRedirectChains"));
    expect(screen.getByTestId("redirect-chains-table")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 5. IssuesBreakdownSection (imported directly, not mocked)
// ═════════════════════════════════════════════════════════════════════

// We need to import the REAL IssuesBreakdownSection, but it's mocked above for OnSiteSection.
// We'll test it through its own direct import which was done at the top.
// Since vi.mock("./IssuesBreakdownSection") affects the import at the top of THIS file,
// we need to use a workaround: test the real component via vi.importActual.

describe("IssuesBreakdownSection", () => {
  // The IssuesBreakdownSection import at top is mocked for OnSiteSection.
  // We test it indirectly through checking the actual module.
  // Actually, the mock only affects OTHER modules importing "./IssuesBreakdownSection".
  // Our direct import at the top of this file IS the real one since we import BEFORE mock.
  // However vi.mock is hoisted. Let's use the real component from the direct import.

  // Actually vi.mock IS hoisted and WILL affect our import. Let's use importActual.

  test("renders empty state when no issues have count > 0", async () => {
    const mod = await vi.importActual<typeof import("./IssuesBreakdownSection")>(
      "./IssuesBreakdownSection"
    );
    const RealComponent = mod.IssuesBreakdownSection;
    const issues = {
      missingTitles: 0,
      missingMetaDescriptions: 0,
      duplicateContent: 0,
      brokenLinks: 0,
      slowPages: 0,
      suboptimalTitles: 0,
      thinContent: 0,
      missingH1: 0,
      largeImages: 0,
      missingAltText: 0,
    };
    renderWithProviders(<RealComponent issues={issues} />);
    expect(screen.getByText("noIssuesFound")).toBeDefined();
    expect(screen.getByText("noIssuesFoundDescription")).toBeDefined();
  });

  test("renders issue rows when issues have counts > 0", async () => {
    const mod = await vi.importActual<typeof import("./IssuesBreakdownSection")>(
      "./IssuesBreakdownSection"
    );
    const RealComponent = mod.IssuesBreakdownSection;
    const issues = {
      missingTitles: 3,
      missingMetaDescriptions: 0,
      duplicateContent: 0,
      brokenLinks: 0,
      slowPages: 0,
      suboptimalTitles: 0,
      thinContent: 0,
      missingH1: 5,
      largeImages: 0,
      missingAltText: 2,
      missingHttps: 1,
    };
    renderWithProviders(<RealComponent issues={issues} />);
    expect(screen.getByText("issuesBreakdown")).toBeDefined();
    // Check that issues with count > 0 are listed
    expect(screen.getByText("issueMissingH1")).toBeDefined();
    expect(screen.getByText("issueMissingAltText")).toBeDefined();
    expect(screen.getByText("issueMissingHttps")).toBeDefined();
  });

  test("filters by severity when severityFilter is set", async () => {
    const mod = await vi.importActual<typeof import("./IssuesBreakdownSection")>(
      "./IssuesBreakdownSection"
    );
    const RealComponent = mod.IssuesBreakdownSection;
    const issues = {
      missingTitles: 3, // warning
      missingMetaDescriptions: 0,
      duplicateContent: 0,
      brokenLinks: 0,
      slowPages: 0,
      suboptimalTitles: 0,
      thinContent: 0,
      missingH1: 5, // critical
      largeImages: 0,
      missingAltText: 2, // warning
      missingHttps: 1, // critical
      largeDomSize: 4, // recommendation
    };
    const onClearFilter = vi.fn();
    renderWithProviders(
      <RealComponent
        issues={issues}
        severityFilter="critical"
        onClearFilter={onClearFilter}
      />
    );
    // Should show the filter badge (text is inside a button with other nodes)
    expect(screen.getByText(/severityCritical/)).toBeDefined();
    // Only critical issues visible: missingH1, missingHttps
    expect(screen.getByText("issueMissingH1")).toBeDefined();
    expect(screen.getByText("issueMissingHttps")).toBeDefined();
    // recommendation issue should not appear
    expect(screen.queryByText("issueLargeDom")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 6. KeywordMapSection
// ═════════════════════════════════════════════════════════════════════
describe("KeywordMapSection", () => {
  test("renders child chart and table components when queries are loading", () => {
    renderWithProviders(
      <KeywordMapSection domainId={"d1" as any} />
    );
    expect(screen.getByTestId("keyword-map-bubble-chart")).toBeDefined();
    expect(screen.getByTestId("intent-distribution-chart")).toBeDefined();
    expect(screen.getByTestId("difficulty-distribution-chart")).toBeDefined();
    expect(screen.getByTestId("quick-wins-table")).toBeDefined();
    expect(screen.getByTestId("competitor-overlap-table")).toBeDefined();
    expect(screen.getByTestId("cannibalization-table")).toBeDefined();
  });

  test("shows empty state with refresh button when keywords array is empty", () => {
    mockQueries([
      [api.keywordMap_queries.getKeywordMapData, []],
      [api.keywordMap_queries.getSerpFeatureOpportunities, []],
      [api.domains.getDomain, { _id: "d1", domain: "example.com", settings: { location: "US", language: "en" } }],
    ]);
    renderWithProviders(
      <KeywordMapSection domainId={"d1" as any} />
    );
    expect(screen.getByText("noDiscoveredKeywords")).toBeDefined();
    expect(screen.getByText("fetchDiscoveredKeywords")).toBeDefined();
  });

  test("renders summary stat cards when keywords data exists", () => {
    const keywords = [
      { keywordType: "core", keywordTypeOverride: null, quickWinScore: 5, isMonitored: true, difficulty: 40, searchVolume: 1000 },
      { keywordType: "longtail", keywordTypeOverride: null, quickWinScore: 0, isMonitored: false, difficulty: 20, searchVolume: 500 },
      { keywordType: "branded", keywordTypeOverride: null, quickWinScore: 3, isMonitored: true, difficulty: 10, searchVolume: 2000 },
    ];
    mockQueries([
      [api.keywordMap_queries.getKeywordMapData, keywords],
      [api.keywordMap_queries.getSerpFeatureOpportunities, []],
      [api.domains.getDomain, { _id: "d1", domain: "example.com", settings: { location: "US", language: "en" } }],
    ]);
    renderWithProviders(
      <KeywordMapSection domainId={"d1" as any} />
    );
    expect(screen.getByText("totalKeywords")).toBeDefined();
    expect(screen.getByText("keywordTypes")).toBeDefined();
    expect(screen.getByText("quickWins")).toBeDefined();
    expect(screen.getByText("totalVolume")).toBeDefined();
  });

  test("renders SERP feature opportunities when available", () => {
    const keywords = [
      { keywordType: "core", keywordTypeOverride: null, quickWinScore: 0, isMonitored: true, difficulty: 40, searchVolume: 1000 },
    ];
    const serpFeatures = [
      { feature: "featured_snippet", count: 5, avgPosition: 3, exampleKeywords: ["kw1", "kw2"] },
      { feature: "people_also_ask", count: 3, avgPosition: 7, exampleKeywords: [] },
    ];
    mockQueries([
      [api.keywordMap_queries.getKeywordMapData, keywords],
      [api.keywordMap_queries.getSerpFeatureOpportunities, serpFeatures],
      [api.domains.getDomain, { _id: "d1", domain: "example.com", settings: { location: "US", language: "en" } }],
    ]);
    renderWithProviders(
      <KeywordMapSection domainId={"d1" as any} />
    );
    expect(screen.getByText("serpFeatureOpportunities")).toBeDefined();
    expect(screen.getByText("serpFeatureLabelFeaturedSnippet")).toBeDefined();
    expect(screen.getByText("serpFeatureLabelPeopleAlsoAsk")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 7. LinkBuildingSection
// ═════════════════════════════════════════════════════════════════════
describe("LinkBuildingSection", () => {
  test("renders header, stats cards, and prospects table", () => {
    renderWithProviders(
      <LinkBuildingSection domainId={"d1" as any} domainName="example.com" />
    );
    expect(screen.getByText("linkBuildingTitle")).toBeDefined();
    expect(screen.getByText("linkBuildingSubtitle")).toBeDefined();
    expect(screen.getByTestId("ez-icon")).toBeDefined();
    expect(screen.getByTestId("link-building-stats-cards")).toBeDefined();
    expect(screen.getByTestId("link-building-prospects-table")).toBeDefined();
  });

  test("shows refresh button", () => {
    renderWithProviders(
      <LinkBuildingSection domainId={"d1" as any} domainName="example.com" />
    );
    expect(screen.getByText("refreshProspects")).toBeDefined();
  });

  test("shows download button when prospects exist", () => {
    mockQueries([
      [api.linkBuilding_queries.getProspectStats, { activeProspects: 10, totalProspects: 15 }],
      [api.linkBuilding_queries.getTopProspects, [{ _id: "p1" }]],
      [api.linkBuilding_queries.getProspectsByChannel, []],
    ]);
    renderWithProviders(
      <LinkBuildingSection domainId={"d1" as any} domainName="example.com" />
    );
    expect(screen.getByText("downloadReport")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 8. OnSiteSection
// ═════════════════════════════════════════════════════════════════════
describe("OnSiteSection", () => {
  test("renders empty state when no analysis and no scan in progress", () => {
    // All queries return undefined by default
    renderWithProviders(
      <OnSiteSection domainId={"d1" as any} />
    );
    expect(screen.getByText("noScanData")).toBeDefined();
    expect(screen.getByText("noScanDataDescription")).toBeDefined();
    expect(screen.getByText("runOnSiteScan")).toBeDefined();
  });

  test("renders scan in progress state", () => {
    mockQueries([
      [api.seoAudit_queries.getLatestScan, {
        _id: "scan1",
        status: "crawling",
        startedAt: Date.now() - 60000,
        seoAuditStatus: "running",
        advertoolsCrawlStatus: "pending",
        pagesScanned: 10,
        totalPagesToScan: 50,
      }],
      [api.seoAudit_queries.getLatestAnalysis, null],
      [api.seoAudit_queries.isOnsiteDataStale, false],
    ]);
    renderWithProviders(
      <OnSiteSection domainId={"d1" as any} />
    );
    expect(screen.getByText("scanInProgress")).toBeDefined();
    expect(screen.getByText("seoAudit")).toBeDefined();
    expect(screen.getByText("siteCrawl")).toBeDefined();
  });

  test("renders full analysis view when data exists", () => {
    mockQueries([
      [api.seoAudit_queries.getLatestScan, {
        _id: "scan1",
        status: "completed",
        startedAt: Date.now() - 120000,
        completedAt: Date.now(),
      }],
      [api.seoAudit_queries.getLatestAnalysis, {
        _id: "analysis1",
        fetchedAt: Date.now(),
        issues: {
          missingTitles: 0,
          missingMetaDescriptions: 0,
          duplicateContent: 0,
          brokenLinks: 0,
          slowPages: 0,
          suboptimalTitles: 0,
          thinContent: 0,
          missingH1: 0,
          largeImages: 0,
          missingAltText: 0,
        },
      }],
      [api.seoAudit_queries.isOnsiteDataStale, false],
    ]);
    renderWithProviders(
      <OnSiteSection domainId={"d1" as any} />
    );
    expect(screen.getByText("onSiteSeoAnalysis")).toBeDefined();
    expect(screen.getByTestId("on-site-health-card")).toBeDefined();
    expect(screen.getByTestId("issues-summary-cards")).toBeDefined();
    expect(screen.getByTestId("sitemap-overview-card")).toBeDefined();
    expect(screen.getByTestId("robots-analysis-card-mock")).toBeDefined();
    expect(screen.getByTestId("on-site-pages-table")).toBeDefined();
  });

  test("shows failed banner when scan failed but previous analysis exists", () => {
    mockQueries([
      [api.seoAudit_queries.getLatestScan, {
        _id: "scan1",
        status: "failed",
        startedAt: Date.now() - 120000,
        completedAt: Date.now(),
        error: "Timeout exceeded",
      }],
      [api.seoAudit_queries.getLatestAnalysis, {
        _id: "analysis1",
        fetchedAt: Date.now() - 86400000,
        issues: {
          missingTitles: 0, missingMetaDescriptions: 0, duplicateContent: 0,
          brokenLinks: 0, slowPages: 0, suboptimalTitles: 0, thinContent: 0,
          missingH1: 0, largeImages: 0, missingAltText: 0,
        },
      }],
      [api.seoAudit_queries.isOnsiteDataStale, true],
    ]);
    renderWithProviders(
      <OnSiteSection domainId={"d1" as any} />
    );
    // Failed banner should appear along with existing analysis data
    expect(screen.getByText("lastScanFailedLower")).toBeDefined();
    expect(screen.getByText("Timeout exceeded")).toBeDefined();
    expect(screen.getByText("onSiteSeoAnalysis")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 9. AuditSectionsBreakdown (imported directly but mocked for OnSite)
// ═════════════════════════════════════════════════════════════════════
describe("AuditSectionsBreakdown", () => {
  test("renders section cards with grades and scores", async () => {
    const mod = await vi.importActual<typeof import("./AuditSectionsBreakdown")>(
      "./AuditSectionsBreakdown"
    );
    const RealComponent = mod.AuditSectionsBreakdown;
    const sections = {
      technical: { score: 85, grade: "A", issues: [] },
      on_page: { score: 60, grade: "C", issues: [{ issue: "Missing meta", action: "Add meta", priority: "important" }] },
      content: { score: 90, grade: "A", issues: [] },
    };
    renderWithProviders(<RealComponent sections={sections} />);
    expect(screen.getByText("auditSections")).toBeDefined();
    expect(screen.getByText("sectionTechnical")).toBeDefined();
    expect(screen.getByText("sectionOnPage")).toBeDefined();
    expect(screen.getByText("sectionContent")).toBeDefined();
    expect(screen.getAllByText("A").length).toBe(2); // technical + content both grade A
    expect(screen.getByText("C")).toBeDefined();
    expect(screen.getByText("85")).toBeDefined();
    expect(screen.getByText("60")).toBeDefined();
  });

  test("expands section to show issues on click", async () => {
    const mod = await vi.importActual<typeof import("./AuditSectionsBreakdown")>(
      "./AuditSectionsBreakdown"
    );
    const RealComponent = mod.AuditSectionsBreakdown;
    const sections = {
      technical: {
        score: 70,
        grade: "B",
        issues: [
          { issue: "Slow TTFB", action: "Optimize server response", priority: "critical" },
          { issue: "No caching", action: "Enable caching", priority: "important" },
        ],
      },
    };
    renderWithProviders(<RealComponent sections={sections} />);
    // Issues not visible initially
    expect(screen.queryByText("Slow TTFB")).toBeNull();
    // Click to expand
    fireEvent.click(screen.getByText("sectionTechnical"));
    expect(screen.getByText("Slow TTFB")).toBeDefined();
    expect(screen.getByText("No caching")).toBeDefined();
    expect(screen.getByText("Optimize server response")).toBeDefined();
  });

  test("renders recommendations when provided", async () => {
    const mod = await vi.importActual<typeof import("./AuditSectionsBreakdown")>(
      "./AuditSectionsBreakdown"
    );
    const RealComponent = mod.AuditSectionsBreakdown;
    const sections = {
      technical: { score: 95, grade: "A", issues: [] },
    };
    const recommendations = ["Add structured data", "Improve mobile UX"];
    renderWithProviders(
      <RealComponent sections={sections} recommendations={recommendations} />
    );
    expect(screen.getByText("recommendations")).toBeDefined();
    expect(screen.getByText("Add structured data")).toBeDefined();
    expect(screen.getByText("Improve mobile UX")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 10. RobotsAnalysisCard (imported directly but mocked for OnSite)
// ═════════════════════════════════════════════════════════════════════
describe("RobotsAnalysisCard", () => {
  test("renders no-data state when query returns null/undefined", async () => {
    const mod = await vi.importActual<typeof import("./RobotsAnalysisCard")>(
      "./RobotsAnalysisCard"
    );
    const RealComponent = mod.RobotsAnalysisCard;
    renderWithProviders(<RealComponent domainId={"d1" as any} />);
    expect(screen.getByText("robotsTxt")).toBeDefined();
    expect(screen.getByText("noRobotsTxtData")).toBeDefined();
  });

  test("renders robots data with user-agent groups", async () => {
    const mod = await vi.importActual<typeof import("./RobotsAnalysisCard")>(
      "./RobotsAnalysisCard"
    );
    const RealComponent = mod.RobotsAnalysisCard;
    mockQueries([
      [api.seoAudit_queries.getRobotsData, {
        fetchedAt: Date.now(),
        robotsUrl: "https://example.com/robots.txt",
        directives: {
          "*": {
            allow: ["/public"],
            disallow: ["/admin", "/private"],
          },
          sitemap: ["https://example.com/sitemap.xml"],
        },
      }],
    ]);
    renderWithProviders(<RealComponent domainId={"d1" as any} />);
    expect(screen.getByText("robotsTxt")).toBeDefined();
    expect(screen.getByText(/example\.com\/robots\.txt/)).toBeDefined();
    // User agent group
    const userAgentEl = screen.getByText(/userAgent/);
    expect(userAgentEl).toBeDefined();
    // Allow/disallow paths
    expect(screen.getByText("/public")).toBeDefined();
    expect(screen.getByText("/admin")).toBeDefined();
    expect(screen.getByText("/private")).toBeDefined();
    // Sitemaps
    expect(screen.getByText("sitemaps")).toBeDefined();
    expect(screen.getByText("https://example.com/sitemap.xml")).toBeDefined();
  });

  test("renders flat directive structure", async () => {
    const mod = await vi.importActual<typeof import("./RobotsAnalysisCard")>(
      "./RobotsAnalysisCard"
    );
    const RealComponent = mod.RobotsAnalysisCard;
    mockQueries([
      [api.seoAudit_queries.getRobotsData, {
        fetchedAt: Date.now(),
        robotsUrl: "https://test.com/robots.txt",
        directives: {
          user_agent: ["*"],
          allow: ["/"],
          disallow: ["/secret"],
          sitemap: "https://test.com/sitemap.xml",
        },
      }],
    ]);
    renderWithProviders(<RealComponent domainId={"d1" as any} />);
    expect(screen.getByText("/")).toBeDefined();
    expect(screen.getByText("/secret")).toBeDefined();
  });

  test("shows no directives found for empty directives", async () => {
    const mod = await vi.importActual<typeof import("./RobotsAnalysisCard")>(
      "./RobotsAnalysisCard"
    );
    const RealComponent = mod.RobotsAnalysisCard;
    mockQueries([
      [api.seoAudit_queries.getRobotsData, {
        fetchedAt: Date.now(),
        robotsUrl: "https://empty.com/robots.txt",
        directives: undefined,
      }],
    ]);
    renderWithProviders(<RealComponent domainId={"d1" as any} />);
    expect(screen.getByText("noDirectivesFound")).toBeDefined();
  });
});
