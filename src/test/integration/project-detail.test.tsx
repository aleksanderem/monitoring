/**
 * Integration tests for the Project Detail page.
 *
 * Tests page-level behavior: loading state, not-found state, header rendering,
 * tab rendering, tab content components, settings form with limit inputs,
 * and save mutation. All tab content components are mocked to isolate page structure.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

const mockRouterPush = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/projects/project_1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ projectId: "project_1" }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit", "domains.delete", "keywords.add", "keywords.refresh"],
    modules: ["positioning", "backlinks", "seo_audit", "competitors", "ai_strategy", "link_building"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: ["domains.create", "domains.edit", "domains.delete", "keywords.add", "keywords.refresh"],
    modules: ["positioning", "backlinks", "seo_audit", "competitors", "ai_strategy", "link_building"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));

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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock ALL tab content components to prevent deep rendering
// ---------------------------------------------------------------------------

vi.mock("@/components/project/sections/ProjectOverviewSection", () => ({
  ProjectOverviewSection: () => <div data-testid="project-overview">Overview</div>,
}));

vi.mock("@/components/project/sections/ProjectPositionMonitoring", () => ({
  ProjectPositionMonitoring: () => <div data-testid="project-position-monitoring">PositionMonitoring</div>,
}));

vi.mock("@/components/project/sections/ProjectBacklinksOverview", () => ({
  ProjectBacklinksOverview: () => <div data-testid="project-backlinks-overview">BacklinksOverview</div>,
}));

vi.mock("@/components/project/tables/ProjectDomainsTable", () => ({
  ProjectDomainsTable: () => <div data-testid="project-domains-table">DomainsTable</div>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import ProjectDetailPage from "@/app/(dashboard)/projects/[projectId]/page";
import { PROJECT_ACTIVE } from "@/test/fixtures/projects";

// ---------------------------------------------------------------------------
// Query mock helper using getFunctionName for stable keys
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

const PROJECT_DETAIL = {
  ...PROJECT_ACTIVE,
  limits: { maxDomains: 5, maxKeywordsPerDomain: 100, maxDailyRefreshes: 10 },
};

function baseQueries(overrides: QueryMap = {}): QueryMap {
  return {
    "projects:getProject": PROJECT_DETAIL,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  mockRouterPush.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectDetailPage", () => {
  // 1. Loading state
  it("shows loading state when project query returns undefined", () => {
    renderWithProviders(<ProjectDetailPage />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  // 2. Not found state
  it("shows not-found state when project query returns null", () => {
    setupQueryMock(baseQueries({ "projects:getProject": null }));
    renderWithProviders(<ProjectDetailPage />);

    expect(screen.getByText("Project not found")).toBeInTheDocument();
    expect(screen.getByText("Back to projects")).toBeInTheDocument();
  });

  // 3. Not found back link navigates to /projects
  it("navigates to /projects when clicking back link in not-found state", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries({ "projects:getProject": null }));
    renderWithProviders(<ProjectDetailPage />);

    await user.click(screen.getByText("Back to projects"));
    expect(mockRouterPush).toHaveBeenCalledWith("/projects");
  });

  // 4. Header renders project name
  it("renders the project name in the header", () => {
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Main Project");
  });

  // 5. Header renders domain/keyword summary
  it("renders domain and keyword summary in the header", () => {
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    // domainKeywordSummary: "{domains} domains · {keywords} keywords"
    expect(screen.getByText(/3 domains/)).toBeInTheDocument();
    expect(screen.getByText(/120 keywords/)).toBeInTheDocument();
  });

  // 6. Back button navigates to /projects
  it("navigates to /projects when clicking the back arrow button", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    // The back arrow is the first button in the header
    const buttons = screen.getAllByRole("button");
    // The first button is the arrow-left back button
    await user.click(buttons[0]);
    expect(mockRouterPush).toHaveBeenCalledWith("/projects");
  });

  // 7. All 5 tabs render
  it("renders all 4 tabs: Overview, Keywords, Backlinks, Settings", () => {
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    expect(screen.getByRole("tab", { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Keywords/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Backlinks/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Settings/ })).toBeInTheDocument();
  });

  // 8. Overview tab (default) shows overview and domains table components
  it("shows ProjectOverviewSection and ProjectDomainsTable in the default Overview tab", () => {
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    expect(screen.getByTestId("project-overview")).toBeInTheDocument();
    expect(screen.getByTestId("project-domains-table")).toBeInTheDocument();
  });

  // 9. Clicking Keywords tab shows position monitoring component
  it("shows ProjectPositionMonitoring when Keywords tab is clicked", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    await user.click(screen.getByRole("tab", { name: /Keywords/ }));
    expect(screen.getByTestId("project-position-monitoring")).toBeInTheDocument();
  });

  // 10. Clicking Backlinks tab shows backlinks overview component
  it("shows ProjectBacklinksOverview when Backlinks tab is clicked", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    await user.click(screen.getByRole("tab", { name: /Backlinks/ }));
    expect(screen.getByTestId("project-backlinks-overview")).toBeInTheDocument();
  });

  // 11. Settings tab shows limit inputs with current values
  it("shows limit inputs with current values in the Settings tab", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    await user.click(screen.getByRole("tab", { name: /Settings/ }));

    // Verify the settings section title
    expect(screen.getByText("Project Limits")).toBeInTheDocument();

    // Verify the three input fields exist with correct values
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toHaveValue(5);   // maxDomains
    expect(inputs[1]).toHaveValue(100); // maxKeywordsPerDomain
    expect(inputs[2]).toHaveValue(10);  // maxDailyRefreshes
  });

  // 12. Changing limit input updates the form value
  it("updates form value when changing a limit input", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    await user.click(screen.getByRole("tab", { name: /Settings/ }));

    const inputs = screen.getAllByRole("spinbutton");
    // Clear and type a new value for maxDomains
    await user.clear(inputs[0]);
    await user.type(inputs[0], "20");

    expect(inputs[0]).toHaveValue(20);
  });

  // 13. Settings save button calls updateProjectLimits mutation
  it("calls updateProjectLimits mutation when save button is clicked", async () => {
    const mockUpdateLimits = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(mockUpdateLimits as any);

    const user = userEvent.setup();
    setupQueryMock(baseQueries());
    renderWithProviders(<ProjectDetailPage />);

    await user.click(screen.getByRole("tab", { name: /Settings/ }));

    const saveButton = screen.getByRole("button", { name: /Save limits/i });
    await user.click(saveButton);

    expect(mockUpdateLimits).toHaveBeenCalledWith({
      projectId: "project_1",
      limits: {
        maxDomains: 5,
        maxKeywordsPerDomain: 100,
        maxDailyRefreshes: 10,
      },
    });
  });
});
