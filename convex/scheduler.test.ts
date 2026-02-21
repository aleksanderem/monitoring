import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupChain(
  t: any,
  refreshFrequency: "daily" | "weekly" | "on_demand" = "daily"
) {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: `test-org-${Date.now()}`,
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
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
      domain: `example-${refreshFrequency}.com`,
      createdAt: Date.now(),
      settings: {
        refreshFrequency,
        searchEngine: "google.com",
        location: "US",
        language: "en",
      },
    });
  });

  return { orgId, teamId, projectId, domainId };
}

async function addKeyword(
  t: any,
  domainId: any,
  phrase: string,
  status: "active" | "paused" | "pending_approval" = "active"
) {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("keywords", {
      domainId,
      phrase,
      createdAt: Date.now(),
      status,
    });
  });
}

// ---------------------------------------------------------------------------
// getDailyDomains
// ---------------------------------------------------------------------------

describe("getDailyDomains", () => {
  test("returns only daily domains", async () => {
    const t = convexTest(schema, modules);

    const { domainId: dailyId } = await setupChain(t, "daily");
    await setupChain(t, "weekly");
    await setupChain(t, "on_demand");

    const result = await t.query(internal.scheduler.getDailyDomains, {});

    expect(result).toHaveLength(1);
    expect(result[0]._id).toEqual(dailyId);
    expect(result[0].settings.refreshFrequency).toBe("daily");
  });

  test("returns empty when no daily domains exist", async () => {
    const t = convexTest(schema, modules);

    await setupChain(t, "weekly");
    await setupChain(t, "on_demand");

    const result = await t.query(internal.scheduler.getDailyDomains, {});

    expect(result).toHaveLength(0);
  });

  test("returns multiple daily domains", async () => {
    const t = convexTest(schema, modules);

    await setupChain(t, "daily");
    await setupChain(t, "daily");

    const result = await t.query(internal.scheduler.getDailyDomains, {});

    expect(result).toHaveLength(2);
    result.forEach((d: any) => {
      expect(d.settings.refreshFrequency).toBe("daily");
    });
  });
});

// ---------------------------------------------------------------------------
// getWeeklyDomains
// ---------------------------------------------------------------------------

describe("getWeeklyDomains", () => {
  test("returns only weekly domains", async () => {
    const t = convexTest(schema, modules);

    await setupChain(t, "daily");
    const { domainId: weeklyId } = await setupChain(t, "weekly");
    await setupChain(t, "on_demand");

    const result = await t.query(internal.scheduler.getWeeklyDomains, {});

    expect(result).toHaveLength(1);
    expect(result[0]._id).toEqual(weeklyId);
    expect(result[0].settings.refreshFrequency).toBe("weekly");
  });

  test("returns empty when no weekly domains exist", async () => {
    const t = convexTest(schema, modules);

    await setupChain(t, "daily");
    await setupChain(t, "on_demand");

    const result = await t.query(internal.scheduler.getWeeklyDomains, {});

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDomainKeywords
// ---------------------------------------------------------------------------

describe("getDomainKeywords", () => {
  test("returns only active keywords for the given domain", async () => {
    const t = convexTest(schema, modules);

    const { domainId } = await setupChain(t, "daily");

    await addKeyword(t, domainId, "seo tools", "active");
    await addKeyword(t, domainId, "keyword tracker", "active");
    await addKeyword(t, domainId, "rank monitor", "paused");

    const result = await t.query(internal.scheduler.getDomainKeywords, {
      domainId,
    });

    expect(result).toHaveLength(2);
    const phrases = result.map((k: any) => k.phrase).sort();
    expect(phrases).toEqual(["keyword tracker", "seo tools"]);
    result.forEach((k: any) => {
      expect(k.status).toBe("active");
    });
  });

  test("excludes paused keywords", async () => {
    const t = convexTest(schema, modules);

    const { domainId } = await setupChain(t, "weekly");

    await addKeyword(t, domainId, "paused keyword", "paused");

    const result = await t.query(internal.scheduler.getDomainKeywords, {
      domainId,
    });

    expect(result).toHaveLength(0);
  });

  test("excludes pending_approval keywords", async () => {
    const t = convexTest(schema, modules);

    const { domainId } = await setupChain(t, "daily");

    await addKeyword(t, domainId, "pending kw", "pending_approval");
    await addKeyword(t, domainId, "active kw", "active");

    const result = await t.query(internal.scheduler.getDomainKeywords, {
      domainId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].phrase).toBe("active kw");
  });

  test("does not return keywords from other domains", async () => {
    const t = convexTest(schema, modules);

    const { domainId: domain1 } = await setupChain(t, "daily");
    const { domainId: domain2 } = await setupChain(t, "weekly");

    await addKeyword(t, domain1, "domain1 keyword", "active");
    await addKeyword(t, domain2, "domain2 keyword", "active");

    const result = await t.query(internal.scheduler.getDomainKeywords, {
      domainId: domain1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].phrase).toBe("domain1 keyword");
  });

  test("returns empty when domain has no keywords", async () => {
    const t = convexTest(schema, modules);

    const { domainId } = await setupChain(t, "daily");

    const result = await t.query(internal.scheduler.getDomainKeywords, {
      domainId,
    });

    expect(result).toHaveLength(0);
  });
});
