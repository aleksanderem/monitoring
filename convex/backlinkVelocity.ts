import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// Get velocity history for a domain (last N days)
export const getVelocityHistory = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()), // Default: 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const history = await ctx.db
      .query("backlinkVelocityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Filter by date and sort
    return history
      .filter((h) => h.date >= cutoffDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

// Get velocity statistics (averages, trends)
export const getVelocityStats = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()), // Period to calculate stats for (default: 30)
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const history = await ctx.runQuery(ctx.functionName.split(":")[0] + ":getVelocityHistory", {
      domainId: args.domainId,
      days,
    });

    if (history.length === 0) {
      return {
        avgNewPerDay: 0,
        avgLostPerDay: 0,
        avgNetChange: 0,
        totalNew: 0,
        totalLost: 0,
        netChange: 0,
        daysTracked: 0,
      };
    }

    const totalNew = history.reduce((sum, h) => sum + h.newBacklinks, 0);
    const totalLost = history.reduce((sum, h) => sum + h.lostBacklinks, 0);
    const daysTracked = history.length;

    return {
      avgNewPerDay: totalNew / daysTracked,
      avgLostPerDay: totalLost / daysTracked,
      avgNetChange: (totalNew - totalLost) / daysTracked,
      totalNew,
      totalLost,
      netChange: totalNew - totalLost,
      daysTracked,
    };
  },
});

// Detect velocity anomalies (spikes/drops > 2 standard deviations)
export const detectVelocityAnomalies = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()), // Period to analyze (default: 30)
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const history = await ctx.runQuery(ctx.functionName.split(":")[0] + ":getVelocityHistory", {
      domainId: args.domainId,
      days,
    });

    if (history.length < 3) {
      return []; // Need at least 3 data points to detect anomalies
    }

    // Calculate mean and standard deviation of net change
    const netChanges = history.map((h) => h.netChange);
    const mean = netChanges.reduce((sum, val) => sum + val, 0) / netChanges.length;
    const variance =
      netChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      netChanges.length;
    const stdDev = Math.sqrt(variance);

    const threshold = 2; // 2 standard deviations

    // Find anomalies
    const anomalies = history
      .map((h) => {
        const zScore = stdDev === 0 ? 0 : (h.netChange - mean) / stdDev;
        const isAnomaly = Math.abs(zScore) > threshold;

        if (!isAnomaly) return null;

        return {
          date: h.date,
          newBacklinks: h.newBacklinks,
          lostBacklinks: h.lostBacklinks,
          netChange: h.netChange,
          zScore,
          type: zScore > 0 ? ("spike" as const) : ("drop" as const),
          severity:
            Math.abs(zScore) > 3
              ? ("high" as const)
              : Math.abs(zScore) > 2.5
                ? ("medium" as const)
                : ("low" as const),
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    return anomalies;
  },
});

// Internal mutation to save daily velocity calculation
export const saveDailyVelocity = internalMutation({
  args: {
    domainId: v.id("domains"),
    date: v.string(), // YYYY-MM-DD
    newBacklinks: v.number(),
    lostBacklinks: v.number(),
    totalBacklinks: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists for this date
    const existing = await ctx.db
      .query("backlinkVelocityHistory")
      .withIndex("by_domain_date", (q) =>
        q.eq("domainId", args.domainId).eq("date", args.date)
      )
      .unique();

    const netChange = args.newBacklinks - args.lostBacklinks;

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        newBacklinks: args.newBacklinks,
        lostBacklinks: args.lostBacklinks,
        netChange,
        totalBacklinks: args.totalBacklinks,
        createdAt: Date.now(),
      });
      return { updated: true };
    } else {
      // Insert new entry
      await ctx.db.insert("backlinkVelocityHistory", {
        domainId: args.domainId,
        date: args.date,
        newBacklinks: args.newBacklinks,
        lostBacklinks: args.lostBacklinks,
        netChange,
        totalBacklinks: args.totalBacklinks,
        createdAt: Date.now(),
      });
      return { created: true };
    }
  },
});
