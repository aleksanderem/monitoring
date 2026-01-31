import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type DateRangePreset = "7d" | "30d" | "3m" | "6m" | "1y" | "all" | "custom";

export interface DateRangeValue {
  from: Date;
  to: Date;
  preset?: DateRangePreset;
}

export interface ComparisonRange {
  from: Date;
  to: Date;
  type: "previous" | "custom";
}

// Helper function to calculate date ranges
export function calculateDateRange(preset: DateRangePreset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "all":
      // Set to very far back for "all time"
      from.setFullYear(2020, 0, 1);
      break;
    case "custom":
      // Return current dates for custom
      return { from: new Date(from), to: new Date(to) };
  }

  return { from, to };
}

// Helper to calculate previous period
export function calculatePreviousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);
  return { from: prevFrom, to: prevTo };
}

// Helper to format date for URL
function formatDateForUrl(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Helper to parse date from URL
function parseDateFromUrl(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

interface UseDateRangeOptions {
  initialPreset?: DateRangePreset;
  syncWithUrl?: boolean;
}

export function useDateRange({
  initialPreset = "30d",
  syncWithUrl = false,
}: UseDateRangeOptions = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL if syncWithUrl is true
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    if (syncWithUrl) {
      const fromParam = searchParams.get("from");
      const toParam = searchParams.get("to");
      const presetParam = searchParams.get("range") as DateRangePreset | null;

      const from = parseDateFromUrl(fromParam);
      const to = parseDateFromUrl(toParam);

      if (from && to) {
        return { from, to, preset: presetParam || "custom" };
      }

      if (presetParam) {
        const range = calculateDateRange(presetParam);
        return { ...range, preset: presetParam };
      }
    }

    const range = calculateDateRange(initialPreset);
    return { ...range, preset: initialPreset };
  });

  const [comparisonRange, setComparisonRange] = useState<ComparisonRange | undefined>();

  // Sync to URL when date range changes
  useEffect(() => {
    if (syncWithUrl && router) {
      const params = new URLSearchParams(searchParams.toString());

      if (dateRange.preset && dateRange.preset !== "custom") {
        params.set("range", dateRange.preset);
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", formatDateForUrl(dateRange.from));
        params.set("to", formatDateForUrl(dateRange.to));
        params.delete("range");
      }

      router.push(`?${params.toString()}`, { scroll: false });
    }
  }, [dateRange, syncWithUrl, router, searchParams]);

  return {
    dateRange,
    setDateRange,
    comparisonRange,
    setComparisonRange,
  };
}
