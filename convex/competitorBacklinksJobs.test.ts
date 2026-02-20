import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a minimal tenant hierarchy
async function createTenantHierarchy(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      emailVerificationTime: Date.now(),
    });
  });

  const orgId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("organizations", {
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
      domain: "mysite.com",
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

async function createCompetitor(t: any, domainId: any, domain: string) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("competitors", {
      domainId,
      competitorDomain: domain,
      name: domain,
      status: "active" as const,
      createdAt: Date.now(),
    });
  });
}

async function insertJob(
  t: any,
  domainId: any,
  competitorId: any,
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("competitorBacklinksJobs", {
      domainId,
      competitorId,
      status: "pending" as const,
      createdAt: Date.now(),
      ...overrides,
    });
  });
}

describe("competitorBacklinksJobs", () => {
  describe("getActiveJobForCompetitor", () => {
    test("returns null when no jobs exist", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobForCompetitor,
        { competitorId: compId }
      );

      expect(result).toBeNull();
    });

    test("returns pending job as active", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "pending",
      });

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobForCompetitor,
        { competitorId: compId }
      );

      expect(result).not.toBeNull();
      expect(result!._id).toBe(jobId);
      expect(result!.status).toBe("pending");
    });

    test("returns processing job as active", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      await insertJob(t, tenant.domainId, compId, {
        status: "processing",
        startedAt: Date.now(),
      });

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobForCompetitor,
        { competitorId: compId }
      );

      expect(result).not.toBeNull();
      expect(result!.status).toBe("processing");
    });

    test("does not return completed job", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      await insertJob(t, tenant.domainId, compId, {
        status: "completed",
        completedAt: Date.now(),
      });

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobForCompetitor,
        { competitorId: compId }
      );

      expect(result).toBeNull();
    });

    test("does not return failed or cancelled jobs", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      await insertJob(t, tenant.domainId, compId, { status: "failed" });
      await insertJob(t, tenant.domainId, compId, { status: "cancelled" });

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobForCompetitor,
        { competitorId: compId }
      );

      expect(result).toBeNull();
    });
  });

  describe("getActiveJobsForDomain", () => {
    test("returns empty array when no active jobs", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobsForDomain,
        { domainId: tenant.domainId }
      );

      expect(result).toEqual([]);
    });

    test("returns all active jobs for domain", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const comp1 = await createCompetitor(t, tenant.domainId, "rival1.com");
      const comp2 = await createCompetitor(t, tenant.domainId, "rival2.com");

      await insertJob(t, tenant.domainId, comp1, { status: "pending" });
      await insertJob(t, tenant.domainId, comp2, { status: "processing" });
      await insertJob(t, tenant.domainId, comp1, { status: "completed" });

      const result = await t.query(
        api.competitorBacklinksJobs.getActiveJobsForDomain,
        { domainId: tenant.domainId }
      );

      expect(result).toHaveLength(2);
      const statuses = result.map((j: any) => j.status);
      expect(statuses).toContain("pending");
      expect(statuses).toContain("processing");
    });
  });

  describe("getJob", () => {
    test("returns job by ID", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId);

      const result = await t.query(api.competitorBacklinksJobs.getJob, {
        jobId,
      });

      expect(result).not.toBeNull();
      expect(result!._id).toBe(jobId);
      expect(result!.status).toBe("pending");
    });
  });

  describe("getJobInternal", () => {
    test("returns job by ID via internal query", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId);

      const result = await t.query(
        internal.competitorBacklinksJobs.getJobInternal,
        { jobId }
      );

      expect(result).not.toBeNull();
      expect(result!._id).toBe(jobId);
    });
  });

  describe("updateJobInternal", () => {
    test("updates job status", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId);

      await t.mutation(
        internal.competitorBacklinksJobs.updateJobInternal,
        { jobId, status: "processing", startedAt: 1000 }
      );

      const updated = await t.query(
        internal.competitorBacklinksJobs.getJobInternal,
        { jobId }
      );

      expect(updated!.status).toBe("processing");
      expect(updated!.startedAt).toBe(1000);
    });

    test("updates job to completed with backlinks count", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "processing",
      });

      await t.mutation(
        internal.competitorBacklinksJobs.updateJobInternal,
        { jobId, status: "completed", backlinksFound: 42, completedAt: 2000 }
      );

      const updated = await t.query(
        internal.competitorBacklinksJobs.getJobInternal,
        { jobId }
      );

      expect(updated!.status).toBe("completed");
      expect(updated!.backlinksFound).toBe(42);
      expect(updated!.completedAt).toBe(2000);
    });

    test("updates job to failed with error", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "processing",
      });

      await t.mutation(
        internal.competitorBacklinksJobs.updateJobInternal,
        { jobId, status: "failed", error: "API timeout", completedAt: 3000 }
      );

      const updated = await t.query(
        internal.competitorBacklinksJobs.getJobInternal,
        { jobId }
      );

      expect(updated!.status).toBe("failed");
      expect(updated!.error).toBe("API timeout");
    });
  });

  describe("cancelJob", () => {
    test("cancels a pending job", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "pending",
      });

      await t.mutation(api.competitorBacklinksJobs.cancelJob, { jobId });

      const job = await t.query(api.competitorBacklinksJobs.getJob, { jobId });
      expect(job!.status).toBe("cancelled");
      expect(job!.completedAt).toBeDefined();
    });

    test("cancels a processing job", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "processing",
      });

      await t.mutation(api.competitorBacklinksJobs.cancelJob, { jobId });

      const job = await t.query(api.competitorBacklinksJobs.getJob, { jobId });
      expect(job!.status).toBe("cancelled");
    });

    test("throws when cancelling a completed job", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "completed",
        completedAt: Date.now(),
      });

      await expect(
        t.mutation(api.competitorBacklinksJobs.cancelJob, { jobId })
      ).rejects.toThrow("Cannot cancel completed or already cancelled job");
    });

    test("throws when cancelling an already cancelled job", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");
      const jobId = await insertJob(t, tenant.domainId, compId, {
        status: "cancelled",
        completedAt: Date.now(),
      });

      await expect(
        t.mutation(api.competitorBacklinksJobs.cancelJob, { jobId })
      ).rejects.toThrow("Cannot cancel completed or already cancelled job");
    });
  });

  describe("createBacklinksJob", () => {
    test("creates a job with pending status", async () => {
      const t = convexTest(schema, modules);
      const tenant = await createTenantHierarchy(t);
      const compId = await createCompetitor(t, tenant.domainId, "rival.com");

      const jobId = await t.mutation(
        api.competitorBacklinksJobs.createBacklinksJob,
        { domainId: tenant.domainId, competitorId: compId }
      );

      expect(jobId).toBeDefined();

      const job = await t.query(api.competitorBacklinksJobs.getJob, { jobId });
      expect(job).not.toBeNull();
      expect(job!.status).toBe("pending");
      expect(job!.domainId).toBe(tenant.domainId);
      expect(job!.competitorId).toBe(compId);
      expect(job!.createdAt).toBeDefined();
    });
  });
});
