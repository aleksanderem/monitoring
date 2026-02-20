import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create full hierarchy (user -> org -> orgMember -> team -> teamMember -> project -> domain)
 * and return all IDs plus an authenticated client.
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

/**
 * Helper: create a scan for a domain and return its ID.
 */
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
// getLatestScan
// =============================================

describe("getLatestScan", () => {
  test("returns null when no scans exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getLatestScan, { domainId });
    expect(result).toBeNull();
  });

  test("returns the most recent scan", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    // Create two scans — older one first
    await t.run(async (ctx) => {
      await ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now() - 120000,
        completedAt: Date.now() - 60000,
      });
    });

    const latestScanId = await t.run(async (ctx) => {
      return await ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now() - 30000,
        completedAt: Date.now(),
        summary: { totalPages: 10, totalIssues: 2 },
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getLatestScan, { domainId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(latestScanId);
    expect(result!.summary?.totalPages).toBe(10);
  });
});

// =============================================
// getScanHistory
// =============================================

describe("getScanHistory", () => {
  test("returns empty array when no scans exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getScanHistory, { domainId });
    expect(result).toEqual([]);
  });

  test("returns scans in descending order with limit", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    for (let i = 0; i < 5; i++) {
      await t.run(async (ctx) => {
        await ctx.db.insert("onSiteScans", {
          domainId,
          status: "complete",
          startedAt: Date.now() - (5 - i) * 60000,
          completedAt: Date.now() - (5 - i) * 30000,
        });
      });
    }

    const result = await asUser.query(api.seoAudit_queries.getScanHistory, { domainId, limit: 3 });
    expect(result).toHaveLength(3);
  });
});

// =============================================
// getLatestAnalysis
// =============================================

describe("getLatestAnalysis", () => {
  test("returns null when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getLatestAnalysis, { domainId });
    expect(result).toBeNull();
  });

  test("returns the most recent analysis", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 78,
        totalPages: 15,
        criticalIssues: 2,
        warnings: 5,
        recommendations: 8,
        issues: {
          missingTitles: 1,
          missingMetaDescriptions: 2,
          duplicateContent: 0,
          brokenLinks: 1,
          slowPages: 3,
          suboptimalTitles: 0,
          thinContent: 1,
          missingH1: 0,
          largeImages: 2,
          missingAltText: 3,
        },
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getLatestAnalysis, { domainId });
    expect(result).not.toBeNull();
    expect(result!.healthScore).toBe(78);
    expect(result!.totalPages).toBe(15);
    expect(result!.criticalIssues).toBe(2);
  });
});

// =============================================
// getScanPagesCount
// =============================================

describe("getScanPagesCount", () => {
  test("returns 0 when scan has no pages", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    const count = await asUser.query(api.seoAudit_queries.getScanPagesCount, { scanId });
    expect(count).toBe(0);
  });

  test("returns correct page count for a scan", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("domainOnsitePages", {
          domainId,
          scanId,
          url: `https://mysite.com/page${i}`,
          statusCode: 200,
          wordCount: 500,
          issueCount: 0,
          issues: [],
        });
      }
    });

    const count = await asUser.query(api.seoAudit_queries.getScanPagesCount, { scanId });
    expect(count).toBe(3);
  });
});

// =============================================
// getPagesList
// =============================================

describe("getPagesList", () => {
  test("returns empty when no pages exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getPagesList, { domainId });
    expect(result.pages).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  test("filters pages with issues", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/clean",
        statusCode: 200,
        wordCount: 800,
        issueCount: 0,
        issues: [],
      });

      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/broken",
        statusCode: 200,
        wordCount: 100,
        issueCount: 2,
        issues: [
          { type: "critical" as const, category: "meta_tags", message: "Missing title" },
          { type: "warning" as const, category: "content", message: "Thin content" },
        ],
      });
    });

    const withIssues = await asUser.query(api.seoAudit_queries.getPagesList, {
      domainId,
      scanId,
      hasIssues: true,
    });
    expect(withIssues.pages).toHaveLength(1);
    expect(withIssues.pages[0].url).toBe("https://mysite.com/broken");

    const noIssues = await asUser.query(api.seoAudit_queries.getPagesList, {
      domainId,
      scanId,
      hasIssues: false,
    });
    expect(noIssues.pages).toHaveLength(1);
    expect(noIssues.pages[0].url).toBe("https://mysite.com/clean");
  });

  test("supports search query filtering", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/blog/seo-guide",
        title: "Complete SEO Guide",
        statusCode: 200,
        wordCount: 2000,
        issueCount: 0,
        issues: [],
      });

      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://mysite.com/about",
        title: "About Us",
        statusCode: 200,
        wordCount: 300,
        issueCount: 0,
        issues: [],
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getPagesList, {
      domainId,
      searchQuery: "seo",
    });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].url).toContain("seo-guide");
  });

  test("paginates results with offset and limit", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("domainOnsitePages", {
          domainId,
          scanId,
          url: `https://mysite.com/page-${String.fromCharCode(65 + i)}`,
          statusCode: 200,
          wordCount: 500,
          issueCount: 0,
          issues: [],
        });
      }
    });

    const result = await asUser.query(api.seoAudit_queries.getPagesList, {
      domainId,
      limit: 2,
      offset: 0,
    });
    expect(result.pages).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.hasMore).toBe(true);

    const page2 = await asUser.query(api.seoAudit_queries.getPagesList, {
      domainId,
      limit: 2,
      offset: 4,
    });
    expect(page2.pages).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });
});

// =============================================
// isOnsiteDataStale
// =============================================

describe("isOnsiteDataStale", () => {
  test("returns true when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.isOnsiteDataStale, { domainId });
    expect(result).toBe(true);
  });

  test("returns false for recent analysis", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 85,
        totalPages: 10,
        criticalIssues: 0,
        warnings: 2,
        recommendations: 3,
        issues: {
          missingTitles: 0, missingMetaDescriptions: 0, duplicateContent: 0,
          brokenLinks: 0, slowPages: 0, suboptimalTitles: 0,
          thinContent: 0, missingH1: 0, largeImages: 0, missingAltText: 0,
        },
        fetchedAt: Date.now(), // fresh
      });
    });

    const result = await asUser.query(api.seoAudit_queries.isOnsiteDataStale, { domainId });
    expect(result).toBe(false);
  });

  test("returns true for stale analysis (older than 7 days)", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 85,
        totalPages: 10,
        criticalIssues: 0,
        warnings: 2,
        recommendations: 3,
        issues: {
          missingTitles: 0, missingMetaDescriptions: 0, duplicateContent: 0,
          brokenLinks: 0, slowPages: 0, suboptimalTitles: 0,
          thinContent: 0, missingH1: 0, largeImages: 0, missingAltText: 0,
        },
        fetchedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      });
    });

    const result = await asUser.query(api.seoAudit_queries.isOnsiteDataStale, { domainId });
    expect(result).toBe(true);
  });
});

// =============================================
// getIssuesByCategory
// =============================================

describe("getIssuesByCategory", () => {
  test("returns empty array when no issues exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getIssuesByCategory, { domainId });
    expect(result).toEqual([]);
  });

  test("groups issues by category with severity counts", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "critical",
        category: "meta_tags",
        title: "Missing title",
        description: "Page has no title tag",
        affectedPages: 3,
        detectedAt: Date.now(),
      });

      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "warning",
        category: "meta_tags",
        title: "Short meta description",
        description: "Meta description is too short",
        affectedPages: 5,
        detectedAt: Date.now(),
      });

      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "critical",
        category: "performance",
        title: "Slow page load",
        description: "Page takes over 3s to load",
        affectedPages: 2,
        detectedAt: Date.now(),
      });

      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "recommendation",
        category: "images",
        title: "Missing alt text",
        description: "Images should have alt attributes",
        affectedPages: 10,
        detectedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getIssuesByCategory, { domainId });
    expect(result).toHaveLength(3); // meta_tags, performance, images

    const metaTags = result.find((r: any) => r.category === "meta_tags");
    expect(metaTags?.critical).toBe(1);
    expect(metaTags?.warnings).toBe(1);
    expect(metaTags?.recommendations).toBe(0);
    expect(metaTags?.total).toBe(2);

    const performance = result.find((r: any) => r.category === "performance");
    expect(performance?.critical).toBe(1);
    expect(performance?.total).toBe(1);

    const images = result.find((r: any) => r.category === "images");
    expect(images?.recommendations).toBe(1);
    expect(images?.total).toBe(1);
  });
});

// =============================================
// getCriticalIssues
// =============================================

describe("getCriticalIssues", () => {
  test("returns only critical issues sorted by affected pages", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "critical",
        category: "links",
        title: "Broken links",
        description: "Multiple broken links found",
        affectedPages: 15,
        detectedAt: Date.now(),
      });

      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "critical",
        category: "meta_tags",
        title: "Missing titles",
        description: "Pages missing title tags",
        affectedPages: 8,
        detectedAt: Date.now(),
      });

      // This warning should NOT appear in critical results
      await ctx.db.insert("onSiteIssues", {
        scanId, domainId,
        severity: "warning",
        category: "content",
        title: "Thin content",
        description: "Pages with low word count",
        affectedPages: 20,
        detectedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getCriticalIssues, { domainId });
    expect(result).toHaveLength(2);
    // Sorted by affectedPages descending
    expect(result[0].title).toBe("Broken links");
    expect(result[0].affectedPages).toBe(15);
    expect(result[1].title).toBe("Missing titles");
    expect(result[1].affectedPages).toBe(8);
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert("onSiteIssues", {
          scanId, domainId,
          severity: "critical",
          category: "meta_tags",
          title: `Critical issue ${i}`,
          description: `Description ${i}`,
          affectedPages: 10 - i,
          detectedAt: Date.now(),
        });
      }
    });

    const result = await asUser.query(api.seoAudit_queries.getCriticalIssues, {
      domainId,
      limit: 2,
    });
    expect(result).toHaveLength(2);
  });
});

// =============================================
// getPagesWithFailedCheck
// =============================================

describe("getPagesWithFailedCheck", () => {
  test("finds pages with failing checks array entries", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      // Page with a failed check
      await ctx.db.insert("domainOnsitePages", {
        domainId, scanId,
        url: "https://mysite.com/no-title",
        statusCode: 200,
        wordCount: 500,
        issueCount: 1,
        issues: [{ type: "critical" as const, category: "meta_tags", message: "Missing title" }],
        checks: [
          { check: "title_tag", passed: false, message: "No title found" },
          { check: "meta_description", passed: true, message: "OK" },
        ],
      });

      // Page with all checks passing
      await ctx.db.insert("domainOnsitePages", {
        domainId, scanId,
        url: "https://mysite.com/good-page",
        statusCode: 200,
        wordCount: 800,
        issueCount: 0,
        issues: [],
        checks: [
          { check: "title_tag", passed: true, message: "OK" },
          { check: "meta_description", passed: true, message: "OK" },
        ],
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getPagesWithFailedCheck, {
      scanId,
      checkCategory: "title_tag",
    });
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://mysite.com/no-title");
  });

  test("falls back to issues array when no checks field", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId, scanId,
        url: "https://mysite.com/legacy-page",
        statusCode: 200,
        wordCount: 500,
        issueCount: 1,
        issues: [{ type: "warning" as const, category: "images", message: "Missing alt text on images" }],
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getPagesWithFailedCheck, {
      scanId,
      checkCategory: "images",
    });
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://mysite.com/legacy-page");
  });
});

// =============================================
// getSitemapData / getRobotsData
// =============================================

describe("getSitemapData", () => {
  test("returns null when no sitemap data exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getSitemapData, { domainId });
    expect(result).toBeNull();
  });

  test("returns sitemap data for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainSitemapData", {
        domainId,
        sitemapUrl: "https://mysite.com/sitemap.xml",
        totalUrls: 42,
        urls: ["https://mysite.com/", "https://mysite.com/about"],
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getSitemapData, { domainId });
    expect(result).not.toBeNull();
    expect(result!.totalUrls).toBe(42);
    expect(result!.sitemapUrl).toBe("https://mysite.com/sitemap.xml");
  });
});

describe("getRobotsData", () => {
  test("returns null when no robots data exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getRobotsData, { domainId });
    expect(result).toBeNull();
  });

  test("returns robots data for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainRobotsData", {
        domainId,
        robotsUrl: "https://mysite.com/robots.txt",
        directives: { "User-agent": "*", Disallow: "/admin/" },
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getRobotsData, { domainId });
    expect(result).not.toBeNull();
    expect(result!.robotsUrl).toBe("https://mysite.com/robots.txt");
  });
});

// =============================================
// getCrawlAnalyticsAvailability
// =============================================

describe("getCrawlAnalyticsAvailability", () => {
  test("returns all false when no crawl data exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getCrawlAnalyticsAvailability, { domainId });
    expect(result.hasLinks).toBe(false);
    expect(result.hasRedirects).toBe(false);
    expect(result.hasImages).toBe(false);
    expect(result.hasWordFreq).toBe(false);
    expect(result.hasRobotsTest).toBe(false);
    expect(result.hasPageSpeed).toBe(false);
  });

  test("detects available crawl analytics data", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("crawlLinkAnalysis", {
        domainId, scanId,
        totalLinks: 100, internalLinks: 80, externalLinks: 20, nofollowLinks: 5,
        links: [],
        fetchedAt: Date.now(),
      });

      await ctx.db.insert("crawlImageAnalysis", {
        domainId, scanId,
        totalImages: 50, missingAltCount: 10,
        images: [],
        fetchedAt: Date.now(),
      });

      // Add a page so hasPageSpeed becomes true
      await ctx.db.insert("domainOnsitePages", {
        domainId, scanId,
        url: "https://mysite.com/",
        statusCode: 200,
        wordCount: 500,
        issueCount: 0,
        issues: [],
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getCrawlAnalyticsAvailability, { domainId });
    expect(result.hasLinks).toBe(true);
    expect(result.hasRedirects).toBe(false);
    expect(result.hasImages).toBe(true);
    expect(result.hasWordFreq).toBe(false);
    expect(result.hasRobotsTest).toBe(false);
    expect(result.hasPageSpeed).toBe(true);
  });
});

// =============================================
// getFullAuditSections
// =============================================

describe("getFullAuditSections", () => {
  test("returns null when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getFullAuditSections, { domainId });
    expect(result).toBeNull();
  });

  test("returns grade, sections, issues and recommendations", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 72,
        totalPages: 20,
        criticalIssues: 3,
        warnings: 5,
        recommendations: 8,
        issues: {
          missingTitles: 1, missingMetaDescriptions: 2, duplicateContent: 0,
          brokenLinks: 1, slowPages: 2, suboptimalTitles: 0,
          thinContent: 1, missingH1: 0, largeImages: 1, missingAltText: 3,
        },
        grade: "B",
        sections: { technical: { score: 80 }, on_page: { score: 70 } },
        allIssues: [{ priority: "high", section: "technical", issue: "Slow TTFB", action: "Optimize server" }],
        auditRecommendations: ["Add meta descriptions", "Fix broken links"],
        pagesAnalyzed: 18,
        fetchedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getFullAuditSections, { domainId });
    expect(result).not.toBeNull();
    expect(result!.grade).toBe("B");
    expect(result!.healthScore).toBe(72);
    expect(result!.pagesAnalyzed).toBe(18);
    expect(result!.recommendations).toHaveLength(2);
    expect(result!.allIssues).toHaveLength(1);
    expect(result!.sections.technical.score).toBe(80);
  });
});

// =============================================
// getPageSpeedData
// =============================================

describe("getPageSpeedData", () => {
  test("returns null when no pages have lighthouse scores", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getPageSpeedData, { domainId });
    expect(result).toBeNull();
  });

  test("computes averages from lighthouse data", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId, scanId,
        url: "https://mysite.com/fast",
        statusCode: 200,
        wordCount: 600,
        issueCount: 0,
        issues: [],
        lighthouseScores: { performance: 90, accessibility: 95, bestPractices: 88, seo: 92 },
        coreWebVitals: { largestContentfulPaint: 1.2, firstInputDelay: 50, timeToInteractive: 2.5, domComplete: 3.0, cumulativeLayoutShift: 0.05 },
      });

      await ctx.db.insert("domainOnsitePages", {
        domainId, scanId,
        url: "https://mysite.com/slow",
        statusCode: 200,
        wordCount: 300,
        issueCount: 0,
        issues: [],
        lighthouseScores: { performance: 50, accessibility: 75, bestPractices: 60, seo: 80 },
        coreWebVitals: { largestContentfulPaint: 4.0, firstInputDelay: 200, timeToInteractive: 6.0, domComplete: 7.0, cumulativeLayoutShift: 0.3 },
      });
    });

    const result = await asUser.query(api.seoAudit_queries.getPageSpeedData, { domainId });
    expect(result).not.toBeNull();
    expect(result!.totalPages).toBe(2);
    expect(result!.averages.performance).toBe(70); // (90+50)/2
    expect(result!.averages.accessibility).toBe(85); // (95+75)/2
    expect(result!.avgCwv).not.toBeNull();
    expect(result!.avgCwv!.lcp).toBe(2.6); // (1.2+4.0)/2
    // Per-page sorted by performance ascending (worst first)
    expect(result!.perPage[0].url).toBe("https://mysite.com/slow");
    expect(result!.perPage[1].url).toBe("https://mysite.com/fast");
  });
});

// =============================================
// getWordFrequency
// =============================================

describe("getWordFrequency", () => {
  test("returns empty array when no data exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const result = await asUser.query(api.seoAudit_queries.getWordFrequency, { domainId });
    expect(result).toEqual([]);
  });

  test("filters by phrase length", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupTestHierarchy(t);

    const scanId = await createScan(t, domainId);

    await t.run(async (ctx) => {
      await ctx.db.insert("crawlWordFrequency", {
        domainId, scanId,
        phraseLength: 1,
        totalWords: 500,
        data: [{ word: "seo", absFreq: 50 }, { word: "tools", absFreq: 30 }],
        fetchedAt: Date.now(),
      });

      await ctx.db.insert("crawlWordFrequency", {
        domainId, scanId,
        phraseLength: 2,
        totalWords: 300,
        data: [{ word: "seo tools", absFreq: 20 }],
        fetchedAt: Date.now(),
      });
    });

    const unigrams = await asUser.query(api.seoAudit_queries.getWordFrequency, {
      domainId,
      phraseLength: 1,
    });
    expect(unigrams).toHaveLength(1);
    expect(unigrams[0].phraseLength).toBe(1);

    const all = await asUser.query(api.seoAudit_queries.getWordFrequency, { domainId });
    expect(all).toHaveLength(2);
  });
});
