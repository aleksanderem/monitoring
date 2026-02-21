import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
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
 * Mark domain onboarding as completed
 */
export const completeOnboarding = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.domainId, { onboardingCompleted: true });
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
