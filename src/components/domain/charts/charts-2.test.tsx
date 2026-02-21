import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockQueries, resetConvexMocks } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";

// --- Mocks ---

// next/navigation — useDateRange depends on useRouter / useSearchParams
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/domains/test",
  useSearchParams: () => new URLSearchParams(),
}));

// convex/react — vi.fn wrappers so resetConvexMocks / mockQueries can reconfigure
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

// GlowingEffect — heavy WebGL component, stub it
vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

// DateRangePicker — complex component not under test
vi.mock("@/components/common/DateRangePicker", () => ({
  DateRangePicker: () => <div data-testid="date-range-picker" />,
}));

// GradientChartTooltip — stub
vi.mock("@/components/application/charts/charts-base", () => ({
  GradientChartTooltip: () => null,
}));

// LoadingState — renders Skeleton divs
vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: ({ type }: { type?: string }) => (
    <div data-testid="loading-state" data-type={type} />
  ),
}));

// cx utility — pass through
vi.mock("@/utils/cx", () => ({
  cx: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// useAnalyticsQuery mock for CompetitorOverviewChart & CompetitorPositionScatterChart
const mockUseAnalyticsQuery = vi.fn();
vi.mock("@/hooks/useAnalyticsQuery", () => ({
  useAnalyticsQuery: (...args: unknown[]) => mockUseAnalyticsQuery(...args),
}));

// --- Imports (after mocks) ---

import { BacklinksHistoryChart } from "./BacklinksHistoryChart";
import { BacklinkVelocityChart } from "./BacklinkVelocityChart";
import { BacklinkQualityComparisonChart } from "./BacklinkQualityComparisonChart";
import { AnchorTextDistributionChart } from "./AnchorTextDistributionChart";
import { ReferringDomainQualityChart } from "./ReferringDomainQualityChart";
import { TLDDistributionChart } from "./TLDDistributionChart";
import { PlatformTypesChart } from "./PlatformTypesChart";
import { LinkAttributesChart } from "./LinkAttributesChart";
import { CompetitorBacklinkRadarChart } from "./CompetitorBacklinkRadarChart";
import { CompetitorKeywordBarsChart } from "./CompetitorKeywordBarsChart";
import { CompetitorOverviewChart } from "./CompetitorOverviewChart";
import { CompetitorPositionScatterChart } from "./CompetitorPositionScatterChart";

// --- Helpers ---

const DOMAIN_ID = "test-domain-id" as any;

beforeEach(() => {
  resetConvexMocks();
  mockUseAnalyticsQuery.mockReturnValue({
    data: undefined,
    isLoading: true,
    error: null,
    refetch: vi.fn(),
  });
});

// =========================================================================
// 1. BacklinksHistoryChart (useQuery)
// =========================================================================
describe("BacklinksHistoryChart", () => {
  it("shows loading skeleton when query returns undefined", () => {
    const { container } = render(<BacklinksHistoryChart domainId={DOMAIN_ID} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    const mockData = [
      { date: "2025-01-01", backlinks: 100 },
      { date: "2025-02-01", backlinks: 200 },
      { date: "2025-03-01", backlinks: 300 },
    ];
    mockQueries([[api.backlinks.getBacklinksHistory, mockData]]);
    render(<BacklinksHistoryChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("historyTitle")).toBeInTheDocument();
  });

  it("shows empty state when data is empty array", () => {
    mockQueries([[api.backlinks.getBacklinksHistory, []]]);
    render(<BacklinksHistoryChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("historyEmpty")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([[api.backlinks.getBacklinksHistory, null]]);
    render(<BacklinksHistoryChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("historyEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 2. BacklinkVelocityChart (props-based)
// =========================================================================
describe("BacklinkVelocityChart", () => {
  const mockVelocityData = [
    { date: "2025-01-01", newBacklinks: 50, lostBacklinks: 10, netChange: 40 },
    { date: "2025-02-01", newBacklinks: 30, lostBacklinks: 20, netChange: 10 },
  ];

  it("shows loading skeleton when isLoading is true", () => {
    const { container } = render(
      <BacklinkVelocityChart data={[]} isLoading={true} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    render(<BacklinkVelocityChart data={mockVelocityData} />);
    expect(screen.getByText("velocityTitle")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    render(<BacklinkVelocityChart data={[]} />);
    expect(screen.getByText("velocityEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 3. BacklinkQualityComparisonChart (useQuery)
// =========================================================================
describe("BacklinkQualityComparisonChart", () => {
  it("shows loading skeleton when query returns undefined", () => {
    const { container } = render(
      <BacklinkQualityComparisonChart domainId={DOMAIN_ID} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    const mockData = {
      series: [
        { name: "__own__", data: [100, 50, 20] },
        { name: "competitor.com", data: [80, 40, 30] },
      ],
    };
    mockQueries([
      [api.competitorComparison_queries.getBacklinkQualityComparison, mockData],
    ]);
    render(<BacklinkQualityComparisonChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("backlinkQualityTitle")).toBeInTheDocument();
    expect(screen.getByText("chartYourDomain")).toBeInTheDocument();
    expect(screen.getByText("competitor.com")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([
      [api.competitorComparison_queries.getBacklinkQualityComparison, null],
    ]);
    render(<BacklinkQualityComparisonChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });

  it("shows empty state when series is empty", () => {
    mockQueries([
      [api.competitorComparison_queries.getBacklinkQualityComparison, { series: [] }],
    ]);
    render(<BacklinkQualityComparisonChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });
});

// =========================================================================
// 4. AnchorTextDistributionChart (useQuery)
// =========================================================================
describe("AnchorTextDistributionChart", () => {
  it("shows loading skeleton when query returns undefined", () => {
    const { container } = render(
      <AnchorTextDistributionChart domainId={DOMAIN_ID} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    const mockData = {
      total: 200,
      categories: [
        { name: "branded", count: 80, percentage: 40 },
        { name: "exact_url", count: 60, percentage: 30 },
        { name: "generic", count: 40, percentage: 20 },
        { name: "other", count: 20, percentage: 10 },
      ],
    };
    mockQueries([
      [api.backlinkAnalysis_queries.getAnchorTextDistribution, mockData],
    ]);
    render(<AnchorTextDistributionChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("anchorDistributionTitle")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([
      [api.backlinkAnalysis_queries.getAnchorTextDistribution, null],
    ]);
    render(<AnchorTextDistributionChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("anchorDistributionEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 5. ReferringDomainQualityChart (useQuery)
// =========================================================================
describe("ReferringDomainQualityChart", () => {
  it("shows loading skeleton when query returns undefined", () => {
    const { container } = render(
      <ReferringDomainQualityChart domainId={DOMAIN_ID} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    const mockData = {
      avgScore: 72,
      distribution: [
        { tier: "excellent", count: 50, percentage: 25 },
        { tier: "good", count: 80, percentage: 40 },
        { tier: "average", count: 50, percentage: 25 },
        { tier: "poor", count: 20, percentage: 10 },
      ],
    };
    mockQueries([
      [api.backlinkAnalysis_queries.getLinkQualityScores, mockData],
    ]);
    render(<ReferringDomainQualityChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("qualityTitle")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([
      [api.backlinkAnalysis_queries.getLinkQualityScores, null],
    ]);
    render(<ReferringDomainQualityChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("qualityEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 6. TLDDistributionChart (props-based)
// =========================================================================
describe("TLDDistributionChart", () => {
  it("shows loading skeleton when isLoading is true", () => {
    const { container } = render(
      <TLDDistributionChart data={{}} isLoading={true} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    const data = { com: 500, org: 200, net: 100, io: 50, co: 30 };
    render(<TLDDistributionChart data={data} />);
    expect(screen.getByText("tldTitle")).toBeInTheDocument();
  });

  it("shows empty state when data is empty object", () => {
    render(<TLDDistributionChart data={{}} />);
    expect(screen.getByText("tldEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 7. PlatformTypesChart (props-based)
// =========================================================================
describe("PlatformTypesChart", () => {
  it("shows loading skeleton when isLoading is true", () => {
    const { container } = render(
      <PlatformTypesChart data={{}} isLoading={true} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders radar chart with data", () => {
    const data = {
      blog: 300,
      forum: 150,
      "social-media": 100,
      news: 80,
      wiki: 50,
    };
    render(<PlatformTypesChart data={data} />);
    expect(screen.getByText("platformsTitle")).toBeInTheDocument();
  });

  it("shows empty state when data is empty object", () => {
    render(<PlatformTypesChart data={{}} />);
    expect(screen.getByText("platformsEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 8. LinkAttributesChart (props-based)
// =========================================================================
describe("LinkAttributesChart", () => {
  it("shows loading skeleton when isLoading is true", () => {
    const { container } = render(
      <LinkAttributesChart data={{}} isLoading={true} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders radar chart with 3+ attributes", () => {
    const data = { dofollow: 500, nofollow: 200, ugc: 50, sponsored: 30 };
    render(<LinkAttributesChart data={data} />);
    expect(screen.getByText("linkAttributesTitle")).toBeInTheDocument();
    expect(screen.getByText("linkAttributesDescription")).toBeInTheDocument();
  });

  it("renders bar chart with fewer than 3 attributes", () => {
    const data = { dofollow: 500, nofollow: 200 };
    render(<LinkAttributesChart data={data} />);
    expect(screen.getByText("linkAttributesTitle")).toBeInTheDocument();
  });

  it("shows empty state when data is empty object", () => {
    render(<LinkAttributesChart data={{}} />);
    expect(screen.getByText("linkAttributesEmpty")).toBeInTheDocument();
  });
});

// =========================================================================
// 9. CompetitorBacklinkRadarChart (useQuery)
// =========================================================================
describe("CompetitorBacklinkRadarChart", () => {
  it("shows loading skeleton when query returns undefined", () => {
    const { container } = render(
      <CompetitorBacklinkRadarChart domainId={DOMAIN_ID} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders metric bars with data", () => {
    const mockData = [
      {
        metric: "totalBacklinks",
        yourValue: 500,
        competitors: [
          { name: "rival.com", value: 300 },
          { name: "other.com", value: 200 },
        ],
      },
      {
        metric: "referringDomains",
        yourValue: 100,
        competitors: [
          { name: "rival.com", value: 80 },
          { name: "other.com", value: 60 },
        ],
      },
    ];
    mockQueries([
      [api.competitorComparison_queries.getBacklinkRadarData, mockData],
    ]);
    render(<CompetitorBacklinkRadarChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("backlinkRadarTitle")).toBeInTheDocument();
    expect(screen.getAllByText("rival.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("other.com").length).toBeGreaterThan(0);
  });

  it("shows empty state when data is empty array", () => {
    mockQueries([
      [api.competitorComparison_queries.getBacklinkRadarData, []],
    ]);
    render(<CompetitorBacklinkRadarChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([
      [api.competitorComparison_queries.getBacklinkRadarData, null],
    ]);
    render(<CompetitorBacklinkRadarChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });
});

// =========================================================================
// 10. CompetitorKeywordBarsChart (useQuery)
// =========================================================================
describe("CompetitorKeywordBarsChart", () => {
  it("shows loading skeleton when query returns undefined", () => {
    const { container } = render(
      <CompetitorKeywordBarsChart domainId={DOMAIN_ID} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders keyword position table with data", () => {
    const mockData = {
      keywords: ["keyword1", "keyword2", "keyword3"],
      series: [
        { name: "__own__", positions: [1, 5, 10] },
        { name: "competitor.com", positions: [3, 8, null] },
      ],
    };
    mockQueries([
      [api.competitorComparison_queries.getKeywordPositionBars, mockData],
    ]);
    render(<CompetitorKeywordBarsChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("keywordBarsTitle")).toBeInTheDocument();
    expect(screen.getByText("keyword1")).toBeInTheDocument();
    expect(screen.getByText("keyword2")).toBeInTheDocument();
    expect(screen.getByText("keyword3")).toBeInTheDocument();
  });

  it("shows empty state when keywords array is empty", () => {
    mockQueries([
      [
        api.competitorComparison_queries.getKeywordPositionBars,
        { keywords: [], series: [] },
      ],
    ]);
    render(<CompetitorKeywordBarsChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockQueries([
      [api.competitorComparison_queries.getKeywordPositionBars, null],
    ]);
    render(<CompetitorKeywordBarsChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });
});

// =========================================================================
// 11. CompetitorOverviewChart (useAnalyticsQuery)
// =========================================================================
describe("CompetitorOverviewChart", () => {
  it("shows loading state when isLoading is true", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorOverviewChart domainId={DOMAIN_ID} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("renders chart with valid competitor data", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: {
        data: [
          {
            date: "2025-01-01",
            ownAvgPosition: 5,
            competitors: [{ competitorId: "c1", avgPosition: 8 }],
          },
        ],
        competitors: [{ id: "c1", name: "rival.com", domain: "rival.com" }],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorOverviewChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("competitorOverviewTitle")).toBeInTheDocument();
    expect(screen.getAllByTestId("responsive-container").length).toBeGreaterThan(0);
  });

  it("shows empty state when no competitors", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: { data: [], competitors: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorOverviewChart domainId={DOMAIN_ID} />);
    expect(
      screen.getByText("competitorOverviewNoCompetitors")
    ).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorOverviewChart domainId={DOMAIN_ID} />);
    expect(
      screen.getByText("competitorOverviewNoCompetitors")
    ).toBeInTheDocument();
  });
});

// =========================================================================
// 12. CompetitorPositionScatterChart (useAnalyticsQuery)
// =========================================================================
describe("CompetitorPositionScatterChart", () => {
  it("shows loading skeleton when isLoading is true", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(
      <CompetitorPositionScatterChart domainId={DOMAIN_ID} />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders stacked bar chart with data", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: [
        {
          keyword: "seo tools",
          yourPosition: 3,
          competitorName: "rival.com",
          competitorPosition: 10,
          searchVolume: 5000,
        },
        {
          keyword: "keyword tracker",
          yourPosition: 8,
          competitorName: "rival.com",
          competitorPosition: 2,
          searchVolume: 3000,
        },
        {
          keyword: "rank checker",
          yourPosition: 5,
          competitorName: "rival.com",
          competitorPosition: 5,
          searchVolume: 2000,
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorPositionScatterChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("winRateTitle")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows empty state when data is empty array", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorPositionScatterChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });

  it("shows empty state when data is null", () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<CompetitorPositionScatterChart domainId={DOMAIN_ID} />);
    expect(screen.getByText("chartNoData")).toBeInTheDocument();
  });
});
