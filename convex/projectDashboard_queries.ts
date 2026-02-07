import { v } from "convex/values";
import { query } from "./_generated/server";
import { auth } from "./auth";

// ─── Helpers ───────────────────────────────────────────────

async function getProjectDomains(ctx: any, projectId: any) {
    return ctx.db
        .query("domains")
        .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
        .collect();
}

// ─── Queries ───────────────────────────────────────────────

// Project overview: aggregated stats from all domains
export const getProjectOverview = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const project = await ctx.db.get(args.projectId);
        if (!project) return null;

        const domains = await getProjectDomains(ctx, args.projectId);

        let totalKeywords = 0;
        let totalMonitored = 0;
        let totalBacklinks = 0;
        let totalReferringDomains = 0;
        let positionSum = 0;
        let positionCount = 0;
        let totalEtv = 0;

        for (const domain of domains) {
            // Keywords
            const keywords = await ctx.db
                .query("keywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();
            totalKeywords += keywords.length;

            // Discovered keywords count
            const discovered = await ctx.db
                .query("discoveredKeywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();
            totalMonitored += keywords.length;

            // Avg position from discovered keywords
            for (const dk of discovered) {
                if (dk.bestPosition && dk.bestPosition < 999) {
                    positionSum += dk.bestPosition;
                    positionCount++;
                }
                totalEtv += dk.etv ?? 0;
            }

            // Backlinks summary
            const blSummary = await ctx.db
                .query("domainBacklinksSummary")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .unique();
            if (blSummary) {
                totalBacklinks += blSummary.totalBacklinks;
                totalReferringDomains += blSummary.totalDomains;
            }
        }

        return {
            projectName: project.name,
            totalDomains: domains.length,
            totalKeywords,
            totalDiscoveredKeywords: positionCount,
            totalMonitored,
            avgPosition: positionCount > 0 ? Math.round((positionSum / positionCount) * 10) / 10 : null,
            totalEstimatedTraffic: Math.round(totalEtv),
            totalBacklinks,
            totalReferringDomains,
            domains: domains.map((d: any) => ({ _id: d._id, domain: d.domain })),
        };
    },
});

// Position distribution across all project domains
export const getProjectPositionDistribution = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const domains = await getProjectDomains(ctx, args.projectId);

        const buckets = {
            top3: 0,
            top10: 0,
            top20: 0,
            top50: 0,
            top100: 0,
            beyond: 0,
        };

        for (const domain of domains) {
            const discovered = await ctx.db
                .query("discoveredKeywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();

            for (const dk of discovered) {
                const pos = dk.bestPosition;
                if (!pos || pos >= 999) continue;
                if (pos <= 3) buckets.top3++;
                else if (pos <= 10) buckets.top10++;
                else if (pos <= 20) buckets.top20++;
                else if (pos <= 50) buckets.top50++;
                else if (pos <= 100) buckets.top100++;
                else buckets.beyond++;
            }
        }

        return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
    },
});

// Movement trend across all project domains
export const getProjectMovementTrend = query({
    args: {
        projectId: v.id("projects"),
        days: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const days = args.days ?? 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const domains = await getProjectDomains(ctx, args.projectId);

        // Aggregate visibility history by date
        const dateMap: Record<string, { etv: number; count: number; isUp: number; isDown: number; isNew: number; isLost: number }> = {};

        for (const domain of domains) {
            const history = await ctx.db
                .query("domainVisibilityHistory")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .filter((q) => q.gte(q.field("date"), cutoff))
                .collect();

            for (const h of history) {
                if (!dateMap[h.date]) {
                    dateMap[h.date] = { etv: 0, count: 0, isUp: 0, isDown: 0, isNew: 0, isLost: 0 };
                }
                const d = dateMap[h.date];
                d.etv += h.metrics.etv ?? 0;
                d.count += h.metrics.count ?? 0;
                d.isUp += h.metrics.is_up ?? 0;
                d.isDown += h.metrics.is_down ?? 0;
                d.isNew += h.metrics.is_new ?? 0;
                d.isLost += h.metrics.is_lost ?? 0;
            }
        }

        return Object.entries(dateMap)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    },
});

// Backlinks summary across all project domains
export const getProjectBacklinksSummary = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const domains = await getProjectDomains(ctx, args.projectId);

        let totalBacklinks = 0;
        let totalDomains = 0;
        let totalDofollow = 0;
        let totalNofollow = 0;

        const domainSummaries = [];

        for (const domain of domains) {
            const summary = await ctx.db
                .query("domainBacklinksSummary")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .unique();

            if (summary) {
                totalBacklinks += summary.totalBacklinks;
                totalDomains += summary.totalDomains;
                totalDofollow += summary.dofollow;
                totalNofollow += summary.nofollow;

                domainSummaries.push({
                    domain: domain.domain,
                    domainId: domain._id,
                    backlinks: summary.totalBacklinks,
                    referringDomains: summary.totalDomains,
                    dofollow: summary.dofollow,
                    nofollow: summary.nofollow,
                });
            }
        }

        return {
            totalBacklinks,
            totalReferringDomains: totalDomains,
            totalDofollow,
            totalNofollow,
            dofollowPercent: totalBacklinks > 0 ? Math.round((totalDofollow / totalBacklinks) * 100) : 0,
            domainSummaries,
        };
    },
});

// Top performers: keywords with biggest position changes across all domains
export const getProjectTopPerformers = query({
    args: {
        projectId: v.id("projects"),
        days: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const days = args.days ?? 7;
        const limit = args.limit ?? 20;
        const domains = await getProjectDomains(ctx, args.projectId);

        const movers: Array<{
            keyword: string;
            domain: string;
            currentPosition: number;
            previousPosition: number;
            change: number;
        }> = [];

        for (const domain of domains) {
            const keywords = await ctx.db
                .query("keywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();

            for (const kw of keywords) {
                const positions = await ctx.db
                    .query("keywordPositions")
                    .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
                    .order("desc")
                    .take(2);

                if (positions.length >= 2 && positions[0].position !== null && positions[1].position !== null) {
                    const change = positions[1].position - positions[0].position; // positive = improved
                    if (Math.abs(change) > 0) {
                        movers.push({
                            keyword: kw.phrase,
                            domain: domain.domain,
                            currentPosition: positions[0].position,
                            previousPosition: positions[1].position,
                            change,
                        });
                    }
                }
            }
        }

        // Sort by absolute change
        movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        const gainers = movers.filter((m) => m.change > 0).slice(0, limit);
        const losers = movers.filter((m) => m.change < 0).slice(0, limit);

        return { gainers, losers };
    },
});

// Domains table with key metrics
export const getProjectDomainsWithMetrics = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const domains = await getProjectDomains(ctx, args.projectId);

        const results = [];

        for (const domain of domains) {
            const keywords = await ctx.db
                .query("keywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();

            const discovered = await ctx.db
                .query("discoveredKeywords")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .collect();

            const blSummary = await ctx.db
                .query("domainBacklinksSummary")
                .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
                .unique();

            let avgPosition: number | null = null;
            let totalEtv = 0;
            if (discovered.length > 0) {
                const validPositions = discovered.filter((d) => d.bestPosition && d.bestPosition < 999);
                if (validPositions.length > 0) {
                    avgPosition = Math.round((validPositions.reduce((s, d) => s + d.bestPosition, 0) / validPositions.length) * 10) / 10;
                }
                totalEtv = discovered.reduce((s, d) => s + (d.etv ?? 0), 0);
            }

            results.push({
                _id: domain._id,
                domain: domain.domain,
                createdAt: domain.createdAt,
                lastRefreshedAt: domain.lastRefreshedAt,
                monitoredKeywords: keywords.length,
                discoveredKeywords: discovered.length,
                avgPosition,
                estimatedTraffic: Math.round(totalEtv),
                totalBacklinks: blSummary?.totalBacklinks ?? 0,
                referringDomains: blSummary?.totalDomains ?? 0,
            });
        }

        return results;
    },
});
