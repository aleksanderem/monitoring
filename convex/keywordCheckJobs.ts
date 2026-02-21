import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

// Get all active jobs (for global status indicator)
export const getAllActiveJobs = query({
  args: {},
  handler: async (ctx, args) => {
    const activeJobs = await ctx.db
      .query("keywordCheckJobs")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .order("desc")
      .collect();

    // Enrich with domain and current keyword info
    const enrichedJobs = await Promise.all(
      activeJobs.map(async (job) => {
        const domain = await ctx.db.get(job.domainId);
        let currentKeywordPhrase: string | undefined;

        if (job.currentKeywordId) {
          const currentKeyword = await ctx.db.get(job.currentKeywordId);
          currentKeywordPhrase = currentKeyword?.phrase;
        }

        return {
          _id: job._id,
          domainId: job.domainId,
          domainName: domain?.domain,
          status: job.status,
          totalKeywords: job.totalKeywords,
          processedKeywords: job.processedKeywords,
          failedKeywords: job.failedKeywords,
          currentKeywordPhrase,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
        };
      })
    );

    return enrichedJobs;
  },
});

// Get recently completed jobs (last 2 minutes) for toast notifications
export const getRecentCompletedJobs = query({
  args: {},
  handler: async (ctx, args) => {
    const twoMinutesAgo = Date.now() - (2 * 60 * 1000);

    const recentJobs = await ctx.db
      .query("keywordCheckJobs")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "completed"),
            q.eq(q.field("status"), "failed"),
            q.eq(q.field("status"), "cancelled")
          ),
          q.gte(q.field("completedAt"), twoMinutesAgo)
        )
      )
      .order("desc")
      .collect();

    // Enrich with domain info
    const enrichedJobs = await Promise.all(
      recentJobs.map(async (job) => {
        const domain = await ctx.db.get(job.domainId);

        return {
          _id: job._id,
          domainId: job.domainId,
          domainName: domain?.domain,
          status: job.status,
          totalKeywords: job.totalKeywords,
          processedKeywords: job.processedKeywords,
          failedKeywords: job.failedKeywords,
          error: job.error,
          completedAt: job.completedAt,
        };
      })
    );

    return enrichedJobs;
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
  args: {
    jobId: v.id("keywordCheckJobs"),
    startIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const CHUNK_SIZE = 15; // Process 15 keywords per action invocation to stay within timeout
    const startIndex = args.startIndex ?? 0;

    console.log(`[processKeywordCheckJob] Starting job ${args.jobId} from index ${startIndex}`);

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

    // Mark job as processing (only on first chunk)
    if (startIndex === 0) {
      await ctx.runMutation(internal.keywordCheckJobs.updateJobStatusInternal, {
        jobId: args.jobId,
        status: "processing",
        startedAt: Date.now(),
      });
    }

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
      await ctx.runMutation(internal.notifications.createJobNotification, {
        domainId: job.domainId,
        type: "job_failed",
        title: "Keyword check failed",
        message: "Domain not found",
        jobType: "keyword_check",
        jobId: args.jobId,
      });
      return;
    }

    // Resume counters from job state (previous chunks already counted)
    let processedCount = job.processedKeywords || 0;
    let failedCount = job.failedKeywords || 0;

    const endIndex = Math.min(startIndex + CHUNK_SIZE, job.keywordIds.length);
    const chunkKeywordIds = job.keywordIds.slice(startIndex, endIndex);

    // Phase 1: Check cancellation before processing chunk
    if (startIndex > 0) {
      const currentJob = await ctx.runQuery(internal.keywordCheckJobs.getJobInternal, {
        jobId: args.jobId,
      });
      if (currentJob?.status === "cancelled") {
        console.log(`[processKeywordCheckJob] Job ${args.jobId} cancelled before chunk`);
        return;
      }
    }

    // Phase 2: Batch fetch all keyword data for this chunk (1 query instead of N)
    const keywords = await ctx.runQuery(internal.keywords.getKeywordsByIdsBatch, {
      keywordIds: chunkKeywordIds,
    });

    // Build a set of found keyword IDs for tracking missing ones
    const foundKeywordIds = new Set(keywords.map((k) => k._id));
    const missingCount = chunkKeywordIds.filter((id) => !foundKeywordIds.has(id)).length;
    if (missingCount > 0) {
      console.error(`[processKeywordCheckJob] ${missingCount} keywords not found in chunk`);
      failedCount += missingCount;
      processedCount += missingCount;
    }

    // Phase 3: Batch set all to "checking" (1 mutation instead of N)
    await ctx.runMutation(internal.keywords.updateKeywordStatusBatch, {
      updates: keywords.map((k) => ({ keywordId: k._id, status: "checking" as const })),
    });

    // Update job's current keyword to first in chunk
    if (keywords.length > 0) {
      await ctx.runMutation(internal.keywordCheckJobs.updateJobCurrentKeywordInternal, {
        jobId: args.jobId,
        currentKeywordId: keywords[0]._id,
      });
    }

    // Phase 4: Split keywords into first-time (need history) vs regular (batch API call)
    const firstTimeKeywords = keywords.filter(
      (k) => !k.positionUpdatedAt && !(k.recentPositions?.length)
    );
    const regularKeywords = keywords.filter(
      (k) => k.positionUpdatedAt || (k.recentPositions?.length)
    );

    const keywordResults = new Map<string, boolean>(); // keywordId -> success
    const failedPhrases: string[] = [];

    // Phase 4a: Process first-time keywords individually (they need fetchSinglePositionInternal with history)
    for (const keyword of firstTimeKeywords) {
      try {
        console.log(`[processKeywordCheckJob] First-time check for ${keyword.phrase}, fetching with history`);
        const result = await ctx.runAction(internal.dataforseo.fetchSinglePositionInternal, {
          keywordId: keyword._id,
          phrase: keyword.phrase,
          domain: domain.domain,
          location: domain.settings.location,
          language: domain.settings.language,
          fetchHistoryIfEmpty: true,
        });
        keywordResults.set(keyword._id, result.success);
        if (!result.success) {
          console.error(`[processKeywordCheckJob] First-time check failed for ${keyword.phrase}: ${result.error}`);
          failedPhrases.push(keyword.phrase);
        }
      } catch (error) {
        console.error(`[processKeywordCheckJob] Error checking keyword ${keyword.phrase}:`, error);
        keywordResults.set(keyword._id, false);
        failedPhrases.push(keyword.phrase);
      }
    }

    // Phase 4b: Batch API call for all regular keywords (1 action instead of N)
    if (regularKeywords.length > 0) {
      try {
        console.log(`[processKeywordCheckJob] Batch checking ${regularKeywords.length} regular keywords`);
        const result = await ctx.runAction(internal.dataforseo.fetchPositionsInternal, {
          domainId: job.domainId,
          keywords: regularKeywords.map((k) => ({ id: k._id, phrase: k.phrase })),
          domain: domain.domain,
          searchEngine: domain.settings.searchEngine,
          location: domain.settings.location,
          language: domain.settings.language,
        });

        // If the batch call succeeds, mark all regular keywords as successful
        // If it fails, mark all as failed
        for (const keyword of regularKeywords) {
          keywordResults.set(keyword._id, result.success);
        }
        if (!result.success) {
          console.error(`[processKeywordCheckJob] Batch fetch failed: ${result.error}`);
          for (const keyword of regularKeywords) {
            failedPhrases.push(keyword.phrase);
          }
        }
      } catch (error) {
        console.error(`[processKeywordCheckJob] Error in batch fetch:`, error);
        for (const keyword of regularKeywords) {
          keywordResults.set(keyword._id, false);
          failedPhrases.push(keyword.phrase);
        }
      }
    }

    // Phase 5: Batch set all to "completed"/"failed" based on results (1 mutation instead of N)
    const statusUpdates = keywords.map((k) => ({
      keywordId: k._id,
      status: (keywordResults.get(k._id) ? "completed" : "failed") as "completed" | "failed",
    }));
    await ctx.runMutation(internal.keywords.updateKeywordStatusBatch, {
      updates: statusUpdates,
    });

    // Count results
    for (const [, success] of keywordResults) {
      if (success) {
        processedCount++;
      } else {
        failedCount++;
        processedCount++;
      }
    }

    // Phase 6: Update progress once for the whole chunk (1 mutation instead of N)
    await ctx.runMutation(internal.keywordCheckJobs.updateJobProgressInternal, {
      jobId: args.jobId,
      processedKeywords: processedCount,
      failedKeywords: failedCount,
    });

    console.log(`[processKeywordCheckJob] Chunk done: ${processedCount}/${job.totalKeywords}, failed: ${failedCount}`);

    // If there are more keywords, schedule next chunk
    if (endIndex < job.keywordIds.length) {
      console.log(`[processKeywordCheckJob] Chunk done (${startIndex}-${endIndex}), scheduling next chunk at index ${endIndex}`);
      await ctx.scheduler.runAfter(0, internal.keywordCheckJobs.processKeywordCheckJobInternal, {
        jobId: args.jobId,
        startIndex: endIndex,
      });
      return;
    }

    // All keywords processed — finalize job
    await ctx.runMutation(internal.keywordCheckJobs.updateJobStatusInternal, {
      jobId: args.jobId,
      status: "completed",
      completedAt: Date.now(),
    });

    // Build detailed notification message including failed keyword names
    let notificationMessage = `Checked ${processedCount} keywords`;
    if (failedCount > 0) {
      const MAX_SHOWN = 5;
      const shownPhrases = failedPhrases.slice(0, MAX_SHOWN).map(p => `"${p}"`).join(", ");
      const moreCount = failedPhrases.length - MAX_SHOWN;
      notificationMessage += `, ${failedCount} failed: ${shownPhrases}`;
      if (moreCount > 0) {
        notificationMessage += ` and ${moreCount} more`;
      }
    }

    await ctx.runMutation(internal.notifications.createJobNotification, {
      domainId: job.domainId,
      type: failedCount > 0 ? "job_failed" : "job_completed",
      title: "Keyword position check completed",
      message: notificationMessage,
      jobType: "keyword_check",
      jobId: args.jobId,
    });

    // Clear checking status from all keywords in one mutation
    await ctx.runMutation(internal.keywordCheckJobs.clearKeywordCheckingStatusBatch, {
      keywordIds: job.keywordIds,
    });

    // Trigger page scoring recomputation after keyword positions updated
    await ctx.scheduler.runAfter(0, internal.pageScoring.computePageScores, {
      domainId: job.domainId,
      offset: 0,
    });

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

// Batch clear checking status for multiple keywords (single mutation instead of N calls)
export const clearKeywordCheckingStatusBatch = internalMutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    for (const keywordId of args.keywordIds) {
      const keyword = await ctx.db.get(keywordId);
      if (!keyword) continue; // Skip deleted keywords — don't crash the batch
      await ctx.db.patch(keywordId, {
        checkingStatus: undefined,
        checkJobId: undefined,
      });
    }
  },
});

// Cleanup stuck jobs - runs every 5 minutes via cron
export const cleanupStuckJobs = internalMutation({
  args: {},
  handler: async (ctx, args) => {
    const now = Date.now();
    const PENDING_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const PROCESSING_TIMEOUT = 30 * 60 * 1000; // 30 minutes (chunked processing spans multiple action invocations)

    // Find stuck pending jobs (pending for more than 5 minutes)
    const stuckPendingJobs = await ctx.db
      .query("keywordCheckJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    for (const job of stuckPendingJobs) {
      if (now - job.createdAt > PENDING_TIMEOUT) {
        console.log(`[cleanupStuckJobs] Marking stuck pending job ${job._id} as failed`);
        await ctx.db.patch(job._id, {
          status: "failed",
          error: "Job timed out in pending state",
          completedAt: now,
        });

        // Clear checking status from all keywords
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_check_job", (q) => q.eq("checkJobId", job._id))
          .collect();

        for (const keyword of keywords) {
          await ctx.db.patch(keyword._id, {
            checkingStatus: undefined,
            checkJobId: undefined,
          });
        }
      }
    }

    // Find stuck processing jobs (processing for more than 15 minutes)
    const stuckProcessingJobs = await ctx.db
      .query("keywordCheckJobs")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    for (const job of stuckProcessingJobs) {
      const startTime = job.startedAt || job.createdAt;
      if (now - startTime > PROCESSING_TIMEOUT) {
        console.log(`[cleanupStuckJobs] Marking stuck processing job ${job._id} as failed`);
        await ctx.db.patch(job._id, {
          status: "failed",
          error: "Job timed out during processing",
          completedAt: now,
        });

        // Clear checking status from all keywords
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_check_job", (q) => q.eq("checkJobId", job._id))
          .collect();

        for (const keyword of keywords) {
          await ctx.db.patch(keyword._id, {
            checkingStatus: undefined,
            checkJobId: undefined,
          });
        }
      }
    }

    // Safety net: find orphaned keywords stuck in "checking" with no active job
    // This handles edge cases where cancellation or job failure left keywords behind
    const cancelledJobs = await ctx.db
      .query("keywordCheckJobs")
      .withIndex("by_status", (q) => q.eq("status", "cancelled"))
      .collect();

    for (const job of cancelledJobs) {
      // Only process recently cancelled jobs (within last hour) to bound the work
      if (now - (job.completedAt || job.createdAt) > 60 * 60 * 1000) continue;

      const orphanedKeywords = await ctx.db
        .query("keywords")
        .withIndex("by_check_job", (q) => q.eq("checkJobId", job._id))
        .collect();

      if (orphanedKeywords.length > 0) {
        console.log(`[cleanupStuckJobs] Clearing ${orphanedKeywords.length} orphaned keywords from cancelled job ${job._id}`);
        for (const keyword of orphanedKeywords) {
          await ctx.db.patch(keyword._id, {
            checkingStatus: undefined,
            checkJobId: undefined,
          });
        }
      }
    }
  },
});
