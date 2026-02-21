/**
 * Helpers for controlling Convex mocks in integration tests.
 *
 * The global vi.mock("convex/react") provides the default:
 * useQuery → undefined, useMutation → vi.fn().
 *
 * These helpers let individual tests configure specific return values per query.
 *
 * IMPORTANT: Convex's `anyApi` is a Proxy that creates new objects on every
 * property access, so `api.domains.list === api.domains.list` is always false.
 * We use `getFunctionName()` from `convex/server` to extract stable string keys
 * (e.g. "domains:list") and match against those instead.
 */
import { vi } from "vitest";
import { useQuery, useMutation, useAction } from "convex/react";
import { getFunctionName } from "convex/server";

type QueryEntry = [ref: unknown, data: unknown];

/**
 * Convert a Convex function reference to a stable string key.
 * Falls back to the reference itself if getFunctionName fails.
 */
function refToKey(ref: unknown): string {
  try {
    return getFunctionName(ref as any);
  } catch {
    return String(ref);
  }
}

/**
 * Configure useQuery mock to return specific data for specific Convex query references.
 * Uses getFunctionName() for stable string matching (not reference identity).
 *
 * @example
 * mockQueries([
 *   [api.domains.list, DOMAIN_LIST],
 *   [api.keywords.getKeywordMonitoring, KEYWORD_LIST],
 * ]);
 */
export function mockQueries(responses: QueryEntry[]) {
  const map = new Map<string, unknown>();
  for (const [ref, data] of responses) {
    map.set(refToKey(ref), data);
  }

  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    if (map.has(key)) return map.get(key);
    return undefined; // loading state by default
  }) as any);
}

/**
 * Create a tracked mutation mock that records calls.
 * Returns a vi.fn() that resolves to undefined by default.
 */
export function mockMutation() {
  const fn = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useMutation).mockReturnValue(fn as any);
  return fn;
}

/**
 * Create a tracked action mock.
 */
export function mockAction() {
  const fn = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAction).mockReturnValue(fn as any);
  return fn;
}

/**
 * Reset all Convex mocks to default (loading) state.
 */
export function resetConvexMocks() {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  vi.mocked(useAction).mockReturnValue(vi.fn() as any);
}
