import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";
import { PERMISSIONS } from "./permissions";

const modules = import.meta.glob("./**/*.ts");

// Helper: create an org with an owner and optionally additional members
async function setupOrg(t: any, opts?: { name?: string; slug?: string }) {
  return await t.run(async (ctx: any) => {
    // Create plan for permissions
    const planId = await ctx.db.insert("plans", {
      name: "Pro",
      key: `pro-${Date.now()}`,
      permissions: Object.keys(PERMISSIONS),
      modules: ["positioning", "backlinks", "seo_audit", "reports", "competitors", "ai_strategy", "forecasts", "link_building"],
      limits: {},
      isDefault: false,
      createdAt: Date.now(),
    });

    const orgId = await ctx.db.insert("organizations", {
      name: opts?.name ?? "Test Org",
      slug: opts?.slug ?? `test-org-${Date.now()}`,
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
      planId,
    });

    const ownerId = await ctx.db.insert("users", {
      name: "Owner User",
      email: `owner-${Date.now()}@test.com`,
    });

    const ownerMembershipId = await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId: ownerId,
      role: "owner",
      joinedAt: Date.now(),
    });

    // Create a team for completeness
    const teamId = await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });

    return { orgId, ownerId, ownerMembershipId, teamId, planId };
  });
}

// Helper: add a member to an org
async function addMember(t: any, orgId: Id<"organizations">, role: string, email?: string) {
  return await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", {
      name: `${role} User`,
      email: email ?? `${role}-${Date.now()}@test.com`,
    });

    const membershipId = await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role,
      joinedAt: Date.now(),
    });

    return { userId, membershipId };
  });
}

describe("getUserOrganizations", () => {
  test("returns only the user's orgs", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t, { name: "Org A" });
    const { orgId: orgBId } = await setupOrg(t, { name: "Org B" });

    // Owner of orgA shouldn't see orgB
    const asOwner = t.withIdentity({ subject: ownerId });
    const orgs = await asOwner.query(api.organizations.getUserOrganizations, {});
    expect(orgs.length).toBe(1);
    expect(orgs[0]!.name).toBe("Org A");
    expect(orgs[0]!.role).toBe("owner");
  });

  test("returns multiple orgs if user is member of several", async () => {
    const t = convexTest(schema, modules);
    const { orgId: org1Id } = await setupOrg(t, { name: "Org 1" });
    const { orgId: org2Id } = await setupOrg(t, { name: "Org 2" });

    // Create a user and add to both orgs
    const userId = await t.run(async (ctx: any) => {
      const uid = await ctx.db.insert("users", {
        name: "Multi Org User",
        email: "multi@test.com",
      });
      await ctx.db.insert("organizationMembers", {
        organizationId: org1Id,
        userId: uid,
        role: "member",
        joinedAt: Date.now(),
      });
      await ctx.db.insert("organizationMembers", {
        organizationId: org2Id,
        userId: uid,
        role: "viewer",
        joinedAt: Date.now(),
      });
      return uid;
    });

    const asUser = t.withIdentity({ subject: userId });
    const orgs = await asUser.query(api.organizations.getUserOrganizations, {});
    expect(orgs.length).toBe(2);
    const names = orgs.map((o: any) => o.name);
    expect(names).toContain("Org 1");
    expect(names).toContain("Org 2");
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await setupOrg(t);

    const orgs = await t.query(api.organizations.getUserOrganizations, {});
    expect(orgs).toEqual([]);
  });
});

describe("getOrganization", () => {
  test("returns org with role for member", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t, { name: "My Org" });

    const asOwner = t.withIdentity({ subject: ownerId });
    const org = await asOwner.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org).not.toBeNull();
    expect(org!.name).toBe("My Org");
    expect(org!.role).toBe("owner");
  });

  test("returns null for non-member", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrg(t);
    const outsiderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Outsider",
        email: "outsider@test.com",
      });
    });

    const asOutsider = t.withIdentity({ subject: outsiderId });
    const org = await asOutsider.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org).toBeNull();
  });
});

describe("inviteMember", () => {
  test("adds member with correct role", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t);

    // Create target user
    const targetEmail = "newmember@test.com";
    const targetUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "New Member",
        email: targetEmail,
      });
    });

    const asOwner = t.withIdentity({ subject: ownerId });
    await asOwner.mutation(api.organizations.inviteMember, {
      organizationId: orgId,
      email: targetEmail,
      role: "member",
    });

    // Verify membership was created
    const asNewMember = t.withIdentity({ subject: targetUserId });
    const org = await asNewMember.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org).not.toBeNull();
    expect(org!.role).toBe("member");
  });

  test("fails when user does not exist", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t);

    const asOwner = t.withIdentity({ subject: ownerId });
    await expect(
      asOwner.mutation(api.organizations.inviteMember, {
        organizationId: orgId,
        email: "nonexistent@test.com",
        role: "member",
      })
    ).rejects.toThrow("Nie znaleziono użytkownika");
  });

  test("fails when user is already a member", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t);
    const { userId } = await addMember(t, orgId, "member", "existing@test.com");

    const asOwner = t.withIdentity({ subject: ownerId });
    await expect(
      asOwner.mutation(api.organizations.inviteMember, {
        organizationId: orgId,
        email: "existing@test.com",
        role: "viewer",
      })
    ).rejects.toThrow("Ten użytkownik jest już członkiem organizacji");
  });

  test("requires members.invite permission", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrg(t);
    // Add a viewer (who doesn't have members.invite)
    const { userId: viewerId } = await addMember(t, orgId, "viewer");

    // Create a user to invite
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        name: "To Invite",
        email: "toinvite@test.com",
      });
    });

    const asViewer = t.withIdentity({ subject: viewerId });
    await expect(
      asViewer.mutation(api.organizations.inviteMember, {
        organizationId: orgId,
        email: "toinvite@test.com",
        role: "member",
      })
    ).rejects.toThrow();
  });
});

describe("updateMemberRole", () => {
  test("changes member role", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t);
    const { userId: memberId, membershipId } = await addMember(t, orgId, "member");

    const asOwner = t.withIdentity({ subject: ownerId });
    await asOwner.mutation(api.organizations.updateMemberRole, {
      membershipId,
      role: "admin",
    });

    // Verify role changed
    const asMember = t.withIdentity({ subject: memberId });
    const org = await asMember.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org!.role).toBe("admin");
  });

  test("cannot change owner role", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId, ownerMembershipId } = await setupOrg(t);
    // Add an admin to attempt the change
    const { userId: adminId } = await addMember(t, orgId, "admin");

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.organizations.updateMemberRole, {
        membershipId: ownerMembershipId,
        role: "member",
      })
    ).rejects.toThrow("Nie można zmienić roli właściciela");
  });
});

describe("removeMember", () => {
  test("removes member but not owner", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t);
    const { userId: memberId, membershipId } = await addMember(t, orgId, "member");

    const asOwner = t.withIdentity({ subject: ownerId });
    await asOwner.mutation(api.organizations.removeMember, {
      membershipId,
    });

    // Verify member is gone
    const asMember = t.withIdentity({ subject: memberId });
    const org = await asMember.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org).toBeNull();
  });

  test("cannot remove owner", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId, ownerMembershipId } = await setupOrg(t);
    // Add an admin
    const { userId: adminId } = await addMember(t, orgId, "admin");

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.organizations.removeMember, {
        membershipId: ownerMembershipId,
      })
    ).rejects.toThrow("Nie można usunąć właściciela");
  });

  test("also removes from teams in the org", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId, teamId } = await setupOrg(t);
    const { userId: memberId, membershipId } = await addMember(t, orgId, "member");

    // Add member to team
    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: memberId,
        joinedAt: Date.now(),
      });
    });

    const asOwner = t.withIdentity({ subject: ownerId });
    await asOwner.mutation(api.organizations.removeMember, {
      membershipId,
    });

    // Verify team membership is also removed
    const teamMemberships = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("teamMembers")
        .withIndex("by_user", (q: any) => q.eq("userId", memberId))
        .collect();
    });
    expect(teamMemberships.length).toBe(0);
  });
});

describe("getOrganizationMembers", () => {
  test("returns all members with user info", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t);
    await addMember(t, orgId, "admin");
    await addMember(t, orgId, "viewer");

    const asOwner = t.withIdentity({ subject: ownerId });
    const members = await asOwner.query(api.organizations.getOrganizationMembers, {
      organizationId: orgId,
    });
    expect(members.length).toBe(3); // owner + admin + viewer
    expect(members.some((m: any) => m.role === "owner")).toBe(true);
    expect(members.some((m: any) => m.role === "admin")).toBe(true);
    expect(members.some((m: any) => m.role === "viewer")).toBe(true);
  });

  test("returns empty for non-member", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrg(t);
    const outsiderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Outsider",
        email: "outsider2@test.com",
      });
    });

    const asOutsider = t.withIdentity({ subject: outsiderId });
    const members = await asOutsider.query(api.organizations.getOrganizationMembers, {
      organizationId: orgId,
    });
    expect(members).toEqual([]);
  });
});

describe("tenant isolation", () => {
  test("user A cannot see user B's org data", async () => {
    const t = convexTest(schema, modules);
    const { orgId: orgAId, ownerId: userAId } = await setupOrg(t, { name: "Org A" });
    const { orgId: orgBId, ownerId: userBId } = await setupOrg(t, { name: "Org B" });

    // User A tries to access Org B
    const asUserA = t.withIdentity({ subject: userAId });
    const orgB = await asUserA.query(api.organizations.getOrganization, {
      organizationId: orgBId,
    });
    expect(orgB).toBeNull();

    // User A tries to list Org B members
    const orgBMembers = await asUserA.query(api.organizations.getOrganizationMembers, {
      organizationId: orgBId,
    });
    expect(orgBMembers).toEqual([]);

    // User B can see their own org
    const asUserB = t.withIdentity({ subject: userBId });
    const orgBResult = await asUserB.query(api.organizations.getOrganization, {
      organizationId: orgBId,
    });
    expect(orgBResult).not.toBeNull();
    expect(orgBResult!.name).toBe("Org B");
  });
});

describe("updateOrganization", () => {
  test("owner can update org settings", async () => {
    const t = convexTest(schema, modules);
    const { orgId, ownerId } = await setupOrg(t, { name: "Original Name" });

    const asOwner = t.withIdentity({ subject: ownerId });
    await asOwner.mutation(api.organizations.updateOrganization, {
      organizationId: orgId,
      name: "Updated Name",
      settings: { defaultRefreshFrequency: "weekly" },
    });

    const org = await asOwner.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org!.name).toBe("Updated Name");
    expect(org!.settings.defaultRefreshFrequency).toBe("weekly");
  });

  test("viewer cannot update org settings", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupOrg(t);
    const { userId: viewerId } = await addMember(t, orgId, "viewer");

    const asViewer = t.withIdentity({ subject: viewerId });
    await expect(
      asViewer.mutation(api.organizations.updateOrganization, {
        organizationId: orgId,
        name: "Hacked Name",
      })
    ).rejects.toThrow();
  });
});
