# Supabase Migration — Complete Data Flow Audit

## Overview

This document maps every read from `keywordPositions` and `competitorKeywordPositions` tables
in Convex, classifies each as STAYS / MIGRATES / HYBRID, and estimates the Convex read savings.

Dual-write (Phase 1) is already live — every new position is written to both Convex and Supabase.
This document drives Phase 2: migrating READ queries from Convex to Supabase.

---

## Classification Legend

| Category | Meaning |
|----------|---------|
| **STAYS** | Write-adjacent (upsert check, cascade delete) or already optimized via denormalized fields |
| **MIGRATES** | Analytical/historical read — perfect for SQL aggregation, JOINs, window functions |
| **HYBRID** | Uses denormalized fields for short periods, falls back to DB for longer periods |

---

## 1. keywordPositions — STAYS IN CONVEX

These are write-adjacent operations that must remain in Convex because they're part of
mutation transactions or denormalization repair logic.

| File | Function | Pattern | Why it stays |
|------|----------|---------|--------------|
| keywords.ts | storePosition | by_keyword_date, .first() | Upsert check before write |
| keywords.ts | deleteKeyword | by_keyword, .collect() | Cascade delete |
| keywords.ts | deleteKeywords | by_keyword, .collect() | Cascade delete |
| keywords.ts | repairDenormalization | by_keyword, .take(7) | Denorm repair mutation |
| keywords.ts | backfillDenormalizedPositions | by_keyword, .take(7) | Denorm backfill mutation |
| keywords.ts | deduplicatePositions | by_keyword, .collect() | Cleanup mutation |
| domains.ts | deleteDomain | by_keyword, .collect() | Cascade delete |
| domains.ts | remove | by_keyword, .collect() | Cascade delete |
| dataforseo.ts | storePositionInternal | by_keyword_date, .first() | Upsert check before write |
| dataforseo.ts | checkKeywordHasHistory | by_keyword, .take(3) | Write decision check |
| dataforseo.ts | getExistingPositionDates | by_keyword, .collect() | Dedup before API call |

**Total: 11 functions, all mutations/internal — no migration needed.**

---

## 2. keywordPositions — ALREADY OPTIMIZED (Denormalized)

These queries were already migrated to use denormalized fields on the `keywords` table
during S0053 optimization. They do NOT read from `keywordPositions` at all.

| File | Function | Denormalized fields used |
|------|----------|------------------------|
| keywords.ts | getKeywords | currentPosition, previousPosition, positionChange, currentUrl |
| keywords.ts | getKeywordMonitoring | currentPosition, previousPosition, recentPositions |
| keywords.ts | getMonitoringStats | currentPosition (bucketing) |
| keywords.ts | getPositionDistribution | currentPosition (bucketing) |
| keywords.ts | getMovementTrend | currentPosition, positionChange |
| keywords.ts | getRecentChanges (≤7d) | recentPositions array |
| keywords.ts | getTopPerformers (≤7d) | recentPositions array |

**Total: 7 functions, 0 keywordPositions reads — already optimal.**

---

## 3. keywordPositions — MIGRATE TO SUPABASE

### 3A. Dashboard N+1 Queries (HIGHEST PRIORITY — biggest cost savings)

These loop over ALL user keywords, making 1-2 keywordPositions reads per keyword.
With 200 keywords, that's 200-400 Convex reads PER dashboard load.

| File | Function | Current pattern | Reads/call | Supabase replacement |
|------|----------|----------------|------------|---------------------|
| dashboard.ts | getStats | Loop all KWs, .take(2) each | K×2 | `SELECT AVG(position), COUNT(*) FROM keyword_positions WHERE ... GROUP BY convex_domain_id` |
| dashboard.ts | getPositionDistribution | Loop all KWs, .take(1) each | K×1 | `SELECT CASE WHEN position BETWEEN 1 AND 3 THEN '1-3' ... END AS bucket, COUNT(*) FROM keyword_positions WHERE (convex_keyword_id, date) IN (SELECT ...) GROUP BY bucket` |
| dashboard.ts | getRecentChanges | Loop all KWs, .take(2) each | K×2 | `WITH latest AS (SELECT *, ROW_NUMBER() OVER(PARTITION BY convex_keyword_id ORDER BY date DESC) as rn ...) SELECT ... WHERE rn <= 2` |
| dashboard.ts | getRecentActivity | No index, .take(50) | Full scan | `SELECT * FROM keyword_positions ORDER BY date DESC LIMIT 50` |

**Estimated savings: ~5K reads/day → 4 SQL queries/day (for 200 keywords, 5 dashboard loads)**

### 3B. Domain-Level Aggregations

| File | Function | Current pattern | Reads/call | Supabase replacement |
|------|----------|----------------|------------|---------------------|
| domains.ts | getDomains | Loop KWs per domain, .first() each | K per domain | `SELECT convex_domain_id, AVG(position) FROM (SELECT DISTINCT ON (convex_keyword_id) * ORDER BY date DESC) GROUP BY convex_domain_id` |
| domains.ts | getPositionDistribution | Loop KWs, .first() each | K | Same bucket query as dashboard but per-domain |

**Estimated savings: ~2K reads/day → 2 SQL queries/day**

### 3C. Single-Keyword History (Chart Data)

| File | Function | Current pattern | Reads/call | Supabase replacement |
|------|----------|----------------|------------|---------------------|
| keywords.ts | getKeywordWithHistory | by_keyword + date filter, .collect() | 30 rows | `SELECT date, position, url FROM keyword_positions WHERE convex_keyword_id = $1 AND date >= $2 ORDER BY date` |
| keywords.ts | getPositionHistory | by_keyword, .collect() ALL | Unbounded | `SELECT date, position FROM keyword_positions WHERE convex_keyword_id = $1 ORDER BY date` |
| keywords.ts | getPositionAggregation | by_keyword + date filter, .first() | 1 | `SELECT position FROM keyword_positions WHERE convex_keyword_id = $1 AND date <= $2 ORDER BY date DESC LIMIT 1` |

**Estimated savings: ~500 reads/day → ~50 SQL queries/day**

### 3D. Report Generation

| File | Function | Current pattern | Reads/call |
|------|----------|----------------|------------|
| domainReports.ts | collectReportDataInternal | Loop 100 KWs, 2 reads each | 200 |
| reports.ts | getReportByToken | Loop KWs, .take(2) each | K×2 |

**Estimated savings: ~400 reads per report → 1-2 SQL queries**

### 3E. Keyword Group Analytics

| File | Function | Current pattern | Reads/call |
|------|----------|----------------|------------|
| keywordGroups_queries.ts | getGroupStats | .first() per group KW | K per group |
| keywordGroups_queries.ts | getKeywordsByGroup | .first() per KW | K per group |
| keywordGroups_queries.ts | fetchGroupPerformanceHistory | .collect() per KW, 30d | K×30 rows |

**Estimated savings: ~1K reads/day → 3 SQL queries/day**

### 3F. Internal/Admin

| File | Function | Current pattern |
|------|----------|----------------|
| keywordPositions_internal.ts | getLatestPosition | .take(1) — called by other functions |
| keywordPositions_internal.ts | getLatestPositionsBatch | .first() per KW — batch helper |
| diagnostic.ts | buildDomainDiagnostic | .collect() per active KW |

---

## 4. competitorKeywordPositions — STAYS IN CONVEX

| File | Function | Pattern | Why it stays |
|------|----------|---------|--------------|
| competitors_internal.ts | storeCompetitorPositionInternal | by_competitor_keyword_date, .first() | Upsert check |
| mutations/competitors.ts | removeCompetitor | by_competitor, .collect() | Cascade delete |
| mutations/competitors.ts | storeCompetitorPosition | by_competitor_keyword_date, .first() | Upsert check |
| competitors.ts | removeCompetitor | by_competitor, .collect() | Cascade delete |
| competitors.ts | saveCompetitorPosition | by_competitor_keyword_date, .first() | Upsert check |
| competitors.ts | bulkDeleteCompetitorPositions | by_competitor ± date, .collect() | Cleanup |
| keywordSerpJobs.ts | trackCompetitorsBatch | by_competitor_keyword_date, .first() | Batch upsert |

**Total: 7 functions, all mutations — no migration needed.**

---

## 5. competitorKeywordPositions — MIGRATE TO SUPABASE

### 5A. Competitor Overview/Trends (HIGHEST PRIORITY)

| File | Function | Current pattern | Reads/call |
|------|----------|----------------|------------|
| queries/competitors.ts | getCompetitorsByDomain | by_competitor, .collect() per comp | All positions per competitor |
| queries/competitors.ts | getCompetitorOverview | by_competitor + date, .collect() | All positions in date range |
| competitors_queries.ts | getCompetitorsByDomain | by_competitor, .collect() | Same as above (duplicate file) |
| competitors_queries.ts | getCompetitorOverview | by_competitor + date, .collect() | Same as above (duplicate file) |

**Supabase: `SELECT date, AVG(position) FROM competitor_keyword_positions WHERE convex_competitor_id = ANY($1) AND date >= $2 GROUP BY date ORDER BY date`**

### 5B. Gap Analysis Queries

| File | Function | Current pattern | Reads/call |
|------|----------|----------------|------------|
| queries/competitors.ts | getKeywordOverlap | by_competitor, .collect() | All positions |
| queries/competitors.ts | getCompetitorKeywordGaps | by_competitor, .collect() per comp | All positions per comp |
| competitors_queries.ts | getKeywordGaps | by_competitor, .collect() per comp | All positions per comp |

**Supabase: `SELECT ckp.convex_keyword_id, ckp.position as comp_pos, kp.position as own_pos FROM competitor_keyword_positions ckp LEFT JOIN keyword_positions kp ON ckp.convex_keyword_id = kp.convex_keyword_id AND kp.date = ckp.date WHERE ...`**

### 5C. Single Competitor History

| File | Function | Current pattern | Reads/call |
|------|----------|----------------|------------|
| competitors.ts | getCompetitorPositions | by_competitor_keyword, .take(30) | 30 per call |
| competitors.ts | getCompetitorsForKeyword | by_competitor_keyword, .first() per comp | 1 per competitor |
| competitorComparison_queries.ts | getPositionScatterData | by_competitor, .collect() | All per comp |

### 5D. Supporting Reads

| File | Function | Current pattern |
|------|----------|----------------|
| competitorAnalysis.ts | triggerCompetitorPageAnalysis | by_competitor_keyword, .first() |
| lib/diagnosticCross.ts | computeCompetitorsExtDiagnostic | by_competitor, .collect() |
| aiStrategy.ts | getCompetitorPositionsInternal | by_competitor, streaming |
| contentGaps_actions.ts | (via internal) | by_competitor, batch |

---

## 6. Frontend Real-Time Analysis

### STAYS real-time in Convex (uses denormalized fields):
| Component | Query | Data source |
|-----------|-------|------------|
| AllKeywordsTable | api.keywords.getKeywords | keywords.currentPosition |
| KeywordMonitoringTable | api.keywords.getKeywordMonitoring | keywords.currentPosition/recentPositions |
| MonitoringStats | api.keywords.getMonitoringStats | keywords.currentPosition (bucketing) |
| PositionDistributionChart | api.keywords.getPositionDistribution | keywords.currentPosition |
| MovementTrendChart | api.keywords.getMovementTrend | keywords.positionChange |

### MIGRATES to Supabase (historical/analytical — no real-time needed):
| Component | Query | Why Supabase |
|-----------|-------|-------------|
| KeywordMonitoringDetailModal | api.keywords.getPositionHistory | Full history chart, loaded on modal open |
| CompetitorOverviewChart | api.queries.competitors.getCompetitorOverview | Time series, refreshed on page load |
| CompetitorKeywordGapTable | api.queries.competitors.getCompetitorKeywordGaps | Gap analysis, not real-time |
| GroupPerformanceChart | api.keywordGroups_queries.getAllGroupsPerformance | 30-day group trends |
| Dashboard stats | api.dashboard.getStats | Aggregation across all domains |
| Dashboard distribution | api.dashboard.getPositionDistribution | Histogram bucketing |
| Dashboard gainers/losers | api.dashboard.getRecentChanges | Period comparison |

---

## 7. Migration Priority Order

### Phase 2a — Dashboard queries (biggest bang for buck)
Migrate dashboard.ts functions to Supabase. These are the most expensive queries
(N reads per keyword per dashboard load) and the easiest to migrate (pure aggregations).

**Files to modify:** dashboard.ts (convert 4 queries to Supabase calls)
**Expected savings:** ~5K-10K Convex reads/day eliminated
**Implementation:** Convex action → Supabase SQL → return to frontend

### Phase 2b — Domain aggregations + report generation
Migrate domains.ts getDomains/getPositionDistribution and domainReports.ts.

**Files to modify:** domains.ts, domainReports.ts, reports.ts
**Expected savings:** ~3K reads/day eliminated

### Phase 2c — Competitor analytical queries
Migrate all competitorKeywordPositions analytical reads.

**Files to modify:** queries/competitors.ts, competitors_queries.ts, competitorComparison_queries.ts, competitors.ts (read-only functions)
**Expected savings:** ~2K reads/day eliminated
**Note:** Resolve duplicate query files (queries/competitors.ts vs competitors_queries.ts)

### Phase 2d — Keyword history + group analytics
Migrate getPositionHistory, getKeywordWithHistory, group queries.

**Files to modify:** keywords.ts (3 functions), keywordGroups_queries.ts (3 functions)
**Expected savings:** ~1.5K reads/day eliminated

### Phase 2e — Cleanup duplicates
Many query files have near-identical functions (queries/competitors.ts vs competitors_queries.ts,
competitors.ts vs both). Consolidate to single source of truth in Supabase.

---

## 8. Architecture After Migration

```
┌────────────────────────────────────────────┐
│                 Frontend                    │
│                                            │
│  useQuery(api.keywords.*)  ──→ Convex      │  Real-time: denormalized fields
│  supabase.from('keyword_positions') ──→ SB │  Charts/reports: direct SQL
│  useQuery(api.dashboard.*)  ──→ Convex→SB  │  Aggregations via Convex action
└────────────────────────────────────────────┘

┌──────────────────────┐    ┌──────────────────────┐
│       Convex         │    │      Supabase        │
│                      │    │                      │
│  keywords table      │    │  keyword_positions   │
│  (denormalized:      │    │  (full history,      │
│   currentPosition,   │    │   partitioned by     │
│   recentPositions)   │    │   month)             │
│                      │    │                      │
│  Mutations:          │    │  competitor_keyword_  │
│  - storePosition     │◄──►│  positions           │
│  - deleteKeyword     │    │  (full history)      │
│  - repairs           │    │                      │
│                      │    │  SQL: JOINs, AVG,    │
│  Scheduler, Auth,    │    │  window functions,   │
│  Real-time subs      │    │  aggregations        │
└──────────────────────┘    └──────────────────────┘
         │                           │
         └─── Dual Write ────────────┘
              (already live)
```

---

## 9. Estimated Total Savings

| Phase | Reads eliminated/day | SQL queries added/day |
|-------|---------------------|----------------------|
| 2a Dashboard | ~5,000-10,000 | ~20 |
| 2b Domains/Reports | ~3,000 | ~15 |
| 2c Competitors | ~2,000 | ~30 |
| 2d History/Groups | ~1,500 | ~50 |
| **Total** | **~12,000-16,000** | **~115** |

This is a conservative estimate for a single user with ~200 keywords.
At SaaS scale with 100 tenants × 200 keywords, savings multiply to ~1M+ reads/day.
