/**
 * Analytics event constants and types.
 * Thin abstraction layer for event tracking.
 */

export const ANALYTICS_CATEGORIES = {
  NAVIGATION: "navigation",
  FEATURE: "feature",
  CONVERSION: "conversion",
  PERFORMANCE: "performance",
  ERROR: "error",
} as const;

export type AnalyticsCategory = (typeof ANALYTICS_CATEGORIES)[keyof typeof ANALYTICS_CATEGORIES];

/**
 * Predefined event names for consistent tracking.
 */
export const EVENTS = {
  // Navigation
  PAGE_VIEW: "page_view",
  TAB_SWITCH: "tab_switch",

  // Feature usage
  KEYWORD_ADD: "keyword_add",
  KEYWORD_REFRESH: "keyword_refresh",
  DOMAIN_ADD: "domain_add",
  REPORT_GENERATE: "report_generate",
  REPORT_SHARE: "report_share",
  SEO_AUDIT_START: "seo_audit_start",
  AI_STRATEGY_GENERATE: "ai_strategy_generate",
  COMPETITOR_ADD: "competitor_add",
  BACKLINK_FETCH: "backlink_fetch",

  // Conversion
  SIGNUP: "signup",
  ONBOARDING_COMPLETE: "onboarding_complete",
  PLAN_UPGRADE: "plan_upgrade",

  // Performance
  WEB_VITAL: "web_vital",

  // Errors
  API_ERROR: "api_error",
  CLIENT_ERROR: "client_error",
} as const;

export type AnalyticsEventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Generate a random session ID for grouping events.
 */
export function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
