import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Update the status of a content gap
 */
export const updateGapStatus = mutation({
  args: {
    gapId: v.id("contentGaps"),
    status: v.union(
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("ranking"),
      v.literal("dismissed")
    ),
  },
  handler: async (ctx, args) => {
    const gap = await ctx.db.get(args.gapId);
    if (!gap) {
      throw new Error("Gap not found");
    }

    await ctx.db.patch(args.gapId, {
      status: args.status,
      lastChecked: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update the priority of a content gap (manual override)
 */
export const updateGapPriority = mutation({
  args: {
    gapId: v.id("contentGaps"),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
  },
  handler: async (ctx, args) => {
    const gap = await ctx.db.get(args.gapId);
    if (!gap) {
      throw new Error("Gap not found");
    }

    await ctx.db.patch(args.gapId, {
      priority: args.priority,
      lastChecked: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Dismiss a content gap (mark as not relevant)
 */
export const dismissGap = mutation({
  args: {
    gapId: v.id("contentGaps"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const gap = await ctx.db.get(args.gapId);
    if (!gap) {
      throw new Error("Gap not found");
    }

    await ctx.db.patch(args.gapId, {
      status: "dismissed",
      lastChecked: Date.now(),
    });

    // TODO: Could store dismiss reason in a separate dismissalReasons table if needed

    return { success: true };
  },
});

/**
 * Add multiple gaps to monitoring (bulk action)
 * This changes their status to "monitoring" and optionally adds the keywords to active monitoring
 */
export const addGapsToMonitoring = mutation({
  args: {
    gapIds: v.array(v.id("contentGaps")),
    addToActiveMonitoring: v.optional(v.boolean()), // Also change keyword status to "active"
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let updatedCount = 0;
    let addedToMonitoring = 0;

    for (const gapId of args.gapIds) {
      const gap = await ctx.db.get(gapId);
      if (!gap) {
        continue;
      }

      // Update gap status
      await ctx.db.patch(gapId, {
        status: "monitoring",
        lastChecked: now,
      });
      updatedCount++;

      // Optionally add keyword to active monitoring
      if (args.addToActiveMonitoring) {
        const keyword = await ctx.db.get(gap.keywordId);
        if (keyword && keyword.status !== "active") {
          await ctx.db.patch(gap.keywordId, {
            status: "active",
          });
          addedToMonitoring++;
        }
      }
    }

    return {
      success: true,
      updatedGaps: updatedCount,
      addedToMonitoring,
    };
  },
});

/**
 * Bulk update gap statuses
 */
export const bulkUpdateGapStatus = mutation({
  args: {
    gapIds: v.array(v.id("contentGaps")),
    status: v.union(
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("ranking"),
      v.literal("dismissed")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let updatedCount = 0;

    for (const gapId of args.gapIds) {
      const gap = await ctx.db.get(gapId);
      if (!gap) {
        continue;
      }

      await ctx.db.patch(gapId, {
        status: args.status,
        lastChecked: now,
      });
      updatedCount++;
    }

    return {
      success: true,
      updatedCount,
    };
  },
});

/**
 * Bulk update gap priorities
 */
export const bulkUpdateGapPriority = mutation({
  args: {
    gapIds: v.array(v.id("contentGaps")),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let updatedCount = 0;

    for (const gapId of args.gapIds) {
      const gap = await ctx.db.get(gapId);
      if (!gap) {
        continue;
      }

      await ctx.db.patch(gapId, {
        priority: args.priority,
        lastChecked: now,
      });
      updatedCount++;
    }

    return {
      success: true,
      updatedCount,
    };
  },
});
