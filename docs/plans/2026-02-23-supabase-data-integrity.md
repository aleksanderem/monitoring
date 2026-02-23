# Supabase Data Integrity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all gaps where position data fails to reach Supabase, add monitoring for every data path, ensure charts and stats show data.

**Architecture:** Supabase = source of truth for position/analytics data. Convex = auth, tenancy, business logic, real-time subs. Denormalized fields on keywords table are a cache. Every write path must dual-write. Every read path must have visibility.

**Tech Stack:** Convex (mutations/actions), Supabase (PostgreSQL), Vitest (testing)

---

### Task 1: Add Supabase dual-write to fetchSinglePositionInternal

**Files:**
- Modify: `convex/dataforseo.ts:58-233`
- Test: `convex/dataforseo.test.ts`

**Context:** This action is called for first-time keyword position checks. It calls `storePositionInternal` (Convex mutation) but never writes to Supabase. It doesn't receive `domainId` as an arg, so we need to look it up from the keyword record.

**Step 1: Write the failing test**

Add a test in `convex/dataforseo.test.ts` that verifies `writeKeywordPositions` is called when `fetchSinglePositionInternal` runs. Mock `writeKeywordPositions` and assert it was called with the correct row shape including `convex_domain_id`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dataforseo.test.ts -t "fetchSinglePositionInternal.*supabase" --reporter=verbose`
Expected: FAIL — writeKeywordPositions never called

**Step 3: Implement the dual-write**

In `fetchSinglePositionInternal` handler, after the `storePositionInternal` call at line 202-209:

1. Look up the keyword to get domainId:
```typescript
const keyword = await ctx.runQuery(internal.keywords.getKeywordInternal, { keywordId: args.keywordId });
const domainId = keyword?.domainId;
```

2. After line 209 (the storePositionInternal call), add:
```typescript
if (domainId) {
  writeKeywordPositions([{
    convex_domain_id: domainId,
    convex_keyword_id: args.keywordId,
    date: today,
    position,
    url: domainMatch?.url || null,
    search_volume: data.tasks[0].result[0].search_volume,
    difficulty,
  }]).catch((err) =>
    console.error(`[Supabase] fetchSinglePositionInternal write failed: keyword=${args.keywordId}:`, err.message)
  );
}
```

3. Same pattern for the dev-mode mock path (after line 77-84):
```typescript
if (domainId) {
  writeKeywordPositions([{
    convex_domain_id: domainId,
    convex_keyword_id: args.keywordId,
    date: today,
    position,
    url: position ? `https://${args.domain}/page-${Math.floor(Math.random() * 10)}` : null,
    search_volume: Math.floor(Math.random() * 10000),
  }]).catch((err) =>
    console.error(`[Supabase] fetchSinglePositionInternal mock write failed:`, err.message)
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run convex/dataforseo.test.ts -t "fetchSinglePositionInternal.*supabase" --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/dataforseo.ts convex/dataforseo.test.ts
git commit -m "fix: add Supabase dual-write to fetchSinglePositionInternal"
```

---

### Task 2: Add Supabase dual-write to fetchHistoricalPositionsInternal

**Files:**
- Modify: `convex/dataforseo.ts:838-994`
- Test: `convex/dataforseo.test.ts`

**Context:** This action fetches 6 months of historical positions for new keywords. It loops through dates calling `storePositionInternal` but never writes to Supabase. It also doesn't have `domainId` — only `keywordId`.

**Step 1: Write the failing test**

Test that `writeKeywordPositions` is called with a batch of historical rows after the processing loop completes.

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dataforseo.test.ts -t "fetchHistoricalPositionsInternal.*supabase" --reporter=verbose`
Expected: FAIL

**Step 3: Implement the dual-write**

In `fetchHistoricalPositionsInternal` handler:

1. At the top of the handler (after line 848), look up domainId:
```typescript
const keyword = await ctx.runQuery(internal.keywords.getKeywordInternal, { keywordId: args.keywordId });
const domainId = keyword?.domainId;
```

2. Create a buffer array before the processing loop:
```typescript
const supabaseBuffer: KeywordPositionRow[] = [];
```

3. Inside both the mock loop (line 879-893) and real loop (line 950-988), after each `storePositionInternal` call, push to buffer:
```typescript
if (domainId) {
  supabaseBuffer.push({
    convex_domain_id: domainId,
    convex_keyword_id: args.keywordId,
    date,
    position,
    url,
    search_volume: searchVolume,
  });
}
```

4. After the loop ends (before the final console.log), flush to Supabase:
```typescript
if (supabaseBuffer.length > 0) {
  writeKeywordPositions(supabaseBuffer).catch((err) =>
    console.error(`[Supabase] fetchHistoricalPositionsInternal write failed: ${supabaseBuffer.length} rows, keyword=${args.keywordId}:`, err.message)
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run convex/dataforseo.test.ts -t "fetchHistoricalPositionsInternal.*supabase" --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/dataforseo.ts convex/dataforseo.test.ts
git commit -m "fix: add Supabase dual-write to fetchHistoricalPositionsInternal"
```

---

### Task 3: Fix silent error swallowing on ALL Supabase writes

**Files:**
- Modify: `convex/dataforseo.ts` (line 667)
- Modify: `convex/keywordSerpJobs.ts` (line 439)
- Modify: `convex/lib/supabase.ts` (lines 62, 78)

**Context:** Supabase write failures are swallowed by `.catch(() => {})` or only `console.warn`. Must upgrade to `console.error` with context everywhere.

**Step 1: Fix dataforseo.ts line 667**

Change:
```typescript
writeKeywordPositions(supabaseRows).catch((err) =>
  console.warn("[Supabase dual-write] keyword positions failed:", err)
);
```
To:
```typescript
writeKeywordPositions(supabaseRows).catch((err) =>
  console.error(`[Supabase] fetchPositionsInternal dual-write failed: ${supabaseRows.length} rows, domain=${args.domainId}:`, err.message)
);
```

**Step 2: Fix keywordSerpJobs.ts line 439**

Find the `.catch(() => {})` after writeKeywordPositions and change to:
```typescript
.catch((err) =>
  console.error(`[Supabase] keywordSerpJobs write failed: keyword=${keyword._id}:`, err.message)
)
```

**Step 3: Upgrade supabase.ts helpers**

In `writeKeywordPositions` (line 62), change `console.warn` to `console.error` and add row count:
```typescript
console.error(`[Supabase] writeKeywordPositions failed (${rows.length} rows):`, error.message);
```

Same for `writeCompetitorPositions` (line 78).

**Step 4: Commit**

```bash
git add convex/dataforseo.ts convex/keywordSerpJobs.ts convex/lib/supabase.ts
git commit -m "fix: upgrade Supabase write error logging from warn/silent to error with context"
```

---

### Task 4: Add discoveredKeywords fallback to getPositionDistribution and getMonitoringStats

**Files:**
- Modify: `convex/keywords.ts:110-146` (getPositionDistribution)
- Modify: `convex/keywords.ts:283-357` (getMonitoringStats)
- Test: `convex/keywords.test.ts`

**Context:** These functions read `keyword.currentPosition` and skip if null. The table (getKeywordMonitoring) falls back to `discoveredKeywords.bestPosition` when denormalized field is null. These functions need the same fallback so charts/stats aren't empty.

**Step 1: Write failing test for getPositionDistribution**

Create test where keywords have `currentPosition: undefined` but corresponding `discoveredKeywords` records have `bestPosition` set. Assert the distribution returns non-zero counts.

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/keywords.test.ts -t "getPositionDistribution.*fallback" --reporter=verbose`
Expected: FAIL — all distribution buckets are 0

**Step 3: Implement fallback in getPositionDistribution**

After fetching keywords (line 121), add discoveredKeywords batch fetch:
```typescript
const allDiscovered = await ctx.db
  .query("discoveredKeywords")
  .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
  .collect();
const discoveredMap = new Map<string, typeof allDiscovered[0]>();
for (const dk of allDiscovered) {
  discoveredMap.set(dk.keyword, dk);
}
```

Change line 133 from:
```typescript
const pos = keyword.currentPosition;
```
To:
```typescript
const discovered = discoveredMap.get(keyword.phrase);
const pos = keyword.currentPosition ??
  (discovered?.bestPosition && discovered.bestPosition !== 999
    ? discovered.bestPosition
    : null);
```

**Step 4: Same pattern for getMonitoringStats**

After fetching keywords (line 294), add the same discoveredKeywords batch fetch.

Change line 308 from:
```typescript
const currentPos = keyword.currentPosition;
```
To:
```typescript
const discovered = discoveredMap.get(keyword.phrase);
const currentPos = keyword.currentPosition ??
  (discovered?.bestPosition && discovered.bestPosition !== 999
    ? discovered.bestPosition
    : null);
```

**Step 5: Run tests**

Run: `npx vitest run convex/keywords.test.ts -t "getPositionDistribution|getMonitoringStats" --reporter=verbose`
Expected: PASS

**Step 6: Commit**

```bash
git add convex/keywords.ts convex/keywords.test.ts
git commit -m "fix: add discoveredKeywords fallback to getPositionDistribution and getMonitoringStats"
```

---

### Task 5: Run Convex → Supabase backfill

**Files:**
- Existing: `convex/backfillSupabase.ts`

**Context:** The backfill action already exists. It reads all `keywordPositions` from Convex and writes them to Supabase in batches of 500.

**Step 1: Run the backfill**

```bash
npx convex run --typecheck=disable backfillSupabase:backfillKeywordPositions '{}'
```

Expected: Output showing rows synced per domain.

**Step 2: Verify counts match**

Query Supabase to count rows:
```bash
curl -s "https://slamuolwnpopvdbmjeye.supabase.co/rest/v1/keyword_positions?select=date" \
  -H "apikey: <key>" -H "Prefer: count=exact" -D /dev/stderr -o /dev/null 2>&1 | grep content-range
```

Compare with Convex keywordPositions count. They should be within 5% of each other.

**Step 3: Commit any fixes needed**

```bash
git commit -m "chore: run Supabase backfill — sync Convex keywordPositions to Supabase"
```

---

### Task 6: Add cron_executions monitoring table to Supabase

**Files:**
- Create: `supabase/migrations/003_cron_monitoring.sql`

**Step 1: Write the migration**

```sql
-- Cron execution monitoring
CREATE TABLE cron_executions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name text NOT NULL,
  domain_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  keywords_processed int DEFAULT 0,
  keywords_failed int DEFAULT 0,
  supabase_rows_written int DEFAULT 0,
  error_message text,
  duration_ms int
);

CREATE INDEX idx_cron_exec_job_date ON cron_executions (job_name, started_at DESC);
CREATE INDEX idx_cron_exec_status ON cron_executions (status) WHERE status != 'success';
```

**Step 2: Run migration in Supabase SQL Editor or via CLI**

**Step 3: Commit**

```bash
git add supabase/migrations/003_cron_monitoring.sql
git commit -m "feat: add cron_executions monitoring table to Supabase"
```

---

### Task 7: Add Supabase monitoring helpers

**Files:**
- Modify: `convex/lib/supabase.ts`
- Test: verify helpers compile

**Context:** Add helper functions for logging cron executions and tracking Supabase query performance.

**Step 1: Add cron execution logger to supabase.ts**

```typescript
export async function logCronStart(
  jobName: string,
  domainId?: string
): Promise<number | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("cron_executions")
    .insert({ job_name: jobName, domain_id: domainId, status: "running" })
    .select("id")
    .single();
  if (error) {
    console.error(`[Supabase] logCronStart failed:`, error.message);
    return null;
  }
  return data.id;
}

export async function logCronEnd(
  execId: number | null,
  status: "success" | "failed" | "timeout",
  metrics?: {
    keywordsProcessed?: number;
    keywordsFailed?: number;
    supabaseRowsWritten?: number;
    errorMessage?: string;
  }
): Promise<void> {
  if (!execId) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const startRow = await sb.from("cron_executions").select("started_at").eq("id", execId).single();
  const durationMs = startRow.data
    ? Date.now() - new Date(startRow.data.started_at).getTime()
    : null;
  await sb.from("cron_executions").update({
    status,
    finished_at: new Date().toISOString(),
    duration_ms: durationMs,
    keywords_processed: metrics?.keywordsProcessed ?? 0,
    keywords_failed: metrics?.keywordsFailed ?? 0,
    supabase_rows_written: metrics?.supabaseRowsWritten ?? 0,
    error_message: metrics?.errorMessage,
  }).eq("id", execId);
}
```

**Step 2: Add tracked query wrapper**

```typescript
export async function trackedSupabaseQuery<T>(
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
  } catch (err: any) {
    console.error(`[Supabase:error] ${name} failed for domain=${domainId}:`, err.message);
    throw err;
  }
}
```

**Step 3: Commit**

```bash
git add convex/lib/supabase.ts
git commit -m "feat: add cron monitoring and query tracking helpers to Supabase lib"
```

---

### Task 8: Wire cron monitoring + rate limiting into scheduler

**Files:**
- Modify: `convex/scheduler.ts:82-111`
- Test: `convex/scheduler.test.ts`

**Context:** The `refreshDomains` function loops all domains in a tight loop. Add stagger delay between domains and log execution to cron_executions.

**Step 1: Write failing test**

Test that refreshDomains processes domains with a delay between them and logs start/end to Supabase.

**Step 2: Implement rate-limited refresh**

Replace `refreshDomains` (lines 82-111):

```typescript
async function refreshDomains(
  ctx: any,
  domains: Doc<"domains">[],
  label: string,
): Promise<{ refreshed: number; failed: number }> {
  console.log(`[scheduler] Refreshing ${domains.length} ${label} domains`);
  let failed = 0;

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const execId = await logCronStart(`${label}-keyword-refresh`, domain._id);

    try {
      const keywords = await ctx.runQuery(internal.scheduler.getDomainKeywords, {
        domainId: domain._id,
      });

      if (keywords.length > 0) {
        await ctx.runAction(internal.dataforseo.fetchPositionsInternal, {
          domainId: domain._id,
          keywords: keywords.map((k: Doc<"keywords">) => ({ id: k._id, phrase: k.phrase })),
          domain: domain.domain,
          searchEngine: domain.settings.searchEngine,
          location: domain.settings.location,
          language: domain.settings.language,
        });
      }

      await logCronEnd(execId, "success", { keywordsProcessed: keywords.length });
    } catch (error: any) {
      failed++;
      console.error(`[scheduler] Failed to refresh domain ${domain.domain}:`, error);
      await logCronEnd(execId, "failed", { errorMessage: error.message });
    }

    // Stagger: 2s between domains to avoid thundering herd
    if (i < domains.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { refreshed: domains.length - failed, failed };
}
```

Add import at top of scheduler.ts:
```typescript
import { logCronStart, logCronEnd } from "./lib/supabase";
```

**Step 3: Run tests**

Run: `npx vitest run convex/scheduler.test.ts --reporter=verbose`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/scheduler.ts convex/scheduler.test.ts
git commit -m "feat: add rate limiting (2s stagger) and cron monitoring to scheduler"
```

---

### Task 9: Add weekly health check — Convex vs Supabase consistency

**Files:**
- Modify: `convex/keywords.ts` (add healthCheckConsistency action)
- Modify: `convex/crons.ts` (add weekly trigger)

**Step 1: Add health check action**

In `convex/keywords.ts`, add an internal action:

```typescript
export const healthCheckConsistency = internalAction({
  handler: async (ctx) => {
    const sb = getSupabaseAdmin();
    if (!sb) {
      console.error("[healthCheck] Supabase not configured");
      return;
    }

    const domains = await ctx.runQuery(internal.keywords.listAllDomainIds);

    for (const domain of domains) {
      // Count in Convex
      const convexKeywords = await ctx.runQuery(internal.keywords.getDomainKeywordsWithPositionData, {
        domainId: domain._id,
      });
      const convexWithPosition = convexKeywords.filter((k: any) => k.currentPosition != null).length;

      // Count in Supabase
      const { count, error } = await sb
        .from("keyword_positions")
        .select("*", { count: "exact", head: true })
        .eq("convex_domain_id", domain._id)
        .not("position", "is", null);

      const supabaseCount = count ?? 0;

      // Log drift
      const drift = Math.abs(convexWithPosition - supabaseCount);
      const driftPct = convexWithPosition > 0
        ? Math.round((drift / convexWithPosition) * 100)
        : (supabaseCount > 0 ? 100 : 0);

      if (driftPct > 10) {
        console.error(
          `[healthCheck] DRIFT domain=${domain.domain}: convex=${convexWithPosition} vs supabase=${supabaseCount} (${driftPct}% drift)`
        );
      } else {
        console.log(
          `[healthCheck] OK domain=${domain.domain}: convex=${convexWithPosition}, supabase=${supabaseCount}`
        );
      }
    }
  },
});
```

**Step 2: Add weekly cron trigger**

In `convex/crons.ts`, add:
```typescript
crons.weekly(
  "health-check-data-consistency",
  { dayOfWeek: "sunday", hourUTC: 5, minuteUTC: 30 },
  internal.keywords.healthCheckConsistency
);
```

**Step 3: Commit**

```bash
git add convex/keywords.ts convex/crons.ts
git commit -m "feat: add weekly Convex vs Supabase consistency health check"
```

---

### Task 10: Verify everything works end-to-end

**Step 1: Run all tests**

```bash
npx vitest run --reporter=verbose
```
Expected: ALL PASS

**Step 2: Build check**

```bash
npx next build
```
Expected: Build succeeds

**Step 3: Deploy and verify**

```bash
npx convex dev --typecheck=disable
```

Open the monitoring page in browser. Charts should now show data from the discoveredKeywords fallback. After the next cron cycle (or manual position check), Supabase data will be complete and charts reading from Supabase will populate.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Supabase data integrity fixes — dual-write, monitoring, fallbacks"
```
