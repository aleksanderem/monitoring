import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  calculateDateRange,
  calculatePreviousPeriod,
  useDateRange,
} from "./useDateRange";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ---- Helper: strip time portion for date-only comparisons ----
function toDateString(d: Date) {
  return d.toISOString().split("T")[0];
}

describe("calculateDateRange", () => {
  it('"7d" returns from = 7 days ago, to = today', () => {
    const { from, to } = calculateDateRange("7d");
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);

    expect(toDateString(from)).toBe(toDateString(expected));
    expect(toDateString(to)).toBe(toDateString(new Date()));
  });

  it('"30d" returns from = 30 days ago, to = today', () => {
    const { from, to } = calculateDateRange("30d");
    const expected = new Date();
    expected.setDate(expected.getDate() - 30);

    expect(toDateString(from)).toBe(toDateString(expected));
    expect(toDateString(to)).toBe(toDateString(new Date()));
  });

  it('"3m" returns from = 3 months ago, to = today', () => {
    const { from, to } = calculateDateRange("3m");
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 3);

    expect(toDateString(from)).toBe(toDateString(expected));
    expect(toDateString(to)).toBe(toDateString(new Date()));
  });

  it('"1y" returns from = 1 year ago, to = today', () => {
    const { from, to } = calculateDateRange("1y");
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() - 1);

    expect(toDateString(from)).toBe(toDateString(expected));
    expect(toDateString(to)).toBe(toDateString(new Date()));
  });

  it('"all" returns from = Jan 1 2020, to = today', () => {
    const { from, to } = calculateDateRange("all");

    expect(from.getFullYear()).toBe(2020);
    expect(from.getMonth()).toBe(0);
    expect(from.getDate()).toBe(1);
    expect(toDateString(to)).toBe(toDateString(new Date()));
  });
});

describe("calculatePreviousPeriod", () => {
  it("returns the previous period of equal length ending 1ms before the current period starts", () => {
    // Given a 7-day period
    const to = new Date("2025-06-15T00:00:00Z");
    const from = new Date("2025-06-08T00:00:00Z");
    const duration = to.getTime() - from.getTime();

    const prev = calculatePreviousPeriod(from, to);

    // prevTo should be 1ms before from
    expect(prev.to.getTime()).toBe(from.getTime() - 1);
    // prevFrom should be duration ms before prevTo
    expect(prev.from.getTime()).toBe(prev.to.getTime() - duration);
    // The previous period length matches the original period length
    expect(prev.to.getTime() - prev.from.getTime()).toBe(duration);
  });

  it("works with a 30-day period", () => {
    const to = new Date("2025-07-01T00:00:00Z");
    const from = new Date("2025-06-01T00:00:00Z");
    const duration = to.getTime() - from.getTime();

    const prev = calculatePreviousPeriod(from, to);

    expect(prev.to.getTime()).toBe(from.getTime() - 1);
    expect(prev.to.getTime() - prev.from.getTime()).toBe(duration);
  });
});

describe("useDateRange hook", () => {
  it('defaults to "30d" preset', () => {
    const { result } = renderHook(() => useDateRange());

    expect(result.current.dateRange.preset).toBe("30d");
    expect(result.current.dateRange.from).toBeInstanceOf(Date);
    expect(result.current.dateRange.to).toBeInstanceOf(Date);
  });

  it("accepts a custom initial preset", () => {
    const { result } = renderHook(() =>
      useDateRange({ initialPreset: "7d" })
    );

    expect(result.current.dateRange.preset).toBe("7d");
  });

  it("dateRange has from, to, and preset properties", () => {
    const { result } = renderHook(() => useDateRange());
    const { dateRange } = result.current;

    expect(dateRange).toHaveProperty("from");
    expect(dateRange).toHaveProperty("to");
    expect(dateRange).toHaveProperty("preset");
    expect(dateRange.from).toBeInstanceOf(Date);
    expect(dateRange.to).toBeInstanceOf(Date);
    expect(typeof dateRange.preset).toBe("string");
  });

  it("from date is before to date", () => {
    const { result } = renderHook(() => useDateRange());

    expect(result.current.dateRange.from.getTime()).toBeLessThan(
      result.current.dateRange.to.getTime()
    );
  });
});
