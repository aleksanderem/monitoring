import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEscapeClose } from "./useEscapeClose";

describe("useEscapeClose", () => {
  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(onClose, true));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose for other keys", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(onClose, true));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose when enabled is false", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(onClose, false));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll when enabled", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(onClose, true));

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll on unmount", () => {
    document.body.style.overflow = "auto";
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeClose(onClose, true));

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("does not lock body scroll when disabled", () => {
    document.body.style.overflow = "";
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(onClose, false));

    expect(document.body.style.overflow).toBe("");
  });
});
