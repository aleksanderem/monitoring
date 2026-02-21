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
// getGeneratorOutputs
// ---------------------------------------------------------------------------

describe("getGeneratorOutputs", () => {
  test("returns empty array when no outputs exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const results = await t.query(api.generators.getGeneratorOutputs, {
      domainId,
    });
    expect(results).toEqual([]);
  });

  test("returns all outputs for a domain when no type filter", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 1,
        status: "completed",
        content: "schema content",
        createdAt: Date.now() - 1000,
      });
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "llmsTxt",
        version: 1,
        status: "completed",
        content: "llms content",
        createdAt: Date.now(),
      });
    });

    const results = await t.query(api.generators.getGeneratorOutputs, {
      domainId,
    });
    expect(results).toHaveLength(2);
  });

  test("filters by type when type is provided", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 1,
        status: "completed",
        createdAt: Date.now(),
      });
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "llmsTxt",
        version: 1,
        status: "completed",
        createdAt: Date.now(),
      });
    });

    const results = await t.query(api.generators.getGeneratorOutputs, {
      domainId,
      type: "jsonSchema",
    });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("jsonSchema");
  });

  test("returns results in descending order", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 1,
        status: "completed",
        createdAt: Date.now() - 2000,
      });
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 2,
        status: "completed",
        createdAt: Date.now(),
      });
    });

    const results = await t.query(api.generators.getGeneratorOutputs, {
      domainId,
      type: "jsonSchema",
    });
    expect(results).toHaveLength(2);
    // Descending order: version 2 first
    expect(results[0].version).toBe(2);
    expect(results[1].version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getLatestOutput
// ---------------------------------------------------------------------------

describe("getLatestOutput", () => {
  test("returns null when no output exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const result = await t.query(api.generators.getLatestOutput, {
      domainId,
      type: "jsonSchema",
    });
    expect(result).toBeNull();
  });

  test("returns the latest output by type", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 1,
        status: "completed",
        content: "v1",
        createdAt: Date.now() - 2000,
      });
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 2,
        status: "completed",
        content: "v2",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.generators.getLatestOutput, {
      domainId,
      type: "jsonSchema",
    });
    expect(result).not.toBeNull();
    expect(result!.version).toBe(2);
    expect(result!.content).toBe("v2");
  });

  test("does not return outputs of a different type", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("generatorOutputs", {
        domainId,
        type: "llmsTxt",
        version: 1,
        status: "completed",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.generators.getLatestOutput, {
      domainId,
      type: "jsonSchema",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createGeneratorOutput
// ---------------------------------------------------------------------------

describe("createGeneratorOutput", () => {
  test("creates output with version 1 when none exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const outputId = await t.mutation(api.generators.createGeneratorOutput, {
      domainId,
      type: "jsonSchema",
    });
    expect(outputId).toBeDefined();

    const output = await t.run(async (ctx: any) => {
      return ctx.db.get(outputId);
    });
    expect(output.version).toBe(1);
    expect(output.status).toBe("pending");
    expect(output.type).toBe("jsonSchema");
  });

  test("auto-increments version for same domain and type", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(api.generators.createGeneratorOutput, {
      domainId,
      type: "jsonSchema",
    });
    const secondId = await t.mutation(api.generators.createGeneratorOutput, {
      domainId,
      type: "jsonSchema",
    });

    const second = await t.run(async (ctx: any) => {
      return ctx.db.get(secondId);
    });
    expect(second.version).toBe(2);
  });

  test("versions are independent per type", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.mutation(api.generators.createGeneratorOutput, {
      domainId,
      type: "jsonSchema",
    });
    const llmsId = await t.mutation(api.generators.createGeneratorOutput, {
      domainId,
      type: "llmsTxt",
    });

    const llms = await t.run(async (ctx: any) => {
      return ctx.db.get(llmsId);
    });
    expect(llms.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updateGeneratorStatus (internal mutation)
// ---------------------------------------------------------------------------

describe("updateGeneratorStatus", () => {
  test("updates status only", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const outputId = await t.run(async (ctx: any) => {
      return ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 1,
        status: "pending",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.generators.updateGeneratorStatus, {
      outputId,
      status: "generating",
    });

    const updated = await t.run(async (ctx: any) => {
      return ctx.db.get(outputId);
    });
    expect(updated.status).toBe("generating");
    expect(updated.content).toBeUndefined();
  });

  test("updates status with content and metadata", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const outputId = await t.run(async (ctx: any) => {
      return ctx.db.insert("generatorOutputs", {
        domainId,
        type: "llmsTxt",
        version: 1,
        status: "generating",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.generators.updateGeneratorStatus, {
      outputId,
      status: "completed",
      content: "Generated llms.txt content",
      metadata: { pages: 10, tokens: 500 },
    });

    const updated = await t.run(async (ctx: any) => {
      return ctx.db.get(outputId);
    });
    expect(updated.status).toBe("completed");
    expect(updated.content).toBe("Generated llms.txt content");
    expect(updated.metadata).toEqual({ pages: 10, tokens: 500 });
  });

  test("updates status with error on failure", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const outputId = await t.run(async (ctx: any) => {
      return ctx.db.insert("generatorOutputs", {
        domainId,
        type: "jsonSchema",
        version: 1,
        status: "generating",
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.generators.updateGeneratorStatus, {
      outputId,
      status: "failed",
      error: "AI provider unavailable",
    });

    const updated = await t.run(async (ctx: any) => {
      return ctx.db.get(outputId);
    });
    expect(updated.status).toBe("failed");
    expect(updated.error).toBe("AI provider unavailable");
  });
});

// ---------------------------------------------------------------------------
// getOnsitePagesInternal
// ---------------------------------------------------------------------------

describe("getOnsitePagesInternal", () => {
  test("returns empty array when no pages exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const results = await t.query(internal.generators.getOnsitePagesInternal, {
      domainId,
    });
    expect(results).toEqual([]);
  });

  test("returns all pages for a domain, default limit 50", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const scanId = await t.run(async (ctx: any) => {
      return ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/page-a",
        statusCode: 200,
        wordCount: 500,
        issueCount: 0,
        issues: [],
      });
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/page-b",
        statusCode: 200,
        wordCount: 1000,
        issueCount: 0,
        issues: [],
      });
    });

    const results = await t.query(internal.generators.getOnsitePagesInternal, {
      domainId,
    });
    expect(results).toHaveLength(2);
    // Both pages returned with correct fields
    const urls = results.map((r: any) => r.url);
    expect(urls).toContain("https://example.com/page-a");
    expect(urls).toContain("https://example.com/page-b");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const scanId = await t.run(async (ctx: any) => {
      return ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("domainOnsitePages", {
          domainId,
          scanId,
          url: `https://example.com/page-${i}`,
          statusCode: 200,
          wordCount: 100 + i * 100,
          issueCount: 0,
          issues: [],
        });
      }
    });

    const results = await t.query(internal.generators.getOnsitePagesInternal, {
      domainId,
      limit: 2,
    });
    expect(results).toHaveLength(2);
  });

  test("maps fields correctly", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const scanId = await t.run(async (ctx: any) => {
      return ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/test",
        statusCode: 200,
        title: "Test Page",
        metaDescription: "A test page",
        h1: "Test Heading",
        wordCount: 800,
        issueCount: 0,
        issues: [],
        htags: { h1: ["Test Heading"], h2: ["Subtitle"] },
      });
    });

    const results = await t.query(internal.generators.getOnsitePagesInternal, {
      domainId,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      url: "https://example.com/test",
      title: "Test Page",
      metaDescription: "A test page",
      h1: "Test Heading",
      htags: { h1: ["Test Heading"], h2: ["Subtitle"] },
      wordCount: 800,
      statusCode: 200,
    });
  });
});

// ---------------------------------------------------------------------------
// getSchemaValidationInternal
// ---------------------------------------------------------------------------

describe("getSchemaValidationInternal", () => {
  test("returns empty array when no validations exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const results = await t.query(
      internal.generators.getSchemaValidationInternal,
      { domainId }
    );
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getSitemapUrlsInternal
// ---------------------------------------------------------------------------

describe("getSitemapUrlsInternal", () => {
  test("returns empty array when no sitemap data exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const results = await t.query(
      internal.generators.getSitemapUrlsInternal,
      { domainId }
    );
    expect(results).toEqual([]);
  });

  test("returns urls from the latest sitemap entry", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainSitemapData", {
        domainId,
        sitemapUrl: "https://example.com/sitemap.xml",
        totalUrls: 3,
        urls: [
          "https://example.com/page-1",
          "https://example.com/page-2",
          "https://example.com/page-3",
        ],
        fetchedAt: Date.now(),
      });
    });

    const results = await t.query(
      internal.generators.getSitemapUrlsInternal,
      { domainId }
    );
    expect(results).toHaveLength(3);
    expect(results).toContain("https://example.com/page-1");
  });
});

// ---------------------------------------------------------------------------
// getTopKeywordsInternal
// ---------------------------------------------------------------------------

describe("getTopKeywordsInternal", () => {
  test("returns empty array when no keywords exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    const results = await t.query(
      internal.generators.getTopKeywordsInternal,
      { domainId }
    );
    expect(results).toEqual([]);
  });

  test("filters out keywords without position or with position 0", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "no position",
        createdAt: Date.now(),
        status: "active",
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "zero position",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 0,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "has position",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 5,
        currentUrl: "https://example.com/page",
      });
    });

    const results = await t.query(
      internal.generators.getTopKeywordsInternal,
      { domainId }
    );
    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe("has position");
    expect(results[0].position).toBe(5);
  });

  test("sorts by position ascending and respects limit", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomain(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos 10",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 10,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos 1",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 1,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos 5",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 5,
      });
    });

    const results = await t.query(
      internal.generators.getTopKeywordsInternal,
      { domainId, limit: 2 }
    );
    expect(results).toHaveLength(2);
    expect(results[0].keyword).toBe("pos 1");
    expect(results[1].keyword).toBe("pos 5");
  });
});
