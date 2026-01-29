import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Organizations (tenants)
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    settings: v.object({
      defaultRefreshFrequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("on_demand")
      ),
    }),
    limits: v.optional(v.object({
      maxKeywords: v.optional(v.number()),           // Global keyword limit
      maxProjects: v.optional(v.number()),           // Max projects
      maxDomains: v.optional(v.number()),            // Max domains globally
      maxDomainsPerProject: v.optional(v.number()),  // Default per project
      maxKeywordsPerDomain: v.optional(v.number()),  // Default per domain
    })),
  }).index("by_slug", ["slug"]),

  // Teams within organizations
  teams: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Projects within teams
  projects: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    createdAt: v.number(),
    limits: v.optional(v.object({
      maxDomains: v.optional(v.number()),            // Override org limit
      maxKeywordsPerDomain: v.optional(v.number()),  // Override org default
    })),
  }).index("by_team", ["teamId"]),

  // Domains within projects
  domains: defineTable({
    projectId: v.id("projects"),
    domain: v.string(),
    createdAt: v.number(),
    tags: v.optional(v.array(v.string())),
    settings: v.object({
      refreshFrequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("on_demand")
      ),
      searchEngine: v.string(),
      location: v.string(),
      language: v.string(),
    }),
    lastRefreshedAt: v.optional(v.number()),
    limits: v.optional(v.object({
      maxKeywords: v.optional(v.number()),           // Override project/org default
    })),
  }).index("by_project", ["projectId"]),

  // Keywords within domains
  keywords: defineTable({
    domainId: v.id("domains"),
    phrase: v.string(),
    createdAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("pending_approval")
    ),
    proposedBy: v.optional(v.string()),
    lastUpdated: v.optional(v.number()),
    checkingStatus: v.optional(v.union(
      v.literal("queued"),
      v.literal("checking"),
      v.literal("completed"),
      v.literal("failed")
    )),
    checkJobId: v.optional(v.id("keywordCheckJobs")),
    searchVolume: v.optional(v.number()),
    difficulty: v.optional(v.number()),
  }).index("by_domain", ["domainId"])
    .index("by_check_job", ["checkJobId"]),

  // Background jobs for keyword position checking
  keywordCheckJobs: defineTable({
    domainId: v.id("domains"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    totalKeywords: v.number(),
    processedKeywords: v.number(),
    failedKeywords: v.number(),
    keywordIds: v.array(v.id("keywords")),
    currentKeywordId: v.optional(v.id("keywords")),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_domain", ["domainId"])
    .index("by_status", ["status"]),

  // Historical keyword positions
  keywordPositions: defineTable({
    keywordId: v.id("keywords"),
    date: v.string(),
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    searchVolume: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    cpc: v.optional(v.number()),
    fetchedAt: v.number(),
  })
    .index("by_keyword", ["keywordId"])
    .index("by_keyword_date", ["keywordId", "date"]),

  // Domain visibility history (aggregate metrics from Historical Rank Overview API)
  domainVisibilityHistory: defineTable({
    domainId: v.id("domains"),
    date: v.string(), // YYYY-MM-DD
    metrics: v.object({
      // Keywords by position range
      pos_1: v.optional(v.number()),
      pos_2_3: v.optional(v.number()),
      pos_4_10: v.optional(v.number()),
      pos_11_20: v.optional(v.number()),
      pos_21_30: v.optional(v.number()),
      pos_31_40: v.optional(v.number()),
      pos_41_50: v.optional(v.number()),
      pos_51_60: v.optional(v.number()),
      pos_61_70: v.optional(v.number()),
      pos_71_80: v.optional(v.number()),
      pos_81_90: v.optional(v.number()),
      pos_91_100: v.optional(v.number()),
      // Aggregate metrics
      etv: v.optional(v.number()), // Estimated traffic value
      impressions_etv: v.optional(v.number()),
      count: v.optional(v.number()), // Total keywords count
      is_new: v.optional(v.number()),
      is_up: v.optional(v.number()),
      is_down: v.optional(v.number()),
      is_lost: v.optional(v.number()),
    }),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_date", ["domainId", "date"]),

  // Discovered keywords from domain visibility scan (not yet monitored)
  discoveredKeywords: defineTable({
    domainId: v.id("domains"),
    keyword: v.string(),
    bestPosition: v.number(),
    previousPosition: v.optional(v.number()), // Previous position from SE Ranking
    url: v.string(),
    searchVolume: v.optional(v.number()),
    cpc: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    traffic: v.optional(v.number()),
    lastSeenDate: v.string(),
    status: v.union(
      v.literal("discovered"), // Found but not yet added to monitoring
      v.literal("monitoring"), // Added to active monitoring
      v.literal("ignored") // User explicitly ignored this keyword
    ),
    createdAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_keyword", ["domainId", "keyword"])
    .index("by_domain_status", ["domainId", "status"]),

  // Shareable reports
  reports: defineTable({
    projectId: v.id("projects"),
    token: v.string(),
    name: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    template: v.optional(v.union(
      v.literal("executive-summary"),
      v.literal("detailed-keyword"),
      v.literal("competitor-analysis"),
      v.literal("progress-report")
    )),
    settings: v.object({
      domainsIncluded: v.array(v.id("domains")),
      showSearchVolume: v.boolean(),
      showDifficulty: v.boolean(),
      allowKeywordProposals: v.boolean(),
      // Auto-update configuration
      updateFrequency: v.optional(v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("manual")
      )),
      lastAutoUpdate: v.optional(v.number()),
      // Customization
      customization: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        brandColor: v.optional(v.string()),
        introText: v.optional(v.string()),
      })),
      // Section visibility
      sections: v.optional(v.object({
        showCoverPage: v.optional(v.boolean()),
        showExecutiveSummary: v.optional(v.boolean()),
        showPositionChanges: v.optional(v.boolean()),
        showKeywordPerformance: v.optional(v.boolean()),
        showTopGainersLosers: v.optional(v.boolean()),
        showSerpVisibility: v.optional(v.boolean()),
      })),
    }),
  })
    .index("by_project", ["projectId"])
    .index("by_token", ["token"]),

  // Generated reports (PDF/CSV/Excel downloads)
  generatedReports: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    reportType: v.union(
      v.literal("summary"),
      v.literal("detailed"),
      v.literal("executive")
    ),
    format: v.union(
      v.literal("pdf"),
      v.literal("csv"),
      v.literal("excel")
    ),
    dateRange: v.object({
      start: v.string(), // YYYY-MM-DD
      end: v.string(),   // YYYY-MM-DD
    }),
    domainsIncluded: v.array(v.id("domains")),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed")
    ),
    progress: v.number(), // 0-100
    fileUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()), // bytes
    error: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    emailSent: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // External clients
  clients: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    hasAccount: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_email", ["email"]),

  // Client access to reports
  clientReportAccess: defineTable({
    clientId: v.id("clients"),
    reportId: v.id("reports"),
    grantedAt: v.number(),
  })
    .index("by_client", ["clientId"])
    .index("by_report", ["reportId"]),

  // Keyword proposals from clients
  keywordProposals: defineTable({
    reportId: v.id("reports"),
    clientId: v.id("clients"),
    phrase: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    createdAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    // Metadata from keyword research tools
    searchVolume: v.optional(v.number()),
    competition: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    difficulty: v.optional(v.number()), // 0-100 scale
    source: v.optional(v.union(
      v.literal("client"),
      v.literal("dataforseo"),
      v.literal("seranking")
    )),
    metadata: v.optional(v.object({
      whySuggested: v.optional(v.string()),
      relatedKeywords: v.optional(v.array(v.string())),
      trendData: v.optional(v.array(v.object({
        month: v.string(),
        volume: v.number(),
      }))),
    })),
  })
    .index("by_report", ["reportId"])
    .index("by_status", ["status"]),

  // Messages between clients and team
  messages: defineTable({
    reportId: v.id("reports"),
    authorType: v.union(v.literal("user"), v.literal("client")),
    authorId: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_report", ["reportId"]),

  // Custom roles for organizations
  roles: defineTable({
    organizationId: v.optional(v.id("organizations")), // null = system role
    name: v.string(),
    key: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    isSystem: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_key", ["organizationId", "key"]),

  // Organization membership
  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
      v.literal("custom")
    ),
    roleId: v.optional(v.id("roles")), // for custom roles
    joinedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["organizationId", "userId"]),

  // Project-level role assignments
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    roleId: v.optional(v.id("roles")),
    inheritFromOrg: v.boolean(),
    assignedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  // Team membership
  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.optional(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    )),
    joinedAt: v.number(),
    lastActiveAt: v.optional(v.number()),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"]),

  // Team invitations
  teamInvitations: defineTable({
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    invitedBy: v.id("users"),
    token: v.string(),
    customMessage: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  // =================================================================
  // Super Admin System
  // =================================================================

  // Super admins (system-wide administrators)
  superAdmins: defineTable({
    userId: v.id("users"),
    grantedBy: v.optional(v.id("users")),
    grantedAt: v.number(),
  }).index("by_user", ["userId"]),

  // User suspensions (tracks suspended users)
  userSuspensions: defineTable({
    userId: v.id("users"),
    suspendedBy: v.id("users"),
    suspendedAt: v.number(),
    reason: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Organization suspensions (tracks suspended organizations)
  organizationSuspensions: defineTable({
    organizationId: v.id("organizations"),
    suspendedBy: v.id("users"),
    suspendedAt: v.number(),
    reason: v.optional(v.string()),
  }).index("by_organization", ["organizationId"]),

  // System configuration (singleton pattern)
  systemConfig: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  // API usage logs (for DataForSEO and SE Ranking)
  apiUsageLogs: defineTable({
    provider: v.union(v.literal("dataforseo"), v.literal("seranking")),
    endpoint: v.string(),
    organizationId: v.optional(v.id("organizations")),
    domainId: v.optional(v.id("domains")),
    requestCount: v.number(),
    cost: v.optional(v.number()),
    date: v.string(), // YYYY-MM-DD
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_provider_date", ["provider", "date"])
    .index("by_organization", ["organizationId"]),

  // Notification/email logs
  notificationLogs: defineTable({
    type: v.union(v.literal("email"), v.literal("system")),
    recipient: v.string(),
    subject: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("pending")),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // Admin audit logs
  adminAuditLogs: defineTable({
    adminUserId: v.id("users"),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    details: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_admin", ["adminUserId"])
    .index("by_target", ["targetType", "targetId"]),

  // System logs (for debugging and monitoring)
  systemLogs: defineTable({
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
    eventType: v.string(), // e.g., "api_error", "database_error", "validation_error"
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()),
    stackTrace: v.optional(v.string()),
    requestMetadata: v.optional(v.object({
      url: v.optional(v.string()),
      method: v.optional(v.string()),
      headers: v.optional(v.any()),
      body: v.optional(v.any()),
    })),
    createdAt: v.number(),
  })
    .index("by_level", ["level"])
    .index("by_event_type", ["eventType"])
    .index("by_user", ["userId"])
    .index("by_created_at", ["createdAt"]),

  // =================================================================
  // Backlinks (from SE Ranking)
  // =================================================================

  // Domain backlinks summary (aggregated stats)
  domainBacklinksSummary: defineTable({
    domainId: v.id("domains"),
    totalBacklinks: v.number(),
    totalDomains: v.number(),
    totalIps: v.number(),
    totalSubnets: v.number(),
    dofollow: v.number(),
    nofollow: v.number(),
    newBacklinks: v.optional(v.number()),
    lostBacklinks: v.optional(v.number()),
    avgInlinkRank: v.optional(v.number()),
    fetchedAt: v.number(),
  }).index("by_domain", ["domainId"]),

  // Backlinks distributions (TLD, platforms, countries, etc.)
  domainBacklinksDistributions: defineTable({
    domainId: v.id("domains"),
    tldDistribution: v.any(), // Object with TLD counts
    platformTypes: v.any(), // Object with platform type counts
    countries: v.any(), // Object with country counts
    linkTypes: v.any(), // Object with link type counts (anchor, redirect, image, etc.)
    linkAttributes: v.any(), // Object with link attributes (nofollow, noopener, etc.)
    semanticLocations: v.any(), // Object with semantic location counts
    fetchedAt: v.number(),
  }).index("by_domain", ["domainId"]),

  // Individual backlinks
  domainBacklinks: defineTable({
    domainId: v.id("domains"),
    domainFrom: v.string(),
    urlFrom: v.string(),
    urlTo: v.string(),
    tldFrom: v.optional(v.string()),
    anchor: v.optional(v.string()),
    textPre: v.optional(v.string()),
    textPost: v.optional(v.string()),
    dofollow: v.boolean(),
    itemType: v.optional(v.string()), // anchor, redirect, image, canonical
    rank: v.optional(v.number()),
    pageFromRank: v.optional(v.number()),
    domainFromRank: v.optional(v.number()),
    backlink_spam_score: v.optional(v.number()),
    firstSeen: v.optional(v.string()),
    lastSeen: v.optional(v.string()),
    isNew: v.optional(v.boolean()),
    isLost: v.optional(v.boolean()),
    pageFromTitle: v.optional(v.string()),
    semanticLocation: v.optional(v.string()),
    domainFromCountry: v.optional(v.string()),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_urlFrom", ["domainId", "urlFrom"])
    .index("by_domain_rank", ["domainId", "rank"]),

  // =================================================================
  // User Settings & Preferences
  // =================================================================

  // User preferences (language, timezone, formats)
  userPreferences: defineTable({
    userId: v.id("users"),
    language: v.string(), // en, es, fr, de, pl
    timezone: v.string(), // e.g., "America/New_York"
    dateFormat: v.string(), // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
    timeFormat: v.string(), // 12h, 24h
  }).index("by_user", ["userId"]),

  // User notification preferences
  userNotificationPreferences: defineTable({
    userId: v.id("users"),
    dailyRankingReports: v.boolean(),
    positionAlerts: v.boolean(),
    keywordOpportunities: v.boolean(),
    teamInvitations: v.boolean(),
    systemUpdates: v.boolean(),
    frequency: v.string(), // immediate, daily, weekly
  }).index("by_user", ["userId"]),

  // User API keys
  userAPIKeys: defineTable({
    userId: v.id("users"),
    name: v.string(),
    key: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.union(v.number(), v.null()),
  })
    .index("by_user", ["userId"])
    .index("by_key", ["key"]),

  // =================================================================
  // On-Site SEO Analysis (DataForSEO On-Page API)
  // =================================================================

  // Domain on-site analysis summary
  domainOnsiteAnalysis: defineTable({
    domainId: v.id("domains"),
    healthScore: v.number(), // 0-100 overall health score
    totalPages: v.number(),
    criticalIssues: v.number(),
    warnings: v.number(),
    recommendations: v.number(),
    avgLoadTime: v.optional(v.number()),
    avgWordCount: v.optional(v.number()),
    issues: v.object({
      missingTitles: v.number(),
      missingMetaDescriptions: v.number(),
      duplicateContent: v.number(),
      brokenLinks: v.number(),
      slowPages: v.number(),
      suboptimalTitles: v.number(),
      thinContent: v.number(),
      missingH1: v.number(),
      largeImages: v.number(),
      missingAltText: v.number(),
    }),
    fetchedAt: v.number(),
  }).index("by_domain", ["domainId"]),

  // Individual crawled pages
  domainOnsitePages: defineTable({
    domainId: v.id("domains"),
    analysisId: v.id("domainOnsiteAnalysis"),
    url: v.string(),
    statusCode: v.number(),
    title: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    h1: v.optional(v.string()),
    wordCount: v.number(),
    loadTime: v.optional(v.number()),
    issueCount: v.number(),
    issues: v.array(v.object({
      type: v.union(
        v.literal("critical"),
        v.literal("warning"),
        v.literal("recommendation")
      ),
      category: v.string(),
      message: v.string(),
    })),
  })
    .index("by_domain", ["domainId"])
    .index("by_analysis", ["analysisId"]),
});
