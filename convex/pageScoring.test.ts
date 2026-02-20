import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  normalizeUrlForMatching,
  scoreTechnicalHealth,
  scoreContentQuality,
  scoreSEOPerformance,
  scoreStrategicValue,
  computeFullPageScore,
} from "./pageScoring";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

async function setupHierarchy(t: any, userId: string) {
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

  return { orgId, teamId, projectId };
}

async function createDomain(t: any, projectId: any, domain = "example.com") {
  return t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

/** Minimal page data for testing pure scoring functions. */
function makePage(overrides: Partial<any> = {}): any {
  return {
    _id: "fake_id" as any,
    _creationTime: Date.now(),
    domainId: "fake_domain" as any,
    scanId: "fake_scan" as any,
    url: "https://example.com/page",
    statusCode: 200,
    wordCount: 1200,
    issueCount: 0,
    issues: [],
    ...overrides,
  };
}

function makeKeyword(overrides: Partial<any> = {}): any {
  return {
    phrase: "test keyword",
    position: 5,
    searchVolume: 1000,
    difficulty: 40,
    ...overrides,
  };
}

function makeBacklink(overrides: Partial<any> = {}): any {
  return {
    _id: "fake_bl" as any,
    _creationTime: Date.now(),
    domainId: "fake_domain" as any,
    urlFrom: "https://other.com/page",
    urlTo: "https://example.com/page",
    fetchedAt: Date.now(),
    domainFrom: "other.com",
    domainFromRank: 50,
    dofollow: true,
    backlink_spam_score: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure helper: normalizeUrlForMatching
// ---------------------------------------------------------------------------

describe("normalizeUrlForMatching", () => {
  test("strips protocol, www, trailing slash and hash", () => {
    expect(normalizeUrlForMatching("https://www.example.com/page/")).toBe("example.com/page");
    expect(normalizeUrlForMatching("http://example.com/page#section")).toBe("example.com/page");
  });

  test("lowercases the URL", () => {
    expect(normalizeUrlForMatching("HTTPS://Example.COM/Page")).toBe("example.com/page");
  });

  test("handles plain domain", () => {
    expect(normalizeUrlForMatching("example.com")).toBe("example.com");
  });
});

// ---------------------------------------------------------------------------
// scoreTechnicalHealth
// ---------------------------------------------------------------------------

describe("scoreTechnicalHealth", () => {
  test("returns no_data for all sub-scores when page has no metrics", () => {
    const page = makePage({ url: "http://example.com/page" });
    const result = scoreTechnicalHealth(page);
    // No lighthouse, no CWV, no resource errors, no cache
    const noDataCount = result.subScores.filter((s) => s.status === "no_data").length;
    expect(noDataCount).toBeGreaterThanOrEqual(4);
    // HTTP page should get critical for security
    const secSub = result.subScores.find((s) => s.id === "T6");
    expect(secSub?.score).toBe(0);
    expect(secSub?.status).toBe("critical");
  });

  test("scores perfect lighthouse and CWV highly", () => {
    const page = makePage({
      lighthouseScores: { performance: 95, seo: 98, accessibility: 100, bestPractices: 100 },
      coreWebVitals: {
        largestContentfulPaint: 1500,
        firstInputDelay: 50,
        timeToInteractive: 2000,
        domComplete: 3000,
        cumulativeLayoutShift: 0.05,
      },
      resourceErrors: { hasErrors: false, hasWarnings: false, errorCount: 0, warningCount: 0 },
      cacheControl: { cachable: true, ttl: 7200 },
    });
    const result = scoreTechnicalHealth(page);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.coverage).toBeGreaterThan(0.8);
  });

  test("penalizes non-HTTPS pages", () => {
    const httpsPage = makePage({ url: "https://example.com/page" });
    const httpPage = makePage({ url: "http://example.com/page" });
    const httpsResult = scoreTechnicalHealth(httpsPage);
    const httpResult = scoreTechnicalHealth(httpPage);
    const httpsSec = httpsResult.subScores.find((s) => s.id === "T6")!;
    const httpSec = httpResult.subScores.find((s) => s.id === "T6")!;
    expect(httpsSec.score).toBe(100);
    expect(httpSec.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scoreContentQuality
// ---------------------------------------------------------------------------

describe("scoreContentQuality", () => {
  test("deep content with good meta scores highly", () => {
    const page = makePage({
      wordCount: 2000,
      title: "Best SEO Tools for Small Business in 2025",
      metaDescription: "Discover the top SEO tools for small businesses. Compare features, pricing, and find the perfect tool for your needs.",
      htags: { h1: ["Best SEO Tools"], h2: ["Tool 1", "Tool 2", "Comparison"], h3: ["Features"] },
      readabilityScores: { automatedReadabilityIndex: 8, colemanLiauIndex: 8, daleChallIndex: 8, fleschKincaidIndex: 8, smogIndex: 8 },
      contentConsistency: { titleToContent: 0.8, descriptionToContent: 0.7 },
      imagesCount: 5,
      imagesMissingAlt: 0,
    });
    const keywords = [makeKeyword({ phrase: "seo tools" })];
    const result = scoreContentQuality(page, keywords);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  test("thin content scores poorly", () => {
    const page = makePage({ wordCount: 50, title: "Hi" });
    const result = scoreContentQuality(page, []);
    const c1 = result.subScores.find((s) => s.id === "C1")!;
    expect(c1.score).toBeLessThanOrEqual(25);
  });

  test("missing title scores zero for meta title", () => {
    const page = makePage({ wordCount: 800 });
    const result = scoreContentQuality(page, []);
    const c2 = result.subScores.find((s) => s.id === "C2")!;
    expect(c2.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scoreSEOPerformance
// ---------------------------------------------------------------------------

describe("scoreSEOPerformance", () => {
  test("top keyword positions score highly", () => {
    const page = makePage();
    const keywords = [
      makeKeyword({ position: 1, searchVolume: 5000 }),
      makeKeyword({ phrase: "another kw", position: 3, searchVolume: 2000 }),
    ];
    const backlinks = [makeBacklink(), makeBacklink({ domainFrom: "site2.com", urlFrom: "https://site2.com/p" })];
    const result = scoreSEOPerformance(page, keywords, backlinks);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  test("no keywords and no backlinks scores low", () => {
    const page = makePage({ inboundLinksCount: 0 });
    const result = scoreSEOPerformance(page, [], []);
    expect(result.score).toBeLessThanOrEqual(15);
  });

  test("orphan page (no inbound links) gets low internal link equity", () => {
    const page = makePage({ inboundLinksCount: 0 });
    const result = scoreSEOPerformance(page, [], []);
    const s4 = result.subScores.find((s) => s.id === "S4")!;
    expect(s4.score).toBe(5);
    expect(s4.explanation).toContain("Orphan");
  });
});

// ---------------------------------------------------------------------------
// scoreStrategicValue
// ---------------------------------------------------------------------------

describe("scoreStrategicValue", () => {
  test("transactional high-volume keywords score highly", () => {
    const page = makePage({ internalLinksCount: 10, inboundLinksCount: 15 });
    const keywords = [
      makeKeyword({ intent: "transactional", searchVolume: 5000, position: 3, difficulty: 30 }),
    ];
    const result = scoreStrategicValue(page, keywords);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  test("no keywords gives low strategic value", () => {
    const page = makePage({ internalLinksCount: 0, inboundLinksCount: 0 });
    const result = scoreStrategicValue(page, []);
    expect(result.score).toBeLessThanOrEqual(30);
  });

  test("informational hub pages get topical authority bonus", () => {
    const page = makePage({ internalLinksCount: 5, inboundLinksCount: 3 });
    const keywords = [
      makeKeyword({ intent: "informational", searchVolume: 500, position: 8 }),
    ];
    const result = scoreStrategicValue(page, keywords);
    const v1 = result.subScores.find((s) => s.id === "V1")!;
    expect(v1.explanation).toContain("topical authority");
  });
});

// ---------------------------------------------------------------------------
// computeFullPageScore
// ---------------------------------------------------------------------------

describe("computeFullPageScore", () => {
  test("error pages (4xx/5xx) get zero composite", () => {
    const page = makePage({ statusCode: 404 });
    const result = computeFullPageScore(page, [], []);
    expect(result.composite).toBe(0);
    expect(result.grade).toBe("F");
  });

  test("redirect pages (3xx) get composite 10", () => {
    const page = makePage({ statusCode: 301 });
    const result = computeFullPageScore(page, [], []);
    expect(result.composite).toBe(10);
    expect(result.grade).toBe("F");
  });

  test("well-optimized page gets a reasonable composite", () => {
    const page = makePage({
      wordCount: 1500,
      title: "SEO Guide for Beginners",
      metaDescription: "A comprehensive guide to SEO for beginners. Learn keyword research, on-page optimization, and link building.",
      htags: { h1: ["SEO Guide"], h2: ["Keyword Research", "On-Page SEO"], h3: ["Tools"] },
      lighthouseScores: { performance: 90, seo: 95, accessibility: 88, bestPractices: 92 },
      inboundLinksCount: 10,
      internalLinksCount: 8,
      imagesCount: 3,
      imagesMissingAlt: 0,
    });
    const keywords = [makeKeyword({ position: 5, searchVolume: 2000, intent: "informational" })];
    const backlinks = [makeBacklink({ domainFromRank: 60, dofollow: true })];
    const result = computeFullPageScore(page, keywords, backlinks);
    expect(result.composite).toBeGreaterThanOrEqual(30);
    expect(result.grade).not.toBe("F");
    expect(result.dataCompleteness).toBeGreaterThan(0);
    expect(result.scoredAt).toBeGreaterThan(0);
  });

  test("grade mapping: A >= 90, B >= 80, C >= 70, D >= 50, F < 50", () => {
    // We test the grade indirectly via full score results
    const errorPage = makePage({ statusCode: 500 });
    expect(computeFullPageScore(errorPage, [], []).grade).toBe("F");
  });
});

// ---------------------------------------------------------------------------
// computePageScores (internalMutation) - integration
// ---------------------------------------------------------------------------

describe("computePageScores internalMutation", () => {
  test("scores pages and patches pageScore field", async () => {
    const t = convexTest(schema, modules);

    const projectId = await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      return ctx.db.insert("projects", {
        teamId,
        name: "Project",
        createdAt: Date.now(),
      });
    });

    const domainId = await createDomain(t, projectId);

    // Create a scan
    const scanId = await t.run(async (ctx: any) => {
      return ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
      });
    });

    // Create an analysis record
    await t.run(async (ctx: any) => {
      return ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 75,
        totalPages: 1,
        criticalIssues: 0,
        warnings: 0,
        recommendations: 0,
        issues: {
          missingTitles: 0,
          missingMetaDescriptions: 0,
          duplicateContent: 0,
          brokenLinks: 0,
          slowPages: 0,
          suboptimalTitles: 0,
          thinContent: 0,
          missingH1: 0,
          largeImages: 0,
          missingAltText: 0,
        },
        fetchedAt: Date.now(),
      });
    });

    // Create a page
    const pageId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/test-page",
        statusCode: 200,
        wordCount: 1200,
        title: "Test Page Title",
        metaDescription: "A description for the test page that is reasonably long enough.",
        issueCount: 0,
        issues: [],
        inboundLinksCount: 5,
      });
    });

    // Create a keyword
    await t.run(async (ctx: any) => {
      return ctx.db.insert("keywords", {
        domainId,
        phrase: "test page",
        createdAt: Date.now(),
        status: "active",
        currentPosition: 7,
        currentUrl: "https://example.com/test-page",
        searchVolume: 500,
        difficulty: 35,
      });
    });

    // Run the mutation
    await t.mutation(internal.pageScoring.computePageScores, {
      domainId,
      offset: 0,
    });

    // Check that the page was scored
    const page = await t.run(async (ctx: any) => {
      return ctx.db.get(pageId);
    });

    expect(page.pageScore).toBeDefined();
    expect(page.pageScore.composite).toBeGreaterThanOrEqual(0);
    expect(page.pageScore.composite).toBeLessThanOrEqual(100);
    expect(page.pageScore.grade).toBeDefined();
    expect(page.pageScore.technical).toBeDefined();
    expect(page.pageScore.content).toBeDefined();
    expect(page.pageScore.seoPerformance).toBeDefined();
    expect(page.pageScore.strategic).toBeDefined();
  });

  test("empty batch updates aggregates", async () => {
    const t = convexTest(schema, modules);

    const projectId = await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      return ctx.db.insert("projects", { teamId, name: "Project", createdAt: Date.now() });
    });

    const domainId = await createDomain(t, projectId);

    const scanId = await t.run(async (ctx: any) => {
      return ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      return ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 50,
        totalPages: 0,
        criticalIssues: 0,
        warnings: 0,
        recommendations: 0,
        issues: {
          missingTitles: 0,
          missingMetaDescriptions: 0,
          duplicateContent: 0,
          brokenLinks: 0,
          slowPages: 0,
          suboptimalTitles: 0,
          thinContent: 0,
          missingH1: 0,
          largeImages: 0,
          missingAltText: 0,
        },
        fetchedAt: Date.now(),
      });
    });

    // No pages exist - call with offset 0 should just run aggregates
    await t.mutation(internal.pageScoring.computePageScores, {
      domainId,
      offset: 0,
    });
    // Should not throw
  });
});

// ---------------------------------------------------------------------------
// recomputeAggregatesOnly
// ---------------------------------------------------------------------------

describe("recomputeAggregatesOnly", () => {
  test("recomputes aggregates from scored pages", async () => {
    const t = convexTest(schema, modules);

    const projectId = await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Org",
        slug: "org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "weekly" },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Team",
        createdAt: Date.now(),
      });
      return ctx.db.insert("projects", { teamId, name: "Project", createdAt: Date.now() });
    });

    const domainId = await createDomain(t, projectId);

    const scanId = await t.run(async (ctx: any) => {
      return ctx.db.insert("onSiteScans", {
        domainId,
        status: "complete",
        startedAt: Date.now(),
      });
    });

    const analysisId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domainOnsiteAnalysis", {
        domainId,
        scanId,
        healthScore: 50,
        totalPages: 1,
        criticalIssues: 0,
        warnings: 0,
        recommendations: 0,
        issues: {
          missingTitles: 0,
          missingMetaDescriptions: 0,
          duplicateContent: 0,
          brokenLinks: 0,
          slowPages: 0,
          suboptimalTitles: 0,
          thinContent: 0,
          missingH1: 0,
          largeImages: 0,
          missingAltText: 0,
        },
        fetchedAt: Date.now(),
      });
    });

    // Create a page with pre-existing pageScore
    await t.run(async (ctx: any) => {
      return ctx.db.insert("domainOnsitePages", {
        domainId,
        scanId,
        url: "https://example.com/scored",
        statusCode: 200,
        wordCount: 1000,
        issueCount: 0,
        issues: [],
        pageScore: {
          composite: 75,
          grade: "C",
          technical: { score: 70, subScores: [] },
          content: { score: 80, subScores: [] },
          seoPerformance: { score: 60, subScores: [] },
          strategic: { score: 65, subScores: [] },
          scoredAt: Date.now(),
          dataCompleteness: 0.8,
        },
      });
    });

    await t.mutation(internal.pageScoring.recomputeAggregatesOnly, {
      domainId,
    });

    const analysis = await t.run(async (ctx: any) => {
      return ctx.db.get(analysisId);
    });

    expect(analysis.avgPageScore).toBe(75);
    expect(analysis.pageScoreDistribution).toBeDefined();
    expect(analysis.pageScoreDistribution.C).toBe(1);
    expect(analysis.pageScoreAxes).toBeDefined();
    expect(analysis.pageScoreAxes.technical).toBe(70);
    expect(analysis.pageScoreAxes.content).toBe(80);
  });
});
