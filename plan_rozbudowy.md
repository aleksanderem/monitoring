# Plan rozbudowy endpointu diagnostycznego

Cel: diagnostic endpoint powinien cross-walidować WSZYSTKIE dane wyświetlane w UI per domena, per zakładka. Każda metryka widoczna dla użytkownika musi mieć odpowiadającą walidację, która sprawdza czy dane są spójne wewnętrznie i cross-tabowo.

Plik do modyfikacji: `convex/diagnostic.ts` → funkcja `buildDiagnosticSnapshot`

---

## Obecny stan pokrycia

Pokryte: Monitoring (denormalizacja, top3/top10, 7d movement, staleness), Widoczność (discoveredKeywords, cross-validation z monitoring), Backlinki (summary vs table, dofollow ratio), Luki w treści (NaN scores, priority consistency), Konkurenci (count + positions), Jobs (stuck), Limits (enforcement).

Brakuje: Przegląd, Mapa słów kluczowych, Link Building, On-Site, pełne Luki w treści, Wnioski, częściowo Konkurenci i Backlinki.

---

## Moduł 1: Przegląd (Overview)

Queries w UI:
- `domains.getLatestVisibilityMetrics` → top3, top10, top20, top50, total, etv, isUp, isDown, isNew, isLost, change
- `keywords.getMonitoringStats` → totalKeywords, avgPosition, top10Count, improvingCount, decliningCount
- `domains.getForecastSummary` → forecastData (jeśli istnieje)

### 1a. getLatestVisibilityMetrics — cross-walidacja z discoveredKeywords

Logika: `getLatestVisibilityMetrics` czyta z `domainVisibilityHistory` (zagregowane metryki z DataForSEO). Te powinny odpowiadać aktualnym rekordom w `discoveredKeywords`.

Walidacje:
- `visMetrics.total` vs `count(discoveredKeywords where bestPosition != 999)` → jeśli rozbieżność > 20%, contradiction
- `visMetrics.top3` vs `count(discoveredKeywords where bestPosition <= 3)` → jeśli rozbieżność > 30%, contradiction
- `visMetrics.top10` vs `count(discoveredKeywords where bestPosition <= 10)` → jeśli rozbieżność > 30%, contradiction
- Jeśli `visMetrics.isUp + visMetrics.isDown` > `visMetrics.total` → violation (więcej zmian niż keywords)

Dane do zwrotu:
```
overview: {
  visibilityMetrics: { total, top3, top10, etv, isUp, isDown },
  actualDiscoveredCounts: { total, top3, top10 },
  metricsVsActualDivergence: { totalPct, top3Pct, top10Pct },
  contradictions: string[]
}
```

### 1b. getMonitoringStats — spójność z monitoring tab

Logika: Overview wyświetla te same dane co Monitoring tab. Diagnostic już oblicza monitoring stats (monTop3, monTop10, monAvgPos, monGainers, monLosers) — wystarczy dodać do outputu explicit porównanie z overview.

Walidacje:
- Monitoring avgPosition powinno == diagnostic monAvgPos (już obliczane)
- Jeśli Overview pokazuje monitoringStats ale Monitoring tab liczy inaczej → contradiction

To jest już pokryte przez istniejący crossValidation.monitoring — nie wymaga dodatkowej pracy.

---

## Moduł 2: Monitoring

Już pokryty: denormalizacja, top3/top10, movement, staleness.

### 2a. Dodatkowe: getPositionDistribution consistency

Logika: `getPositionDistribution` groupuje keywords wg bucket (1-3, 4-10, 11-20, 21-50, 51-100, 100+). Suma bucketów powinna == totalWithPosition.

Walidacje:
- Obliczyć distribution z activeKws w diagnostic (mamy pętlę po keywords)
- Sprawdzić: sum(all buckets) == monPosCount
- Dodać buckety do crossValidation.monitoring output

Dane do zwrotu:
```
monitoring: {
  ...existing,
  positionDistribution: { "1-3": N, "4-10": N, "11-20": N, "21-50": N, "51-100": N, "100+": N },
  distributionSumMatchesTotal: boolean
}
```

### 2b. getMovementTrend — sprawdzenie danych trendu

Logika: `getMovementTrend` czyta `recentPositions` per keyword i buduje daily series. Diagnostic powinien sprawdzić czy recentPositions ma sensowne daty.

Walidacje:
- Dla każdego keyword z recentPositions: czy daty są unikalne, czy są w formacie YYYY-MM-DD, czy najnowsza data jest < 7 dni temu
- Jeśli > 50% keywords ma stale recentPositions (najnowszy > 7d) → warning

Dane do zwrotu:
```
monitoring: {
  ...existing,
  recentPositionsHealth: { fresh: N, stale7d: N, empty: N }
}
```

---

## Moduł 3: Mapa słów kluczowych (Keyword Map)

Queries w UI:
- `keywordMap_queries.getKeywordMapData` → discoveredKeywords + monitoredKeywords join
- `keywordMap_queries.getQuickWins` → discoveredKeywords filtered (pos 4-30, difficulty < 50)
- `keywordMap_queries.getSerpFeatureOpportunities`
- `keywordMap_queries.getCompetitorOverlapData`
- `keywordMap_queries.getCannibalizationData`
- `keywordMap_queries.getIntentDistribution`
- `keywordMap_queries.getDifficultyDistribution`

### 3a. Quick Wins — NaN safety i spójność z keyword map

Logika: `calculateQuickWinScore` używa `!searchVolume` (falsy check) i `!position` — to łapie NaN (bo NaN jest falsy). Ale `dk.difficulty ?? 100` NIE łapie NaN (`NaN ?? 100` = NaN), więc filter `dk.difficulty < 50 || dk.difficulty == null` nie łapie NaN-difficulty keywords (NaN < 50 = false → excluded).

Walidacje:
- Policzyć discoveredKeywords z NaN difficulty, NaN searchVolume, NaN bestPosition
- Sprawdzić ile quick wins jest pomijanych z powodu NaN difficulty
- Quick wins count powinno być > 0 jeśli są keywords w pozycjach 4-30

Dane do zwrotu:
```
keywordMap: {
  discoveredKeywordsTotal: N,
  discoveredWithNaN: { difficulty: N, searchVolume: N, position: N },
  quickWinCandidates: N,  // pos 4-30 with valid data
  quickWinExcludedByNaN: N,
  cannibalizationUrlCount: N,
  contradictions: string[]
}
```

### 3b. Cannibalization — URL overlap

Logika: `getCannibalizationData` grupuje discoveredKeywords by URL. Jeśli > 1 keyword na tym samym URL → cannibalization.

Walidacje:
- Policzyć unikalne URLe w discoveredKeywords
- Policzyć URLe z > 1 keyword
- Jeśli cannibalization count > 30% of total URLs → warning (może być overcount z powodu generic URLs)

### 3c. isMonitored flag consistency

Logika: `getKeywordMapData` oznacza keywords jako `isMonitored` jeśli discoveredKeyword.keyword matches monitored keyword phrase. Jeśli wiele monitored keywords NIE ma odpowiednika w discovered → inconsistency.

Walidacje:
- Policzyć monitored keywords z dopasowaniem w discovered
- Policzyć monitored keywords BEZ dopasowania
- Jeśli > 50% monitored nie ma odpowiednika → warning (visibility scan may be stale or domain mismatch)

---

## Moduł 4: Widoczność (Visibility)

Już częściowo pokryty (discoveredKeywords count, cross-validation z monitoring).

### 4a. getVisibilityStats — spójność wewnętrzna

Logika: `getVisibilityStats` oblicza top3Count, top10Count, avgPosition z `discoveredKeywords`. Diagnostic oblicza te same wartości (visTop3, visTop10, visAvgPos). Sprawdzić czy obliczenia się zgadzają.

Walidacje:
- visibilityStats.top3Count == diagnostic visTop3 (powinno być identyczne bo to te same dane)
- visibilityStats.avgPosition == diagnostic visAvgPos

To jest pośrednio pokryte — diagnostic robi to samo obliczenie. Ale dodać explicit visibilityScore do outputu.

### 4b. getLatestVisibilityMetrics vs getVisibilityStats

Logika: Te dwa query czytają z RÓŻNYCH tabel! `getVisibilityStats` czyta z `discoveredKeywords`, a `getLatestVisibilityMetrics` czyta z `domainVisibilityHistory`. Jeśli się rozjeżdżają → widoczny problem w UI (Overview vs Visibility tab mogą pokazywać inne liczby).

Walidacje:
- visibilityMetrics.top3 vs visibilityStats.top3Count → jeśli > 30% rozbieżności → contradiction (z wyjaśnieniem że to dwa różne źródła)
- visibilityMetrics.total vs visibilityStats.totalKeywords

Dane do zwrotu:
```
visibility: {
  fromDiscoveredKeywords: { total, top3, top10, avgPosition },
  fromVisibilityHistory: { total, top3, top10 },
  divergence: { totalPct, top3Pct, top10Pct },
  contradictions: string[]
}
```

---

## Moduł 5: Backlinki

Częściowo pokryty (summary vs table count, dofollow ratio).

### 5a. getBacklinkDistributions — NaN i spójność

Logika: `getBacklinkDistributions` liczy anchor text types, dofollow/nofollow ratio, spam score distribution. Dane mogą mieć null/undefined pola.

Walidacje:
- Policzyć backlinks z null spam_score → te nie wejdą w toxic count w Insights
- Policzyć backlinks z null dofollow → te wpadną jako nofollow (false is the default)
- Anchor text distribution: sum of all types == total backlinks

Dane do zwrotu:
```
backlinks: {
  ...existing,
  nullSpamScore: N,
  nullDofollow: N,
  anchorTypeDistribution: { text: N, image: N, empty: N, other: N },
  contradictions: string[]
}
```

### 5b. Backlink velocity — getVelocityStats consistency

Logika: `backlinkVelocity.getVelocityStats` oblicza new/lost backlinks w oknie 7d i 30d. Powinno korelować z summary diff (jeśli jest >1 summary record).

Walidacje:
- Jeśli velocity mówi +50 new backlinks (30d) ale summary.totalBacklinks się nie zmienił → contradiction
- Ten check wymaga > 1 domainBacklinksSummary record (historycznego) — sprawdzić czy istnieje

### 5c. Cross-tab: Insights toxic count vs Backlinks toxic count

Logika: `getBacklinkInsights` (Wnioski) liczy toxic jako `backlink_spam_score >= 70`. `getBacklinks` (Backlinki tab) pozwala filtrować. Te powinny być spójne.

Walidacje:
- Policzyć toxic (spam_score >= 70) z domainBacklinks table → to jest ground truth
- Porównać z insights output

---

## Moduł 6: Link Building

Queries w UI:
- `linkBuilding_queries.getProspectStats` → totalProspects, activeProspects, avgScore, avgImpact, byDifficulty
- `linkBuilding_queries.getTopProspects` → lista prospects z scoring

### 6a. Prospect stats — spójność z Insights

Logika: `getBacklinkInsights` (zakładka Wnioski) zwraca `activeProspects` z `linkBuildingProspects`. To powinna być ta sama liczba co `getProspectStats.activeProspects`.

Walidacje:
- Policzyć linkBuildingProspects z status == "identified" (to co Insights liczy)
- Policzyć linkBuildingProspects z status != "dismissed" (to co Link Building liczy jako "active")
- Porównać: insights.activeProspects vs linkBuilding.activeProspects → mogą się różnić bo Insights filtruje `status === "identified"`, a linkBuilding filtruje `status !== "dismissed"` (co obejmuje też "reviewing")
- Udokumentować tę rozbieżność w diagnostic output

### 6b. Prospect scoring NaN

Logika: `prospectScore` i `estimatedImpact` są liczone przy generowaniu prospects. Sprawdzić czy nie ma NaN.

Walidacje:
- Policzyć prospects z NaN prospectScore lub NaN estimatedImpact
- Jeśli > 0 → warning

Dane do zwrotu:
```
linkBuilding: {
  totalProspects: N,
  activeProspects: N,  // status != "dismissed"
  identifiedProspects: N,  // status == "identified"
  reviewingProspects: N,
  nanScoring: N,
  insightsVsLinkBuildingNote: string,
  contradictions: string[]
}
```

---

## Moduł 7: Konkurenci

Częściowo pokryty (count + czy mają positions).

### 7a. getKeywordGaps — NaN w gapScore

Logika: `getKeywordGaps` oblicza gapScore z searchVolume, difficulty, positionGap. Po naprawie w S0071 NaN jest chroniony, ale diagnostic powinien weryfikować że żaden gapScore nie jest NaN.

Walidacje:
- Policzyć keyword gaps (z competitorKeywordPositions) — ile ma NaN w gapScore source data
- Sprawdzić keywords z NaN searchVolume lub NaN difficulty (source data)

### 7b. getCompetitorGapComparison — totalScore consistency

Logika: `getCompetitorGapComparison` sumuje opportunityScore per competitor. Po naprawie w S0071 to jest NaN-safe. Diagnostic powinien weryfikować.

Walidacje:
- Dla każdego competitor: sum of gap opportunityScores (NaN-safe) == total wyświetlany
- Policzyć NaN opportunityScores w contentGaps per competitor

### 7c. Competitor positions coverage

Logika: Każdy aktywny competitor powinien mieć pozycje dla WSZYSTKICH monitorowanych keywords (bo tracking obejmuje wszystkie).

Walidacje:
- Dla każdego active competitor: ile keywords ma pozycje vs ile jest active keywords total
- Jeśli coverage < 50% → warning (tracking może nie działać)

Dane do zwrotu:
```
competitors: {
  ...existing,
  perCompetitor: [{
    domain: string,
    keywordsCovered: N,
    keywordsTotal: N,
    coveragePct: N,
    latestPositionDate: string | null
  }],
  gapDataQuality: {
    nanSearchVolume: N,
    nanDifficulty: N,
    nanOpportunityScore: N
  },
  contradictions: string[]
}
```

---

## Moduł 8: On-Site

Queries w UI:
- `seoAudit_queries.getLatestScan` → scan metadata
- `seoAudit_queries.getLatestAnalysis` → domainOnsiteAnalysis (healthScore, issues)
- `seoAudit_queries.getOnSiteHealthCard` → healthScore + breakdown
- `seoAudit_queries.getIssuesSummary` → issue counts by severity

### 8a. On-Site health score — spójność z Insights

Logika: `getDomainHealthScore` (Wnioski) czyta `domainOnsiteAnalysis.healthScore` i konwertuje na 0-20 punktów. On-Site tab wyświetla healthScore jako 0-100. Te powinny korelować.

Walidacje:
- Sprawdzić czy `domainOnsiteAnalysis` istnieje
- Jeśli healthScore == null → Insights daje domyślne 10/20 punktów
- Jeśli healthScore < 70 → Insights powinien generować recommendation "recLowOnPageScore"
- Weryfikacja: (healthScore / 100) * 20 ≈ to co Insights liczy jako onsiteScore

### 8b. Scan freshness

Walidacje:
- Ostatni scan age — jeśli > 30 dni → warning (stale on-site data)
- Jeśli scan status == "crawling" i startedAt > 2h ago → warning (stuck scan)
- Jeśli analysis istnieje ale scan nie → violation (orphaned analysis)

### 8c. Issues consistency

Walidacje:
- Sum of issues by severity == total issues count (jeśli te dane są dostępne)
- Jeśli healthScore jest wysoki (> 80) ale jest > 10 high-severity issues → contradiction

Dane do zwrotu:
```
onSite: {
  hasAnalysis: boolean,
  healthScore: number | null,
  lastScanAge: number | null,  // hours
  scanStatus: string | null,
  issuesSummary: { critical: N, warning: N, info: N } | null,
  insightsOnsiteScore: number,  // what Insights would compute (0-20)
  contradictions: string[]
}
```

---

## Moduł 9: Luki w treści (Content Gaps) — rozszerzenie

Już częściowo pokryty (NaN scores, NaN difficulty, priority consistency).

### 9a. getGapSummary — totalEstimatedValue NaN

Logika: Po naprawie w S0071 `getGapSummary` jest NaN-safe. Diagnostic powinien weryfikować source data.

Walidacje:
- Policzyć gaps z NaN estimatedTrafficValue
- Jeśli > 0 → warning + run repairContentGapScores

### 9b. getTopicClusters — cluster math

Logika: `getTopicClusters` grupuje gaps by first word i sumuje scores. Suma totalOpportunityScore all clusters powinna == sum opportunityScore all non-dismissed gaps.

Walidacje:
- Sum(cluster.totalOpportunityScore for all clusters) vs sum(gap.opportunityScore for non-dismissed gaps, NaN-safe)
- Gaps bez phrase (keyword deleted) → orphaned gaps
- Gaps z keywordId that doesn't exist in keywords table → orphaned reference

### 9c. getCompetitorGapComparison — totalScore cross-check z getGapSummary

Logika: Sum of all competitors' totalScore == sum of all non-dismissed gaps' opportunityScore.

Walidacje:
- Sum(competitor.totalScore) should approximate sum(non-dismissed gap scores)
- Gaps without competitorId that exists → orphaned competitor reference

### 9d. Content gaps vs Insights recommendations

Logika: Insights `getRecommendations` zlicza high-priority identified gaps. Content Gaps tab `getGapSummary` też zwraca highPriority count. Te powinny być identyczne.

Walidacje:
- diagnostic.contentGaps.highPriority (recalculated) vs what Recommendations would count → te powinny być tożsame po naprawie S0071
- Jeśli > 0 high-priority identified gaps → Recommendations powinno zawierać "content" recommendation

Dane do zwrotu (rozszerzenie istniejącego):
```
contentGaps: {
  ...existing,
  nanEstimatedTrafficValue: N,
  orphanedGaps: N,  // keywordId not in keywords table
  orphanedCompetitorRefs: N,  // competitorId not in competitors table
  clusterScoreSum: number,
  allGapsScoreSum: number,
  clusterVsAllMatch: boolean,
  contradictions: string[]
}
```

---

## Moduł 10: Wnioski (Insights)

Queries w UI:
- `insights_queries.getDomainHealthScore` → totalScore, breakdown (keywords 30, backlinks 30, onsite 20, content 20)
- `insights_queries.getKeywordInsights` → atRisk, opportunities, nearPage1
- `insights_queries.getBacklinkInsights` → toxicCount, dofollowRatio, newBacklinks, activeProspects
- `insights_queries.getRecommendations` → prioritized list

### 10a. Health score breakdown math

Logika: `totalScore = keywordScore + backlinkScore + onsiteScore + contentScore`. Każdy sub-score ma swój max.

Walidacje:
- totalScore == sum of breakdown scores (musi się zgadzać arytmetycznie)
- keywordScore <= 30, backlinkScore <= 30, onsiteScore <= 20, contentScore <= 20
- totalScore <= 100

### 10b. getKeywordInsights — spójność z Monitoring

Logika: `getKeywordInsights` liczy atRisk (drop > 5 pos w 7d) i opportunities (gain > 5 pos). To powinno korelować z monitoring movement data.

Walidacje:
- atRiskCount + opportunityCount <= totalActiveKeywords
- Jeśli monitoring.gainers7d > 0 ale insights.opportunities == 0 → possible inconsistency (różne thresholds: monitoring liczy ANY improvement, insights liczy > 5)
- Dodać notatkę o tym w diagnostic output

### 10c. getBacklinkInsights — cross-tab spójność

Logika: `getBacklinkInsights` oblicza toxicCount, dofollowRatio, activeProspects z kilku tabel. Te powinny zgadzać się z odpowiednikami na zakładkach Backlinki i Link Building.

Walidacje:
- insights.toxicCount == count(domainBacklinks where spam_score >= 70) → ground truth
- insights.dofollowRatio — czy zgadza się z backlinks summary ratio (diagnostic już to sprawdza)
- insights.activeProspects == count(linkBuildingProspects where status == "identified")

### 10d. getRecommendations — logiczna poprawność

Logika: Recommendations używa konkretnych thresholdów do generowania rad. Diagnostic powinien sprawdzić czy wygenerowane recommendations odpowiadają faktycznym danym.

Walidacje:
- Jeśli droppingCount > 5 → powinna być recommendation "recSignificantRankingDrops" z priority "high"
- Jeśli toxicCount > 10 → powinna być recommendation "recToxicBacklinks" z priority "high"
- Jeśli highPriorityGaps > 10 → powinna być recommendation "recHighPriorityContentGaps" z priority "high"
- Jeśli onsiteHealthScore < 70 → powinna być recommendation "recLowOnPageScore" z priority "high"

Dane do zwrotu:
```
insights: {
  healthScore: {
    total: N,
    breakdown: { keywords: N, backlinks: N, onsite: N, content: N },
    mathCorrect: boolean,  // total == sum of breakdown
    withinBounds: boolean  // each score <= max
  },
  keywordInsightsVsMonitoring: {
    insightsAtRisk: N,
    insightsOpportunities: N,
    monitoringGainers: N,
    monitoringLosers: N,
    note: string  // "Different thresholds: insights uses >5 positions, monitoring counts any change"
  },
  backlinkInsightsCrossCheck: {
    toxicCount: N,
    dofollowRatio: N,
    activeProspects: N,
    matchesBacklinksTab: boolean,
    matchesLinkBuildingTab: boolean
  },
  recommendationsCheck: {
    expectedHighPriority: string[],
    actualHighPriority: string[],
    missingRecommendations: string[],
    unexpectedRecommendations: string[]
  },
  contradictions: string[]
}
```

---

## Moduł 11: Badanie AI (AI Research)

Query w UI:
- `aiResearch.getHistory` → lista research sessions

### 11a. Minimalna walidacja

AI Research to niezależny moduł — nie generuje danych które wpływają na inne zakładki. Minimalna walidacja:

Walidacje:
- Policzyć research sessions per domain
- Sprawdzić czy jakieś sessions mają status "running" dłużej niż 10 min → stuck

Dane do zwrotu:
```
aiResearch: {
  totalSessions: N,
  stuckSessions: N
}
```

---

## Moduł 12: Ustawienia (Settings)

Już pokryty przez limits enforcement. Nie wymaga dodatkowej pracy.

---

## Cross-tab contradictions (nowe sekcje)

Oprócz per-moduł walidacji, dodać globalne cross-tab checks:

### CT1: "Keywords count" wszędzie powinno być spójne
- Monitoring tab: activeKeywords count
- Przegląd: ten sam count
- Wnioski: ten sam count (getDomainHealthScore.stats.totalKeywords)
- Competitors: getCompetitorStats.totalKeywords

### CT2: "Content gaps high priority" spójne cross-tab
- Content Gaps tab: getGapSummary.highPriority
- Competitors tab: getCompetitorStats.highPriorityGaps
- Insights tab: getRecommendations high priority gap count

### CT3: "Toxic backlinks" spójne cross-tab
- Backlinks tab: toxic filter count
- Insights tab: getBacklinkInsights.toxicCount
- Recommendations: toxic backlinks recommendation threshold

### CT4: "Link building prospects" spójne cross-tab
- Link Building tab: getProspectStats.activeProspects
- Insights tab: getBacklinkInsights.activeProspects

---

## Implementacja — kolejność

1. Rozszerzyć typ `DomainStats` o nowe sekcje: overview, keywordMap, visibility, linkBuilding, onSite, insights, aiResearch
2. Dodać obliczenia w głównej pętli `for (const domain of domains)`:
   a. Moduł 8 (On-Site) — niezależny, proste query
   b. Moduł 6 (Link Building) — niezależny, proste query
   c. Moduł 11 (AI Research) — niezależny, proste query
   d. Moduł 1 (Przegląd) — wymaga danych z istniejących obliczeń
   e. Moduł 3 (Mapa) — wymaga discoveredKeywords (już ładowane)
   f. Moduł 4 (Widoczność) — rozszerzenie istniejącego
   g. Moduł 5 (Backlinki) — rozszerzenie istniejącego
   h. Moduł 7 (Konkurenci) — rozszerzenie istniejącego
   i. Moduł 9 (Luki) — rozszerzenie istniejącego
   j. Moduł 10 (Wnioski) — wymaga danych z wielu modułów, robić na końcu
3. Dodać cross-tab contradictions (CT1-CT4) po zebraniu wszystkich danych
4. Dodać nowe invariants do summary

## Uwagi dot. wydajności

- Diagnostic to query dev-only (admin). Może być wolniejszy niż produkcyjne query.
- Unikać N+1 — reużywać dane już załadowane (keywords, discoveredKeywords, competitors, gaps, backlinks)
- Większość nowych danych to obliczenia in-memory na już-załadowanych rekordach
- Nowe query: onSiteScans (1 per domain), linkBuildingProspects (1 per domain), aiResearch history (1 per domain), domainOnsiteAnalysis (już ładowane? nie — dodać)
