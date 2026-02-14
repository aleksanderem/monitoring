/**
 * Core diagnostic validation modules (1-5).
 * Each function accepts DiagnosticInput and returns its typed result.
 */

import {
  DiagnosticInput,
  OverviewDiagnostic,
  MonitoringExtDiagnostic,
  KeywordMapDiagnostic,
  VisibilityDiagnostic,
  BacklinksExtDiagnostic,
  pctDivergence,
} from "./diagnosticTypes";

// ─── Module 1: Overview ───

export async function computeOverviewDiagnostic(
  input: DiagnosticInput
): Promise<OverviewDiagnostic> {
  const contradictions: string[] = [];

  // Actual discovered counts
  const actualTotal = input.rankedDiscovered.length;
  const actualTop3 = input.rankedDiscovered.filter(
    (dk) => dk.bestPosition <= 3
  ).length;
  const actualTop10 = input.rankedDiscovered.filter(
    (dk) => dk.bestPosition <= 10
  ).length;
  const actualDiscoveredCounts = {
    total: actualTotal,
    top3: actualTop3,
    top10: actualTop10,
  };

  if (!input.visHistory) {
    return {
      visibilityMetrics: null,
      actualDiscoveredCounts,
      metricsVsActualDivergence: {
        totalPct: null,
        top3Pct: null,
        top10Pct: null,
      },
      contradictions,
    };
  }

  const m = input.visHistory.metrics;
  const visTotal = m.count ?? 0;
  const visTop3 = (m.pos_1 ?? 0) + (m.pos_2_3 ?? 0);
  const visTop10 = visTop3 + (m.pos_4_10 ?? 0);
  const etv = m.etv ?? 0;
  const isUp = m.is_up ?? 0;
  const isDown = m.is_down ?? 0;

  const visibilityMetrics = {
    total: visTotal,
    top3: visTop3,
    top10: visTop10,
    etv,
    isUp,
    isDown,
  };

  const totalPct = pctDivergence(visTotal, actualTotal);
  const top3Pct = pctDivergence(visTop3, actualTop3);
  const top10Pct = pctDivergence(visTop10, actualTop10);

  if (totalPct !== null && totalPct > 20) {
    contradictions.push(
      `Visibility metrics total (${visTotal}) vs discovered keywords (${actualTotal}): ${totalPct}% divergence`
    );
  }
  if (top3Pct !== null && top3Pct > 30) {
    contradictions.push(
      `Visibility metrics top3 (${visTop3}) vs discovered keywords (${actualTop3}): ${top3Pct}% divergence`
    );
  }
  if (top10Pct !== null && top10Pct > 30) {
    contradictions.push(
      `Visibility metrics top10 (${visTop10}) vs discovered keywords (${actualTop10}): ${top10Pct}% divergence`
    );
  }
  if (isUp + isDown > visTotal) {
    contradictions.push(
      `More changes (${isUp + isDown}) than total keywords (${visTotal})`
    );
  }

  return {
    visibilityMetrics,
    actualDiscoveredCounts,
    metricsVsActualDivergence: { totalPct, top3Pct, top10Pct },
    contradictions,
  };
}

// ─── Module 2: Monitoring Extension ───

export async function computeMonitoringExtDiagnostic(
  input: DiagnosticInput
): Promise<MonitoringExtDiagnostic> {
  // 2a. Position distribution
  const buckets: Record<string, number> = {
    "1-3": 0,
    "4-10": 0,
    "11-20": 0,
    "21-50": 0,
    "51-100": 0,
    "100+": 0,
  };

  for (const kw of input.activeKws) {
    const pos = kw.currentPosition;
    if (pos == null || typeof pos !== "number") continue;
    if (pos >= 1 && pos <= 3) buckets["1-3"]++;
    else if (pos >= 4 && pos <= 10) buckets["4-10"]++;
    else if (pos >= 11 && pos <= 20) buckets["11-20"]++;
    else if (pos >= 21 && pos <= 50) buckets["21-50"]++;
    else if (pos >= 51 && pos <= 100) buckets["51-100"]++;
    else if (pos > 100) buckets["100+"]++;
  }

  const bucketSum = Object.values(buckets).reduce((a, b) => a + b, 0);
  const distributionSumMatchesTotal =
    bucketSum === input.monitoringComputed.totalWithPosition;

  // 2b. recentPositions health
  const threshold = new Date(input.now - 7 * 24 * 3600_000)
    .toISOString()
    .split("T")[0];
  let fresh = 0;
  let stale7d = 0;
  let empty = 0;

  for (const kw of input.activeKws) {
    const rp = kw.recentPositions;
    if (!rp || rp.length === 0) {
      empty++;
      continue;
    }
    const latestDate = rp[rp.length - 1].date;
    if (latestDate >= threshold) {
      fresh++;
    } else {
      stale7d++;
    }
  }

  return {
    positionDistribution: buckets,
    distributionSumMatchesTotal,
    recentPositionsHealth: { fresh, stale7d, empty },
  };
}

// ─── Module 3: Keyword Map ───

export async function computeKeywordMapDiagnostic(
  input: DiagnosticInput
): Promise<KeywordMapDiagnostic> {
  const contradictions: string[] = [];
  const discovered = input.discovered;
  const discoveredKeywordsTotal = discovered.length;

  // 3a. NaN detection
  let nanDifficulty = 0;
  let nanSearchVolume = 0;
  let nanPosition = 0;
  for (const dk of discovered) {
    if (typeof dk.difficulty === "number" && isNaN(dk.difficulty))
      nanDifficulty++;
    if (typeof dk.searchVolume === "number" && isNaN(dk.searchVolume))
      nanSearchVolume++;
    if (typeof dk.bestPosition === "number" && isNaN(dk.bestPosition))
      nanPosition++;
  }

  // 3b. Quick Wins
  let quickWinCandidates = 0;
  let quickWinExcludedByNaN = 0;
  for (const dk of discovered) {
    if (dk.bestPosition >= 4 && dk.bestPosition <= 30) {
      if (
        typeof dk.difficulty === "number" &&
        !isNaN(dk.difficulty) &&
        dk.difficulty < 50
      ) {
        quickWinCandidates++;
      } else if (typeof dk.difficulty === "number" && isNaN(dk.difficulty)) {
        quickWinExcludedByNaN++;
      }
    }
  }
  if (quickWinExcludedByNaN > 0) {
    contradictions.push(
      `${quickWinExcludedByNaN} quick win candidates excluded due to NaN difficulty`
    );
  }

  // 3c. Cannibalization
  const urlCounts = new Map<string, number>();
  for (const dk of discovered) {
    if (dk.url) {
      urlCounts.set(dk.url, (urlCounts.get(dk.url) ?? 0) + 1);
    }
  }
  let cannibalizationUrlCount = 0;
  for (const count of urlCounts.values()) {
    if (count > 1) cannibalizationUrlCount++;
  }
  if (
    discoveredKeywordsTotal > 0 &&
    cannibalizationUrlCount > discoveredKeywordsTotal * 0.3
  ) {
    contradictions.push(
      `${cannibalizationUrlCount} URLs target multiple keywords (>${Math.round(discoveredKeywordsTotal * 0.3)} threshold) — potential cannibalization`
    );
  }

  // 3d. isMonitored consistency
  const monitoredPhrases = new Set(
    input.activeKws.map((kw) => kw.phrase.toLowerCase())
  );
  let monitoredMatchCount = 0;
  for (const dk of discovered) {
    if (monitoredPhrases.has(dk.keyword.toLowerCase())) {
      monitoredMatchCount++;
    }
  }
  const monitoredNoMatchCount = input.activeKws.length - monitoredMatchCount;
  if (
    input.activeKws.length > 0 &&
    monitoredNoMatchCount > input.activeKws.length * 0.5
  ) {
    contradictions.push(
      `${monitoredNoMatchCount} monitored keywords have no match in discovered keywords`
    );
  }

  return {
    discoveredKeywordsTotal,
    discoveredWithNaN: {
      difficulty: nanDifficulty,
      searchVolume: nanSearchVolume,
      position: nanPosition,
    },
    quickWinCandidates,
    quickWinExcludedByNaN,
    cannibalizationUrlCount,
    monitoredMatchCount,
    monitoredNoMatchCount,
    contradictions,
  };
}

// ─── Module 4: Visibility ───

export async function computeVisibilityDiagnostic(
  input: DiagnosticInput
): Promise<VisibilityDiagnostic> {
  const contradictions: string[] = [];
  const fromDK = {
    total: input.visibilityComputed.totalKeywords,
    top3: input.visibilityComputed.top3,
    top10: input.visibilityComputed.top10,
    avgPosition: input.visibilityComputed.avgPosition,
  };

  if (!input.visHistory) {
    return {
      fromDiscoveredKeywords: fromDK,
      fromVisibilityHistory: null,
      divergence: { totalPct: null, top3Pct: null, top10Pct: null },
      contradictions,
    };
  }

  const m = input.visHistory.metrics;
  const vhTotal = m.count ?? 0;
  const vhTop3 = (m.pos_1 ?? 0) + (m.pos_2_3 ?? 0);
  const vhTop10 = vhTop3 + (m.pos_4_10 ?? 0);
  const fromVH = { total: vhTotal, top3: vhTop3, top10: vhTop10 };

  const totalPct = pctDivergence(fromDK.total, vhTotal);
  const top3Pct = pctDivergence(fromDK.top3, vhTop3);
  const top10Pct = pctDivergence(fromDK.top10, vhTop10);

  if (top3Pct !== null && top3Pct > 30) {
    contradictions.push(
      `Visibility tab data sources diverge on top3: discovered=${fromDK.top3}, history=${vhTop3}`
    );
  }
  if (totalPct !== null && totalPct > 30) {
    contradictions.push(
      `Visibility tab data sources diverge on total: discovered=${fromDK.total}, history=${vhTotal}`
    );
  }

  return {
    fromDiscoveredKeywords: fromDK,
    fromVisibilityHistory: fromVH,
    divergence: { totalPct, top3Pct, top10Pct },
    contradictions,
  };
}

// ─── Module 5: Backlinks Extension ───

export async function computeBacklinksExtDiagnostic(
  input: DiagnosticInput
): Promise<BacklinksExtDiagnostic> {
  const contradictions: string[] = [];
  const backlinks = input.backlinks;
  const total = backlinks.length;

  let nullSpamScore = 0;
  let nullDofollow = 0;
  let toxicCount = 0;
  const anchorTypeDistribution: Record<string, number> = {};

  for (const bl of backlinks) {
    if (bl.backlink_spam_score == null) {
      nullSpamScore++;
    } else if (bl.backlink_spam_score >= 70) {
      toxicCount++;
    }

    if (bl.dofollow == null) {
      nullDofollow++;
    }

    const itemType = bl.itemType ?? "unknown";
    anchorTypeDistribution[itemType] =
      (anchorTypeDistribution[itemType] ?? 0) + 1;
  }

  if (total > 0 && nullSpamScore > total * 0.5) {
    contradictions.push(
      `Over 50% of backlinks have no spam score — toxic count may be underreported`
    );
  }

  const distributionSum = Object.values(anchorTypeDistribution).reduce(
    (a, b) => a + b,
    0
  );
  if (distributionSum !== total) {
    contradictions.push(
      `Anchor type distribution sum (${distributionSum}) != total backlinks (${total})`
    );
  }

  return {
    nullSpamScore,
    nullDofollow,
    anchorTypeDistribution,
    toxicCount,
    contradictions,
  };
}
