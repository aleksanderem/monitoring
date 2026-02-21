import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create minimal tenant hierarchy for action tests
async function createTenantWithDomain(t: any, domainName = "example.com") {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
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
      domain: domainName,
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google.com",
        location: "United States",
        language: "en",
      },
    });
  });

  return { orgId, teamId, projectId, domainId };
}

// =====================================================================
// suggestCompetitors
// =====================================================================
describe("suggestCompetitors", () => {
  test("returns mock competitors when DataForSEO credentials are not set", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    // Without DATAFORSEO_LOGIN/PASSWORD env vars, the action returns mock data
    const result = await t.action(api.competitors_actions.suggestCompetitors, {
      domainId,
    });

    expect(result.success).toBe(true);
    expect(result.competitors).toBeDefined();
    expect(result.competitors.length).toBeGreaterThan(0);
    // Verify mock competitor shape
    const first = result.competitors[0];
    expect(first).toHaveProperty("domain");
    expect(first).toHaveProperty("intersections");
    expect(first).toHaveProperty("avgPosition");
    expect(first).toHaveProperty("etv");
    expect(typeof first.domain).toBe("string");
    expect(typeof first.intersections).toBe("number");
    expect(typeof first.etv).toBe("number");
  });

  test("returns error when domain does not exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    // Delete the domain so lookup fails
    await t.run(async (ctx: any) => {
      await ctx.db.delete(domainId);
    });

    const result = await t.action(api.competitors_actions.suggestCompetitors, {
      domainId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Domain not found");
    expect(result.competitors).toEqual([]);
  });

  test("mock competitors have expected structure with 8 entries", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    const result = await t.action(api.competitors_actions.suggestCompetitors, {
      domainId,
    });

    expect(result.success).toBe(true);
    // The mock data has exactly 8 competitors
    expect(result.competitors).toHaveLength(8);

    // All entries should have numeric intersections and etv
    for (const comp of result.competitors) {
      expect(comp.intersections).toBeGreaterThan(0);
      expect(comp.etv).toBeGreaterThan(0);
      expect(comp.domain).toMatch(/\./); // domain should contain a dot
    }
  });
});
