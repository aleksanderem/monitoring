/**
 * Integration tests for CompetitorManagementSection and ContentGapSection
 * data flow paths. Tests loading, empty, populated, mutation calls,
 * bulk operations, job progress, and permission gating.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import {
  COMPETITORS_LIST,
  COMPETITORS_EMPTY,
  CONTENT_GAP_JOB_ACTIVE,
  CONTENT_GAP_JOBS_NONE,
  BACKLINKS_JOBS_NONE,
  GAP_SUMMARY,
} from "@/test/fixtures/competitors";

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
  usePathname: () => "/domains/domain_active_1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "domain_active_1" }),
}));

const ALL_PERMISSIONS = [
  "domains.create", "domains.edit", "domains.delete",
  "keywords.add", "keywords.refresh",
  "competitors.add", "competitors.analyze",
  "projects.create", "projects.edit", "projects.delete",
];

const ALL_MODULES = [
  "positioning", "backlinks", "seo_audit", "reports",
  "competitors", "ai_strategy", "forecasts", "link_building",
];

let currentPermissions = ALL_PERMISSIONS;

const permsMock = (overrides: { permissions?: string[] } = {}) => ({
  permissions: overrides.permissions ?? currentPermissions,
  modules: ALL_MODULES,
  role: "admin",
  plan: { name: "Pro", key: "pro" },
  isLoading: false,
  can: (p: string) => (overrides.permissions ?? currentPermissions).includes(p),
  hasModule: () => true,
});

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => permsMock(),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => permsMock(),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));
vi.mock("@/hooks/use-breakpoint", () => ({ useBreakpoint: () => true }));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
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

// Mock heavy sub-components
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

vi.mock("@/hooks/useDateRange", () => ({
  useDateRange: () => ({
    dateRange: { from: new Date("2025-01-01"), to: new Date("2025-12-31") },
    setDateRange: vi.fn(),
    comparisonRange: null,
    setComparisonRange: vi.fn(),
    preset: "1y",
    setPreset: vi.fn(),
  }),
}));

vi.mock("@/components/common/DateRangePicker", () => ({
  DateRangePicker: () => <div data-testid="date-range-picker">DateRangePicker</div>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { CompetitorManagementSection } from "@/components/domain/sections/CompetitorManagementSection";
import { ContentGapSection } from "@/components/domain/sections/ContentGapSection";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOMAIN_ID = "domain_active_1" as any;

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
  // Reset confirm dialog mock
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

// ===========================================================================
// CompetitorManagementSection flows
// ===========================================================================

describe("CompetitorManagementSection Flows", () => {
  it("shows loading state when competitors query returns undefined", () => {
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // competitors === undefined triggers the loading text
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("shows empty state with add button when competitors list is empty", () => {
    setupQueries({
      "competitors:getCompetitors": [],
      "competitorContentGapJobs:getActiveJobsForDomain": [],
      "competitorBacklinksJobs:getActiveJobsForDomain": [],
    });

    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    expect(screen.getByText("No competitors added yet")).toBeInTheDocument();
    expect(screen.getByText("Add Your First Competitor")).toBeInTheDocument();
  });

  it("lists only active competitors, filtering out paused ones", () => {
    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": CONTENT_GAP_JOBS_NONE,
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // 2 active competitors should be shown
    expect(screen.getByText("Competitor One")).toBeInTheDocument();
    expect(screen.getByText("competitor-one.com")).toBeInTheDocument();
    expect(screen.getByText("SEO Rival")).toBeInTheDocument();
    expect(screen.getByText("seo-rival.io")).toBeInTheDocument();

    // Paused competitor should NOT be shown
    expect(screen.queryByText("Old Competitor")).not.toBeInTheDocument();
  });

  it("shows content gap job progress bar when active job exists", () => {
    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": [CONTENT_GAP_JOB_ACTIVE],
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Job status text should appear for comp_1 which has an active job
    expect(screen.getByText("Analyzing content gaps...")).toBeInTheDocument();
  });

  it("calls removeCompetitor mutation when delete button clicked", async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(removeMock as any);

    // Mock window.confirm to auto-approve
    vi.spyOn(window, "confirm").mockReturnValue(true);

    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": CONTENT_GAP_JOBS_NONE,
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    const user = userEvent.setup();
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Find delete buttons via the Trash01 icon (react-aria Button doesn't
    // forward the title prop to the DOM as an HTML title attribute)
    const deleteIcons = screen.getAllByTestId("icon-Trash01");
    expect(deleteIcons.length).toBeGreaterThanOrEqual(1);

    const firstDeleteBtn = deleteIcons[0].closest("button")!;
    await user.click(firstDeleteBtn);

    expect(removeMock).toHaveBeenCalledWith({ competitorId: "comp_1" });
  });

  it("calls removeCompetitor for each selected competitor on bulk delete", async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(removeMock as any);

    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": CONTENT_GAP_JOBS_NONE,
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    const user = userEvent.setup();
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Click select-all checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    const selectAllCheckbox = checkboxes[0];
    await user.click(selectAllCheckbox);

    // Bulk delete button should appear
    const deleteBtn = screen.getByRole("button", { name: /Delete.*2/i });
    await user.click(deleteBtn);

    // removeCompetitor should be called for each active competitor
    expect(removeMock).toHaveBeenCalledTimes(2);
    expect(removeMock).toHaveBeenCalledWith({ competitorId: "comp_1" });
    expect(removeMock).toHaveBeenCalledWith({ competitorId: "comp_2" });
  });

  it("calls createContentGapJob when Analyze Content Gap button clicked", async () => {
    const createJobMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(createJobMock as any);

    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": CONTENT_GAP_JOBS_NONE,
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    const user = userEvent.setup();
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Find content gap buttons
    const contentGapButtons = screen.getAllByText("Content Gap");
    await user.click(contentGapButtons[0]);

    expect(createJobMock).toHaveBeenCalledWith({
      domainId: DOMAIN_ID,
      competitorId: "comp_1",
    });
  });

  it("calls createBacklinksJob when Fetch Backlinks button clicked", async () => {
    const createJobMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(createJobMock as any);

    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": CONTENT_GAP_JOBS_NONE,
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    const user = userEvent.setup();
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // Find backlinks buttons
    const backlinksButtons = screen.getAllByText("Backlinks");
    await user.click(backlinksButtons[0]);

    expect(createJobMock).toHaveBeenCalled();
  });

  it("disables content gap button when an active job already exists for that competitor", () => {
    setupQueries({
      "competitors:getCompetitors": COMPETITORS_LIST,
      "competitorContentGapJobs:getActiveJobsForDomain": [CONTENT_GAP_JOB_ACTIVE],
      "competitorBacklinksJobs:getActiveJobsForDomain": BACKLINKS_JOBS_NONE,
    });

    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);

    // The content gap buttons - comp_1 has an active job, so its button should be disabled
    const contentGapButtons = screen.getAllByText("Content Gap");
    // comp_1's button (first one) should be disabled because CONTENT_GAP_JOB_ACTIVE targets comp_1
    expect(contentGapButtons[0].closest("button")).toBeDisabled();
    // comp_2's button should be enabled (no active job)
    expect(contentGapButtons[1].closest("button")).not.toBeDisabled();
  });
});

// ===========================================================================
// ContentGapSection flows
// ===========================================================================

describe("ContentGapSection Flows", () => {
  it("shows loading skeleton cards when gapSummary is undefined", () => {
    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    // Section title still renders
    expect(screen.getByText("Content Gap Analysis")).toBeInTheDocument();
    // Loading skeleton pulse elements
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders gap summary cards with correct data", () => {
    setupQueries({
      "contentGaps_queries:getGapSummary": GAP_SUMMARY,
      "competitors:getCompetitors": COMPETITORS_LIST,
    });

    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    // totalGaps=47, highPriority=12
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    // competitorsAnalyzed=2
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("creates jobs for each active competitor when refresh clicked", async () => {
    const createJobMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(createJobMock as any);

    setupQueries({
      "contentGaps_queries:getGapSummary": GAP_SUMMARY,
      "competitors:getCompetitors": COMPETITORS_LIST,
    });

    const user = userEvent.setup();
    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    const refreshButton = screen.getByRole("button", { name: /Refresh Analysis/i });
    await user.click(refreshButton);

    // Should create a job for each of the 2 active competitors
    expect(createJobMock).toHaveBeenCalledTimes(2);
  });

  it("disables refresh button when no active competitors exist", () => {
    setupQueries({
      "contentGaps_queries:getGapSummary": GAP_SUMMARY,
      "competitors:getCompetitors": COMPETITORS_EMPTY,
    });

    renderWithProviders(<ContentGapSection domainId={DOMAIN_ID} />);

    const refreshButton = screen.getByRole("button", { name: /Refresh Analysis/i });
    expect(refreshButton).toBeDisabled();
  });
});
