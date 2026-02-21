"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ArrowUpRight, Zap, XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface PageSpeedTabProps {
  domainId: Id<"domains">;
}

type PerPageData = {
  url: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  tti?: number;
  domComplete?: number;
};

function scoreColor(score: number) {
  if (score >= 90) return "text-utility-success-600";
  if (score >= 50) return "text-utility-warning-600";
  return "text-utility-error-600";
}

function scoreBg(score: number) {
  if (score >= 90) return "bg-utility-success-50";
  if (score >= 50) return "bg-utility-warning-50";
  return "bg-utility-error-50";
}

function scoreRing(score: number) {
  if (score >= 90) return "ring-utility-success-200";
  if (score >= 50) return "ring-utility-warning-200";
  return "ring-utility-error-200";
}

function ScoreCircle({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-20 h-20" : size === "md" ? "w-16 h-16" : "w-12 h-12";
  const textSize = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`${dim} ${scoreBg(score)} ring-2 ${scoreRing(score)} rounded-full flex items-center justify-center`}>
        <span className={`${textSize} font-bold ${scoreColor(score)} tabular-nums`}>{score}</span>
      </div>
      <span className="text-xs text-tertiary font-medium">{label}</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const bg = score >= 90 ? "text-utility-success-700 bg-utility-success-50" : score >= 50 ? "text-utility-warning-700 bg-utility-warning-50" : "text-utility-error-700 bg-utility-error-50";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${bg}`}>
      {score}
    </span>
  );
}

function CwvMetric({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-secondary bg-secondary/20 px-4 py-3 text-center">
      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider block mb-1">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${warn ? "text-utility-warning-600" : "text-primary"}`}>
        {value}
      </span>
      {unit && <span className="text-xs text-quaternary ml-0.5">{unit}</span>}
    </div>
  );
}

function fmtCwv(ms: number): { val: string; unit: string } {
  if (ms >= 1000) return { val: (ms / 1000).toFixed(2), unit: "s" };
  return { val: ms.toFixed(0), unit: "ms" };
}

function cwvStatus(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  switch (metric) {
    case "lcp": return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "fid": return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
    case "cls": return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "tti": return value <= 3800 ? "good" : value <= 7300 ? "needs-improvement" : "poor";
    default: return "good";
  }
}

function CwvStatusDot({ status }: { status: "good" | "needs-improvement" | "poor" }) {
  const cls = status === "good"
    ? "bg-utility-success-500"
    : status === "needs-improvement"
      ? "bg-utility-warning-500"
      : "bg-utility-error-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function CwvDetailCard({ label, fullName, value, unit, target, metric, rawValue }: {
  label: string;
  fullName: string;
  value: string;
  unit: string;
  target: string;
  metric: string;
  rawValue: number;
}) {
  const status = cwvStatus(metric, rawValue);
  const valueColor = status === "good"
    ? "text-utility-success-600"
    : status === "needs-improvement"
      ? "text-utility-warning-600"
      : "text-utility-error-600";

  return (
    <div className="flex flex-col rounded-lg border border-secondary bg-secondary/20 p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <CwvStatusDot status={status} />
        <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}<span className="text-xs font-medium ml-0.5">{unit}</span>
      </div>
      <p className="text-xs text-tertiary mt-2">{fullName}</p>
      <p className="text-[10px] text-quaternary mt-auto pt-1">T: {target}</p>
    </div>
  );
}

function PsiDetailModal({ page, isOpen, onClose }: {
  page: PerPageData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('onsite');
  useEscapeClose(onClose, isOpen);
  if (!isOpen || !page) return null;

  let displayUrl = page.url;
  try {
    const u = new URL(page.url);
    displayUrl = u.pathname === "/" ? u.hostname : u.hostname + u.pathname;
  } catch { /* keep original */ }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-overlay/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="relative rounded-xl border border-secondary bg-primary shadow-xl">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          {/* Header */}
          <div className="flex items-start justify-between border-b border-secondary p-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-primary truncate" title={page.url}>
                  {displayUrl}
                </h2>
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-fg-quaternary hover:text-fg-primary transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBg(page.performance)} ${scoreColor(page.performance)}`}>
                  Perf: {page.performance}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBg(page.accessibility)} ${scoreColor(page.accessibility)}`}>
                  A11y: {page.accessibility}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBg(page.bestPractices)} ${scoreColor(page.bestPractices)}`}>
                  BP: {page.bestPractices}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBg(page.seo)} ${scoreColor(page.seo)}`}>
                  SEO: {page.seo}
                </span>
              </div>
            </div>
            <Button size="sm" color="secondary" iconLeading={XClose} onClick={onClose}>
              {t('close')}
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Lighthouse Scores */}
            <div>
              <h4 className="text-sm font-semibold text-primary mb-4">{t('lighthouseScoresLabel')}</h4>
              <div className="flex items-center justify-around py-4 rounded-lg border border-secondary bg-secondary/10">
                <ScoreCircle score={page.performance} label={t('labelPerformance')} size="lg" />
                <ScoreCircle score={page.accessibility} label={t('labelAccessibility')} size="lg" />
                <ScoreCircle score={page.bestPractices} label={t('labelBestPractices')} size="lg" />
                <ScoreCircle score={page.seo} label={t('labelSeo')} size="lg" />
              </div>
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-utility-success-500" />
                  <span className="text-[10px] text-tertiary">{t('scoreGuideGood')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-utility-warning-500" />
                  <span className="text-[10px] text-tertiary">{t('scoreGuideNeedsImprovement')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-utility-error-500" />
                  <span className="text-[10px] text-tertiary">{t('scoreGuidePoor')}</span>
                </div>
              </div>
            </div>

            {/* Core Web Vitals */}
            {(page.lcp != null || page.fid != null || page.cls != null || page.tti != null) && (
              <div>
                <h4 className="text-sm font-semibold text-primary mb-4">{t('coreWebVitalsLabel')}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {page.lcp != null && (() => { const f = fmtCwv(page.lcp); return (
                    <CwvDetailCard
                      label={t('labelLcp')}
                      fullName={t('metricLcp')}
                      value={f.val}
                      unit={f.unit}
                      target="≤ 2.5s"
                      metric="lcp"
                      rawValue={page.lcp}
                    />
                  ); })()}
                  {page.fid != null && (() => { const f = fmtCwv(page.fid); return (
                    <CwvDetailCard
                      label={t('labelFidTbt')}
                      fullName={t('metricFid')}
                      value={f.val}
                      unit={f.unit}
                      target="≤ 100ms"
                      metric="fid"
                      rawValue={page.fid}
                    />
                  ); })()}
                  {page.tti != null && (() => { const f = fmtCwv(page.tti); return (
                    <CwvDetailCard
                      label={t('labelTti')}
                      fullName={t('metricTti')}
                      value={f.val}
                      unit={f.unit}
                      target="≤ 3.8s"
                      metric="tti"
                      rawValue={page.tti}
                    />
                  ); })()}
                  {page.cls != null && (
                    <CwvDetailCard
                      label={t('labelClsShort')}
                      fullName={t('metricCls')}
                      value={page.cls.toFixed(3)}
                      unit=""
                      target="≤ 0.1"
                      metric="cls"
                      rawValue={page.cls}
                    />
                  )}
                </div>

                {/* Additional metrics */}
                {page.domComplete != null && (() => { const f = fmtCwv(page.domComplete); return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <CwvMetric
                      label={t('labelDomComplete')}
                      value={f.val}
                      unit={f.unit}
                      warn={page.domComplete > 4000}
                    />
                  </div>
                ); })()}

                {/* Status guide */}
                <div className="flex items-center gap-6 mt-4 pt-3 border-t border-secondary">
                  <span className="text-[10px] text-quaternary uppercase tracking-wider">{t('statusGuide')}:</span>
                  <div className="flex items-center gap-1.5">
                    <CwvStatusDot status="good" />
                    <span className="text-[10px] text-tertiary">{t('statusGood')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CwvStatusDot status="needs-improvement" />
                    <span className="text-[10px] text-tertiary">{t('statusNeedsImprovement')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CwvStatusDot status="poor" />
                    <span className="text-[10px] text-tertiary">{t('statusPoor')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PsiProgressCard({ psiStatus }: {
  psiStatus: {
    psiJobId: string | null;
    psiStatus: string;
    psiProgress: { current: number; total: number } | null;
    psiStartedAt: number | null;
    psiError: string | null;
  };
}) {
  const t = useTranslations('onsite');
  const elapsed = psiStatus.psiStartedAt
    ? Math.floor((Date.now() - psiStatus.psiStartedAt) / 1000)
    : 0;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const progressPct = psiStatus.psiProgress && psiStatus.psiProgress.total > 0
    ? Math.round((psiStatus.psiProgress.current / psiStatus.psiProgress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="bg-brand-50 rounded-full p-4 animate-pulse">
        <Zap className="w-8 h-8 text-brand-600" />
      </div>
      <h4 className="text-lg font-semibold text-primary">{t('pageSpeedAnalysisInProgress')}</h4>
      <div className="text-sm text-tertiary">{minutes}m {seconds}s elapsed</div>
      <p className="text-sm text-secondary text-center max-w-md">
        {psiStatus.psiStatus === "pending"
          ? t('pageSpeedQueuedWaiting')
          : `Analyzing pages with Lighthouse (mobile) — ${psiStatus.psiProgress?.current ?? 0} of ${psiStatus.psiProgress?.total ?? "?"} pages done`}
      </p>

      <div className="w-full max-w-md">
        <div className="h-2 bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progressPct, 5)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-quaternary">
          <span>{psiStatus.psiProgress?.current ?? 0} / {psiStatus.psiProgress?.total ?? "?"} pages</span>
          <span>{progressPct}%</span>
        </div>
      </div>

      {psiStatus.psiJobId && (
        <div className="text-[10px] text-quaternary font-mono">
          job: {psiStatus.psiJobId}
        </div>
      )}
    </div>
  );
}

export function PageSpeedTab({ domainId }: PageSpeedTabProps) {
  const t = useTranslations('onsite');
  const data = useQuery(api.seoAudit_queries.getPageSpeedData, { domainId });
  const psiStatus = useQuery(api.seoAudit_queries.getPsiJobStatus, { domainId });
  const runPsi = useAction(api.seoAudit_actions.runPageSpeedAnalysis);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PerPageData | null>(null);

  const handleRunAnalysis = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await runPsi({ domainId });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('failedToStartPsi'));
    } finally {
      setSubmitting(false);
    }
  };

  const isJobRunning = psiStatus?.psiStatus === "pending" || psiStatus?.psiStatus === "running";

  // Show progress card when job is running
  if (isJobRunning && psiStatus) {
    return <PsiProgressCard psiStatus={psiStatus} />;
  }

  // No data yet — show run button
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
          <Zap className="w-8 h-8 text-brand-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-primary mb-1">{t('noPageSpeedData')}</p>
          <p className="text-xs text-tertiary max-w-sm">
            {t('noPageSpeedDataDescription')}
          </p>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('submitting')}
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              {t('runPageSpeedAnalysis')}
            </>
          )}
        </button>
        {psiStatus?.psiStatus === "failed" && (
          <p className="text-xs text-utility-error-600">{psiStatus.psiError || t('previousAnalysisFailed')}</p>
        )}
        {error && <p className="text-xs text-utility-error-600">{error}</p>}
      </div>
    );
  }

  // Data exists — show results
  return (
    <div className="space-y-6">
      {/* Average Lighthouse Scores */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-primary">{t('avgLighthouseScores')}</h4>
          <div className="flex items-center gap-3">
            <span className="text-xs text-tertiary">{t('pagesAnalyzedCount', { count: data.totalPages })}</span>
            <button
              onClick={handleRunAnalysis}
              disabled={submitting || isJobRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-secondary text-secondary hover:text-primary hover:border-primary disabled:opacity-50 transition-colors"
            >
              <Zap className="w-3 h-3" />
              {t('reRun')}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-around py-4 rounded-lg border border-secondary bg-secondary/10">
          <ScoreCircle score={data.averages.performance} label={t('labelPerformance')} />
          <ScoreCircle score={data.averages.accessibility} label={t('labelAccessibility')} />
          <ScoreCircle score={data.averages.bestPractices} label={t('labelBestPractices')} />
          <ScoreCircle score={data.averages.seo} label={t('labelSeo')} />
        </div>
      </div>

      {/* Average Core Web Vitals */}
      {data.avgCwv && (
        <div>
          <h4 className="text-sm font-semibold text-primary mb-3">{t('avgCoreWebVitals')}</h4>
          <div className="grid grid-cols-3 gap-3">
            <CwvMetric label="LCP" value={fmtCwv(data.avgCwv.lcp).val} unit={fmtCwv(data.avgCwv.lcp).unit} warn={data.avgCwv.lcp > 2500} />
            <CwvMetric label="CLS" value={data.avgCwv.cls.toFixed(3)} unit="" warn={data.avgCwv.cls > 0.1} />
            <CwvMetric label="FID / TBT" value={fmtCwv(data.avgCwv.fid).val} unit={fmtCwv(data.avgCwv.fid).unit} warn={data.avgCwv.fid > 100} />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-utility-error-600">{error}</p>}

      {/* Per-page breakdown */}
      <div>
        <h4 className="text-sm font-semibold text-primary mb-3">{t('perPageBreakdown')}</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-quaternary uppercase">{t('psiColPage')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-quaternary uppercase">{t('psiColPerf')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-quaternary uppercase">{t('psiColAccess')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-quaternary uppercase">{t('psiColBestPr')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-quaternary uppercase">{t('psiColSeo')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-quaternary uppercase">{t('psiColLcp')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-quaternary uppercase">{t('psiColCls')}</th>
              </tr>
            </thead>
            <tbody className="bg-primary divide-y divide-secondary">
              {data.perPage.map((page) => {
                let shortUrl = page.url;
                try {
                  const u = new URL(page.url);
                  shortUrl = u.pathname === "/" ? "/" : u.pathname;
                } catch { /* keep original */ }

                return (
                  <tr
                    key={page.url}
                    className="hover:bg-primary_hover transition-colors cursor-pointer"
                    onClick={() => setSelectedPage(page)}
                  >
                    <td className="px-4 py-3 text-sm text-primary max-w-[300px]">
                      <div className="flex items-center gap-1" title={page.url}>
                        <span className="truncate">{shortUrl}</span>
                        <ArrowUpRight className="w-3 h-3 flex-shrink-0 opacity-40" />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center"><ScoreBadge score={page.performance} /></td>
                    <td className="px-3 py-3 text-center"><ScoreBadge score={page.accessibility} /></td>
                    <td className="px-3 py-3 text-center"><ScoreBadge score={page.bestPractices} /></td>
                    <td className="px-3 py-3 text-center"><ScoreBadge score={page.seo} /></td>
                    <td className="px-3 py-3 text-center text-sm tabular-nums text-tertiary">
                      {page.lcp != null ? (
                        <span className={page.lcp > 2500 ? "text-utility-warning-600" : ""}>
                          {fmtCwv(page.lcp).val}{fmtCwv(page.lcp).unit}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="px-3 py-3 text-center text-sm tabular-nums text-tertiary">
                      {page.cls != null ? (
                        <span className={page.cls > 0.1 ? "text-utility-warning-600" : ""}>
                          {page.cls.toFixed(3)}
                        </span>
                      ) : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.perPage.length === 0 && (
            <div className="text-center py-8 text-sm text-tertiary">{t('noPageSpeedDataFound')}</div>
          )}
        </div>
      </div>

      {/* PSI Detail Modal */}
      <PsiDetailModal
        page={selectedPage}
        isOpen={selectedPage !== null}
        onClose={() => setSelectedPage(null)}
      />
    </div>
  );
}
