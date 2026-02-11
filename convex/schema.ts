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
      maxKeywords: v.optional(v.number()),
    })),
    onboardingCompleted: v.optional(v.boolean()),
    onboardingDismissed: v.optional(v.boolean()),
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
    // Denormalized position data (updated by storePosition to avoid N+1 queries)
    currentPosition: v.optional(v.union(v.number(), v.null())),
    previousPosition: v.optional(v.union(v.number(), v.null())),
    positionChange: v.optional(v.union(v.number(), v.null())),
    currentUrl: v.optional(v.union(v.string(), v.null())),
    latestCpc: v.optional(v.number()),
    positionUpdatedAt: v.optional(v.number()),
    recentPositions: v.optional(v.array(v.object({
      date: v.string(),
      position: v.union(v.number(), v.null()),
    }))),
    tags: v.optional(v.array(v.string())), // Tags for keyword organization
    keywordType: v.optional(v.union(
      v.literal("core"),
      v.literal("longtail"),
      v.literal("branded")
    )),
  }).index("by_domain", ["domainId"])
    .index("by_check_job", ["checkJobId"]),

  // Keyword groups for organizing keywords
  keywordGroups: defineTable({
    domainId: v.id("domains"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(), // Hex color code
    createdAt: v.number(),
  }).index("by_domain", ["domainId"]),

  // Many-to-many relationship between keywords and groups
  keywordGroupMemberships: defineTable({
    keywordId: v.id("keywords"),
    groupId: v.id("keywordGroups"),
    addedAt: v.number(),
  })
    .index("by_keyword", ["keywordId"])
    .index("by_group", ["groupId"])
    .index("by_keyword_group", ["keywordId", "groupId"]),

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

  // SERP fetching jobs (for bulk competitor analysis)
  keywordSerpJobs: defineTable({
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

  // SERP Features tracking (featured snippet, PAA, image pack, etc.)
  serpFeatureTracking: defineTable({
    keywordId: v.id("keywords"),
    date: v.string(), // YYYY-MM-DD
    features: v.object({
      featuredSnippet: v.optional(v.boolean()),
      peopleAlsoAsk: v.optional(v.boolean()),
      imagePack: v.optional(v.boolean()),
      videoPack: v.optional(v.boolean()),
      localPack: v.optional(v.boolean()),
      knowledgeGraph: v.optional(v.boolean()),
      sitelinks: v.optional(v.boolean()),
      topStories: v.optional(v.boolean()),
      relatedSearches: v.optional(v.boolean()),
    }),
    fetchedAt: v.number(),
  })
    .index("by_keyword", ["keywordId"])
    .index("by_keyword_date", ["keywordId", "date"]),

  // SERP Results (top 100 organic results for each keyword)
  keywordSerpResults: defineTable({
    keywordId: v.id("keywords"),
    domainId: v.id("domains"),
    date: v.string(), // YYYY-MM-DD

    // Ranking info
    position: v.number(),
    rankGroup: v.optional(v.number()),
    rankAbsolute: v.optional(v.number()),

    // Basic info
    domain: v.string(),
    url: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    breadcrumb: v.optional(v.string()),
    websiteName: v.optional(v.string()),
    relativeUrl: v.optional(v.string()),
    mainDomain: v.optional(v.string()),

    // Highlighted text
    highlighted: v.optional(v.array(v.string())),

    // Sitelinks
    sitelinks: v.optional(v.array(v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      url: v.optional(v.string()),
    }))),

    // Traffic & Value
    etv: v.optional(v.number()),
    estimatedPaidTrafficCost: v.optional(v.number()),

    // SERP Features
    isFeaturedSnippet: v.optional(v.boolean()),
    isMalicious: v.optional(v.boolean()),
    isWebStory: v.optional(v.boolean()),
    ampVersion: v.optional(v.boolean()),

    // Rating
    rating: v.optional(v.object({
      ratingType: v.optional(v.string()),
      value: v.optional(v.number()),
      votesCount: v.optional(v.number()),
      ratingMax: v.optional(v.number()),
    })),

    // Price (for products)
    price: v.optional(v.object({
      current: v.optional(v.number()),
      regular: v.optional(v.number()),
      maxValue: v.optional(v.number()),
      currency: v.optional(v.string()),
      isPriceRange: v.optional(v.boolean()),
      displayedPrice: v.optional(v.string()),
    })),

    // Timestamps
    timestamp: v.optional(v.string()),

    // About this result
    aboutThisResult: v.optional(v.object({
      url: v.optional(v.string()),
      source: v.optional(v.string()),
      sourceInfo: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
    })),

    // Your domain flag
    isYourDomain: v.boolean(),

    fetchedAt: v.number(),
  })
    .index("by_keyword", ["keywordId"])
    .index("by_keyword_date", ["keywordId", "date"])
    .index("by_domain", ["domainId"])
    .index("by_featured_snippet", ["keywordId", "isFeaturedSnippet"]),

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
    previousPosition: v.optional(v.number()),
    url: v.string(),
    searchVolume: v.optional(v.number()),
    cpc: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    traffic: v.optional(v.number()),
    lastSeenDate: v.string(),
    status: v.union(
      v.literal("discovered"),
      v.literal("monitoring"),
      v.literal("ignored")
    ),
    createdAt: v.number(),

    // Extended SEO metrics (from Ranked Keywords API)
    competition: v.optional(v.number()),
    competitionLevel: v.optional(v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"))),
    intent: v.optional(v.union(
      v.literal("commercial"),
      v.literal("informational"),
      v.literal("navigational"),
      v.literal("transactional")
    )),
    serpFeatures: v.optional(v.array(v.string())),
    etv: v.optional(v.number()),
    estimatedPaidTrafficCost: v.optional(v.number()),

    // Rank changes
    previousRankAbsolute: v.optional(v.number()),
    isNew: v.optional(v.boolean()),
    isUp: v.optional(v.boolean()),
    isDown: v.optional(v.boolean()),

    // Monthly search volumes
    monthlySearches: v.optional(v.any()), // Array of {year, month, search_volume}

    // Backlinks info
    backlinksInfo: v.optional(v.any()), // {referringDomains, referringPages, dofollow, backlinks}

    // SERP details
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    rating: v.optional(v.any()), // {value, votesCount, ratingMax}

    // Page/domain rank
    pageRank: v.optional(v.number()),
    mainDomainRank: v.optional(v.number()),
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
    domainFrom: v.optional(v.string()), // Made optional for backwards compatibility with old data
    urlFrom: v.string(),
    urlTo: v.string(),
    tldFrom: v.optional(v.string()),
    anchor: v.optional(v.string()),
    textPre: v.optional(v.string()),
    textPost: v.optional(v.string()),
    dofollow: v.optional(v.boolean()), // New field, optional for backwards compatibility
    itemType: v.optional(v.string()), // anchor, redirect, image, canonical
    rank: v.optional(v.number()), // New field name
    pageFromRank: v.optional(v.number()),
    domainFromRank: v.optional(v.number()), // New field name
    backlink_spam_score: v.optional(v.number()),
    firstSeen: v.optional(v.string()),
    lastSeen: v.optional(v.string()),
    isNew: v.optional(v.boolean()),
    isLost: v.optional(v.boolean()),
    pageFromTitle: v.optional(v.string()),
    semanticLocation: v.optional(v.string()),
    domainFromCountry: v.optional(v.string()),
    fetchedAt: v.number(),
    // Old fields for backwards compatibility (will be removed after data migration)
    nofollow: v.optional(v.boolean()), // Old field, use dofollow instead
    inlinkRank: v.optional(v.number()), // Old field, use rank instead
    domainInlinkRank: v.optional(v.number()), // Old field, use domainFromRank instead
    lastVisited: v.optional(v.string()), // Old field, use lastSeen instead
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_urlFrom", ["domainId", "urlFrom"])
    .index("by_domain_rank", ["domainId", "rank"]),

  // Backlink velocity history (daily tracking of new/lost backlinks)
  backlinkVelocityHistory: defineTable({
    domainId: v.id("domains"),
    date: v.string(), // YYYY-MM-DD
    newBacklinks: v.number(), // Count of backlinks gained this day
    lostBacklinks: v.number(), // Count of backlinks lost this day
    netChange: v.number(), // newBacklinks - lostBacklinks
    totalBacklinks: v.number(), // Total backlinks on this day
    createdAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_date", ["domainId", "date"]),

  // Link building prospects (auto-generated from backlink gap analysis)
  linkBuildingProspects: defineTable({
    domainId: v.id("domains"),
    referringDomain: v.string(),
    domainRank: v.number(),
    linksToCompetitors: v.number(),
    competitors: v.array(v.string()),
    prospectScore: v.number(), // 0-100
    acquisitionDifficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    suggestedChannel: v.union(
      v.literal("broken_link"),
      v.literal("guest_post"),
      v.literal("resource_page"),
      v.literal("outreach"),
      v.literal("content_mention")
    ),
    estimatedImpact: v.number(), // 0-100
    status: v.union(v.literal("identified"), v.literal("reviewing"), v.literal("dismissed")),
    reasoning: v.optional(v.string()),
    generatedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_score", ["domainId", "prospectScore"])
    .index("by_domain_status", ["domainId", "status"]),

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

  // On-site scan jobs (tracking DataForSEO crawl progress)
  onSiteScans: defineTable({
    domainId: v.id("domains"),
    status: v.union(
      v.literal("queued"),
      v.literal("crawling"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed")
    ),
    taskId: v.optional(v.string()), // DataForSEO task ID (legacy)
    crawlId: v.optional(v.string()), // DataForSEO crawl ID (legacy)
    seoAuditJobId: v.optional(v.string()), // SEO Audit API async job ID
    advertoolsCrawlJobId: v.optional(v.string()), // Advertools crawl job ID
    fullAuditJobId: v.optional(v.string()), // Full Audit API job ID
    psiJobId: v.optional(v.string()), // PageSpeed Insights batch job ID
    psiStatus: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"))),
    psiProgress: v.optional(v.object({ current: v.number(), total: v.number() })),
    psiStartedAt: v.optional(v.number()),
    psiError: v.optional(v.string()),
    // Dual-job sub-status tracking
    seoAuditStatus: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("skipped"))),
    advertoolsCrawlStatus: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("skipped"))),
    source: v.optional(v.string()), // "seo_audit" | "dataforseo" | "mock"
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // Progress tracking
    pagesScanned: v.optional(v.number()),
    totalPagesToScan: v.optional(v.number()),
    lastProgressUpdate: v.optional(v.number()),
    summary: v.optional(v.object({
      totalPages: v.number(),
      totalIssues: v.number(),
      crawlTime: v.optional(v.number()), // seconds
    })),
  })
    .index("by_domain", ["domainId"])
    .index("by_status", ["status"])
    .index("by_domain_status", ["domainId", "status"]),

  // Domain on-site analysis summary
  domainOnsiteAnalysis: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    healthScore: v.number(), // 0-100 overall health score
    totalPages: v.number(),
    criticalIssues: v.number(),
    warnings: v.number(),
    recommendations: v.number(),
    avgLoadTime: v.optional(v.number()),
    avgWordCount: v.optional(v.number()),
    avgPerformance: v.optional(v.number()),
    issues: v.object({
      // Legacy DataForSEO fields
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
      // SEO Audit API fields
      missingHttps: v.optional(v.number()),
      missingCanonical: v.optional(v.number()),
      missingRobotsMeta: v.optional(v.number()),
      notMobileFriendly: v.optional(v.number()),
      missingStructuredData: v.optional(v.number()),
      largeDomSize: v.optional(v.number()),
      tooManyElements: v.optional(v.number()),
      highElementSimilarity: v.optional(v.number()),
      lowTextToCodeRatio: v.optional(v.number()),
    }),
    // Full Audit API fields
    grade: v.optional(v.string()), // "A", "B", "C", "D", "F"
    sections: v.optional(v.any()), // {technical, on_page, content, links, images, structured_data}
    allIssues: v.optional(v.any()), // [{priority, section, issue, action}]
    auditRecommendations: v.optional(v.array(v.string())),
    pagesAnalyzed: v.optional(v.number()),
    fetchedAt: v.number(),
    // Page scoring aggregates
    avgPageScore: v.optional(v.number()),
    pageScoreDistribution: v.optional(v.object({
      A: v.number(),
      B: v.number(),
      C: v.number(),
      D: v.number(),
      F: v.number(),
    })),
    pageScoreAxes: v.optional(v.object({
      technical: v.number(),
      content: v.number(),
      seoPerformance: v.number(),
      strategic: v.number(),
    })),
    pageScoreScoredAt: v.optional(v.number()),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // Individual crawled pages
  domainOnsitePages: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    analysisId: v.optional(v.id("domainOnsiteAnalysis")),
    url: v.string(),
    statusCode: v.number(),

    // Basic meta
    title: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    h1: v.optional(v.string()),
    canonical: v.optional(v.string()),

    // Content metrics
    wordCount: v.number(),
    plainTextSize: v.optional(v.number()),
    plainTextRate: v.optional(v.number()),

    // Readability scores
    readabilityScores: v.optional(v.object({
      automatedReadabilityIndex: v.number(),
      colemanLiauIndex: v.number(),
      daleChallIndex: v.number(),
      fleschKincaidIndex: v.number(),
      smogIndex: v.number(),
    })),

    // Content consistency
    contentConsistency: v.optional(v.object({
      titleToContent: v.number(),
      descriptionToContent: v.number(),
    })),

    // Heading structure
    htags: v.optional(v.object({
      h1: v.array(v.string()),
      h2: v.array(v.string()),
      h3: v.optional(v.array(v.string())),
      h4: v.optional(v.array(v.string())),
    })),

    // Links analysis
    internalLinksCount: v.optional(v.number()),
    externalLinksCount: v.optional(v.number()),
    inboundLinksCount: v.optional(v.number()),

    // Images
    imagesCount: v.optional(v.number()),
    imagesMissingAlt: v.optional(v.number()),
    imageAlts: v.optional(v.array(v.object({
      src: v.string(),
      alt: v.string(),
      hasAlt: v.boolean(),
      containsKeyword: v.optional(v.boolean()),
      matchedKeyword: v.optional(v.string()),
    }))),

    // Performance timing
    loadTime: v.optional(v.number()),
    pageSize: v.optional(v.number()), // bytes
    totalDomSize: v.optional(v.number()),

    // Core Web Vitals
    coreWebVitals: v.optional(v.object({
      largestContentfulPaint: v.number(),
      firstInputDelay: v.number(),
      timeToInteractive: v.number(),
      domComplete: v.number(),
      cumulativeLayoutShift: v.optional(v.number()),
    })),

    // Technical
    scriptsCount: v.optional(v.number()),
    renderBlockingScriptsCount: v.optional(v.number()),
    cacheControl: v.optional(v.object({
      cachable: v.boolean(),
      ttl: v.number(),
    })),

    // Social media tags
    hasSocialTags: v.optional(v.boolean()),
    socialMediaTags: v.optional(v.object({
      hasOgTags: v.boolean(),
      hasTwitterCard: v.boolean(),
    })),

    // Lighthouse scores
    lighthouseScores: v.optional(v.object({
      performance: v.number(),
      accessibility: v.number(),
      bestPractices: v.number(),
      seo: v.number(),
    })),

    // OnPage score from DataForSEO
    onpageScore: v.optional(v.number()),

    // Resource errors
    resourceErrors: v.optional(v.object({
      hasErrors: v.boolean(),
      hasWarnings: v.boolean(),
      errorCount: v.number(),
      warningCount: v.number(),
    })),

    // Flags
    brokenResources: v.optional(v.boolean()),
    brokenLinks: v.optional(v.boolean()),
    duplicateTitle: v.optional(v.boolean()),
    duplicateDescription: v.optional(v.boolean()),
    duplicateContent: v.optional(v.boolean()),

    // Issues (existing)
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

    // Page Score (multi-dimensional scoring algorithm)
    pageScore: v.optional(v.object({
      composite: v.number(),
      grade: v.string(),
      technical: v.object({
        score: v.number(),
        subScores: v.array(v.object({
          id: v.string(),
          label: v.string(),
          score: v.number(),
          weight: v.number(),
          status: v.string(),
          explanation: v.string(),
        })),
      }),
      content: v.object({
        score: v.number(),
        subScores: v.array(v.object({
          id: v.string(),
          label: v.string(),
          score: v.number(),
          weight: v.number(),
          status: v.string(),
          explanation: v.string(),
        })),
      }),
      seoPerformance: v.object({
        score: v.number(),
        subScores: v.array(v.object({
          id: v.string(),
          label: v.string(),
          score: v.number(),
          weight: v.number(),
          status: v.string(),
          explanation: v.string(),
        })),
      }),
      strategic: v.object({
        score: v.number(),
        subScores: v.array(v.object({
          id: v.string(),
          label: v.string(),
          score: v.number(),
          weight: v.number(),
          status: v.string(),
          explanation: v.string(),
        })),
      }),
      scoredAt: v.number(),
      dataCompleteness: v.number(),
    })),

    // Checks from Instant Pages (store as object for flexibility)
    checks: v.optional(v.any()),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"])
    .index("by_analysis", ["analysisId"]),

  // Detailed on-site issues (for comprehensive issue tracking)
  onSiteIssues: defineTable({
    scanId: v.id("onSiteScans"),
    domainId: v.id("domains"),
    pageId: v.optional(v.id("domainOnsitePages")), // null for site-wide issues
    severity: v.union(
      v.literal("critical"),
      v.literal("warning"),
      v.literal("recommendation")
    ),
    category: v.union(
      v.literal("meta_tags"),
      v.literal("headings"),
      v.literal("images"),
      v.literal("links"),
      v.literal("performance"),
      v.literal("mobile"),
      v.literal("indexability"),
      v.literal("security"),
      v.literal("content")
    ),
    title: v.string(),
    description: v.string(),
    affectedPages: v.number(), // count of pages with this issue
    detectedAt: v.number(),
  })
    .index("by_scan", ["scanId"])
    .index("by_domain", ["domainId"])
    .index("by_severity", ["severity"])
    .index("by_category", ["category"]),

  // Core Web Vitals metrics (from PageSpeed Insights)
  coreWebVitals: defineTable({
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    date: v.string(), // YYYY-MM-DD
    device: v.union(v.literal("mobile"), v.literal("desktop")),
    // Core Web Vitals
    lcp: v.optional(v.number()), // Largest Contentful Paint (seconds)
    fid: v.optional(v.number()), // First Input Delay (milliseconds)
    cls: v.optional(v.number()), // Cumulative Layout Shift
    // Additional metrics
    performanceScore: v.optional(v.number()), // 0-100
    fcp: v.optional(v.number()), // First Contentful Paint (seconds)
    ttfb: v.optional(v.number()), // Time to First Byte (milliseconds)
    // Pass/fail status
    lcpPass: v.optional(v.boolean()),
    fidPass: v.optional(v.boolean()),
    clsPass: v.optional(v.boolean()),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_date", ["domainId", "date"])
    .index("by_domain_device", ["domainId", "device"]),

  // Schema/structured data validation
  schemaValidation: defineTable({
    pageId: v.id("domainOnsitePages"),
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    schemaTypes: v.array(v.string()), // ["Article", "Organization", "Product"]
    valid: v.boolean(),
    errors: v.array(v.object({
      path: v.string(),
      message: v.string(),
    })),
    warnings: v.array(v.object({
      path: v.string(),
      message: v.string(),
    })),
    validatedAt: v.number(),
  })
    .index("by_page", ["pageId"])
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // Sitemap data (from Advertools API)
  domainSitemapData: defineTable({
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    sitemapUrl: v.string(),
    totalUrls: v.number(),
    urls: v.optional(v.array(v.string())),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"]),

  // Robots.txt data (from Advertools API)
  domainRobotsData: defineTable({
    domainId: v.id("domains"),
    scanId: v.optional(v.id("onSiteScans")),
    robotsUrl: v.string(),
    directives: v.any(),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"]),

  // =================================================================
  // Crawl Analytics (from Advertools Crawl API)
  // =================================================================

  // Link analysis from crawl data
  crawlLinkAnalysis: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    totalLinks: v.number(),
    internalLinks: v.number(),
    externalLinks: v.number(),
    nofollowLinks: v.number(),
    links: v.any(), // top 1000: [{sourceUrl, targetUrl, anchorText, nofollow, internal}]
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // Redirect chain analysis from crawl data
  crawlRedirectAnalysis: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    totalRedirects: v.number(),
    redirects: v.any(), // [{sourceUrl, targetUrl, statusCode, chain, chainLength}]
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // Image analysis from crawl data
  crawlImageAnalysis: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    totalImages: v.number(),
    missingAltCount: v.number(),
    images: v.any(), // top 500: [{pageUrl, imageUrl, alt, missingAlt}]
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // Word frequency analysis from crawl body text
  crawlWordFrequency: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    phraseLength: v.number(), // 1=unigrams, 2=bigrams
    totalWords: v.number(),
    data: v.array(v.object({
      word: v.string(),
      absFreq: v.number(),
      wtdFreq: v.optional(v.number()),
      relValue: v.optional(v.number()),
    })),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // Robots.txt test results (can-fetch checks per user-agent)
  crawlRobotsTestResults: defineTable({
    domainId: v.id("domains"),
    scanId: v.id("onSiteScans"),
    robotstxtUrl: v.string(),
    results: v.array(v.object({
      userAgent: v.string(),
      urlPath: v.string(),
      canFetch: v.boolean(),
    })),
    fetchedAt: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_scan", ["scanId"]),

  // =================================================================
  // Competitor Tracking
  // =================================================================

  // Competitor domains for comparison
  competitors: defineTable({
    domainId: v.id("domains"), // The domain this competitor is tracked against
    competitorDomain: v.string(), // The competitor's domain
    name: v.string(), // Friendly name (defaults to domain if not provided)
    status: v.union(
      v.literal("active"),
      v.literal("paused")
    ),
    createdAt: v.number(),
    lastCheckedAt: v.optional(v.number()),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_status", ["domainId", "status"])
    .index("by_domain_competitor", ["domainId", "competitorDomain"]),

  // Competitor keyword positions
  competitorKeywordPositions: defineTable({
    competitorId: v.id("competitors"),
    keywordId: v.id("keywords"), // The keyword being tracked
    date: v.string(), // YYYY-MM-DD
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    fetchedAt: v.number(),
  })
    .index("by_competitor", ["competitorId"])
    .index("by_keyword", ["keywordId"])
    .index("by_competitor_keyword", ["competitorId", "keywordId"])
    .index("by_competitor_keyword_date", ["competitorId", "keywordId", "date"]),

  // =================================================================
  // Competitor Backlinks
  // =================================================================

  // Competitor backlinks summary (aggregated stats)
  competitorBacklinksSummary: defineTable({
    competitorId: v.id("competitors"),
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
  }).index("by_competitor", ["competitorId"]),

  // Competitor backlinks distributions (TLD, platforms, countries, etc.)
  competitorBacklinksDistributions: defineTable({
    competitorId: v.id("competitors"),
    tldDistribution: v.any(),
    platformTypes: v.any(),
    countries: v.any(),
    linkTypes: v.any(),
    linkAttributes: v.any(),
    semanticLocations: v.any(),
    fetchedAt: v.number(),
  }).index("by_competitor", ["competitorId"]),

  // Individual competitor backlinks
  competitorBacklinks: defineTable({
    competitorId: v.id("competitors"),
    domainFrom: v.optional(v.string()),
    urlFrom: v.string(),
    urlTo: v.string(),
    tldFrom: v.optional(v.string()),
    anchor: v.optional(v.string()),
    textPre: v.optional(v.string()),
    textPost: v.optional(v.string()),
    dofollow: v.optional(v.boolean()),
    itemType: v.optional(v.string()),
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
    .index("by_competitor", ["competitorId"])
    .index("by_competitor_urlFrom", ["competitorId", "urlFrom"])
    .index("by_competitor_rank", ["competitorId", "rank"]),

  // =================================================================
  // Competitor Content Analysis (On-Page)
  // =================================================================

  // Competitor page analysis (on-page SEO analysis of competitor pages)
  competitorPageAnalysis: defineTable({
    competitorId: v.optional(v.id("competitors")), // Optional for keyword-specific reports
    keywordId: v.id("keywords"), // The keyword this page ranks for
    url: v.string(),
    position: v.number(), // SERP position for this keyword

    // Basic meta
    title: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    h1: v.optional(v.string()),
    canonical: v.optional(v.string()),

    // Content metrics
    wordCount: v.number(),
    plainTextSize: v.optional(v.number()),
    plainTextRate: v.optional(v.number()),

    // Heading structure
    htags: v.optional(v.object({
      h1: v.array(v.string()),
      h2: v.array(v.string()),
      h3: v.optional(v.array(v.string())),
      h4: v.optional(v.array(v.string())),
    })),

    // Links analysis
    internalLinksCount: v.optional(v.number()),
    externalLinksCount: v.optional(v.number()),

    // Images
    imagesCount: v.optional(v.number()),

    // Performance
    loadTime: v.optional(v.number()),
    pageSize: v.optional(v.number()),

    // Core Web Vitals
    coreWebVitals: v.optional(v.object({
      largestContentfulPaint: v.number(),
      firstInputDelay: v.number(),
      timeToInteractive: v.number(),
      cumulativeLayoutShift: v.optional(v.number()),
    })),

    // OnPage score from DataForSEO
    onpageScore: v.optional(v.number()),

    // Readability
    readabilityScores: v.optional(v.object({
      automatedReadabilityIndex: v.number(),
      fleschKincaidIndex: v.number(),
    })),

    // Schema/structured data
    schemaTypes: v.optional(v.array(v.string())),

    fetchedAt: v.number(),
  })
    .index("by_competitor", ["competitorId"])
    .index("by_keyword", ["keywordId"])
    .index("by_competitor_keyword", ["competitorId", "keywordId"]),

  // =================================================================
  // Competitor Analysis Reports (Keyword-Specific)
  // =================================================================

  // Competitor analysis reports - keyword-specific deep-dive
  competitorAnalysisReports: defineTable({
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
    keyword: v.string(), // Denormalized for easy display

    // Analyzed competitor pages (selected from SERP)
    competitorPages: v.array(v.object({
      domain: v.string(),
      url: v.string(),
      position: v.number(),
      pageAnalysisId: v.optional(v.id("competitorPageAnalysis")), // Link to detailed analysis
    })),

    // User's page (if ranking)
    userPage: v.optional(v.object({
      url: v.string(),
      position: v.number(),
    })),

    // Analysis summary
    analysis: v.optional(v.object({
      // On-page comparison
      avgCompetitorWordCount: v.number(),
      avgCompetitorH2Count: v.number(),
      avgCompetitorImagesCount: v.number(),

      // Content insights
      commonTopics: v.optional(v.array(v.string())),
      missingTopics: v.optional(v.array(v.string())),

      // Backlinks summary
      avgBacklinksCount: v.optional(v.number()),
      topReferringDomains: v.optional(v.array(v.object({
        domain: v.string(),
        backlinksCount: v.number(),
      }))),
    })),

    // AI-generated actionable recommendations
    recommendations: v.optional(v.array(v.object({
      category: v.union(
        v.literal("content"),
        v.literal("onpage"),
        v.literal("backlinks"),
        v.literal("technical")
      ),
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
      title: v.string(),
      description: v.string(),
      actionSteps: v.optional(v.array(v.string())),
    }))),

    status: v.union(
      v.literal("pending"),
      v.literal("analyzing"),
      v.literal("completed"),
      v.literal("failed")
    ),

    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_domain", ["domainId"])
    .index("by_keyword", ["keywordId"])
    .index("by_domain_status", ["domainId", "status"]),

  // =================================================================
  // Competitor Jobs
  // =================================================================

  // Content Gap Analysis Jobs
  competitorContentGapJobs: defineTable({
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    opportunitiesFound: v.optional(v.number()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_domain", ["domainId"])
    .index("by_competitor", ["competitorId"])
    .index("by_status", ["status"]),

  // Competitor Backlinks Fetch Jobs
  competitorBacklinksJobs: defineTable({
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    backlinksFound: v.optional(v.number()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_domain", ["domainId"])
    .index("by_competitor", ["competitorId"])
    .index("by_status", ["status"]),

  // =================================================================
  // Forecasting & Predictive Analytics
  // =================================================================

  // Statistical forecasts for keywords and domains
  forecasts: defineTable({
    entityType: v.union(v.literal("keyword"), v.literal("domain")),
    entityId: v.string(), // ID reference (keyword or domain)
    metric: v.string(), // "position", "traffic", "backlinks", "etv"
    generatedAt: v.number(),
    predictions: v.array(v.object({
      date: v.string(), // YYYY-MM-DD
      value: v.number(),
      confidenceLower: v.number(),
      confidenceUpper: v.number(),
    })),
    accuracy: v.object({
      r2: v.number(), // R-squared (goodness of fit)
      rmse: v.number(), // Root mean squared error
      confidenceLevel: v.string(), // "high" | "medium" | "low"
    }),
  })
    .index("by_entity", ["entityType", "entityId", "metric"]),

  // Detected anomalies in metrics
  anomalies: defineTable({
    entityType: v.union(v.literal("keyword"), v.literal("domain")),
    entityId: v.string(), // ID reference (keyword or domain)
    metric: v.string(), // "position", "traffic", "backlinks", "etv"
    detectedAt: v.number(),
    date: v.string(), // YYYY-MM-DD - Date of anomaly
    type: v.union(
      v.literal("spike"),
      v.literal("drop"),
      v.literal("pattern_change")
    ),
    severity: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    value: v.number(), // Actual value
    expectedValue: v.number(), // Expected value from mean
    zScore: v.number(), // Z-score magnitude
    description: v.string(), // Human-readable description
    resolved: v.boolean(), // Whether user marked as resolved
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_date", ["date"])
    .index("by_severity", ["severity"])
    .index("by_resolved", ["resolved"]),

  // =================================================================
  // Content Gap Analysis
  // =================================================================

  // Content gap opportunities identified from competitor analysis
  contentGaps: defineTable({
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
    competitorId: v.id("competitors"),
    opportunityScore: v.number(), // 0-100, weighted by multiple factors
    competitorPosition: v.number(),
    yourPosition: v.union(v.number(), v.null()),
    searchVolume: v.number(),
    difficulty: v.number(),
    competitorUrl: v.string(),
    estimatedTrafficValue: v.number(),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    status: v.union(
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("ranking"),
      v.literal("dismissed")
    ),
    identifiedAt: v.number(),
    lastChecked: v.number(),
  })
    .index("by_domain", ["domainId"])
    .index("by_priority", ["domainId", "priority"])
    .index("by_score", ["domainId", "opportunityScore"])
    .index("by_status", ["domainId", "status"])
    .index("by_keyword", ["keywordId"])
    .index("by_competitor", ["competitorId"]),

  // Gap analysis reports (comprehensive summaries)
  gapAnalysisReports: defineTable({
    domainId: v.id("domains"),
    generatedAt: v.number(),
    totalGaps: v.number(),
    highPriorityGaps: v.number(),
    estimatedTotalValue: v.number(),
    topOpportunities: v.array(v.id("contentGaps")),
    competitorsAnalyzed: v.number(),
    keywordsAnalyzed: v.number(),
  }).index("by_domain_date", ["domainId", "generatedAt"]),

  // =================================================================
  // Domain Reports (Full SEO Report Generation)
  // =================================================================

  domainReports: defineTable({
    domainId: v.id("domains"),
    name: v.string(),
    status: v.union(
      v.literal("initializing"),
      v.literal("analyzing"),
      v.literal("collecting"),
      v.literal("ready"),
      v.literal("failed")
    ),
    progress: v.number(), // 0-100
    currentStep: v.optional(v.string()),
    steps: v.optional(v.array(v.object({
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("skipped"), v.literal("failed")),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
    }))),
    reportData: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    options: v.optional(v.object({
      freshnessThresholdMs: v.optional(v.number()),
    })),
  })
    .index("by_domain", ["domainId"])
    .index("by_domain_status", ["domainId", "status"]),

  // =================================================================
  // Notifications
  // =================================================================

  notifications: defineTable({
    userId: v.id("users"),
    domainId: v.optional(v.id("domains")),
    type: v.union(
      v.literal("job_started"),
      v.literal("job_completed"),
      v.literal("job_failed"),
      v.literal("info"),
      v.literal("warning")
    ),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
    jobType: v.optional(v.string()),
    jobId: v.optional(v.string()),
    domainName: v.optional(v.string()),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_unread", ["userId", "isRead", "createdAt"]),
});
