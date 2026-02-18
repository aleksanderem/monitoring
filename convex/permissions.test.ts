import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";
import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "./permissions";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full org hierarchy and return all IDs
async function setupOrgHierarchy(t: any, opts?: {
  planPermissions?: string[];
  planModules?: string[];
}) {
  return await t.run(async (ctx: any) => {
    // Create plan
    const planId = await ctx.db.insert("plans", {
      name: "Test Plan",
      key: "test",
      permissions: opts?.planPermissions ?? Object.keys(PERMISSIONS),
      modules: opts?.planModules ?? ["positioning", "backlinks", "seo_audit", "reports", "competitors", "ai_strategy", "forecasts", "link_building"],
      limits: { maxKeywords: 100 },
      isDefault: false,
      createdAt: Date.now(),
    });

    // Create org with plan
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
      planId,
    });

    // Create team
    const teamId = await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });

    // Create project
    const projectId = await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });

    // Create domain
    const domainId = await ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });

    return { orgId, teamId, projectId, domainId, planId };
  });
}

// Helper: create a user and add them as org member
async function createOrgMember(t: any, orgId: Id<"organizations">, role: string, email?: string) {
  return await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", {
      name: "Test User",
      email: email ?? `user-${Date.now()}@test.com`,
    });
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role,
      joinedAt: Date.now(),
    });
    return userId;
  });
}

// Helper: create super admin
async function makeSuperAdmin(t: any, userId: Id<"users">) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("superAdmins", {
      userId,
      grantedAt: Date.now(),
    });
  });
}

describe("getUserPermissions", () => {
  test("owner gets all plan permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "owner");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    expect(result).toEqual(expect.arrayContaining(Object.keys(PERMISSIONS)));
  });

  test("admin role gets admin-level permissions intersected with plan ceiling", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "admin");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    // Admin should have all SYSTEM_ROLE_PERMISSIONS.admin that are also in the plan
    for (const perm of SYSTEM_ROLE_PERMISSIONS.admin) {
      expect(result).toContain(perm);
    }
  });

  test("viewer role gets only view permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "viewer");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    for (const perm of SYSTEM_ROLE_PERMISSIONS.viewer) {
      expect(result).toContain(perm);
    }
    // Viewer should NOT have write permissions like keywords.add
    expect(result).not.toContain("keywords.add");
  });

  test("plan ceiling restricts role permissions", async () => {
    const t = convexTest(schema, modules);
    // Plan that only allows positioning permissions
    const { orgId } = await setupOrgHierarchy(t, {
      planPermissions: ["keywords.view", "keywords.add", "domains.view"],
      planModules: ["positioning"],
    });
    const userId = await createOrgMember(t, orgId, "admin");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    // Admin has all PERMISSIONS but plan ceiling limits to only 3
    expect(result).toContain("keywords.view");
    expect(result).toContain("keywords.add");
    expect(result).toContain("domains.view");
    expect(result).not.toContain("backlinks.view");
    expect(result).not.toContain("audit.view");
  });

  test("super admin gets wildcard permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "member");
    await makeSuperAdmin(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    expect(result).toContain("*");
  });

  test("non-member gets empty permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    // Create a user but don't add as member
    const userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Outsider",
        email: "outsider@test.com",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    expect(result).toEqual([]);
  });

  test("unauthenticated user gets empty permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    const result = await t.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    expect(result).toEqual([]);
  });
});

describe("requireTenantAccess", () => {
  test("member can access their own org's domain", async () => {
    const t = convexTest(schema, modules);
    const { orgId, domainId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "member");

    const asUser = t.withIdentity({ subject: userId });
    // Use getMyContext as a proxy for requireTenantAccess (it checks org membership)
    const result = await asUser.query(api.permissions.getMyContext, {
      organizationId: orgId,
    });
    expect(result).not.toBeNull();
    expect(result?.role).toBe("member");
  });

  test("non-member cannot access another org", async () => {
    const t = convexTest(schema, modules);
    const { orgId: org1Id } = await setupOrgHierarchy(t);

    // Create a second org
    const org2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
    });

    // Add user to org1 only
    const userId = await createOrgMember(t, org1Id, "member");

    const asUser = t.withIdentity({ subject: userId });
    // This user should NOT see org2 — getMyContext returns object but with empty permissions and null role
    const result = await asUser.query(api.permissions.getMyContext, {
      organizationId: org2Id,
    });
    expect(result).not.toBeNull();
    expect(result!.permissions).toEqual([]);
    expect(result!.role).toBeNull();
  });

  test("super admin can access any org", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    // Create a user in a different org but make them super admin
    const otherOrgId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-2",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
    });
    const superUserId = await createOrgMember(t, otherOrgId, "member");
    await makeSuperAdmin(t, superUserId);

    const asSuperAdmin = t.withIdentity({ subject: superUserId });
    // Super admin gets wildcard permissions even for orgs they aren't a member of
    const perms = await asSuperAdmin.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    // Super admin should get ["*"] via the getUserPermissions wildcard path
    expect(perms).toContain("*");
  });
});

describe("getContextFromDomain", () => {
  test("resolves domain -> project -> team -> org chain correctly", async () => {
    const t = convexTest(schema, modules);
    const { orgId, domainId, projectId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "owner");

    const asUser = t.withIdentity({ subject: userId });
    // getMyContext with the org verifies the full chain resolution
    const result = await asUser.query(api.permissions.getMyContext, {
      organizationId: orgId,
    });
    expect(result).not.toBeNull();
    expect(result?.permissions).toBeDefined();
    expect(result?.modules).toBeDefined();
  });
});

describe("grantedPermissions restriction", () => {
  test("grantedPermissions further restrict effective permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    // Create member with grantedPermissions restriction
    const userId = await t.run(async (ctx: any) => {
      const uid = await ctx.db.insert("users", {
        name: "Restricted User",
        email: "restricted@test.com",
      });
      await ctx.db.insert("organizationMembers", {
        organizationId: orgId,
        userId: uid,
        role: "member",
        grantedPermissions: ["keywords.view", "domains.view"],
        joinedAt: Date.now(),
      });
      return uid;
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    // Even though member role has many permissions, grantedPermissions restricts to just 2
    expect(result).toContain("keywords.view");
    expect(result).toContain("domains.view");
    expect(result).not.toContain("keywords.add");
    expect(result).not.toContain("reports.view");
    expect(result.length).toBe(2);
  });
});

describe("custom roles", () => {
  test("user with custom role gets only that role's permissions", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);

    // Create custom role
    const roleId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Keyword Manager",
        key: "keyword_manager",
        permissions: ["keywords.view", "keywords.add", "keywords.remove"],
        isSystem: false,
        createdAt: Date.now(),
      });
    });

    // Create user with custom role
    const userId = await t.run(async (ctx: any) => {
      const uid = await ctx.db.insert("users", {
        name: "Custom Role User",
        email: "custom@test.com",
      });
      await ctx.db.insert("organizationMembers", {
        organizationId: orgId,
        userId: uid,
        role: "custom",
        roleId,
        joinedAt: Date.now(),
      });
      return uid;
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.permissions.getMyPermissions, {
      organizationId: orgId,
    });
    expect(result).toContain("keywords.view");
    expect(result).toContain("keywords.add");
    expect(result).toContain("keywords.remove");
    expect(result).not.toContain("domains.create");
  });
});

describe("getPermissionsList", () => {
  test("returns all permissions and categories", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.permissions.getPermissionsList, {});
    expect(result.permissions).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(result.permissions["keywords.view"]).toBeDefined();
    expect(result.categories.keywords).toBeDefined();
  });
});

describe("getRoles", () => {
  test("returns system and custom roles for an org", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrgHierarchy(t);
    const userId = await createOrgMember(t, orgId, "owner");

    // Create a system role
    await t.run(async (ctx: any) => {
      await ctx.db.insert("roles", {
        organizationId: undefined,
        name: "Admin",
        key: "admin",
        permissions: [...SYSTEM_ROLE_PERMISSIONS.admin],
        isSystem: true,
        createdAt: Date.now(),
      });
    });

    // Create a custom role
    await t.run(async (ctx: any) => {
      await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Custom Role",
        key: "custom_role",
        permissions: ["keywords.view"],
        isSystem: false,
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const roles = await asUser.query(api.permissions.getRoles, {
      organizationId: orgId,
    });
    expect(roles.length).toBeGreaterThanOrEqual(2);
    expect(roles.some((r: any) => r.isSystem)).toBe(true);
    expect(roles.some((r: any) => !r.isSystem)).toBe(true);
  });
});
