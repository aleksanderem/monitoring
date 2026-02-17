import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full tenant hierarchy (user -> org -> team -> project -> domain)
// Returns all IDs needed for testing.
async function createTenantHierarchy(
  t: any,
  opts: {
    email: string;
    orgName: string;
    domainName: string;
  }
) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: opts.email,
      emailVerificationTime: Date.now(),
    });
  });

  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
      name: opts.orgName,
      slug: opts.orgName.toLowerCase().replace(/\s+/g, "-"),
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });

  const membershipId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner" as const,
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Default Team",
      createdAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Default Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: opts.domainName,
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "weekly" as const,
        searchEngine: "google",
        location: "United States",
        language: "en",
      },
    });
  });

  return { userId, orgId, membershipId, teamId, projectId, domainId };
}

// =====================================================================
// getAllJobs — tenant isolation tests
// =====================================================================
describe("getAllJobs", () => {
  test("returns empty array for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    expect(result).toEqual([]);
  });

  test("user sees only their own org's jobs", async () => {
    const t = convexTest(schema, modules);

    // Create User A with full hierarchy
    const tenantA = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    // Create User B with full hierarchy
    const tenantB = await createTenantHierarchy(t, {
      email: "bob@example.com",
      orgName: "Org B",
      domainName: "bob.com",
    });

    // Insert keywordCheckJob for User A's domain
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantA.domainId,
        status: "pending",
        totalKeywords: 10,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
    });

    // Insert keywordCheckJob for User B's domain
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantB.domainId,
        status: "processing",
        totalKeywords: 5,
        processedKeywords: 2,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
    });

    // User A should only see their own job
    const asA = t.withIdentity({ subject: tenantA.userId });
    const jobsA = await asA.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    expect(jobsA.length).toBe(1);
    expect(jobsA[0].domainName).toBe("alice.com");

    // User B should only see their own job
    const asB = t.withIdentity({ subject: tenantB.userId });
    const jobsB = await asB.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    expect(jobsB.length).toBe(1);
    expect(jobsB[0].domainName).toBe("bob.com");
  });

  test("tenant isolation across all 7 job tables", async () => {
    const t = convexTest(schema, modules);

    const tenantA = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const tenantB = await createTenantHierarchy(t, {
      email: "bob@example.com",
      orgName: "Org B",
      domainName: "bob.com",
    });

    // Create a competitor for Org A's domain
    const competitorAId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenantA.domainId,
        competitorDomain: "competitor-a.com",
        name: "Competitor A",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const now = Date.now();

    // Insert jobs for User A across all 7 tables
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantA.domainId,
        status: "completed",
        totalKeywords: 10,
        processedKeywords: 10,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now - 1000,
        completedAt: now,
      });
      await ctx.db.insert("keywordSerpJobs", {
        domainId: tenantA.domainId,
        status: "pending",
        totalKeywords: 5,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now - 900,
      });
      await ctx.db.insert("onSiteScans", {
        domainId: tenantA.domainId,
        status: "complete",
        startedAt: now - 800,
        completedAt: now,
      });
      await ctx.db.insert("competitorBacklinksJobs", {
        domainId: tenantA.domainId,
        competitorId: competitorAId,
        status: "completed",
        createdAt: now - 700,
        completedAt: now,
      });
      await ctx.db.insert("competitorContentGapJobs", {
        domainId: tenantA.domainId,
        competitorId: competitorAId,
        status: "pending",
        createdAt: now - 600,
      });
      await ctx.db.insert("generatedReports", {
        projectId: tenantA.projectId,
        name: "Test Report A",
        reportType: "summary" as const,
        format: "pdf" as const,
        dateRange: { start: "2025-01-01", end: "2025-01-31" },
        domainsIncluded: [tenantA.domainId],
        status: "ready" as const,
        progress: 100,
        createdBy: tenantA.userId,
        createdAt: now - 500,
        completedAt: now,
      });
      await ctx.db.insert("domainReports", {
        domainId: tenantA.domainId,
        name: "SEO Report A",
        status: "ready" as const,
        progress: 100,
        createdAt: now - 400,
        completedAt: now,
      });
    });

    // User B should see NONE of these
    const asB = t.withIdentity({ subject: tenantB.userId });
    const jobsB = await asB.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    expect(jobsB.length).toBe(0);

    // User A should see all 7 jobs
    const asA = t.withIdentity({ subject: tenantA.userId });
    const jobsA = await asA.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    expect(jobsA.length).toBe(7);
  });

  test("filter=active returns only pending/processing jobs", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const now = Date.now();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenant.domainId,
        status: "pending",
        totalKeywords: 10,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now,
      });
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenant.domainId,
        status: "completed",
        totalKeywords: 5,
        processedKeywords: 5,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now - 1000,
        completedAt: now,
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const active = await asUser.query(api.jobs_queries.getAllJobs, {
      filter: "active",
    });
    expect(active.length).toBe(1);
    expect(active[0].status).toBe("pending");

    const completed = await asUser.query(api.jobs_queries.getAllJobs, {
      filter: "completed",
    });
    expect(completed.length).toBe(1);
    expect(completed[0].status).toBe("completed");
  });

  test("status normalization maps raw statuses correctly", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const now = Date.now();
    await t.run(async (ctx: any) => {
      // "queued" should normalize to "pending"
      await ctx.db.insert("onSiteScans", {
        domainId: tenant.domainId,
        status: "queued",
        startedAt: now,
      });
      // "crawling" should normalize to "processing"
      await ctx.db.insert("onSiteScans", {
        domainId: tenant.domainId,
        status: "crawling",
        startedAt: now - 100,
      });
      // "complete" should normalize to "completed"
      await ctx.db.insert("onSiteScans", {
        domainId: tenant.domainId,
        status: "complete",
        startedAt: now - 200,
        completedAt: now,
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const jobs = await asUser.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    const statuses = jobs.map((j: any) => j.status).sort();
    expect(statuses).toEqual(["completed", "pending", "processing"]);
  });

  test("empty state: user with no jobs sees empty list", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const jobs = await asUser.query(api.jobs_queries.getAllJobs, {
      filter: "all",
    });
    expect(jobs).toEqual([]);
  });
});

// =====================================================================
// getJobStats — tenant isolation tests
// =====================================================================
describe("getJobStats", () => {
  test("returns zeros for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.jobs_queries.getJobStats, {});
    expect(result).toEqual({ activeCount: 0, completedToday: 0, failedToday: 0 });
  });

  test("counts are tenant-scoped, not global", async () => {
    const t = convexTest(schema, modules);

    const tenantA = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const tenantB = await createTenantHierarchy(t, {
      email: "bob@example.com",
      orgName: "Org B",
      domainName: "bob.com",
    });

    const now = Date.now();

    // Create 2 active jobs for A, 1 for B
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantA.domainId,
        status: "pending",
        totalKeywords: 10,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now,
      });
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantA.domainId,
        status: "processing",
        totalKeywords: 5,
        processedKeywords: 2,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now - 100,
      });
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantB.domainId,
        status: "pending",
        totalKeywords: 3,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now - 200,
      });
      // Create a recently completed job for A
      await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantA.domainId,
        status: "completed",
        totalKeywords: 8,
        processedKeywords: 8,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: now - 5000,
        completedAt: now - 1000,
      });
    });

    // User A should see 2 active, 1 completed today
    const asA = t.withIdentity({ subject: tenantA.userId });
    const statsA = await asA.query(api.jobs_queries.getJobStats, {});
    expect(statsA.activeCount).toBe(2);
    expect(statsA.completedToday).toBe(1);

    // User B should see 1 active, 0 completed
    const asB = t.withIdentity({ subject: tenantB.userId });
    const statsB = await asB.query(api.jobs_queries.getJobStats, {});
    expect(statsB.activeCount).toBe(1);
    expect(statsB.completedToday).toBe(0);
  });

  test("empty state: new user sees zero stats", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const stats = await asUser.query(api.jobs_queries.getJobStats, {});
    expect(stats).toEqual({ activeCount: 0, completedToday: 0, failedToday: 0 });
  });
});

// =====================================================================
// cancelAnyJob — tenant isolation and access control
// =====================================================================
describe("cancelAnyJob", () => {
  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.jobs_queries.cancelAnyJob, {
        table: "keywordCheckJobs",
        jobId: "invalid" as any,
      })
    ).rejects.toThrow("Not authenticated");
  });

  test("user can cancel their own org's job", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywordCheckJobs", {
        domainId: tenant.domainId,
        status: "pending",
        totalKeywords: 10,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    await asUser.mutation(api.jobs_queries.cancelAnyJob, {
      table: "keywordCheckJobs",
      jobId: jobId as string,
    });

    // Verify job was cancelled
    const job = await t.run(async (ctx: any) => {
      return await ctx.db.get(jobId);
    });
    expect(job.status).toBe("cancelled");
    expect(job.error).toBe("Cancelled by user");
  });

  test("user CANNOT cancel another org's job", async () => {
    const t = convexTest(schema, modules);

    const tenantA = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const tenantB = await createTenantHierarchy(t, {
      email: "bob@example.com",
      orgName: "Org B",
      domainName: "bob.com",
    });

    // Create job for Org A
    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywordCheckJobs", {
        domainId: tenantA.domainId,
        status: "pending",
        totalKeywords: 10,
        processedKeywords: 0,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
    });

    // User B should NOT be able to cancel it
    const asB = t.withIdentity({ subject: tenantB.userId });
    await expect(
      asB.mutation(api.jobs_queries.cancelAnyJob, {
        table: "keywordCheckJobs",
        jobId: jobId as string,
      })
    ).rejects.toThrow("Access denied");

    // Verify job was NOT cancelled
    const job = await t.run(async (ctx: any) => {
      return await ctx.db.get(jobId);
    });
    expect(job.status).toBe("pending");
  });

  test("cancelling already completed job is a no-op", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywordCheckJobs", {
        domainId: tenant.domainId,
        status: "completed",
        totalKeywords: 10,
        processedKeywords: 10,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now() - 5000,
        completedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    // Should not throw, but should not change status
    await asUser.mutation(api.jobs_queries.cancelAnyJob, {
      table: "keywordCheckJobs",
      jobId: jobId as string,
    });

    const job = await t.run(async (ctx: any) => {
      return await ctx.db.get(jobId);
    });
    expect(job.status).toBe("completed");
  });

  test("cancel works across different job table types", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId: tenant.domainId,
        competitorDomain: "rival.com",
        name: "Rival",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const serpJobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywordSerpJobs", {
        domainId: tenant.domainId,
        status: "processing",
        totalKeywords: 5,
        processedKeywords: 1,
        failedKeywords: 0,
        keywordIds: [],
        createdAt: Date.now(),
      });
    });

    const compBackJobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitorBacklinksJobs", {
        domainId: tenant.domainId,
        competitorId,
        status: "pending",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: tenant.userId });

    // Cancel SERP job
    await asUser.mutation(api.jobs_queries.cancelAnyJob, {
      table: "keywordSerpJobs",
      jobId: serpJobId as string,
    });
    const serpJob = await t.run(async (ctx: any) => ctx.db.get(serpJobId));
    expect(serpJob.status).toBe("cancelled");

    // Cancel competitor backlinks job
    await asUser.mutation(api.jobs_queries.cancelAnyJob, {
      table: "competitorBacklinksJobs",
      jobId: compBackJobId as string,
    });
    const compJob = await t.run(async (ctx: any) => ctx.db.get(compBackJobId));
    expect(compJob.status).toBe("cancelled");
  });
});

// =====================================================================
// getScheduledJobs
// =====================================================================
describe("getScheduledJobs", () => {
  test("returns empty for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.jobs_queries.getScheduledJobs, {});
    expect(result).toEqual([]);
  });

  test("returns hardcoded schedule list for authenticated user", async () => {
    const t = convexTest(schema, modules);

    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "alice.com",
    });

    const asUser = t.withIdentity({ subject: tenant.userId });
    const result = await asUser.query(api.jobs_queries.getScheduledJobs, {});
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("schedule");
    expect(result[0]).toHaveProperty("description");
  });
});
