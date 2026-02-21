import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      name: "Team",
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
      name: "Project",
      createdAt: Date.now(),
    });
  });
  return { orgId, teamId, projectId };
}

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

async function createDomain(t: any, projectId: string, domain = "example.com") {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });
}

// ---------------------------------------------------------------------------
// getReports
// ---------------------------------------------------------------------------

describe("getReports", () => {
  test("returns empty when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const reports = await t.query(api.reports.getReports, { projectId });
    expect(reports).toEqual([]);
  });

  test("returns reports for a project when authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "tok1",
        name: "Report 1",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const reports = await asUser.query(api.reports.getReports, { projectId });
    expect(reports).toHaveLength(1);
    expect(reports[0].name).toBe("Report 1");
  });
});

// ---------------------------------------------------------------------------
// getReportByToken
// ---------------------------------------------------------------------------

describe("getReportByToken", () => {
  test("returns null for nonexistent token", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.reports.getReportByToken, { token: "nope" });
    expect(result).toBeNull();
  });

  test("returns expired flag for expired report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "expired-tok",
        name: "Expired",
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 50000,
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const result = await t.query(api.reports.getReportByToken, { token: "expired-tok" });
    expect(result).toEqual({ expired: true });
  });

  test("returns report with domains and keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "seo tools",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 5,
        currentUrl: "https://example.com/seo",
        positionChange: 2,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "paused kw",
        status: "paused",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "valid-tok",
        name: "Valid Report",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const result = await t.query(api.reports.getReportByToken, { token: "valid-tok" }) as any;
    expect(result.name).toBe("Valid Report");
    expect(result.domains).toHaveLength(1);
    // Only active keywords
    expect(result.domains[0].keywords).toHaveLength(1);
    expect(result.domains[0].keywords[0].phrase).toBe("seo tools");
    expect(result.domains[0].keywords[0].position).toBe(5);
    expect(result.domains[0].keywords[0].change).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createReport
// ---------------------------------------------------------------------------

describe("createReport", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await expect(
      t.mutation(api.reports.createReport, {
        projectId,
        name: "My Report",
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      })
    ).rejects.toThrow("Not authenticated");
  });

  test("creates a report with a generated token", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const reportId = await asUser.mutation(api.reports.createReport, {
      projectId,
      name: "New Report",
      settings: {
        domainsIncluded: [domainId],
        showSearchVolume: false,
        showDifficulty: true,
        allowKeywordProposals: true,
      },
    });

    expect(reportId).toBeDefined();

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.name).toBe("New Report");
    expect(report!.token).toBeTruthy();
    expect(report!.token.length).toBe(32);
    expect(report!.settings.showSearchVolume).toBe(false);
  });

  test("creates a report with template and expiry", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const expiresAt = Date.now() + 86400000;
    const reportId = await asUser.mutation(api.reports.createReport, {
      projectId,
      name: "Exec Report",
      expiresAt,
      template: "executive-summary",
      settings: {
        domainsIncluded: [domainId],
        showSearchVolume: true,
        showDifficulty: true,
        allowKeywordProposals: false,
      },
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.template).toBe("executive-summary");
    expect(report!.expiresAt).toBe(expiresAt);
  });
});

// ---------------------------------------------------------------------------
// updateReport
// ---------------------------------------------------------------------------

describe("updateReport", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId,
        token: "tok",
        name: "R",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    await expect(
      t.mutation(api.reports.updateReport, { reportId, name: "Updated" })
    ).rejects.toThrow("Not authenticated");
  });

  test("updates report name and settings", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId,
        token: "tok",
        name: "Old Name",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.reports.updateReport, {
      reportId,
      name: "New Name",
      settings: {
        domainsIncluded: [domainId],
        showSearchVolume: false,
        showDifficulty: false,
        allowKeywordProposals: true,
      },
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.name).toBe("New Name");
    expect(report!.settings.showSearchVolume).toBe(false);
    expect(report!.settings.allowKeywordProposals).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteReport
// ---------------------------------------------------------------------------

describe("deleteReport", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId, token: "tok", name: "R", createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true, showDifficulty: true, allowKeywordProposals: false,
        },
      });
    });

    await expect(
      t.mutation(api.reports.deleteReport, { reportId })
    ).rejects.toThrow("Not authenticated");
  });

  test("deletes report and associated proposals, messages, and accesses", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId, token: "tok", name: "R", createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true, showDifficulty: true, allowKeywordProposals: true,
        },
      });
    });

    // Create associated data
    const clientId = await t.run(async (ctx: any) => {
      return ctx.db.insert("clients", {
        organizationId: orgId, email: "c@t.com", name: "C", hasAccount: false, createdAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "test kw", status: "pending", createdAt: Date.now(),
      });
      await ctx.db.insert("messages", {
        reportId, authorType: "client", authorId: clientId, content: "Hi", createdAt: Date.now(),
      });
      await ctx.db.insert("clientReportAccess", {
        clientId, reportId, grantedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.reports.deleteReport, { reportId });

    // Verify everything is gone
    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report).toBeNull();

    const proposals = await t.run(async (ctx: any) => {
      return ctx.db.query("keywordProposals").collect();
    });
    expect(proposals).toHaveLength(0);

    const messages = await t.run(async (ctx: any) => {
      return ctx.db.query("messages").collect();
    });
    expect(messages).toHaveLength(0);

    const accesses = await t.run(async (ctx: any) => {
      return ctx.db.query("clientReportAccess").collect();
    });
    expect(accesses).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getShareLinkForDomain
// ---------------------------------------------------------------------------

describe("getShareLinkForDomain", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const result = await t.query(api.reports.getShareLinkForDomain, { domainId });
    expect(result).toBeNull();
  });

  test("returns null when no single-domain report exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.reports.getShareLinkForDomain, { domainId });
    expect(result).toBeNull();
  });

  test("returns share link for single-domain report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "share-tok",
        name: "Share Link",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.reports.getShareLinkForDomain, { domainId });
    expect(result).not.toBeNull();
    expect(result!.token).toBe("share-tok");
    expect(result!.name).toBe("Share Link");
  });
});

// ---------------------------------------------------------------------------
// createShareLink
// ---------------------------------------------------------------------------

describe("createShareLink", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await expect(
      t.mutation(api.reports.createShareLink, { domainId })
    ).rejects.toThrow("Not authenticated");
  });

  test("creates a share link report for a domain", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.mutation(api.reports.createShareLink, { domainId });

    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(32);
    expect(result.reportId).toBeDefined();

    const report = await t.run(async (ctx: any) => ctx.db.get(result.reportId));
    expect(report!.settings.domainsIncluded).toHaveLength(1);
    expect(report!.settings.domainsIncluded[0]).toEqual(domainId);
    expect(report!.name).toContain("example.com");
  });

  test("uses custom name when provided", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.mutation(api.reports.createShareLink, {
      domainId,
      name: "Custom Name",
    });

    const report = await t.run(async (ctx: any) => ctx.db.get(result.reportId));
    expect(report!.name).toBe("Custom Name");
  });
});

// ---------------------------------------------------------------------------
// regenerateToken
// ---------------------------------------------------------------------------

describe("regenerateToken", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId, token: "old-tok", name: "R", createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true, showDifficulty: true, allowKeywordProposals: false,
        },
      });
    });

    await expect(
      t.mutation(api.reports.regenerateToken, { reportId })
    ).rejects.toThrow("Not authenticated");
  });

  test("generates a new token different from the old one", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    const reportId = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId, token: "old-tok", name: "R", createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true, showDifficulty: true, allowKeywordProposals: false,
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const newToken = await asUser.mutation(api.reports.regenerateToken, { reportId });

    expect(newToken).toBeTruthy();
    expect(newToken.length).toBe(32);
    expect(newToken).not.toBe("old-tok");

    const report = await t.run(async (ctx: any) => ctx.db.get(reportId));
    expect(report!.token).toBe(newToken);
  });
});

// ---------------------------------------------------------------------------
// getReportByTokenInternal
// ---------------------------------------------------------------------------

describe("getReportByTokenInternal", () => {
  test("returns null for nonexistent token", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(internal.reports.getReportByTokenInternal, { token: "nope" });
    expect(result).toBeNull();
  });

  test("returns report for valid token", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "internal-tok",
        name: "Internal Report",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true, showDifficulty: true, allowKeywordProposals: false,
        },
      });
    });

    const result = await t.query(internal.reports.getReportByTokenInternal, { token: "internal-tok" });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Internal Report");
  });
});

// ---------------------------------------------------------------------------
// getPublicReportData
// ---------------------------------------------------------------------------

describe("getPublicReportData", () => {
  test("returns null for invalid token", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.reports.getPublicReportData, { token: "nope" });
    expect(result).toBeNull();
  });

  test("returns expired flag for expired report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "exp-tok",
        name: "Expired",
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 50000,
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const result = await t.query(api.reports.getPublicReportData, { token: "exp-tok" });
    expect(result).toHaveProperty("expired", true);
  });

  test("returns full report data with keywords and chart data", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "seo",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 3,
        previousPosition: 5,
        positionChange: 2,
        currentUrl: "https://example.com/seo",
        searchVolume: 1000,
        difficulty: 45,
        recentPositions: [
          { date: "2026-01-01", position: 5 },
          { date: "2026-01-02", position: 3 },
        ],
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "pub-tok",
        name: "Public Report",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: false,
        },
      });
    });

    const result = await t.query(api.reports.getPublicReportData, { token: "pub-tok" }) as any;
    expect(result.name).toBe("Public Report");
    expect(result.domains).toHaveLength(1);
    expect(result.domains[0].keywords).toHaveLength(1);
    expect(result.domains[0].keywords[0].phrase).toBe("seo");
    expect(result.domains[0].keywords[0].position).toBe(3);
    expect(result.domains[0].keywords[0].searchVolume).toBe(1000);
    expect(result.domains[0].chartData).toHaveLength(2);
    expect(result.domains[0].trackingSince).toBeGreaterThan(0);
  });

  test("hides search volume and difficulty when settings disable them", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const domainId = await createDomain(t, projectId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "test",
        status: "active",
        createdAt: Date.now(),
        currentPosition: 10,
        searchVolume: 500,
        difficulty: 30,
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "hidden-tok",
        name: "Hidden Metrics",
        createdAt: Date.now(),
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: false,
          showDifficulty: false,
          allowKeywordProposals: false,
        },
      });
    });

    const result = await t.query(api.reports.getPublicReportData, { token: "hidden-tok" }) as any;
    expect(result.domains[0].keywords[0].searchVolume).toBeNull();
    expect(result.domains[0].keywords[0].difficulty).toBeNull();
  });
});
