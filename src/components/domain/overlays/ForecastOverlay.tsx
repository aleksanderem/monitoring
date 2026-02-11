"use client";

import { Line, Area } from "recharts";

interface ForecastOverlayProps {
  data: Array<{
    date: Date | string;
    value?: number | null;
    forecast?: number | null;
    forecastLower?: number | null;
    forecastUpper?: number | null;
  }>;
  dataKey: string; // Key for the forecasted metric (e.g., "position", "etv")
  forecastDataKey?: string; // Optional override for forecast key
  color?: string;
  showConfidenceInterval?: boolean;
}

/**
 * ForecastOverlay component
 *
 * Usage: Add this component inside your recharts chart (AreaChart, LineChart, etc)
 * to display forecasted values with confidence intervals.
 *
 * Example:
 * ```tsx
 * <AreaChart data={combinedData}>
 *   <Area dataKey="actual" ... />
 *   <ForecastOverlay data={combinedData} dataKey="position" />
 * </AreaChart>
 * ```
 *
 * The data array should contain both historical and forecasted points.
 * Forecasted points should have:
 * - forecast: predicted value
 * - forecastLower: lower confidence bound
 * - forecastUpper: upper confidence bound
 */
export function ForecastOverlay({
  data,
  dataKey,
  forecastDataKey = "forecast",
  color = "#60a5fa",
  showConfidenceInterval = true,
}: ForecastOverlayProps) {
  return (
    <>
      {/* Confidence interval area (if enabled) */}
      {showConfidenceInterval && (
        <Area
          type="monotone"
          dataKey="forecastUpper"
          stroke="none"
          fill={color}
          fillOpacity={0.1}
          connectNulls
        />
      )}

      {/* Forecast line (dashed) */}
      <Line
        type="monotone"
        dataKey={forecastDataKey}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="5 5"
        dot={false}
        connectNulls
      />

      {/* Lower confidence bound (if enabled) */}
      {showConfidenceInterval && (
        <Line
          type="monotone"
          dataKey="forecastLower"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.3}
          strokeDasharray="2 2"
          dot={false}
          connectNulls
        />
      )}
    </>
  );
}

/**
 * Helper function to merge historical and forecast data for charts
 */
export function mergeHistoricalAndForecast<T extends { date: string }>(
  historical: T[],
  forecastPredictions: Array<{
    date: string;
    value: number;
    confidenceLower: number;
    confidenceUpper: number;
  }> | undefined
): Array<T & {
  forecast?: number;
  forecastLower?: number;
  forecastUpper?: number;
}> {
  if (!forecastPredictions || forecastPredictions.length === 0) {
    return historical;
  }

  // Create a map of forecast data by date
  const forecastMap = new Map(
    forecastPredictions.map((f) => [
      f.date,
      {
        forecast: f.value,
        forecastLower: f.confidenceLower,
        forecastUpper: f.confidenceUpper,
      },
    ])
  );

  // Merge historical data with forecast
  const merged = historical.map((h) => ({
    ...h,
    ...forecastMap.get(h.date),
  }));

  // Add forecast-only dates
  const historicalDates = new Set(historical.map((h) => h.date));
  const forecastOnly = forecastPredictions
    .filter((f) => !historicalDates.has(f.date))
    .map((f) => ({
      date: f.date,
      forecast: f.value,
      forecastLower: f.confidenceLower,
      forecastUpper: f.confidenceUpper,
    } as any));

  return [...merged, ...forecastOnly];
}
