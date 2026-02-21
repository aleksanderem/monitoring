import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
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

// Shared refresh logic — sequential because of external API rate limits
async function refreshDomains(
  ctx: any,
  domains: Doc<"domains">[],
  label: string,
): Promise<{ refreshed: number }> {
  console.log(`Refreshing ${domains.length} ${label} domains`);

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
}

// Refresh all daily domains
export const refreshDailyDomains = internalAction({
  args: {},
  handler: async (ctx): Promise<{ refreshed: number }> => {
    const domains = await ctx.runQuery(internal.scheduler.getDailyDomains);
    return refreshDomains(ctx, domains, "daily");
  },
});

// Refresh all weekly domains
export const refreshWeeklyDomains = internalAction({
  args: {},
  handler: async (ctx): Promise<{ refreshed: number }> => {
    const domains = await ctx.runQuery(internal.scheduler.getWeeklyDomains);
    return refreshDomains(ctx, domains, "weekly");
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
    const orgsWithDomains = await ctx.runQuery(
      internal.digestQueries.getActiveOrgsWithDomains
    );

    let sent = 0;
    let failed = 0;

    for (const { members, domains } of orgsWithDomains) {
      // Filter members who opted in to daily ranking reports
      const optedIn = members.filter(
        (m) => m.prefs?.dailyRankingReports === true && m.email
      );
      if (optedIn.length === 0) continue;

      for (const domain of domains) {
        const digestData = await ctx.runQuery(
          internal.digestQueries.getDailyDigestData,
          { domainId: domain._id }
        );
        if (digestData.totalKeywords === 0) continue;

        for (const member of optedIn) {
          const subject = `[doseo] Codzienny raport: ${domain.domain}`;
          try {
            await ctx.runAction(
              internal.actions.sendEmail.sendDailyDigest,
              {
                to: member.email,
                userName: member.name || "Użytkowniku",
                domainName: domain.domain,
                totalKeywords: digestData.totalKeywords,
                avgPosition: digestData.avgPosition ?? undefined,
                gainers: digestData.gainers,
                losers: digestData.losers,
              }
            );
            await ctx.runMutation(internal.scheduler.logNotification, {
              type: "email",
              recipient: member.email,
              subject,
              status: "sent",
            });
            sent++;
          } catch (error: any) {
            console.error(
              `[daily-digest] Failed to send to ${member.email} for ${domain.domain}:`,
              error
            );
            await ctx.runMutation(internal.scheduler.logNotification, {
              type: "email",
              recipient: member.email,
              subject,
              status: "failed",
              error: error?.message ?? String(error),
            });
            failed++;
          }
        }
      }
    }

    console.log(`Daily digests complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  },
});

/**
 * Trigger weekly report emails for all users who have opted in
 * Called by cron job weekly on Mondays at 9 AM UTC
 */
export const triggerWeeklyReports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    const orgsWithDomains = await ctx.runQuery(
      internal.digestQueries.getActiveOrgsWithDomains
    );

    let sent = 0;
    let failed = 0;

    for (const { members, domains } of orgsWithDomains) {
      // Weekly report goes to users with frequency=weekly OR dailyRankingReports=true
      const optedIn = members.filter(
        (m) =>
          (m.prefs?.frequency === "weekly" ||
            m.prefs?.dailyRankingReports === true) &&
          m.email
      );
      if (optedIn.length === 0) continue;

      for (const domain of domains) {
        const reportData = await ctx.runQuery(
          internal.digestQueries.getWeeklyReportData,
          { domainId: domain._id }
        );
        if (reportData.totalKeywords === 0) continue;

        for (const member of optedIn) {
          const subject = `[doseo] Tygodniowy raport: ${domain.domain}`;
          try {
            await ctx.runAction(
              internal.actions.sendEmail.sendWeeklyReport,
              {
                to: member.email,
                userName: member.name || "Użytkowniku",
                domainName: domain.domain,
                totalKeywords: reportData.totalKeywords,
                top3: reportData.top3,
                top10: reportData.top10,
                top20: reportData.top20,
                top50: reportData.top50,
                improved: reportData.improved,
                declined: reportData.declined,
                stable: reportData.stable,
              }
            );
            await ctx.runMutation(internal.scheduler.logNotification, {
              type: "email",
              recipient: member.email,
              subject,
              status: "sent",
            });
            sent++;
          } catch (error: any) {
            console.error(
              `[weekly-report] Failed to send to ${member.email} for ${domain.domain}:`,
              error
            );
            await ctx.runMutation(internal.scheduler.logNotification, {
              type: "email",
              recipient: member.email,
              subject,
              status: "failed",
              error: error?.message ?? String(error),
            });
            failed++;
          }
        }
      }
    }

    console.log(`Weekly reports complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  },
});

// ─── Notification logging ───────────────────────────────

export const logNotification = internalMutation({
  args: {
    type: v.union(v.literal("email"), v.literal("system")),
    recipient: v.string(),
    subject: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("pending")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLogs", {
      type: args.type,
      recipient: args.recipient,
      subject: args.subject,
      status: args.status,
      error: args.error,
      createdAt: Date.now(),
    });
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

    const today = new Date().toISOString().split("T")[0];

    for (const domain of domains) {
      try {
        // Parallelize the 2 independent queries per domain
        const [summary, backlinks] = await Promise.all([
          ctx.runQuery(internal.scheduler.getDomainBacklinkSummary, {
            domainId: domain._id,
          }),
          ctx.runQuery(internal.scheduler.getDomainBacklinks, {
            domainId: domain._id,
          }),
        ]);

        if (!summary) {
          continue; // Skip domains without backlink data
        }

        // Count new backlinks: only those first seen today (not the permanent isNew flag)
        const newBacklinks = backlinks.filter(
          (b: any) => b.firstSeen === today
        ).length;

        // Count lost backlinks: only those whose lastSeen is yesterday (newly lost today)
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const lostBacklinks = backlinks.filter(
          (b: any) => b.isLost === true && b.lastSeen === yesterday
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
