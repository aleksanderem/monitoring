// Shared helpers for position denormalization logic.
// Used by keywords.ts and dataforseo.ts to update recentPositions arrays
// and derive current/previous/change values.

export type RecentPosition = { date: string; position: number | null };

/**
 * Update recentPositions array: add/replace entry for the given date, keep last 7 sorted by date.
 * Returns the trimmed array plus derived current/previous/change values.
 */
export function updateRecentPositions(
  recentPositions: RecentPosition[],
  date: string,
  position: number | null,
  fallbackPrevious: number | null | undefined,
): { trimmed: RecentPosition[]; currentPos: number | null; previousPos: number | null; change: number | null } {
  const filtered = recentPositions.filter((p) => p.date !== date);
  filtered.push({ date, position });
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = filtered.slice(-7);

  const latestEntry = trimmed[trimmed.length - 1];
  const prevEntry = trimmed.length >= 2 ? trimmed[trimmed.length - 2] : null;

  const currentPos = latestEntry?.position ?? null;
  const previousPos = prevEntry?.position ?? fallbackPrevious ?? null;
  const change = (currentPos != null && previousPos != null)
    ? previousPos - currentPos
    : null;

  return { trimmed, currentPos, previousPos, change };
}
