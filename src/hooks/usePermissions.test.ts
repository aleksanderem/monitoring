import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    permissions: ["read", "write"],
    modules: ["seo", "analytics"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
  })),
}));

import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";

describe("usePermissions", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(PermissionsProvider, { organizationId: "org123" as any, children });

  it("returns permissions from context", () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.permissions).toEqual(["read", "write"]);
    expect(result.current.role).toBe("admin");
  });

  it("can() checks permission presence", () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.can("read")).toBe(true);
    expect(result.current.can("delete")).toBe(false);
  });

  it("hasModule() checks module presence", () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.hasModule("seo")).toBe(true);
    expect(result.current.hasModule("billing")).toBe(false);
  });

  it("returns defaults without provider", () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("anything")).toBe(false);
    expect(result.current.hasModule("anything")).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });
});
