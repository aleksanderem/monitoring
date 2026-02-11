# Plan weryfikacji przepływu danych — Monitoring App

## Cel

Przed uruchomieniem aplikacji zweryfikować, że dane pobrane z zewnętrznych API (DataForSEO, SE Ranking, PageSpeed Insights) są poprawnie przetwarzane, przechowywane, denormalizowane i wyświetlane użytkownikowi. Użytkownik nie powinien widzieć wartości absurdalnych, niespójnych między widokami, ani oderwanych od rzeczywistości.

## Metodologia

Każdy test poniżej definiuje: co sprawdzamy, jak to zweryfikować, i jaki wynik jest poprawny. Testy pogrupowane są w 7 faz — od źródła danych, przez przetwarzanie, po wyświetlanie.

---

## FAZA 1: Integralność danych źródłowych (API → Convex)

Weryfikujemy, czy dane wchodzące z zewnętrznych API są prawidłowo parsowane i nie gubimy informacji ani nie przekłamujemy wartości na etapie zapisu.

### 1.1 DataForSEO — pozycje słów kluczowych

PUNKT KONTROLNY: Porównać surową odpowiedź API z tym, co zapisujemy w tabeli keywordPositions.

PROCEDURA:
1. Wybrać 5 słów kluczowych o znanych pozycjach (sprawdzić ręcznie w Google dla wybranej lokalizacji).
2. Uruchomić fetchSinglePositionInternal dla tych słów.
3. Zalogować surową odpowiedź API (response.tasks[0].result[0].items).
4. Porównać z rekordem w keywordPositions:
   - Czy position odpowiada rank_group z API (nie rank_absolute)?
   - Czy url jest prawidłowy URL strony (nie URL Google)?
   - Czy date to data dzisiejsza (format YYYY-MM-DD)?
   - Czy searchVolume, difficulty, cpc zgadzają się z API?

CO MOŻE PÓJŚĆ NIE TAK:
- Mapowanie rank_group vs rank_absolute — API zwraca oba, my powinniśmy używać rank_group (pozycja organiczna) nie rank_absolute (pozycja na SERP z reklamami).
- Null position gdy keyword nie rankuje — czy poprawnie zapisujemy null, a nie 0 czy undefined?
- Lokalizacja — czy parametr location_code odpowiada wybranej lokalizacji domeny? Błąd tu da kompletnie inne wyniki.

### 1.2 DataForSEO — dane visibility (discovered keywords)

PUNKT KONTROLNY: Porównać metryki visibility z tym, co raportuje DataForSEO w panelu.

PROCEDURA:
1. Dla domeny testowej pobrać visibility z DataForSEO panelu (manualna weryfikacja).
2. Uruchomić fetchAndStoreVisibility.
3. Porównać:
   - Czy total keywords w discoveredKeywords odpowiada API?
   - Czy pozycje bestPosition są w zakresie 1-100 (nie 0, nie >100)?
   - Czy ETV jest liczbą >= 0 (nie NaN, nie ujemny)?
   - Czy searchVolume jest liczbą całkowitą >= 0?

CO MOŻE PÓJŚĆ NIE TAK:
- API zwraca position=0 dla featured snippets — czy traktujemy to jako pozycję 1, czy oddzielnie?
- ETV z API może być null — czy obsługujemy to jako 0?
- Kodowanie znaków w keyword phrase (polskie znaki, apostrofy) — czy zachowujemy oryginał?

### 1.3 SE Ranking — backlinki

PUNKT KONTROLNY: Porównać summary i listę backlinków z danymi w SE Ranking panelu.

PROCEDURA:
1. Dla domeny testowej sprawdzić SE Ranking dashboard manualne.
2. Uruchomić fetchBacklinksFromAPI.
3. Porównać:
   - Czy totalBacklinks, totalDomains, dofollow, nofollow zgadzają się?
   - Czy domainBacklinks zawiera oczekiwaną liczbę rekordów (limit API)?
   - Czy rank i backlink_spam_score są w zakresie 0-100?
   - Czy firstSeen, lastSeen to prawidłowe daty (nie null, nie w przyszłości)?
   - Czy urlFrom i urlTo to prawidłowe URL-e (nie puste stringi)?

CO MOŻE PÓJŚĆ NIE TAK:
- Limit API (np. top 1000 backlinków) — czy informujemy użytkownika, że to nie jest 100% backlinków?
- Backlinki z null anchor — czy wyświetlamy pusty string czy "[no anchor]"?
- Duplikaty backlinków z tego samego URL — czy saveBacklinkData prawidłowo czyści stare dane?

### 1.4 DataForSEO — Content Gap (Domain Intersection)

PUNKT KONTROLNY: Czy słowa kluczowe znalezione przez API jako gap są rzeczywiście takie, gdzie competitor rankuje a my nie.

PROCEDURA:
1. Wybrać konkurenta z kilkoma znanymi słowami kluczowymi.
2. Uruchomić analyzeContentGap.
3. Ręcznie sprawdzić 10 zwróconych gaps:
   - Czy competitor faktycznie rankuje na pozycji competitorPosition?
   - Czy nasza domena faktycznie NIE rankuje (lub rankuje nisko)?
   - Czy searchVolume i difficulty są realistyczne?

CO MOŻE PÓJŚĆ NIE TAK:
- API może zwracać słowa brandowe konkurenta (jego nazwa firmy) — czy to filtrujemy?
- Zduplikowane gaps (ten sam keyword, różni konkurenci) — czy obsługujemy poprawnie?
- estimatedTrafficValue obliczony źle (np. negatywny, lub astronomiczny dla niskiego SV).

---

## FAZA 2: Poprawność denormalizacji (mutacje → keywords)

Denormalizacja jest kluczowa dla wydajności, ale źle zaimplementowana może prowadzić do rozbieżności. Weryfikujemy, czy denormalizowane pola na keywords są zawsze spójne z tabelami źródłowymi.

### 2.1 currentPosition vs keywordPositions

PUNKT KONTROLNY: Dla każdego keyword, currentPosition na keywords powinien odpowiadać najnowszemu rekordowi w keywordPositions.

PROCEDURA:
1. Pobrać 20 losowych keywords z denormalizowanym currentPosition.
2. Dla każdego pobrać najnowszy keywordPositions (by_keyword_date, ostatnia data).
3. Porównać:
   - keywords.currentPosition === najnowszy keywordPositions.position
   - keywords.currentUrl === najnowszy keywordPositions.url
   - keywords.positionUpdatedAt >= najnowszy keywordPositions.fetchedAt

KRYTYCZNY SCENARIUSZ: Co jeśli storePositionInternal zaktualizuje keywordPositions ale nie keywords (crash w połowie mutacji)? Convex jest transakcyjny na poziomie mutacji — ale warto to potwierdzić.

### 2.2 previousPosition i positionChange

PUNKT KONTROLNY: positionChange = previousPosition - currentPosition (nie odwrotnie!). Dodatnia wartość = poprawa (przesunięcie w górę).

PROCEDURA:
1. Pobrać 10 keywords z positionChange != 0.
2. Zweryfikować: positionChange = previousPosition - currentPosition.
3. Sprawdzić przypadki brzegowe:
   - previousPosition=null (nowy keyword): positionChange powinien być null lub 0?
   - currentPosition=null (stracona pozycja): positionChange powinien być null?
   - previousPosition=10, currentPosition=5: positionChange=+5 (poprawa).
   - previousPosition=5, currentPosition=10: positionChange=-5 (spadek).

CO MOŻE PÓJŚĆ NIE TAK:
- Odwrócony znak — jeśli liczymy currentPosition - previousPosition zamiast odwrotnie, "poprawa" staje się liczbą ujemną i frontend wyświetli zielone strzałki dla spadków.
- Brak obsługi null — NaN propaguje do frontend i może crashować wykresy.

### 2.3 recentPositions (sparkline data)

PUNKT KONTROLNY: recentPositions powinien zawierać dokładnie 7 (lub mniej jeśli keyword jest nowy) ostatnich wpisów, posortowanych chronologicznie.

PROCEDURA:
1. Pobrać 10 keywords z recentPositions.
2. Dla każdego:
   - Sprawdzić, czy recentPositions.length <= 7.
   - Sprawdzić, czy daty są posortowane rosnąco.
   - Sprawdzić, czy ostatnia data recentPositions odpowiada positionUpdatedAt.
   - Sprawdzić, czy pozycje w recentPositions zgadzają się z keywordPositions.
   - Sprawdzić, czy nie ma duplikatów dat.

CO MOŻE PÓJŚĆ NIE TAK:
- Wielokrotne sprawdzanie tego samego dnia dodaje duplikaty zamiast nadpisywać.
- Array nigdy nie jest przycinany i rośnie ponad 7 elementów.
- Daty w złym formacie (timestamp vs string) psują sortowanie.

### 2.4 Spójność latestCpc z API

PUNKT KONTROLNY: latestCpc na keywords powinien odpowiadać ostatniemu CPC z API.

PROCEDURA:
1. Pobrać 10 keywords z latestCpc.
2. Porównać z cpc z ostatniego keywordPositions lub z danych discoveredKeywords.
3. Sprawdzić, czy wartość ma sens (np. CPC w PLN powinien być < 100 PLN dla większości keywords, nie 999999).

---

## FAZA 3: Poprawność logiki obliczeniowej (queries → frontend data)

### 3.1 Statystyki monitoringu (getMonitoringStats)

PUNKT KONTROLNY: Wartości w 4 kartach metrycznych powinny być matematycznie poprawne.

PROCEDURA:
1. Pobrać surowe dane z getKeywordMonitoring (lista keywords).
2. Ręcznie policzyć:
   - totalKeywords = count(keywords z status="active")
   - avgPosition = mean(currentPosition) dla keywords z pozycją != null
   - Sprawdzić, czy avgPosition nie uwzględnia keywords bez pozycji (null).
3. estimatedMonthlyTraffic:
   - Formuła: sum(searchVolume * CTR(currentPosition)) dla każdego keyword.
   - Sprawdzić tabelę CTR: pozycja 1 = 28.5%, pozycja 2 = 15.7%, pozycja 3 = 11.0%, itd.
   - Czy keywords bez pozycji mają CTR=0 (nie CTR z pozycji 1)?
4. movementBreakdown (7d):
   - Porównać currentPosition z pierwszą wartością z recentPositions (7 dni temu).
   - Gainer: pozycja się poprawiła (mniejszy numer).
   - Loser: pozycja się pogorszyła (większy numer).
   - Stable: brak zmiany lub brak danych do porównania.

PUŁAPKI:
- avgPosition=0 gdy wszystkie keywords mają null pozycję (dzielenie przez 0).
- CTR mapping dla pozycji >100 powinien dawać 0, nie undefined.
- "7 dni temu" mierzone od recentPositions[0] może nie być dokładnie 7 dni, jeśli sprawdzenia nie były codzienne.

### 3.2 Rozkład pozycji (getPositionDistribution)

PUNKT KONTROLNY: Suma wszystkich bucketów = total keywords w monitoring.

PROCEDURA:
1. Pobrać getPositionDistribution.
2. Policzyć: top3 + pos4_10 + pos11_20 + pos21_50 + pos51_100 + pos100plus.
3. Porównać z liczbą discoveredKeywords z position != null.
4. Sprawdzić, czy keywords z position=null NIE są liczone w żadnym buckecie.

PUŁAPKA: Jeśli discoveredKeywords.bestPosition=999 oznacza "nie rankuje" — czy jest odfiltrowane? Jeśli nie, wpadnie do bucketu 100+ i zawyży liczbę.

### 3.3 Health Score (getDomainHealthScore)

PUNKT KONTROLNY: Wynik 0-100 z czterema osiami powinien być logiczny.

PROCEDURA:
1. Dla domeny testowej policzyć ręcznie każdą oś:
   - Keyword Health (0-30): Na podstawie avg position i trendu improving/declining.
   - Backlink Health (0-30): Na podstawie referring domains i ratio domain-to-links.
   - On-Site Health (0-20): Z domainOnsiteAnalysis.healthScore.
   - Content Coverage (0-20): Inverse liczby content gaps.
2. Sprawdzić, czy composite = suma 4 osi.
3. Sprawdzić grade: A(90+), B(80-89), C(70-79), D(50-69), F(<50).
4. Edge cases:
   - Domena bez backlinków: Backlink Health = 0, nie null/NaN.
   - Domena bez on-site scanu: On-Site Health = 0 z informacją "no data".
   - Domena bez content gaps: Content Coverage = 20 (max, bo brak luk).

PUŁAPKA: Jeśli jedna oś zwraca NaN, composite staje się NaN i frontend wyświetli pusty gauge lub "NaN%".

### 3.4 Page Scoring (computePageScores)

PUNKT KONTROLNY: Composite score jest realistyczny i poszczególne osie mają sens.

PROCEDURA:
1. Wybrać stronę z pełnymi danymi Lighthouse.
2. Ręcznie policzyć:
   - Technical Health (10%): Lighthouse performance * 0.3 + CWV * 0.25 + mobile * 0.2 + SSL * 0.15 + loadTime * 0.1.
   - Content Quality (35%): title * 0.2 + meta * 0.2 + readability * 0.25 + wordCount * 0.15 + headings * 0.2.
   - SEO Performance (35%): keyword density * 0.3 + keyword in title * 0.15 + structured data * 0.2 + internal links * 0.15 + canonical * 0.1 + meta robots * 0.1.
   - Strategic Alignment (20%): page rank * 0.3 + backlink quality * 0.25 + topic relevance * 0.25 + competitor ranking * 0.2.
3. Sprawdzić coverage penalty: jeśli <50% metryk dostępnych, score * 0.5.
4. Porównać z wynikiem computePageScores.

PUŁAPKA: Strona z jednym brakującym polem (np. brak readabilityScore) — czy reszta osi się przelicza poprawnie, czy cała oś = 0?

### 3.5 Competitor overview — średnie pozycje

PUNKT KONTROLNY: Średnia pozycja konkurenta na wykresie odpowiada faktycznym danym.

PROCEDURA:
1. Wybrać konkurenta z 5+ wspólnymi słowami kluczowymi.
2. Pobrać getCompetitorOverview dla 7 dni.
3. Dla jednego dnia ręcznie policzyć: avg(all competitor positions for that day).
4. Porównać z wartością na wykresie.
5. Sprawdzić, czy null positions (competitor nie rankuje) są wyłączone z avg (nie traktowane jako 0).

PUŁAPKA: Jeśli competitor nie rankuje na keyword, a my liczymy position=0 zamiast pomijać, średnia będzie drastycznie niższa (lepsza) niż w rzeczywistości.

### 3.6 Content Gap scoring

PUNKT KONTROLNY: gapScore jest logiczny i prawidłowo priorytetyzuje.

PROCEDURA:
1. Pobrać 10 content gaps.
2. Ręcznie policzyć: gapScore = (100 - yourPosition) * (searchVolume / 1000).
3. Gdzie yourPosition = 101 jeśli nie rankujemy.
4. Sprawdzić:
   - Keyword z SV=10000 i my nie rankujemy: score = (100-101) * 10 = -10? Czy to bug?
   - Czy formuła ma sens? Jeśli yourPosition=101, to (100-101) = -1, co daje negatywny score.
   - Prawdopodobnie powinno być: gapScore = (101 - yourPosition) * (searchVolume / 1000) lub max(0, ...).

KRYTYCZNE: To jest potencjalny bug — negatywne scores dla keywords gdzie nie rankujemy (a to powinny być NAJWIĘKSZE okazje).

---

## FAZA 4: Spójność międzywidokowa

Użytkownik widzi te same dane w różnych widokach. Jeśli się różnią, traci zaufanie.

### 4.1 Pozycja keyword: Monitoring vs Overview vs Visibility

PUNKT KONTROLNY: Ta sama pozycja keyword powinna wyświetlać się spójnie wszędzie.

PROCEDURA:
1. Wybrać keyword "X" z pozycją 7.
2. Sprawdzić tę pozycję w:
   - Tab "Monitoring" → KeywordMonitoringTable (kolumna Position).
   - Tab "Overview" → TopKeywordsTable (jeśli jest w top 10).
   - Tab "Visibility" → PositionDistributionChart (bucket 4-10).
   - Tab "Insights" → Keyword insights (jeśli jest w "opportunities" lub "at-risk").
3. Wszystkie powinny pokazywać tę samą wartość.

CO MOŻE PÓJŚĆ NIE TAK:
- Monitoring używa keywords.currentPosition (denormalizowane).
- Overview TopKeywords używa discoveredKeywords.bestPosition (osobna tabela!).
- Jeśli denormalizacja nie zsynchronizowała się z discoveredKeywords, wartości mogą się różnić.
- Visibility Distribution liczy z discoveredKeywords, Monitoring z keywords — jeśli keyword istnieje w obu tabelach, pozycje mogą się różnić.

### 4.2 Liczba keywords: Monitoring stats vs Overview vs Distribution

PUNKT KONTROLNY: "Total keywords" w różnych widokach powinno być spójne (lub jasno wytłumaczone, czemu się różni).

PROCEDURA:
1. Zanotować:
   - MonitoringStats.totalKeywords (z keywords table, status="active").
   - Overview.totalKeywords (z domainVisibilityHistory).
   - PositionDistribution total (z discoveredKeywords).
2. Te liczby BĘDĄ się różnić — bo:
   - Monitoring = manually tracked keywords.
   - Discovered = all keywords domain ranks for.
   - Visibility = historical snapshot.
3. WERYFIKACJA: Czy UI jasno komunikuje tę różnicę? Czy user nie pomyśli, że liczy 50 keywords ale Overview mówi 500?

### 4.3 ETV: Monitoring vs Overview vs Dashboard

PUNKT KONTROLNY: ETV powinien być obliczany tą samą formułą wszędzie.

PROCEDURA:
1. Sprawdzić formułę ETV w:
   - getMonitoringStats: sum(searchVolume * CTR(position))
   - getLatestVisibilityMetrics: etv z API (DataForSEO)
   - getProjectOverview: sum per domain
2. Jeśli Monitoring oblicza ETV z naszego CTR mapping, a Overview bierze z API — wartości mogą się różnić o 20-50%.
3. DECYZJA: Użyć jednego źródła ETV lub jasno labelować ("szacowany" vs "z DataForSEO").

### 4.4 Backlinks: Summary vs Table count

PUNKT KONTROLNY: totalBacklinks w summary powinno odpowiadać temu, co widzi user.

PROCEDURA:
1. Porównać domainBacklinksSummary.totalBacklinks z count(domainBacklinks).
2. Jeśli API zwraca np. totalBacklinks=15000, ale domainBacklinks ma 1000 rekordów (limit API) — user widzi "15,000 backlinks" w summary ale tabela ma 1000 wierszy.
3. WERYFIKACJA: Czy UI wyjaśnia, że tabela pokazuje top 1000 z 15000?

### 4.5 Trendy: MovementTrend vs Monitoring changes

PUNKT KONTROLNY: Liczba "gainers" na wykresie trendu powinna odpowiadać liczbie keywords z pozytywnym positionChange.

PROCEDURA:
1. Pobrać getMovementTrend dla dzisiejszego dnia.
2. Ręcznie policzyć keywords z positionChange > 0 z getKeywordMonitoring.
3. Porównać.

PUŁAPKA: MovementTrend może brać dane z domainVisibilityHistory (miesięczne snapshoty), a Monitoring z denormalizowanych pól (real-time). Granularność różnic: MovementTrend="w tym miesiącu 40 gainers", Monitoring="dziś 3 gainers".

---

## FAZA 5: Poprawność wyświetlania (frontend rendering)

### 5.1 Formatowanie liczb

PROCEDURA:
1. Sprawdzić formatowanie dla wartości brzegowych:
   - 0 → powinno wyświetlać "0" lub "—" (spójnie!).
   - null → "—" (nie "null", "undefined", "NaN").
   - 999999 → "1.0M" (nie "999,999").
   - 1234 → "1.2K".
   - 0.5 → "0.5" lub "1" (zaokrąglenie?).
   - Negatywne: -5 → "-5" z czerwonym kolorem.
2. Sprawdzić, czy formatNumber traktuje 0 jako falsy (`if (!num) return "—"`) — to by oznaczało, że CPC=0 wyświetla się jako "—" zamiast "$0.00".

POTENCJALNY BUG: `if (!num) return "—"` — 0 jest falsy w JS, więc CPC=0.00 (darmowy keyword) wyświetli "—" zamiast "$0.00".

### 5.2 Kolorystyka pozycji

PROCEDURA:
1. Sprawdzić, czy badge colors są spójne między KeywordMonitoringTable i TopKeywordsTable:
   - MonitoringTable: 1-3=success-600, 4-10=success-500, 11-20=warning-600, 21-50=gray-600, 51+=gray-500.
   - TopKeywordsTable: 1-3=blue, 4-10=success, 11-20=warning, 21-50=error, 50+=gray.
2. NIESPÓJNOŚĆ: Monitoring ma 1-3=green, TopKeywords ma 1-3=blue. User widzi ten sam keyword raz zielony, raz niebieski.
3. REKOMENDACJA: Ujednolicić schemat kolorów.

### 5.3 Kierunek strzałek trendu

PROCEDURA:
1. Keyword z poprawą (pozycja 10 → 5, change=+5):
   - Powinien wyświetlać zieloną strzałkę W GÓRĘ z "+5".
2. Keyword z spadkiem (pozycja 5 → 10, change=-5):
   - Powinien wyświetlać czerwoną strzałkę W DÓŁ z "-5".
3. UWAGA na konwencję:
   - W SEO "niższa pozycja = lepsza" (1 > 10).
   - Ale "strzałka w górę = poprawa" (intuicyjne dla usera).
   - change > 0 → poprawa → zielona strzałka w górę. Czy to zgadza się z obliczeniem previousPosition - currentPosition?

PUŁAPKA: Jeśli change = currentPosition - previousPosition (zamiast prev - current), to poprawa daje wartość ujemną, a frontend może to nieprawidłowo renderować.

### 5.4 Oś Y wykresów pozycji

PROCEDURA:
1. Sprawdzić, czy oś Y na PositionHistoryChart jest odwrócona (1 na górze, 100 na dole).
2. CompetitorOverviewChart ma reversed={true} — potwierdzić, że to działa prawidłowo.
3. Keyword sparkline w expanded row — czy też jest reversed?

PUŁAPKA: Niereversed oś Y sprawia, że spadek pozycji (np. z 5 na 50) wygląda jak "wzrost" na wykresie — co jest mylące.

### 5.5 Daty i strefy czasowe

PROCEDURA:
1. Sprawdzić, czy daty na wykresach odpowiadają strefie czasowej użytkownika (nie UTC).
2. Format: czy polskie locale pokazuje "15 mar" czy angielskie "Mar 15"?
3. Tooltip na wykresie: czy pokazuje pełną datę czytelnie?
4. PUŁAPKA: keywordPositions.date to string "YYYY-MM-DD" (UTC), ale toLocaleDateString() konwertuje na lokalny czas — przesunięcie o dzień przy UTC+1 (Polska).

### 5.6 Puste stany (empty states)

PROCEDURA:
1. Dla nowej domeny bez danych sprawdzić każdy tab:
   - Overview: Powinien pokazać "Brak danych" z CTA "Uruchom pierwszy skan".
   - Monitoring: Powinien pokazać "Dodaj słowa kluczowe".
   - Backlinks: "Pobierz dane backlinków".
   - Visibility: "Uruchom skan visibility".
   - Content Gaps: "Dodaj konkurenta i uruchom analizę".
2. Sprawdzić, czy nie ma crashy (component expecting array but getting undefined).
3. Sprawdzić, czy karty metryczne pokazują "—" lub "0", nie "NaN" ani pusty string.

---

## FAZA 6: Integralność procesów background (Jobs & Scheduler)

### 6.1 Keyword check job — pełny cykl

PROCEDURA:
1. Dodać 10 keywords do domeny testowej.
2. Uruchomić "Refresh positions".
3. Obserwować:
   - Job tworzy się w keywordCheckJobs ze status=pending.
   - Keywords zmieniają checkingStatus na "queued".
   - Job przechodzi do processing, keywords po kolei na "checking".
   - Po zakończeniu: job=completed, keywords=completed.
   - Denormalizowane pola zaktualizowane (currentPosition, recentPositions).
4. Sprawdzić progress bar:
   - processedKeywords/totalKeywords powinno rosnąć od 0 do 10.
   - failedKeywords powinno być 0 (chyba że API error).
5. Po zakończeniu:
   - Toast notification pojawia się.
   - Tabela monitoring odświeża się z nowymi pozycjami.

### 6.2 Obsługa błędów w trakcie job

PROCEDURA:
1. Symulować: jeden keyword z niemożliwym phrase (np. 500 znaków).
2. Sprawdzić:
   - Job kontynuuje z resztą keywords (nie crashuje cały job).
   - failedKeywords inkrementuje się.
   - Keyword z błędem ma checkingStatus="failed", nie "checking" na wieczność.
   - Pozostałe keywords mają zaktualizowane pozycje.

### 6.3 Usunięcie keyword w trakcie job

PROCEDURA:
1. Uruchomić job na 10 keywords.
2. Podczas przetwarzania usunąć 2 keywords.
3. Sprawdzić:
   - Job nie crashuje (graceful skip deleted keywords).
   - processedKeywords nadal dochodzi do totalKeywords lub pomija usunięte.
   - Job kończy się jako completed.

### 6.4 Scheduler — cron daily/weekly

PROCEDURA:
1. Sprawdzić konfigurację cron:
   - Daily refresh: 8 AM UTC (9 AM PL zimą, 10 AM PL latem).
   - Weekly refresh: poniedziałek 8 AM UTC.
   - Backlink velocity: 2 AM UTC.
2. Sprawdzić, czy domeny z refreshFrequency="daily" przetwarzane są sekwencyjnie (nie parallel — rate limit).
3. Sprawdzić, czy domeny z refreshFrequency="weekly" nie są przetwarzane codziennie.

### 6.5 Backlink velocity calculation

PROCEDURA:
1. Ręcznie sprawdzić backlinki z firstSeen=today i isLost=true/lastSeen=yesterday.
2. Porównać z wartościami w backlinkVelocityHistory.
3. Sprawdzić anomaly detection:
   - Jeśli normalny dzień ma 5 nowych backlinków, a dziś jest 50 — czy flaga anomalii się ustawia?
   - Czy 2σ standard deviation jest poprawnie obliczane?

---

## FAZA 7: Testy integracyjne end-to-end

### 7.1 Scenariusz: Nowa domena od zera

PROCEDURA:
1. Dodać nową domenę.
2. Dodać 5 keywords.
3. Uruchomić "Refresh positions".
4. Po zakończeniu sprawdzić KAŻDY tab:
   - Overview: Karty z wartościami (nie NaN, nie 0 jeśli mamy pozycje).
   - Monitoring: Tabela z 5 keywords, pozycjami, sparklines.
   - Visibility: "Brak danych" (jeszcze nie uruchomiono skan visibility).
5. Uruchomić visibility scan.
6. Po zakończeniu:
   - Overview aktualizuje się z danymi visibility.
   - PositionDistributionChart renderuje się poprawnie.
7. Pobrać backlinki.
8. Sprawdzić tab Backlinks: summary, tabela, wykresy.
9. Dodać konkurenta.
10. Uruchomić content gap analysis.
11. Sprawdzić tab Content Gaps: tabela z gaps, metryki.

### 7.2 Scenariusz: Keyword traci pozycję

PROCEDURA:
1. Keyword "X" z pozycją 5.
2. Następne sprawdzenie: pozycja null (nie rankuje).
3. Sprawdzić:
   - currentPosition=null, previousPosition=5.
   - positionChange powinien być null lub wskazywać stratę.
   - recentPositions ma nowy wpis z position=null.
   - Monitoring table: badge "—", zmiana "lost" z czerwonym kolorem.
   - Insights: keyword powinien pojawić się w "at-risk".
   - Health score powinien spaść (gorsza średnia pozycji).

### 7.3 Scenariusz: Keyword znacząco poprawia pozycję

PROCEDURA:
1. Keyword "Y" z pozycją 45.
2. Następne sprawdzenie: pozycja 3.
3. Sprawdzić:
   - positionChange = +42.
   - Zielona strzałka w górę, "+42".
   - Keyword pojawia się w "opportunities" w Insights.
   - Position badge zmienia kolor z gray na green.
   - Sparkline pokazuje dramatyczny skok.
   - PositionDistribution: przesunięcie z bucketu 21-50 do Top 3.

### 7.4 Scenariusz: Dane historyczne

PROCEDURA:
1. Dla keyword z 30+ dniami danych.
2. Otworzyć Position History Chart (w expanded row).
3. Sprawdzić:
   - Wykres ma punkt dla każdego dnia ze sprawdzeniem.
   - Linie nie łączą się przez dni bez danych (lub łączą — konsekwentna decyzja).
   - Zakres osi Y: 1-100 reversed.
   - Tooltip na hover pokazuje datę i pozycję.

### 7.5 Scenariusz: Wiele domen w projekcie

PROCEDURA:
1. Projekt z 3 domenami, każda z 10 keywords.
2. Sprawdzić Project Dashboard:
   - Total keywords = suma z 3 domen.
   - Avg position = średnia ze WSZYSTKICH keywords (nie średnia średnich!).
   - Total ETV = suma ETV z 3 domen.
   - Position distribution = suma bucketów z 3 domen.

PUŁAPKA: Średnia średnich ≠ średnia globalna. Jeśli domena A ma 2 keywords avg=5 i domena B ma 100 keywords avg=50, globalna średnia powinna być bliżej 50, nie (5+50)/2=27.5.

---

## FAZA 8: Walidacja danych wejściowych

### 8.1 Keyword phrase validation

PROCEDURA:
1. Spróbować dodać keyword:
   - Pusty string → powinien odrzucić.
   - Bardzo długi (500+ znaków) → powinien odrzucić lub obciąć.
   - Ze znakami specjalnymi (polskie: ąęóśżź, emoji: 🔥) → powinien zaakceptować polskie, odrzucić/sanitizować emoji.
   - Duplikat istniejącego → powinien poinformować o duplikacie.
   - HTML/script injection: `<script>alert('xss')</script>` → powinien escapować.

### 8.2 URL validation (competitors, domains)

PROCEDURA:
1. Spróbować dodać domenę/konkurenta:
   - Z protokołem: "https://example.com" → zaakceptować, usunąć protokół do przechowania.
   - Bez protokołu: "example.com" → zaakceptować.
   - Z path: "example.com/page" → czy akceptujemy subdirectory?
   - Invalid: "not a domain", "http://", "" → odrzucić.

---

## Priorytetyzacja

KRYTYCZNE (mogą powodować, że user widzi bzdury):
- 2.2: Znak positionChange (odwrócony = zielone strzałki dla spadków)
- 3.6: Negatywne gap scores (odwraca priorytetyzację)
- 4.1: Niespójna pozycja keyword między widokami
- 5.1: formatNumber(0) → "—" zamiast "0"
- 5.3: Kierunek strzałek trendu

WYSOKIE (widoczne niespójności):
- 1.1: rank_group vs rank_absolute mapping
- 2.1: currentPosition desync z keywordPositions
- 3.1: avgPosition z null keywords
- 4.2: Różna liczba keywords między widokami
- 4.3: Dwie różne formuły ETV
- 5.2: Niespójna kolorystyka pozycji

ŚREDNIE (edge cases):
- 1.2: Position=0 dla featured snippets
- 2.3: recentPositions overflow ponad 7
- 3.3: NaN w health score
- 5.5: Timezone shift o 1 dzień
- 6.2: Błąd w trakcie job

NISKIE (quality of life):
- 4.4: Backlinks summary vs table count discrepancy
- 5.6: Empty states
- 8.1: Input validation
