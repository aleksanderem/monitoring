/**
 * Integration tests for the Jobs page.
 * Tests loading, empty, active jobs, stats, and tab rendering.
 *
 * useTranslations is globally mocked as a key passthrough (from setup.ts),
 * so t("noActiveJobs") returns "noActiveJobs".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { JOB_STATS } from "@/test/fixtures/jobs";

// ---------------------------------------------------------------------------
// Mocks (hoisted)
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

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("motion/react", () => ({
  motion: new Proxy({}, { get: () => (props: Record<string, unknown>) => <div {...props} /> }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Fixtures (UnifiedJob shape matching what the component expects)
// ---------------------------------------------------------------------------

const ACTIVE_JOB_UNIFIED = {
  id: "job_1",
  table: "keywordCheckJobs",
  type: "Keyword Check",
  domainName: "example.com",
  status: "processing" as const,
  progress: 48,
  currentStep: "Checking keywords 22/45",
  createdAt: Date.now() - 5 * 60 * 1000,
  startedAt: Date.now() - 4 * 60 * 1000,
};

const SECOND_ACTIVE_JOB = {
  id: "job_2",
  table: "serpFetchJobs",
  type: "SERP Fetch",
  domainName: "blog.example.com",
  status: "pending" as const,
  createdAt: Date.now() - 2 * 60 * 1000,
};

const SCHEDULED_JOBS = [
  {
    name: "Daily Keyword Check",
    description: "Checks all tracked keyword positions",
    schedule: "Every day at 6:00 AM",
  },
  {
    name: "Weekly Backlink Scan",
    description: "Scans for new backlinks",
    schedule: "Every Monday at 3:00 AM",
  },
];

const HISTORY_COMPLETED_JOB = {
  id: "job_h1",
  table: "keywordCheckJobs",
  type: "Keyword Check",
  domainName: "example.com",
  status: "completed" as const,
  progress: 100,
  createdAt: Date.now() - 2 * 60 * 60 * 1000,
  startedAt: Date.now() - 2 * 60 * 60 * 1000 + 5000,
  completedAt: Date.now() - 2 * 60 * 60 * 1000 + 180000,
};

const HISTORY_FAILED_JOB = {
  id: "job_h2",
  table: "serpFetchJobs",
  type: "SERP Fetch",
  domainName: "example.com",
  status: "failed" as const,
  createdAt: Date.now() - 4 * 60 * 60 * 1000,
  startedAt: Date.now() - 4 * 60 * 60 * 1000 + 2000,
  completedAt: Date.now() - 4 * 60 * 60 * 1000 + 60000,
  error: "DataForSEO API rate limit exceeded",
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let JobsPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  const mod = await import("@/app/(dashboard)/jobs/page");
  JobsPage = mod.default;
});

describe("Jobs Page", () => {
  describe("Stats header cards", () => {
    it("shows dash placeholders when stats are loading", () => {
      render(<JobsPage />);

      const dashElements = screen.getAllByText("\u2014");
      expect(dashElements.length).toBeGreaterThanOrEqual(3);
    });

    it("displays stat counts when loaded", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
      });

      render(<JobsPage />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("renders stat labels", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
      });

      render(<JobsPage />);

      expect(screen.getByText("activeNow")).toBeInTheDocument();
      expect(screen.getByText("completedToday")).toBeInTheDocument();
      expect(screen.getByText("failedToday")).toBeInTheDocument();
    });
  });

  describe("Active jobs tab", () => {
    it("shows loading state when active jobs are undefined", () => {
      render(<JobsPage />);

      const loadingStates = screen.getAllByTestId("loading-state");
      expect(loadingStates.length).toBeGreaterThanOrEqual(1);
    });

    it("shows success empty state when no active jobs", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
      });

      render(<JobsPage />);

      expect(screen.getByText("noActiveJobs")).toBeInTheDocument();
      expect(screen.getByText("allTasksCompleted")).toBeInTheDocument();
    });

    it("renders active job cards with type, domain, and progress", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [ACTIVE_JOB_UNIFIED],
      });

      render(<JobsPage />);

      expect(screen.getByText("Keyword Check")).toBeInTheDocument();
      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("48%")).toBeInTheDocument();
    });

    it("shows stop button on active job cards", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [ACTIVE_JOB_UNIFIED],
      });

      render(<JobsPage />);

      expect(screen.getByText("stop")).toBeInTheDocument();
    });

    it("renders progress bar for jobs with progress", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [ACTIVE_JOB_UNIFIED],
      });

      const { container } = render(<JobsPage />);

      const progressBar = container.querySelector('[style*="width: 48%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it("renders multiple active jobs", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [ACTIVE_JOB_UNIFIED, SECOND_ACTIVE_JOB],
      });

      render(<JobsPage />);

      expect(screen.getByText("Keyword Check")).toBeInTheDocument();
      expect(screen.getByText("SERP Fetch")).toBeInTheDocument();
      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    });
  });

  describe("Page header and tabs", () => {
    it("renders page title and description", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
      });

      render(<JobsPage />);

      expect(screen.getByText("title")).toBeInTheDocument();
      expect(screen.getByText("description")).toBeInTheDocument();
    });

    it("renders tab labels", () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
      });

      render(<JobsPage />);

      expect(screen.getByText("tabActive")).toBeInTheDocument();
      expect(screen.getByText("tabScheduled")).toBeInTheDocument();
      expect(screen.getByText("tabHistory")).toBeInTheDocument();
    });
  });

  describe("Scheduled jobs tab", () => {
    it("renders scheduled jobs when tab is selected", async () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
        "jobs_queries:getScheduledJobs": SCHEDULED_JOBS,
      });

      render(<JobsPage />);
      const user = userEvent.setup();

      await user.click(screen.getByText("tabScheduled"));

      expect(screen.getByText("Daily Keyword Check")).toBeInTheDocument();
      expect(screen.getByText("Weekly Backlink Scan")).toBeInTheDocument();
    });
  });

  describe("History tab", () => {
    it("renders history table when tab is selected", async () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [HISTORY_COMPLETED_JOB, HISTORY_FAILED_JOB],
        "jobs_queries:getScheduledJobs": SCHEDULED_JOBS,
      });

      render(<JobsPage />);
      const user = userEvent.setup();

      await user.click(screen.getByText("tabHistory"));

      expect(screen.getByText("columnType")).toBeInTheDocument();
      expect(screen.getByText("columnDomain")).toBeInTheDocument();
      expect(screen.getByText("columnStatus")).toBeInTheDocument();
      expect(screen.getByText("columnDuration")).toBeInTheDocument();

      expect(screen.getByText("Keyword Check")).toBeInTheDocument();
      expect(screen.getByText("SERP Fetch")).toBeInTheDocument();
    });

    it("shows error message for failed jobs in history", async () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [HISTORY_FAILED_JOB],
        "jobs_queries:getScheduledJobs": SCHEDULED_JOBS,
      });

      render(<JobsPage />);
      const user = userEvent.setup();

      await user.click(screen.getByText("tabHistory"));

      expect(screen.getByText("DataForSEO API rate limit exceeded")).toBeInTheDocument();
    });

    it("shows filter buttons (All, Completed, Failed)", async () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [HISTORY_COMPLETED_JOB],
        "jobs_queries:getScheduledJobs": SCHEDULED_JOBS,
      });

      render(<JobsPage />);
      const user = userEvent.setup();

      await user.click(screen.getByText("tabHistory"));

      expect(screen.getByText("filterAll")).toBeInTheDocument();
      expect(screen.getByText("filterCompleted")).toBeInTheDocument();
      expect(screen.getByText("filterFailed")).toBeInTheDocument();
    });

    it("shows empty state when no history jobs match filter", async () => {
      setupQueries({
        "jobs_queries:getJobStats": JOB_STATS,
        "jobs_queries:getAllJobs": [],
        "jobs_queries:getScheduledJobs": SCHEDULED_JOBS,
      });

      render(<JobsPage />);
      const user = userEvent.setup();

      await user.click(screen.getByText("tabHistory"));

      expect(screen.getByText("noJobsFound")).toBeInTheDocument();
    });
  });
});
