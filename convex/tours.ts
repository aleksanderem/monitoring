import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

/**
 * Get progress for a specific tour.
 */
export const getTourProgress = query({
  args: {
    tourId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("tourProgress")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", userId).eq("tourId", args.tourId)
      )
      .first();
  },
});

/**
 * Get all tour progress for the current user.
 */
export const getAllTourProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Get tours not yet completed by the current user.
 */
export const getActiveTours = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const allProgress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return allProgress.filter((p) => !p.isCompleted && !p.dismissedAt);
  },
});

/**
 * Start a tour — creates a progress record if none exists.
 */
export const startTour = mutation({
  args: {
    tourId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("tourProgress")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", userId).eq("tourId", args.tourId)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("tourProgress", {
      userId,
      tourId: args.tourId,
      completedSteps: [],
      isCompleted: false,
      startedAt: Date.now(),
    });
  },
});

/**
 * Mark a single step as complete within a tour.
 */
export const completeStep = mutation({
  args: {
    tourId: v.string(),
    stepId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", userId).eq("tourId", args.tourId)
      )
      .first();

    if (!progress) throw new Error("Tour not started");

    const steps = progress.completedSteps.includes(args.stepId)
      ? progress.completedSteps
      : [...progress.completedSteps, args.stepId];

    await ctx.db.patch(progress._id, { completedSteps: steps });
  },
});

/**
 * Mark a tour as fully completed.
 */
export const completeTour = mutation({
  args: {
    tourId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", userId).eq("tourId", args.tourId)
      )
      .first();

    if (!progress) throw new Error("Tour not started");

    await ctx.db.patch(progress._id, {
      isCompleted: true,
      completedAt: Date.now(),
    });
  },
});

/**
 * Dismiss a tour — user chose not to continue.
 */
export const dismissTour = mutation({
  args: {
    tourId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", userId).eq("tourId", args.tourId)
      )
      .first();

    if (!progress) {
      // Create and immediately dismiss
      await ctx.db.insert("tourProgress", {
        userId,
        tourId: args.tourId,
        completedSteps: [],
        isCompleted: false,
        dismissedAt: Date.now(),
        startedAt: Date.now(),
      });
      return;
    }

    await ctx.db.patch(progress._id, { dismissedAt: Date.now() });
  },
});

/**
 * Reset tour progress (for testing or re-onboarding).
 * If tourId is provided, resets only that tour. Otherwise resets all.
 */
export const resetTourProgress = mutation({
  args: {
    tourId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.tourId) {
      const progress = await ctx.db
        .query("tourProgress")
        .withIndex("by_user_tour", (q) =>
          q.eq("userId", userId).eq("tourId", args.tourId)
        )
        .first();
      if (progress) await ctx.db.delete(progress._id);
    } else {
      const allProgress = await ctx.db
        .query("tourProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const p of allProgress) {
        await ctx.db.delete(p._id);
      }
    }
  },
});
