/**
 * Test fixtures for settings-related data.
 * Shapes match api.users.*, api.userSettings.*, api.plans.*, api.limits.*,
 * api.organizations.*, api.branding.* return types.
 */

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

// api.userSettings.getUserPreferences
export const USER_PREFERENCES = {
  language: "en",
  timezone: "Europe/Warsaw",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h" as const,
};

// api.userSettings.getNotificationPreferences
export const NOTIFICATION_PREFERENCES_ALL_ON = {
  dailyRankingReports: true,
  positionAlerts: true,
  keywordOpportunities: true,
  teamInvitations: true,
  systemUpdates: true,
  frequency: "daily",
};

export const NOTIFICATION_PREFERENCES_ALL_OFF = {
  dailyRankingReports: false,
  positionAlerts: false,
  keywordOpportunities: false,
  teamInvitations: false,
  systemUpdates: false,
  frequency: "weekly",
};

// api.users.getAPIKeys
export const API_KEYS = [
  {
    _id: "apikey_1" as any,
    name: "Production Key",
    key: "sk_prod_abc1...xyz9",
    scopes: ["read:keywords", "write:keywords", "read:domains"],
    createdAt: now - 30 * day,
    lastUsedAt: now - 2 * 60 * 60 * 1000,
  },
  {
    _id: "apikey_2" as any,
    name: "Development Key",
    key: "sk_dev_def2...uvw8",
    scopes: ["read:keywords"],
    createdAt: now - 10 * day,
    lastUsedAt: null,
  },
];

export const API_KEYS_EMPTY: typeof API_KEYS = [];

// api.branding.getOrganizationBranding
export const BRANDING_WITH_LOGO = {
  organizationId: "org_1" as any,
  organizationName: "Test Organization",
  branding: {
    logoStorageId: "storage_logo_1",
    logoUrl: "https://example.com/logo.png",
  },
};

export const BRANDING_NO_LOGO = {
  organizationId: "org_1" as any,
  organizationName: "Test Organization",
  branding: null,
};

// api.organizations.getOrganizationMembers
export const MEMBERS = [
  {
    _id: "member_1" as any,
    organizationId: "org_1" as any,
    userId: "user_1" as any,
    role: "owner" as const,
    joinedAt: now - 90 * day,
    user: { email: "owner@example.com", name: "Owner User" },
  },
  {
    _id: "member_2" as any,
    organizationId: "org_1" as any,
    userId: "user_2" as any,
    role: "admin" as const,
    joinedAt: now - 60 * day,
    user: { email: "admin@example.com", name: "Admin User" },
  },
  {
    _id: "member_3" as any,
    organizationId: "org_1" as any,
    userId: "user_3" as any,
    role: "member" as const,
    joinedAt: now - 30 * day,
    user: { email: "member@example.com", name: "Regular Member" },
  },
];

// api.plans.getPlan
export const PLAN_FREE = {
  _id: "plan_free" as any,
  name: "Free",
  key: "free",
  description: "Basic plan with limited features",
  permissions: ["domains.create", "domains.edit", "keywords.add", "keywords.refresh"],
  modules: ["positioning"],
  limits: {
    maxKeywords: 50,
    maxDomains: 2,
    maxProjects: 1,
    maxDomainsPerProject: 2,
    maxKeywordsPerDomain: 25,
    maxDailyRefreshes: 5,
    refreshCooldownMinutes: 60,
    maxKeywordsPerBulkRefresh: 10,
    maxDailyApiCost: 1,
  },
  isDefault: true,
  createdAt: now - 365 * day,
};

export const PLAN_PRO = {
  _id: "plan_pro" as any,
  name: "Pro",
  key: "pro",
  description: "Professional plan with all features",
  permissions: [
    "domains.create", "domains.edit", "domains.delete",
    "keywords.add", "keywords.refresh",
    "reports.create", "reports.share",
    "projects.create", "projects.edit", "projects.delete",
    "competitors.add", "competitors.analyze",
  ],
  modules: [
    "positioning", "backlinks", "seo_audit", "reports",
    "competitors", "ai_strategy", "forecasts", "link_building",
  ],
  limits: {
    maxKeywords: 5000,
    maxDomains: 50,
    maxProjects: 20,
    maxDomainsPerProject: 10,
    maxKeywordsPerDomain: 500,
    maxDailyRefreshes: 100,
    refreshCooldownMinutes: 15,
    maxKeywordsPerBulkRefresh: 100,
    maxDailyApiCost: 50,
  },
  isDefault: false,
  createdAt: now - 365 * day,
};

// api.limits.getUsageStats
export const USAGE_STATS_LOW = {
  keywords: { current: 12, limit: 5000 },
  domains: { current: 3, limit: 50 },
  projects: { current: 2, limit: 20 },
  defaults: {
    maxDomainsPerProject: 10,
    maxKeywordsPerDomain: 500,
  },
};

export const USAGE_STATS_NEAR_LIMIT = {
  keywords: { current: 4200, limit: 5000 },
  domains: { current: 45, limit: 50 },
  projects: { current: 18, limit: 20 },
  defaults: {
    maxDomainsPerProject: 10,
    maxKeywordsPerDomain: 500,
  },
};

export const USAGE_STATS_FREE = {
  keywords: { current: 30, limit: 50 },
  domains: { current: 2, limit: 2 },
  projects: { current: 1, limit: 1 },
  defaults: {
    maxDomainsPerProject: 2,
    maxKeywordsPerDomain: 25,
  },
};

// api.limits.getOrgRefreshLimits
export const ORG_REFRESH_LIMITS = {
  organizationId: "org_1" as any,
  refreshCooldownMinutes: 15,
  maxDailyRefreshes: 100,
  maxDailyRefreshesPerUser: 50,
  maxKeywordsPerBulkRefresh: 100,
};

// api.organizations.getUserOrganizations
export const USER_ORGANIZATIONS = [
  {
    _id: "org_1" as any,
    name: "Test Organization",
    role: "admin" as const,
    plan: "pro",
    memberCount: 3,
  },
];
