"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { KeywordMapBubbleChart } from "../charts/KeywordMapBubbleChart";
import { IntentDistributionChart } from "../charts/IntentDistributionChart";
import { DifficultyDistributionChart } from "../charts/DifficultyDistributionChart";
import { QuickWinsTable } from "../tables/QuickWinsTable";
import { CompetitorOverlapTable } from "../tables/CompetitorOverlapTable";
import { CannibalizationTable } from "../tables/CannibalizationTable";
import { useTranslations } from "next-intl";
import { Target04, Zap, TrendUp02, Hash01, HelpCircle, Star01, MessageChatCircle, Map01, Image01, VideoRecorder, ShoppingBag01, Link01, File07, SearchLg, CheckVerified01, BarChart01, Globe01, BookOpen01, RefreshCcw01 } from "@untitledui/icons";
import { Tooltip, TooltipTrigger } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { toast } from "sonner";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface KeywordMapSectionProps {
    domainId: Id<"domains">;
}

type SerpFeatureStaticInfo = {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    importance: "high" | "medium" | "low";
    labelKey: string;
    descKey: string;
    optKey: string;
};

const SERP_FEATURE_STATIC: Record<string, SerpFeatureStaticInfo> = {
    featured_snippet: { icon: Star01, color: "text-utility-warning-500", importance: "high", labelKey: "serpFeatureLabelFeaturedSnippet", descKey: "serpFeatureDescFeaturedSnippet", optKey: "serpFeatureOptFeaturedSnippet" },
    people_also_ask: { icon: MessageChatCircle, color: "text-utility-blue-500", importance: "high", labelKey: "serpFeatureLabelPeopleAlsoAsk", descKey: "serpFeatureDescPeopleAlsoAsk", optKey: "serpFeatureOptPeopleAlsoAsk" },
    knowledge_panel: { icon: BookOpen01, color: "text-utility-brand-500", importance: "medium", labelKey: "serpFeatureLabelKnowledgePanel", descKey: "serpFeatureDescKnowledgePanel", optKey: "serpFeatureOptKnowledgePanel" },
    local_pack: { icon: Map01, color: "text-utility-success-500", importance: "high", labelKey: "serpFeatureLabelLocalPack", descKey: "serpFeatureDescLocalPack", optKey: "serpFeatureOptLocalPack" },
    image_pack: { icon: Image01, color: "text-utility-pink-500", importance: "medium", labelKey: "serpFeatureLabelImagePack", descKey: "serpFeatureDescImagePack", optKey: "serpFeatureOptImagePack" },
    video: { icon: VideoRecorder, color: "text-utility-error-500", importance: "medium", labelKey: "serpFeatureLabelVideoResults", descKey: "serpFeatureDescVideoResults", optKey: "serpFeatureOptVideoResults" },
    shopping_results: { icon: ShoppingBag01, color: "text-utility-success-600", importance: "high", labelKey: "serpFeatureLabelShoppingResults", descKey: "serpFeatureDescShoppingResults", optKey: "serpFeatureOptShoppingResults" },
    sitelinks: { icon: Link01, color: "text-tertiary", importance: "low", labelKey: "serpFeatureLabelSitelinks", descKey: "serpFeatureDescSitelinks", optKey: "serpFeatureOptSitelinks" },
    top_stories: { icon: File07, color: "text-utility-orange-500", importance: "medium", labelKey: "serpFeatureLabelTopStories", descKey: "serpFeatureDescTopStories", optKey: "serpFeatureOptTopStories" },
    related_searches: { icon: SearchLg, color: "text-quaternary", importance: "low", labelKey: "serpFeatureLabelRelatedSearches", descKey: "serpFeatureDescRelatedSearches", optKey: "serpFeatureOptRelatedSearches" },
    reviews: { icon: Star01, color: "text-utility-warning-400", importance: "medium", labelKey: "serpFeatureLabelReviewStars", descKey: "serpFeatureDescReviewStars", optKey: "serpFeatureOptReviewStars" },
    faq: { icon: MessageChatCircle, color: "text-utility-blue-400", importance: "medium", labelKey: "serpFeatureLabelFaqRichResult", descKey: "serpFeatureDescFaqRichResult", optKey: "serpFeatureOptFaqRichResult" },
    carousel: { icon: Globe01, color: "text-utility-brand-400", importance: "low", labelKey: "serpFeatureLabelCarousel", descKey: "serpFeatureDescCarousel", optKey: "serpFeatureOptCarousel" },
    answer_box: { icon: CheckVerified01, color: "text-utility-success-400", importance: "high", labelKey: "serpFeatureLabelAnswerBox", descKey: "serpFeatureDescAnswerBox", optKey: "serpFeatureOptAnswerBox" },
    paid: { icon: BarChart01, color: "text-quaternary", importance: "low", labelKey: "serpFeatureLabelPaidAds", descKey: "serpFeatureDescPaidAds", optKey: "serpFeatureOptPaidAds" },
    twitter: { icon: Globe01, color: "text-utility-blue-300", importance: "low", labelKey: "serpFeatureLabelTwitter", descKey: "serpFeatureDescTwitter", optKey: "serpFeatureOptTwitter" },
    jobs: { icon: Globe01, color: "text-utility-success-300", importance: "low", labelKey: "serpFeatureLabelJobs", descKey: "serpFeatureDescJobs", optKey: "serpFeatureOptJobs" },
    recipes: { icon: Globe01, color: "text-utility-orange-400", importance: "medium", labelKey: "serpFeatureLabelRecipes", descKey: "serpFeatureDescRecipes", optKey: "serpFeatureOptRecipes" },
};

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function KeywordMapSection({ domainId }: KeywordMapSectionProps) {
    const t = useTranslations('keywords');
    const mapData = useQuery(api.keywordMap_queries.getKeywordMapData, { domainId });
    const serpFeatures = useQuery(api.keywordMap_queries.getSerpFeatureOpportunities, { domainId });
    const domain = useQuery(api.domains.getDomain, { domainId });
    const fetchVisibility = useAction(api.dataforseo.fetchAndStoreVisibility);
    const [isFetching, setIsFetching] = useState(false);

    const handleRefreshDiscovered = async () => {
        if (!domain || isFetching) return;
        setIsFetching(true);
        try {
            const result = await fetchVisibility({
                domainId,
                domain: domain.domain,
                location: domain.settings.location,
                language: domain.settings.language,
            });
            if (result.success) {
                toast.success(t('discoveredKeywordsRefreshed', { count: result.count || 0 }));
            } else {
                toast.error(result.error || "Failed to fetch keywords");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to fetch keywords");
        } finally {
            setIsFetching(false);
        }
    };

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
            {/* Refresh button when no discovered keywords */}
            {stats && stats.total === 0 && (
                <div className="relative flex flex-col items-center gap-3 rounded-xl border border-secondary bg-primary py-10">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <Globe01 className="h-10 w-10 text-quaternary" />
                    <p className="text-sm font-medium text-primary">{t('noDiscoveredKeywords')}</p>
                    <p className="text-xs text-tertiary max-w-sm text-center">{t('noDiscoveredKeywordsDesc')}</p>
                    <Button
                        color="secondary"
                        size="sm"
                        iconLeading={RefreshCcw01}
                        onClick={handleRefreshDiscovered}
                        isDisabled={isFetching || !domain}
                    >
                        {isFetching ? t('fetchingDiscoveredKeywords') : t('fetchDiscoveredKeywords')}
                    </Button>
                </div>
            )}

            {/* Summary Cards */}
            {stats && stats.total > 0 && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                            <Hash01 className="h-4 w-4" />
                            {t('totalKeywords')}
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(stats.total)}</p>
                        <p className="mt-0.5 text-xs text-tertiary">{t('countMonitored', { count: stats.monitored })}</p>
                    </div>
                    <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                        <div className="flex items-center gap-2 text-sm text-tertiary mb-2">
                            <Target04 className="h-4 w-4" />
                            {t('keywordTypes')}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-tertiary">{t('keywordTypeCore')}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full bg-brand-500 dark:bg-brand-400" style={{ width: `${stats.total > 0 ? (stats.core / stats.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-sm font-semibold text-primary w-8 text-right">{stats.core}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-tertiary">{t('keywordTypeLongtail')}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full bg-utility-blue-500 dark:bg-utility-blue-400" style={{ width: `${stats.total > 0 ? (stats.longtail / stats.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-sm font-semibold text-primary w-8 text-right">{stats.longtail}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-tertiary">{t('keywordTypeBranded')}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-full rounded-full bg-utility-warning-500 dark:bg-utility-warning-400" style={{ width: `${stats.total > 0 ? (stats.branded / stats.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="text-sm font-semibold text-primary w-8 text-right">{stats.branded}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                            <Zap className="h-4 w-4 text-fg-warning-primary" />
                            {t('quickWins')}
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-utility-success-600">{stats.quickWins}</p>
                        <p className="mt-0.5 text-xs text-tertiary">{t('keywordsInStrikingDistance')}</p>
                    </div>
                    <div className="relative rounded-xl border border-secondary bg-primary p-4">
                        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                            <TrendUp02 className="h-4 w-4" />
                            {t('totalVolume')}
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(stats.totalVolume)}</p>
                        <p className="mt-0.5 text-xs text-tertiary">{t('avgDifficultyValue', { value: stats.avgDifficulty })}</p>
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
                <div className="relative rounded-xl border border-secondary bg-primary p-6">
                    <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                    <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-md font-semibold text-primary">{t('serpFeatureOpportunities')}</h3>
                        <TooltipTrigger delay={200}>
                            <button className="inline-flex" aria-label="What are SERP features?">
                                <HelpCircle className="h-4 w-4 text-quaternary" />
                            </button>
                            <Tooltip className="max-w-sm rounded-lg bg-primary px-3 py-2 text-xs text-secondary shadow-lg border border-secondary">
                                {t('serpFeaturesTooltip')}
                            </Tooltip>
                        </TooltipTrigger>
                    </div>
                    <p className="mb-4 text-sm text-tertiary">
                        {t('serpFeaturesSubtitle')}
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {serpFeatures.slice(0, 12).map((feature) => {
                            const info = SERP_FEATURE_STATIC[feature.feature];
                            const Icon = info?.icon ?? Globe01;
                            const label = info ? t(info.labelKey as any) : feature.feature.replace(/_/g, " ");
                            const importanceBadge = info?.importance === "high"
                                ? { text: t('highImpact'), className: "bg-utility-success-50 text-utility-success-700" }
                                : info?.importance === "medium"
                                    ? { text: t('mediumImpact'), className: "bg-utility-warning-50 text-utility-warning-700" }
                                    : { text: t('lowImpact'), className: "bg-secondary text-tertiary" };

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
                                                    <span className="text-xs text-quaternary">{t('avgHash', { position: feature.avgPosition })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="rounded-full bg-utility-brand-50 px-2 py-0.5 text-xs font-semibold text-utility-brand-600">
                                            {feature.count}
                                        </span>
                                    </div>

                                    {info && (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs leading-relaxed text-tertiary">{t(info.descKey as any)}</p>
                                            <div className="rounded-md bg-utility-brand-50/50 px-2.5 py-2">
                                                <p className="text-[11px] font-medium text-utility-brand-700 mb-0.5">{t('howToOptimize')}</p>
                                                <p className="text-[11px] leading-relaxed text-utility-brand-600">{t(info.optKey as any)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {!info && (
                                        <p className="mt-2 text-xs text-quaternary">
                                            {t('serpFeatureUnknownInfo', { count: feature.count, position: feature.avgPosition })}
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
                                                <span className="text-[10px] text-quaternary">{t('plusMore', { count: feature.exampleKeywords.length - 3 })}</span>
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
