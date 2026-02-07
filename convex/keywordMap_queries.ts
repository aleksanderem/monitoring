import { v } from "convex/values";
import { query } from "./_generated/server";

// Difficulty tier classification
function getDifficultyTier(difficulty: number | null | undefined): "easy" | "medium" | "hard" | "very_hard" | "unknown" {
    if (difficulty === null || difficulty === undefined) return "unknown";
    if (difficulty < 30) return "easy";
    if (difficulty < 50) return "medium";
    if (difficulty < 75) return "hard";
    return "very_hard";
}

// Auto-detect keyword type from phrase
function detectKeywordType(phrase: string, domainName: string): "core" | "longtail" | "branded" {
    const words = phrase.trim().split(/\s+/);
    const domainBase = domainName.replace(/\.(com|pl|net|org|io|co|eu|de|uk)$/i, "").replace(/^www\./, "");
    if (phrase.toLowerCase().includes(domainBase.toLowerCase())) return "branded";
    if (words.length >= 4) return "longtail";
    return "core";
}

// Calculate quick win score: higher = better opportunity
function calculateQuickWinScore(position: number | null, searchVolume: number | null, difficulty: number | null): number {
    if (!position || !searchVolume || position > 30 || position <= 3) return 0;
    const positionFactor = position >= 11 && position <= 20 ? 1.5 : 1.0;
    const difficultyBonus = difficulty !== null ? (100 - difficulty) / 100 : 0.5;
    return Math.round(searchVolume * difficultyBonus * positionFactor / position);
}

/**
 * Main keyword map data — joins keywords + discoveredKeywords with computed analytics fields
 */
export const getKeywordMapData = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const domain = await ctx.db.get(args.domainId);
        if (!domain) return [];
        const domainName = domain.domain;

        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        // Also get monitored keywords to mark which ones are monitored
        const monitoredKeywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        const monitoredPhrases = new Set(monitoredKeywords.map((k) => k.phrase.toLowerCase()));

        return discoveredKeywords
            .filter((dk) => dk.bestPosition > 0 && dk.bestPosition !== 999)
            .map((dk) => {
                const keywordType = detectKeywordType(dk.keyword, domainName);
                const difficultyTier = getDifficultyTier(dk.difficulty);
                const quickWinScore = calculateQuickWinScore(dk.bestPosition, dk.searchVolume ?? null, dk.difficulty ?? null);
                const monitoredKeyword = monitoredKeywords.find((k) => k.phrase.toLowerCase() === dk.keyword.toLowerCase());

                return {
                    _id: dk._id,
                    keyword: dk.keyword,
                    position: dk.bestPosition,
                    previousPosition: dk.previousPosition ?? null,
                    url: dk.url,
                    searchVolume: dk.searchVolume ?? null,
                    difficulty: dk.difficulty ?? null,
                    cpc: dk.cpc ?? null,
                    etv: dk.etv ?? null,
                    intent: dk.intent ?? null,
                    competitionLevel: dk.competitionLevel ?? null,
                    serpFeatures: dk.serpFeatures ?? [],
                    keywordType,
                    keywordTypeOverride: monitoredKeyword?.keywordType ?? null,
                    difficultyTier,
                    quickWinScore,
                    isMonitored: monitoredPhrases.has(dk.keyword.toLowerCase()),
                    monitoredKeywordId: monitoredKeyword?._id ?? null,
                    isNew: dk.isNew ?? false,
                    isUp: dk.isUp ?? false,
                    isDown: dk.isDown ?? false,
                    monthlySearches: dk.monthlySearches ?? null,
                    backlinksInfo: dk.backlinksInfo ?? null,
                };
            });
    },
});

/**
 * Quick wins — keywords in striking distance (pos 4-30) with low difficulty and decent volume
 */
export const getQuickWins = query({
    args: {
        domainId: v.id("domains"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;

        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        // Join with monitored keywords to check isMonitored status
        const monitoredKeywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();
        const monitoredMap = new Map(monitoredKeywords.map((k) => [k.phrase.toLowerCase(), k._id]));

        const quickWins = discoveredKeywords
            .filter((dk) => {
                const pos = dk.bestPosition;
                const vol = dk.searchVolume ?? 0;
                const diff = dk.difficulty ?? 100;
                return pos > 3 && pos <= 30 && vol >= 100 && diff < 50;
            })
            .map((dk) => ({
                _id: dk._id,
                keyword: dk.keyword,
                position: dk.bestPosition,
                previousPosition: dk.previousPosition ?? null,
                positionChange: dk.previousPosition ? dk.previousPosition - dk.bestPosition : null,
                searchVolume: dk.searchVolume ?? 0,
                difficulty: dk.difficulty ?? 0,
                cpc: dk.cpc ?? null,
                etv: dk.etv ?? null,
                intent: dk.intent ?? null,
                url: dk.url,
                title: dk.title ?? null,
                mainDomainRank: dk.mainDomainRank ?? null,
                serpFeatures: dk.serpFeatures ?? [],
                backlinksInfo: dk.backlinksInfo as { referringDomains?: number; referringPages?: number; dofollow?: number; backlinks?: number } | null ?? null,
                isMonitored: monitoredMap.has(dk.keyword.toLowerCase()),
                monitoredKeywordId: monitoredMap.get(dk.keyword.toLowerCase()) ?? null,
                quickWinScore: calculateQuickWinScore(dk.bestPosition, dk.searchVolume ?? null, dk.difficulty ?? null),
            }))
            .sort((a, b) => b.quickWinScore - a.quickWinScore)
            .slice(0, limit);

        return quickWins;
    },
});

/**
 * Action plan for a quick win keyword — SERP competitors, backlink gaps, recommendations
 */
export const getQuickWinActionPlan = query({
    args: {
        domainId: v.id("domains"),
        discoveredKeywordId: v.id("discoveredKeywords"),
    },
    handler: async (ctx, args) => {
        // 1. Get the discovered keyword
        const dk = await ctx.db.get(args.discoveredKeywordId);
        if (!dk || dk.domainId !== args.domainId) return null;

        const domain = await ctx.db.get(args.domainId);
        if (!domain) return null;

        // 2. Check if monitored
        const monitoredKeywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();
        const monitoredKeyword = monitoredKeywords.find(
            (k) => k.phrase.toLowerCase() === dk.keyword.toLowerCase() && k.status === "active"
        );

        // 3. Get SERP results if monitored
        let serpCompetitors: Array<{
            position: number;
            domain: string;
            url: string;
            title: string | null;
            isYourDomain: boolean;
        }> | null = null;

        if (monitoredKeyword) {
            const serpResults = await ctx.db
                .query("keywordSerpResults")
                .withIndex("by_keyword", (q) => q.eq("keywordId", monitoredKeyword._id))
                .order("desc")
                .take(200);

            if (serpResults.length > 0) {
                const latestDate = serpResults[0].date;
                const latestResults = serpResults
                    .filter((r) => r.date === latestDate)
                    .sort((a, b) => a.position - b.position)
                    .slice(0, 10);

                serpCompetitors = latestResults.map((r) => ({
                    position: r.position,
                    domain: r.mainDomain || r.domain,
                    url: r.url,
                    title: r.title ?? null,
                    isYourDomain: r.isYourDomain,
                }));
            }
        }

        // 4. Get active competitors
        const competitors = await ctx.db
            .query("competitors")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.eq(q.field("status"), "active"))
            .collect();

        // 5. Competitor backlink profiles (for those ranking in SERP or all active)
        const competitorProfiles: Array<{
            domain: string;
            position: number | null;
            totalBacklinks: number;
            referringDomains: number;
            dofollow: number;
        }> = [];

        for (const comp of competitors) {
            const compDomain = comp.competitorDomain.toLowerCase().replace(/^www\./, "");
            const serpEntry = serpCompetitors?.find((s) => {
                const sDomain = s.domain.toLowerCase().replace(/^www\./, "");
                return sDomain === compDomain || sDomain.endsWith("." + compDomain);
            });

            const summary = await ctx.db
                .query("competitorBacklinksSummary")
                .withIndex("by_competitor", (q) => q.eq("competitorId", comp._id))
                .unique();

            if (summary) {
                competitorProfiles.push({
                    domain: comp.competitorDomain,
                    position: serpEntry?.position ?? null,
                    totalBacklinks: summary.totalBacklinks,
                    referringDomains: summary.totalDomains,
                    dofollow: summary.dofollow,
                });
            }
        }

        // Sort: competitors with SERP positions first, then by referring domains
        competitorProfiles.sort((a, b) => {
            if (a.position !== null && b.position === null) return -1;
            if (a.position === null && b.position !== null) return 1;
            if (a.position !== null && b.position !== null) return a.position - b.position;
            return b.referringDomains - a.referringDomains;
        });

        // 6. Our backlink profile
        const ourSummary = await ctx.db
            .query("domainBacklinksSummary")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .unique();

        const yourBacklinkProfile = ourSummary
            ? { totalBacklinks: ourSummary.totalBacklinks, referringDomains: ourSummary.totalDomains, dofollow: ourSummary.dofollow }
            : null;

        // 7. Backlink gap — domains linking to competitors but not to us (top 15)
        const ourBacklinks = await ctx.db
            .query("domainBacklinks")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();
        const ourDomains = new Set(ourBacklinks.map((bl) => bl.domainFrom).filter(Boolean));

        const gapMap: Record<string, {
            domain: string;
            competitors: string[];
            totalLinks: number;
            totalDomainRank: number;
            dofollow: number;
            topAnchors: Record<string, number>;
        }> = {};

        for (const comp of competitors.slice(0, 10)) {
            const compBacklinks = await ctx.db
                .query("competitorBacklinks")
                .withIndex("by_competitor", (q) => q.eq("competitorId", comp._id))
                .collect();

            for (const bl of compBacklinks) {
                const blDomain = bl.domainFrom;
                if (!blDomain || ourDomains.has(blDomain)) continue;

                if (!gapMap[blDomain]) {
                    gapMap[blDomain] = { domain: blDomain, competitors: [], totalLinks: 0, totalDomainRank: 0, dofollow: 0, topAnchors: {} };
                }
                const g = gapMap[blDomain];
                if (!g.competitors.includes(comp.competitorDomain)) g.competitors.push(comp.competitorDomain);
                g.totalLinks++;
                g.totalDomainRank += bl.domainFromRank ?? 0;
                if (bl.dofollow === true) g.dofollow++;
                const anchor = bl.anchor || "(empty)";
                g.topAnchors[anchor] = (g.topAnchors[anchor] || 0) + 1;
            }
        }

        const backlinkGapTargets = Object.values(gapMap)
            .map((g) => {
                const avgRank = g.totalLinks > 0 ? Math.round(g.totalDomainRank / g.totalLinks) : 0;
                const topAnchors = Object.entries(g.topAnchors)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([anchor]) => anchor);
                const priorityScore = Math.round(Math.min(100, g.competitors.length * 25 + Math.min(avgRank / 10, 50)));
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
            .slice(0, 15);

        // 8. Generate recommendations
        const recommendations: Array<{
            category: "links" | "content" | "serp_features" | "technical";
            priority: "high" | "medium" | "low";
            title: string;
            description: string;
            actionSteps: string[];
        }> = [];

        const position = dk.bestPosition;
        const intent = dk.intent ?? "informational";
        const serpFeatures = dk.serpFeatures ?? [];
        const ourRefDomains = yourBacklinkProfile?.referringDomains ?? 0;
        const avgCompRefDomains = competitorProfiles.length > 0
            ? Math.round(competitorProfiles.reduce((s, c) => s + c.referringDomains, 0) / competitorProfiles.length)
            : 0;
        const refDomainGap = avgCompRefDomains - ourRefDomains;

        // Links recommendations
        if (refDomainGap > 0 && backlinkGapTargets.length > 0) {
            recommendations.push({
                category: "links",
                priority: refDomainGap > 50 ? "high" : "medium",
                title: `Close the referring domain gap (${refDomainGap > 0 ? "+" : ""}${refDomainGap} gap)`,
                description: `Competitors have on average ${avgCompRefDomains} referring domains vs your ${ourRefDomains}. Focus on acquiring links from domains that already link to competitors.`,
                actionSteps: [
                    `Target the top ${Math.min(backlinkGapTargets.length, 5)} gap domains that link to ${backlinkGapTargets[0]?.competitorCount ?? 0}+ competitors`,
                    "Start with guest posting or resource link outreach to highest priority targets",
                    "Focus on dofollow links from domains with rank 50+",
                    "Track new referring domains weekly to measure progress",
                ],
            });
        }

        if (backlinkGapTargets.length >= 3) {
            const multiCompTargets = backlinkGapTargets.filter((t) => t.competitorCount >= 2);
            if (multiCompTargets.length > 0) {
                recommendations.push({
                    category: "links",
                    priority: "high",
                    title: `${multiCompTargets.length} shared competitor link sources found`,
                    description: `These domains link to multiple competitors but not to you — they are likely open to linking to similar content.`,
                    actionSteps: [
                        `Reach out to ${multiCompTargets[0].domain} (links to ${multiCompTargets[0].competitorCount} competitors)`,
                        "Analyze what content competitors used to earn these links",
                        "Create equal or better content to pitch for link placement",
                    ],
                });
            }
        }

        // Content recommendations by intent
        if (intent === "informational") {
            recommendations.push({
                category: "content",
                priority: position <= 10 ? "medium" : "high",
                title: "Optimize for informational intent",
                description: "Searchers want detailed answers. Structure content for comprehensive coverage with clear headings.",
                actionSteps: [
                    "Add an FAQ section with related questions",
                    "Include data, statistics, and expert quotes",
                    "Add table of contents for long content",
                    "Use schema markup (FAQ, HowTo) for rich results",
                ],
            });
        } else if (intent === "commercial") {
            recommendations.push({
                category: "content",
                priority: position <= 10 ? "medium" : "high",
                title: "Optimize for commercial investigation intent",
                description: "Searchers are comparing options. Create content that helps with decision-making.",
                actionSteps: [
                    "Add comparison tables with clear feature breakdowns",
                    "Include pros/cons lists and user reviews",
                    "Add pricing information and value propositions",
                    "Use Product schema markup for rich results",
                ],
            });
        } else if (intent === "transactional") {
            recommendations.push({
                category: "content",
                priority: "high",
                title: "Optimize for transactional intent",
                description: "Searchers are ready to act. Minimize friction between landing and conversion.",
                actionSteps: [
                    "Add clear CTAs above the fold",
                    "Include trust signals: reviews, certifications, guarantees",
                    "Optimize page speed — every second counts for conversions",
                    "Add Product/Offer schema markup",
                ],
            });
        }

        // SERP feature recommendations
        if (serpFeatures.includes("featured_snippet") || serpFeatures.includes("people_also_ask")) {
            recommendations.push({
                category: "serp_features",
                priority: "high",
                title: "Target the Featured Snippet / PAA",
                description: "This keyword shows a featured snippet or PAA boxes — winning these can jump you to position 0.",
                actionSteps: [
                    "Add a concise 40-60 word answer to the main question near the top",
                    "Use a paragraph, list, or table format matching the current snippet type",
                    "Add H2/H3 headers phrased as common questions",
                    "Include structured data (FAQ schema)",
                ],
            });
        }
        if (serpFeatures.includes("local_pack")) {
            recommendations.push({
                category: "serp_features",
                priority: "medium",
                title: "Local pack detected",
                description: "Google shows a local map pack. If you have a physical location, optimize for local SEO.",
                actionSteps: [
                    "Claim and optimize your Google Business Profile",
                    "Ensure NAP consistency (Name, Address, Phone) across all directories",
                    "Get local reviews on Google and industry-specific platforms",
                ],
            });
        }
        if (serpFeatures.includes("video")) {
            recommendations.push({
                category: "serp_features",
                priority: "medium",
                title: "Video results showing",
                description: "Google displays video results for this keyword. Creating video content could earn you an additional SERP spot.",
                actionSteps: [
                    "Create a YouTube video targeting this keyword",
                    "Embed the video on your ranking page",
                    "Add VideoObject schema markup",
                ],
            });
        }

        // Technical / position-based
        if (position >= 4 && position <= 10) {
            recommendations.push({
                category: "technical",
                priority: "medium",
                title: "Almost there — page 1 optimization",
                description: `You're at position #${position}. Small technical improvements can push you into top 3.`,
                actionSteps: [
                    "Improve page Core Web Vitals (LCP < 2.5s, CLS < 0.1)",
                    "Optimize title tag and meta description for higher CTR",
                    "Add internal links from your highest-authority pages",
                    "Ensure content is more comprehensive than top 3 results",
                ],
            });
        } else if (position >= 11 && position <= 20) {
            recommendations.push({
                category: "technical",
                priority: "high",
                title: "Push from page 2 to page 1",
                description: `Position #${position} is close to page 1. Focus on both content depth and link authority.`,
                actionSteps: [
                    "Expand content by 30-50% with additional subtopics",
                    "Build 5-10 quality backlinks to this page specifically",
                    "Add 3-5 internal links from relevant pages",
                    "Improve page load speed and mobile usability",
                ],
            });
        }

        return {
            keyword: {
                _id: dk._id,
                keyword: dk.keyword,
                position: dk.bestPosition,
                previousPosition: dk.previousPosition ?? null,
                positionChange: dk.previousPosition ? dk.previousPosition - dk.bestPosition : null,
                url: dk.url,
                title: dk.title ?? null,
                description: dk.description ?? null,
                searchVolume: dk.searchVolume ?? null,
                difficulty: dk.difficulty ?? null,
                cpc: dk.cpc ?? null,
                etv: dk.etv ?? null,
                intent: dk.intent ?? null,
                serpFeatures: dk.serpFeatures ?? [],
                mainDomainRank: dk.mainDomainRank ?? null,
                pageRank: dk.pageRank ?? null,
                backlinksInfo: dk.backlinksInfo as { referringDomains?: number; referringPages?: number; dofollow?: number; backlinks?: number } | null ?? null,
                competitionLevel: dk.competitionLevel ?? null,
            },
            isMonitored: !!monitoredKeyword,
            monitoredKeywordId: monitoredKeyword?._id ?? null,
            serpCompetitors,
            competitorProfiles,
            yourBacklinkProfile,
            backlinkGapTargets,
            recommendations,
        };
    },
});

/**
 * Difficulty distribution — bucket counts for easy/medium/hard/very_hard
 */
export const getDifficultyDistribution = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.neq(q.field("bestPosition"), 999))
            .collect();

        const distribution = { easy: 0, medium: 0, hard: 0, very_hard: 0, unknown: 0 };
        const volumeByTier = { easy: 0, medium: 0, hard: 0, very_hard: 0, unknown: 0 };

        for (const dk of discoveredKeywords) {
            const tier = getDifficultyTier(dk.difficulty);
            distribution[tier]++;
            volumeByTier[tier] += dk.searchVolume ?? 0;
        }

        return {
            distribution,
            volumeByTier,
            total: discoveredKeywords.length,
        };
    },
});

/**
 * Intent distribution — group keywords by search intent
 */
export const getIntentDistribution = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.neq(q.field("bestPosition"), 999))
            .collect();

        const intents: Record<string, { count: number; totalVolume: number; avgPosition: number; positionSum: number }> = {
            commercial: { count: 0, totalVolume: 0, avgPosition: 0, positionSum: 0 },
            informational: { count: 0, totalVolume: 0, avgPosition: 0, positionSum: 0 },
            navigational: { count: 0, totalVolume: 0, avgPosition: 0, positionSum: 0 },
            transactional: { count: 0, totalVolume: 0, avgPosition: 0, positionSum: 0 },
            unknown: { count: 0, totalVolume: 0, avgPosition: 0, positionSum: 0 },
        };

        for (const dk of discoveredKeywords) {
            const intent = dk.intent ?? "unknown";
            const bucket = intents[intent] ?? intents.unknown;
            bucket.count++;
            bucket.totalVolume += dk.searchVolume ?? 0;
            bucket.positionSum += dk.bestPosition;
        }

        // Calculate averages
        for (const key of Object.keys(intents)) {
            const bucket = intents[key];
            bucket.avgPosition = bucket.count > 0 ? Math.round((bucket.positionSum / bucket.count) * 10) / 10 : 0;
        }

        return intents;
    },
});

/**
 * SERP feature opportunities — which SERP features appear for your keywords
 */
export const getSerpFeatureOpportunities = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.neq(q.field("bestPosition"), 999))
            .collect();

        const featureMap: Record<string, { count: number; keywords: string[]; avgPosition: number; positionSum: number }> = {};

        for (const dk of discoveredKeywords) {
            if (!dk.serpFeatures || dk.serpFeatures.length === 0) continue;
            for (const feature of dk.serpFeatures) {
                if (!featureMap[feature]) {
                    featureMap[feature] = { count: 0, keywords: [], avgPosition: 0, positionSum: 0 };
                }
                featureMap[feature].count++;
                featureMap[feature].positionSum += dk.bestPosition;
                if (featureMap[feature].keywords.length < 5) {
                    featureMap[feature].keywords.push(dk.keyword);
                }
            }
        }

        const features = Object.entries(featureMap)
            .map(([name, data]) => ({
                feature: name,
                count: data.count,
                avgPosition: data.count > 0 ? Math.round((data.positionSum / data.count) * 10) / 10 : 0,
                exampleKeywords: data.keywords,
            }))
            .sort((a, b) => b.count - a.count);

        return features;
    },
});

/**
 * Competitor overlap matrix — from SERP results, which competitors appear in top 10 for each keyword
 */
export const getCompetitorOverlapMatrix = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const domain = await ctx.db.get(args.domainId);
        if (!domain) return { competitors: [], keywords: [], matrix: [] };

        // Get known competitors
        const competitors = await ctx.db
            .query("competitors")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.eq(q.field("status"), "active"))
            .collect();

        const competitorDomains = competitors.map((c) => c.competitorDomain.toLowerCase().replace(/^www\./, ""));

        if (competitorDomains.length === 0) return { competitors: [], keywords: [], matrix: [] };

        // Get monitored keywords
        const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.eq(q.field("status"), "active"))
            .collect();

        const matrix: Array<{
            keyword: string;
            keywordId: string;
            yourPosition: number | null;
            competitors: Array<{ domain: string; position: number | null }>;
        }> = [];

        for (const keyword of keywords.slice(0, 50)) {
            // Get most recent SERP results for this keyword
            const serpResults = await ctx.db
                .query("keywordSerpResults")
                .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
                .order("desc")
                .take(100);

            if (serpResults.length === 0) continue;

            const latestDate = serpResults[0].date;
            const latestResults = serpResults.filter((r) => r.date === latestDate);

            // Find your domain position
            const yourResult = latestResults.find((r) => r.isYourDomain);
            const yourPosition = yourResult?.position ?? null;

            // Find competitor positions
            const competitorPositions = competitorDomains.map((compDomain) => {
                const compResult = latestResults.find((r) => {
                    const resultDomain = (r.mainDomain || r.domain || "").toLowerCase().replace(/^www\./, "");
                    return resultDomain === compDomain || resultDomain.endsWith("." + compDomain);
                });
                return {
                    domain: compDomain,
                    position: compResult?.position ?? null,
                };
            });

            matrix.push({
                keyword: keyword.phrase,
                keywordId: keyword._id,
                yourPosition,
                competitors: competitorPositions,
            });
        }

        return {
            competitors: competitorDomains,
            keywords: matrix.map((m) => m.keyword),
            matrix,
        };
    },
});

/**
 * Keyword cannibalization — URLs ranking for multiple keywords
 */
export const getKeywordCannibalization = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.eq(q.field("status"), "active"))
            .collect();

        // Collect URL → keywords mapping from SERP results
        const urlKeywordMap: Record<string, Array<{ keyword: string; position: number }>> = {};

        for (const keyword of keywords) {
            const serpResults = await ctx.db
                .query("keywordSerpResults")
                .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
                .order("desc")
                .take(100);

            if (serpResults.length === 0) continue;

            const latestDate = serpResults[0].date;
            const yourResults = serpResults.filter((r) => r.date === latestDate && r.isYourDomain);

            for (const result of yourResults) {
                const normalizedUrl = result.url.replace(/\/$/, "").toLowerCase();
                if (!urlKeywordMap[normalizedUrl]) {
                    urlKeywordMap[normalizedUrl] = [];
                }
                urlKeywordMap[normalizedUrl].push({
                    keyword: keyword.phrase,
                    position: result.position,
                });
            }
        }

        // Filter URLs with multiple keywords (cannibalization candidates)
        const cannibalization = Object.entries(urlKeywordMap)
            .filter(([, keywords]) => keywords.length > 1)
            .map(([url, keywords]) => ({
                url,
                keywordCount: keywords.length,
                keywords: keywords.sort((a, b) => a.position - b.position),
                avgPosition: Math.round((keywords.reduce((sum, k) => sum + k.position, 0) / keywords.length) * 10) / 10,
                totalVolume: 0, // Would need to join with search volume data
            }))
            .sort((a, b) => b.keywordCount - a.keywordCount);

        return cannibalization;
    },
});

/**
 * Monthly search trends — aggregate monthly search volume from discoveredKeywords
 */
export const getMonthlySearchTrends = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.neq(q.field("bestPosition"), 999))
            .collect();

        // Aggregate monthly search volumes across all keywords
        const monthlyTotals: Record<string, number> = {};
        let keywordsWithData = 0;

        for (const dk of discoveredKeywords) {
            if (!dk.monthlySearches || !Array.isArray(dk.monthlySearches)) continue;
            keywordsWithData++;
            for (const entry of dk.monthlySearches as Array<{ year: number; month: number; search_volume: number }>) {
                const key = `${entry.year}-${String(entry.month).padStart(2, "0")}`;
                monthlyTotals[key] = (monthlyTotals[key] ?? 0) + (entry.search_volume ?? 0);
            }
        }

        const trends = Object.entries(monthlyTotals)
            .map(([month, totalVolume]) => ({ month, totalVolume }))
            .sort((a, b) => a.month.localeCompare(b.month));

        return {
            trends,
            keywordsWithData,
            totalKeywords: discoveredKeywords.length,
        };
    },
});

/**
 * Bubble chart data — formatted for Recharts ScatterChart
 */
export const getKeywordMapBubbleData = query({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const domain = await ctx.db.get(args.domainId);
        if (!domain) return [];

        const discoveredKeywords = await ctx.db
            .query("discoveredKeywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .filter((q) => q.neq(q.field("bestPosition"), 999))
            .collect();

        return discoveredKeywords
            .filter((dk) => dk.searchVolume && dk.difficulty !== undefined && dk.difficulty !== null)
            .map((dk) => ({
                keyword: dk.keyword,
                difficulty: dk.difficulty!,
                searchVolume: dk.searchVolume!,
                etv: dk.etv ?? 0,
                intent: dk.intent ?? "unknown",
                position: dk.bestPosition,
                cpc: dk.cpc ?? 0,
                url: dk.url,
            }))
            .slice(0, 500); // Limit for performance
    },
});
