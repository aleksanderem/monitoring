/**
 * Integration tests for the Domain Insights page.
 *
 * Tests page-level behavior: loading state, summary cards, anomaly cards,
 * severity badges, resolved/unresolved states, empty state, and metrics display.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
  usePathname: () => "/domains/domain_active_1/insights",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "domain_active_1" }),
}));

// Mock React.use() so Promise<params> is treated as a plain object
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, use: (val: any) => val };
});

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit", "domains.delete"],
    modules: ["positioning", "forecasts"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>{children}</button>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery } from "convex/react";
import InsightsPage from "@/app/(dashboard)/domains/[domainId]/insights/page";

// ---------------------------------------------------------------------------
// Query mock helper using getFunctionName for stable keys
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueries(responses: QueryMap) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in responses) return responses[name];
    } catch {}
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ANOMALY_SUMMARY = { total: 12, high: 3, medium: 5, low: 4 };

const ANOMALIES = [
  {
    _id: "anomaly_1" as any,
    severity: "high",
    type: "spike",
    description: "Unusual position spike for keyword 'seo tools'",
    detectedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    value: 45.2,
    expectedValue: 12.3,
    zScore: 3.45,
    metric: "position",
    resolved: false,
  },
  {
    _id: "anomaly_2" as any,
    severity: "medium",
    type: "drop",
    description: "Position drop for keyword 'monitoring'",
    detectedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    value: 8.1,
    expectedValue: 22.5,
    zScore: -2.1,
    metric: "position",
    resolved: true,
  },
];

function baseQueries(overrides: QueryMap = {}): QueryMap {
  return {
    "forecasts_queries:getAnomalySummary": ANOMALY_SUMMARY,
    "forecasts_queries:getAnomalies": ANOMALIES,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper to render the page with params as plain object
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <InsightsPage params={{ domainId: "domain_active_1" } as any} />
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InsightsPage", () => {
  it("shows loading state when queries return undefined", () => {
    // useQuery returns undefined by default — no setupQueries called
    renderPage();

    expect(screen.getByText("Insights & Anomalies")).toBeInTheDocument();
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("renders page header text correctly", () => {
    setupQueries(baseQueries());
    renderPage();

    expect(screen.getByText("Insights & Anomalies")).toBeInTheDocument();
    expect(
      screen.getByText("Statistical anomalies detected in your ranking data")
    ).toBeInTheDocument();
  });

  it("renders summary cards with correct counts", () => {
    setupQueries(baseQueries());
    renderPage();

    expect(screen.getByText("Total Anomalies")).toBeInTheDocument();
    expect(screen.getByText("High Severity")).toBeInTheDocument();
    expect(screen.getByText("Medium Severity")).toBeInTheDocument();
    expect(screen.getByText("Low Severity")).toBeInTheDocument();

    // The summary values appear as large text (and also in badges)
    // Total: 12, High: 3, Medium: 5, Low: 4
    const twelves = screen.getAllByText("12");
    expect(twelves.length).toBeGreaterThanOrEqual(1);
    const threes = screen.getAllByText("3");
    expect(threes.length).toBeGreaterThanOrEqual(1);
    const fives = screen.getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(1);
    const fours = screen.getAllByText("4");
    expect(fours.length).toBeGreaterThanOrEqual(1);
  });

  it("renders anomaly cards with severity badges and type labels", () => {
    setupQueries(baseQueries());
    renderPage();

    // Severity badges
    const badges = screen.getAllByTestId("badge");
    const badgeTexts = badges.map((b) => b.textContent);
    expect(badgeTexts).toContain("high");
    expect(badgeTexts).toContain("medium");

    // Type labels rendered as secondary badges
    expect(screen.getByText(/Spike/)).toBeInTheDocument();
    expect(screen.getByText(/Drop/)).toBeInTheDocument();
  });

  it("renders anomaly descriptions", () => {
    setupQueries(baseQueries());
    renderPage();

    expect(
      screen.getByText("Unusual position spike for keyword 'seo tools'")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Position drop for keyword 'monitoring'")
    ).toBeInTheDocument();
  });

  it("displays anomaly metrics (actual, expected, z-score, metric)", () => {
    setupQueries(baseQueries());
    renderPage();

    // Anomaly 1: value=45.2, expectedValue=12.3, zScore=3.45, metric=position
    expect(screen.getByText("45.2")).toBeInTheDocument();
    expect(screen.getByText("12.3")).toBeInTheDocument();
    expect(screen.getByText("3.45")).toBeInTheDocument();

    // Anomaly 2: value=8.1, expectedValue=22.5, zScore=-2.10
    expect(screen.getByText("8.1")).toBeInTheDocument();
    expect(screen.getByText("22.5")).toBeInTheDocument();
    expect(screen.getByText("-2.10")).toBeInTheDocument();

    // Metric labels
    const metricLabels = screen.getAllByText("position");
    expect(metricLabels.length).toBe(2);
  });

  it("shows 'Resolved' badge for resolved anomalies", () => {
    setupQueries(baseQueries());
    renderPage();

    const badges = screen.getAllByTestId("badge");
    const resolvedBadges = badges.filter((b) => b.textContent === "Resolved");
    expect(resolvedBadges.length).toBe(1);
  });

  it("shows 'Mark as Resolved' button for unresolved anomalies", () => {
    setupQueries(baseQueries());
    renderPage();

    expect(screen.getByText("Mark as Resolved")).toBeInTheDocument();
  });

  it("does NOT show 'Mark as Resolved' button for resolved anomalies", () => {
    // Only resolved anomalies — the button should not appear
    const resolvedOnly = [{ ...ANOMALIES[1] }]; // anomaly_2 is resolved
    setupQueries(baseQueries({
      "forecasts_queries:getAnomalies": resolvedOnly,
    }));
    renderPage();

    expect(screen.queryByText("Mark as Resolved")).not.toBeInTheDocument();
  });

  it("shows empty state when no anomalies are returned", () => {
    setupQueries(baseQueries({
      "forecasts_queries:getAnomalies": [],
    }));
    renderPage();

    expect(screen.getByText("No anomalies found")).toBeInTheDocument();
  });
});
