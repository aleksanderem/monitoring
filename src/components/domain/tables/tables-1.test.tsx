import { describe, test, expect, beforeEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { mockQueries, resetConvexMocks } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/domains/test",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock("@/components/base/input/input", () => ({
  Input: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/base/badges/badges", () => ({
  Badge: ({
    children,
    color,
  }: {
    children: React.ReactNode;
    color?: string;
    [key: string]: unknown;
  }) => <span data-color={color}>{children}</span>,
  BadgeWithDot: ({
    children,
    color,
  }: {
    children: React.ReactNode;
    color?: string;
    [key: string]: unknown;
  }) => <span data-color={color}>{children}</span>,
}));

vi.mock("@/components/base/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/patterns/BulkActionBar", () => ({
  BulkActionBar: ({ selectedCount }: { selectedCount: number }) =>
    selectedCount > 0 ? (
      <div data-testid="bulk-bar">{selectedCount} selected</div>
    ) : null,
}));

vi.mock("@/hooks/useRowSelection", () => ({
  useRowSelection: () => ({
    selectedIds: new Set<string>(),
    count: 0,
    isSelected: () => false,
    isAllSelected: () => false,
    isIndeterminate: () => false,
    toggle: vi.fn(),
    toggleAll: vi.fn(),
    clear: vi.fn(),
    select: vi.fn(),
  }),
}));

// Modal mocks for KeywordMonitoringTable
vi.mock("../modals/AddKeywordsModal", () => ({
  AddKeywordsModal: () => null,
}));
vi.mock("../modals/KeywordMonitoringDetailModal", () => ({
  KeywordMonitoringDetailModal: () => null,
}));
vi.mock("../modals/RefreshConfirmModal", () => ({
  RefreshConfirmModal: () => null,
}));
vi.mock("../charts/KeywordPositionChart", () => ({
  KeywordPositionChart: () => <div data-testid="position-chart" />,
}));

// Modal mocks for ReferringDomainsTable
vi.mock("../modals/ReferringDomainDetailModal", () => ({
  ReferringDomainDetailModal: () => null,
}));

// Mocks for DiscoveredKeywordsTable
vi.mock("../cards/KeywordDetailCard", () => ({
  KeywordDetailCard: () => <div data-testid="keyword-detail-card" />,
}));
vi.mock("../charts/MonthlySearchTrendChart", () => ({
  MonthlySearchTrendChart: () => <div data-testid="monthly-chart" />,
}));
vi.mock("../tooltips/KeywordTooltip", () => ({
  KeywordTooltip: () => null,
}));
vi.mock("../modals/KeywordDetailModal", () => ({
  KeywordDetailModal: () => null,
}));

// Modal mocks for ContentGapOpportunitiesTable
vi.mock("../modals/ContentGapDetailModal", () => ({
  ContentGapDetailModal: () => null,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { AllKeywordsTable } from "./AllKeywordsTable";
import { TopKeywordsTable } from "./TopKeywordsTable";
import { KeywordMonitoringTable } from "./KeywordMonitoringTable";
import { BacklinksTable } from "./BacklinksTable";
import { ReferringDomainsTable } from "./ReferringDomainsTable";
import { AnchorTextTable } from "./AnchorTextTable";
import { ToxicLinksTable } from "./ToxicLinksTable";
import { TLDDistributionTable } from "./TLDDistributionTable";
import { DiscoveredKeywordsTable } from "./DiscoveredKeywordsTable";
import { CompetitorOverlapTable } from "./CompetitorOverlapTable";
import { ContentGapOpportunitiesTable } from "./ContentGapOpportunitiesTable";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const domainId = "d1" as Id<"domains">;

beforeEach(() => {
  resetConvexMocks();
  vi.clearAllMocks();
});

// ===========================================================================
// 1. AllKeywordsTable
// ===========================================================================
describe("AllKeywordsTable", () => {
  test("shows loading state when query returns undefined", () => {
    renderWithProviders(<AllKeywordsTable domainId={domainId} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  test("shows empty state when keywords array is empty", () => {
    mockQueries([[api.keywords.getKeywords, []]]);
    renderWithProviders(<AllKeywordsTable domainId={domainId} />);
    expect(screen.getByText("noKeywordsFound")).toBeInTheDocument();
  });

  test("renders keyword rows with data", () => {
    const keywords = [
      {
        _id: "kw1",
        phrase: "react testing",
        currentPosition: 5,
        previousPosition: 8,
        searchVolume: 12000,
      },
      {
        _id: "kw2",
        phrase: "vitest guide",
        currentPosition: 12,
        previousPosition: 12,
        searchVolume: 3400,
      },
    ];
    mockQueries([[api.keywords.getKeywords, keywords]]);
    renderWithProviders(<AllKeywordsTable domainId={domainId} />);
    expect(screen.getByText("react testing")).toBeInTheDocument();
    expect(screen.getByText("vitest guide")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    // 12000 formatted as 12.0K
    expect(screen.getByText("12.0K")).toBeInTheDocument();
  });

  test("renders title and description", () => {
    const keywords = [{ _id: "kw1", phrase: "test", currentPosition: 1, previousPosition: 1, searchVolume: 100 }];
    mockQueries([[api.keywords.getKeywords, keywords]]);
    renderWithProviders(<AllKeywordsTable domainId={domainId} />);
    expect(screen.getByText("allKeywords")).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. TopKeywordsTable
// ===========================================================================
describe("TopKeywordsTable", () => {
  const baseProps = {
    title: "Top 10 Keywords",
    description: "Your best performing keywords",
  };

  test("shows loading skeleton when isLoading is true", () => {
    renderWithProviders(
      <TopKeywordsTable keywords={[]} isLoading={true} {...baseProps} />
    );
    // Loading renders pulse skeletons, no table
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("shows empty state when keywords is empty", () => {
    renderWithProviders(
      <TopKeywordsTable keywords={[]} isLoading={false} {...baseProps} />
    );
    expect(screen.getByText("noKeywordsInRange")).toBeInTheDocument();
    expect(screen.getByText("Top 10 Keywords")).toBeInTheDocument();
  });

  test("renders keyword rows with position, phrase, volume, difficulty", () => {
    const keywords = [
      {
        _id: "tk1",
        phrase: "best seo tool",
        position: 2,
        previousPosition: 4,
        change: 2,
        volume: 8000,
        difficulty: 25,
      },
      {
        _id: "tk2",
        phrase: "keyword tracker",
        position: 7,
        previousPosition: 5,
        change: -2,
        volume: 5000,
        difficulty: 55,
      },
    ];
    renderWithProviders(
      <TopKeywordsTable keywords={keywords} isLoading={false} {...baseProps} />
    );
    expect(screen.getByText("best seo tool")).toBeInTheDocument();
    expect(screen.getByText("keyword tracker")).toBeInTheDocument();
    // "2" appears multiple times (position badge + change indicators), use getAllByText
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("8000")).toBeInTheDocument();
    expect(screen.getByText("5000")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  test("renders dash for null change", () => {
    const keywords = [
      {
        _id: "tk3",
        phrase: "no change kw",
        position: 10,
        previousPosition: null,
        change: null,
        volume: 1000,
        difficulty: 40,
      },
    ];
    renderWithProviders(
      <TopKeywordsTable keywords={keywords} isLoading={false} {...baseProps} />
    );
    // null change renders dash
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 3. KeywordMonitoringTable
// ===========================================================================
describe("KeywordMonitoringTable", () => {
  test("shows loading state when query returns undefined", () => {
    renderWithProviders(<KeywordMonitoringTable domainId={domainId} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  test("shows empty state with add button when no keywords", () => {
    mockQueries([
      [api.keywords.getKeywordMonitoring, []],
      [api.keywordSerpJobs.getActiveJobForDomain, null],
    ]);
    renderWithProviders(<KeywordMonitoringTable domainId={domainId} />);
    expect(screen.getByText("noKeywordsMonitored")).toBeInTheDocument();
    expect(screen.getByText("addKeywords")).toBeInTheDocument();
  });

  test("renders keyword rows with position and phrase", () => {
    const keywords = [
      {
        keywordId: "kwm1",
        phrase: "monitoring keyword",
        currentPosition: 3,
        previousPosition: 5,
        change: 2,
        searchVolume: 9000,
        difficulty: 45,
        status: "rising",
        checkingStatus: null,
        cpc: 1.5,
        etv: 120.5,
      },
    ];
    mockQueries([
      [api.keywords.getKeywordMonitoring, keywords],
      [api.keywordSerpJobs.getActiveJobForDomain, null],
    ]);
    renderWithProviders(<KeywordMonitoringTable domainId={domainId} />);
    expect(screen.getByText("monitoring keyword")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("keywordMonitoring")).toBeInTheDocument();
  });
});

// ===========================================================================
// 4. BacklinksTable
// ===========================================================================
describe("BacklinksTable", () => {
  test("shows loading skeleton when isLoading", () => {
    renderWithProviders(
      <BacklinksTable
        backlinks={{ total: 0, items: [], stats: { totalDofollow: 0, totalNofollow: 0, avgRank: 0, avgSpamScore: 0 } }}
        isLoading={true}
      />
    );
    // Should show pulse skeleton, not the table
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("shows empty state when no backlinks", () => {
    renderWithProviders(
      <BacklinksTable
        backlinks={{ total: 0, items: [], stats: { totalDofollow: 0, totalNofollow: 0, avgRank: 0, avgSpamScore: 0 } }}
        isLoading={false}
      />
    );
    expect(screen.getByText("noBacklinksFound")).toBeInTheDocument();
  });

  test("renders backlink rows with domain and anchor", () => {
    const backlinks = {
      total: 2,
      items: [
        {
          _id: "bl1",
          urlFrom: "https://example.com/page1",
          urlTo: "https://mysite.com/",
          domainFrom: "example.com",
          anchor: "click here",
          dofollow: true,
          rank: 45,
          backlink_spam_score: 10,
          itemType: "anchor",
          lastSeen: "2024-01-15",
        },
        {
          _id: "bl2",
          urlFrom: "https://blog.test/post",
          urlTo: "https://mysite.com/about",
          domainFrom: "blog.test",
          anchor: "learn more",
          dofollow: false,
          rank: 22,
          backlink_spam_score: 65,
          itemType: "anchor",
          lastSeen: "2024-02-10",
        },
      ],
      stats: { totalDofollow: 1, totalNofollow: 1, avgRank: 33, avgSpamScore: 37.5 },
    };
    renderWithProviders(<BacklinksTable backlinks={backlinks} isLoading={false} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("blog.test")).toBeInTheDocument();
    expect(screen.getByText("click here")).toBeInTheDocument();
    expect(screen.getByText("learn more")).toBeInTheDocument();
    expect(screen.getByText("backlinksTitle")).toBeInTheDocument();
  });
});

// ===========================================================================
// 5. ReferringDomainsTable
// ===========================================================================
describe("ReferringDomainsTable", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(<ReferringDomainsTable domainId={domainId} />);
    // Loading state has animate-pulse divs
    expect(screen.queryByText("referringDomainsTitle")).not.toBeInTheDocument();
  });

  test("returns null when data has no domains", () => {
    mockQueries([
      [api.backlinkAnalysis_queries.getReferringDomainIntelligence, { domains: [], totalDomains: 0 }],
    ]);
    const { container } = renderWithProviders(<ReferringDomainsTable domainId={domainId} />);
    // When data is empty, component returns null
    expect(container.innerHTML).toBe("");
  });

  test("renders domain rows with quality badges", () => {
    const data = {
      totalDomains: 2,
      domains: [
        {
          domain: "authority-site.com",
          linkCount: 15,
          dofollow: 12,
          nofollow: 3,
          dofollowPercent: 80,
          avgDomainRank: 75,
          avgSpamScore: 5,
          qualityScore: 85,
          topAnchors: [{ anchor: "great content", count: 5 }],
          firstSeen: "2024-01-01",
          lastSeen: "2024-06-01",
          country: "US",
        },
        {
          domain: "small-blog.net",
          linkCount: 2,
          dofollow: 2,
          nofollow: 0,
          dofollowPercent: 100,
          avgDomainRank: 20,
          avgSpamScore: null,
          qualityScore: 30,
          topAnchors: [{ anchor: "visit", count: 1 }],
          firstSeen: null,
          lastSeen: null,
          country: null,
        },
      ],
    };
    mockQueries([
      [api.backlinkAnalysis_queries.getReferringDomainIntelligence, data],
    ]);
    renderWithProviders(<ReferringDomainsTable domainId={domainId} />);
    expect(screen.getByText("authority-site.com")).toBeInTheDocument();
    expect(screen.getByText("small-blog.net")).toBeInTheDocument();
    expect(screen.getByText("referringDomainsTitle")).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. AnchorTextTable
// ===========================================================================
describe("AnchorTextTable", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(<AnchorTextTable domainId={domainId} />);
    expect(screen.queryByText("anchorTextsTitle")).not.toBeInTheDocument();
  });

  test("returns null when data has no anchors", () => {
    mockQueries([
      [api.backlinkAnalysis_queries.getAnchorTextDistribution, { topAnchors: [] }],
    ]);
    const { container } = renderWithProviders(<AnchorTextTable domainId={domainId} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders anchor text rows with counts", () => {
    const data = {
      topAnchors: [
        { anchor: "best seo tool", category: "branded", count: 120, dofollow: 100, nofollow: 20, percentage: 45.2 },
        { anchor: "click here", category: "generic", count: 80, dofollow: 50, nofollow: 30, percentage: 30.1 },
      ],
    };
    mockQueries([
      [api.backlinkAnalysis_queries.getAnchorTextDistribution, data],
    ]);
    renderWithProviders(<AnchorTextTable domainId={domainId} />);
    expect(screen.getByText("best seo tool")).toBeInTheDocument();
    expect(screen.getByText("click here")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("anchorTextsTitle")).toBeInTheDocument();
  });
});

// ===========================================================================
// 7. ToxicLinksTable
// ===========================================================================
describe("ToxicLinksTable", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(<ToxicLinksTable domainId={domainId} />);
    expect(screen.queryByText("toxicLinksTitle")).not.toBeInTheDocument();
  });

  test("returns null when data is falsy", () => {
    mockQueries([
      [api.backlinkAnalysis_queries.getToxicLinks, null],
    ]);
    const { container } = renderWithProviders(<ToxicLinksTable domainId={domainId} />);
    expect(container.innerHTML).toBe("");
  });

  test("shows clean state when items array is empty", () => {
    const data = {
      toxicCount: 0,
      toxicPercentage: 0,
      avgSpamScore: 0,
      totalAnalyzed: 100,
      items: [],
    };
    mockQueries([
      [api.backlinkAnalysis_queries.getToxicLinks, data],
    ]);
    renderWithProviders(<ToxicLinksTable domainId={domainId} />);
    expect(screen.getByText("toxicEmpty")).toBeInTheDocument();
    expect(screen.getByText("toxicLinksTitle")).toBeInTheDocument();
  });

  test("renders toxic link rows with spam scores", () => {
    const data = {
      toxicCount: 2,
      toxicPercentage: 5,
      avgSpamScore: 85,
      totalAnalyzed: 40,
      items: [
        {
          _id: "tl1",
          urlFrom: "https://spam-site.xyz/page",
          domainFrom: "spam-site.xyz",
          anchor: "free money",
          spamScore: 95,
          dofollow: true,
          domainFromRank: 3,
        },
        {
          _id: "tl2",
          urlFrom: "https://bad-link.net/post",
          domainFrom: "bad-link.net",
          anchor: "casino",
          spamScore: 82,
          dofollow: false,
          domainFromRank: 7,
        },
      ],
    };
    mockQueries([
      [api.backlinkAnalysis_queries.getToxicLinks, data],
    ]);
    renderWithProviders(<ToxicLinksTable domainId={domainId} />);
    expect(screen.getByText("spam-site.xyz")).toBeInTheDocument();
    expect(screen.getByText("bad-link.net")).toBeInTheDocument();
    expect(screen.getByText("free money")).toBeInTheDocument();
    expect(screen.getByText("casino")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
  });
});

// ===========================================================================
// 8. TLDDistributionTable
// ===========================================================================
describe("TLDDistributionTable", () => {
  test("shows loading skeleton when isLoading", () => {
    renderWithProviders(<TLDDistributionTable data={{}} isLoading={true} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("shows empty state when data is empty object", () => {
    renderWithProviders(<TLDDistributionTable data={{}} isLoading={false} />);
    expect(screen.getByText("tldEmpty")).toBeInTheDocument();
    expect(screen.getByText("tldTitle")).toBeInTheDocument();
  });

  test("renders TLD rows sorted by count descending", () => {
    const data = { com: 150, org: 30, net: 20 };
    renderWithProviders(<TLDDistributionTable data={data} isLoading={false} />);
    expect(screen.getByText(".com")).toBeInTheDocument();
    expect(screen.getByText(".org")).toBeInTheDocument();
    expect(screen.getByText(".net")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("tldTitle")).toBeInTheDocument();
  });

  test("shows percentage values", () => {
    const data = { com: 100 };
    renderWithProviders(<TLDDistributionTable data={data} isLoading={false} />);
    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });
});

// ===========================================================================
// 9. DiscoveredKeywordsTable
// ===========================================================================
describe("DiscoveredKeywordsTable", () => {
  test("shows loading state when query returns undefined", () => {
    renderWithProviders(<DiscoveredKeywordsTable domainId={domainId} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  test("shows empty state when keywords is empty", () => {
    mockQueries([
      [api.dataforseo.getDiscoveredKeywords, []],
      [api.keywords.getKeywords, []],
    ]);
    renderWithProviders(<DiscoveredKeywordsTable domainId={domainId} />);
    expect(screen.getByText("noKeywordsDiscovered")).toBeInTheDocument();
  });

  test("renders discovered keyword rows with position and volume", () => {
    const discovered = [
      {
        _id: "dk1",
        keyword: "seo best practices",
        bestPosition: 8,
        searchVolume: 6500,
        difficulty: 42,
        cpc: 2.1,
        etv: 85.3,
      },
      {
        _id: "dk2",
        keyword: "link building tips",
        bestPosition: 999,
        searchVolume: 3200,
        difficulty: 35,
        cpc: 1.8,
        etv: 50.0,
      },
    ];
    mockQueries([
      [api.dataforseo.getDiscoveredKeywords, discovered],
      [api.keywords.getKeywords, []],
    ]);
    renderWithProviders(<DiscoveredKeywordsTable domainId={domainId} />);
    expect(screen.getByText("seo best practices")).toBeInTheDocument();
    expect(screen.getByText("link building tips")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    // 6500 → 6.5K
    expect(screen.getByText("6.5K")).toBeInTheDocument();
    expect(screen.getByText("discoveredKeywords")).toBeInTheDocument();
  });

  test("shows add/remove monitoring buttons based on monitored status", () => {
    const discovered = [
      { _id: "dk1", keyword: "monitored kw", bestPosition: 5, searchVolume: 1000, difficulty: 30 },
      { _id: "dk2", keyword: "new kw", bestPosition: 10, searchVolume: 2000, difficulty: 40 },
    ];
    const monitored = [
      { _id: "mkw1", phrase: "monitored kw" },
    ];
    mockQueries([
      [api.dataforseo.getDiscoveredKeywords, discovered],
      [api.keywords.getKeywords, monitored],
    ]);
    renderWithProviders(<DiscoveredKeywordsTable domainId={domainId} />);
    // One row should have "removeFromMonitor", the other "addToMonitor"
    expect(screen.getByText("removeFromMonitor")).toBeInTheDocument();
    expect(screen.getByText("addToMonitor")).toBeInTheDocument();
  });
});

// ===========================================================================
// 10. CompetitorOverlapTable
// ===========================================================================
describe("CompetitorOverlapTable", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(<CompetitorOverlapTable domainId={domainId} />);
    expect(screen.queryByText("overlapTitle")).not.toBeInTheDocument();
  });

  test("shows empty state when no competitors", () => {
    mockQueries([
      [api.keywordMap_queries.getCompetitorOverlapMatrix, { competitors: [], matrix: [] }],
    ]);
    renderWithProviders(<CompetitorOverlapTable domainId={domainId} />);
    expect(screen.getByText("overlapTitle")).toBeInTheDocument();
    expect(screen.getByText("overlapEmpty")).toBeInTheDocument();
  });

  test("renders overlap matrix with positions", () => {
    const data = {
      competitors: ["rival.com", "other.net"],
      matrix: [
        {
          keywordId: "kw1",
          keyword: "seo audit",
          yourPosition: 3,
          competitors: [
            { domain: "rival.com", position: 5 },
            { domain: "other.net", position: 12 },
          ],
        },
        {
          keywordId: "kw2",
          keyword: "rank checker",
          yourPosition: null,
          competitors: [
            { domain: "rival.com", position: 2 },
            { domain: "other.net", position: null },
          ],
        },
      ],
    };
    mockQueries([
      [api.keywordMap_queries.getCompetitorOverlapMatrix, data],
    ]);
    renderWithProviders(<CompetitorOverlapTable domainId={domainId} />);
    expect(screen.getByText("seo audit")).toBeInTheDocument();
    expect(screen.getByText("rank checker")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("#5")).toBeInTheDocument();
    expect(screen.getByText("overlapTitle")).toBeInTheDocument();
  });
});

// ===========================================================================
// 11. ContentGapOpportunitiesTable
// ===========================================================================
describe("ContentGapOpportunitiesTable", () => {
  test("shows loading skeleton when query returns undefined", () => {
    renderWithProviders(<ContentGapOpportunitiesTable domainId={domainId} />);
    // Loading state shows animated pulse skeletons
    expect(screen.queryByText("contentGapTitle")).not.toBeInTheDocument();
  });

  test("shows empty state when no competitors exist", () => {
    mockQueries([
      [api.contentGaps_queries.getContentGaps, []],
      [api.competitors.getCompetitors, []],
    ]);
    renderWithProviders(<ContentGapOpportunitiesTable domainId={domainId} />);
    expect(screen.getByText("contentGapNoCompetitors")).toBeInTheDocument();
  });

  test("shows no-opportunities message when data is empty but competitors exist", () => {
    mockQueries([
      [api.contentGaps_queries.getContentGaps, []],
      [api.competitors.getCompetitors, [{ _id: "comp1", competitorDomain: "rival.com" }]],
    ]);
    renderWithProviders(<ContentGapOpportunitiesTable domainId={domainId} />);
    expect(screen.getByText("contentGapNoOpportunities")).toBeInTheDocument();
  });

  test("renders opportunity rows with keyword, score, volume", () => {
    const opportunities = [
      {
        _id: "gap1",
        keywordPhrase: "content strategy",
        competitorDomain: "rival.com",
        opportunityScore: 85,
        searchVolume: 15000,
        difficulty: 55,
        competitorPosition: 4,
        estimatedTrafficValue: 250,
        status: "identified",
        priority: "high",
      },
      {
        _id: "gap2",
        keywordPhrase: "seo checklist",
        competitorDomain: "other.net",
        opportunityScore: 42,
        searchVolume: 8000,
        difficulty: 30,
        competitorPosition: 7,
        estimatedTrafficValue: 120,
        status: "monitoring",
        priority: "medium",
      },
    ];
    const competitors = [
      { _id: "comp1", competitorDomain: "rival.com" },
      { _id: "comp2", competitorDomain: "other.net" },
    ];
    mockQueries([
      [api.contentGaps_queries.getContentGaps, opportunities],
      [api.competitors.getCompetitors, competitors],
    ]);
    renderWithProviders(<ContentGapOpportunitiesTable domainId={domainId} />);
    expect(screen.getByText("content strategy")).toBeInTheDocument();
    expect(screen.getByText("seo checklist")).toBeInTheDocument();
    expect(screen.getByText("rival.com")).toBeInTheDocument();
    expect(screen.getByText("other.net")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("contentGapTitle")).toBeInTheDocument();
  });
});
