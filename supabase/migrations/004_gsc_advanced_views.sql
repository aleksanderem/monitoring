-- Phase 4: GSC Advanced Views — Crawl Budget Waste + Zero-Click Search Analysis
-- Run this in Supabase SQL Editor

-- =============================================================
-- v_crawl_budget_waste: URLs consuming crawl budget without SEO value
-- Cross-references url_inspections with gsc_performance
-- =============================================================
CREATE OR REPLACE VIEW v_crawl_budget_waste AS
SELECT
  ui.convex_domain_id,
  ui.url,
  ui.indexing_state,
  ui.coverage_state,
  ui.last_crawl_time,
  ui.robots_txt_state,
  COALESCE(perf.total_clicks, 0) as total_clicks,
  COALESCE(perf.total_impressions, 0) as total_impressions,
  CASE
    WHEN ui.indexing_state IS NOT NULL AND ui.indexing_state != 'PASS' THEN 'blocked_but_crawled'
    WHEN COALESCE(perf.total_clicks, 0) = 0 AND COALESCE(perf.total_impressions, 0) < 5 THEN 'zero_value'
    WHEN ui.coverage_state ILIKE '%redirect%' THEN 'redirect_target'
    ELSE 'low_value'
  END as waste_reason
FROM url_inspections ui
LEFT JOIN (
  SELECT convex_domain_id, page,
         SUM(clicks) as total_clicks,
         SUM(impressions) as total_impressions
  FROM gsc_performance
  WHERE date >= CURRENT_DATE - 90 AND page IS NOT NULL
  GROUP BY convex_domain_id, page
) perf ON ui.convex_domain_id = perf.convex_domain_id AND ui.url = perf.page
WHERE (ui.indexing_state IS NOT NULL AND ui.indexing_state != 'PASS')
   OR (COALESCE(perf.total_clicks, 0) = 0 AND COALESCE(perf.total_impressions, 0) < 5)
   OR ui.coverage_state ILIKE '%redirect%'
ORDER BY ui.last_crawl_time DESC NULLS LAST;

-- =============================================================
-- v_zero_click_queries: queries with high impressions but very low CTR
-- Position 1-3, >100 impressions, <3% CTR = likely zero-click (SERP features)
-- =============================================================
CREATE OR REPLACE VIEW v_zero_click_queries AS
SELECT
  convex_domain_id,
  query,
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions,
  AVG(position) as avg_position,
  CASE
    WHEN SUM(impressions) > 0
    THEN ROUND((SUM(clicks)::numeric / SUM(impressions)) * 100, 2)
    ELSE 0
  END as ctr_pct
FROM gsc_performance
WHERE date >= CURRENT_DATE - 28
  AND query IS NOT NULL
GROUP BY convex_domain_id, query
HAVING AVG(position) <= 3
   AND SUM(impressions) > 100
   AND (CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::numeric / SUM(impressions) ELSE 0 END) < 0.03
ORDER BY SUM(impressions) DESC;
