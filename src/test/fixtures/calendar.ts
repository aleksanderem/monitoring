/**
 * Test fixtures for calendar-related data.
 * Shape matches api.calendarEvents.getEvents return type.
 */

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const CALENDAR_EVENT_RANKING_DROP = {
  _id: "evt_1" as any,
  domainId: "domain_active_1" as any,
  category: "ranking_drop",
  title: "Position drop: best seo tools",
  description: "Keyword 'best seo tools' dropped from position 3 to 8",
  aiReasoning: "Competitor published updated content targeting this keyword",
  aiActionItems: ["Update content with fresh data", "Add internal links", "Check technical issues"],
  scheduledAt: now + 1 * day,
  scheduledEndAt: now + 1 * day + 2 * 60 * 60 * 1000,
  priority: "critical" as const,
  status: "scheduled" as const,
  keywordId: "kw_1" as any,
  keywordPhrase: "best seo tools",
  competitorDomain: undefined,
  sourceType: "ai_generated" as const,
  color: "pink",
  createdAt: now,
  completedAt: undefined,
};

export const CALENDAR_EVENT_OPPORTUNITY = {
  _id: "evt_2" as any,
  domainId: "domain_active_1" as any,
  category: "ranking_opportunity",
  title: "Quick win: keyword research tool",
  description: "Keyword 'keyword research tool' at position 11 — close to page 1",
  aiReasoning: undefined,
  aiActionItems: undefined,
  scheduledAt: now + 2 * day,
  scheduledEndAt: undefined,
  priority: "high" as const,
  status: "scheduled" as const,
  keywordId: "kw_2" as any,
  keywordPhrase: "keyword research tool",
  competitorDomain: undefined,
  sourceType: "system" as const,
  color: "green",
  createdAt: now - 1 * day,
  completedAt: undefined,
};

export const CALENDAR_EVENT_CONTENT_PLAN = {
  _id: "evt_3" as any,
  domainId: "domain_active_1" as any,
  category: "content_plan",
  title: "Create guide: SEO monitoring for beginners",
  description: "Target 3 low-competition keywords with comprehensive guide",
  aiReasoning: "Content gap analysis shows opportunity in beginner guides",
  aiActionItems: ["Research top 5 competitors", "Outline H2/H3 structure", "Draft content"],
  scheduledAt: now + 5 * day,
  scheduledEndAt: now + 7 * day,
  priority: "medium" as const,
  status: "scheduled" as const,
  keywordId: undefined,
  keywordPhrase: undefined,
  competitorDomain: undefined,
  sourceType: "ai_generated" as const,
  color: "blue",
  createdAt: now - 2 * day,
  completedAt: undefined,
};

export const CALENDAR_EVENT_LINK_BUILDING = {
  _id: "evt_4" as any,
  domainId: "domain_active_1" as any,
  category: "link_building",
  title: "Outreach: techsite.com guest post",
  description: "Send outreach email for guest post opportunity",
  aiReasoning: undefined,
  aiActionItems: ["Draft outreach email", "Prepare topic pitches"],
  scheduledAt: now + 3 * day,
  scheduledEndAt: undefined,
  priority: "medium" as const,
  status: "scheduled" as const,
  keywordId: undefined,
  keywordPhrase: undefined,
  competitorDomain: "techsite.com",
  sourceType: "ai_generated" as const,
  color: "purple",
  createdAt: now - 1 * day,
  completedAt: undefined,
};

export const CALENDAR_EVENT_AUDIT = {
  _id: "evt_5" as any,
  domainId: "domain_active_1" as any,
  category: "audit_task",
  title: "Fix broken internal links",
  description: "5 broken internal links detected in last crawl",
  aiReasoning: undefined,
  aiActionItems: undefined,
  scheduledAt: now + 1 * day,
  scheduledEndAt: undefined,
  priority: "high" as const,
  status: "in_progress" as const,
  keywordId: undefined,
  keywordPhrase: undefined,
  competitorDomain: undefined,
  sourceType: "system" as const,
  color: "orange",
  createdAt: now - 3 * day,
  completedAt: undefined,
};

export const CALENDAR_EVENT_COMPLETED = {
  _id: "evt_6" as any,
  domainId: "domain_active_1" as any,
  category: "content_plan",
  title: "Published: Ultimate SEO checklist",
  description: "Comprehensive SEO checklist published and indexed",
  aiReasoning: undefined,
  aiActionItems: undefined,
  scheduledAt: now - 5 * day,
  scheduledEndAt: now - 5 * day + 4 * 60 * 60 * 1000,
  priority: "low" as const,
  status: "completed" as const,
  keywordId: undefined,
  keywordPhrase: undefined,
  competitorDomain: undefined,
  sourceType: "user_created" as const,
  color: "gray",
  createdAt: now - 10 * day,
  completedAt: now - 5 * day,
};

export const CALENDAR_EVENTS_ALL = [
  CALENDAR_EVENT_RANKING_DROP,
  CALENDAR_EVENT_OPPORTUNITY,
  CALENDAR_EVENT_CONTENT_PLAN,
  CALENDAR_EVENT_LINK_BUILDING,
  CALENDAR_EVENT_AUDIT,
  CALENDAR_EVENT_COMPLETED,
];

export const CALENDAR_EVENTS_EMPTY: typeof CALENDAR_EVENTS_ALL = [];
