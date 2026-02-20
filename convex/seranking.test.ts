import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDomain(t: any) {
  return await t.run(async (ctx: any) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
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
    });
    const domainId = await ctx.db.insert("domains", {
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
    return { orgId, teamId, projectId, domainId };
  });
}

// ---------------------------------------------------------------------------
// storeBacklinksSummary (internal mutation)
// ---------------------------------------------------------------------------

describe("storeBacklinksSummary", () => {
  test("inserts new summary when none exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(internal.seranking.storeBacklinksSummary, {
      domainId,
      summary: {
        totalBacklinks: 150,
        totalDomains: 45,
        totalIps: 30,
        totalSubnets: 20,
        dofollow: 120,
        nofollow: 30,
        newBacklinks: 10,
        lostBacklinks: 3,
        avgInlinkRank: 42.5,
      },
    });

    const stored = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinksSummary")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .first();
    });

    expect(stored).not.toBeNull();
    expect(stored.totalBacklinks).toBe(150);
    expect(stored.totalDomains).toBe(45);
    expect(stored.dofollow).toBe(120);
    expect(stored.nofollow).toBe(30);
    expect(stored.newBacklinks).toBe(10);
    expect(stored.lostBacklinks).toBe(3);
    expect(stored.avgInlinkRank).toBe(42.5);
    expect(stored.fetchedAt).toBeGreaterThan(0);
  });

  test("replaces existing summary for same domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // Insert first summary
    await t.mutation(internal.seranking.storeBacklinksSummary, {
      domainId,
      summary: {
        totalBacklinks: 100,
        totalDomains: 30,
        totalIps: 20,
        totalSubnets: 10,
        dofollow: 80,
        nofollow: 20,
      },
    });

    // Insert updated summary
    await t.mutation(internal.seranking.storeBacklinksSummary, {
      domainId,
      summary: {
        totalBacklinks: 200,
        totalDomains: 60,
        totalIps: 40,
        totalSubnets: 25,
        dofollow: 160,
        nofollow: 40,
      },
    });

    const all = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinksSummary")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(all).toHaveLength(1);
    expect(all[0].totalBacklinks).toBe(200);
    expect(all[0].totalDomains).toBe(60);
  });

  test("handles optional fields being undefined", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(internal.seranking.storeBacklinksSummary, {
      domainId,
      summary: {
        totalBacklinks: 50,
        totalDomains: 10,
        totalIps: 5,
        totalSubnets: 3,
        dofollow: 40,
        nofollow: 10,
      },
    });

    const stored = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinksSummary")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .first();
    });

    expect(stored.newBacklinks).toBeUndefined();
    expect(stored.lostBacklinks).toBeUndefined();
    expect(stored.avgInlinkRank).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// storeBacklinks (internal mutation)
// ---------------------------------------------------------------------------

describe("storeBacklinks", () => {
  test("inserts backlinks for a domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(internal.seranking.storeBacklinks, {
      domainId,
      backlinks: [
        {
          urlFrom: "https://referrer.com/page-1",
          urlTo: "https://example.com/target",
          anchor: "example link",
          nofollow: false,
          inlinkRank: 55,
          domainInlinkRank: 60,
          firstSeen: "2025-01-15",
          lastVisited: "2025-06-01",
        },
        {
          urlFrom: "https://other.com/article",
          urlTo: "https://example.com/about",
          anchor: "about us",
          nofollow: true,
        },
      ],
    });

    const stored = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(stored).toHaveLength(2);

    const first = stored.find((b: any) => b.urlFrom === "https://referrer.com/page-1");
    expect(first).toBeDefined();
    expect(first.urlTo).toBe("https://example.com/target");
    expect(first.anchor).toBe("example link");
    expect(first.dofollow).toBe(true); // nofollow=false -> dofollow=true
    expect(first.rank).toBe(55);
    expect(first.firstSeen).toBe("2025-01-15");
    expect(first.lastSeen).toBe("2025-06-01");
    expect(first.domainFrom).toBe("referrer.com");

    const second = stored.find((b: any) => b.urlFrom === "https://other.com/article");
    expect(second).toBeDefined();
    expect(second.dofollow).toBe(false); // nofollow=true -> dofollow=false
    expect(second.domainFrom).toBe("other.com");
  });

  test("replaces existing backlinks on re-store", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // First store
    await t.mutation(internal.seranking.storeBacklinks, {
      domainId,
      backlinks: [
        {
          urlFrom: "https://old.com/link",
          urlTo: "https://example.com/page",
          anchor: "old link",
          nofollow: false,
        },
      ],
    });

    // Second store replaces all
    await t.mutation(internal.seranking.storeBacklinks, {
      domainId,
      backlinks: [
        {
          urlFrom: "https://new.com/link",
          urlTo: "https://example.com/page",
          anchor: "new link",
          nofollow: false,
        },
        {
          urlFrom: "https://another.com/ref",
          urlTo: "https://example.com/about",
          anchor: "another",
          nofollow: true,
        },
      ],
    });

    const stored = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(stored).toHaveLength(2);
    const urls = stored.map((b: any) => b.urlFrom);
    expect(urls).toContain("https://new.com/link");
    expect(urls).toContain("https://another.com/ref");
    expect(urls).not.toContain("https://old.com/link");
  });

  test("handles empty backlinks array", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    // First insert some
    await t.mutation(internal.seranking.storeBacklinks, {
      domainId,
      backlinks: [
        {
          urlFrom: "https://old.com/link",
          urlTo: "https://example.com/page",
          anchor: "old link",
          nofollow: false,
        },
      ],
    });

    // Then store empty -> should clear all
    await t.mutation(internal.seranking.storeBacklinks, {
      domainId,
      backlinks: [],
    });

    const stored = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(stored).toHaveLength(0);
  });

  test("extracts domainFrom from urlFrom correctly", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(internal.seranking.storeBacklinks, {
      domainId,
      backlinks: [
        {
          urlFrom: "https://sub.domain.com/path/to/page",
          urlTo: "https://example.com/",
          anchor: "test",
          nofollow: false,
        },
      ],
    });

    const stored = await t.run(async (ctx: any) => {
      return ctx.db
        .query("domainBacklinks")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .first();
    });

    expect(stored.domainFrom).toBe("sub.domain.com");
  });
});
