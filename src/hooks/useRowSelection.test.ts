import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRowSelection } from "./useRowSelection";

describe("useRowSelection", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(() => useRowSelection());
    expect(result.current.count).toBe(0);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("toggle adds and removes an item", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("toggleAll selects all, then deselects all", () => {
    const ids = ["a", "b", "c"];
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggleAll(ids));
    expect(result.current.count).toBe(3);
    expect(result.current.isAllSelected(ids)).toBe(true);

    act(() => result.current.toggleAll(ids));
    expect(result.current.count).toBe(0);
    expect(result.current.isAllSelected(ids)).toBe(false);
  });

  it("clear resets selection", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => {
      result.current.toggle("a");
      result.current.toggle("b");
    });
    expect(result.current.count).toBe(2);

    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it("isIndeterminate is true when partially selected", () => {
    const ids = ["a", "b", "c"];
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggle("a"));
    expect(result.current.isIndeterminate(ids)).toBe(true);
    expect(result.current.isAllSelected(ids)).toBe(false);
  });

  it("isIndeterminate is false when none selected", () => {
    const { result } = renderHook(() => useRowSelection());
    expect(result.current.isIndeterminate(["a", "b"])).toBe(false);
  });

  it("isIndeterminate is false when all selected", () => {
    const ids = ["a", "b"];
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.toggleAll(ids));
    expect(result.current.isIndeterminate(ids)).toBe(false);
  });

  it("toggleAll with empty array does nothing", () => {
    const { result } = renderHook(() => useRowSelection());
    act(() => result.current.toggleAll([]));
    expect(result.current.count).toBe(0);
  });

  it("isAllSelected returns false for empty array", () => {
    const { result } = renderHook(() => useRowSelection());
    expect(result.current.isAllSelected([])).toBe(false);
  });
});
