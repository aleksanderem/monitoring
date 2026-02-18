# Roles & Permissions System Design

Date: 2026-02-16
Status: Approved

## Context

The monitoring application needs a multi-tenant roles and permissions system where:
- Super admin oversees all tenants and their users
- Tenants can assign permissions up to their own level (cascading down)
- Plans (Free/Pro/Enterprise) define available modules and limits per organization

## Architecture: Permission Ceiling

Every permission check resolves effective permissions as: `intersection(plan_permissions, role_permissions, granted_permissions)`.

No one can grant permissions they don't have themselves. Plan sets the absolute ceiling. Owner gets everything the plan allows. Each lower role gets a subset.

## Data Model

### New table: `plans`

```
plans:
  name: string              // "Free", "Pro", "Enterprise"
  key: string               // "free", "pro", "enterprise"
  permissions: string[]     // allowed permission keys for this plan
  modules: string[]         // "positioning", "backlinks", "seo_audit", "reports", "competitors", "ai_strategy", "forecasts", "link_building"
  limits: {
    maxKeywords, maxDomains, maxProjects,
    maxDomainsPerProject, maxKeywordsPerDomain,
    maxDailyRefreshes, refreshCooldownMinutes,
    maxKeywordsPerBulkRefresh, maxDailyApiCost
  }
  isDefault: boolean
  createdAt: number
```

### Modified: `organizations`

Add field: `planId: v.optional(v.id("plans"))`

### Modified: `organizationMembers`

Add fields:
- `grantedPermissions: v.optional(v.array(v.string()))` — explicit permissions granted by higher-level user
- `grantedBy: v.optional(v.id("users"))` — who granted the permissions

## Modules

| Module | Key | Permissions | Description |
|--------|-----|-------------|-------------|
| Positioning | `positioning` | keywords.*, domains.* | Keyword monitoring, positions |
| Backlinks | `backlinks` | backlinks.view, backlinks.analyze | Backlink analysis, velocity |
| SEO Audit | `seo_audit` | audit.view, audit.run | On-site analysis, crawl, CWV |
| Reports | `reports` | reports.* | Report generation & sharing |
| Competitors | `competitors` | competitors.view, competitors.add, competitors.analyze | Competitor tracking, content gap |
| AI Strategy | `ai_strategy` | ai.research, ai.strategy | AI research, strategy sessions |
| Forecasts | `forecasts` | forecasts.view, forecasts.generate | Forecasting, anomaly detection |
| Link Building | `link_building` | links.view, links.manage | Link prospects, outreach |

## Predefined Plans

- **Free**: `positioning` + `reports` (basic) — maxKeywords: 50, maxDomains: 3
- **Pro**: all except `ai_strategy` + `forecasts` — maxKeywords: 500, maxDomains: 20
- **Enterprise**: all modules — no limits

## Permission Resolution Algorithm

```
getEffectivePermissions(userId, organizationId, projectId?):
  1. Super admin? → return ["*"]
  2. Get plan for organization → planPermissions (ceiling)
  3. Get org membership → role + grantedPermissions
  4. If role = "owner" → return planPermissions
  5. If role = "custom" → get role.permissions
  6. Else → get SYSTEM_ROLE_PERMISSIONS[role]
  7. rolePermissions = intersection(planPermissions, role_permissions)
  8. If grantedPermissions exists → return intersection(rolePermissions, grantedPermissions)
  9. If projectId → check projectMembers override
  10. Return rolePermissions
```

## Cascading Role Assignment

```
assignMemberRole(callerUserId, targetMembershipId, newRole, customPermissions?):
  1. callerPermissions = getEffectivePermissions(caller)
  2. targetRolePermissions = permissions for newRole
  3. Assert: targetRolePermissions ⊆ callerPermissions
  4. If customPermissions → assert: customPermissions ⊆ callerPermissions
  5. If not → throw "Cannot grant permissions you don't have"
```

## Tenant Isolation

New helper `requireTenantAccess(ctx, resourceId)` added to every query and mutation:
1. Resolve organizationId from resource
2. Get userId from auth
3. Super admin → pass
4. Check organizationMembers → pass/fail

~40+ endpoints need this guard added.

## Frontend

### Hooks and Components

- `usePermissions()` — returns `{ permissions, can(p), plan, modules }`
- `<PermissionGate permission="keywords.add">` — conditional rendering
- `<ModuleGate module="backlinks">` — hide sections for unavailable modules

### Super Admin Impersonation

1. Admin clicks "Enter as tenant" in admin panel
2. Audit log entry created
3. `impersonatingOrgId` stored in localStorage
4. Redirect to dashboard with tenant context
5. Yellow banner: "Viewing as: [Org Name] — Return to admin panel"
6. All queries use impersonating org instead of user's org

### Role Management UI (Settings)

- Member list with roles and effective permissions
- Owner can edit all roles except own
- Admin can edit member/viewer but not other admins
- Custom role creation with permission checkboxes
- Disabled checkboxes for permissions the granting user doesn't have
- Visual info: "Permissions limited by plan: [plan name]"

## Scope of Changes

- Schema: new `plans` table, extend `organizations` + `organizationMembers`
- Backend: extend `permissions.ts`, new `plans.ts`, modify ~40 queries/mutations
- Frontend: new hooks, 2 gate components, role management panel in Settings, extend admin panel
- Permissions expanded from 24 → ~36
