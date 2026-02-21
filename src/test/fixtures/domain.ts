/**
 * Test fixtures for domain-related data.
 * Shapes match the return types of Convex queries, not raw schema.
 */

// Mimics the return shape of api.domains.list
export const DOMAIN_ACTIVE = {
  _id: "domain_active_1" as any,
  _creationTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
  domain: "example.com",
  projectId: "project_1" as any,
  projectName: "Main Project",
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  tags: ["ecommerce", "seo"],
  keywordCount: 45,
  settings: {
    refreshFrequency: "daily" as const,
    searchEngine: "google.pl",
    location: "Poland",
    language: "pl",
  },
  lastRefreshedAt: Date.now() - 2 * 60 * 60 * 1000,
  onboardingCompleted: true,
  onboardingDismissed: false,
};

export const DOMAIN_SETUP = {
  ...DOMAIN_ACTIVE,
  _id: "domain_setup_1" as any,
  domain: "newsite.com",
  keywordCount: 0,
  onboardingCompleted: false,
  onboardingDismissed: false,
  lastRefreshedAt: undefined,
};

export const DOMAIN_SECOND = {
  ...DOMAIN_ACTIVE,
  _id: "domain_2" as any,
  domain: "blog.example.com",
  projectName: "Blog Project",
  tags: ["blog", "content"],
  keywordCount: 12,
};

export const DOMAIN_LIST = [DOMAIN_ACTIVE, DOMAIN_SETUP, DOMAIN_SECOND];

// Mimics the return shape of api.domains.getDomain
export const DOMAIN_DETAIL = {
  ...DOMAIN_ACTIVE,
  businessDescription: "E-commerce platform selling electronics",
  targetCustomer: "Tech enthusiasts aged 25-45",
  activeStrategyId: undefined,
  cachedPageContent: undefined,
  cachedPageContentAt: undefined,
  limits: { maxKeywords: 100, maxDailyRefreshes: 10 },
};

// Onboarding status shape (api.onboarding.getOnboardingStatus)
export const ONBOARDING_COMPLETE = {
  isCompleted: true,
  steps: {
    domainAdded: true,
    keywordsAdded: true,
    firstCheckComplete: true,
  },
};

export const ONBOARDING_INCOMPLETE = {
  isCompleted: false,
  steps: {
    domainAdded: true,
    keywordsAdded: false,
    firstCheckComplete: false,
  },
};
