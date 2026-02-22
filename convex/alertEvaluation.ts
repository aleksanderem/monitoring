import { v } from "convex/values";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  evaluatePositionDrop,
  evaluateTopNExit,
  evaluateNewCompetitor,
  evaluateBacklinkLost,
  evaluateVisibilityDrop,
  type AlertTrigger,
} from "./alertEvaluators";

// =================================================================
// Internal Queries (data fetchers for evaluators)
// =================================================================

/**
 * Get all active alert rules for a domain
 */
export const getActiveRulesForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alertRules")
      .withIndex("by_domain_active", (q) =>
        q.eq("domainId", args.domainId).eq("isActive", true)
      )
      .collect();
  },
});

/**
 * Get all active keywords for a domain (with position data)
 */
export const getKeywordsForEvaluation = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

/**
 * Get latest backlink velocity entry for a domain
 */
export const getLatestBacklinkVelocity = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("backlinkVelocityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

/**
 * Get last 2 visibility history entries for a domain
 */
export const getRecentVisibilityHistory = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(2);
  },
});

/**
 * Get unique domains from today's SERP results (top 10 positions only)
 */
export const getSerpDomainsForDate = internalQuery({
  args: { domainId: v.id("domains"), date: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("keywordSerpResults")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) =>
        q.and(
          q.eq(q.field("date"), args.date),
          q.lte(q.field("position"), 10)
        )
      )
      .collect();

    const domains = new Set<string>();
    for (const r of results) {
      if (r.domain) domains.add(r.domain);
    }
    return Array.from(domains);
  },
});

/**
 * Get all domains that have at least one active alert rule
 */
export const getDomainsWithActiveRules = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allRules = await ctx.db
      .query("alertRules")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Unique domain IDs
    const domainIds = new Set<string>();
    for (const rule of allRules) {
      domainIds.add(rule.domainId);
    }

    const domains: Doc<"domains">[] = [];
    for (const id of domainIds) {
      const domain = await ctx.db.get(id as Id<"domains">);
      if (domain) domains.push(domain);
    }

    return domains;
  },
});

// =================================================================
// Alert Event Creation + Notification
// =================================================================

/**
 * Create alert event, send in-app notification to team members.
 * Handles cooldown check: returns false if within cooldown period.
 */
export const createAlertEventAndNotify = internalMutation({
  args: {
    ruleId: v.id("alertRules"),
    domainId: v.id("domains"),
    ruleType: v.string(),
    ruleName: v.string(),
    notifyVia: v.optional(v.array(v.union(v.literal("in_app"), v.literal("email")))),
    topN: v.optional(v.number()),
    data: v.object({
      keywordId: v.optional(v.id("keywords")),
      keywordPhrase: v.optional(v.string()),
      previousValue: v.optional(v.number()),
      currentValue: v.optional(v.number()),
      competitorDomain: v.optional(v.string()),
      details: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const channels = args.notifyVia ?? ["in_app"];

    // Create the event
    await ctx.db.insert("alertEvents", {
      ruleId: args.ruleId,
      domainId: args.domainId,
      ruleType: args.ruleType,
      triggeredAt: now,
      data: args.data,
      status: "active",
    });

    // Update rule's lastTriggeredAt
    await ctx.db.patch(args.ruleId, { lastTriggeredAt: now });

    // Get domain + project for notification context
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return;

    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .collect();

    // Send in-app notifications
    if (channels.includes("in_app")) {
      for (const member of teamMembers) {
        await ctx.db.insert("notifications", {
          userId: member.userId,
          domainId: args.domainId,
          type: "warning",
          title: `Alert: ${args.ruleName}`,
          message: args.data.details ?? `Alert rule "${args.ruleName}" triggered for ${domain.domain}`,
          isRead: false,
          createdAt: now,
          domainName: domain.domain,
        });
      }
    }

    // Send email notifications
    if (channels.includes("email")) {
      // Collect team member emails (with positionAlerts pref check)
      const emailRecipients: string[] = [];
      for (const member of teamMembers) {
        const user = await ctx.db.get(member.userId);
        if (!user || !(user as any).email) continue;

        const prefs = await ctx.db
          .query("userNotificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", member.userId))
          .unique();

        // Default to sending if no prefs or positionAlerts not explicitly false
        if (!prefs || prefs.positionAlerts !== false) {
          emailRecipients.push((user as any).email);
        }
      }

      // Schedule the appropriate email action per ruleType
      for (const email of emailRecipients) {
        switch (args.ruleType) {
          case "position_drop":
            if (args.data.keywordPhrase && args.data.previousValue != null && args.data.currentValue != null) {
              await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendPositionDropAlert, {
                to: email,
                domainName: domain.domain,
                keywordPhrase: args.data.keywordPhrase,
                previousPosition: args.data.previousValue,
                currentPosition: args.data.currentValue,
              });
            }
            break;
          case "top_n_exit":
            if (args.data.keywordPhrase && args.data.previousValue != null && args.data.currentValue != null) {
              await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendTopNExitAlert, {
                to: email,
                domainName: domain.domain,
                keywordPhrase: args.data.keywordPhrase,
                previousPosition: args.data.previousValue,
                currentPosition: args.data.currentValue,
                topN: args.topN ?? 10,
              });
            }
            break;
          case "new_competitor":
            if (args.data.competitorDomain) {
              await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendNewCompetitorAlert, {
                to: email,
                domainName: domain.domain,
                competitorDomain: args.data.competitorDomain,
              });
            }
            break;
          case "backlink_lost":
            if (args.data.currentValue != null) {
              await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendBacklinkLostAlert, {
                to: email,
                domainName: domain.domain,
                lostCount: Math.abs(args.data.currentValue),
              });
            }
            break;
          case "visibility_drop":
            if (args.data.previousValue != null && args.data.currentValue != null) {
              await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendVisibilityDropAlert, {
                to: email,
                domainName: domain.domain,
                previousValue: args.data.previousValue,
                currentValue: args.data.currentValue,
              });
            }
            break;
        }
      }
    }
  },
});

// =================================================================
// Main Evaluation Engine
// =================================================================

/**
 * Evaluate all active alert rules across all domains.
 * Called by daily cron job.
 */
export const evaluateAlertRules = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    domainsProcessed: number;
    alertsFired: number;
    errors: number;
  }> => {
    const domains = await ctx.runQuery(
      internal.alertEvaluation.getDomainsWithActiveRules
    );

    console.log(`[AlertEval] Evaluating alert rules for ${domains.length} domains`);

    let alertsFired = 0;
    let errors = 0;

    for (const domain of domains) {
      try {
        const rules = await ctx.runQuery(
          internal.alertEvaluation.getActiveRulesForDomain,
          { domainId: domain._id }
        );

        for (const rule of rules) {
          try {
            // Check cooldown
            if (rule.lastTriggeredAt) {
              const cooldownMs = rule.cooldownMinutes * 60 * 1000;
              if (Date.now() - rule.lastTriggeredAt < cooldownMs) {
                continue; // Skip — still within cooldown
              }
            }

            const triggers = await evaluateRule(ctx, rule, domain);

            // Fire alert for the first trigger only (to avoid spam)
            if (triggers.length > 0) {
              const trigger = triggers[0];
              const details =
                triggers.length > 1
                  ? `${trigger.details} (and ${triggers.length - 1} more)`
                  : trigger.details;

              await ctx.runMutation(
                internal.alertEvaluation.createAlertEventAndNotify,
                {
                  ruleId: rule._id,
                  domainId: domain._id,
                  ruleType: rule.ruleType,
                  ruleName: rule.name,
                  notifyVia: rule.notifyVia,
                  topN: rule.topN,
                  data: {
                    keywordId: trigger.keywordId,
                    keywordPhrase: trigger.keywordPhrase,
                    previousValue: trigger.previousValue,
                    currentValue: trigger.currentValue,
                    competitorDomain: trigger.competitorDomain,
                    details,
                  },
                }
              );
              alertsFired++;
            }
          } catch (err) {
            console.error(
              `[AlertEval] Error evaluating rule ${rule.name} for ${domain.domain}:`,
              err
            );
            errors++;
          }
        }
      } catch (err) {
        console.error(
          `[AlertEval] Error processing domain ${domain.domain}:`,
          err
        );
        errors++;
      }
    }

    console.log(
      `[AlertEval] Done: ${domains.length} domains, ${alertsFired} alerts fired, ${errors} errors`
    );

    return {
      domainsProcessed: domains.length,
      alertsFired,
      errors,
    };
  },
});

/**
 * Evaluate a single rule against current data
 */
async function evaluateRule(
  ctx: any,
  rule: Doc<"alertRules">,
  domain: Doc<"domains">
): Promise<AlertTrigger[]> {
  switch (rule.ruleType) {
    case "position_drop": {
      const keywords = await ctx.runQuery(
        internal.alertEvaluation.getKeywordsForEvaluation,
        { domainId: domain._id }
      );
      return evaluatePositionDrop(rule, keywords);
    }

    case "top_n_exit": {
      const keywords = await ctx.runQuery(
        internal.alertEvaluation.getKeywordsForEvaluation,
        { domainId: domain._id }
      );
      return evaluateTopNExit(rule, keywords);
    }

    case "new_competitor": {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];

      const [todayDomains, yesterdayDomains] = await Promise.all([
        ctx.runQuery(internal.alertEvaluation.getSerpDomainsForDate, {
          domainId: domain._id,
          date: today,
        }),
        ctx.runQuery(internal.alertEvaluation.getSerpDomainsForDate, {
          domainId: domain._id,
          date: yesterday,
        }),
      ]);

      return evaluateNewCompetitor(
        rule,
        new Set(todayDomains),
        new Set(yesterdayDomains),
        domain.domain
      );
    }

    case "backlink_lost": {
      const velocity = await ctx.runQuery(
        internal.alertEvaluation.getLatestBacklinkVelocity,
        { domainId: domain._id }
      );
      const trigger = evaluateBacklinkLost(rule, velocity);
      return trigger ? [trigger] : [];
    }

    case "visibility_drop": {
      const history = await ctx.runQuery(
        internal.alertEvaluation.getRecentVisibilityHistory,
        { domainId: domain._id }
      );
      if (history.length < 2) return [];
      const trigger = evaluateVisibilityDrop(
        rule,
        history[0].metrics,
        history[1].metrics
      );
      return trigger ? [trigger] : [];
    }

    default:
      return [];
  }
}
