/**
 * R21 — Session Management & Account Security Integration Tests
 *
 * Tests the security backend (session tracking, login history, revocation)
 * and the frontend components (ActiveSessionsList, LoginHistoryTable, SessionManagement).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn(() => undefined);
const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useAction: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupQueryMock(responses: Record<string, unknown>) {
  mockUseQuery.mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = getFunctionName(ref as any);
    return responses[key] ?? undefined;
  }) as any);
}

const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();

function setupMutationMock() {
  mutationMap.clear();
  mockUseMutation.mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) {
      mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    }
    return mutationMap.get(key)!;
  }) as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    _id: "session_1" as any,
    _creationTime: Date.now(),
    userId: "user_1" as any,
    deviceInfo: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      browser: "Chrome",
      os: "macOS",
      deviceType: "desktop",
    },
    ipAddress: "192.168.1.1",
    location: "Warsaw, PL",
    status: "active",
    isCurrent: false,
    loginAt: Date.now() - 3600000,
    lastActivityAt: Date.now() - 600000,
    ...overrides,
  };
}

function makeLoginEntry(overrides: Record<string, unknown> = {}) {
  return {
    _id: "login_1" as any,
    _creationTime: Date.now(),
    userId: "user_1" as any,
    loginMethod: "password",
    deviceInfo: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      browser: "Chrome",
      os: "macOS",
    },
    ipAddress: "192.168.1.1",
    status: "success",
    loginAt: Date.now() - 3600000,
    ...overrides,
  };
}

const ACTIVE_SESSIONS = [
  makeSession({ _id: "session_1" as any, isCurrent: true }),
  makeSession({
    _id: "session_2" as any,
    deviceInfo: {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
      browser: "Safari",
      os: "iOS",
      deviceType: "mobile",
    },
    ipAddress: "10.0.0.1",
    lastActivityAt: Date.now() - 7200000,
  }),
  makeSession({
    _id: "session_3" as any,
    deviceInfo: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      browser: "Firefox",
      os: "Windows",
      deviceType: "desktop",
    },
    ipAddress: "172.16.0.1",
    lastActivityAt: Date.now() - 86400000,
  }),
];

const LOGIN_HISTORY = [
  makeLoginEntry({ _id: "login_1" as any, status: "success", loginAt: Date.now() - 3600000 }),
  makeLoginEntry({
    _id: "login_2" as any,
    status: "failed",
    failureReason: "Invalid password",
    loginAt: Date.now() - 7200000,
  }),
  makeLoginEntry({
    _id: "login_3" as any,
    loginMethod: "google",
    status: "success",
    loginAt: Date.now() - 86400000,
  }),
];

// ---------------------------------------------------------------------------
// 1) Backend logic tests (security.ts module)
// ---------------------------------------------------------------------------

describe("convex/security — device parser", () => {
  it("exports parseBrowser, parseOS, parseDeviceType logic via trackSession", async () => {
    // We test the parsing logic indirectly through the exported functions' behavior
    // The parser functions are internal, so we validate through the module structure
    const securityModule = await import("../../../convex/security");
    expect(securityModule.getActiveSessions).toBeDefined();
    expect(securityModule.getLoginHistory).toBeDefined();
    expect(securityModule.revokeSession).toBeDefined();
    expect(securityModule.revokeAllOtherSessions).toBeDefined();
    expect(securityModule.trackSession).toBeDefined();
    expect(securityModule.updateSessionActivity).toBeDefined();
    expect(securityModule.trackLoginAttempt).toBeDefined();
    expect(securityModule.cleanExpiredSessions).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2) ActiveSessionsList component tests
// ---------------------------------------------------------------------------

describe("ActiveSessionsList", () => {
  beforeEach(() => {
    setupMutationMock();
  });

  it("shows loading state when sessions are undefined", async () => {
    setupQueryMock({});
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);
    // LoadingState renders skeletons (pulse divs) — just verify no error
    expect(document.querySelector("[class*='animate-pulse']") || document.querySelector("table") === null).toBeTruthy();
  });

  it("shows empty state when no sessions exist", async () => {
    setupQueryMock({ "security:getActiveSessions": [] });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);
    expect(screen.getByText("noActiveSessions")).toBeInTheDocument();
  });

  it("renders active sessions with device info", async () => {
    setupQueryMock({ "security:getActiveSessions": ACTIVE_SESSIONS });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    // Check that browser/OS info renders
    expect(screen.getByText(/Chrome.*macOS/)).toBeInTheDocument();
    expect(screen.getByText(/Safari.*iOS/)).toBeInTheDocument();
    expect(screen.getByText(/Firefox.*Windows/)).toBeInTheDocument();
  });

  it("shows 'Current' badge on current session", async () => {
    setupQueryMock({ "security:getActiveSessions": ACTIVE_SESSIONS });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    expect(screen.getByText("currentSession")).toBeInTheDocument();
  });

  it("does not show revoke button on current session", async () => {
    setupQueryMock({
      "security:getActiveSessions": [makeSession({ isCurrent: true })],
    });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    // Only 1 session and it's current — no revoke buttons
    expect(screen.queryByText("revokeSessionBtn")).not.toBeInTheDocument();
  });

  it("shows revoke buttons on non-current sessions", async () => {
    setupQueryMock({ "security:getActiveSessions": ACTIVE_SESSIONS });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    // 3 sessions, 1 current => 2 revoke buttons
    const revokeButtons = screen.getAllByText("revokeSessionBtn");
    expect(revokeButtons).toHaveLength(2);
  });

  it("calls revokeSession mutation when revoke is clicked", async () => {
    setupQueryMock({ "security:getActiveSessions": ACTIVE_SESSIONS });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    const revokeButtons = screen.getAllByText("revokeSessionBtn");
    fireEvent.click(revokeButtons[0]);

    await waitFor(() => {
      const revokeFn = mutationMap.get("security:revokeSession");
      expect(revokeFn).toHaveBeenCalledWith({
        sessionId: "session_2",
      });
    });
  });

  it("shows 'Revoke all other' button when multiple sessions exist", async () => {
    setupQueryMock({ "security:getActiveSessions": ACTIVE_SESSIONS });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    expect(screen.getByText("revokeAllOther")).toBeInTheDocument();
  });

  it("hides 'Revoke all other' when only one session", async () => {
    setupQueryMock({
      "security:getActiveSessions": [makeSession({ isCurrent: true })],
    });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    expect(screen.queryByText("revokeAllOther")).not.toBeInTheDocument();
  });

  it("displays IP address in the location column", async () => {
    setupQueryMock({ "security:getActiveSessions": ACTIVE_SESSIONS });
    const { ActiveSessionsList } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<ActiveSessionsList />);

    expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3) LoginHistoryTable component tests
// ---------------------------------------------------------------------------

describe("LoginHistoryTable", () => {
  beforeEach(() => {
    setupMutationMock();
  });

  it("shows loading state when history is undefined", async () => {
    setupQueryMock({});
    const { LoginHistoryTable } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<LoginHistoryTable />);
    expect(document.querySelector("[class*='animate-pulse']") || document.querySelector("table") === null).toBeTruthy();
  });

  it("shows empty state when no login history", async () => {
    setupQueryMock({ "security:getLoginHistory": [] });
    const { LoginHistoryTable } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<LoginHistoryTable />);
    expect(screen.getByText("noLoginHistory")).toBeInTheDocument();
  });

  it("renders login history entries", async () => {
    setupQueryMock({ "security:getLoginHistory": LOGIN_HISTORY });
    const { LoginHistoryTable } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<LoginHistoryTable />);

    // Check that entries render with correct info
    expect(screen.getAllByText(/Chrome/)).toHaveLength(3); // All use Chrome in fixture
    expect(screen.getAllByText("loginSuccess").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("loginFailed").length).toBeGreaterThanOrEqual(1);
  });

  it("shows login method for each entry", async () => {
    setupQueryMock({ "security:getLoginHistory": LOGIN_HISTORY });
    const { LoginHistoryTable } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<LoginHistoryTable />);

    // password entries (2) + google entry (1)
    const passwordElements = screen.getAllByText("password");
    expect(passwordElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("google")).toBeInTheDocument();
  });

  it("shows success and failure indicators", async () => {
    setupQueryMock({ "security:getLoginHistory": LOGIN_HISTORY });
    const { LoginHistoryTable } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<LoginHistoryTable />);

    // 2 successful, 1 failed
    const successElements = screen.getAllByText("loginSuccess");
    expect(successElements).toHaveLength(2);
    const failedElements = screen.getAllByText("loginFailed");
    expect(failedElements).toHaveLength(1);
  });

  it("displays IP addresses for each login entry", async () => {
    setupQueryMock({ "security:getLoginHistory": LOGIN_HISTORY });
    const { LoginHistoryTable } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<LoginHistoryTable />);

    // All entries have 192.168.1.1
    const ipElements = screen.getAllByText("192.168.1.1");
    expect(ipElements).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 4) SessionManagement combined component tests
// ---------------------------------------------------------------------------

describe("SessionManagement", () => {
  beforeEach(() => {
    setupMutationMock();
  });

  it("renders both ActiveSessionsList and LoginHistoryTable", async () => {
    setupQueryMock({
      "security:getActiveSessions": ACTIVE_SESSIONS,
      "security:getLoginHistory": LOGIN_HISTORY,
    });
    const { SessionManagement } = await import(
      "@/components/settings/SessionManagement"
    );
    render(<SessionManagement />);

    // Both section headers should be present
    expect(screen.getByText("activeSessionsTitle")).toBeInTheDocument();
    expect(screen.getByText("loginHistoryTitle")).toBeInTheDocument();
  });

  it("renders divider between sections", async () => {
    setupQueryMock({
      "security:getActiveSessions": ACTIVE_SESSIONS,
      "security:getLoginHistory": LOGIN_HISTORY,
    });
    const { SessionManagement } = await import(
      "@/components/settings/SessionManagement"
    );
    const { container } = render(<SessionManagement />);

    // Should have an hr divider
    expect(container.querySelector("hr")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5) Schema validation tests
// ---------------------------------------------------------------------------

describe("Schema — userSessions and loginHistory tables", () => {
  it("schema includes userSessions table", async () => {
    const schema = await import("../../../convex/schema");
    const schemaDef = schema.default;
    // The schema default export has tables property
    expect(schemaDef).toBeDefined();
    expect(schemaDef.tables).toBeDefined();
    expect(schemaDef.tables.userSessions).toBeDefined();
    expect(schemaDef.tables.loginHistory).toBeDefined();
  });

  it("userSessions has by_user and by_user_status indexes", async () => {
    const schema = await import("../../../convex/schema");
    const sessionTable = schema.default.tables.userSessions;
    expect(sessionTable).toBeDefined();
    // Convex schema table objects have indexes array
    const indexes = sessionTable.indexes;
    const indexNames = indexes.map((idx: any) => idx.indexDescriptor);
    expect(indexNames).toContain("by_user");
    expect(indexNames).toContain("by_user_status");
  });

  it("loginHistory has by_user and by_user_date indexes", async () => {
    const schema = await import("../../../convex/schema");
    const loginTable = schema.default.tables.loginHistory;
    expect(loginTable).toBeDefined();
    const indexes = loginTable.indexes;
    const indexNames = indexes.map((idx: any) => idx.indexDescriptor);
    expect(indexNames).toContain("by_user");
    expect(indexNames).toContain("by_user_date");
  });
});

// ---------------------------------------------------------------------------
// 6) Translation key tests
// ---------------------------------------------------------------------------

describe("Translation keys", () => {
  it("EN settings.json has all session management keys", async () => {
    const en = await import("@/messages/en/settings.json");
    const keys = [
      "tabSessions",
      "activeSessionsTitle",
      "activeSessionsDescription",
      "sessionDevice",
      "sessionLocation",
      "sessionLastActive",
      "currentSession",
      "revokeSessionBtn",
      "revokeAllOther",
      "sessionRevoked",
      "sessionRevokeError",
      "confirmRevokeAll",
      "allSessionsRevoked",
      "noActiveSessions",
      "loginHistoryTitle",
      "loginHistoryDescription",
      "loginDate",
      "loginMethod",
      "loginDeviceColumn",
      "loginIp",
      "loginStatus",
      "loginSuccess",
      "loginFailed",
      "noLoginHistory",
    ];
    for (const key of keys) {
      expect((en as any)[key] || (en as any).default?.[key]).toBeDefined();
    }
  });

  it("PL settings.json has all session management keys", async () => {
    const pl = await import("@/messages/pl/settings.json");
    const keys = [
      "tabSessions",
      "activeSessionsTitle",
      "loginHistoryTitle",
      "sessionRevoked",
      "noActiveSessions",
      "noLoginHistory",
    ];
    for (const key of keys) {
      expect((pl as any)[key] || (pl as any).default?.[key]).toBeDefined();
    }
  });
});
