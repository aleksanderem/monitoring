import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { checkRefreshLimits } from "./limits";
import { buildLocationParam } from "./dataforseoLocations";
import { createDebugLogger } from "./lib/debugLogger";
import { API_COSTS } from "./apiUsage";
import { isValidKeywordPhrase } from "./lib/keywordValidation";

// Create a new SERP fetch job
export const createSerpFetchJob = mutation({
  args: {
    domainId: v.id("domains"),
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    // Get userId for per-user rate limiting and job tracking
    const userId = await auth.getUserId(ctx);

    // Check refresh rate limits (cooldown + daily quota + per-user + per-project + per-domain + bulk cap)
    await checkRefreshLimits(ctx, args.domainId, userId, args.keywordIds.length);

    // Create job record
    const jobId = await ctx.db.insert("keywordSerpJobs", {
      domainId: args.domainId,
      createdBy: userId ?? undefined,
      status: "pending",
      totalKeywords: args.keywordIds.length,
      processedKeywords: 0,
      failedKeywords: 0,
      keywordIds: args.keywordIds,
      createdAt: Date.now(),
    });

    // Schedule background processing
    await ctx.scheduler.runAfter(0, internal.keywordSerpJobs.processSerpFetchJobInternal, {
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
      .query("keywordSerpJobs")
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
  args: { jobId: v.id("keywordSerpJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Internal query to get job
export const getJobInternal = internalQuery({
  args: { jobId: v.id("keywordSerpJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Internal mutation to update job
export const updateJobInternal = internalMutation({
  args: {
    jobId: v.id("keywordSerpJobs"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    currentKeywordId: v.optional(v.id("keywords")),
    processedKeywords: v.optional(v.number()),
    failedKeywords: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, updates);
  },
});

// Cancel job
export const cancelJob = mutation({
  args: { jobId: v.id("keywordSerpJobs") },
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
  },
});

// Internal action to process job in background
export const processSerpFetchJobInternal = internalAction({
  args: {
    jobId: v.id("keywordSerpJobs"),
    startIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const CHUNK_SIZE = 10; // Process 10 keywords per action invocation (SERP jobs are heavier with 1s delay)
    const startIndex = args.startIndex ?? 0;

    console.log(`[processSerpFetchJob] Starting job ${args.jobId} from index ${startIndex}`);
    const debug = await createDebugLogger(ctx, "serp_job");

    // Get job
    const job = await ctx.runQuery(internal.keywordSerpJobs.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      console.error(`[processSerpFetchJob] Job ${args.jobId} not found`);
      return;
    }

    if (job.status === "cancelled") {
      console.log(`[processSerpFetchJob] Job ${args.jobId} was cancelled`);
      return;
    }

    // Mark as processing (only on first chunk)
    if (startIndex === 0) {
      await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
        jobId: args.jobId,
        status: "processing",
        startedAt: Date.now(),
      });
    }

    // Get domain info
    const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
      domainId: job.domainId,
    });

    if (!domain) {
      await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
        jobId: args.jobId,
        status: "failed",
        completedAt: Date.now(),
        error: "Domain not found",
      });
      await ctx.runMutation(internal.notifications.createJobNotification, {
        domainId: job.domainId,
        type: "job_failed",
        title: "SERP check failed",
        message: "Domain not found",
        jobType: "serp_fetch",
        jobId: args.jobId,
      });
      return;
    }

    // Get API credentials
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
        jobId: args.jobId,
        status: "failed",
        completedAt: Date.now(),
        error: "DataForSEO credentials not configured",
      });
      await ctx.runMutation(internal.notifications.createJobNotification, {
        domainId: job.domainId,
        type: "job_failed",
        title: "SERP check failed",
        message: "DataForSEO credentials not configured",
        jobType: "serp_fetch",
        jobId: args.jobId,
      });
      return;
    }

    const authToken = btoa(`${login}:${password}`);

    // Resume counters from job state
    let processedCount = job.processedKeywords || 0;
    let failedCount = job.failedKeywords || 0;

    const endIndex = Math.min(startIndex + CHUNK_SIZE, job.keywordIds.length);

    // ── Fetch keywords for this chunk ──
    const chunkKeywordIds = job.keywordIds.slice(startIndex, endIndex);
    const chunkKeywords: Array<{ _id: Id<"keywords">; phrase: string }> = [];
    const skippedCount = { invalid: 0 };

    for (const keywordId of chunkKeywordIds) {
      const keyword = await ctx.runQuery(internal.keywords.getKeywordInternal, {
        keywordId,
      });
      if (!keyword) {
        console.error(`[processSerpFetchJob] Keyword ${keywordId} not found`);
        failedCount++;
        continue;
      }
      // Validate phrase before sending to API
      const validation = isValidKeywordPhrase(keyword.phrase);
      if (!validation.valid) {
        console.warn(`[processSerpFetchJob] Skipping invalid phrase "${keyword.phrase}": ${validation.reason}`);
        skippedCount.invalid++;
        failedCount++;
        continue;
      }
      chunkKeywords.push({ _id: keyword._id, phrase: keyword.phrase });
    }

    if (chunkKeywords.length === 0) {
      // All keywords in chunk were invalid/missing — skip to next chunk
      await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
        jobId: args.jobId,
        processedKeywords: processedCount,
        failedKeywords: failedCount,
      });
    } else {
      // ── Check daily cost cap before batch API call ──
      const batchCost = chunkKeywords.length * API_COSTS.SERP_LIVE_ADVANCED;
      const costCheck = await ctx.runQuery(internal.apiUsage.checkDailyCostCap, {
        estimatedCost: batchCost,
        domainId: job.domainId,
      });

      if (!costCheck.allowed) {
        console.error(`[processSerpFetchJob] Daily API cost limit reached ($${costCheck.todayCost}/$${costCheck.cap}), pausing job`);
        await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
          jobId: args.jobId,
          status: "failed",
          completedAt: Date.now(),
          error: `Daily API cost limit reached ($${costCheck.todayCost}/$${costCheck.cap})`,
        });
        return;
      }

      // ── Check if job was cancelled ──
      const currentJob = await ctx.runQuery(internal.keywordSerpJobs.getJobInternal, {
        jobId: args.jobId,
      });
      if (currentJob?.status === "cancelled") {
        console.log(`[processSerpFetchJob] Job ${args.jobId} was cancelled during processing`);
        return;
      }

      // ── Build batched SERP request ──
      const locationParam = buildLocationParam(domain.settings.location);
      const tasks = chunkKeywords.map((kw) => ({
        keyword: kw.phrase,
        ...locationParam,
        language_code: domain.settings.language,
        device: "desktop",
        os: "windows",
        depth: 100,
      }));

      try {
        const data = await debug.logStep("serp_live_batch", { count: tasks.length }, async () => {
          const response = await fetch(
            "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(tasks),
            }
          );

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          return await response.json();
        });

        // Log API usage once per batch
        await ctx.runMutation(internal.apiUsage.logApiUsage, {
          endpoint: "/serp/google/organic/live/advanced",
          taskCount: chunkKeywords.length,
          estimatedCost: batchCost,
          caller: "processSerpFetchJob",
          domainId: job.domainId,
          metadata: JSON.stringify({ batchSize: chunkKeywords.length }),
        });

        if (data.status_code !== 20000 || !data.tasks) {
          console.error(`[processSerpFetchJob] Batch API error: ${data.status_code}`);
          failedCount += chunkKeywords.length;
        } else {
          // ── Process each task result ──
          // Helper to convert null to undefined
          const n = (val: any) => val != null ? val : undefined;

          for (let t = 0; t < data.tasks.length; t++) {
            const taskResult = data.tasks[t];
            const keyword = chunkKeywords[t];

            if (!keyword) continue;

            // Update current keyword indicator
            await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
              jobId: args.jobId,
              currentKeywordId: keyword._id,
            });

            if (!taskResult || taskResult.status_code !== 20000 || !taskResult.result?.[0]?.items) {
              console.error(`[processSerpFetchJob] No valid results for "${keyword.phrase}"`);
              failedCount++;
              continue;
            }

            const items = taskResult.result[0].items;
            const organicResults = items
              .filter((item: any) => item.type === "organic")
              .slice(0, 100)
              .map((item: any) => ({
                position: item.rank_absolute || item.rank_group || 0,
                rankGroup: n(item.rank_group),
                rankAbsolute: n(item.rank_absolute),
                domain: item.domain || (item.url ? new URL(item.url).hostname : ""),
                url: item.url || "",
                title: n(item.title),
                description: n(item.description),
                breadcrumb: n(item.breadcrumb),
                websiteName: n(item.website_name),
                relativeUrl: n(item.relative_url),
                mainDomain: n(item.main_domain),
                highlighted: n(item.highlighted),
                sitelinks: item.links
                  ?.filter((link: any) => link.type === "sitelink")
                  ?.map((link: any) => ({
                    title: n(link.title),
                    description: n(link.description),
                    url: n(link.url),
                  })),
                etv: n(item.etv),
                estimatedPaidTrafficCost: n(item.estimated_paid_traffic_cost),
                isFeaturedSnippet: n(item.is_featured_snippet),
                isMalicious: n(item.is_malicious),
                isWebStory: n(item.is_web_story),
                ampVersion: n(item.amp_version),
                rating: item.rating
                  ? {
                      ratingType: n(item.rating.rating_type),
                      value: n(item.rating.value),
                      votesCount: n(item.rating.votes_count),
                      ratingMax: n(item.rating.rating_max),
                    }
                  : undefined,
                price: item.price
                  ? {
                      current: n(item.price.current),
                      regular: n(item.price.regular),
                      maxValue: n(item.price.max_value),
                      currency: n(item.price.currency),
                      isPriceRange: n(item.price.is_price_range),
                      displayedPrice: n(item.price.displayed_price),
                    }
                  : undefined,
                timestamp: n(item.timestamp),
                aboutThisResult: item.about_this_result
                  ? {
                      url: n(item.about_this_result.url),
                      source: n(item.about_this_result.source),
                      sourceInfo: n(item.about_this_result.source_info),
                      sourceUrl: n(item.about_this_result.source_url),
                    }
                  : undefined,
              }));

            // Store results
            await ctx.runMutation(internal.dataforseo.storeSerpResultsInternal, {
              keywordId: keyword._id,
              domainId: job.domainId,
              yourDomain: domain.domain,
              results: organicResults,
            });

            // Auto-extract and track top competitors (positions 1-10, excluding own domain)
            const topCompetitors = organicResults
              .filter((r: any) => r.position <= 10 && r.domain !== domain.domain)
              .slice(0, 10);

            if (topCompetitors.length > 0) {
              const today = new Date().toISOString().split("T")[0];
              try {
                await ctx.runMutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
                  domainId: job.domainId,
                  keywordId: keyword._id,
                  date: today,
                  competitors: topCompetitors.map((c: any) => ({
                    domain: c.domain,
                    position: c.position,
                    url: c.url,
                  })),
                });
              } catch (error) {
                console.error(`[processSerpFetchJob] Error tracking competitors batch:`, error);
              }
            }

            processedCount++;
          }
        }

        // Update progress after batch
        await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
          jobId: args.jobId,
          processedKeywords: processedCount,
          failedKeywords: failedCount,
        });
      } catch (error) {
        console.error(`[processSerpFetchJob] Batch API error:`, error);
        failedCount += chunkKeywords.length;

        await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
          jobId: args.jobId,
          processedKeywords: processedCount,
          failedKeywords: failedCount,
        });
      }
    }

    // If there are more keywords, schedule next chunk
    if (endIndex < job.keywordIds.length) {
      console.log(`[processSerpFetchJob] Chunk done (${startIndex}-${endIndex}), scheduling next chunk at index ${endIndex}`);
      await ctx.scheduler.runAfter(0, internal.keywordSerpJobs.processSerpFetchJobInternal, {
        jobId: args.jobId,
        startIndex: endIndex,
      });
      return;
    }

    // All keywords processed — finalize job
    await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId: args.jobId,
      status: "completed",
      completedAt: Date.now(),
      processedKeywords: processedCount,
      failedKeywords: failedCount,
    });

    // Notify team
    await ctx.runMutation(internal.notifications.createJobNotification, {
      domainId: job.domainId,
      type: failedCount > 0 ? "job_failed" : "job_completed",
      title: "SERP check completed",
      message: `Processed ${processedCount} keywords${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      jobType: "serp_fetch",
      jobId: args.jobId,
    });

    console.log(
      `[processSerpFetchJob] Job ${args.jobId} completed: ${processedCount} processed, ${failedCount} failed`
    );
  },
});

// Batch mutation: add/update competitors + save positions in one transaction
// Replaces N × (addCompetitorInternal + saveCompetitorPosition) individual calls
export const trackCompetitorsBatch = internalMutation({
  args: {
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
    date: v.string(),
    competitors: v.array(
      v.object({
        domain: v.string(),
        position: v.number(),
        url: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const comp of args.competitors) {
      // Check if competitor exists
      const existing = await ctx.db
        .query("competitors")
        .withIndex("by_domain_competitor", (q) =>
          q.eq("domainId", args.domainId).eq("competitorDomain", comp.domain)
        )
        .first();

      let competitorId: Id<"competitors">;
      if (existing) {
        competitorId = existing._id;
        if (existing.status === "active") {
          await ctx.db.patch(existing._id, { lastCheckedAt: Date.now() });
        }
      } else {
        competitorId = await ctx.db.insert("competitors", {
          domainId: args.domainId,
          competitorDomain: comp.domain,
          name: comp.domain,
          status: "paused",
          createdAt: Date.now(),
        });
      }

      // Save position (upsert)
      const existingPos = await ctx.db
        .query("competitorKeywordPositions")
        .withIndex("by_competitor_keyword_date", (q) =>
          q.eq("competitorId", competitorId).eq("keywordId", args.keywordId).eq("date", args.date)
        )
        .first();

      if (existingPos) {
        await ctx.db.patch(existingPos._id, {
          position: comp.position,
          url: comp.url,
          fetchedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("competitorKeywordPositions", {
          competitorId,
          keywordId: args.keywordId,
          date: args.date,
          position: comp.position,
          url: comp.url,
          fetchedAt: Date.now(),
        });
      }
    }
  },
});
