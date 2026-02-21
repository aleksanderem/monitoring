-- Phase 1: Keyword positions analytical store
-- Run this in Supabase SQL Editor

-- =============================================================
-- keyword_positions: main analytical table (partitioned by month)
-- =============================================================
CREATE TABLE keyword_positions (
  id bigint GENERATED ALWAYS AS IDENTITY,
  convex_domain_id text NOT NULL,
  convex_keyword_id text NOT NULL,
  date date NOT NULL,
  position smallint,               -- null = not found in top 30
  url text,
  search_volume int,
  difficulty smallint,
  cpc numeric(10,2),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

-- Create monthly partitions for current + next 12 months
DO $$
DECLARE
  start_date date := date_trunc('month', CURRENT_DATE);
  partition_date date;
  partition_name text;
  next_date date;
BEGIN
  FOR i IN 0..12 LOOP
    partition_date := start_date + (i || ' months')::interval;
    next_date := partition_date + '1 month'::interval;
    partition_name := 'keyword_positions_' || to_char(partition_date, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF keyword_positions
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, partition_date, next_date
    );
  END LOOP;
END $$;

-- Unique constraint: one position per keyword per date
CREATE UNIQUE INDEX idx_kp_keyword_date
  ON keyword_positions (convex_keyword_id, date);

-- Primary query pattern: positions for a keyword over time
CREATE INDEX idx_kp_keyword_date_pos
  ON keyword_positions (convex_keyword_id, date DESC, position);

-- Domain-level queries: all keywords for a domain on a date
CREATE INDEX idx_kp_domain_date
  ON keyword_positions (convex_domain_id, date DESC);

-- =============================================================
-- competitor_keyword_positions: competitor tracking
-- =============================================================
CREATE TABLE competitor_keyword_positions (
  id bigint GENERATED ALWAYS AS IDENTITY,
  convex_competitor_id text NOT NULL,
  convex_keyword_id text NOT NULL,
  date date NOT NULL,
  position smallint,
  url text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

-- Create monthly partitions
DO $$
DECLARE
  start_date date := date_trunc('month', CURRENT_DATE);
  partition_date date;
  partition_name text;
  next_date date;
BEGIN
  FOR i IN 0..12 LOOP
    partition_date := start_date + (i || ' months')::interval;
    next_date := partition_date + '1 month'::interval;
    partition_name := 'competitor_kp_' || to_char(partition_date, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF competitor_keyword_positions
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, partition_date, next_date
    );
  END LOOP;
END $$;

CREATE UNIQUE INDEX idx_ckp_comp_kw_date
  ON competitor_keyword_positions (convex_competitor_id, convex_keyword_id, date);

CREATE INDEX idx_ckp_keyword_date
  ON competitor_keyword_positions (convex_keyword_id, date DESC);

-- =============================================================
-- Auto-create future partitions (run monthly via pg_cron or manually)
-- =============================================================
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  target_date date := date_trunc('month', CURRENT_DATE) + '2 months'::interval;
  next_date date := target_date + '1 month'::interval;
  kp_name text := 'keyword_positions_' || to_char(target_date, 'YYYY_MM');
  ckp_name text := 'competitor_kp_' || to_char(target_date, 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF keyword_positions
     FOR VALUES FROM (%L) TO (%L)', kp_name, target_date, next_date
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF competitor_keyword_positions
     FOR VALUES FROM (%L) TO (%L)', ckp_name, target_date, next_date
  );
END $$ LANGUAGE plpgsql;

-- Schedule: SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partitions()');
-- (enable pg_cron extension first if using scheduled partition creation)

-- =============================================================
-- RLS: disabled for now (service role key writes, API routes read)
-- Enable when adding direct frontend Supabase queries
-- =============================================================
ALTER TABLE keyword_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_keyword_positions ENABLE ROW LEVEL SECURITY;

-- Service role key bypasses RLS, so writes from Convex actions work
-- For frontend reads via API routes, we'll add policies in Phase 2
