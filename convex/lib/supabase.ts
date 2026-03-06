import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Get Supabase admin client for use in Convex actions.
 * Uses service role key (bypasses RLS) for writing analytical data.
 * Returns null if env vars are not configured (graceful degradation).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

// ─── Types ─────────────────────────────────────────────────

export interface KeywordPositionRow {
  convex_domain_id: string;
  convex_keyword_id: string;
  date: string; // YYYY-MM-DD
  position: number | null;
  url: string | null;
  search_volume?: number | null;
  difficulty?: number | null;
  cpc?: number | null;
}

export interface CompetitorPositionRow {
  convex_competitor_id: string;
  convex_keyword_id: string;
  date: string;
  position: number | null;
  url: string | null;
}

export interface GscPerformanceRow {
  convex_domain_id: string;
  date: string;
  query: string | null;
  page: string | null;
  device: string | null;
  country: string | null;
  search_type: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface UrlInspectionRow {
  convex_domain_id: string;
  url: string;
  indexing_state: string | null;
  coverage_state: string | null;
  robots_txt_state: string | null;
  last_crawl_time: string | null;
  crawled_as: string | null;
  google_canonical: string | null;
  user_canonical: string | null;
  mobile_usability: string | null;
  rich_results_valid: number;
  rich_results_errors: number;
}

// ─── Retry helper ─────────────────────────────────────────

/**
 * Retry an async function with exponential backoff.
 * Delays: 200ms, 400ms, 800ms (doubles each attempt).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = 200 * Math.pow(2, attempt - 1);
        console.warn(`[Supabase] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

// ─── Write helpers ─────────────────────────────────────────

/**
 * Upsert keyword positions to Supabase with retry (3 attempts, exponential backoff).
 * Uses ON CONFLICT (convex_keyword_id, date) DO UPDATE for idempotency.
 * Silently skips if Supabase is not configured.
 */
export async function writeKeywordPositions(rows: KeywordPositionRow[]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || rows.length === 0) return;

  await withRetry(async () => {
    const { error } = await sb
      .from("keyword_positions")
      .upsert(rows, { onConflict: "convex_keyword_id,date" });

    if (error) {
      throw new Error(`writeKeywordPositions failed (${rows.length} rows): ${error.message}`);
    }
  }, `writeKeywordPositions(${rows.length} rows)`);
}

/**
 * Upsert competitor keyword positions to Supabase with retry.
 */
export async function writeCompetitorPositions(rows: CompetitorPositionRow[]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || rows.length === 0) return;

  await withRetry(async () => {
    const { error } = await sb
      .from("competitor_keyword_positions")
      .upsert(rows, { onConflict: "convex_competitor_id,convex_keyword_id,date" });

    if (error) {
      throw new Error(`writeCompetitorPositions failed (${rows.length} rows): ${error.message}`);
    }
  }, `writeCompetitorPositions(${rows.length} rows)`);
}

/**
 * Upsert GSC performance data to Supabase with retry.
 * Batches in chunks of 500 to avoid payload limits.
 */
export async function writeGscPerformance(rows: GscPerformanceRow[]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || rows.length === 0) return;

  // Batch in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await withRetry(async () => {
      const { error } = await sb
        .from("gsc_performance")
        .upsert(chunk, { onConflict: "convex_domain_id,date,query,page,device,country,search_type" });

      if (error) {
        throw new Error(`writeGscPerformance failed (${chunk.length} rows): ${error.message}`);
      }
    }, `writeGscPerformance(${chunk.length} rows, batch ${Math.floor(i / 500) + 1})`);
  }
}

/**
 * Upsert URL inspection results to Supabase with retry.
 */
export async function writeUrlInspections(rows: UrlInspectionRow[]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || rows.length === 0) return;

  await withRetry(async () => {
    const { error } = await sb
      .from("url_inspections")
      .upsert(rows, { onConflict: "convex_domain_id,url" });

    if (error) {
      throw new Error(`writeUrlInspections failed (${rows.length} rows): ${error.message}`);
    }
  }, `writeUrlInspections(${rows.length} rows)`);
}

// ─── Monitoring helpers ───────────────────────────────────

/**
 * Log the start of a cron execution to Supabase for observability.
 * Returns the execution ID for later completion logging, or null if Supabase is unavailable.
 */
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

/**
 * Log the end of a cron execution with status and optional metrics.
 * Computes duration_ms from the original started_at timestamp.
 */
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

/**
 * Wrap a Supabase query with timing and error logging.
 * Warns on queries taking longer than 2 seconds.
 */
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
