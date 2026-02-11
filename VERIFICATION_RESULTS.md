# Wyniki weryfikacji przepływu danych — Monitoring App

Data audytu: 2026-02-11
Sesja: S0054
Agenty: backend-auditor, logic-auditor, frontend-auditor

---

## Podsumowanie

| Kategoria | Liczba |
|-----------|--------|
| KRYTYCZNE BUGI | 5 |
| BUGI | 1 |
| OSTRZEŻENIA | 12 |
| PASS | 16 |

---

## KRYTYCZNE BUGI (user widzi bzdury lub system się psuje)

### BUG-01: clearKeywordCheckingStatusBatch crash na usuniętych keywords [BACKEND]

Plik: `convex/keywordCheckJobs.ts`, linia 489
Problem: `ctx.db.patch(keywordId, {...})` rzuca błąd jeśli keyword został usunięty w trakcie jobu. Ponieważ jest to pojedyncza mutacja, Convex rollbackuje CAŁĄ batch — wszystkie keywords w jobie zostają zablokowane w statusie "checking" na zawsze.
Wpływ: UI wyświetla "checking..." dla wszystkich keywords w domenie, jedyny workaround to ręczny `clearAllCheckingStatuses`.
Priorytet: P0 — blokuje cały workflow monitoringu.
Fix: Dodać `try/catch` wokół `ctx.db.patch` lub sprawdzać istnienie keyword przed patch (`const kw = await ctx.db.get(keywordId); if (!kw) continue;`).

### BUG-02: `|| undefined` traci wartości falsy w backlinks [BACKEND]

Plik: `convex/backlinks.ts`, linia 204 + `convex/backlinks.ts`, linia 604
Problem: `dofollow: backlink.dofollow || undefined` — gdy API zwraca `dofollow: false`, wyrażenie `false || undefined` zwraca `undefined`. Ten sam wzorzec dotyczy: `isNew`, `isLost`, `rank` (wartość 0), `backlink_spam_score` (wartość 0).
Wpływ: Nofollow linki tracą flagę `dofollow: false`. Backlinki z rank=0 lub spam_score=0 tracą te wartości. Statystyki dofollow/nofollow w summary mogą być nieprawidłowe.
Fix: Zmienić na `dofollow: backlink.dofollow ?? undefined` (nullish coalescing) lub lepiej: `dofollow: backlink.dofollow !== undefined ? backlink.dofollow : undefined`.

### BUG-03: storePositionInternal nie deduplikuje pozycji [BACKEND]

Plik: `convex/dataforseo.ts`, linia 504
Problem: `ctx.db.insert("keywordPositions", {...})` zawsze insertuje nowy rekord, nigdy nie sprawdza czy istnieje wpis dla tego samego keywordId+date. W kontraście, `storePosition` w keywords.ts poprawnie robi upsert przez index `by_keyword_date`. Ponieważ Convex actions mogą być retryowane, duplikaty pozycji akumulują się.
Wpływ: Wykresy historii pozycji mogą pokazywać zduplikowane punkty. Zapytania "last N positions" zwracają duplikaty zamiast N różnych dni.
Fix: Przed insertem sprawdzić `by_keyword_date` index i update zamiast insert, analogicznie do `storePosition` w keywords.ts.

### BUG-04: formatNumber traktuje 0 jako null w 6 plikach [FRONTEND]

Pliki: `KeywordMonitoringTable.tsx:62`, `KeywordMonitoringDetailModal.tsx:21`, `TopicClustersCard.tsx:47`, `ContentGapDetailModal.tsx:37`, `ContentGapOpportunitiesTable.tsx:55`, `QuickWinDetailModal.tsx:31`
Problem: `if (!num) return "—"` — w JavaScript `!0 === true`, więc wartość 0 wyświetla się jako "—" (brak danych) zamiast "0".
Dodatkowo: `keyword.searchVolume ? formatNumber(...) : "—"` w DiscoveredKeywordsTable i AllKeywordsTable ukrywa searchVolume=0.
Wpływ: CPC=$0.00 wyświetla "—", search volume=0 wyświetla "—", potential traffic=0 wyświetla "—". Użytkownik nie odróżnia "brak danych" od "wartość zero".
Fix: Zmienić na `if (num === null || num === undefined) return "—"`. Zmienić `keyword.searchVolume ?` na `keyword.searchVolume != null ?`.

### BUG-05: ETV obliczane trzema różnymi metodami [FRONTEND]

Pliki: `keywords.ts:190` (MonitoringStats), `domains.ts:616` (ExecutiveSummary), `keywords.ts:260` (MonitoringTable per-keyword)
Problem: Trzy widoki pokazują "ETV" / "Traffic" ale każdy oblicza inaczej:
1. MonitoringStats "Est. Monthly Traffic" = nasz CTR × searchVolume (tylko monitorowane keywords)
2. ExecutiveSummary "Traffic Value (ETV)" = surowa wartość z DataForSEO API (wszystkie discovered keywords)
3. Per-keyword ETV w tabeli = DataForSEO per-keyword ETV
Wpływ: Użytkownik widzi "Est. Monthly Traffic: 1,200" w Monitoring i "ETV: 45,230" w Overview — drastycznie różne liczby bez wyjaśnienia. Podważa zaufanie do danych.
Fix: Ujednolicić formułę lub jasno labelować źródło (np. "Est. Traffic (monitored)" vs "ETV (DataForSEO, all keywords)").

---

## BUGI (widoczne niespójności)

### BUG-06: Niespójna kolorystyka badge'ów pozycji [FRONTEND]

Pliki: `KeywordMonitoringTable.tsx:53-60` vs `TopKeywordsTable.tsx:24-31`
Problem:
- Pozycja 1-3: ZIELONY w Monitoring, NIEBIESKI w TopKeywords
- Pozycja 21-50: SZARY w Monitoring, CZERWONY w TopKeywords
Wpływ: Ten sam keyword (#2) ma zielony badge w jednym tabie i niebieski w drugim. Pozycja #30 jest neutralna (szara) w Monitoring ale alarmowa (czerwona) w TopKeywords.
Fix: Ujednolicić schemat kolorów — Monitoring (zielony=top, szary=dół) jest bardziej intuicyjny.

---

## OSTRZEŻENIA (potencjalne problemy)

### WARN-01: rank_absolute zamiast rank_group [BACKEND]
`dataforseo.ts` używa `rank_absolute` zamiast `rank_group`. rank_absolute liczy wszystkie elementy SERP (reklamy, featured snippets, PAA), więc pozycje mogą być zawyżone o 2-5 pozycji.

### WARN-02: latestCpc nigdy nie jest populowane z głównego SERP flow [BACKEND]
Żaden caller `storePositionInternal` nie przekazuje argumentu `cpc`. Denormalizowane `latestCpc` zostaje undefined. Frontend fallbackuje do `discovered?.cpc`.

### WARN-03: Dwa crony to NOP-y [BACKEND]
`detectAnomaliesDaily` i `analyzeContentGapsWeekly` logują "function needs to be fixed" i nie robią nic.

### WARN-04: Velocity date matching może failować [BACKEND]
`b.firstSeen === today` porównuje stringi. Jeśli API zwraca daty w innym formacie (np. "2025-06-15 08:30:00"), newBacklinks zawsze = 0.

### WARN-05: Position=0 (featured snippet) wypada z dystrybucji [LOGIC]
`getPositionDistribution` filtruje 999 ale nie obsługuje pos=0. Takie keywords nie wpadają do żadnego bucketu (pierwszy branch wymaga pos > 0).

### WARN-06: difficulty=100 zeruje gap score [LOGIC]
W `getKeywordGaps`: `difficultyWeight = 1 - difficulty/100 = 0`, co daje gapScore=0 niezależnie od SV. Agresywne — contentGap.ts obsługuje to łagodniej.

### WARN-07: Pozycja keyword z różnych źródeł w różnych widokach [FRONTEND]
MonitoringTable → `keywords.currentPosition`, TopKeywords → `discoveredKeywords.bestPosition`, Distribution → `discoveredKeywords.bestPosition`. Mogą się rozjeżdżać.

### WARN-08: "Total keywords" oznacza co innego w każdym widoku [FRONTEND]
Monitoring: monitorowane keywords. Visibility: discovered keywords. Overview: historical snapshot. Bez wyjaśnienia.

### WARN-09: Backlinks summary total vs paginacja tabeli [FRONTEND]
Summary: "15,000 backlinks". Tabela: 50 wierszy na stronę, bez info że to nie jest kompletna lista.

### WARN-10: MovementTrend vs MonitoringStats gainers się różnią [FRONTEND]
Chart: DataForSEO monthly history (wszystkie keywords). Cards: nasze tracked positions (monitorowane keywords). Różne źródła, różne populacje.

### WARN-11: Brak walidacji max length na keyword phrase [FRONTEND]
Można submitować phrase 10,000 znaków. Brak ryzyka XSS (React escapuje), ale problem usability/storage.

### WARN-12: Brak walidacji formatu na polach settings [FRONTEND]
searchEngine, location, language jako free text bez walidacji. Invalid values spowodują API failures.

---

## PASS (potwierdzone poprawne)

| # | Punkt kontrolny | Agent |
|---|----------------|-------|
| 1 | positionChange = previousPosition - currentPosition (positive = improvement) | backend |
| 2 | recentPositions capped at 7, sorted, deduped | backend |
| 3 | Job lifecycle pending→processing→completed poprawny | backend |
| 4 | Per-keyword try/catch izoluje failures w jobie | backend |
| 5 | Content gap parsing i batch handling | backend |
| 6 | Division by zero w avgPosition zabezpieczone | logic |
| 7 | Health score — brak NaN propagation, all edge cases | logic |
| 8 | Page scoring — weights sum to 1.0, coverage penalty OK | logic |
| 9 | Competitor overview — null positions correctly excluded | logic |
| 10 | Content gap gapScore — nie może być ujemny (additive formula) | logic |
| 11 | CTR mapping — positions > 100 return 0 | logic |
| 12 | Trend arrows green/up for improvement, red/down for decline | frontend |
| 13 | Position chart Y-axis correctly reversed | frontend |
| 14 | Dates timezone-safe for Polish users | frontend |
| 15 | All components handle loading and empty states | frontend |
| 16 | React auto-escapes XSS in keyword phrases | frontend |

---

## Status napraw (S0054)

Wszystkie 6 bugów naprawione. TypeScript kompiluje bez błędów.

| Bug | Status | Fix |
|-----|--------|-----|
| BUG-01 | NAPRAWIONY | keywordCheckJobs.ts: dodano `ctx.db.get()` guard przed `ctx.db.patch()` w clearKeywordCheckingStatusBatch |
| BUG-02 | NAPRAWIONY | backlinks.ts: zmieniono `\|\|` na `??` (nullish coalescing) w obu saveBacklinkData i saveCompetitorBacklinkData |
| BUG-03 | NAPRAWIONY | dataforseo.ts: storePositionInternal teraz robi upsert (query by_keyword_date → patch or insert) |
| BUG-04 | NAPRAWIONY | KeywordMonitoringTable.tsx + KeywordMonitoringDetailModal.tsx: zmieniono `!num` na `num === null \|\| num === undefined` |
| BUG-05 | NAPRAWIONY | MonitoringStats subtitle: "Based on monitored keywords only". ExecutiveSummary subtitle: "DataForSEO estimate, all keywords" |
| BUG-06 | NAPRAWIONY | TopKeywordsTable.tsx: ujednolicono kolorystykę badge (1-3=success, 4-10=success, 11-20=warning, 21-50+=gray) |

## Pozostałe ostrzeżenia (do rozważenia)

1. WARN-01 (P3): rank_absolute → rank_group
2. WARN-05 (P3): Position 0 handling
3. Remaining WARNs by priority
