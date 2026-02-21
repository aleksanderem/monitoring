/**
 * R17 — Command Palette integration tests.
 *
 * Tests:
 * 1. Cmd+K opens the command palette
 * 2. Typing in search input triggers searchAll query
 * 3. Results are grouped by category
 * 4. Clicking a domain result navigates to domain page
 * 5. Escape closes the palette
 * 6. Empty state shown when no results match
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEARCH_RESULTS = {
  domains: [
    { id: "domain_1", name: "example.com", projectName: "My Project", projectId: "proj_1", type: "domain" as const },
    { id: "domain_2", name: "test-site.org", projectName: "Another Project", projectId: "proj_2", type: "domain" as const },
  ],
  keywords: [
    { id: "kw_1", phrase: "best seo tools", domainName: "example.com", domainId: "domain_1", type: "keyword" as const },
  ],
  projects: [
    { id: "proj_1", name: "My Project", type: "project" as const },
  ],
};

const EMPTY_RESULTS = {
  domains: [],
  keywords: [],
  projects: [],
};

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

function setupQueryMock(responses: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    return responses[key] ?? undefined;
  }) as any);
}

// Import AFTER mocks
import { CommandPalette } from "@/components/application/command-menus/command-palette";
import { CommandProvider } from "@/providers/CommandProvider";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("R17: Command Palette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  });

  it("Cmd+K opens the command palette", () => {
    render(<CommandProvider><div>App content</div></CommandProvider>);

    // Palette should not be visible initially
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();

    // Fire Cmd+K
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    // Palette should now be visible
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
    expect(screen.getByTestId("command-palette-input")).toBeInTheDocument();
  });

  it("Ctrl+K also opens the command palette", () => {
    render(<CommandProvider><div>App content</div></CommandProvider>);

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });

  it("typing in search input triggers searchAll query", () => {
    vi.useFakeTimers();

    setupQueryMock({ "search:searchAll": SEARCH_RESULTS });

    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "example" } });

    // Advance past the debounce
    act(() => { vi.advanceTimersByTime(300); });

    // useQuery should have been called with the debounced term
    expect(vi.mocked(useQuery)).toHaveBeenCalled();

    // Find a call where args is not "skip" (i.e., actual query was issued)
    const calls = vi.mocked(useQuery).mock.calls;
    const nonSkipCall = calls.find((c) => c[1] !== "skip");
    expect(nonSkipCall).toBeDefined();

    vi.useRealTimers();
  });

  it("results are grouped by category", () => {
    setupQueryMock({ "search:searchAll": SEARCH_RESULTS });

    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);

    // Simulate having a search term by setting up the mock to return results
    // The component queries when debouncedTerm has content, but we can test
    // rendering by providing results directly
    // We need to trigger the search; set initial state via the input
    vi.useFakeTimers();
    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "test" } });
    act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();

    // Check category headers exist
    expect(screen.getByText("domains")).toBeInTheDocument();
    expect(screen.getByText("keywords")).toBeInTheDocument();
    expect(screen.getByText("projects")).toBeInTheDocument();

    // Check result items (example.com appears as both domain name and keyword sublabel)
    expect(screen.getAllByText("example.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("test-site.org")).toBeInTheDocument();
    expect(screen.getByText("best seo tools")).toBeInTheDocument();
    // "My Project" appears as both domain sublabel and project name
    expect(screen.getAllByText("My Project").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a domain result navigates to domain page", () => {
    setupQueryMock({ "search:searchAll": SEARCH_RESULTS });
    const onOpenChange = vi.fn();

    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    vi.useFakeTimers();
    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "example" } });
    act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();

    // Click on a domain result
    const domainResult = screen.getByTestId("result-domain_1");
    fireEvent.click(domainResult);

    expect(mockPush).toHaveBeenCalledWith("/domains/domain_1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clicking a project result navigates to project page", () => {
    setupQueryMock({ "search:searchAll": SEARCH_RESULTS });
    const onOpenChange = vi.fn();

    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    vi.useFakeTimers();
    fireEvent.change(screen.getByTestId("command-palette-input"), { target: { value: "project" } });
    act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();

    const projectResult = screen.getByTestId("result-proj_1");
    fireEvent.click(projectResult);

    expect(mockPush).toHaveBeenCalledWith("/projects/proj_1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape closes the palette", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByTestId("command-palette-input"), { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clicking overlay closes the palette", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId("command-palette-overlay"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("empty state shown when no results match", () => {
    setupQueryMock({ "search:searchAll": EMPTY_RESULTS });
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);

    vi.useFakeTimers();
    fireEvent.change(screen.getByTestId("command-palette-input"), { target: { value: "xyznonexistent" } });
    act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();

    expect(screen.getByTestId("no-results")).toBeInTheDocument();
    expect(screen.getByText("noResults")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<CommandPalette open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("keyboard navigation with arrow keys and Enter", () => {
    setupQueryMock({ "search:searchAll": SEARCH_RESULTS });
    const onOpenChange = vi.fn();

    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    vi.useFakeTimers();
    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "test" } });
    act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();

    // First item should be active by default (index 0 = first domain)
    // Press ArrowDown to move to second item
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press Enter to navigate to second item (test-site.org → domain_2)
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/domains/domain_2");
  });
});
