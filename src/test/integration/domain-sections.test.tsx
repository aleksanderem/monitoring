/**
 * Integration tests for domain section components:
 * BacklinksSummaryStats, VisibilityStats, ContentGapSection, CompetitorManagementSection
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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
  usePathname: () => "/domains/domain_1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "domain_1" }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh", "competitors.add", "competitors.analyze"],
    modules: ["positioning", "competitors", "backlinks"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh", "competitors.add", "competitors.analyze"],
    modules: ["positioning", "competitors", "backlinks"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));

vi.mock("@/hooks/use-breakpoint", () => ({
  useBreakpoint: () => true,
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

// Override global next-intl mock to include NextIntlClientProvider
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

// Mock heavy sub-components of ContentGapSection to isolate testing
vi.mock("@/components/domain/tables/ContentGapOpportunitiesTable", () => ({
  ContentGapOpportunitiesTable: () => <div data-testid="content-gap-table">Opportunities Table</div>,
}));

vi.mock("@/components/domain/charts/ContentGapTrendsChart", () => ({
  ContentGapTrendsChart: () => <div data-testid="content-gap-trends">Trends Chart</div>,
}));

vi.mock("@/components/domain/charts/ContentGapBubbleChart", () => ({
  ContentGapBubbleChart: () => <div data-testid="content-gap-bubble">Bubble Chart</div>,
}));

vi.mock("@/components/domain/cards/TopicClustersCard", () => ({
  TopicClustersCard: () => <div data-testid="topic-clusters">Topic Clusters</div>,
}));

vi.mock("@/components/domain/cards/CompetitorGapComparisonCard", () => ({
  CompetitorGapComparisonCard: () => <div data-testid="competitor-gap-comparison">Gap Comparison</div>,
}));

vi.mock("@/components/domain/modals/AddCompetitorModal", () => ({
  AddCompetitorModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-competitor-modal">Add Competitor</div> : null,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { BacklinksSummaryStats } from "@/components/domain/sections/BacklinksSummaryStats";
import { VisibilityStats } from "@/components/domain/sections/VisibilityStats";
import { ContentGapSection } from "@/components/domain/sections/ContentGapSection";
import { CompetitorManagementSection } from "@/components/domain/sections/CompetitorManagementSection";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DOMAIN_ID = "domain_1" as any;

const BACKLINK_SUMMARY = {
  totalBacklinks: 1250,
  totalDomains: 340,
  totalIps: 280,
  dofollow: 1000,
  nofollow: 250,
};

const VISIBILITY_STATS = {
  totalKeywords: 50,
  avgPosition: 12.5,
  top3Count: 5,
  top10Count: 15,
  top100Count: 45,
  visibilityScore: 72,
  visibilityChange: 3.2,
};

const GAP_SUMMARY = {
  totalGaps: 45,
  highPriority: 12,
  mediumPriority: 20,
  lowPriority: 13,
  totalEstimatedValue: 5000,
  competitorsAnalyzed: 2,
  lastAnalyzedAt: Date.now() - 86400000,
  statusCounts: { identified: 20, monitoring: 10, ranking: 10, dismissed: 5 },
  topOpportunities: [],
};

const COMPETITORS = [
  { _id: "comp_1", competitorDomain: "rival.com", name: "Rival Site", status: "active" as const, domainId: DOMAIN_ID, lastCheckedAt: null },
  { _id: "comp_2", competitorDomain: "other.com", name: "Other Site", status: "active" as const, domainId: DOMAIN_ID, lastCheckedAt: null },
];

// ---------------------------------------------------------------------------
// Query mock helper using function name strings
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueries(queryResponses: QueryMap) {
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
});

// ===========================================================================
// BacklinksSummaryStats
// ===========================================================================

describe("BacklinksSummaryStats", () => {
  it("shows 4 skeleton cards when isLoading=true", () => {
    renderWithProviders(<BacklinksSummaryStats summary={null} isLoading={true} />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("shows no-backlink-data alert when summary is null", () => {
    renderWithProviders(<BacklinksSummaryStats summary={null} isLoading={false} />);

    expect(screen.getByText("No backlink data available")).toBeInTheDocument();
    expect(screen.getByText(/Click.*Fetch Backlinks.*to load data/i)).toBeInTheDocument();
  });

  it("renders 4 stat cards with correct labels when data provided", () => {
    renderWithProviders(<BacklinksSummaryStats summary={BACKLINK_SUMMARY} isLoading={false} />);

    expect(screen.getByText("Total Backlinks")).toBeInTheDocument();
    expect(screen.getByText("Referring Domains")).toBeInTheDocument();
    expect(screen.getByText("Referring IPs")).toBeInTheDocument();
    expect(screen.getByText("Dofollow Links")).toBeInTheDocument();

    // Values (toLocaleString in jsdom may or may not add commas)
    expect(screen.getByText((1250).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText((340).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText((280).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText((1000).toLocaleString())).toBeInTheDocument();
  });

  it("shows correct dofollow percentage and nofollow count", () => {
    renderWithProviders(<BacklinksSummaryStats summary={BACKLINK_SUMMARY} isLoading={false} />);

    // 1000/1250 = 80.0%, nofollow = 250
    expect(screen.getByText("80.0% dofollow · 250 nofollow")).toBeInTheDocument();
  });
});

// ===========================================================================
// VisibilityStats
// ===========================================================================

describe("VisibilityStats", () => {
  it("shows skeleton cards when isLoading=true", () => {
    renderWithProviders(
      <VisibilityStats stats={VISIBILITY_STATS} isLoading={true} />
    );

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("renders 4 stat cards with correct labels and values", () => {
    renderWithProviders(
      <VisibilityStats stats={VISIBILITY_STATS} isLoading={false} />
    );

    expect(screen.getByText("Visibility Score")).toBeInTheDocument();
    expect(screen.getByText("Average Position")).toBeInTheDocument();
    expect(screen.getByText("Top 3 Rankings")).toBeInTheDocument();
    expect(screen.getByText("Top 10 Rankings")).toBeInTheDocument();

    // Values: visibilityScore=72 -> "72", avgPosition=12.5 -> "12.5"
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("shows up trend indicator when visibilityChange > 0", () => {
    renderWithProviders(
      <VisibilityStats stats={{ ...VISIBILITY_STATS, visibilityChange: 3.2 }} isLoading={false} />
    );

    // Should show "3.2%" trend text with success color
    expect(screen.getByText("3.2%")).toBeInTheDocument();
    const trendEl = screen.getByText("3.2%");
    expect(trendEl.className).toContain("success");
  });

  it("shows down trend indicator when visibilityChange < 0", () => {
    renderWithProviders(
      <VisibilityStats stats={{ ...VISIBILITY_STATS, visibilityChange: -2.5 }} isLoading={false} />
    );

    // Should show "2.5%" trend text with error color
    expect(screen.getByText("2.5%")).toBeInTheDocument();
    const trendEl = screen.getByText("2.5%");
    expect(trendEl.className).toContain("error");
  });
});

// ===========================================================================
// ContentGapSection
// ===========================================================================

describe("ContentGapSection", () => {
  it("renders loading state when queries return undefined", () => {
    // Default mock returns undefined for all queries
    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    // Section title should still render
    expect(screen.getByText("Content Gap Analysis")).toBeInTheDocument();
    // GapSummaryCards is shown with isLoading when gapSummary === undefined
    // The skeleton pulse elements should be present
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders gap summary cards when data provided", () => {
    setupQueries({
      "contentGaps_queries:getGapSummary": GAP_SUMMARY,
      "competitors:getCompetitors": COMPETITORS,
    });

    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    expect(screen.getByText("Content Gap Analysis")).toBeInTheDocument();
    // GapSummaryCards renders totalGaps=45, highPriority=12
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows no competitors state when competitor list is empty", () => {
    setupQueries({
      "contentGaps_queries:getGapSummary": GAP_SUMMARY,
      "competitors:getCompetitors": [],
    });

    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    // Refresh button should be disabled when no active competitors
    const refreshButton = screen.getByRole("button", { name: /Refresh Analysis/i });
    expect(refreshButton).toBeDisabled();
  });

  it("clicking refresh triggers mutation for each active competitor", async () => {
    const createJobMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(createJobMock as any);

    setupQueries({
      "contentGaps_queries:getGapSummary": GAP_SUMMARY,
      "competitors:getCompetitors": COMPETITORS,
    });

    const user = userEvent.setup();
    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    const refreshButton = screen.getByRole("button", { name: /Refresh Analysis/i });
    await user.click(refreshButton);

    // Should call createJob for each active competitor
    expect(createJobMock).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// CompetitorManagementSection
// ===========================================================================

describe("CompetitorManagementSection", () => {
  it("shows loading state when competitors undefined", () => {
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state with Add First prompt when no competitors", () => {
    setupQueries({
      "competitors:getCompetitors": [],
      "competitorContentGapJobs:getActiveJobsForDomain": [],
      "competitorBacklinksJobs:getActiveJobsForDomain": [],
    });

    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    expect(screen.getByText("No competitors added yet")).toBeInTheDocument();
    expect(screen.getByText("Add Your First Competitor")).toBeInTheDocument();
  });

  it("renders competitor list with names and domains", () => {
    setupQueries({
      "competitors:getCompetitors": COMPETITORS,
      "competitorContentGapJobs:getActiveJobsForDomain": [],
      "competitorBacklinksJobs:getActiveJobsForDomain": [],
    });

    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    expect(screen.getByText("Rival Site")).toBeInTheDocument();
    expect(screen.getByText("rival.com")).toBeInTheDocument();
    expect(screen.getByText("Other Site")).toBeInTheDocument();
    expect(screen.getByText("other.com")).toBeInTheDocument();
  });

  it("opens AddCompetitorModal when Add Competitor button clicked", async () => {
    setupQueries({
      "competitors:getCompetitors": COMPETITORS,
      "competitorContentGapJobs:getActiveJobsForDomain": [],
      "competitorBacklinksJobs:getActiveJobsForDomain": [],
    });

    const user = userEvent.setup();
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Modal should not be visible initially
    expect(screen.queryByTestId("add-competitor-modal")).not.toBeInTheDocument();

    // Click the Add Competitor button in the header
    const addButton = screen.getByRole("button", { name: /Add Competitor/i });
    await user.click(addButton);

    expect(screen.getByTestId("add-competitor-modal")).toBeInTheDocument();
  });

  it("shows bulk delete button when select all is checked", async () => {
    setupQueries({
      "competitors:getCompetitors": COMPETITORS,
      "competitorContentGapJobs:getActiveJobsForDomain": [],
      "competitorBacklinksJobs:getActiveJobsForDomain": [],
    });

    const user = userEvent.setup();
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Bulk delete button should not be visible initially
    expect(screen.queryByRole("button", { name: /Delete/i })).not.toBeInTheDocument();

    // Find the select-all checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    const selectAllCheckbox = checkboxes[0];

    await user.click(selectAllCheckbox);

    // Bulk delete button should now appear with count
    const deleteButton = screen.getByRole("button", { name: /Delete.*2/i });
    expect(deleteButton).toBeInTheDocument();
  });
});
