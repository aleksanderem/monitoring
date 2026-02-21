import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full tenant hierarchy
async function createTenantHierarchy(
  t: any,
  opts: {
    email: string;
    orgName: string;
    domainName: string;
  }
) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: opts.email,
      emailVerificationTime: Date.now(),
    });
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
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner" as const,
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Default Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: opts.domainName,
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google",
        location: "United States",
        language: "en",
      },
    });
  });

  return { userId, orgId, teamId, projectId, domainId };
}

// =====================================================================
// getBacklinkRadarData
// =====================================================================
describe("getBacklinkRadarData", () => {
  test("returns empty when user is not authenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // No identity — should return []
    const result = await t.query(
      api.competitorComparison_queries.getBacklinkRadarData,
      { domainId: tenant.domainId }
    );
    expect(result).toEqual([]);
  });

  test("returns empty when no backlink data exists", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkRadarData,
      { domainId: tenant.domainId }
    );
    expect(result).toEqual([]);
  });

  test("returns normalized radar data with domain summary only", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId: tenant.domainId,
        totalBacklinks: 1000,
        totalDomains: 200,
        totalIps: 100,
        totalSubnets: 50,
        dofollow: 800,
        nofollow: 200,
        newBacklinks: 50,
        avgInlinkRank: 45,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkRadarData,
      { domainId: tenant.domainId }
    );

    // Should return 5 metrics, all normalized to 100 (since own is the only entity)
    expect(result).toHaveLength(5);
    const metricNames = result.map((r: any) => r.metric);
    expect(metricNames).toContain("totalBacklinks");
    expect(metricNames).toContain("referringDomains");
    expect(metricNames).toContain("dofollowRatio");
    expect(metricNames).toContain("avgDomainRank");
    expect(metricNames).toContain("freshBacklinksRatio");

    // With only one entity, yourValue should be 100 for each metric
    for (const metric of result) {
      expect((metric as any).yourValue).toBe(100);
      expect((metric as any).competitors).toEqual([]);
    }
  });

  test("returns normalized radar data with domain and competitors", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId: tenant.domainId,
        totalBacklinks: 1000,
        totalDomains: 200,
        totalIps: 100,
        totalSubnets: 50,
        dofollow: 800,
        nofollow: 200,
        newBacklinks: 50,
        avgInlinkRank: 45,
        fetchedAt: Date.now(),
      });
    });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorBacklinksSummary", {
        competitorId,
        totalBacklinks: 2000,
        totalDomains: 400,
        totalIps: 200,
        totalSubnets: 100,
        dofollow: 1600,
        nofollow: 400,
        newBacklinks: 100,
        avgInlinkRank: 60,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkRadarData,
      { domainId: tenant.domainId }
    );

    expect(result).toHaveLength(5);

    // Competitor has double the backlinks, so for totalBacklinks:
    // competitor = 100, own = 50
    const totalBacklinks = result.find((r: any) => r.metric === "totalBacklinks");
    expect(totalBacklinks).toBeDefined();
    expect((totalBacklinks as any).yourValue).toBe(50); // 1000/2000 * 100
    expect((totalBacklinks as any).competitors).toHaveLength(1);
    expect((totalBacklinks as any).competitors[0].name).toBe("Rival");
    expect((totalBacklinks as any).competitors[0].value).toBe(100);
  });

  test("skips competitors without backlink summaries", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinksSummary", {
        domainId: tenant.domainId,
        totalBacklinks: 500,
        totalDomains: 100,
        totalIps: 50,
        totalSubnets: 25,
        dofollow: 400,
        nofollow: 100,
        fetchedAt: Date.now(),
      });
    });

    // Competitor with no backlink summary
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "nosummary.com",
        name: "No Summary",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkRadarData,
      { domainId: tenant.domainId }
    );

    expect(result).toHaveLength(5);
    // Should only have own data, competitor skipped due to no summary
    for (const metric of result) {
      expect((metric as any).competitors).toEqual([]);
    }
  });
});

// =====================================================================
// getBacklinkQualityComparison
// =====================================================================
describe("getBacklinkQualityComparison", () => {
  test("returns empty when user is not authenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(
      api.competitorComparison_queries.getBacklinkQualityComparison,
      { domainId: tenant.domainId }
    );
    expect(result).toEqual({ tiers: [], series: [] });
  });

  test("returns tier distribution for own domain backlinks", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Insert backlinks with different domain ranks
    await t.run(async (ctx: any) => {
      // High DR (60+)
      await ctx.db.insert("domainBacklinks", {
        domainId: tenant.domainId,
        urlFrom: "https://highdr.com/link1",
        urlTo: "https://mysite.com/page1",
        domainFromRank: 75,
        fetchedAt: Date.now(),
      });
      // Medium DR (30-59)
      await ctx.db.insert("domainBacklinks", {
        domainId: tenant.domainId,
        urlFrom: "https://meddr.com/link1",
        urlTo: "https://mysite.com/page2",
        domainFromRank: 45,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("domainBacklinks", {
        domainId: tenant.domainId,
        urlFrom: "https://meddr2.com/link1",
        urlTo: "https://mysite.com/page3",
        domainFromRank: 35,
        fetchedAt: Date.now(),
      });
      // Low DR (0-29)
      await ctx.db.insert("domainBacklinks", {
        domainId: tenant.domainId,
        urlFrom: "https://lowdr.com/link1",
        urlTo: "https://mysite.com/page4",
        domainFromRank: 10,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkQualityComparison,
      { domainId: tenant.domainId }
    );

    expect(result.tiers).toEqual(["High DR (60+)", "Medium DR (30-59)", "Low DR (0-29)"]);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].name).toBe("__own__");
    expect(result.series[0].data).toEqual([1, 2, 1]); // 1 high, 2 medium, 1 low
  });

  test("includes competitor backlinks in tier distribution", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      // Competitor backlinks
      await ctx.db.insert("competitorBacklinks", {
        competitorId,
        urlFrom: "https://highdr.com/comp-link",
        urlTo: "https://rival.com/page",
        domainFromRank: 80,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("competitorBacklinks", {
        competitorId,
        urlFrom: "https://lowdr.com/comp-link",
        urlTo: "https://rival.com/page2",
        domainFromRank: 15,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkQualityComparison,
      { domainId: tenant.domainId }
    );

    expect(result.series).toHaveLength(2);
    expect(result.series[0].name).toBe("__own__");
    expect(result.series[0].data).toEqual([0, 0, 0]); // no own backlinks

    expect(result.series[1].name).toBe("Rival");
    expect(result.series[1].data).toEqual([1, 0, 1]); // 1 high, 0 medium, 1 low
  });

  test("treats null/undefined domainFromRank as low DR", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainBacklinks", {
        domainId: tenant.domainId,
        urlFrom: "https://unknown.com/link1",
        urlTo: "https://mysite.com/page1",
        fetchedAt: Date.now(),
        // No domainFromRank — should be treated as low DR
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getBacklinkQualityComparison,
      { domainId: tenant.domainId }
    );

    expect(result.series[0].data).toEqual([0, 0, 1]); // Unknown rank goes to low tier
  });
});

// =====================================================================
// getKeywordPositionBars
// =====================================================================
describe("getKeywordPositionBars", () => {
  test("returns empty when user is not authenticated", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(
      api.competitorComparison_queries.getKeywordPositionBars,
      { domainId: tenant.domainId }
    );
    expect(result).toEqual({ keywords: [], series: [] });
  });

  test("returns empty when no active keywords exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getKeywordPositionBars,
      { domainId: tenant.domainId }
    );
    expect(result).toEqual({ keywords: [], series: [] });
  });

  test("returns keyword position bars with own positions from denormalized data", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 5000,
        currentPosition: 3,
      });
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "keyword research",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 3000,
        currentPosition: 7,
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getKeywordPositionBars,
      { domainId: tenant.domainId }
    );

    // Keywords sorted by search volume desc
    expect(result.keywords).toEqual(["seo tools", "keyword research"]);
    expect(result.series).toHaveLength(1); // own only, no competitors
    expect(result.series[0].name).toBe("__own__");
    expect(result.series[0].positions).toEqual([3, 7]);
  });

  test("respects the limit argument", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "kw1",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 5000,
        currentPosition: 1,
      });
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "kw2",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 3000,
        currentPosition: 2,
      });
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "kw3",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 1000,
        currentPosition: 5,
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getKeywordPositionBars,
      { domainId: tenant.domainId, limit: 2 }
    );

    expect(result.keywords).toHaveLength(2);
    expect(result.keywords).toEqual(["kw1", "kw2"]);
  });

  test("includes competitor positions from SERP results", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 5000,
        currentPosition: 3,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    // Insert SERP results for the keyword
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId,
        domainId: tenant.domainId,
        date: "2025-01-15",
        position: 3,
        domain: "mysite.com",
        url: "https://mysite.com/seo-tools",
        isYourDomain: true,
        fetchedAt: Date.now(),
      });
      await ctx.db.insert("keywordSerpResults", {
        keywordId,
        domainId: tenant.domainId,
        date: "2025-01-15",
        position: 5,
        domain: "rival.com",
        url: "https://rival.com/seo-tools",
        mainDomain: "rival.com",
        isYourDomain: false,
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getKeywordPositionBars,
      { domainId: tenant.domainId }
    );

    expect(result.keywords).toEqual(["seo tools"]);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].name).toBe("__own__");
    expect(result.series[0].positions).toEqual([3]);
    expect(result.series[1].name).toBe("Rival");
    expect(result.series[1].positions).toEqual([5]);
  });

  test("excludes paused keywords", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "active keyword",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 1000,
        currentPosition: 5,
      });
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "paused keyword",
        status: "paused" as const,
        createdAt: Date.now(),
        searchVolume: 9000,
        currentPosition: 1,
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      api.competitorComparison_queries.getKeywordPositionBars,
      { domainId: tenant.domainId }
    );

    expect(result.keywords).toEqual(["active keyword"]);
  });
});
