/**
 * R09 — AI Report Engine Integration Tests
 *
 * Tests the report generation wizard, session progress tracking,
 * and generated reports list components.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn(() => undefined);
const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/domains/test/reports",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "test-domain-id" }),
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
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
      mutationMap.set(key, vi.fn().mockResolvedValue("session-id-123"));
    }
    return mutationMap.get(key)!;
  }) as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DOMAIN_ID = "test-domain-id" as any;
const SESSION_ID = "session-id-1" as any;

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    _id: SESSION_ID,
    _creationTime: Date.now(),
    domainId: DOMAIN_ID,
    organizationId: "org-1" as any,
    createdBy: "user-1" as any,
    reportType: "executive-summary",
    config: {
      dateRange: { start: Date.now() - 7 * 86400000, end: Date.now() },
      sections: ["overview", "keywords"],
    },
    status: "analyzing",
    progress: 45,
    currentStep: "Running keyword analysis...",
    createdAt: Date.now() - 60000,
    ...overrides,
  };
}

const SESSION_COMPLETED = makeSession({
  _id: "session-2" as any,
  status: "completed",
  progress: 100,
  currentStep: "Report generated",
  completedAt: Date.now(),
});

const SESSION_FAILED = makeSession({
  _id: "session-3" as any,
  status: "failed",
  progress: 40,
  currentStep: "Analysis failed",
  error: "API rate limit exceeded",
});

const SESSION_LIST = [
  makeSession(),
  SESSION_COMPLETED,
  makeSession({
    _id: "session-4" as any,
    reportType: "competitor-analysis",
    status: "collecting",
    progress: 20,
  }),
];

// ---------------------------------------------------------------------------
// 1) ReportGenerationWizard tests
// ---------------------------------------------------------------------------

describe("ReportGenerationWizard", () => {
  let ReportGenerationWizard: React.ComponentType<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupMutationMock();
    const mod = await import(
      "@/components/domain/reports/ReportGenerationWizard"
    );
    ReportGenerationWizard = mod.ReportGenerationWizard;
  });

  it("renders type selection buttons on step 1", () => {
    render(<ReportGenerationWizard domainId={DOMAIN_ID} />);

    expect(screen.getByText("reportTypeExecutive")).toBeInTheDocument();
    expect(screen.getByText("reportTypeKeyword")).toBeInTheDocument();
    expect(screen.getByText("reportTypeCompetitor")).toBeInTheDocument();
    expect(screen.getByText("reportTypeProgress")).toBeInTheDocument();
  });

  it("shows date range options after selecting a report type", () => {
    render(<ReportGenerationWizard domainId={DOMAIN_ID} />);

    fireEvent.click(screen.getByText("reportTypeExecutive"));

    expect(screen.getByText("reportLast7")).toBeInTheDocument();
    expect(screen.getByText("reportLast14")).toBeInTheDocument();
    expect(screen.getByText("reportLast30")).toBeInTheDocument();
    expect(screen.getByText("reportLast90")).toBeInTheDocument();
  });

  it("shows review step after selecting date range", () => {
    render(<ReportGenerationWizard domainId={DOMAIN_ID} />);

    fireEvent.click(screen.getByText("reportTypeExecutive"));
    fireEvent.click(screen.getByText("reportLast30"));

    // "reportReview" appears in step indicator and as heading
    const reviewTexts = screen.getAllByText("reportReview");
    expect(reviewTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("reportGenerate")).toBeInTheDocument();
  });

  it("calls createReportSession mutation on generate", async () => {
    render(<ReportGenerationWizard domainId={DOMAIN_ID} />);

    fireEvent.click(screen.getByText("reportTypeExecutive"));
    fireEvent.click(screen.getByText("reportLast30"));
    fireEvent.click(screen.getByText("reportGenerate"));

    const createFn = mutationMap.get("aiReports:createReportSession");
    await waitFor(() => {
      expect(createFn).toHaveBeenCalledTimes(1);
    });

    const callArgs = createFn!.mock.calls[0][0];
    expect(callArgs.domainId).toBe(DOMAIN_ID);
    expect(callArgs.reportType).toBe("executive-summary");
    expect(callArgs.config.sections).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2) ReportSessionProgress tests
// ---------------------------------------------------------------------------

describe("ReportSessionProgress", () => {
  let ReportSessionProgress: React.ComponentType<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupMutationMock();
    const mod = await import(
      "@/components/domain/reports/ReportSessionProgress"
    );
    ReportSessionProgress = mod.ReportSessionProgress;
  });

  it("shows progress bar with correct percentage", () => {
    const session = makeSession({ progress: 45 });
    setupQueryMock({ "aiReports:getReportSession": session });

    render(<ReportSessionProgress sessionId={SESSION_ID} />);

    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows current step text", () => {
    const session = makeSession({ currentStep: "Running keyword analysis..." });
    setupQueryMock({ "aiReports:getReportSession": session });

    render(<ReportSessionProgress sessionId={SESSION_ID} />);

    expect(screen.getByText("Running keyword analysis...")).toBeInTheDocument();
  });

  it("shows completed status badge", () => {
    setupQueryMock({ "aiReports:getReportSession": SESSION_COMPLETED });

    render(<ReportSessionProgress sessionId={"session-2" as any} />);

    expect(screen.getByText("reportStatusCompleted")).toBeInTheDocument();
  });

  it("shows failed status with error message", () => {
    setupQueryMock({ "aiReports:getReportSession": SESSION_FAILED });

    render(<ReportSessionProgress sessionId={"session-3" as any} />);

    expect(screen.getByText("reportStatusFailed")).toBeInTheDocument();
    expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
  });

  it("shows cancel button for in-progress sessions", () => {
    const session = makeSession({ status: "analyzing" });
    setupQueryMock({ "aiReports:getReportSession": session });

    render(<ReportSessionProgress sessionId={SESSION_ID} />);

    expect(screen.getByText("reportCancel")).toBeInTheDocument();
  });

  it("hides cancel button for completed sessions", () => {
    setupQueryMock({ "aiReports:getReportSession": SESSION_COMPLETED });

    render(<ReportSessionProgress sessionId={"session-2" as any} />);

    expect(screen.queryByText("reportCancel")).not.toBeInTheDocument();
  });

  it("shows loading state when query returns undefined", () => {
    setupQueryMock({});

    render(<ReportSessionProgress sessionId={SESSION_ID} />);

    // Should show animate-pulse skeleton
    const card = screen.getByText("", { selector: ".animate-pulse" });
    expect(card).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3) GeneratedReportsList tests
// ---------------------------------------------------------------------------

describe("GeneratedReportsList", () => {
  let GeneratedReportsList: React.ComponentType<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import(
      "@/components/domain/reports/GeneratedReportsList"
    );
    GeneratedReportsList = mod.GeneratedReportsList;
  });

  it("renders reports table with session data", () => {
    setupQueryMock({ "aiReports:getReportSessions": SESSION_LIST });

    render(<GeneratedReportsList domainId={DOMAIN_ID} />);

    // Check table headers
    expect(screen.getByText("reportType")).toBeInTheDocument();
    expect(screen.getByText("reportStatus")).toBeInTheDocument();
    expect(screen.getByText("reportProgress")).toBeInTheDocument();
    expect(screen.getByText("reportCreated")).toBeInTheDocument();

    // Check data rows exist
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("shows empty state when no reports exist", () => {
    setupQueryMock({ "aiReports:getReportSessions": [] });

    render(<GeneratedReportsList domainId={DOMAIN_ID} />);

    expect(screen.getByText("noReports")).toBeInTheDocument();
  });

  it("shows loading state when query returns undefined", () => {
    setupQueryMock({});

    render(<GeneratedReportsList domainId={DOMAIN_ID} />);

    // Should show animate-pulse skeleton
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("shows correct status badges for different statuses", () => {
    setupQueryMock({ "aiReports:getReportSessions": SESSION_LIST });

    render(<GeneratedReportsList domainId={DOMAIN_ID} />);

    // Should have status labels for each session
    expect(screen.getByText("reportStatusAnalyzing")).toBeInTheDocument();
    expect(screen.getByText("reportStatusCompleted")).toBeInTheDocument();
    expect(screen.getByText("reportStatusCollecting")).toBeInTheDocument();
  });

  it("shows report type labels", () => {
    setupQueryMock({ "aiReports:getReportSessions": SESSION_LIST });

    render(<GeneratedReportsList domainId={DOMAIN_ID} />);

    // Two sessions with executive-summary, one with competitor-analysis
    const executiveLabels = screen.getAllByText("reportTypeExecutive");
    expect(executiveLabels.length).toBe(2);
    expect(screen.getByText("reportTypeCompetitor")).toBeInTheDocument();
  });
});
