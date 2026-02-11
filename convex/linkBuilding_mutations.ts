import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Update prospect status (reviewing/dismissed)
export const updateProspectStatus = mutation({
    args: {
        prospectId: v.id("linkBuildingProspects"),
        status: v.union(v.literal("identified"), v.literal("reviewing"), v.literal("dismissed")),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.prospectId, { status: args.status });
    },
});

// Generate link building report from backlink gap data
export const generateLinkBuildingReport = mutation({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        // Get our backlinks to know our referring domains
        const ourBacklinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const ourDomains = new Set(ourBacklinks.map((bl) => bl.domainFrom).filter(Boolean));

        // Get competitors
        const competitors = await ctx.db
            .query("competitors")
            .withIndex("by_domain_status", (q) => q.eq("domainId", args.domainId).eq("status", "active"))
            .collect();

        if (competitors.length === 0) {
            return { generated: 0, message: "No active competitors found" };
        }

        // Build gap map
        const gapMap: Record<
            string,
            {
                domain: string;
                competitors: string[];
                totalLinks: number;
                totalDomainRank: number;
                dofollow: number;
                anchors: Set<string>;
            }
        > = {};

        for (const comp of competitors) {
            const compBacklinks = await ctx.db
                .query("competitorBacklinks")
                .withIndex("by_competitor", (q) => q.eq("competitorId", comp._id))
                .collect();

            for (const bl of compBacklinks) {
                const domain = bl.domainFrom;
                if (!domain || ourDomains.has(domain)) continue;

                if (!gapMap[domain]) {
                    gapMap[domain] = { domain, competitors: [], totalLinks: 0, totalDomainRank: 0, dofollow: 0, anchors: new Set() };
                }
                const g = gapMap[domain];
                if (!g.competitors.includes(comp.competitorDomain)) g.competitors.push(comp.competitorDomain);
                g.totalLinks++;
                g.totalDomainRank += bl.domainFromRank ?? 0;
                if (bl.dofollow === true) g.dofollow++;
                if (bl.anchor) g.anchors.add(bl.anchor);
            }
        }

        // Delete existing prospects for this domain
        const existing = await ctx.db
            .query("linkBuildingProspects")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        for (const p of existing) {
            await ctx.db.delete(p._id);
        }

        // Score and classify each gap domain
        const now = Date.now();
        let generated = 0;

        const gaps = Object.values(gapMap).sort((a, b) => {
            const scoreA = a.competitors.length * 25 + Math.min((a.totalDomainRank / Math.max(a.totalLinks, 1)) / 10, 50);
            const scoreB = b.competitors.length * 25 + Math.min((b.totalDomainRank / Math.max(b.totalLinks, 1)) / 10, 50);
            return scoreB - scoreA;
        });

        // Process top 200 gap domains
        for (const gap of gaps.slice(0, 200)) {
            const avgDomainRank = gap.totalLinks > 0 ? Math.round(gap.totalDomainRank / gap.totalLinks) : 0;
            const dofollowRate = gap.totalLinks > 0 ? gap.dofollow / gap.totalLinks : 0;

            // Prospect score: based on competitor count, domain rank, dofollow rate
            const competitorScore = Math.min(gap.competitors.length * 20, 50);
            const rankScore = Math.min(avgDomainRank / 20, 30);
            const dofollowScore = dofollowRate * 20;
            const prospectScore = Math.round(Math.min(100, competitorScore + rankScore + dofollowScore));

            // Acquisition difficulty: based on domain rank (high rank = harder to get link from)
            const acquisitionDifficulty: "easy" | "medium" | "hard" = avgDomainRank > 500 ? "hard" : avgDomainRank > 200 ? "medium" : "easy";

            // Suggested channel: heuristic based on link patterns
            let suggestedChannel: "broken_link" | "guest_post" | "resource_page" | "outreach" | "content_mention";
            if (gap.totalLinks > 5) {
                suggestedChannel = "guest_post"; // Actively linking = likely accepts content
            } else if (dofollowRate > 0.8) {
                suggestedChannel = "resource_page"; // High dofollow = may have resource pages
            } else if (gap.competitors.length >= 3) {
                suggestedChannel = "outreach"; // Links to many competitors = industry site
            } else if (gap.anchors.size > 3) {
                suggestedChannel = "content_mention"; // Diverse anchors = editorial links
            } else {
                suggestedChannel = "broken_link"; // Default fallback
            }

            // Estimated impact: based on domain rank and dofollow
            const estimatedImpact = Math.round(Math.min(100, rankScore * 2 + dofollowScore * 1.5 + competitorScore * 0.3));

            await ctx.db.insert("linkBuildingProspects", {
                domainId: args.domainId,
                referringDomain: gap.domain,
                domainRank: avgDomainRank,
                linksToCompetitors: gap.totalLinks,
                competitors: gap.competitors,
                prospectScore,
                acquisitionDifficulty,
                suggestedChannel,
                estimatedImpact,
                status: "identified",
                generatedAt: now,
            });

            generated++;
        }

        return { generated, message: `Generated ${generated} link building prospects` };
    },
});
