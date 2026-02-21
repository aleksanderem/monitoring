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

// ─── Write helpers ─────────────────────────────────────────

/**
 * Upsert keyword positions to Supabase.
 * Uses ON CONFLICT (convex_keyword_id, date) DO UPDATE for idempotency.
 * Silently skips if Supabase is not configured.
 */
export async function writeKeywordPositions(rows: KeywordPositionRow[]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || rows.length === 0) return;

  const { error } = await sb
    .from("keyword_positions")
    .upsert(rows, { onConflict: "convex_keyword_id,date" });

  if (error) {
    console.warn("[Supabase] Failed to write keyword positions:", error.message);
  }
}

/**
 * Upsert competitor keyword positions to Supabase.
 */
export async function writeCompetitorPositions(rows: CompetitorPositionRow[]): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || rows.length === 0) return;

  const { error } = await sb
    .from("competitor_keyword_positions")
    .upsert(rows, { onConflict: "convex_competitor_id,convex_keyword_id,date" });

  if (error) {
    console.warn("[Supabase] Failed to write competitor positions:", error.message);
  }
}
