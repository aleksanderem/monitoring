# Comprehensive Test Plan — Stan Zero

## Problem

Obecne testy (140 smoke testów) importują komponent, renderują go z mockami zwracającymi `undefined`, i sprawdzają czy `container` istnieje. To łapie złamane importy, ale nie weryfikuje czy aplikacja faktycznie działa. Użytkownik musi ręcznie klikać po aplikacji żeby znaleźć błędy.

## Cel

Pokryć testami prawdziwe zachowanie aplikacji: co się renderuje przy jakich danych, co się dzieje przy pustym stanie, co się dzieje po interakcji użytkownika. Po zakończeniu — "stan zero" — każda regresja zostanie złapana automatycznie.

## Podejście

Testy integracyjne z prawdziwymi danymi testowymi (fixture'y), nie z mockami zwracającymi `undefined`. Mockujemy tylko granice systemu (Convex transport, Next.js router, window APIs), ale dostarczamy realistyczne dane do mocków.

## Struktura testów

```
src/test/
  setup.ts                    — globalne mocki (icons, recharts, matchMedia) [ISTNIEJE]
  smoke.test.tsx              — smoke testy importu/renderowania [ISTNIEJE]
  i18n-validation.test.ts     — walidacja tłumaczeń [ISTNIEJE]
  fixtures/                   — dane testowe [NOWE]
    domain.ts                 — example Domain, empty domain, setup domain
    keywords.ts               — keyword list, empty list, keyword with positions
    competitors.ts            — competitor list, gaps
    backlinks.ts              — backlink summary, history, distributions
    projects.ts               — project list, single project
    jobs.ts                   — active jobs, history, stats
    user.ts                   — user, permissions, organization
  helpers/                    — test utilities [NOWE]
    convex-mock.tsx           — wrapper that lets tests control useQuery return values per-query
    render-with-providers.tsx — renders with all necessary providers (intl, theme, router)
  integration/                — testy integracyjne [NOWE]
    domains-list.test.tsx
    domain-detail.test.tsx
    domain-monitoring.test.tsx
    domain-backlinks.test.tsx
    domain-competitors.test.tsx
    domain-visibility.test.tsx
    projects-list.test.tsx
    project-detail.test.tsx
    jobs.test.tsx
    settings.test.tsx
    calendar.test.tsx
```

## Faza 0: Infrastruktura testowa

### 0.1 Fixtures (dane testowe)

Realistyczne obiekty danych dopasowane do typów Convex:

```typescript
// fixtures/domain.ts
export const DOMAIN_ACTIVE = {
  _id: "domain_123" as Id<"domains">,
  name: "example.com",
  projectId: "project_1" as Id<"projects">,
  searchEngine: "google.pl",
  location: "Poland",
  language: "pl",
  refreshFrequency: "daily",
  status: "active",
  // ...
};

export const DOMAIN_SETUP_INCOMPLETE = { ... status: "setup" };
export const DOMAIN_LIST = [DOMAIN_ACTIVE, DOMAIN_SETUP_INCOMPLETE, ...];
```

Analogicznie dla keywords, competitors, backlinks, projects, jobs, user.

### 0.2 Convex mock wrapper

Convex `api.*` references to Proxy objects (anyApi) — nie mają toString() ani stabilnego klucza.
Podejście: per-test `vi.mocked(useQuery).mockImplementation()` z mapą referencji.

```typescript
// helpers/convex-mock.tsx
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Configure useQuery to return specific data for specific query references.
 * Uses reference identity (===) for matching, not string keys.
 */
export function mockConvexQueries(responses: Array<[queryRef: any, data: unknown]>) {
  const map = new Map(responses);
  vi.mocked(useQuery).mockImplementation((ref: any, args: any) => {
    if (args === "skip") return undefined;
    return map.has(ref) ? map.get(ref) : undefined;
  });
}

// Usage in test:
// mockConvexQueries([
//   [api.domains.list, DOMAIN_LIST],
//   [api.keywords.getKeywords, KEYWORD_LIST],
// ]);
```

Mutacje/akcje mockujemy jako `vi.fn()` i sprawdzamy `.toHaveBeenCalledWith()`.

### 0.3 Provider wrapper

```typescript
// helpers/render-with-providers.tsx
export function renderWithProviders(ui: ReactElement, options?: {
  queryResponses?: QueryMap,
  route?: string,
  params?: Record<string, string>,
}) {
  // Sets up: Convex mock, NextIntlProvider with real messages, router mock, theme
}
```

## Faza 1: Strony — testy stanów renderowania

Dla każdej strony testujemy: loading, empty, error, data loaded.

### 1.1 `/domains` (lista domen)

| Test | Query mock | Oczekiwany rezultat |
|------|-----------|---------------------|
| Loading state | `api.domains.list → undefined` | Renderuje LoadingState (skeleton) |
| Empty state | `api.domains.list → []` | Renderuje EmptyState z przyciskiem "Add Domain" |
| With domains | `api.domains.list → DOMAIN_LIST` | Renderuje tabelę z wierszami dla każdej domeny |
| Search filters | `→ DOMAIN_LIST` + wpisz "example" | Filtruje do domen pasujących do "example" |
| Search no results | `→ DOMAIN_LIST` + wpisz "zzzzz" | Pokazuje "No domains match" + przycisk Clear |
| Sort by name | `→ DOMAIN_LIST` + klik header "Domain" | Sortuje domeny po nazwie |
| Delete domain | `→ DOMAIN_LIST` + klik Delete | Otwiera DeleteConfirmationDialog |

### 1.2 `/domains/[domainId]` (szczegóły domeny)

| Test | Query mocks | Oczekiwany rezultat |
|------|------------|---------------------|
| Loading | `getDomain → undefined` | LoadingState |
| Not found | `getDomain → null` | "Domain not found" message |
| Setup incomplete | `getDomain → DOMAIN_ACTIVE, getOnboardingStatus → { isCompleted: false }` | Overlay z setup prompt |
| Loaded, overview tab | `getDomain → DOMAIN_ACTIVE, getOnboardingStatus → { isCompleted: true }` | ModuleHubCards renderowane |
| Tab switching | dane załadowane + klik "Monitoring" | Przełącza na tab monitoring |
| Header actions | dane załadowane | Przyciski Share, Report, Refresh, Edit, Delete widoczne |

### 1.3 `/domains/[domainId]` — Monitoring tab

| Test | Query mocks | Oczekiwany rezultat |
|------|------------|---------------------|
| Loading keywords | `getKeywordMonitoring → undefined` | LoadingState w tabeli |
| Empty keywords | `getKeywordMonitoring → []` | Empty state z przyciskiem "Add Keywords" |
| With keywords | `getKeywordMonitoring → KEYWORD_LIST` | Tabela z wierszami, 25 per strona |
| Stats loaded | `getMonitoringStats → STATS` | 4 MetricCards z wartościami |
| Keyword search | keywords loaded + wpisz "seo" | Filtruje keywordy |
| Sort by position | keywords loaded + klik "Position" header | Sortuje po pozycji |
| Expand row | keywords loaded + klik wiersz | Pokazuje KeywordPositionChart |
| Bulk select | keywords loaded + zaznacz 3 | BulkActionBar z opcjami refresh/delete |
| Add keywords modal | klik "Add Keywords" | Otwiera AddKeywordsModal |
| Pagination | 50+ keywords + klik next | Przechodzi na stronę 2 |

### 1.4 `/domains/[domainId]` — Backlinks tab

| Test | Query mocks | Oczekiwany rezultat |
|------|------------|---------------------|
| Loading | `getBacklinkSummary → undefined` | Loading skeleton |
| No data | `getBacklinkSummary → null` | Empty state z "Fetch Backlinks" button |
| Summary stats | `getBacklinkSummary → BACKLINK_SUMMARY` | Stats cards: total, referring domains, dofollow % |
| History chart | `getBacklinksHistory → HISTORY_DATA` | Area chart renderowany z DateRangePicker |
| Stale data warning | `isBacklinkDataStale → true` | Warning banner z refresh button |

### 1.5 `/domains/[domainId]` — Competitors tab

| Test | Query mocks | Oczekiwany rezultat |
|------|------------|---------------------|
| No competitors | `getCompetitors → []` | Empty state z "Add Competitor" |
| With competitors | `getCompetitors → COMPETITOR_LIST` | Management section + charts |
| Keyword gap table | competitors loaded + select competitor | Gap table z danymi |

### 1.6 `/projects`

| Test | Query mock | Oczekiwany rezultat |
|------|-----------|---------------------|
| Loading | `projects.list → undefined` | LoadingState |
| Empty | `projects.list → []` | EmptyState z CreateProjectDialog |
| With projects | `projects.list → PROJECT_LIST` | Tabela z projektami |
| Search | projects loaded + wpisz tekst | Filtruje projekty |
| Delete | projects loaded + klik Delete | DeleteConfirmationDialog |

### 1.7 `/jobs`

| Test | Query mock | Oczekiwany rezultat |
|------|-----------|---------------------|
| Loading | `getActiveJobs → undefined` | Loading |
| No active jobs | `getActiveJobs → []` | "No active jobs" success state |
| Active jobs | `getActiveJobs → JOB_LIST` | Job cards z progress bars |
| History tab | klik History + `getAllJobs → JOB_HISTORY` | Tabela z historią |
| Stats | `getJobStats → STATS` | 3 header cards (active, completed, failed) |

### 1.8 `/settings`

| Test | Query mock | Oczekiwany rezultat |
|------|-----------|---------------------|
| Profile loading | `getCurrentUser → undefined` | LoadingState |
| Profile loaded | `getCurrentUser → USER` | Name, email inputs z wartościami |
| Plan & Usage | `getPlan → PRO_PLAN, getUsageStats → USAGE` | Plan info, usage bars |
| Members | `getOrganizationMembers → MEMBERS` | Members table |

### 1.9 `/calendar`

| Test | Query mock | Oczekiwany rezultat |
|------|-----------|---------------------|
| No domains | `domains.list → []` | "No domains" empty state |
| With domain | `domains.list → [DOMAIN], getEvents → EVENTS` | Calendar z eventami |

## Faza 2: Komponenty domenowe — testy interakcji

Pogłębione testy na kluczowych komponentach z interakcjami userEvent.

### 2.1 KeywordMonitoringTable

- Renderowanie kolumn (11 konfigurowalnych)
- Sortowanie po każdej kolumnie (click header → zmiana kierunku)
- Filtrowanie po zakresie pozycji
- Wyszukiwanie po frazie
- Rozwijanie wiersza (expand) → renderuje wykres
- Zaznaczanie wierszy → BulkActionBar pojawia się
- Paginacja (next/prev/strona)
- Column visibility toggle (persisted to localStorage)

### 2.2 AddKeywordsModal

- Otwarcie/zamknięcie (Escape key)
- Wpisanie keywords → submit → wywołanie mutacji
- Walidacja: puste pole, duplikaty
- AI suggestions: klik → załaduj sugestie → zaznacz → dodaj

### 2.3 CompetitorKeywordGapTable

- Selekcja konkurenta z dropdown
- Filtrowanie gaps
- Sortowanie po gap score, volume, difficulty
- Bulk zaznaczanie + "Add selected keywords"

### 2.4 BacklinksHistoryChart

- Renderowanie z danymi
- Zmiana date range → granularity zmienia się (daily vs monthly)
- Comparison range toggle

### 2.5 ModuleHubCard

- Stan locked → nie klikalne, overlay z lockiem
- Stan ready → klikalne, wywołuje onClick
- Benefit text → klik info → expandable card
- Navigate to prerequisite tab (locked state)

## Faza 3: Walidacje strukturalne

Już częściowo istnieją, uzupełnić:

### 3.1 HTML nesting (ISTNIEJE w smokeRender)
- button in button, a in button, button in a

### 3.2 i18n validation (ISTNIEJE)
- Dotted keys, key parity EN/PL, empty values

### 3.3 Accessibility basics (NOWE)
- Buttony mają accessible name (text content lub aria-label)
- Inputy mają label
- Images mają alt text
- Focusable elements mają visible focus indicator

## Priorytety wykonania

1. **Faza 0** — infrastruktura (fixtures, convex mock, provider wrapper) — bez tego nic nie napiszemy
2. **Faza 1.2 + 1.3** — domain detail + monitoring tab — to jest 70% aplikacji, tam user spędza 90% czasu
3. **Faza 1.1** — domains list — główna nawigacja
4. **Faza 1.4 + 1.5** — backlinks + competitors
5. **Faza 2** — interakcje na kluczowych komponentach
6. **Faza 1.6-1.9** — pozostałe strony
7. **Faza 3** — walidacje strukturalne

## Szacowana skala

- ~30 fixtures (obiekty danych)
- ~120-150 testów integracyjnych (Faza 1+2)
- ~20 walidacji strukturalnych (Faza 3)
- Razem: ~300-310 testów (vs obecne 246)

## Wykonanie

Team agents — każda faza/strona to osobny agent pracujący równolegle. Faza 0 musi być gotowa przed resztą (blocker).
