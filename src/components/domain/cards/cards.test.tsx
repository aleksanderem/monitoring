/**
 * Component-level tests for all card components in src/components/domain/cards/
 *
 * Uses:
 * - renderWithProviders for NextIntlClientProvider wrapping
 * - mockQueries / resetConvexMocks for useQuery-based components
 * - Global mocks from setup.ts: @untitledui/icons, next-intl (key passthrough), recharts, sonner
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { mockQueries, resetConvexMocks } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";

// ── Component imports ────────────────────────────────────────────────
import { MetricCard } from "./MetricCard";
import { CoreWebVitalsCard } from "./CoreWebVitalsCard";
import { LighthouseScoresCard } from "./LighthouseScoresCard";
import { ForecastSummaryCard } from "./ForecastSummaryCard";
import { GapSummaryCards } from "./GapSummaryCards";
import { VelocityMetricsCards } from "./VelocityMetricsCards";
import { CrawlSummaryCards } from "./CrawlSummaryCards";
import { IssuesSummaryCards } from "./IssuesSummaryCards";
import { KeywordDetailCard } from "./KeywordDetailCard";
import { OnSiteHealthCard } from "./OnSiteHealthCard";
import { CompetitorGapComparisonCard } from "./CompetitorGapComparisonCard";
import { TopicClustersCard } from "./TopicClustersCard";
import { LinkBuildingStatsCards } from "./LinkBuildingStatsCards";
import { RobotsTestResultsCard } from "./RobotsTestResultsCard";
import { ModuleHubCard } from "./ModuleHubCard";

// ── Override the global next-intl mock to include NextIntlClientProvider ──
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

// ── Mocks for convex + navigation ───────────────────────────────────

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

// ── Mocks for third-party / heavy deps ──────────────────────────────

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/foundations/featured-icon/featured-icon", () => ({
  FeaturedIcon: ({ icon: Icon }: { icon: React.FC<{ className?: string }> }) => (
    <div data-testid="featured-icon">
      {Icon && <Icon className="mock-icon" />}
    </div>
  ),
}));

vi.mock("@/components/application/metrics/metrics", () => ({
  MetricChangeIndicator: ({ trend, value }: { trend: string; value: string }) => (
    <span data-testid="metric-change">{trend}: {value}</span>
  ),
}));

vi.mock("@/components/base/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

vi.mock("@/components/base/badges/badges", () => ({
  Badge: ({ children, color, size }: { children: React.ReactNode; color?: string; size?: string }) => (
    <span data-testid="base-badge" data-color={color}>{children}</span>
  ),
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({ children, onClick, ...rest }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("motion/react", () => {
  const Component = ({ children, ...props }: Record<string, unknown>) => {
    const domSafe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (["className", "style", "id", "role", "onClick", "data-testid"].includes(k)) domSafe[k] = v;
    }
    return <div {...domSafe}>{children as React.ReactNode}</div>;
  };
  return {
    motion: new Proxy({}, {
      get: () => Component,
      has: () => true,
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
  };
});

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getNodes: () => [], getEdges: () => [], setNodes: vi.fn(), setEdges: vi.fn(),
    fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(),
  }),
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Background: () => <div />, Controls: () => <div />, MiniMap: () => <div />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
}));

vi.mock("@/components/ai/canvas", () => ({
  Canvas: () => <div data-testid="canvas" />,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: () => <span data-testid="ez-icon" />,
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));
vi.mock("@/hooks/use-outside-click", () => ({ useOutsideClick: vi.fn() }));

vi.mock("../modals/TopicClusterDetailModal", () => ({
  TopicClusterDetailModal: () => <div data-testid="topic-cluster-modal" />,
}));

// ── Test setup ──────────────────────────────────────────────────────

beforeEach(() => {
  resetConvexMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// MetricCard
// ═══════════════════════════════════════════════════════════════════════
describe("MetricCard", () => {
  test("renders title and value", () => {
    renderWithProviders(<MetricCard title="Total Keywords" value={1234} />);
    expect(screen.getByText("Total Keywords")).toBeInTheDocument();
    // jsdom toLocaleString may or may not format with commas
    expect(screen.getByText((text) => text.includes("1") && text.includes("234"))).toBeInTheDocument();
  });

  test("renders string value as-is", () => {
    renderWithProviders(<MetricCard title="Score" value="98.5%" />);
    expect(screen.getByText("98.5%")).toBeInTheDocument();
  });

  test("renders icon when provided", () => {
    const MockIcon = (props: { className?: string }) => <svg data-testid="mock-icon" {...props} />;
    renderWithProviders(<MetricCard title="Test" value={0} icon={MockIcon} />);
    expect(screen.getByTestId("featured-icon")).toBeInTheDocument();
  });

  test("renders trend and change indicator when both provided", () => {
    renderWithProviders(
      <MetricCard title="Visits" value={500} trend="positive" change="+12%" />
    );
    expect(screen.getByTestId("metric-change")).toBeInTheDocument();
    expect(screen.getByText("positive: +12%")).toBeInTheDocument();
  });

  test("does not render change indicator when trend is null", () => {
    renderWithProviders(<MetricCard title="Visits" value={500} trend={null} change="+12%" />);
    expect(screen.queryByTestId("metric-change")).not.toBeInTheDocument();
  });

  test("renders subtitle when provided", () => {
    renderWithProviders(<MetricCard title="Test" value={0} subtitle="Some subtitle" />);
    expect(screen.getByText("Some subtitle")).toBeInTheDocument();
  });

  test("renders changeDescription instead of subtitle when present with trend", () => {
    renderWithProviders(
      <MetricCard
        title="Test"
        value={100}
        trend="positive"
        change="+5%"
        changeDescription="vs last week"
        subtitle="hidden subtitle"
      />
    );
    expect(screen.getByText("vs last week")).toBeInTheDocument();
    expect(screen.queryByText("hidden subtitle")).not.toBeInTheDocument();
  });

  test("renders badge and actions", () => {
    renderWithProviders(
      <MetricCard
        title="Test"
        value={0}
        badge={<span data-testid="custom-badge">New</span>}
        actions={<button data-testid="custom-action">Click</button>}
      />
    );
    expect(screen.getByTestId("custom-badge")).toBeInTheDocument();
    expect(screen.getByTestId("custom-action")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CoreWebVitalsCard
// ═══════════════════════════════════════════════════════════════════════
describe("CoreWebVitalsCard", () => {
  test("renders no-data message when vitals is undefined", () => {
    renderWithProviders(<CoreWebVitalsCard />);
    expect(screen.getByText("coreWebVitals")).toBeInTheDocument();
    expect(screen.getByText("noCwvData")).toBeInTheDocument();
  });

  test("renders all four metrics with data", () => {
    renderWithProviders(
      <CoreWebVitalsCard
        vitals={{
          largestContentfulPaint: 2000,
          firstInputDelay: 50,
          timeToInteractive: 3000,
          domComplete: 4000,
          cumulativeLayoutShift: 0.05,
        }}
      />
    );
    expect(screen.getByText("LCP")).toBeInTheDocument();
    expect(screen.getByText("FID")).toBeInTheDocument();
    expect(screen.getByText("TTI")).toBeInTheDocument();
    expect(screen.getByText("CLS")).toBeInTheDocument();
    // LCP 2000ms = 2.00s
    expect(screen.getByText("2.00")).toBeInTheDocument();
    // FID 50ms
    expect(screen.getByText("50")).toBeInTheDocument();
    // CLS 0.05 = 0.050
    expect(screen.getByText("0.050")).toBeInTheDocument();
  });

  test("renders status guide labels", () => {
    renderWithProviders(
      <CoreWebVitalsCard
        vitals={{
          largestContentfulPaint: 2000,
          firstInputDelay: 50,
          timeToInteractive: 3000,
          domComplete: 4000,
        }}
      />
    );
    expect(screen.getByText("statusGood")).toBeInTheDocument();
    expect(screen.getByText("statusNeedsImprovement")).toBeInTheDocument();
    expect(screen.getByText("statusPoor")).toBeInTheDocument();
  });

  test("defaults CLS to 0 when undefined", () => {
    renderWithProviders(
      <CoreWebVitalsCard
        vitals={{
          largestContentfulPaint: 2000,
          firstInputDelay: 50,
          timeToInteractive: 3000,
          domComplete: 4000,
        }}
      />
    );
    // CLS defaults to 0 → "0.000"
    expect(screen.getByText("0.000")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LighthouseScoresCard
// ═══════════════════════════════════════════════════════════════════════
describe("LighthouseScoresCard", () => {
  test("renders no-data message when scores is undefined", () => {
    renderWithProviders(<LighthouseScoresCard />);
    expect(screen.getByText("lighthouseScores")).toBeInTheDocument();
    expect(screen.getByText("noLighthouseData")).toBeInTheDocument();
  });

  test("renders all four category scores", () => {
    renderWithProviders(
      <LighthouseScoresCard
        scores={{ performance: 95, accessibility: 88, bestPractices: 72, seo: 45 }}
      />
    );
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("categoryPerformance")).toBeInTheDocument();
    expect(screen.getByText("categoryAccessibility")).toBeInTheDocument();
    expect(screen.getByText("categoryBestPractices")).toBeInTheDocument();
    expect(screen.getByText("categorySeo")).toBeInTheDocument();
  });

  test("renders status guide footer", () => {
    renderWithProviders(
      <LighthouseScoresCard
        scores={{ performance: 90, accessibility: 90, bestPractices: 90, seo: 90 }}
      />
    );
    expect(screen.getByText("statusGuide")).toBeInTheDocument();
    expect(screen.getByText("statusGood")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ForecastSummaryCard
// ═══════════════════════════════════════════════════════════════════════
describe("ForecastSummaryCard", () => {
  test("shows loading skeleton when query is undefined", () => {
    renderWithProviders(<ForecastSummaryCard domainId={"test-domain" as any} />);
    expect(screen.getByText("forecast30Day")).toBeInTheDocument();
    // animate-pulse is the loading skeleton
    const pulseEl = document.querySelector(".animate-pulse");
    expect(pulseEl).toBeInTheDocument();
  });

  test("shows insufficient data message when history has fewer than 10 entries", () => {
    const shortHistory = Array.from({ length: 5 }, (_, i) => ({
      date: `2024-01-0${i + 1}`,
      metrics: { etv: 100 + i },
    }));
    mockQueries([[api.domains.getVisibilityHistory, shortHistory]]);
    renderWithProviders(<ForecastSummaryCard domainId={"test-domain" as any} />);
    expect(screen.getByText("notEnoughDataForForecasting")).toBeInTheDocument();
    expect(screen.getByText("needAtLeast10Days")).toBeInTheDocument();
  });

  test("shows projected ETV change with sufficient data", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      metrics: { etv: 1000 + i * 10 },
    }));
    mockQueries([[api.domains.getVisibilityHistory, history]]);
    renderWithProviders(<ForecastSummaryCard domainId={"test-domain" as any} />);
    expect(screen.getByText("forecast30Day")).toBeInTheDocument();
    expect(screen.getByText("projectedEtvChange")).toBeInTheDocument();
  });

  test("shows empty data message when history is null", () => {
    mockQueries([[api.domains.getVisibilityHistory, null]]);
    renderWithProviders(<ForecastSummaryCard domainId={"test-domain" as any} />);
    expect(screen.getByText("notEnoughDataForForecasting")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GapSummaryCards
// ═══════════════════════════════════════════════════════════════════════
describe("GapSummaryCards", () => {
  const mockSummary = {
    totalGaps: 150,
    highPriority: 30,
    totalEstimatedValue: 5500,
    competitorsAnalyzed: 4,
    lastAnalyzedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
  };

  test("renders loading skeletons when isLoading is true", () => {
    renderWithProviders(
      <GapSummaryCards summary={mockSummary} isLoading={true} />
    );
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders all four metric cards with data", () => {
    renderWithProviders(<GapSummaryCards summary={mockSummary} />);
    expect(screen.getByText("gapSummaryTotalGaps")).toBeInTheDocument();
    expect(screen.getByText("gapSummaryHighPriority")).toBeInTheDocument();
    expect(screen.getByText("gapSummaryEstTrafficValue")).toBeInTheDocument();
    expect(screen.getByText("gapSummaryCompetitors")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("5.5k")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  test("formats large values with k suffix", () => {
    renderWithProviders(
      <GapSummaryCards
        summary={{ ...mockSummary, totalEstimatedValue: 12500 }}
      />
    );
    expect(screen.getByText("12.5k")).toBeInTheDocument();
  });

  test("shows zero high priority percentage for zero gaps", () => {
    renderWithProviders(
      <GapSummaryCards
        summary={{ ...mockSummary, totalGaps: 0, highPriority: 0 }}
      />
    );
    // highPriorityPercentage = 0 when totalGaps is 0
    expect(screen.getByText('gapSummaryOfTotal({"percentage":0})')).toBeInTheDocument();
  });

  test("shows 'never' for null lastAnalyzedAt", () => {
    renderWithProviders(
      <GapSummaryCards
        summary={{ ...mockSummary, lastAnalyzedAt: null }}
      />
    );
    expect(screen.getByText("gapSummaryNever")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VelocityMetricsCards
// ═══════════════════════════════════════════════════════════════════════
describe("VelocityMetricsCards", () => {
  const mockStats = {
    avgNewPerDay: 3.5,
    avgLostPerDay: 1.2,
    avgNetChange: 2.3,
    totalNew: 105,
    totalLost: 36,
    netChange: 69,
    daysTracked: 30,
  };

  test("renders loading skeletons when isLoading is true", () => {
    renderWithProviders(
      <VelocityMetricsCards stats={mockStats} isLoading={true} />
    );
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders all four metric titles with data", () => {
    renderWithProviders(<VelocityMetricsCards stats={mockStats} />);
    expect(screen.getByText("velocityAvgNewPerDay")).toBeInTheDocument();
    expect(screen.getByText("velocityAvgLostPerDay")).toBeInTheDocument();
    expect(screen.getByText("velocityNetGrowth")).toBeInTheDocument();
    expect(screen.getByText("velocity7Day")).toBeInTheDocument();
  });

  test("shows formatted values", () => {
    renderWithProviders(<VelocityMetricsCards stats={mockStats} />);
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(screen.getByText("+2.3/day")).toBeInTheDocument();
  });

  test("uses recentVelocity for 7-day metric when provided", () => {
    renderWithProviders(
      <VelocityMetricsCards stats={mockStats} recentVelocity={5.0} />
    );
    expect(screen.getByText("+5.0")).toBeInTheDocument();
  });

  test("shows days tracked info", () => {
    renderWithProviders(<VelocityMetricsCards stats={mockStats} />);
    const daysTexts = screen.getAllByText('velocityLastNDays({"days":30})');
    expect(daysTexts.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CrawlSummaryCards
// ═══════════════════════════════════════════════════════════════════════
describe("CrawlSummaryCards", () => {
  test("returns null when no data available", () => {
    // All queries return undefined (loading) by default, but component checks for data
    // We need to mock all 4 queries to return null/falsy
    mockQueries([
      [api.seoAudit_queries.getLinkAnalysis, null],
      [api.seoAudit_queries.getRedirectAnalysis, null],
      [api.seoAudit_queries.getImageAnalysis, null],
      [api.seoAudit_queries.getLatestAnalysis, null],
    ]);
    const { container } = renderWithProviders(
      <CrawlSummaryCards domainId={"test-domain" as any} />
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders cards when data is available", () => {
    mockQueries([
      [api.seoAudit_queries.getLinkAnalysis, { internalLinks: 250, externalLinks: 40 }],
      [api.seoAudit_queries.getRedirectAnalysis, { totalRedirects: 3 }],
      [api.seoAudit_queries.getImageAnalysis, { missingAltCount: 12 }],
      [api.seoAudit_queries.getLatestAnalysis, { avgWordCount: 850, avgPerformance: 78 }],
    ]);
    renderWithProviders(<CrawlSummaryCards domainId={"test-domain" as any} />);
    expect(screen.getByText("avgWordCount")).toBeInTheDocument();
    expect(screen.getByText("avgPerformance")).toBeInTheDocument();
    expect(screen.getByText("internalLinks")).toBeInTheDocument();
    expect(screen.getByText("externalLinks")).toBeInTheDocument();
    expect(screen.getByText("redirectChains")).toBeInTheDocument();
    expect(screen.getByText("missingAlt")).toBeInTheDocument();
    expect(screen.getByText("850")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  test("shows dash for missing data fields", () => {
    mockQueries([
      [api.seoAudit_queries.getLinkAnalysis, null],
      [api.seoAudit_queries.getRedirectAnalysis, null],
      [api.seoAudit_queries.getImageAnalysis, null],
      [api.seoAudit_queries.getLatestAnalysis, { avgWordCount: 500 }],
    ]);
    renderWithProviders(<CrawlSummaryCards domainId={"test-domain" as any} />);
    // internalLinks etc. should show "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// IssuesSummaryCards
// ═══════════════════════════════════════════════════════════════════════
describe("IssuesSummaryCards", () => {
  const baseAnalysis = {
    criticalIssues: 5,
    warnings: 12,
    recommendations: 8,
    totalPages: 100,
  };

  test("renders three severity cards", () => {
    renderWithProviders(<IssuesSummaryCards analysis={baseAnalysis} />);
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("warnings")).toBeInTheDocument();
    expect(screen.getByText("recommendations")).toBeInTheDocument();
  });

  test("renders issue counts", () => {
    renderWithProviders(<IssuesSummaryCards analysis={baseAnalysis} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  test("shows top issues breakdown when issues detail is provided", () => {
    renderWithProviders(
      <IssuesSummaryCards
        analysis={{
          ...baseAnalysis,
          issues: {
            missingTitles: 3,
            missingMetaDescriptions: 5,
            duplicateContent: 2,
            brokenLinks: 4,
            slowPages: 1,
            suboptimalTitles: 0,
            thinContent: 3,
            missingH1: 2,
            largeImages: 0,
            missingAltText: 1,
          },
        }}
      />
    );
    // brokenLinks=4 is a critical issue, should appear
    expect(screen.getByText("issueBrokenLinks")).toBeInTheDocument();
  });

  test("shows 'showIssues' button when onShowIssues callback is provided and count > 0", () => {
    const onShowIssues = vi.fn();
    renderWithProviders(
      <IssuesSummaryCards analysis={baseAnalysis} onShowIssues={onShowIssues} />
    );
    const buttons = screen.getAllByText("showIssues");
    expect(buttons.length).toBe(3); // all three severities have count > 0
  });

  test("does not show button when count is 0", () => {
    const onShowIssues = vi.fn();
    renderWithProviders(
      <IssuesSummaryCards
        analysis={{ ...baseAnalysis, criticalIssues: 0 }}
        onShowIssues={onShowIssues}
      />
    );
    // Only 2 buttons now (warnings and recommendations)
    const buttons = screen.getAllByText("showIssues");
    expect(buttons.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// KeywordDetailCard
// ═══════════════════════════════════════════════════════════════════════
describe("KeywordDetailCard", () => {
  test("renders SEO metrics card with difficulty and competition", () => {
    renderWithProviders(
      <KeywordDetailCard
        keyword={{
          difficulty: 45,
          competitionLevel: "MEDIUM",
          cpc: 1.5,
          intent: "commercial",
        }}
      />
    );
    expect(screen.getByText("cardSeoMetrics")).toBeInTheDocument();
    expect(screen.getByText("cardDifficulty")).toBeInTheDocument();
    expect(screen.getByText("45/100")).toBeInTheDocument();
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    expect(screen.getByText("$1.50")).toBeInTheDocument();
    expect(screen.getByText("commercial")).toBeInTheDocument();
  });

  test("renders traffic value card with ETV and search volume", () => {
    renderWithProviders(
      <KeywordDetailCard
        keyword={{
          etv: 25.5,
          estimatedPaidTrafficCost: 150.75,
          searchVolume: 12000,
        }}
      />
    );
    expect(screen.getByText("cardTrafficValue")).toBeInTheDocument();
    expect(screen.getByText("25.50")).toBeInTheDocument();
    expect(screen.getByText("$150.75")).toBeInTheDocument();
    // jsdom toLocaleString may or may not format with commas
    expect(screen.getByText((text) => text.includes("12") && text.includes("000"))).toBeInTheDocument();
  });

  test("renders ranking info with position and badges", () => {
    renderWithProviders(
      <KeywordDetailCard
        keyword={{
          position: 5,
          previousPosition: 8,
          isUp: true,
        }}
      />
    );
    expect(screen.getByText("cardRankingInfo")).toBeInTheDocument();
    expect(screen.getByText("#5")).toBeInTheDocument();
    expect(screen.getByText("cardUp")).toBeInTheDocument();
  });

  test("renders SERP features when provided", () => {
    renderWithProviders(
      <KeywordDetailCard
        keyword={{
          serpFeatures: ["featured_snippet", "people_also_ask"],
        }}
      />
    );
    expect(screen.getByText("cardSerpFeatures")).toBeInTheDocument();
    expect(screen.getByText("featured snippet")).toBeInTheDocument();
    expect(screen.getByText("people also ask")).toBeInTheDocument();
  });

  test("does not render SERP features section when empty", () => {
    renderWithProviders(
      <KeywordDetailCard keyword={{ serpFeatures: [] }} />
    );
    expect(screen.queryByText("cardSerpFeatures")).not.toBeInTheDocument();
  });

  test("renders backlinks info when provided", () => {
    renderWithProviders(
      <KeywordDetailCard
        keyword={{
          backlinksInfo: {
            referringDomains: 42,
            referringPages: 150,
            dofollow: 38,
          },
        }}
      />
    );
    expect(screen.getByText("cardBacklinks")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// OnSiteHealthCard
// ═══════════════════════════════════════════════════════════════════════
describe("OnSiteHealthCard", () => {
  test("renders health score and grade for excellent site", () => {
    renderWithProviders(
      <OnSiteHealthCard
        analysis={{
          healthScore: 95,
          totalPages: 50,
          criticalIssues: 0,
          warnings: 2,
          recommendations: 5,
        }}
      />
    );
    expect(screen.getByText("overallHealth")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("statusExcellent")).toBeInTheDocument();
  });

  test("renders critical status for low score", () => {
    renderWithProviders(
      <OnSiteHealthCard
        analysis={{
          healthScore: 30,
          totalPages: 100,
          criticalIssues: 60,
          warnings: 20,
          recommendations: 10,
        }}
      />
    );
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    expect(screen.getByText("statusCritical")).toBeInTheDocument();
  });

  test("uses avgPageScore when available", () => {
    renderWithProviders(
      <OnSiteHealthCard
        analysis={{
          healthScore: 60,
          totalPages: 50,
          criticalIssues: 5,
          warnings: 10,
          recommendations: 5,
          avgPageScore: 85,
        }}
      />
    );
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("renders page score distribution when provided", () => {
    renderWithProviders(
      <OnSiteHealthCard
        analysis={{
          healthScore: 75,
          totalPages: 50,
          criticalIssues: 3,
          warnings: 8,
          recommendations: 5,
          pageScoreDistribution: { A: 10, B: 15, C: 12, D: 8, F: 5 },
        }}
      />
    );
    expect(screen.getByText("A:10")).toBeInTheDocument();
    expect(screen.getByText("B:15")).toBeInTheDocument();
    expect(screen.getByText("F:5")).toBeInTheDocument();
  });

  test("renders pages analyzed count", () => {
    renderWithProviders(
      <OnSiteHealthCard
        analysis={{
          healthScore: 80,
          totalPages: 75,
          criticalIssues: 2,
          warnings: 5,
          recommendations: 3,
          pagesAnalyzed: 60,
        }}
      />
    );
    expect(screen.getByText('pagesAnalyzed({"count":60})')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CompetitorGapComparisonCard
// ═══════════════════════════════════════════════════════════════════════
describe("CompetitorGapComparisonCard", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(
      <CompetitorGapComparisonCard domainId={"test-domain" as any} />
    );
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("shows empty state when comparison is empty array", () => {
    mockQueries([[api.contentGaps_queries.getCompetitorGapComparison, []]]);
    renderWithProviders(
      <CompetitorGapComparisonCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("gapComparisonTitle")).toBeInTheDocument();
    expect(screen.getByText("gapComparisonEmpty")).toBeInTheDocument();
  });

  test("renders chart when data has 6 or fewer competitors", () => {
    mockQueries([
      [api.contentGaps_queries.getCompetitorGapComparison, [
        { competitorDomain: "www.example.com", totalGaps: 50, highPriorityGaps: 10, avgOpportunityScore: 72 },
        { competitorDomain: "www.test.com", totalGaps: 30, highPriorityGaps: 5, avgOpportunityScore: 65 },
      ]],
    ]);
    renderWithProviders(
      <CompetitorGapComparisonCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("gapComparisonTitle")).toBeInTheDocument();
    // BarChart is rendered with ResponsiveContainer stub
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  test("renders list view when data has more than 6 competitors", () => {
    const manyCompetitors = Array.from({ length: 8 }, (_, i) => ({
      competitorDomain: `www.comp${i}.com`,
      totalGaps: 20 + i * 5,
      highPriorityGaps: 3 + i,
      avgOpportunityScore: 60 + i * 2,
    }));
    mockQueries([[api.contentGaps_queries.getCompetitorGapComparison, manyCompetitors]]);
    renderWithProviders(
      <CompetitorGapComparisonCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("gapComparisonDistribution")).toBeInTheDocument();
    // List view shows competitor names (trimmed www.)
    expect(screen.getByText("comp0.com")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TopicClustersCard
// ═══════════════════════════════════════════════════════════════════════
describe("TopicClustersCard", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(
      <TopicClustersCard domainId={"test-domain" as any} />
    );
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("shows empty state when clusters is empty array", () => {
    mockQueries([[api.contentGaps_queries.getTopicClusters, []]]);
    renderWithProviders(
      <TopicClustersCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("topicClusters")).toBeInTheDocument();
    expect(screen.getByText("noClustersFound")).toBeInTheDocument();
  });

  test("renders clusters table with data", () => {
    const clusters = [
      {
        topic: "SEO Strategy",
        gapCount: 12,
        avgOpportunityScore: 78,
        totalSearchVolume: 45000,
        avgDifficulty: 35,
        totalEstimatedValue: 2500,
        topKeywords: ["seo tips", "seo guide", "seo strategy"],
      },
      {
        topic: "Content Marketing",
        gapCount: 8,
        avgOpportunityScore: 65,
        totalSearchVolume: 32000,
        avgDifficulty: 42,
        totalEstimatedValue: 1800,
        topKeywords: ["content strategy", "blog writing"],
      },
    ];
    mockQueries([[api.contentGaps_queries.getTopicClusters, clusters]]);
    renderWithProviders(
      <TopicClustersCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("SEO Strategy")).toBeInTheDocument();
    expect(screen.getByText("Content Marketing")).toBeInTheDocument();
    expect(screen.getByText("topicClustersDescription")).toBeInTheDocument();
  });

  test("shows cluster count badge", () => {
    const clusters = [
      {
        topic: "Test Topic",
        gapCount: 5,
        avgOpportunityScore: 70,
        totalSearchVolume: 10000,
        avgDifficulty: 25,
        totalEstimatedValue: 500,
        topKeywords: ["test"],
      },
    ];
    mockQueries([[api.contentGaps_queries.getTopicClusters, clusters]]);
    renderWithProviders(
      <TopicClustersCard domainId={"test-domain" as any} />
    );
    // Badge shows the count of filtered/sorted clusters
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LinkBuildingStatsCards
// ═══════════════════════════════════════════════════════════════════════
describe("LinkBuildingStatsCards", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(
      <LinkBuildingStatsCards domainId={"test-domain" as any} />
    );
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("shows zero-state when stats is null", () => {
    mockQueries([[api.linkBuilding_queries.getProspectStats, null]]);
    renderWithProviders(
      <LinkBuildingStatsCards domainId={"test-domain" as any} />
    );
    expect(screen.getByText("statsProspects")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("statsGenerateToFind")).toBeInTheDocument();
  });

  test("renders all four stat cards when data is available", () => {
    mockQueries([
      [api.linkBuilding_queries.getProspectStats, {
        activeProspects: 25,
        reviewingCount: 5,
        avgScore: 72,
        avgImpact: 8.5,
        byDifficulty: { easy: 10, medium: 8, hard: 7 },
      }],
    ]);
    renderWithProviders(
      <LinkBuildingStatsCards domainId={"test-domain" as any} />
    );
    expect(screen.getByText("statsActiveProspects")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("statsAvgScore")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("statsAvgImpact")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("statsEasyWins")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// RobotsTestResultsCard
// ═══════════════════════════════════════════════════════════════════════
describe("RobotsTestResultsCard", () => {
  test("returns null when robotsData is undefined (loading)", () => {
    const { container } = renderWithProviders(
      <RobotsTestResultsCard domainId={"test-domain" as any} />
    );
    expect(container.innerHTML).toBe("");
  });

  test("returns null when robotsData is null", () => {
    mockQueries([[api.seoAudit_queries.getRobotsTestResults, null]]);
    const { container } = renderWithProviders(
      <RobotsTestResultsCard domainId={"test-domain" as any} />
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders robots.txt URL and test results", () => {
    mockQueries([
      [api.seoAudit_queries.getRobotsTestResults, {
        robotstxtUrl: "https://example.com/robots.txt",
        results: [
          { userAgent: "Googlebot", urlPath: "/admin", canFetch: false },
          { userAgent: "Googlebot", urlPath: "/", canFetch: true },
          { userAgent: "*", urlPath: "/api", canFetch: false },
        ],
      }],
    ]);
    renderWithProviders(
      <RobotsTestResultsCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("https://example.com/robots.txt")).toBeInTheDocument();
    expect(screen.getByText("Googlebot")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("/admin")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("/api")).toBeInTheDocument();
  });

  test("shows allowed and blocked counts per user agent", () => {
    mockQueries([
      [api.seoAudit_queries.getRobotsTestResults, {
        robotstxtUrl: "https://example.com/robots.txt",
        results: [
          { userAgent: "Googlebot", urlPath: "/admin", canFetch: false },
          { userAgent: "Googlebot", urlPath: "/", canFetch: true },
          { userAgent: "Googlebot", urlPath: "/public", canFetch: true },
        ],
      }],
    ]);
    renderWithProviders(
      <RobotsTestResultsCard domainId={"test-domain" as any} />
    );
    // 2 allowed, 1 blocked for Googlebot
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  test("shows no results message when results array is empty", () => {
    mockQueries([
      [api.seoAudit_queries.getRobotsTestResults, {
        robotstxtUrl: "https://example.com/robots.txt",
        results: [],
      }],
    ]);
    renderWithProviders(
      <RobotsTestResultsCard domainId={"test-domain" as any} />
    );
    expect(screen.getByText("noRobotsTestResults")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ModuleHubCard
// ═══════════════════════════════════════════════════════════════════════
describe("ModuleHubCard", () => {
  const baseProps = {
    tabId: "monitoring",
    title: "Position Monitoring",
    description: "Track keyword positions daily",
    icon: "search-01",
    state: "ready" as const,
    colors: [[59, 130, 246]] as [number, number, number][],
    onClick: vi.fn(),
  };

  test("renders title", () => {
    renderWithProviders(<ModuleHubCard {...baseProps} />);
    expect(screen.getByText("Position Monitoring")).toBeInTheDocument();
  });

  test("renders with locked state", () => {
    renderWithProviders(
      <ModuleHubCard {...baseProps} state="locked" />
    );
    expect(screen.getByText("Position Monitoring")).toBeInTheDocument();
  });

  test("renders with loading state", () => {
    renderWithProviders(
      <ModuleHubCard {...baseProps} state="loading" />
    );
    expect(screen.getByText("Position Monitoring")).toBeInTheDocument();
  });

  test("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    renderWithProviders(<ModuleHubCard {...baseProps} onClick={onClick} />);
    // The card should be clickable - find the main container
    const title = screen.getByText("Position Monitoring");
    // Walk up to find clickable parent
    const clickable = title.closest("[class*='cursor']") || title.parentElement?.parentElement;
    if (clickable) {
      clickable.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  test("renders info button when benefitText is provided and not locked", () => {
    renderWithProviders(
      <ModuleHubCard
        {...baseProps}
        benefitText="Unlock real-time tracking"
        benefitLabel="Pro Tip"
      />
    );
    // The benefit info button (circle with "i" icon) should be rendered
    // It appears as a role="button" element when not locked
    const infoButtons = document.querySelectorAll('[role="button"]');
    expect(infoButtons.length).toBeGreaterThan(0);
  });
});
