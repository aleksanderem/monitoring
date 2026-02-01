import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Internal mutation to create or update a content gap
 */
export const upsertGap = internalMutation({
  args: {
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
    competitorId: v.id("competitors"),
    opportunityScore: v.number(),
    competitorPosition: v.number(),
    yourPosition: v.union(v.number(), v.null()),
    searchVolume: v.number(),
    difficulty: v.number(),
    competitorUrl: v.string(),
    estimatedTrafficValue: v.number(),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
  },
  handler: async (ctx, args) => {
    // Check if gap already exists for this keyword + competitor
    const existingGaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .collect();

    const existingGap = existingGaps.find(
      (g) => g.competitorId === args.competitorId
    );

    const now = Date.now();

    if (existingGap) {
      // Update existing gap
      // Check if user is now ranking - auto-update status to "ranking"
      const newStatus =
        args.yourPosition !== null && args.yourPosition <= 10
          ? ("ranking" as const)
          : existingGap.status;

      await ctx.db.patch(existingGap._id, {
        opportunityScore: args.opportunityScore,
        competitorPosition: args.competitorPosition,
        yourPosition: args.yourPosition,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        competitorUrl: args.competitorUrl,
        estimatedTrafficValue: args.estimatedTrafficValue,
        priority: args.priority,
        status: newStatus,
        lastChecked: now,
      });

      return existingGap._id;
    } else {
      // Create new gap
      // Initial status is "identified" unless user is already ranking well
      const initialStatus =
        args.yourPosition !== null && args.yourPosition <= 10
          ? ("ranking" as const)
          : ("identified" as const);

      const gapId = await ctx.db.insert("contentGaps", {
        domainId: args.domainId,
        keywordId: args.keywordId,
        competitorId: args.competitorId,
        opportunityScore: args.opportunityScore,
        competitorPosition: args.competitorPosition,
        yourPosition: args.yourPosition,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        competitorUrl: args.competitorUrl,
        estimatedTrafficValue: args.estimatedTrafficValue,
        priority: args.priority,
        status: initialStatus,
        identifiedAt: now,
        lastChecked: now,
      });

      return gapId;
    }
  },
});

/**
 * Main gap analysis engine
 * Analyzes all keywords vs all competitors to identify content gaps
 */
export const analyzeContentGaps = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get all active competitors
    const competitors: any = await ctx.runQuery(internal.competitors_internal.getCompetitorsByDomain, {
      domainId: args.domainId,
    });

    const activeCompetitors: any = competitors.filter((c: any) => c.status === "active");

    if (activeCompetitors.length === 0) {
      return {
        success: false,
        message: "No active competitors found for this domain",
        gapsCreated: 0,
        gapsUpdated: 0,
      };
    }

    // Get all active keywords for this domain
    const keywords: any = await ctx.runQuery(internal.competitors_internal.getDomainKeywords, {
      domainId: args.domainId,
    });

    const activeKeywords: any = keywords.filter((k: any) => k.status === "active");

    if (activeKeywords.length === 0) {
      return {
        success: false,
        message: "No active keywords found for this domain",
        gapsCreated: 0,
        gapsUpdated: 0,
      };
    }

    let gapsCreated = 0;
    let gapsUpdated = 0;
    const gapIds: Id<"contentGaps">[] = [];

    // For each keyword, compare with each competitor
    for (const keyword of activeKeywords) {
      // Get your latest position for this keyword
      const yourPositions = await ctx.runQuery(
        internal.keywordPositions_internal.getLatestPosition,
        { keywordId: keyword._id }
      );
      const yourPosition = yourPositions?.position ?? null;

      for (const competitor of activeCompetitors) {
        // Get competitor's latest position for this keyword
        const competitorPositions = await ctx.runQuery(
          internal.competitorKeywordPositions_internal.getLatestPosition,
          {
            competitorId: competitor._id,
            keywordId: keyword._id,
          }
        );

        const competitorPosition = competitorPositions?.position ?? null;
        const competitorUrl = competitorPositions?.url ?? "";

        // Only create gap if competitor ranks
        if (competitorPosition === null) {
          continue;
        }

        // Check if there's actually a gap (competitor ranks better than you)
        const yourPos = yourPosition ?? 100; // Treat not ranking as position 100
        const compPos = competitorPosition;

        if (compPos >= yourPos) {
          // No gap - you're already ranking as well or better
          continue;
        }

        // Calculate enhanced opportunity score
        const volume = keyword.searchVolume ?? 100;
        const difficulty = keyword.difficulty ?? 50;

        // Enhanced scoring algorithm (from spec)
        const baseScore = ((100 - compPos) / 100) * 100;
        const volumeWeight = Math.log10(volume + 1) / 6;
        const difficultyPenalty = difficulty / 100;
        const positionGapBonus = yourPosition ? (yourPos - compPos) / 100 : 0.5;

        const opportunityScore = Math.round(
          baseScore * 0.4 +
            volumeWeight * 100 * 0.3 -
            difficultyPenalty * 100 * 0.2 +
            positionGapBonus * 100 * 0.1
        );

        // Clamp to 0-100 range
        const clampedScore = Math.max(0, Math.min(100, opportunityScore));

        // Assign priority based on score
        let priority: "high" | "medium" | "low";
        if (clampedScore >= 70) {
          priority = "high";
        } else if (clampedScore >= 40) {
          priority = "medium";
        } else {
          priority = "low";
        }

        // Calculate estimated traffic value
        // Simple estimate: searchVolume * CTR_estimate * conversion_value
        // CTR estimate based on competitor position (simplified)
        const ctrEstimate =
          compPos === 1
            ? 0.3
            : compPos <= 3
            ? 0.15
            : compPos <= 10
            ? 0.05
            : 0.01;
        const estimatedTrafficValue = Math.round(volume * ctrEstimate);

        // Upsert the gap
        const gapId = await ctx.runMutation(internal.contentGaps_actions.upsertGap, {
          domainId: args.domainId,
          keywordId: keyword._id,
          competitorId: competitor._id,
          opportunityScore: clampedScore,
          competitorPosition: compPos,
          yourPosition,
          searchVolume: volume,
          difficulty,
          competitorUrl,
          estimatedTrafficValue,
          priority,
        });

        gapIds.push(gapId);

        // Track if created or updated
        // Since upsert can return existing ID, we'll consider all as "processed"
        gapsUpdated++;
      }
    }

    return {
      success: true,
      message: `Analyzed ${activeKeywords.length} keywords across ${activeCompetitors.length} competitors`,
      gapsProcessed: gapsUpdated,
      competitorsAnalyzed: activeCompetitors.length,
      keywordsAnalyzed: activeKeywords.length,
    };
  },
});

/**
 * Internal mutation to create a gap analysis report
 */
export const createReport = internalMutation({
  args: {
    domainId: v.id("domains"),
    totalGaps: v.number(),
    highPriorityGaps: v.number(),
    estimatedTotalValue: v.number(),
    topOpportunities: v.array(v.id("contentGaps")),
    competitorsAnalyzed: v.number(),
    keywordsAnalyzed: v.number(),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("gapAnalysisReports", {
      domainId: args.domainId,
      generatedAt: Date.now(),
      totalGaps: args.totalGaps,
      highPriorityGaps: args.highPriorityGaps,
      estimatedTotalValue: args.estimatedTotalValue,
      topOpportunities: args.topOpportunities,
      competitorsAnalyzed: args.competitorsAnalyzed,
      keywordsAnalyzed: args.keywordsAnalyzed,
    });

    return reportId;
  },
});

/**
 * Generate comprehensive gap analysis report
 * Runs gap analysis and creates a summary report
 */
export const generateGapReport = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Run gap analysis first
    const analysisResult: any = await ctx.runAction(
      api.contentGaps_actions.analyzeContentGaps,
      { domainId: args.domainId }
    );

    if (!analysisResult.success) {
      return {
        success: false,
        message: analysisResult.message,
      };
    }

    // Get gap summary
    const summary: any = await ctx.runQuery(internal.contentGaps_internal.getGapSummary, {
      domainId: args.domainId,
    });

    // Create report
    const reportId: any = await ctx.runMutation(internal.contentGaps_actions.createReport, {
      domainId: args.domainId,
      totalGaps: summary.totalGaps,
      highPriorityGaps: summary.highPriority,
      estimatedTotalValue: summary.totalEstimatedValue,
      topOpportunities: summary.topOpportunities.map((o: any) => o.gapId),
      competitorsAnalyzed: analysisResult.competitorsAnalyzed,
      keywordsAnalyzed: analysisResult.keywordsAnalyzed,
    });

    return {
      success: true,
      reportId,
      summary: {
        totalGaps: summary.totalGaps,
        highPriorityGaps: summary.highPriority,
        estimatedTotalValue: summary.totalEstimatedValue,
        competitorsAnalyzed: analysisResult.competitorsAnalyzed,
        keywordsAnalyzed: analysisResult.keywordsAnalyzed,
      },
    };
  },
});
