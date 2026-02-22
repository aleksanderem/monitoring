/**
 * Component-level tests for the first batch of chart components.
 *
 * 13 components tested:
 *  1. MiniSparkline
 *  2. PositionDistributionChart
 *  3. PositionHistoryChart
 *  4. MovementTrendChart
 *  5. DifficultyDistributionChart
 *  6. IntentDistributionChart
 *  7. SERPFeaturesChart
 *  8. KeywordMapBubbleChart
 *  9. ContentGapBubbleChart
 * 10. ContentGapTrendsChart
 * 11. MonthlySearchTrendChart
 * 12. CountriesDistributionChart
 * 13. GroupPerformanceChart
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/domains/domain_1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "domain_1" }),
}));

vi.mock("@/hooks/use-breakpoint", () => ({
  useBreakpoint: () => true,
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock("@/components/application/charts/charts-base", () => ({
  ChartLegendContent: ({ className }: any) => <div data-testid="chart-legend" className={className} />,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
  GradientChartTooltip: () => <div data-testid="gradient-chart-tooltip" />,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children, className }: any) => (
    <div data-testid="chart-container" className={className}>{children}</div>
  ),
  ChartTooltip: ({ children }: any) => <div data-testid="chart-tooltip">{children}</div>,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
  ChartLegend: ({ children }: any) => <div data-testid="chart-legend">{children}</div>,
  ChartLegendContent: () => <div data-testid="chart-legend-content" />,
}));

vi.mock("@/components/common/DateRangePicker", () => ({
  DateRangePicker: () => <div data-testid="date-range-picker" />,
}));

vi.mock("@/hooks/useDateRange", () => ({
  useDateRange: () => ({
    dateRange: {
      from: new Date("2025-01-01"),
      to: new Date("2025-12-31"),
      preset: "1y",
    },
    setDateRange: vi.fn(),
  }),
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/base/tooltip/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/hooks/useAnalyticsQuery", () => ({
  useAnalyticsQuery: vi.fn(() => ({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })),
}));

// Override global next-intl mock to include NextIntlClientProvider for renderWithProviders
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { useAction } from "convex/react";
import { mockQueries, resetConvexMocks, mockAction } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";
import { MiniSparkline } from "./MiniSparkline";
import { PositionDistributionChart } from "./PositionDistributionChart";
import { PositionHistoryChart } from "./PositionHistoryChart";
import { MovementTrendChart } from "./MovementTrendChart";
import { DifficultyDistributionChart } from "./DifficultyDistributionChart";
import { IntentDistributionChart } from "./IntentDistributionChart";
import { SERPFeaturesChart } from "./SERPFeaturesChart";
import { KeywordMapBubbleChart } from "./KeywordMapBubbleChart";
import { ContentGapBubbleChart } from "./ContentGapBubbleChart";
import { ContentGapTrendsChart } from "./ContentGapTrendsChart";
import { MonthlySearchTrendChart } from "./MonthlySearchTrendChart";
import { CountriesDistributionChart } from "./CountriesDistributionChart";
import { GroupPerformanceChart } from "./GroupPerformanceChart";
import { useAnalyticsQuery } from "@/hooks/useAnalyticsQuery";

beforeEach(() => {
  resetConvexMocks();
  vi.mocked(useAnalyticsQuery).mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
});

// ===========================================================================
// 1. MiniSparkline (props-based)
// ===========================================================================
describe("MiniSparkline", () => {
  it("renders empty div when data is empty array", () => {
    const { container } = renderWithProviders(<MiniSparkline data={[]} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders empty div when data is null-ish", () => {
    const { container } = renderWithProviders(<MiniSparkline data={null as any} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders chart with valid data", () => {
    renderWithProviders(
      <MiniSparkline data={[
        { date: 1700000000000, position: 5 },
        { date: 1700100000000, position: 3 },
        { date: 1700200000000, position: 7 },
      ]} />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("filters out null positions", () => {
    renderWithProviders(
      <MiniSparkline data={[
        { date: 1700000000000, position: null },
        { date: 1700100000000, position: 3 },
      ]} />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders chart container even when all positions are null", () => {
    renderWithProviders(
      <MiniSparkline data={[
        { date: 1700000000000, position: null },
        { date: 1700100000000, position: null },
      ]} />
    );
    // data.length > 0 so it enters the chart branch
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = renderWithProviders(<MiniSparkline data={[]} className="my-sparkline" />);
    expect(container.querySelector(".my-sparkline")).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. PositionDistributionChart
// ===========================================================================
describe("PositionDistributionChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<PositionDistributionChart domainId={"d1" as any} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("returns null when query returns null (falsy, non-undefined)", () => {
    mockQueries([[api.keywords.getPositionDistribution, null]]);
    const { container } = renderWithProviders(<PositionDistributionChart domainId={"d1" as any} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows empty state when all distribution values are zero", () => {
    mockQueries([[api.keywords.getPositionDistribution, {
      top3: 0, pos4_10: 0, pos11_20: 0, pos21_50: 0, pos51_100: 0, pos100plus: 0,
    }]]);
    renderWithProviders(<PositionDistributionChart domainId={"d1" as any} />);
    expect(screen.getByText("No position data available")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    mockQueries([[api.keywords.getPositionDistribution, {
      top3: 10, pos4_10: 20, pos11_20: 15, pos21_50: 8, pos51_100: 3, pos100plus: 1,
    }]]);
    renderWithProviders(<PositionDistributionChart domainId={"d1" as any} />);
    expect(screen.getByText("Current Position Distribution")).toBeInTheDocument();
    expect(screen.getByText(/How your keywords are distributed/)).toBeInTheDocument();
  });
});

// ===========================================================================
// 3. PositionHistoryChart
// ===========================================================================
describe("PositionHistoryChart", () => {
  it("shows loading state when queries return undefined", () => {
    renderWithProviders(<PositionHistoryChart domainId={"d1" as any} />);
    expect(screen.getByText("Position History")).toBeInTheDocument();
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("shows empty state when history is empty", () => {
    mockQueries([
      [api.domains.getDomain, { _id: "d1", domain: "example.com", settings: { location: 2840, language: "en" } }],
      [api.domains.getVisibilityHistory, []],
    ]);
    renderWithProviders(<PositionHistoryChart domainId={"d1" as any} />);
    expect(screen.getByText("No historical data yet")).toBeInTheDocument();
    expect(screen.getByText("Check back after the first ranking update")).toBeInTheDocument();
  });

  it("renders chart with history data", () => {
    const historyData = [
      { date: "2025-01-01", metrics: { pos_1: 5, pos_2_3: 10, pos_4_10: 20, pos_11_20: 15, pos_21_30: 5, pos_31_40: 3, pos_41_50: 2, pos_51_60: 1, pos_61_70: 0, pos_71_80: 0, pos_81_90: 0, pos_91_100: 0 } },
      { date: "2025-02-01", metrics: { pos_1: 6, pos_2_3: 12, pos_4_10: 22, pos_11_20: 13, pos_21_30: 4, pos_31_40: 2, pos_41_50: 1, pos_51_60: 1, pos_61_70: 0, pos_71_80: 0, pos_81_90: 0, pos_91_100: 0 } },
    ];
    mockQueries([
      [api.domains.getDomain, { _id: "d1", domain: "example.com", settings: { location: 2840, language: "en" } }],
      [api.domains.getVisibilityHistory, historyData],
    ]);
    renderWithProviders(<PositionHistoryChart domainId={"d1" as any} />);
    expect(screen.getByText("Position History")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 4. MovementTrendChart (uses useAction, not useQuery)
// ===========================================================================
describe("MovementTrendChart", () => {
  it("shows loading state when action has not resolved yet", () => {
    // Action returns a never-resolving promise → trend stays undefined → loading state
    const actionFn = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.mocked(useAction).mockReturnValue(actionFn as any);
    renderWithProviders(<MovementTrendChart domainId={"d1" as any} />);
    expect(screen.getByText("Position Movement Trend (6 months)")).toBeInTheDocument();
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("shows empty state when trend is empty array", async () => {
    const actionFn = vi.fn().mockResolvedValue([]);
    vi.mocked(useAction).mockReturnValue(actionFn as any);
    renderWithProviders(<MovementTrendChart domainId={"d1" as any} />);
    await waitFor(() => {
      expect(screen.getByText("No historical data yet")).toBeInTheDocument();
    });
    expect(screen.getByText(/Click "Refresh Keywords"/)).toBeInTheDocument();
  });

  it("renders chart with trend data", async () => {
    const actionFn = vi.fn().mockResolvedValue([
      { date: new Date("2025-01-01").getTime(), gainers: 10, losers: 5 },
      { date: new Date("2025-01-02").getTime(), gainers: 12, losers: 3 },
    ]);
    vi.mocked(useAction).mockReturnValue(actionFn as any);
    renderWithProviders(<MovementTrendChart domainId={"d1" as any} />);
    await waitFor(() => {
      expect(screen.getByText("Position Movement Trend (6 months)")).toBeInTheDocument();
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 5. DifficultyDistributionChart
// ===========================================================================
describe("DifficultyDistributionChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<DifficultyDistributionChart domainId={"d1" as any} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when total is 0", () => {
    mockQueries([[api.keywordMap_queries.getDifficultyDistribution, {
      total: 0,
      distribution: { easy: 0, medium: 0, hard: 0, very_hard: 0 },
      volumeByTier: { easy: 0, medium: 0, hard: 0, very_hard: 0 },
    }]]);
    renderWithProviders(<DifficultyDistributionChart domainId={"d1" as any} />);
    expect(screen.getByText("No difficulty data available")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    mockQueries([[api.keywordMap_queries.getDifficultyDistribution, {
      total: 50,
      distribution: { easy: 20, medium: 15, hard: 10, very_hard: 5 },
      volumeByTier: { easy: 5000, medium: 3000, hard: 2000, very_hard: 1000 },
    }]]);
    renderWithProviders(<DifficultyDistributionChart domainId={"d1" as any} />);
    expect(screen.getByText("Difficulty Distribution")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. IntentDistributionChart
// ===========================================================================
describe("IntentDistributionChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<IntentDistributionChart domainId={"d1" as any} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when all intents have zero count", () => {
    mockQueries([[api.keywordMap_queries.getIntentDistribution, {
      commercial: { count: 0, totalVolume: 0, avgPosition: 0 },
      informational: { count: 0, totalVolume: 0, avgPosition: 0 },
      navigational: { count: 0, totalVolume: 0, avgPosition: 0 },
      transactional: { count: 0, totalVolume: 0, avgPosition: 0 },
    }]]);
    renderWithProviders(<IntentDistributionChart domainId={"d1" as any} />);
    expect(screen.getByText("No intent data available")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    mockQueries([[api.keywordMap_queries.getIntentDistribution, {
      commercial: { count: 15, totalVolume: 10000, avgPosition: 8.5 },
      informational: { count: 30, totalVolume: 25000, avgPosition: 12.3 },
      navigational: { count: 5, totalVolume: 3000, avgPosition: 3.2 },
      transactional: { count: 10, totalVolume: 8000, avgPosition: 15.1 },
    }]]);
    renderWithProviders(<IntentDistributionChart domainId={"d1" as any} />);
    expect(screen.getByText("Search Intent Distribution")).toBeInTheDocument();
    expect(screen.getByText(/Breakdown of keywords by user search intent/)).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 7. SERPFeaturesChart
// ===========================================================================
describe("SERPFeaturesChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<SERPFeaturesChart domainId={"d1" as any} />);
    const pulseElement = document.querySelector(".animate-pulse");
    expect(pulseElement).toBeInTheDocument();
    expect(screen.getByText("Loading SERP features...")).toBeInTheDocument();
  });

  it("returns null when query returns null", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, null]]);
    const { container } = renderWithProviders(<SERPFeaturesChart domainId={"d1" as any} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows empty state when totalDataPoints is 0", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, {
      totalDataPoints: 0,
      totalKeywords: 0,
      featurePercentages: {},
      featureCounts: {},
    }]]);
    renderWithProviders(<SERPFeaturesChart domainId={"d1" as any} />);
    expect(screen.getByText("No SERP features data yet")).toBeInTheDocument();
    expect(screen.getByText("SERP features will appear here after keyword position checks")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    mockQueries([[api.serpFeatures_queries.getSerpFeaturesSummary, {
      totalDataPoints: 100,
      totalKeywords: 50,
      featurePercentages: { featuredSnippet: 25.5, peopleAlsoAsk: 60.2, imagePack: 15.0 },
      featureCounts: { featuredSnippet: 13, peopleAlsoAsk: 30, imagePack: 8 },
    }]]);
    renderWithProviders(<SERPFeaturesChart domainId={"d1" as any} />);
    expect(screen.getByText("SERP Features Presence")).toBeInTheDocument();
    expect(screen.getByText("Percentage of keywords showing each feature")).toBeInTheDocument();
  });
});

// ===========================================================================
// 8. KeywordMapBubbleChart
// ===========================================================================
describe("KeywordMapBubbleChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<KeywordMapBubbleChart domainId={"d1" as any} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when data is empty array", () => {
    mockQueries([[api.keywordMap_queries.getKeywordMapBubbleData, []]]);
    renderWithProviders(<KeywordMapBubbleChart domainId={"d1" as any} />);
    expect(screen.getByText("No keyword data available for bubble chart")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([[api.keywordMap_queries.getKeywordMapBubbleData, null]]);
    renderWithProviders(<KeywordMapBubbleChart domainId={"d1" as any} />);
    expect(screen.getByText("No keyword data available for bubble chart")).toBeInTheDocument();
  });

  it("renders chart with bubble data", () => {
    mockQueries([[api.keywordMap_queries.getKeywordMapBubbleData, [
      { keyword: "seo tools", position: 5, searchVolume: 12000, difficulty: 45, etv: 800, intent: "commercial" },
      { keyword: "keyword research", position: 12, searchVolume: 8000, difficulty: 60, etv: 400, intent: "informational" },
    ]]]);
    renderWithProviders(<KeywordMapBubbleChart domainId={"d1" as any} />);
    expect(screen.getByText("Keyword Map")).toBeInTheDocument();
    expect(screen.getByText(/Volume vs Difficulty/)).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 9. ContentGapBubbleChart
// ===========================================================================
describe("ContentGapBubbleChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<ContentGapBubbleChart domainId={"d1" as any} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when no gaps found", () => {
    mockQueries([[api.contentGaps_queries.getContentGaps, []]]);
    renderWithProviders(<ContentGapBubbleChart domainId={"d1" as any} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("shows empty state when gaps is null", () => {
    mockQueries([[api.contentGaps_queries.getContentGaps, null]]);
    renderWithProviders(<ContentGapBubbleChart domainId={"d1" as any} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders chart with gap data", () => {
    mockQueries([[api.contentGaps_queries.getContentGaps, [
      { keywordPhrase: "seo tips", difficulty: 30, searchVolume: 5000, opportunityScore: 75 },
      { keywordPhrase: "link building", difficulty: 55, searchVolume: 3000, opportunityScore: 50 },
      { keywordPhrase: "seo tips", difficulty: 30, searchVolume: 5000, opportunityScore: 80 },
    ]]]);
    renderWithProviders(<ContentGapBubbleChart domainId={"d1" as any} />);
    expect(screen.getByText("Content Gap Opportunity Map")).toBeInTheDocument();
    expect(screen.getByText(/Gap keywords plotted by difficulty/)).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 10. ContentGapTrendsChart
// ===========================================================================
describe("ContentGapTrendsChart", () => {
  it("shows loading state when query returns undefined", () => {
    renderWithProviders(<ContentGapTrendsChart domainId={"d1" as any} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when trends is empty array", () => {
    mockQueries([[api.contentGaps_queries.getGapTrends, []]]);
    renderWithProviders(<ContentGapTrendsChart domainId={"d1" as any} />);
    expect(screen.getByText("Gap Trends")).toBeInTheDocument();
    expect(screen.getByText("No trend data yet. Run content gap analysis to start tracking.")).toBeInTheDocument();
  });

  it("shows empty state when trends is null", () => {
    mockQueries([[api.contentGaps_queries.getGapTrends, null]]);
    renderWithProviders(<ContentGapTrendsChart domainId={"d1" as any} />);
    expect(screen.getByText("No trend data yet. Run content gap analysis to start tracking.")).toBeInTheDocument();
  });

  it("renders chart with trend data", () => {
    mockQueries([[api.contentGaps_queries.getGapTrends, [
      { date: "2025-01-01", totalGaps: 20, highPriorityGaps: 5, estimatedValue: 15000 },
      { date: "2025-01-15", totalGaps: 25, highPriorityGaps: 8, estimatedValue: 20000 },
    ]]]);
    renderWithProviders(<ContentGapTrendsChart domainId={"d1" as any} />);
    expect(screen.getByText("Gap Trends")).toBeInTheDocument();
    expect(screen.getByText("Content gap changes over time")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 11. MonthlySearchTrendChart (props-based)
// ===========================================================================
describe("MonthlySearchTrendChart", () => {
  it("shows empty state when monthlySearches is empty", () => {
    renderWithProviders(<MonthlySearchTrendChart monthlySearches={[]} />);
    expect(screen.getByText("No trend data available")).toBeInTheDocument();
  });

  it("shows empty state when monthlySearches is null", () => {
    renderWithProviders(<MonthlySearchTrendChart monthlySearches={null as any} />);
    expect(screen.getByText("No trend data available")).toBeInTheDocument();
  });

  it("renders chart with monthly data", () => {
    renderWithProviders(
      <MonthlySearchTrendChart monthlySearches={[
        { year: 2025, month: 1, search_volume: 1000 },
        { year: 2025, month: 2, search_volume: 1200 },
        { year: 2025, month: 3, search_volume: 900 },
      ]} />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByText("Avg Volume")).toBeInTheDocument();
    expect(screen.getByText("Peak Volume")).toBeInTheDocument();
    expect(screen.getByText("Low Volume")).toBeInTheDocument();
  });

  it("shows trending up when last volume > first volume", () => {
    renderWithProviders(
      <MonthlySearchTrendChart monthlySearches={[
        { year: 2025, month: 1, search_volume: 500 },
        { year: 2025, month: 2, search_volume: 1000 },
      ]} />
    );
    expect(screen.getByText("Trending Up")).toBeInTheDocument();
  });

  it("shows trending down when last volume < first volume", () => {
    renderWithProviders(
      <MonthlySearchTrendChart monthlySearches={[
        { year: 2025, month: 1, search_volume: 1000 },
        { year: 2025, month: 2, search_volume: 500 },
      ]} />
    );
    expect(screen.getByText("Trending Down")).toBeInTheDocument();
  });

  it("shows stable trend when volumes are equal", () => {
    renderWithProviders(
      <MonthlySearchTrendChart monthlySearches={[
        { year: 2025, month: 1, search_volume: 1000 },
        { year: 2025, month: 2, search_volume: 1000 },
      ]} />
    );
    expect(screen.getByText(/Stable/)).toBeInTheDocument();
  });
});

// ===========================================================================
// 12. CountriesDistributionChart (props-based)
// ===========================================================================
describe("CountriesDistributionChart", () => {
  it("shows loading state when isLoading is true", () => {
    renderWithProviders(<CountriesDistributionChart data={{}} isLoading={true} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when data is empty object", () => {
    renderWithProviders(<CountriesDistributionChart data={{}} />);
    expect(screen.getByText("Countries Distribution")).toBeInTheDocument();
    expect(screen.getByText("No country data available")).toBeInTheDocument();
  });

  it("shows empty state when all keys are blank strings", () => {
    renderWithProviders(<CountriesDistributionChart data={{ "": 50 }} />);
    expect(screen.getByText("No country data available")).toBeInTheDocument();
  });

  it("renders chart with country data", () => {
    renderWithProviders(
      <CountriesDistributionChart data={{ US: 500, GB: 300, DE: 200, FR: 150 }} />
    );
    expect(screen.getByText("Countries Distribution")).toBeInTheDocument();
    expect(screen.getByText(/Geographic distribution of your backlinks/)).toBeInTheDocument();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});

// ===========================================================================
// 13. GroupPerformanceChart (useAnalyticsQuery-based)
// ===========================================================================
describe("GroupPerformanceChart", () => {
  it("shows loading state when isLoading is true", () => {
    vi.mocked(useAnalyticsQuery).mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    renderWithProviders(<GroupPerformanceChart domainId={"d1" as any} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("shows empty state when data is empty array", () => {
    vi.mocked(useAnalyticsQuery).mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    renderWithProviders(<GroupPerformanceChart domainId={"d1" as any} />);
    expect(screen.getByText("No groups created yet")).toBeInTheDocument();
    expect(screen.getByText("Create keyword groups to see performance comparison")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    vi.mocked(useAnalyticsQuery).mockReturnValue({ data: null as any, isLoading: false, error: null, refetch: vi.fn() });
    renderWithProviders(<GroupPerformanceChart domainId={"d1" as any} />);
    expect(screen.getByText("No groups created yet")).toBeInTheDocument();
  });

  it("renders chart with group performance data", () => {
    vi.mocked(useAnalyticsQuery).mockReturnValue({
      data: [
        {
          groupId: "g1",
          name: "Brand Keywords",
          color: "#3b82f6",
          history: [
            { date: 1704067200000, avgPosition: 5.2 },
            { date: 1704153600000, avgPosition: 4.8 },
          ],
        },
        {
          groupId: "g2",
          name: "Long Tail",
          color: "#10b981",
          history: [
            { date: 1704067200000, avgPosition: 15.0 },
            { date: 1704153600000, avgPosition: 13.5 },
          ],
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderWithProviders(<GroupPerformanceChart domainId={"d1" as any} />);
    expect(screen.getByText("Group Performance Comparison")).toBeInTheDocument();
    expect(screen.getByText(/Average ranking position over time/)).toBeInTheDocument();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });
});
