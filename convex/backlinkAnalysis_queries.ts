import { v } from "convex/values";
import { query } from "./_generated/server";

// ─── Helpers ───────────────────────────────────────────────

const GENERIC_ANCHORS = new Set([
    "click here",
    "here",
    "read more",
    "learn more",
    "visit",
    "website",
    "link",
    "source",
    "view",
    "see more",
    "more",
    "this",
    "go",
    "details",
    "info",
]);

function classifyAnchor(anchor: string, domainName: string): "branded" | "exact_url" | "generic" | "other" {
    const lower = anchor.toLowerCase().trim();
    if (!lower || lower.length === 0) return "generic";

    // Naked URL: looks like a URL
    if (/^https?:\/\//.test(lower) || /^www\./.test(lower) || /\.\w{2,}\//.test(lower)) return "exact_url";

    // Branded: contains domain name (without TLD)
    const domainBase = domainName.replace(/\.(com|org|net|io|pl|co|de|uk|eu|info|biz)$/i, "").toLowerCase();
    if (domainBase.length > 2 && lower.includes(domainBase)) return "branded";

    // Generic: common generic anchors
    if (GENERIC_ANCHORS.has(lower)) return "generic";

    return "other";
}

function computeLinkQualityScore(backlink: {
    rank?: number | null;
    domainFromRank?: number | null;
    dofollow?: boolean | null;
    backlink_spam_score?: number | null;
}): number {
    const rank = Math.min(backlink.rank ?? 0, 1000);
    const domainRank = Math.min(backlink.domainFromRank ?? 0, 1000);
    const dofollowBonus = backlink.dofollow ? 20 : 0;
    const spamPenalty = (backlink.backlink_spam_score ?? 0) * 0.2;

    // Normalize rank and domainRank to 0-30 scale (higher rank = higher score)
    const rankScore = (rank / 1000) * 30;
    const domainRankScore = (domainRank / 1000) * 30;

    return Math.round(Math.max(0, Math.min(100, rankScore + domainRankScore + dofollowBonus - spamPenalty)));
}

// ─── Queries ───────────────────────────────────────────────

// Anchor text distribution: groups anchors by category
export const getAnchorTextDistribution = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const domain = await ctx.db.get(args.domainId);
        if (!domain) return null;

        const backlinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        if (backlinks.length === 0) return null;

        const domainName = domain.domain || "";

        // Category counts
        const categories: Record<string, { count: number; avgRank: number; totalRank: number }> = {
            branded: { count: 0, avgRank: 0, totalRank: 0 },
            exact_url: { count: 0, avgRank: 0, totalRank: 0 },
            generic: { count: 0, avgRank: 0, totalRank: 0 },
            other: { count: 0, avgRank: 0, totalRank: 0 },
        };

        // Individual anchor counts (top anchors)
        const anchorCounts: Record<string, { count: number; dofollow: number; nofollow: number; category: string }> = {};

        for (const bl of backlinks) {
            const anchor = bl.anchor || "(empty)";
            const category = classifyAnchor(anchor, domainName);

            categories[category].count++;
            categories[category].totalRank += bl.domainFromRank ?? 0;

            const anchorKey = anchor.toLowerCase().trim() || "(empty)";
            if (!anchorCounts[anchorKey]) {
                anchorCounts[anchorKey] = { count: 0, dofollow: 0, nofollow: 0, category };
            }
            anchorCounts[anchorKey].count++;
            if (bl.dofollow === true) {
                anchorCounts[anchorKey].dofollow++;
            } else if (bl.dofollow === false) {
                anchorCounts[anchorKey].nofollow++;
            }
        }

        // Compute avg rank per category
        for (const cat of Object.keys(categories)) {
            if (categories[cat].count > 0) {
                categories[cat].avgRank = Math.round(categories[cat].totalRank / categories[cat].count);
            }
        }

        // Sort anchors by count, return top 50
        const topAnchors = Object.entries(anchorCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 50)
            .map(([anchor, data]) => ({
                anchor,
                count: data.count,
                dofollow: data.dofollow,
                nofollow: data.nofollow,
                category: data.category,
                percentage: Math.round((data.count / backlinks.length) * 1000) / 10,
            }));

        return {
            total: backlinks.length,
            categories: Object.entries(categories).map(([name, data]) => ({
                name,
                count: data.count,
                percentage: Math.round((data.count / backlinks.length) * 1000) / 10,
                avgRank: data.avgRank,
            })),
            topAnchors,
        };
    },
});

// Link quality score distribution
export const getLinkQualityScores = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const backlinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        if (backlinks.length === 0) return null;

        const buckets = {
            excellent: { min: 70, max: 100, count: 0 },
            good: { min: 40, max: 69, count: 0 },
            average: { min: 20, max: 39, count: 0 },
            poor: { min: 0, max: 19, count: 0 },
        };

        let totalScore = 0;
        const scored = backlinks.map((bl) => {
            const score = computeLinkQualityScore(bl);
            totalScore += score;

            if (score >= 70) buckets.excellent.count++;
            else if (score >= 40) buckets.good.count++;
            else if (score >= 20) buckets.average.count++;
            else buckets.poor.count++;

            return {
                _id: bl._id,
                urlFrom: bl.urlFrom,
                domainFrom: bl.domainFrom,
                anchor: bl.anchor,
                qualityScore: score,
                rank: bl.rank,
                domainFromRank: bl.domainFromRank,
                dofollow: bl.dofollow,
                spamScore: bl.backlink_spam_score,
            };
        });

        // Sort by quality desc, return top 100
        scored.sort((a, b) => b.qualityScore - a.qualityScore);

        return {
            avgScore: Math.round(totalScore / backlinks.length),
            distribution: Object.entries(buckets).map(([tier, data]) => ({
                tier,
                count: data.count,
                percentage: Math.round((data.count / backlinks.length) * 1000) / 10,
                min: data.min,
                max: data.max,
            })),
            topLinks: scored.slice(0, 100),
        };
    },
});

// Referring domain intelligence: group by domainFrom
export const getReferringDomainIntelligence = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const backlinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        if (backlinks.length === 0) return null;

        const domainMap: Record<
            string,
            {
                count: number;
                dofollow: number;
                nofollow: number;
                totalRank: number;
                totalDomainRank: number;
                totalSpam: number;
                spamCount: number;
                anchors: Record<string, number>;
                firstSeen: string | null;
                lastSeen: string | null;
                country: string | null;
            }
        > = {};

        for (const bl of backlinks) {
            const domain = bl.domainFrom || "(unknown)";
            if (!domainMap[domain]) {
                domainMap[domain] = {
                    count: 0,
                    dofollow: 0,
                    nofollow: 0,
                    totalRank: 0,
                    totalDomainRank: 0,
                    totalSpam: 0,
                    spamCount: 0,
                    anchors: {},
                    firstSeen: null,
                    lastSeen: null,
                    country: null,
                };
            }

            const d = domainMap[domain];
            d.count++;
            if (bl.dofollow === true) d.dofollow++;
            else if (bl.dofollow === false) d.nofollow++;
            d.totalRank += bl.rank ?? 0;
            d.totalDomainRank += bl.domainFromRank ?? 0;
            if (bl.backlink_spam_score != null) {
                d.totalSpam += bl.backlink_spam_score;
                d.spamCount++;
            }
            const anchor = bl.anchor || "(empty)";
            d.anchors[anchor] = (d.anchors[anchor] || 0) + 1;

            if (bl.firstSeen && (!d.firstSeen || bl.firstSeen < d.firstSeen)) d.firstSeen = bl.firstSeen;
            if (bl.lastSeen && (!d.lastSeen || bl.lastSeen > d.lastSeen)) d.lastSeen = bl.lastSeen;
            if (bl.domainFromCountry) d.country = bl.domainFromCountry;
        }

        const domains = Object.entries(domainMap)
            .map(([domain, data]) => {
                // Get top 3 anchors
                const topAnchors = Object.entries(data.anchors)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([anchor, count]) => ({ anchor, count }));

                const avgRank = data.count > 0 ? Math.round(data.totalDomainRank / data.count) : 0;
                const avgSpam = data.spamCount > 0 ? Math.round(data.totalSpam / data.spamCount) : null;

                return {
                    domain,
                    linkCount: data.count,
                    dofollow: data.dofollow,
                    nofollow: data.nofollow,
                    dofollowPercent: Math.round((data.dofollow / data.count) * 100),
                    avgDomainRank: avgRank,
                    avgSpamScore: avgSpam,
                    qualityScore: computeLinkQualityScore({
                        rank: data.totalRank / data.count,
                        domainFromRank: avgRank,
                        dofollow: data.dofollow > data.nofollow,
                        backlink_spam_score: avgSpam,
                    }),
                    topAnchors,
                    firstSeen: data.firstSeen,
                    lastSeen: data.lastSeen,
                    country: data.country,
                };
            })
            .sort((a, b) => b.qualityScore - a.qualityScore);

        return {
            totalDomains: domains.length,
            domains: domains.slice(0, 200),
        };
    },
});

// Toxic links: backlinks with high spam score
export const getToxicLinks = query({
    args: {
        domainId: v.id("domains"),
        threshold: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const threshold = args.threshold ?? 70;

        const backlinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        if (backlinks.length === 0) return null;

        const toxic = backlinks
            .filter((bl) => (bl.backlink_spam_score ?? 0) >= threshold)
            .sort((a, b) => (b.backlink_spam_score ?? 0) - (a.backlink_spam_score ?? 0))
            .slice(0, 200)
            .map((bl) => ({
                _id: bl._id,
                urlFrom: bl.urlFrom,
                urlTo: bl.urlTo,
                domainFrom: bl.domainFrom,
                anchor: bl.anchor,
                spamScore: bl.backlink_spam_score ?? 0,
                domainFromRank: bl.domainFromRank,
                dofollow: bl.dofollow,
                firstSeen: bl.firstSeen,
                lastSeen: bl.lastSeen,
                country: bl.domainFromCountry,
            }));

        const totalWithSpam = backlinks.filter((bl) => bl.backlink_spam_score != null).length;
        const toxicCount = backlinks.filter((bl) => (bl.backlink_spam_score ?? 0) >= threshold).length;

        return {
            toxicCount,
            totalAnalyzed: totalWithSpam,
            toxicPercentage: totalWithSpam > 0 ? Math.round((toxicCount / totalWithSpam) * 1000) / 10 : 0,
            avgSpamScore: totalWithSpam > 0 ? Math.round(backlinks.reduce((s, bl) => s + (bl.backlink_spam_score ?? 0), 0) / totalWithSpam) : 0,
            items: toxic,
        };
    },
});

// Backlink gap: domains linking to competitors but NOT to us
export const getBacklinkGap = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        // Get our backlinks
        const ourBacklinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        // Get our referring domains
        const ourDomains = new Set(ourBacklinks.map((bl) => bl.domainFrom).filter(Boolean));

        // Get competitors
        const competitors = await ctx.db
            .query("competitors")
            .withIndex("by_domain_status", (q) => q.eq("domainId", args.domainId).eq("status", "active"))
            .collect();

        if (competitors.length === 0) {
            return { gaps: [], competitorCount: 0, totalGapDomains: 0 };
        }

        // Collect competitor backlinks
        const gapMap: Record<
            string,
            {
                domain: string;
                competitors: string[];
                totalLinks: number;
                avgDomainRank: number;
                totalDomainRank: number;
                dofollow: number;
                topAnchors: Record<string, number>;
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
                    gapMap[domain] = {
                        domain,
                        competitors: [],
                        totalLinks: 0,
                        avgDomainRank: 0,
                        totalDomainRank: 0,
                        dofollow: 0,
                        topAnchors: {},
                    };
                }

                const g = gapMap[domain];
                if (!g.competitors.includes(comp.competitorDomain)) {
                    g.competitors.push(comp.competitorDomain);
                }
                g.totalLinks++;
                g.totalDomainRank += bl.domainFromRank ?? 0;
                if (bl.dofollow === true) g.dofollow++;
                const anchor = bl.anchor || "(empty)";
                g.topAnchors[anchor] = (g.topAnchors[anchor] || 0) + 1;
            }
        }

        // Compute scores and sort
        const gaps = Object.values(gapMap)
            .map((g) => {
                const avgRank = g.totalLinks > 0 ? Math.round(g.totalDomainRank / g.totalLinks) : 0;
                const topAnchors = Object.entries(g.topAnchors)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([anchor, count]) => ({ anchor, count }));

                // Priority score: more competitors linking = higher priority, higher domain rank = better
                const competitorScore = g.competitors.length * 25;
                const rankScore = Math.min(avgRank / 10, 50);
                const priorityScore = Math.round(Math.min(100, competitorScore + rankScore));

                return {
                    domain: g.domain,
                    competitorCount: g.competitors.length,
                    competitors: g.competitors,
                    totalLinks: g.totalLinks,
                    avgDomainRank: avgRank,
                    dofollowPercent: g.totalLinks > 0 ? Math.round((g.dofollow / g.totalLinks) * 100) : 0,
                    topAnchors,
                    priorityScore,
                };
            })
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .slice(0, 200);

        return {
            gaps,
            competitorCount: competitors.length,
            totalGapDomains: Object.keys(gapMap).length,
        };
    },
});
