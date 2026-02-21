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

export const JOB_STATS_BUSY = {
  activeCount: 3,
  completedToday: 15,
  failedToday: 2,
};

export const JOB_STATS_EMPTY = {
  activeCount: 0,
  completedToday: 0,
  failedToday: 0,
};

// Active job with progress for progress bar testing
export const ACTIVE_JOB_WITH_PROGRESS = {
  id: "job_progress_1",
  table: "keywordCheckJobs",
  type: "Keyword Check",
  domainName: "example.com",
  status: "processing" as const,
  progress: 50,
  currentStep: "Checking positions for batch 3/6",
  createdAt: now - 5 * 60 * 1000,
  startedAt: now - 4 * 60 * 1000,
};

// Active SERP job (for KeywordMonitoringTable progress indicator)
export const ACTIVE_SERP_JOB = {
  _id: "serpjob_1" as any,
  domainId: "domain_active_1" as any,
  status: "processing" as const,
  processedKeywords: 5,
  totalKeywords: 20,
  createdAt: now - 2 * 60 * 1000,
};

export const ACTIVE_SERP_JOB_COMPLETE = null;

// Multiple active jobs for stats testing
export const ACTIVE_JOBS_MULTIPLE = [
  {
    id: "job_a1",
    table: "keywordCheckJobs",
    type: "Keyword Check",
    domainName: "example.com",
    status: "processing" as const,
    progress: 50,
    currentStep: "Checking positions",
    createdAt: now - 5 * 60 * 1000,
    startedAt: now - 4 * 60 * 1000,
  },
  {
    id: "job_a2",
    table: "keywordSerpJobs",
    type: "SERP Fetch",
    domainName: "blog.example.com",
    status: "processing" as const,
    progress: 30,
    currentStep: "Fetching SERP data",
    createdAt: now - 3 * 60 * 1000,
    startedAt: now - 2 * 60 * 1000,
  },
  {
    id: "job_a3",
    table: "competitorContentGapJobs",
    type: "Content Gap Analysis",
    domainName: "shop.example.pl",
    status: "pending" as const,
    progress: undefined,
    currentStep: undefined,
    createdAt: now - 1 * 60 * 1000,
    startedAt: undefined,
  },
];

export const ACTIVE_JOBS_EMPTY: any[] = [];

// Scheduled jobs
export const SCHEDULED_JOBS = [
  {
    name: "Daily Keyword Refresh",
    schedule: "Daily at 6:00 UTC",
    description: "Refresh positions for all monitored keywords",
  },
  {
    name: "Weekly Visibility Update",
    schedule: "Monday at 3:00 UTC",
    description: "Fetch visibility stats for all domains",
  },
  {
    name: "Monthly Backlink Audit",
    schedule: "1st of month at 2:00 UTC",
    description: "Fetch and analyze backlink profiles",
  },
];

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

// Job history in unified shape (api.jobs_queries.getAllJobs)
export const JOB_HISTORY_UNIFIED = [
  {
    id: "job_h1",
    table: "keywordCheckJobs",
    type: "Keyword Check",
    domainName: "example.com",
    status: "completed" as const,
    progress: 100,
    currentStep: undefined,
    createdAt: now - 2 * 60 * 60 * 1000,
    startedAt: now - 2 * 60 * 60 * 1000 + 5000,
    completedAt: now - 2 * 60 * 60 * 1000 + 180000,
    error: undefined,
  },
  {
    id: "job_h2",
    table: "keywordSerpJobs",
    type: "SERP Fetch",
    domainName: "example.com",
    status: "failed" as const,
    progress: 30,
    currentStep: undefined,
    createdAt: now - 4 * 60 * 60 * 1000,
    startedAt: now - 4 * 60 * 60 * 1000 + 2000,
    completedAt: now - 4 * 60 * 60 * 1000 + 60000,
    error: "DataForSEO API rate limit exceeded",
  },
  {
    id: "job_h3",
    table: "competitorContentGapJobs",
    type: "Content Gap Analysis",
    domainName: "blog.example.com",
    status: "completed" as const,
    progress: 100,
    currentStep: undefined,
    createdAt: now - 6 * 60 * 60 * 1000,
    startedAt: now - 6 * 60 * 60 * 1000 + 1000,
    completedAt: now - 6 * 60 * 60 * 1000 + 300000,
    error: undefined,
  },
  {
    id: "job_h4",
    table: "keywordCheckJobs",
    type: "Keyword Check",
    domainName: "shop.example.pl",
    status: "cancelled" as const,
    progress: 15,
    currentStep: undefined,
    createdAt: now - 8 * 60 * 60 * 1000,
    startedAt: now - 8 * 60 * 60 * 1000 + 3000,
    completedAt: now - 8 * 60 * 60 * 1000 + 45000,
    error: "Cancelled by user",
  },
];

export const JOB_HISTORY_EMPTY: typeof JOB_HISTORY_UNIFIED = [];
