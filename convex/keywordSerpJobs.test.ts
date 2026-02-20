import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a full tenant hierarchy with domain
async function createTenantWithDomain(t: any, domainName = "example.com") {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      email: "user@test.com",
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
      domain: domainName,
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

// Helper: create keywords for a domain
async function createKeywords(t: any, domainId: any, phrases: string[]) {
  const keywordIds: any[] = [];
  for (const phrase of phrases) {
    const kwId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("keywords", {
        domainId,
        phrase,
        createdAt: Date.now(),
        status: "active" as const,
      });
    });
    keywordIds.push(kwId);
  }
  return keywordIds;
}

// Helper: create a SERP job directly in the DB
async function createSerpJob(
  t: any,
  domainId: any,
  keywordIds: any[],
  overrides: Record<string, any> = {}
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("keywordSerpJobs", {
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

// ─── getJobInternal ─────────────────────────────────────────────────

describe("getJobInternal", () => {
  test("returns a SERP job by ID", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["seo tools"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    const job = await t.query(internal.keywordSerpJobs.getJobInternal, { jobId });

    expect(job).not.toBeNull();
    expect(job!._id).toBe(jobId);
    expect(job!.domainId).toBe(domainId);
    expect(job!.status).toBe("pending");
    expect(job!.totalKeywords).toBe(1);
    expect(job!.processedKeywords).toBe(0);
  });

  test("returns null for non-existent job", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    // Create a job just to get a valid-format ID, then use a different one
    const keywordIds = await createKeywords(t, domainId, ["test"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    // Delete it, then query
    await t.run(async (ctx: any) => {
      await ctx.db.delete(jobId);
    });

    const result = await t.query(internal.keywordSerpJobs.getJobInternal, { jobId });
    expect(result).toBeNull();
  });
});

// ─── updateJobInternal ──────────────────────────────────────────────

describe("updateJobInternal", () => {
  test("updates job status", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["seo"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    await t.mutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId,
      status: "processing",
      startedAt: 1700000000000,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("processing");
    expect(job.startedAt).toBe(1700000000000);
  });

  test("updates processed and failed counts", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["a", "b", "c"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    await t.mutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId,
      processedKeywords: 2,
      failedKeywords: 1,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.processedKeywords).toBe(2);
    expect(job.failedKeywords).toBe(1);
  });

  test("updates current keyword ID", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["keyword1", "keyword2"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    await t.mutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId,
      currentKeywordId: keywordIds[1],
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.currentKeywordId).toBe(keywordIds[1]);
  });

  test("marks job as completed with timestamp", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["done"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    await t.mutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId,
      status: "completed",
      completedAt: 1700000000000,
      processedKeywords: 1,
      failedKeywords: 0,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("completed");
    expect(job.completedAt).toBe(1700000000000);
  });

  test("sets error message on failure", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["fail"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    await t.mutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId,
      status: "failed",
      error: "API rate limited",
      completedAt: 1700000000000,
    });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("failed");
    expect(job.error).toBe("API rate limited");
  });
});

// ─── getActiveJobForDomain ──────────────────────────────────────────

describe("getActiveJobForDomain", () => {
  test("returns pending job for domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["active"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "pending" });

    const result = await t.query(api.keywordSerpJobs.getActiveJobForDomain, { domainId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(jobId);
  });

  test("returns processing job for domain", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["processing"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "processing" });

    const result = await t.query(api.keywordSerpJobs.getActiveJobForDomain, { domainId });
    expect(result).not.toBeNull();
    expect(result!._id).toBe(jobId);
  });

  test("returns null when no active job exists", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    const result = await t.query(api.keywordSerpJobs.getActiveJobForDomain, { domainId });
    expect(result).toBeNull();
  });

  test("ignores completed/failed/cancelled jobs", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["kw1", "kw2", "kw3"]);

    await createSerpJob(t, domainId, [keywordIds[0]], { status: "completed" });
    await createSerpJob(t, domainId, [keywordIds[1]], { status: "failed" });
    await createSerpJob(t, domainId, [keywordIds[2]], { status: "cancelled" });

    const result = await t.query(api.keywordSerpJobs.getActiveJobForDomain, { domainId });
    expect(result).toBeNull();
  });
});

// ─── getJob ─────────────────────────────────────────────────────────

describe("getJob", () => {
  test("returns job by ID", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["query"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    const job = await t.query(api.keywordSerpJobs.getJob, { jobId });
    expect(job).not.toBeNull();
    expect(job!._id).toBe(jobId);
    expect(job!.totalKeywords).toBe(1);
  });
});

// ─── cancelJob ──────────────────────────────────────────────────────

describe("cancelJob", () => {
  test("cancels a pending job", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["cancel"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "pending" });

    await t.mutation(api.keywordSerpJobs.cancelJob, { jobId });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("cancelled");
    expect(job.completedAt).toBeDefined();
  });

  test("cancels a processing job", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["cancel2"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "processing" });

    await t.mutation(api.keywordSerpJobs.cancelJob, { jobId });

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job.status).toBe("cancelled");
  });

  test("throws when job is already completed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["done"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "completed" });

    await expect(
      t.mutation(api.keywordSerpJobs.cancelJob, { jobId })
    ).rejects.toThrow("Cannot cancel job in status: completed");
  });

  test("throws when job is already failed", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["fail"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "failed" });

    await expect(
      t.mutation(api.keywordSerpJobs.cancelJob, { jobId })
    ).rejects.toThrow("Cannot cancel job in status: failed");
  });

  test("throws when job is already cancelled", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["cancel3"]);
    const jobId = await createSerpJob(t, domainId, keywordIds, { status: "cancelled" });

    await expect(
      t.mutation(api.keywordSerpJobs.cancelJob, { jobId })
    ).rejects.toThrow("Cannot cancel job in status: cancelled");
  });

  test("throws when job not found", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["x"]);
    const jobId = await createSerpJob(t, domainId, keywordIds);

    // Delete the job, then try to cancel
    await t.run(async (ctx: any) => {
      await ctx.db.delete(jobId);
    });

    await expect(
      t.mutation(api.keywordSerpJobs.cancelJob, { jobId })
    ).rejects.toThrow("Job not found");
  });
});

// ─── computeVisibilitySnapshot ──────────────────────────────────────

describe("computeVisibilitySnapshot", () => {
  test("creates visibility snapshot from keyword positions", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    // Create keywords with various positions
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos1",
        createdAt: Date.now(),
        status: "active" as const,
        currentPosition: 1,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos3",
        createdAt: Date.now(),
        status: "active" as const,
        currentPosition: 3,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos7",
        createdAt: Date.now(),
        status: "active" as const,
        currentPosition: 7,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos15",
        createdAt: Date.now(),
        status: "active" as const,
        currentPosition: 15,
      });
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "pos25",
        createdAt: Date.now(),
        status: "active" as const,
        currentPosition: 25,
      });
    });

    await t.mutation(internal.keywordSerpJobs.computeVisibilitySnapshot, { domainId });

    // Verify the snapshot was created
    const snapshot = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("domainVisibilityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .first();
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.metrics.pos_1).toBe(1);
    expect(snapshot.metrics.pos_2_3).toBe(1);
    expect(snapshot.metrics.pos_4_10).toBe(1);
    expect(snapshot.metrics.pos_11_20).toBe(1);
    expect(snapshot.metrics.pos_21_30).toBe(1);
    expect(snapshot.metrics.count).toBe(5);
  });

  test("skips when no ranking keywords exist", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    // Create keywords without positions
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "no-pos",
        createdAt: Date.now(),
        status: "active" as const,
      });
    });

    await t.mutation(internal.keywordSerpJobs.computeVisibilitySnapshot, { domainId });

    const snapshot = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("domainVisibilityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .first();
    });

    expect(snapshot).toBeNull();
  });

  test("updates existing snapshot for today", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const today = new Date().toISOString().split("T")[0];

    // Pre-seed a snapshot for today
    await t.run(async (ctx: any) => {
      await ctx.db.insert("domainVisibilityHistory", {
        domainId,
        date: today,
        metrics: { pos_1: 0, count: 0 },
        fetchedAt: Date.now() - 10000,
      });
    });

    // Create a keyword with position
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId,
        phrase: "updated",
        createdAt: Date.now(),
        status: "active" as const,
        currentPosition: 1,
      });
    });

    await t.mutation(internal.keywordSerpJobs.computeVisibilitySnapshot, { domainId });

    // Should have updated the existing entry, not created a second one
    const snapshots = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("domainVisibilityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    expect(snapshots.length).toBe(1);
    expect(snapshots[0].metrics.pos_1).toBe(1);
    expect(snapshots[0].metrics.count).toBe(1);
  });

  test("counts all position buckets correctly", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);

    // Create keywords across all buckets
    const positions = [1, 2, 5, 12, 25, 35, 45, 55, 65, 75, 85, 95];
    await t.run(async (ctx: any) => {
      for (const pos of positions) {
        await ctx.db.insert("keywords", {
          domainId,
          phrase: `pos-${pos}`,
          createdAt: Date.now(),
          status: "active" as const,
          currentPosition: pos,
        });
      }
    });

    await t.mutation(internal.keywordSerpJobs.computeVisibilitySnapshot, { domainId });

    const snapshot = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("domainVisibilityHistory")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .first();
    });

    expect(snapshot.metrics.pos_1).toBe(1);
    expect(snapshot.metrics.pos_2_3).toBe(1);
    expect(snapshot.metrics.pos_4_10).toBe(1);
    expect(snapshot.metrics.pos_11_20).toBe(1);
    expect(snapshot.metrics.pos_21_30).toBe(1);
    expect(snapshot.metrics.pos_31_40).toBe(1);
    expect(snapshot.metrics.pos_41_50).toBe(1);
    expect(snapshot.metrics.pos_51_60).toBe(1);
    expect(snapshot.metrics.pos_61_70).toBe(1);
    expect(snapshot.metrics.pos_71_80).toBe(1);
    expect(snapshot.metrics.pos_81_90).toBe(1);
    expect(snapshot.metrics.pos_91_100).toBe(1);
    expect(snapshot.metrics.count).toBe(12);
  });
});

// ─── trackCompetitorsBatch ──────────────────────────────────────────

describe("trackCompetitorsBatch", () => {
  test("creates new competitors and stores positions", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["seo tools"]);

    const results = await t.mutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
      domainId,
      keywordId: keywordIds[0],
      date: "2024-01-15",
      competitors: [
        { domain: "competitor1.com", position: 1, url: "https://competitor1.com/page" },
        { domain: "competitor2.com", position: 3, url: "https://competitor2.com/page" },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results[0].position).toBe(1);
    expect(results[1].position).toBe(3);

    // Verify competitors were created
    const competitors = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitors")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(competitors).toHaveLength(2);
    expect(competitors[0].status).toBe("paused"); // Auto-discovered = paused
    expect(competitors[1].status).toBe("paused");

    // Verify positions were stored
    const positions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitorKeywordPositions")
        .collect();
    });
    expect(positions).toHaveLength(2);
  });

  test("reuses existing competitor and updates lastCheckedAt for active ones", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["test kw"]);

    // Pre-create an active competitor
    const competitorId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "existing.com",
        name: "existing.com",
        status: "active" as const,
        createdAt: Date.now() - 100000,
      });
    });

    const results = await t.mutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
      domainId,
      keywordId: keywordIds[0],
      date: "2024-01-15",
      competitors: [
        { domain: "existing.com", position: 2, url: "https://existing.com/page" },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0].competitorId).toBe(competitorId);

    // Verify no duplicate competitor was created
    const competitors = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitors")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(competitors).toHaveLength(1);

    // Active competitor should have lastCheckedAt updated
    expect(competitors[0].lastCheckedAt).toBeDefined();
  });

  test("upserts position for same competitor+keyword+date", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["upsert kw"]);

    // First call
    await t.mutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
      domainId,
      keywordId: keywordIds[0],
      date: "2024-01-15",
      competitors: [
        { domain: "upsert.com", position: 5, url: "https://upsert.com/old" },
      ],
    });

    // Second call with same date — should update, not duplicate
    await t.mutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
      domainId,
      keywordId: keywordIds[0],
      date: "2024-01-15",
      competitors: [
        { domain: "upsert.com", position: 3, url: "https://upsert.com/new" },
      ],
    });

    const positions = await t.run(async (ctx: any) => {
      return await ctx.db.query("competitorKeywordPositions").collect();
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].position).toBe(3);
    expect(positions[0].url).toBe("https://upsert.com/new");
  });

  test("handles empty competitors array", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["empty"]);

    const results = await t.mutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
      domainId,
      keywordId: keywordIds[0],
      date: "2024-01-15",
      competitors: [],
    });

    expect(results).toHaveLength(0);
  });

  test("does not update lastCheckedAt for paused competitors", async () => {
    const t = convexTest(schema, modules);
    const { domainId } = await createTenantWithDomain(t);
    const keywordIds = await createKeywords(t, domainId, ["paused kw"]);

    // Pre-create a paused competitor
    await t.run(async (ctx: any) => {
      await ctx.db.insert("competitors", {
        domainId,
        competitorDomain: "paused.com",
        name: "paused.com",
        status: "paused" as const,
        createdAt: Date.now() - 100000,
      });
    });

    await t.mutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
      domainId,
      keywordId: keywordIds[0],
      date: "2024-01-15",
      competitors: [
        { domain: "paused.com", position: 4, url: "https://paused.com/page" },
      ],
    });

    const competitors = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("competitors")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });

    // Paused competitor should NOT have lastCheckedAt updated
    expect(competitors[0].lastCheckedAt).toBeUndefined();
  });
});
