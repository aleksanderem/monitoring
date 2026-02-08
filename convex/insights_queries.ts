import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Domain Health Score — aggregates health across keywords, backlinks, on-site
 */
export const getDomainHealthScore = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const domain = await ctx.db.get(args.domainId);
        if (!domain) return null;

        // 1. Keyword health (0-30 points)
        const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const activeKeywords = keywords.filter((k) => k.status === "active");
        let keywordScore = 0;
        let avgPosition = 0;
        let keywordsWithPosition = 0;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        let improving = 0;
        let declining = 0;

        for (const kw of activeKeywords.slice(0, 100)) {
            const latestPos = await ctx.db
                .query("keywordPositions")
                .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                .order("desc")
                .first();

            if (latestPos?.position) {
                keywordsWithPosition++;
                avgPosition += latestPos.position;

                const oldPositions = await ctx.db
                    .query("keywordPositions")
                    .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                    .filter((q) => q.lte(q.field("date"), sevenDaysAgo))
                    .order("desc")
                    .first();

                if (oldPositions?.position) {
                    const diff = oldPositions.position - latestPos.position;
                    if (diff > 1) improving++;
                    else if (diff < -1) declining++;
                }
            }
        }

        if (keywordsWithPosition > 0) {
            avgPosition = avgPosition / keywordsWithPosition;
            // Better avg position = higher score
            keywordScore = Math.min(30, Math.round(30 * Math.max(0, 1 - avgPosition / 100)));
            // Bonus for improvement momentum
            if (improving > declining) keywordScore = Math.min(30, keywordScore + 3);
            // Penalty for declining
            if (declining > improving * 2) keywordScore = Math.max(0, keywordScore - 5);
        }

        // 2. Backlink health (0-30 points)
        const backlinkSummary = await ctx.db
            .query("domainBacklinksSummary")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .order("desc")
            .first();

        let backlinkScore = 0;
        if (backlinkSummary) {
            const totalBacklinks = backlinkSummary.totalBacklinks ?? 0;
            const referringDomains = backlinkSummary.totalDomains ?? 0;
            // More referring domains = better
            backlinkScore += Math.min(15, Math.round(referringDomains / 10));
            // Good ratio of domains to links
            const ratio = totalBacklinks > 0 ? referringDomains / totalBacklinks : 0;
            backlinkScore += ratio > 0.3 ? 10 : ratio > 0.1 ? 5 : 2;
            // Cap at 30
            backlinkScore = Math.min(30, backlinkScore);
        }

        // 3. On-site health (0-20 points)
        const latestAnalysis = await ctx.db
            .query("domainOnsiteAnalysis")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .order("desc")
            .first();

        let onsiteScore = 10; // Default neutral
        if (latestAnalysis) {
            const { healthScore: onsiteHealthScore } = latestAnalysis;
            if (onsiteHealthScore != null) {
                onsiteScore = Math.round((onsiteHealthScore / 100) * 20);
            }
        }

        // 4. Content coverage (0-20 points)
        const contentGaps = await ctx.db
            .query("contentGaps")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const totalGaps = contentGaps.filter((g) => g.status !== "dismissed").length;
        // Fewer gaps = better content coverage
        let contentScore = 20;
        if (totalGaps > 100) contentScore = 5;
        else if (totalGaps > 50) contentScore = 10;
        else if (totalGaps > 20) contentScore = 15;

        const totalScore = keywordScore + backlinkScore + onsiteScore + contentScore;

        return {
            totalScore,
            maxScore: 100,
            breakdown: {
                keywords: { score: keywordScore, max: 30, labelKey: "breakdownKeywords" },
                backlinks: { score: backlinkScore, max: 30, labelKey: "breakdownBacklinks" },
                onsite: { score: onsiteScore, max: 20, labelKey: "breakdownOnSite" },
                content: { score: contentScore, max: 20, labelKey: "breakdownContent" },
            },
            stats: {
                totalKeywords: activeKeywords.length,
                avgPosition: keywordsWithPosition > 0 ? Math.round(avgPosition * 10) / 10 : null,
                improving,
                declining,
                totalBacklinks: backlinkSummary?.totalBacklinks ?? 0,
                referringDomains: backlinkSummary?.totalDomains ?? 0,
                contentGaps: totalGaps,
            },
        };
    },
});

/**
 * Keyword insights — at-risk, opportunities, and notable changes
 */
export const getKeywordInsights = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const activeKeywords = keywords.filter((k) => k.status === "active");
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const atRisk: Array<{ keyword: string; currentPosition: number; previousPosition: number; drop: number }> = [];
        const opportunities: Array<{ keyword: string; currentPosition: number; previousPosition: number; gain: number }> = [];
        const nearPage1: Array<{ keyword: string; position: number; searchVolume: number | null }> = [];

        for (const kw of activeKeywords) {
            const latestPos = await ctx.db
                .query("keywordPositions")
                .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                .order("desc")
                .first();

            if (!latestPos?.position) continue;

            const oldPos = await ctx.db
                .query("keywordPositions")
                .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                .filter((q) => q.lte(q.field("date"), sevenDaysAgo))
                .order("desc")
                .first();

            // Near page 1 (position 11-20)
            if (latestPos.position >= 11 && latestPos.position <= 20) {
                nearPage1.push({
                    keyword: kw.phrase,
                    position: latestPos.position,
                    searchVolume: latestPos.searchVolume ?? null,
                });
            }

            if (!oldPos?.position) continue;

            const diff = oldPos.position - latestPos.position; // positive = improved

            // At-risk: dropped 5+ positions
            if (diff < -5) {
                atRisk.push({
                    keyword: kw.phrase,
                    currentPosition: latestPos.position,
                    previousPosition: oldPos.position,
                    drop: Math.abs(diff),
                });
            }

            // Opportunities: gained 5+ positions (trending up)
            if (diff > 5) {
                opportunities.push({
                    keyword: kw.phrase,
                    currentPosition: latestPos.position,
                    previousPosition: oldPos.position,
                    gain: diff,
                });
            }
        }

        // Sort by magnitude
        atRisk.sort((a, b) => b.drop - a.drop);
        opportunities.sort((a, b) => b.gain - a.gain);
        nearPage1.sort((a, b) => a.position - b.position);

        return {
            atRisk: atRisk.slice(0, 10),
            opportunities: opportunities.slice(0, 10),
            nearPage1: nearPage1.slice(0, 10),
            summary: {
                atRiskCount: atRisk.length,
                opportunityCount: opportunities.length,
                nearPage1Count: nearPage1.length,
            },
        };
    },
});

/**
 * Backlink insights — toxic alerts, velocity, notable changes
 */
export const getBacklinkInsights = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        // Get backlink summary
        const summaries = await ctx.db
            .query("domainBacklinksSummary")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .order("desc")
            .take(2);

        const current = summaries[0];
        const previous = summaries[1];

        // Toxic links count
        const backlinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const toxicCount = backlinks.filter((bl) => (bl.backlink_spam_score ?? 0) >= 70).length;
        const totalWithSpam = backlinks.filter((bl) => bl.backlink_spam_score != null).length;
        const toxicPercentage = totalWithSpam > 0 ? Math.round((toxicCount / totalWithSpam) * 100) : 0;

        // Velocity (new vs lost)
        let newBacklinks = 0;
        let lostBacklinks = 0;
        if (current && previous) {
            newBacklinks = Math.max(0, (current.totalBacklinks ?? 0) - (previous.totalBacklinks ?? 0));
            lostBacklinks = Math.max(0, (previous.totalBacklinks ?? 0) - (current.totalBacklinks ?? 0));
        }

        // Dofollow ratio
        const dofollowCount = backlinks.filter((bl) => bl.dofollow === true).length;
        const dofollowRatio = backlinks.length > 0 ? Math.round((dofollowCount / backlinks.length) * 100) : 0;

        // Link building prospects
        const prospects = await ctx.db
            .query("linkBuildingProspects")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const activeProspects = prospects.filter((p) => p.status === "identified").length;

        return {
            totalBacklinks: current?.totalBacklinks ?? backlinks.length,
            referringDomains: current?.totalDomains ?? 0,
            toxicCount,
            toxicPercentage,
            newBacklinks,
            lostBacklinks,
            dofollowRatio,
            activeProspects,
        };
    },
});

/**
 * Actionable recommendations — prioritized list based on all data
 */
export const getRecommendations = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const recommendations: Array<{
            priority: "high" | "medium" | "low";
            category: "keywords" | "backlinks" | "onsite" | "content";
            titleKey: string;
            descriptionKey: string;
            metricKey?: string;
            params: Record<string, string | number>;
        }> = [];

        // 1. Check keyword health
        const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const activeKeywords = keywords.filter((k) => k.status === "active");
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        let droppingCount = 0;
        let nearPage1Count = 0;

        for (const kw of activeKeywords.slice(0, 100)) {
            const latestPos = await ctx.db
                .query("keywordPositions")
                .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                .order("desc")
                .first();

            if (!latestPos?.position) continue;

            if (latestPos.position >= 11 && latestPos.position <= 20) nearPage1Count++;

            const oldPos = await ctx.db
                .query("keywordPositions")
                .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                .filter((q) => q.lte(q.field("date"), sevenDaysAgo))
                .order("desc")
                .first();

            if (oldPos?.position && latestPos.position - oldPos.position > 5) {
                droppingCount++;
            }
        }

        if (droppingCount > 5) {
            recommendations.push({
                priority: "high",
                category: "keywords",
                titleKey: "recSignificantRankingDrops",
                descriptionKey: "recSignificantRankingDropsDesc",
                metricKey: "recKeywordsMetric",
                params: { count: droppingCount },
            });
        } else if (droppingCount > 0) {
            recommendations.push({
                priority: "medium",
                category: "keywords",
                titleKey: "recSomeRankingsDeclining",
                descriptionKey: "recSomeRankingsDecliningDesc",
                metricKey: "recKeywordsMetric",
                params: { count: droppingCount },
            });
        }

        if (nearPage1Count > 0) {
            recommendations.push({
                priority: "medium",
                category: "keywords",
                titleKey: "recKeywordsNearPage1",
                descriptionKey: "recKeywordsNearPage1Desc",
                metricKey: "recKeywordsMetric",
                params: { count: nearPage1Count },
            });
        }

        // 2. Backlink health
        const backlinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const toxicCount = backlinks.filter((bl) => (bl.backlink_spam_score ?? 0) >= 70).length;

        if (toxicCount > 10) {
            recommendations.push({
                priority: "high",
                category: "backlinks",
                titleKey: "recToxicBacklinks",
                descriptionKey: "recToxicBacklinksDesc",
                metricKey: "recToxicLinksMetric",
                params: { count: toxicCount },
            });
        } else if (toxicCount > 0) {
            recommendations.push({
                priority: "low",
                category: "backlinks",
                titleKey: "recMinorToxicBacklinks",
                descriptionKey: "recMinorToxicBacklinksDesc",
                metricKey: "recToxicLinksMetric",
                params: { count: toxicCount },
            });
        }

        // Check link building prospects
        const prospects = await ctx.db
            .query("linkBuildingProspects")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const identifiedProspects = prospects.filter((p) => p.status === "identified").length;
        if (identifiedProspects > 0) {
            recommendations.push({
                priority: "medium",
                category: "backlinks",
                titleKey: "recLinkBuildingOpportunities",
                descriptionKey: "recLinkBuildingOpportunitiesDesc",
                metricKey: "recProspectsMetric",
                params: { count: identifiedProspects },
            });
        }

        // 3. On-site health
        const latestAnalysis = await ctx.db
            .query("domainOnsiteAnalysis")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .order("desc")
            .first();

        if (latestAnalysis) {
            if (latestAnalysis.healthScore != null && latestAnalysis.healthScore < 70) {
                recommendations.push({
                    priority: "high",
                    category: "onsite",
                    titleKey: "recLowOnPageScore",
                    descriptionKey: "recLowOnPageScoreDesc",
                    metricKey: "recScoreMetric",
                    params: { score: latestAnalysis.healthScore },
                });
            }
        } else {
            recommendations.push({
                priority: "medium",
                category: "onsite",
                titleKey: "recNoOnsiteScan",
                descriptionKey: "recNoOnsiteScanDesc",
                params: {},
            });
        }

        // 4. Content gaps
        const gaps = await ctx.db
            .query("contentGaps")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const highPriorityGaps = gaps.filter((g) => g.priority === "high" && g.status === "identified").length;

        if (highPriorityGaps > 10) {
            recommendations.push({
                priority: "high",
                category: "content",
                titleKey: "recHighPriorityContentGaps",
                descriptionKey: "recHighPriorityContentGapsDesc",
                metricKey: "recGapsMetric",
                params: { count: highPriorityGaps },
            });
        } else if (highPriorityGaps > 0) {
            recommendations.push({
                priority: "medium",
                category: "content",
                titleKey: "recContentOpportunitiesAvailable",
                descriptionKey: "recContentOpportunitiesAvailableDesc",
                metricKey: "recGapsMetric",
                params: { count: highPriorityGaps },
            });
        }

        if (gaps.length === 0) {
            recommendations.push({
                priority: "low",
                category: "content",
                titleKey: "recNoContentGapAnalysis",
                descriptionKey: "recNoContentGapAnalysisDesc",
                params: {},
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return recommendations;
    },
});
