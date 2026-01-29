import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Create a new keyword check job
export const createKeywordCheckJob = mutation({
  args: {
    domainId: v.id("domains"),
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    // Create job record
    const jobId = await ctx.db.insert("keywordCheckJobs", {
      domainId: args.domainId,
      status: "pending",
      totalKeywords: args.keywordIds.length,
      processedKeywords: 0,
      failedKeywords: 0,
      keywordIds: args.keywordIds,
      createdAt: Date.now(),
    });

    // Mark all keywords as queued
    for (const keywordId of args.keywordIds) {
      await ctx.db.patch(keywordId, {
        checkingStatus: "queued",
        checkJobId: jobId,
      });
    }

    // Schedule background processing
    await ctx.scheduler.runAfter(0, internal.keywordCheckJobs.processKeywordCheckJobInternal, {
      jobId,
    });

    return jobId;
  },
});

// Get active job for domain
export const getActiveJobForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const activeJob = await ctx.db
      .query("keywordCheckJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
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

// Get job by ID
export const getJob = query({
  args: { jobId: v.id("keywordCheckJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Cancel job
export const cancelJob = mutation({
  args: { jobId: v.id("keywordCheckJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      throw new Error("Cannot cancel job in status: " + job.status);
    }

    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    // Clear checking status from all keywords
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_check_job", (q) => q.eq("checkJobId", args.jobId))
      .collect();

    for (const keyword of keywords) {
      await ctx.db.patch(keyword._id, {
        checkingStatus: undefined,
        checkJobId: undefined,
      });
    }
  },
});

// Internal action to process job in background
export const processKeywordCheckJobInternal = internalAction({
  args: { jobId: v.id("keywordCheckJobs") },
  handler: async (ctx, args) => {
    console.log(`[processKeywordCheckJob] Starting job ${args.jobId}`);

    // Get job
    const job = await ctx.runQuery(internal.keywordCheckJobs.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      console.error(`[processKeywordCheckJob] Job ${args.jobId} not found`);
      return;
    }

    if (job.status === "cancelled") {
      console.log(`[processKeywordCheckJob] Job ${args.jobId} was cancelled`);
      return;
    }

    // Mark job as processing
    await ctx.runMutation(internal.keywordCheckJobs.updateJobStatusInternal, {
      jobId: args.jobId,
      status: "processing",
      startedAt: Date.now(),
    });

    // Get domain info
    const domain = await ctx.runQuery(internal.keywordCheckJobs.getDomainInternal, {
      domainId: job.domainId,
    });

    if (!domain) {
      await ctx.runMutation(internal.keywordCheckJobs.updateJobStatusInternal, {
        jobId: args.jobId,
        status: "failed",
        error: "Domain not found",
        completedAt: Date.now(),
      });
      return;
    }

    let processedCount = 0;
    let failedCount = 0;

    // Process each keyword
    for (const keywordId of job.keywordIds) {
      // Check if job was cancelled
      const currentJob = await ctx.runQuery(internal.keywordCheckJobs.getJobInternal, {
        jobId: args.jobId,
      });

      if (currentJob?.status === "cancelled") {
        console.log(`[processKeywordCheckJob] Job ${args.jobId} cancelled during processing`);
        return;
      }

      // Get keyword
      const keyword = await ctx.runQuery(internal.keywordCheckJobs.getKeywordInternal, {
        keywordId,
      });

      if (!keyword) {
        console.error(`[processKeywordCheckJob] Keyword ${keywordId} not found`);
        failedCount++;
        continue;
      }

      console.log(`[processKeywordCheckJob] Processing keyword ${keyword.phrase} (${processedCount + 1}/${job.totalKeywords})`);

      // Update job current keyword
      await ctx.runMutation(internal.keywordCheckJobs.updateJobCurrentKeywordInternal, {
        jobId: args.jobId,
        currentKeywordId: keywordId,
      });

      // Mark keyword as checking
      await ctx.runMutation(internal.keywordCheckJobs.updateKeywordStatusInternal, {
        keywordId,
        status: "checking",
      });

      try {
        // Check if keyword has any position history
        const existingPositions = await ctx.runQuery(internal.keywordCheckJobs.getKeywordPositionsCountInternal, {
          keywordId,
        });
        const needsHistory = existingPositions === 0;

        if (needsHistory) {
          // Use fetchSinglePosition with history
          console.log(`[processKeywordCheckJob] First-time check for ${keyword.phrase}, fetching with history`);
          const result = await ctx.runAction(internal.dataforseo.fetchSinglePositionInternal, {
            keywordId,
            phrase: keyword.phrase,
            domain: domain.domain,
            location: domain.settings.location,
            language: domain.settings.language,
            fetchHistoryIfEmpty: true,
          });

          if (!result.success) {
            throw new Error(result.error || "Failed to fetch position");
          }
        } else {
          // Use fetchPositions for already-checked keywords
          console.log(`[processKeywordCheckJob] Regular check for ${keyword.phrase}`);
          const result = await ctx.runAction(internal.dataforseo.fetchPositionsInternal, {
            domainId: job.domainId,
            keywords: [{ id: keywordId, phrase: keyword.phrase }],
            domain: domain.domain,
            searchEngine: domain.settings.searchEngine,
            location: domain.settings.location,
            language: domain.settings.language,
          });

          if (!result.success) {
            throw new Error(result.error || "Failed to fetch positions");
          }
        }

        // Mark keyword as completed
        await ctx.runMutation(internal.keywordCheckJobs.updateKeywordStatusInternal, {
          keywordId,
          status: "completed",
        });

        processedCount++;
      } catch (error) {
        console.error(`[processKeywordCheckJob] Error checking keyword ${keyword.phrase}:`, error);

        // Mark keyword as failed
        await ctx.runMutation(internal.keywordCheckJobs.updateKeywordStatusInternal, {
          keywordId,
          status: "failed",
        });

        failedCount++;
        processedCount++;
      }

      // Update job progress
      await ctx.runMutation(internal.keywordCheckJobs.updateJobProgressInternal, {
        jobId: args.jobId,
        processedKeywords: processedCount,
        failedKeywords: failedCount,
      });

      console.log(`[processKeywordCheckJob] Progress: ${processedCount}/${job.totalKeywords}, failed: ${failedCount}`);
    }

    // Mark job as completed
    await ctx.runMutation(internal.keywordCheckJobs.updateJobStatusInternal, {
      jobId: args.jobId,
      status: "completed",
      completedAt: Date.now(),
    });

    // Clear checking status from all keywords
    for (const keywordId of job.keywordIds) {
      await ctx.runMutation(internal.keywordCheckJobs.clearKeywordCheckingStatusInternal, {
        keywordId,
      });
    }

    console.log(`[processKeywordCheckJob] Job ${args.jobId} completed: ${processedCount}/${job.totalKeywords} processed, ${failedCount} failed`);
  },
});

// Internal queries and mutations
export const getJobInternal = internalQuery({
  args: { jobId: v.id("keywordCheckJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.domainId);
  },
});

export const getKeywordInternal = internalQuery({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.keywordId);
  },
});

export const updateJobStatusInternal = internalMutation({
  args: {
    jobId: v.id("keywordCheckJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.startedAt !== undefined) updates.startedAt = args.startedAt;
    if (args.completedAt !== undefined) updates.completedAt = args.completedAt;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.jobId, updates);
  },
});

export const updateJobCurrentKeywordInternal = internalMutation({
  args: {
    jobId: v.id("keywordCheckJobs"),
    currentKeywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      currentKeywordId: args.currentKeywordId,
    });
  },
});

export const updateJobProgressInternal = internalMutation({
  args: {
    jobId: v.id("keywordCheckJobs"),
    processedKeywords: v.number(),
    failedKeywords: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      processedKeywords: args.processedKeywords,
      failedKeywords: args.failedKeywords,
    });
  },
});

export const updateKeywordStatusInternal = internalMutation({
  args: {
    keywordId: v.id("keywords"),
    status: v.union(
      v.literal("queued"),
      v.literal("checking"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keywordId, {
      checkingStatus: args.status,
    });
  },
});

export const clearKeywordCheckingStatusInternal = internalMutation({
  args: {
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keywordId, {
      checkingStatus: undefined,
      checkJobId: undefined,
    });
  },
});

export const getKeywordPositionsCountInternal = internalQuery({
  args: {
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .collect();
    return positions.length;
  },
});
