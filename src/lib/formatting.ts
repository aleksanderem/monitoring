/**
 * Shared formatting utilities to avoid duplication across components.
 */

/**
 * Format a number with compact notation (e.g. 1.2K, 3.5M).
 * Returns "—" for null/undefined values.
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Returns Tailwind classes for position badge coloring based on SERP position.
 * Accepts null for keywords without a known position.
 */
export function getPositionBadgeClass(position: number | null): string {
  if (!position || position === 999) return "bg-utility-gray-50 text-utility-gray-600";
  if (position <= 3) return "bg-utility-success-50 text-utility-success-600";
  if (position <= 10) return "bg-utility-success-25 text-utility-success-500";
  if (position <= 20) return "bg-utility-warning-50 text-utility-warning-600";
  if (position <= 50) return "bg-utility-gray-50 text-utility-gray-600";
  return "bg-utility-gray-25 text-utility-gray-500";
}
