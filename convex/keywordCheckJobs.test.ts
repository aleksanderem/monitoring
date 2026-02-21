import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full tenant hierarchy
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

  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", {
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

  return { userId, orgId, teamId, projectId, domainId };
}

// Helper: create a keyword check job
async function createJob(
  t: any,
  domainId: any,
  keywordIds: any[],
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("keywordCheckJobs", {
      domainId,
      status: "pending" as const,
      totalKeywords: keywordIds.length,
      processedKeywords: 0,
      failedKeywords: 0,
      keywordIds,
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

// =====================================================================
// getActiveJobForDomain
// =====================================================================
describe("getActiveJobForDomain", () => {
  test("returns null when no jobs exist", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(api.keywordCheckJobs.getActiveJobForDomain, {
      domainId: tenant.domainId,
    });
    expect(result).toBeNull();
  });

  test("returns pending job as active", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    const result = await t.query(api.keywordCheckJobs.getActiveJobForDomain, {
      domainId: tenant.domainId,
    });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(jobId);
    expect(result!.status).toBe("pending");
  });

  test("returns processing job as active", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, [], {
      status: "processing" as const,
      startedAt: Date.now(),
    });

    const result = await t.query(api.keywordCheckJobs.getActiveJobForDomain, {
      domainId: tenant.domainId,
    });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(jobId);
    expect(result!.status).toBe("processing");
  });

  test("does not return completed jobs", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await createJob(t, tenant.domainId, [], {
      status: "completed" as const,
      completedAt: Date.now(),
    });

    const result = await t.query(api.keywordCheckJobs.getActiveJobForDomain, {
      domainId: tenant.domainId,
    });
    expect(result).toBeNull();
  });

  test("does not return cancelled or failed jobs", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await createJob(t, tenant.domainId, [], {
      status: "cancelled" as const,
      completedAt: Date.now(),
    });
    await createJob(t, tenant.domainId, [], {
      status: "failed" as const,
      completedAt: Date.now(),
    });

    const result = await t.query(api.keywordCheckJobs.getActiveJobForDomain, {
      domainId: tenant.domainId,
    });
    expect(result).toBeNull();
  });
});

// =====================================================================
// getJob
// =====================================================================
describe("getJob", () => {
  test("returns job by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    const result = await t.query(api.keywordCheckJobs.getJob, { jobId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(jobId);
    expect(result!.status).toBe("pending");
  });
});

// =====================================================================
// getAllActiveJobs
// =====================================================================
describe("getAllActiveJobs", () => {
  test("returns empty when no active jobs exist", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.keywordCheckJobs.getAllActiveJobs, {});
    expect(result).toEqual([]);
  });

  test("returns enriched active jobs with domain and keyword info", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    await createJob(t, tenant.domainId, [keywordId], {
      status: "processing" as const,
      startedAt: Date.now(),
      currentKeywordId: keywordId,
    });

    const result = await t.query(api.keywordCheckJobs.getAllActiveJobs, {});
    expect(result).toHaveLength(1);
    expect(result[0].domainName).toBe("mysite.com");
    expect(result[0].currentKeywordPhrase).toBe("seo tools");
    expect(result[0].status).toBe("processing");
  });

  test("does not include completed jobs", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await createJob(t, tenant.domainId, [], {
      status: "completed" as const,
      completedAt: Date.now(),
    });

    const result = await t.query(api.keywordCheckJobs.getAllActiveJobs, {});
    expect(result).toEqual([]);
  });
});

// =====================================================================
// getRecentCompletedJobs
// =====================================================================
describe("getRecentCompletedJobs", () => {
  test("returns jobs completed within last 2 minutes", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await createJob(t, tenant.domainId, [], {
      status: "completed" as const,
      completedAt: Date.now(),
      processedKeywords: 10,
      totalKeywords: 10,
    });

    const result = await t.query(api.keywordCheckJobs.getRecentCompletedJobs, {});
    expect(result).toHaveLength(1);
    expect(result[0].domainName).toBe("mysite.com");
    expect(result[0].status).toBe("completed");
  });

  test("does not return jobs completed more than 2 minutes ago", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await createJob(t, tenant.domainId, [], {
      status: "completed" as const,
      completedAt: Date.now() - 3 * 60 * 1000, // 3 minutes ago
    });

    const result = await t.query(api.keywordCheckJobs.getRecentCompletedJobs, {});
    expect(result).toEqual([]);
  });

  test("includes failed and cancelled jobs", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    await createJob(t, tenant.domainId, [], {
      status: "failed" as const,
      completedAt: Date.now(),
      error: "API error",
    });
    await createJob(t, tenant.domainId, [], {
      status: "cancelled" as const,
      completedAt: Date.now(),
    });

    const result = await t.query(api.keywordCheckJobs.getRecentCompletedJobs, {});
    expect(result).toHaveLength(2);
  });
});

// =====================================================================
// cancelJob
// =====================================================================
describe("cancelJob", () => {
  test("cancels a pending job and clears keyword status", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    // Create keyword linked to this job
    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "queued" as const,
        checkJobId: jobId,
      });
    });

    await t.mutation(api.keywordCheckJobs.cancelJob, { jobId });

    // Verify job was cancelled
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("cancelled");
    expect(job.completedAt).toBeDefined();

    // Verify keyword checking status was cleared
    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword.checkingStatus).toBeUndefined();
    expect(keyword.checkJobId).toBeUndefined();
  });

  test("cancels a processing job", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, [], {
      status: "processing" as const,
      startedAt: Date.now(),
    });

    await t.mutation(api.keywordCheckJobs.cancelJob, { jobId });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("cancelled");
  });

  test("throws when cancelling a completed job", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, [], {
      status: "completed" as const,
      completedAt: Date.now(),
    });

    await expect(
      t.mutation(api.keywordCheckJobs.cancelJob, { jobId })
    ).rejects.toThrow("Cannot cancel job in status: completed");
  });

  test("throws when cancelling a failed job", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, [], {
      status: "failed" as const,
      completedAt: Date.now(),
    });

    await expect(
      t.mutation(api.keywordCheckJobs.cancelJob, { jobId })
    ).rejects.toThrow("Cannot cancel job in status: failed");
  });

  test("throws when cancelling an already cancelled job", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, [], {
      status: "cancelled" as const,
      completedAt: Date.now(),
    });

    await expect(
      t.mutation(api.keywordCheckJobs.cancelJob, { jobId })
    ).rejects.toThrow("Cannot cancel job in status: cancelled");
  });
});

// =====================================================================
// Internal mutations: updateJobStatusInternal
// =====================================================================
describe("updateJobStatusInternal", () => {
  test("updates job status to processing with startedAt", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);
    const now = Date.now();

    await t.mutation(internal.keywordCheckJobs.updateJobStatusInternal, {
      jobId,
      status: "processing",
      startedAt: now,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("processing");
    expect(job.startedAt).toBe(now);
  });

  test("updates job status to completed with completedAt", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, [], {
      status: "processing" as const,
    });
    const now = Date.now();

    await t.mutation(internal.keywordCheckJobs.updateJobStatusInternal, {
      jobId,
      status: "completed",
      completedAt: now,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("completed");
    expect(job.completedAt).toBe(now);
  });

  test("updates job status to failed with error message", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    await t.mutation(internal.keywordCheckJobs.updateJobStatusInternal, {
      jobId,
      status: "failed",
      error: "Domain not found",
      completedAt: Date.now(),
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("failed");
    expect(job.error).toBe("Domain not found");
  });
});

// =====================================================================
// Internal mutations: updateJobCurrentKeywordInternal
// =====================================================================
describe("updateJobCurrentKeywordInternal", () => {
  test("updates the current keyword being processed", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const jobId = await createJob(t, tenant.domainId, [keywordId]);

    await t.mutation(internal.keywordCheckJobs.updateJobCurrentKeywordInternal, {
      jobId,
      currentKeywordId: keywordId,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.currentKeywordId).toBe(keywordId);
  });
});

// =====================================================================
// Internal mutations: updateJobProgressInternal
// =====================================================================
describe("updateJobProgressInternal", () => {
  test("updates processed and failed keyword counts", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    await t.mutation(internal.keywordCheckJobs.updateJobProgressInternal, {
      jobId,
      processedKeywords: 8,
      failedKeywords: 2,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.processedKeywords).toBe(8);
    expect(job.failedKeywords).toBe(2);
  });
});

// =====================================================================
// Internal mutations: clearKeywordCheckingStatusBatch
// =====================================================================
describe("clearKeywordCheckingStatusBatch", () => {
  test("clears checking status for multiple keywords", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    const kw1 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "kw1",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "checking" as const,
        checkJobId: jobId,
      });
    });
    const kw2 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "kw2",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "completed" as const,
        checkJobId: jobId,
      });
    });

    await t.mutation(internal.keywordCheckJobs.clearKeywordCheckingStatusBatch, {
      keywordIds: [kw1, kw2],
    });

    const keyword1 = await t.run(async (ctx: any) => ctx.db.get(kw1));
    const keyword2 = await t.run(async (ctx: any) => ctx.db.get(kw2));
    expect(keyword1.checkingStatus).toBeUndefined();
    expect(keyword1.checkJobId).toBeUndefined();
    expect(keyword2.checkingStatus).toBeUndefined();
    expect(keyword2.checkJobId).toBeUndefined();
  });

  test("skips deleted keywords without crashing", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const kw1 = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "kw1",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "checking" as const,
      });
    });

    // Delete the keyword before clearing
    await t.run(async (ctx: any) => {
      await ctx.db.delete(kw1);
    });

    // Should not throw
    await t.mutation(internal.keywordCheckJobs.clearKeywordCheckingStatusBatch, {
      keywordIds: [kw1],
    });
  });
});

// =====================================================================
// Internal queries: getJobInternal, getDomainInternal, getKeywordInternal
// =====================================================================
describe("internal queries", () => {
  test("getJobInternal returns job by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    const result = await t.query(internal.keywordCheckJobs.getJobInternal, { jobId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(jobId);
  });

  test("getDomainInternal returns domain by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const result = await t.query(internal.keywordCheckJobs.getDomainInternal, {
      domainId: tenant.domainId,
    });
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("mysite.com");
  });

  test("getKeywordInternal returns keyword by ID", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.keywordCheckJobs.getKeywordInternal, {
      keywordId,
    });
    expect(result).not.toBeNull();
    expect(result!.phrase).toBe("seo tools");
  });
});

// =====================================================================
// cleanupStuckJobs
// =====================================================================
describe("cleanupStuckJobs", () => {
  test("marks stuck pending jobs as failed after 5 minutes", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const stuckJobId = await createJob(t, tenant.domainId, [], {
      createdAt: Date.now() - 6 * 60 * 1000, // 6 minutes ago
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    const job = await t.run(async (ctx: any) => ctx.db.get(stuckJobId));
    expect(job.status).toBe("failed");
    expect(job.error).toBe("Job timed out in pending state");
    expect(job.completedAt).toBeDefined();
  });

  test("does not mark recent pending jobs as failed", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const recentJobId = await createJob(t, tenant.domainId, [], {
      createdAt: Date.now() - 2 * 60 * 1000, // 2 minutes ago
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    const job = await t.run(async (ctx: any) => ctx.db.get(recentJobId));
    expect(job.status).toBe("pending");
  });

  test("marks stuck processing jobs as failed after 30 minutes", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const stuckJobId = await createJob(t, tenant.domainId, [], {
      status: "processing" as const,
      startedAt: Date.now() - 31 * 60 * 1000, // 31 minutes ago
      createdAt: Date.now() - 32 * 60 * 1000,
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    const job = await t.run(async (ctx: any) => ctx.db.get(stuckJobId));
    expect(job.status).toBe("failed");
    expect(job.error).toBe("Job timed out during processing");
  });

  test("does not mark recent processing jobs as failed", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const recentJobId = await createJob(t, tenant.domainId, [], {
      status: "processing" as const,
      startedAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      createdAt: Date.now() - 11 * 60 * 1000,
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    const job = await t.run(async (ctx: any) => ctx.db.get(recentJobId));
    expect(job.status).toBe("processing");
  });

  test("clears orphaned keywords from cancelled jobs", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const cancelledJobId = await createJob(t, tenant.domainId, [], {
      status: "cancelled" as const,
      completedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "orphaned kw",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "checking" as const,
        checkJobId: cancelledJobId,
      });
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword.checkingStatus).toBeUndefined();
    expect(keyword.checkJobId).toBeUndefined();
  });

  test("does not process cancelled jobs older than 1 hour", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const oldCancelledJobId = await createJob(t, tenant.domainId, [], {
      status: "cancelled" as const,
      completedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      createdAt: Date.now() - 3 * 60 * 60 * 1000,
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "old orphan",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "checking" as const,
        checkJobId: oldCancelledJobId,
      });
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    // The keyword should still have checking status since old cancelled jobs are skipped
    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword.checkingStatus).toBe("checking");
  });

  test("clears keywords linked to stuck pending jobs via by_check_job index", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const stuckJobId = await createJob(t, tenant.domainId, [], {
      createdAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "stuck kw",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "queued" as const,
        checkJobId: stuckJobId,
      });
    });

    await t.mutation(internal.keywordCheckJobs.cleanupStuckJobs, {});

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword.checkingStatus).toBeUndefined();
    expect(keyword.checkJobId).toBeUndefined();
  });
});

// =====================================================================
// updateKeywordStatusInternal
// =====================================================================
describe("updateKeywordStatusInternal", () => {
  test("updates keyword checking status", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.keywordCheckJobs.updateKeywordStatusInternal, {
      keywordId,
      status: "checking",
    });

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword.checkingStatus).toBe("checking");
  });
});

// =====================================================================
// clearKeywordCheckingStatusInternal
// =====================================================================
describe("clearKeywordCheckingStatusInternal", () => {
  test("clears checking status and job ID from a keyword", async () => {
    const t = convexTest(schema, modules);
    const tenant = await createTenantHierarchy(t, {
      email: "alice@example.com",
      orgName: "Org A",
      domainName: "mysite.com",
    });

    const jobId = await createJob(t, tenant.domainId, []);

    const keywordId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId: tenant.domainId,
        phrase: "seo tools",
        status: "active" as const,
        createdAt: Date.now(),
        checkingStatus: "completed" as const,
        checkJobId: jobId,
      });
    });

    await t.mutation(internal.keywordCheckJobs.clearKeywordCheckingStatusInternal, {
      keywordId,
    });

    const keyword = await t.run(async (ctx: any) => ctx.db.get(keywordId));
    expect(keyword.checkingStatus).toBeUndefined();
    expect(keyword.checkJobId).toBeUndefined();
  });
});
