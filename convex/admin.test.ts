import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(t: any, name: string, email: string) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name, email });
  });
}

async function makeSuperAdmin(t: any, userId: string, grantedBy?: string) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("superAdmins", {
      userId,
      grantedBy,
      grantedAt: Date.now(),
    });
  });
}

async function setupOrgHierarchy(t: any, userId: string) {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx: any) => {
    return ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx: any) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  return { orgId, teamId, projectId };
}

// ===========================================================================
// checkIsSuperAdmin
// ===========================================================================

describe("admin.checkIsSuperAdmin", () => {
  test("returns true for super admin", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.admin.checkIsSuperAdmin, {});
    expect(result).toBe(true);
  });

  test("returns false for regular user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.admin.checkIsSuperAdmin, {});
    expect(result).toBe(false);
  });

  test("returns false for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.admin.checkIsSuperAdmin, {});
    expect(result).toBe(false);
  });
});

// ===========================================================================
// getSystemStats
// ===========================================================================

describe("admin.getSystemStats", () => {
  test("returns stats for super admin", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    await setupOrgHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    const stats = await asAdmin.query(api.admin.getSystemStats, {});

    expect(stats).not.toBeNull();
    expect(stats!.users.total).toBeGreaterThanOrEqual(1);
    expect(stats!.organizations.total).toBeGreaterThanOrEqual(1);
    expect(stats!.projects.total).toBeGreaterThanOrEqual(1);
  });

  test("returns null for non-admin", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asUser = t.withIdentity({ subject: userId });
    const stats = await asUser.query(api.admin.getSystemStats, {});
    expect(stats).toBeNull();
  });
});

// ===========================================================================
// listAllOrganizations
// ===========================================================================

describe("admin.listAllOrganizations", () => {
  test("returns organizations with stats for super admin", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    await setupOrgHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.admin.listAllOrganizations, {});

    expect(result.organizations.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.organizations[0].memberCount).toBeGreaterThanOrEqual(1);
  });

  test("returns empty for non-admin", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.admin.listAllOrganizations, {});
    expect(result.organizations).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("supports search filter", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    await setupOrgHierarchy(t, adminId);

    // Create a second org
    await t.run(async (ctx: any) => {
      await ctx.db.insert("organizations", {
        name: "Another Org",
        slug: "another-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.admin.listAllOrganizations, {
      search: "another",
    });

    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0].name).toBe("Another Org");
  });
});

// ===========================================================================
// listAllUsers
// ===========================================================================

describe("admin.listAllUsers", () => {
  test("returns users with enrichment for super admin", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    await setupOrgHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    const result = await asAdmin.query(api.admin.listAllUsers, {});

    expect(result.users.length).toBeGreaterThanOrEqual(1);
    const adminUser = result.users.find((u: any) => u.email === "admin@test.com");
    expect(adminUser).toBeDefined();
    expect(adminUser!.isSuperAdmin).toBe(true);
    expect(adminUser!.organizationCount).toBeGreaterThanOrEqual(1);
  });

  test("returns empty for non-admin", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.admin.listAllUsers, {});
    expect(result.users).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ===========================================================================
// grantSuperAdmin / revokeSuperAdmin
// ===========================================================================

describe("admin.grantSuperAdmin", () => {
  test("grants super admin to a user", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.admin.grantSuperAdmin, { userId });

    // Verify via checkIsSuperAdmin
    const asUser = t.withIdentity({ subject: userId });
    const isSA = await asUser.query(api.admin.checkIsSuperAdmin, {});
    expect(isSA).toBe(true);
  });

  test("throws if user is already super admin", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const userId = await createUser(t, "Other", "other@test.com");
    await makeSuperAdmin(t, userId, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.admin.grantSuperAdmin, { userId })
    ).rejects.toThrow("User is already a super admin");
  });

  test("throws for non-admin caller", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");
    const targetId = await createUser(t, "Target", "target@test.com");

    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.mutation(api.admin.grantSuperAdmin, { userId: targetId })
    ).rejects.toThrow("Super admin access required");
  });
});

describe("admin.revokeSuperAdmin", () => {
  test("revokes super admin from a user", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const userId = await createUser(t, "Other", "other@test.com");
    await makeSuperAdmin(t, userId, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.admin.revokeSuperAdmin, { userId });

    const asUser = t.withIdentity({ subject: userId });
    const isSA = await asUser.query(api.admin.checkIsSuperAdmin, {});
    expect(isSA).toBe(false);
  });

  test("throws when revoking own super admin", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.admin.revokeSuperAdmin, { userId: adminId })
    ).rejects.toThrow("Cannot revoke your own super admin status");
  });
});

// ===========================================================================
// adminSuspendOrganization / adminActivateOrganization
// ===========================================================================

describe("admin.adminSuspendOrganization", () => {
  test("suspends and activates an organization", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { orgId } = await setupOrgHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });

    // Suspend
    await asAdmin.mutation(api.admin.adminSuspendOrganization, {
      organizationId: orgId,
      reason: "Policy violation",
    });

    // Verify suspended via listAllOrganizations
    const listResult = await asAdmin.query(api.admin.listAllOrganizations, {});
    const org = listResult.organizations.find((o: any) => o._id === orgId);
    expect(org!.suspended).toBe(true);

    // Activate
    await asAdmin.mutation(api.admin.adminActivateOrganization, {
      organizationId: orgId,
    });

    // Verify no longer suspended
    const listResult2 = await asAdmin.query(api.admin.listAllOrganizations, {});
    const org2 = listResult2.organizations.find((o: any) => o._id === orgId);
    expect(org2!.suspended).toBe(false);
  });

  test("throws if organization already suspended", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const { orgId } = await setupOrgHierarchy(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.admin.adminSuspendOrganization, {
      organizationId: orgId,
    });

    await expect(
      asAdmin.mutation(api.admin.adminSuspendOrganization, {
        organizationId: orgId,
      })
    ).rejects.toThrow("Organization is already suspended");
  });
});

// ===========================================================================
// adminSuspendUser / adminActivateUser
// ===========================================================================

describe("admin.adminSuspendUser", () => {
  test("suspends and activates a user", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asAdmin = t.withIdentity({ subject: adminId });

    // Suspend
    await asAdmin.mutation(api.admin.adminSuspendUser, {
      userId,
      reason: "Spam",
    });

    // Verify suspended via listAllUsers
    const listResult = await asAdmin.query(api.admin.listAllUsers, {});
    const user = listResult.users.find((u: any) => u._id === userId);
    expect(user!.suspended).toBe(true);

    // Activate
    await asAdmin.mutation(api.admin.adminActivateUser, { userId });

    const listResult2 = await asAdmin.query(api.admin.listAllUsers, {});
    const user2 = listResult2.users.find((u: any) => u._id === userId);
    expect(user2!.suspended).toBe(false);
  });

  test("throws when suspending self", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.admin.adminSuspendUser, { userId: adminId })
    ).rejects.toThrow("Cannot suspend your own account");
  });
});

// ===========================================================================
// initFirstSuperAdmin / bootstrapSuperAdminByEmail
// ===========================================================================

describe("admin.initFirstSuperAdmin", () => {
  test("initializes first super admin when none exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "First Admin", "first@test.com");

    // No identity needed for bootstrap
    const result = await t.mutation(api.admin.initFirstSuperAdmin, { userId });
    expect(result.message).toContain("successfully");

    // Verify
    const asUser = t.withIdentity({ subject: userId });
    const isSA = await asUser.query(api.admin.checkIsSuperAdmin, {});
    expect(isSA).toBe(true);
  });

  test("throws if super admin already exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, userId);

    const otherUserId = await createUser(t, "Other", "other@test.com");

    await expect(
      t.mutation(api.admin.initFirstSuperAdmin, { userId: otherUserId })
    ).rejects.toThrow("Super admin already exists");
  });
});

describe("admin.bootstrapSuperAdminByEmail", () => {
  test("finds user by email and makes them super admin", async () => {
    const t = convexTest(schema, modules);
    await createUser(t, "Bootstrap User", "bootstrap@test.com");

    const result = await t.mutation(api.admin.bootstrapSuperAdminByEmail, {
      email: "bootstrap@test.com",
    });
    expect(result.email).toBe("bootstrap@test.com");
  });

  test("throws if email not found", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.admin.bootstrapSuperAdminByEmail, {
        email: "nonexistent@test.com",
      })
    ).rejects.toThrow("not found");
  });
});

// ===========================================================================
// adminDeleteUser (cascade)
// ===========================================================================

describe("admin.adminDeleteUser", () => {
  test("deletes user and their memberships", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);

    const userId = await createUser(t, "ToDelete", "delete@test.com");
    // Give them an org membership
    const orgId = await t.run(async (ctx: any) => {
      return ctx.db.insert("organizations", {
        name: "User Org",
        slug: "user-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
    });
    await t.run(async (ctx: any) => {
      await ctx.db.insert("organizationMembers", {
        organizationId: orgId,
        userId,
        role: "member",
        joinedAt: Date.now(),
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.admin.adminDeleteUser, { userId });

    // Verify user deleted
    const user = await t.run(async (ctx: any) => ctx.db.get(userId));
    expect(user).toBeNull();

    // Verify memberships cleaned up
    const memberships = await t.run(async (ctx: any) => {
      return ctx.db
        .query("organizationMembers")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();
    });
    expect(memberships).toHaveLength(0);
  });

  test("throws when deleting self", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.admin.adminDeleteUser, { userId: adminId })
    ).rejects.toThrow("Cannot delete your own account");
  });
});

// ===========================================================================
// getAdminAuditLogs
// ===========================================================================

describe("admin.getAdminAuditLogs", () => {
  test("returns audit logs after admin actions", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "Admin", "admin@test.com");
    await makeSuperAdmin(t, adminId);
    const userId = await createUser(t, "Target", "target@test.com");

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.admin.grantSuperAdmin, { userId });

    const logs = await asAdmin.query(api.admin.getAdminAuditLogs, {});
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe("grant_super_admin");
  });

  test("returns empty array for non-admin", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Regular", "regular@test.com");

    const asUser = t.withIdentity({ subject: userId });
    const logs = await asUser.query(api.admin.getAdminAuditLogs, {});
    expect(logs).toEqual([]);
  });
});
