import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Create a new Content Gap analysis job
 */
export const createContentGapJob = mutation({
  args: {
    domainId: v.id("domains"),
    competitorId: v.id("competitors"),
  },
  handler: async (ctx, args) => {
    // Create job record
    const jobId = await ctx.db.insert("competitorContentGapJobs", {
      domainId: args.domainId,
      competitorId: args.competitorId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule background processing
    await ctx.scheduler.runAfter(0, internal.competitorContentGapJobs.processContentGapJobInternal, {
      jobId,
    });

    return jobId;
  },
});

/**
 * Get active job for competitor
 */
export const getActiveJobForCompetitor = query({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    const activeJob = await ctx.db
      .query("competitorContentGapJobs")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .order("desc")
      .first();

    return activeJob;
  },
});

/**
 * Get all active jobs for a domain
 */
export const getActiveJobsForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const activeJobs = await ctx.db
      .query("competitorContentGapJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .collect();

    return activeJobs;
  },
});

/**
 * Get job by ID
 */
export const getJob = query({
  args: { jobId: v.id("competitorContentGapJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * Internal query to get job
 */
export const getJobInternal = internalQuery({
  args: { jobId: v.id("competitorContentGapJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * Internal mutation to update job
 */
export const updateJobInternal = internalMutation({
  args: {
    jobId: v.id("competitorContentGapJobs"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    opportunitiesFound: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, updates);
  },
});

/**
 * Cancel job
 */
export const cancelJob = mutation({
  args: { jobId: v.id("competitorContentGapJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    if (job.status === "completed" || job.status === "cancelled") {
      throw new Error("Cannot cancel completed or already cancelled job");
    }

    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

/**
 * Internal action to process content gap analysis
 */
export const processContentGapJobInternal = internalAction({
  args: { jobId: v.id("competitorContentGapJobs") },
  handler: async (ctx, args) => {
    console.log(`[processContentGapJob] Starting job ${args.jobId}`);

    // Update job status to processing
    await ctx.runMutation(internal.competitorContentGapJobs.updateJobInternal, {
      jobId: args.jobId,
      status: "processing",
      startedAt: Date.now(),
    });

    try {
      // Get job details
      const job = await ctx.runQuery(internal.competitorContentGapJobs.getJobInternal, {
        jobId: args.jobId,
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Call the existing content gap analysis action
      const result = await ctx.runAction(internal.contentGap.analyzeContentGap, {
        domainId: job.domainId,
        competitorId: job.competitorId,
      });

      // Mark job as completed
      await ctx.runMutation(internal.competitorContentGapJobs.updateJobInternal, {
        jobId: args.jobId,
        status: "completed",
        opportunitiesFound: result.opportunitiesFound || 0,
        completedAt: Date.now(),
      });

      console.log(`[processContentGapJob] Job ${args.jobId} completed: ${result.opportunitiesFound || 0} opportunities found`);
    } catch (error: any) {
      console.error(`[processContentGapJob] Job ${args.jobId} failed:`, error);

      await ctx.runMutation(internal.competitorContentGapJobs.updateJobInternal, {
        jobId: args.jobId,
        status: "failed",
        error: error.message || "Unknown error",
        completedAt: Date.now(),
      });
    }
  },
});
