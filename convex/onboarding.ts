import { v } from "convex/values";
import { query, mutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

// =================================================================
// User-Level Onboarding (App Welcome Flow — R14)
// =================================================================

/**
 * Get the current user's onboarding status (whether they've completed
 * the first-time welcome flow).
 */
export const getUserOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const status = await ctx.db
      .query("userOnboardingStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return {
      hasCompletedOnboarding: status?.hasCompletedOnboarding ?? false,
      userId,
    };
  },
});

/**
 * Mark the current user's onboarding as complete.
 */
export const completeUserOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userOnboardingStatus")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        hasCompletedOnboarding: true,
        completedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userOnboardingStatus", {
        userId,
        hasCompletedOnboarding: true,
        completedAt: Date.now(),
      });
    }
  },
});

// =================================================================
// Domain-Level Onboarding (DomainSetupWizard)
// =================================================================

/**
 * Get computed onboarding status for a domain.
 * Steps are derived from actual data, so this works
 * for both new domains (wizard) and legacy domains (checklist).
 */
export const getOnboardingStatus = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return null;

    // Count discovered keywords
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "discovered")
      )
      .collect();

    // Count active monitored keywords
    const allKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const activeKeywords = allKeywords.filter((k) => k.status === "active");

    // Check if any SERP results exist (from any keyword for this domain)
    const serpResult = await ctx.db
      .query("keywordSerpResults")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    // Count active competitors
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) =>
        q.eq("domainId", args.domainId).eq("status", "active")
      )
      .collect();

    // Check if any content gap analysis completed
    const completedGapJob = await ctx.db
      .query("competitorContentGapJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .first();

    // Count content gaps found
    const contentGaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const steps = {
      businessContextSet: !!(domain.businessDescription && domain.targetCustomer),
      keywordsDiscovered: discoveredKeywords.length > 0 || activeKeywords.length > 0,
      keywordsMonitored: activeKeywords.length > 0,
      serpChecked: serpResult !== null,
      competitorsAdded: competitors.length > 0,
      analysisComplete: completedGapJob !== null,
    };

    return {
      isCompleted: domain.onboardingCompleted === true,
      isDismissed: domain.onboardingDismissed === true,
      steps,
      counts: {
        discoveredKeywords: discoveredKeywords.length,
        monitoredKeywords: activeKeywords.length,
        activeCompetitors: competitors.length,
        contentGaps: contentGaps.length,
      },
    };
  },
});

/**
 * Mark domain onboarding as completed and schedule post-onboarding jobs
 * (backlink fetch + on-site scan) if the org's plan includes those modules.
 */
export const completeOnboarding = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.domainId, { onboardingCompleted: true });

    // Schedule post-onboarding jobs (backlinks, on-site scan) in the background
    await ctx.scheduler.runAfter(0, internal.onboarding.postOnboardingJobs, {
      domainId: args.domainId,
    });
  },
});

/**
 * Internal action that runs after onboarding completion.
 * Checks org plan modules and triggers backlink fetch + on-site scan if included.
 */
export const postOnboardingJobs = internalAction({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get domain → project → org → plan modules
    const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
      domainId: args.domainId,
    });
    if (!domain) return;

    const orgId = await ctx.runQuery(internal.permissions.getOrgFromProjectInternal, {
      projectId: domain.projectId,
    });
    if (!orgId) return;

    const modules = await ctx.runQuery(internal.permissions.getOrganizationModulesInternal, {
      organizationId: orgId,
    });

    // Auto-fetch backlinks if plan includes backlinks module
    if (modules.includes("backlinks")) {
      try {
        await ctx.runAction(internal.backlinks.fetchBacklinksInternal, {
          domainId: args.domainId,
        });
      } catch (error) {
        console.error("[postOnboardingJobs] Failed to auto-fetch backlinks:", error);
      }
    }

    // Auto-trigger on-site scan if plan includes seo_audit module
    if (modules.includes("seo_audit")) {
      try {
        await ctx.runMutation(internal.seoAudit_actions.triggerSeoAuditScanInternal, {
          domainId: args.domainId,
        });
      } catch (error) {
        console.error("[postOnboardingJobs] Failed to auto-trigger on-site scan:", error);
      }
    }
  },
});

/**
 * Dismiss the onboarding checklist banner
 */
export const dismissOnboarding = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.domainId, { onboardingDismissed: true });
  },
});
