import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTenantHierarchy(t: any, opts: { email: string; orgName: string; domainName: string }) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", { email: opts.email, emailVerificationTime: Date.now() });
  });
  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
      name: opts.orgName,
      slug: opts.orgName.toLowerCase().replace(/\s+/g, "-"),
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", { organizationId: orgId, userId, role: "owner" as const, joinedAt: Date.now() });
  });
  const teamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("teams", { organizationId: orgId, name: "Default Team", createdAt: Date.now() });
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("teamMembers", { teamId, userId, role: "owner" as const, joinedAt: Date.now() });
  });
  const projectId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("projects", { teamId, name: "Default Project", createdAt: Date.now() });
  });
  const domainId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: opts.domainName,
      createdAt: Date.now(),
      settings: { refreshFrequency: "weekly" as const, searchEngine: "google", location: "United States", language: "en" },
    });
  });
  return { userId, orgId, teamId, projectId, domainId };
}

// =====================================================================
// storeCompetitorPageAnalysis (internalMutation)
// =====================================================================
describe("storeCompetitorPageAnalysis", () => {
  test("creates a new page analysis record", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const analysisId = await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId,
      keywordId,
      url: "https://rival.com/seo-tools",
      position: 3,
      title: "Best SEO Tools",
      metaDescription: "Top SEO tools for 2025",
      wordCount: 1500,
    });

    expect(analysisId).toBeDefined();

    const record = await t.run(async (ctx: any) => ctx.db.get(analysisId));
    expect(record.url).toBe("https://rival.com/seo-tools");
    expect(record.position).toBe(3);
    expect(record.wordCount).toBe(1500);
    expect(record.title).toBe("Best SEO Tools");
    expect(record.fetchedAt).toBeDefined();
  });

  test("updates existing record for same competitor+keyword", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const firstId = await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId,
      keywordId,
      url: "https://rival.com/seo-tools",
      position: 3,
      wordCount: 1500,
    });

    const secondId = await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId,
      keywordId,
      url: "https://rival.com/seo-tools-updated",
      position: 2,
      wordCount: 2000,
    });

    // Should update the same record, not create a new one
    expect(secondId).toEqual(firstId);

    const record = await t.run(async (ctx: any) => ctx.db.get(firstId));
    expect(record.position).toBe(2);
    expect(record.wordCount).toBe(2000);
    expect(record.url).toBe("https://rival.com/seo-tools-updated");
  });

  test("creates new record when competitorId is undefined (keyword-specific)", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const analysisId = await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId: undefined,
      keywordId,
      url: "https://rival.com/seo-tools",
      position: 5,
      wordCount: 800,
    });

    expect(analysisId).toBeDefined();
    const record = await t.run(async (ctx: any) => ctx.db.get(analysisId));
    expect(record.competitorId).toBeUndefined();
    expect(record.wordCount).toBe(800);
  });
});

// =====================================================================
// getCachedPageAnalysis (internalQuery)
// =====================================================================
describe("getCachedPageAnalysis", () => {
  test("returns null when no analysis exists for URL", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(internal.competitorAnalysis.getCachedPageAnalysis, {
      url: "https://nonexistent.com/page",
    });

    expect(result).toBeNull();
  });

  test("returns analysis when fetched within 7 days", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "test",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    // Insert a fresh analysis
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorPageAnalysis", {
        keywordId,
        url: "https://rival.com/page",
        position: 1,
        wordCount: 1000,
        fetchedAt: Date.now(), // fresh
      });
    });

    const result = await t.query(internal.competitorAnalysis.getCachedPageAnalysis, {
      url: "https://rival.com/page",
    });

    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://rival.com/page");
  });

  test("returns null when analysis is older than 7 days", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "test",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorPageAnalysis", {
        keywordId,
        url: "https://rival.com/old-page",
        position: 1,
        wordCount: 1000,
        fetchedAt: eightDaysAgo,
      });
    });

    const result = await t.query(internal.competitorAnalysis.getCachedPageAnalysis, {
      url: "https://rival.com/old-page",
    });

    expect(result).toBeNull();
  });
});

// =====================================================================
// getCompetitorPageAnalysis (public query, requires auth)
// =====================================================================
describe("getCompetitorPageAnalysis", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "test",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    const result = await t.query(api.competitorAnalysis.getCompetitorPageAnalysis, {
      competitorId,
      keywordId,
    });
    expect(result).toBeNull();
  });

  test("returns analysis for authenticated user with access", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    // Store an analysis
    await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId,
      keywordId,
      url: "https://rival.com/seo-tools",
      position: 3,
      wordCount: 1500,
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(api.competitorAnalysis.getCompetitorPageAnalysis, {
      competitorId,
      keywordId,
    });

    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://rival.com/seo-tools");
    expect(result!.wordCount).toBe(1500);
  });
});

// =====================================================================
// getCompetitorAnalyzedPages (public query, requires auth)
// =====================================================================
describe("getCompetitorAnalyzedPages", () => {
  test("returns empty array when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.competitorAnalysis.getCompetitorAnalyzedPages, { competitorId });
    expect(result).toEqual([]);
  });

  test("returns all analyzed pages for a competitor", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const kw1 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "kw1", createdAt: Date.now(), status: "active" as const });
    });
    const kw2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "kw2", createdAt: Date.now(), status: "active" as const });
    });

    await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId, keywordId: kw1, url: "https://rival.com/page1", position: 1, wordCount: 500,
    });
    await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId, keywordId: kw2, url: "https://rival.com/page2", position: 4, wordCount: 800,
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const pages = await asUser.query(api.competitorAnalysis.getCompetitorAnalyzedPages, { competitorId });

    expect(pages).toHaveLength(2);
  });
});

// =====================================================================
// comparePageWithCompetitor (public query, requires auth)
// =====================================================================
describe("comparePageWithCompetitor", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const result = await t.query(api.competitorAnalysis.comparePageWithCompetitor, { keywordId, competitorId });
    expect(result).toBeNull();
  });

  test("returns null when no competitor page analysis exists", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(api.competitorAnalysis.comparePageWithCompetitor, { keywordId, competitorId });
    expect(result).toBeNull();
  });

  test("returns comparison with null yours when no your-domain SERP result", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const });
    });

    await t.mutation(internal.competitorAnalysis.storeCompetitorPageAnalysis, {
      competitorId, keywordId, url: "https://rival.com/seo-tools", position: 3, wordCount: 1500,
      htags: { h1: ["Main Title"], h2: ["Sub 1", "Sub 2"] },
      imagesCount: 5,
      internalLinksCount: 10,
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(api.competitorAnalysis.comparePageWithCompetitor, { keywordId, competitorId });

    expect(result).not.toBeNull();
    expect(result!.competitor).toBeDefined();
    expect(result!.competitor.wordCount).toBe(1500);
    expect(result!.yours).toBeNull();
    expect(result!.comparison).toBeNull();
  });
});

// =====================================================================
// triggerCompetitorPageAnalysis (mutation, schedules action)
// =====================================================================
describe("triggerCompetitorPageAnalysis", () => {
  test("throws when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    await expect(
      t.mutation(api.competitorAnalysis.triggerCompetitorPageAnalysis, { competitorId, keywordId })
    ).rejects.toThrow();
  });

  test("returns failure when no SERP data found", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.mutation(api.competitorAnalysis.triggerCompetitorPageAnalysis, { competitorId, keywordId });

    expect(result.success).toBe(false);
    expect(result.url).toBeNull();
  });

  test("succeeds when competitor position data exists", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const });
    });

    // Insert position data
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorKeywordPositions", {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 5,
        url: "https://rival.com/seo-tools",
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.mutation(api.competitorAnalysis.triggerCompetitorPageAnalysis, { competitorId, keywordId });

    expect(result.success).toBe(true);
    expect(result.url).toBe("https://rival.com/seo-tools");
  });

  test("falls back to SERP results when no position data", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const });
    });

    // Insert SERP result for competitor domain
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId,
        domainId: tenant.domainId,
        date: "2025-01-15",
        position: 7,
        domain: "rival.com",
        url: "https://rival.com/serp-page",
        isYourDomain: false,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.mutation(api.competitorAnalysis.triggerCompetitorPageAnalysis, { competitorId, keywordId });

    expect(result.success).toBe(true);
    expect(result.url).toBe("https://rival.com/serp-page");
  });
});
