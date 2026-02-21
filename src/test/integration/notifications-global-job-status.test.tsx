/**
 * Integration tests for GlobalJobStatus component.
 *
 * The component renders a fixed-position panel showing active background jobs,
 * with expand/collapse, cancel functionality, and toast notifications for failures.
 *
 * Data flow:
 * - useQuery(api.jobs_queries.getAllJobs, { filter: "active" }) -> active job list
 * - useQuery(api.jobs_queries.getAllJobs, { filter: "recentlyFailed" }) -> failed jobs (toast triggers)
 * - useMutation(api.jobs_queries.cancelAnyJob) -> cancel a running job
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();
const mockCancelJob = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockCancelJob,
  useAction: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_JOB_PROCESSING = {
  id: "job_1",
  type: "Keyword Check",
  domainName: "example.com",
  status: "processing",
  progress: 65,
  table: "keywordCheckJobs",
  currentStep: "Checking positions...",
};

const ACTIVE_JOB_PENDING = {
  id: "job_2",
  type: "SERP Fetch",
  domainName: "test.com",
  status: "pending",
  progress: null,
  table: "keywordSerpJobs",
  currentStep: null,
};

const FAILED_JOB = {
  id: "job_3",
  type: "On-Site Scan",
  domainName: "broken.com",
  status: "failed",
  error: "API quota exceeded",
  table: "onSiteScans",
};

const FAILED_JOB_2 = {
  id: "job_4",
  type: "Keyword Check",
  domainName: "another.com",
  status: "failed",
  error: "Timeout error",
  table: "keywordCheckJobs",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let activeJobsData: any[] | undefined;
let failedJobsData: any[] | undefined;

function setupMocks(
  active: any[] | undefined = [],
  failed: any[] | undefined = [],
) {
  activeJobsData = active;
  failedJobsData = failed;
  mockUseQuery.mockImplementation((_ref: any, args: any) => {
    if (args?.filter === "active") return activeJobsData;
    if (args?.filter === "recentlyFailed") return failedJobsData;
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let GlobalJobStatus: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockCancelJob.mockResolvedValue(undefined);
  activeJobsData = [];
  failedJobsData = [];
  const mod = await import(
    "@/components/domain/job-status/GlobalJobStatus"
  );
  GlobalJobStatus = mod.GlobalJobStatus;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GlobalJobStatus", () => {
  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe("Rendering", () => {
    it("returns null when active jobs is an empty array", () => {
      setupMocks([], []);
      const { container } = renderWithProviders(<GlobalJobStatus />);
      expect(container.innerHTML).toBe("");
    });

    it("returns null when active jobs query is undefined (loading)", () => {
      setupMocks(undefined, undefined);
      const { container } = renderWithProviders(<GlobalJobStatus />);
      expect(container.innerHTML).toBe("");
    });

    it("renders the panel when active jobs exist", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);
      // The header text uses ICU plural: "1 job running"
      expect(screen.getByText(/1 job running/i)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------
  describe("Header", () => {
    it("shows correct job count for multiple jobs", () => {
      setupMocks([ACTIVE_JOB_PROCESSING, ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.getByText(/2 jobs running/i)).toBeInTheDocument();
    });

    it("shows processing/pending breakdown", () => {
      setupMocks([ACTIVE_JOB_PROCESSING, ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      // "1 processing, 1 pending"
      expect(screen.getByText(/1 processing, 1 pending/i)).toBeInTheDocument();
    });

    it("toggle button collapses the list", async () => {
      const user = userEvent.setup();
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);

      // Initially expanded — domain name visible
      expect(screen.getByText("example.com")).toBeInTheDocument();

      // Click header to collapse
      await user.click(screen.getByText(/1 job running/i));

      // Domain name should be hidden
      expect(screen.queryByText("example.com")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Job list
  // -----------------------------------------------------------------------
  describe("Job list", () => {
    it("shows job type badge for each job", () => {
      setupMocks([ACTIVE_JOB_PROCESSING, ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.getByText("Keyword Check")).toBeInTheDocument();
      expect(screen.getByText("SERP Fetch")).toBeInTheDocument();
    });

    it("shows domain name for each job", () => {
      setupMocks([ACTIVE_JOB_PROCESSING, ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("test.com")).toBeInTheDocument();
    });

    it("shows progress bar when progress is not null", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);
      // Progress percentage text
      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    it("does not show progress bar when progress is null", () => {
      setupMocks([ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.queryByText("%")).not.toBeInTheDocument();
    });

    it("shows currentStep text when available", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.getByText("Checking positions...")).toBeInTheDocument();
    });

    it("does not show currentStep when null", () => {
      setupMocks([ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.queryByText("Checking positions...")).not.toBeInTheDocument();
    });

    it("shows translated status text for processing job with progress", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);
      // The translateStatus function renders "Processing" for "processing"
      expect(screen.getByText("Processing")).toBeInTheDocument();
    });

    it("shows translated status text for pending job without progress", () => {
      setupMocks([ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Cancel functionality
  // -----------------------------------------------------------------------
  describe("Cancel functionality", () => {
    it("shows cancel button for each job", () => {
      setupMocks([ACTIVE_JOB_PROCESSING, ACTIVE_JOB_PENDING], []);
      renderWithProviders(<GlobalJobStatus />);
      const cancelButtons = screen.getAllByTitle(/stop job/i);
      expect(cancelButtons).toHaveLength(2);
    });

    it("calls cancelAnyJob with table and jobId on cancel click", async () => {
      const user = userEvent.setup();
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);

      await user.click(screen.getByTitle(/stop job/i));

      await waitFor(() => {
        expect(mockCancelJob).toHaveBeenCalledWith({
          table: "keywordCheckJobs",
          jobId: "job_1",
        });
      });
    });

    it("shows success toast after successful cancel", async () => {
      const user = userEvent.setup();
      mockCancelJob.mockResolvedValue(undefined);
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);

      await user.click(screen.getByTitle(/stop job/i));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Job cancelled");
      });
    });

    it("shows error toast on failed cancel", async () => {
      const user = userEvent.setup();
      mockCancelJob.mockRejectedValue(new Error("Network error"));
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);

      await user.click(screen.getByTitle(/stop job/i));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to cancel job");
      });
    });
  });

  // -----------------------------------------------------------------------
  // Failed job notifications
  // -----------------------------------------------------------------------
  describe("Failed job notifications", () => {
    it("shows toast.error for newly failed jobs", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], [FAILED_JOB]);
      renderWithProviders(<GlobalJobStatus />);

      expect(toast.error).toHaveBeenCalledWith(
        // "On-Site Scan failed: broken.com" from keywords.jobFailedToast
        expect.stringContaining("broken.com"),
        expect.objectContaining({ description: "API quota exceeded" }),
      );
    });

    it("toast includes job type in message", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], [FAILED_JOB]);
      renderWithProviders(<GlobalJobStatus />);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("On-Site Scan"),
        expect.anything(),
      );
    });

    it("does not show duplicate toasts for the same failed job on re-render", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], [FAILED_JOB]);
      const { rerender } = renderWithProviders(<GlobalJobStatus />);

      expect(toast.error).toHaveBeenCalledTimes(1);

      // Re-render with the same failed job data
      rerender(
        <GlobalJobStatus />,
      );

      // Should still be 1, not 2
      expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it("shows separate toasts for multiple failed jobs", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], [FAILED_JOB, FAILED_JOB_2]);
      renderWithProviders(<GlobalJobStatus />);

      expect(toast.error).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Expand / Collapse
  // -----------------------------------------------------------------------
  describe("Expand / Collapse", () => {
    it("is initially expanded (job details visible)", () => {
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);
      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    it("click header toggles to collapsed (details hidden)", async () => {
      const user = userEvent.setup();
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);

      // Collapse
      await user.click(screen.getByText(/1 job running/i));
      expect(screen.queryByText("example.com")).not.toBeInTheDocument();
    });

    it("click again re-expands", async () => {
      const user = userEvent.setup();
      setupMocks([ACTIVE_JOB_PROCESSING], []);
      renderWithProviders(<GlobalJobStatus />);

      // Collapse
      await user.click(screen.getByText(/1 job running/i));
      expect(screen.queryByText("example.com")).not.toBeInTheDocument();

      // Re-expand
      await user.click(screen.getByText(/1 job running/i));
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });
  });
});
