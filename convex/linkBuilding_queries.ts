import { v } from "convex/values";
import { query } from "./_generated/server";

// Get top link building prospects sorted by score
export const getTopProspects = query({
    args: {
        domainId: v.id("domains"),
        limit: v.optional(v.number()),
        status: v.optional(v.union(v.literal("identified"), v.literal("reviewing"), v.literal("dismissed"))),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 100;

        let prospects;
        if (args.status) {
            prospects = await ctx.db
                .query("linkBuildingProspects")
                .withIndex("by_domain_status", (q) => q.eq("domainId", args.domainId).eq("status", args.status!))
                .collect();
        } else {
            prospects = await ctx.db
                .query("linkBuildingProspects")
                .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
                .collect();
        }

        // Filter out dismissed by default unless explicitly requested
        if (!args.status) {
            prospects = prospects.filter((p) => p.status !== "dismissed");
        }

        prospects.sort((a, b) => b.prospectScore - a.prospectScore);

        return prospects.slice(0, limit);
    },
});

// Get prospects grouped by suggested channel
export const getProspectsByChannel = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const prospects = await ctx.db
            .query("linkBuildingProspects")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const active = prospects.filter((p) => p.status !== "dismissed");

        const channels: Record<string, { count: number; avgScore: number; totalScore: number; avgImpact: number; totalImpact: number }> = {};

        for (const p of active) {
            if (!channels[p.suggestedChannel]) {
                channels[p.suggestedChannel] = { count: 0, avgScore: 0, totalScore: 0, avgImpact: 0, totalImpact: 0 };
            }
            const ch = channels[p.suggestedChannel];
            ch.count++;
            ch.totalScore += p.prospectScore;
            ch.totalImpact += p.estimatedImpact;
        }

        return Object.entries(channels)
            .map(([channel, data]) => ({
                channel,
                count: data.count,
                avgScore: Math.round(data.totalScore / data.count),
                avgImpact: Math.round(data.totalImpact / data.count),
            }))
            .sort((a, b) => b.count - a.count);
    },
});

// Get overall link building stats
export const getProspectStats = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const prospects = await ctx.db
            .query("linkBuildingProspects")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        if (prospects.length === 0) return null;

        const active = prospects.filter((p) => p.status !== "dismissed");
        const reviewing = prospects.filter((p) => p.status === "reviewing");
        const dismissed = prospects.filter((p) => p.status === "dismissed");

        const easy = active.filter((p) => p.acquisitionDifficulty === "easy");
        const medium = active.filter((p) => p.acquisitionDifficulty === "medium");
        const hard = active.filter((p) => p.acquisitionDifficulty === "hard");

        const avgScore = active.length > 0 ? Math.round(active.reduce((s, p) => s + p.prospectScore, 0) / active.length) : 0;
        const avgImpact = active.length > 0 ? Math.round(active.reduce((s, p) => s + p.estimatedImpact, 0) / active.length) : 0;

        return {
            totalProspects: prospects.length,
            activeProspects: active.length,
            reviewingCount: reviewing.length,
            dismissedCount: dismissed.length,
            avgScore,
            avgImpact,
            byDifficulty: {
                easy: easy.length,
                medium: medium.length,
                hard: hard.length,
            },
            generatedAt: prospects.length > 0 ? Math.max(...prospects.map((p) => p.generatedAt)) : null,
        };
    },
});
