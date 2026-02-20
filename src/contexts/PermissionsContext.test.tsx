import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { api } from "../../convex/_generated/api";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

import {
  PermissionsProvider,
  usePermissions,
} from "@/contexts/PermissionsContext";
import type { Id } from "../../convex/_generated/dataModel";

// ── Fixtures ──────────────────────────────────────────────────────────────

const ORG_ID = "org_1" as Id<"organizations">;

const CONTEXT_DATA = {
  permissions: ["domains.create", "domains.edit", "keywords.add"],
  modules: ["backlinks", "competitors"],
  role: "editor",
  plan: { name: "Pro", key: "pro" },
};

const WILDCARD_CONTEXT = {
  permissions: ["*"],
  modules: ["backlinks"],
  role: "admin",
  plan: { name: "Enterprise", key: "enterprise" },
};

// ── Query key helpers ─────────────────────────────────────────────────────

const permissionsKey = getFunctionName(api.permissions.getMyContext);

function refToKey(ref: unknown): string {
  try {
    return getFunctionName(ref as any);
  } catch {
    return String(ref);
  }
}

function setupQuery(returnValue: unknown) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    if (key === permissionsKey) return returnValue;
    return undefined;
  }) as any);
}

// ── Wrapper ───────────────────────────────────────────────────────────────

function makeWrapper(organizationId: Id<"organizations"> | undefined) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PermissionsProvider organizationId={organizationId}>
        {children}
      </PermissionsProvider>
    );
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("PermissionsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── LOADING STATE ─────────────────────────────────────────────────────

  describe("loading state", () => {
    it("isLoading is true when query returns undefined", () => {
      setupQuery(undefined);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("can() returns false for any permission during loading", () => {
      setupQuery(undefined);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.can("domains.create")).toBe(false);
      expect(result.current.can("anything")).toBe(false);
    });

    it("hasModule() returns false for any module during loading", () => {
      setupQuery(undefined);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.hasModule("backlinks")).toBe(false);
      expect(result.current.hasModule("anything")).toBe(false);
    });
  });

  // ── WITH DATA ─────────────────────────────────────────────────────────

  describe("with data", () => {
    it("isLoading is false when query returns data", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("can() returns true for included permissions", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.can("domains.create")).toBe(true);
      expect(result.current.can("domains.edit")).toBe(true);
      expect(result.current.can("keywords.add")).toBe(true);
    });

    it("can() returns false for excluded permissions", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.can("domains.delete")).toBe(false);
      expect(result.current.can("admin.manage")).toBe(false);
    });

    it("hasModule() returns true for included modules", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.hasModule("backlinks")).toBe(true);
      expect(result.current.hasModule("competitors")).toBe(true);
    });

    it("hasModule() returns false for excluded modules", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.hasModule("seo_audit")).toBe(false);
      expect(result.current.hasModule("ai_strategy")).toBe(false);
    });

    it("role is set correctly from context data", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.role).toBe("editor");
    });

    it("plan is set correctly from context data", () => {
      setupQuery(CONTEXT_DATA);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.plan).toEqual({ name: "Pro", key: "pro" });
    });
  });

  // ── WILDCARD ──────────────────────────────────────────────────────────

  describe("wildcard permissions", () => {
    it("can() returns true for any permission when * is in permissions", () => {
      setupQuery(WILDCARD_CONTEXT);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.can("domains.create")).toBe(true);
      expect(result.current.can("domains.delete")).toBe(true);
      expect(result.current.can("admin.manage")).toBe(true);
    });

    it("can() returns true for non-existent permissions with wildcard", () => {
      setupQuery(WILDCARD_CONTEXT);
      const { result } = renderHook(() => usePermissions(), {
        wrapper: makeWrapper(ORG_ID),
      });

      expect(result.current.can("completely.made.up")).toBe(true);
      expect(result.current.can("")).toBe(true);
    });
  });

  // ── NO ORG ID ─────────────────────────────────────────────────────────

  describe("no organization ID", () => {
    it("query is skipped when organizationId is undefined", () => {
      setupQuery(undefined);
      renderHook(() => usePermissions(), {
        wrapper: makeWrapper(undefined),
      });

      expect(useQuery).toHaveBeenCalledWith(
        api.permissions.getMyContext,
        "skip"
      );
    });
  });
});
