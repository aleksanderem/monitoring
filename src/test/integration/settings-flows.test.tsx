/**
 * Integration tests for Settings page data FLOW paths.
 *
 * Verifies deeper mutation/action interactions, tab-specific data loading,
 * and cross-cutting concerns like role-based visibility.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

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

vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));
vi.mock("@/hooks/use-breakpoint", () => ({ useBreakpoint: () => true }));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({ GlowingEffect: () => null }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));

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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockSignIn = vi.fn().mockResolvedValue(undefined);
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useAction } from "convex/react";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import {
  USER_PREFERENCES,
  NOTIFICATION_PREFERENCES_ALL_ON,
  NOTIFICATION_PREFERENCES_ALL_OFF,
  API_KEYS,
  API_KEYS_EMPTY,
  BRANDING_WITH_LOGO,
  BRANDING_NO_LOGO,
  MEMBERS,
  PLAN_FREE,
  PLAN_PRO,
  USAGE_STATS_LOW,
  USAGE_STATS_NEAR_LIMIT,
  USAGE_STATS_FREE,
  ORG_REFRESH_LIMITS,
  USER_ORGANIZATIONS,
} from "@/test/fixtures/settings";
import { CURRENT_USER } from "@/test/fixtures/user";

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

/** Mutation map that tracks calls per function name. */
function setupMutationMap() {
  const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as any);
  return mutationMap;
}

function setupActionMap() {
  const actionMap = new Map<string, ReturnType<typeof vi.fn>>();
  vi.mocked(useAction).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!actionMap.has(key)) actionMap.set(key, vi.fn().mockResolvedValue("https://checkout.stripe.com/test"));
    return actionMap.get(key)!;
  }) as any);
  return actionMap;
}

/** Base queries for a fully-loaded settings page. */
function baseQueries(overrides: QueryMap = {}): QueryMap {
  return {
    "users:getCurrentUser": { ...CURRENT_USER, joinedAt: Date.now() - 90 * 24 * 60 * 60 * 1000 },
    "auth:getCurrentUser": { ...CURRENT_USER, joinedAt: Date.now() - 90 * 24 * 60 * 60 * 1000 },
    "userSettings:getUserPreferences": USER_PREFERENCES,
    "userSettings:getNotificationPreferences": NOTIFICATION_PREFERENCES_ALL_ON,
    "users:getAPIKeys": API_KEYS,
    "organizations:getUserOrganizations": [{
      _id: "org_1",
      name: "Test Organization",
      role: "admin",
      planId: "plan_pro",
      subscriptionStatus: "active",
      billingCycle: "monthly",
      subscriptionPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    }],
    "organizations:getOrganizationMembers": MEMBERS,
    "plans:getPlan": PLAN_PRO,
    "plans:getDefaultPlan": null,
    "limits:getUsageStats": USAGE_STATS_LOW,
    "limits:getOrgRefreshLimits": ORG_REFRESH_LIMITS,
    "branding:getOrganizationBranding": BRANDING_NO_LOGO,
    ...overrides,
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
  mockSignIn.mockClear();
  mockSignIn.mockResolvedValue(undefined);
  localStorage.clear();

  const mod = await import("@/app/(dashboard)/settings/page");
  SettingsPage = mod.default;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Settings Flows", () => {
  // ── Profile Tab ──────────────────────────────────────────────────────

  describe("Profile Tab", () => {
    it("populates name and email inputs from currentUser query data", () => {
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    });

    it("calls updateProfile mutation with form values on Save", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries(baseQueries());

      renderWithProviders(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /Save changes/i });
      await user.click(saveButton);

      const updateProfile = mutationMap.get("users:updateProfile");
      expect(updateProfile).toBeDefined();
      expect(updateProfile).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
      });
    });
  });

  // ── Preferences Tab ──────────────────────────────────────────────────

  describe("Preferences Tab", () => {
    it("loads preference values into select fields", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const prefsTab = screen.getAllByRole("tab", { name: /Preferences/i })[0];
      await user.click(prefsTab);

      // Language select should have "en" selected (showing "English")
      const selects = screen.getAllByRole("combobox");
      const languageSelect = selects.find(
        (s) => (s as HTMLSelectElement).value === "en"
      );
      expect(languageSelect).toBeDefined();
    });

    it("calls updateUserPreferences mutation on Save", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const prefsTab = screen.getAllByRole("tab", { name: /Preferences/i })[0];
      await user.click(prefsTab);

      const saveButton = screen.getByRole("button", { name: /Save preferences/i });
      await user.click(saveButton);

      const updatePrefs = mutationMap.get("userSettings:updateUserPreferences");
      expect(updatePrefs).toBeDefined();
      expect(updatePrefs).toHaveBeenCalledWith({
        language: "en",
        timezone: "Europe/Warsaw",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
      });
    });
  });

  // ── Notifications Tab ────────────────────────────────────────────────

  describe("Notifications Tab", () => {
    it("renders toggle labels matching notification preference data", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({
        "userSettings:getNotificationPreferences": NOTIFICATION_PREFERENCES_ALL_OFF,
      }));
      renderWithProviders(<SettingsPage />);

      const notifTab = screen.getAllByRole("tab", { name: /Notifications/i })[0];
      await user.click(notifTab);

      expect(screen.getByText("Daily ranking reports")).toBeInTheDocument();
      expect(screen.getByText("Position alerts")).toBeInTheDocument();
      expect(screen.getByText("Keyword opportunities")).toBeInTheDocument();
      expect(screen.getByText("Team invitations")).toBeInTheDocument();
      expect(screen.getByText("System updates")).toBeInTheDocument();
    });

    it("calls updateNotificationPreferences mutation on Save", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const notifTab = screen.getAllByRole("tab", { name: /Notifications/i })[0];
      await user.click(notifTab);

      const saveButton = screen.getByRole("button", { name: /Save notifications/i });
      await user.click(saveButton);

      const updateNotifs = mutationMap.get("userSettings:updateNotificationPreferences");
      expect(updateNotifs).toBeDefined();
      expect(updateNotifs).toHaveBeenCalled();
    });
  });

  // ── API Keys Tab ─────────────────────────────────────────────────────

  describe("API Keys Tab", () => {
    it("shows empty state when no API keys exist", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({ "users:getAPIKeys": API_KEYS_EMPTY }));
      renderWithProviders(<SettingsPage />);

      const apiTab = screen.getAllByRole("tab", { name: /API Keys/i })[0];
      await user.click(apiTab);

      expect(screen.getByText(/No API keys yet/)).toBeInTheDocument();
    });

    it("renders keys table with masked keys and scope badges", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const apiTab = screen.getAllByRole("tab", { name: /API Keys/i })[0];
      await user.click(apiTab);

      expect(screen.getByText("Production Key")).toBeInTheDocument();
      expect(screen.getByText("Development Key")).toBeInTheDocument();
      expect(screen.getByText("sk_prod_abc1...xyz9")).toBeInTheDocument();
      // read:keywords appears on both keys, so use getAllByText
      const readBadges = screen.getAllByText("read:keywords");
      expect(readBadges.length).toBeGreaterThanOrEqual(1);
    });

    it("calls revokeAPIKey mutation when clicking Revoke", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const apiTab = screen.getAllByRole("tab", { name: /API Keys/i })[0];
      await user.click(apiTab);

      const revokeButtons = screen.getAllByRole("button", { name: /Revoke/i });
      await user.click(revokeButtons[0]);

      const revokeKey = mutationMap.get("users:revokeAPIKey");
      expect(revokeKey).toBeDefined();
      expect(revokeKey).toHaveBeenCalledWith({ keyId: "apikey_1" });
    });
  });

  // ── Branding Tab ─────────────────────────────────────────────────────

  describe("Branding Tab", () => {
    it("shows upload button when no logo is set", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({ "branding:getOrganizationBranding": BRANDING_NO_LOGO }));
      renderWithProviders(<SettingsPage />);

      const brandingTab = screen.getAllByRole("tab", { name: /Branding/i })[0];
      await user.click(brandingTab);

      expect(screen.getByText("No logo uploaded yet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Upload logo/i })).toBeInTheDocument();
    });

    it("shows image element when logo URL exists", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({ "branding:getOrganizationBranding": BRANDING_WITH_LOGO }));
      renderWithProviders(<SettingsPage />);

      const brandingTab = screen.getAllByRole("tab", { name: /Branding/i })[0];
      await user.click(brandingTab);

      const logo = screen.getByAltText("Company logo");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
    });
  });

  // ── Members Tab ──────────────────────────────────────────────────────

  describe("Members Tab", () => {
    it("renders invite form for admin users", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const membersTab = screen.getAllByRole("tab", { name: /Members/i })[0];
      await user.click(membersTab);

      expect(screen.getByText("Invite member")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    });

    it("hides invite form for non-admin users", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({
        "organizations:getUserOrganizations": [{
          _id: "org_1",
          name: "Test Organization",
          role: "member",
          planId: "plan_pro",
          subscriptionStatus: "active",
          billingCycle: "monthly",
          subscriptionPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        }],
      }));
      renderWithProviders(<SettingsPage />);

      const membersTab = screen.getAllByRole("tab", { name: /Members/i })[0];
      await user.click(membersTab);

      expect(screen.queryByText("Invite member")).not.toBeInTheDocument();
    });

    it("does not show Remove button for owner members", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const membersTab = screen.getAllByRole("tab", { name: /Members/i })[0];
      await user.click(membersTab);

      // Owner User row should not have a Remove button
      // But Admin User and Regular Member should
      const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
      // MEMBERS has 3 members: owner, admin, member. Only admin and member should have Remove
      expect(removeButtons).toHaveLength(2);
    });
  });

  // ── Plan & Usage Tab ─────────────────────────────────────────────────

  describe("Plan & Usage Tab", () => {
    it("displays free plan info for free plan users", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({
        "organizations:getUserOrganizations": [{
          _id: "org_1",
          name: "Test Organization",
          role: "admin",
          planId: undefined,
          subscriptionStatus: undefined,
          billingCycle: undefined,
          subscriptionPeriodEnd: undefined,
        }],
        "plans:getPlan": undefined,
        "plans:getDefaultPlan": PLAN_FREE,
        "limits:getUsageStats": USAGE_STATS_FREE,
      }));
      renderWithProviders(<SettingsPage />);

      const planTab = screen.getAllByRole("tab", { name: /Plan & Usage/i })[0];
      await user.click(planTab);

      expect(screen.getByText("View your current plan, resource usage, and available features.")).toBeInTheDocument();
      // Usage numbers
      expect(screen.getByText("Keywords")).toBeInTheDocument();
    });

    it("shows usage bars with near-limit percentages", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries({
        "limits:getUsageStats": USAGE_STATS_NEAR_LIMIT,
      }));
      renderWithProviders(<SettingsPage />);

      const planTab = screen.getAllByRole("tab", { name: /Plan & Usage/i })[0];
      await user.click(planTab);

      // Near-limit values: 4200/5000 = 84%, 45/50 = 90%, 18/20 = 90%
      expect(screen.getByText("4200 / 5000")).toBeInTheDocument();
      expect(screen.getByText("45 / 50")).toBeInTheDocument();
      expect(screen.getByText("18 / 20")).toBeInTheDocument();
    });

    it("calls createCheckoutSession action on upgrade click", async () => {
      const user = userEvent.setup();
      const actionMap = setupActionMap();
      setupQueries(baseQueries({
        "organizations:getUserOrganizations": [{
          _id: "org_1",
          name: "Test Organization",
          role: "admin",
          planId: undefined,
          subscriptionStatus: undefined,
          billingCycle: undefined,
          subscriptionPeriodEnd: undefined,
        }],
        "plans:getPlan": undefined,
        "plans:getDefaultPlan": PLAN_FREE,
        "limits:getUsageStats": USAGE_STATS_FREE,
      }));
      renderWithProviders(<SettingsPage />);

      const planTab = screen.getAllByRole("tab", { name: /Plan & Usage/i })[0];
      await user.click(planTab);

      // Need to select the Pro plan first to reveal the Upgrade button
      const proRadio = screen.getByText("Pro");
      await user.click(proRadio);

      // Now the upgrade button should appear
      const upgradeButton = screen.getByRole("button", { name: /Upgrade/i });
      await user.click(upgradeButton);

      const createCheckout = actionMap.get("stripe:createCheckoutSession");
      expect(createCheckout).toBeDefined();
      expect(createCheckout).toHaveBeenCalledWith({ billingCycle: "monthly" });
    });
  });

  // ── Limits Tab ───────────────────────────────────────────────────────

  describe("Limits Tab", () => {
    it("populates limit inputs with saved values", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const limitsTab = screen.getAllByRole("tab", { name: /Limits/i })[0];
      await user.click(limitsTab);

      const numberInputs = screen.getAllByRole("spinbutton");
      const values = numberInputs.map((input) => (input as HTMLInputElement).value);
      expect(values).toContain("15");
      expect(values).toContain("100");
      expect(values).toContain("50");
    });

    it("calls updateOrganizationLimits mutation on Save", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      const limitsTab = screen.getAllByRole("tab", { name: /Limits/i })[0];
      await user.click(limitsTab);

      const saveButton = screen.getByRole("button", { name: /Save limits/i });
      await user.click(saveButton);

      const updateLimits = mutationMap.get("limits:updateOrganizationLimits");
      expect(updateLimits).toBeDefined();
      expect(updateLimits).toHaveBeenCalledWith({
        organizationId: "org_1",
        limits: {
          refreshCooldownMinutes: 15,
          maxDailyRefreshes: 100,
          maxDailyRefreshesPerUser: 50,
          maxKeywordsPerBulkRefresh: 100,
        },
      });
    });
  });

  // ── Cross-cutting ────────────────────────────────────────────────────

  // ── Security Tab ──────────────────────────────────────────────────

  describe("Security Tab", () => {
    async function navigateToSecurity(user: ReturnType<typeof userEvent.setup>) {
      const securityTab = screen.getAllByRole("tab", { name: /Security/i })[0];
      await user.click(securityTab);
    }

    it("shows change password button on security tab", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument();
    });

    it("shows security description text", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      expect(screen.getByText(/send a verification code/i)).toBeInTheDocument();
    });

    it("calls signIn with reset flow when change password clicked", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      await user.click(screen.getByRole("button", { name: /change password/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("password", {
          email: "test@example.com",
          flow: "reset",
        });
      });
    });

    it("shows code and password fields after sending code", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      await user.click(screen.getByRole("button", { name: /change password/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it("calls signIn with reset-verification flow on valid password change", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      // Step 1: send code
      await user.click(screen.getByRole("button", { name: /change password/i }));
      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
      mockSignIn.mockClear();

      // Step 2: enter code + new password
      await user.type(screen.getByLabelText(/code/i), "123456");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "NewPass123");

      // Find the submit button (Change password button in the form)
      const submitButtons = screen.getAllByRole("button", { name: /change password/i });
      await user.click(submitButtons[0]);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("password", {
          email: "test@example.com",
          code: "123456",
          newPassword: "NewPass123",
          flow: "reset-verification",
        });
      });
    });

    it("shows success toast and returns to idle after successful password change", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      await user.click(screen.getByRole("button", { name: /change password/i }));
      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());

      await user.type(screen.getByLabelText(/code/i), "123456");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "NewPass123");

      const submitButtons = screen.getAllByRole("button", { name: /change password/i });
      await user.click(submitButtons[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });

      // Should return to idle state showing the description text again
      await waitFor(() => {
        expect(screen.getByText(/send a verification code/i)).toBeInTheDocument();
      });
    });

    it("shows error on password mismatch without calling signIn", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      await user.click(screen.getByRole("button", { name: /change password/i }));
      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
      mockSignIn.mockClear();

      await user.type(screen.getByLabelText(/code/i), "123456");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "DifferentPass1");

      const submitButtons = screen.getAllByRole("button", { name: /change password/i });
      await user.click(submitButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("shows error toast on invalid code and stays on code step", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      await user.click(screen.getByRole("button", { name: /change password/i }));
      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
      mockSignIn.mockClear();
      mockSignIn.mockRejectedValueOnce(new Error("Invalid code"));

      await user.type(screen.getByLabelText(/code/i), "000000");
      await user.type(screen.getByLabelText(/new password/i), "NewPass123");
      await user.type(screen.getByLabelText(/confirm password/i), "NewPass123");

      const submitButtons = screen.getAllByRole("button", { name: /change password/i });
      await user.click(submitButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Should stay on code step
      expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    });

    it("returns to idle state when cancel button is clicked", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);
      await navigateToSecurity(user);

      await user.click(screen.getByRole("button", { name: /change password/i }));
      await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      // Should return to idle showing change password button
      await waitFor(() => {
        const changeBtn = screen.getByRole("button", { name: /change password/i });
        expect(changeBtn).toBeInTheDocument();
      });
    });
  });

  // ── Tab switching ─────────────────────────────────────────────────

  describe("Tab switching", () => {
    it("switches visible content between tabs", async () => {
      const user = userEvent.setup();
      setupQueries(baseQueries());
      renderWithProviders(<SettingsPage />);

      // Default: Profile tab
      expect(screen.getByText("Manage your personal information and how others see you.")).toBeInTheDocument();

      // Switch to Notifications
      const notifTab = screen.getAllByRole("tab", { name: /Notifications/i })[0];
      await user.click(notifTab);
      expect(screen.queryByText("Manage your personal information and how others see you.")).not.toBeInTheDocument();
      expect(screen.getByText("Choose what you want to be notified about and how often.")).toBeInTheDocument();

      // Switch to API Keys
      const apiTab = screen.getAllByRole("tab", { name: /API Keys/i })[0];
      await user.click(apiTab);
      expect(screen.queryByText("Choose what you want to be notified about and how often.")).not.toBeInTheDocument();
      expect(screen.getByText("Manage API keys for programmatic access to your data.")).toBeInTheDocument();

      // Switch to Branding
      const brandingTab = screen.getAllByRole("tab", { name: /Branding/i })[0];
      await user.click(brandingTab);
      expect(screen.getByText("Company Logo")).toBeInTheDocument();
    });
  });
});
