/**
 * Integration tests for Domains List and Projects List flow paths.
 * Tests search filtering, tag filtering, combined filters, sorting,
 * delete mutations, no-results states, and empty states.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { PROJECT_LIST } from "@/test/fixtures/projects";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/domains",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const ALL_PERMISSIONS = [
  "domains.create", "domains.edit", "domains.delete",
  "keywords.add", "keywords.refresh",
  "reports.create", "reports.share",
  "projects.create", "projects.edit", "projects.delete",
];

const ALL_MODULES = [
  "positioning", "backlinks", "seo_audit", "reports",
  "competitors", "ai_strategy", "forecasts", "link_building",
];

const permsMock = {
  permissions: ALL_PERMISSIONS,
  modules: ALL_MODULES,
  role: "admin",
  plan: { name: "Pro", key: "pro" },
  isLoading: false,
  can: (permission: string) => ALL_PERMISSIONS.includes(permission),
  hasModule: (module: string) => ALL_MODULES.includes(module),
};

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => permsMock,
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => permsMock,
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
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

vi.mock("@/components/application/modals/create-domain-dialog", () => ({
  CreateDomainDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/application/modals/create-project-dialog", () => ({
  CreateProjectDialog: () => <button data-testid="create-project-btn">Create Project</button>,
}));

vi.mock("@/components/application/modals/delete-confirmation-dialog", () => ({
  DeleteConfirmationDialog: ({
    children,
    onConfirm,
    title,
  }: {
    children: React.ReactNode;
    onConfirm: () => Promise<void>;
    title: string;
  }) => (
    <div data-testid="delete-dialog" data-title={title}>
      {children}
      <button data-testid="confirm-delete" onClick={() => onConfirm()}>
        Confirm Delete
      </button>
    </div>
  ),
}));

vi.mock("@/components/application/slideout-menus/project-details-slideout", () => ({
  ProjectDetailsSlideout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: (props: Record<string, unknown>) => (
    <span data-testid={`ez-icon-${props.name}`} />
  ),
}));

vi.mock("@/lib/countryFlags", () => ({
  getCountryFlag: (loc: string) => `[${loc}]`,
  getLanguageFlag: (lang: string) => `[${lang}]`,
}));

vi.mock("@/components/base/input/input", () => ({
  InputBase: ({ value, onChange, placeholder, ...rest }: any) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e: any) => onChange?.(e.target.value)}
      {...(rest["aria-label"] ? { "aria-label": rest["aria-label"] } : {})}
    />
  ),
  Input: ({ label, value, onChange, placeholder, ...rest }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e: any) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("motion/react", () => ({
  motion: new Proxy({}, { get: () => (props: Record<string, unknown>) => <div {...props} /> }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderWithProviders } from "@/test/helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupQueries(responses: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in responses) return responses[name];
    } catch {
      // ignore
    }
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Domain list fixtures (matching api.domains.list return shape)
// ---------------------------------------------------------------------------

const DOMAIN_A = {
  _id: "domain_a" as any,
  _creationTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
  domain: "example.com",
  projectId: "project_1" as any,
  project: { _id: "project_1", name: "Main Project" },
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  tags: ["ecommerce", "seo"],
  keywordCount: 45,
  settings: {
    refreshFrequency: "daily" as const,
    searchEngine: "google.pl",
    location: "Poland",
    language: "pl",
  },
  lastRefreshedAt: Date.now() - 2 * 60 * 60 * 1000,
  onboardingCompleted: true,
  onboardingDismissed: false,
};

const DOMAIN_B = {
  ...DOMAIN_A,
  _id: "domain_b" as any,
  domain: "blog.example.com",
  project: { _id: "project_2", name: "Blog Project" },
  tags: ["blog", "content"],
  keywordCount: 12,
};

const DOMAIN_C = {
  ...DOMAIN_A,
  _id: "domain_c" as any,
  domain: "shop.test.io",
  project: { _id: "project_3", name: "Shop Project" },
  tags: [],
  keywordCount: 0,
};

const DOMAIN_D = {
  ...DOMAIN_A,
  _id: "domain_d" as any,
  domain: "tagged-site.pl",
  project: { _id: "project_1", name: "Main Project" },
  tags: ["ecommerce", "priority"],
  keywordCount: 78,
};

const DOMAIN_LIST = [DOMAIN_A, DOMAIN_B, DOMAIN_C, DOMAIN_D];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let DomainsPage: React.ComponentType;
let ProjectsPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);

  const domainsMod = await import("@/app/(dashboard)/domains/page");
  DomainsPage = domainsMod.default;

  const projectsMod = await import("@/app/(dashboard)/projects/page");
  ProjectsPage = projectsMod.default;
});

// ===========================================================================
// Domains List Flows
// ===========================================================================

describe("Domains List Flows", () => {
  it("filters domains by domain name search", () => {
    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "blog" } });

    expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    expect(screen.queryByText("shop.test.io")).not.toBeInTheDocument();
    expect(screen.queryByText("tagged-site.pl")).not.toBeInTheDocument();
  });

  it("filters domains by project name search", () => {
    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Blog Project" } });

    expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    expect(screen.queryByText("example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("shop.test.io")).not.toBeInTheDocument();
  });

  it("filters domains by clicking a tag filter", async () => {
    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);
    const user = userEvent.setup();

    // Click the "blog" tag in the filter section
    const blogTagButtons = screen.getAllByText("blog");
    // The tag button in the filter area (not in the table)
    const tagFilterButton = blogTagButtons[0].closest("button");
    expect(tagFilterButton).toBeTruthy();
    await user.click(tagFilterButton!);

    // Only domain_b has the "blog" tag
    expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    // Domains without the "blog" tag should be hidden
    expect(screen.queryByText("shop.test.io")).not.toBeInTheDocument();
  });

  it("applies tag and search filters together", async () => {
    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);
    const user = userEvent.setup();

    // First click the "ecommerce" tag (DOMAIN_A and DOMAIN_D have it)
    const ecommerceButtons = screen.getAllByText("ecommerce");
    const tagButton = ecommerceButtons[0].closest("button");
    await user.click(tagButton!);

    // Both ecommerce domains should be visible
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("tagged-site.pl")).toBeInTheDocument();

    // Now also search for "tagged"
    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "tagged" } });

    // Only DOMAIN_D matches both ecommerce tag + "tagged" search
    expect(screen.getByText("tagged-site.pl")).toBeInTheDocument();
    expect(screen.queryByText("example.com")).not.toBeInTheDocument();
  });

  it("sorts by keyword count when column header clicked", async () => {
    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);
    const user = userEvent.setup();

    // Click the keyword count column header to sort
    const keywordHeader = screen.getByText("colKeywords");
    await user.click(keywordHeader);

    // After sorting ascending, the order should be: 0, 12, 45, 78
    const cells = screen.getAllByText(/^\d+$/).map(el => el.textContent);
    // Verify ascending order is present
    const numericCells = cells.map(Number).filter(n => [0, 12, 45, 78].includes(n));
    expect(numericCells).toEqual([0, 12, 45, 78]);
  });

  it("calls remove mutation when domain delete is confirmed", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(deleteFn as any);

    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);
    const user = userEvent.setup();

    // Find all confirm-delete buttons (one per domain row)
    const confirmButtons = screen.getAllByTestId("confirm-delete");
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(confirmButtons[0]);

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalled();
    });
  });

  it("shows no results message when search matches nothing", () => {
    setupQueries({ "domains:list": DOMAIN_LIST });
    renderWithProviders(<DomainsPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent-domain-xyz" } });

    expect(screen.getByText("noDomainsMatch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "clearSearch" })).toBeInTheDocument();
  });

  it("shows empty state with add domain button when no domains exist", () => {
    setupQueries({ "domains:list": [] });
    renderWithProviders(<DomainsPage />);

    expect(screen.getByText("noDomains")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "addDomain" })).toBeInTheDocument();
  });
});

// ===========================================================================
// Projects List Flows
// ===========================================================================

describe("Projects List Flows", () => {
  it("filters projects by name search", async () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    const { container } = renderWithProviders(<ProjectsPage />);
    const user = userEvent.setup();

    const searchInput = screen.getByTestId("search-input");
    await user.type(searchInput, "Blog");

    expect(screen.getByText("Blog Project")).toBeInTheDocument();
    expect(screen.queryByText("Main Project")).not.toBeInTheDocument();
  });

  it("sorts projects by name when column header clicked", async () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    renderWithProviders(<ProjectsPage />);
    const user = userEvent.setup();

    // Default sort is name ascending, so "Blog Project" comes before "Main Project"
    const projectNames = screen.getAllByText(/Project/).map(el => el.textContent);
    const blogIdx = projectNames.indexOf("Blog Project");
    const mainIdx = projectNames.indexOf("Main Project");
    expect(blogIdx).toBeLessThan(mainIdx);

    // Click name header to reverse sort
    const nameHeader = screen.getByText("columnProject");
    await user.click(nameHeader);

    // After descending sort, "Main Project" should come first
    const updatedNames = screen.getAllByText(/Project/).map(el => el.textContent);
    const newMainIdx = updatedNames.indexOf("Main Project");
    const newBlogIdx = updatedNames.indexOf("Blog Project");
    expect(newMainIdx).toBeLessThan(newBlogIdx);
  });

  it("calls remove mutation when project delete confirmed", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(deleteFn as any);

    setupQueries({ "projects:list": PROJECT_LIST });
    renderWithProviders(<ProjectsPage />);
    const user = userEvent.setup();

    const confirmButtons = screen.getAllByTestId("confirm-delete");
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(confirmButtons[0]);

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalled();
    });
  });

  it("shows empty state with create button when no projects exist", () => {
    setupQueries({ "projects:list": [] });
    renderWithProviders(<ProjectsPage />);

    expect(screen.getByText("noProjectsFound")).toBeInTheDocument();
    expect(screen.getByText("noProjectsDescription")).toBeInTheDocument();
    expect(screen.getByTestId("create-project-btn")).toBeInTheDocument();
  });
});
