/**
 * Integration tests for JobCompletionNotifier component.
 *
 * Tests the toast notification behavior when keyword check jobs complete:
 * - toast.success for "completed" jobs (with domain, success/total/failed counts)
 * - toast.error for "failed" jobs (with domain and error message)
 * - toast.info for "cancelled" jobs (with domain and processed/total counts)
 * - Deduplication via useRef<Set<string>> (no duplicate toasts on re-render)
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { toast } from "sonner";
import { JobCompletionNotifier } from "@/components/domain/job-status/JobCompletionNotifier";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPLETED_JOB = {
  _id: "job_1",
  status: "completed",
  domainName: "example.com",
  totalKeywords: 50,
  failedKeywords: 2,
};

const FAILED_JOB = {
  _id: "job_2",
  status: "failed",
  domainName: "test.com",
  error: "API timeout",
  totalKeywords: 30,
  failedKeywords: 30,
};

const CANCELLED_JOB = {
  _id: "job_3",
  status: "cancelled",
  domainName: "demo.com",
  processedKeywords: 15,
  totalKeywords: 40,
  failedKeywords: 0,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JobCompletionNotifier", () => {
  describe("Rendering", () => {
    it("returns null — no visible DOM content", () => {
      const { container } = renderWithProviders(<JobCompletionNotifier />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("Loading state", () => {
    it("does nothing when query returns undefined", () => {
      mockUseQuery.mockReturnValue(undefined);
      renderWithProviders(<JobCompletionNotifier />);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe("Completed jobs", () => {
    it("shows toast.success for a completed job", () => {
      mockUseQuery.mockReturnValue([COMPLETED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("toast title includes the domain name", () => {
      mockUseQuery.mockReturnValue([COMPLETED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      const title = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(title).toContain("example.com");
    });

    it("toast description includes success count, total, and failed count", () => {
      mockUseQuery.mockReturnValue([COMPLETED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      const opts = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][1] as { description: string };
      // success = 50 - 2 = 48
      expect(opts.description).toContain("48");
      expect(opts.description).toContain("50");
      expect(opts.description).toContain("2");
    });

    it("uses domain fallback when domainName is missing", () => {
      mockUseQuery.mockReturnValue([{ ...COMPLETED_JOB, _id: "job_fallback", domainName: "" }]);
      renderWithProviders(<JobCompletionNotifier />);

      const title = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      // Should use the "domainFallback" translation ("domain")
      expect(title).toContain("domain");
    });
  });

  describe("Failed jobs", () => {
    it("shows toast.error for a failed job", () => {
      mockUseQuery.mockReturnValue([FAILED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it("toast title includes the domain name", () => {
      mockUseQuery.mockReturnValue([FAILED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      const title = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(title).toContain("test.com");
    });

    it("toast description includes the error message", () => {
      mockUseQuery.mockReturnValue([FAILED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      const opts = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1] as { description: string };
      expect(opts.description).toBe("API timeout");
    });

    it("uses 'Unknown error occurred' fallback when error is null", () => {
      mockUseQuery.mockReturnValue([{ ...FAILED_JOB, _id: "job_null_err", error: null }]);
      renderWithProviders(<JobCompletionNotifier />);

      const opts = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1] as { description: string };
      expect(opts.description).toBe("Unknown error occurred");
    });
  });

  describe("Cancelled jobs", () => {
    it("shows toast.info for a cancelled job", () => {
      mockUseQuery.mockReturnValue([CANCELLED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      expect(toast.info).toHaveBeenCalledTimes(1);
    });

    it("toast title includes the domain name", () => {
      mockUseQuery.mockReturnValue([CANCELLED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      const title = (toast.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(title).toContain("demo.com");
    });

    it("toast description includes processed and total counts", () => {
      mockUseQuery.mockReturnValue([CANCELLED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      const opts = (toast.info as ReturnType<typeof vi.fn>).mock.calls[0][1] as { description: string };
      expect(opts.description).toContain("15");
      expect(opts.description).toContain("40");
    });
  });

  describe("Deduplication", () => {
    it("does NOT show toast twice for the same job ID on re-render", () => {
      mockUseQuery.mockReturnValue([COMPLETED_JOB]);
      const { rerender } = renderWithProviders(<JobCompletionNotifier />);

      expect(toast.success).toHaveBeenCalledTimes(1);

      // Re-render with same data — should not fire again
      rerender(<JobCompletionNotifier />);
      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("shows toast for new jobs added after initial render", () => {
      mockUseQuery.mockReturnValue([COMPLETED_JOB]);
      const { rerender } = renderWithProviders(<JobCompletionNotifier />);

      expect(toast.success).toHaveBeenCalledTimes(1);

      // Second render adds a new job alongside the existing one
      const NEW_JOB = { ...COMPLETED_JOB, _id: "job_new", domainName: "new-site.com" };
      mockUseQuery.mockReturnValue([COMPLETED_JOB, NEW_JOB]);
      rerender(<JobCompletionNotifier />);

      // Original job should not re-fire; only the new one
      expect(toast.success).toHaveBeenCalledTimes(2);
    });
  });

  describe("Multiple jobs in one batch", () => {
    it("shows different toast types for each job status in the same batch", () => {
      mockUseQuery.mockReturnValue([COMPLETED_JOB, FAILED_JOB, CANCELLED_JOB]);
      renderWithProviders(<JobCompletionNotifier />);

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.info).toHaveBeenCalledTimes(1);
    });
  });
});
