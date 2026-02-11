import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate and store a forecast for an entity (keyword or domain)
 */
export const generateForecast = mutation({
  args: {
    entityType: v.union(v.literal("keyword"), v.literal("domain")),
    entityId: v.string(),
    metric: v.string(),
    predictions: v.array(v.object({
      date: v.string(),
      value: v.number(),
      confidenceLower: v.number(),
      confidenceUpper: v.number(),
    })),
    accuracy: v.object({
      r2: v.number(),
      rmse: v.number(),
      confidenceLevel: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const { entityType, entityId, metric, predictions, accuracy } = args;

    // Delete any existing forecast for this entity + metric
    const existingForecast = await ctx.db
      .query("forecasts")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", entityType).eq("entityId", entityId).eq("metric", metric)
      )
      .first();

    if (existingForecast) {
      await ctx.db.delete(existingForecast._id);
    }

    // Insert new forecast
    const forecastId = await ctx.db.insert("forecasts", {
      entityType,
      entityId,
      metric,
      generatedAt: Date.now(),
      predictions,
      accuracy,
    });

    return forecastId;
  },
});

/**
 * Mark an anomaly as resolved
 */
export const resolveAnomaly = mutation({
  args: {
    anomalyId: v.id("anomalies"),
  },
  handler: async (ctx, args) => {
    const { anomalyId } = args;

    await ctx.db.patch(anomalyId, {
      resolved: true,
    });

    return { success: true };
  },
});

/**
 * Create a new anomaly detection
 */
export const createAnomaly = mutation({
  args: {
    entityType: v.union(v.literal("keyword"), v.literal("domain")),
    entityId: v.string(),
    metric: v.string(),
    date: v.string(),
    type: v.union(v.literal("spike"), v.literal("drop"), v.literal("pattern_change")),
    severity: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    value: v.number(),
    expectedValue: v.number(),
    zScore: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const {
      entityType,
      entityId,
      metric,
      date,
      type,
      severity,
      value,
      expectedValue,
      zScore,
      description,
    } = args;

    // Check if anomaly already exists for this entity + metric + date
    const existing = await ctx.db
      .query("anomalies")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", entityType).eq("entityId", entityId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("metric"), metric),
          q.eq(q.field("date"), date)
        )
      )
      .first();

    if (existing) {
      // Update existing anomaly
      await ctx.db.patch(existing._id, {
        type,
        severity,
        value,
        expectedValue,
        zScore,
        description,
        detectedAt: Date.now(),
      });
      return existing._id;
    }

    // Insert new anomaly
    const anomalyId = await ctx.db.insert("anomalies", {
      entityType,
      entityId,
      metric,
      detectedAt: Date.now(),
      date,
      type,
      severity,
      value,
      expectedValue,
      zScore,
      description,
      resolved: false,
    });

    return anomalyId;
  },
});
