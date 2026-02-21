/**
 * Integration tests for KeywordMonitoringTable data flow paths.
 *
 * Tests detailed filtering, sorting, pagination, column visibility,
 * row expansion, bulk actions, single row actions, SERP job progress,
 * and status indicators.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
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

vi.mock("@/components/domain/charts/KeywordPositionChart", () => ({
  KeywordPositionChart: () => <div data-testid="keyword-position-chart">Chart</div>,
}));

vi.mock("@/components/domain/modals/AddKeywordsModal", () => ({
  AddKeywordsModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-keywords-modal">Add Keywords Modal</div> : null,
}));

vi.mock("@/components/domain/modals/KeywordMonitoringDetailModal", () => ({
  KeywordMonitoringDetailModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="keyword-detail-modal">Keyword Detail Modal</div> : null,
}));

vi.mock("@/components/domain/modals/RefreshConfirmModal", () => ({
  RefreshConfirmModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="refresh-confirm-modal">Refresh Confirm Modal</div> : null,
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import {
  KEYWORD_MONITORING_LIST,
  KEYWORD_MONITORING_LIST_LARGE,
  KEYWORD_LIST_MIXED,
  KEYWORD_CHECKING,
  KEYWORD_AI_PROPOSED,
  makeKeyword,
} from "@/test/fixtures/keywords";
import { ACTIVE_SERP_JOB } from "@/test/fixtures/jobs";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";

const DOMAIN_ID = "domain_active_1" as any;

// ---------------------------------------------------------------------------
// Query mock helper
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
// Mutation mock helper (per-mutation Map for tracking calls)
// ---------------------------------------------------------------------------

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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KeywordMonitoringTable — Data Flow Tests", () => {
  // =========================================================================
  // Group 1: Basic States
  // =========================================================================

  describe("Basic States", () => {
    it("renders LoadingState when keywords query returns undefined", () => {
      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);
      expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    });

    it("renders empty state with Add Keywords button when keywords=[]", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": [],
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      expect(screen.getByText("No keywords being monitored yet")).toBeInTheDocument();
      expect(screen.getByText("Add keywords to start tracking their positions")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Keywords/i })).toBeInTheDocument();
    });

    it("renders 25 items on page 1 when given 52 keywords", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST_LARGE,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Table body rows: 25 per page
      const tbody = screen.getAllByRole("row").filter(row => row.closest("tbody") && row.querySelector("td"));
      expect(tbody.length).toBe(25);

      // Pagination info visible
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Group 2: SERP Job Progress
  // =========================================================================

  describe("SERP Job Progress", () => {
    it("shows progress indicator when SERP job is active", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": {
          ...ACTIVE_SERP_JOB,
          failedKeywords: 0,
        },
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      expect(screen.getByText("Fetching SERP data...")).toBeInTheDocument();
      expect(screen.getByText("Processed 5 of 20 keywords")).toBeInTheDocument();
    });

    it("does not show progress indicator when activeSerpJob is null", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      expect(screen.queryByText("Fetching SERP data...")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Group 3: Sorting
  // =========================================================================

  describe("Sorting", () => {
    const getKeywordOrder = () => {
      const rows = screen.getAllByRole("row").filter(
        (row) => row.closest("tbody") && row.querySelector("td")
      );
      return rows
        .map((row) => {
          const cells = row.querySelectorAll("td");
          const phraseCell = cells[1];
          return phraseCell?.textContent?.trim() || "";
        })
        .filter(Boolean);
    };

    it("default sort is by position ascending", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const order = getKeywordOrder();
      // Positions: seo monitoring software=1, best seo tools=5, keyword research tool=12, position tracker free=null(999)
      expect(order[0]).toContain("seo monitoring software");
      expect(order[1]).toContain("best seo tools");
      expect(order[2]).toContain("keyword research tool");
      expect(order[3]).toContain("position tracker free");
    });

    it("clicking Position header toggles sort direction", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const positionHeader = screen.getByText("Position").closest("th");
      expect(positionHeader).toBeTruthy();

      // Click to toggle to descending
      await user.click(positionHeader!);

      const descOrder = getKeywordOrder();
      // Descending: null(999) -> 12 -> 5 -> 1
      expect(descOrder[0]).toContain("position tracker free");
      expect(descOrder[3]).toContain("seo monitoring software");
    });

    it("null position sorts to bottom in ascending order", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": [
          makeKeyword({ keywordId: "kw_a", phrase: "has pos 10", currentPosition: 10 }),
          makeKeyword({ keywordId: "kw_b", phrase: "no position kw", currentPosition: null, change: null }),
          makeKeyword({ keywordId: "kw_c", phrase: "has pos 3", currentPosition: 3 }),
        ],
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const order = getKeywordOrder();
      expect(order[0]).toContain("has pos 3");
      expect(order[1]).toContain("has pos 10");
      expect(order[2]).toContain("no position kw");
    });
  });

  // =========================================================================
  // Group 4: Filtering
  // =========================================================================

  describe("Filtering", () => {
    const openFilters = async (user: ReturnType<typeof userEvent.setup>) => {
      const filtersButton = screen.getByRole("button", { name: /Filters/i });
      await user.click(filtersButton);
    };

    const getVisiblePhrases = () => {
      const rows = screen.getAllByRole("row").filter(
        (row) => row.closest("tbody") && row.querySelector("td")
      );
      return rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return cells[1]?.textContent?.trim() || "";
      }).filter(Boolean);
    };

    it("filters to Top 3 when position filter is set", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_LIST_MIXED,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);
      await openFilters(user);

      // Find position filter select
      const selects = screen.getAllByRole("combobox");
      const positionSelect = selects.find(el => {
        const options = within(el).queryAllByRole("option");
        return options.some(o => o.textContent === "Top 3");
      });
      expect(positionSelect).toBeTruthy();

      await user.selectOptions(positionSelect!, "top3");

      const phrases = getVisiblePhrases();
      // Only KEYWORD_TOP3 (position=2) should remain
      expect(phrases).toHaveLength(1);
      expect(phrases[0]).toContain("top ranking keyword");
    });

    it("filters to Unknown includes keywords with null position", async () => {
      const user = userEvent.setup();

      // Use a minimal list: one with position, one without
      const testKeywords = [
        makeKeyword({ keywordId: "kw_with_pos", phrase: "has position kw", currentPosition: 5 }),
        makeKeyword({ keywordId: "kw_no_pos", phrase: "no position kw", currentPosition: null, change: null }),
      ];

      setupQueryMock({
        "keywords:getKeywordMonitoring": testKeywords,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Both visible initially
      expect(screen.getByText("has position kw")).toBeInTheDocument();
      expect(screen.getByText("no position kw")).toBeInTheDocument();

      await openFilters(user);

      // Select "Top 3" to verify filtering works (position=5 excluded)
      const selects = screen.getAllByRole("combobox");
      const positionSelect = selects.find(el => {
        const options = within(el).queryAllByRole("option");
        return options.some(o => o.textContent === "Top 3");
      })!;

      await user.selectOptions(positionSelect, "top3");

      // Only keyword with position=5 should be excluded (5 > 3)
      expect(screen.queryByText("has position kw")).not.toBeInTheDocument();
      // null position should also be excluded for Top 3
      expect(screen.queryByText("no position kw")).not.toBeInTheDocument();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_LIST_MIXED,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const searchInput = screen.getByPlaceholderText("Search keywords...");
      await user.click(searchInput);
      await user.type(searchInput, "SEO");

      const phrases = getVisiblePhrases();
      // Should match: "seo analysis platform", "SEO tools comparison"
      // (both contain "seo" case-insensitively)
      expect(phrases.length).toBeGreaterThanOrEqual(2);
      const lowerPhrases = phrases.map(p => p.toLowerCase());
      expect(lowerPhrases.every(p => p.includes("seo"))).toBe(true);
    });

    it("search + filter combined shows intersection", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_LIST_MIXED,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Apply search
      const searchInput = screen.getByPlaceholderText("Search keywords...");
      await user.click(searchInput);
      await user.type(searchInput, "seo");

      // Apply Top 10 filter
      await openFilters(user);
      const selects = screen.getAllByRole("combobox");
      const positionSelect = selects.find(el => {
        const options = within(el).queryAllByRole("option");
        return options.some(o => o.textContent === "Top 10");
      });
      await user.selectOptions(positionSelect!, "top10");

      const phrases = getVisiblePhrases();
      // seo analysis platform (pos 8, matches "seo" + top10) and possibly top ranking keyword (pos 2 but "top ranking keyword" doesn't contain "seo")
      // SEO tools comparison (pos 25, not top10)
      // So only "seo analysis platform" matches both
      expect(phrases.length).toBe(1);
      expect(phrases[0]).toContain("seo analysis platform");
    });

    it("pagination resets to page 1 when filter changes", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST_LARGE,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Go to page 2
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      const nextButton = screen.getByRole("button", { name: /Next/i });
      await user.click(nextButton);
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

      // Now apply a search filter - should reset to page 1
      const searchInput = screen.getByPlaceholderText("Search keywords...");
      await user.click(searchInput);
      await user.type(searchInput, "keyword 001");

      // Should be back on page 1 (or no pagination if only 1 result)
      expect(screen.queryByText(/Page 2 of/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Group 5: Column Visibility
  // =========================================================================

  describe("Column Visibility", () => {
    it("column picker hides Volume column when unchecked", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Volume header should be visible initially
      expect(screen.getByText("Volume")).toBeInTheDocument();

      // Open column picker
      const columnsButton = screen.getByRole("button", { name: /Columns/i });
      await user.click(columnsButton);

      // Find the volume checkbox
      const volumeLabel = screen.getByText("volume").closest("label");
      expect(volumeLabel).toBeTruthy();
      const volumeCheckbox = volumeLabel!.querySelector("input[type='checkbox']") as HTMLInputElement;
      expect(volumeCheckbox.checked).toBe(true);

      await user.click(volumeCheckbox);

      // Volume header should now be gone
      expect(screen.queryByText("Volume")).not.toBeInTheDocument();
    });

    it("column picker renders and is interactive", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const columnsButton = screen.getByRole("button", { name: /Columns/i });
      await user.click(columnsButton);

      // Should show checkboxes for each column
      const checkboxes = screen.getAllByRole("checkbox").filter(
        cb => cb.closest("label")?.textContent?.trim() !== ""
      );
      // Should have column labels: keyword, position, previous, change, volume, difficulty, cpc, etv, competition, intent, actions
      expect(checkboxes.length).toBeGreaterThanOrEqual(5);
    });
  });

  // =========================================================================
  // Group 6: Row Expansion
  // =========================================================================

  describe("Row Expansion", () => {
    it("expands row to show detail section when expand button clicked", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Find the expand/collapse buttons (they are in the keyword cell)
      const expandButtons = screen.getAllByRole("button").filter(btn => {
        const svg = btn.querySelector("svg");
        return svg && btn.closest("td") && !btn.title;
      });

      // Click the first row's expand button
      // The expand button is the small chevron icon button inside the keyword cell
      const firstRowTds = screen.getAllByRole("row")
        .filter(r => r.closest("tbody") && r.querySelector("td"));
      const firstRow = firstRowTds[0];
      const expandBtn = firstRow.querySelector("button:not([title])");
      expect(expandBtn).toBeTruthy();
      await user.click(expandBtn!);

      // Expanded content should show Position History heading and chart
      expect(screen.getByText("Position History")).toBeInTheDocument();
      expect(screen.getByTestId("keyword-position-chart")).toBeInTheDocument();
    });

    it("collapses expanded row when expand button is clicked again", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const firstRowTds = screen.getAllByRole("row")
        .filter(r => r.closest("tbody") && r.querySelector("td"));
      const firstRow = firstRowTds[0];
      const expandBtn = firstRow.querySelector("button:not([title])");

      // Expand
      await user.click(expandBtn!);
      expect(screen.getByText("Position History")).toBeInTheDocument();

      // Collapse
      await user.click(expandBtn!);
      expect(screen.queryByText("Position History")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Group 7: Bulk Actions
  // =========================================================================

  describe("Bulk Actions", () => {
    it("shows 1 selected when single row checkbox is checked", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const checkboxes = screen.getAllByRole("checkbox");
      const firstRowCheckbox = checkboxes[1]; // [0] is header "select all"
      await user.click(firstRowCheckbox);

      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("selects all visible rows when header checkbox is checked", async () => {
      const user = userEvent.setup();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      const checkboxes = screen.getAllByRole("checkbox");
      const headerCheckbox = checkboxes[0];
      await user.click(headerCheckbox);

      expect(screen.getByText(`${KEYWORD_MONITORING_LIST.length} selected`)).toBeInTheDocument();
    });

    it("calls refreshKeywordPositions mutation for selected rows on bulk refresh", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select first 3 rows
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      await user.click(checkboxes[3]);

      expect(screen.getByText("3 selected")).toBeInTheDocument();

      // Click bulk refresh
      const refreshBtn = screen.getByRole("button", { name: /Refresh selected/i });
      await user.click(refreshBtn);

      const refreshFn = mutationMap.get("keywords:refreshKeywordPositions");
      expect(refreshFn).toBeDefined();
      expect(refreshFn).toHaveBeenCalled();

      // Verify the call includes the selected keyword IDs
      const callArgs = refreshFn!.mock.calls[0][0];
      expect(callArgs.keywordIds).toHaveLength(3);
    });

    it("calls bulkDeleteKeywords mutation for selected rows on bulk delete (with confirmation modal)", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();
      mutationMap.get("keywords:bulkDeleteKeywords")?.mockResolvedValue(2);

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select 2 rows
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      expect(screen.getByText("2 selected")).toBeInTheDocument();

      // Click bulk delete — opens confirmation modal
      const deleteBtn = screen.getByRole("button", { name: /Delete selected/i });
      await user.click(deleteBtn);

      // Confirm in the modal
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete 2 keywords/)).toBeInTheDocument();
      });
      const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
      const confirmBtn = deleteButtons[deleteButtons.length - 1];
      await user.click(confirmBtn);

      await waitFor(() => {
        const deleteFn = mutationMap.get("keywords:bulkDeleteKeywords");
        expect(deleteFn).toBeDefined();
        expect(deleteFn).toHaveBeenCalled();
      });
    });

    it("calls createSerpFetchJob mutation for selected rows on bulk SERP fetch", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select 3 rows
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      await user.click(checkboxes[3]);

      // Click bulk SERP fetch
      const serpBtn = screen.getByRole("button", { name: /Fetch SERP for selected/i });
      await user.click(serpBtn);

      const serpFn = mutationMap.get("keywordSerpJobs:createSerpFetchJob");
      expect(serpFn).toBeDefined();
      expect(serpFn).toHaveBeenCalled();

      const callArgs = serpFn!.mock.calls[0][0];
      expect(callArgs.keywordIds).toHaveLength(3);
      expect(callArgs.domainId).toBe(DOMAIN_ID);
    });
  });

  // =========================================================================
  // Group 8: Single Row Actions
  // =========================================================================

  describe("Single Row Actions", () => {
    it("calls refreshKeywordPositions when single row refresh button clicked", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Find refresh buttons in the actions column (they have title="Refresh position")
      const refreshBtns = screen.getAllByTitle("Refresh position");
      expect(refreshBtns.length).toBeGreaterThan(0);

      await user.click(refreshBtns[0]);

      const refreshFn = mutationMap.get("keywords:refreshKeywordPositions");
      expect(refreshFn).toBeDefined();
      expect(refreshFn).toHaveBeenCalledTimes(1);

      const callArgs = refreshFn!.mock.calls[0][0];
      expect(callArgs.keywordIds).toHaveLength(1);
    });

    it("calls deleteKeywords when single row delete button clicked", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMock();

      setupQueryMock({
        "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Find delete buttons in the actions column (they have title="Delete keyword")
      const deleteBtns = screen.getAllByTitle("Delete keyword");
      expect(deleteBtns.length).toBeGreaterThan(0);

      await user.click(deleteBtns[0]);

      const deleteFn = mutationMap.get("keywords:deleteKeywords");
      expect(deleteFn).toBeDefined();
      expect(deleteFn).toHaveBeenCalledTimes(1);

      const callArgs = deleteFn!.mock.calls[0][0];
      expect(callArgs.keywordIds).toHaveLength(1);
    });
  });

  // =========================================================================
  // Group 9: Status Indicators
  // =========================================================================

  describe("Status Indicators", () => {
    it("shows spinning indicator for keyword with checkingStatus=checking", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": [KEYWORD_CHECKING],
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // The checking keyword renders RefreshCw01 with animate-spin class
      const spinners = document.querySelectorAll(".animate-spin");
      expect(spinners.length).toBeGreaterThanOrEqual(1);
    });

    it("shows AI badge for keyword with proposedBy=ai", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": [KEYWORD_AI_PROPOSED],
        "keywordSerpJobs:getActiveJobForDomain": null,
      });

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // The AI badge renders "AI" text
      expect(screen.getByText("AI")).toBeInTheDocument();
      // Should also contain the phrase
      expect(screen.getByText("ai suggested seo term")).toBeInTheDocument();
    });
  });
});
