# Roles & Permissions System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a multi-tenant roles and permissions system with plan-based module gating, cascading Permission Ceiling hierarchy, tenant isolation on all endpoints, and full frontend permission/module guards.

**Architecture:** Permission Ceiling — effective permissions = intersection(plan_permissions, role_permissions, granted_permissions). Plans define module/limit ceilings per organization. Super admin bypasses all checks. ~70 backend endpoints need tenant isolation guards. Frontend uses `usePermissions()` hook and `<PermissionGate>`/`<ModuleGate>` components.

**Tech Stack:** Convex (schema, queries, mutations), Next.js, React, TypeScript, @convex-dev/auth

**Design Doc:** `docs/plans/2026-02-16-roles-permissions-design.md`

---

## Task 1: Schema — Add `plans` table

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add plans table to schema**

Add after the `authTables` spread and before `organizations`:

```typescript
// Subscription plans (define module/permission/limit ceilings per organization)
plans: defineTable({
  name: v.string(),              // "Free", "Pro", "Enterprise"
  key: v.string(),               // "free", "pro", "enterprise"
  description: v.optional(v.string()),
  permissions: v.array(v.string()), // allowed permission keys
  modules: v.array(v.string()),    // "positioning","backlinks","seo_audit","reports","competitors","ai_strategy","forecasts","link_building"
  limits: v.object({
    maxKeywords: v.optional(v.number()),
    maxDomains: v.optional(v.number()),
    maxProjects: v.optional(v.number()),
    maxDomainsPerProject: v.optional(v.number()),
    maxKeywordsPerDomain: v.optional(v.number()),
    maxDailyRefreshes: v.optional(v.number()),
    refreshCooldownMinutes: v.optional(v.number()),
    maxKeywordsPerBulkRefresh: v.optional(v.number()),
    maxDailyApiCost: v.optional(v.number()),
  }),
  isDefault: v.boolean(),        // assigned to new organizations
  createdAt: v.number(),
})
  .index("by_key", ["key"])
  .index("by_default", ["isDefault"]),
```

**Step 2: Extend organizations table**

Add `planId` field to existing `organizations` table definition:

```typescript
planId: v.optional(v.id("plans")),
```

**Step 3: Extend organizationMembers table**

Add fields to existing `organizationMembers` table:

```typescript
grantedPermissions: v.optional(v.array(v.string())),
grantedBy: v.optional(v.id("users")),
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add plans table and extend org/membership schema for RBAC"
```

---

## Task 2: Backend — Expand permissions definitions

**Files:**
- Modify: `convex/permissions.ts`

**Step 1: Expand PERMISSIONS dictionary**

Replace the existing `PERMISSIONS` and `PERMISSION_CATEGORIES` with expanded versions. Add new module-specific permissions after existing ones:

```typescript
export const PERMISSIONS = {
  // --- Organization ---
  "org.settings.view": "Podgląd ustawień organizacji",
  "org.settings.edit": "Edycja ustawień organizacji",
  "org.limits.view": "Podgląd limitów",
  "org.limits.edit": "Edycja limitów",

  // --- Members ---
  "members.view": "Podgląd listy członków",
  "members.invite": "Zapraszanie członków",
  "members.remove": "Usuwanie członków",
  "members.roles.edit": "Zmiana ról członków",

  // --- Projects ---
  "projects.view": "Podgląd projektów",
  "projects.create": "Tworzenie projektów",
  "projects.edit": "Edycja projektów",
  "projects.delete": "Usuwanie projektów",

  // --- Domains ---
  "domains.view": "Podgląd domen",
  "domains.create": "Dodawanie domen",
  "domains.edit": "Edycja domen",
  "domains.delete": "Usuwanie domen",

  // --- Keywords (positioning module) ---
  "keywords.view": "Podgląd słów kluczowych",
  "keywords.add": "Dodawanie słów kluczowych",
  "keywords.remove": "Usuwanie słów kluczowych",
  "keywords.refresh": "Odświeżanie pozycji",

  // --- Reports ---
  "reports.view": "Podgląd raportów",
  "reports.create": "Tworzenie raportów",
  "reports.edit": "Edycja raportów",
  "reports.share": "Udostępnianie raportów",

  // --- Backlinks module ---
  "backlinks.view": "Podgląd profilu backlinków",
  "backlinks.analyze": "Analiza backlinków",

  // --- SEO Audit module ---
  "audit.view": "Podgląd audytu SEO",
  "audit.run": "Uruchamianie skanów SEO",

  // --- Competitors module ---
  "competitors.view": "Podgląd konkurentów",
  "competitors.add": "Dodawanie konkurentów",
  "competitors.analyze": "Analiza konkurentów",

  // --- AI Strategy module ---
  "ai.research": "Badanie słów kluczowych AI",
  "ai.strategy": "Generowanie strategii AI",

  // --- Forecasts module ---
  "forecasts.view": "Podgląd prognoz",
  "forecasts.generate": "Generowanie prognoz",

  // --- Link Building module ---
  "links.view": "Podgląd prospektów linków",
  "links.manage": "Zarządzanie prospektami linków",
} as const;
```

**Step 2: Update PERMISSION_CATEGORIES**

```typescript
export const PERMISSION_CATEGORIES = {
  org: {
    label: "Organizacja",
    permissions: ["org.settings.view", "org.settings.edit", "org.limits.view", "org.limits.edit"],
  },
  members: {
    label: "Członkowie",
    permissions: ["members.view", "members.invite", "members.remove", "members.roles.edit"],
  },
  projects: {
    label: "Projekty",
    permissions: ["projects.view", "projects.create", "projects.edit", "projects.delete"],
  },
  domains: {
    label: "Domeny",
    permissions: ["domains.view", "domains.create", "domains.edit", "domains.delete"],
  },
  keywords: {
    label: "Słowa kluczowe",
    permissions: ["keywords.view", "keywords.add", "keywords.remove", "keywords.refresh"],
  },
  reports: {
    label: "Raporty",
    permissions: ["reports.view", "reports.create", "reports.edit", "reports.share"],
  },
  backlinks: {
    label: "Backlinki",
    permissions: ["backlinks.view", "backlinks.analyze"],
  },
  audit: {
    label: "Audyt SEO",
    permissions: ["audit.view", "audit.run"],
  },
  competitors: {
    label: "Konkurenci",
    permissions: ["competitors.view", "competitors.add", "competitors.analyze"],
  },
  ai: {
    label: "AI",
    permissions: ["ai.research", "ai.strategy"],
  },
  forecasts: {
    label: "Prognozy",
    permissions: ["forecasts.view", "forecasts.generate"],
  },
  links: {
    label: "Link Building",
    permissions: ["links.view", "links.manage"],
  },
} as const;
```

**Step 3: Update SYSTEM_ROLE_PERMISSIONS**

```typescript
export const SYSTEM_ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS) as Permission[],
  member: [
    "org.settings.view", "org.limits.view",
    "members.view",
    "projects.view", "projects.create", "projects.edit",
    "domains.view", "domains.create", "domains.edit",
    "keywords.view", "keywords.add", "keywords.remove", "keywords.refresh",
    "reports.view", "reports.create", "reports.edit",
    "backlinks.view", "backlinks.analyze",
    "audit.view", "audit.run",
    "competitors.view", "competitors.add", "competitors.analyze",
    "ai.research", "ai.strategy",
    "forecasts.view", "forecasts.generate",
    "links.view", "links.manage",
  ] as Permission[],
  viewer: [
    "org.settings.view", "org.limits.view",
    "members.view",
    "projects.view",
    "domains.view",
    "keywords.view",
    "reports.view",
    "backlinks.view",
    "audit.view",
    "competitors.view",
    "forecasts.view",
    "links.view",
  ] as Permission[],
} as const;
```

**Step 4: Add MODULE_PERMISSIONS mapping**

```typescript
// Maps module keys to the permissions they unlock
export const MODULE_PERMISSIONS: Record<string, Permission[]> = {
  positioning: ["keywords.view", "keywords.add", "keywords.remove", "keywords.refresh", "domains.view", "domains.create", "domains.edit", "domains.delete"],
  backlinks: ["backlinks.view", "backlinks.analyze"],
  seo_audit: ["audit.view", "audit.run"],
  reports: ["reports.view", "reports.create", "reports.edit", "reports.share"],
  competitors: ["competitors.view", "competitors.add", "competitors.analyze"],
  ai_strategy: ["ai.research", "ai.strategy"],
  forecasts: ["forecasts.view", "forecasts.generate"],
  link_building: ["links.view", "links.manage"],
};

// All modules
export const ALL_MODULES = Object.keys(MODULE_PERMISSIONS);
```

**Step 5: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add convex/permissions.ts
git commit -m "feat: expand permissions to 36 with module categories"
```

---

## Task 3: Backend — Plans CRUD (`convex/plans.ts`)

**Files:**
- Create: `convex/plans.ts`

**Step 1: Create plans.ts with CRUD and seed**

```typescript
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { auth } from "./auth";
import { isSuperAdmin, requireSuperAdmin } from "./admin";
import { PERMISSIONS, MODULE_PERMISSIONS, ALL_MODULES, Permission } from "./permissions";

// ─── Queries ────────────────────────────────────────────

export const getPlans = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return [];
    return await ctx.db.query("plans").collect();
  },
});

export const getPlan = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.planId);
  },
});

export const getPlanByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

export const getDefaultPlan = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();
  },
});

// ─── Mutations ──────────────────────────────────────────

export const createPlan = mutation({
  args: {
    name: v.string(),
    key: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    modules: v.array(v.string()),
    limits: v.object({
      maxKeywords: v.optional(v.number()),
      maxDomains: v.optional(v.number()),
      maxProjects: v.optional(v.number()),
      maxDomainsPerProject: v.optional(v.number()),
      maxKeywordsPerDomain: v.optional(v.number()),
      maxDailyRefreshes: v.optional(v.number()),
      refreshCooldownMinutes: v.optional(v.number()),
      maxKeywordsPerBulkRefresh: v.optional(v.number()),
      maxDailyApiCost: v.optional(v.number()),
    }),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    // Verify key uniqueness
    const existing = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) throw new Error("Plan z takim kluczem już istnieje");

    // If setting as default, unset other defaults
    if (args.isDefault) {
      const currentDefault = await ctx.db
        .query("plans")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();
      for (const plan of currentDefault) {
        await ctx.db.patch(plan._id, { isDefault: false });
      }
    }

    return await ctx.db.insert("plans", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("plans"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    modules: v.optional(v.array(v.string())),
    limits: v.optional(v.object({
      maxKeywords: v.optional(v.number()),
      maxDomains: v.optional(v.number()),
      maxProjects: v.optional(v.number()),
      maxDomainsPerProject: v.optional(v.number()),
      maxKeywordsPerDomain: v.optional(v.number()),
      maxDailyRefreshes: v.optional(v.number()),
      refreshCooldownMinutes: v.optional(v.number()),
      maxKeywordsPerBulkRefresh: v.optional(v.number()),
      maxDailyApiCost: v.optional(v.number()),
    })),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan nie istnieje");

    if (args.isDefault) {
      const currentDefault = await ctx.db
        .query("plans")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();
      for (const p of currentDefault) {
        if (p._id !== args.planId) {
          await ctx.db.patch(p._id, { isDefault: false });
        }
      }
    }

    const { planId, ...updates } = args;
    await ctx.db.patch(planId, updates);
    return planId;
  },
});

export const deletePlan = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan nie istnieje");

    // Check if any organizations use this plan
    const orgsUsingPlan = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("planId"), args.planId))
      .collect();

    if (orgsUsingPlan.length > 0) {
      throw new Error(`Ten plan jest używany przez ${orgsUsingPlan.length} organizacji. Najpierw zmień ich plan.`);
    }

    await ctx.db.delete(args.planId);
  },
});

export const assignPlanToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organizacja nie istnieje");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan nie istnieje");

    await ctx.db.patch(args.organizationId, { planId: args.planId });

    // Also update org limits from plan
    await ctx.db.patch(args.organizationId, {
      planId: args.planId,
      limits: plan.limits,
    });

    return args.organizationId;
  },
});

// ─── Seed Data ──────────────────────────────────────────

export const seedPlans = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    // Check if plans already exist
    const existing = await ctx.db.query("plans").first();
    if (existing) throw new Error("Plany już istnieją");

    const allPerms = Object.keys(PERMISSIONS);

    // Free plan
    const freeModules = ["positioning", "reports"];
    const freePerms = [
      "org.settings.view", "org.limits.view",
      "members.view",
      "projects.view", "projects.create", "projects.edit",
      "domains.view", "domains.create", "domains.edit",
      "keywords.view", "keywords.add", "keywords.remove", "keywords.refresh",
      "reports.view", "reports.create",
    ];

    await ctx.db.insert("plans", {
      name: "Free",
      key: "free",
      description: "Podstawowy monitoring pozycji i raporty",
      permissions: freePerms,
      modules: freeModules,
      limits: {
        maxKeywords: 50,
        maxDomains: 3,
        maxProjects: 1,
        maxDomainsPerProject: 3,
        maxKeywordsPerDomain: 50,
        maxDailyRefreshes: 5,
      },
      isDefault: true,
      createdAt: Date.now(),
    });

    // Pro plan
    const proModules = ["positioning", "backlinks", "seo_audit", "reports", "competitors", "link_building"];
    const proPerms = allPerms.filter(
      (p) => !p.startsWith("ai.") && !p.startsWith("forecasts.")
    );

    await ctx.db.insert("plans", {
      name: "Pro",
      key: "pro",
      description: "Pełny monitoring z backlinkami, audytem i konkurencją",
      permissions: proPerms,
      modules: proModules,
      limits: {
        maxKeywords: 500,
        maxDomains: 20,
        maxProjects: 10,
        maxDomainsPerProject: 10,
        maxKeywordsPerDomain: 100,
        maxDailyRefreshes: 50,
      },
      isDefault: false,
      createdAt: Date.now(),
    });

    // Enterprise plan
    await ctx.db.insert("plans", {
      name: "Enterprise",
      key: "enterprise",
      description: "Wszystkie moduły bez limitów",
      permissions: allPerms,
      modules: [...ALL_MODULES],
      limits: {},
      isDefault: false,
      createdAt: Date.now(),
    });

    return { seeded: 3 };
  },
});
```

**Step 2: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add convex/plans.ts
git commit -m "feat: add plans CRUD with seed data for Free/Pro/Enterprise"
```

---

## Task 4: Backend — Rewrite permission resolution with Permission Ceiling

**Files:**
- Modify: `convex/permissions.ts`

**Step 1: Add `getEffectivePermissions` function**

Replace the existing `getUserPermissions` function body (keep the export name for backward compatibility) with Permission Ceiling logic:

```typescript
export async function getUserPermissions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  projectId?: Id<"projects">
): Promise<string[]> {
  // 1. Super admin bypass
  const superAdminRecord = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (superAdminRecord) return ["*"];

  // 2. Get plan ceiling
  const org = await ctx.db.get(organizationId);
  if (!org) return [];

  let planPermissions: string[] | null = null;
  if (org.planId) {
    const plan = await ctx.db.get(org.planId);
    if (plan) {
      planPermissions = plan.permissions;
    }
  }
  // If no plan assigned, no ceiling (backward compat — all permissions available)
  // This allows existing orgs without plans to keep working
  const ceiling = planPermissions ?? Object.keys(PERMISSIONS);

  // 3. Get org membership
  const orgMembership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .unique();

  if (!orgMembership) return [];

  // 4. Owner gets everything the plan allows
  if (orgMembership.role === "owner") {
    return ceiling;
  }

  // 5. Resolve role permissions
  let rolePermissions: string[];

  if (orgMembership.role === "custom" && orgMembership.roleId) {
    const customRole = await ctx.db.get(orgMembership.roleId);
    rolePermissions = customRole ? customRole.permissions : [];
  } else {
    const role = orgMembership.role as keyof typeof SYSTEM_ROLE_PERMISSIONS;
    rolePermissions = role in SYSTEM_ROLE_PERMISSIONS
      ? [...SYSTEM_ROLE_PERMISSIONS[role]]
      : [];
  }

  // 6. Apply plan ceiling: intersection(ceiling, rolePermissions)
  let effective = rolePermissions.filter((p) => ceiling.includes(p));

  // 7. Apply grantedPermissions if set (further restriction by higher-level user)
  if (orgMembership.grantedPermissions) {
    effective = effective.filter((p) => orgMembership.grantedPermissions!.includes(p));
  }

  // 8. Check project-level override
  if (projectId) {
    const projectMember = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();

    if (projectMember && !projectMember.inheritFromOrg && projectMember.roleId) {
      const projectRole = await ctx.db.get(projectMember.roleId);
      if (projectRole) {
        // Project role also bounded by ceiling
        effective = projectRole.permissions.filter((p) => ceiling.includes(p));
      }
    }
  }

  return effective;
}
```

**Step 2: Add `requireTenantAccess` helper**

Add this new function for query-level tenant isolation:

```typescript
/**
 * Verify user belongs to the organization that owns a resource.
 * Use in queries (read-only access). For write operations, use requirePermission().
 * Super admins bypass. Returns the organizationId for further use.
 */
export async function requireTenantAccess(
  ctx: QueryCtx | MutationCtx,
  resourceType: "domain" | "project" | "team" | "organization",
  resourceId: string
): Promise<Id<"organizations">> {
  const userId = await auth.getUserId(ctx);
  if (!userId) throw new Error("Nie jesteś zalogowany");

  // Super admin bypass
  const superAdminRecord = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (superAdminRecord) {
    // Still need to resolve org for data scoping
    let orgId: Id<"organizations"> | null = null;
    if (resourceType === "organization") {
      orgId = resourceId as Id<"organizations">;
    } else if (resourceType === "domain") {
      orgId = await getOrgFromDomain(ctx, resourceId as Id<"domains">);
    } else if (resourceType === "project") {
      orgId = await getOrgFromProject(ctx, resourceId as Id<"projects">);
    } else if (resourceType === "team") {
      const team = await ctx.db.get(resourceId as Id<"teams">);
      orgId = team?.organizationId ?? null;
    }
    if (!orgId) throw new Error("Zasób nie istnieje");
    return orgId;
  }

  // Resolve organizationId
  let organizationId: Id<"organizations"> | null = null;

  if (resourceType === "organization") {
    organizationId = resourceId as Id<"organizations">;
  } else if (resourceType === "domain") {
    organizationId = await getOrgFromDomain(ctx, resourceId as Id<"domains">);
  } else if (resourceType === "project") {
    organizationId = await getOrgFromProject(ctx, resourceId as Id<"projects">);
  } else if (resourceType === "team") {
    const team = await ctx.db.get(resourceId as Id<"teams">);
    organizationId = team?.organizationId ?? null;
  }

  if (!organizationId) throw new Error("Zasób nie istnieje");

  // Check org membership
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId!).eq("userId", userId)
    )
    .unique();

  if (!membership) {
    throw new Error("Brak dostępu do tego zasobu");
  }

  return organizationId;
}
```

**Step 3: Add `requireQueryPermission` for queries**

Since existing `requirePermission` requires `MutationCtx` (for audit logging), add a lighter query version:

```typescript
/**
 * Check permission in a query context (no audit logging).
 * Throws if user lacks the permission.
 */
export async function requireQueryPermission(
  ctx: QueryCtx,
  permission: string,
  context: PermissionContext
): Promise<void> {
  const userId = await auth.getUserId(ctx);
  if (!userId) throw new Error("Nie jesteś zalogowany");

  const result = await checkPermission(ctx, userId, permission, context);

  // Super admin bypass
  const superAdminRecord = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (!superAdminRecord && !result.allowed) {
    throw new Error(result.reason || "Brak uprawnień");
  }
}
```

**Step 4: Add `getOrganizationModules` helper**

```typescript
/**
 * Get available modules for an organization based on its plan.
 */
export async function getOrganizationModules(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<string[]> {
  const org = await ctx.db.get(organizationId);
  if (!org) return [];

  if (!org.planId) {
    // No plan = all modules (backward compat)
    return ALL_MODULES;
  }

  const plan = await ctx.db.get(org.planId);
  return plan?.modules ?? ALL_MODULES;
}
```

**Step 5: Update `assignMemberRole` with cascading check**

In the existing `assignMemberRole` mutation, add before the `ctx.db.patch` call:

```typescript
// Cascading permission check: caller can only assign permissions they have
const callerPermissions = await getUserPermissions(ctx, userId, membership.organizationId);
if (!callerPermissions.includes("*")) {
  let targetPermissions: string[];
  if (args.role === "custom" && args.roleId) {
    const targetRole = await ctx.db.get(args.roleId);
    targetPermissions = targetRole?.permissions ?? [];
  } else {
    const roleKey = args.role as keyof typeof SYSTEM_ROLE_PERMISSIONS;
    targetPermissions = roleKey in SYSTEM_ROLE_PERMISSIONS
      ? [...SYSTEM_ROLE_PERMISSIONS[roleKey]]
      : [];
  }

  const callerCannotGrant = targetPermissions.filter((p) => !callerPermissions.includes(p));
  if (callerCannotGrant.length > 0) {
    throw new Error(`Nie możesz nadać uprawnień których sam nie posiadasz: ${callerCannotGrant.join(", ")}`);
  }
}
```

**Step 6: Export new functions and add query for user's org context**

```typescript
/**
 * Get user's effective permissions and plan info for frontend use
 */
export const getMyContext = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const permissions = await getUserPermissions(ctx, userId, args.organizationId);
    const modules = await getOrganizationModules(ctx, args.organizationId);

    const org = await ctx.db.get(args.organizationId);
    let plan = null;
    if (org?.planId) {
      plan = await ctx.db.get(org.planId);
    }

    // Get membership for role info
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    return {
      permissions,
      modules,
      role: membership?.role ?? null,
      plan: plan ? { name: plan.name, key: plan.key } : null,
    };
  },
});
```

**Step 7: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add convex/permissions.ts
git commit -m "feat: Permission Ceiling resolution with tenant isolation and cascading"
```

---

## Task 5: Backend — Add tenant isolation to domain-related queries

This is the largest task. Add `requireTenantAccess` to all unprotected domain queries.

**Files:**
- Modify: `convex/domains.ts`
- Modify: `convex/keywords.ts`
- Modify: `convex/competitors.ts`

**Pattern for each query:**

For queries that accept `domainId`, add at the top of handler:
```typescript
const userId = await auth.getUserId(ctx);
if (!userId) return <empty>; // null, [], etc.
await requireTenantAccess(ctx, "domain", args.domainId);
```

For queries that accept `projectId`:
```typescript
const userId = await auth.getUserId(ctx);
if (!userId) return <empty>;
await requireTenantAccess(ctx, "project", args.projectId);
```

**Step 1: Fix `convex/domains.ts`**

Add tenant access checks to these exported queries:
- `getDomains` — add project tenant check
- `getDomain` — add domain tenant check
- `getDiscoveredKeywords` — add domain tenant check
- `getDiscoveredKeywordsCount` — add domain tenant check
- `getVisibilityHistory` — add domain tenant check
- `getVisibilityStats` — add domain tenant check
- `getTopKeywords` — add domain tenant check
- `getBacklinksSummary` — add domain tenant check
- `getBacklinks` — add domain tenant check
- `getPositionDistribution` — add domain tenant check
- `getLatestVisibilityMetrics` — add domain tenant check

Add to mutations without checks:
- `markRefreshed` — add domain tenant check
- `ignoreDiscoveredKeywords` — add domain tenant check

Import at top of file:
```typescript
import { requireTenantAccess } from "./permissions";
```

**Step 2: Fix `convex/keywords.ts`**

Add tenant access checks to:
- `getKeywords`
- `getPositionDistribution` (in keywords.ts)
- `getMovementTrend`
- `getMonitoringStats`
- `getKeywordMonitoring`
- `getRecentChanges`
- `getTopPerformers`
- `getTopKeywordsByVolume`
- `getPositionHistory` — resolve domain from keyword first
- `getSerpResultsForKeyword` — resolve domain from keyword
- `getPositionAggregation`
- `clearAllCheckingStatuses` (mutation)

**Step 3: Fix `convex/competitors.ts`**

Add tenant access checks to:
- `getCompetitors`
- `getCompetitorPositions` — resolve through competitor → domain
- `getCompetitorsForKeyword`
- `getCompetitorSuggestionsFromSerp`
- `addCompetitor` (mutation)
- `removeCompetitor` (mutation)
- `updateCompetitor` (mutation)

**Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add convex/domains.ts convex/keywords.ts convex/competitors.ts
git commit -m "feat: add tenant isolation to domain, keyword, and competitor queries"
```

---

## Task 6: Backend — Add tenant isolation to remaining query files

**Files:**
- Modify: `convex/reports.ts` — `getReports` query
- Modify: `convex/proposals.ts` — all queries and mutations
- Modify: `convex/keywordMap_queries.ts` — all queries
- Modify: `convex/forecasts_queries.ts` — all queries
- Modify: `convex/insights_queries.ts` — all queries
- Modify: `convex/serpFeatures_queries.ts` — all queries
- Modify: `convex/backlinkAnalysis_queries.ts` — all queries
- Modify: `convex/contentGaps_queries.ts` — all queries
- Modify: `convex/seoAudit_queries.ts` — all queries
- Modify: `convex/jobs_queries.ts` — filter by org membership
- Modify: `convex/competitorAnalysis.ts` — all queries and mutations
- Modify: `convex/competitors_queries.ts` — all queries
- Modify: `convex/keywordGroups_queries.ts` — all queries
- Modify: `convex/projectDashboard_queries.ts` — all queries
- Modify: `convex/competitorComparison_queries.ts` — all queries

**Pattern:** Same as Task 5. Each file gets `import { requireTenantAccess } from "./permissions"` and each exported query/mutation handler gets the tenant check at the top.

Special case: `jobs_queries.ts` — `getAllJobs` needs to filter jobs by the user's organization. Instead of returning ALL jobs, resolve user's org, get their domains, and only return jobs for those domains.

**Step 1:** Add guards to each file following the pattern.

**Step 2: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add convex/reports.ts convex/proposals.ts convex/keywordMap_queries.ts convex/forecasts_queries.ts convex/insights_queries.ts convex/serpFeatures_queries.ts convex/backlinkAnalysis_queries.ts convex/contentGaps_queries.ts convex/seoAudit_queries.ts convex/jobs_queries.ts convex/competitorAnalysis.ts convex/competitors_queries.ts convex/keywordGroups_queries.ts convex/projectDashboard_queries.ts convex/competitorComparison_queries.ts
git commit -m "feat: add tenant isolation to all remaining query endpoints"
```

---

## Task 7: Backend — Update `auth.ts` to assign default plan on org creation

**Files:**
- Modify: `convex/auth.ts`

**Step 1: Update `afterUserCreatedOrUpdated` callback**

After org creation, find and assign the default plan:

```typescript
// Find default plan and assign
const defaultPlan = await ctx.db
  .query("plans")
  .withIndex("by_default", (q) => q.eq("isDefault", true))
  .first();

if (defaultPlan) {
  await ctx.db.patch(orgId, {
    planId: defaultPlan._id,
    limits: defaultPlan.limits,
  });
}
```

**Step 2: Verify and commit**

```bash
git add convex/auth.ts
git commit -m "feat: assign default plan to new organizations on registration"
```

---

## Task 8: Backend — Update admin.ts with plan management in org details

**Files:**
- Modify: `convex/admin.ts`

**Step 1: Add plan info to `getOrganizationDetails` response**

In the return object, add plan data:

```typescript
const plan = org.planId ? await ctx.db.get(org.planId) : null;

return {
  ...org,
  // ... existing fields ...
  plan: plan ? { _id: plan._id, name: plan.name, key: plan.key, modules: plan.modules } : null,
};
```

**Step 2: Add plan info to `listAllOrganizations`**

In the enrichment loop, add:

```typescript
const plan = org.planId ? await ctx.db.get(org.planId) : null;

return {
  // ... existing fields ...
  planName: plan?.name ?? "Brak planu",
  planKey: plan?.key ?? null,
};
```

**Step 3: Verify and commit**

```bash
git add convex/admin.ts
git commit -m "feat: add plan info to admin organization views"
```

---

## Task 9: Frontend — Create `usePermissions` hook and context

**Files:**
- Create: `src/hooks/usePermissions.ts`
- Create: `src/contexts/PermissionsContext.tsx`

**Step 1: Create PermissionsContext**

```typescript
// src/contexts/PermissionsContext.tsx
"use client";

import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface PermissionsContextValue {
  permissions: string[];
  modules: string[];
  role: string | null;
  plan: { name: string; key: string } | null;
  isLoading: boolean;
  can: (permission: string) => boolean;
  hasModule: (module: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: [],
  modules: [],
  role: null,
  plan: null,
  isLoading: true,
  can: () => false,
  hasModule: () => false,
});

export function PermissionsProvider({
  organizationId,
  children,
}: {
  organizationId: Id<"organizations"> | undefined;
  children: ReactNode;
}) {
  const context = useQuery(
    api.permissions.getMyContext,
    organizationId ? { organizationId } : "skip"
  );

  const value = useMemo<PermissionsContextValue>(() => {
    if (!context) {
      return {
        permissions: [],
        modules: [],
        role: null,
        plan: null,
        isLoading: context === undefined,
        can: () => false,
        hasModule: () => false,
      };
    }

    const perms = context.permissions;
    const isWildcard = perms.includes("*");

    return {
      permissions: perms,
      modules: context.modules,
      role: context.role,
      plan: context.plan,
      isLoading: false,
      can: (permission: string) => isWildcard || perms.includes(permission),
      hasModule: (module: string) => context.modules.includes(module),
    };
  }, [context]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
```

**Step 2: Create standalone hook file**

```typescript
// src/hooks/usePermissions.ts
export { usePermissions } from "@/contexts/PermissionsContext";
```

**Step 3: Verify and commit**

```bash
git add src/contexts/PermissionsContext.tsx src/hooks/usePermissions.ts
git commit -m "feat: add PermissionsContext and usePermissions hook"
```

---

## Task 10: Frontend — Create PermissionGate and ModuleGate components

**Files:**
- Create: `src/components/auth/PermissionGate.tsx`
- Create: `src/components/auth/ModuleGate.tsx`

**Step 1: Create PermissionGate**

```typescript
// src/components/auth/PermissionGate.tsx
"use client";

import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
```

**Step 2: Create ModuleGate**

```typescript
// src/components/auth/ModuleGate.tsx
"use client";

import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface ModuleGateProps {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ModuleGate({ module, children, fallback }: ModuleGateProps) {
  const { hasModule, isLoading, plan } = usePermissions();

  if (isLoading) return null;

  if (!hasModule(module)) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-lg font-semibold text-primary mb-2">
          Moduł niedostępny w Twoim planie
        </div>
        <p className="text-sm text-tertiary max-w-md">
          Aktualny plan: <strong>{plan?.name ?? "Brak"}</strong>.
          Skontaktuj się z administratorem, aby uzyskać dostęp do tej funkcji.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
```

**Step 3: Verify and commit**

```bash
git add src/components/auth/PermissionGate.tsx src/components/auth/ModuleGate.tsx
git commit -m "feat: add PermissionGate and ModuleGate components"
```

---

## Task 11: Frontend — Integrate PermissionsProvider into dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Wrap dashboard with PermissionsProvider**

The provider needs the user's organization ID. Add a query for the first org membership:

```typescript
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
```

Inside the component, after auth checks:

```typescript
const userOrgs = useQuery(
  api.organizations.getUserOrganizations,
  isAuthenticated ? {} : "skip"
);
const activeOrgId = userOrgs?.[0]?._id;
```

Wrap the return JSX:

```tsx
<PermissionsProvider organizationId={activeOrgId}>
  <div className="flex min-h-screen bg-primary">
    {/* ... existing content ... */}
  </div>
</PermissionsProvider>
```

**Step 2: Filter sidebar navigation by modules**

Use `usePermissions()` inside the layout to conditionally show/hide nav items. Add module-gated items like competitors, backlinks, etc. if they appear in the sidebar.

Currently the sidebar is static (Projects, Domains, Jobs, Settings). Module gating happens at the domain detail page tab level, not sidebar level. So this step is mainly about wrapping with the provider.

**Step 3: Verify and commit**

```bash
git add src/app/\(dashboard\)/layout.tsx
git commit -m "feat: integrate PermissionsProvider in dashboard layout"
```

---

## Task 12: Frontend — Gate domain detail tabs by modules

**Files:**
- Modify: `src/app/(dashboard)/domains/[domainId]/page.tsx`

**Step 1: Import and use hooks**

```typescript
import { usePermissions } from "@/hooks/usePermissions";
import { ModuleGate } from "@/components/auth/ModuleGate";
import { PermissionGate } from "@/components/auth/PermissionGate";
```

**Step 2: Filter tabs array by modules**

In the tabs definition, wrap module-dependent tabs:

```typescript
const { hasModule, can } = usePermissions();

const tabs = [
  { id: "overview", label: "Przegląd" },
  { id: "monitoring", label: "Monitoring" },
  { id: "keyword-map", label: "Mapa słów" },
  { id: "visibility", label: "Widoczność" },
  ...(hasModule("backlinks") ? [{ id: "backlinks", label: "Backlinki" }] : []),
  ...(hasModule("link_building") ? [{ id: "link-building", label: "Link Building" }] : []),
  ...(hasModule("competitors") ? [{ id: "competitors", label: "Konkurenci" }] : []),
  ...(hasModule("seo_audit") ? [{ id: "onsite", label: "On-Site" }] : []),
  ...(hasModule("competitors") ? [{ id: "content-gaps", label: "Content Gaps" }] : []),
  { id: "insights", label: "Insights" },
  ...(hasModule("ai_strategy") ? [
    { id: "ai-research", label: "AI Research" },
    { id: "strategy", label: "Strategia" },
  ] : []),
  { id: "generators", label: "Generatory" },
  { id: "settings", label: "Ustawienia" },
  ...(isSuperAdmin ? [{ id: "diagnostics", label: "Diagnostyka" }] : []),
];
```

**Step 3: Gate action buttons**

Wrap create/edit/delete buttons with PermissionGate:

```tsx
<PermissionGate permission="keywords.refresh">
  <button onClick={handleRefresh}>Odśwież pozycje</button>
</PermissionGate>
```

**Step 4: Verify and commit**

```bash
git add src/app/\(dashboard\)/domains/\[domainId\]/page.tsx
git commit -m "feat: gate domain tabs by modules and action buttons by permissions"
```

---

## Task 13: Frontend — Gate action buttons in section components

**Files:**
- Modify: `src/components/domain/sections/CompetitorManagementSection.tsx`
- Modify: `src/components/domain/sections/LinkBuildingSection.tsx`
- Modify: `src/components/domain/sections/OnSiteSection.tsx`
- Modify: `src/components/domain/sections/ContentGapSection.tsx`
- Modify: `src/components/domain/sections/AIStrategySection.tsx`
- Modify: `src/components/domain/sections/StrategySection.tsx`

**Pattern for each section:** Import `usePermissions`, wrap action buttons with `<PermissionGate>`.

Examples:
- CompetitorManagementSection: gate "Add Competitor" with `competitors.add`, "Delete" with `competitors.analyze`
- OnSiteSection: gate "Start Scan" with `audit.run`
- AIStrategySection: gate "Generate Strategy" with `ai.strategy`
- LinkBuildingSection: gate "Generate Report" with `links.manage`

**Step 1:** Add PermissionGate wrapping to each section's action buttons.

**Step 2: Verify and commit**

```bash
git add src/components/domain/sections/
git commit -m "feat: gate section action buttons with PermissionGate"
```

---

## Task 14: Frontend — Gate project/domain list action buttons

**Files:**
- Modify: `src/app/(dashboard)/projects/page.tsx`
- Modify: `src/app/(dashboard)/domains/page.tsx`

**Step 1: Gate create/edit/delete buttons**

Wrap with PermissionGate:
- "Create Project" → `projects.create`
- "Edit Project" → `projects.edit`
- "Delete Project" → `projects.delete`
- "Create Domain" → `domains.create`
- "Edit Domain" → `domains.edit`
- "Delete Domain" → `domains.delete`

**Step 2: Verify and commit**

```bash
git add src/app/\(dashboard\)/projects/page.tsx src/app/\(dashboard\)/domains/page.tsx
git commit -m "feat: gate project and domain list action buttons"
```

---

## Task 15: Frontend — Role management panel in Settings

**Files:**
- Create: `src/components/settings/RoleManagement.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

**Step 1: Create RoleManagement component**

Component that shows organization members, their roles, effective permissions. Owner/admin can change roles. Permission checkboxes are disabled for permissions the caller doesn't have.

Key features:
- Table of members with name, email, role, joined date
- Edit role dropdown (owner/admin/member/viewer/custom)
- For custom roles: expandable permission checklist grouped by category
- Checkboxes disabled for permissions the current user doesn't have (ceiling enforcement)
- "Save" button per member
- Uses `api.permissions.assignMemberRole` mutation
- Shows current plan info banner: "Plan: [name] — uprawnienia ograniczone planem"

**Step 2: Add tab/section in Settings page**

Add "Roles & Permissions" section to the settings page.

**Step 3: Verify and commit**

```bash
git add src/components/settings/RoleManagement.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add role management panel to settings page"
```

---

## Task 16: Frontend — Super admin impersonation

**Files:**
- Create: `src/components/admin/ImpersonationBanner.tsx`
- Modify: `src/app/(admin)/admin/organizations/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Create ImpersonationBanner**

Yellow banner at top of dashboard when super admin is impersonating:

```tsx
"use client";

import { useEffect, useState } from "react";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<{
    orgId: string;
    orgName: string;
  } | null>(null);

  useEffect(() => {
    const orgId = localStorage.getItem("impersonatingOrgId");
    const orgName = localStorage.getItem("impersonatingOrgName");
    if (orgId && orgName) {
      setImpersonating({ orgId, orgName });
    }
  }, []);

  if (!impersonating) return null;

  const handleExit = () => {
    localStorage.removeItem("impersonatingOrgId");
    localStorage.removeItem("impersonatingOrgName");
    window.location.href = "/admin/organizations";
  };

  return (
    <div className="bg-warning-solid text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-4 z-50">
      <span>Przeglądasz jako: <strong>{impersonating.orgName}</strong></span>
      <button
        onClick={handleExit}
        className="underline hover:no-underline font-semibold"
      >
        Powrót do panelu admina
      </button>
    </div>
  );
}
```

**Step 2: Add "Enter as tenant" button to admin organizations page**

Button sets `impersonatingOrgId` + `impersonatingOrgName` in localStorage and redirects to `/dashboard`.

**Step 3: Update PermissionsProvider to use impersonating org**

In the dashboard layout, check localStorage for impersonating org and use that instead of the user's own org:

```typescript
const impersonatingOrgId = typeof window !== "undefined"
  ? localStorage.getItem("impersonatingOrgId")
  : null;

const activeOrgId = impersonatingOrgId
  ? (impersonatingOrgId as Id<"organizations">)
  : userOrgs?.[0]?._id;
```

**Step 4: Add ImpersonationBanner to dashboard layout**

Place it above the main content area.

**Step 5: Verify and commit**

```bash
git add src/components/admin/ImpersonationBanner.tsx src/app/\(admin\)/admin/organizations/page.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add super admin impersonation with visual banner"
```

---

## Task 17: Admin — Plan management UI

**Files:**
- Create: `src/app/(admin)/admin/plans/page.tsx`
- Modify: `src/components/admin/admin-sidebar.tsx`

**Step 1: Create plans management page**

Page shows:
- Table of plans (name, key, modules, limits, org count, default badge)
- Create/Edit plan form with:
  - Name, key, description
  - Module checkboxes (all 8 modules)
  - Limit inputs (maxKeywords, maxDomains, etc.)
  - isDefault toggle
- Delete button (disabled if orgs use the plan)
- "Seed Plans" button if no plans exist (calls `api.plans.seedPlans`)

**Step 2: Add "Plans" to admin sidebar**

Add navigation item between Organizations and Users.

**Step 3: Verify and commit**

```bash
git add src/app/\(admin\)/admin/plans/page.tsx src/components/admin/admin-sidebar.tsx
git commit -m "feat: add plan management page to admin panel"
```

---

## Task 18: Admin — Plan assignment on organization detail

**Files:**
- Modify: `src/app/(admin)/admin/organizations/page.tsx`

**Step 1: Add plan selector to org detail view**

When viewing org details, add a dropdown to select/change plan. Uses `api.plans.assignPlanToOrganization` mutation. Shows current plan info and available plans from `api.plans.getPlans`.

**Step 2: Verify and commit**

```bash
git add src/app/\(admin\)/admin/organizations/page.tsx
git commit -m "feat: add plan assignment to admin organization detail"
```

---

## Task 19: Normalize `organizations.ts` to use permission system

**Files:**
- Modify: `convex/organizations.ts`

**Step 1: Replace manual role checks with `requirePermission`**

In `updateOrganization`, replace:
```typescript
if (!membership || !["owner", "admin"].includes(membership.role)) {
```
with:
```typescript
await requirePermission(ctx, "org.settings.edit", { organizationId: args.organizationId });
```

In `inviteMember`, replace manual check with `requirePermission(ctx, "members.invite", ...)`.
In `updateMemberRole`, replace with `requirePermission(ctx, "members.roles.edit", ...)`.
In `removeMember`, replace with `requirePermission(ctx, "members.remove", ...)`.

Add tenant isolation to queries:
- `getOrganization` — already checks membership, OK
- `getOrganizationMembers` — already checks membership, OK

**Step 2: Verify and commit**

```bash
git add convex/organizations.ts
git commit -m "refactor: normalize organizations.ts to use requirePermission"
```

---

## Task 20: Final verification and type check

**Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with no errors

**Step 2: Verify dev server starts**

Run: `npx convex dev` (verify schema pushes cleanly)

**Step 3: Final commit with all remaining changes**

```bash
git add -A
git commit -m "feat: complete roles & permissions system with multi-tenant RBAC"
```

---

## Summary of Deliverables

| Area | Files | Changes |
|------|-------|---------|
| Schema | `convex/schema.ts` | +plans table, +planId on org, +grantedPermissions on membership |
| Permissions | `convex/permissions.ts` | Expanded to 36 perms, Permission Ceiling, tenant isolation helpers |
| Plans | `convex/plans.ts` (new) | CRUD, seed data, plan assignment |
| Auth | `convex/auth.ts` | Auto-assign default plan |
| Admin | `convex/admin.ts` | Plan info in org views |
| Tenant isolation | 15+ convex files | requireTenantAccess on 70+ endpoints |
| Organizations | `convex/organizations.ts` | Normalized to use requirePermission |
| Frontend context | `src/contexts/PermissionsContext.tsx` | Provider + hook |
| Frontend gates | `src/components/auth/` | PermissionGate, ModuleGate |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` | Provider integration, impersonation |
| Domain detail | `domains/[domainId]/page.tsx` | Module-gated tabs, permission-gated buttons |
| Section components | 6 section files | Permission-gated action buttons |
| Settings | Settings page | Role management panel |
| Admin plans | `admin/plans/page.tsx` (new) | Plan CRUD UI |
| Admin orgs | `admin/organizations/page.tsx` | Plan assignment, impersonation button |
| Impersonation | `ImpersonationBanner.tsx` (new) | Yellow banner with exit button |
