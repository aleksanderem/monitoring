import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDomainWithScan(t: ReturnType<typeof convexTest>) {
  const projectId = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
    });
    const teamId = await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Test Team",
      createdAt: Date.now(),
    });
    return await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  const scanId = await t.run(async (ctx) => {
    return await ctx.db.insert("onSiteScans", {
      domainId,
      status: "queued",
      startedAt: Date.now(),
      source: "seo_audit",
    });
  });

  return { projectId, domainId, scanId };
}

// ===========================================================================
// triggerSeoAuditScan
// ===========================================================================

describe("seoAudit_actions.triggerSeoAuditScan", () => {
  test("creates a scan record with status queued", async () => {
    const t = convexTest(schema, modules);

    const projectId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Test Team",
        createdAt: Date.now(),
      });
      return await ctx.db.insert("projects", {
        teamId,
        name: "Test Project",
        createdAt: Date.now(),
      });
    });

    const domainId = await t.run(async (ctx) => {
      return await ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
    });

    const scanId = await t.mutation(api.seoAudit_actions.triggerSeoAuditScan, {
      domainId,
    });

    expect(scanId).toBeDefined();

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan).not.toBeNull();
    expect(scan!.status).toBe("queued");
    expect(scan!.domainId).toBe(domainId);
    expect(scan!.source).toBe("seo_audit");
  });

  test("throws if a scan is already in progress", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomainWithScan(t);

    // First scan already exists from setupDomainWithScan (status: queued)
    await expect(
      t.mutation(api.seoAudit_actions.triggerSeoAuditScan, { domainId })
    ).rejects.toThrow("A scan is already in progress");
  });
});

// ===========================================================================
// triggerInstantPagesScan
// ===========================================================================

describe("seoAudit_actions.triggerInstantPagesScan", () => {
  test("creates a scan record for instant scan", async () => {
    const t = convexTest(schema, modules);

    const projectId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Test Team",
        createdAt: Date.now(),
      });
      return await ctx.db.insert("projects", {
        teamId,
        name: "Test Project",
        createdAt: Date.now(),
      });
    });

    const domainId = await t.run(async (ctx) => {
      return await ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: {
          refreshFrequency: "daily" as const,
          searchEngine: "google",
          location: "US",
          language: "en",
        },
      });
    });

    const scanId = await t.mutation(api.seoAudit_actions.triggerInstantPagesScan, {
      domainId,
    });

    expect(scanId).toBeDefined();

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan).not.toBeNull();
    expect(scan!.status).toBe("queued");
  });

  test("throws if a scan is already in progress", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await setupDomainWithScan(t);

    await expect(
      t.mutation(api.seoAudit_actions.triggerInstantPagesScan, { domainId })
    ).rejects.toThrow("A scan is already in progress");
  });
});

// ===========================================================================
// cancelSeoAuditScan
// ===========================================================================

describe("seoAudit_actions.cancelSeoAuditScan", () => {
  test("marks a queued scan as failed with cancellation message", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    const result = await t.mutation(api.seoAudit_actions.cancelSeoAuditScan, {
      scanId,
    });
    expect(result).toEqual({ success: true });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("failed");
    expect(scan!.error).toBe("Scan cancelled by user");
    expect(scan!.completedAt).toBeDefined();
  });

  test("throws for a completed scan", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    // Mark as complete first
    await t.run(async (ctx) => {
      await ctx.db.patch(scanId, { status: "complete", completedAt: Date.now() });
    });

    await expect(
      t.mutation(api.seoAudit_actions.cancelSeoAuditScan, { scanId })
    ).rejects.toThrow("Cannot cancel scan with status: complete");
  });

  test("throws for non-existent scan", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    // Delete the scan
    await t.run(async (ctx) => {
      await ctx.db.delete(scanId);
    });

    await expect(
      t.mutation(api.seoAudit_actions.cancelSeoAuditScan, { scanId })
    ).rejects.toThrow("Scan not found");
  });
});

// ===========================================================================
// Internal helper mutations
// ===========================================================================

describe("seoAudit_actions.updateScanStatus", () => {
  test("updates scan status", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.updateScanStatus, {
      scanId,
      status: "crawling",
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("crawling");
  });
});

describe("seoAudit_actions.updateScanProgress", () => {
  test("updates progress fields", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.updateScanProgress, {
      scanId,
      pagesScanned: 5,
      totalPagesToScan: 20,
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.pagesScanned).toBe(5);
    expect(scan!.totalPagesToScan).toBe(20);
    expect(scan!.lastProgressUpdate).toBeDefined();
  });

  test("no-ops if scan does not exist", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.run(async (ctx) => {
      await ctx.db.delete(scanId);
    });

    // Should not throw
    await t.mutation(internal.seoAudit_actions.updateScanProgress, {
      scanId,
      pagesScanned: 1,
    });
  });
});

describe("seoAudit_actions.updateScanJobId", () => {
  test("stores seoAuditJobId and fullAuditJobId", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.updateScanJobId, {
      scanId,
      jobId: "job-abc-123",
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.seoAuditJobId).toBe("job-abc-123");
    expect(scan!.fullAuditJobId).toBe("job-abc-123");
  });
});

describe("seoAudit_actions.updateScanCrawlJobId", () => {
  test("stores advertoolsCrawlJobId", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.updateScanCrawlJobId, {
      scanId,
      crawlJobId: "crawl-xyz-456",
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.advertoolsCrawlJobId).toBe("crawl-xyz-456");
  });
});

describe("seoAudit_actions.failScan", () => {
  test("marks scan as failed with error message", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.failScan, {
      scanId,
      error: "API timeout",
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("failed");
    expect(scan!.error).toBe("API timeout");
    expect(scan!.completedAt).toBeDefined();
  });
});

describe("seoAudit_actions.updateAuditSubStatus", () => {
  test("sets seoAuditStatus field", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.updateAuditSubStatus, {
      scanId,
      seoAuditStatus: "running",
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.seoAuditStatus).toBe("running");
  });
});

describe("seoAudit_actions.updateCrawlSubStatus", () => {
  test("sets advertoolsCrawlStatus field", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.updateCrawlSubStatus, {
      scanId,
      advertoolsCrawlStatus: "completed",
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.advertoolsCrawlStatus).toBe("completed");
  });
});

// ===========================================================================
// Data storage mutations
// ===========================================================================

describe("seoAudit_actions.storeSitemapData", () => {
  test("inserts sitemap data record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeSitemapData, {
      domainId,
      scanId,
      sitemapUrl: "https://example.com/sitemap.xml",
      totalUrls: 3,
      urls: ["https://example.com/", "https://example.com/about", "https://example.com/contact"],
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("domainSitemapData").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].totalUrls).toBe(3);
    expect(records[0].urls).toHaveLength(3);
    expect(records[0].fetchedAt).toBeDefined();
  });
});

describe("seoAudit_actions.storeRobotsData", () => {
  test("inserts robots data record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeRobotsData, {
      domainId,
      scanId,
      robotsUrl: "https://example.com/robots.txt",
      directives: { "User-agent": "*", Disallow: "/admin" },
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("domainRobotsData").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].robotsUrl).toBe("https://example.com/robots.txt");
  });
});

describe("seoAudit_actions.storeLinkAnalysis", () => {
  test("inserts link analysis record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeLinkAnalysis, {
      domainId,
      scanId,
      totalLinks: 100,
      internalLinks: 70,
      externalLinks: 25,
      nofollowLinks: 5,
      links: [],
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("crawlLinkAnalysis").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].totalLinks).toBe(100);
    expect(records[0].internalLinks).toBe(70);
    expect(records[0].externalLinks).toBe(25);
  });
});

describe("seoAudit_actions.storeRedirectAnalysis", () => {
  test("inserts redirect analysis record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeRedirectAnalysis, {
      domainId,
      scanId,
      totalRedirects: 5,
      redirects: [{ from: "/old", to: "/new", status: 301 }],
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("crawlRedirectAnalysis").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].totalRedirects).toBe(5);
  });
});

describe("seoAudit_actions.storeImageAnalysis", () => {
  test("inserts image analysis record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeImageAnalysis, {
      domainId,
      scanId,
      totalImages: 50,
      missingAltCount: 10,
      images: [],
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("crawlImageAnalysis").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].totalImages).toBe(50);
    expect(records[0].missingAltCount).toBe(10);
  });
});

describe("seoAudit_actions.storeWordFrequency", () => {
  test("inserts word frequency record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeWordFrequency, {
      domainId,
      scanId,
      phraseLength: 1,
      totalWords: 500,
      data: [
        { word: "seo", absFreq: 25 },
        { word: "optimization", absFreq: 18 },
      ],
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("crawlWordFrequency").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].phraseLength).toBe(1);
    expect(records[0].data).toHaveLength(2);
  });
});

describe("seoAudit_actions.storeRobotsTestResults", () => {
  test("inserts robots test results record", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.storeRobotsTestResults, {
      domainId,
      scanId,
      robotstxtUrl: "https://example.com/robots.txt",
      results: [
        { userAgent: "Googlebot", urlPath: "/admin", canFetch: false },
        { userAgent: "Googlebot", urlPath: "/", canFetch: true },
      ],
    });

    const records = await t.run(async (ctx) => {
      return await ctx.db.query("crawlRobotsTestResults").collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].results).toHaveLength(2);
  });
});

// ===========================================================================
// storeSeoAuditResults (internal mutation)
// ===========================================================================

describe("seoAudit_actions.storeSeoAuditResults", () => {
  test("stores per-URL check-based results creating pages, analysis, and issues", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    const results = [
      {
        url: "https://example.com/",
        score: 80,
        results: [
          { check: "HTTPS_CHECK", passed: true, result: "OK" },
          { check: "H1_FOUND", passed: false, result: "Missing H1 tag" },
          { check: "CANONICAL_FOUND", passed: true, result: "OK" },
        ],
      },
      {
        url: "https://example.com/about",
        score: 60,
        results: [
          { check: "HTTPS_CHECK", passed: false, result: "Not HTTPS" },
          { check: "H1_FOUND", passed: false, result: "Missing H1" },
        ],
      },
    ];

    await t.mutation(internal.seoAudit_actions.storeSeoAuditResults, {
      scanId,
      domainId,
      results,
    });

    // Check pages were created
    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .collect();
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].onpageScore).toBe(80);
    expect(pages[1].onpageScore).toBe(60);

    // Check analysis was created
    const analysis = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .first();
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.totalPages).toBe(2);
    expect(analysis!.healthScore).toBe(70); // (80+60)/2

    // Check issues were created
    const issues = await t.run(async (ctx) => {
      return await ctx.db.query("onSiteIssues").collect();
    });
    // H1_FOUND failed on 2 pages, HTTPS_CHECK failed on 1 page
    expect(issues.length).toBeGreaterThanOrEqual(2);

    // Scan should be marked complete (no crawl sub-status)
    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.seoAuditStatus).toBe("completed");
    expect(scan!.status).toBe("complete");
  });

  test("handles wrapped result formats", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    // Format: {results: [...]}
    const results = {
      results: [
        {
          url: "https://example.com/page1",
          score: 90,
          results: [{ check: "HTTPS_CHECK", passed: true, result: "OK" }],
        },
      ],
    };

    await t.mutation(internal.seoAudit_actions.storeSeoAuditResults, {
      scanId,
      domainId,
      results,
    });

    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .collect();
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].onpageScore).toBe(90);
  });
});

// ===========================================================================
// storeFullAuditResults (internal mutation)
// ===========================================================================

describe("seoAudit_actions.storeFullAuditResults", () => {
  test("stores sections-format audit results", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    const result = {
      summary: {
        score: 85,
        grade: "B",
        pages_analyzed: 10,
        critical_issues: 1,
        important_issues: 3,
        minor_issues: 5,
      },
      sections: {
        technical: { score: 80 },
        on_page: { score: 90 },
      },
      all_issues: [
        { priority: "critical", section: "Technical", issue: "Slow TTFB", action: "Optimize server" },
        { priority: "important", section: "On_page", issue: "Missing meta desc", action: "Add descriptions" },
      ],
      recommendations: ["Improve page speed", "Add structured data"],
    };

    await t.mutation(internal.seoAudit_actions.storeFullAuditResults, {
      scanId,
      domainId,
      result,
    });

    const analysis = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .first();
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.healthScore).toBe(85);
    expect(analysis!.grade).toBe("B");
    expect(analysis!.criticalIssues).toBe(1);
    expect(analysis!.warnings).toBe(3);

    const issues = await t.run(async (ctx) => {
      return await ctx.db.query("onSiteIssues").collect();
    });
    expect(issues).toHaveLength(2);

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.seoAuditStatus).toBe("completed");
  });

  test("delegates legacy per-URL format to storeSeoAuditResults", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    // Legacy format: has total_checks
    const result = {
      url: "https://example.com/",
      score: 75,
      total_checks: 5,
      results: [
        { check: "HTTPS_CHECK", passed: true, result: "OK" },
        { check: "H1_FOUND", passed: false, result: "Missing" },
      ],
    };

    await t.mutation(internal.seoAudit_actions.storeFullAuditResults, {
      scanId,
      domainId,
      result,
    });

    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .collect();
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].onpageScore).toBe(75);
  });
});

// ===========================================================================
// storeInstantSeoAuditResults
// ===========================================================================

describe("seoAudit_actions.storeInstantSeoAuditResults", () => {
  test("stores selected-pages results and marks scan complete", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    const results = [
      {
        url: "https://example.com/page1",
        score: 85,
        results: [
          { check: "HTTPS_CHECK", passed: true, result: "OK" },
          { check: "H1_FOUND", passed: false, result: "Missing H1" },
        ],
      },
      {
        url: "https://example.com/page2",
        score: 95,
        results: [
          { check: "HTTPS_CHECK", passed: true, result: "OK" },
          { check: "H1_FOUND", passed: true, result: "OK" },
        ],
      },
    ];

    await t.mutation(internal.seoAudit_actions.storeInstantSeoAuditResults, {
      domainId,
      scanId,
      results,
    });

    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .collect();
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].onpageScore).toBe(85);
    expect(pages[0].issueCount).toBe(1); // H1_FOUND failed
    expect(pages[1].onpageScore).toBe(95);
    expect(pages[1].issueCount).toBe(0);

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("complete");
    expect(scan!.completedAt).toBeDefined();
    expect(scan!.summary).toEqual({ totalPages: 2, totalIssues: 1 });
  });
});

// ===========================================================================
// checkDualJobCompletion
// ===========================================================================

describe("seoAudit_actions.checkDualJobCompletion", () => {
  test("marks scan failed if both audit and crawl failed", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(scanId, {
        seoAuditStatus: "failed",
        advertoolsCrawlStatus: "failed",
      });
    });

    await t.mutation(internal.seoAudit_actions.checkDualJobCompletion, {
      scanId,
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("failed");
    expect(scan!.error).toBe("Both SEO audit and crawl failed");
  });

  test("marks scan complete if audit completed and crawl skipped", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(scanId, {
        seoAuditStatus: "completed",
        advertoolsCrawlStatus: "skipped",
      });
    });

    await t.mutation(internal.seoAudit_actions.checkDualJobCompletion, {
      scanId,
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("complete");
    expect(scan!.completedAt).toBeDefined();
  });

  test("does not complete if audit still running", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(scanId, {
        seoAuditStatus: "running",
        advertoolsCrawlStatus: "completed",
      });
    });

    await t.mutation(internal.seoAudit_actions.checkDualJobCompletion, {
      scanId,
    });

    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    // Status should remain unchanged (queued from setup)
    expect(scan!.status).toBe("queued");
  });

  test("no-ops for deleted scan", async () => {
    const t = convexTest(schema, modules);
    const { scanId } = await setupDomainWithScan(t);

    await t.run(async (ctx) => {
      await ctx.db.delete(scanId);
    });

    // Should not throw
    await t.mutation(internal.seoAudit_actions.checkDualJobCompletion, {
      scanId,
    });
  });
});

// ===========================================================================
// recalculateAnalysisFromPages
// ===========================================================================

describe("seoAudit_actions.recalculateAnalysisFromPages", () => {
  test("creates analysis from crawl data when no analysis exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    // Insert some pages with scores
    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/",
        statusCode: 200,
        wordCount: 500,
        onpageScore: 90,
        issueCount: 1,
        issues: [
          { type: "warning" as const, category: "meta_tags", message: "Title too long" },
        ],
      });
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/about",
        statusCode: 200,
        wordCount: 300,
        onpageScore: 70,
        issueCount: 2,
        issues: [
          { type: "critical" as const, category: "headings", message: "Missing H1" },
          { type: "warning" as const, category: "content", message: "Thin content" },
        ],
      });
    });

    await t.mutation(internal.seoAudit_actions.recalculateAnalysisFromPages, {
      scanId,
      domainId,
    });

    const analysis = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .first();
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.healthScore).toBe(80); // (90+70)/2
    expect(analysis!.totalPages).toBe(2);
    expect(analysis!.grade).toBe("B"); // 80 >= 80
  });

  test("replaces empty Full Audit data with crawl-derived data", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    // Create an empty analysis (as if Full Audit returned nothing useful)
    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 0,
        totalPages: 0,
        criticalIssues: 0,
        warnings: 0,
        recommendations: 0,
        grade: "?",
        issues: {
          missingTitles: 0, missingMetaDescriptions: 0, duplicateContent: 0,
          brokenLinks: 0, slowPages: 0, suboptimalTitles: 0,
          thinContent: 0, missingH1: 0, largeImages: 0, missingAltText: 0,
        },
        fetchedAt: Date.now(),
      });

      // Add a page
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/",
        statusCode: 200,
        wordCount: 400,
        onpageScore: 85,
        issueCount: 0,
        issues: [],
      });
    });

    await t.mutation(internal.seoAudit_actions.recalculateAnalysisFromPages, {
      scanId,
      domainId,
    });

    const analysis = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .first();
    });
    expect(analysis!.healthScore).toBe(85);
    expect(analysis!.totalPages).toBe(1);
    expect(analysis!.grade).toBe("B");
  });

  test("no-ops if no pages exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.recalculateAnalysisFromPages, {
      scanId,
      domainId,
    });

    const analysis = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .first();
    });
    expect(analysis).toBeNull();
  });
});

// ===========================================================================
// enrichOnsitePagesFromCrawl
// ===========================================================================

describe("seoAudit_actions.enrichOnsitePagesFromCrawl", () => {
  test("enriches existing pages and inserts new ones from crawl data", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    // Pre-existing page from SEO Audit
    await t.run(async (ctx) => {
      await ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/",
        statusCode: 200,
        wordCount: 0,
        onpageScore: 85,
        issueCount: 0,
        issues: [],
      });
    });

    const crawlResults = [
      {
        url: "https://example.com/",
        status: 200,
        title: "Home Page",
        h1: "Welcome",
        metaDescription: "Welcome to example",
        canonical: "https://example.com/",
        wordCount: 500,
        internalLinks: 10,
        externalLinks: 3,
      },
      {
        url: "https://example.com/new-page",
        status: 200,
        title: "New Page",
        h1: "New Content",
        metaDescription: "A new page",
        canonical: "https://example.com/new-page",
        wordCount: 300,
        internalLinks: 5,
        externalLinks: 1,
      },
    ];

    await t.mutation(internal.seoAudit_actions.enrichOnsitePagesFromCrawl, {
      scanId,
      domainId,
      crawlResults,
    });

    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .collect();
    });
    expect(pages).toHaveLength(2);

    // Existing page should keep its audit score but get enriched
    const homePage = pages.find((p) => p.url === "https://example.com/");
    expect(homePage!.onpageScore).toBe(85); // Preserved from audit
    expect(homePage!.title).toBe("Home Page");
    expect(homePage!.wordCount).toBe(500);

    // New page should get crawl-derived score
    const newPage = pages.find((p) => p.url === "https://example.com/new-page");
    expect(newPage).toBeDefined();
    expect(newPage!.title).toBe("New Page");
    expect(newPage!.onpageScore).toBeDefined();
  });
});

// ===========================================================================
// completeMockSeoAuditScan
// ===========================================================================

describe("seoAudit_actions.completeMockSeoAuditScan", () => {
  test("creates mock pages, analysis, and marks scan complete", async () => {
    const t = convexTest(schema, modules);
    const { domainId, scanId } = await setupDomainWithScan(t);

    await t.mutation(internal.seoAudit_actions.completeMockSeoAuditScan, {
      scanId,
      domainId,
      domainName: "example.com",
    });

    // Check pages were created (15 mock paths)
    const pages = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .collect();
    });
    expect(pages.length).toBe(15);

    // Check analysis was created
    const analysis = await t.run(async (ctx) => {
      return await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_scan", (q) => q.eq("scanId", scanId))
        .first();
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.totalPages).toBe(15);

    // Scan should be complete
    const scan = await t.run(async (ctx) => {
      return await ctx.db.get(scanId);
    });
    expect(scan!.status).toBe("complete");
    expect(scan!.completedAt).toBeDefined();
  });
});
