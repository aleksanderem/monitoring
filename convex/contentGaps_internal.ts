import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Internal query to get gap summary for reports
 */
export const getGapSummary = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const totalGaps = gaps.length;
    const highPriority = gaps.filter((g) => g.priority === "high").length;
    const totalEstimatedValue = gaps.reduce(
      (sum, gap) => sum + gap.estimatedTrafficValue,
      0
    );

    // Get top 10 opportunities
    const topGaps = [...gaps]
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 10);

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
