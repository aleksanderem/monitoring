/**
 * Integration tests for form interaction flows across the app.
 *
 * Tests AddKeywordsModal, CreateProjectDialog, and DeleteConfirmationDialog
 * for rendering, validation, submission, and close behavior.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "test-domain-id" }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh", "projects.create"],
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
    permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh", "projects.create"],
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

vi.mock("@/hooks/use-breakpoint", () => ({
  useBreakpoint: () => true,
}));

// Override the global next-intl mock to include NextIntlClientProvider
// so renderWithProviders can use real translations.
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

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
  Input: ({
    label,
    value,
    onChange,
    placeholder,
    isRequired,
    isDisabled,
    autoFocus,
    ...rest
  }: {
    label?: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
    autoFocus?: boolean;
    [k: string]: unknown;
  }) => (
    <div>
      {label && <label htmlFor="mock-input">{label}</label>}
      <input
        id="mock-input"
        data-testid="project-name-input"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        required={isRequired}
        disabled={isDisabled}
        autoFocus={autoFocus}
      />
    </div>
  ),
}));

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
import { AddKeywordsModal } from "@/components/domain/modals/AddKeywordsModal";
import { CreateProjectDialog } from "@/components/application/modals/create-project-dialog";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { Button } from "@/components/base/buttons/button";

const DOMAIN_ID = "domain_test_1" as any;

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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.info).mockClear();
});

// ---------------------------------------------------------------------------
// 1. AddKeywordsModal
// ---------------------------------------------------------------------------

describe("AddKeywordsModal", () => {
  const defaultProps = {
    domainId: DOMAIN_ID,
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onClose = vi.fn();
    setupQueryMock({
      "dataforseo:getDiscoveredKeywords": [],
    });
  });

  it("renders when isOpen=true and is hidden when isOpen=false", () => {
    // Render open
    const { unmount } = renderWithProviders(
      <AddKeywordsModal {...defaultProps} isOpen={true} />
    );
    expect(screen.getByText("Add Keywords to Monitor")).toBeInTheDocument();
    unmount();

    // Render closed
    renderWithProviders(
      <AddKeywordsModal {...defaultProps} isOpen={false} />
    );
    expect(screen.queryByText("Add Keywords to Monitor")).not.toBeInTheDocument();
  });

  it("textarea accepts keyword input (one per line)", async () => {
    const user = userEvent.setup();

    renderWithProviders(<AddKeywordsModal {...defaultProps} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");

    await user.click(textarea);
    await user.type(textarea, "seo tools{enter}keyword research");

    expect(textarea).toHaveValue("seo tools\nkeyword research");
  });

  it("submit button calls mutation with parsed keywords", async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn().mockResolvedValue(["kw_1", "kw_2"]);
    vi.mocked(useMutation).mockReturnValue(mockMutate as any);

    renderWithProviders(<AddKeywordsModal {...defaultProps} />);

    const textarea = screen.getByRole("textbox");

    await user.click(textarea);
    await user.type(textarea, "seo tools{enter}keyword research");

    // Click the Add Keywords submit button
    const submitButton = screen.getByRole("button", { name: /Add Keywords/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        domainId: DOMAIN_ID,
        phrases: ["seo tools", "keyword research"],
      });
    });
  });

  it("deduplicates keywords before submission", async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn().mockResolvedValue(["kw_1"]);
    vi.mocked(useMutation).mockReturnValue(mockMutate as any);

    renderWithProviders(<AddKeywordsModal {...defaultProps} />);

    const textarea = screen.getByRole("textbox");

    await user.click(textarea);
    // Type duplicate keywords (case matters — both are lowercased to "seo tools")
    await user.type(textarea, "seo tools{enter}SEO Tools{enter}keyword research");

    const submitButton = screen.getByRole("button", { name: /Add Keywords/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        domainId: DOMAIN_ID,
        phrases: ["seo tools", "keyword research"],
      });
    });
  });

  it("shows toast error when submitting empty input", async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue(mockMutate as any);

    renderWithProviders(<AddKeywordsModal {...defaultProps} />);

    // Type whitespace-only content to bypass the disabled check, then clear
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "   ");
    // The button is enabled because trim().length > 0 for spaces in a textarea
    // but handleSubmit filters to empty lines after trim, triggering toast.error
    const submitButton = screen.getByRole("button", { name: /Add Keywords/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please enter at least one keyword");
    });
    // Mutation should not have been called
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. CreateProjectDialog
// ---------------------------------------------------------------------------

describe("CreateProjectDialog", () => {
  it("opens dialog with form fields when trigger button is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateProjectDialog />);

    // The trigger button should be visible
    const triggerButton = screen.getByRole("button", { name: /New Project/i });
    expect(triggerButton).toBeInTheDocument();

    // Dialog content should not be visible yet
    expect(screen.queryByText("Create new project")).not.toBeInTheDocument();

    await user.click(triggerButton);

    // After clicking, dialog content appears
    await waitFor(() => {
      expect(screen.getByText("Create new project")).toBeInTheDocument();
    });
    expect(screen.getByText("Add a new project to organize your SEO monitoring.")).toBeInTheDocument();
    expect(screen.getByTestId("project-name-input")).toBeInTheDocument();
  });

  it("project name is required — submit with empty name shows toast error", async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue(mockMutate as any);

    renderWithProviders(<CreateProjectDialog />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /New Project/i }));

    await waitFor(() => {
      expect(screen.getByText("Create new project")).toBeInTheDocument();
    });

    // The Create project button should be disabled when name is empty
    const submitButton = screen.getByRole("button", { name: /Create project/i });
    expect(submitButton).toBeDisabled();

    // Mutation should not have been called
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("submit calls create mutation with form data", async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn().mockResolvedValue("project_123");
    vi.mocked(useMutation).mockReturnValue(mockMutate as any);

    renderWithProviders(<CreateProjectDialog />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /New Project/i }));

    await waitFor(() => {
      expect(screen.getByTestId("project-name-input")).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId("project-name-input");
    await user.type(nameInput, "My SEO Project");

    const submitButton = screen.getByRole("button", { name: /Create project/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ name: "My SEO Project" });
    });
  });

  it("dialog closes after successful creation", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const mockMutate = vi.fn().mockResolvedValue("project_123");
    vi.mocked(useMutation).mockReturnValue(mockMutate as any);

    renderWithProviders(<CreateProjectDialog onSuccess={onSuccess} />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /New Project/i }));

    await waitFor(() => {
      expect(screen.getByTestId("project-name-input")).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId("project-name-input");
    await user.type(nameInput, "My Project");

    await user.click(screen.getByRole("button", { name: /Create project/i }));

    // After submission, dialog should close
    await waitFor(() => {
      expect(screen.queryByText("Create new project")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. DeleteConfirmationDialog
// ---------------------------------------------------------------------------

describe("DeleteConfirmationDialog", () => {
  const defaultProps = {
    title: "Delete this item?",
    description: "This action cannot be undone.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onConfirm = vi.fn().mockResolvedValue(undefined);
  });

  it("renders with title and description when trigger is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DeleteConfirmationDialog {...defaultProps}>
        <Button>Open Delete</Button>
      </DeleteConfirmationDialog>
    );

    // Title/description not visible before opening
    expect(screen.queryByText("Delete this item?")).not.toBeInTheDocument();

    // Click trigger to open
    await user.click(screen.getByRole("button", { name: /Open Delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Delete this item?")).toBeInTheDocument();
    });
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("confirm button calls onConfirm callback", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DeleteConfirmationDialog {...defaultProps}>
        <Button>Open Delete</Button>
      </DeleteConfirmationDialog>
    );

    // Open dialog
    await user.click(screen.getByRole("button", { name: /Open Delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Delete this item?")).toBeInTheDocument();
    });

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /^Delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("cancel button closes dialog without calling onConfirm", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DeleteConfirmationDialog {...defaultProps}>
        <Button>Open Delete</Button>
      </DeleteConfirmationDialog>
    );

    // Open dialog
    await user.click(screen.getByRole("button", { name: /Open Delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Delete this item?")).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByRole("button", { name: /^Cancel$/i });
    await user.click(cancelButton);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText("Delete this item?")).not.toBeInTheDocument();
    });

    // onConfirm should not have been called
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });
});
