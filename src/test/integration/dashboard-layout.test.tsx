/**
 * Integration tests for the Dashboard Layout.
 *
 * Verifies loading state, authentication redirect, sidebar navigation,
 * top bar, global job status, over-limit alerts, and error boundary wrapping.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

let mockAuth = { isAuthenticated: true, isLoading: false };

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => mockAuth,
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  })),
}));

const mockPush = vi.fn();
let currentPathname = "/domains";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  usePermissionsContext: () => ({
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock(
  "@/components/application/app-navigation/sidebar-navigation/sidebar-section-dividers",
  () => ({
    SidebarNavigationSectionDividers: ({
      items,
      activeUrl,
    }: {
      items: any[];
      activeUrl: string;
    }) => (
      <nav data-testid="sidebar" data-active-url={activeUrl}>
        {items
          ?.filter((i: any) => !i.divider)
          .map((item: any) => (
            <a
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.href}`}
            >
              {item.label}
            </a>
          ))}
      </nav>
    ),
  })
);

vi.mock("@/components/application/app-navigation/TopBar", () => ({
  TopBar: () => <div data-testid="topbar">TopBar</div>,
}));

vi.mock("@/components/domain/job-status/GlobalJobStatus", () => ({
  GlobalJobStatus: () => <div data-testid="global-job-status" />,
}));

vi.mock("@/components/domain/job-status/JobCompletionNotifier", () => ({
  JobCompletionNotifier: () => null,
}));

vi.mock("@/components/domain/SidebarUsageIndicator", () => ({
  SidebarUsageIndicator: () => <div data-testid="usage-indicator" />,
}));

vi.mock("@/components/application/alerts/alerts", () => ({
  AlertFullWidth: ({
    title,
    description,
    onConfirm,
    confirmLabel,
  }: {
    title: string;
    description: string;
    onConfirm?: () => void;
    confirmLabel?: string;
  }) => (
    <div data-testid="alert-full-width" data-title={title}>
      <span>{description}</span>
      {confirmLabel && onConfirm && (
        <button onClick={onConfirm}>{confirmLabel}</button>
      )}
    </div>
  ),
}));

vi.mock("@/components/admin/ImpersonationBanner", () => ({
  ImpersonationBanner: () => null,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({
    children,
    label,
  }: {
    children: React.ReactNode;
    label?: string;
  }) => <div data-testid="error-boundary" data-label={label}>{children}</div>,
}));

vi.mock("@untitledui/icons", () => ({
  Calendar: () => <span>CalendarIcon</span>,
  Folder: () => <span>FolderIcon</span>,
  Globe01: () => <span>GlobeIcon</span>,
  LayersThree01: () => <span>LayersIcon</span>,
  Settings01: () => <span>SettingsIcon</span>,
}));

// Override global next-intl mock to use real translations
vi.mock("next-intl", async () => {
  const actual =
    await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useAction } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORGS = [{ _id: "org_1" as any }];

const USAGE_NORMAL = {
  keywords: { current: 50, limit: 100 },
  domains: { current: 3, limit: 10 },
  projects: { current: 2, limit: 5 },
};

const USAGE_OVER_LIMIT = {
  keywords: { current: 150, limit: 100 },
  domains: { current: 3, limit: 10 },
  projects: { current: 2, limit: 5 },
};

// ---------------------------------------------------------------------------
// Query mock helper
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueries(responses: QueryMap) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in responses) return responses[name];
    } catch {
      // not a valid function reference
    }
    return undefined;
  }) as any);
}

function defaultQueries(usageOverride?: QueryMap) {
  return {
    "organizations:getUserOrganizations": ORGS,
    "limits:getUsageStats": USAGE_NORMAL,
    ...usageOverride,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let DashboardLayout: React.ComponentType<{ children: React.ReactNode }>;

beforeEach(async () => {
  mockAuth = { isAuthenticated: true, isLoading: false };
  currentPathname = "/domains";
  mockPush.mockClear();
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  vi.mocked(useAction).mockReturnValue(vi.fn() as any);
  localStorage.clear();

  const mod = await import("@/app/(dashboard)/layout");
  DashboardLayout = mod.default;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dashboard Layout", () => {
  // 1. Loading state shows spinner
  it("shows a loading spinner when isLoading is true", () => {
    mockAuth = { isAuthenticated: false, isLoading: true };

    renderWithProviders(
      <DashboardLayout>
        <div data-testid="page-content">Test Content</div>
      </DashboardLayout>
    );

    // The loading text from tc("loading")
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Children should NOT be rendered during loading
    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
  });

  // 2. Unauthenticated state redirects to /login
  it("redirects to /login when not authenticated", () => {
    mockAuth = { isAuthenticated: false, isLoading: false };

    renderWithProviders(
      <DashboardLayout>
        <div data-testid="page-content">Test Content</div>
      </DashboardLayout>
    );

    expect(mockPush).toHaveBeenCalledWith("/login");
    // Children should NOT be rendered when unauthenticated
    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
  });

  // 3. Authenticated state renders children
  it("renders children content when authenticated", () => {
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div data-testid="page-content">Test Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  // 4. Sidebar renders with all 5 navigation items
  it("renders sidebar with all 5 navigation items", () => {
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toBeInTheDocument();

    // Check all 5 nav items
    expect(screen.getByTestId("nav-/projects")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();

    expect(screen.getByTestId("nav-/domains")).toBeInTheDocument();
    expect(screen.getByText("Domains")).toBeInTheDocument();

    expect(screen.getByTestId("nav-/jobs")).toBeInTheDocument();
    expect(screen.getByText("Jobs")).toBeInTheDocument();

    expect(screen.getByTestId("nav-/calendar")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();

    expect(screen.getByTestId("nav-/settings")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  // 5. TopBar renders
  it("renders the TopBar component", () => {
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId("topbar")).toBeInTheDocument();
  });

  // 6. GlobalJobStatus renders
  it("renders the GlobalJobStatus component", () => {
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId("global-job-status")).toBeInTheDocument();
  });

  // 7. Over-limit alert shows when usage exceeds limits
  it("shows over-limit alert when usage exceeds plan limits", () => {
    setupQueries(
      defaultQueries({ "limits:getUsageStats": USAGE_OVER_LIMIT })
    );

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const alert = screen.getByTestId("alert-full-width");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("data-title", "Plan limit exceeded");
    expect(
      screen.getByText(
        "You've exceeded your plan limits. Upgrade your plan or remove excess resources to continue adding new items."
      )
    ).toBeInTheDocument();
  });

  // 8. Over-limit alert NOT shown when usage is within limits
  it("does not show over-limit alert when usage is within limits", () => {
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.queryByTestId("alert-full-width")).not.toBeInTheDocument();
  });

  // 9. Over-limit alert upgrade button navigates to /pricing
  it("navigates to /pricing when clicking the upgrade button", async () => {
    const user = userEvent.setup();
    setupQueries(
      defaultQueries({ "limits:getUsageStats": USAGE_OVER_LIMIT })
    );

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const upgradeButton = screen.getByRole("button", {
      name: /Upgrade plan/i,
    });
    await user.click(upgradeButton);

    expect(mockPush).toHaveBeenCalledWith("/pricing");
  });

  // 10. Children are wrapped in ErrorBoundary
  it("wraps children in an ErrorBoundary with label 'Page'", () => {
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div data-testid="page-content">Test Content</div>
      </DashboardLayout>
    );

    const errorBoundary = screen.getByTestId("error-boundary");
    expect(errorBoundary).toBeInTheDocument();
    expect(errorBoundary).toHaveAttribute("data-label", "Page");

    // Children should be inside the error boundary
    const pageContent = screen.getByTestId("page-content");
    expect(errorBoundary).toContainElement(pageContent);
  });

  // 11. Layout passes correct activeUrl to sidebar
  it("passes the current pathname as activeUrl to the sidebar", () => {
    currentPathname = "/projects";
    setupQueries(defaultQueries());

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveAttribute("data-active-url", "/projects");
  });

  // 12. No alert when usage data is still loading (undefined)
  it("does not show over-limit alert when usage data is not yet loaded", () => {
    setupQueries({
      "organizations:getUserOrganizations": ORGS,
      // usage not provided — returns undefined
    });

    renderWithProviders(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.queryByTestId("alert-full-width")).not.toBeInTheDocument();
  });
});
