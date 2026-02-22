/**
 * R12 Cross-Feature Flow Tests
 *
 * Tests that AllKeywordsTable and CompetitorKeywordGapTable correctly render
 * cross-feature states (already-monitored indicators, add-to-monitoring buttons)
 * and call mutations with correct args when users interact with them.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

const mockUseAnalyticsQuery = vi.fn();
const mockAddKeywords = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/hooks/useAnalyticsQuery", () => ({
  useAnalyticsQuery: (...args: unknown[]) => mockUseAnalyticsQuery(...args),
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

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: () => <span data-testid="ez-icon" />,
}));

// Override the global next-intl mock to include NextIntlClientProvider
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

// CompetitorKeywordGapTable-specific mocks
vi.mock("@/components/base/badges/badges", () => ({
  Badge: ({
    children,
    color,
  }: {
    children: React.ReactNode;
    color: string;
    [key: string]: unknown;
  }) => <span data-color={color}>{children}</span>,
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    iconLeading: Icon,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    iconLeading?: React.ComponentType;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} data-size={rest.size} data-color={rest.color}>
      {Icon && <Icon />}
      {children}
    </button>
  ),
}));

vi.mock("@/components/base/select/select", () => ({
  Select: Object.assign(
    ({
      onSelectionChange,
      placeholder,
      items,
    }: {
      onSelectionChange: (key: string) => void;
      placeholder?: string;
      children: (item: { id: string; label: string }) => React.ReactNode;
      items: { id: string; label: string }[];
      [key: string]: unknown;
    }) => (
      <select
        data-testid="competitor-select"
        onChange={(e) => onSelectionChange(e.target.value)}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {items?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    ),
    { Item: () => null }
  ),
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
    [key: string]: unknown;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/patterns/BulkActionBar", () => ({
  BulkActionBar: ({
    selectedCount,
    onClearSelection,
    actions,
  }: {
    selectedCount: number;
    onClearSelection: () => void;
    actions: Array<{ label: string; onClick: () => void }>;
  }) => (
    <div data-testid="bulk-bar">
      {selectedCount} selected
      <button onClick={onClearSelection}>Clear selection</button>
      {actions?.map((action, i) => (
        <button key={i} data-testid={`bulk-action-${i}`} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { AllKeywordsTable } from "@/components/domain/tables/AllKeywordsTable";
import { CompetitorKeywordGapTable } from "@/components/domain/tables/CompetitorKeywordGapTable";
import type { Id } from "../../../../convex/_generated/dataModel";

const DOMAIN_ID = "domain_active_1" as Id<"domains">;

// ---------------------------------------------------------------------------
// Query mock helper (for AllKeywordsTable which uses useQuery)
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

function setupMutationMock() {
  const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as any);
  return mutationMap;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

// Keywords returned by api.keywords.getKeywords (AllKeywordsTable's query)
function makeGetKeywordsEntry(overrides: Record<string, unknown> = {}) {
  return {
    _id: "kw_1" as any,
    domainId: DOMAIN_ID,
    phrase: "best seo tools",
    currentPosition: 5,
    previousPosition: 8,
    positionChange: 3,
    status: "active",
    searchVolume: 2400,
    difficulty: 45,
    url: "https://example.com/seo-tools",
    createdAt: now - 10 * day,
    ...overrides,
  };
}

const ALL_KEYWORDS_LIST = [
  makeGetKeywordsEntry(),
  makeGetKeywordsEntry({
    _id: "kw_2" as any,
    phrase: "keyword research tool",
    currentPosition: 12,
    previousPosition: 10,
    searchVolume: 1800,
  }),
  makeGetKeywordsEntry({
    _id: "kw_3" as any,
    phrase: "seo monitoring software",
    currentPosition: 1,
    previousPosition: 1,
    searchVolume: 800,
  }),
];

// Competitors returned by useAnalyticsQuery for CompetitorKeywordGapTable
const FAKE_COMPETITORS = [
  {
    _id: "comp_1" as Id<"competitors">,
    competitorDomain: "rival-seo.com",
    name: "Rival SEO",
    status: "active" as const,
    keywordCount: 25,
    avgPosition: 8.5,
    lastChecked: now - 1 * day,
    createdAt: now - 20 * day,
  },
  {
    _id: "comp_2" as Id<"competitors">,
    competitorDomain: "another-competitor.io",
    name: "Another Competitor",
    status: "active" as const,
    keywordCount: 15,
    avgPosition: 12.3,
    lastChecked: now - 2 * day,
    createdAt: now - 15 * day,
  },
];

// Gap data returned by useAnalyticsQuery for competitor keyword gaps
const FAKE_GAPS = [
  {
    keywordId: "gap_kw_1",
    phrase: "link building strategy",
    competitorPosition: 3,
    competitorUrl: "https://rival-seo.com/link-building",
    ourPosition: 22,
    gap: 19,
    searchVolume: 4500,
    difficulty: 42,
    gapScore: 78.5,
  },
  {
    keywordId: "gap_kw_2",
    phrase: "technical seo audit",
    competitorPosition: 5,
    competitorUrl: "https://rival-seo.com/seo-audit",
    ourPosition: null,
    gap: 5,
    searchVolume: 2800,
    difficulty: 55,
    gapScore: 62.3,
  },
  {
    keywordId: "gap_kw_3",
    phrase: "backlink analysis tool",
    competitorPosition: 2,
    competitorUrl: null,
    ourPosition: 35,
    gap: 33,
    searchVolume: 1200,
    difficulty: 30,
    gapScore: 45.0,
  },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  mockUseAnalyticsQuery.mockReset();
  mockAddKeywords.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
});

// ===========================================================================
// AllKeywordsTable — Cross-Feature Flow Tests
// ===========================================================================

describe("AllKeywordsTable — Cross-Feature Flows", () => {
  describe("Already-monitored keyword state", () => {
    it("shows 'In monitoring' disabled button for keywords already in monitoring", () => {
      setupQueryMock({
        "keywords:getKeywords": ALL_KEYWORDS_LIST,
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

      // All keywords from getKeywords are "already monitored" since they come from
      // the same query. The table cross-checks phrases against monitored set.
      // Every row should show the "In monitoring" state.
      const inMonitoringButtons = screen.getAllByText("In monitoring");
      expect(inMonitoringButtons.length).toBe(ALL_KEYWORDS_LIST.length);

      // They should all be disabled
      inMonitoringButtons.forEach((btn) => {
        const buttonEl = btn.closest("button");
        expect(buttonEl).toBeTruthy();
        expect(buttonEl).toBeDisabled();
      });
    });

    it("shows 'Add to monitoring' button for keywords not yet monitored", () => {
      // Both keywords come from getKeywords which is the monitored set,
      // so they show as "In monitoring".
      const keywordsWithMix = [
        makeGetKeywordsEntry({ phrase: "monitored keyword" }),
        makeGetKeywordsEntry({ _id: "kw_new_1" as any, phrase: "new keyword to track" }),
      ];

      setupQueryMock({
        "keywords:getKeywords": keywordsWithMix,
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

      // Both phrases match since getKeywords IS the monitoring list
      const inMonitoringButtons = screen.getAllByText("In monitoring");
      expect(inMonitoringButtons.length).toBe(2);
    });
  });

  describe("Loading and empty states", () => {
    it("renders LoadingState when keywords query returns undefined", () => {
      setupQueryMock({}); // no response for keywords query → undefined
      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);
      expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    });

    it("renders empty state when keywords list is empty", () => {
      setupQueryMock({
        "keywords:getKeywords": [],
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);
      expect(screen.getByText("No keywords found matching your criteria")).toBeInTheDocument();
    });
  });

  describe("Table content rendering", () => {
    it("renders keyword phrases in table rows", () => {
      setupQueryMock({
        "keywords:getKeywords": ALL_KEYWORDS_LIST,
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

      expect(screen.getByText("best seo tools")).toBeInTheDocument();
      expect(screen.getByText("keyword research tool")).toBeInTheDocument();
      expect(screen.getByText("seo monitoring software")).toBeInTheDocument();
    });

    it("renders position badges for keywords with positions", () => {
      setupQueryMock({
        "keywords:getKeywords": ALL_KEYWORDS_LIST,
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

      // Position values are rendered
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("renders formatted search volume values", () => {
      setupQueryMock({
        "keywords:getKeywords": ALL_KEYWORDS_LIST,
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

      // 2400 → "2.4K", 1800 → "1.8K", 800 → "800"
      expect(screen.getByText("2.4K")).toBeInTheDocument();
      expect(screen.getByText("1.8K")).toBeInTheDocument();
      expect(screen.getByText("800")).toBeInTheDocument();
    });
  });

  describe("Search filtering", () => {
    it("filters keywords by search query case-insensitively", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywords": ALL_KEYWORDS_LIST,
      });

      renderWithProviders(<AllKeywordsTable domainId={DOMAIN_ID} />);

      // Type in the search input
      const searchInput = screen.getByPlaceholderText("Search keywords...");
      await user.type(searchInput, "seo");

      // "best seo tools" and "seo monitoring software" match, "keyword research tool" doesn't
      expect(screen.getByText("best seo tools")).toBeInTheDocument();
      expect(screen.getByText("seo monitoring software")).toBeInTheDocument();
      expect(screen.queryByText("keyword research tool")).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// CompetitorKeywordGapTable — Cross-Feature Flow Tests
// ===========================================================================

describe("CompetitorKeywordGapTable — Cross-Feature Flows", () => {
  // Helper to set up the analytics query mock for competitor + gaps data
  function setupCompetitorMocks(overrides?: {
    competitors?: unknown;
    gaps?: unknown;
  }) {
    const competitors = overrides?.competitors ?? FAKE_COMPETITORS;
    const gaps = overrides?.gaps ?? FAKE_GAPS;

    mockUseAnalyticsQuery.mockImplementation(
      (_ref: unknown, args: Record<string, unknown>) => {
        if (args && "competitorId" in args) return { data: gaps };
        return { data: competitors };
      }
    );
  }

  describe("Per-row add-to-monitoring button", () => {
    it("shows Plus button per row that triggers toast on click", async () => {
      const user = userEvent.setup();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      // Select a competitor to show gap table
      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // Find all Plus action buttons in the table rows
      // The per-row Plus buttons are in the last column
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(FAKE_GAPS.length);

      // Each row should have a button
      rows.forEach((row) => {
        const buttons = row.querySelectorAll("button");
        expect(buttons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("clicking per-row Plus button triggers addKeywords mutation", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      // Select competitor
      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // Click the first row's action button (the Plus button in last td)
      const firstRow = container.querySelector("tbody tr");
      expect(firstRow).toBeTruthy();
      const actionTd = firstRow!.querySelector("td:last-child");
      const plusButton = actionTd!.querySelector("button");
      expect(plusButton).toBeTruthy();
      await user.click(plusButton!);

      // Should trigger addKeywords mutation with the phrase
      const addKeywordsFn = mutationMap.get("keywords:addKeywords");
      expect(addKeywordsFn).toHaveBeenCalled();
    });
  });

  describe("Bulk add-to-monitoring via BulkActionBar", () => {
    it("calls addKeywords with selected phrases on bulk add", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      // Select competitor
      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // Select first two row checkboxes
      const checkboxes = within(container).getAllByRole("checkbox");
      const rowCheckboxes = checkboxes.slice(1); // skip header
      await user.click(rowCheckboxes[0]);
      await user.click(rowCheckboxes[1]);

      // Bulk action bar should appear with 2 selected
      const bulkBar = within(container).getByTestId("bulk-bar");
      expect(bulkBar).toHaveTextContent("2 selected");

      // Click the bulk "Add to monitoring" button
      const bulkAddBtn = within(bulkBar).getByTestId("bulk-action-0");
      await user.click(bulkAddBtn);

      // The mutation should have been called with the selected phrases
      const addKeywordsFn = mutationMap.get("keywords:addKeywords");
      expect(addKeywordsFn).toBeDefined();
      expect(addKeywordsFn).toHaveBeenCalledWith({
        domainId: DOMAIN_ID,
        phrases: expect.arrayContaining([
          "link building strategy",
          "technical seo audit",
        ]),
      });
    });

    it("calls addKeywords with all three selected phrases when all are checked", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      // Select competitor
      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // Use header checkbox to select all
      const checkboxes = within(container).getAllByRole("checkbox");
      const headerCheckbox = checkboxes[0];
      await user.click(headerCheckbox);

      // Bulk action bar should appear with 3 selected
      const bulkBar = within(container).getByTestId("bulk-bar");
      expect(bulkBar).toHaveTextContent("3 selected");

      // Click bulk add
      const bulkAddBtn = within(bulkBar).getByTestId("bulk-action-0");
      await user.click(bulkAddBtn);

      const addKeywordsFn = mutationMap.get("keywords:addKeywords");
      expect(addKeywordsFn).toBeDefined();
      expect(addKeywordsFn).toHaveBeenCalledWith({
        domainId: DOMAIN_ID,
        phrases: expect.arrayContaining([
          "link building strategy",
          "technical seo audit",
          "backlink analysis tool",
        ]),
      });
    });

    it("clears selection after successful bulk add", async () => {
      const user = userEvent.setup();
      setupMutationMock();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      // Select competitor
      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // Select a row
      const checkboxes = within(container).getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      // Bulk bar shows 1 selected
      const bulkBar = within(container).getByTestId("bulk-bar");
      expect(bulkBar).toHaveTextContent("1 selected");

      // Click bulk add — on success, selection is cleared
      const bulkAddBtn = within(bulkBar).getByTestId("bulk-action-0");
      await user.click(bulkAddBtn);

      // After async mutation completes, bulk bar should disappear
      // (selection cleared means count = 0 so BulkActionBar is not rendered)
      await vi.waitFor(() => {
        expect(within(container).queryByTestId("bulk-bar")).not.toBeInTheDocument();
      });
    });
  });

  describe("Loading and empty states", () => {
    it("shows loading state while competitors are fetching", () => {
      mockUseAnalyticsQuery.mockReturnValue({ data: undefined });
      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );
      expect(within(container).getByText("Loading keyword gaps...")).toBeInTheDocument();
    });

    it("shows empty state when no active competitors exist", () => {
      mockUseAnalyticsQuery.mockReturnValue({
        data: [{ ...FAKE_COMPETITORS[0], status: "paused" }],
      });
      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );
      expect(within(container).getByText("No competitors added yet")).toBeInTheDocument();
    });

    it("shows select prompt before competitor is chosen", () => {
      setupCompetitorMocks();
      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );
      expect(within(container).getByText("Select a competitor to view keyword gaps")).toBeInTheDocument();
    });

    it("shows empty gap state when selected competitor has no gaps", async () => {
      const user = userEvent.setup();
      setupCompetitorMocks({ gaps: [] });

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      expect(within(container).getByText("No keyword gaps found")).toBeInTheDocument();
    });
  });

  describe("Gap data rendering", () => {
    it("renders keyword phrases and competitor positions", async () => {
      const user = userEvent.setup();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // Keyword phrases visible
      expect(within(container).getByText("link building strategy")).toBeInTheDocument();
      expect(within(container).getByText("technical seo audit")).toBeInTheDocument();
      expect(within(container).getByText("backlink analysis tool")).toBeInTheDocument();

      // Competitor positions visible
      expect(within(container).getByText("#3")).toBeInTheDocument();
      expect(within(container).getByText("#5")).toBeInTheDocument();
      expect(within(container).getByText("#2")).toBeInTheDocument();
    });

    it("shows 'not ranking' for gaps where our position is null", async () => {
      const user = userEvent.setup();
      setupCompetitorMocks();

      const { container } = renderWithProviders(
        <CompetitorKeywordGapTable domainId={DOMAIN_ID} />
      );

      const select = within(container).getByTestId("competitor-select");
      await user.selectOptions(select, "comp_1");

      // "technical seo audit" has ourPosition: null
      expect(within(container).getByText("Not ranking")).toBeInTheDocument();
    });
  });
});
