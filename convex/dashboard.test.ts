import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create full hierarchy (user -> org -> orgMember -> team -> project -> domain)
 * and return all IDs needed for dashboard tests.
 */
async function setupFullHierarchy(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@test.com",
    } as any);
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Team",
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  return { userId, orgId, teamId };
}

/**
 * Helper: add a project under a team, a domain under the project, and return both IDs.
 */
async function addProjectAndDomain(
  t: ReturnType<typeof convexTest>,
  teamId: any,
  opts?: { projectName?: string; domainName?: string }
) {
  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: opts?.projectName ?? "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: opts?.domainName ?? "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  return { projectId, domainId };
}

/**
 * Helper: insert a keyword on a domain with given status.
 */
async function addKeyword(
  t: ReturnType<typeof convexTest>,
  domainId: any,
  phrase: string,
  status: "active" | "paused" | "pending_approval" = "active"
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("keywords", {
      domainId,
      phrase,
      createdAt: Date.now(),
      status,
    });
  });
}

// =============================================
// _getUserKeywordMeta
// =============================================

describe("_getUserKeywordMeta", () => {
  test("returns null when not authenticated", async () => {
    const t = convexTest(schema, modules);
    // No identity set — unauthenticated call
    const result = await t.query(internal.dashboard._getUserKeywordMeta, {});
    expect(result).toBeNull();
  });

  test("returns null when user has no org membership", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Orphan User",
        email: "orphan@test.com",
      } as any);
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});
    expect(result).toBeNull();
  });

  test("returns empty keywords/domains when org has no projects", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setupFullHierarchy(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});

    expect(result).not.toBeNull();
    expect(result!.keywords).toEqual([]);
    expect(result!.domains).toEqual([]);
    expect(result!.projectsCount).toBe(0);
  });

  test("returns correct domains and keywords for single project + domain", async () => {
    const t = convexTest(schema, modules);
    const { userId, teamId } = await setupFullHierarchy(t);
    const { domainId } = await addProjectAndDomain(t, teamId, {
      domainName: "mysite.com",
    });

    const kwId = await addKeyword(t, domainId, "seo tools");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});

    expect(result).not.toBeNull();
    expect(result!.projectsCount).toBe(1);
    expect(result!.domains).toHaveLength(1);
    expect(result!.domains[0].domain).toBe("mysite.com");
    expect(result!.keywords).toHaveLength(1);
    expect(result!.keywords[0].phrase).toBe("seo tools");
    expect(result!.keywords[0].domainId).toBe(domainId);
  });

  test("returns correct projectsCount across multiple projects", async () => {
    const t = convexTest(schema, modules);
    const { userId, teamId } = await setupFullHierarchy(t);

    await addProjectAndDomain(t, teamId, {
      projectName: "Project A",
      domainName: "a.com",
    });
    await addProjectAndDomain(t, teamId, {
      projectName: "Project B",
      domainName: "b.com",
    });
    await addProjectAndDomain(t, teamId, {
      projectName: "Project C",
      domainName: "c.com",
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});

    expect(result).not.toBeNull();
    expect(result!.projectsCount).toBe(3);
    expect(result!.domains).toHaveLength(3);
    const domainNames = result!.domains.map((d) => d.domain).sort();
    expect(domainNames).toEqual(["a.com", "b.com", "c.com"]);
  });

  test("filters only active keywords (paused and pending_approval excluded)", async () => {
    const t = convexTest(schema, modules);
    const { userId, teamId } = await setupFullHierarchy(t);
    const { domainId } = await addProjectAndDomain(t, teamId);

    await addKeyword(t, domainId, "active keyword 1", "active");
    await addKeyword(t, domainId, "active keyword 2", "active");
    await addKeyword(t, domainId, "paused keyword", "paused");
    await addKeyword(t, domainId, "pending keyword", "pending_approval");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});

    expect(result).not.toBeNull();
    expect(result!.keywords).toHaveLength(2);
    const phrases = result!.keywords.map((k) => k.phrase).sort();
    expect(phrases).toEqual(["active keyword 1", "active keyword 2"]);
  });

  test("aggregates keywords across multiple domains", async () => {
    const t = convexTest(schema, modules);
    const { userId, teamId } = await setupFullHierarchy(t);

    const { domainId: d1 } = await addProjectAndDomain(t, teamId, {
      projectName: "P1",
      domainName: "site1.com",
    });
    const { domainId: d2 } = await addProjectAndDomain(t, teamId, {
      projectName: "P2",
      domainName: "site2.com",
    });

    await addKeyword(t, d1, "keyword a");
    await addKeyword(t, d1, "keyword b");
    await addKeyword(t, d2, "keyword c");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});

    expect(result).not.toBeNull();
    expect(result!.keywords).toHaveLength(3);
    expect(result!.domains).toHaveLength(2);

    // Verify keywords are associated with correct domains
    const kwOnD1 = result!.keywords.filter((k) => k.domainId === d1);
    const kwOnD2 = result!.keywords.filter((k) => k.domainId === d2);
    expect(kwOnD1).toHaveLength(2);
    expect(kwOnD2).toHaveLength(1);
  });

  test("returns correct keyword metadata (id, phrase, domainId, creationTime)", async () => {
    const t = convexTest(schema, modules);
    const { userId, teamId } = await setupFullHierarchy(t);
    const { domainId } = await addProjectAndDomain(t, teamId);

    const kwId = await addKeyword(t, domainId, "rank tracking");

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(internal.dashboard._getUserKeywordMeta, {});

    expect(result).not.toBeNull();
    expect(result!.keywords).toHaveLength(1);

    const kw = result!.keywords[0];
    expect(kw.id).toBe(kwId);
    expect(kw.phrase).toBe("rank tracking");
    expect(kw.domainId).toBe(domainId);
    expect(typeof kw.creationTime).toBe("number");
    expect(kw.creationTime).toBeGreaterThan(0);
  });
});
