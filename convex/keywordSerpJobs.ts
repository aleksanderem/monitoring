import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Create a new SERP fetch job
export const createSerpFetchJob = mutation({
  args: {
    domainId: v.id("domains"),
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    // Create job record
    const jobId = await ctx.db.insert("keywordSerpJobs", {
      domainId: args.domainId,
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
  args: { jobId: v.id("keywordSerpJobs") },
  handler: async (ctx, args) => {
    console.log(`[processSerpFetchJob] Starting job ${args.jobId}`);

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

    // Mark as processing
    await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
      jobId: args.jobId,
      status: "processing",
      startedAt: Date.now(),
    });

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

    const auth = btoa(`${login}:${password}`);

    // Process each keyword
    let processedCount = 0;
    let failedCount = 0;

    for (const keywordId of job.keywordIds) {
      // Check if job was cancelled
      const currentJob = await ctx.runQuery(internal.keywordSerpJobs.getJobInternal, {
        jobId: args.jobId,
      });

      if (currentJob?.status === "cancelled") {
        console.log(`[processSerpFetchJob] Job ${args.jobId} was cancelled during processing`);
        return;
      }

      // Update current keyword
      await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
        jobId: args.jobId,
        currentKeywordId: keywordId,
      });

      // Get keyword
      const keyword = await ctx.runQuery(internal.keywords.getKeywordInternal, {
        keywordId,
      });

      if (!keyword) {
        console.error(`[processSerpFetchJob] Keyword ${keywordId} not found`);
        failedCount++;
        continue;
      }

      try {
        // Fetch SERP data for this keyword
        const task = {
          keyword: keyword.phrase,
          location_code: 2840,
          language_code: "en",
          device: "desktop",
          os: "windows",
          depth: 100,
        };

        const response = await fetch(
          "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([task]),
          }
        );

        if (!response.ok) {
          console.error(
            `[processSerpFetchJob] API error for "${keyword.phrase}": ${response.status}`
          );
          failedCount++;
          continue;
        }

        const data = await response.json();

        if (data.status_code !== 20000) {
          console.error(
            `[processSerpFetchJob] API returned error for "${keyword.phrase}": ${data.status_code}`
          );
          failedCount++;
          continue;
        }

        const taskResult = data.tasks?.[0];

        if (!taskResult || taskResult.status_code !== 20000 || !taskResult.result?.[0]?.items) {
          console.error(`[processSerpFetchJob] No valid results for "${keyword.phrase}"`);
          failedCount++;
          continue;
        }

        // Extract organic results (convert null to undefined for optional fields)
        // Helper to convert null to undefined
        const n = (val: any) => val != null ? val : undefined;

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

        for (const competitor of topCompetitors) {
          try {
            // Add competitor (will check if exists and reactivate if paused)
            const competitorId = await ctx.runMutation(internal.competitors.addCompetitorInternal, {
              domainId: job.domainId,
              competitorDomain: competitor.domain,
              name: competitor.domain,
            });

            // Save competitor position for this keyword
            const today = new Date().toISOString().split("T")[0];
            await ctx.runMutation(internal.competitors.saveCompetitorPosition, {
              competitorId,
              keywordId: keyword._id,
              date: today,
              position: competitor.position,
              url: competitor.url,
            });
          } catch (error) {
            console.error(`[processSerpFetchJob] Error tracking competitor ${competitor.domain}:`, error);
            // Continue with other competitors
          }
        }

        processedCount++;

        // Update progress
        await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
          jobId: args.jobId,
          processedKeywords: processedCount,
          failedKeywords: failedCount,
        });

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `[processSerpFetchJob] Error processing keyword "${keyword.phrase}":`,
          error
        );
        failedCount++;

        await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
          jobId: args.jobId,
          processedKeywords: processedCount,
          failedKeywords: failedCount,
        });
      }
    }

    // Mark as completed
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
