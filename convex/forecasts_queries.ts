import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the latest forecast for an entity (keyword or domain) and metric
 */
export const getForecast = query({
  args: {
    entityType: v.union(v.literal("keyword"), v.literal("domain")),
    entityId: v.string(),
    metric: v.string(),
  },
  handler: async (ctx, args) => {
    const { entityType, entityId, metric } = args;

    // Get the most recent forecast for this entity + metric
    const forecast = await ctx.db
      .query("forecasts")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", entityType).eq("entityId", entityId).eq("metric", metric)
      )
      .order("desc")
      .first();

    return forecast;
  },
});

/**
 * Get anomalies for a domain with optional filtering
 */
export const getAnomalies = query({
  args: {
    domainId: v.string(),
    severity: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    resolved: v.optional(v.boolean()),
    entityType: v.optional(v.union(v.literal("keyword"), v.literal("domain"))),
  },
  handler: async (ctx, args) => {
    const { domainId, severity, resolved, entityType } = args;

    // Get all anomalies for this domain
    let anomalies = await ctx.db
      .query("anomalies")
      .collect();

    // Filter by domain (check if entityId matches domainId or if it's a keyword belonging to this domain)
    anomalies = anomalies.filter((anomaly) => {
      if (anomaly.entityType === "domain" && anomaly.entityId === domainId) {
        return true;
      }
      // For keywords, we'd need to check if the keyword belongs to this domain
      // This will be resolved when we have the keyword data
      return false;
    });

    // Apply filters
    if (severity !== undefined) {
      anomalies = anomalies.filter((a) => a.severity === severity);
    }

    if (resolved !== undefined) {
      anomalies = anomalies.filter((a) => a.resolved === resolved);
    }

    if (entityType !== undefined) {
      anomalies = anomalies.filter((a) => a.entityType === entityType);
    }

    // Sort by detection time (most recent first)
    anomalies.sort((a, b) => b.detectedAt - a.detectedAt);

    return anomalies;
  },
});

/**
 * Get anomaly summary (count by severity) for a domain
 */
export const getAnomalySummary = query({
  args: {
    domainId: v.string(),
  },
  handler: async (ctx, args) => {
    const { domainId } = args;

    // Get all unresolved anomalies for this domain
    let anomalies = await ctx.db
      .query("anomalies")
      .collect();

    // Filter by domain and unresolved
    anomalies = anomalies.filter((anomaly) => {
      const belongsToDomain =
        (anomaly.entityType === "domain" && anomaly.entityId === domainId) ||
        (anomaly.entityType === "keyword"); // We'll refine this check later
      return belongsToDomain && !anomaly.resolved;
    });

    // Count by severity
    const summary = {
      total: anomalies.length,
      high: anomalies.filter((a) => a.severity === "high").length,
      medium: anomalies.filter((a) => a.severity === "medium").length,
      low: anomalies.filter((a) => a.severity === "low").length,
    };

    return summary;
  },
});

/**
 * Get anomalies for a specific keyword
 */
export const getKeywordAnomalies = query({
  args: {
    keywordId: v.id("keywords"),
  },
  handler: async (ctx, args) => {
    const { keywordId } = args;

    const anomalies = await ctx.db
      .query("anomalies")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "keyword").eq("entityId", keywordId)
      )
      .order("desc")
      .collect();

    return anomalies;
  },
});
