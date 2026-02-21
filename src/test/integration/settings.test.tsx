/**
 * Integration tests for the Settings page.
 *
 * Verifies loading state, profile section, preferences, notifications,
 * API keys, members, plan & usage, limits, and tab navigation.
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
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
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

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

// Override the global next-intl mock to use real translations
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

import { useQuery, useMutation, useAction } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CURRENT_USER = {
  _id: "user_1",
  name: "Alex Test",
  email: "alex@test.com",
  role: "admin",
  joinedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
};

const USER_PREFERENCES = {
  language: "en",
  timezone: "Europe/Warsaw",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
};

const NOTIFICATION_PREFS = {
  dailyRankingReports: true,
  positionAlerts: true,
  keywordOpportunities: false,
  teamInvitations: true,
  systemUpdates: true,
  frequency: "daily",
};

const API_KEYS = [
  {
    _id: "key_1",
    name: "Production Key",
    key: "sk_...abc123",
    scopes: ["read", "write"],
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastUsedAt: Date.now() - 2 * 60 * 60 * 1000,
  },
];

const ORG = [
  {
    _id: "org_1",
    name: "Test Org",
    role: "admin",
    planId: "plan_pro",
    subscriptionStatus: "active",
    billingCycle: "monthly",
    subscriptionPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
];

const MEMBERS = [
  {
    _id: "member_1",
    userId: "user_1",
    user: { name: "Alex Test", email: "alex@test.com" },
    role: "owner",
    joinedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
  },
  {
    _id: "member_2",
    userId: "user_2",
    user: { name: "Jane Dev", email: "jane@test.com" },
    role: "admin",
    joinedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
];

const PLAN = {
  name: "Pro",
  key: "pro",
  modules: ["positioning", "backlinks", "competitors"],
  limits: {
    maxKeywords: 500,
    maxDomains: 10,
    maxProjects: 5,
    maxDomainsPerProject: 5,
    maxKeywordsPerDomain: 100,
  },
};

const USAGE_STATS = {
  keywords: { current: 120, limit: 500 },
  domains: { current: 3, limit: 10 },
  projects: { current: 2, limit: 5 },
  defaults: {
    maxDomainsPerProject: 5,
    maxKeywordsPerDomain: 100,
  },
};

const REFRESH_LIMITS = {
  organizationId: "org_1",
  refreshCooldownMinutes: 30,
  maxDailyRefreshes: 100,
  maxDailyRefreshesPerUser: 20,
  maxKeywordsPerBulkRefresh: 50,
};

const BRANDING = { branding: { logoUrl: null } };

// ---------------------------------------------------------------------------
// Query mock helper using function name strings
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

/** All queries populated for a fully-loaded settings page. */
function allQueriesLoaded() {
  return {
    "users:getCurrentUser": CURRENT_USER,
    "userSettings:getUserPreferences": USER_PREFERENCES,
    "userSettings:getNotificationPreferences": NOTIFICATION_PREFS,
    "users:getAPIKeys": API_KEYS,
    "organizations:getUserOrganizations": ORG,
    "organizations:getOrganizationMembers": MEMBERS,
    "plans:getPlan": PLAN,
    "plans:getDefaultPlan": null,
    "limits:getUsageStats": USAGE_STATS,
    "limits:getOrgRefreshLimits": REFRESH_LIMITS,
    "branding:getOrganizationBranding": BRANDING,
    "stripe:createCheckoutSession": null,
    "stripe:createBillingPortalSession": null,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let SettingsPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  vi.mocked(useAction).mockReturnValue(vi.fn() as any);
  localStorage.clear();

  const mod = await import("@/app/(dashboard)/settings/page");
  SettingsPage = mod.default;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Settings Page", () => {
  // 1. Loading state
  it("renders loading state when queries return undefined", () => {
    renderWithProviders(<SettingsPage />);

    // The page title should always render even during loading
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Profile tab is default, and ProfileSection returns LoadingState when currentUser is undefined
    const loadingStates = screen.getAllByTestId("loading-state");
    expect(loadingStates.length).toBeGreaterThanOrEqual(1);
  });

  // 2. Profile tab — renders name, email, role badge, joined date
  it("renders profile information with name, email, role, and joined date", () => {
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    // Profile section heading (h2 inside the section, not the tab)
    const heading = screen.getByRole("heading", { name: "Profile", level: 2 });
    expect(heading).toBeInTheDocument();

    // Name and email inputs should have current values
    const nameInput = screen.getByDisplayValue("Alex Test");
    expect(nameInput).toBeInTheDocument();

    const emailInput = screen.getByDisplayValue("alex@test.com");
    expect(emailInput).toBeInTheDocument();

    // Role badge
    expect(screen.getByText("admin")).toBeInTheDocument();

    // Joined date — rendered via t("joinedDate", { date: ... })
    const joinedText = screen.getByText((content) => content.startsWith("Joined"));
    expect(joinedText).toBeInTheDocument();
  });

  // 3. Profile tab save — clicking save calls updateProfile mutation
  it("calls updateProfile mutation when clicking Save changes", async () => {
    const user = userEvent.setup();
    const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(mockUpdateProfile as any);
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const saveButton = screen.getByRole("button", { name: /Save changes/i });
    await user.click(saveButton);

    expect(mockUpdateProfile).toHaveBeenCalled();
  });

  // 4. Preferences tab — renders theme/language/timezone/date format selects
  it("renders preferences selects when navigating to Preferences tab", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    // Two TabLists render (mobile + desktop); pick the first matching tab
    const preferencesTab = screen.getAllByRole("tab", { name: /Preferences/i })[0];
    await user.click(preferencesTab);

    // Section heading
    expect(screen.getByText("Customize your regional and display settings.")).toBeInTheDocument();

    // Select fields should be present — check labels
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByText("Date format")).toBeInTheDocument();
    expect(screen.getByText("Time format")).toBeInTheDocument();
  });

  // 5. Notifications tab — renders 5 toggles and frequency dropdown
  it("renders notification toggles and frequency select", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    // Navigate to Notifications tab
    const notifTab = screen.getAllByRole("tab", { name: /Notifications/i })[0];
    await user.click(notifTab);

    // Toggle labels
    expect(screen.getByText("Daily ranking reports")).toBeInTheDocument();
    expect(screen.getByText("Position alerts")).toBeInTheDocument();
    expect(screen.getByText("Keyword opportunities")).toBeInTheDocument();
    expect(screen.getByText("Team invitations")).toBeInTheDocument();
    expect(screen.getByText("System updates")).toBeInTheDocument();

    // Frequency label
    expect(screen.getByText("Notification frequency")).toBeInTheDocument();
  });

  // 6. API Keys tab — renders existing keys table with masked keys
  it("renders API keys table with key name and masked key", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    // Navigate to API Keys tab
    const apiTab = screen.getAllByRole("tab", { name: /API Keys/i })[0];
    await user.click(apiTab);

    // Key name
    expect(screen.getByText("Production Key")).toBeInTheDocument();

    // Masked key value
    expect(screen.getByText("sk_...abc123")).toBeInTheDocument();

    // Scope badges
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("write")).toBeInTheDocument();

    // Revoke button
    expect(screen.getByRole("button", { name: /Revoke/i })).toBeInTheDocument();
  });

  // 7. API Keys tab — generate key form is rendered with name input and scope checkboxes
  it("renders generate key form with name input and scope checkboxes", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const apiTab = screen.getAllByRole("tab", { name: /API Keys/i })[0];
    await user.click(apiTab);

    // Generate new API key form heading
    expect(screen.getByText("Generate new API key")).toBeInTheDocument();

    // Key name input placeholder
    expect(screen.getByPlaceholderText("e.g. Production API, CI/CD Pipeline")).toBeInTheDocument();

    // Scope checkboxes
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Write")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    // Generate button
    expect(screen.getByRole("button", { name: /Generate key/i })).toBeInTheDocument();
  });

  // 8. Members tab — renders members table with names, emails, roles
  it("renders members table with member names and emails", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    // Navigate to Members tab
    const membersTab = screen.getAllByRole("tab", { name: /Members/i })[0];
    await user.click(membersTab);

    // Section heading
    expect(screen.getByText("Organization Members")).toBeInTheDocument();

    // Member names
    expect(screen.getByText("Alex Test")).toBeInTheDocument();
    expect(screen.getByText("Jane Dev")).toBeInTheDocument();

    // Member emails
    expect(screen.getByText("alex@test.com")).toBeInTheDocument();
    expect(screen.getByText("jane@test.com")).toBeInTheDocument();
  });

  // 9. Members tab — invite form visible for admin
  it("renders invite member form for admin users", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const membersTab = screen.getAllByRole("tab", { name: /Members/i })[0];
    await user.click(membersTab);

    // Invite form heading
    expect(screen.getByText("Invite member")).toBeInTheDocument();

    // Email input placeholder
    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();

    // Invite button
    expect(screen.getByRole("button", { name: /Invite/i })).toBeInTheDocument();
  });

  // 10. Plan & Usage tab — renders plan name and usage bars
  it("renders plan name and usage stats on Plan & Usage tab", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const planTab = screen.getAllByRole("tab", { name: /Plan & Usage/i })[0];
    await user.click(planTab);

    // Plan section heading
    expect(screen.getByText("View your current plan, resource usage, and available features.")).toBeInTheDocument();

    // Usage labels
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Domains")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();

    // Usage numbers: current / limit
    expect(screen.getByText("120 / 500")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  // 11. Limits tab — renders 4 number inputs with current values
  it("renders limit inputs with current values on Limits tab", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const limitsTab = screen.getAllByRole("tab", { name: /Limits/i })[0];
    await user.click(limitsTab);

    // Section heading
    expect(screen.getByText("Refresh Limits")).toBeInTheDocument();

    // Labels for each limit field
    expect(screen.getByText("Cooldown between refreshes (minutes)")).toBeInTheDocument();
    expect(screen.getByText("Daily refresh limit (org-wide)")).toBeInTheDocument();
    expect(screen.getByText("Daily refresh limit (per user)")).toBeInTheDocument();
    expect(screen.getByText("Max keywords per bulk action")).toBeInTheDocument();

    // Number inputs with values
    const numberInputs = screen.getAllByRole("spinbutton");
    const values = numberInputs.map((input) => (input as HTMLInputElement).value);
    expect(values).toContain("30");
    expect(values).toContain("100");
    expect(values).toContain("20");
    expect(values).toContain("50");
  });

  // 12. Tab navigation — clicking tab labels switches visible content
  it("switches visible content when clicking different tabs", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    // Default tab is Profile — profile heading visible
    expect(screen.getByText("Manage your personal information and how others see you.")).toBeInTheDocument();

    // Switch to Notifications
    const notifTab = screen.getAllByRole("tab", { name: /Notifications/i })[0];
    await user.click(notifTab);

    // Profile description should no longer be visible
    expect(screen.queryByText("Manage your personal information and how others see you.")).not.toBeInTheDocument();

    // Notifications description visible
    expect(screen.getByText("Choose what you want to be notified about and how often.")).toBeInTheDocument();

    // Switch to Limits
    const limitsTab = screen.getAllByRole("tab", { name: /Limits/i })[0];
    await user.click(limitsTab);

    expect(screen.queryByText("Choose what you want to be notified about and how often.")).not.toBeInTheDocument();
    expect(screen.getByText("Refresh Limits")).toBeInTheDocument();
  });

  // 13. Branding tab — renders upload section
  it("renders branding section with upload button", async () => {
    const user = userEvent.setup();
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const brandingTab = screen.getAllByRole("tab", { name: /Branding/i })[0];
    await user.click(brandingTab);

    expect(screen.getByText("Company Logo")).toBeInTheDocument();
    expect(screen.getByText("No logo uploaded yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload logo/i })).toBeInTheDocument();
    expect(screen.getByText("PNG, JPG or SVG. Max 2MB.")).toBeInTheDocument();
  });

  // 14. Limits tab — save calls updateOrganizationLimits mutation
  it("calls updateOrganizationLimits when clicking Save limits", async () => {
    const user = userEvent.setup();
    const mockUpdateLimits = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(mockUpdateLimits as any);
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    const limitsTab = screen.getAllByRole("tab", { name: /Limits/i })[0];
    await user.click(limitsTab);

    const saveButton = screen.getByRole("button", { name: /Save limits/i });
    await user.click(saveButton);

    expect(mockUpdateLimits).toHaveBeenCalled();
  });

  // 15. Page title and description always render
  it("renders page header with title and description", () => {
    setupQueries(allQueriesLoaded());

    renderWithProviders(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Manage your account settings, preferences, and API access.")).toBeInTheDocument();
  });
});
