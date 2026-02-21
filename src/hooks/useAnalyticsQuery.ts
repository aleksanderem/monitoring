"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAction } from "convex/react";
/**
 * Hook for calling Convex actions that query Supabase analytical data.
 * Mimics the useQuery interface (data/isLoading/error) but works with actions.
 *
 * Unlike useQuery, this does NOT provide real-time reactivity.
 * Data is fetched on mount and optionally refreshed on an interval.
 *
 * Usage:
 *   const { data, isLoading } = useAnalyticsQuery(api.dashboard.getStats, {});
 *   const { data, isLoading } = useAnalyticsQuery(api.dashboard.getStats, {}, { refreshInterval: 60000 });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAnalyticsQuery<Result>(
  actionRef: any,
  args: Record<string, unknown>,
  options?: { enabled?: boolean; refreshInterval?: number }
): {
  data: Result | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const actionFn = useAction(actionRef);
  const [data, setData] = useState<Result | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const argsKey = JSON.stringify(args);
  const argsKeyRef = useRef(argsKey);
  const enabled = options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actionFn as any)(args);
      setData(result as Result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFn, argsKey, enabled]);

  // Fetch on mount and when args change
  useEffect(() => {
    argsKeyRef.current = argsKey;
    fetchData();
  }, [fetchData, argsKey]);

  // Optional polling
  useEffect(() => {
    if (!options?.refreshInterval || !enabled) return;
    const interval = setInterval(fetchData, options.refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, options?.refreshInterval, enabled]);

  return { data, isLoading, error, refetch: fetchData };
}
