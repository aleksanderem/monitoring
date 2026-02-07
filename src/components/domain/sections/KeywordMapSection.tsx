"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { KeywordMapBubbleChart } from "../charts/KeywordMapBubbleChart";
import { IntentDistributionChart } from "../charts/IntentDistributionChart";
import { DifficultyDistributionChart } from "../charts/DifficultyDistributionChart";
import { QuickWinsTable } from "../tables/QuickWinsTable";
import { CompetitorOverlapTable } from "../tables/CompetitorOverlapTable";
import { CannibalizationTable } from "../tables/CannibalizationTable";
import { Target04, Zap, TrendUp02, Hash01, HelpCircle, Star01, MessageChatCircle, Map01, Image01, VideoRecorder, ShoppingBag01, Link01, File07, SearchLg, CheckVerified01, BarChart01, Globe01, BookOpen01 } from "@untitledui/icons";
import { Tooltip, TooltipTrigger } from "react-aria-components";

interface KeywordMapSectionProps {
    domainId: Id<"domains">;
}

type SerpFeatureInfo = {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    importance: "high" | "medium" | "low";
    description: string;
    howToOptimize: string;
};

const SERP_FEATURE_INFO: Record<string, SerpFeatureInfo> = {
    featured_snippet: {
        label: "Featured Snippet",
        icon: Star01,
        color: "text-utility-warning-500",
        importance: "high",
        description: "A summary answer displayed above organic results (position 0). Captures 35-50% of clicks for the query and massively boosts brand authority.",
        howToOptimize: "Structure content with clear Q&A format, use headers that match the query, provide concise 40-60 word answers in a paragraph, list, or table directly below the heading.",
    },
    people_also_ask: {
        label: "People Also Ask",
        icon: MessageChatCircle,
        color: "text-utility-blue-500",
        importance: "high",
        description: "An expandable FAQ box showing related questions. Appears in 40-65% of searches. Each expanded answer links back to a source page, providing additional visibility.",
        howToOptimize: "Add an FAQ section to your page. Answer each related question concisely (40-50 words) under an H2/H3, then expand with detail. Use schema markup (FAQPage) to reinforce.",
    },
    knowledge_panel: {
        label: "Knowledge Panel",
        icon: BookOpen01,
        color: "text-utility-brand-500",
        importance: "medium",
        description: "An information box on the right side of SERP showing key facts about entities (brands, people, places). Signals Google recognizes you as an authority.",
        howToOptimize: "Claim your Google Business Profile, ensure consistent NAP data across directories, use Organization/Person schema markup, and build Wikipedia/Wikidata presence.",
    },
    local_pack: {
        label: "Local Pack",
        icon: Map01,
        color: "text-utility-success-500",
        importance: "high",
        description: "A map with 3 local business results. Dominates clicks for local intent queries (\"near me\", city-based searches). Critical for businesses serving specific geographic areas.",
        howToOptimize: "Optimize Google Business Profile with accurate info, collect reviews (aim for 4.5+ stars), ensure NAP consistency, add local schema markup, create location-specific landing pages.",
    },
    image_pack: {
        label: "Image Pack",
        icon: Image01,
        color: "text-utility-pink-500",
        importance: "medium",
        description: "A row of image thumbnails in search results. Clicking opens Google Images with a link to the source page. Provides an additional entry point to your content.",
        howToOptimize: "Use original, high-quality images. Add descriptive filenames and alt text with target keywords. Implement image sitemap. Use WebP format and proper image dimensions.",
    },
    video: {
        label: "Video Results",
        icon: VideoRecorder,
        color: "text-utility-error-500",
        importance: "medium",
        description: "Video thumbnails (usually from YouTube) embedded in search results. Video results get 41% higher CTR than plain text results and are increasingly favored by Google.",
        howToOptimize: "Create YouTube videos for target keywords. Add timestamps, closed captions, and VideoObject schema. Embed relevant videos on your pages. Optimize video titles and descriptions.",
    },
    shopping_results: {
        label: "Shopping Results",
        icon: ShoppingBag01,
        color: "text-utility-success-600",
        importance: "high",
        description: "Product listings with images, prices, and store names. Appears for commercial/transactional queries. Drives high-intent traffic directly to product pages.",
        howToOptimize: "Set up Google Merchant Center, submit product feed with accurate pricing and availability, use Product schema, add competitive pricing and high-quality product images.",
    },
    sitelinks: {
        label: "Sitelinks",
        icon: Link01,
        color: "text-tertiary",
        importance: "low",
        description: "Additional links below your main result showing key pages on your site. Takes up more SERP real estate and helps users navigate directly to relevant sections.",
        howToOptimize: "Maintain clear site structure with descriptive navigation. Use internal linking. Add breadcrumb schema. Ensure your pages have unique, descriptive titles and meta descriptions.",
    },
    top_stories: {
        label: "Top Stories",
        icon: File07,
        color: "text-utility-orange-500",
        importance: "medium",
        description: "A carousel of recent news articles related to the query. Provides massive short-term traffic spikes for timely content. Requires being indexed as a news source.",
        howToOptimize: "Publish timely, newsworthy content. Register with Google News. Use Article/NewsArticle schema. Ensure fast page load and AMP compatibility. Publish frequently.",
    },
    related_searches: {
        label: "Related Searches",
        icon: SearchLg,
        color: "text-quaternary",
        importance: "low",
        description: "Suggested related queries at the bottom of SERP. These are content ideas straight from Google showing what users also search for around your topic.",
        howToOptimize: "Use these as content ideas. Create content targeting related queries. Add internal links between related topic pages to build topical authority.",
    },
    reviews: {
        label: "Review Stars",
        icon: Star01,
        color: "text-utility-warning-400",
        importance: "medium",
        description: "Star ratings displayed in search results (1-5 stars). Results with review stars see 20-35% higher CTR. Builds trust and stands out visually in SERP.",
        howToOptimize: "Implement Review/AggregateRating schema. Collect genuine customer reviews. Display reviews on product and service pages. Aim for 4+ star average.",
    },
    faq: {
        label: "FAQ Rich Result",
        icon: MessageChatCircle,
        color: "text-utility-blue-400",
        importance: "medium",
        description: "Expandable FAQ answers displayed directly in SERP under your listing. Increases your result's visual size and provides immediate answers that build trust.",
        howToOptimize: "Add FAQPage schema markup to pages with FAQ sections. Each Q&A should be concise but helpful. Keep answers under 300 characters for best display.",
    },
    carousel: {
        label: "Carousel",
        icon: Globe01,
        color: "text-utility-brand-400",
        importance: "low",
        description: "A horizontal scrollable list of results, often showing entities, products, or related topics. Provides visual browsing experience directly on SERP.",
        howToOptimize: "Use structured data (ItemList, Product, or Event schema). Create comprehensive, well-organized content around the topic. Ensure your entities are well-defined.",
    },
    answer_box: {
        label: "Answer Box",
        icon: CheckVerified01,
        color: "text-utility-success-400",
        importance: "high",
        description: "A direct answer to a specific question, displayed prominently above results. Similar to featured snippets but for factual queries (calculations, conversions, definitions).",
        howToOptimize: "Provide clear, factual answers. Use definition lists, tables, and structured formats. Target \"what is\", \"how to\", and question-based queries with concise answers.",
    },
    paid: {
        label: "Paid Ads",
        icon: BarChart01,
        color: "text-quaternary",
        importance: "low",
        description: "Google Ads appearing above or below organic results. When ads dominate a SERP, organic CTR drops significantly. Indicates high commercial value of the keyword.",
        howToOptimize: "For keywords with heavy ad presence, focus on featured snippets and other rich results to stand out. Consider running ads for the most competitive terms.",
    },
    twitter: {
        label: "Twitter/X Results",
        icon: Globe01,
        color: "text-utility-blue-300",
        importance: "low",
        description: "Recent tweets/posts from X (Twitter) shown in a carousel. Appears for trending topics, brands, and public figures. Provides real-time social proof.",
        howToOptimize: "Maintain an active X/Twitter presence. Post about topics you want to rank for. Use relevant hashtags. Engage with trending conversations in your niche.",
    },
    jobs: {
        label: "Jobs Results",
        icon: Globe01,
        color: "text-utility-success-300",
        importance: "low",
        description: "Job listings displayed directly in search results. Appears for job-related queries. Can drive qualified candidate traffic directly from SERP.",
        howToOptimize: "Use JobPosting schema markup. Post jobs on Google for Jobs. Include salary range, location, and job type in structured data.",
    },
    recipes: {
        label: "Recipe Results",
        icon: Globe01,
        color: "text-utility-orange-400",
        importance: "medium",
        description: "Rich recipe cards with images, cooking time, ratings, and calories. Dominates food-related queries and provides a very high CTR due to visual appeal.",
        howToOptimize: "Use Recipe schema with all fields (cook time, ingredients, nutrition, images). Add step-by-step instructions with photos. Include ratings and reviews.",
    },
};

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function KeywordMapSection({ domainId }: KeywordMapSectionProps) {
    const mapData = useQuery(api.keywordMap_queries.getKeywordMapData, { domainId });
    const serpFeatures = useQuery(api.keywordMap_queries.getSerpFeatureOpportunities, { domainId });

    const stats = mapData
        ? {
              total: mapData.length,
              core: mapData.filter((k) => k.keywordType === "core" || k.keywordTypeOverride === "core").length,
              longtail: mapData.filter((k) => k.keywordType === "longtail" || k.keywordTypeOverride === "longtail").length,
              branded: mapData.filter((k) => k.keywordType === "branded" || k.keywordTypeOverride === "branded").length,
              quickWins: mapData.filter((k) => k.quickWinScore > 0).length,
              monitored: mapData.filter((k) => k.isMonitored).length,
              avgDifficulty: mapData.length > 0 ? Math.round(mapData.reduce((s, k) => s + (k.difficulty ?? 0), 0) / mapData.length) : 0,
              totalVolume: mapData.reduce((s, k) => s + (k.searchVolume ?? 0), 0),
          }
        : null;

    return (
        <div className="flex flex-col gap-6">
            {/* Summary Cards */}
            {stats && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                            <Hash01 className="h-4 w-4" />
                            Total Keywords
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(stats.total)}</p>
                        <p className="mt-0.5 text-xs text-tertiary">{stats.monitored} monitored</p>
                    </div>
                    <div className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="flex items-center gap-2 text-sm text-tertiary mb-2">
                            <Target04 className="h-4 w-4" />
                            Keyword Types
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-tertiary">Core</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full bg-brand-500 dark:bg-brand-400" style={{ width: `${stats.total > 0 ? (stats.core / stats.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-sm font-semibold text-primary w-8 text-right">{stats.core}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-tertiary">Long-tail</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full bg-utility-blue-500 dark:bg-utility-blue-400" style={{ width: `${stats.total > 0 ? (stats.longtail / stats.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-sm font-semibold text-primary w-8 text-right">{stats.longtail}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-tertiary">Branded</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full bg-utility-warning-500 dark:bg-utility-warning-400" style={{ width: `${stats.total > 0 ? (stats.branded / stats.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-sm font-semibold text-primary w-8 text-right">{stats.branded}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                            <Zap className="h-4 w-4 text-fg-warning-primary" />
                            Quick Wins
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-utility-success-600">{stats.quickWins}</p>
                        <p className="mt-0.5 text-xs text-tertiary">keywords in striking distance</p>
                    </div>
                    <div className="rounded-xl border border-secondary bg-primary p-4">
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                            <TrendUp02 className="h-4 w-4" />
                            Total Volume
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(stats.totalVolume)}</p>
                        <p className="mt-0.5 text-xs text-tertiary">avg difficulty: {stats.avgDifficulty}</p>
                    </div>
                </div>
            )}

            {/* Bubble Chart */}
            <KeywordMapBubbleChart domainId={domainId} />

            {/* Two-column: Intent + Difficulty distributions */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <IntentDistributionChart domainId={domainId} />
                <DifficultyDistributionChart domainId={domainId} />
            </div>

            {/* SERP Features Opportunities */}
            {serpFeatures && serpFeatures.length > 0 && (
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-md font-semibold text-primary">SERP Feature Opportunities</h3>
                        <TooltipTrigger delay={200}>
                            <button className="inline-flex" aria-label="What are SERP features?">
                                <HelpCircle className="h-4 w-4 text-quaternary" />
                            </button>
                            <Tooltip className="max-w-sm rounded-lg bg-primary px-3 py-2 text-xs text-secondary shadow-lg border border-secondary">
                                SERP features are special result types Google shows beyond the standard blue links, such as featured snippets, image packs, and knowledge panels. Winning these features can dramatically increase your visibility and click-through rate, even if you don't rank #1 organically.
                            </Tooltip>
                        </TooltipTrigger>
                    </div>
                    <p className="mb-4 text-sm text-tertiary">
                        These special Google result types appear for your keywords. Hover over each to learn how to capture them.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {serpFeatures.slice(0, 12).map((feature) => {
                            const info = SERP_FEATURE_INFO[feature.feature];
                            const Icon = info?.icon ?? Globe01;
                            const label = info?.label ?? feature.feature.replace(/_/g, " ");
                            const importanceBadge = info?.importance === "high"
                                ? { text: "High impact", className: "bg-utility-success-50 text-utility-success-700" }
                                : info?.importance === "medium"
                                    ? { text: "Medium impact", className: "bg-utility-warning-50 text-utility-warning-700" }
                                    : { text: "Low impact", className: "bg-secondary text-tertiary" };

                            return (
                                <div key={feature.feature} className="group rounded-lg border border-secondary p-4 transition-colors hover:border-brand-300 hover:bg-primary_hover">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                                                <Icon className={`h-4 w-4 ${info?.color ?? "text-tertiary"}`} />
                                            </div>
                                            <div>
                                                <span className="text-sm font-semibold text-primary">{label}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${importanceBadge.className}`}>
                                                        {importanceBadge.text}
                                                    </span>
                                                    <span className="text-xs text-quaternary">Avg #{feature.avgPosition}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="rounded-full bg-utility-brand-50 px-2 py-0.5 text-xs font-semibold text-utility-brand-600">
                                            {feature.count}
                                        </span>
                                    </div>

                                    {info && (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs leading-relaxed text-tertiary">{info.description}</p>
                                            <div className="rounded-md bg-utility-brand-50/50 px-2.5 py-2">
                                                <p className="text-[11px] font-medium text-utility-brand-700 mb-0.5">How to optimize</p>
                                                <p className="text-[11px] leading-relaxed text-utility-brand-600">{info.howToOptimize}</p>
                                            </div>
                                        </div>
                                    )}

                                    {!info && (
                                        <p className="mt-2 text-xs text-quaternary">
                                            This SERP feature appears for {feature.count} of your keywords at an average position of #{feature.avgPosition}.
                                        </p>
                                    )}

                                    {feature.exampleKeywords && feature.exampleKeywords.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {feature.exampleKeywords.slice(0, 3).map((kw, i) => (
                                                <span key={i} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-tertiary truncate max-w-[140px]">
                                                    {kw}
                                                </span>
                                            ))}
                                            {feature.exampleKeywords.length > 3 && (
                                                <span className="text-[10px] text-quaternary">+{feature.exampleKeywords.length - 3} more</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Wins */}
            <QuickWinsTable domainId={domainId} />

            {/* Competitor Overlap */}
            <CompetitorOverlapTable domainId={domainId} />

            {/* Cannibalization Detection */}
            <CannibalizationTable domainId={domainId} />
        </div>
    );
}
