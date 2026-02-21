import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "../../../../convex/_generated/dataModel";

// --- Mocks ---

const mockUseAnalyticsQuery = vi.fn();

vi.mock("@/hooks/useAnalyticsQuery", () => ({
  useAnalyticsQuery: (...args: unknown[]) => mockUseAnalyticsQuery(...args),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@untitledui/icons", () => ({
  Plus: () => <span>+</span>,
  ChevronSelectorVertical: () => <span>↕</span>,
  SearchLg: () => <span>🔍</span>,
}));

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
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/base/select/select", () => ({
  Select: Object.assign(
    ({
      onSelectionChange,
      placeholder,
      children: renderItem,
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
  }: {
    selectedCount: number;
    onClearSelection: () => void;
  }) => (
    <div data-testid="bulk-bar">
      {selectedCount} selected
      <button onClick={onClearSelection}>Clear selection</button>
    </div>
  ),
}));

import { CompetitorKeywordGapTable } from "./CompetitorKeywordGapTable";

const domainId = "test-domain-id" as Id<"domains">;

const fakeCompetitors = [
  {
    _id: "comp1" as Id<"competitors">,
    competitorDomain: "rival.com",
    name: "Rival",
    status: "active",
    keywordCount: 10,
    avgPosition: 5,
    lastChecked: Date.now(),
    createdAt: Date.now(),
  },
  {
    _id: "comp2" as Id<"competitors">,
    competitorDomain: "paused.com",
    name: "Paused Comp",
    status: "paused",
    keywordCount: 5,
    avgPosition: 8,
    lastChecked: Date.now(),
    createdAt: Date.now(),
  },
];

const fakeGaps = [
  {
    keywordId: "kw1",
    phrase: "seo tools",
    competitorPosition: 3,
    competitorUrl: "https://rival.com/seo",
    ourPosition: 15,
    gap: 12,
    searchVolume: 5000,
    difficulty: 35,
    gapScore: 72,
  },
  {
    keywordId: "kw2",
    phrase: "keyword research",
    competitorPosition: 5,
    competitorUrl: null,
    ourPosition: null,
    gap: 5,
    searchVolume: 3000,
    difficulty: 55,
    gapScore: 45,
  },
  {
    keywordId: "kw3",
    phrase: "backlink checker",
    competitorPosition: 2,
    competitorUrl: null,
    ourPosition: 30,
    gap: 28,
    searchVolume: 1000,
    difficulty: undefined,
    gapScore: 30,
  },
];

describe("CompetitorKeywordGapTable — user flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user sees loading state while competitors are fetching", () => {
    mockUseAnalyticsQuery.mockReturnValue({ data: undefined });
    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );
    expect(within(container).getByText("keywordGapLoading")).toBeInTheDocument();
  });

  it("user sees empty state when no active competitors exist", () => {
    // Only paused competitor — no active ones
    mockUseAnalyticsQuery.mockReturnValue({
      data: fakeCompetitors.filter((c) => c.status === "paused"),
    });
    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );
    expect(
      within(container).getByText("keywordGapNoCompetitors")
    ).toBeInTheDocument();
  });

  it("user sees prompt to select competitor, selects one, sees keyword gap data", async () => {
    const user = userEvent.setup();
    mockUseAnalyticsQuery.mockImplementation(
      (_ref: unknown, args: Record<string, unknown>) => {
        if (args && "competitorId" in args) return { data: fakeGaps };
        return { data: fakeCompetitors };
      }
    );

    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );

    // Step 1: User sees prompt to pick a competitor
    expect(
      within(container).getByText("keywordGapSelectPrompt")
    ).toBeInTheDocument();

    // Step 2: User selects "Rival" from dropdown
    const select = within(container).getByTestId("competitor-select");
    await user.selectOptions(select, "comp1");

    // Step 3: User sees keyword gap results in table
    expect(within(container).getByText("seo tools")).toBeInTheDocument();
    expect(within(container).getByText("keyword research")).toBeInTheDocument();
    expect(within(container).getByText("backlink checker")).toBeInTheDocument();

    // Step 4: User sees position data — #3 for competitor, #15 for us
    expect(within(container).getByText("#3")).toBeInTheDocument();
    expect(within(container).getByText("#15")).toBeInTheDocument();

    // Step 5: Keywords we don't rank for show "not ranking" text
    expect(
      within(container).getByText("keywordGapNotRanking")
    ).toBeInTheDocument();
  });

  it("user searches for specific keyword within gap results", async () => {
    const user = userEvent.setup();
    mockUseAnalyticsQuery.mockImplementation(
      (_ref: unknown, args: Record<string, unknown>) => {
        if (args && "competitorId" in args) return { data: fakeGaps };
        return { data: fakeCompetitors };
      }
    );

    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );

    // Select competitor first
    await user.selectOptions(
      within(container).getByTestId("competitor-select"),
      "comp1"
    );

    // All 3 keywords visible
    expect(within(container).getByText("seo tools")).toBeInTheDocument();
    expect(within(container).getByText("keyword research")).toBeInTheDocument();

    // User types search query
    const searchInput = within(container).getByTestId("search-input");
    await user.type(searchInput, "seo");

    // Only matching keyword visible
    expect(within(container).getByText("seo tools")).toBeInTheDocument();
    expect(
      within(container).queryByText("keyword research")
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByText("backlink checker")
    ).not.toBeInTheDocument();
  });

  it("user selects rows with checkboxes and sees bulk action bar", async () => {
    const user = userEvent.setup();
    mockUseAnalyticsQuery.mockImplementation(
      (_ref: unknown, args: Record<string, unknown>) => {
        if (args && "competitorId" in args) return { data: fakeGaps };
        return { data: fakeCompetitors };
      }
    );

    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );

    // Select competitor
    await user.selectOptions(
      within(container).getByTestId("competitor-select"),
      "comp1"
    );

    // Find row checkboxes (skip header checkbox)
    const checkboxes = within(container).getAllByRole("checkbox");
    // First is header "select all", rest are per-row
    const rowCheckboxes = checkboxes.slice(1);

    // User clicks first row checkbox
    await user.click(rowCheckboxes[0]);

    // Bulk action bar appears
    const bulkBar = within(container).getByTestId("bulk-bar");
    expect(bulkBar).toHaveTextContent("1 selected");

    // User clicks second row checkbox
    await user.click(rowCheckboxes[1]);
    expect(bulkBar).toHaveTextContent("2 selected");

    // User clears selection
    await user.click(within(bulkBar).getByText("Clear selection"));
    expect(
      within(container).queryByTestId("bulk-bar")
    ).not.toBeInTheDocument();
  });

  it("user sees opportunity score badges with correct severity colors", async () => {
    const user = userEvent.setup();
    mockUseAnalyticsQuery.mockImplementation(
      (_ref: unknown, args: Record<string, unknown>) => {
        if (args && "competitorId" in args) return { data: fakeGaps };
        return { data: fakeCompetitors };
      }
    );

    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );

    await user.selectOptions(
      within(container).getByTestId("competitor-select"),
      "comp1"
    );

    // gapScore 72 → success (green), 45 → warning (yellow), 30 → gray
    const badges = within(container).getAllByText(/^[\d.]+$/);
    const scoreBadges = badges.filter((b) => b.hasAttribute("data-color"));

    const colors = scoreBadges.map((b) => b.getAttribute("data-color"));
    expect(colors).toContain("success"); // score 72
    expect(colors).toContain("warning"); // score 45
    expect(colors).toContain("gray"); // score 30
  });

  it("user sees dash for missing difficulty instead of broken data", async () => {
    const user = userEvent.setup();
    mockUseAnalyticsQuery.mockImplementation(
      (_ref: unknown, args: Record<string, unknown>) => {
        if (args && "competitorId" in args) return { data: fakeGaps };
        return { data: fakeCompetitors };
      }
    );

    const { container } = render(
      <CompetitorKeywordGapTable domainId={domainId} />
    );

    await user.selectOptions(
      within(container).getByTestId("competitor-select"),
      "comp1"
    );

    // "backlink checker" has difficulty: undefined — user should see "—"
    const dashes = within(container).getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
