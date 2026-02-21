import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create full hierarchy (user -> org -> orgMember -> team -> teamMember -> project -> domain)
 */
async function setupTestHierarchy(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    } as any);
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Test Team",
      createdAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: "mysite.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  const asUser = t.withIdentity({ subject: userId });
  return { userId, orgId, teamId, projectId, domainId, asUser };
}

async function createScan(
  t: ReturnType<typeof convexTest>,
  domainId: Id<"domains">,
  status: "queued" | "crawling" | "processing" | "complete" | "failed" = "complete"
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("onSiteScans", {
      domainId,
      status,
      startedAt: Date.now() - 60000,
      completedAt: status === "complete" ? Date.now() : undefined,
      summary: status === "complete" ? { totalPages: 5, totalIssues: 3 } : undefined,
    });
  });
}

// =============================================
// getLinkAnalysis
// =============================================

describe("getLinkAnalysis", () => {
  test("returns null when no link analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getLinkAnalysis, { domainId });
    expect(result).toBeNull();
  });

  test("returns link analysis data for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("crawlLinkAnalysis", {
        domainId,
        scanId,
        totalLinks: 150,
        internalLinks: 120,
        externalLinks: 30,
        nofollowLinks: 10,
        links: [{ sourceUrl: "/page1", targetUrl: "/page2", anchorText: "link" }],
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getLinkAnalysis, { domainId });
    expect(result).not.toBeNull();
    expect(result!.totalLinks).toBe(150);
    expect(result!.internalLinks).toBe(120);
    expect(result!.externalLinks).toBe(30);
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const result = await t.query(api.seoAudit_queries.getLinkAnalysis, { domainId });
    expect(result).toBeNull();
  });
});

// =============================================
// getRedirectAnalysis
// =============================================

describe("getRedirectAnalysis", () => {
  test("returns null when no redirect analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getRedirectAnalysis, { domainId });
    expect(result).toBeNull();
  });

  test("returns redirect analysis data for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("crawlRedirectAnalysis", {
        domainId,
        scanId,
        totalRedirects: 8,
        redirects: [{ sourceUrl: "/old", targetUrl: "/new", statusCode: 301, chainLength: 1 }],
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getRedirectAnalysis, { domainId });
    expect(result).not.toBeNull();
    expect(result!.totalRedirects).toBe(8);
  });
});

// =============================================
// getImageAnalysis
// =============================================

describe("getImageAnalysis", () => {
  test("returns null when no image analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getImageAnalysis, { domainId });
    expect(result).toBeNull();
  });

  test("returns image analysis data for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("crawlImageAnalysis", {
        domainId,
        scanId,
        totalImages: 75,
        missingAltCount: 12,
        images: [],
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getImageAnalysis, { domainId });
    expect(result).not.toBeNull();
    expect(result!.totalImages).toBe(75);
    expect(result!.missingAltCount).toBe(12);
  });
});

// =============================================
// getRobotsTestResults
// =============================================

describe("getRobotsTestResults", () => {
  test("returns null when no robots test results exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getRobotsTestResults, { domainId });
    expect(result).toBeNull();
  });

  test("returns robots test results for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("crawlRobotsTestResults", {
        domainId,
        scanId,
        robotstxtUrl: "https://mysite.com/robots.txt",
        results: [
          { userAgent: "Googlebot", urlPath: "/admin/", canFetch: false },
          { userAgent: "Googlebot", urlPath: "/blog/", canFetch: true },
        ],
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getRobotsTestResults, { domainId });
    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(2);
    expect(result!.results[0].canFetch).toBe(false);
    expect(result!.results[1].canFetch).toBe(true);
  });
});

// =============================================
// getPsiJobStatus
// =============================================

describe("getPsiJobStatus", () => {
  test("returns null when no scans exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getPsiJobStatus, { domainId });
    expect(result).toBeNull();
  });

  test("returns null when scan has no psiStatus", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await createScan(t, domainId);

    const result = await asUser.query(api.seoAudit_queries.getPsiJobStatus, { domainId });
    expect(result).toBeNull();
  });

  test("returns PSI status when available", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now() - 60000,
        completedAt: Date.now(),
        psiStatus: "running",
        psiProgress: { current: 3, total: 10 },
        psiStartedAt: Date.now() - 30000,
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getPsiJobStatus, { domainId });
    expect(result).not.toBeNull();
    expect(result!.psiStatus).toBe("running");
    expect(result!.psiProgress).toEqual({ current: 3, total: 10 });
    expect(result!.psiError).toBeNull();
  });
});

// =============================================
// Internal Queries
// =============================================

describe("getLatestScanInternal", () => {
  test("returns null when no scans exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const result = await t.query(internal.seoAudit_queries.getLatestScanInternal, { domainId });
    expect(result).toBeNull();
  });

  test("returns the most recent scan without auth", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now() - 120000,
      });
    });

    const latestScanId = await t.run(async (ctx) => {
      return await ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
        summary: { totalPages: 20, totalIssues: 5 },
      });
    });

    const result = await t.query(internal.seoAudit_queries.getLatestScanInternal, { domainId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(latestScanId);
  });
});

describe("getScanById", () => {
  test("returns null for nonexistent scan", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    // Create and delete to get a valid-format but nonexistent ID
    const scanId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("onSiteScans", {
        domainId,
        status: "queued",
        startedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    const result = await t.query(internal.seoAudit_queries.getScanById, { scanId });
    expect(result).toBeNull();
  });

  test("returns scan by ID", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId, "crawling");

    const result = await t.query(internal.seoAudit_queries.getScanById, { scanId });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("crawling");
    expect(result!.domainId).toBe(domainId);
  });
});

describe("getActiveScan", () => {
  test("returns null when no active scans", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    await createScan(t, domainId, "complete");

    const result = await t.query(internal.seoAudit_queries.getActiveScan, { domainId });
    expect(result).toBeNull();
  });

  test("returns crawling scan first", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    await createScan(t, domainId, "queued");
    const crawlingId = await createScan(t, domainId, "crawling");

    const result = await t.query(internal.seoAudit_queries.getActiveScan, { domainId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(crawlingId);
    expect(result!.status).toBe("crawling");
  });

  test("falls back to queued scan when no crawling scan", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const queuedId = await createScan(t, domainId, "queued");

    const result = await t.query(internal.seoAudit_queries.getActiveScan, { domainId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(queuedId);
    expect(result!.status).toBe("queued");
  });
});

describe("getPageBodyTexts", () => {
  test("returns empty array (stub)", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    const result = await t.query(internal.seoAudit_queries.getPageBodyTexts, { scanId, domainId });
    expect(result).toEqual([]);
  });
});

describe("getSitemapDataInternal", () => {
  test("returns null when no sitemap data", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const result = await t.query(internal.seoAudit_queries.getSitemapDataInternal, { domainId });
    expect(result).toBeNull();
  });

  test("returns sitemap data without auth", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainSitemapData", {
        domainId,
        sitemapUrl: "https://mysite.com/sitemap.xml",
        totalUrls: 25,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(internal.seoAudit_queries.getSitemapDataInternal, { domainId });
    expect(result).not.toBeNull();
    expect(result!.totalUrls).toBe(25);
  });
});

describe("getEnrichedPageStats", () => {
  test("returns null when no pages exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    const result = await t.query(internal.seoAudit_queries.getEnrichedPageStats, { scanId });
    expect(result).toBeNull();
  });

  test("computes average word count and load time", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/page1",
        statusCode: 200,
        wordCount: 1000,
        loadTime: 2.5,
        issueCount: 0,
        issues: [],
        lighthouseScores: { performance: 80, accessibility: 90, bestPractices: 85, seo: 95 },
      });

      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/page2",
        statusCode: 200,
        wordCount: 500,
        loadTime: 1.5,
        issueCount: 0,
        issues: [],
        lighthouseScores: { performance: 60, accessibility: 70, bestPractices: 75, seo: 85 },
      });
    });

    const result = await t.query(internal.seoAudit_queries.getEnrichedPageStats, { scanId });
    expect(result).not.toBeNull();
    expect(result!.avgWordCount).toBe(750); // (1000+500)/2
    expect(result!.avgLoadTime).toBe(2); // (2.5+1.5)/2
    expect(result!.avgPerformance).toBe(70); // (80+60)/2
  });

  test("handles pages with zero word count", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/empty",
        statusCode: 200,
        wordCount: 0,
        issueCount: 0,
        issues: [],
      });

      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/content",
        statusCode: 200,
        wordCount: 800,
        issueCount: 0,
        issues: [],
      });
    });

    const result = await t.query(internal.seoAudit_queries.getEnrichedPageStats, { scanId });
    expect(result).not.toBeNull();
    expect(result!.avgWordCount).toBe(800); // Only counts pages with wordCount > 0
    expect(result!.avgLoadTime).toBeUndefined(); // No pages with loadTime
    expect(result!.avgPerformance).toBeUndefined(); // No lighthouse scores
  });
});

describe("getPageUrls", () => {
  test("returns empty array when no pages", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    const result = await t.query(internal.seoAudit_queries.getPageUrls, { scanId });
    expect(result).toEqual([]);
  });

  test("returns page IDs and URLs", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/page1",
        statusCode: 200,
        wordCount: 500,
        issueCount: 0,
        issues: [],
      });
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/page2",
        statusCode: 200,
        wordCount: 300,
        issueCount: 0,
        issues: [],
      });
    });

    const result = await t.query(internal.seoAudit_queries.getPageUrls, { scanId });
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("_id");
    expect(result[0]).toHaveProperty("url");
    const urls = result.map((r: any) => r.url);
    expect(urls).toContain("https://mysite.com/page1");
    expect(urls).toContain("https://mysite.com/page2");
  });
});

describe("getPagesByStatusRange", () => {
  test("filters pages by status code range", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/ok",
        statusCode: 200,
        wordCount: 500,
        issueCount: 0,
        issues: [],
      });
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/redirect",
        statusCode: 301,
        wordCount: 0,
        issueCount: 0,
        issues: [],
      });
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/not-found",
        statusCode: 404,
        wordCount: 0,
        issueCount: 1,
        issues: [{ type: "critical" as const, category: "links", message: "Page not found" }],
      });
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/error",
        statusCode: 500,
        wordCount: 0,
        issueCount: 1,
        issues: [{ type: "critical" as const, category: "performance", message: "Server error" }],
      });
    });

    const redirects = await t.query(internal.seoAudit_queries.getPagesByStatusRange, {
      scanId,
      minStatus: 300,
      maxStatus: 399,
    });
    expect(redirects).toHaveLength(1);
    expect(redirects[0].url).toBe("https://mysite.com/redirect");
    expect(redirects[0].statusCode).toBe(301);

    const clientErrors = await t.query(internal.seoAudit_queries.getPagesByStatusRange, {
      scanId,
      minStatus: 400,
      maxStatus: 499,
    });
    expect(clientErrors).toHaveLength(1);

    const serverErrors = await t.query(internal.seoAudit_queries.getPagesByStatusRange, {
      scanId,
      minStatus: 500,
      maxStatus: 599,
    });
    expect(serverErrors).toHaveLength(1);
  });
});

describe("getImageStatsFromPages", () => {
  test("returns zero counts when no pages", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    const result = await t.query(internal.seoAudit_queries.getImageStatsFromPages, { scanId });
    expect(result.totalImages).toBe(0);
    expect(result.missingAlt).toBe(0);
    expect(result.images).toEqual([]);
  });

  test("aggregates image stats across pages", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/page1",
        statusCode: 200,
        wordCount: 500,
        issueCount: 0,
        issues: [],
        imagesCount: 5,
        imagesMissingAlt: 2,
        imageAlts: [
          { src: "img1.jpg", alt: "Photo", hasAlt: true },
          { src: "img2.jpg", alt: "", hasAlt: false },
        ],
      });

      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/page2",
        statusCode: 200,
        wordCount: 300,
        issueCount: 0,
        issues: [],
        imagesCount: 3,
        imagesMissingAlt: 1,
        imageAlts: [
          { src: "img3.jpg", alt: "Banner", hasAlt: true },
        ],
      });
    });

    const result = await t.query(internal.seoAudit_queries.getImageStatsFromPages, { scanId });
    expect(result.totalImages).toBe(8); // 5 + 3
    expect(result.missingAlt).toBe(3); // 2 + 1
    expect(result.images).toHaveLength(3); // 2 from page1 + 1 from page2
    expect(result.images[0].pageUrl).toBe("https://mysite.com/page1");
    expect(result.images[1].missingAlt).toBe(true);
  });
});
