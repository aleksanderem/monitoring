"use node";

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getSupabaseAdmin } from "../lib/supabase";

// ─── Auth helper ────────────────────────────────────────────────────

async function requireDomainAccess(ctx: any, domainId: string) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const domain = await ctx.runQuery(internal.gsc.getDomainOrgId, { domainId, userId });
  if (!domain) throw new Error("Domain not found or access denied");
  return domain;
}

// ─── Quick Wins: pages on page 2 with decent impressions ────────────

/**
 * Find SEO quick wins — queries ranking on page 2 of Google (positions 8-20)
 * that have substantial impressions. Pushing these to page 1 could yield
 * significant traffic gains with minimal effort.
 */
export const getQuickWins = action({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    minImpressions: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit = 50, minImpressions = 50 }) => {
    await requireDomainAccess(ctx, domainId);
    return fetchQuickWins(domainId, limit, minImpressions);
  },
});

export const getQuickWinsInternal = internalAction({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
    minImpressions: v.optional(v.number()),
  },
  handler: async (_ctx, { domainId, limit = 50, minImpressions = 50 }) => {
    return fetchQuickWins(domainId, limit, minImpressions);
  },
});

async function fetchQuickWins(domainId: string, limit: number, minImpressions: number) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("gsc_performance")
    .select("query, page, clicks, impressions, ctr, position")
    .eq("convex_domain_id", domainId)
    .gte("date", new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    .not("query", "is", null)
    .gte("impressions", minImpressions)
    .gte("position", 8)
    .lte("position", 20)
    .order("impressions", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`getQuickWins failed:`, error.message);
    return [];
  }

  return data ?? [];
}

// ─── Cannibalization: multiple pages ranking for same query ─────────

/**
 * Detect keyword cannibalization — queries where multiple pages from the same
 * domain rank, splitting impressions and confusing Google's ranking signals.
 */
export const getCannibalization = action({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit = 50 }) => {
    await requireDomainAccess(ctx, domainId);
    return fetchCannibalization(domainId, limit);
  },
});

export const getCannibalizationInternal = internalAction({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, { domainId, limit = 50 }) => {
    return fetchCannibalization(domainId, limit);
  },
});

async function fetchCannibalization(domainId: string, limit: number) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("v_cannibalization")
    .select("*")
    .eq("convex_domain_id", domainId)
    .order("total_impressions", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`getCannibalization failed:`, error.message);
    return [];
  }

  return data ?? [];
}

// ─── Content Decay: pages losing traffic over time ──────────────────

/**
 * Detect content decay — pages that lost 30%+ clicks compared to the
 * previous period. These need content refresh or link building.
 */
export const getContentDecay = action({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit = 50 }) => {
    await requireDomainAccess(ctx, domainId);
    return fetchContentDecay(domainId, limit);
  },
});

/**
 * Internal version of getContentDecay for use by alert evaluators
 * (no auth check — only called from internal actions).
 */
export const getContentDecayInternal = internalAction({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, { domainId, limit = 50 }) => {
    return fetchContentDecay(domainId, limit);
  },
});

async function fetchContentDecay(domainId: string, limit: number) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("v_content_decay")
    .select("*")
    .eq("convex_domain_id", domainId)
    .order("click_change", { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`getContentDecay failed:`, error.message);
    return [];
  }

  return data ?? [];
}

// ─── Indexation Health: URL inspection summary ──────────────────────

/**
 * Get indexation health report — summary of URL inspection results
 * showing how many pages are indexed, blocked, or have errors.
 */
export const getIndexationHealth = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, { domainId }) => {
    await requireDomainAccess(ctx, domainId);
    return fetchIndexationHealth(domainId);
  },
});

export const getIndexationHealthInternal = internalAction({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (_ctx, { domainId }) => {
    return fetchIndexationHealth(domainId);
  },
});

async function fetchIndexationHealth(domainId: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from("url_inspections")
    .select("url, indexing_state, coverage_state, mobile_usability, rich_results_valid, rich_results_errors")
    .eq("convex_domain_id", domainId);

  if (error) {
    console.error(`getIndexationHealth failed:`, error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const total = data.length;
  const indexed = data.filter((r) => r.indexing_state === "INDEXING_ALLOWED").length;
  const blocked = data.filter((r) => r.indexing_state && r.indexing_state !== "INDEXING_ALLOWED").length;
  const mobileFriendly = data.filter((r) => r.mobile_usability === "PASS").length;
  const richResultsCount = data.reduce((sum, r) => sum + (r.rich_results_valid ?? 0), 0);
  const richErrorsCount = data.reduce((sum, r) => sum + (r.rich_results_errors ?? 0), 0);

  return {
    total,
    indexed,
    blocked,
    mobileFriendly,
    notMobileFriendly: total - mobileFriendly,
    richResultsCount,
    richErrorsCount,
    blockedUrls: data
      .filter((r) => r.indexing_state && r.indexing_state !== "INDEXING_ALLOWED")
      .map((r) => ({
        url: r.url,
        state: r.indexing_state,
        coverage: r.coverage_state,
      })),
  };
}

// ─── Search Appearance breakdown ────────────────────────────────────

/**
 * Get search appearance breakdown — how often the domain's content appears
 * as rich results, videos, FAQs, etc. in search results.
 */
export const getSearchAppearanceBreakdown = action({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, days = 28 }) => {
    await requireDomainAccess(ctx, domainId);
    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await sb
      .from("gsc_performance")
      .select("search_appearance, clicks, impressions")
      .eq("convex_domain_id", domainId)
      .gte("date", startDate)
      .not("search_appearance", "is", null);

    if (error) {
      console.error(`getSearchAppearanceBreakdown failed:`, error.message);
      return [];
    }

    // Aggregate by search appearance type
    const map = new Map<string, { clicks: number; impressions: number }>();
    for (const row of data ?? []) {
      for (const appearance of row.search_appearance ?? []) {
        const existing = map.get(appearance) ?? { clicks: 0, impressions: 0 };
        existing.clicks += row.clicks ?? 0;
        existing.impressions += row.impressions ?? 0;
        map.set(appearance, existing);
      }
    }

    return Array.from(map.entries())
      .map(([appearance, stats]) => ({
        appearance,
        clicks: stats.clicks,
        impressions: stats.impressions,
      }))
      .sort((a, b) => b.impressions - a.impressions);
  },
});

// ─── Search Type traffic comparison ─────────────────────────────────

/**
 * Compare traffic across search types (web, image, video, news, discover).
 * Helps identify untapped traffic channels.
 */
export const getSearchTypeComparison = action({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, days = 28 }) => {
    await requireDomainAccess(ctx, domainId);
    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await sb
      .from("gsc_performance")
      .select("search_type, clicks, impressions")
      .eq("convex_domain_id", domainId)
      .gte("date", startDate);

    if (error) {
      console.error(`getSearchTypeComparison failed:`, error.message);
      return [];
    }

    // Aggregate by search type
    const map = new Map<string, { clicks: number; impressions: number }>();
    for (const row of data ?? []) {
      const type = row.search_type ?? "web";
      const existing = map.get(type) ?? { clicks: 0, impressions: 0 };
      existing.clicks += row.clicks ?? 0;
      existing.impressions += row.impressions ?? 0;
      map.set(type, existing);
    }

    return Array.from(map.entries())
      .map(([searchType, stats]) => ({
        searchType,
        clicks: stats.clicks,
        impressions: stats.impressions,
        ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);
  },
});

// ─── Crawl Budget Waste: pages consuming budget without value ────────

/**
 * Identify URLs that waste crawl budget — blocked but crawled, zero-value,
 * or redirect targets. Cross-references URL Inspection data with performance.
 */
export const getCrawlBudgetWaste = action({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit = 100 }) => {
    await requireDomainAccess(ctx, domainId);
    return fetchCrawlBudgetWaste(domainId, limit);
  },
});

export const getCrawlBudgetWasteInternal = internalAction({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, { domainId, limit = 100 }) => {
    return fetchCrawlBudgetWaste(domainId, limit);
  },
});

async function fetchCrawlBudgetWaste(domainId: string, limit: number) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("v_crawl_budget_waste")
    .select("*")
    .eq("convex_domain_id", domainId)
    .limit(limit);

  if (error) {
    console.error(`getCrawlBudgetWaste failed:`, error.message);
    return [];
  }

  return data ?? [];
}

// ─── Zero-Click Queries: high impressions, low CTR at top positions ──

/**
 * Find zero-click queries — ranking in positions 1-3 with high impressions
 * but very low CTR (<3%). Google likely answers these directly in SERP features.
 */
export const getZeroClickQueries = action({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit = 50 }) => {
    await requireDomainAccess(ctx, domainId);
    return fetchZeroClickQueries(domainId, limit);
  },
});

export const getZeroClickQueriesInternal = internalAction({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, { domainId, limit = 50 }) => {
    return fetchZeroClickQueries(domainId, limit);
  },
});

async function fetchZeroClickQueries(domainId: string, limit: number) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("v_zero_click_queries")
    .select("*")
    .eq("convex_domain_id", domainId)
    .limit(limit);

  if (error) {
    console.error(`getZeroClickQueries failed:`, error.message);
    return [];
  }

  return data ?? [];
}
