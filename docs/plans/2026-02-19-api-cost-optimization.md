# API Cost Optimization Plan

## Cost Reference

| Endpoint | Cost/task | Used in |
|----------|-----------|---------|
| SERP Live/advanced (depth:30) | $0.005 | position checks, competitor checks |
| SERP Standard (depth:30) | ~$0.00155 | -- not used yet, 3.2x cheaper than Live |
| SERP Priority (depth:30) | ~$0.0031 | -- not used yet, 1.6x cheaper than Live |
| Historical SERPs | $0.01 | historical position fetching |
| Labs: Ranked Keywords | $0.01 | domain visibility (internal) |
| Labs: Keywords for Site | $0.01 | domain visibility fallback |
| Labs: Historical Rank Overview | $0.10 | domain visibility (public), history |
| Keywords Data: Google Ads | $0.075 | domain visibility (internal), enrichment |
| Keywords Data: Search Volume | $0.05 | single position checks |
| On-Page: Content Parsing | $0.001 | homepage scraping |
| On-Page: Instant Pages | $0.01 | competitor page analysis |

---

## 1. CRITICAL: Remove duplicate competitor SERP calls

**Problem:** `trackCompetitorsBatch` in `keywordSerpJobs.ts` already extracts competitor positions from primary keyword SERP response (zero additional API calls). But two separate flows make redundant SERP calls per keyword x per competitor:
- `competitors_actions.ts` -> `checkSingleCompetitorPosition`, `checkCompetitorPositions`, `checkAllActiveCompetitors`
- `actions/competitorPositions.ts` -> `checkSingleKeyword`, `checkCompetitorPositions`

**Waste:** 50 kw x 5 competitors = 250 extra SERP calls x $0.005 = $1.25/check. Weekly = $5/month per user.

**Fix:** Delete both separate competitor position flows. Rely on `trackCompetitorsBatch` from primary keyword SERP check.

**Files to modify/delete:**
- Delete: `convex/actions/competitorPositions.ts`
- Modify: `convex/competitors_actions.ts` -- remove `checkSingleCompetitorPosition`, `checkCompetitorPositions`, `checkCompetitorPositionsInternal`, `checkAllActiveCompetitors`
- Verify: `trackCompetitorsBatch` in `keywordSerpJobs.ts` covers all tracked competitors (not just top 10)
- Update: any UI/scheduler references to removed functions

---

## 2. HIGH: Dead code cleanup -- unused fetching functions

**Problem:** Several expensive API functions exist but are never called:
- `fetchSinglePosition` (public action, dataforseo.ts:209-356) -- 0 callers found
- `fetchHistoricalBatch` (dataforseo.ts:831-1043) -- 0 callers found
- `fetchHistoricalPositions` (dataforseo.ts:1275-1371) -- 0 callers found, makes individual per-date calls

**Waste:** Not direct cost, but maintenance burden and risk of accidental use.

**Fix:** Delete all three unused functions.

**Files to modify:**
- Modify: `convex/dataforseo.ts` -- remove `fetchSinglePosition`, `fetchHistoricalBatch`, `fetchHistoricalPositions`

---

## 3. HIGH: fetchDomainVisibility uses most expensive endpoint ($0.10/call)

**Problem:** `fetchDomainVisibility` (dataforseo.ts:1469-1929) calls `LABS_HISTORICAL_RANK_OVERVIEW` at $0.10/task. Meanwhile `fetchDomainVisibilityInternal` calls `LABS_RANKED_KEYWORDS` at $0.01 + `KEYWORDS_DATA_GOOGLE_ADS` at $0.075 = $0.085 total but gets more useful data (actual ranked keywords vs aggregate overview).

**Callers:**
- `aiKeywordResearch.ts:153` -- calls `fetchDomainVisibility` ($0.10+) for AI research context
- `domains.ts:1109` -- calls `fetchAndStoreVisibility` -> `fetchDomainVisibilityInternal` ($0.085)
- `domains.ts:1124` -- calls `fetchAndStoreVisibilityHistory` ($0.10) for 12 months

**Waste:** AI research uses $0.10 endpoint when $0.085 internal gets better data. Plus language validation retries can double costs to $0.17-0.20.

**Fix:** Replace `fetchDomainVisibility` usage in `aiKeywordResearch.ts` with `fetchDomainVisibilityInternal` (saves $0.015/call and gets richer keyword data). Consider pre-validating language/location combos to avoid retry overhead.

**Files to modify:**
- Modify: `convex/actions/aiKeywordResearch.ts` -- use internal function
- Modify: `convex/dataforseo.ts` -- potentially consolidate the two visibility functions

---

## 4. MEDIUM: Historical positions fetched without deduplication

**Problem:** `fetchHistoricalPositionsInternal` (dataforseo.ts:1045-1191) fetches 6 dates of historical data at $0.01/task but never checks if those dates already have stored data. If called twice for the same keyword, it re-fetches and inserts duplicates.

The `fetchHistoryIfEmpty` flag in `fetchSinglePositionInternal` only checks `needsHistory` via denormalized fields, not actual stored position dates.

**Waste:** $0.06/keyword on redundant re-fetches if triggered multiple times.

**Fix:** Before fetching historical data, query existing `keywordPositions` for the keyword to see which dates already have data. Only fetch missing dates.

**Files to modify:**
- Modify: `convex/dataforseo.ts` -- add deduplication query in `fetchHistoricalPositionsInternal`
- Alternatively: add unique constraint check before insert at lines 1177-1183

---

## 5. MEDIUM: No content caching for homepage scraping

**Problem:** `fetchPageContent` (scrapeHomepage.ts) calls Content Parsing API ($0.001) every time without checking if content was recently fetched. Called from:
- `aiKeywordResearch.ts` -- every AI research session
- `aiBusinessContext.ts` -- every business context generation

If a user runs AI research 5 times in a day, that's 5 content parsing calls for the same homepage.

**Waste:** Low per-call ($0.001) but adds up with repeated use.

**Fix:** Cache scraped content on the domain record (or a separate table) with a TTL (e.g., 24 hours). Check cache before making API call.

**Files to modify:**
- Modify: `convex/actions/scrapeHomepage.ts` -- add caching layer
- Modify: `convex/domains.ts` or create cache table

---

## 6. LOW: Content/page analysis not cached

**Problem:** `analyzeCompetitorPage` (competitorAnalysis.ts) and `analyzePageWithDataForSEO` (competitorAnalysisReports.ts) call Instant Pages API ($0.01/URL) without checking if URL was recently analyzed.

**Waste:** $0.01/URL if analysis triggered multiple times for same URL.

**Fix:** Check `competitorPageAnalysis` table for recent analysis of same URL before making API call. Skip if analyzed within last 7 days.

**Files to modify:**
- Modify: `convex/competitorAnalysis.ts` -- check for existing analysis
- Modify: `convex/competitorAnalysisReports.ts` -- check for existing analysis

---

## 7. LOW: Domain initialization makes 2 separate expensive calls

**Problem:** `initializeDomainAuto` in `domains.ts` (lines 1109-1135) makes two separate expensive calls:
1. `fetchAndStoreVisibility` ($0.085) -- ranked keywords + Google Ads
2. `fetchAndStoreVisibilityHistory` ($0.10) -- 12 months of rank overview

These run sequentially with no shared data.

**Waste:** $0.185 per new domain, up to $0.37 with retries.

**Fix:** These are one-time costs per domain so not high priority, but could be combined. Consider whether historical rank overview is truly needed at domain creation time.

---

## 8. CRITICAL: keywordCheckJobs sends keywords one-at-a-time instead of batching

**Problem:** `keywordCheckJobs.ts` line 281 calls `fetchPositionsInternal` with a SINGLE keyword array `[{ id: keywordId, phrase: keyword.phrase }]`, even though `fetchPositionsInternal` supports batching ALL keywords into ONE DataForSEO API request (it builds a multi-task JSON body at dataforseo.ts:703-710).

Compare with `scheduler.ts` lines 63-70 which correctly passes ALL domain keywords at once:
```
keywords: keywords.map((k) => ({ id: k._id, phrase: k.phrase }))
```

In keywordCheckJobs, each keyword processed in the chunk triggers a separate `fetchPositionsInternal` call, each of which:
1. Makes its own HTTP request to DataForSEO
2. Runs its own `costCheck` query
3. Has its own action overhead (Convex action scheduling)

**Waste:** For a 15-keyword chunk, that's 15 separate action invocations + 15 HTTP requests instead of 1. The DataForSEO cost per keyword is identical ($0.005/task), but the Convex action overhead and HTTP latency multiply by 15x.

**Fix:** Collect all keywords in the chunk, then make ONE `fetchPositionsInternal` call for the entire batch. Process results afterward.

**Files to modify:**
- Modify: `convex/keywordCheckJobs.ts` -- batch keywords before calling fetchPositionsInternal
- The processing loop (lines 220-320) needs restructuring: collect keywords first, batch-fetch, then process results

---

## 9. HIGH: contentGaps_actions makes N×M individual queries (500+ round-trips)

**Problem:** `contentGaps_actions.ts` lines 136-234 has a nested loop pattern that makes individual Convex queries per keyword × per competitor:

```typescript
for (const keyword of activeKeywords) {
  // 1 query per keyword
  const yourPositions = await ctx.runQuery(getLatestPosition, { keywordId });
  for (const competitor of activeCompetitors) {
    // 1 query per keyword×competitor
    const competitorPositions = await ctx.runQuery(getLatestPosition, { competitorId, keywordId });
    // 1 mutation per gap found
    await ctx.runMutation(upsertGap, { ... });
  }
}
```

For 50 keywords × 5 competitors = 50 user position queries + 250 competitor position queries + ~200 upsert mutations = **500+ Convex round-trips** in a single action invocation.

**Fix:** Create batch query functions:
1. `getLatestPositionsBatch(keywordIds)` -- fetch all user positions in one query
2. `getLatestCompetitorPositionsBatch(competitorIds, keywordIds)` -- fetch all competitor positions in one query
3. `upsertGapsBatch(gaps[])` -- batch upsert all gaps in one mutation

This reduces 500+ round-trips to 3.

**Files to modify:**
- Modify: `convex/contentGaps_actions.ts` -- replace nested loop with batch queries
- Create: batch query helpers in `convex/keywordPositions_internal.ts` and `convex/competitorKeywordPositions_internal.ts`
- Create: batch upsert mutation in `convex/contentGaps_actions.ts`

---

## 10. MEDIUM: keywordSerpJobs fetches keywords individually in chunk loop

**Problem:** `keywordSerpJobs.ts` lines 221-238 fetches each keyword individually inside the chunk processing loop:

```typescript
for (const keywordId of chunkKeywordIds) {
  const keyword = await ctx.runQuery(internal.keywords.getKeywordInternal, { keywordId });
  // ... process keyword
}
```

For a 10-keyword chunk, that's 10 sequential `getKeywordInternal` queries.

Additionally, the processing loop (lines 298-464) makes 6 mutations per keyword:
1. `updateJobInternal` (set currentKeywordId)
2. `logApiUsage`
3. `storeSerpResultsInternal`
4. `storePositionInternal` (or `storePosition`)
5. `trackCompetitorsBatch`
6. `updateJobInternal` (progress update)

For a 10-keyword chunk = 60 Convex mutations + 10 queries = 70 round-trips.

**Fix:**
- Phase 1: Replace individual keyword fetches with a batch query `getKeywordsBatch(keywordIds)` that returns all keywords in one call
- Phase 2: Consolidate per-keyword mutations where possible (e.g., batch logApiUsage, batch progress updates)

**Files to modify:**
- Modify: `convex/keywordSerpJobs.ts` -- use batch keyword fetch
- Create: `getKeywordsBatch` query in `convex/keywords.ts`
- Consider: batch mutation for storeSerpResults + storePosition

---

## 11. MEDIUM: keywordCheckJobs per-keyword mutation overhead

**Problem:** `keywordCheckJobs.ts` lines 220-320 hot loop makes 4 mutations + 1 action per keyword:
1. `updateCurrentKeyword` mutation
2. `updateKeywordStatus` mutation (set "checking")
3. `fetchPositionsInternal` action (the single-keyword call from issue #8)
4. `updateKeywordStatus` mutation (set "active"/"error")
5. `updateProgress` mutation

For a 15-keyword chunk = 75 Convex round-trips (60 mutations + 15 actions).

**Fix:** After fixing issue #8 (batch the fetch), consolidate the status update mutations:
- Batch set all keywords to "checking" before the fetch
- After batch fetch, batch set all keywords to "active"/"error"
- Update progress once per chunk, not per keyword
- Remove individual `updateCurrentKeyword` calls (only needed for UI progress tracking — can be done at chunk level)

**Files to modify:**
- Modify: `convex/keywordCheckJobs.ts` -- restructure to batch mutations around batch fetch
- Create: `updateKeywordStatusBatch` mutation in `convex/keywords.ts`

---

## 12. MEDIUM: fetchPositionsInternal queries each keyword for difficulty check

**Problem:** `dataforseo.ts` lines 761-768 queries each keyword individually to check if it needs difficulty data:

```typescript
const keywordsNeedingDifficulty = await Promise.all(
  args.keywords.map(async (kw) => {
    const keyword = await ctx.runQuery(internal.dataforseo.getKeywordInternal, { keywordId: kw.id });
    return keyword && keyword.difficulty === undefined ? kw : null;
  })
);
```

For 50 keywords, this is 50 individual `getKeywordInternal` queries (they run in parallel via Promise.all, but still 50 Convex round-trips).

**Fix:** Either:
- Option A: Pass difficulty status through the args from the caller (scheduler/jobs already have keyword data)
- Option B: Create a batch query `getKeywordsDifficultyStatus(keywordIds)` that returns which keywords need difficulty in one call
- Option C: Always fetch difficulty (it's included in the SERP response at no extra API cost) and let storePosition handle dedup

**Files to modify:**
- Modify: `convex/dataforseo.ts` -- eliminate per-keyword difficulty check queries
- Modify: callers to pass `needsDifficulty` flag per keyword if using Option A

---

## 13. LOW: competitorAnalysisReports processes pages sequentially

**Problem:** `competitorAnalysisReports.ts` lines 235-270 analyzes competitor pages sequentially in a for loop:

```typescript
for (const compPage of report.competitorPages) {
  const analysis = await analyzePageWithDataForSEO(compPage.url);
  // ... store analysis, log usage
}
```

Each `analyzePageWithDataForSEO` is an independent HTTP call to DataForSEO. For 5 competitors, these 5 calls run sequentially when they could run in parallel.

**Waste:** Not extra API cost, but unnecessary latency. 5 sequential calls at ~2s each = ~10s. Parallel = ~2s.

**Fix:** Use `Promise.allSettled` to parallelize the DataForSEO calls:

```typescript
const analysisResults = await Promise.allSettled(
  report.competitorPages.map((compPage) => analyzePageWithDataForSEO(compPage.url))
);
```

Then process results and store analyses.

**Files to modify:**
- Modify: `convex/competitorAnalysisReports.ts` -- parallelize page analysis calls

---

## 14. CRITICAL: Switch SERP from Live mode to Standard mode (3.2x cheaper)

**Problem:** All SERP calls use `/serp/google/organic/live/advanced` at $0.002 base per 10 results ($0.005 at depth:30). DataForSEO offers a Standard async queue at $0.0006 base per 10 results ($0.00155 at depth:30) — **3.2x cheaper** — with ~5 min turnaround.

**Confirmed via DataForSEO docs (Context7):**

Pricing per task (depth:30, 3 pages of 10 results):
| Mode | Base/10 results | Estimated depth:30 | Turnaround |
|------|----------------|-------------------|------------|
| Standard (priority:1) | $0.0006 | ~$0.00155 | ~5 min avg |
| Priority (priority:2) | $0.0012 | ~$0.0031 | <1 min |
| Live | $0.002 | ~$0.005 | <6 sec |

**Async flow (confirmed):**

1. **POST** `/v3/serp/google/organic/task_post` — submit tasks with `postback_url` and `postback_data: "advanced"`
   - Request body: array of task objects (same fields as live: keyword, location_code, language_code, device, os, depth)
   - Extra params: `priority` (1 or 2), `postback_url`, `pingback_url`, `tag`
   - Response: status 20100 "Task Created", returns task IDs
   - `tag` field: custom string to match tasks with our internal IDs (e.g. jobId + keywordId)

2. **DataForSEO sends results to `postback_url`** — full SERP data POSTed to our endpoint
   - Format identical to `live/advanced` response (same items[], organic results, positions)
   - No need for polling or task_get calls

3. **Alternative (without postback):** Poll `GET /v3/serp/google/organic/tasks_ready` then fetch via `GET /v3/serp/google/organic/task_get/advanced/{id}`

**Recommended architecture for Convex:**

```
┌─────────────────────────────────────────────────────────┐
│ Current (Live, synchronous)                             │
│                                                          │
│ Action: POST /live/advanced → get results → process      │
│ Cost: $0.005/task                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Proposed (Standard, async with postback)                 │
│                                                          │
│ 1. Action: POST /task_post with postback_url pointing    │
│    to our Convex httpRouter endpoint                     │
│    tag = "{jobId}:{keywordId}" for matching              │
│    Save task IDs + metadata to DB table "serpTasks"       │
│                                                          │
│ 2. Convex HTTP endpoint receives POST from DataForSEO    │
│    Parse results (same format as live/advanced)           │
│    Match to job/keyword via tag                          │
│    Run internal mutations: storePosition, storeSerpResults│
│    Update job progress                                   │
│                                                          │
│ 3. Fallback: scheduled action polls tasks_ready every    │
│    5 min for any tasks that didn't postback              │
│    Cost: $0.00155/task (3.2x savings)                    │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Use `postback_url` (DataForSEO pushes results to us) rather than polling — cleanest flow
- Convex `httpRouter` can expose a public endpoint for postback (e.g. `POST /api/dataforseo/postback`)
- Validate postback requests (check auth header or secret token in URL)
- `tag` field carries our job context (jobId + keywordId) so postback handler knows what to update
- Fallback poll for tasks that didn't trigger postback within 10 min
- Result format is identical to live/advanced — no changes needed in SERP parsing/processing code

**Waste saved:** For 50 keywords weekly per user:
- Live: 50 × $0.005 = $0.25/check → $1.00/month
- Standard: 50 × $0.00155 = $0.0775/check → $0.31/month
- **Savings: $0.69/month/user (69% reduction)**
- At 100 users: $69/month saved
- At 1000 keywords/user: $13.80/month/user saved → $1,380/month at 100 users

**Trade-off:** Results arrive async (~5 min) instead of instant. This is acceptable for:
- Scheduled checks (cron jobs already run in background)
- Bulk keyword checks (user doesn't wait for individual results)
- SERP data refreshes (background process)

**NOT acceptable for:**
- First-time keyword check (user expects quick feedback) — keep Live for initial checks
- Single keyword re-check from UI — keep Live or use Priority mode

**Files to modify:**
- Create: `convex/http.ts` (or modify existing) — add DataForSEO postback endpoint
- Create: DB table `serpTasks` — track pending async tasks
- Modify: `convex/dataforseo.ts` — add `submitSerpTasksAsync` function using task_post
- Modify: `convex/keywordSerpJobs.ts` — use async flow for bulk checks
- Modify: `convex/scheduler.ts` — use async flow for scheduled refreshes
- Keep: `fetchSinglePositionInternal` using Live for first-time/UI-triggered checks

---

## Summary: Estimated Monthly Savings

| Issue | Category | Savings/Impact |
|-------|----------|----------------|
| #14 Switch to Standard mode | API cost | **69% SERP cost reduction** ($0.69/user/month) |
| #1 Duplicate competitor SERP | API cost | $5.00/user/month |
| #2 Dead code cleanup | Maintenance | $0 (reduces risk) |
| #3 Visibility endpoint swap | API cost | $0.90/year for AI research users |
| #4 Historical dedup | API cost | $0-6 per bulk operation |
| #5 Content caching | API cost | <$0.10/month |
| #6 Page analysis caching | API cost | <$1.00/month |
| #7 Domain init consolidation | API cost | <$0.50/month |
| #8 keywordCheckJobs batch fetch | Latency + overhead | 15x fewer actions per chunk |
| #9 contentGaps N×M queries | Convex round-trips | 500+ → 3 per analysis |
| #10 keywordSerpJobs per-keyword queries | Convex round-trips | 70 → ~15 per chunk |
| #11 keywordCheckJobs mutation overhead | Convex round-trips | 75 → ~10 per chunk |
| #12 fetchPositions difficulty check | Convex round-trips | N → 1 queries (or 0) |
| #13 Sequential page analysis | Latency | 5x faster report generation |

**Combined impact of #1 + #14:** For a user with 50 keywords, 5 competitors, weekly checks:
- Current: $5.00 (redundant competitor) + $1.00 (SERP live) = $6.00/month
- After: $0.00 (competitor free via trackCompetitorsBatch) + $0.31 (SERP standard) = $0.31/month
- **Total savings: $5.69/user/month (95% reduction in SERP costs)**

Implementation priority:
1. #1 (biggest API cost savings — remove redundant competitor calls)
2. #14 (switch bulk SERP to Standard mode — 69% cost reduction)
3. #8 + #11 (keywordCheckJobs batch restructure — do together)
4. #9 (contentGaps N×M elimination)
5. #10 (keywordSerpJobs batch fetch)
6. #2 (dead code cleanup — easy win)
7. #12 (difficulty check consolidation)
8. #3-#7, #13 (lower priority optimizations)
