# Page Scoring Algorithm — Design Document

## Overview

Every crawled page (`domainOnsitePages`) receives a multi-dimensional score across 4 axes plus a weighted composite. Each axis is broken into sub-scores with explicit weights, thresholds, and data sources, enabling full transparency — every point can be traced back to a specific metric and rule.

## Composite Formula

```
PageScore = 0.10 * TechnicalHealth
          + 0.35 * ContentQuality
          + 0.35 * SEOPerformance
          + 0.20 * StrategicValue
```

All axes and sub-scores are on a 0–100 scale.

## Weight Rationale (Google Algorithm 2025-2026)

Based on First Page Sage 2025 research and 2026 SEO industry consensus:

| Google Factor | Algorithm Weight | Maps To Our Axis |
|---|---|---|
| Satisfying Content | 23% | Content Quality |
| Keyword in Meta Title | 14% | Content Quality |
| Backlinks | 13% | SEO Performance |
| Niche Expertise | 13% | Content Quality / Strategic |
| Searcher Engagement | 12% | SEO Performance (proxy via rankings) |
| Freshness | 6% | Content Quality |
| Mobile-Friendly | 5% | Technical Health |
| Trustworthiness | 4% | Strategic Value |
| Link Distribution Diversity | 3% | SEO Performance |
| Page Speed | 3% | Technical Health |
| SSL/HTTPS | 2% | Technical Health |
| Internal Links | 1% | Strategic Value |
| Other (23 factors) | 1% | Mixed |

Our axis weights: Technical 10%, Content 35%, SEO Performance 35%, Strategic 20% — maps to Google's approximate distribution of: Technical ~10%, Content ~56%, Authority/Links ~16%, Engagement ~16%.

---

## Axis 1: Technical Health (0–100)

**Composite weight: 10%**
**Philosophy: Prerequisite — pass/fail with gradient. Below threshold = heavy penalty.**

### Sub-scores

| # | Sub-score | Weight | Data Source | Scoring Logic |
|---|---|---|---|---|
| T1 | Lighthouse Performance | 30% | `lighthouseScores.performance` | Direct value (0–100). If missing → null (excluded from calculation). |
| T2 | Core Web Vitals | 25% | `coreWebVitals` | Per-vital scoring (see below), then average of available vitals. |
| T3 | Lighthouse SEO | 15% | `lighthouseScores.seo` | Direct value (0–100). If missing → null. |
| T4 | Lighthouse Accessibility | 10% | `lighthouseScores.accessibility` | Direct value (0–100). If missing → null. |
| T5 | Lighthouse Best Practices | 5% | `lighthouseScores.bestPractices` | Direct value (0–100). If missing → null. |
| T6 | Page Security | 5% | URL protocol | `https` → 100, `http` → 0. |
| T7 | Resource Health | 5% | `resourceErrors` | `100 - (errorCount * 20) - (warningCount * 5)`, min 0. If missing → 70 (neutral). |
| T8 | Cache Efficiency | 5% | `cacheControl` | `cachable && ttl >= 3600` → 100. `cachable && ttl < 3600` → 50. Not cachable → 20. Missing → 50. |

### T2: Core Web Vitals Detail

Each vital scored independently, then averaged:

```
LCP (Largest Contentful Paint):
  <= 2500ms → 100 (good)
  <= 4000ms → 50  (needs improvement)
  > 4000ms  → 0   (poor)

CLS (Cumulative Layout Shift):
  <= 0.1  → 100
  <= 0.25 → 50
  > 0.25  → 0

FID (First Input Delay) / INP:
  <= 100ms → 100
  <= 300ms → 50
  > 300ms  → 0

TTI (Time to Interactive):
  <= 3800ms → 100
  <= 7300ms → 50
  > 7300ms  → 0

CWV_score = average of all available vital scores
```

### Missing Data Handling (Technical)

If Lighthouse data is missing entirely (no PSI run), only T6, T7, T8 can be scored. In this case:
- Score only from available sub-scores, redistribute weights proportionally
- Apply a `dataCoverage` penalty: `finalScore = weightedScore * (0.5 + 0.5 * coverageRatio)` where `coverageRatio` = sum of available sub-score weights / 1.0

This means a page with only HTTPS and cache data (10% weight coverage) gets its sub-score halved: even if both are 100, the Technical score would be ~55 — signaling "we don't have enough data to trust this."

---

## Axis 2: Content Quality (0–100)

**Composite weight: 35%**
**Philosophy: Is this content good enough to compete in SERPs?**

### Sub-scores

| # | Sub-score | Weight | Data Source | Scoring Logic |
|---|---|---|---|---|
| C1 | Content Depth | 25% | `wordCount` | Threshold-based (see below). |
| C2 | Meta Title Optimization | 20% | `title` | Length + presence scoring (see below). |
| C3 | Heading Structure | 15% | `htags` | Presence and hierarchy scoring (see below). |
| C4 | Meta Description | 10% | `metaDescription` | Length + presence scoring (see below). |
| C5 | Readability | 10% | `readabilityScores` | Flesch-Kincaid based (see below). |
| C6 | Content Consistency | 10% | `contentConsistency` | Title-to-content + description-to-content match. |
| C7 | Image Optimization | 10% | `imagesCount`, `imagesMissingAlt`, `imageAlts` | Alt text coverage + keyword presence in alts. |

### C1: Content Depth

```
wordCount < 100  → 10  (stub / redirect / error page)
wordCount < 300  → 25  (thin content)
wordCount < 600  → 45  (below average)
wordCount < 1000 → 65  (adequate)
wordCount < 1500 → 80  (good)
wordCount < 2500 → 90  (comprehensive)
wordCount >= 2500 → 100 (deep content)
```

NOTE: These thresholds are for general pages. In a future iteration, thresholds should be relative to SERP competitor word counts for the same keyword (if available). A product page with 400 words might be perfect if competitors average 350.

### C2: Meta Title Optimization

```
title missing          → 0
title.length < 10      → 20  (too short, unlikely to rank)
title.length 10–30     → 60  (short but present)
title.length 31–60     → 100 (optimal range for Google)
title.length 61–70     → 80  (slightly long, may truncate)
title.length > 70      → 50  (will truncate in SERP)
```

Bonus: If title contains a monitored keyword → +10 (capped at 100).

### C3: Heading Structure

```
base = 0
H1 present and exactly 1      → +40
H1 present but multiple        → +25 (penalized for multiple H1s)
H1 missing                     → +0

H2 headings present (>= 2)    → +30
H2 headings present (1)       → +15
H2 missing                     → +0

H3 headings present            → +20
H3 missing                     → +10 (not always needed, neutral)

Bonus: H1 contains a monitored keyword → +10 (capped at 100)
```

### C4: Meta Description

```
missing              → 0
length < 50          → 30  (too short)
length 50–120        → 80  (acceptable)
length 120–160       → 100 (optimal)
length 160–200       → 70  (slightly long)
length > 200         → 40  (will truncate)
```

### C5: Readability

Uses Flesch-Kincaid Grade Level as primary metric (lower = easier to read).

```
If readabilityScores available:
  fkGrade = fleschKincaidIndex

  fkGrade <= 6   → 70  (very simple, may lack depth)
  fkGrade 7–9    → 100 (ideal for web, ~8th grade)
  fkGrade 10–12  → 85  (acceptable for most audiences)
  fkGrade 13–16  → 60  (academic level, harder for general audience)
  fkGrade > 16   → 40  (too complex)

If readabilityScores missing → 50 (neutral)
```

### C6: Content Consistency

```
If contentConsistency available:
  avgMatch = (titleToContent + descriptionToContent) / 2
  score = Math.round(avgMatch * 100)   // assuming values 0.0–1.0
  // Clamp to 0–100

If contentConsistency missing → 50 (neutral)
```

### C7: Image Optimization

```
If imagesCount == 0 → 60 (pages without images aren't penalized heavily, but images help)

If imagesCount > 0:
  altCoverage = (imagesCount - imagesMissingAlt) / imagesCount  // 0.0–1.0
  baseScore = Math.round(altCoverage * 80)   // max 80 from coverage

  // Bonus for keyword-optimized alts
  If imageAlts available:
    keywordAlts = imageAlts.filter(img => img.containsKeyword).length
    keywordRatio = keywordAlts / imagesCount
    bonus = Math.round(keywordRatio * 20)   // up to 20 bonus
  Else:
    bonus = 0

  score = Math.min(100, baseScore + bonus)
```

### Missing Data Handling (Content)

Content data comes from the crawl, so most fields should be populated. For any missing sub-score, exclude it and redistribute weights proportionally. Apply the same `dataCoverage` penalty as Technical axis if coverage < 50%.

---

## Axis 3: SEO Performance (0–100)

**Composite weight: 35%**
**Philosophy: How much organic value does this page generate RIGHT NOW?**

### Sub-scores

| # | Sub-score | Weight | Data Source | Scoring Logic |
|---|---|---|---|---|
| S1 | Keyword Rankings | 30% | `keywordPositions` where `url` matches this page | Position-based scoring per keyword, best keywords weighted higher. |
| S2 | Traffic Potential | 20% | `keywordPositions` (position + searchVolume) | Estimated organic traffic = sum of (volume * CTR(position)). |
| S3 | Backlink Authority | 35% | `domainBacklinks` where `urlTo` matches this page | Quality-weighted backlink scoring. |
| S4 | Internal Link Equity | 15% | `inboundLinksCount` | Internal linking strength. |

### S1: Keyword Rankings

For each keyword that ranks for this URL, compute a position score:

```
positionScore(position):
  1       → 100
  2       → 92
  3       → 85
  4–5     → 70
  6–10    → 55
  11–15   → 35
  16–20   → 25
  21–50   → 15
  51–100  → 5
  > 100 or null → 0
```

Volume multiplier amplifies value of ranking for high-volume keywords:

```
volumeMultiplier(searchVolume):
  0–50       → 0.3
  51–200     → 0.5
  201–500    → 0.7
  501–1000   → 0.85
  1001–5000  → 1.0
  5001–10000 → 1.15
  > 10000    → 1.3
```

```
keywordScores = keywords.map(kw => positionScore(kw.position) * volumeMultiplier(kw.searchVolume))
S1 = keywordScores.length > 0
  ? Math.min(100, Math.round(sum(top5keywordScores) / 5))  // average of top 5 best-scoring keywords
  : 0
```

Using top 5 prevents a page with 1 great keyword + 50 bad ones from being diluted, while still rewarding pages that rank for multiple valuable terms.

### S2: Traffic Potential

Estimated CTR by position (industry averages 2025-2026):

```
estimatedCTR(position):
  1  → 0.276
  2  → 0.158
  3  → 0.110
  4  → 0.084
  5  → 0.063
  6  → 0.045
  7  → 0.035
  8  → 0.028
  9  → 0.024
  10 → 0.020
  11–20 → 0.010
  21–50 → 0.003
  51+   → 0.001
```

```
estimatedMonthlyTraffic = sum(keywords.map(kw =>
  (kw.searchVolume ?? 0) * estimatedCTR(kw.position)
))

// Normalize to 0–100 using logarithmic scale (handles wide range):
S2 = estimatedMonthlyTraffic <= 0
  ? 0
  : Math.min(100, Math.round(20 * Math.log10(estimatedMonthlyTraffic + 1)))
```

Logarithmic normalization scale reference:
- 1 visit/mo → ~6
- 10 visits → ~20
- 100 visits → ~40
- 1000 visits → ~60
- 10000 visits → ~80
- 100000 visits → ~100

### S3: Backlink Authority

For each backlink pointing to this URL, compute a quality score:

```
backlinkQuality(backlink):
  base = 10  // every link has some value

  // Domain authority of linker
  domainRank = backlink.domainFromRank ?? 0
  if domainRank >= 70 → base += 40
  if domainRank >= 50 → base += 30
  if domainRank >= 30 → base += 20
  if domainRank >= 10 → base += 10

  // Dofollow bonus
  if backlink.dofollow → base *= 1.5

  // Spam penalty
  spamScore = backlink.backlink_spam_score ?? 0
  if spamScore >= 70  → base *= 0.1   // nearly worthless
  if spamScore >= 50  → base *= 0.3   // heavily discounted
  if spamScore >= 30  → base *= 0.7   // minor discount

  // Semantic location bonus
  if backlink.semanticLocation in ["article", "main_content"] → base *= 1.2

  return Math.min(100, base)
```

```
backlinkScores = backlinks.map(bl => backlinkQuality(bl))
uniqueDomains = new Set(backlinks.map(bl => bl.domainFrom)).size

// Combine quality and diversity
avgQuality = backlinkScores.length > 0 ? mean(backlinkScores) : 0
diversityBonus = Math.min(30, uniqueDomains * 3)   // up to 30 bonus for diverse sources

S3 = Math.min(100, Math.round(avgQuality * 0.7 + diversityBonus))

// Override: if zero backlinks, S3 = 0
if backlinks.length == 0 → S3 = 0
```

### S4: Internal Link Equity

```
inbound = inboundLinksCount ?? 0

S4:
  inbound == 0   → 5   (orphan page — almost no value)
  inbound 1–2    → 30  (poorly linked)
  inbound 3–5    → 50  (minimal)
  inbound 6–10   → 70  (adequate)
  inbound 11–20  → 85  (well linked)
  inbound > 20   → 100 (hub / key page)
```

### Missing Data Handling (SEO Performance)

- If no keywords rank for this URL: S1 = 0, S2 = 0 (legitimate — page has no rankings)
- If no backlinks to this URL: S3 = 0 (legitimate — page has no backlinks)
- These are NOT treated as missing data — they are real signals of low SEO performance
- S4 missing → 30 (neutral, some internal linking assumed)

---

## Axis 4: Strategic Value (0–100)

**Composite weight: 20%**
**Philosophy: How important is this page to the business strategy and SEO ecosystem?**

### Sub-scores

| # | Sub-score | Weight | Data Source | Scoring Logic |
|---|---|---|---|---|
| V1 | Intent Alignment | 40% | Keywords for this URL + their `intent` | Intent-based value scoring. |
| V2 | Search Volume Value | 25% | Keywords for this URL + `searchVolume` | Total addressable search value. |
| V3 | Competitive Position | 20% | Keywords `difficulty` vs `position` | Realistic assessment of competitive standing. |
| V4 | Internal Hub Value | 15% | `internalLinksCount` (outgoing) + `inboundLinksCount` | Hub pages that connect the site together. |

### V1: Intent Alignment

The key insight: all intent types have value, but they serve different roles in the funnel. Pure transactional pages drive sales directly. Informational pages build topical authority that lifts transactional pages. The scoring reflects this.

```
intentValue(intent):
  "transactional" → 100   // direct sales driver
  "commercial"    → 85    // comparison/consideration, high purchase intent
  "informational" → 55    // topical authority builder — essential for algorithm
  "navigational"  → 30    // branded/navigational, limited strategic value

  missing/unknown → 40    // default neutral-low
```

For pages with multiple keywords (different intents), compute weighted average by search volume:

```
V1 = weightedAverage(
  keywords.map(kw => ({
    value: intentValue(kw.intent),
    weight: kw.searchVolume ?? 10   // minimum weight of 10 for unknown volume
  }))
)
```

If no keywords associated with this URL → V1 = 30 (low but not zero — page may have future potential).

**Topical Authority Bonus**: If page intent is "informational" AND page has `internalLinksCount >= 3` pointing to pages with "transactional" or "commercial" keywords → bonus +15 (capped at 100). This rewards informational pages that actively support the sales funnel.

### V2: Search Volume Value

Total search opportunity this page addresses.

```
totalVolume = sum(keywords.map(kw => kw.searchVolume ?? 0))

// Logarithmic normalization (same scale as traffic potential):
V2 = totalVolume <= 0
  ? 0
  : Math.min(100, Math.round(20 * Math.log10(totalVolume + 1)))
```

Scale reference:
- 10 total volume → ~20
- 100 → ~40
- 1000 → ~60
- 10000 → ~80
- 100000 → ~100

### V3: Competitive Position

Are we positioned realistically for the keywords we're targeting? Scores high for:
- Easy keywords where we already rank well (quick wins)
- Hard keywords where we rank well (strong competitive position)
- Scores LOW for hard keywords where we rank poorly (unrealistic / needs much work)

```
competitiveScore(position, difficulty):
  if position == null → 20   // not ranking at all

  if difficulty <= 30:         // easy keyword
    if position <= 10 → 100   // dominating easy keyword — good
    if position <= 30 → 80    // can easily push to page 1
    if position <= 50 → 60    // within reach
    else → 40                 // should be easier to rank for

  if difficulty <= 60:         // medium keyword
    if position <= 10 → 95    // strong position on competitive keyword
    if position <= 20 → 75    // striking distance
    if position <= 50 → 50    // realistic with effort
    else → 25                 // long road ahead

  if difficulty > 60:          // hard keyword
    if position <= 10 → 100   // excellent — holding ground vs tough competition
    if position <= 20 → 70    // good, need to maintain
    if position <= 50 → 40    // very challenging to improve
    else → 15                 // nearly unrealistic without major investment
```

```
V3 = keywords.length > 0
  ? Math.round(mean(keywords.map(kw => competitiveScore(kw.position, kw.difficulty ?? 50))))
  : 20   // no keywords → low strategic position
```

### V4: Internal Hub Value

Pages that connect the site's content architecture score higher.

```
outgoing = internalLinksCount ?? 0
incoming = inboundLinksCount ?? 0
total = outgoing + incoming

V4:
  total == 0      → 5    // isolated page
  total 1–5       → 25   // weakly connected
  total 6–15      → 50   // moderately connected
  total 16–30     → 75   // well connected
  total 31–50     → 90   // hub page
  total > 50      → 100  // major hub / pillar page
```

### Missing Data Handling (Strategic Value)

- No keywords for this URL: V1 = 30, V2 = 0, V3 = 20 — page gets a low strategic score (correct: unknown value)
- If intent data missing on keywords: use `unknown` intent value (40)
- Internal link data missing: V4 = 30 (neutral)

---

## Composite Calculation

```typescript
function computePageScore(page: PageData): PageScoreResult {
  const technical = computeTechnicalHealth(page);    // { score, subScores, coverage }
  const content = computeContentQuality(page);       // { score, subScores, coverage }
  const seo = computeSEOPerformance(page);           // { score, subScores, coverage }
  const strategic = computeStrategicValue(page);     // { score, subScores, coverage }

  const composite = Math.round(
    0.10 * technical.score +
    0.35 * content.score +
    0.35 * seo.score +
    0.20 * strategic.score
  );

  return {
    composite,           // 0–100 headline score
    axes: {
      technical,         // { score, weight: 0.10, subScores: [...] }
      content,           // { score, weight: 0.35, subScores: [...] }
      seo,               // { score, weight: 0.35, subScores: [...] }
      strategic,         // { score, weight: 0.20, subScores: [...] }
    },
    grade: scoreToGrade(composite),
    dataCompleteness: {
      technical: technical.coverage,
      content: content.coverage,
      seo: seo.coverage,
      strategic: strategic.coverage,
    },
  };
}
```

## Grade Mapping

```
90–100 → A  (Excellent — top-performing page)
80–89  → B  (Good — minor improvements possible)
70–79  → C  (Average — clear optimization opportunities)
50–69  → D  (Below average — needs significant work)
0–49   → F  (Poor — critical issues or no SEO presence)
```

## Score Explanation Format

Each axis returns sub-scores with explanations for the UI:

```typescript
interface SubScore {
  id: string;            // e.g., "T1", "C3", "S2"
  label: string;         // e.g., "Lighthouse Performance", "Heading Structure"
  score: number;         // 0–100
  weight: number;        // weight within axis (e.g., 0.30)
  contribution: number;  // score * weight = actual points contributed
  dataSource: string;    // which field(s) were used
  explanation: string;   // human-readable: "Title is 45 chars (optimal 31-60 range)"
  status: "good" | "warning" | "critical" | "no_data";
}
```

Status thresholds (per sub-score):
- `good`: score >= 70
- `warning`: score >= 40 and < 70
- `critical`: score < 40
- `no_data`: data source missing/null

---

## Edge Cases

### Pages with HTTP errors (4xx, 5xx)
Pages with non-200 status codes get automatic overrides:
- `statusCode` 4xx → composite = 0, all axes = 0, grade = F
- `statusCode` 5xx → composite = 0, all axes = 0, grade = F
- `statusCode` 3xx (redirect) → composite = 10, grade = F, with explanation "Redirect — this page passes value to its target"

### Pages with no crawl data
If a page exists in `domainOnsitePages` but has minimal data (only URL + statusCode):
- Technical = scored on available data with coverage penalty
- Content = scored on available data with coverage penalty
- SEO Performance = scored normally (backlinks + keywords don't depend on crawl)
- Strategic = scored normally

### Brand new pages (< 30 days since first crawl)
No special treatment. A new page with great content + no rankings yet will score:
- Technical: high (if well-built)
- Content: high (if well-written)
- SEO Performance: low (no rankings/backlinks yet — accurate)
- Strategic: medium-high (if targeting good keywords)
- Composite: ~40-60 — correctly reflecting "promising but unproven"

---

## Data Requirements Summary

### Per-page data needed (from `domainOnsitePages`):
- `url`, `statusCode`, `title`, `metaDescription`, `h1`
- `wordCount`, `htags`, `readabilityScores`, `contentConsistency`
- `imagesCount`, `imagesMissingAlt`, `imageAlts`
- `lighthouseScores`, `coreWebVitals`, `loadTime`
- `internalLinksCount`, `externalLinksCount`, `inboundLinksCount`
- `resourceErrors`, `cacheControl`

### Cross-referenced data:
- `keywordPositions` — filtered by `url` matching this page's URL
- `keywords` — for `intent`, `searchVolume`, `difficulty` per keyword
- `domainBacklinks` — filtered by `urlTo` matching this page's URL

### Normalization requirements:
- URL matching must be normalized (trailing slashes, protocol, www)
- Keyword-to-page mapping via `keywordPositions.url` field
- Backlink-to-page mapping via `domainBacklinks.urlTo` field

---

## Storage: Schema Additions

### New field on `domainOnsitePages`

```typescript
pageScore: v.optional(v.object({
  composite: v.number(),        // 0-100 headline score
  grade: v.string(),            // "A" | "B" | "C" | "D" | "F"

  technical: v.object({
    score: v.number(),
    subScores: v.array(v.object({
      id: v.string(),           // "T1", "T2", etc.
      label: v.string(),
      score: v.number(),
      weight: v.number(),
      status: v.string(),       // "good" | "warning" | "critical" | "no_data"
      explanation: v.string(),
    })),
  }),
  content: v.object({
    score: v.number(),
    subScores: v.array(v.object({
      id: v.string(),
      label: v.string(),
      score: v.number(),
      weight: v.number(),
      status: v.string(),
      explanation: v.string(),
    })),
  }),
  seoPerformance: v.object({
    score: v.number(),
    subScores: v.array(v.object({
      id: v.string(),
      label: v.string(),
      score: v.number(),
      weight: v.number(),
      status: v.string(),
      explanation: v.string(),
    })),
  }),
  strategic: v.object({
    score: v.number(),
    subScores: v.array(v.object({
      id: v.string(),
      label: v.string(),
      score: v.number(),
      weight: v.number(),
      status: v.string(),
      explanation: v.string(),
    })),
  }),

  scoredAt: v.number(),         // timestamp of last computation
  dataCompleteness: v.number(), // 0-1, how much data was available
}))
```

---

## Computation Pipeline

### Architecture

Batch computation via `internalMutation` — scores stored on page records, recomputed when underlying data changes.

### File: `convex/pageScoring.ts`

New file containing:
1. Pure scoring functions (no DB, independently testable)
2. Batch computation mutation with chunked scheduler
3. URL normalization utility

### Computation Flow

```
TRIGGER (crawl done / PSI done / keyword check / backlink update / manual)
  │
  ▼
computePageScores(domainId, offset=0)  [internalMutation]
  │
  ├── 1. Load pages batch (50 pages from offset)
  ├── 2. Load ALL keywords for domain (once, cached for batch)
  ├── 3. Load ALL keywordPositions for domain (once)
  ├── 4. Load ALL backlinks for domain (once)
  ├── 5. Build lookup maps:
  │      normalizedUrl → KeywordWithPosition[]
  │      normalizedUrl → Backlink[]
  ├── 6. For each page:
  │      ├── computeFullPageScore(page, kwMap[url], blMap[url])
  │      └── ctx.db.patch(page._id, { pageScore: result })
  ├── 7. If more pages → scheduler.runAfter(0, self, { offset + 50 })
  └── 8. If last batch → updateDomainAggregates(domainId)
```

Chunking at 50 pages per mutation keeps execution under Convex limits.

### URL Normalization

Keywords and backlinks reference pages by URL. Matching must be normalized:

```typescript
function normalizeUrlForMatching(url: string): string {
  let n = url.toLowerCase().trim();
  n = n.replace(/^https?:\/\//, "");  // remove protocol
  n = n.replace(/^www\./, "");        // remove www
  n = n.replace(/\/$/, "");           // remove trailing slash
  n = n.replace(/#.*$/, "");          // remove fragment
  return n;
}
```

### Trigger Integration Points

Each trigger schedules the same entry point:

```typescript
await ctx.scheduler.runAfter(0, internal.pageScoring.computePageScores, {
  domainId,
  offset: 0,
});
```

| Trigger | Location | After what |
|---|---|---|
| Crawl enrichment done | `seoAudit_actions.ts` | Last batch of `enrichOnsitePagesFromCrawl` |
| PSI results stored | `seoAudit_actions.ts` | `storePsiResults` mutation |
| Keyword check done | `keywords.ts` | After position check batch completes |
| Backlink analysis done | Backlink handler | After backlink summary updated |
| Manual rescore | New `triggerRescore` mutation | User clicks "Rescore" in UI |

### Domain-Level Aggregates

After last page batch, compute site-wide summary:

```typescript
// Stored on domain record or domainOnsiteAnalysis
{
  avgPageScore: number,         // average composite across all scored pages
  gradeDistribution: {
    A: number, B: number, C: number, D: number, F: number
  },
  topPages: [...],              // top 5 by composite
  worstPages: [...],            // bottom 5 by composite
  scoredAt: number,
  totalScored: number,
}
```

### Pure Scoring Functions (testable)

All math lives in pure functions — no DB calls:

```typescript
export function scoreTechnicalHealth(page: PageData): AxisResult
export function scoreContentQuality(page: PageData, keywords: Keyword[]): AxisResult
export function scoreSEOPerformance(page: PageData, kwPositions: KWPosition[], backlinks: Backlink[]): AxisResult
export function scoreStrategicValue(page: PageData, kwPositions: KWPosition[], keywords: Keyword[]): AxisResult
export function computeFullPageScore(page: PageData, kwPositions: KWPosition[], keywords: Keyword[], backlinks: Backlink[]): PageScoreResult
```

The mutation only handles data loading, URL matching, and DB patching.

---

## Implementation Plan

### Step 1: Schema update
Add `pageScore` field to `domainOnsitePages` in `convex/schema.ts`.

### Step 2: Pure scoring functions
Create `convex/pageScoring.ts` with all pure scoring functions implementing the algorithm above. Each function returns `{ score, subScores[], coverage }`.

### Step 3: Batch computation mutation
Add `computePageScores` internalMutation with chunked scheduler pattern. Loads data, builds URL maps, calls pure functions, patches pages.

### Step 4: Domain aggregates
Add `updateDomainScoreAggregates` internalMutation called after last page batch.

### Step 5: Trigger integration
Wire `computePageScores` into existing pipeline:
- After `storePsiResults`
- After `enrichOnsitePagesFromCrawl` (last batch)
- After keyword position check
- After backlink analysis
- Manual `triggerRescore` mutation

### Step 6: TypeScript verification
`npx tsc --noEmit` — zero errors.
`npx convex dev --once` — successful deploy.
