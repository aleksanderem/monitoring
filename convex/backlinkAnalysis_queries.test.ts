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

async function setupDomain(t: any, projectId: string, domain = "example.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

async function insertBacklink(
  t: any,
  domainId: string,
  overrides: Record<string, any> = {}
) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domainBacklinks", {
      domainId,
      urlFrom: "https://ref.com/page",
      urlTo: "https://example.com/",
      fetchedAt: Date.now(),
      ...overrides,
    });
  });
}

async function setupAuth(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return ctx.db.insert("users", {
      name: "Alice",
      email: "alice@test.com",
    });
  });
  const { projectId } = await setupHierarchy(t, userId);
  const domainId = await setupDomain(t, projectId);
  const asUser = t.withIdentity({ subject: userId });
  return { userId, projectId, domainId, asUser };
}

// ===========================================================================
// getAnchorTextDistribution
// ===========================================================================

describe("backlinkAnalysis_queries.getAnchorTextDistribution", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "A", email: "a@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(
      api.backlinkAnalysis_queries.getAnchorTextDistribution,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null when no backlinks exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getAnchorTextDistribution,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("classifies anchors into categories correctly", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // branded anchor (contains domain base "example")
    await insertBacklink(t, domainId, {
      anchor: "Example website",
      domainFrom: "ref1.com",
      domainFromRank: 100,
      dofollow: true,
    });
    // exact_url anchor
    await insertBacklink(t, domainId, {
      anchor: "https://example.com/page",
      domainFrom: "ref2.com",
      domainFromRank: 200,
      dofollow: false,
    });
    // generic anchor
    await insertBacklink(t, domainId, {
      anchor: "click here",
      domainFrom: "ref3.com",
      domainFromRank: 50,
      dofollow: true,
    });
    // other anchor
    await insertBacklink(t, domainId, {
      anchor: "best seo tools review",
      domainFrom: "ref4.com",
      domainFromRank: 300,
      dofollow: true,
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getAnchorTextDistribution,
      { domainId }
    );

    expect(result).not.toBeNull();
    expect(result!.total).toBe(4);
    expect(result!.categories).toHaveLength(4);

    const byName = Object.fromEntries(
      result!.categories.map((c: any) => [c.name, c])
    );
    expect(byName.branded.count).toBe(1);
    expect(byName.exact_url.count).toBe(1);
    expect(byName.generic.count).toBe(1);
    expect(byName.other.count).toBe(1);

    // Each should be 25%
    expect(byName.branded.percentage).toBe(25);

    // topAnchors should contain all 4
    expect(result!.topAnchors.length).toBe(4);
    // Check dofollow/nofollow counting
    const urlAnchor = result!.topAnchors.find(
      (a: any) => a.category === "exact_url"
    );
    expect(urlAnchor!.dofollow).toBe(0);
    expect(urlAnchor!.nofollow).toBe(1);
  });

  test("undefined anchor is classified as other via (empty) placeholder", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // When anchor is undefined, code substitutes "(empty)" which classifyAnchor treats as "other"
    await insertBacklink(t, domainId, {
      domainFrom: "ref.com",
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getAnchorTextDistribution,
      { domainId }
    );

    expect(result).not.toBeNull();
    const other = result!.categories.find((c: any) => c.name === "other");
    expect(other!.count).toBe(1);
    // The anchor key should be "(empty)"
    expect(result!.topAnchors[0].anchor).toBe("(empty)");
  });
});

// ===========================================================================
// getLinkQualityScores
// ===========================================================================

describe("backlinkAnalysis_queries.getLinkQualityScores", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "A", email: "a@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(
      api.backlinkAnalysis_queries.getLinkQualityScores,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null when no backlinks exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getLinkQualityScores,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("scores and distributes backlinks into quality buckets", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // Excellent: high rank + dofollow + low spam
    await insertBacklink(t, domainId, {
      rank: 900,
      domainFromRank: 900,
      dofollow: true,
      backlink_spam_score: 0,
      domainFrom: "excellent.com",
      urlFrom: "https://excellent.com/p",
      anchor: "great link",
    });

    // Poor: low rank + nofollow + high spam
    await insertBacklink(t, domainId, {
      rank: 10,
      domainFromRank: 10,
      dofollow: false,
      backlink_spam_score: 80,
      domainFrom: "poor.com",
      urlFrom: "https://poor.com/p",
      anchor: "spammy",
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getLinkQualityScores,
      { domainId }
    );

    expect(result).not.toBeNull();
    expect(result!.distribution).toHaveLength(4);

    const byTier = Object.fromEntries(
      result!.distribution.map((d: any) => [d.tier, d])
    );
    // Excellent link: rank 900 -> rankScore=27, domainRankScore=27, dofollow=20, spam=0 => 74 -> excellent
    expect(byTier.excellent.count).toBe(1);
    // Poor link: rank 10 -> 0.3, domainRank=0.3, no dofollow, spam=16 => ~0 -> poor
    expect(byTier.poor.count).toBe(1);

    // topLinks sorted by quality desc
    expect(result!.topLinks[0].domainFrom).toBe("excellent.com");
    expect(result!.topLinks[0].qualityScore).toBeGreaterThan(
      result!.topLinks[1].qualityScore
    );

    expect(result!.avgScore).toBeGreaterThan(0);
  });
});

// ===========================================================================
// getReferringDomainIntelligence
// ===========================================================================

describe("backlinkAnalysis_queries.getReferringDomainIntelligence", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "A", email: "a@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(
      api.backlinkAnalysis_queries.getReferringDomainIntelligence,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null when no backlinks exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getReferringDomainIntelligence,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("groups backlinks by referring domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // Two backlinks from same domain
    await insertBacklink(t, domainId, {
      domainFrom: "blog.com",
      urlFrom: "https://blog.com/post1",
      anchor: "great tools",
      dofollow: true,
      domainFromRank: 500,
      rank: 400,
      backlink_spam_score: 10,
      firstSeen: "2025-01-01",
      lastSeen: "2025-06-01",
      domainFromCountry: "US",
    });
    await insertBacklink(t, domainId, {
      domainFrom: "blog.com",
      urlFrom: "https://blog.com/post2",
      anchor: "seo review",
      dofollow: false,
      domainFromRank: 500,
      rank: 300,
      backlink_spam_score: 5,
      firstSeen: "2025-03-01",
      lastSeen: "2025-07-01",
    });

    // One backlink from another domain
    await insertBacklink(t, domainId, {
      domainFrom: "news.org",
      urlFrom: "https://news.org/article",
      anchor: "example website",
      dofollow: true,
      domainFromRank: 800,
      rank: 700,
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getReferringDomainIntelligence,
      { domainId }
    );

    expect(result).not.toBeNull();
    expect(result!.totalDomains).toBe(2);
    expect(result!.domains).toHaveLength(2);

    const blogDomain = result!.domains.find((d: any) => d.domain === "blog.com");
    expect(blogDomain).toBeDefined();
    expect(blogDomain!.linkCount).toBe(2);
    expect(blogDomain!.dofollow).toBe(1);
    expect(blogDomain!.nofollow).toBe(1);
    expect(blogDomain!.dofollowPercent).toBe(50);
    expect(blogDomain!.firstSeen).toBe("2025-01-01");
    expect(blogDomain!.lastSeen).toBe("2025-07-01");
    expect(blogDomain!.country).toBe("US");
    expect(blogDomain!.avgSpamScore).not.toBeNull();
    expect(blogDomain!.topAnchors.length).toBeGreaterThanOrEqual(2);

    const newsDomain = result!.domains.find((d: any) => d.domain === "news.org");
    expect(newsDomain!.linkCount).toBe(1);
    expect(newsDomain!.dofollow).toBe(1);
  });
});

// ===========================================================================
// getToxicLinks
// ===========================================================================

describe("backlinkAnalysis_queries.getToxicLinks", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "A", email: "a@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(
      api.backlinkAnalysis_queries.getToxicLinks,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null when no backlinks exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getToxicLinks,
      { domainId }
    );
    expect(result).toBeNull();
  });

  test("filters toxic links by default threshold of 70", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // Toxic
    await insertBacklink(t, domainId, {
      domainFrom: "spam.net",
      urlFrom: "https://spam.net/link",
      backlink_spam_score: 85,
      dofollow: false,
      domainFromRank: 10,
      firstSeen: "2025-01-01",
      lastSeen: "2025-06-01",
      domainFromCountry: "RU",
    });
    // Borderline toxic (exactly 70)
    await insertBacklink(t, domainId, {
      domainFrom: "borderline.com",
      urlFrom: "https://borderline.com/p",
      backlink_spam_score: 70,
    });
    // Clean
    await insertBacklink(t, domainId, {
      domainFrom: "clean.com",
      urlFrom: "https://clean.com/page",
      backlink_spam_score: 20,
    });
    // No spam score
    await insertBacklink(t, domainId, {
      domainFrom: "unknown.com",
      urlFrom: "https://unknown.com/p",
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getToxicLinks,
      { domainId }
    );

    expect(result).not.toBeNull();
    expect(result!.toxicCount).toBe(2); // spam.net + borderline
    expect(result!.totalAnalyzed).toBe(3); // 3 have spam scores
    expect(result!.items).toHaveLength(2);
    // Sorted by spam score desc
    expect(result!.items[0].spamScore).toBe(85);
    expect(result!.items[1].spamScore).toBe(70);
    expect(result!.items[0].country).toBe("RU");
    expect(result!.toxicPercentage).toBeGreaterThan(0);
    expect(result!.avgSpamScore).toBeGreaterThan(0);
  });

  test("uses custom threshold when provided", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    await insertBacklink(t, domainId, {
      domainFrom: "mid.com",
      urlFrom: "https://mid.com/p",
      backlink_spam_score: 50,
    });
    await insertBacklink(t, domainId, {
      domainFrom: "low.com",
      urlFrom: "https://low.com/p",
      backlink_spam_score: 10,
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getToxicLinks,
      { domainId, threshold: 40 }
    );

    expect(result).not.toBeNull();
    expect(result!.toxicCount).toBe(1);
    expect(result!.items[0].domainFrom).toBe("mid.com");
  });
});

// ===========================================================================
// getBacklinkGap
// ===========================================================================

describe("backlinkAnalysis_queries.getBacklinkGap", () => {
  test("returns empty defaults when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "A", email: "a@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await setupDomain(t, projectId);

    const result = await t.query(
      api.backlinkAnalysis_queries.getBacklinkGap,
      { domainId }
    );
    expect(result).toEqual({
      gaps: [],
      competitorCount: 0,
      totalGapDomains: 0,
    });
  });

  test("returns empty when no competitors", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getBacklinkGap,
      { domainId }
    );
    expect(result.gaps).toEqual([]);
    expect(result.competitorCount).toBe(0);
  });

  test("finds gap domains linking to competitors but not to us", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // Our backlink from blog.com (should be excluded from gaps)
    await insertBacklink(t, domainId, {
      domainFrom: "blog.com",
      urlFrom: "https://blog.com/us",
    });

    // Create two competitors
    const comp1Id = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "competitor1.com",
        name: "Competitor 1",
        status: "active",
        createdAt: Date.now(),
      });
    });
    const comp2Id = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "competitor2.com",
        name: "Competitor 2",
        status: "active",
        createdAt: Date.now(),
      });
    });

    // Gap domain "linker.org" links to both competitors but not to us
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorBacklinks", {
        competitorId: comp1Id,
        domainFrom: "linker.org",
        urlFrom: "https://linker.org/review",
        urlTo: "https://competitor1.com/",
        dofollow: true,
        domainFromRank: 600,
        anchor: "top tools",
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("competitorBacklinks", {
        competitorId: comp2Id,
        domainFrom: "linker.org",
        urlFrom: "https://linker.org/list",
        urlTo: "https://competitor2.com/",
        dofollow: true,
        domainFromRank: 600,
        anchor: "best software",
        fetchedAt: Date.now(),
      });
    });

    // Another gap domain linking to only comp1
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorBacklinks", {
        competitorId: comp1Id,
        domainFrom: "techblog.io",
        urlFrom: "https://techblog.io/post",
        urlTo: "https://competitor1.com/feature",
        dofollow: false,
        domainFromRank: 300,
        anchor: "check this",
        fetchedAt: Date.now(),
      });
    });

    // blog.com also links to comp1 (but we already have a link from blog.com, so no gap)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorBacklinks", {
        competitorId: comp1Id,
        domainFrom: "blog.com",
        urlFrom: "https://blog.com/comp-review",
        urlTo: "https://competitor1.com/",
        dofollow: true,
        domainFromRank: 400,
        anchor: "review",
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getBacklinkGap,
      { domainId }
    );

    expect(result.competitorCount).toBe(2);
    expect(result.totalGapDomains).toBe(2); // linker.org + techblog.io (blog.com excluded)
    expect(result.gaps).toHaveLength(2);

    // linker.org should have higher priority (links from 2 competitors)
    const linker = result.gaps.find((g: any) => g.domain === "linker.org");
    expect(linker).toBeDefined();
    expect(linker!.competitorCount).toBe(2);
    expect(linker!.competitors).toContain("competitor1.com");
    expect(linker!.competitors).toContain("competitor2.com");
    expect(linker!.totalLinks).toBe(2);
    expect(linker!.dofollowPercent).toBe(100);
    expect(linker!.priorityScore).toBeGreaterThan(0);
    expect(linker!.topAnchors.length).toBeGreaterThanOrEqual(1);

    const techblog = result.gaps.find((g: any) => g.domain === "techblog.io");
    expect(techblog!.competitorCount).toBe(1);

    // linker.org should rank higher due to more competitors
    expect(linker!.priorityScore).toBeGreaterThanOrEqual(
      techblog!.priorityScore
    );
  });

  test("ignores paused competitors", async () => {
    const t = convexTest(schema, modules);
    const { domainId, asUser } = await setupAuth(t);

    // Paused competitor
    const pausedId = await t.run(async (ctx: any) => {
      return ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "paused.com",
        name: "Paused",
        status: "paused",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorBacklinks", {
        competitorId: pausedId,
        domainFrom: "linker.org",
        urlFrom: "https://linker.org/p",
        urlTo: "https://paused.com/",
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(
      api.backlinkAnalysis_queries.getBacklinkGap,
      { domainId }
    );

    expect(result.competitorCount).toBe(0);
    expect(result.gaps).toEqual([]);
  });
});
