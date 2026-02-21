/**
 * Integration tests for the Domains list page.
 * Verifies loading, empty, populated, search, and delete-dialog states.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before any imports that use them)
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
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

// Override the global next-intl mock to include NextIntlClientProvider
// (the global setup.ts mock doesn't export it, but renderWithProviders needs it)
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

// Stub the CreateDomainDialog to just render children (the trigger button)
vi.mock("@/components/application/modals/create-domain-dialog", () => ({
  CreateDomainDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub EzIcon
vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: (props: Record<string, unknown>) => (
    <span data-testid={`ez-icon-${props.name}`} />
  ),
}));

// Stub countryFlags helpers
vi.mock("@/lib/countryFlags", () => ({
  getCountryFlag: (loc: string) => `[${loc}]`,
  getLanguageFlag: (lang: string) => `[${lang}]`,
}));

// Mock InputBase to use a plain input that calls onChange with a string value
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from "react";
import { useQuery } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import DomainsPage from "@/app/(dashboard)/domains/page";

// ---------------------------------------------------------------------------
// Helper: configure useQuery to return data for domains.list
// Uses getFunctionName from convex/server to match references since anyApi
// creates new Proxy objects each time a property is accessed.
// ---------------------------------------------------------------------------

function mockDomainsQuery(data: unknown) {
  const { getFunctionName } = require("convex/server");
  vi.mocked(useQuery).mockImplementation(((ref: unknown) => {
    try {
      const name = getFunctionName(ref);
      if (name === "domains:list") return data;
    } catch {
      // not a convex function ref
    }
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Test-local fixtures matching the actual api.domains.list return shape
// (project is a full object, not flat projectName)
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

const DOMAIN_LIST = [DOMAIN_A, DOMAIN_B, DOMAIN_C];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DomainsPage", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  });

  // 1. Loading state
  it("renders loading skeleton when query returns undefined", () => {
    // useQuery returns undefined by default (loading)
    renderWithProviders(<DomainsPage />);
    // The real LoadingState renders skeleton divs with animate-pulse
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  // 2. Empty state
  it("renders empty state with Add Domain button when no domains exist", () => {
    mockDomainsQuery([]);
    renderWithProviders(<DomainsPage />);

    // Translation keys are returned as-is by the passthrough mock
    expect(screen.getByText("noDomains")).toBeInTheDocument();
    expect(screen.getByText("noDomainsDescription")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "addDomain" })).toBeInTheDocument();
  });

  // 3. With domains — table renders domain names
  it("renders table with correct domain names when domains exist", () => {
    mockDomainsQuery(DOMAIN_LIST);
    renderWithProviders(<DomainsPage />);

    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    expect(screen.getByText("shop.test.io")).toBeInTheDocument();
  });

  // 4. Search filtering — only matching domains shown
  it("filters domains when searching by domain name", () => {
    mockDomainsQuery(DOMAIN_LIST);
    renderWithProviders(<DomainsPage />);

    const searchInput = screen.getByPlaceholderText("searchDomains");
    fireEvent.change(searchInput, { target: { value: "blog" } });

    expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    expect(screen.queryByText("shop.test.io")).not.toBeInTheDocument();
  });

  // 5. Search no results — gibberish search
  it("shows no results state when search matches nothing", () => {
    mockDomainsQuery(DOMAIN_LIST);
    renderWithProviders(<DomainsPage />);

    const searchInput = screen.getByPlaceholderText("searchDomains");
    fireEvent.change(searchInput, { target: { value: "zzzznonexistent" } });

    expect(screen.getByText("noDomainsMatch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "clearSearch" })).toBeInTheDocument();
  });

  // 6. Domain row shows correct data
  it("displays domain name, project name, keyword count, and tags", () => {
    mockDomainsQuery(DOMAIN_LIST);
    renderWithProviders(<DomainsPage />);

    // Domain A: example.com
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Main Project")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    // Tags appear both in filter section and table rows, so use getAllByText
    expect(screen.getAllByText("ecommerce").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("seo").length).toBeGreaterThanOrEqual(1);

    // Domain B
    expect(screen.getByText("Blog Project")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("blog").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("content").length).toBeGreaterThanOrEqual(1);
  });

  // 7. Delete button opens confirmation dialog
  it("opens delete confirmation dialog when delete button is clicked", async () => {
    const user = userEvent.setup();
    mockDomainsQuery(DOMAIN_LIST);
    renderWithProviders(<DomainsPage />);

    // Find all delete buttons (one per domain row) via the icon test id
    const deleteButtons = screen.getAllByTestId("icon-Trash01");
    expect(deleteButtons.length).toBe(DOMAIN_LIST.length);

    // Click the first delete button (its parent is the ButtonUtility)
    const firstDeleteBtn = deleteButtons[0].closest("button")!;
    await user.click(firstDeleteBtn);

    // The confirmation dialog should appear with the domain name (translation key with param)
    expect(
      await screen.findByText(/deleteDomainTitle/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("deleteDomainDescription")
    ).toBeInTheDocument();
  });
});
