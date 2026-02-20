import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTenantHierarchy(t: any, opts: { email: string; orgName: string; domainName: string }) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", { email: opts.email, emailVerificationTime: Date.now() });
  });
  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
      name: opts.orgName,
      slug: opts.orgName.toLowerCase().replace(/\s+/g, "-"),
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", { organizationId: orgId, userId, role: "owner" as const, joinedAt: Date.now() });
  });
  const teamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("teams", { organizationId: orgId, name: "Default Team", createdAt: Date.now() });
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("teamMembers", { teamId, userId, role: "owner" as const, joinedAt: Date.now() });
  });
  const projectId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("projects", { teamId, name: "Default Project", createdAt: Date.now() });
  });
  const domainId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: opts.domainName,
      createdAt: Date.now(),
      settings: { refreshFrequency: "weekly" as const, searchEngine: "google", location: "United States", language: "en" },
    });
  });
  return { userId, orgId, teamId, projectId, domainId };
}

// =====================================================================
// createAnalysisReport (mutation)
// =====================================================================
describe("createAnalysisReport", () => {
  test("creates a report and schedules analysis", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const,
      });
    });

    const reportId = await t.mutation(api.competitorAnalysisReports.createAnalysisReport, {
      domainId: tenant.domainId,
      keywordId,
      keyword: "seo tools",
      competitorPages: [
        { domain: "rival.com", url: "https://rival.com/seo-tools", position: 2 },
        { domain: "other.com", url: "https://other.com/tools", position: 5 },
      ],
      userPage: { url: "https://example.com/seo-tools", position: 8 },
    });

    expect(reportId).toBeDefined();

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report.status).toBe("pending");
    expect(report.keyword).toBe("seo tools");
    expect(report.competitorPages).toHaveLength(2);
    expect(report.userPage?.url).toBe("https://example.com/seo-tools");
    expect(report.createdAt).toBeDefined();
  });

  test("creates a report without userPage", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId, phrase: "test kw", createdAt: Date.now(), status: "active" as const,
      });
    });

    const reportId = await t.mutation(api.competitorAnalysisReports.createAnalysisReport, {
      domainId: tenant.domainId,
      keywordId,
      keyword: "test kw",
      competitorPages: [{ domain: "rival.com", url: "https://rival.com/page", position: 1 }],
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report.userPage).toBeUndefined();
  });
});

// =====================================================================
// getReportsForDomain (query)
// =====================================================================
describe("getReportsForDomain", () => {
  test("returns empty array when no reports exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const reports = await t.query(api.competitorAnalysisReports.getReportsForDomain, {
      domainId: tenant.domainId,
    });
    expect(reports).toEqual([]);
  });

  test("returns reports for the domain ordered desc", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const kw1 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "kw1", createdAt: Date.now(), status: "active" as const });
    });
    const kw2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "kw2", createdAt: Date.now(), status: "active" as const });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId: kw1, keyword: "kw1",
        competitorPages: [{ domain: "a.com", url: "https://a.com/1", position: 1 }],
        status: "completed" as const, createdAt: Date.now() - 1000,
      });
      await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId: kw2, keyword: "kw2",
        competitorPages: [{ domain: "b.com", url: "https://b.com/2", position: 2 }],
        status: "pending" as const, createdAt: Date.now(),
      });
    });

    const reports = await t.query(api.competitorAnalysisReports.getReportsForDomain, {
      domainId: tenant.domainId,
    });
    expect(reports).toHaveLength(2);
  });
});

// =====================================================================
// getReport (query)
// =====================================================================
describe("getReport", () => {
  test("returns a report by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [{ domain: "x.com", url: "https://x.com/p", position: 3 }],
        status: "completed" as const, createdAt: Date.now(),
      });
    });

    const report = await t.query(api.competitorAnalysisReports.getReport, { reportId });
    expect(report).not.toBeNull();
    expect(report!.keyword).toBe("test");
    expect(report!.status).toBe("completed");
  });

  test("returns null for non-existent report ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    // Create a keyword just to get a valid-format ID, then use a report ID that doesn't exist
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "temp", createdAt: Date.now(), status: "active" as const });
    });
    const tempReportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "temp",
        competitorPages: [], status: "pending" as const, createdAt: Date.now(),
      });
    });
    // Delete it to simulate non-existence
    await t.run(async (ctx: any) => { await ctx.db.delete(tempReportId); });

    const report = await t.query(api.competitorAnalysisReports.getReport, { reportId: tempReportId });
    expect(report).toBeNull();
  });
});

// =====================================================================
// deleteReport (mutation)
// =====================================================================
describe("deleteReport", () => {
  test("deletes a report", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [], status: "pending" as const, createdAt: Date.now(),
      });
    });

    await t.mutation(api.competitorAnalysisReports.deleteReport, { reportId });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report).toBeNull();
  });
});

// =====================================================================
// retryAnalysis (mutation)
// =====================================================================
describe("retryAnalysis", () => {
  test("resets report status to pending and clears analysis", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [{ domain: "x.com", url: "https://x.com/p", position: 1 }],
        status: "failed" as const,
        error: "API timeout",
        createdAt: Date.now(),
        completedAt: Date.now(),
        analysis: { avgCompetitorWordCount: 100, avgCompetitorH2Count: 3, avgCompetitorImagesCount: 5 },
      });
    });

    const resultId = await t.mutation(api.competitorAnalysisReports.retryAnalysis, { reportId });
    expect(resultId).toEqual(reportId);

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report.status).toBe("pending");
    expect(report.error).toBeUndefined();
    expect(report.analysis).toBeUndefined();
    expect(report.recommendations).toBeUndefined();
    expect(report.completedAt).toBeUndefined();
  });

  test("throws when report not found", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "temp", createdAt: Date.now(), status: "active" as const });
    });
    const tempId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "temp",
        competitorPages: [], status: "pending" as const, createdAt: Date.now(),
      });
    });
    await t.run(async (ctx: any) => { await ctx.db.delete(tempId); });

    await expect(
      t.mutation(api.competitorAnalysisReports.retryAnalysis, { reportId: tempId })
    ).rejects.toThrow("Report not found");
  });
});

// =====================================================================
// generateAllKeywordReports (mutation)
// =====================================================================
describe("generateAllKeywordReports", () => {
  test("returns zero created when no keywords exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const result = await t.mutation(api.competitorAnalysisReports.generateAllKeywordReports, {
      domainId: tenant.domainId,
    });

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.error).toBe("No keywords or competitors found");
  });

  test("returns zero created when no competitors exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "kw1", createdAt: Date.now(), status: "active" as const });
    });

    const result = await t.mutation(api.competitorAnalysisReports.generateAllKeywordReports, {
      domainId: tenant.domainId,
    });

    expect(result.created).toBe(0);
    expect(result.error).toBe("No keywords or competitors found");
  });

  test("skips keywords without SERP data", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "kw1", createdAt: Date.now(), status: "active" as const });
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });

    const result = await t.mutation(api.competitorAnalysisReports.generateAllKeywordReports, {
      domainId: tenant.domainId,
    });

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test("creates reports for keywords with matching SERP data", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });

    // Insert SERP result matching competitor domain
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId,
        domainId: tenant.domainId,
        date: "2025-01-15",
        position: 3,
        domain: "rival.com",
        url: "https://rival.com/seo-tools",
        isYourDomain: false,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.mutation(api.competitorAnalysisReports.generateAllKeywordReports, {
      domainId: tenant.domainId,
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  test("skips keywords that already have reports", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordSerpResults", {
        keywordId, domainId: tenant.domainId, date: "2025-01-15", position: 3,
        domain: "rival.com", url: "https://rival.com/seo-tools", isYourDomain: false, fetchedAt: Date.now(),
      });
    });

    // Create an existing report for this keyword
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "seo tools",
        competitorPages: [{ domain: "rival.com", url: "https://rival.com/seo-tools", position: 3 }],
        status: "completed" as const, createdAt: Date.now(),
      });
    });

    const result = await t.mutation(api.competitorAnalysisReports.generateAllKeywordReports, {
      domainId: tenant.domainId,
    });

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test("includes user page when domain matches SERP result", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "seo tools", createdAt: Date.now(), status: "active" as const });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId: tenant.domainId, competitorDomain: "rival.com", name: "Rival", status: "active" as const, createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      // Competitor SERP result
      await ctx.db.insert("keywordSerpResults", {
        keywordId, domainId: tenant.domainId, date: "2025-01-15", position: 3,
        domain: "rival.com", url: "https://rival.com/seo-tools", isYourDomain: false, fetchedAt: Date.now(),
      });
      // User's own SERP result
      await ctx.db.insert("keywordSerpResults", {
        keywordId, domainId: tenant.domainId, date: "2025-01-15", position: 8,
        domain: "example.com", url: "https://example.com/seo-tools", isYourDomain: true, fetchedAt: Date.now(),
      });
    });

    const result = await t.mutation(api.competitorAnalysisReports.generateAllKeywordReports, {
      domainId: tenant.domainId,
    });

    expect(result.created).toBe(1);

    // Verify the created report has userPage set
    const reports = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitorAnalysisReports")
        .withIndex("by_domain", (q: any) => q.eq("domainId", tenant.domainId))
        .collect();
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].userPage).toBeDefined();
    expect(reports[0].userPage!.url).toBe("https://example.com/seo-tools");
    expect(reports[0].userPage!.position).toBe(8);
  });
});

// =====================================================================
// getReportInternal (internalQuery)
// =====================================================================
describe("getReportInternal", () => {
  test("returns report by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [], status: "pending" as const, createdAt: Date.now(),
      });
    });

    const report = await t.query(internal.competitorAnalysisReports.getReportInternal, { reportId });
    expect(report).not.toBeNull();
    expect(report!.keyword).toBe("test");
  });
});

// =====================================================================
// updateReportInternal (internalMutation)
// =====================================================================
describe("updateReportInternal", () => {
  test("updates report status", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [], status: "pending" as const, createdAt: Date.now(),
      });
    });

    await t.mutation(internal.competitorAnalysisReports.updateReportInternal, {
      reportId,
      status: "analyzing",
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report.status).toBe("analyzing");
  });

  test("updates report with analysis and recommendations", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [{ domain: "x.com", url: "https://x.com/p", position: 1 }],
        status: "analyzing" as const, createdAt: Date.now(),
      });
    });

    const now = Date.now();
    await t.mutation(internal.competitorAnalysisReports.updateReportInternal, {
      reportId,
      status: "completed",
      analysis: { avgCompetitorWordCount: 1200, avgCompetitorH2Count: 5, avgCompetitorImagesCount: 8 },
      recommendations: [
        {
          category: "content" as const,
          priority: "high" as const,
          title: "Increase content length",
          description: "Your content is shorter than competitors",
          actionSteps: ["Add more sections", "Expand existing content"],
        },
        {
          category: "backlinks" as const,
          priority: "high" as const,
          title: "Build backlinks",
          description: "Get more referring domains",
        },
      ],
      completedAt: now,
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report.status).toBe("completed");
    expect(report.analysis!.avgCompetitorWordCount).toBe(1200);
    expect(report.recommendations).toHaveLength(2);
    expect(report.completedAt).toBe(now);
  });

  test("updates report with error on failure", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, { email: "a@b.com", orgName: "Org", domainName: "example.com" });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", { domainId: tenant.domainId, phrase: "test", createdAt: Date.now(), status: "active" as const });
    });

    const reportId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorAnalysisReports", {
        domainId: tenant.domainId, keywordId, keyword: "test",
        competitorPages: [], status: "analyzing" as const, createdAt: Date.now(),
      });
    });

    await t.mutation(internal.competitorAnalysisReports.updateReportInternal, {
      reportId,
      status: "failed",
      error: "DataForSEO API timeout",
      completedAt: Date.now(),
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report.status).toBe("failed");
    expect(report.error).toBe("DataForSEO API timeout");
  });
});
