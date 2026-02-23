import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "../../../../convex/_generated/dataModel";

// --- Mocks ---

const mockAddKeywords = vi.fn();
let toastMessages: { type: string; message: string }[] = [];

vi.mock("convex/react", () => ({
  useMutation: () => mockAddKeywords,
  useQuery: () => undefined,
}));

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => toastMessages.push({ type: "error", message: msg }),
    success: (msg: string) => toastMessages.push({ type: "success", message: msg }),
    info: (msg: string) => toastMessages.push({ type: "info", message: msg }),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}(${JSON.stringify(params)})`;
    return key;
  },
}));

vi.mock("@/components/application/modals/modal", () => {
  const R = require("react");
  return {
    DialogTrigger: ({ children, isOpen }: any) =>
      isOpen ? R.createElement("div", { "data-testid": "dialog-trigger" }, children) : null,
    ModalOverlay: ({ children }: any) => R.createElement("div", null, children),
    Modal: ({ children }: any) => R.createElement("div", null, children),
    Dialog: ({ children }: any) => R.createElement("div", null, children),
  };
});

vi.mock("@/components/base/buttons/close-button", () => ({
  CloseButton: ({ onPress }: any) => (
    <button onClick={onPress} aria-label="close">×</button>
  ),
}));

vi.mock("@/components/foundations/featured-icon/featured-icon", () => ({
  FeaturedIcon: () => null,
}));

vi.mock("@/components/shared-assets/background-patterns", () => ({
  BackgroundPattern: () => null,
}));

vi.mock("@untitledui/icons", () => ({
  Plus: () => <span>+</span>,
  Stars01: () => <span>★</span>,
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled ?? false}>
      {children}
    </button>
  ),
}));

import { AddKeywordsModal } from "./AddKeywordsModal";

const domainId = "test-domain-id" as Id<"domains">;

function openModal(onClose = vi.fn()) {
  const result = render(
    <AddKeywordsModal domainId={domainId} isOpen={true} onClose={onClose} />
  );
  const textarea = within(result.container).getByRole("textbox");
  const addButton = within(result.container).getByText("addKeywords");
  return { ...result, textarea, addButton, onClose };
}

describe("AddKeywordsModal — user flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastMessages = [];
  });

  it("user sees nothing when modal is closed", () => {
    const { container } = render(
      <AddKeywordsModal domainId={domainId} isOpen={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("user opens modal, sees textarea and cannot submit empty form", () => {
    const { textarea, addButton } = openModal();

    expect(textarea).toBeInTheDocument();
    expect(addButton).toBeDisabled();
  });

  it("user types valid keywords, submits, sees success and modal closes", async () => {
    const user = userEvent.setup();
    mockAddKeywords.mockResolvedValue(["id1", "id2"]);

    const onClose = vi.fn();
    const { textarea, addButton } = openModal(onClose);

    // User types two keywords
    await user.type(textarea, "seo tools\nkeyword research");

    // Button becomes enabled
    expect(addButton).not.toBeDisabled();

    // User clicks add
    await user.click(addButton);

    // Modal closes and success toast appears
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastMessages.some((t) => t.type === "success")).toBe(true);
  });

  it("user types mix of valid and invalid keywords — only valid ones submitted", async () => {
    const user = userEvent.setup();
    mockAddKeywords.mockResolvedValue(["id1"]);

    const { textarea, addButton } = openModal();

    // "a" is too short, "12345" is just numbers, "seo audit" is valid
    await user.type(textarea, "a\n12345\nseo audit");
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddKeywords).toHaveBeenCalledWith({
        domainId,
        phrases: ["seo audit"],
      });
    });

    // User sees toast mentioning skipped keywords
    expect(toastMessages.length).toBeGreaterThan(0);
  });

  it("user types URLs — they are rejected, valid keywords go through", async () => {
    const user = userEvent.setup();
    mockAddKeywords.mockResolvedValue(["id1"]);

    const { textarea, addButton } = openModal();

    await user.type(textarea, "https://google.com\nlocal seo tips");
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddKeywords).toHaveBeenCalledWith({
        domainId,
        phrases: ["local seo tips"],
      });
    });
  });

  it("user types duplicate keywords — duplicates are collapsed", async () => {
    const user = userEvent.setup();
    mockAddKeywords.mockResolvedValue(["id1"]);

    const { textarea, addButton } = openModal();

    await user.type(textarea, "seo tools\nseo tools\nseo tools");
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddKeywords).toHaveBeenCalledWith({
        domainId,
        phrases: ["seo tools"],
      });
    });
  });

  it("user types only invalid keywords — sees error, nothing submitted", async () => {
    const user = userEvent.setup();

    const { textarea, addButton } = openModal();

    await user.type(textarea, "a\n1\nhttps://x.com");
    await user.click(addButton);

    expect(mockAddKeywords).not.toHaveBeenCalled();
    expect(toastMessages.some((t) => t.type === "error")).toBe(true);
  });

  it("user clicks cancel button to close modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = render(
      <AddKeywordsModal domainId={domainId} isOpen={true} onClose={onClose} />
    );

    const cancelButton = within(container).getByText("cancel");
    await user.click(cancelButton);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
