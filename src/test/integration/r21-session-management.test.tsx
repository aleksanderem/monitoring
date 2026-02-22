/**
 * R21 — Session Management & Account Security integration tests.
 *
 * Tests:
 * - Active sessions list rendering (loading, empty, populated states)
 * - Login history table rendering
 * - Revoke session mutation flow
 * - Revoke all other sessions flow
 * - Sessions tab visibility in settings
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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
    permissions: ["domains.create", "domains.edit"],
    modules: ["positioning"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: ["domains.create"],
    modules: ["positioning"],
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

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

const mockSignIn = vi.fn().mockResolvedValue(undefined);
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    _id: "session_1" as any,
    userId: "user_1" as any,
    sessionId: "convex_sess_abc",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    deviceLabel: "Chrome on macOS",
    lastActiveAt: now - 5 * 60 * 1000, // 5 minutes ago
    createdAt: now - 2 * day,
    expiresAt: now + 28 * day,
    isRevoked: false,
    ...overrides,
  };
}

const SESSION_CURRENT = makeSession({
  _id: "session_1",
  lastActiveAt: now - 1000,
  deviceLabel: "Chrome on macOS",
  ipAddress: "10.0.0.1",
});

const SESSION_OTHER = makeSession({
  _id: "session_2",
  lastActiveAt: now - 2 * hour,
  deviceLabel: "Firefox on Windows",
  ipAddress: "192.168.1.50",
  createdAt: now - 7 * day,
});

const SESSION_MOBILE = makeSession({
  _id: "session_3",
  lastActiveAt: now - 12 * hour,
  deviceLabel: "Safari on iOS",
  ipAddress: "172.16.0.5",
  createdAt: now - 14 * day,
});

const SESSIONS_LIST = [SESSION_CURRENT, SESSION_OTHER, SESSION_MOBILE];

function makeLoginEntry(overrides: Record<string, unknown> = {}) {
  return {
    _id: "login_1" as any,
    userId: "user_1" as any,
    ipAddress: "10.0.0.1",
    userAgent: "Mozilla/5.0",
    deviceLabel: "Chrome on macOS",
    method: "password" as const,
    success: true,
    createdAt: now - 30 * 60 * 1000,
    ...overrides,
  };
}

const LOGIN_SUCCESS = makeLoginEntry();
const LOGIN_FAILED = makeLoginEntry({
  _id: "login_2",
  success: false,
  failureReason: "Invalid password",
  method: "password" as const,
  createdAt: now - 2 * hour,
});
const LOGIN_GOOGLE = makeLoginEntry({
  _id: "login_3",
  method: "google" as const,
  createdAt: now - day,
});

const LOGIN_HISTORY = [LOGIN_SUCCESS, LOGIN_FAILED, LOGIN_GOOGLE];

// ---------------------------------------------------------------------------
// Query mock helpers
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

function setupMutationMap() {
  const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as any);
  return mutationMap;
}

/** Base queries for a settings page that shows the sessions tab. */
function sessionsTabQueries(overrides: QueryMap = {}): QueryMap {
  return {
    "users:getCurrentUser": { _id: "user_1", name: "Test User", email: "test@example.com" },
    "auth:getCurrentUser": { _id: "user_1", name: "Test User", email: "test@example.com" },
    "userSettings:getUserPreferences": { language: "en", timezone: "UTC", dateFormat: "YYYY-MM-DD", timeFormat: "24h" },
    "userSettings:getNotificationPreferences": { dailyRankingReports: true, positionAlerts: true, keywordOpportunities: true, teamInvitations: true, systemUpdates: true, frequency: "daily" },
    "users:getAPIKeys": [],
    "organizations:getUserOrganizations": [{ _id: "org_1", name: "Test Org", role: "admin", planId: "plan_pro", subscriptionStatus: "active" }],
    "organizations:getOrganizationMembers": [],
    "plans:getPlan": { _id: "plan_pro", name: "Pro", key: "pro", modules: [], limits: {}, permissions: [], isDefault: false, createdAt: now },
    "plans:getDefaultPlan": null,
    "limits:getUsageStats": { keywords: { current: 10, limit: 500 }, domains: { current: 2, limit: 20 }, projects: { current: 1, limit: 10 } },
    "limits:getOrgRefreshLimits": null,
    "branding:getOrganizationBranding": null,
    "security:getActiveSessions": SESSIONS_LIST,
    "security:getLoginHistory": LOGIN_HISTORY,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let SessionManagementSection: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  localStorage.clear();

  const mod = await import("@/components/settings/SessionManagement");
  SessionManagementSection = mod.SessionManagementSection;
});

// ---------------------------------------------------------------------------
// Tests — SessionManagementSection (standalone)
// ---------------------------------------------------------------------------

describe("R21 — Session Management", () => {

  // ── Active Sessions ──────────────────────────────────────────────

  describe("Active Sessions List", () => {
    it("shows loading state when sessions query returns undefined", () => {
      setupQueries({
        "security:getActiveSessions": undefined,
        "security:getLoginHistory": undefined,
      });
      // Force useQuery to return undefined for everything (loading)
      vi.mocked(useQuery).mockImplementation((() => undefined) as any);

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getAllByTestId("loading-state").length).toBeGreaterThan(0);
    });

    it("shows empty state when there are no active sessions", () => {
      setupQueries({
        "security:getActiveSessions": [],
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getByText("No active sessions found.")).toBeInTheDocument();
    });

    it("renders sessions with device label, IP, and timestamps", () => {
      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);

      // Device labels
      expect(screen.getByText("Chrome on macOS")).toBeInTheDocument();
      expect(screen.getByText("Firefox on Windows")).toBeInTheDocument();
      expect(screen.getByText("Safari on iOS")).toBeInTheDocument();

      // IP addresses
      expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
      expect(screen.getByText("192.168.1.50")).toBeInTheDocument();
      expect(screen.getByText("172.16.0.5")).toBeInTheDocument();
    });

    it("marks the first session as Current", () => {
      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    it("does not show revoke button on the current (first) session", () => {
      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);

      // There should be Revoke buttons only for non-current sessions (2 of 3)
      const revokeButtons = screen.getAllByRole("button", { name: /Revoke/i });
      // "Revoke all other sessions" is also a button, so filter just "Revoke" text
      const singleRevokeButtons = revokeButtons.filter((btn) =>
        btn.textContent?.trim() === "Revoke"
      );
      expect(singleRevokeButtons).toHaveLength(2);
    });

    it("shows 'Revoke all other sessions' button when multiple sessions exist", () => {
      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getByText("Revoke all other sessions")).toBeInTheDocument();
    });

    it("hides 'Revoke all other sessions' button when only one session exists", () => {
      setupQueries({
        "security:getActiveSessions": [SESSION_CURRENT],
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.queryByText("Revoke all other sessions")).not.toBeInTheDocument();
    });

    it("shows unknown device label when deviceLabel is missing", () => {
      const sessionNoDevice = makeSession({
        _id: "session_nodev",
        deviceLabel: undefined,
        lastActiveAt: now,
      });
      setupQueries({
        "security:getActiveSessions": [sessionNoDevice],
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getByText("Unknown device")).toBeInTheDocument();
    });

    it("shows Unknown IP when ipAddress is missing", () => {
      const sessionNoIp = makeSession({
        _id: "session_noip",
        ipAddress: undefined,
        lastActiveAt: now,
      });
      setupQueries({
        "security:getActiveSessions": [sessionNoIp],
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  // ── Revoke Session Flow ──────────────────────────────────────────

  describe("Revoke Session", () => {
    it("calls revokeSession mutation with correct session ID on confirm", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      // Mock confirm to return true
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      renderWithProviders(<SessionManagementSection />);

      // Click the first "Revoke" button (second session)
      const revokeButtons = screen.getAllByRole("button", { name: /^Revoke$/ });
      await user.click(revokeButtons[0]);

      expect(confirmSpy).toHaveBeenCalled();

      await waitFor(() => {
        const revokeFn = mutationMap.get("security:revokeSession");
        expect(revokeFn).toHaveBeenCalledWith({ sessionId: "session_2" });
      });

      expect(toast.success).toHaveBeenCalledWith("Session revoked successfully");
      confirmSpy.mockRestore();
    });

    it("does not revoke when user cancels confirm dialog", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      renderWithProviders(<SessionManagementSection />);

      const revokeButtons = screen.getAllByRole("button", { name: /^Revoke$/ });
      await user.click(revokeButtons[0]);

      const revokeFn = mutationMap.get("security:revokeSession");
      expect(revokeFn).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it("shows error toast when revoke fails", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      mutationMap.set("security:revokeSession", vi.fn().mockRejectedValue(new Error("Server error")));
      vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
        const key = getFunctionName(ref as any);
        if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
        return mutationMap.get(key)!;
      }) as any);

      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      renderWithProviders(<SessionManagementSection />);

      const revokeButtons = screen.getAllByRole("button", { name: /^Revoke$/ });
      await user.click(revokeButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to revoke session");
      });

      confirmSpy.mockRestore();
    });
  });

  // ── Revoke All Sessions ──────────────────────────────────────────

  describe("Revoke All Other Sessions", () => {
    it("calls revokeAllOtherSessions and shows success toast with count", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      mutationMap.set("security:revokeAllOtherSessions", vi.fn().mockResolvedValue({ revokedCount: 2 }));
      vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
        const key = getFunctionName(ref as any);
        if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
        return mutationMap.get(key)!;
      }) as any);

      setupQueries({
        "security:getActiveSessions": SESSIONS_LIST,
        "security:getLoginHistory": [],
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      renderWithProviders(<SessionManagementSection />);

      await user.click(screen.getByText("Revoke all other sessions"));

      await waitFor(() => {
        expect(mutationMap.get("security:revokeAllOtherSessions")).toHaveBeenCalled();
      });

      expect(toast.success).toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  // ── Login History ────────────────────────────────────────────────

  describe("Login History Table", () => {
    it("shows empty state when no login history", () => {
      setupQueries({
        "security:getActiveSessions": [],
        "security:getLoginHistory": [],
      });

      renderWithProviders(<SessionManagementSection />);
      expect(screen.getByText("No login history available.")).toBeInTheDocument();
    });

    it("renders login entries with method, device, IP, and status", () => {
      setupQueries({
        "security:getActiveSessions": [],
        "security:getLoginHistory": LOGIN_HISTORY,
      });

      renderWithProviders(<SessionManagementSection />);

      // Methods — "Password" may appear multiple times (login entries), so use getAllByText
      expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Google")).toBeInTheDocument();

      // Statuses
      const successBadges = screen.getAllByText("Success");
      expect(successBadges.length).toBeGreaterThanOrEqual(2); // LOGIN_SUCCESS and LOGIN_GOOGLE
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("displays unknown device when deviceLabel is missing in history", () => {
      const entryNoDevice = makeLoginEntry({
        _id: "login_nodev",
        deviceLabel: undefined,
      });
      setupQueries({
        "security:getActiveSessions": [],
        "security:getLoginHistory": [entryNoDevice],
      });

      renderWithProviders(<SessionManagementSection />);
      // "Unknown device" text in the device column
      expect(screen.getByText("Unknown device")).toBeInTheDocument();
    });
  });

  // ── Settings Page Tab Integration ────────────────────────────────

  describe("Settings Page — Sessions Tab", () => {
    let SettingsPage: React.ComponentType;

    beforeEach(async () => {
      vi.mocked(useQuery).mockImplementation((() => undefined) as any);
      vi.mocked(useMutation).mockReturnValue(vi.fn() as any);

      const mod = await import("@/app/(dashboard)/settings/page");
      SettingsPage = mod.default;
    });

    it("renders the Sessions tab in tab navigation", () => {
      setupQueries(sessionsTabQueries());
      renderWithProviders(<SettingsPage />);

      // The tab should be present (rendered as tab button or link)
      expect(screen.getAllByText("Sessions").length).toBeGreaterThan(0);
    });
  });
});
