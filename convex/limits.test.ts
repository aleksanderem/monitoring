import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";
import { PERMISSIONS } from "./permissions";

const modules = import.meta.glob("./**/*.ts");

// Helper: create full org hierarchy with optional limits at each level
async function setupHierarchyWithLimits(t: any, opts?: {
  orgLimits?: Record<string, number>;
  projectLimits?: Record<string, number>;
  domainLimits?: Record<string, number>;
}) {
  return await t.run(async (ctx: any) => {
    const planId = await ctx.db.insert("plans", {
      name: "Test Plan",
      key: "test-limits",
      permissions: Object.keys(PERMISSIONS),
      modules: ["positioning", "backlinks", "seo_audit", "reports", "competitors"],
      limits: { maxKeywords: 500 },
      isDefault: false,
      createdAt: Date.now(),
    });

    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org-limits",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
      planId,
      limits: opts?.orgLimits as any,
    });

    const teamId = await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });

    const projectId = await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
      limits: opts?.projectLimits as any,
    });

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
      limits: opts?.domainLimits as any,
    });

    // Create user as owner
    const userId = await ctx.db.insert("users", {
      name: "Owner",
      email: "owner@test.com",
    });
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });

    return { orgId, teamId, projectId, domainId, userId, planId };
  });
}

// Helper: add keywords to a domain
async function addKeywords(t: any, domainId: Id<"domains">, count: number) {
  await t.run(async (ctx: any) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: `keyword-${i}`,
        createdAt: Date.now(),
        status: "active" as const,
      });
    }
  });
}

describe("resolveKeywordLimit", () => {
  test("domain limit takes priority when set", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      orgLimits: { maxKeywordsPerDomain: 100 },
      projectLimits: { maxKeywordsPerDomain: 75 },
      domainLimits: { maxKeywords: 25 },
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getDomainLimits, { domainId });
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(25);
    expect(result!.source).toBe("domain");
  });

  test("project limit used when domain has no limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      orgLimits: { maxKeywordsPerDomain: 100 },
      projectLimits: { maxKeywordsPerDomain: 75 },
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getDomainLimits, { domainId });
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(75);
    expect(result!.source).toBe("project");
  });

  test("org limit used when domain and project have no limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      orgLimits: { maxKeywordsPerDomain: 100 },
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getDomainLimits, { domainId });
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(100);
    expect(result!.source).toBe("organization");
  });

  test("default limit (50) used when nothing is configured", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getDomainLimits, { domainId });
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(50);
    expect(result!.source).toBe("default");
  });
});

describe("checkKeywordLimit", () => {
  test("allows adding keywords when under limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      domainLimits: { maxKeywords: 10 },
    });
    await addKeywords(t, domainId, 5);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.checkAddKeywordsLimit, {
      domainId,
      countToAdd: 3,
    });
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(5);
  });

  test("blocks adding keywords when at capacity", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      domainLimits: { maxKeywords: 5 },
    });
    await addKeywords(t, domainId, 5);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.checkAddKeywordsLimit, {
      domainId,
      countToAdd: 1,
    });
    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(5);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(0);
    expect(result.message).toBeDefined();
  });

  test("blocks adding keywords that would exceed limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      domainLimits: { maxKeywords: 10 },
    });
    await addKeywords(t, domainId, 8);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.checkAddKeywordsLimit, {
      domainId,
      countToAdd: 5,
    });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(2);
  });

  test("only counts active keywords toward limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      domainLimits: { maxKeywords: 5 },
    });
    // Add 3 active and 3 paused keywords
    await t.run(async (ctx: any) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("keywords", {
          domainId,
          phrase: `active-${i}`,
          createdAt: Date.now(),
          status: "active" as const,
        });
      }
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("keywords", {
          domainId,
          phrase: `paused-${i}`,
          createdAt: Date.now(),
          status: "paused" as const,
        });
      }
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.checkAddKeywordsLimit, {
      domainId,
      countToAdd: 1,
    });
    // Only 3 active keywords, limit is 5
    expect(result.currentCount).toBe(3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe("checkRefreshCooldown", () => {
  test("blocks refresh within cooldown window", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId, orgId } = await setupHierarchyWithLimits(t, {
      orgLimits: { refreshCooldownMinutes: 10 },
    });

    // Create a recent check job (simulates a recent refresh)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId,
        createdBy: userId,
        status: "completed" as const,
        totalKeywords: 5,
        processedKeywords: 5,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getRefreshLimitStatus, {
      domainId,
    });
    expect(result.cooldown).not.toBeNull();
    expect(result.cooldown!.blocked).toBe(true);
  });

  test("allows refresh after cooldown expires", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      orgLimits: { refreshCooldownMinutes: 5 },
    });

    // Create a check job from 10 minutes ago (past the 5-min cooldown)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId,
        createdBy: userId,
        status: "completed" as const,
        totalKeywords: 5,
        processedKeywords: 5,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getRefreshLimitStatus, {
      domainId,
    });
    // With no other blocking limits, should be able to refresh
    if (result.cooldown) {
      expect(result.cooldown.blocked).toBe(false);
    }
  });

  test("no cooldown when not configured", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getRefreshLimitStatus, {
      domainId,
    });
    // Cooldown not configured at org level, so field should be null
    expect(result.cooldown).toBeNull();
  });
});

describe("getUsageStats", () => {
  test("counts match actual data after inserts", async () => {
    const t = convexTest(schema, modules);
    const { orgId, domainId, projectId, userId } = await setupHierarchyWithLimits(t);

    // Add some keywords
    await addKeywords(t, domainId, 7);

    const asUser = t.withIdentity({ subject: userId });
    const stats = await asUser.query(api.limits.getUsageStats, {
      organizationId: orgId,
    });

    expect(stats).not.toBeNull();
    expect(stats!.keywords.current).toBe(7);
    expect(stats!.domains.current).toBe(1);
    expect(stats!.projects.current).toBe(1);
  });

  test("returns null for non-member", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupHierarchyWithLimits(t);
    // Create outsider user
    const outsiderId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Outsider",
        email: "outsider@test.com",
      });
    });

    const asOutsider = t.withIdentity({ subject: outsiderId });
    const stats = await asOutsider.query(api.limits.getUsageStats, {
      organizationId: orgId,
    });
    expect(stats).toBeNull();
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { orgId } = await setupHierarchyWithLimits(t);
    const stats = await t.query(api.limits.getUsageStats, {
      organizationId: orgId,
    });
    expect(stats).toBeNull();
  });

  test("counts across multiple domains in org", async () => {
    const t = convexTest(schema, modules);
    const { orgId, projectId, userId } = await setupHierarchyWithLimits(t);

    // Create a second domain
    const domain2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("domains", {
        projectId,
        domain: "example2.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
    });

    // Get the first domain
    const domain1Id = await t.run(async (ctx: any) => {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
        .collect();
      return domains[0]._id;
    });

    await addKeywords(t, domain1Id, 3);
    await addKeywords(t, domain2Id, 4);

    const asUser = t.withIdentity({ subject: userId });
    const stats = await asUser.query(api.limits.getUsageStats, {
      organizationId: orgId,
    });
    expect(stats!.keywords.current).toBe(7);
    expect(stats!.domains.current).toBe(2);
  });
});

describe("getDomainLimits", () => {
  test("returns all limit sources for transparency", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      orgLimits: { maxKeywordsPerDomain: 100 },
      projectLimits: { maxKeywordsPerDomain: 75 },
      domainLimits: { maxKeywords: 25 },
    });
    await addKeywords(t, domainId, 10);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getDomainLimits, { domainId });
    expect(result).not.toBeNull();
    expect(result!.currentCount).toBe(10);
    expect(result!.limit).toBe(25);
    expect(result!.remaining).toBe(15);
    expect(result!.source).toBe("domain");
    expect(result!.domainLimit).toBe(25);
    expect(result!.projectDefault).toBe(75);
    expect(result!.orgDefault).toBe(100);
  });

  test("returns correct remaining after adding keywords", async () => {
    const t = convexTest(schema, modules);
    const { domainId, userId } = await setupHierarchyWithLimits(t, {
      domainLimits: { maxKeywords: 20 },
    });
    await addKeywords(t, domainId, 12);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.limits.getDomainLimits, { domainId });
    expect(result).not.toBeNull();
    expect(result!.currentCount).toBe(12);
    expect(result!.remaining).toBe(8);
  });
});
