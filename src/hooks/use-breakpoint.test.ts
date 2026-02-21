import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useBreakpoint", () => {
  let listeners: Map<string, ((e: { matches: boolean }) => void)[]>;
  let currentMatches: Map<string, boolean>;

  beforeEach(() => {
    listeners = new Map();
    currentMatches = new Map();

    vi.stubGlobal("matchMedia", (query: string) => {
      const matches = currentMatches.get(query) ?? false;
      if (!listeners.has(query)) listeners.set(query, []);
      return {
        matches,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.get(query)!.push(cb);
        },
        removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          const arr = listeners.get(query)!;
          const idx = arr.indexOf(cb);
          if (idx >= 0) arr.splice(idx, 1);
        },
      };
    });
  });

  it("returns false when viewport is below breakpoint", async () => {
    currentMatches.set("(min-width: 768px)", false);
    const { useBreakpoint } = await import("./use-breakpoint");
    const { result } = renderHook(() => useBreakpoint("md"));
    expect(result.current).toBe(false);
  });

  it("returns true when viewport matches breakpoint", async () => {
    currentMatches.set("(min-width: 1024px)", true);
    const { useBreakpoint } = await import("./use-breakpoint");
    const { result } = renderHook(() => useBreakpoint("lg"));
    expect(result.current).toBe(true);
  });

  it("responds to media query changes", async () => {
    currentMatches.set("(min-width: 640px)", false);
    const { useBreakpoint } = await import("./use-breakpoint");
    const { result } = renderHook(() => useBreakpoint("sm"));

    expect(result.current).toBe(false);

    act(() => {
      const cbs = listeners.get("(min-width: 640px)") ?? [];
      cbs.forEach((cb) => cb({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it("uses correct pixel values for each breakpoint", async () => {
    const expected: Record<string, string> = {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    };

    for (const [size, px] of Object.entries(expected)) {
      currentMatches.set(`(min-width: ${px})`, true);
    }

    const { useBreakpoint } = await import("./use-breakpoint");

    for (const size of Object.keys(expected)) {
      const { result } = renderHook(() =>
        useBreakpoint(size as "sm" | "md" | "lg" | "xl" | "2xl")
      );
      expect(result.current).toBe(true);
    }
  });
});
