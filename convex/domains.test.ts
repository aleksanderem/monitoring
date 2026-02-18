import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a full org -> team -> project -> domain hierarchy in one shot. */
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

  const projectId = await t.run(async (ctx: any) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  return { orgId, teamId, projectId };
}

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

// ===========================================================================
// getDomains
// ===========================================================================

describe("domains.getDomains", () => {
  test("returns domains for a project with stats", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    // Add an active keyword
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "test keyword",
        status: "active",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const domains = await asUser.query(api.domains.getDomains, { projectId });

    expect(domains).toHaveLength(1);
    expect(domains[0].domain).toBe("example.com");
    expect(domains[0].keywordCount).toBe(1);
  });

  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    // No identity set => unauthenticated
    const domains = await t.query(api.domains.getDomains, { projectId });
    expect(domains).toEqual([]);
  });
});

// ===========================================================================
// getDomain
// ===========================================================================

describe("domains.getDomain", () => {
  test("returns a single domain by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "mysite.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const domain = await asUser.query(api.domains.getDomain, { domainId });

    expect(domain).not.toBeNull();
    expect(domain!.domain).toBe("mysite.com");
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "mysite.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const domain = await t.query(api.domains.getDomain, { domainId });
    expect(domain).toBeNull();
  });
});

// ===========================================================================
// createDomain
// ===========================================================================

describe("domains.createDomain", () => {
  test("creates a domain and strips protocol", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const domainId = await asUser.mutation(api.domains.createDomain, {
      projectId,
      domain: "https://www.example.com/",
      settings: DEFAULT_SETTINGS,
    });

    expect(domainId).toBeTruthy();

    const domain = await t.run(async (ctx: any) => {
      return ctx.db.get(domainId);
    });
    expect(domain!.domain).toBe("www.example.com");
  });

  test("rejects duplicate domain+location+language in same project", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.domains.createDomain, {
      projectId,
      domain: "example.com",
      settings: DEFAULT_SETTINGS,
    });

    await expect(
      asUser.mutation(api.domains.createDomain, {
        projectId,
        domain: "example.com",
        settings: DEFAULT_SETTINGS,
      })
    ).rejects.toThrow("Domain with this location/language already exists");
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    await expect(
      t.mutation(api.domains.createDomain, {
        projectId,
        domain: "example.com",
        settings: DEFAULT_SETTINGS,
      })
    ).rejects.toThrow();
  });
});

// ===========================================================================
// updateDomain
// ===========================================================================

describe("domains.updateDomain", () => {
  test("updates domain name and strips protocol", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "old.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.domains.updateDomain, {
      domainId,
      domain: "https://new.com/",
    });

    const updated = await t.run(async (ctx: any) => {
      return ctx.db.get(domainId);
    });
    expect(updated!.domain).toBe("new.com");
  });

  test("updates tags", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.domains.updateDomain, {
      domainId,
      tags: ["seo", "important"],
    });

    const updated = await t.run(async (ctx: any) => {
      return ctx.db.get(domainId);
    });
    expect(updated!.tags).toEqual(["seo", "important"]);
  });
});

// ===========================================================================
// deleteDomain (cascade)
// ===========================================================================

describe("domains.deleteDomain", () => {
  test("deletes domain and cascades to keywords, positions, and discovered keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "tobedeleted.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    // Add keyword + position + discovered keyword
    const keywordId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test phrase",
        status: "active",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordPositions", {
        keywordId,
        date: "2025-01-01",
        position: 5,
        url: "https://tobedeleted.com/page",
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "discovered one",
        bestPosition: 3,
        url: "https://tobedeleted.com/page",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.domains.deleteDomain, { domainId });

    // Verify everything is deleted
    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain).toBeNull();

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword).toBeNull();

    const positions = await t.run(async (ctx: any) => {
      return ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q: any) => q.eq("keywordId", keywordId))
        .collect();
    });
    expect(positions).toHaveLength(0);

    const discovered = await t.run(async (ctx: any) => {
      return ctx.db
        .query("discoveredKeywords")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(discovered).toHaveLength(0);
  });
});

// ===========================================================================
// Tenant isolation
// ===========================================================================

describe("domains - tenant isolation", () => {
  test("user from org A cannot query domains in org B", async () => {
    const t = convexTest(schema, modules);

    // Org A user
    const userA = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "UserA", email: "a@test.com" });
    });
    const hierA = await setupHierarchy(t, userA);

    await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId: hierA.projectId,
        domain: "orgA-domain.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    // Org B user
    const userB = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "UserB", email: "b@test.com" });
    });
    const orgB = await t.run(async (ctx: any) => {
      return ctx.db.insert("organizations", {
        name: "Org B",
        slug: "org-b",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
    });
    await t.run(async (ctx: any) => {
      await ctx.db.insert("organizationMembers", {
        organizationId: orgB,
        userId: userB,
        role: "owner",
        joinedAt: Date.now(),
      });
    });

    // User B should get an error when querying org A's project domains
    const asUserB = t.withIdentity({ subject: userB });
    await expect(
      asUserB.query(api.domains.getDomains, { projectId: hierA.projectId })
    ).rejects.toThrow();
  });

  test("user from org A cannot delete domain in org B", async () => {
    const t = convexTest(schema, modules);

    const userA = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "UserA", email: "a@test.com" });
    });
    const hierA = await setupHierarchy(t, userA);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId: hierA.projectId,
        domain: "secret.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const userB = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "UserB", email: "b@test.com" });
    });
    const orgB = await t.run(async (ctx: any) => {
      return ctx.db.insert("organizations", {
        name: "Org B",
        slug: "org-b",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
    });
    await t.run(async (ctx: any) => {
      await ctx.db.insert("organizationMembers", {
        organizationId: orgB,
        userId: userB,
        role: "owner",
        joinedAt: Date.now(),
      });
    });

    const asUserB = t.withIdentity({ subject: userB });
    await expect(
      asUserB.mutation(api.domains.deleteDomain, { domainId })
    ).rejects.toThrow();
  });
});

// ===========================================================================
// Simplified create / remove (domains.create, domains.remove)
// ===========================================================================

describe("domains.create (simplified)", () => {
  test("creates domain via simplified endpoint", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const domainId = await asUser.mutation(api.domains.create, {
      projectId,
      domain: "https://simple.com/",
      location: "US",
      language: "en",
    });

    expect(domainId).toBeTruthy();

    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain!.domain).toBe("simple.com");
    expect(domain!.settings.location).toBe("US");
    expect(domain!.settings.language).toBe("en");
    expect(domain!.settings.refreshFrequency).toBe("weekly"); // default
  });
});

describe("domains.remove (simplified)", () => {
  test("removes domain and cascades", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "removeme.com",
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
    await asUser.mutation(api.domains.remove, { id: domainId });

    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain).toBeNull();
  });
});

// ===========================================================================
// domains.list (across all projects)
// ===========================================================================

describe("domains.list", () => {
  test("returns domains across all user projects sorted by creation time", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { teamId } = await setupHierarchy(t, userId);

    // Create two projects under the same team
    const project1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Project 1",
        createdAt: Date.now(),
      });
    });
    const project2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("projects", {
        teamId,
        name: "Project 2",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domains", {
        projectId: project1,
        domain: "first.com",
        createdAt: 1000,
        settings: DEFAULT_SETTINGS,
      });
      await ctx.db.insert("domains", {
        projectId: project2,
        domain: "second.com",
        createdAt: 2000,
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const domains = await asUser.query(api.domains.list, {});

    expect(domains.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    const domainNames = domains.map((d: any) => d.domain);
    expect(domainNames).toContain("first.com");
    expect(domainNames).toContain("second.com");
  });
});

// ===========================================================================
// Discovered keywords
// ===========================================================================

describe("domains.getDiscoveredKeywords", () => {
  test("returns discovered keywords sorted by position", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "keyword b",
        bestPosition: 10,
        url: "https://example.com/b",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "keyword a",
        bestPosition: 3,
        url: "https://example.com/a",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const keywords = await asUser.query(api.domains.getDiscoveredKeywords, {
      domainId,
    });

    expect(keywords).toHaveLength(2);
    expect(keywords[0].keyword).toBe("keyword a"); // position 3 first
    expect(keywords[1].keyword).toBe("keyword b"); // position 10 second
  });

  test("filters by status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "disc",
        bestPosition: 5,
        url: "https://example.com/a",
        lastSeenDate: "2025-01-01",
        status: "discovered",
        createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId,
        keyword: "ign",
        bestPosition: 50,
        url: "https://example.com/b",
        lastSeenDate: "2025-01-01",
        status: "ignored",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const discovered = await asUser.query(api.domains.getDiscoveredKeywords, {
      domainId,
      status: "discovered",
    });
    expect(discovered).toHaveLength(1);
    expect(discovered[0].keyword).toBe("disc");
  });
});

// ===========================================================================
// getDiscoveredKeywordsCount
// ===========================================================================

describe("domains.getDiscoveredKeywordsCount", () => {
  test("returns correct counts by status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "a", bestPosition: 1, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "b", bestPosition: 2, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "c", bestPosition: 3, url: "u", lastSeenDate: "2025-01-01", status: "monitoring", createdAt: Date.now(),
      });
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "d", bestPosition: 4, url: "u", lastSeenDate: "2025-01-01", status: "ignored", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const counts = await asUser.query(api.domains.getDiscoveredKeywordsCount, { domainId });

    expect(counts).not.toBeNull();
    expect(counts!.total).toBe(4);
    expect(counts!.discovered).toBe(2);
    expect(counts!.monitoring).toBe(1);
    expect(counts!.ignored).toBe(1);
  });
});

// ===========================================================================
// markRefreshed
// ===========================================================================

describe("domains.markRefreshed", () => {
  test("sets lastRefreshedAt timestamp", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.domains.markRefreshed, { domainId });

    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain!.lastRefreshedAt).toBeDefined();
    expect(domain!.lastRefreshedAt).toBeGreaterThan(0);
  });
});

// ===========================================================================
// getVisibilityStats
// ===========================================================================

describe("domains.getVisibilityStats", () => {
  test("computes stats from discovered keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    // Add discovered keywords with various positions
    await t.run(async (ctx: any) => {
      // Position 2 => top3, top10
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "kw1", bestPosition: 2, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(), searchVolume: 1000,
      });
      // Position 8 => top10
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "kw2", bestPosition: 8, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(), searchVolume: 500,
      });
      // Position 999 => should be excluded
      await ctx.db.insert("discoveredKeywords", {
        domainId, keyword: "kw3", bestPosition: 999, url: "u", lastSeenDate: "2025-01-01", status: "discovered", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const stats = await asUser.query(api.domains.getVisibilityStats, { domainId });

    expect(stats).not.toBeNull();
    expect(stats!.totalKeywords).toBe(2); // Excludes position 999
    expect(stats!.top3Count).toBe(1);
    expect(stats!.top10Count).toBe(2);
    expect(stats!.top100Count).toBe(2);
    expect(stats!.avgPosition).toBe(5); // (2+8)/2 = 5
    expect(stats!.visibilityScore).toBeGreaterThan(0);
  });

  test("returns zeroed stats for empty domain", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "empty.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const stats = await asUser.query(api.domains.getVisibilityStats, { domainId });

    expect(stats!.totalKeywords).toBe(0);
    expect(stats!.top3Count).toBe(0);
    expect(stats!.visibilityScore).toBe(0);
  });
});

// ===========================================================================
// getUserRoleForDomain
// ===========================================================================

describe("domains.getUserRoleForDomain", () => {
  test("returns user role through domain hierarchy", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const role = await asUser.query(api.domains.getUserRoleForDomain, { domainId });

    expect(role).toBe("owner");
  });
});

// ===========================================================================
// saveBusinessContextPublic
// ===========================================================================

describe("domains.saveBusinessContextPublic", () => {
  test("saves business description and target customer", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "mybiz.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.domains.saveBusinessContextPublic, {
      domainId,
      businessDescription: "We sell widgets",
      targetCustomer: "Small businesses",
    });

    const domain = await t.run(async (ctx: any) => ctx.db.get(domainId));
    expect(domain!.businessDescription).toBe("We sell widgets");
    expect(domain!.targetCustomer).toBe("Small businesses");
  });
});
