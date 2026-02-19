import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Calculate linear regression for a dataset
 *
 * Uses least squares regression to find the line of best fit.
 * Returns slope, intercept, R², RMSE, and standard error for confidence intervals.
 *
 * Formula:
 * - slope (m) = Σ[(x - x̄)(y - ȳ)] / Σ[(x - x̄)²]
 * - intercept (b) = ȳ - m * x̄
 * - R² = 1 - (SSres / SStot)
 * - RMSE = √(Σ(actual - predicted)² / n)
 * - SE = RMSE / √n
 */
export const calculateLinearRegression = action({
  args: {
    dataPoints: v.array(v.object({
      date: v.string(),
      value: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<{
    slope: number;
    intercept: number;
    r2: number;
    rmse: number;
    standardError: number;
    firstDate: string;
  }> => {
    const { dataPoints } = args;

    if (dataPoints.length < 2) {
      throw new Error("Need at least 2 data points for regression");
    }

    // Convert dates to numeric values (days since first date)
    const firstDate = new Date(dataPoints[0].date);
    const xValues = dataPoints.map((point) => {
      const date = new Date(point.date);
      return Math.floor((date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    });
    const yValues = dataPoints.map((point) => point.value);

    // Calculate means
    const n = xValues.length;
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

    // Calculate slope (m)
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }
    const slope = numerator / denominator;

    // Calculate intercept (b)
    const intercept = yMean - slope * xMean;

    // Calculate R² (coefficient of determination)
    let ssRes = 0; // Sum of squares of residuals
    let ssTot = 0; // Total sum of squares
    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      ssRes += (yValues[i] - predicted) ** 2;
      ssTot += (yValues[i] - yMean) ** 2;
    }
    const r2 = 1 - (ssRes / ssTot);

    // Calculate RMSE (Root Mean Squared Error)
    const rmse = Math.sqrt(ssRes / n);

    // Calculate standard error for confidence intervals
    const standardError = rmse / Math.sqrt(n);

    return {
      slope,
      intercept,
      r2,
      rmse,
      standardError,
      firstDate: dataPoints[0].date,
    };
  },
});

/**
 * Generate a forecast for a keyword's position
 *
 * Uses linear regression to predict future positions with confidence intervals.
 * Predictions are bounded to realistic ranges (1-100 for positions).
 */
export const generateKeywordForecast = action({
  args: {
    keywordId: v.id("keywords"),
    metric: v.string(), // "position"
    daysToForecast: v.optional(v.number()), // Default: 30
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    predictions: number;
    accuracy: {
      r2: number;
      rmse: number;
      confidenceLevel: string;
    };
  }> => {
    const { keywordId, metric, daysToForecast = 30 } = args;

    // Get historical position data using the action (reads from Supabase)
    const keywordData = await ctx.runAction(api.keywords.getKeywordWithHistory, {
      keywordId,
    });

    if (!keywordData || !keywordData.history || keywordData.history.length < 10) {
      throw new Error("Need at least 10 historical data points for forecasting");
    }

    // Prepare data points (filter out null positions)
    const dataPoints = keywordData.history
      .filter((p: { position: number | null }) => p.position !== null)
      .map((p: { date: string; position: number | null }) => ({
        date: p.date,
        value: p.position as number,
      }));

    if (dataPoints.length < 10) {
      throw new Error("Need at least 10 valid data points for forecasting");
    }

    // Calculate regression
    const regression = await ctx.runAction(api.forecasts_actions.calculateLinearRegression, {
      dataPoints,
    });

    // Generate predictions
    const predictions = [];
    const firstDate = new Date(regression.firstDate);
    const lastDataPoint = dataPoints[dataPoints.length - 1];
    const lastDate = new Date(lastDataPoint.date);

    for (let i = 1; i <= daysToForecast; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(lastDate.getDate() + i);

      // Calculate days since first date
      const daysSinceFirst = Math.floor(
        (futureDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Predict value using linear regression
      const predictedValue = regression.slope * daysSinceFirst + regression.intercept;

      // Calculate confidence interval (±1.96 * SE for 95% confidence)
      const confidenceLower = predictedValue - 1.96 * regression.standardError;
      const confidenceUpper = predictedValue + 1.96 * regression.standardError;

      // Bound predictions to realistic ranges (1-100 for positions)
      const boundedValue = Math.max(1, Math.min(100, Math.round(predictedValue)));
      const boundedLower = Math.max(1, Math.min(100, Math.round(confidenceLower)));
      const boundedUpper = Math.max(1, Math.min(100, Math.round(confidenceUpper)));

      predictions.push({
        date: futureDate.toISOString().split("T")[0],
        value: boundedValue,
        confidenceLower: boundedLower,
        confidenceUpper: boundedUpper,
      });
    }

    // Determine confidence level based on RMSE
    let confidenceLevel: string;
    if (regression.rmse < 5) {
      confidenceLevel = "high";
    } else if (regression.rmse < 15) {
      confidenceLevel = "medium";
    } else {
      confidenceLevel = "low";
    }

    // Store forecast in database
    await ctx.runMutation(api.forecasts_mutations.generateForecast, {
      entityType: "keyword",
      entityId: keywordId,
      metric,
      predictions,
      accuracy: {
        r2: regression.r2,
        rmse: regression.rmse,
        confidenceLevel,
      },
    });

    return {
      success: true,
      predictions: predictions.length,
      accuracy: {
        r2: regression.r2,
        rmse: regression.rmse,
        confidenceLevel,
      },
    };
  },
});

/**
 * Detect anomalies using z-score analysis
 *
 * Z-score = (value - mean) / stdDev
 * Flag anomalies when |z| > 2.5 (99% confidence)
 */
export const detectAnomaliesForEntity = action({
  args: {
    entityType: v.union(v.literal("keyword"), v.literal("domain")),
    entityId: v.string(),
    metric: v.string(),
  },
  handler: async (ctx, args): Promise<{ anomaliesDetected: number; message?: string }> => {
    const { entityType, entityId, metric } = args;

    let dataPoints: Array<{ date: string; value: number }> = [];

    // Get historical data based on entity type
    if (entityType === "keyword") {
      const keywordData = await ctx.runAction(api.keywords.getKeywordWithHistory, {
        keywordId: entityId as any,
      });

      if (!keywordData || !keywordData.history) {
        return { anomaliesDetected: 0, message: "No keyword data found" };
      }

      dataPoints = keywordData.history
        .slice(-30) // Last 30 days
        .filter((p: { position: number | null }) => p.position !== null)
        .map((p: { date: string; position: number | null }) => ({
          date: p.date,
          value: p.position as number,
        }));
    } else if (entityType === "domain" && metric === "backlinks") {
      // For domain backlinks, we'd query velocity history
      // This will be implemented when we have the data structure
      return { anomaliesDetected: 0 };
    }

    if (dataPoints.length < 10) {
      return { anomaliesDetected: 0, message: "Not enough data points" };
    }

    // Calculate mean and standard deviation
    const values = dataPoints.map((p) => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { anomaliesDetected: 0, message: "No variance in data" };
    }

    // Detect anomalies (last 7 days)
    let anomaliesDetected = 0;
    const recentPoints = dataPoints.slice(-7);

    for (const point of recentPoints) {
      const zScore = (point.value - mean) / stdDev;
      const absZScore = Math.abs(zScore);

      if (absZScore > 2.5) {
        // Determine type and severity
        const type = zScore > 0 ? "spike" : "drop";
        let severity: "high" | "medium" | "low";
        if (absZScore > 3.5) {
          severity = "high";
        } else if (absZScore > 3.0) {
          severity = "medium";
        } else {
          severity = "low";
        }

        // Create description
        const direction = type === "spike" ? "increased" : "decreased";
        const description = `${metric} ${direction} significantly on ${point.date}. Value: ${point.value}, Expected: ${mean.toFixed(1)} (z-score: ${zScore.toFixed(2)})`;

        // Store anomaly
        await ctx.runMutation(api.forecasts_mutations.createAnomaly, {
          entityType,
          entityId,
          metric,
          date: point.date,
          type,
          severity,
          value: point.value,
          expectedValue: mean,
          zScore: absZScore,
          description,
        });

        anomaliesDetected++;
      }
    }

    return { anomaliesDetected };
  },
});

/**
 * Generate forecasts for all active keywords in a domain
 */
export const generateDomainForecasts = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    successCount: number;
    failCount: number;
    total: number;
  }> => {
    const { domainId } = args;

    // Get all active keywords for this domain
    const keywords = await ctx.runQuery(api.keywords.getKeywords, {
      domainId,
    });

    let successCount = 0;
    let failCount = 0;

    for (const keyword of keywords) {
      if (keyword.status !== "active") continue;

      try {
        await ctx.runAction(api.forecasts_actions.generateKeywordForecast, {
          keywordId: keyword._id,
          metric: "position",
          daysToForecast: 30,
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to generate forecast for keyword ${keyword._id}:`, error);
        failCount++;
      }
    }

    return {
      success: true,
      successCount,
      failCount,
      total: keywords.length,
    };
  },
});

/**
 * Detect anomalies for all active keywords in a domain
 */
export const detectDomainAnomalies = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    totalAnomalies: number;
    processedKeywords: number;
  }> => {
    const { domainId } = args;

    // Get all active keywords for this domain
    const keywords = await ctx.runQuery(api.keywords.getKeywords, {
      domainId,
    });

    let totalAnomalies = 0;
    let processedKeywords = 0;

    for (const keyword of keywords) {
      if (keyword.status !== "active") continue;

      try {
        const result = await ctx.runAction(api.forecasts_actions.detectAnomaliesForEntity, {
          entityType: "keyword",
          entityId: keyword._id,
          metric: "position",
        });
        totalAnomalies += result.anomaliesDetected || 0;
        processedKeywords++;
      } catch (error) {
        console.error(`Failed to detect anomalies for keyword ${keyword._id}:`, error);
      }
    }

    return {
      success: true,
      totalAnomalies,
      processedKeywords,
    };
  },
});
