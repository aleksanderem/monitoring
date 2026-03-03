import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { checkRefreshLimits } from "./limits";
import { buildLocationParam } from "./dataforseoLocations";
import { createDebugLogger } from "./lib/debugLogger";
import { API_COSTS, extractApiCost } from "./apiUsage";
import { isValidKeywordPhrase } from "./lib/keywordValidation";
import { writeKeywordPositions, writeCompetitorPositions, type KeywordPositionRow, type CompetitorPositionRow } from "./lib/supabase";

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
    await checkRefreshLimits(ctx, args.domainId, userId, args.keywordIds.length, "serp");

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

    // ── Fetch keywords for this chunk (1 batch query instead of N individual) ──
    const chunkKeywordIds: Id<"keywords">[] = job.keywordIds.slice(startIndex, endIndex);
    const skippedCount = { invalid: 0 };

    const allKeywords: Array<{ _id: Id<"keywords">; phrase: string }> = await ctx.runQuery(internal.keywords.getKeywordsByIdsBatch, {
      keywordIds: chunkKeywordIds,
    });

    // Track missing keywords
    const foundIds = new Set(allKeywords.map((k) => k._id));
    const missingCount = chunkKeywordIds.filter((id) => !foundIds.has(id)).length;
    if (missingCount > 0) {
      console.error(`[processSerpFetchJob] ${missingCount} keywords not found in chunk`);
      failedCount += missingCount;
    }

    // Filter out invalid phrases
    const chunkKeywords: Array<{ _id: Id<"keywords">; phrase: string }> = [];
    for (const keyword of allKeywords) {
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

      // ── Process keywords one at a time (DataForSEO allows only 1 task per request) ──
      const locationParam = buildLocationParam(domain.settings.location);
      const n = (val: any) => val != null ? val : undefined;

      const callSerpApi = async (task: object) => {
        const response = await fetch(
          "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([task]),
          }
        );
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
      };

      for (const keyword of chunkKeywords) {
        // Update current keyword indicator
        await ctx.runMutation(internal.keywordSerpJobs.updateJobInternal, {
          jobId: args.jobId,
          currentKeywordId: keyword._id,
        });

        try {
          const task = {
            keyword: keyword.phrase,
            ...locationParam,
            language_code: domain.settings.language,
            device: "desktop",
            os: "windows",
            depth: 30,
          };

          let data = await callSerpApi(task);

          // Log API usage
          await ctx.runMutation(internal.apiUsage.logApiUsage, {
            endpoint: "/serp/google/organic/live/advanced",
            taskCount: 1,
            estimatedCost: extractApiCost(data, API_COSTS.SERP_LIVE_ADVANCED),
            caller: "processSerpFetchJob",
            domainId: job.domainId,
          });

          // If 40501 (language mismatch), retry without language
          const taskResult0 = data.tasks?.[0];
          if (taskResult0?.status_code === 40501) {
            console.warn(`[processSerpFetchJob] 40501 for "${keyword.phrase}", retrying without language_code`);
            const { language_code: _, ...taskNoLang } = task;
            data = await callSerpApi(taskNoLang);
          }

          if (data.status_code !== 20000 || !data.tasks?.[0]) {
            console.error(`[processSerpFetchJob] API error for "${keyword.phrase}": ${data.status_code}`);
            failedCount++;
            continue;
          }

          const taskResult = data.tasks[0];
          if (taskResult.status_code !== 20000) {
            console.error(`[processSerpFetchJob] Task error for "${keyword.phrase}": status=${taskResult.status_code}, message="${taskResult.status_message}"`);
            failedCount++;
            continue;
          }

          if (!taskResult.result?.[0]?.items || taskResult.result[0].items.length === 0) {
            console.log(`[processSerpFetchJob] No SERP results for "${keyword.phrase}" (empty)`);
            processedCount++;
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

          // Store SERP results
          await ctx.runMutation(internal.dataforseo.storeSerpResultsInternal, {
            keywordId: keyword._id,
            domainId: job.domainId,
            yourDomain: domain.domain,
            results: organicResults,
          });

          // Store keyword position (find our domain in SERP results)
          const today = new Date().toISOString().split("T")[0];
          const ourResult = organicResults.find((r: any) => r.domain === domain.domain);
          const kwPosition = ourResult ? ourResult.position : null;
          const kwUrl = ourResult ? ourResult.url : null;

          await ctx.runMutation(internal.dataforseo.storePositionInternal, {
            keywordId: keyword._id,
            date: today,
            position: kwPosition,
            url: kwUrl,
          });

          // Dual-write to Supabase
          writeKeywordPositions([{
            convex_domain_id: job.domainId,
            convex_keyword_id: keyword._id,
            date: today,
            position: kwPosition,
            url: kwUrl,
          }]).catch((err) =>
            console.error(`[Supabase] keywordSerpJobs write failed: keyword=${keyword._id}:`, err)
          );

          // Auto-extract and track top competitors (positions 1-10, excluding own domain)
          const topCompetitors = organicResults
            .filter((r: any) => r.position <= 10 && r.domain !== domain.domain)
            .slice(0, 10);

          if (topCompetitors.length > 0) {
            try {
              const storedPositions = await ctx.runMutation(internal.keywordSerpJobs.trackCompetitorsBatch, {
                domainId: job.domainId,
                keywordId: keyword._id,
                date: today,
                competitors: topCompetitors.map((c: any) => ({
                  domain: c.domain,
                  position: c.position,
                  url: c.url,
                })),
              });

              // Dual-write competitor positions to Supabase
              if (storedPositions && storedPositions.length > 0) {
                writeCompetitorPositions(storedPositions.map((sp: { competitorId: string; keywordId: string; date: string; position: number; url: string }) => ({
                  convex_competitor_id: sp.competitorId,
                  convex_keyword_id: sp.keywordId,
                  date: sp.date,
                  position: sp.position,
                  url: sp.url,
                }))).catch((err) =>
                  console.error(`[Supabase] keywordSerpJobs competitor write failed: keyword=${keyword._id}:`, err)
                );
              }
            } catch (error) {
              console.error(`[processSerpFetchJob] Error tracking competitors:`, error);
            }
          }

          processedCount++;
        } catch (error) {
          console.error(`[processSerpFetchJob] Error for "${keyword.phrase}":`, error);
          failedCount++;
        }

        // Update progress after each keyword
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

    // Update visibility snapshot from keyword positions (includes recentPositions backfill)
    await ctx.runMutation(internal.keywordSerpJobs.computeVisibilitySnapshot, {
      domainId: job.domainId,
    });

    // Auto-fetch historical visibility data if chart would show too few points
    const historyCount = await ctx.runQuery(internal.keywordSerpJobs.countVisibilityHistory, {
      domainId: job.domainId,
    });
    if (historyCount < 5) {
      const domain = await ctx.runQuery(internal.keywordSerpJobs.getDomainInternal, {
        domainId: job.domainId,
      });
      if (domain) {
        console.log(`[processSerpFetchJob] Only ${historyCount} visibility history entries — auto-fetching DataForSEO history`);
        await ctx.scheduler.runAfter(0, internal.dataforseo.fetchAndStoreVisibilityHistoryInternal, {
          domainId: job.domainId,
          domain: domain.domain,
          location: domain.settings.location,
          language: domain.settings.language,
        });
      }
    }

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

// Helper: classify a position into a bucket name
function classifyPosition(pos: number) {
  if (pos === 1) return "pos_1";
  if (pos <= 3) return "pos_2_3";
  if (pos <= 10) return "pos_4_10";
  if (pos <= 20) return "pos_11_20";
  if (pos <= 30) return "pos_21_30";
  if (pos <= 40) return "pos_31_40";
  if (pos <= 50) return "pos_41_50";
  if (pos <= 60) return "pos_51_60";
  if (pos <= 70) return "pos_61_70";
  if (pos <= 80) return "pos_71_80";
  if (pos <= 90) return "pos_81_90";
  return "pos_91_100";
}

function emptyBuckets() {
  return {
    pos_1: 0, pos_2_3: 0, pos_4_10: 0, pos_11_20: 0,
    pos_21_30: 0, pos_31_40: 0, pos_41_50: 0,
    pos_51_60: 0, pos_61_70: 0, pos_71_80: 0,
    pos_81_90: 0, pos_91_100: 0,
    count: 0,
  };
}

// After SERP job completes, aggregate keyword positions into visibility snapshots
// for the overview chart (domainVisibilityHistory table).
// Also backfills recent days from recentPositions so the chart shows multi-day data.
export const computeVisibilitySnapshot = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    // Build per-date buckets from recentPositions (past days) + currentPosition (today)
    const dateMap = new Map<string, ReturnType<typeof emptyBuckets>>();

    for (const kw of keywords) {
      // Backfill from recentPositions (last ~7 entries with dates)
      if (kw.recentPositions) {
        for (const rp of kw.recentPositions) {
          if (rp.position == null || rp.position <= 0) continue;
          const dateKey = rp.date;
          if (!dateMap.has(dateKey)) dateMap.set(dateKey, emptyBuckets());
          const buckets = dateMap.get(dateKey)!;
          buckets[classifyPosition(rp.position)]++;
          buckets.count++;
        }
      }

      // Today's snapshot from currentPosition (overrides any recentPositions entry for today)
      const pos = kw.currentPosition;
      if (pos != null && pos > 0) {
        if (!dateMap.has(today)) dateMap.set(today, emptyBuckets());
        // recentPositions might already include today — we'll recalculate today's bucket fresh below
      }
    }

    // Recalculate today's bucket fresh from currentPosition (authoritative source)
    const todayBuckets = emptyBuckets();
    for (const kw of keywords) {
      const pos = kw.currentPosition;
      if (pos == null || pos <= 0) continue;
      todayBuckets[classifyPosition(pos)]++;
      todayBuckets.count++;
    }
    if (todayBuckets.count > 0) {
      dateMap.set(today, todayBuckets);
    }

    if (dateMap.size === 0) {
      console.log(`[computeVisibilitySnapshot] No ranking data for domain ${args.domainId}, skipping`);
      return;
    }

    // Upsert each date's snapshot
    let upserted = 0;
    for (const [date, metrics] of dateMap) {
      const existing = await ctx.db
        .query("domainVisibilityHistory")
        .withIndex("by_domain_date", (q) =>
          q.eq("domainId", args.domainId).eq("date", date)
        )
        .unique();

      if (existing) {
        // Only overwrite if this is today (fresh data) or no data existed before
        if (date === today || existing.metrics.count === 0) {
          await ctx.db.patch(existing._id, { metrics, fetchedAt: now });
          upserted++;
        }
      } else {
        await ctx.db.insert("domainVisibilityHistory", {
          domainId: args.domainId,
          date,
          metrics,
          fetchedAt: now,
        });
        upserted++;
      }
    }

    console.log(`[computeVisibilitySnapshot] Stored ${upserted} snapshots (${dateMap.size} dates) for ${args.domainId}`);
  },
});

// Count existing visibility history entries for a domain (used to decide if auto-fetch is needed)
export const countVisibilityHistory = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    return entries.length;
  },
});

// Get domain details for auto-fetch (internal, no auth)
export const getDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.domainId);
  },
});

// Batch mutation: add/update competitors + save positions in one transaction
// Replaces N × (addCompetitorInternal + saveCompetitorPosition) individual calls
// Returns resolved competitor positions for Supabase dual-write
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
  handler: async (ctx, args): Promise<Array<{ competitorId: string; keywordId: string; date: string; position: number; url: string }>> => {
    const results: Array<{ competitorId: string; keywordId: string; date: string; position: number; url: string }> = [];

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

      results.push({
        competitorId,
        keywordId: args.keywordId,
        date: args.date,
        position: comp.position,
        url: comp.url,
      });
    }

    return results;
  },
});
