/**
 * R19: Admin System Health Dashboard — integration tests.
 *
 * Verifies:
 *  - Loading state
 *  - Health status banner (healthy / degraded / critical)
 *  - Metric cards render correct values
 *  - Job queue status panel
 *  - API quota widget with progress bar
 *  - Error timeline chart
 *  - Failed jobs table (populated + empty)
 *  - Bulk operations panel
 *  - Sidebar navigation includes Health link
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

let mockQueryResponses: Map<string, unknown> = new Map();
const mockMutationFns: Map<string, ReturnType<typeof vi.fn>> = new Map();

vi.mock("convex/react", () => ({
  useQuery: vi.fn((ref: unknown, args?: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    if (mockQueryResponses.has(key)) return mockQueryResponses.get(key);
    return undefined;
  }),
  useMutation: vi.fn((ref: unknown) => {
    const key = refToKey(ref);
    if (!mockMutationFns.has(key)) {
      mockMutationFns.set(key, vi.fn().mockResolvedValue(undefined));
    }
    return mockMutationFns.get(key)!;
  }),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/health",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function refToKey(ref: unknown): string {
  try {
    return getFunctionName(ref as any);
  } catch {
    return String(ref);
  }
}

function setupQueries(responses: Record<string, unknown>) {
  mockQueryResponses = new Map(Object.entries(responses));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeHealthData(overrides: Record<string, unknown> = {}) {
  return {
    overallStatus: "healthy",
    jobQueue: {
      keywordCheck: { pending: 3, processing: 1, failedLast24h: 0 },
      keywordSerp: { pending: 5, processing: 2, failedLast24h: 1 },
      onSiteScan: { pending: 0, processing: 0, failedLast24h: 0 },
      totalActive: 11,
      totalFailedLast24h: 1,
    },
    errors: {
      last24h: 5,
      lastHour: 0,
      warningsLast24h: 12,
    },
    apiUsage: {
      todayCost: 0.4523,
      todayCalls: 87,
    },
    notifications: {
      sentLast24h: 42,
      failedLast24h: 2,
    },
    ...overrides,
  };
}

const FAILED_JOBS = [
  {
    id: "job_1",
    type: "Keyword Check",
    domainName: "example.com",
    error: "DataForSEO rate limit exceeded",
    failedAt: Date.now() - 3600000,
    createdAt: Date.now() - 7200000,
  },
  {
    id: "job_2",
    type: "SERP Fetch",
    domainName: "test.org",
    error: "Timeout after 60s",
    failedAt: Date.now() - 1800000,
    createdAt: Date.now() - 5400000,
  },
];

const ERROR_TIMELINE = [
  { date: "2026-02-16", errors: 2, warnings: 5 },
  { date: "2026-02-17", errors: 0, warnings: 3 },
  { date: "2026-02-18", errors: 8, warnings: 10 },
  { date: "2026-02-19", errors: 1, warnings: 2 },
  { date: "2026-02-20", errors: 0, warnings: 0 },
  { date: "2026-02-21", errors: 3, warnings: 7 },
  { date: "2026-02-22", errors: 5, warnings: 12 },
];

const COST_STATUS = {
  todayCost: 0.4523,
  defaultCap: 5,
  pace24h: 1.2,
  callsToday: 87,
};

// ---------------------------------------------------------------------------
// Lazy imports (after mocks are declared)
// ---------------------------------------------------------------------------

let AdminHealthPage: React.ComponentType;
let AdminSidebar: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockQueryResponses.clear();
  mockMutationFns.clear();

  const healthModule = await import("@/app/(admin)/admin/health/page");
  AdminHealthPage = healthModule.default;

  const sidebarModule = await import("@/components/admin/admin-sidebar");
  AdminSidebar = sidebarModule.AdminSidebar;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminHealthPage", () => {
  describe("Loading state", () => {
    it("shows spinner when health data is undefined", () => {
      render(<AdminHealthPage />);
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Health status banner", () => {
    it("shows healthy status when overallStatus is healthy", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData({ overallStatus: "healthy" }),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      expect(screen.getByTestId("health-status-banner")).toHaveTextContent("healthStatusHealthy");
    });

    it("shows degraded status when overallStatus is degraded", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData({ overallStatus: "degraded" }),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      expect(screen.getByTestId("health-status-banner")).toHaveTextContent("healthStatusDegraded");
    });

    it("shows critical status when overallStatus is critical", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData({ overallStatus: "critical" }),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      expect(screen.getByTestId("health-status-banner")).toHaveTextContent("healthStatusCritical");
    });
  });

  describe("Health metric cards", () => {
    beforeEach(() => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
    });

    it("displays active jobs count", () => {
      render(<AdminHealthPage />);
      const cards = screen.getAllByTestId("health-metric-card");
      // First card: Active Jobs = 11
      expect(cards[0]).toHaveTextContent("healthActiveJobs");
      expect(cards[0]).toHaveTextContent("11");
    });

    it("displays errors count for last 24h", () => {
      render(<AdminHealthPage />);
      const cards = screen.getAllByTestId("health-metric-card");
      expect(cards[1]).toHaveTextContent("healthErrorsLast24h");
      expect(cards[1]).toHaveTextContent("5");
    });

    it("displays API cost today", () => {
      render(<AdminHealthPage />);
      const cards = screen.getAllByTestId("health-metric-card");
      expect(cards[2]).toHaveTextContent("healthApiCostToday");
      expect(cards[2]).toHaveTextContent("$0.4523");
    });

    it("displays notification count", () => {
      render(<AdminHealthPage />);
      const cards = screen.getAllByTestId("health-metric-card");
      expect(cards[3]).toHaveTextContent("healthNotifications");
      expect(cards[3]).toHaveTextContent("42");
    });
  });

  describe("Job queue status", () => {
    beforeEach(() => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
    });

    it("renders the job queue panel with three queue types", () => {
      render(<AdminHealthPage />);
      const panel = screen.getByTestId("job-queue-status");
      expect(panel).toHaveTextContent("healthQueueKeywordCheck");
      expect(panel).toHaveTextContent("healthQueueKeywordSerp");
      expect(panel).toHaveTextContent("healthQueueOnSiteScan");
    });

    it("shows pending counts per queue", () => {
      render(<AdminHealthPage />);
      const pending = screen.getAllByTestId("queue-pending");
      expect(pending[0]).toHaveTextContent("3");
      expect(pending[1]).toHaveTextContent("5");
      expect(pending[2]).toHaveTextContent("0");
    });

    it("shows processing counts per queue", () => {
      render(<AdminHealthPage />);
      const processing = screen.getAllByTestId("queue-processing");
      expect(processing[0]).toHaveTextContent("1");
      expect(processing[1]).toHaveTextContent("2");
      expect(processing[2]).toHaveTextContent("0");
    });

    it("shows failed counts per queue", () => {
      render(<AdminHealthPage />);
      const failed = screen.getAllByTestId("queue-failed");
      expect(failed[0]).toHaveTextContent("0");
      expect(failed[1]).toHaveTextContent("1");
      expect(failed[2]).toHaveTextContent("0");
    });
  });

  describe("API quota widget", () => {
    it("renders loading state when cost status is undefined", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
      });
      render(<AdminHealthPage />);
      const widget = screen.getByTestId("api-quota-widget");
      expect(widget).toHaveTextContent("healthLoading");
    });

    it("renders cost values when data available", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      const widget = screen.getByTestId("api-quota-widget");
      expect(widget).toHaveTextContent("$0.4523");
      expect(widget).toHaveTextContent("$5.00");
      expect(widget).toHaveTextContent("87");
    });
  });

  describe("Error rate chart", () => {
    it("renders the error timeline chart", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      const chart = screen.getByTestId("error-rate-chart");
      expect(chart).toHaveTextContent("healthErrorTimeline");
      expect(chart).toHaveTextContent("healthErrors");
      expect(chart).toHaveTextContent("healthWarnings");
    });

    it("does not render when timeline is empty", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": [],
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      expect(screen.queryByTestId("error-rate-chart")).not.toBeInTheDocument();
    });
  });

  describe("Failed jobs table", () => {
    it("shows empty message when no failed jobs", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      const table = screen.getByTestId("failed-jobs-table");
      expect(table).toHaveTextContent("healthNoFailedJobs");
    });

    it("renders failed job rows with details", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": FAILED_JOBS,
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      const table = screen.getByTestId("failed-jobs-table");
      expect(table).toHaveTextContent("Keyword Check");
      expect(table).toHaveTextContent("example.com");
      expect(table).toHaveTextContent("DataForSEO rate limit exceeded");
      expect(table).toHaveTextContent("SERP Fetch");
      expect(table).toHaveTextContent("test.org");
    });
  });

  describe("Bulk operations panel", () => {
    it("renders the bulk operations panel", () => {
      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
      });
      render(<AdminHealthPage />);
      const panel = screen.getByTestId("bulk-operations-panel");
      expect(panel).toHaveTextContent("healthBulkOperations");
      expect(panel).toHaveTextContent("healthBulkSuspendUsers");
    });

    it("calls bulkSuspendUsers mutation when button clicked", async () => {
      const user = userEvent.setup();
      const mockBulkSuspend = vi.fn().mockResolvedValue({ suspended: 2, skipped: 0 });
      mockMutationFns.set("admin:bulkSuspendUsers", mockBulkSuspend);

      setupQueries({
        "adminHealth:getSystemHealth": makeHealthData(),
        "adminHealth:getFailedJobsDetail": [],
        "adminHealth:getErrorTimeline": ERROR_TIMELINE,
        "apiUsage:getDailyApiCostStatus": COST_STATUS,
        "admin:getSystemStats": { users: { total: 10 } },
      });
      render(<AdminHealthPage />);

      // The placeholders are returned as translation keys in the mock
      const inputs = screen.getAllByRole("textbox");
      await user.type(inputs[0], "user1,user2");
      await user.type(inputs[1], "Violation");

      // Find button by translation key
      const suspendButton = screen.getByText("healthBulkSuspendButton");
      await user.click(suspendButton);

      await waitFor(() => {
        expect(mockBulkSuspend).toHaveBeenCalledWith({
          userIds: ["user1", "user2"],
          reason: "Violation",
        });
      });
    });
  });
});

describe("AdminSidebar", () => {
  it("includes Health nav item", () => {
    setupQueries({});
    render(<AdminSidebar />);
    const healthLink = screen.getByText("navHealth");
    expect(healthLink).toBeInTheDocument();
    expect(healthLink.closest("a")).toHaveAttribute("href", "/admin/health");
  });
});
