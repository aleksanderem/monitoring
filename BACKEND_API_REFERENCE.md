# Backend API Reference - Convex Functions

> **Dla AI:** Ten dokument opisuje kompletny backend Convex, który JEST JUŻ ZAIMPLEMENTOWANY.
> Nie twórz tych funkcji od nowa - one już istnieją i działają.
> Używaj ich w nowym frontendzie przez `useQuery`, `useMutation`, `useAction`.

---

## Database Schema (25+ Tables)

### Core Hierarchy
```
organizations → teams → projects → domains → keywords → keywordPositions
```

### All Tables (Alphabetical)

1. **adminAuditLogs** - Admin action logs
2. **apiUsageLogs** - DataForSEO/SE Ranking usage tracking
3. **clients** - External users (client reports access)
4. **clientReportAccess** - Client-report permissions
5. **discoveredKeywords** - Keywords found in visibility scans (not monitored yet)
6. **domains** - Domains to monitor
7. **domainBacklinks** - Individual backlinks
8. **domainBacklinksSummary** - Aggregated backlink stats
9. **domainOnsiteAnalysis** - On-page SEO health score
10. **domainOnsitePages** - Crawled pages with issues
11. **domainVisibilityHistory** - Daily visibility snapshots (position distribution)
12. **generatedReports** - PDF/CSV/Excel downloads (status, fileUrl)
13. **keywordCheckJobs** - Background position check jobs
14. **keywordPositions** - Historical position data (date, position, url, metrics)
15. **keywordProposals** - Client keyword suggestions
16. **keywords** - Monitored keywords
17. **messages** - Client-team messaging
18. **notificationLogs** - Email/system notifications
19. **organizationMembers** - User membership + roles
20. **organizations** - Tenants
21. **organizationSuspensions** - Suspended orgs
22. **projectMembers** - Project-level role assignments
23. **projects** - Projects
24. **reports** - Shareable client reports (token-based)
25. **roles** - Custom RBAC roles
26. **superAdmins** - Platform admins
27. **systemConfig** - Key-value config store
28. **systemLogs** - Error/warning/info logs
29. **teamInvitations** - Pending team invites
30. **teamMembers** - Team membership
31. **teams** - Teams
32. **userNotificationPreferences** - Email notification settings
33. **userPreferences** - Language, timezone, formats
34. **users** - User accounts (from Convex Auth)
35. **userSuspensions** - Suspended users

---

## API Functions by Module

### 1. projects.ts

**Queries:**
```typescript
// Get all projects for a team (with stats: domainCount, keywordCount)
api.projects.getProjects({ teamId: Id<"teams"> })
→ Array<Project & { domainCount: number, keywordCount: number }>

// Get single project with stats
api.projects.getProject({ projectId: Id<"projects"> })
→ Project & { domainCount: number, keywordCount: number } | null
```

**Mutations:**
```typescript
// Create project
api.projects.createProject({ name: string, teamId: Id<"teams"> })
→ Id<"projects">

// Update project
api.projects.updateProject({
  projectId: Id<"projects">,
  name?: string,
  limits?: { maxDomains?: number, maxKeywordsPerDomain?: number }
})
→ Id<"projects">

// Delete project (cascade deletes domains, keywords, etc.)
api.projects.deleteProject({ projectId: Id<"projects"> })
→ void
```

---

### 2. domains.ts

**Queries:**
```typescript
// Get domains for project (with stats: keywordCount, avgPosition)
api.domains.getDomains({ projectId: Id<"projects"> })
→ Array<Domain & { keywordCount: number, avgPosition: number | null }>

// Get single domain
api.domains.getDomain({ domainId: Id<"domains"> })
→ Domain | null
```

**Mutations:**
```typescript
// Create domain
api.domains.createDomain({
  projectId: Id<"projects">,
  domain: string,  // e.g., "example.com"
  settings: {
    refreshFrequency: "daily" | "weekly" | "on_demand",
    searchEngine: string,  // e.g., "google.pl"
    location: string,      // e.g., "Poland"
    language: string       // e.g., "pl"
  }
})
→ Id<"domains">

// Update domain
api.domains.updateDomain({
  domainId: Id<"domains">,
  domain?: string,
  settings?: { ... }
})
→ Id<"domains">

// Delete domain
api.domains.deleteDomain({ domainId: Id<"domains"> })
→ void
```

---

### 3. keywords.ts

**Queries:**
```typescript
// Get keywords for domain (with current position, change, metrics)
api.keywords.getKeywords({ domainId: Id<"domains"> })
→ Array<Keyword & {
  currentPosition: number | null,
  url: string | null,
  searchVolume?: number,
  difficulty?: number,
  lastUpdated?: number,
  change: number | null,  // Delta from previous position
  checkingStatus?: "queued" | "checking" | "completed" | "failed"
}>

// Get keyword with position history
api.keywords.getKeywordWithHistory({
  keywordId: Id<"keywords">,
  days?: number  // Default 30
})
→ Keyword & {
  currentPosition: number | null,
  rankingUrl: string | null,
  searchVolume?: number,
  difficulty?: number,
  lastUpdated?: number,
  change: number | null,
  history: Array<{ date: string, position: number | null, url: string | null, ... }>
}
```

**Mutations:**
```typescript
// Add single keyword
api.keywords.addKeyword({
  domainId: Id<"domains">,
  phrase: string
})
→ Id<"keywords">

// Bulk add keywords
api.keywords.addKeywords({
  domainId: Id<"domains">,
  phrases: string[]
})
→ Array<Id<"keywords">>

// Update keyword status
api.keywords.updateKeywordStatus({
  keywordId: Id<"keywords">,
  status: "active" | "paused" | "pending_approval"
})
→ Id<"keywords">

// Delete keyword
api.keywords.deleteKeyword({ keywordId: Id<"keywords"> })
→ void
```

---

### 4. keywordCheckJobs.ts (Background Jobs)

**Queries:**
```typescript
// Get job status
api.keywordCheckJobs.getCheckJob({ jobId: Id<"keywordCheckJobs"> })
→ CheckJob & {
  status: "pending" | "processing" | "completed" | "failed",
  totalKeywords: number,
  processedKeywords: number,
  failedKeywords: number,
  progress: number  // 0-100
}

// Get active jobs for domain
api.keywordCheckJobs.getActiveJobs({ domainId: Id<"domains"> })
→ Array<CheckJob>
```

**Mutations:**
```typescript
// Create check job
api.keywordCheckJobs.createCheckJob({
  domainId: Id<"domains">,
  keywordIds: Array<Id<"keywords">>
})
→ Id<"keywordCheckJobs">
```

**Actions:**
```typescript
// Process job (calls DataForSEO API)
api.keywordCheckJobs.processCheckJob({ jobId: Id<"keywordCheckJobs"> })
→ void
```

---

### 5. dataforseo.ts (API Integration - 2,959 LOC)

**Actions (External API Calls):**

```typescript
// Fetch positions for all active keywords in domain
api.dataforseo.fetchPositions({ domainId: Id<"domains"> })
→ { success: boolean, processedCount: number, errors?: string[] }

// Get keyword metrics (volume, difficulty, CPC)
api.dataforseo.getKeywordMetrics({
  phrases: string[],
  location: string  // e.g., "2616" for Poland
})
→ Array<{
  keyword: string,
  searchVolume: number,
  difficulty: number,
  cpc: number
}>

// Fetch visibility history (Historical Rank Overview API)
api.dataforseo.fetchAndStoreVisibilityHistory({
  domainId: Id<"domains">,
  days: 30 | 90 | 365
})
→ {
  success: boolean,
  recordsStored: number,
  discoveredKeywordsCount: number
}

// Add keywords with historical data
api.dataforseo.addKeywordsWithHistory({
  domainId: Id<"domains">,
  phrases: string[]
})
→ Array<Id<"keywords">>

// Suggest keywords (AI-powered)
api.dataforseo.suggestKeywords({
  seed: string,
  location: string,
  limit?: number
})
→ Array<{ keyword: string, searchVolume: number, difficulty: number }>
```

---

### 6. seranking.ts (SE Ranking Integration)

**Actions:**
```typescript
// Fetch visibility history from SE Ranking
api.seranking.fetchVisibilityHistory({
  domainId: Id<"domains">,
  siteId: string  // SE Ranking site ID
})
→ { success: boolean, recordsStored: number }

// Fetch domain keywords
api.seranking.fetchDomainKeywords({
  siteId: string
})
→ Array<{ keyword: string, position: number, url: string, ... }>

// Fetch backlinks summary
api.seranking.fetchBacklinksSummary({
  domainId: Id<"domains">,
  siteId: string
})
→ {
  totalBacklinks: number,
  totalDomains: number,
  dofollow: number,
  nofollow: number
}

// Fetch individual backlinks
api.seranking.fetchBacklinks({
  domainId: Id<"domains">,
  siteId: string,
  limit?: number  // Default 100
})
→ Array<{ urlFrom: string, urlTo: string, anchor: string, ... }>
```

---

### 7. teams.ts

**Queries:**
```typescript
// Get teams for organization
api.teams.getTeams({ organizationId: Id<"organizations"> })
→ Array<Team>

// Get team with members
api.teams.getTeam({ teamId: Id<"teams"> })
→ Team & {
  members: Array<{ userId: Id<"users">, role: string, ... }>
}
```

**Mutations:**
```typescript
// Create team
api.teams.createTeam({
  organizationId: Id<"organizations">,
  name: string
})
→ Id<"teams">

// Update team
api.teams.updateTeam({ teamId: Id<"teams">, name: string })
→ Id<"teams">

// Delete team
api.teams.deleteTeam({ teamId: Id<"teams"> })
→ void

// Add member
api.teams.addTeamMember({
  teamId: Id<"teams">,
  userId: Id<"users">,
  role: "owner" | "admin" | "member" | "viewer"
})
→ Id<"teamMembers">

// Remove member
api.teams.removeTeamMember({
  teamId: Id<"teams">,
  userId: Id<"users">
})
→ void

// Update member role
api.teams.updateMemberRole({
  teamId: Id<"teams">,
  userId: Id<"users">,
  role: "owner" | "admin" | "member" | "viewer"
})
→ Id<"teamMembers">
```

**Team Invitations:**
```typescript
// Create invitation
api.teams.createInvitation({
  teamId: Id<"teams">,
  email: string,
  role: "admin" | "member" | "viewer",
  customMessage?: string
})
→ { invitationId: Id<"teamInvitations">, token: string }

// Accept invitation
api.teams.acceptInvitation({ token: string })
→ Id<"teamMembers">

// Cancel invitation
api.teams.cancelInvitation({ invitationId: Id<"teamInvitations"> })
→ void
```

---

### 8. reports.ts (Client Reports)

**Queries:**
```typescript
// Get reports for project
api.reports.getReports({ projectId: Id<"projects"> })
→ Array<Report>

// Get report by token (public access, no auth)
api.reports.getReportByToken({ token: string })
→ Report | null
```

**Mutations:**
```typescript
// Create report
api.reports.createReport({
  projectId: Id<"projects">,
  name: string,
  settings: {
    domainsIncluded: Array<Id<"domains">>,
    showSearchVolume: boolean,
    showDifficulty: boolean,
    allowKeywordProposals: boolean,
    updateFrequency?: "daily" | "weekly" | "monthly" | "manual",
    customization?: {
      logoUrl?: string,
      brandColor?: string,
      introText?: string
    }
  }
})
→ { reportId: Id<"reports">, token: string }

// Update report
api.reports.updateReport({
  reportId: Id<"reports">,
  name?: string,
  settings?: { ... }
})
→ Id<"reports">

// Delete report
api.reports.deleteReport({ reportId: Id<"reports"> })
→ void

// Update report data (regenerate)
api.reports.updateReportData({ reportId: Id<"reports"> })
→ void
```

---

### 9. generatedReports.ts (PDF/CSV Downloads)

**Queries:**
```typescript
// Get generated reports
api.generatedReports.getGeneratedReports({ projectId: Id<"projects"> })
→ Array<GeneratedReport & {
  status: "generating" | "ready" | "failed",
  progress: number,  // 0-100
  fileUrl?: string
}>

// Get report status
api.generatedReports.getReportStatus({ reportId: Id<"generatedReports"> })
→ { status: string, progress: number, fileUrl?: string, error?: string }
```

**Actions:**
```typescript
// Generate report
api.generatedReports.generateReport({
  projectId: Id<"projects">,
  reportType: "summary" | "detailed" | "executive",
  format: "pdf" | "csv" | "excel",
  dateRange: { start: string, end: string },  // "YYYY-MM-DD"
  domainsIncluded: Array<Id<"domains">>
})
→ Id<"generatedReports">

// Send report via email
api.generatedReports.sendReportEmail({
  reportId: Id<"generatedReports">,
  recipientEmail: string
})
→ { success: boolean }
```

---

### 10. proposals.ts (Keyword Proposals)

**Queries:**
```typescript
// Get proposals for project
api.proposals.getProposals({ projectId: Id<"projects"> })
→ Array<KeywordProposal & {
  status: "pending" | "approved" | "rejected",
  searchVolume?: number,
  difficulty?: number
}>

// Get proposals by report
api.proposals.getProposalsByReport({ reportId: Id<"reports"> })
→ Array<KeywordProposal>
```

**Mutations:**
```typescript
// Create proposal (from client)
api.proposals.createProposal({
  reportId: Id<"reports">,
  clientId: Id<"clients">,
  phrase: string
})
→ Id<"keywordProposals">

// Review proposal
api.proposals.reviewProposal({
  proposalId: Id<"keywordProposals">,
  status: "approved" | "rejected",
  reviewedBy: Id<"users">
})
→ Id<"keywordProposals">

// Approve + add to monitoring
api.proposals.promoteProposal({
  proposalId: Id<"keywordProposals">,
  domainId: Id<"domains">
})
→ Id<"keywords">
```

---

### 11. dashboard.ts (Analytics)

**Queries:**
```typescript
// Get overview stats
api.dashboard.getOverviewStats({ organizationId: Id<"organizations"> })
→ {
  totalProjects: number,
  totalDomains: number,
  totalKeywords: number,
  avgPosition: number,
  positionDistribution: {
    pos_1_3: number,
    pos_4_10: number,
    pos_11_20: number,
    pos_21_50: number,
    pos_51_100: number,
    pos_100_plus: number
  }
}

// Get recent activity
api.dashboard.getRecentActivity({
  organizationId: Id<"organizations">,
  limit?: number
})
→ Array<{
  type: "keyword_added" | "domain_checked" | "position_change" | ...,
  timestamp: number,
  details: any
}>

// Get top movers (gainers/losers)
api.dashboard.getTopMovers({
  organizationId: Id<"organizations">,
  days: number
})
→ {
  gainers: Array<{ keyword: string, domain: string, change: number, ... }>,
  losers: Array<{ keyword: string, domain: string, change: number, ... }>
}

// Get visibility trend
api.dashboard.getVisibilityTrend({
  domainId: Id<"domains">,
  days: number
})
→ Array<{ date: string, visibility: number, ... }>
```

---

### 12. admin.ts (Super Admin - 1,434 LOC)

**User Management:**
```typescript
// List all users
api.admin.listAllUsers({
  filter?: { role?: string, status?: string },
  pagination?: { page: number, pageSize: number }
})
→ { users: Array<User>, totalCount: number }

// Get user details
api.admin.getUserDetails({ userId: Id<"users"> })
→ User & {
  organizations: Array<{ orgId: Id, role: string }>,
  teams: Array<{ teamId: Id, role: string }>,
  lastLogin?: number
}

// Grant super admin
api.admin.grantSuperAdmin({ userId: Id<"users">, grantedBy: Id<"users"> })
→ void

// Suspend user
api.admin.suspendUser({ userId: Id<"users">, reason?: string })
→ void

// Delete user (cascade)
api.admin.deleteUser({ userId: Id<"users"> })
→ void
```

**Organization Management:**
```typescript
// List all organizations
api.admin.listAllOrganizations({
  filter?: { status?: string },
  pagination?: { page: number, pageSize: number }
})
→ { organizations: Array<Organization>, totalCount: number }

// Get org details
api.admin.getOrganizationDetails({ orgId: Id<"organizations"> })
→ Organization & {
  members: Array<{ userId: Id, role: string }>,
  usage: { keywords: number, domains: number, projects: number }
}

// Update org limits
api.admin.updateOrganizationLimits({
  orgId: Id<"organizations">,
  limits: {
    maxKeywords?: number,
    maxProjects?: number,
    maxDomains?: number
  }
})
→ void

// Suspend organization
api.admin.suspendOrganization({ orgId: Id<"organizations">, reason?: string })
→ void
```

**API Usage & Logs:**
```typescript
// Get API usage logs
api.admin.getAPIUsageLogs({
  filter?: {
    provider?: "dataforseo" | "seranking",
    date?: string,
    organizationId?: Id<"organizations">
  }
})
→ Array<APIUsageLog>

// Get total costs
api.admin.getTotalCosts({
  dateRange: { start: string, end: string },
  provider?: "dataforseo" | "seranking"
})
→ { totalCost: number, breakdown: { ... } }

// Get system logs
api.admin.getSystemLogs({
  filter?: {
    level?: "info" | "warning" | "error",
    eventType?: string,
    userId?: Id<"users">
  }
})
→ Array<SystemLog>

// Get audit logs
api.admin.getAuditLogs({
  filter?: { adminUserId?: Id<"users">, targetType?: string }
})
→ Array<AuditLog>
```

**System Config:**
```typescript
// Get config value
api.admin.getSystemConfig({ key: string })
→ any

// Set config value
api.admin.setSystemConfig({ key: string, value: any })
→ void
```

---

### 13. permissions.ts (RBAC - 723 LOC)

**Permission Checking (Internal Helpers):**
```typescript
// These are helper functions used internally in mutations
// Frontend doesn't call these directly, but backend uses them

// Get user role in organization
getUserRoleInOrganization(ctx, orgId, userId)
→ "owner" | "admin" | "member" | "viewer" | "custom"

// Check if user has permission
hasPermission(role, permission)
→ boolean

// Require permission (throws if no access)
requirePermission(ctx, permission, context)
→ void | throws Error

// Get context from domain
getContextFromDomain(ctx, domainId)
→ { organizationId, projectId, domainId }
```

**Permissions List:**
- `org.manage`, `org.delete`, `org.view_billing`
- `teams.create`, `teams.view`, `teams.manage`, `teams.delete`, `teams.invite_members`
- `projects.create`, `projects.view`, `projects.manage`, `projects.delete`
- `domains.create`, `domains.view`, `domains.manage`, `domains.delete`, `domains.refresh`
- `keywords.create`, `keywords.view`, `keywords.manage`, `keywords.delete`, `keywords.approve_proposals`
- `reports.create`, `reports.view`, `reports.manage`, `reports.delete`
- `members.invite`, `members.view`, `members.manage`, `members.remove`, `members.assign_roles`

---

### 14. limits.ts (Keyword Limits)

**Queries:**
```typescript
// Get domain limits (cascades from domain → project → org)
api.limits.getDomainLimits({ domainId: Id<"domains"> })
→ {
  maxKeywords: number,
  currentKeywords: number,
  remaining: number
}

// Check if can add keywords
api.limits.canAddKeywords({
  domainId: Id<"domains">,
  count: number
})
→ boolean

// Get remaining slots
api.limits.getRemainingKeywordSlots({ domainId: Id<"domains"> })
→ number
```

**Mutations:**
```typescript
// Update organization limits (admin only)
api.limits.updateOrganizationLimits({
  organizationId: Id<"organizations">,
  limits: {
    maxKeywords?: number,
    maxProjects?: number,
    maxDomains?: number
  }
})
→ void

// Update project limits
api.limits.updateProjectLimits({
  projectId: Id<"projects">,
  limits: { maxDomains?: number, maxKeywordsPerDomain?: number }
})
→ void

// Update domain limits
api.limits.updateDomainLimits({
  domainId: Id<"domains">,
  limits: { maxKeywords?: number }
})
→ void
```

---

## Usage Examples (Frontend)

### Example 1: Fetch Projects with Stats
```typescript
"use client";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export default function ProjectsList({ teamId }) {
  const projects = useQuery(api.projects.getProjects, { teamId });

  if (!projects) return <div>Loading...</div>;

  return (
    <ul>
      {projects.map(project => (
        <li key={project._id}>
          {project.name} - {project.domainCount} domains, {project.keywordCount} keywords
        </li>
      ))}
    </ul>
  );
}
```

### Example 2: Create Domain
```typescript
"use client";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export default function AddDomainButton({ projectId }) {
  const createDomain = useMutation(api.domains.createDomain);

  const handleAdd = async () => {
    await createDomain({
      projectId,
      domain: "example.com",
      settings: {
        refreshFrequency: "daily",
        searchEngine: "google.pl",
        location: "Poland",
        language: "pl"
      }
    });
  };

  return <button onClick={handleAdd}>Add Domain</button>;
}
```

### Example 3: Check Positions (Background Job)
```typescript
"use client";
import { useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";

export default function CheckPositionsButton({ domainId }) {
  const fetchPositions = useAction(api.dataforseo.fetchPositions);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const result = await fetchPositions({ domainId });
      console.log("Checked", result.processedCount, "keywords");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <button onClick={handleCheck} disabled={isChecking}>
      {isChecking ? "Checking..." : "Check Positions"}
    </button>
  );
}
```

---

## Important Notes for AI

### ✅ DO:
- Use these functions as-is (they're already implemented)
- Call them with correct arguments (TypeScript will help)
- Handle loading states (`useQuery` returns `undefined` while loading)
- Handle errors (wrap mutations in try-catch)

### ❌ DON'T:
- Re-implement these functions (they exist in /convex/)
- Modify function signatures (backend is frozen)
- Skip permission checks (backend enforces them)
- Call mutations directly from server components (only from client components)

### 🔧 Pattern:
```typescript
// Query (reactive, read-only)
const data = useQuery(api.module.functionName, { arg: value });

// Mutation (write data)
const mutateFn = useMutation(api.module.functionName);
await mutateFn({ arg: value });

// Action (external API call)
const actionFn = useAction(api.module.functionName);
const result = await actionFn({ arg: value });
```

---

**Last Updated:** 2026-01-29
**Session:** S0049
**Purpose:** Quick reference for AI to know what backend APIs exist
