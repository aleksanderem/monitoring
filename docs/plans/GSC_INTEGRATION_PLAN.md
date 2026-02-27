# GSC (Google Search Console) Deep Integration Plan

## Executive Summary

Google Search Console is the only source of real click/impression data for organic search. Our app currently tracks keyword positions via DataForSEO (SERP scraping) and has backlink/on-site/competitor data — but we have zero visibility into actual user behavior from Google's side. GSC fills this gap with first-party data: real clicks, real impressions, real CTR, real average position as Google calculates it, plus page-level performance, device/country breakdowns, crawl status, and index coverage.

The more data sources we cross-reference, the better the product becomes. A keyword at position 5 with 10,000 impressions but only 50 clicks tells a completely different story than a keyword at position 5 with 10,000 impressions and 2,000 clicks. Only GSC gives us this picture.

---

## Part 1: What Data Can We Fetch from GSC

### 1.1 Search Analytics API (`searchAnalytics.query`)

This is the crown jewel. Every request returns rows with 4 metrics: `clicks`, `impressions`, `ctr`, `position`. The power comes from dimensions and filters.

**Dimensions (can combine up to 3 per request):**

| Dimension | What it gives us |
|-----------|-----------------|
| `query` | The actual search term users typed |
| `page` | Which URL on the domain ranked |
| `country` | Country code (ISO 3166-1 alpha-3) |
| `device` | DESKTOP, MOBILE, TABLET |
| `date` | Daily granularity (last 16 months available) |
| `searchAppearance` | AMP, INSTANT_APP, RICHCARD, RICH_RESULT, etc. |

**Useful dimension combinations:**
- `[query]` — keyword-level performance (what we do today, but only 500 rows)
- `[query, page]` — which page ranks for which keyword + its performance
- `[query, date]` — keyword trends over time
- `[page]` — page-level aggregate performance
- `[page, date]` — page performance trends
- `[page, query]` — all keywords driving traffic to a specific page
- `[query, device]` — mobile vs desktop performance per keyword
- `[query, country]` — geo performance per keyword
- `[device]` — overall device split
- `[country]` — overall geo split

**Search types:** `web` (default), `image`, `video`, `news`, `discover`, `googleNews`. Discover and googleNews provide unique data not available anywhere else.

**Row limits:** Up to 25,000 per request with `startRow` pagination. We currently fetch only 500.

**Date range:** Up to 16 months of historical data. We currently fetch 28 days.

**Data freshness states:** `all` (includes fresh/incomplete data from last 2-3 days), `final` (finalized, 3+ days old).

**Filters:** Can filter by any dimension using `equals`, `contains`, `notEquals`, `notContains`, `includingRegex`, `excludingRegex`. This enables targeted queries like "all keywords containing 'seo' on mobile in Germany."

### 1.2 URL Inspection API

Per-URL deep diagnostics. For each URL we can get:

- **Index status:** Whether Google has indexed the page, when it was last crawled, how it was discovered
- **Coverage verdict:** "pass" (indexed), "neutral" (not indexed but not an error), "fail" (error preventing indexing)
- **Crawl info:** Last crawl time, crawl allowed by robots.txt, page fetch status, canonical URL (both declared and Google-selected)
- **Mobile usability:** Whether the page passes mobile-friendly tests, specific issues found
- **Rich results:** Whether structured data was detected and valid, specific errors
- **AMP status:** Validation status if AMP is used

This is extremely valuable for on-site audit cross-referencing: our `domainOnsitePages` table has crawl data from DataForSEO, but URL Inspection gives us Google's actual perspective. A page might look fine to our crawler but be blocked by Google due to canonical issues, noindex, or robots.txt.

**Rate limit:** 2,000 inspections per day per property, 600 per minute. This means we can't inspect every page on large sites, but we can inspect high-value pages (top traffic, top keywords, recently changed).

### 1.3 Sitemaps API

- List all sitemaps submitted for a property
- Get status of each sitemap (success, errors, warnings, pending)
- Submit new sitemaps
- Delete sitemaps

Useful for sitemap health monitoring and as part of on-site diagnostics.

### 1.4 Sites API

- List all properties the authenticated user has access to
- Verify ownership
- We already use this during OAuth to populate the property selector

---

## Part 2: What We Track Today (Data Model Audit)

### Core tracking data (DataForSEO-sourced):

| Table | Key data | What it gives us |
|-------|----------|-----------------|
| `keywords` | phrase, currentPosition, previousPosition, positionChange, searchVolume, difficulty, recentPositions | Per-keyword ranking snapshots from SERP scraping |
| `keywordPositions` | keywordId, date, position, url, searchVolume, difficulty, cpc | Historical position tracking (daily) |
| `discoveredKeywords` | keyword, bestPosition, url, searchVolume, difficulty, traffic, intent, serpFeatures | Keywords found via DataForSEO Ranked Keywords API |
| `keywordSerpResults` | top 100 organic results per keyword/date | Full SERP snapshots |
| `serpFeatureTracking` | featuredSnippet, PAA, imagePack, etc. per keyword/date | SERP feature presence tracking |

### Competition data:

| Table | Key data |
|-------|----------|
| `competitors` | tracked competitor domains per our domain |
| `competitorKeywordPositions` | competitor rank for each of our tracked keywords |
| `competitorBacklinksSummary/Distributions/Backlinks` | competitor backlink profiles |
| `contentGaps` | keywords where competitors rank but we don't (or rank poorly) |

### Site health data:

| Table | Key data |
|-------|----------|
| `domainOnsiteAnalysis` | health score, issue counts, grade, sections |
| `domainOnsitePages` | per-page crawl data (status codes, titles, meta, word count, load time, Core Web Vitals, structured data) |
| `onSiteIssues` | individual issues per page |
| `coreWebVitals` | LCP, FID, CLS, TTFB per page |

### Backlink data:

| Table | Key data |
|-------|----------|
| `domainBacklinksSummary` | total backlinks, referring domains, dofollow/nofollow |
| `domainBacklinks` | individual backlinks with anchor text, ranks, spam scores |
| `backlinkVelocityHistory` | daily new/lost backlinks tracking |
| `linkBuildingProspects` | auto-generated link building opportunities |

### AI/Strategy data:

| Table | Key data |
|-------|----------|
| `aiResearchSessions` | AI-generated keyword suggestions with relevance scores |
| `aiStrategySessions` | full SEO strategy with action items and progress tracking |

### Current GSC data (minimal):

| Table | Key data |
|-------|----------|
| `gscConnections` | OAuth tokens, property list, sync status |
| `gscKeywordMetrics` | keyword, date, clicks, impressions, ctr, position, url (optional) |

The `gscKeywordMetrics` table is populated by a sync that fetches only `dimensions: ["query"]` with `rowLimit: 500` for the last 28 days. This means we're missing page-level data, device/country breakdowns, long-tail keywords beyond top 500, and historical data beyond 28 days.

---

## Part 3: Cross-Reference Opportunities

This is where the product becomes significantly better than the sum of its parts. Each cross-reference creates insights that neither data source could provide alone.

### 3.1 GSC Position vs DataForSEO Position (keyword-level)

**What:** Compare Google's reported average position for a keyword against our SERP-scraped position.

**Why this matters:** DataForSEO scrapes SERPs from specific locations/devices. Google's position is a weighted average across all users, locations, and devices. Discrepancies reveal:
- Keywords where personalization heavily affects ranking (your scraped rank is 3 but GSC says 8 = most users see you at 8)
- Keywords where mobile and desktop ranks differ significantly
- Keywords with position volatility (daily scrape shows 5, but average over 28 days is 12)

**Implementation:** Already partially exists in `getGscKeywordComparison`. Enhance by:
- Adding `positionDelta = gscPosition - trackedPosition` field
- Flagging "high discrepancy" keywords (delta > 5)
- Showing trend: is the discrepancy growing or shrinking?
- Cross-referencing with device dimension data to explain discrepancies

**New data needed:** GSC `[query, device]` dimension combination.

### 3.2 Click-Through Rate Analysis (keyword + page)

**What:** For each tracked keyword, show real CTR alongside position. Highlight keywords with abnormally low or high CTR for their position.

**Why this matters:** Average CTR by position is well-studied (pos 1 ~27%, pos 2 ~15%, pos 3 ~11%). A keyword at position 2 with 5% CTR is massively underperforming — likely the title/description needs work, or SERP features are stealing clicks. A keyword at position 8 with 12% CTR is overperforming — worth investing more in.

**Implementation:**
- Add CTR benchmarks by position (industry averages)
- Flag keywords where CTR deviates significantly from expected
- Cross-reference with `serpFeatureTracking`: if a keyword has featured snippet active and low CTR, the snippet is stealing clicks
- Cross-reference with `domainOnsitePages`: show the ranking URL's title/meta description alongside the CTR, so users can see what needs fixing

**New data needed:** GSC `[query, page]` to match keyword + URL, then join with `domainOnsitePages` by URL.

### 3.3 Page Performance Dashboard (page-level)

**What:** For each crawled page (`domainOnsitePages`), overlay GSC data: total clicks, impressions, top keywords driving traffic to that page, CTR, average position.

**Why this matters:** Currently our on-site analysis tells you "this page has thin content" or "this page is slow," but there's no context for how important that page is. A slow page that gets 10,000 clicks/month is an urgent fix. A slow page with 0 clicks is low priority. GSC page-level data adds business impact to technical issues.

**Implementation:**
- New GSC sync dimension: `[page]` and `[page, query]`
- New table: `gscPageMetrics` — aggregate clicks/impressions/ctr/position per page per day
- Join with `domainOnsitePages` by URL to enrich on-site data
- New UI: page-level performance column in on-site pages table
- Priority scoring: weight on-site issues by page traffic (high-traffic + issue = critical)

**New data needed:** GSC `[page]`, `[page, query]`, `[page, date]` dimensions.

### 3.4 Content Gap Enrichment

**What:** When we identify a content gap (competitor ranks, we don't), check if GSC shows any impressions for that keyword. If yes, we have the keyword but low visibility. If no impressions at all, we truly don't appear.

**Why this matters:** A content gap where you already have 500 impressions but 0 clicks is a different problem than a gap where you have 0 impressions. The first means you're appearing but not clicked (fix the snippet). The second means you need to create or optimize content.

**Implementation:**
- During content gap analysis, cross-reference each gap keyword against `gscKeywordMetrics`
- Add fields to `contentGaps`: `gscImpressions`, `gscClicks`, `gscPosition`
- New priority bucket: "appearing but not clicked" vs "not appearing at all"
- UI: show GSC data columns in content gap table

**New data needed:** More keywords from GSC (increase from 500 to 5,000+), using `[query]` dimension with higher rowLimit.

### 3.5 Discovered Keywords Validation

**What:** Cross-reference DataForSEO's discovered keywords with GSC to validate actual traffic.

**Why this matters:** DataForSEO's Ranked Keywords API shows keywords a domain ranks for, with estimated traffic. GSC provides actual traffic. Cross-referencing reveals:
- Keywords with high estimated traffic but low actual traffic (overestimated)
- Keywords with low estimated traffic but high actual traffic (underestimated, hidden gems)
- Keywords in GSC not found by DataForSEO at all (long-tail, low-volume but collectively significant)

**Implementation:**
- After sync, match GSC keywords against `discoveredKeywords` by phrase
- Flag "GSC-only" keywords (in GSC but not in discovered) — these are the long-tail goldmine
- Add GSC clicks/impressions columns to the discovered keywords table
- New "keyword discovery" mode: auto-propose GSC keywords that get significant traffic but aren't being tracked

**New data needed:** Full 25,000-row GSC keyword pull (paginated if needed).

### 3.6 Device & Country Performance Split

**What:** For each domain, show traffic breakdown by device (desktop/mobile/tablet) and top countries. For each keyword, show device and country performance.

**Why this matters:** Many sites have dramatically different mobile vs desktop performance. A keyword ranking at position 3 on desktop but position 15 on mobile is invisible to most users. Country data reveals international SEO opportunities or problems.

**Implementation:**
- New tables: `gscDeviceMetrics`, `gscCountryMetrics` (aggregate per domain per day)
- New UI section on overview tab: device/country traffic split charts
- Per-keyword drill-down: "This keyword gets 80% of its impressions on mobile but only 20% of clicks — mobile experience needs work"
- Cross-reference with `coreWebVitals`: if mobile traffic is low and CWV on mobile is poor, there's a clear connection

**New data needed:** GSC `[device]`, `[country]`, `[query, device]`, `[query, country]` dimensions.

### 3.7 Search Appearance Insights

**What:** Track how often the domain appears in special search features: rich results, AMP, video, FAQ, etc.

**Why this matters:** Rich results significantly impact CTR. Knowing that 30% of your impressions come from rich results — and that rich result clicks have 2x the CTR — quantifies the value of structured data. Cross-reference with `schemaValidation` table to show: "you have schema errors on pages that could be getting rich results."

**Implementation:**
- GSC dimension: `[searchAppearance]` and `[searchAppearance, query]`
- New table: `gscSearchAppearanceMetrics`
- Join with `schemaValidation` and `domainOnsitePages` (structured data status)
- UI: "Search Appearance" card on overview, showing feature types and their traffic contribution

**New data needed:** GSC `[searchAppearance]`, `[searchAppearance, query]` dimensions.

### 3.8 URL Inspection for Priority Pages

**What:** For the top N pages by GSC traffic, run URL Inspection to get Google's actual crawl/index status.

**Why this matters:** Our on-site crawler sees pages from outside. URL Inspection shows what Google actually sees: the selected canonical, the indexing status, mobile usability from Google's perspective, rich result eligibility. A page that our crawler says is fine might have a Google-side canonical issue that kills its traffic.

**Implementation:**
- After GSC sync identifies top pages by clicks, batch-inspect them (respect 2,000/day limit)
- New table: `gscUrlInspections` — indexStatus, crawlTime, canonical, mobileUsability, richResults
- Join with `domainOnsitePages` to show side-by-side: "Our crawler sees X, Google sees Y"
- Alert when Google's view differs from expected (e.g., non-canonical, not indexed, mobile issues)

**New data needed:** URL Inspection API calls for top-traffic pages.

### 3.9 AI Strategy Enhancement

**What:** Feed GSC data into the AI Strategy generation as a data snapshot.

**Why this matters:** Currently the AI strategy uses DataForSEO data (positions, search volumes, competitors). Adding real click/impression data makes the strategy far more grounded. The AI can recommend "increase CTR on your position-2 keywords — they're getting 500 impressions but only 15 clicks" instead of generic advice.

**Implementation:**
- Enhance `dataSnapshot` in `aiStrategySessions` with GSC metrics
- Modify `convex/actions/aiStrategy.ts` to include GSC data in the prompt:
  - Top 20 keywords by clicks with CTR
  - Device split
  - Top 10 pages by traffic
  - Keywords with low CTR for position (optimization opportunities)
  - GSC-only keywords (long-tail opportunities)
- No new tables needed — just richer data collection during strategy generation

### 3.10 Backlink Impact Correlation

**What:** Correlate backlink acquisition/loss with GSC traffic changes.

**Why this matters:** When you gain 50 backlinks in a week, did traffic actually increase? When you lost a high-authority backlink, did any keywords drop? This connects `backlinkVelocityHistory` with GSC time-series data to show cause and effect.

**Implementation:**
- New query: overlay `backlinkVelocityHistory` timeline with `gscKeywordMetrics` (by date) aggregate trends
- Chart: dual-axis showing backlink velocity (new/lost per day) vs total clicks/impressions
- Alert: "You gained 30 backlinks this week and organic traffic increased 15%" or "You lost a DA-80 backlink and position for [keyword] dropped from 3 to 12"
- Cross-reference individual backlinks (`domainBacklinks.firstSeen`) with keyword position changes

**New data needed:** GSC `[date]` dimension for time series, already fetched if we do `[query, date]`.

---

## Part 4: New Schema Tables

### 4.1 `gscPageMetrics` (new)

```
gscPageMetrics: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  page: v.string(),          // full URL
  date: v.string(),          // YYYY-MM-DD
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
})
  .index("by_domain_date", ["domainId", "date"])
  .index("by_domain_page", ["domainId", "page"])
```

### 4.2 `gscDeviceMetrics` (new)

```
gscDeviceMetrics: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  device: v.string(),        // DESKTOP, MOBILE, TABLET
  date: v.string(),
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
})
  .index("by_domain_date", ["domainId", "date"])
```

### 4.3 `gscCountryMetrics` (new)

```
gscCountryMetrics: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  country: v.string(),       // ISO 3166-1 alpha-3
  date: v.string(),
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
})
  .index("by_domain_date", ["domainId", "date"])
```

### 4.4 `gscUrlInspections` (new)

```
gscUrlInspections: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  url: v.string(),
  inspectedAt: v.number(),
  verdict: v.string(),                // "pass", "neutral", "fail"
  indexingState: v.string(),          // "INDEXING_ALLOWED", "BLOCKED_BY_META_TAG", etc.
  lastCrawlTime: v.optional(v.string()),
  pageFetchState: v.optional(v.string()),  // "SUCCESSFUL", "SOFT_404", etc.
  robotsTxtState: v.optional(v.string()),  // "ALLOWED", "DISALLOWED"
  userCanonical: v.optional(v.string()),
  googleCanonical: v.optional(v.string()),
  mobileUsability: v.optional(v.string()), // "MOBILE_FRIENDLY", issues
  richResultsStatus: v.optional(v.string()),
  richResultsItems: v.optional(v.any()),   // detected structured data types
})
  .index("by_domain", ["domainId"])
  .index("by_domain_url", ["domainId", "url"])
```

### 4.5 `gscSearchAppearanceMetrics` (new)

```
gscSearchAppearanceMetrics: defineTable({
  domainId: v.id("domains"),
  organizationId: v.id("organizations"),
  appearance: v.string(),    // "RICH_RESULT", "AMP", "FAQ", etc.
  date: v.string(),
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
})
  .index("by_domain_date", ["domainId", "date"])
```

### 4.6 Existing `gscKeywordMetrics` — enhance

Add `device` and `country` optional fields so we can store per-keyword device/country breakdowns without needing separate tables:

```
// Add to existing gscKeywordMetrics:
device: v.optional(v.string()),    // DESKTOP, MOBILE, TABLET (null = aggregate)
country: v.optional(v.string()),   // ISO 3166-1 alpha-3 (null = aggregate)
```

Alternative: keep keyword metrics clean and do device/country as separate queries at the domain level only (tables 4.2, 4.3). This is simpler and sufficient — users rarely need per-keyword per-device per-country data.

**Decision: Keep keyword metrics clean. Device/country as domain-level aggregates only (tables 4.2, 4.3).** Per-keyword device/country can be fetched on-demand via action calls when a user drills into a specific keyword.

---

## Part 5: Sync Architecture

### 5.1 Multi-Dimension Sync Strategy

Instead of one API call per domain (current), we need multiple calls per domain, each with a different dimension combination. To stay within Google's rate limits and Convex action time limits, we structure the sync as a multi-phase pipeline.

**Phase 1 — Keywords (high priority, runs every sync):**
- `dimensions: ["query"]`, `rowLimit: 5000` (paginated if > 5000)
- Stores to `gscKeywordMetrics`

**Phase 2 — Pages (high priority, runs every sync):**
- `dimensions: ["page"]`, `rowLimit: 5000`
- Stores to `gscPageMetrics`

**Phase 3 — Device/Country aggregates (medium priority, runs every sync):**
- `dimensions: ["device"]` — 3 rows max
- `dimensions: ["country"]`, `rowLimit: 250`
- Stores to `gscDeviceMetrics`, `gscCountryMetrics`

**Phase 4 — Keyword-Page mapping (lower priority, runs weekly or on-demand):**
- `dimensions: ["query", "page"]`, `rowLimit: 10000` (paginated)
- Used for cross-reference 3.2 (CTR analysis) and 3.3 (page keyword attribution)
- Stores as enrichment to `gscKeywordMetrics` (add `url` field, already optional)

**Phase 5 — Search Appearance (lower priority, runs weekly or on-demand):**
- `dimensions: ["searchAppearance"]`, `rowLimit: 100`
- Stores to `gscSearchAppearanceMetrics`

**Phase 6 — URL Inspections (on-demand or weekly for top pages):**
- Takes top 50 pages by clicks from `gscPageMetrics`
- Inspects each via URL Inspection API (respect 600/min, 2000/day)
- Stores to `gscUrlInspections`

### 5.2 Date Range Strategy

**Daily sync (automated cron):**
- Fetch last 3 days with `dataState: "all"` — captures fresh data
- This replaces previous data for those dates (upsert by domain + date + dimension key)

**Initial historical backfill (on first connect or manual trigger):**
- Fetch 16 months of data in monthly batches
- Runs as a background job, not blocking the UI
- Uses `dataState: "final"` for accuracy

**On-demand refresh:**
- User clicks "Sync Now" — fetches last 7 days
- Optionally fetches URL Inspection for top pages

### 5.3 Rate Limiting & Batching

GSC API quotas (per property):
- Search Analytics: 200 requests/minute, 20,000 requests/day
- URL Inspection: 600/minute, 2,000/day

For a typical domain sync (phases 1-5): ~5 API calls. Well within limits.

For batch operations (multi-domain orgs, historical backfill): implement a simple queue with delays between batches.

---

## Part 6: UX Flow — When and How Users Connect GSC

### 6.1 Connection Points (When)

There are several natural moments when a user should be prompted or guided to connect GSC:

**A) Settings page (existing):**
The `GscConnectionPanel` already exists. This is the primary explicit connection point. User goes to Settings, clicks "Connect Google Search Console," completes OAuth. This works at the organization level — one OAuth connection covers all properties.

**B) Domain onboarding (new — high value):**
When a user adds a new domain and completes onboarding, we should show a "Connect GSC for richer data" step. If GSC is already connected at the org level, just show the property selector. If not connected, show a "Connect GSC" button that opens the OAuth flow, then auto-maps the matching property.

**C) Domain overview tab (existing, enhance):**
The overview tab already shows `GscMetricsCard` and `GscPropertySection`. If GSC is not connected, the property section shows "not connected." We should enhance this with a more prominent CTA: "Connect Google Search Console to see real click data, CTR analysis, and page performance."

**D) Contextual prompts in relevant tabs (new — nudge):**
When a user is viewing the monitoring tab, content gaps tab, or on-site tab, and GSC is not connected, show a subtle banner: "This section is more powerful with GSC data. [Connect now]"

### 6.2 Property Mapping (How)

After OAuth, the user has a list of GSC properties. Each property needs to be mapped to a domain in our app.

**Auto-mapping:** When the user's domain is `example.com` and GSC has `sc-domain:example.com` or `https://www.example.com/`, we auto-suggest the match. For exact matches, auto-assign without asking.

**Manual mapping:** The property selector dropdown (`GscPropertySection`) on the domain settings tab lets the user manually pick which GSC property corresponds to this domain. This handles cases where the domain name doesn't exactly match the GSC property (e.g., domain is "example.com" but GSC property is "https://www.example.com/blog/").

**Multi-domain:** One GSC connection can have 20+ properties. Each domain in our app maps to one GSC property. The settings tab shows which property is mapped.

### 6.3 Data Visibility After Connection

**Immediately after connecting:**
- Properties list populates in the selector
- If auto-mapped, first sync triggers automatically (Phase 1-3: keywords, pages, device/country)
- GscMetricsCard starts showing real data within a few seconds of sync completion

**Within the first day:**
- Historical backfill runs in background (up to 16 months)
- Cross-references start populating:
  - Keyword comparison table enriches with CTR data
  - Content gap table shows GSC impression/click data
  - Discovered keywords table shows "validated by GSC" column

**After first week of tracking:**
- Trend data becomes meaningful (7-day click/impression trends)
- Backlink impact correlation can start showing correlations
- AI Strategy incorporates GSC data in next generation

### 6.4 Domain Detail Page — New GSC Sections

**Overview tab enhancements:**
- GscMetricsCard: already exists, enhance with trend arrows (vs previous period)
- Device split mini-chart: pie chart showing desktop/mobile/tablet click distribution
- Top pages by clicks: mini-table showing top 5 pages with click counts
- GSC vs tracked position comparison: mini-table showing biggest discrepancies

**New "Search Performance" section within Monitoring tab (or as enhancement):**
- Full keyword-level table with GSC data: keyword, clicks, impressions, CTR, GSC position, tracked position, delta
- Filters: date range, device, country
- Sort by clicks, impressions, CTR, position
- Highlight keywords with CTR anomalies (much lower or higher than expected for position)

**On-Site tab enhancement:**
- Pages table: add "GSC Clicks" and "GSC Impressions" columns (from `gscPageMetrics`)
- Issue priority: weight issues by page traffic (high-traffic broken page = critical)
- URL Inspection status column for top pages

**Content Gaps tab enhancement:**
- Add "GSC Impressions" and "GSC Clicks" columns to the gap table
- New filter: "Appearing but not clicked" (has impressions, low/no clicks)
- Priority re-calculation incorporating GSC data

**Insights tab enhancement:**
- New insight type: "CTR Optimization Opportunities" — keywords with good position but low CTR
- New insight type: "Hidden Gems" — GSC keywords with significant clicks that aren't being tracked
- New insight type: "Mobile Gap" — keywords where mobile position is much worse than desktop

---

## Part 7: Implementation Phases

### Phase A — Foundation (prerequisite, partially done)

Status: ~70% complete (OAuth works, basic sync works, UI scaffolding exists)

Remaining:
1. Increase `rowLimit` from 500 to 5,000 in existing sync
2. Add pagination for >5,000 rows
3. Store `url` field from `[query, page]` response (already optional in schema)
4. Proper error handling and retry logic in sync actions

### Phase B — Multi-Dimension Sync

New sync phases 1-5 as described in Part 5:
1. Add `gscPageMetrics`, `gscDeviceMetrics`, `gscCountryMetrics` tables to schema
2. Implement multi-phase sync in `syncGscDataInternal`
3. Add historical backfill action (16 months, monthly batches)
4. Add sync progress tracking (which phases completed, last sync per phase)

### Phase C — Cross-Reference Queries

Build the backend queries that join GSC data with existing data:
1. Enhanced `getGscKeywordComparison` with CTR analysis and position delta
2. New `getPagePerformance` query joining `gscPageMetrics` + `domainOnsitePages`
3. Enhanced content gap queries with GSC impression/click data
4. Device/country aggregate queries for overview charts
5. "Hidden gems" query: GSC keywords not in tracked keywords

### Phase D — UI Integration

Build the frontend to display cross-referenced data:
1. Enhanced GscMetricsCard with trends
2. Device/country split charts on overview
3. Search Performance table (keyword-level GSC data with filters)
4. On-Site pages table with GSC traffic columns
5. Content gap table with GSC columns
6. Insights tab new insight types

### Phase E — URL Inspection

1. Add `gscUrlInspections` table
2. Implement batch URL Inspection action (top pages by traffic)
3. Add inspection status to on-site pages table
4. Alert on canonical mismatches, index issues for high-traffic pages

### Phase F — Search Appearance & Advanced

1. Add `gscSearchAppearanceMetrics` table
2. Search appearance chart on overview
3. Cross-reference with structured data validation
4. AI Strategy enhancement with GSC data in prompt
5. Backlink impact correlation chart

### Phase G — UX Polish

1. Onboarding step for GSC connection
2. Contextual prompts in tabs when GSC not connected
3. Auto-mapping property to domain on connect
4. "Sync Now" with progress indicator
5. Date range picker for GSC data throughout the app

---

## Part 8: Priority Assessment

**Highest ROI (do first):**
- Multi-dimension keyword sync with more rows (Phase A remaining + B partial) — immediate data quality improvement
- CTR analysis cross-reference (Phase C.1) — unique insight no competitor gives easily
- Page-level GSC data (Phase B.2 + C.2) — connects technical issues to business impact

**Medium ROI:**
- Content gap enrichment (Phase C.3) — improves existing feature significantly
- Device/country breakdown (Phase B.3 + D.2) — valuable but less actionable than keyword/page data
- Hidden gems keyword discovery (Phase C.5) — great for keyword research

**Lower ROI (do later):**
- URL Inspection (Phase E) — powerful but limited by rate limits and complexity
- Search appearance (Phase F.1-3) — niche feature, useful for sites with structured data
- AI Strategy enhancement (Phase F.4) — nice-to-have, improves AI output quality
- Backlink correlation (Phase F.5) — interesting but hard to prove causation

---

## Part 9: Open Questions

1. **Should GSC data be behind a plan tier?** Currently GSC connection is available to all users. The deeper cross-references (CTR analysis, URL inspection, AI strategy enhancement) could be premium features.

2. **Sync frequency for heavy dimensions:** Page-level and keyword-page mapping generate many more rows than keyword-only. Should these sync daily or weekly? Trade-off: freshness vs storage costs and sync time.

3. **Historical backfill UX:** 16 months of data across multiple dimensions is a lot. Should we show a progress bar? Allow the user to cancel? Backfill in the background and show "historical data loading..." in the UI?

4. **GSC-discovered keywords auto-tracking:** When GSC reveals keywords we're not tracking that get significant traffic, should we auto-propose them for tracking (like `discoveredKeywords` does from DataForSEO), or just surface them in the UI?

5. **Discover/googleNews data:** GSC can report on Google Discover and Google News performance. These are non-search traffic sources. Worth fetching for sites that get significant Discover traffic, but adds complexity. Phase F or later?
