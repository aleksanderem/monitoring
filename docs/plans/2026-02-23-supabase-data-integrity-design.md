# Supabase Data Integrity — Design Document

Date: 2026-02-23

## Problem Statement

Three interconnected bugs cause empty charts, missing stats, and incomplete Supabase data:

1. Two write paths (fetchSinglePositionInternal, fetchHistoricalPositionsInternal) skip Supabase dual-write entirely — keywords checked through these paths never appear in Supabase
2. Functions reading denormalized fields (getPositionDistribution, getMonitoringStats, etc.) have no fallback when those fields are null — charts show empty while the table (which has a fallback) shows data
3. Supabase write errors are silently swallowed — no visibility into failures

## Architecture Principle

Supabase = source of truth for all position/analytics data.
Convex = auth, tenancy, business logic, real-time subscriptions.

Denormalized fields on keywords table (currentPosition, recentPositions, etc.) are a CACHE of Supabase data, kept for real-time Convex query performance. They must never be the only copy.

## Fix 1: Complete Dual-Write Coverage

Every path that stores a keyword position must write to Supabase.

### Paths to fix:

1. `dataforseo.ts: fetchSinglePositionInternal` — called for first-time keyword checks. After calling storePositionInternal, must also call writeKeywordPositions with the same data. Needs domainId passed through (check if available from keyword lookup).

2. `dataforseo.ts: fetchHistoricalPositionsInternal` — called to backfill 6 months of history for new keywords. Stores positions in a loop via storePositionInternal but never writes to Supabase. Must accumulate rows in a buffer and batch-write to Supabase at the end.

3. Any other storePositionInternal caller — audit all callers of this mutation. The mutation itself can't call Supabase (mutations can't do HTTP), so the calling ACTION must handle the Supabase write.

### Implementation:

Both functions are already actions (can do HTTP). Add writeKeywordPositions calls after position storage. Buffer rows and batch-write at end of processing loop for efficiency.

## Fix 2: Error Visibility

Replace all `.catch(() => {})` and `.catch(err => console.warn(...))` on Supabase writes with proper error logging that includes:
- Function name
- Number of rows attempted
- Error message
- Domain ID for context

Pattern:
```typescript
writeKeywordPositions(rows).catch((err) =>
  console.error(`[Supabase] writeKeywordPositions failed in ${functionName}: ${rows.length} rows, domain=${domainId}:`, err.message)
);
```

## Fix 3: Backfill Existing Data

Run the existing `backfillSupabase.ts` to sync all Convex keywordPositions data to Supabase. This is a one-time operation. The backfill already exists and handles batching.

After backfill, verify row counts match between Convex keywordPositions and Supabase keyword_positions.

## Fix 4: Denormalized Field Fallback (Safety Net)

Even with complete dual-write, denormalized fields can drift. Functions that read them need a safety net.

Two approaches, NOT mutually exclusive:

A. Add discoveredKeywords fallback to getPositionDistribution and getMonitoringStats (matches what getKeywordMonitoring already does). This is a Convex query — fast, real-time.

B. For functions that already read from Supabase (getMovementTrendSupabase, dashboard actions), ensure they work correctly when Supabase has data but denormalized fields don't.

Implement A for the critical monitoring page functions. B is already handled by the Supabase actions.

## Fix 5: Cron Monitoring and Rate Limiting

### Current problem:
Crons fire at fixed times for ALL domains simultaneously. With dozens of domains, this can:
- Hit DataForSEO rate limits
- Cause Convex function timeouts
- Create thundering herd on Supabase writes

### Design:

Add a `cron_executions` table in Supabase for monitoring:
```sql
CREATE TABLE cron_executions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name text NOT NULL,
  domain_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running, success, failed, timeout
  keywords_processed int DEFAULT 0,
  keywords_failed int DEFAULT 0,
  supabase_rows_written int DEFAULT 0,
  error_message text,
  duration_ms int
);

CREATE INDEX idx_cron_exec_job_date ON cron_executions (job_name, started_at DESC);
CREATE INDEX idx_cron_exec_status ON cron_executions (status) WHERE status != 'success';
```

### Rate limiting in scheduler:

Instead of processing all domains in a tight loop, add delay between domains:

```typescript
for (const domain of domains) {
  const execId = await logCronStart(ctx, "daily-keyword-refresh", domain._id);
  try {
    const result = await processDomain(ctx, domain);
    await logCronEnd(ctx, execId, "success", result);
  } catch (error) {
    await logCronEnd(ctx, execId, "failed", { error: error.message });
  }
  // Stagger: wait 2s between domains to avoid thundering herd
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### Per-query monitoring:

Add a lightweight helper that logs every Supabase read/write with timing:

```typescript
async function trackedSupabaseQuery<T>(
  name: string,
  domainId: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    if (ms > 2000) {
      console.warn(`[Supabase:slow] ${name} took ${ms}ms for domain=${domainId}`);
    }
    return result;
  } catch (err) {
    console.error(`[Supabase:error] ${name} failed for domain=${domainId}:`, err);
    throw err;
  }
}
```

## Fix 6: Health Check — Convex vs Supabase Consistency

Add an internal action that compares counts:

```typescript
// For each domain:
// 1. Count keywords in Convex
// 2. Count distinct convex_keyword_id in Supabase keyword_positions
// 3. Count keywords with currentPosition != null in Convex
// 4. Count distinct convex_keyword_id with position != null in Supabase
// 5. Flag mismatches > 10%
```

Run this weekly via cron. Log results to cron_executions table. Alert if drift exceeds threshold.

## Implementation Order

1. Fix dual-write gaps (fetchSinglePositionInternal, fetchHistoricalPositionsInternal)
2. Fix error logging on all Supabase writes
3. Run backfill to sync existing data
4. Add discoveredKeywords fallback to getPositionDistribution and getMonitoringStats
5. Add cron_executions table and monitoring
6. Add rate limiting to scheduler
7. Add health check action
8. Add per-query Supabase tracking wrapper

## Testing Strategy

For each fix:
- Unit test: mock Supabase, verify writeKeywordPositions is called with correct data
- Integration test: verify Supabase row counts after position check
- Manual verification: check charts show data after backfill
- Monitoring: check cron_executions table for failures after deployment

## Success Criteria

- All charts show position data (not empty)
- Supabase keyword_positions row count matches Convex keywordPositions count (within 5%)
- Every cron execution logged with duration and success/failure
- No silent Supabase write failures (all logged)
- Scheduler processes domains with 2s stagger (no thundering herd)
