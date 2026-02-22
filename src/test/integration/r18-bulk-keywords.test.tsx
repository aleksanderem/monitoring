/**
 * R18: Bulk Keyword Management integration tests.
 *
 * Tests the 4 bulk mutations (delete, move to group, change tags, pause/resume)
 * and the corresponding UI modals and bulk action bar wiring.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/domains/test-domain-id",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "test-domain-id" }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.remove", "keywords.refresh"],
    modules: ["positioning", "competitors"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.remove", "keywords.refresh"],
    modules: ["positioning", "competitors"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));

vi.mock("@/hooks/useDateRange", () => ({
  useDateRange: () => ({
    dateRange: { from: new Date("2025-01-01"), to: new Date("2025-01-31") },
    setDateRange: vi.fn(),
    comparisonRange: null,
    setComparisonRange: vi.fn(),
    preset: "30d",
    setPreset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-breakpoint", () => ({
  useBreakpoint: () => true,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: () => <span data-testid="ez-icon" />,
}));

vi.mock("@/components/domain/charts/KeywordPositionChart", () => ({
  KeywordPositionChart: () => <div data-testid="keyword-position-chart">Chart</div>,
}));

vi.mock("@/components/domain/modals/AddKeywordsModal", () => ({
  AddKeywordsModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-keywords-modal">Add Keywords Modal</div> : null,
}));

vi.mock("@/components/domain/modals/KeywordMonitoringDetailModal", () => ({
  KeywordMonitoringDetailModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="keyword-detail-modal">Keyword Detail Modal</div> : null,
}));

vi.mock("@/components/domain/modals/RefreshConfirmModal", () => ({
  RefreshConfirmModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="refresh-confirm-modal">Refresh Confirm Modal</div> : null,
}));

// Override the global next-intl mock to include NextIntlClientProvider
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

vi.mock("motion/react", () => {
  const Component = ({ children, ...props }: Record<string, unknown>) => {
    const domSafe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (["className", "style", "id", "role", "onClick", "data-testid"].includes(k)) domSafe[k] = v;
    }
    return <div {...domSafe}>{children as React.ReactNode}</div>;
  };
  return {
    motion: new Proxy({}, { get: () => Component, has: () => true }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
    animate: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { KEYWORD_MONITORING_LIST, makeKeyword } from "@/test/fixtures/keywords";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";

const DOMAIN_ID = "domain_active_1" as any;

// ---------------------------------------------------------------------------
// Query mock helper
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueryMock(queryResponses: QueryMap) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in queryResponses) return queryResponses[name];
    } catch {
      // not a valid function reference
    }
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Mutation mock helper
// ---------------------------------------------------------------------------

function setupMutationMock() {
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

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Test keywords
// ---------------------------------------------------------------------------

const THREE_KEYWORDS = [
  makeKeyword({ keywordId: "kw_1" as any, phrase: "seo tools" }),
  makeKeyword({ keywordId: "kw_2" as any, phrase: "keyword research" }),
  makeKeyword({ keywordId: "kw_3" as any, phrase: "link building" }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("R18: Bulk Keyword Management", () => {
  // =========================================================================
  // Bulk Action Bar visibility
  // =========================================================================

  describe("Bulk Action Bar", () => {
    it("shows bulk action bar when rows are selected", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      setupMutationMock();

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Initially no bulk bar
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();

      // Select a checkbox
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]); // first row checkbox (index 0 is header)

      // Should show bulk action bar with all actions
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      expect(screen.getByText("Move to group")).toBeInTheDocument();
      expect(screen.getByText("Change tags")).toBeInTheDocument();
      expect(screen.getByText("Pause")).toBeInTheDocument();
      expect(screen.getByText("Resume")).toBeInTheDocument();
      expect(screen.getByText("Delete selected")).toBeInTheDocument();
    });

    it("shows correct count when multiple rows are selected via select-all", () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      setupMutationMock();

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Click select-all checkbox (header)
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Bulk Delete
  // =========================================================================

  describe("Bulk Delete", () => {
    it("opens BulkDeleteConfirmModal when clicking delete in bulk bar", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      const mutationMap = setupMutationMock();

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select 2 rows
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      // Click "Delete selected" bulk action
      const deleteBtn = screen.getByText("Delete selected");
      fireEvent.click(deleteBtn);

      // Modal should open with confirmation text
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete 2 keywords/)).toBeInTheDocument();
      });
    });

    it("calls bulkDeleteKeywords mutation on confirm", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      const mutationMap = setupMutationMock();
      mutationMap.get("keywords:bulkDeleteKeywords")?.mockResolvedValue(2);

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select rows and open modal
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      fireEvent.click(screen.getByText("Delete selected"));

      // Wait for modal and click confirm
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete 2 keywords/)).toBeInTheDocument();
      });

      // Find the delete button inside the modal (not the bulk bar one)
      const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
      // The modal's delete button is the last one rendered
      const confirmBtn = deleteButtons[deleteButtons.length - 1];
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mutationMap.get("keywords:bulkDeleteKeywords")).toHaveBeenCalledWith({
          keywordIds: ["kw_1", "kw_2"],
          domainId: DOMAIN_ID,
        });
      });
    });
  });

  // =========================================================================
  // Bulk Move to Group
  // =========================================================================

  describe("Bulk Move to Group", () => {
    it("opens BulkMoveToGroupModal when clicking move in bulk bar", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
        "keywordGroups_queries:getGroupsByDomain": [
          { _id: "grp_1", name: "Brand Keywords", keywordCount: 5, color: "#FF0000", domainId: DOMAIN_ID, createdAt: Date.now() },
        ],
      });
      setupMutationMock();

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select a row
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      // Click "Move to group"
      fireEvent.click(screen.getByText("Move to group"));

      // Modal should appear with group selector
      await waitFor(() => {
        expect(screen.getByText("Move to Group")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Bulk Change Tags
  // =========================================================================

  describe("Bulk Change Tags", () => {
    it("opens BulkChangeTagsModal when clicking tags in bulk bar", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      setupMutationMock();

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select rows
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      // Click "Change tags"
      fireEvent.click(screen.getByText("Change tags"));

      // Modal should appear with tag input and operation radio buttons
      await waitFor(() => {
        expect(screen.getByText("Change Tags")).toBeInTheDocument();
        expect(screen.getByText("Add tags to existing")).toBeInTheDocument();
        expect(screen.getByText("Remove specified tags")).toBeInTheDocument();
        expect(screen.getByText("Replace all tags")).toBeInTheDocument();
      });
    });

    it("calls bulkChangeTags with add operation and tags from input", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      const mutationMap = setupMutationMock();
      mutationMap.get("keywords:bulkChangeTags")?.mockResolvedValue(1);

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select and open modal
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);
      fireEvent.click(screen.getByText("Change tags"));

      await waitFor(() => {
        expect(screen.getByText("Change Tags")).toBeInTheDocument();
      });

      // Type tags
      const tagInput = screen.getByPlaceholderText("tag1, tag2, tag3");
      fireEvent.change(tagInput, { target: { value: "seo, marketing" } });

      // Confirm (add is the default operation)
      const confirmBtn = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mutationMap.get("keywords:bulkChangeTags")).toHaveBeenCalledWith({
          keywordIds: ["kw_1"],
          tags: ["seo", "marketing"],
          operation: "add",
          domainId: DOMAIN_ID,
        });
      });
    });
  });

  // =========================================================================
  // Bulk Toggle Status (Pause/Resume)
  // =========================================================================

  describe("Bulk Toggle Status", () => {
    it("calls bulkToggleStatus with 'paused' when clicking Pause", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      const mutationMap = setupMutationMock();
      mutationMap.get("keywords:bulkToggleStatus")?.mockResolvedValue(2);

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select 2 rows
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      // Click "Pause"
      fireEvent.click(screen.getByText("Pause"));

      await waitFor(() => {
        expect(mutationMap.get("keywords:bulkToggleStatus")).toHaveBeenCalledWith({
          keywordIds: ["kw_1", "kw_2"],
          status: "paused",
          domainId: DOMAIN_ID,
        });
      });
    });

    it("calls bulkToggleStatus with 'active' when clicking Resume", async () => {
      setupQueryMock({
        "keywords:getKeywordMonitoring": THREE_KEYWORDS,
        "keywordSerpJobs:getActiveJobForDomain": null,
      });
      const mutationMap = setupMutationMock();
      mutationMap.get("keywords:bulkToggleStatus")?.mockResolvedValue(1);

      renderWithProviders(<KeywordMonitoringTable domainId={DOMAIN_ID} />);

      // Select 1 row
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      // Click "Resume"
      fireEvent.click(screen.getByText("Resume"));

      await waitFor(() => {
        expect(mutationMap.get("keywords:bulkToggleStatus")).toHaveBeenCalledWith({
          keywordIds: ["kw_1"],
          status: "active",
          domainId: DOMAIN_ID,
        });
      });
    });
  });
});
