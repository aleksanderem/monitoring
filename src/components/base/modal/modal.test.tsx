import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

describe("Modal — user flows", () => {
  it("user cannot see modal content when it is closed", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Secret content</p>
      </Modal>
    );
    expect(container.innerHTML).toBe("");
  });

  it("user opens modal, sees title, description and content", () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Delete project"
        description="This action cannot be undone."
      >
        <p>Are you sure?</p>
      </Modal>
    );

    expect(screen.getByText("Delete project")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("user presses Escape to close modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("user clicks backdrop to close modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    const backdrop = container.querySelector('[aria-hidden="true"]')!;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("user sees footer actions when provided", () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        footer={
          <>
            <button>Cancel</button>
            <button>Confirm</button>
          </>
        }
      >
        <p>Body</p>
      </Modal>
    );

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("page scroll is locked while modal is open, restored after close", () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("modal adapts size — sm is narrower, xl is wider", () => {
    const { container: sm } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="sm">
        small
      </Modal>
    );
    expect(sm.querySelector('[role="dialog"]')!.className).toContain("max-w-sm");

    const { container: xl } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="xl">
        large
      </Modal>
    );
    expect(xl.querySelector('[role="dialog"]')!.className).toContain("max-w-xl");
  });
});
