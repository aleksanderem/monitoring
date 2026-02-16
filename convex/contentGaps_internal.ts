import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Internal query to get gap summary for reports
 *
 * Optimized: uses streaming aggregation and targeted db.get() enrichment.
 */
export const getGapSummary = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Stream-aggregate to avoid holding all gaps in memory
    let totalGaps = 0;
    let highPriority = 0;
    let totalEstimatedValue = 0;

    const TOP_N = 10;
    type TopGap = {
      _id: Id<"contentGaps">;
      keywordId: Id<"keywords">;
      competitorId: Id<"competitors">;
      opportunityScore: number;
      estimatedTrafficValue: number;
      priority: string;
    };
    const topGaps: TopGap[] = [];
    let minTopScore = -1;

    for await (const gap of ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
    ) {
      totalGaps++;
      if (gap.priority === "high") highPriority++;
      totalEstimatedValue += gap.estimatedTrafficValue ?? 0;

      if (topGaps.length < TOP_N || gap.opportunityScore > minTopScore) {
        topGaps.push({
          _id: gap._id,
          keywordId: gap.keywordId,
          competitorId: gap.competitorId,
          opportunityScore: gap.opportunityScore,
          estimatedTrafficValue: gap.estimatedTrafficValue,
          priority: gap.priority,
        });
        if (topGaps.length > TOP_N) {
          topGaps.sort((a, b) => b.opportunityScore - a.opportunityScore);
          topGaps.length = TOP_N;
        }
        minTopScore = topGaps[topGaps.length - 1].opportunityScore;
      }
    }

    topGaps.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Targeted enrichment for top 10 only (using typed Ids for proper db.get resolution)
    const topOpportunities = await Promise.all(
      topGaps.map(async (gap) => {
        const keyword = await ctx.db.get(gap.keywordId);
        const competitor = await ctx.db.get(gap.competitorId);
        return {
          gapId: gap._id,
          keywordPhrase: keyword?.phrase ?? "Unknown",
          competitorDomain: competitor?.competitorDomain ?? "Unknown",
          opportunityScore: gap.opportunityScore,
          estimatedValue: gap.estimatedTrafficValue,
          priority: gap.priority,
        };
      })
    );

    return {
      totalGaps,
      highPriority,
      totalEstimatedValue,
      topOpportunities,
    };
  },
});
