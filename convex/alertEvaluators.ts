import type { Doc, Id } from "./_generated/dataModel";

/**
 * Alert trigger result — returned by each evaluator
 */
export interface AlertTrigger {
  keywordId?: Id<"keywords">;
  keywordPhrase?: string;
  previousValue?: number;
  currentValue?: number;
  competitorDomain?: string;
  details?: string;
}

// =================================================================
// Position Drop Evaluator
// =================================================================

/**
 * Checks all keywords for position drops exceeding the threshold.
 * Returns an array of triggers (one per affected keyword).
 */
export function evaluatePositionDrop(
  rule: Doc<"alertRules">,
  keywords: Doc<"keywords">[]
): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];

  for (const kw of keywords) {
    if (
      kw.currentPosition != null &&
      kw.previousPosition != null &&
      kw.currentPosition > kw.previousPosition
    ) {
      const drop = kw.currentPosition - kw.previousPosition;
      if (drop > rule.threshold) {
        triggers.push({
          keywordId: kw._id,
          keywordPhrase: kw.phrase,
          previousValue: kw.previousPosition,
          currentValue: kw.currentPosition,
          details: `Position dropped by ${drop} (from ${kw.previousPosition} to ${kw.currentPosition})`,
        });
      }
    }
  }

  return triggers;
}

// =================================================================
// Top N Exit Evaluator
// =================================================================

/**
 * Checks all keywords that exited the top N positions.
 * Returns an array of triggers (one per affected keyword).
 */
export function evaluateTopNExit(
  rule: Doc<"alertRules">,
  keywords: Doc<"keywords">[]
): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];
  const topN = rule.topN ?? rule.threshold;

  for (const kw of keywords) {
    if (kw.previousPosition != null && kw.previousPosition <= topN) {
      const exitedTopN =
        kw.currentPosition == null || kw.currentPosition > topN;

      if (exitedTopN) {
        triggers.push({
          keywordId: kw._id,
          keywordPhrase: kw.phrase,
          previousValue: kw.previousPosition,
          currentValue: kw.currentPosition ?? undefined,
          details: `Keyword exited top ${topN} (was at position ${kw.previousPosition}${kw.currentPosition != null ? `, now at ${kw.currentPosition}` : ", now not ranking"})`,
        });
      }
    }
  }

  return triggers;
}

// =================================================================
// New Competitor Evaluator
// =================================================================

/**
 * Checks for new competitor domains in recent SERP results.
 * Compares today's top-10 SERP domains against yesterday's.
 */
export function evaluateNewCompetitor(
  _rule: Doc<"alertRules">,
  todaySerpDomains: Set<string>,
  yesterdaySerpDomains: Set<string>,
  ownDomain: string
): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];

  for (const domain of todaySerpDomains) {
    if (domain === ownDomain) continue;
    if (!yesterdaySerpDomains.has(domain)) {
      triggers.push({
        competitorDomain: domain,
        details: `New competitor "${domain}" detected in SERP results`,
      });
    }
  }

  return triggers;
}

// =================================================================
// Backlink Lost Evaluator
// =================================================================

/**
 * Checks if the domain lost more backlinks than the threshold.
 */
export function evaluateBacklinkLost(
  rule: Doc<"alertRules">,
  latestVelocity: { lostBacklinks: number; date: string } | null
): AlertTrigger | null {
  if (!latestVelocity) return null;

  if (latestVelocity.lostBacklinks > rule.threshold) {
    return {
      currentValue: latestVelocity.lostBacklinks,
      previousValue: rule.threshold,
      details: `Lost ${latestVelocity.lostBacklinks} backlinks on ${latestVelocity.date} (threshold: ${rule.threshold})`,
    };
  }

  return null;
}

// =================================================================
// Visibility Drop Evaluator
// =================================================================

/**
 * Checks if domain visibility dropped by more than X%.
 * Compares the latest two visibility history entries.
 */
export function evaluateVisibilityDrop(
  rule: Doc<"alertRules">,
  current: { etv?: number; count?: number } | null,
  previous: { etv?: number; count?: number } | null
): AlertTrigger | null {
  if (!current || !previous) return null;

  // Use ETV if available, otherwise fall back to keyword count
  const currentValue = current.etv ?? current.count ?? 0;
  const previousValue = previous.etv ?? previous.count ?? 0;

  if (previousValue === 0) return null;

  const dropPercent = ((previousValue - currentValue) / previousValue) * 100;

  if (dropPercent > rule.threshold) {
    return {
      previousValue: Math.round(previousValue),
      currentValue: Math.round(currentValue),
      details: `Visibility dropped by ${dropPercent.toFixed(1)}% (from ${Math.round(previousValue)} to ${Math.round(currentValue)}, threshold: ${rule.threshold}%)`,
    };
  }

  return null;
}
