"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateDateRange,
  calculatePreviousPeriod,
  type DateRangePreset,
  type DateRangeValue,
  type ComparisonRange,
} from "@/hooks/useDateRange";

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  comparisonEnabled?: boolean;
  comparisonValue?: ComparisonRange;
  onComparisonChange?: (value: ComparisonRange | undefined) => void;
  className?: string;
}

// Helper to format date range
function formatDateRange(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (sameMonth && from.getDate() === to.getDate()) {
    return from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (sameYear) {
    return `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  return `${from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })} - ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}`;
}

export function DateRangePicker({
  value,
  onChange,
  comparisonEnabled = false,
  comparisonValue,
  onComparisonChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = calculateDateRange(preset);
    onChange({ ...range, preset });
    setIsOpen(false);
  };

  const toggleComparison = () => {
    const newShowComparison = !showComparison;
    setShowComparison(newShowComparison);

    if (newShowComparison && onComparisonChange) {
      // Auto-calculate previous period
      const prevPeriod = calculatePreviousPeriod(value.from, value.to);
      onComparisonChange({ ...prevPeriod, type: "previous" });
    } else if (onComparisonChange) {
      onComparisonChange(undefined);
    }
  };

  const presets: Array<{ value: DateRangePreset; label: string }> = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "3m", label: "Last 3 months" },
    { value: "6m", label: "Last 6 months" },
    { value: "1y", label: "Last year" },
    { value: "all", label: "All time" },
  ];

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-medium text-primary transition-colors",
          "hover:bg-secondary/50",
          isOpen && "bg-secondary"
        )}
      >
        <CalendarIcon className="h-4 w-4 text-tertiary" />
        <span>{value.preset && value.preset !== "custom" ? presets.find(p => p.value === value.preset)?.label : formatDateRange(value.from, value.to)}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-secondary bg-primary p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">Select Date Range</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-tertiary hover:text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 space-y-1">
              <h4 className="mb-2 text-xs font-medium text-tertiary">Presets</h4>
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    value.preset === preset.value
                      ? "bg-utility-brand-50 text-utility-brand-600 font-medium"
                      : "text-primary hover:bg-secondary"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {comparisonEnabled && (
              <div className="mt-4 border-t border-secondary pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showComparison}
                    onChange={toggleComparison}
                    className="h-4 w-4 rounded border-secondary"
                  />
                  <span className="text-sm font-medium text-primary">Compare</span>
                </label>

                {showComparison && comparisonValue && (
                  <div className="mt-3 rounded-md bg-secondary/50 p-3">
                    <p className="text-xs font-medium text-tertiary mb-1">Comparison Period</p>
                    <p className="text-sm text-primary">
                      {formatDateRange(comparisonValue.from, comparisonValue.to)}
                    </p>
                    <p className="mt-1 text-xs text-tertiary">
                      {comparisonValue.type === "previous" ? "vs. Previous Period" : "vs. Custom Period"}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 text-xs text-tertiary">
              <p>Current selection: {formatDateRange(value.from, value.to)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Re-export types for convenience
export type { DateRangePreset, DateRangeValue, ComparisonRange };
