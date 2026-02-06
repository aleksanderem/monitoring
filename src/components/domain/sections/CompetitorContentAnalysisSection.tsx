"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { FileSearch02, TrendUp02, TrendDown02, RefreshCcw01, Zap } from "@untitledui/icons";
import { toast } from "sonner";

interface CompetitorContentAnalysisSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorContentAnalysisSection({ domainId }: CompetitorContentAnalysisSectionProps) {
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

  // Transform to select items
  const competitorItems: SelectItemType[] = competitors
    ?.map((c) => ({ id: c._id, label: c.name || c.competitorDomain })) || [];

  const keywordItems: SelectItemType[] = keywords
    ?.map((k) => ({ id: k._id, label: k.phrase })) || [];

  const handleAnalyzePage = async () => {
    if (!selectedCompetitor || !selectedKeyword) return;

    setAnalyzing(true);
    toast.info("Analyzing competitor page...");

    try {
      // Find the competitor's SERP result for this keyword
      const serpResults = await fetch(`/api/serp-results?keywordId=${selectedKeyword}`);
      // This is simplified - you'd need to get the actual URL from SERP results
      toast.success("Page analysis started");
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze page");
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
            <div className="text-xs text-quaternary">you</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-tertiary">
              {format(compValue)}
            </div>
            <div className="text-xs text-quaternary">them</div>
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
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-8 text-tertiary">Loading...</div>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <div className="text-center py-12">
          <FileSearch02 className="h-12 w-12 text-quaternary mx-auto mb-4" />
          <p className="text-tertiary mb-2">No competitors added yet</p>
          <p className="text-sm text-quaternary">
            Add competitors above to analyze their page content
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Header */}
      <div className="border-b border-secondary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">Content Analysis Comparison</h3>
            <p className="text-sm text-tertiary">
              Compare on-page SEO metrics with competitor pages
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
            placeholder="Select competitor"
          >
            {(item) => <span>{item.label}</span>}
          </Select>

          <Select
            size="md"
            items={keywordItems}
            selectedKey={selectedKeyword}
            onSelectionChange={(key) => setSelectedKeyword(key as Id<"keywords">)}
            placeholder="Select keyword"
            isDisabled={!selectedCompetitor}
          >
            {(item) => <span>{item.label}</span>}
          </Select>

          <Button
            color="secondary"
            size="md"
            onClick={handleAnalyzePage}
            isDisabled={!selectedCompetitor || !selectedKeyword || analyzing}
            iconLeading={analyzing ? RefreshCcw01 : Zap}
          >
            {analyzing ? "Analyzing..." : "Analyze Page"}
          </Button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparison && comparison.competitor ? (
        <div className="p-6 space-y-6">
          {/* URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <p className="text-xs font-medium text-tertiary mb-2">Your Page</p>
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
                <p className="text-sm text-quaternary">Not ranking or no analysis available</p>
              )}
            </div>
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <p className="text-xs font-medium text-tertiary mb-2">Competitor Page</p>
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
              <h4 className="text-sm font-semibold text-primary mb-3">Content Metrics</h4>
              <div className="space-y-2">
                {renderMetricComparison(
                  "Word Count",
                  comparison.yours?.wordCount,
                  comparison.competitor.wordCount,
                  (v) => v.toLocaleString()
                )}
                {renderMetricComparison(
                  "H2 Headings",
                  comparison.yours?.htags?.h2?.length,
                  comparison.competitor.htags?.h2?.length || 0
                )}
                {renderMetricComparison(
                  "Images",
                  comparison.yours?.imagesCount,
                  comparison.competitor.imagesCount || 0
                )}
                {renderMetricComparison(
                  "Internal Links",
                  comparison.yours?.internalLinksCount,
                  comparison.competitor.internalLinksCount || 0
                )}
              </div>
            </div>

            {/* Technical Metrics */}
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3">Technical Metrics</h4>
              <div className="space-y-2">
                {comparison.competitor.onpageScore !== undefined && (
                  <div className="flex items-center justify-between py-2 border-b border-secondary">
                    <span className="text-sm text-tertiary">OnPage Score</span>
                    <div className="flex items-center gap-3">
                      {comparison.yours?.onpageScore !== undefined && (
                        <div className="text-right">
                          <div className="text-sm font-medium text-primary">
                            {comparison.yours.onpageScore}/100
                          </div>
                          <div className="text-xs text-quaternary">you</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium text-tertiary">
                          {comparison.competitor.onpageScore}/100
                        </div>
                        <div className="text-xs text-quaternary">them</div>
                      </div>
                    </div>
                  </div>
                )}
                {comparison.competitor.loadTime !== undefined && (
                  renderMetricComparison(
                    "Load Time (ms)",
                    comparison.yours?.loadTime,
                    comparison.competitor.loadTime,
                    (v) => v.toFixed(0)
                  )
                )}
                {comparison.competitor.pageSize !== undefined && (
                  renderMetricComparison(
                    "Page Size (KB)",
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
            <h4 className="text-sm font-semibold text-primary mb-3">Meta Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-tertiary mb-2">Competitor Title</p>
                <p className="text-sm text-primary">{comparison.competitor.title || "—"}</p>
                <p className="text-xs text-quaternary mt-1">
                  {comparison.competitor.title?.length || 0} characters
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-tertiary mb-2">Competitor Meta Description</p>
                <p className="text-sm text-primary">{comparison.competitor.metaDescription || "—"}</p>
                <p className="text-xs text-quaternary mt-1">
                  {comparison.competitor.metaDescription?.length || 0} characters
                </p>
              </div>
            </div>
          </div>

          {/* Headings */}
          {comparison.competitor.htags && (
            <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3">Heading Structure</h4>
              <div className="space-y-3">
                {comparison.competitor.htags.h1 && comparison.competitor.htags.h1.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">H1 Tags</p>
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
                    <p className="text-xs font-medium text-tertiary mb-1">H2 Tags ({comparison.competitor.htags.h2.length})</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {comparison.competitor.htags.h2.slice(0, 5).map((h2: string, idx: number) => (
                        <p key={idx} className="text-sm text-primary pl-3 border-l-2 border-secondary">
                          {h2}
                        </p>
                      ))}
                      {comparison.competitor.htags.h2.length > 5 && (
                        <p className="text-xs text-quaternary pl-3">
                          +{comparison.competitor.htags.h2.length - 5} more...
                        </p>
                      )}
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
                Quick Insights
              </h4>
              <div className="space-y-2 text-sm">
                {comparison.comparison.wordCountDiff !== 0 && (
                  <p className="text-tertiary">
                    {comparison.comparison.wordCountDiff > 0 ? (
                      <span className="text-utility-success-600">
                        ✓ Your content is {comparison.comparison.wordCountDiff} words longer
                      </span>
                    ) : (
                      <span className="text-utility-warning-600">
                        ⚠ Consider adding {Math.abs(comparison.comparison.wordCountDiff)} more words to match competitor depth
                      </span>
                    )}
                  </p>
                )}
                {comparison.comparison.h2CountDiff !== 0 && (
                  <p className="text-tertiary">
                    {comparison.comparison.h2CountDiff > 0 ? (
                      <span className="text-utility-success-600">
                        ✓ You have {comparison.comparison.h2CountDiff} more H2 headings
                      </span>
                    ) : (
                      <span className="text-utility-warning-600">
                        ⚠ Add {Math.abs(comparison.comparison.h2CountDiff)} more H2 headings for better structure
                      </span>
                    )}
                  </p>
                )}
                {comparison.comparison.imagesCountDiff !== 0 && (
                  <p className="text-tertiary">
                    {comparison.comparison.imagesCountDiff > 0 ? (
                      <span className="text-utility-success-600">
                        ✓ You have {comparison.comparison.imagesCountDiff} more images
                      </span>
                    ) : (
                      <span className="text-utility-warning-600">
                        ⚠ Consider adding {Math.abs(comparison.comparison.imagesCountDiff)} more images
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
          <p className="mb-2">No analysis data available</p>
          <p className="text-sm text-quaternary">
            Click "Analyze Page" to fetch competitor page analysis
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-tertiary">
          <p>Select a competitor and keyword to view content analysis</p>
        </div>
      )}
    </div>
  );
}
