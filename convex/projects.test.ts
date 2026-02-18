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

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

// ===========================================================================
// projects.create (simplified)
// ===========================================================================

describe("projects.create", () => {
  test("creates a project under user's first team", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const projectId = await asUser.mutation(api.projects.create, {
      name: "My Project",
    });

    expect(projectId).toBeTruthy();

    const project = await t.run(async (ctx: any) => ctx.db.get(projectId));
    expect(project!.name).toBe("My Project");
    expect(project!.teamId).toBe(teamId);
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.projects.create, { name: "No Auth" })
    ).rejects.toThrow();
  });

  test("throws when user has no team membership", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Lone", email: "lone@test.com" });
    });

    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.mutation(api.projects.create, { name: "Orphan" })
    ).rejects.toThrow("User is not a member of any team");
  });
});

// ===========================================================================
// projects.createProject (with explicit teamId)
// ===========================================================================

describe("projects.createProject", () => {
  test("creates project under specified team", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const projectId = await asUser.mutation(api.projects.createProject, {
      name: "Explicit Project",
      teamId,
    });

    expect(projectId).toBeTruthy();
    const project = await t.run(async (ctx: any) => ctx.db.get(projectId));
    expect(project!.name).toBe("Explicit Project");
    expect(project!.teamId).toBe(teamId);
  });
});

// ===========================================================================
// projects.getProjects
// ===========================================================================

describe("projects.getProjects", () => {
  test("returns projects with domain and keyword counts", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "My Proj",
        createdAt: Date.now(),
      });
    });

    // Add a domain with 2 keywords
    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "kw1",
        status: "active",
        createdAt: Date.now(),
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "kw2",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const projects = await asUser.query(api.projects.getProjects, { teamId });

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("My Proj");
    expect(projects[0].domainCount).toBe(1);
    expect(projects[0].keywordCount).toBe(2);
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projects = await t.query(api.projects.getProjects, { teamId });
    expect(projects).toEqual([]);
  });
});

// ===========================================================================
// projects.getProject
// ===========================================================================

describe("projects.getProject", () => {
  test("returns single project with stats", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Single",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const project = await asUser.query(api.projects.getProject, { projectId });

    expect(project).not.toBeNull();
    expect(project!.name).toBe("Single");
    expect(project!.domainCount).toBe(0);
    expect(project!.keywordCount).toBe(0);
  });
});

// ===========================================================================
// projects.update (simplified)
// ===========================================================================

describe("projects.update", () => {
  test("updates project name", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Old Name",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.projects.update, {
      id: projectId,
      name: "New Name",
    });

    const project = await t.run(async (ctx: any) => ctx.db.get(projectId));
    expect(project!.name).toBe("New Name");
  });
});

// ===========================================================================
// projects.updateProject (with permission check)
// ===========================================================================

describe("projects.updateProject", () => {
  test("updates project name with permission check", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "To Edit",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.projects.updateProject, {
      projectId,
      name: "Edited",
    });

    const project = await t.run(async (ctx: any) => ctx.db.get(projectId));
    expect(project!.name).toBe("Edited");
  });
});

// ===========================================================================
// projects.remove (simplified cascade delete)
// ===========================================================================

describe("projects.remove", () => {
  test("deletes project and cascades to domains and keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Delete Me",
        createdAt: Date.now(),
      });
    });

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "gone.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "bye",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.projects.remove, { id: projectId });

    const project = await t.run(async (ctx: any) => ctx.db.get(projectId));
    expect(project).toBeNull();

    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain).toBeNull();

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword).toBeNull();
  });
});

// ===========================================================================
// projects.deleteProject (with permission check + full cascade)
// ===========================================================================

describe("projects.deleteProject", () => {
  test("deletes project and cascades to domains, keywords, and positions", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Full Delete",
        createdAt: Date.now(),
      });
    });

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "cascade.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "cascade kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const positionId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordPositions", {
        keywordId,
        date: "2025-01-01",
        position: 5,
        url: "https://cascade.com/page",
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.projects.deleteProject, { projectId });

    expect(await t.run(async (ctx: any) => ctx.db.get(projectId))).toBeNull();
    expect(await t.run(async (ctx: any) => ctx.db.get(domainId))).toBeNull();
    expect(await t.run(async (ctx: any) => ctx.db.get(keywordId))).toBeNull();
    expect(await t.run(async (ctx: any) => ctx.db.get(positionId))).toBeNull();
  });
});

// ===========================================================================
// projects.list
// ===========================================================================

describe("projects.list", () => {
  test("returns all projects for user with stats", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("projects", {
        teamId,
        name: "Proj A",
        createdAt: Date.now(),
      });
      await ctx.db.insert("projects", {
        teamId,
        name: "Proj B",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const projects = await asUser.query(api.projects.list, {});

    expect(projects.length).toBeGreaterThanOrEqual(2);
    const names = projects.map((p: any) => p.name);
    expect(names).toContain("Proj A");
    expect(names).toContain("Proj B");
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const projects = await t.query(api.projects.list, {});
    expect(projects).toEqual([]);
  });
});

// ===========================================================================
// projects.getRecentProjects
// ===========================================================================

describe("projects.getRecentProjects", () => {
  test("returns limited recent projects", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert("projects", {
          teamId,
          name: `Project ${i}`,
          createdAt: Date.now() + i,
        });
      }
    });

    const asUser = t.withIdentity({ subject: userId });
    const projects = await asUser.query(api.projects.getRecentProjects, { limit: 3 });

    expect(projects).toHaveLength(3);
  });
});

// ===========================================================================
// projects.getDomains
// ===========================================================================

describe("projects.getDomains", () => {
  test("returns domains for project with keyword counts", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    const projectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Proj",
        createdAt: Date.now(),
      });
    });

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "kw",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const domains = await asUser.query(api.projects.getDomains, { projectId });

    expect(domains).toHaveLength(1);
    expect(domains[0].domain).toBe("example.com");
    expect(domains[0].keywordCount).toBe(1);
  });
});

// ===========================================================================
// Org hierarchy: org -> team -> project -> domain chain
// ===========================================================================

describe("project-domain hierarchy", () => {
  test("full org -> team -> project -> domain chain works end-to-end", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { orgId, teamId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });

    // Create project via mutation
    const projectId = await asUser.mutation(api.projects.createProject, {
      name: "E2E Project",
      teamId,
    });

    // Create domain via mutation
    const domainId = await asUser.mutation(api.domains.create, {
      projectId,
      domain: "e2e.com",
      location: "US",
      language: "en",
    });

    // Verify domain appears in project domains
    const domains = await asUser.query(api.projects.getDomains, { projectId });
    expect(domains).toHaveLength(1);
    expect(domains[0].domain).toBe("e2e.com");

    // Verify project appears in team projects
    const projects = await asUser.query(api.projects.getProjects, { teamId });
    const found = projects.find((p: any) => p._id === projectId);
    expect(found).toBeDefined();
    expect(found.domainCount).toBe(1);

    // Verify role resolution through the hierarchy
    const role = await asUser.query(api.domains.getUserRoleForDomain, { domainId });
    expect(role).toBe("owner");
  });
});
