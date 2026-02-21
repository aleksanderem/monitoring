/**
 * Integration tests for the Projects list page.
 * Tests loading, empty, populated, search filtering, and delete states.
 *
 * useTranslations is globally mocked as a key passthrough (from setup.ts),
 * so t("noProjectsFound") returns "noProjectsFound".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { mockPermissions } from "@/test/helpers/permissions-mock";
import { PROJECT_LIST, PROJECT_ACTIVE } from "@/test/fixtures/projects";
import React from "react";

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
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => mockPermissions(),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => mockPermissions(),
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/application/modals/create-project-dialog", () => ({
  CreateProjectDialog: () => <button data-testid="create-project-btn">Create Project</button>,
}));

vi.mock("@/components/application/modals/delete-confirmation-dialog", () => ({
  DeleteConfirmationDialog: ({
    children,
    onConfirm,
    title,
  }: {
    children: React.ReactNode;
    onConfirm: () => Promise<void>;
    title: string;
  }) => (
    <div data-testid="delete-dialog" data-title={title}>
      {children}
      <button data-testid="confirm-delete" onClick={() => onConfirm()}>
        Confirm Delete
      </button>
    </div>
  ),
}));

vi.mock("@/components/application/slideout-menus/project-details-slideout", () => ({
  ProjectDetailsSlideout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

// InputBase uses react-aria-components which doesn't fire onChange with string
// values in jsdom. Mock it as a simple controlled input.
vi.mock("@/components/base/input/input", () => ({
  InputBase: ({
    value,
    onChange,
    placeholder,
    ...rest
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    [k: string]: unknown;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label={rest["aria-label"] as string}
    />
  ),
  Input: ({ label, ...props }: { label?: string; [k: string]: unknown }) => (
    <div>
      {label && <label>{label}</label>}
      <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />
    </div>
  ),
}));

vi.mock("motion/react", () => ({
  motion: new Proxy({}, { get: () => (props: Record<string, unknown>) => <div {...props} /> }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configure useQuery to return data based on Convex function name.
 * Uses getFunctionName() to resolve proxy-based references.
 */
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
// Test suite
// ---------------------------------------------------------------------------

let ProjectsPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  const mod = await import("@/app/(dashboard)/projects/page");
  ProjectsPage = mod.default;
});

describe("Projects List Page", () => {
  it("shows loading skeleton when data is undefined", () => {
    render(<ProjectsPage />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    expect(screen.getByTestId("loading-state")).toHaveAttribute("data-type", "table");
  });

  it("shows empty state with create button when project list is empty", () => {
    setupQueries({ "projects:list": [] });
    render(<ProjectsPage />);

    expect(screen.getByText("noProjectsFound")).toBeInTheDocument();
    expect(screen.getByText("noProjectsDescription")).toBeInTheDocument();
    expect(screen.getByTestId("create-project-btn")).toBeInTheDocument();
  });

  it("renders project table with project data", () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);

    expect(screen.getByText("Main Project")).toBeInTheDocument();
    expect(screen.getByText("Blog Project")).toBeInTheDocument();

    // Domain counts
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    // Keyword counts
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("displays the page header and table header", () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
    expect(screen.getByText("allProjects")).toBeInTheDocument();
  });

  it("filters projects by search query", async () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText("searchPlaceholder");
    await user.type(searchInput, "Blog");

    expect(screen.getByText("Blog Project")).toBeInTheDocument();
    expect(screen.queryByText("Main Project")).not.toBeInTheDocument();
  });

  it("shows no results message when search matches nothing", async () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText("searchPlaceholder");
    await user.type(searchInput, "zzzznothing");

    expect(screen.getByText(/noSearchResults/)).toBeInTheDocument();
    expect(screen.getByText("clearSearch")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText("searchPlaceholder");
    await user.type(searchInput, "zzzznothing");

    // Verify search filtered out results
    expect(screen.queryByText("Main Project")).not.toBeInTheDocument();

    const clearBtn = screen.getByText("clearSearch");
    await user.click(clearBtn);

    expect(screen.getByText("Main Project")).toBeInTheDocument();
    expect(screen.getByText("Blog Project")).toBeInTheDocument();
  });

  it("triggers delete flow and calls mutation on confirm", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useMutation).mockReturnValue(deleteFn as any);
    setupQueries({ "projects:list": PROJECT_LIST });

    render(<ProjectsPage />);
    const user = userEvent.setup();

    const confirmButtons = screen.getAllByTestId("confirm-delete");
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(confirmButtons[0]);

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalled();
    });
  });

  it("shows create project button in header when projects exist", () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);

    const createBtns = screen.getAllByTestId("create-project-btn");
    expect(createBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("renders project links pointing to project detail pages", () => {
    setupQueries({ "projects:list": PROJECT_LIST });
    render(<ProjectsPage />);

    const link = screen.getByText("Main Project").closest("a");
    expect(link).toHaveAttribute("href", `/projects/${PROJECT_ACTIVE._id}`);
  });
});
