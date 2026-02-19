import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

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
// Add Competitor
// =====================================================================
describe("addCompetitor", () => {
  test("successfully adds a competitor", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const competitorId = await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival.com",
      name: "Rival Inc",
    });

    expect(competitorId).toBeDefined();

    // Verify competitor was created
    const competitor = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(competitor.competitorDomain).toBe("rival.com");
    expect(competitor.name).toBe("Rival Inc");
    expect(competitor.status).toBe("active");
  });

  test("defaults name to domain when not provided", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const competitorId = await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival.com",
    });

    const competitor = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(competitor.name).toBe("rival.com");
  });

  test("throws when adding duplicate competitor", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival.com",
    });

    // Adding the same competitor again should throw
    await expect(
      asUser.mutation(api.competitors.addCompetitor, {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
      })
    ).rejects.toThrow("already being tracked");
  });

  test("re-activates a paused competitor", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Create a paused competitor directly
    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    // Adding the same competitor should re-activate it
    const asUser = t.withIdentity({ subject: tenant.userId });
    const reactivatedId = await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival.com",
      name: "Rival Updated",
    });

    expect(reactivatedId).toBe(competitorId);
    const competitor = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(competitor.status).toBe("active");
    expect(competitor.name).toBe("Rival Updated");
  });

  test("requires authentication", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await expect(
      t.mutation(api.competitors.addCompetitor, {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
      })
    ).rejects.toThrow();
  });
});

// =====================================================================
// Remove Competitor
// =====================================================================
describe("removeCompetitor", () => {
  test("pauses a competitor (soft delete)", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const competitorId = await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival.com",
    });

    await asUser.mutation(api.competitors.removeCompetitor, {
      competitorId,
    });

    const competitor = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(competitor.status).toBe("paused");
  });

  test("throws for non-existent competitor", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    // Use a real competitor ID from another test to create a valid-format ID
    await expect(
      asUser.mutation(api.competitors.removeCompetitor, {
        competitorId: "invalid_id" as any,
      })
    ).rejects.toThrow();
  });
});

// =====================================================================
// Get Competitors
// =====================================================================
describe("getCompetitors", () => {
  test("returns all competitors for a domain", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival1.com",
      name: "Rival 1",
    });
    await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival2.com",
      name: "Rival 2",
    });

    const competitors = await asUser.query(api.competitors.getCompetitors, {
      domainId: tenant.domainId,
    });
    expect(competitors.length).toBe(2);
    const domains = competitors.map((c: any) => c.competitorDomain).sort();
    expect(domains).toEqual(["rival1.com", "rival2.com"]);
  });

  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(api.competitors.getCompetitors, {
      domainId: tenant.domainId,
    });
    expect(result).toEqual([]);
  });
});

// =====================================================================
// Update Competitor
// =====================================================================
describe("updateCompetitor", () => {
  test("updates name and status", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const competitorId = await asUser.mutation(api.competitors.addCompetitor, {
      domainId: tenant.domainId,
      competitorDomain: "rival.com",
    });

    await asUser.mutation(api.competitors.updateCompetitor, {
      competitorId,
      name: "New Name",
      status: "paused",
    });

    const competitor = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(competitor.name).toBe("New Name");
    expect(competitor.status).toBe("paused");
  });
});

// =====================================================================
// Competitor Positions
// =====================================================================
describe("competitor positions", () => {
  test("store and query competitor positions", async () => {
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

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
        searchVolume: 5000,
      });
    });

    // Store positions via internal mutation
    await t.mutation(internal.competitors.saveCompetitorPosition, {
      competitorId,
      keywordId,
      date: "2025-01-15",
      position: 5,
      url: "https://rival.com/seo-tools",
    });

    await t.mutation(internal.competitors.saveCompetitorPosition, {
      competitorId,
      keywordId,
      date: "2025-01-16",
      position: 3,
      url: "https://rival.com/seo-tools",
    });

    // Query positions
    const asUser = t.withIdentity({ subject: tenant.userId });
    const positions = await asUser.action(api.competitors.getCompetitorPositions, {
      competitorId,
      keywordId,
    });

    expect(positions.length).toBe(2);
    // Positions are returned in desc order, take(30)
    expect(positions[0].position).toBe(3); // Latest first
    expect(positions[1].position).toBe(5);
  });

  test("saveCompetitorPosition updates existing position for same date", async () => {
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

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    // Store position for a date
    await t.mutation(internal.competitors.saveCompetitorPosition, {
      competitorId,
      keywordId,
      date: "2025-01-15",
      position: 5,
      url: "https://rival.com/seo-tools",
    });

    // Store again for same date with updated position
    await t.mutation(internal.competitors.saveCompetitorPosition, {
      competitorId,
      keywordId,
      date: "2025-01-15",
      position: 2,
      url: "https://rival.com/seo-tools-v2",
    });

    // Should only have 1 position entry (updated, not duplicated)
    const positions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor_keyword", (q: any) =>
          q.eq("competitorId", competitorId).eq("keywordId", keywordId)
        )
        .collect();
    });
    expect(positions.length).toBe(1);
    expect(positions[0].position).toBe(2);
    expect(positions[0].url).toBe("https://rival.com/seo-tools-v2");
  });
});

// =====================================================================
// Competitor Stats
// =====================================================================
// getCompetitors (scoped by domain)
// =====================================================================
describe("getCompetitors scoping", () => {
  test("returns competitors scoped to the correct domain", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Create a second domain under the same project
    const domain2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("domains", {
        projectId: tenant.projectId,
        domain: "othersite.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "weekly" as const,
          searchEngine: "google",
          location: "United States",
          language: "en",
        },
      });
    });

    // Add competitor to domain 1
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival-for-domain1.com",
        name: "Rival for D1",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    // Add competitor to domain 2
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: domain2Id,
        competitorDomain: "rival-for-domain2.com",
        name: "Rival for D2",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const compsD1 = await asUser.query(api.competitors.getCompetitors, {
      domainId: tenant.domainId,
    });
    expect(compsD1.length).toBe(1);
    expect(compsD1[0].competitorDomain).toBe("rival-for-domain1.com");

    const compsD2 = await asUser.query(api.competitors.getCompetitors, {
      domainId: domain2Id,
    });
    expect(compsD2.length).toBe(1);
    expect(compsD2[0].competitorDomain).toBe("rival-for-domain2.com");
  });
});

// =====================================================================
// getCompetitorsForKeyword
// =====================================================================
describe("getCompetitorsForKeyword", () => {
  test("returns competitors with their latest position for a keyword", async () => {
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

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    // Store a position
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorKeywordPositions", {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 4,
        url: "https://rival.com/seo-tools",
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.action(api.competitors.getCompetitorsForKeyword, {
      domainId: tenant.domainId,
      keywordId,
    });

    expect(result.length).toBe(1);
    expect(result[0].competitorDomain).toBe("rival.com");
    expect(result[0].currentPosition).toBe(4);
  });

  test("returns null position when no data exists", async () => {
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

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.action(api.competitors.getCompetitorsForKeyword, {
      domainId: tenant.domainId,
      keywordId,
    });

    expect(result.length).toBe(1);
    expect(result[0].currentPosition).toBeNull();
  });
});

// =====================================================================
// Internal: storeCompetitorPositionInternal
// =====================================================================
describe("storeCompetitorPositionInternal", () => {
  test("creates and updates positions correctly", async () => {
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

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    // Create new position
    const posId1 = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 7,
        url: "https://rival.com/seo-tools",
      }
    );
    expect(posId1).toBeDefined();

    // Update existing position for same date
    const posId2 = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 4,
        url: "https://rival.com/seo-tools-updated",
      }
    );
    // Should return the same ID since it's an update
    expect(posId2).toBe(posId1);

    // Verify the update
    const pos = await t.run(async (ctx: any) => ctx.db.get(posId1));
    expect(pos.position).toBe(4);
    expect(pos.url).toBe("https://rival.com/seo-tools-updated");
  });
});

// =====================================================================
// Competitor Comparison Data (competitorComparison_queries)
// =====================================================================
describe("competitorComparison_queries", () => {
  test("getPositionScatterData returns scatter data with matching positions", async () => {
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

    // Add competitor position for same keyword
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorKeywordPositions", {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 7,
        url: "https://rival.com/seo-tools",
        fetchedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const scatter = await asUser.action(
      api.competitorComparison_queries.getPositionScatterData,
      { domainId: tenant.domainId }
    );

    expect(scatter.length).toBe(1);
    expect(scatter[0].keyword).toBe("seo tools");
    expect(scatter[0].yourPosition).toBe(3);
    expect(scatter[0].competitorPosition).toBe(7);
    expect(scatter[0].searchVolume).toBe(5000);
  });

  test("getPositionScatterData returns empty when no matching positions", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const scatter = await asUser.action(
      api.competitorComparison_queries.getPositionScatterData,
      { domainId: tenant.domainId }
    );
    expect(scatter).toEqual([]);
  });
});
