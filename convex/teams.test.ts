import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupHierarchy(t: any, userId: string) {
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

  return { orgId, teamId };
}

async function createUser(t: any, name: string, email: string) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name, email });
  });
}

// ===========================================================================
// getTeams
// ===========================================================================

describe("teams.getTeams", () => {
  test("returns teams for an organization with details", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { orgId, teamId } = await setupHierarchy(t, userId);

    // Add a project to the team
    await t.run(async (ctx: any) => {
      await ctx.db.insert("projects", {
        teamId,
        name: "Project 1",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const teams = await asUser.query(api.teams.getTeams, { organizationId: orgId });

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe("Default Team");
    expect(teams[0].isMember).toBe(true);
    expect(teams[0].memberCount).toBe(1);
    expect(teams[0].projectCount).toBe(1);
    expect(teams[0].isOwner).toBe(true);
    expect(teams[0].userRole).toBe("owner");
  });

  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { orgId } = await setupHierarchy(t, userId);

    const teams = await t.query(api.teams.getTeams, { organizationId: orgId });
    expect(teams).toEqual([]);
  });

  test("returns empty array for non-member of org", async () => {
    const t = convexTest(schema, modules);
    const userA = await createUser(t, "Alice", "alice@test.com");
    const { orgId } = await setupHierarchy(t, userA);

    const userB = await createUser(t, "Bob", "bob@test.com");
    const asUserB = t.withIdentity({ subject: userB });
    const teams = await asUserB.query(api.teams.getTeams, { organizationId: orgId });
    expect(teams).toEqual([]);
  });
});

// ===========================================================================
// createTeam
// ===========================================================================

describe("teams.createTeam", () => {
  test("creates a team and adds creator as owner", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { orgId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const teamId = await asUser.mutation(api.teams.createTeam, {
      organizationId: orgId,
      name: "New Team",
    });

    expect(teamId).toBeTruthy();

    const team = await t.run(async (ctx: any) => ctx.db.get(teamId));
    expect(team!.name).toBe("New Team");

    // Verify creator was added as owner
    const members = await t.run(async (ctx: any) => {
      return ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
        .collect();
    });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toEqual(userId);
    expect(members[0].role).toBe("owner");
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { orgId } = await setupHierarchy(t, userId);

    await expect(
      t.mutation(api.teams.createTeam, { organizationId: orgId, name: "Fail" })
    ).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// getTeamMembers
// ===========================================================================

describe("teams.getTeamMembers", () => {
  test("returns team members with user details", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const members = await asUser.query(api.teams.getTeamMembers, { teamId });

    expect(members).toHaveLength(1);
    expect(members[0].name).toBe("Alice");
    expect(members[0].role).toBe("owner");
  });

  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const members = await t.query(api.teams.getTeamMembers, { teamId });
    expect(members).toEqual([]);
  });
});

// ===========================================================================
// addTeamMember
// ===========================================================================

describe("teams.addTeamMember", () => {
  test("adds a new member to the team", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const newUser = await createUser(t, "Bob", "bob@test.com");

    const asUser = t.withIdentity({ subject: userId });
    const memberId = await asUser.mutation(api.teams.addTeamMember, {
      teamId,
      userId: newUser,
    });

    expect(memberId).toBeTruthy();

    const members = await t.run(async (ctx: any) => {
      return ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
        .collect();
    });
    expect(members).toHaveLength(2);

    const bobMembership = members.find((m: any) => m.userId === newUser);
    expect(bobMembership).toBeTruthy();
    expect(bobMembership!.role).toBe("member"); // default role
  });

  test("returns existing membership id if already a member", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const existingId = await asUser.mutation(api.teams.addTeamMember, {
      teamId,
      userId,
    });

    expect(existingId).toBeTruthy();

    // Should still have only 1 member
    const members = await t.run(async (ctx: any) => {
      return ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
        .collect();
    });
    expect(members).toHaveLength(1);
  });
});

// ===========================================================================
// updateTeam
// ===========================================================================

describe("teams.updateTeam", () => {
  test("updates team name", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.teams.updateTeam, { teamId, name: "Renamed Team" });

    const team = await t.run(async (ctx: any) => ctx.db.get(teamId));
    expect(team!.name).toBe("Renamed Team");
  });

  test("throws for non-member", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const outsider = await createUser(t, "Eve", "eve@test.com");
    const asEve = t.withIdentity({ subject: outsider });

    await expect(
      asEve.mutation(api.teams.updateTeam, { teamId, name: "Hacked" })
    ).rejects.toThrow("Not authorized");
  });
});

// ===========================================================================
// deleteTeam
// ===========================================================================

describe("teams.deleteTeam", () => {
  test("owner can delete team, cascades members and projects", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    // Add a project
    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "To Delete",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.teams.deleteTeam, { teamId });

    const team = await t.run(async (ctx: any) => ctx.db.get(teamId));
    expect(team).toBeNull();

    const project = await t.run(async (ctx: any) => ctx.db.get(projectId));
    expect(project).toBeNull();

    const members = await t.run(async (ctx: any) => {
      return ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
        .collect();
    });
    expect(members).toHaveLength(0);
  });

  test("non-owner cannot delete team", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const bob = await createUser(t, "Bob", "bob@test.com");
    // Add Bob as regular member
    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: bob,
        role: "member",
        joinedAt: Date.now() + 1000, // joined after Alice
      });
    });

    const asBob = t.withIdentity({ subject: bob });
    await expect(
      asBob.mutation(api.teams.deleteTeam, { teamId })
    ).rejects.toThrow("Only the team owner");
  });
});

// ===========================================================================
// leaveTeam
// ===========================================================================

describe("teams.leaveTeam", () => {
  test("member can leave team", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const bob = await createUser(t, "Bob", "bob@test.com");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: bob,
        role: "member",
        joinedAt: Date.now() + 1000,
      });
    });

    const asBob = t.withIdentity({ subject: bob });
    await asBob.mutation(api.teams.leaveTeam, { teamId });

    const members = await t.run(async (ctx: any) => {
      return ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
        .collect();
    });
    expect(members).toHaveLength(1); // Only Alice remains
  });

  test("owner cannot leave while others remain", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const bob = await createUser(t, "Bob", "bob@test.com");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: bob,
        role: "member",
        joinedAt: Date.now() + 1000,
      });
    });

    const asAlice = t.withIdentity({ subject: userId });
    await expect(
      asAlice.mutation(api.teams.leaveTeam, { teamId })
    ).rejects.toThrow("Team owner cannot leave");
  });

  test("last member leaving deletes the team", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const asAlice = t.withIdentity({ subject: userId });
    await asAlice.mutation(api.teams.leaveTeam, { teamId });

    const team = await t.run(async (ctx: any) => ctx.db.get(teamId));
    expect(team).toBeNull();
  });
});

// ===========================================================================
// getTeamDetails
// ===========================================================================

describe("teams.getTeamDetails", () => {
  test("returns full team details with members and projects", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("projects", {
        teamId,
        name: "Project 1",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const details = await asUser.query(api.teams.getTeamDetails, { teamId });

    expect(details).not.toBeNull();
    expect(details!.name).toBe("Default Team");
    expect(details!.members).toHaveLength(1);
    expect(details!.projects).toHaveLength(1);
    expect(details!.isMember).toBe(true);
    expect(details!.isOwner).toBe(true);
    expect(details!.memberCount).toBe(1);
    expect(details!.projectCount).toBe(1);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const details = await t.query(api.teams.getTeamDetails, { teamId });
    expect(details).toBeNull();
  });
});

// ===========================================================================
// removeMember
// ===========================================================================

describe("teams.removeMember", () => {
  test("owner can remove a regular member", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const bob = await createUser(t, "Bob", "bob@test.com");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: bob,
        role: "member",
        joinedAt: Date.now() + 1000,
      });
    });

    const asAlice = t.withIdentity({ subject: userId });
    await asAlice.mutation(api.teams.removeMember, { teamId, userId: bob });

    const members = await t.run(async (ctx: any) => {
      return ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
        .collect();
    });
    expect(members).toHaveLength(1); // Only Alice
  });

  test("cannot remove team owner", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Alice", "alice@test.com");
    const { teamId } = await setupHierarchy(t, userId);

    const bob = await createUser(t, "Bob", "bob@test.com");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: bob,
        role: "admin",
        joinedAt: Date.now() + 1000,
      });
    });

    // Bob (admin) tries to remove Alice (owner)
    const asBob = t.withIdentity({ subject: bob });
    await expect(
      asBob.mutation(api.teams.removeMember, { teamId, userId })
    ).rejects.toThrow("Cannot remove team owner");
  });
});
