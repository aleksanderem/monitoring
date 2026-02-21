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
 * Batch upsert: create or update multiple content gaps in a single mutation.
 */
export const upsertGapsBatch = internalMutation({
  args: {
    gaps: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids: Id<"contentGaps">[] = [];

    for (const gap of args.gaps) {
      const existingGaps = await ctx.db
        .query("contentGaps")
        .withIndex("by_keyword", (q) => q.eq("keywordId", gap.keywordId))
        .collect();

      const existingGap = existingGaps.find(
        (g) => g.competitorId === gap.competitorId
      );

      if (existingGap) {
        const newStatus =
          gap.yourPosition !== null && gap.yourPosition <= 10
            ? ("ranking" as const)
            : existingGap.status;

        await ctx.db.patch(existingGap._id, {
          opportunityScore: gap.opportunityScore,
          competitorPosition: gap.competitorPosition,
          yourPosition: gap.yourPosition,
          searchVolume: gap.searchVolume,
          difficulty: gap.difficulty,
          competitorUrl: gap.competitorUrl,
          estimatedTrafficValue: gap.estimatedTrafficValue,
          priority: gap.priority,
          status: newStatus,
          lastChecked: now,
        });
        ids.push(existingGap._id);
      } else {
        const initialStatus =
          gap.yourPosition !== null && gap.yourPosition <= 10
            ? ("ranking" as const)
            : ("identified" as const);

        const gapId = await ctx.db.insert("contentGaps", {
          domainId: gap.domainId,
          keywordId: gap.keywordId,
          competitorId: gap.competitorId,
          opportunityScore: gap.opportunityScore,
          competitorPosition: gap.competitorPosition,
          yourPosition: gap.yourPosition,
          searchVolume: gap.searchVolume,
          difficulty: gap.difficulty,
          competitorUrl: gap.competitorUrl,
          estimatedTrafficValue: gap.estimatedTrafficValue,
          priority: gap.priority,
          status: initialStatus,
          identifiedAt: now,
          lastChecked: now,
        });
        ids.push(gapId);
      }
    }

    return ids;
  },
});

/**
 * Main gap analysis engine
 * Analyzes all keywords vs all competitors to identify content gaps.
 * Uses batch queries to reduce N×M round-trips to ~3 total.
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

    const keywordIds = activeKeywords.map((k: any) => k._id);
    const competitorIds = activeCompetitors.map((c: any) => c._id);

    type UserPosEntry = { keywordId: string; position: number | null; url: string | null; date: string };
    type CompPosEntry = { competitorId: string; keywordId: string; position: number | null; url: string | null; date: string };

    // Batch query 1: fetch all user positions for all keywords (1 round-trip)
    const allUserPositions: UserPosEntry[] = await ctx.runQuery(
      internal.keywordPositions_internal.getLatestPositionsBatch,
      { keywordIds }
    );
    const userPosMap = new Map<string, UserPosEntry>(
      allUserPositions.map((p) => [p.keywordId, p])
    );

    // Batch query 2: fetch all competitor positions (1 round-trip)
    const allCompPositions: CompPosEntry[] = await ctx.runQuery(
      internal.competitorKeywordPositions_internal.getLatestCompetitorPositionsBatch,
      { competitorIds, keywordIds }
    );
    const compPosMap = new Map<string, CompPosEntry>(
      allCompPositions.map((p) => [`${p.competitorId}:${p.keywordId}`, p])
    );

    // Build gap array in memory (0 round-trips)
    const gaps: Array<{
      domainId: Id<"domains">;
      keywordId: Id<"keywords">;
      competitorId: Id<"competitors">;
      opportunityScore: number;
      competitorPosition: number;
      yourPosition: number | null;
      searchVolume: number;
      difficulty: number;
      competitorUrl: string;
      estimatedTrafficValue: number;
      priority: "high" | "medium" | "low";
    }> = [];

    for (const keyword of activeKeywords) {
      const userPos = userPosMap.get(keyword._id);
      const yourPosition: number | null = userPos?.position ?? null;

      for (const competitor of activeCompetitors) {
        const compPos = compPosMap.get(`${competitor._id}:${keyword._id}`);
        const competitorPosition = compPos?.position ?? null;
        const competitorUrl = compPos?.url ?? "";

        if (competitorPosition === null) continue;

        const yourPos = yourPosition ?? 100;
        if (competitorPosition >= yourPos) continue;

        const volume = keyword.searchVolume ?? 100;
        const difficulty = keyword.difficulty ?? 50;

        const baseScore = ((100 - competitorPosition) / 100) * 100;
        const volumeWeight = Math.log10(volume + 1) / 6;
        const difficultyPenalty = difficulty / 100;
        const positionGapBonus = yourPosition ? (yourPos - competitorPosition) / 100 : 0.5;

        const opportunityScore = Math.round(
          baseScore * 0.4 +
            volumeWeight * 100 * 0.3 -
            difficultyPenalty * 100 * 0.2 +
            positionGapBonus * 100 * 0.1
        );

        const clampedScore = Math.max(0, Math.min(100, opportunityScore));

        let priority: "high" | "medium" | "low";
        if (clampedScore >= 70) {
          priority = "high";
        } else if (clampedScore >= 40) {
          priority = "medium";
        } else {
          priority = "low";
        }

        const ctrEstimate =
          competitorPosition === 1
            ? 0.3
            : competitorPosition <= 3
            ? 0.15
            : competitorPosition <= 10
            ? 0.05
            : 0.01;
        const estimatedTrafficValue = Math.round(volume * ctrEstimate);

        gaps.push({
          domainId: args.domainId,
          keywordId: keyword._id,
          competitorId: competitor._id,
          opportunityScore: clampedScore,
          competitorPosition,
          yourPosition,
          searchVolume: volume,
          difficulty,
          competitorUrl,
          estimatedTrafficValue,
          priority,
        });
      }
    }

    // Batch mutation: upsert all gaps at once (1 round-trip)
    if (gaps.length > 0) {
      await ctx.runMutation(internal.contentGaps_actions.upsertGapsBatch, { gaps });
    }

    return {
      success: true,
      message: `Analyzed ${activeKeywords.length} keywords across ${activeCompetitors.length} competitors`,
      gapsProcessed: gaps.length,
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
