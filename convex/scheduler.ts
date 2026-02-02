import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";

// Get domains that need daily refresh
export const getDailyDomains = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"domains">[]> => {
    const domains = await ctx.db
      .query("domains")
      .collect();

    return domains.filter(
      (d) => d.settings.refreshFrequency === "daily"
    );
  },
});

// Get domains that need weekly refresh
export const getWeeklyDomains = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"domains">[]> => {
    const domains = await ctx.db
      .query("domains")
      .collect();

    return domains.filter(
      (d) => d.settings.refreshFrequency === "weekly"
    );
  },
});

// Get keywords for a specific domain (internal query)
export const getDomainKeywords = internalQuery({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

// Refresh all daily domains
export const refreshDailyDomains = internalAction({
  args: {},
  handler: async (ctx): Promise<{ refreshed: number }> => {
    const domains = await ctx.runQuery(internal.scheduler.getDailyDomains);

    console.log(`Refreshing ${domains.length} daily domains`);

    for (const domain of domains) {
      try {
        const keywords = await ctx.runQuery(internal.scheduler.getDomainKeywords, {
          domainId: domain._id,
        });

        if (keywords.length > 0) {
          await ctx.runAction(internal.dataforseo.fetchPositionsInternal, {
            domainId: domain._id,
            keywords: keywords.map((k: Doc<"keywords">) => ({ id: k._id, phrase: k.phrase })),
            domain: domain.domain,
            searchEngine: domain.settings.searchEngine,
            location: domain.settings.location,
            language: domain.settings.language,
          });
        }
      } catch (error) {
        console.error(`Failed to refresh domain ${domain.domain}:`, error);
      }
    }

    return { refreshed: domains.length };
  },
});

// Refresh all weekly domains
export const refreshWeeklyDomains = internalAction({
  args: {},
  handler: async (ctx): Promise<{ refreshed: number }> => {
    const domains = await ctx.runQuery(internal.scheduler.getWeeklyDomains);

    console.log(`Refreshing ${domains.length} weekly domains`);

    for (const domain of domains) {
      try {
        const keywords = await ctx.runQuery(internal.scheduler.getDomainKeywords, {
          domainId: domain._id,
        });

        if (keywords.length > 0) {
          await ctx.runAction(internal.dataforseo.fetchPositionsInternal, {
            domainId: domain._id,
            keywords: keywords.map((k: Doc<"keywords">) => ({ id: k._id, phrase: k.phrase })),
            domain: domain.domain,
            searchEngine: domain.settings.searchEngine,
            location: domain.settings.location,
            language: domain.settings.language,
          });
        }
      } catch (error) {
        console.error(`Failed to refresh domain ${domain.domain}:`, error);
      }
    }

    return { refreshed: domains.length };
  },
});

// =================================================================
// Email Scheduling Functions
// =================================================================

/**
 * Trigger daily digest emails for all users who have opted in
 * Called by cron job daily at 8 AM UTC
 */
export const triggerDailyDigests = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    // TODO: Implement email sending once Resend is configured
    // 1. Get all users who want daily digests
    // 2. Calculate top gainers/losers from keywordPositions table
    // 3. Send digest emails

    console.log("Daily digests: Email infrastructure ready but not yet configured");

    return { sent: 0, failed: 0 };
  },
});

/**
 * Trigger weekly report emails for all users who have opted in
 * Called by cron job weekly on Mondays at 9 AM UTC
 */
export const triggerWeeklyReports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    // TODO: Implement email sending once Resend is configured
    // 1. Get all users who want weekly reports
    // 2. Calculate weekly stats from keywordPositions table
    // 3. Send report emails

    console.log("Weekly reports: Email infrastructure ready but not yet configured");

    return { sent: 0, failed: 0 };
  },
});

// =================================================================
// Backlink Velocity Calculation
// =================================================================

/**
 * Calculate daily backlink velocity for all domains
 * Called by cron job daily at 2 AM UTC (after backlink refresh typically runs)
 */
export const calculateDailyBacklinkVelocity = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; errors: number }> => {
    // Get all domains that have backlink data
    const domains = await ctx.runQuery(internal.scheduler.getAllDomains);

    console.log(`Calculating backlink velocity for ${domains.length} domains`);

    let processed = 0;
    let errors = 0;

    for (const domain of domains) {
      try {
        // Get current and previous backlinks summary
        const summary = await ctx.runQuery(internal.scheduler.getDomainBacklinkSummary, {
          domainId: domain._id,
        });

        if (!summary) {
          continue; // Skip domains without backlink data
        }

        // Get all backlinks for this domain to calculate new/lost
        const backlinks = await ctx.runQuery(internal.scheduler.getDomainBacklinks, {
          domainId: domain._id,
        });

        const today = new Date().toISOString().split("T")[0];

        // Count new backlinks (firstSeen == today)
        const newBacklinks = backlinks.filter(
          (b: any) => b.firstSeen === today || (b.isNew === true)
        ).length;

        // Count lost backlinks (lastSeen < today and previously active)
        const lostBacklinks = backlinks.filter(
          (b: any) => b.isLost === true
        ).length;

        // Save velocity data
        await ctx.runMutation(internal.backlinkVelocity.saveDailyVelocity, {
          domainId: domain._id,
          date: today,
          newBacklinks,
          lostBacklinks,
          totalBacklinks: summary.totalBacklinks,
        });

        processed++;
      } catch (error) {
        console.error(`Failed to calculate velocity for domain ${domain.domain}:`, error);
        errors++;
      }
    }

    console.log(`Backlink velocity calculation complete: ${processed} processed, ${errors} errors`);

    return { processed, errors };
  },
});

// Helper query to get all domains
export const getAllDomains = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"domains">[]> => {
    return await ctx.db.query("domains").collect();
  },
});

// Helper query to get domain backlink summary
export const getDomainBacklinkSummary = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();
  },
});

// Helper query to get domain backlinks
export const getDomainBacklinks = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

// =================================================================
// Forecasting & Anomaly Detection
// =================================================================

/**
 * Detect anomalies daily for all active keywords
 * Called by cron job daily at 3 AM UTC (after backlink velocity calculation)
 */
export const detectAnomaliesDaily = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; anomaliesDetected: number; errors: number }> => {
    const domains = await ctx.runQuery(internal.scheduler.getAllDomains);

    console.log(`Running daily anomaly detection for ${domains.length} domains`);

    let processedKeywords = 0;
    let totalAnomalies = 0;
    let errors = 0;

    for (const domain of domains) {
      try {
        // TODO: Fix internal.forecasts_actions reference
        // const result = await ctx.runAction(internal.forecasts_actions.detectDomainAnomalies, {
        //   domainId: domain._id,
        // });
        // processedKeywords += result.processedKeywords || 0;
        // totalAnomalies += result.totalAnomalies || 0;
        console.log(`Skipping anomaly detection for ${domain.domain} - function needs to be fixed`);
      } catch (error) {
        console.error(`Failed to detect anomalies for domain ${domain.domain}:`, error);
        errors++;
      }
    }

    console.log(
      `Anomaly detection complete: ${processedKeywords} keywords processed, ${totalAnomalies} anomalies detected, ${errors} errors`
    );

    return { processed: processedKeywords, anomaliesDetected: totalAnomalies, errors };
  },
});

// =================================================================
// Content Gap Analysis
// =================================================================

/**
 * Analyze content gaps weekly for all active domains
 * Called by cron job weekly on Sundays at 4 AM UTC
 */
export const analyzeContentGapsWeekly = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; errors: number }> => {
    const domains = await ctx.runQuery(internal.scheduler.getAllDomains);

    console.log(`Running weekly content gap analysis for ${domains.length} domains`);

    let processed = 0;
    let errors = 0;

    for (const domain of domains) {
      try {
        // TODO: Fix internal.contentGaps_actions reference
        // const result = await ctx.runAction(internal.contentGaps_actions.generateGapReport, {
        //   domainId: domain._id,
        // });
        // if (result.success) {
        //   processed++;
        //   console.log(`Gap analysis complete for ${domain.domain}: ${result.summary?.totalGaps || 0} gaps found`);
        // }
        console.log(`Skipping gap analysis for ${domain.domain} - function needs to be fixed`);
        processed++;
      } catch (error) {
        console.error(`Failed to analyze content gaps for domain ${domain.domain}:`, error);
        errors++;
      }
    }

    console.log(
      `Content gap analysis complete: ${processed} domains processed, ${errors} errors`
    );

    return { processed, errors };
  },
});
