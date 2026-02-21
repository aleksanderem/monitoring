/**
 * Integration tests for table interaction patterns:
 * - AllKeywordsTable: pagination, page count, navigation, item count
 * - BacklinksTable: row rendering, search filter, dofollow/nofollow filter, pagination
 * - KeywordMonitoringTable: column visibility picker, column hide/show, localStorage persistence
 * - CompetitorKeywordGapTable: competitor dropdown, selection, gap data rendering
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/domains/test-domain-id",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "test-domain-id" }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh"],
    modules: ["positioning", "competitors"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh"],
    modules: ["positioning", "competitors"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));

vi.mock("@/hooks/useDateRange", () => ({
  useDateRange: () => ({
    dateRange: { from: new Date("2025-01-01"), to: new Date("2025-01-31") },
    setDateRange: vi.fn(),
    comparisonRange: null,
    setComparisonRange: vi.fn(),
    preset: "30d",
    setPreset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-breakpoint", () => ({
  useBreakpoint: () => true,
}));

// Mock useAnalyticsQuery for CompetitorKeywordGapTable
const mockUseAnalyticsQuery = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}));

vi.mock("@/hooks/useAnalyticsQuery", () => ({
  useAnalyticsQuery: (...args: unknown[]) => mockUseAnalyticsQuery(...args),
}));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

vi.mock("motion/react", () => {
  const Component = ({ children, ...props }: Record<string, unknown>) => {
    const domSafe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (["className", "style", "id", "role", "onClick", "data-testid"].includes(k)) domSafe[k] = v;
    }
    return <div {...domSafe}>{children as React.ReactNode}</div>;
  };
  return {
    motion: new Proxy({}, { get: () => Component, has: () => true }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
    animate: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { makeKeyword, KEYWORD_MONITORING_LIST_LARGE } from "@/test/fixtures/keywords";
import { AllKeywordsTable } from "@/components/domain/tables/AllKeywordsTable";
import { BacklinksTable } from "@/components/domain/tables/BacklinksTable";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";
import { CompetitorKeywordGapTable } from "@/components/domain/tables/CompetitorKeywordGapTable";

const DOMAIN_ID = "domain_active_1" as any;

// ---------------------------------------------------------------------------
// Query mock helper using function name strings
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueryMock(queryResponses: QueryMap) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in queryResponses) return queryResponses[name];
    } catch {
      // not a valid function reference
    }
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// 52 keywords for AllKeywordsTable pagination (3 pages at 25/page)
// Default sort is by position ascending, so assign sequential positions
// so items are ordered predictably: position 1..52
const LARGE_KEYWORD_LIST = Array.from({ length: 52 }, (_, i) => ({
  _id: `kw_${i}` as any,
  _creationTime: Date.now(),
  phrase: `test keyword ${String(i + 1).padStart(3, "0")}`,
  domainId: DOMAIN_ID,
  currentPosition: i + 1,
  previousPosition: i + 6,
  searchVolume: (52 - i) * 100,
  difficulty: (i % 100),
  status: "active",
}));

// Backlinks fixture
function makeBacklinks(count: number) {
  return {
    total: count,
    items: Array.from({ length: count }, (_, i) => ({
      _id: `bl_${i}`,
      domainFrom: `domain${i}.com`,
      urlFrom: `https://domain${i}.com/page-${i}`,
      urlTo: `https://mysite.com/page-${i}`,
      anchor: `anchor text ${i + 1}`,
      dofollow: i % 2 === 0,
      rank: Math.floor(Math.random() * 100),
      domainFromRank: Math.floor(Math.random() * 100),
      backlink_spam_score: Math.floor(Math.random() * 100),
      itemType: i % 3 === 0 ? "anchor" : "redirect",
      firstSeen: "2025-01-01",
      lastSeen: "2025-01-15",
    })),
    stats: {
      totalDofollow: Math.ceil(count / 2),
      totalNofollow: Math.floor(count / 2),
      avgRank: 45,
      avgSpamScore: 25,
    },
  };
}

// Competitor fixtures
const COMPETITORS_LIST = [
  {
    _id: "comp_1" as any,
    competitorDomain: "competitor1.com",
    name: "Competitor One",
    status: "active",
    keywordCount: 25,
    avgPosition: 8.5,
    lastChecked: Date.now(),
    createdAt: Date.now() - 86400000,
  },
  {
    _id: "comp_2" as any,
    competitorDomain: "competitor2.com",
    name: "Competitor Two",
    status: "active",
    keywordCount: 30,
    avgPosition: 12.3,
    lastChecked: Date.now(),
    createdAt: Date.now() - 86400000,
  },
];

const GAP_DATA = [
  {
    keywordId: "gap_kw_1",
    phrase: "machine learning basics",
    competitorPosition: 3,
    competitorUrl: "https://competitor1.com/ml-basics",
    ourPosition: 15,
    gap: 12,
    searchVolume: 5000,
    difficulty: 35,
    gapScore: 82.5,
  },
  {
    keywordId: "gap_kw_2",
    phrase: "python data science",
    competitorPosition: 7,
    competitorUrl: "https://competitor1.com/python-ds",
    ourPosition: null,
    gap: 7,
    searchVolume: 3200,
    difficulty: 48,
    gapScore: 65.0,
  },
  {
    keywordId: "gap_kw_3",
    phrase: "neural network tutorial",
    competitorPosition: 2,
    competitorUrl: "https://competitor1.com/nn-tutorial",
    ourPosition: 25,
    gap: 23,
    searchVolume: 8000,
    difficulty: 62,
    gapScore: 71.2,
  },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  mockUseAnalyticsQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  localStorage.clear();
});

// ===========================================================================
// 1. AllKeywordsTable — Pagination
// ===========================================================================

describe("AllKeywordsTable — Pagination", () => {
  it("shows page 1 of keywords (25 items per page)", () => {
    setupQueryMock({
      "keywords:getKeywords": LARGE_KEYWORD_LIST,
    });

    renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

    // Default sort is position ascending, so positions 1-25 on page 1
    // Position 1 = "test keyword 001", position 25 = "test keyword 025"
    expect(screen.getByText("test keyword 001")).toBeInTheDocument();
    expect(screen.getByText("test keyword 025")).toBeInTheDocument();
    // Position 26 = "test keyword 026" should NOT be on page 1
    expect(screen.queryByText("test keyword 026")).not.toBeInTheDocument();

    // Verify 25 data rows are visible
    const bodyRows = screen.getAllByRole("row").filter((row) => row.closest("tbody"));
    expect(bodyRows.length).toBe(25);
  });

  it("pagination controls show correct page count for 52 items (3 pages)", () => {
    setupQueryMock({
      "keywords:getKeywords": LARGE_KEYWORD_LIST,
    });

    renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

    // paginationInfo: "Page {current} of {total} ({count} keywords)"
    const paginationText = screen.getByText((content) =>
      content.includes("Page 1 of 3") && content.includes("52 keywords")
    );
    expect(paginationText).toBeInTheDocument();
  });

  it("clicking next page shows different items", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywords": LARGE_KEYWORD_LIST,
    });

    renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

    // Verify page 1 content
    expect(screen.getByText("test keyword 001")).toBeInTheDocument();

    // Click Next button
    const nextButton = screen.getByRole("button", { name: /Next/i });
    await user.click(nextButton);

    // Page 2 should show items 26-50
    expect(screen.getByText("test keyword 026")).toBeInTheDocument();
    expect(screen.queryByText("test keyword 001")).not.toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
  });

  it("shows 'X of Y keywords' count text", () => {
    setupQueryMock({
      "keywords:getKeywords": LARGE_KEYWORD_LIST,
    });

    renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

    // The allKeywordsDescription key renders "{count} keywords discovered across all data sources"
    expect(screen.getByText(/52 keywords discovered/)).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. BacklinksTable — Pagination and Filters
// ===========================================================================

describe("BacklinksTable — Pagination and Filters", () => {
  it("renders backlink rows with referring domain, anchor text", () => {
    const backlinks = makeBacklinks(5);

    renderWithProviders(<BacklinksTable backlinks={backlinks} />);

    // Check that referring domains and anchors render
    expect(screen.getByText("domain0.com")).toBeInTheDocument();
    expect(screen.getByText("anchor text 1")).toBeInTheDocument();
    expect(screen.getByText("domain1.com")).toBeInTheDocument();
    expect(screen.getByText("anchor text 2")).toBeInTheDocument();
  });

  it("search filters by domain or anchor text", async () => {
    const user = userEvent.setup();
    const backlinks = makeBacklinks(5);

    renderWithProviders(<BacklinksTable backlinks={backlinks} />);

    // All domains visible initially
    expect(screen.getByText("domain0.com")).toBeInTheDocument();
    expect(screen.getByText("domain3.com")).toBeInTheDocument();

    // Type in search input (placeholder from backlinks translations: "Search backlinks...")
    const searchInput = screen.getByPlaceholderText("Search backlinks...");
    await user.click(searchInput);
    await user.type(searchInput, "domain3");

    // Only matching backlink remains
    expect(screen.getByText("domain3.com")).toBeInTheDocument();
    expect(screen.queryByText("domain0.com")).not.toBeInTheDocument();
    expect(screen.queryByText("domain1.com")).not.toBeInTheDocument();
  });

  it("dofollow/nofollow filter toggle works", async () => {
    const user = userEvent.setup();
    const backlinks = makeBacklinks(10);

    renderWithProviders(<BacklinksTable backlinks={backlinks} />);

    // Open filters panel
    const filtersButton = screen.getByRole("button", { name: /Filters/i });
    await user.click(filtersButton);

    // Find the Link Type filter select — it contains Dofollow/Nofollow options
    const selects = screen.getAllByRole("combobox");
    const linkTypeSelect = selects.find((el) => {
      const options = within(el).queryAllByRole("option");
      return options.some((o) => o.textContent === "Dofollow");
    });
    expect(linkTypeSelect).toBeTruthy();

    // Select "Dofollow" filter
    await user.selectOptions(linkTypeSelect!, "dofollow");

    // Only dofollow backlinks should show (even-indexed items: 0, 2, 4, 6, 8)
    // All visible rows should have "Dofollow" badge
    const dofollowBadges = screen.getAllByText("Dofollow");
    expect(dofollowBadges.length).toBeGreaterThanOrEqual(1);
    // "Nofollow" badges should not be in the table body
    const nofollowBadges = screen.queryAllByText("Nofollow");
    // The filter option itself has "Nofollow" text, but table rows should not
    // After filtering for dofollow, nofollow rows are hidden
    const tableBody = screen.getAllByRole("row").filter((row) => row.closest("tbody"));
    const nofollowInBody = tableBody.filter((row) => within(row).queryByText("Nofollow"));
    expect(nofollowInBody.length).toBe(0);
  });

  it("pagination shows correct item count", () => {
    const backlinks = makeBacklinks(52);

    renderWithProviders(<BacklinksTable backlinks={backlinks} />);

    // Pagination text uses tc('pageOf') + "(52 results)"
    // Renders: "Page 1 of 3 (52 results)"
    const paginationText = screen.getByText((content) =>
      content.includes("Page 1 of 3") && content.includes("52")
    );
    expect(paginationText).toBeInTheDocument();
  });
});

// ===========================================================================
// 3. KeywordMonitoringTable — Column Visibility
// ===========================================================================

describe("KeywordMonitoringTable — Column Visibility", () => {
  const KEYWORDS = KEYWORD_MONITORING_LIST_LARGE.slice(0, 5);

  it("column visibility picker shows all 11 columns", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORDS,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Open column picker
    const columnsButton = screen.getByRole("button", { name: /Columns/i });
    await user.click(columnsButton);

    // All 11 column names should appear as checkbox labels
    // The column picker renders the key name with capitalize class
    const expectedColumns = [
      "keyword", "position", "previous", "change",
      "volume", "difficulty", "cpc", "etv",
      "competition", "intent", "actions",
    ];

    for (const col of expectedColumns) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
  });

  it("unchecking a column hides it from the table", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORDS,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Verify "Difficulty" column header is visible
    expect(screen.getByText("Difficulty")).toBeInTheDocument();

    // Open column picker
    const columnsButton = screen.getByRole("button", { name: /Columns/i });
    await user.click(columnsButton);

    // Find the "difficulty" checkbox and uncheck it
    const difficultyCheckbox = screen.getByRole("checkbox", { name: /difficulty/i });
    expect(difficultyCheckbox).toBeChecked();
    await user.click(difficultyCheckbox);

    // The "Difficulty" column header should now be hidden
    // The column picker label "difficulty" will still be visible, but the th "Difficulty" should be gone
    const headers = screen.getAllByRole("columnheader");
    const difficultyHeader = headers.find((h) => h.textContent?.includes("Difficulty"));
    expect(difficultyHeader).toBeUndefined();
  });

  it("column visibility persists to localStorage", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORDS,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Open column picker and toggle a column
    const columnsButton = screen.getByRole("button", { name: /Columns/i });
    await user.click(columnsButton);

    const cpcCheckbox = screen.getByRole("checkbox", { name: /cpc/i });
    await user.click(cpcCheckbox); // uncheck cpc

    // Verify localStorage was updated
    const saved = localStorage.getItem("keywordMonitoring_columnVisibility");
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.cpc).toBe(false);
  });
});

// ===========================================================================
// 4. CompetitorKeywordGapTable — Competitor Selection
// ===========================================================================

describe("CompetitorKeywordGapTable — Competitor Selection", () => {
  it("shows competitor dropdown when competitors loaded", () => {
    // Mock useAnalyticsQuery to return competitors for first call, undefined for gaps
    let callCount = 0;
    mockUseAnalyticsQuery.mockImplementation((...args: unknown[]) => {
      callCount++;
      // First call is for competitors, second is for gaps
      const actionRef = args[0];
      try {
        const name = getFunctionName(actionRef as any);
        if (name.includes("getCompetitorsByDomain")) {
          return { data: COMPETITORS_LIST, isLoading: false, error: null, refetch: vi.fn() };
        }
      } catch {
        // fall through
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });

    renderWithProviders(<CompetitorKeywordGapTable domainId={DOMAIN_ID} />);

    // The title should render
    expect(screen.getByText("Keyword Gap Analysis")).toBeInTheDocument();

    // The prompt to select a competitor should be visible
    expect(screen.getByText("Select a competitor to view keyword gaps")).toBeInTheDocument();
  });

  it("selecting a competitor loads gap data", async () => {
    const user = userEvent.setup();

    mockUseAnalyticsQuery.mockImplementation((...args: unknown[]) => {
      const actionRef = args[0];
      try {
        const name = getFunctionName(actionRef as any);
        if (name.includes("getCompetitorsByDomain")) {
          return { data: COMPETITORS_LIST, isLoading: false, error: null, refetch: vi.fn() };
        }
        if (name.includes("getCompetitorKeywordGaps")) {
          return { data: GAP_DATA, isLoading: false, error: null, refetch: vi.fn() };
        }
      } catch {
        // fall through
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });

    renderWithProviders(<CompetitorKeywordGapTable domainId={DOMAIN_ID} />);

    // The Select component uses react-aria. Find the trigger button.
    const selectTrigger = screen.getByRole("button", { name: /Select competitor/i });
    await user.click(selectTrigger);

    // react-aria renders options in a listbox
    const listbox = await screen.findByRole("listbox");
    const option = within(listbox).getByText("Competitor One");
    await user.click(option);

    // After selection, gap data should render
    await waitFor(() => {
      expect(screen.getByText("machine learning basics")).toBeInTheDocument();
    });
  });

  it("gap data renders with keyword, competitor position, own position, gap score", async () => {
    const user = userEvent.setup();

    mockUseAnalyticsQuery.mockImplementation((...args: unknown[]) => {
      const actionRef = args[0];
      try {
        const name = getFunctionName(actionRef as any);
        if (name.includes("getCompetitorsByDomain")) {
          return { data: COMPETITORS_LIST, isLoading: false, error: null, refetch: vi.fn() };
        }
        if (name.includes("getCompetitorKeywordGaps")) {
          return { data: GAP_DATA, isLoading: false, error: null, refetch: vi.fn() };
        }
      } catch {
        // fall through
      }
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });

    renderWithProviders(<CompetitorKeywordGapTable domainId={DOMAIN_ID} />);

    // Select competitor using react-aria Select
    const selectTrigger = screen.getByRole("button", { name: /Select competitor/i });
    await user.click(selectTrigger);
    const listbox = await screen.findByRole("listbox");
    const option = within(listbox).getByText("Competitor One");
    await user.click(option);

    await waitFor(() => {
      // Keyword phrases
      expect(screen.getByText("machine learning basics")).toBeInTheDocument();
      expect(screen.getByText("python data science")).toBeInTheDocument();
      expect(screen.getByText("neural network tutorial")).toBeInTheDocument();
    });

    // Competitor positions are rendered as "#3", "#7", "#2"
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("#7")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();

    // Own positions: "#15", "Not ranking", "#25"
    expect(screen.getByText("#15")).toBeInTheDocument();
    expect(screen.getByText("Not ranking")).toBeInTheDocument();
    expect(screen.getByText("#25")).toBeInTheDocument();

    // Gap scores: 82.5, 65.0, 71.2
    expect(screen.getByText("82.5")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("71.2")).toBeInTheDocument();
  });
});
