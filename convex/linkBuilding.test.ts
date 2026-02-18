import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDomain(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return ctx.db.insert("users", { name: "Alice", email: "alice@test.com" });
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

  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "mysite.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google.com",
        location: "US",
        language: "en",
      },
    });
  });

  return { userId, orgId, teamId, projectId, domainId };
}

/** Insert N prospects with varied properties for testing aggregation. */
async function insertProspects(
  t: any,
  domainId: string,
  prospects: Array<{
    referringDomain: string;
    prospectScore: number;
    estimatedImpact: number;
    acquisitionDifficulty: "easy" | "medium" | "hard";
    suggestedChannel: "broken_link" | "guest_post" | "resource_page" | "outreach" | "content_mention";
    status: "identified" | "reviewing" | "dismissed";
  }>
) {
  await t.run(async (ctx: any) => {
    for (const p of prospects) {
      await ctx.db.insert("linkBuildingProspects", {
        domainId,
        referringDomain: p.referringDomain,
        domainRank: 50,
        linksToCompetitors: 3,
        competitors: ["comp1.com"],
        prospectScore: p.prospectScore,
        acquisitionDifficulty: p.acquisitionDifficulty,
        suggestedChannel: p.suggestedChannel,
        estimatedImpact: p.estimatedImpact,
        status: p.status,
        generatedAt: Date.now(),
      });
    }
  });
}

// ===========================================================================
// getTopProspects
// ===========================================================================

describe("linkBuilding_queries.getTopProspects", () => {
  test("returns prospects sorted by score (highest first)", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(t, domainId, [
      { referringDomain: "low.com", prospectScore: 20, estimatedImpact: 10, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "identified" },
      { referringDomain: "high.com", prospectScore: 90, estimatedImpact: 80, acquisitionDifficulty: "hard", suggestedChannel: "guest_post", status: "identified" },
      { referringDomain: "mid.com", prospectScore: 50, estimatedImpact: 40, acquisitionDifficulty: "medium", suggestedChannel: "resource_page", status: "identified" },
    ]);

    const prospects = await t.query(api.linkBuilding_queries.getTopProspects, {
      domainId,
    });

    expect(prospects).toHaveLength(3);
    expect(prospects[0].referringDomain).toBe("high.com");
    expect(prospects[1].referringDomain).toBe("mid.com");
    expect(prospects[2].referringDomain).toBe("low.com");
  });

  test("excludes dismissed prospects by default", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(t, domainId, [
      { referringDomain: "active.com", prospectScore: 70, estimatedImpact: 50, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "identified" },
      { referringDomain: "dismissed.com", prospectScore: 80, estimatedImpact: 60, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "dismissed" },
    ]);

    const prospects = await t.query(api.linkBuilding_queries.getTopProspects, {
      domainId,
    });

    expect(prospects).toHaveLength(1);
    expect(prospects[0].referringDomain).toBe("active.com");
  });

  test("returns dismissed when explicitly filtered", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(t, domainId, [
      { referringDomain: "active.com", prospectScore: 70, estimatedImpact: 50, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "identified" },
      { referringDomain: "dismissed.com", prospectScore: 80, estimatedImpact: 60, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "dismissed" },
    ]);

    const prospects = await t.query(api.linkBuilding_queries.getTopProspects, {
      domainId,
      status: "dismissed",
    });

    expect(prospects).toHaveLength(1);
    expect(prospects[0].referringDomain).toBe("dismissed.com");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(
      t,
      domainId,
      Array.from({ length: 10 }, (_, i) => ({
        referringDomain: `site${i}.com`,
        prospectScore: 50 + i,
        estimatedImpact: 30 + i,
        acquisitionDifficulty: "easy" as const,
        suggestedChannel: "outreach" as const,
        status: "identified" as const,
      }))
    );

    const prospects = await t.query(api.linkBuilding_queries.getTopProspects, {
      domainId,
      limit: 3,
    });

    expect(prospects).toHaveLength(3);
  });
});

// ===========================================================================
// getProspectsByChannel
// ===========================================================================

describe("linkBuilding_queries.getProspectsByChannel", () => {
  test("groups prospects by channel with correct avgScore and avgImpact", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(t, domainId, [
      { referringDomain: "a.com", prospectScore: 80, estimatedImpact: 60, acquisitionDifficulty: "easy", suggestedChannel: "guest_post", status: "identified" },
      { referringDomain: "b.com", prospectScore: 40, estimatedImpact: 20, acquisitionDifficulty: "medium", suggestedChannel: "guest_post", status: "identified" },
      { referringDomain: "c.com", prospectScore: 70, estimatedImpact: 50, acquisitionDifficulty: "hard", suggestedChannel: "outreach", status: "identified" },
      { referringDomain: "d.com", prospectScore: 90, estimatedImpact: 80, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "dismissed" }, // dismissed = excluded
    ]);

    const channels = await t.query(api.linkBuilding_queries.getProspectsByChannel, {
      domainId,
    });

    expect(channels).toHaveLength(2);

    // guest_post has 2 prospects, outreach has 1 (dismissed excluded)
    const guestPost = channels.find((c: any) => c.channel === "guest_post");
    expect(guestPost).toBeDefined();
    expect(guestPost!.count).toBe(2);
    expect(guestPost!.avgScore).toBe(60); // (80+40)/2
    expect(guestPost!.avgImpact).toBe(40); // (60+20)/2

    const outreach = channels.find((c: any) => c.channel === "outreach");
    expect(outreach).toBeDefined();
    expect(outreach!.count).toBe(1);
    expect(outreach!.avgScore).toBe(70);
    expect(outreach!.avgImpact).toBe(50);
  });

  test("sorted by count descending", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(t, domainId, [
      { referringDomain: "a.com", prospectScore: 50, estimatedImpact: 30, acquisitionDifficulty: "easy", suggestedChannel: "broken_link", status: "identified" },
      { referringDomain: "b.com", prospectScore: 50, estimatedImpact: 30, acquisitionDifficulty: "easy", suggestedChannel: "guest_post", status: "identified" },
      { referringDomain: "c.com", prospectScore: 50, estimatedImpact: 30, acquisitionDifficulty: "easy", suggestedChannel: "guest_post", status: "identified" },
      { referringDomain: "d.com", prospectScore: 50, estimatedImpact: 30, acquisitionDifficulty: "easy", suggestedChannel: "guest_post", status: "identified" },
    ]);

    const channels = await t.query(api.linkBuilding_queries.getProspectsByChannel, {
      domainId,
    });

    expect(channels[0].channel).toBe("guest_post");
    expect(channels[0].count).toBe(3);
    expect(channels[1].channel).toBe("broken_link");
    expect(channels[1].count).toBe(1);
  });
});

// ===========================================================================
// getProspectStats
// ===========================================================================

describe("linkBuilding_queries.getProspectStats", () => {
  test("returns correct totals and breakdown", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await insertProspects(t, domainId, [
      { referringDomain: "a.com", prospectScore: 80, estimatedImpact: 60, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "identified" },
      { referringDomain: "b.com", prospectScore: 60, estimatedImpact: 40, acquisitionDifficulty: "medium", suggestedChannel: "outreach", status: "reviewing" },
      { referringDomain: "c.com", prospectScore: 40, estimatedImpact: 20, acquisitionDifficulty: "hard", suggestedChannel: "outreach", status: "identified" },
      { referringDomain: "d.com", prospectScore: 30, estimatedImpact: 10, acquisitionDifficulty: "easy", suggestedChannel: "outreach", status: "dismissed" },
    ]);

    const stats = await t.query(api.linkBuilding_queries.getProspectStats, {
      domainId,
    });

    expect(stats).not.toBeNull();
    expect(stats!.totalProspects).toBe(4);
    expect(stats!.activeProspects).toBe(3); // excludes dismissed
    expect(stats!.reviewingCount).toBe(1);
    expect(stats!.dismissedCount).toBe(1);

    // avgScore from active only: (80+60+40)/3 = 60
    expect(stats!.avgScore).toBe(60);
    // avgImpact from active only: (60+40+20)/3 = 40
    expect(stats!.avgImpact).toBe(40);

    expect(stats!.byDifficulty.easy).toBe(1); // "a.com" is active+easy
    expect(stats!.byDifficulty.medium).toBe(1);
    expect(stats!.byDifficulty.hard).toBe(1);

    expect(stats!.generatedAt).toBeDefined();
  });

  test("returns null for empty domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const stats = await t.query(api.linkBuilding_queries.getProspectStats, {
      domainId,
    });

    expect(stats).toBeNull();
  });
});

// ===========================================================================
// updateProspectStatus
// ===========================================================================

describe("linkBuilding_mutations.updateProspectStatus", () => {
  test("updates prospect from identified to reviewing", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const prospectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("linkBuildingProspects", {
        domainId,
        referringDomain: "prospect.com",
        domainRank: 50,
        linksToCompetitors: 3,
        competitors: ["comp.com"],
        prospectScore: 70,
        acquisitionDifficulty: "medium",
        suggestedChannel: "outreach",
        estimatedImpact: 50,
        status: "identified",
        generatedAt: Date.now(),
      });
    });

    await t.mutation(api.linkBuilding_mutations.updateProspectStatus, {
      prospectId,
      status: "reviewing",
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(prospectId));
    expect(updated!.status).toBe("reviewing");
  });

  test("updates prospect to dismissed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const prospectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("linkBuildingProspects", {
        domainId,
        referringDomain: "dismiss.com",
        domainRank: 30,
        linksToCompetitors: 1,
        competitors: ["c.com"],
        prospectScore: 20,
        acquisitionDifficulty: "easy",
        suggestedChannel: "broken_link",
        estimatedImpact: 10,
        status: "identified",
        generatedAt: Date.now(),
      });
    });

    await t.mutation(api.linkBuilding_mutations.updateProspectStatus, {
      prospectId,
      status: "dismissed",
    });

    const updated = await t.run(async (ctx: any) => ctx.db.get(prospectId));
    expect(updated!.status).toBe("dismissed");
  });
});

// ===========================================================================
// Integration: status change affects query results
// ===========================================================================

describe("linkBuilding - status lifecycle", () => {
  test("dismissing a prospect removes it from default getTopProspects", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const prospectId = await t.run(async (ctx: any) => {
      return ctx.db.insert("linkBuildingProspects", {
        domainId,
        referringDomain: "willbedismissed.com",
        domainRank: 50,
        linksToCompetitors: 2,
        competitors: ["c.com"],
        prospectScore: 60,
        acquisitionDifficulty: "medium",
        suggestedChannel: "outreach",
        estimatedImpact: 40,
        status: "identified",
        generatedAt: Date.now(),
      });
    });

    // Verify it appears initially
    let prospects = await t.query(api.linkBuilding_queries.getTopProspects, { domainId });
    expect(prospects).toHaveLength(1);

    // Dismiss it
    await t.mutation(api.linkBuilding_mutations.updateProspectStatus, {
      prospectId,
      status: "dismissed",
    });

    // No longer in default results
    prospects = await t.query(api.linkBuilding_queries.getTopProspects, { domainId });
    expect(prospects).toHaveLength(0);

    // Still in dismissed filter
    prospects = await t.query(api.linkBuilding_queries.getTopProspects, {
      domainId,
      status: "dismissed",
    });
    expect(prospects).toHaveLength(1);
  });
});
