/**
 * Integration tests for Jobs page data FLOW paths.
 *
 * Verifies stats card data binding, active/scheduled/history tab flows,
 * progress bar rendering, cancel mutations, and history filters.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/jobs",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: [],
    modules: [],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    permissions: [],
    modules: [],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({ GlowingEffect: () => null }));

vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: Record<string, unknown>) => {
        const domSafe: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
          if (["className", "style", "id", "role", "onClick", "data-testid", "children"].includes(k)) domSafe[k] = v;
        }
        return <div {...domSafe}>{props.children as React.ReactNode}</div>;
      },
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Override next-intl to use real translations
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import {
  JOB_STATS_BUSY,
  JOB_STATS_EMPTY,
  ACTIVE_JOBS_MULTIPLE,
  ACTIVE_JOBS_EMPTY,
  ACTIVE_JOB_WITH_PROGRESS,
  SCHEDULED_JOBS,
  JOB_HISTORY_UNIFIED,
  JOB_HISTORY_EMPTY,
} from "@/test/fixtures/jobs";

// We use renderWithProviders for real translations
import { renderWithProviders } from "@/test/helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Query mock helper
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

function setupMutationMap() {
  const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as any);
  return mutationMap;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let JobsPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);

  const mod = await import("@/app/(dashboard)/jobs/page");
  JobsPage = mod.default;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Jobs Flows", () => {
  // ── Stats Cards ──────────────────────────────────────────────────────

  describe("Stats cards", () => {
    it("displays busy stats: activeCount=3, completedToday=15, failedToday=2", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_BUSY,
        "jobs_queries:getAllJobs": [],
      });

      renderWithProviders(<JobsPage />);

      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("displays all zeros for empty stats", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_EMPTY,
        "jobs_queries:getAllJobs": [],
      });

      renderWithProviders(<JobsPage />);

      const zeros = screen.getAllByText("0");
      expect(zeros).toHaveLength(3);
    });
  });

  // ── Active Tab ───────────────────────────────────────────────────────

  describe("Active tab", () => {
    it("shows loading state when active jobs query returns undefined", () => {
      // Don't set up queries - defaults to undefined
      renderWithProviders(<JobsPage />);

      const loadingStates = screen.getAllByTestId("loading-state");
      expect(loadingStates.length).toBeGreaterThanOrEqual(1);
    });

    it("shows empty/success state when no active jobs", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_EMPTY,
        "jobs_queries:getAllJobs": ACTIVE_JOBS_EMPTY,
      });

      renderWithProviders(<JobsPage />);

      expect(screen.getByText("No active jobs")).toBeInTheDocument();
      expect(screen.getByText("All background tasks have completed")).toBeInTheDocument();
    });

    it("renders multiple active job cards with types and domains", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_BUSY,
        "jobs_queries:getAllJobs": ACTIVE_JOBS_MULTIPLE,
      });

      renderWithProviders(<JobsPage />);

      expect(screen.getByText("Keyword Check")).toBeInTheDocument();
      expect(screen.getByText("SERP Fetch")).toBeInTheDocument();
      expect(screen.getByText("Content Gap Analysis")).toBeInTheDocument();
      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("blog.example.com")).toBeInTheDocument();
      expect(screen.getByText("shop.example.pl")).toBeInTheDocument();
    });

    it("renders progress bar at correct width for job with progress=50", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_BUSY,
        "jobs_queries:getAllJobs": [ACTIVE_JOB_WITH_PROGRESS],
      });

      const { container } = renderWithProviders(<JobsPage />);

      // Progress text
      expect(screen.getByText("50%")).toBeInTheDocument();

      // Progress bar element with width style
      const progressBar = container.querySelector('[style*="width: 50%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it("calls cancelAnyJob mutation when clicking Stop button", async () => {
      const user = userEvent.setup();
      const mutationMap = setupMutationMap();
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_BUSY,
        "jobs_queries:getAllJobs": [ACTIVE_JOB_WITH_PROGRESS],
      });

      renderWithProviders(<JobsPage />);

      const stopButton = screen.getByRole("button", { name: /Stop/i });
      await user.click(stopButton);

      const cancelJob = mutationMap.get("jobs_queries:cancelAnyJob");
      expect(cancelJob).toBeDefined();
      expect(cancelJob).toHaveBeenCalledWith({
        table: "keywordCheckJobs",
        jobId: "job_progress_1",
      });
    });
  });

  // ── History Tab ──────────────────────────────────────────────────────

  describe("History tab", () => {
    it("filters to show only failed jobs when Failed filter clicked", async () => {
      const user = userEvent.setup();

      // The history tab calls getAllJobs with filter param
      // We need to mock different responses for different filter args
      const allJobs = JOB_HISTORY_UNIFIED;
      const failedOnly = JOB_HISTORY_UNIFIED.filter((j) => j.status === "failed");

      vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
        if (args === "skip") return undefined;
        try {
          const name = getFunctionName(ref as any);
          if (name === "jobs_queries:getJobStats") return JOB_STATS_BUSY;
          if (name === "jobs_queries:getAllJobs") {
            const filter = (args as any)?.filter;
            if (filter === "failed") return failedOnly;
            return allJobs;
          }
          if (name === "jobs_queries:getScheduledJobs") return SCHEDULED_JOBS;
        } catch {
          // ignore
        }
        return undefined;
      }) as any);

      renderWithProviders(<JobsPage />);

      // Navigate to History tab
      await user.click(screen.getByText("History"));

      // Click Failed filter button (there may be multiple "Failed" texts, use getAllByText and pick the button)
      const failedElements = screen.getAllByText("Failed");
      const failedButton = failedElements.find((el) => el.tagName === "BUTTON");
      expect(failedButton).toBeDefined();
      await user.click(failedButton!);

      // Should show the failed job
      expect(screen.getByText("SERP Fetch")).toBeInTheDocument();
      expect(screen.getByText("DataForSEO API rate limit exceeded")).toBeInTheDocument();
    });
  });

  // ── Scheduled Tab ────────────────────────────────────────────────────

  describe("Scheduled tab", () => {
    it("renders scheduled jobs when tab is selected", async () => {
      const user = userEvent.setup();
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS_EMPTY,
        "jobs_queries:getAllJobs": [],
        "jobs_queries:getScheduledJobs": SCHEDULED_JOBS,
      });

      renderWithProviders(<JobsPage />);

      await user.click(screen.getByText("Scheduled"));

      expect(screen.getByText("Daily Keyword Refresh")).toBeInTheDocument();
      expect(screen.getByText("Weekly Visibility Update")).toBeInTheDocument();
      expect(screen.getByText("Monthly Backlink Audit")).toBeInTheDocument();
      expect(screen.getByText("Daily at 6:00 UTC")).toBeInTheDocument();
    });
  });
});
