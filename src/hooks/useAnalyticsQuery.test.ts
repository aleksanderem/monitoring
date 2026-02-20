import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockActionFn = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockActionFn,
}));

import { useAnalyticsQuery } from "./useAnalyticsQuery";

describe("useAnalyticsQuery", () => {
  beforeEach(() => {
    mockActionFn.mockReset();
  });

  it("starts in loading state then resolves with data", async () => {
    mockActionFn.mockResolvedValue({ total: 42 });
    const actionRef = {} as any;

    const { result } = renderHook(() =>
      useAnalyticsQuery(actionRef, { domainId: "123" })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ total: 42 });
    expect(result.current.error).toBeNull();
  });

  it("sets error when action throws", async () => {
    mockActionFn.mockRejectedValue(new Error("Network error"));
    const actionRef = {} as any;

    const { result } = renderHook(() =>
      useAnalyticsQuery(actionRef, { domainId: "123" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe("Network error");
    expect(result.current.data).toBeUndefined();
  });

  it("does not fetch when enabled is false", async () => {
    const actionRef = {} as any;

    const { result } = renderHook(() =>
      useAnalyticsQuery(actionRef, { domainId: "123" }, { enabled: false })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockActionFn).not.toHaveBeenCalled();
  });

  it("refetch triggers a new fetch", async () => {
    mockActionFn
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 });

    const actionRef = {} as any;
    const { result } = renderHook(() =>
      useAnalyticsQuery(actionRef, { domainId: "123" })
    );

    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual({ v: 2 });
  });

  it("polls with refreshInterval", async () => {
    vi.useFakeTimers();
    mockActionFn.mockResolvedValue({ v: 1 });

    const actionRef = {} as any;
    renderHook(() =>
      useAnalyticsQuery(actionRef, { domainId: "123" }, { refreshInterval: 5000 })
    );

    // Initial fetch
    await vi.advanceTimersByTimeAsync(0);
    expect(mockActionFn).toHaveBeenCalledTimes(1);

    // After interval
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockActionFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockActionFn).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});
