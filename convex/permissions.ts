import { v } from "convex/values";
import { mutation, query, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";

// =================================================================
// Permission Definitions
// =================================================================

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

  // --- Alerts module ---
  "alerts.view": "Podgląd alertów",
  "alerts.manage": "Zarządzanie regułami alertów",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Permission categories for UI
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
  alerts: {
    label: "Alerty",
    permissions: ["alerts.view", "alerts.manage"],
  },
} as const;

// Default system role permissions
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
    "alerts.view", "alerts.manage",
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
    "alerts.view",
  ] as Permission[],
} as const;

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
  alerts: ["alerts.view", "alerts.manage"],
};

// All modules
export const ALL_MODULES = Object.keys(MODULE_PERMISSIONS);

// =================================================================
// Permission Context Helpers
// =================================================================

export interface PermissionContext {
  organizationId: Id<"organizations">;
  projectId?: Id<"projects">;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  role?: string;
  permissions?: string[];
}

/**
 * Get organization context from a domain
 */
export async function getOrgFromDomain(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">
): Promise<Id<"organizations"> | null> {
  const domain = await ctx.db.get(domainId);
  if (!domain) return null;

  const project = await ctx.db.get(domain.projectId);
  if (!project) return null;

  const team = await ctx.db.get(project.teamId);
  if (!team) return null;

  return team.organizationId;
}

/**
 * Get organization context from a project
 */
export async function getOrgFromProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<Id<"organizations"> | null> {
  const project = await ctx.db.get(projectId);
  if (!project) return null;

  const team = await ctx.db.get(project.teamId);
  if (!team) return null;

  return team.organizationId;
}

// Internal query version for actions
export const getOrgFromProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await getOrgFromProject(ctx, args.projectId);
  },
});

/**
 * Get full permission context from a domain
 */
export async function getContextFromDomain(
  ctx: QueryCtx | MutationCtx,
  domainId: Id<"domains">
): Promise<PermissionContext | null> {
  const domain = await ctx.db.get(domainId);
  if (!domain) return null;

  const project = await ctx.db.get(domain.projectId);
  if (!project) return null;

  const team = await ctx.db.get(project.teamId);
  if (!team) return null;

  return {
    organizationId: team.organizationId,
    projectId: domain.projectId,
  };
}

/**
 * Get full permission context from a keyword
 */
export async function getContextFromKeyword(
  ctx: QueryCtx | MutationCtx,
  keywordId: Id<"keywords">
): Promise<PermissionContext | null> {
  const keyword = await ctx.db.get(keywordId);
  if (!keyword) return null;

  return await getContextFromDomain(ctx, keyword.domainId);
}

// =================================================================
// Permission Check Functions
// =================================================================

/**
 * Get effective permissions for a user in an organization/project.
 * Uses Permission Ceiling: effective = intersection(plan_permissions, role_permissions, granted_permissions).
 * Super admins get ["*"] wildcard.
 */
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

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  permission: string,
  context: PermissionContext
): Promise<PermissionCheckResult> {
  const permissions = await getUserPermissions(
    ctx,
    userId,
    context.organizationId,
    context.projectId
  );

  // Check wildcard or exact permission
  const allowed = permissions.includes("*") || permissions.includes(permission);

  return {
    allowed,
    permissions,
    reason: allowed ? undefined : `Brak uprawnienia: ${PERMISSIONS[permission as Permission] || permission}`,
  };
}

/**
 * Require permission - throws error if not allowed
 * Super admins bypass all permission checks
 * Logs permission check attempts for audit trail
 */
export async function requirePermission(
  ctx: MutationCtx,
  permission: string,
  context: PermissionContext
): Promise<void> {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Nie jesteś zalogowany");
  }

  // Super admins bypass all permission checks
  const superAdminRecord = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  const isSuperAdmin = !!superAdminRecord;

  const result = await checkPermission(ctx, userId, permission, context);
  const allowed = isSuperAdmin || result.allowed;

  // Log permission check for audit trail
  try {
    await ctx.db.insert("systemLogs", {
      level: allowed ? "info" : "warning",
      message: allowed
        ? `Permission granted: ${permission} (org: ${context.organizationId}${context.projectId ? `, project: ${context.projectId}` : ""})`
        : `Permission denied: ${permission} (org: ${context.organizationId}${context.projectId ? `, project: ${context.projectId}` : ""})`,
      eventType: "permission_check",
      userId: userId,
      requestMetadata: {
        body: {
          permission,
          organizationId: context.organizationId,
          projectId: context.projectId,
          isSuperAdmin,
          userPermissions: result.permissions,
        },
      },
      createdAt: Date.now(),
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log permission check:", error);
  }

  if (!allowed) {
    throw new Error(result.reason || "Brak uprawnień");
  }
}

// =================================================================
// Tenant Isolation Helpers
// =================================================================

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

  // Super admin bypass
  const superAdminRecord = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (superAdminRecord) return;

  const result = await checkPermission(ctx, userId, permission, context);

  if (!result.allowed) {
    throw new Error(result.reason || "Brak uprawnień");
  }
}

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

// =================================================================
// Queries
// =================================================================

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

/**
 * Get all roles for an organization (including system roles)
 */
export const getRoles = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    // Get system roles (organizationId = undefined)
    const systemRoles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) => q.eq("organizationId", undefined))
      .collect();

    // Get organization custom roles
    const customRoles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return [...systemRoles, ...customRoles];
  },
});

/**
 * Get a single role
 */
export const getRole = query({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roleId);
  },
});

/**
 * Get permissions list for UI
 */
export const getPermissionsList = query({
  args: {},
  handler: async () => {
    return {
      permissions: PERMISSIONS,
      categories: PERMISSION_CATEGORIES,
    };
  },
});

/**
 * Get user's permissions in a context
 */
export const getMyPermissions = query({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await getUserPermissions(ctx, userId, args.organizationId, args.projectId);
  },
});

// =================================================================
// Mutations - Role CRUD
// =================================================================

/**
 * Create a custom role
 */
export const createRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Nie jesteś zalogowany");

    // Check permission
    await requirePermission(ctx, "members.roles.edit", {
      organizationId: args.organizationId,
    });

    // Generate key from name
    const key = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    // Check if key already exists
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_org_key", (q) =>
        q.eq("organizationId", args.organizationId).eq("key", key)
      )
      .unique();

    if (existing) {
      throw new Error("Rola o takiej nazwie już istnieje");
    }

    return await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: args.name,
      key,
      description: args.description,
      permissions: args.permissions,
      isSystem: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a custom role
 */
export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Nie jesteś zalogowany");

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Rola nie istnieje");

    if (role.isSystem) {
      throw new Error("Nie można edytować ról systemowych");
    }

    if (!role.organizationId) {
      throw new Error("Nie można edytować ról systemowych");
    }

    // Check permission
    await requirePermission(ctx, "members.roles.edit", {
      organizationId: role.organizationId,
    });

    const updates: Partial<Doc<"roles">> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.permissions !== undefined) updates.permissions = args.permissions;

    await ctx.db.patch(args.roleId, updates);
    return args.roleId;
  },
});

/**
 * Delete a custom role
 */
export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Nie jesteś zalogowany");

    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Rola nie istnieje");

    if (role.isSystem) {
      throw new Error("Nie można usunąć ról systemowych");
    }

    if (!role.organizationId) {
      throw new Error("Nie można usunąć ról systemowych");
    }

    // Check permission
    await requirePermission(ctx, "members.roles.edit", {
      organizationId: role.organizationId,
    });

    // Check if any members use this role
    const membersWithRole = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", role.organizationId!))
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .collect();

    if (membersWithRole.length > 0) {
      throw new Error(`Ta rola jest przypisana do ${membersWithRole.length} członków. Najpierw zmień ich role.`);
    }

    await ctx.db.delete(args.roleId);
  },
});

// =================================================================
// Mutations - Role Assignment
// =================================================================

/**
 * Assign a role to organization member
 */
export const assignMemberRole = mutation({
  args: {
    membershipId: v.id("organizationMembers"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
      v.literal("custom")
    ),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Nie jesteś zalogowany");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Członkostwo nie istnieje");

    // Cannot change owner role
    if (membership.role === "owner") {
      throw new Error("Nie można zmienić roli właściciela");
    }

    // Check permission
    await requirePermission(ctx, "members.roles.edit", {
      organizationId: membership.organizationId,
    });

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

    // Validate custom role
    if (args.role === "custom") {
      if (!args.roleId) {
        throw new Error("Wybierz rolę");
      }

      const customRole = await ctx.db.get(args.roleId);
      if (!customRole) {
        throw new Error("Wybrana rola nie istnieje");
      }

      // Verify role belongs to this organization
      if (customRole.organizationId !== membership.organizationId && !customRole.isSystem) {
        throw new Error("Wybrana rola nie należy do tej organizacji");
      }
    }

    await ctx.db.patch(args.membershipId, {
      role: args.role,
      roleId: args.role === "custom" ? args.roleId : undefined,
    });

    return args.membershipId;
  },
});

/**
 * Assign project-level role override
 */
export const assignProjectRole = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    roleId: v.optional(v.id("roles")),
    inheritFromOrg: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) throw new Error("Nie jesteś zalogowany");

    // Get org context
    const organizationId = await getOrgFromProject(ctx, args.projectId);
    if (!organizationId) throw new Error("Projekt nie istnieje");

    // Check permission
    await requirePermission(ctx, "members.roles.edit", { organizationId });

    // Check if user is org member
    const orgMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", args.userId)
      )
      .unique();

    if (!orgMembership) {
      throw new Error("Użytkownik nie jest członkiem organizacji");
    }

    // Check existing project membership
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        roleId: args.inheritFromOrg ? undefined : args.roleId,
        inheritFromOrg: args.inheritFromOrg,
      });
      return existing._id;
    }

    return await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: args.userId,
      roleId: args.inheritFromOrg ? undefined : args.roleId,
      inheritFromOrg: args.inheritFromOrg,
      assignedAt: Date.now(),
    });
  },
});

// =================================================================
// System Role Initialization
// =================================================================

/**
 * Initialize system roles (run once on setup)
 */
export const initSystemRoles = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if system roles already exist
    const existingAdmin = await ctx.db
      .query("roles")
      .withIndex("by_org_key", (q) => q.eq("organizationId", undefined).eq("key", "admin"))
      .unique();

    if (existingAdmin) {
      return { message: "System roles already initialized" };
    }

    // Create system roles
    const systemRoles = [
      {
        name: "Administrator",
        key: "admin",
        description: "Pełny dostęp oprócz zmiany właściciela",
        permissions: SYSTEM_ROLE_PERMISSIONS.admin,
      },
      {
        name: "Członek",
        key: "member",
        description: "Może zarządzać projektami, domenami i frazami",
        permissions: SYSTEM_ROLE_PERMISSIONS.member,
      },
      {
        name: "Obserwator",
        key: "viewer",
        description: "Tylko podgląd",
        permissions: SYSTEM_ROLE_PERMISSIONS.viewer,
      },
    ];

    for (const role of systemRoles) {
      await ctx.db.insert("roles", {
        organizationId: undefined,
        name: role.name,
        key: role.key,
        description: role.description,
        permissions: [...role.permissions],
        isSystem: true,
        createdAt: Date.now(),
      });
    }

    return { message: "System roles initialized" };
  },
});
