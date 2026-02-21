import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTitle } from "./usePageTitle";

describe("usePageTitle", () => {
  afterEach(() => {
    document.title = "";
  });

  it("sets document.title with prefix", () => {
    renderHook(() => usePageTitle("Dashboard"));
    expect(document.title).toBe("doseo | Dashboard");
  });

  it("joins multiple segments with pipe", () => {
    renderHook(() => usePageTitle("example.com", "Keywords"));
    expect(document.title).toBe("doseo | example.com | Keywords");
  });

  it("filters out falsy segments", () => {
    renderHook(() => usePageTitle("Home", null, undefined, "Settings"));
    expect(document.title).toBe("doseo | Home | Settings");
  });

  it("sets bare title when all segments are falsy", () => {
    renderHook(() => usePageTitle(null, undefined));
    expect(document.title).toBe("doseo");
  });

  it("resets on rerender with new segments", () => {
    const { rerender } = renderHook(
      ({ segments }: { segments: (string | null)[] }) =>
        usePageTitle(...segments),
      { initialProps: { segments: ["Page A"] } }
    );

    expect(document.title).toBe("doseo | Page A");

    rerender({ segments: ["Page B"] });
    expect(document.title).toBe("doseo | Page B");
  });
});
