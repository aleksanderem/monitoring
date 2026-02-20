import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@untitledui/icons", () => ({
  X: () => <span>×</span>,
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import { BulkActionBar } from "./BulkActionBar";

describe("BulkActionBar — user flows", () => {
  it("bar is hidden when nothing is selected", () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        selectedIds={new Set()}
        onClearSelection={vi.fn()}
        actions={[]}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("user selects items, sees count, clicks bulk action, then clears", async () => {
    const user = userEvent.setup();
    const ids = new Set(["kw1", "kw2", "kw3"]);
    const onExport = vi.fn();
    const onClear = vi.fn();

    render(
      <BulkActionBar
        selectedCount={3}
        selectedIds={ids}
        onClearSelection={onClear}
        actions={[{ label: "Add to monitoring", onClick: onExport }]}
      />
    );

    // User sees how many items are selected
    expect(screen.getByText("3 selected")).toBeInTheDocument();

    // User sees and clicks the bulk action
    const actionButton = screen.getByText("Add to monitoring");
    await user.click(actionButton);
    expect(onExport).toHaveBeenCalledWith(ids);

    // User decides to clear selection
    const clearButtons = screen.getAllByText("Clear");
    await user.click(clearButtons[clearButtons.length - 1]);
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("user sees multiple actions and picks one", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const ids = new Set(["a", "b"]);

    render(
      <BulkActionBar
        selectedCount={2}
        selectedIds={ids}
        onClearSelection={vi.fn()}
        actions={[
          { label: "Add to monitoring", onClick: onAdd },
          { label: "Delete", onClick: onDelete, variant: "destructive" },
        ]}
      />
    );

    // Both actions visible
    expect(screen.getByText("Add to monitoring")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();

    // User clicks delete
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(ids);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
