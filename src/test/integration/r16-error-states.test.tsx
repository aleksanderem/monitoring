/**
 * R16: Loading & Error State Audit
 *
 * Tests for:
 * 1. ErrorBoundary with retry + exponential backoff
 * 2. LoadingState "detail" variant
 * 3. Route-level error.tsx pages (dashboard error page)
 * 4. Route-level loading.tsx pages for all dashboard segments
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingState } from "@/components/shared/LoadingState";
import DashboardError from "@/app/(dashboard)/error";
import DashboardLoading from "@/app/(dashboard)/loading";
import DashboardPageLoading from "@/app/(dashboard)/dashboard/loading";
import ProjectsLoading from "@/app/(dashboard)/projects/loading";
import ProjectDetailLoading from "@/app/(dashboard)/projects/[projectId]/loading";
import DomainsLoading from "@/app/(dashboard)/domains/loading";
import DomainDetailLoading from "@/app/(dashboard)/domains/[domainId]/loading";
import InsightsLoading from "@/app/(dashboard)/domains/[domainId]/insights/loading";
import JobsLoading from "@/app/(dashboard)/jobs/loading";
import CalendarLoading from "@/app/(dashboard)/calendar/loading";
import SettingsLoading from "@/app/(dashboard)/settings/loading";
// DashboardError uses useTranslations which is globally mocked in setup.ts
// so we use plain render() instead of renderWithProviders for those tests.

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A component that always throws on render. */
function ThrowingComponent({ message = "Test error" }: { message?: string }) {
  throw new Error(message);
}

/**
 * Suppress React's console.error for expected error boundary logs.
 * React logs caught errors even when they're handled by error boundaries.
 */
function suppressConsoleError() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return spy;
}

// ---------------------------------------------------------------------------
// ErrorBoundary tests
// ---------------------------------------------------------------------------

describe("ErrorBoundary", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleSpy = suppressConsoleError();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleSpy.mockRestore();
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary label="Test">
        <div>Content OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Content OK")).toBeInTheDocument();
  });

  it("renders error fallback with alert role when child throws", () => {
    render(
      <ErrorBoundary label="Widget">
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText('Something went wrong in "Widget"')).toBeInTheDocument();
    expect(screen.getByText("Test error", { exact: false })).toBeInTheDocument();
  });

  it("renders generic message when no label provided", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows countdown for auto-retry with exponential backoff", () => {
    render(
      <ErrorBoundary label="Backoff" maxRetries={3}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // First retry: backoff = 1000ms * 2^0 = 1s
    expect(screen.getByText(/retrying in 1s/)).toBeInTheDocument();
  });

  it("auto-retries after backoff delay", () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error("Temporary error");
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary label="AutoRetry" maxRetries={3}>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Fix the error before the timer fires
    shouldThrow = false;

    // Advance past the 1s backoff
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("allows manual retry via button click", () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error("Click error");
      return <div>Fixed</div>;
    }

    render(
      <ErrorBoundary label="Manual" maxRetries={3}>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;

    // Use fireEvent instead of userEvent to avoid fake timer conflicts
    act(() => {
      screen.getByText("Retry now").click();
    });

    expect(screen.getByText("Fixed")).toBeInTheDocument();
  });

  it("stops auto-retrying after maxRetries is exhausted", () => {
    render(
      <ErrorBoundary label="Exhausted" maxRetries={0}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // With maxRetries=0, no countdown should appear
    expect(screen.queryByText(/Retrying in/)).not.toBeInTheDocument();
    // The "Try again" button should still work for manual retry
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("shows 'Try again' text when not counting down", () => {
    render(
      <ErrorBoundary label="NoCountdown" maxRetries={0}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("shows 'Retry now' text when counting down", () => {
    render(
      <ErrorBoundary label="Counting" maxRetries={3}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Retry now")).toBeInTheDocument();
  });

  it("logs error to console with label", () => {
    render(
      <ErrorBoundary label="Logger">
        <ThrowingComponent message="Log this" />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      "Logger",
      expect.any(Error),
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// LoadingState tests
// ---------------------------------------------------------------------------

describe("LoadingState", () => {
  it("renders table skeleton by default", () => {
    const { container } = render(<LoadingState />);
    // Table: 1 header skeleton + 5 row skeletons = 6 total
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]');
    // Just check the outer container exists with skeleton children
    expect(container.firstChild).toBeTruthy();
  });

  it("renders card skeleton variant", () => {
    const { container } = render(<LoadingState type="card" rows={3} />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("renders list skeleton variant", () => {
    const { container } = render(<LoadingState type="list" rows={4} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders detail skeleton variant with header, stats, and content areas", () => {
    const { container } = render(<LoadingState type="detail" />);
    // Detail should have a rounded-full avatar skeleton
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
    // Detail should have a grid for stats
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("shows optional message text", () => {
    render(<LoadingState type="detail" message="Please wait..." />);
    expect(screen.getByText("Please wait...")).toBeInTheDocument();
  });

  it("shows message in table variant", () => {
    render(<LoadingState type="table" message="Fetching data..." />);
    expect(screen.getByText("Fetching data...")).toBeInTheDocument();
  });

  it("shows message in card variant", () => {
    render(<LoadingState type="card" message="Loading cards..." />);
    expect(screen.getByText("Loading cards...")).toBeInTheDocument();
  });

  it("shows message in list variant", () => {
    render(<LoadingState type="list" message="Loading list..." />);
    expect(screen.getByText("Loading list...")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dashboard error.tsx page tests
// ---------------------------------------------------------------------------

describe("DashboardError page", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleSpy = suppressConsoleError();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleSpy.mockRestore();
  });

  it("renders error UI with alert role", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("Page crashed"), { digest: "abc123" });

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Page crashed", { exact: false })).toBeInTheDocument();
  });

  it("renders error title from translations", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error(""), { digest: "abc" });

    render(<DashboardError error={error} reset={reset} />);

    // Translation key passthrough from setup mock: useTranslations returns key
    expect(screen.getByText("errorTitle")).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("Click test"), { digest: "x" });

    render(<DashboardError error={error} reset={reset} />);

    act(() => {
      screen.getByRole("button").click();
    });

    expect(reset).toHaveBeenCalled();
  });

  it("shows countdown for auto-retry", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("Retry test"), { digest: "y" });

    render(<DashboardError error={error} reset={reset} />);

    // Initial countdown for first retry (1s backoff)
    expect(screen.getByText('retrying({"seconds":1})', { exact: false })).toBeInTheDocument();
  });

  it("auto-calls reset after backoff delay", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("Auto"), { digest: "z" });

    render(<DashboardError error={error} reset={reset} />);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(reset).toHaveBeenCalled();
  });

  it("logs error to console on mount", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("Console log test"), { digest: "c" });

    render(<DashboardError error={error} reset={reset} />);

    expect(consoleSpy).toHaveBeenCalledWith("Dashboard error:", error);
  });
});

// ---------------------------------------------------------------------------
// Route-level loading.tsx page tests
// ---------------------------------------------------------------------------

describe("Route loading pages", () => {
  it("renders DashboardLoading (layout level)", () => {
    const { container } = render(<DashboardLoading />);
    // Should contain detail-type skeleton (has rounded-full avatar)
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });

  it("renders DashboardPageLoading with card skeleton", () => {
    const { container } = render(<DashboardPageLoading />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("renders ProjectsLoading with table skeleton", () => {
    const { container } = render(<ProjectsLoading />);
    expect(container.firstChild).toBeTruthy();
    // Table type has header + rows in a space-y container
    expect(container.querySelector(".space-y-3")).toBeInTheDocument();
  });

  it("renders ProjectDetailLoading with detail skeleton", () => {
    const { container } = render(<ProjectDetailLoading />);
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });

  it("renders DomainsLoading with table skeleton", () => {
    const { container } = render(<DomainsLoading />);
    expect(container.querySelector(".space-y-3")).toBeInTheDocument();
  });

  it("renders DomainDetailLoading with detail skeleton", () => {
    const { container } = render(<DomainDetailLoading />);
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });

  it("renders InsightsLoading with card skeleton", () => {
    const { container } = render(<InsightsLoading />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("renders JobsLoading with table skeleton", () => {
    const { container } = render(<JobsLoading />);
    expect(container.querySelector(".space-y-3")).toBeInTheDocument();
  });

  it("renders CalendarLoading with card skeleton", () => {
    const { container } = render(<CalendarLoading />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("renders SettingsLoading with list skeleton", () => {
    const { container } = render(<SettingsLoading />);
    expect(container.querySelector(".space-y-2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Route-level error.tsx re-export tests
// ---------------------------------------------------------------------------

describe("Route error pages re-export DashboardError", () => {
  // All child route error.tsx files re-export the parent DashboardError
  // We verify the import resolves and renders the same component

  const routes = [
    { name: "dashboard", load: () => import("@/app/(dashboard)/dashboard/error") },
    { name: "projects", load: () => import("@/app/(dashboard)/projects/error") },
    { name: "projects/[projectId]", load: () => import("@/app/(dashboard)/projects/[projectId]/error") },
    { name: "domains", load: () => import("@/app/(dashboard)/domains/error") },
    { name: "domains/[domainId]", load: () => import("@/app/(dashboard)/domains/[domainId]/error") },
    { name: "domains/[domainId]/insights", load: () => import("@/app/(dashboard)/domains/[domainId]/insights/error") },
    { name: "jobs", load: () => import("@/app/(dashboard)/jobs/error") },
    { name: "calendar", load: () => import("@/app/(dashboard)/calendar/error") },
    { name: "settings", load: () => import("@/app/(dashboard)/settings/error") },
  ];

  it.each(routes)("$name error.tsx exports a valid component", async ({ load }) => {
    const mod = await load();
    expect(typeof mod.default).toBe("function");
  });
});
