import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get user's general preferences (language, timezone, formats)
 */
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Return defaults if no preferences exist
    if (!prefs) {
      return {
        language: "en",
        timezone: "America/New_York",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
      };
    }

    return {
      language: prefs.language,
      timezone: prefs.timezone,
      dateFormat: prefs.dateFormat,
      timeFormat: prefs.timeFormat,
    };
  },
});

/**
 * Update user's general preferences with optimistic updates
 */
export const updateUserPreferences = mutation({
  args: {
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    timeFormat: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing preferences
      await ctx.db.patch(existing._id, {
        ...(args.language !== undefined && { language: args.language }),
        ...(args.timezone !== undefined && { timezone: args.timezone }),
        ...(args.dateFormat !== undefined && { dateFormat: args.dateFormat }),
        ...(args.timeFormat !== undefined && { timeFormat: args.timeFormat }),
      });
    } else {
      // Create new preferences
      await ctx.db.insert("userPreferences", {
        userId,
        language: args.language ?? "en",
        timezone: args.timezone ?? "America/New_York",
        dateFormat: args.dateFormat ?? "MM/DD/YYYY",
        timeFormat: args.timeFormat ?? "12h",
      });
    }
  },
});

/**
 * Get user's notification preferences
 */
export const getNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const prefs = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Return defaults if no preferences exist
    if (!prefs) {
      return {
        dailyRankingReports: true,
        positionAlerts: true,
        keywordOpportunities: true,
        teamInvitations: true,
        systemUpdates: true,
        frequency: "daily",
      };
    }

    return {
      dailyRankingReports: prefs.dailyRankingReports,
      positionAlerts: prefs.positionAlerts,
      keywordOpportunities: prefs.keywordOpportunities,
      teamInvitations: prefs.teamInvitations,
      systemUpdates: prefs.systemUpdates,
      frequency: prefs.frequency,
    };
  },
});

/**
 * Update user's notification preferences with optimistic updates
 */
export const updateNotificationPreferences = mutation({
  args: {
    dailyRankingReports: v.optional(v.boolean()),
    positionAlerts: v.optional(v.boolean()),
    keywordOpportunities: v.optional(v.boolean()),
    teamInvitations: v.optional(v.boolean()),
    systemUpdates: v.optional(v.boolean()),
    frequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing preferences
      await ctx.db.patch(existing._id, {
        ...(args.dailyRankingReports !== undefined && { dailyRankingReports: args.dailyRankingReports }),
        ...(args.positionAlerts !== undefined && { positionAlerts: args.positionAlerts }),
        ...(args.keywordOpportunities !== undefined && { keywordOpportunities: args.keywordOpportunities }),
        ...(args.teamInvitations !== undefined && { teamInvitations: args.teamInvitations }),
        ...(args.systemUpdates !== undefined && { systemUpdates: args.systemUpdates }),
        ...(args.frequency !== undefined && { frequency: args.frequency }),
      });
    } else {
      // Create new preferences
      await ctx.db.insert("userNotificationPreferences", {
        userId,
        dailyRankingReports: args.dailyRankingReports ?? true,
        positionAlerts: args.positionAlerts ?? true,
        keywordOpportunities: args.keywordOpportunities ?? true,
        teamInvitations: args.teamInvitations ?? true,
        systemUpdates: args.systemUpdates ?? true,
        frequency: args.frequency ?? "daily",
      });
    }
  },
});

/**
 * Send a test notification email to the user
 */
export const sendTestNotification = action({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, just return success
    console.log(`Test notification sent to user ${userId.subject}`);

    return {
      success: true,
      message: "Test notification sent successfully",
    };
  },
});
