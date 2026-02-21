/**
 * Integration tests for KeywordMonitoringTable component.
 *
 * Verifies loading, empty, populated states, sorting, filtering,
 * position/change display, status badges, and bulk selection.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
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

// Override the global next-intl mock to include NextIntlClientProvider
// so renderWithProviders can use real translations.
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
  makeKeyword,
} from "@/test/fixtures/keywords";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";

const DOMAIN_ID = "domain_active_1" as any;

// ---------------------------------------------------------------------------
// Query mock helper using function name strings instead of reference identity
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

describe("KeywordMonitoringTable", () => {
  // 1. Loading state
  it("renders loading state when query returns undefined", () => {
    // useQuery returns undefined by default
    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // LoadingState renders Skeleton divs when keywords === undefined.
    // Verify no table heading or empty-state text appears.
    expect(screen.queryByText("Keyword Monitoring")).not.toBeInTheDocument();
    expect(screen.queryByText("No keywords being monitored yet")).not.toBeInTheDocument();
  });

  // 2. Empty state
  it("renders empty state with Add Keywords button when query returns []", () => {
    setupQueryMock({
      "keywords:getKeywordMonitoring": [],
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("No keywords being monitored yet")).toBeInTheDocument();
    expect(screen.getByText("Add keywords to start tracking their positions")).toBeInTheDocument();

    const addButton = screen.getByRole("button", { name: /Add Keywords/i });
    expect(addButton).toBeInTheDocument();
  });

  // 3. With keywords - renders table rows
  it("renders table rows with phrase, position, volume", () => {
    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Section heading
    expect(screen.getByText("Keyword Monitoring")).toBeInTheDocument();

    // Keyword phrases
    expect(screen.getByText("best seo tools")).toBeInTheDocument();
    expect(screen.getByText("keyword research tool")).toBeInTheDocument();
    expect(screen.getByText("seo monitoring software")).toBeInTheDocument();
    expect(screen.getByText("position tracker free")).toBeInTheDocument();

    // Volumes: 2400 -> "2.4K", 1800 -> "1.8K", 800 -> "800", 500 -> "500"
    expect(screen.getByText("2.4K")).toBeInTheDocument();
    expect(screen.getByText("1.8K")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  // 4. Position display
  it("shows numeric position for keywords with currentPosition, dash for null", () => {
    setupQueryMock({
      "keywords:getKeywordMonitoring": [
        makeKeyword({ keywordId: "kw_a", phrase: "has position", currentPosition: 5 }),
        makeKeyword({ keywordId: "kw_b", phrase: "no position", currentPosition: null, change: null }),
      ],
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Position 5 should be visible as badge text
    expect(screen.getByText("5")).toBeInTheDocument();

    // Null position renders em-dash character(s)
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  // 5. Change indicator
  it("shows green up arrow for positive change and red down arrow for negative", () => {
    setupQueryMock({
      "keywords:getKeywordMonitoring": [
        makeKeyword({ keywordId: "kw_up", phrase: "going up", change: 3 }),
        makeKeyword({ keywordId: "kw_down", phrase: "going down", change: -2 }),
      ],
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Positive change: up arrow + number rendered as "↑ 3"
    const upIndicator = screen.getByText(
      (content) => content.includes("\u2191") && content.includes("3")
    );
    expect(upIndicator).toBeInTheDocument();
    expect(upIndicator.className).toContain("success");

    // Negative change: down arrow + number rendered as "↓ 2"
    const downIndicator = screen.getByText(
      (content) => content.includes("\u2193") && content.includes("2")
    );
    expect(downIndicator).toBeInTheDocument();
    expect(downIndicator.className).toContain("error");
  });

  // 6. Status filter options
  it("renders status filter options for rising/falling/stable/new", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Open filters panel
    const filtersButton = screen.getByRole("button", { name: /Filters/i });
    await user.click(filtersButton);

    // Status filter dropdown should contain all status options
    expect(screen.getByText("Rising")).toBeInTheDocument();
    expect(screen.getByText("Falling")).toBeInTheDocument();
    expect(screen.getByText("Stable")).toBeInTheDocument();

    // Verify a select with the Rising option exists (the Status filter)
    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects.find((el) => {
      const options = within(el).queryAllByRole("option");
      return options.some((o) => o.textContent === "Rising");
    });
    expect(statusSelect).toBeTruthy();
  });

  // 7. Search filtering
  it("filters table rows when typing in search input", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // All keywords visible initially
    expect(screen.getByText("best seo tools")).toBeInTheDocument();
    expect(screen.getByText("keyword research tool")).toBeInTheDocument();

    // Type in search input
    const searchInput = screen.getByPlaceholderText("Search keywords...");
    await user.click(searchInput);
    await user.type(searchInput, "research");

    // Only matching keyword remains
    expect(screen.getByText("keyword research tool")).toBeInTheDocument();
    expect(screen.queryByText("best seo tools")).not.toBeInTheDocument();
    expect(screen.queryByText("seo monitoring software")).not.toBeInTheDocument();
    expect(screen.queryByText("position tracker free")).not.toBeInTheDocument();
  });

  // 8. Sort by position
  it("sorts keywords when clicking position header", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // Find position column header
    const positionHeader = screen.getByText("Position").closest("th");
    expect(positionHeader).toBeTruthy();

    // Helper to extract keyword order from table rows
    const getKeywordOrder = () => {
      const rows = screen.getAllByRole("row").filter((row) => {
        return row.closest("tbody") && row.querySelector("td");
      });
      return rows
        .map((row) => {
          const cells = row.querySelectorAll("td");
          const phraseCell = cells[1];
          return phraseCell?.textContent?.trim() || "";
        })
        .filter(Boolean);
    };

    // Default ascending: pos 1, 5, 12, null(999)
    const ascOrder = getKeywordOrder();
    expect(ascOrder[0]).toContain("seo monitoring software");
    expect(ascOrder[1]).toContain("best seo tools");

    // Click position header to toggle to descending
    await user.click(positionHeader!);

    const descOrder = getKeywordOrder();
    // Descending: null(999) first, then 12, 5, 1
    expect(descOrder[0]).toContain("position tracker free");
    expect(descOrder[1]).toContain("keyword research tool");
  });

  // 9. Bulk selection
  it("shows BulkActionBar when checkboxes are selected", async () => {
    const user = userEvent.setup();

    setupQueryMock({
      "keywords:getKeywordMonitoring": KEYWORD_MONITORING_LIST,
      "keywordSerpJobs:getActiveJobForDomain": null,
    });

    renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

    // BulkActionBar should not be visible initially
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();

    // Find row checkboxes; first is "select all", rest are per-row
    const checkboxes = screen.getAllByRole("checkbox");
    const firstRowCheckbox = checkboxes[1];
    const secondRowCheckbox = checkboxes[2];

    await user.click(firstRowCheckbox);

    // BulkActionBar should now show "1 selected"
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Bulk action buttons appear
    expect(screen.getByRole("button", { name: /Refresh selected/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete selected/i })).toBeInTheDocument();

    // Select another row
    await user.click(secondRowCheckbox);
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    // Clear selection
    const clearButton = screen.getByRole("button", { name: /Clear/i });
    await user.click(clearButton);

    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });
});
