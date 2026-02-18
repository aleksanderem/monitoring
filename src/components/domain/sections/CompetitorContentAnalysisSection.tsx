"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { FileSearch02, TrendUp02, TrendDown02, RefreshCw01, Zap } from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface CompetitorContentAnalysisSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorContentAnalysisSection({ domainId }: CompetitorContentAnalysisSectionProps) {
  const t = useTranslations('competitors');
  const [selectedCompetitor, setSelectedCompetitor] = useState<Id<"competitors"> | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<Id<"keywords"> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const competitors = useQuery(api.competitors.getCompetitors, { domainId });
  const allKeywords = useQuery(api.keywords.getKeywords, { domainId });

  // Filter to only active keywords
  const keywords = allKeywords?.filter((k) => k.status === "active");

  // Get analyzed pages for selected competitor
  const analyzedPages = useQuery(
    api.competitorAnalysis.getCompetitorAnalyzedPages,
    selectedCompetitor ? { competitorId: selectedCompetitor } : "skip"
  );

  // Get comparison data when both competitor and keyword are selected
  const comparison = useQuery(
    api.competitorAnalysis.comparePageWithCompetitor,
    selectedCompetitor && selectedKeyword
      ? { competitorId: selectedCompetitor, keywordId: selectedKeyword }
      : "skip"
  );

  // Only show active competitors
  const activeCompetitors = competitors?.filter(c => c.status === "active") ?? [];

  // Transform to select items
  const competitorItems: SelectItemType[] = activeCompetitors
    .map((c) => ({ id: c._id, label: c.name || c.competitorDomain }));

  const keywordItems: SelectItemType[] = keywords
    ?.map((k) => ({ id: k._id, label: k.phrase })) || [];

  const triggerAnalysis = useMutation(api.competitorAnalysis.triggerCompetitorPageAnalysis);

  const handleAnalyzePage = async () => {
    if (!selectedCompetitor || !selectedKeyword) return;

    setAnalyzing(true);
    try {
      const result = await triggerAnalysis({ competitorId: selectedCompetitor, keywordId: selectedKeyword });
      if (result.success) {
        toast.success(t('contentAnalysisPageAnalysisStarted'));
      } else {
        toast.error(result.error || t('contentAnalysisPageAnalysisFailed'));
      }
    } catch (error: any) {
      toast.error(error.message || t('contentAnalysisPageAnalysisFailed'));
    } finally {
      setAnalyzing(false);
    }
  };

  const renderMetricComparison = (
    label: string,
    yourValue: number | undefined,
    compValue: number,
    formatFn?: (v: number) => string
  ) => {
    const format = formatFn || ((v: number) => v.toString());
    const diff = yourValue !== undefined ? yourValue - compValue : 0;
    const isPositive = diff > 0;

    return (
      <div className="flex items-center justify-between py-2 border-b border-secondary last:border-0">
        <span className="text-sm text-tertiary">{label}</span>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-primary">
              {yourValue !== undefined ? format(yourValue) : "—"}
            </div>
            <div className="text-xs text-quaternary">{t('contentAnalysisYou')}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-tertiary">
              {format(compValue)}
            </div>
            <div className="text-xs text-quaternary">{t('contentAnalysisThem')}</div>
          </div>
          {yourValue !== undefined && diff !== 0 && (
            <div className={`flex items-center gap-1 ${isPositive ? "text-utility-success-600" : "text-utility-error-600"}`}>
              {isPositive ? (
                <TrendUp02 className="h-3 w-3" />
              ) : (
                <TrendDown02 className="h-3 w-3" />
              )}
              <span className="text-xs font-medium">{Math.abs(diff)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (competitors === undefined || allKeywords === undefined) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="text-center py-8 text-tertiary">{t('contentAnalysisLoading')}</div>
      </div>
    );
  }

  if (activeCompetitors.length === 0) {
    return (
      <div className="relative rounded-xl border border-secondary bg-primary p-6">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="text-center py-12">
          <FileSearch02 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="text-tertiary mb-2">{t('competitorMgmtNoCompetitors')}</p>
          <p className="text-sm text-quaternary">
            {t('contentAnalysisNoCompetitorsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-secondary bg-primary">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      {/* Header */}
      <div className="border-b border-secondary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">{t('contentAnalysisTitle')}</h3>
            <p className="text-sm text-tertiary">
              {t('contentAnalysisSubtitle')}
            </p>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select
            size="md"
            items={competitorItems}
            selectedKey={selectedCompetitor}
            onSelectionChange={(key) => setSelectedCompetitor(key as Id<"competitors">)}
            placeholder={t('contentAnalysisSelectCompetitor')}
          >
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>

          <Select
            size="md"
            items={keywordItems}
            selectedKey={selectedKeyword}
            onSelectionChange={(key) => setSelectedKeyword(key as Id<"keywords">)}
            placeholder={t('contentAnalysisSelectKeyword')}
            isDisabled={!selectedCompetitor}
          >
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>

          <Button
            color="secondary"
            size="md"
            onClick={handleAnalyzePage}
            isDisabled={!selectedCompetitor || !selectedKeyword || analyzing}
            iconLeading={analyzing ? RefreshCw01 : Zap}
          >
            {analyzing ? t('contentAnalysisAnalyzing') : t('contentAnalysisAnalyze')}
          </Button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparison && comparison.competitor ? (
        <div className="p-6 space-y-6">
          {/* URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <p className="text-xs font-medium text-tertiary mb-2">{t('contentAnalysisYourPage')}</p>
              {comparison.yours ? (
                <a
                  href={comparison.yours.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-utility-blue-600 hover:underline break-all"
                >
                  {comparison.yours.url}
                </a>
              ) : (
                <p className="text-sm text-quaternary">{t('contentAnalysisNotRanking')}</p>
              )}
            </div>
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <p className="text-xs font-medium text-tertiary mb-2">{t('contentAnalysisCompetitorPage')}</p>
              <a
                href={comparison.competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-utility-blue-600 hover:underline break-all"
              >
                {comparison.competitor.url}
              </a>
              <Badge color="gray" size="sm" className="mt-2">
                Position #{comparison.competitor.position}
              </Badge>
            </div>
          </div>

          {/* Content Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Metrics */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3">{t('contentAnalysisContentMetrics')}</h4>
              <div className="space-y-2">
                {renderMetricComparison(
                  t('contentAnalysisWordCount'),
                  comparison.yours?.wordCount,
                  comparison.competitor.wordCount,
                  (v) => v.toLocaleString()
                )}
                {renderMetricComparison(
                  t('contentAnalysisH2Headings'),
                  comparison.yours?.htags?.h2?.length,
                  comparison.competitor.htags?.h2?.length || 0
                )}
                {renderMetricComparison(
                  t('contentAnalysisImages'),
                  comparison.yours?.imagesCount,
                  comparison.competitor.imagesCount || 0
                )}
                {renderMetricComparison(
                  t('contentAnalysisInternalLinks'),
                  comparison.yours?.internalLinksCount,
                  comparison.competitor.internalLinksCount || 0
                )}
              </div>
            </div>

            {/* Technical Metrics */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3">{t('contentAnalysisTechnicalMetrics')}</h4>
              <div className="space-y-2">
                {comparison.competitor.onpageScore !== undefined && (
                  <div className="flex items-center justify-between py-2 border-b border-secondary">
                    <span className="text-sm text-tertiary">{t('contentAnalysisOnPageScore')}</span>
                    <div className="flex items-center gap-3">
                      {comparison.yours?.onpageScore !== undefined && (
                        <div className="text-right">
                          <div className="text-sm font-medium text-primary">
                            {comparison.yours.onpageScore}/100
                          </div>
                          <div className="text-xs text-quaternary">{t('contentAnalysisYou')}</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium text-tertiary">
                          {comparison.competitor.onpageScore}/100
                        </div>
                        <div className="text-xs text-quaternary">{t('contentAnalysisThem')}</div>
                      </div>
                    </div>
                  </div>
                )}
                {comparison.competitor.loadTime !== undefined && (
                  renderMetricComparison(
                    t('contentAnalysisLoadTime'),
                    comparison.yours?.loadTime,
                    comparison.competitor.loadTime,
                    (v) => v.toFixed(0)
                  )
                )}
                {comparison.competitor.pageSize !== undefined && (
                  renderMetricComparison(
                    t('contentAnalysisPageSize'),
                    comparison.yours?.pageSize ? comparison.yours.pageSize / 1024 : undefined,
                    comparison.competitor.pageSize / 1024,
                    (v) => v.toFixed(1)
                  )
                )}
              </div>
            </div>
          </div>

          {/* Meta Information */}
          <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
            <h4 className="text-sm font-semibold text-primary mb-3">{t('contentAnalysisMetaInfo')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-tertiary mb-2">{t('contentAnalysisCompetitorTitle')}</p>
                <p className="text-sm text-primary">{comparison.competitor.title || "—"}</p>
                <p className="text-xs text-quaternary mt-1">
                  {t('contentAnalysisCharacters', { count: comparison.competitor.title?.length || 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-tertiary mb-2">{t('contentAnalysisCompetitorMetaDesc')}</p>
                <p className="text-sm text-primary">{comparison.competitor.metaDescription || "—"}</p>
                <p className="text-xs text-quaternary mt-1">
                  {t('contentAnalysisCharacters', { count: comparison.competitor.metaDescription?.length || 0 })}
                </p>
              </div>
            </div>
          </div>

          {/* Headings */}
          {comparison.competitor.htags && (
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3">{t('contentAnalysisHeadingStructure')}</h4>
              <div className="space-y-3">
                {comparison.competitor.htags.h1 && comparison.competitor.htags.h1.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">{t('contentAnalysisH1Tags')}</p>
                    <div className="space-y-1">
                      {comparison.competitor.htags.h1.map((h1: string, idx: number) => (
                        <p key={idx} className="text-sm text-primary pl-3 border-l-2 border-brand-primary">
                          {h1}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {comparison.competitor.htags.h2 && comparison.competitor.htags.h2.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">{t('contentAnalysisH2Tags', { count: comparison.competitor.htags.h2.length })}</p>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {comparison.competitor.htags.h2.map((h2: string, idx: number) => (
                        <p key={idx} className="text-sm text-primary pl-3 border-l-2 border-secondary">
                          {h2}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Insights */}
          {comparison.comparison && (
            <div className="rounded-lg border border-brand-subtle bg-brand-subtle/10 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-secondary" />
                {t('contentAnalysisQuickInsights')}
              </h4>
              <div className="space-y-2 text-sm">
                {comparison.comparison.wordCountDiff !== 0 && (
                  <p className="text-tertiary">
                    {comparison.comparison.wordCountDiff > 0 ? (
                      <span className="text-utility-success-600">
                        ✓ {t('contentAnalysisInsightWordsLonger', { count: comparison.comparison.wordCountDiff })}
                      </span>
                    ) : (
                      <span className="text-utility-warning-600">
                        ⚠ {t('contentAnalysisInsightWordsAdd', { count: Math.abs(comparison.comparison.wordCountDiff) })}
                      </span>
                    )}
                  </p>
                )}
                {comparison.comparison.h2CountDiff !== 0 && (
                  <p className="text-tertiary">
                    {comparison.comparison.h2CountDiff > 0 ? (
                      <span className="text-utility-success-600">
                        ✓ {t('contentAnalysisInsightH2More', { count: comparison.comparison.h2CountDiff })}
                      </span>
                    ) : (
                      <span className="text-utility-warning-600">
                        ⚠ {t('contentAnalysisInsightH2Add', { count: Math.abs(comparison.comparison.h2CountDiff) })}
                      </span>
                    )}
                  </p>
                )}
                {comparison.comparison.imagesCountDiff !== 0 && (
                  <p className="text-tertiary">
                    {comparison.comparison.imagesCountDiff > 0 ? (
                      <span className="text-utility-success-600">
                        ✓ {t('contentAnalysisInsightImagesMore', { count: comparison.comparison.imagesCountDiff })}
                      </span>
                    ) : (
                      <span className="text-utility-warning-600">
                        ⚠ {t('contentAnalysisInsightImagesAdd', { count: Math.abs(comparison.comparison.imagesCountDiff) })}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : selectedCompetitor && selectedKeyword ? (
        <div className="text-center py-12 text-tertiary">
          <FileSearch02 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="mb-2">{t('contentAnalysisNoData')}</p>
          <p className="text-sm text-quaternary">
            {t('contentAnalysisNoDataHint')}
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-tertiary">
          <p>{t('contentAnalysisSelectPrompt')}</p>
        </div>
      )}
    </div>
  );
}
