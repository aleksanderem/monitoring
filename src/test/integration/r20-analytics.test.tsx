/**
 * R20 — Analytics Infrastructure Integration Tests
 *
 * Tests the analytics admin dashboard page, useAnalytics hook,
 * analytics lib constants, and useWebVitals hook.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";
import { render } from "@testing-library/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn(() => undefined);
const mockUseMutation = vi.fn(() => vi.fn());
const mockUseAction = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useAction: (...args: unknown[]) => mockUseAction(...args),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/analytics",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
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

// ---------------------------------------------------------------------------
// 1) Analytics lib tests
// ---------------------------------------------------------------------------

describe("src/lib/analytics", () => {
  it("exports EVENTS constant with expected keys", async () => {
    const { EVENTS, ANALYTICS_CATEGORIES, generateSessionId } = await import("@/lib/analytics");

    expect(EVENTS.PAGE_VIEW).toBe("page_view");
    expect(EVENTS.KEYWORD_ADD).toBe("keyword_add");
    expect(EVENTS.WEB_VITAL).toBe("web_vital");
    expect(EVENTS.API_ERROR).toBe("api_error");

    expect(ANALYTICS_CATEGORIES.NAVIGATION).toBe("navigation");
    expect(ANALYTICS_CATEGORIES.FEATURE).toBe("feature");
    expect(ANALYTICS_CATEGORIES.PERFORMANCE).toBe("performance");
  });

  it("generateSessionId returns unique session IDs", async () => {
    const { generateSessionId } = await import("@/lib/analytics");
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^sess_/);
  });
});

// ---------------------------------------------------------------------------
// 2) useAnalytics hook tests
// ---------------------------------------------------------------------------

describe("useAnalytics hook", () => {
  let trackFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackFn = vi.fn().mockResolvedValue(undefined);
    mockUseAction.mockReturnValue(trackFn);
  });

  it("calls track action with correct arguments", async () => {
    const { useAnalytics } = await import("@/hooks/useAnalytics");

    let hookResult: ReturnType<typeof useAnalytics> | undefined;
    function TestComponent() {
      hookResult = useAnalytics();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult).toBeDefined();
    expect(hookResult!.sessionId).toMatch(/^sess_/);

    act(() => {
      hookResult!.trackEvent("keyword_add", "feature", { count: 5 });
    });

    expect(trackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "keyword_add",
        category: "feature",
        properties: { count: 5 },
        sessionId: expect.stringMatching(/^sess_/),
        timestamp: expect.any(Number),
      })
    );
  });

  it("uses feature as default category", async () => {
    const { useAnalytics } = await import("@/hooks/useAnalytics");

    let hookResult: ReturnType<typeof useAnalytics> | undefined;
    function TestComponent() {
      hookResult = useAnalytics();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      hookResult!.trackEvent("page_view");
    });

    expect(trackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "page_view",
        category: "feature",
      })
    );
  });

  it("silently catches errors from track action", async () => {
    const failingTrack = vi.fn().mockRejectedValue(new Error("network error"));
    mockUseAction.mockReturnValue(failingTrack);

    const { useAnalytics } = await import("@/hooks/useAnalytics");

    let hookResult: ReturnType<typeof useAnalytics> | undefined;
    function TestComponent() {
      hookResult = useAnalytics();
      return null;
    }

    render(<TestComponent />);

    // Should not throw
    act(() => {
      hookResult!.trackEvent("keyword_add");
    });

    expect(failingTrack).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3) useWebVitals hook tests
// ---------------------------------------------------------------------------

describe("useWebVitals hook", () => {
  let trackFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackFn = vi.fn().mockResolvedValue(undefined);
    mockUseAction.mockReturnValue(trackFn);
    vi.resetModules();
  });

  it("imports web-vitals and calls onLCP/onINP/onCLS/onFCP/onTTFB", async () => {
    const onLCP = vi.fn();
    const onINP = vi.fn();
    const onCLS = vi.fn();
    const onFCP = vi.fn();
    const onTTFB = vi.fn();

    vi.doMock("web-vitals", () => ({
      onLCP,
      onINP,
      onCLS,
      onFCP,
      onTTFB,
    }));

    const { useWebVitals } = await import("@/hooks/useWebVitals");

    function TestComponent() {
      useWebVitals();
      return null;
    }

    render(<TestComponent />);

    // Wait for dynamic import to resolve
    await vi.waitFor(() => {
      expect(onLCP).toHaveBeenCalled();
    });

    expect(onINP).toHaveBeenCalled();
    expect(onCLS).toHaveBeenCalled();
    expect(onFCP).toHaveBeenCalled();
    expect(onTTFB).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4) Analytics Dashboard Page tests
// ---------------------------------------------------------------------------

describe("Analytics Dashboard Page", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue(undefined);
  });

  it("shows loading skeletons when queries return undefined", async () => {
    setupQueryMock({});

    const AnalyticsDashboardPage = (
      await import("@/app/(admin)/admin/analytics/page")
    ).default;

    render(<AnalyticsDashboardPage />);

    // Check that the page renders heading (appears in breadcrumb + h1)
    const headings = screen.getAllByText("navAnalytics");
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("analyticsDescription")).toBeInTheDocument();
  });

  it("renders conversion funnel with data", async () => {
    setupQueryMock({
      "analytics:getConversionFunnel": {
        registered: 100,
        added_domain: 50,
        added_keywords: 30,
        subscribed: 5,
      },
      "analytics:getActiveUsers": {
        totalUnique: 42,
        daily: [
          { date: "2026-02-20", count: 10 },
          { date: "2026-02-21", count: 15 },
        ],
      },
      "analytics:getTopFeatures": [
        { name: "keyword_add", count: 100 },
        { name: "domain_add", count: 50 },
      ],
      "analytics:getWebVitals": {
        LCP: { avg: 2100, p75: 2500, count: 20 },
        CLS: { avg: 0.05, p75: 0.08, count: 20 },
      },
    });

    const AnalyticsDashboardPage = (
      await import("@/app/(admin)/admin/analytics/page")
    ).default;

    render(<AnalyticsDashboardPage />);

    // Funnel
    expect(screen.getByText("analyticsFunnel")).toBeInTheDocument();
    expect(screen.getByText("analyticsFunnelRegistered")).toBeInTheDocument();
    expect(screen.getByText("analyticsFunnelSubscribed")).toBeInTheDocument();

    // Active users
    expect(screen.getByText("42")).toBeInTheDocument();

    // Features
    expect(screen.getByText("keyword_add")).toBeInTheDocument();
    expect(screen.getByText("domain_add")).toBeInTheDocument();

    // Web Vitals
    expect(screen.getByText("LCP")).toBeInTheDocument();
    expect(screen.getByText("CLS")).toBeInTheDocument();
  });

  it("shows empty state when features list is empty", async () => {
    setupQueryMock({
      "analytics:getConversionFunnel": {
        registered: 0,
        added_domain: 0,
        added_keywords: 0,
        subscribed: 0,
      },
      "analytics:getActiveUsers": {
        totalUnique: 0,
        daily: [],
      },
      "analytics:getTopFeatures": [],
      "analytics:getWebVitals": {},
    });

    const AnalyticsDashboardPage = (
      await import("@/app/(admin)/admin/analytics/page")
    ).default;

    render(<AnalyticsDashboardPage />);

    // Should show "no data" messages
    const noDataElements = screen.getAllByText("analyticsNoData");
    expect(noDataElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays Web Vitals with good/poor status colors", async () => {
    setupQueryMock({
      "analytics:getConversionFunnel": {
        registered: 10,
        added_domain: 5,
        added_keywords: 3,
        subscribed: 1,
      },
      "analytics:getActiveUsers": { totalUnique: 5, daily: [] },
      "analytics:getTopFeatures": [],
      "analytics:getWebVitals": {
        LCP: { avg: 1500, p75: 2000, count: 10 }, // good
        FID: { avg: 500, p75: 500, count: 10 }, // poor
        CLS: { avg: 0.3, p75: 0.3, count: 10 }, // poor
      },
    });

    const AnalyticsDashboardPage = (
      await import("@/app/(admin)/admin/analytics/page")
    ).default;

    render(<AnalyticsDashboardPage />);

    // LCP good: green
    const lcpAvg = screen.getByText("1500ms");
    expect(lcpAvg.className).toContain("green");

    // FID poor: red
    const fidAvg = screen.getByText("500ms");
    expect(fidAvg.className).toContain("red");

    // CLS poor: red
    const clsAvg = screen.getByText("0.300");
    expect(clsAvg.className).toContain("red");
  });

  it("shows active users daily breakdown", async () => {
    setupQueryMock({
      "analytics:getConversionFunnel": {
        registered: 10,
        added_domain: 5,
        added_keywords: 3,
        subscribed: 1,
      },
      "analytics:getActiveUsers": {
        totalUnique: 25,
        daily: [
          { date: "2026-02-15", count: 3 },
          { date: "2026-02-16", count: 5 },
          { date: "2026-02-17", count: 8 },
          { date: "2026-02-18", count: 4 },
          { date: "2026-02-19", count: 6 },
          { date: "2026-02-20", count: 7 },
          { date: "2026-02-21", count: 9 },
        ],
      },
      "analytics:getTopFeatures": [],
      "analytics:getWebVitals": {},
    });

    const AnalyticsDashboardPage = (
      await import("@/app/(admin)/admin/analytics/page")
    ).default;

    render(<AnalyticsDashboardPage />);

    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("2026-02-21")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5) Admin Sidebar Analytics nav item
// ---------------------------------------------------------------------------

describe("Admin Sidebar Analytics nav", () => {
  beforeEach(() => {
    vi.doMock("@convex-dev/auth/react", () => ({
      useAuthActions: () => ({ signOut: vi.fn() }),
    }));
  });

  it("includes Analytics nav item", async () => {
    const { AdminSidebar } = await import(
      "@/components/admin/admin-sidebar"
    );

    render(<AdminSidebar />);

    expect(screen.getByText("navAnalytics")).toBeInTheDocument();
  });
});
