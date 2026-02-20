import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full tenant hierarchy (org -> team -> project -> domain)
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
// getCompetitorDetails
// =====================================================================
describe("getCompetitorDetails", () => {
  test("returns competitor by ID", async () => {
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
        name: "Rival Inc",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getCompetitorDetails,
      { competitorId }
    );
    expect(result).not.toBeNull();
    expect(result!.competitorDomain).toBe("rival.com");
    expect(result!.name).toBe("Rival Inc");
    expect(result!.status).toBe("active");
  });

  test("returns null for non-existent competitor", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Create and delete a competitor to get a valid but non-existent ID
    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "temp.com",
        name: "Temp",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });
    await t.run(async (ctx: any) => {
      await ctx.db.delete(competitorId);
    });

    const result = await t.query(
      internal.competitors_internal.getCompetitorDetails,
      { competitorId }
    );
    expect(result).toBeNull();
  });
});

// =====================================================================
// getDomainKeywords
// =====================================================================
describe("getDomainKeywords", () => {
  test("returns only active keywords for domain", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Create active keywords
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "keyword research",
        status: "active" as const,
        createdAt: Date.now(),
      });
      // Paused keyword — should be excluded
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "paused keyword",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getDomainKeywords,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(2);
    const phrases = result.map((k: any) => k.phrase).sort();
    expect(phrases).toEqual(["keyword research", "seo tools"]);
  });

  test("returns empty array when no active keywords exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Only paused keywords
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "paused keyword",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getDomainKeywords,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(0);
  });

  test("does not return keywords from other domains", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

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

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "domain1 keyword",
        status: "active" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("keywords", {
        domainId: domain2Id,
        phrase: "domain2 keyword",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getDomainKeywords,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(1);
    expect(result[0].phrase).toBe("domain1 keyword");
  });
});

// =====================================================================
// getDomainSettings
// =====================================================================
describe("getDomainSettings", () => {
  test("returns domain by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(
      internal.competitors_internal.getDomainSettings,
      { domainId: tenant.domainId }
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("mysite.com");
    expect(result!.settings.searchEngine).toBe("google");
  });

  test("returns null for non-existent domain", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Delete domain to get a valid but missing ID
    const domainId = tenant.domainId;
    await t.run(async (ctx: any) => {
      await ctx.db.delete(domainId);
    });

    const result = await t.query(
      internal.competitors_internal.getDomainSettings,
      { domainId }
    );
    expect(result).toBeNull();
  });
});

// =====================================================================
// storeCompetitorPositionInternal
// =====================================================================
describe("storeCompetitorPositionInternal", () => {
  test("inserts a new position record", async () => {
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

    const posId = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 5,
        url: "https://rival.com/seo-tools",
      }
    );
    expect(posId).toBeDefined();

    const pos = await t.run(async (ctx: any) => ctx.db.get(posId));
    expect(pos.competitorId).toBe(competitorId);
    expect(pos.keywordId).toBe(keywordId);
    expect(pos.date).toBe("2025-01-15");
    expect(pos.position).toBe(5);
    expect(pos.url).toBe("https://rival.com/seo-tools");
    expect(pos.fetchedAt).toBeDefined();
  });

  test("updates existing position for same competitor/keyword/date", async () => {
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

    // Insert first
    const posId1 = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 7,
        url: "https://rival.com/v1",
      }
    );

    // Update same date
    const posId2 = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 3,
        url: "https://rival.com/v2",
      }
    );

    // Should return the same ID (upsert)
    expect(posId2).toBe(posId1);

    const pos = await t.run(async (ctx: any) => ctx.db.get(posId1));
    expect(pos.position).toBe(3);
    expect(pos.url).toBe("https://rival.com/v2");
  });

  test("creates separate records for different dates", async () => {
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

    const posId1 = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: 5,
        url: "https://rival.com/seo-tools",
      }
    );

    const posId2 = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-16",
        position: 3,
        url: "https://rival.com/seo-tools",
      }
    );

    expect(posId1).not.toBe(posId2);

    // Verify both records exist
    const positions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor_keyword", (q: any) =>
          q.eq("competitorId", competitorId).eq("keywordId", keywordId)
        )
        .collect();
    });
    expect(positions.length).toBe(2);
  });

  test("handles null position and url", async () => {
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

    const posId = await t.mutation(
      internal.competitors_internal.storeCompetitorPositionInternal,
      {
        competitorId,
        keywordId,
        date: "2025-01-15",
        position: null,
        url: null,
      }
    );

    const pos = await t.run(async (ctx: any) => ctx.db.get(posId));
    expect(pos.position).toBeNull();
    expect(pos.url).toBeNull();
  });
});

// =====================================================================
// updateLastChecked
// =====================================================================
describe("updateLastChecked", () => {
  test("updates lastCheckedAt timestamp on competitor", async () => {
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

    // Initially no lastCheckedAt
    const before = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(before.lastCheckedAt).toBeUndefined();

    await t.mutation(internal.competitors_internal.updateLastChecked, {
      competitorId,
    });

    const after = await t.run(async (ctx: any) => ctx.db.get(competitorId));
    expect(after.lastCheckedAt).toBeDefined();
    expect(typeof after.lastCheckedAt).toBe("number");
  });
});

// =====================================================================
// getActiveCompetitors
// =====================================================================
describe("getActiveCompetitors", () => {
  test("returns only active competitors for domain", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "active1.com",
        name: "Active 1",
        status: "active" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "active2.com",
        name: "Active 2",
        status: "active" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "paused.com",
        name: "Paused",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getActiveCompetitors,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(2);
    const domains = result.map((c: any) => c.competitorDomain).sort();
    expect(domains).toEqual(["active1.com", "active2.com"]);
  });

  test("returns empty array when no active competitors", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "paused.com",
        name: "Paused",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getActiveCompetitors,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(0);
  });

  test("does not return competitors from other domains", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

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

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival-d1.com",
        name: "Rival D1",
        status: "active" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("competitors", {
        domainId: domain2Id,
        competitorDomain: "rival-d2.com",
        name: "Rival D2",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getActiveCompetitors,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(1);
    expect(result[0].competitorDomain).toBe("rival-d1.com");
  });
});

// =====================================================================
// getCompetitorsByDomain
// =====================================================================
describe("getCompetitorsByDomain", () => {
  test("returns all competitors regardless of status", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "active.com",
        name: "Active",
        status: "active" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "paused.com",
        name: "Paused",
        status: "paused" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(
      internal.competitors_internal.getCompetitorsByDomain,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(2);
    const statuses = result.map((c: any) => c.status).sort();
    expect(statuses).toEqual(["active", "paused"]);
  });

  test("returns empty for domain with no competitors", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(
      internal.competitors_internal.getCompetitorsByDomain,
      { domainId: tenant.domainId }
    );
    expect(result.length).toBe(0);
  });
});

// =====================================================================
// verifyDomainAccess
// =====================================================================
describe("verifyDomainAccess", () => {
  test("returns domain when user has org membership", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      internal.competitors_internal.verifyDomainAccess,
      { domainId: tenant.domainId }
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("mysite.com");
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(
      internal.competitors_internal.verifyDomainAccess,
      { domainId: tenant.domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null for user without org membership", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Create a second user with no org membership
    const otherUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        email: "bob@example.com",
        emailVerificationTime: Date.now(),
      });
    });

    const asOther = t.withIdentity({ subject: otherUserId });
    const result = await asOther.query(
      internal.competitors_internal.verifyDomainAccess,
      { domainId: tenant.domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null for user in different org", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Create a second user in a different org
    const otherUserId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        email: "bob@example.com",
        emailVerificationTime: Date.now(),
      });
    });

    const otherOrgId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("organizations", {
        name: "Org B",
        slug: "org-b",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" as const },
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("organizationMembers", {
        organizationId: otherOrgId,
        userId: otherUserId,
        role: "member" as const,
        joinedAt: Date.now(),
      });
    });

    const asOther = t.withIdentity({ subject: otherUserId });
    const result = await asOther.query(
      internal.competitors_internal.verifyDomainAccess,
      { domainId: tenant.domainId }
    );
    expect(result).toBeNull();
  });

  test("returns null when domain does not exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    // Delete domain to create valid but missing ID
    const domainId = tenant.domainId;
    await t.run(async (ctx: any) => {
      await ctx.db.delete(domainId);
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(
      internal.competitors_internal.verifyDomainAccess,
      { domainId }
    );
    expect(result).toBeNull();
  });
});
