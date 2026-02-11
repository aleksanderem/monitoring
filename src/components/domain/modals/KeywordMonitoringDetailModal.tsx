"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { XClose, Target04 } from "@untitledui/icons";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { Button } from "@/components/base/buttons/button";
import { KeywordPositionChart } from "../charts/KeywordPositionChart";
import { MonthlySearchTrendChart } from "../charts/MonthlySearchTrendChart";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { CreateCompetitorReportModal } from "./CreateCompetitorReportModal";

interface KeywordMonitoringDetailModalProps {
  keyword: any;
  isOpen: boolean;
  onClose: () => void;
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function KeywordMonitoringDetailModal({ keyword, isOpen, onClose }: KeywordMonitoringDetailModalProps) {
  const t = useTranslations('keywords');
  const tc = useTranslations('common');
  useEscapeClose(onClose, isOpen);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [isAddingCompetitors, setIsAddingCompetitors] = useState(false);
  const [isCompetitorReportModalOpen, setIsCompetitorReportModalOpen] = useState(false);

  // Fetch SERP results for this keyword (show top 20 instead of 10)
  const serpResults = useQuery(
    api.keywords.getSerpResultsForKeyword,
    keyword?.keywordId ? { keywordId: keyword.keywordId, limit: 20 } : "skip"
  );

  const addCompetitor = useMutation(api.competitors.addCompetitor);

  const handleToggleCompetitor = (domain: string) => {
    const newSelected = new Set(selectedCompetitors);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedCompetitors(newSelected);
  };

  const handleAddSelectedCompetitors = async () => {
    if (selectedCompetitors.size === 0) {
      toast.error(t('pleaseSelectCompetitor'));
      return;
    }

    if (!keyword?.domainId) {
      toast.error(t('missingDomainInfo'));
      return;
    }

    setIsAddingCompetitors(true);
    try {
      for (const domain of selectedCompetitors) {
        await addCompetitor({
          domainId: keyword.domainId,
          competitorDomain: domain,
        });
      }
      toast.success(t('addedCompetitorsToTracking', { count: selectedCompetitors.size }));
      setSelectedCompetitors(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToAddCompetitors'));
    } finally {
      setIsAddingCompetitors(false);
    }
  };

  if (!isOpen || !keyword) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="rounded-xl border border-secondary bg-primary shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-secondary p-6">
            <div>
              <h2 className="text-xl font-semibold text-primary">{keyword.phrase || t('keywordDetails')}</h2>
              <div className="flex items-center gap-3 mt-2">
                {keyword.currentPosition && (
                  <span className="inline-flex items-center rounded-full bg-utility-success-50 px-3 py-1 text-sm font-medium text-utility-success-700">
                    {t('positionHash', { position: keyword.currentPosition })}
                  </span>
                )}
                {keyword.previousPosition && (
                  <span className="inline-flex items-center rounded-full bg-utility-gray-50 px-3 py-1 text-sm font-medium text-utility-gray-600">
                    {t('previousHash', { position: keyword.previousPosition })}
                  </span>
                )}
                {keyword.change !== null && keyword.change !== 0 && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                      keyword.change > 0
                        ? "bg-utility-success-50 text-utility-success-700"
                        : "bg-utility-error-50 text-utility-error-700"
                    }`}
                  >
                    {keyword.change > 0 ? "↑" : "↓"} {Math.abs(keyword.change)}
                  </span>
                )}
                {keyword.searchVolume && (
                  <span className="text-sm text-tertiary">
                    {t('monthlySearches', { count: formatNumber(keyword.searchVolume) })}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              color="secondary"
              iconLeading={XClose}
              onClick={onClose}
            >
              {tc('close')}
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Position History Chart */}
            {keyword.positionHistory && keyword.positionHistory.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-primary mb-4">{t('positionHistory')}</h3>
                <KeywordPositionChart positionHistory={keyword.positionHistory} />
              </div>
            )}

            {/* Monthly Search Trend Chart */}
            {keyword.monthlySearches && keyword.monthlySearches.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-primary mb-4">{t('searchVolumeTrend')}</h3>
                <MonthlySearchTrendChart monthlySearches={keyword.monthlySearches} />
              </div>
            )}

            {/* Keyword Metrics Grid */}
            <div>
              <h3 className="text-base font-semibold text-primary mb-4">{t('keywordMetrics')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {keyword.searchVolume && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('searchVolume')}</p>
                    <p className="text-lg font-semibold text-primary">{formatNumber(keyword.searchVolume)}</p>
                  </div>
                )}
                {keyword.difficulty !== null && keyword.difficulty !== undefined && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('columnDifficulty')}</p>
                    <p className="text-lg font-semibold text-primary">{keyword.difficulty}</p>
                  </div>
                )}
                {keyword.cpc !== null && keyword.cpc !== undefined && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('columnCpc')}</p>
                    <p className="text-lg font-semibold text-primary">${keyword.cpc.toFixed(2)}</p>
                  </div>
                )}
                {keyword.etv !== null && keyword.etv !== undefined && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('columnEtv')}</p>
                    <p className="text-lg font-semibold text-primary">{keyword.etv.toFixed(2)}</p>
                  </div>
                )}
                {keyword.competition !== null && keyword.competition !== undefined && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('columnCompetition')}</p>
                    <p className="text-lg font-semibold text-primary">{(keyword.competition * 100).toFixed(0)}%</p>
                  </div>
                )}
                {keyword.intent && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('columnIntent')}</p>
                    <p className="text-lg font-semibold text-primary capitalize">{keyword.intent}</p>
                  </div>
                )}
                {keyword.potential && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{t('potentialTraffic')}</p>
                    <p className="text-lg font-semibold text-primary">{formatNumber(keyword.potential)}</p>
                  </div>
                )}
                {keyword.status && (
                  <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                    <p className="text-xs font-medium text-tertiary mb-1">{tc('status')}</p>
                    <p className="text-lg font-semibold text-primary">{tc(`status${keyword.status.charAt(0).toUpperCase()}${keyword.status.slice(1)}` as any)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* URL if available */}
            {keyword.url && (
              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <p className="text-xs font-medium text-tertiary mb-1">{t('rankingUrl')}</p>
                <a
                  href={keyword.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-utility-blue-600 hover:text-utility-blue-700 hover:underline break-all"
                >
                  {keyword.url}
                </a>
              </div>
            )}

            {/* SERP Features */}
            {keyword.serpFeatures && keyword.serpFeatures.length > 0 && (
              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <p className="text-xs font-medium text-tertiary mb-2">{t('serpFeatures')}</p>
                <div className="flex flex-wrap gap-2">
                  {keyword.serpFeatures.map((feature: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-full bg-utility-blue-50 px-2.5 py-0.5 text-xs font-medium text-utility-blue-700"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SERP Competitors */}
            {serpResults && serpResults.results.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-primary">
                    {t('serpCompetitors', { count: serpResults.results.length })}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      color="secondary"
                      iconLeading={Target04}
                      onClick={() => {
                        console.log("Analyze Competitors clicked!");
                        setIsCompetitorReportModalOpen(true);
                      }}
                    >
                      {t('analyzeCompetitors')}
                    </Button>
                    {selectedCompetitors.size > 0 && (
                      <Button
                        size="sm"
                        color="primary"
                        onClick={handleAddSelectedCompetitors}
                        disabled={isAddingCompetitors}
                      >
                        {isAddingCompetitors ? t('adding') : t('trackCompetitors', { count: selectedCompetitors.size })}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-secondary bg-secondary/30 overflow-hidden">
                  <div className="divide-y divide-secondary">
                    {serpResults.results.map((result, idx) => (
                      <div key={idx} className="p-4">
                        <div className="flex items-start gap-3">
                          {!result.isYourDomain && (
                            <div className="flex-shrink-0 pt-1">
                              <input
                                type="checkbox"
                                checked={selectedCompetitors.has(result.domain)}
                                onChange={() => handleToggleCompetitor(result.domain)}
                                className="w-4 h-4 rounded border-utility-gray-300 text-brand-600 focus:ring-brand-500"
                              />
                            </div>
                          )}
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-utility-gray-100 flex items-center justify-center">
                            <span className="text-sm font-semibold text-utility-gray-700">{result.position}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-medium text-primary">{result.domain}</span>
                              {result.isYourDomain && (
                                <span className="text-xs bg-utility-success-100 text-utility-success-700 px-2 py-0.5 rounded">{t('yourDomain')}</span>
                              )}
                              {result.isFeaturedSnippet && (
                                <span className="text-xs bg-utility-purple-100 text-utility-purple-700 px-2 py-0.5 rounded">{t('featuredSnippet')}</span>
                              )}
                              {result.ampVersion && (
                                <span className="text-xs bg-utility-blue-100 text-utility-blue-700 px-2 py-0.5 rounded">AMP</span>
                              )}
                              {result.isWebStory && (
                                <span className="text-xs bg-utility-purple-100 text-utility-purple-700 px-2 py-0.5 rounded">{t('webStory')}</span>
                              )}
                            </div>
                            {result.breadcrumb && <p className="text-xs text-utility-gray-500 mb-1">{result.breadcrumb}</p>}
                            {result.title && <p className="text-sm font-medium text-primary mb-1">{result.title}</p>}

                            {result.rating && (
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <span key={i} className={i < Math.floor(result.rating?.value || 0) ? "text-utility-warning-500" : "text-utility-gray-300"}>★</span>
                                  ))}
                                </div>
                                <span className="text-xs text-tertiary">{result.rating.value?.toFixed(1)} ({result.rating.votesCount?.toLocaleString()} reviews)</span>
                              </div>
                            )}

                            {result.price && (
                              <p className="text-sm font-semibold text-utility-success-700 mb-1">
                                {result.price.displayedPrice || "$" + result.price.current}
                              </p>
                            )}

                            {result.description && <p className="text-xs text-tertiary mb-1">{result.description}</p>}
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-utility-blue-600 hover:underline break-all">{result.url}</a>

                            {(result.etv || result.estimatedPaidTrafficCost) && (
                              <div className="flex items-center gap-3 mt-2">
                                {result.etv && <span className="text-xs text-tertiary">{t('serpEtvLabel', { value: result.etv.toLocaleString() })}</span>}
                                {result.estimatedPaidTrafficCost && <span className="text-xs text-tertiary">{t('serpTrafficCostLabel', { value: result.estimatedPaidTrafficCost.toLocaleString() })}</span>}
                              </div>
                            )}

                            {result.highlighted && result.highlighted.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs font-medium text-utility-blue-700">{t('highlighted')}: </span>
                                {result.highlighted.map((text, hIdx) => (
                                  <span key={hIdx} className="text-xs text-utility-blue-600 font-medium">{text}{hIdx < (result.highlighted?.length || 0) - 1 ? ", " : ""}</span>
                                ))}
                              </div>
                            )}

                            {result.sitelinks && result.sitelinks.length > 0 && (
                              <div className="mt-2 pl-3 border-l-2 border-utility-blue-200">
                                <p className="text-xs font-medium text-utility-blue-700 mb-1">{t('sitelinksCount', { count: result.sitelinks.length })}:</p>
                                {result.sitelinks.slice(0, 4).map((link, linkIdx) => (
                                  <div key={linkIdx} className="mb-1">
                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-utility-blue-600 hover:underline font-medium">{link.title}</a>
                                    {link.description && <p className="text-xs text-tertiary">{link.description}</p>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {(result.rankGroup || result.rankAbsolute) && (
                              <div className="flex items-center gap-3 mt-2">
                                {result.rankGroup && <span className="text-xs text-tertiary">{t('serpRankGroup', { value: result.rankGroup })}</span>}
                                {result.rankAbsolute && <span className="text-xs text-tertiary">{t('serpRankAbsolute', { value: result.rankAbsolute })}</span>}
                              </div>
                            )}

                            {result.aboutThisResult && (
                              <div className="mt-2 p-2 bg-utility-gray-50 rounded border border-utility-gray-200">
                                <p className="text-xs font-medium text-utility-gray-700 mb-1">{t('serpAboutThisResult')}</p>
                                {result.aboutThisResult.source && <p className="text-xs text-tertiary">{t('serpSource', { value: result.aboutThisResult.source })}</p>}
                                {result.aboutThisResult.sourceInfo && <p className="text-xs text-tertiary">{result.aboutThisResult.sourceInfo}</p>}
                              </div>
                            )}

                            {result.timestamp && (
                              <p className="text-xs text-tertiary mt-2">{t('serpPublished', { value: result.timestamp })}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-tertiary mt-2">
                  {t('serpLastFetched', { value: new Date(serpResults.fetchedAt).toLocaleString() })}
                </p>
              </div>
            )}
            {/* Last Updated */}
            {keyword.lastUpdated && (
              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <p className="text-xs font-medium text-tertiary mb-1">{t('lastUpdated')}</p>
                <p className="text-sm text-primary">
                  {new Date(keyword.lastUpdated).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Competitor Analysis Report Modal */}
      <CreateCompetitorReportModal
        domainId={keyword.domainId}
        keywordId={keyword.keywordId}
        keyword={keyword.phrase}
        isOpen={isCompetitorReportModalOpen}
        onClose={() => setIsCompetitorReportModalOpen(false)}
        onReportCreated={() => {
          toast.success(t('analysisStarted'));
          setIsCompetitorReportModalOpen(false);
        }}
      />
    </div>
  );
}
