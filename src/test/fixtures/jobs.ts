/**
 * Test fixtures for jobs-related data.
 */

const now = Date.now();

export const ACTIVE_JOB = {
  _id: "job_1" as any,
  _creationTime: now - 5 * 60 * 1000,
  domainId: "domain_active_1" as any,
  domainName: "example.com",
  type: "keyword_check",
  status: "processing" as const,
  totalKeywords: 45,
  processedKeywords: 22,
  failedKeywords: 0,
  createdAt: now - 5 * 60 * 1000,
  startedAt: now - 4 * 60 * 1000,
};

export const ACTIVE_JOBS = [ACTIVE_JOB];

export const JOB_STATS = {
  activeCount: 1,
  completedToday: 5,
  failedToday: 0,
};

export const JOB_HISTORY = [
  {
    _id: "job_h1" as any,
    _creationTime: now - 2 * 60 * 60 * 1000,
    domainId: "domain_active_1" as any,
    domainName: "example.com",
    type: "keyword_check",
    status: "completed" as const,
    totalKeywords: 45,
    processedKeywords: 45,
    failedKeywords: 0,
    createdAt: now - 2 * 60 * 60 * 1000,
    startedAt: now - 2 * 60 * 60 * 1000 + 5000,
    completedAt: now - 2 * 60 * 60 * 1000 + 180000,
  },
  {
    _id: "job_h2" as any,
    _creationTime: now - 4 * 60 * 60 * 1000,
    domainId: "domain_active_1" as any,
    domainName: "example.com",
    type: "serp_fetch",
    status: "failed" as const,
    totalKeywords: 10,
    processedKeywords: 3,
    failedKeywords: 7,
    createdAt: now - 4 * 60 * 60 * 1000,
    startedAt: now - 4 * 60 * 60 * 1000 + 2000,
    completedAt: now - 4 * 60 * 60 * 1000 + 60000,
    error: "DataForSEO API rate limit exceeded",
  },
];
