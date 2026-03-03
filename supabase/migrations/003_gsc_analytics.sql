-- Phase 3: GSC Analytics — Search Console performance data, URL inspections, page metadata
-- Run this in Supabase SQL Editor

-- =============================================================
-- gsc_performance: core GSC Search Analytics data (partitioned by month)
-- Stores per-query per-page per-date rows from the Search Analytics API.
-- GSC retains 16 months of history, so partitions go back 16 months.
-- =============================================================
CREATE TABLE gsc_performance (
  id bigint GENERATED ALWAYS AS IDENTITY,
  convex_domain_id text NOT NULL,
  date date NOT NULL,
  query text,                    -- search query (nullable for page-only rows)
  page text,                     -- URL (nullable for query-only rows)
  device text,                   -- MOBILE, DESKTOP, TABLET
  country text,                  -- 3-letter country code
  search_type text DEFAULT 'web', -- web, image, video, news, discover
  search_appearance text[],      -- e.g. {'RICH_RESULT','VIDEO'}
  clicks integer DEFAULT 0,
  impressions integer DEFAULT 0,
  ctr numeric(7,6),              -- e.g. 0.123456
  position numeric(6,2),         -- e.g. 12.50
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, date),
  UNIQUE (convex_domain_id, date, query, page, device, country, search_type)
) PARTITION BY RANGE (date);

-- Create monthly partitions: 16 months back + 2 months forward
-- GSC has 16 months of history that will be backfilled
DO $$
DECLARE
  start_date date := date_trunc('month', CURRENT_DATE) - interval '16 months';
  end_date date := date_trunc('month', CURRENT_DATE) + interval '2 months';
  partition_date date;
  partition_name text;
  next_date date;
BEGIN
  partition_date := start_date;
  WHILE partition_date <= end_date LOOP
    next_date := partition_date + '1 month'::interval;
    partition_name := 'gsc_performance_' || to_char(partition_date, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF gsc_performance
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, partition_date, next_date
    );

    partition_date := next_date;
  END LOOP;
END $$;

-- Primary query pattern: domain performance over time
CREATE INDEX idx_gsc_perf_domain_date
  ON gsc_performance (convex_domain_id, date DESC);

-- Query-level lookups (only rows that have a query)
CREATE INDEX idx_gsc_perf_query
  ON gsc_performance (query, date DESC) WHERE query IS NOT NULL;

-- Page-level lookups (only rows that have a page)
CREATE INDEX idx_gsc_perf_page
  ON gsc_performance (page, date DESC) WHERE page IS NOT NULL;

-- =============================================================
-- url_inspections: Google URL Inspection API results
-- NOT partitioned — small table, one row per URL per domain
-- =============================================================
CREATE TABLE url_inspections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  convex_domain_id text NOT NULL,
  url text NOT NULL,
  indexing_state text,           -- INDEXING_ALLOWED, BLOCKED_BY_META_TAG, etc.
  coverage_state text,           -- Submitted and indexed, Discovered - not indexed, etc.
  robots_txt_state text,         -- ALLOWED, DISALLOWED
  last_crawl_time timestamptz,
  crawled_as text,               -- DESKTOP, MOBILE
  google_canonical text,
  user_canonical text,
  mobile_usability text,         -- MOBILE_FRIENDLY, NOT_MOBILE_FRIENDLY
  rich_results_valid integer DEFAULT 0,
  rich_results_errors integer DEFAULT 0,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convex_domain_id, url)
);

-- Domain-level lookups
CREATE INDEX idx_url_insp_domain
  ON url_inspections (convex_domain_id);

-- Find pages with indexing problems
CREATE INDEX idx_url_insp_state
  ON url_inspections (indexing_state) WHERE indexing_state != 'INDEXING_ALLOWED';

-- =============================================================
-- page_metadata: business context for LLM enrichment
-- Stores editorial annotations, priority scores, and AI summaries
-- =============================================================
CREATE TABLE page_metadata (
  convex_domain_id text NOT NULL,
  url text NOT NULL,
  page_type text,                -- product, category, blog, landing
  priority_score integer DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),
  target_keywords text[],
  ai_analysis_summary text,
  last_content_update timestamptz,
  PRIMARY KEY (convex_domain_id, url)
);

-- =============================================================
-- Views: pre-built analytical queries for common SEO insights
-- =============================================================

-- v_seo_quick_wins: pages on page 2 of Google with decent impressions (last 28 days)
CREATE VIEW v_seo_quick_wins AS
SELECT p.convex_domain_id, p.query, p.page,
       SUM(p.clicks) as total_clicks, SUM(p.impressions) as total_impressions,
       AVG(p.position) as avg_position,
       CASE WHEN SUM(p.impressions) > 0 THEN SUM(p.clicks)::numeric / SUM(p.impressions) ELSE 0 END as calc_ctr
FROM gsc_performance p
WHERE p.date >= CURRENT_DATE - 28
  AND p.query IS NOT NULL
GROUP BY p.convex_domain_id, p.query, p.page
HAVING AVG(p.position) BETWEEN 8 AND 20
   AND SUM(p.impressions) > 50
ORDER BY SUM(p.impressions) DESC;

-- v_cannibalization: multiple pages ranking for the same query
CREATE VIEW v_cannibalization AS
SELECT convex_domain_id, query, COUNT(DISTINCT page) as page_count,
       array_agg(DISTINCT page) as competing_pages,
       SUM(clicks) as total_clicks, SUM(impressions) as total_impressions
FROM gsc_performance
WHERE date >= CURRENT_DATE - 28 AND query IS NOT NULL AND page IS NOT NULL
GROUP BY convex_domain_id, query
HAVING COUNT(DISTINCT page) > 1
ORDER BY SUM(impressions) DESC;

-- v_content_decay: pages losing clicks (30%+ drop, last 14 days vs previous 28 days)
CREATE VIEW v_content_decay AS
WITH recent AS (
  SELECT convex_domain_id, page, SUM(clicks) as recent_clicks
  FROM gsc_performance
  WHERE date >= CURRENT_DATE - 14 AND page IS NOT NULL
  GROUP BY convex_domain_id, page
),
previous AS (
  SELECT convex_domain_id, page, SUM(clicks) as prev_clicks
  FROM gsc_performance
  WHERE date BETWEEN CURRENT_DATE - 42 AND CURRENT_DATE - 15 AND page IS NOT NULL
  GROUP BY convex_domain_id, page
)
SELECT r.convex_domain_id, r.page, r.recent_clicks, p.prev_clicks,
       r.recent_clicks - p.prev_clicks as click_change,
       CASE WHEN p.prev_clicks > 0
            THEN ((r.recent_clicks - p.prev_clicks)::numeric / p.prev_clicks * 100)
            ELSE 0 END as pct_change
FROM recent r
JOIN previous p ON r.convex_domain_id = p.convex_domain_id AND r.page = p.page
WHERE p.prev_clicks > 10
  AND r.recent_clicks < p.prev_clicks * 0.7
ORDER BY click_change ASC;

-- =============================================================
-- Auto-create future partitions (replaces 001's function to include gsc_performance)
-- Run monthly via pg_cron or manually
-- =============================================================
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  target_date date := date_trunc('month', CURRENT_DATE) + '2 months'::interval;
  next_date date := target_date + '1 month'::interval;
  kp_name text := 'keyword_positions_' || to_char(target_date, 'YYYY_MM');
  ckp_name text := 'competitor_kp_' || to_char(target_date, 'YYYY_MM');
  gsc_name text := 'gsc_performance_' || to_char(target_date, 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF keyword_positions
     FOR VALUES FROM (%L) TO (%L)', kp_name, target_date, next_date
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF competitor_keyword_positions
     FOR VALUES FROM (%L) TO (%L)', ckp_name, target_date, next_date
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF gsc_performance
     FOR VALUES FROM (%L) TO (%L)', gsc_name, target_date, next_date
  );
END $$ LANGUAGE plpgsql;

-- Schedule: SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partitions()');
-- (enable pg_cron extension first if using scheduled partition creation)

-- =============================================================
-- RLS: enabled on all tables (service role key bypasses RLS)
-- For frontend reads via API routes, add policies as needed
-- =============================================================
ALTER TABLE gsc_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_metadata ENABLE ROW LEVEL SECURITY;

-- Service role key bypasses RLS, so writes from Convex actions work
-- For frontend reads via API routes, add specific policies as needed
