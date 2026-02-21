import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDomain(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return ctx.db.insert("users", { email: "alice@test.com" });
  });

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
      role: "owner" as const,
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

  const projectId = await t.run(async (ctx: any) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
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

function makeKeyword(overrides: Partial<{
  keyword: string;
  searchIntent: string;
  relevanceScore: number;
  rationale: string;
  category: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  difficulty: number;
}> = {}) {
  return {
    keyword: overrides.keyword ?? "test keyword",
    searchIntent: overrides.searchIntent ?? "informational",
    relevanceScore: overrides.relevanceScore ?? 85,
    rationale: overrides.rationale ?? "Highly relevant",
    category: overrides.category ?? "SEO",
    searchVolume: overrides.searchVolume ?? 1000,
    cpc: overrides.cpc ?? 1.5,
    competition: overrides.competition ?? 0.5,
    difficulty: overrides.difficulty ?? 40,
  };
}

// ===========================================================================
// getHistory
// ===========================================================================

describe("aiResearch.getHistory", () => {
  test("returns empty array when no sessions exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const result = await t.query(api.aiResearch.getHistory, { domainId });
    expect(result).toEqual([]);
  });

  test("returns sessions ordered desc by creation time", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // Insert sessions with different timestamps
    await t.run(async (ctx: any) => {
      await ctx.db.insert("aiResearchSessions", {
        domainId,
        businessDescription: "First",
        targetCustomer: "B2B",
        keywordCount: 5,
        focusType: "all",
        keywords: [makeKeyword({ keyword: "first kw" })],
        createdAt: 1000,
      });
      await ctx.db.insert("aiResearchSessions", {
        domainId,
        businessDescription: "Second",
        targetCustomer: "B2C",
        keywordCount: 3,
        focusType: "informational",
        keywords: [makeKeyword({ keyword: "second kw" })],
        createdAt: 2000,
      });
    });

    const result = await t.query(api.aiResearch.getHistory, { domainId });
    expect(result).toHaveLength(2);
    // desc order: newest first
    expect(result[0].businessDescription).toBe("Second");
    expect(result[1].businessDescription).toBe("First");
  });

  test("limits to 20 results", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert("aiResearchSessions", {
          domainId,
          businessDescription: `Session ${i}`,
          targetCustomer: "B2B",
          keywordCount: 1,
          focusType: "all",
          keywords: [makeKeyword()],
          createdAt: i * 1000,
        });
      }
    });

    const result = await t.query(api.aiResearch.getHistory, { domainId });
    expect(result).toHaveLength(20);
  });

  test("only returns sessions for specified domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId, projectId } = await setupDomain(t);

    const otherDomainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "other.com",
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
      await ctx.db.insert("aiResearchSessions", {
        domainId,
        businessDescription: "My domain",
        targetCustomer: "B2B",
        keywordCount: 1,
        focusType: "all",
        keywords: [makeKeyword()],
        createdAt: 1000,
      });
      await ctx.db.insert("aiResearchSessions", {
        domainId: otherDomainId,
        businessDescription: "Other domain",
        targetCustomer: "B2C",
        keywordCount: 1,
        focusType: "commercial",
        keywords: [makeKeyword()],
        createdAt: 2000,
      });
    });

    const result = await t.query(api.aiResearch.getHistory, { domainId });
    expect(result).toHaveLength(1);
    expect(result[0].businessDescription).toBe("My domain");
  });
});

// ===========================================================================
// saveSession
// ===========================================================================

describe("aiResearch.saveSession", () => {
  test("inserts a session with all fields and sets createdAt", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const keywords = [
      makeKeyword({ keyword: "seo tools" }),
      makeKeyword({ keyword: "rank tracker", searchVolume: 5000 }),
    ];

    const sessionId = await t.mutation(internal.aiResearch.saveSession, {
      domainId,
      businessDescription: "SEO SaaS platform",
      targetCustomer: "Marketing agencies",
      keywordCount: 2,
      focusType: "commercial",
      keywords,
    });

    expect(sessionId).toBeDefined();

    const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(session.businessDescription).toBe("SEO SaaS platform");
    expect(session.targetCustomer).toBe("Marketing agencies");
    expect(session.keywordCount).toBe(2);
    expect(session.focusType).toBe("commercial");
    expect(session.keywords).toHaveLength(2);
    expect(session.keywords[0].keyword).toBe("seo tools");
    expect(session.createdAt).toBeGreaterThan(0);
  });

  test("supports all focus types", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    for (const focusType of ["all", "informational", "commercial", "transactional"] as const) {
      const sessionId = await t.mutation(internal.aiResearch.saveSession, {
        domainId,
        businessDescription: "Test",
        targetCustomer: "Test",
        keywordCount: 1,
        focusType,
        keywords: [makeKeyword()],
      });
      const session = await t.run(async (ctx: any) => ctx.db.get(sessionId));
      expect(session.focusType).toBe(focusType);
    }
  });
});

// ===========================================================================
// deleteSession
// ===========================================================================

describe("aiResearch.deleteSession", () => {
  test("deletes an existing session", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const sessionId = await t.run(async (ctx: any) => {
      return ctx.db.insert("aiResearchSessions", {
        domainId,
        businessDescription: "To delete",
        targetCustomer: "B2B",
        keywordCount: 1,
        focusType: "all",
        keywords: [makeKeyword()],
        createdAt: Date.now(),
      });
    });

    await t.mutation(api.aiResearch.deleteSession, { id: sessionId });

    const deleted = await t.run(async (ctx: any) => ctx.db.get(sessionId));
    expect(deleted).toBeNull();
  });
});
