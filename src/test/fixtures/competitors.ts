/**
 * Test fixtures for competitor-related data.
 * Shapes match api.competitors.* and api.contentGaps_queries.* return types.
 */

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

// api.competitors.getCompetitors
export const COMPETITOR_ACTIVE_1 = {
  _id: "comp_1" as any,
  domainId: "domain_active_1" as any,
  competitorDomain: "competitor-one.com",
  name: "Competitor One",
  status: "active" as const,
  createdAt: now - 20 * day,
  lastCheckedAt: now - 1 * day,
};

export const COMPETITOR_ACTIVE_2 = {
  _id: "comp_2" as any,
  domainId: "domain_active_1" as any,
  competitorDomain: "seo-rival.io",
  name: "SEO Rival",
  status: "active" as const,
  createdAt: now - 15 * day,
  lastCheckedAt: now - 2 * day,
};

export const COMPETITOR_PAUSED = {
  _id: "comp_3" as any,
  domainId: "domain_active_1" as any,
  competitorDomain: "old-competitor.net",
  name: "Old Competitor",
  status: "paused" as const,
  createdAt: now - 60 * day,
  lastCheckedAt: now - 30 * day,
};

export const COMPETITORS_LIST = [COMPETITOR_ACTIVE_1, COMPETITOR_ACTIVE_2, COMPETITOR_PAUSED];
export const COMPETITORS_EMPTY: typeof COMPETITORS_LIST = [];

// Active content gap jobs
export const CONTENT_GAP_JOB_ACTIVE = {
  _id: "cgj_1" as any,
  domainId: "domain_active_1" as any,
  competitorId: "comp_1" as any,
  status: "processing" as const,
  progress: 45,
  createdAt: now - 5 * 60 * 1000,
};

export const CONTENT_GAP_JOBS_NONE: any[] = [];

// Active backlinks jobs for competitors
export const BACKLINKS_JOB_ACTIVE = {
  _id: "blj_1" as any,
  domainId: "domain_active_1" as any,
  competitorId: "comp_1" as any,
  status: "processing" as const,
  progress: 70,
  createdAt: now - 3 * 60 * 1000,
};

export const BACKLINKS_JOBS_NONE: any[] = [];

// api.contentGaps_queries.getGapSummary
export const GAP_SUMMARY = {
  totalGaps: 47,
  highPriority: 12,
  mediumPriority: 23,
  lowPriority: 12,
  statusCounts: { identified: 30, monitoring: 10, ranking: 5, dismissed: 2 },
  totalEstimatedValue: 15400,
  topOpportunities: [
    {
      gapId: "gap_1" as any,
      keywordPhrase: "best seo audit tool",
      competitorDomain: "competitor-one.com",
      opportunityScore: 92,
      estimatedValue: 3200,
      priority: "high" as const,
    },
    {
      gapId: "gap_2" as any,
      keywordPhrase: "keyword tracker free",
      competitorDomain: "seo-rival.io",
      opportunityScore: 85,
      estimatedValue: 2100,
      priority: "high" as const,
    },
    {
      gapId: "gap_3" as any,
      keywordPhrase: "rank monitoring software",
      competitorDomain: "competitor-one.com",
      opportunityScore: 78,
      estimatedValue: 1800,
      priority: "medium" as const,
    },
  ],
  competitorsAnalyzed: 2,
  lastAnalyzedAt: now - 3 * day,
};

export const GAP_SUMMARY_EMPTY = {
  totalGaps: 0,
  highPriority: 0,
  mediumPriority: 0,
  lowPriority: 0,
  statusCounts: { identified: 0, monitoring: 0, ranking: 0, dismissed: 0 },
  totalEstimatedValue: 0,
  topOpportunities: [],
  competitorsAnalyzed: 0,
  lastAnalyzedAt: null,
};
