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
