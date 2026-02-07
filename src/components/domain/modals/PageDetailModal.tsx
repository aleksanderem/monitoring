"use client";

import {
  XClose,
  ArrowUpRight,
  AlertCircle,
  AlertTriangle,
  InfoCircle,
  CheckCircle,
  Globe01,
  FileCode02,
  Image01,
  Link01,
  Clock,
  Zap,
  ShieldTick,
  BarChart01,
  Type01,
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useEscapeClose } from "@/hooks/useEscapeClose";

interface PageIssue {
  type: "critical" | "warning" | "recommendation";
  category: string;
  message: string;
}

interface PageData {
  _id: string;
  url: string;
  statusCode: number;
  title?: string;
  metaDescription?: string;
  h1?: string;
  canonical?: string;
  wordCount: number;
  plainTextSize?: number;
  plainTextRate?: number;
  readabilityScores?: {
    automatedReadabilityIndex: number;
    colemanLiauIndex: number;
    daleChallIndex: number;
    fleschKincaidIndex: number;
    smogIndex: number;
  };
  contentConsistency?: {
    titleToContent: number;
    descriptionToContent: number;
  };
  htags?: {
    h1: string[];
    h2: string[];
    h3?: string[];
    h4?: string[];
  };
  internalLinksCount?: number;
  externalLinksCount?: number;
  inboundLinksCount?: number;
  imagesCount?: number;
  imagesMissingAlt?: number;
  imageAlts?: Array<{
    src: string;
    alt: string;
    hasAlt: boolean;
    containsKeyword?: boolean;
    matchedKeyword?: string;
  }>;
  loadTime?: number;
  pageSize?: number;
  totalDomSize?: number;
  coreWebVitals?: {
    largestContentfulPaint: number;
    firstInputDelay: number;
    timeToInteractive: number;
    domComplete: number;
    cumulativeLayoutShift?: number;
  };
  scriptsCount?: number;
  renderBlockingScriptsCount?: number;
  cacheControl?: {
    cachable: boolean;
    ttl: number;
  };
  hasSocialTags?: boolean;
  socialMediaTags?: {
    hasOgTags: boolean;
    hasTwitterCard: boolean;
  };
  lighthouseScores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  onpageScore?: number;
  resourceErrors?: {
    hasErrors: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
  };
  brokenResources?: boolean;
  brokenLinks?: boolean;
  duplicateTitle?: boolean;
  duplicateDescription?: boolean;
  duplicateContent?: boolean;
  issueCount: number;
  issues: PageIssue[];
}

interface PageDetailModalProps {
  page: PageData | null;
  isOpen: boolean;
  onClose: () => void;
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-utility-success-50 text-utility-success-700";
  if (score >= 60) return "bg-utility-warning-50 text-utility-warning-700";
  return "bg-utility-error-50 text-utility-error-700";
}

function getStatusBg(code: number) {
  if (code >= 200 && code < 300) return "bg-utility-success-50 text-utility-success-700";
  if (code >= 300 && code < 400) return "bg-utility-warning-50 text-utility-warning-700";
  return "bg-utility-error-50 text-utility-error-700";
}

function getLhColor(score: number) {
  if (score >= 90) return "text-utility-success-600";
  if (score >= 50) return "text-utility-warning-600";
  return "text-utility-error-600";
}

function getLhBg(score: number) {
  if (score >= 90) return "bg-utility-success-50";
  if (score >= 50) return "bg-utility-warning-50";
  return "bg-utility-error-50";
}

function getLhRing(score: number) {
  if (score >= 90) return "ring-utility-success-200";
  if (score >= 50) return "ring-utility-warning-200";
  return "ring-utility-error-200";
}

function getSeverityIcon(type: string) {
  switch (type) {
    case "critical":
      return <AlertCircle className="w-3.5 h-3.5 text-utility-error-600 flex-shrink-0" />;
    case "warning":
      return <AlertTriangle className="w-3.5 h-3.5 text-utility-warning-600 flex-shrink-0" />;
    default:
      return <InfoCircle className="w-3.5 h-3.5 text-utility-blue-600 flex-shrink-0" />;
  }
}

function getSeverityBadge(type: string) {
  switch (type) {
    case "critical":
      return "bg-utility-error-50 text-utility-error-700";
    case "warning":
      return "bg-utility-warning-50 text-utility-warning-700";
    default:
      return "bg-utility-blue-50 text-utility-blue-700";
  }
}

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function MetricBox({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-secondary bg-secondary/20 px-3 py-2">
      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider block mb-0.5">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${warn ? "text-utility-warning-600" : "text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-fg-quaternary" />
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
    </div>
  );
}

function LhScoreCircle({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-14 h-14 ${getLhBg(score)} ring-2 ${getLhRing(score)} rounded-full flex items-center justify-center`}>
        <span className={`text-base font-bold ${getLhColor(score)} tabular-nums`}>{score}</span>
      </div>
      <span className="text-[10px] text-tertiary font-medium">{label}</span>
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

function CwvCard({ label, fullName, value, unit, target, metric, rawValue }: {
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
    <div className="flex flex-col rounded-lg border border-secondary bg-secondary/20 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <CwvStatusDot status={status} />
        <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums ${valueColor}`}>
        {value}{unit && <span className="text-xs font-medium ml-0.5">{unit}</span>}
      </div>
      <p className="text-[10px] text-tertiary mt-1">{fullName}</p>
      <p className="text-[9px] text-quaternary mt-auto pt-0.5">T: {target}</p>
    </div>
  );
}

export function PageDetailModal({ page, isOpen, onClose }: PageDetailModalProps) {
  useEscapeClose(onClose, isOpen);

  if (!isOpen || !page) return null;

  const issues = page.issues || [];
  const criticalIssues = issues.filter((i) => i.type === "critical");
  const warningIssues = issues.filter((i) => i.type === "warning");
  const recIssues = issues.filter((i) => i.type !== "critical" && i.type !== "warning");

  let displayUrl = page.url;
  try {
    const u = new URL(page.url);
    displayUrl = u.pathname === "/" ? u.hostname : u.hostname + u.pathname;
  } catch { /* keep original */ }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="rounded-xl border border-secondary bg-primary shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-secondary p-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-primary truncate" title={page.url}>
                  {displayUrl}
                </h2>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-fg-quaternary hover:text-fg-primary transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {page.onpageScore != null && (
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getScoreBg(page.onpageScore)}`}>
                    Score: {page.onpageScore}
                  </span>
                )}
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusBg(page.statusCode)}`}>
                  HTTP {page.statusCode}
                </span>
                {/* Lighthouse score badges */}
                {page.lighthouseScores && (
                  <>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${getLhBg(page.lighthouseScores.performance)} ${getLhColor(page.lighthouseScores.performance)}`}>
                      P: {page.lighthouseScores.performance}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${getLhBg(page.lighthouseScores.accessibility)} ${getLhColor(page.lighthouseScores.accessibility)}`}>
                      A: {page.lighthouseScores.accessibility}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${getLhBg(page.lighthouseScores.bestPractices)} ${getLhColor(page.lighthouseScores.bestPractices)}`}>
                      BP: {page.lighthouseScores.bestPractices}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${getLhBg(page.lighthouseScores.seo)} ${getLhColor(page.lighthouseScores.seo)}`}>
                      SEO: {page.lighthouseScores.seo}
                    </span>
                  </>
                )}
                {issues.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-sm text-utility-success-600">
                    <CheckCircle className="w-4 h-4" /> No issues
                  </span>
                ) : (
                  <span className="text-sm text-tertiary">
                    {issues.length} issue{issues.length !== 1 ? "s" : ""}
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
              Close
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Issues Section */}
            {issues.length > 0 && (
              <div>
                <SectionHeader icon={AlertCircle} title={`Issues (${issues.length})`} />
                <div className="space-y-4">
                  {criticalIssues.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-utility-error-600 mb-1.5">
                        Critical ({criticalIssues.length})
                      </p>
                      <div className="space-y-1">
                        {criticalIssues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-md border border-utility-error-100 bg-utility-error-50/30 px-3 py-2">
                            {getSeverityIcon(issue.type)}
                            <span className="text-sm text-primary flex-1">{issue.message}</span>
                            <span className={`inline-flex rounded px-1.5 py-0 text-[10px] font-medium flex-shrink-0 ${getSeverityBadge(issue.type)}`}>
                              {issue.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {warningIssues.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-utility-warning-600 mb-1.5">
                        Warnings ({warningIssues.length})
                      </p>
                      <div className="space-y-1">
                        {warningIssues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-md border border-utility-warning-100 bg-utility-warning-50/30 px-3 py-2">
                            {getSeverityIcon(issue.type)}
                            <span className="text-sm text-primary flex-1">{issue.message}</span>
                            <span className={`inline-flex rounded px-1.5 py-0 text-[10px] font-medium flex-shrink-0 ${getSeverityBadge(issue.type)}`}>
                              {issue.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {recIssues.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-utility-blue-600 mb-1.5">
                        Recommendations ({recIssues.length})
                      </p>
                      <div className="space-y-1">
                        {recIssues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-md border border-utility-blue-100 bg-utility-blue-50/30 px-3 py-2">
                            {getSeverityIcon(issue.type)}
                            <span className="text-sm text-primary flex-1">{issue.message}</span>
                            <span className={`inline-flex rounded px-1.5 py-0 text-[10px] font-medium flex-shrink-0 ${getSeverityBadge(issue.type)}`}>
                              {issue.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEO Meta */}
            {(page.title || page.metaDescription || page.h1 || page.canonical) && (
              <div>
                <SectionHeader icon={Globe01} title="SEO Meta" />
                <div className="rounded-lg border border-secondary bg-secondary/20 p-4 space-y-3">
                  {page.title && (
                    <div>
                      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider block mb-0.5">Title</span>
                      <p className="text-sm text-primary">{page.title}</p>
                      <span className="text-[10px] text-quaternary">{page.title.length} chars</span>
                    </div>
                  )}
                  {page.metaDescription && (
                    <div>
                      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider block mb-0.5">Meta Description</span>
                      <p className="text-sm text-primary">{page.metaDescription}</p>
                      <span className="text-[10px] text-quaternary">{page.metaDescription.length} chars</span>
                    </div>
                  )}
                  {page.h1 && (
                    <div>
                      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider block mb-0.5">H1</span>
                      <p className="text-sm text-primary">{page.h1}</p>
                    </div>
                  )}
                  {page.canonical && (
                    <div>
                      <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider block mb-0.5">Canonical</span>
                      <a href={page.canonical} target="_blank" rel="noopener noreferrer" className="text-sm text-utility-blue-600 hover:underline break-all">
                        {page.canonical}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Metrics */}
            <div>
              <SectionHeader icon={Type01} title="Content" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricBox label="Word Count" value={page.wordCount.toLocaleString()} warn={page.wordCount < 300} />
                {page.pageSize != null && (
                  <MetricBox label="Page Size" value={formatBytes(page.pageSize)} warn={page.pageSize > 3 * 1024 * 1024} />
                )}
                {page.plainTextRate != null && (
                  <MetricBox label="Text/HTML Ratio" value={`${(page.plainTextRate * 100).toFixed(1)}%`} warn={page.plainTextRate < 0.1} />
                )}
                {page.totalDomSize != null && (
                  <MetricBox label="DOM Size" value={page.totalDomSize.toLocaleString()} warn={page.totalDomSize > 1500} />
                )}
              </div>

              {/* Readability */}
              {page.readabilityScores && (
                <div className="mt-3">
                  <p className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">Readability Scores</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <MetricBox label="Flesch-Kincaid" value={page.readabilityScores.fleschKincaidIndex.toFixed(1)} />
                    <MetricBox label="Coleman-Liau" value={page.readabilityScores.colemanLiauIndex.toFixed(1)} />
                    <MetricBox label="Dale-Chall" value={page.readabilityScores.daleChallIndex.toFixed(1)} />
                    <MetricBox label="SMOG" value={page.readabilityScores.smogIndex.toFixed(1)} />
                    <MetricBox label="ARI" value={page.readabilityScores.automatedReadabilityIndex.toFixed(1)} />
                  </div>
                </div>
              )}

              {/* Content Consistency */}
              {page.contentConsistency && (
                <div className="mt-3">
                  <p className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">Content Consistency</p>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricBox label="Title to Content" value={`${(page.contentConsistency.titleToContent * 100).toFixed(0)}%`} warn={page.contentConsistency.titleToContent < 0.3} />
                    <MetricBox label="Description to Content" value={`${(page.contentConsistency.descriptionToContent * 100).toFixed(0)}%`} warn={page.contentConsistency.descriptionToContent < 0.3} />
                  </div>
                </div>
              )}
            </div>

            {/* Heading Structure — table format */}
            {page.htags && (page.htags.h1.length > 0 || page.htags.h2.length > 0) && (
              <div>
                <SectionHeader icon={FileCode02} title="Heading Structure" />
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-secondary">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-quaternary uppercase w-16">Tag</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-quaternary uppercase">Content</th>
                      </tr>
                    </thead>
                    <tbody className="bg-primary divide-y divide-secondary">
                      {page.htags.h1.map((h, i) => (
                        <tr key={`h1-${i}`}>
                          <td className="px-4 py-2 text-xs font-semibold text-primary">H1</td>
                          <td className="px-4 py-2 text-sm text-primary truncate max-w-[500px]" title={h}>{h}</td>
                        </tr>
                      ))}
                      {page.htags.h2.map((h, i) => (
                        <tr key={`h2-${i}`}>
                          <td className="px-4 py-2 text-xs font-medium text-tertiary">H2</td>
                          <td className="px-4 py-2 text-xs text-secondary truncate max-w-[500px]" title={h}>{h}</td>
                        </tr>
                      ))}
                      {page.htags.h3?.slice(0, 10).map((h, i) => (
                        <tr key={`h3-${i}`}>
                          <td className="px-4 py-2 text-xs font-medium text-quaternary">H3</td>
                          <td className="px-4 py-2 text-xs text-tertiary truncate max-w-[500px]" title={h}>{h}</td>
                        </tr>
                      ))}
                      {page.htags.h3 && page.htags.h3.length > 10 && (
                        <tr>
                          <td className="px-4 py-2 text-xs text-quaternary" />
                          <td className="px-4 py-2 text-[10px] text-quaternary">+{page.htags.h3.length - 10} more H3 headings</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Links & Images */}
            {(page.internalLinksCount != null || page.externalLinksCount != null || page.imagesCount != null) && (
              <div>
                <SectionHeader icon={Link01} title="Links & Images" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {page.internalLinksCount != null && (
                    <MetricBox label="Internal Links" value={page.internalLinksCount} />
                  )}
                  {page.externalLinksCount != null && (
                    <MetricBox label="External Links" value={page.externalLinksCount} />
                  )}
                  {page.inboundLinksCount != null && (
                    <MetricBox label="Inbound Links" value={page.inboundLinksCount} />
                  )}
                  {page.imagesCount != null && (
                    <MetricBox label="Total Images" value={page.imagesCount} />
                  )}
                  {page.imagesCount != null && page.imagesMissingAlt != null && (
                    <MetricBox
                      label="With Alt"
                      value={`${page.imagesCount - page.imagesMissingAlt} / ${page.imagesCount}`}
                    />
                  )}
                  {page.imagesMissingAlt != null && (
                    <MetricBox label="Missing Alt" value={page.imagesMissingAlt} warn={page.imagesMissingAlt > 0} />
                  )}
                </div>

                {/* Image Alt Details — NO nested scrollbar, show as table */}
                {page.imageAlts && page.imageAlts.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-tertiary hover:text-primary transition-colors">
                      Image Details ({page.imageAlts.length})
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full divide-y divide-secondary">
                        <thead className="bg-secondary">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-medium text-quaternary uppercase">File</th>
                            <th className="px-3 py-2 text-left text-[10px] font-medium text-quaternary uppercase">Alt Text</th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-quaternary uppercase">Keyword</th>
                          </tr>
                        </thead>
                        <tbody className="bg-primary divide-y divide-secondary">
                          {page.imageAlts.map((img, idx) => (
                            <tr key={idx} className={!img.hasAlt ? "bg-utility-warning-50/20" : ""}>
                              <td className="px-3 py-2 text-xs text-tertiary max-w-[200px] truncate" title={img.src}>
                                {img.src.split("/").pop() || img.src}
                              </td>
                              <td className="px-3 py-2 text-xs max-w-[300px] truncate">
                                {img.hasAlt ? (
                                  <span className="text-primary">{img.alt}</span>
                                ) : (
                                  <span className="text-utility-warning-600 italic">Missing alt text</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {img.containsKeyword && img.matchedKeyword ? (
                                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-utility-success-50 text-utility-success-700">
                                    {img.matchedKeyword}
                                  </span>
                                ) : img.hasAlt ? (
                                  <span className="text-[10px] text-quaternary">--</span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Core Web Vitals — above Performance/Lighthouse */}
            {page.coreWebVitals && (
              <div>
                <SectionHeader icon={Zap} title="Core Web Vitals" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <CwvCard
                    label="LCP"
                    fullName="Largest Contentful Paint"
                    value={fmtCwv(page.coreWebVitals.largestContentfulPaint).val}
                    unit={fmtCwv(page.coreWebVitals.largestContentfulPaint).unit}
                    target="\u2264 2.5s"
                    metric="lcp"
                    rawValue={page.coreWebVitals.largestContentfulPaint}
                  />
                  <CwvCard
                    label="FID / TBT"
                    fullName="First Input Delay"
                    value={fmtCwv(page.coreWebVitals.firstInputDelay).val}
                    unit={fmtCwv(page.coreWebVitals.firstInputDelay).unit}
                    target="\u2264 100ms"
                    metric="fid"
                    rawValue={page.coreWebVitals.firstInputDelay}
                  />
                  <CwvCard
                    label="TTI"
                    fullName="Time to Interactive"
                    value={fmtCwv(page.coreWebVitals.timeToInteractive).val}
                    unit={fmtCwv(page.coreWebVitals.timeToInteractive).unit}
                    target="\u2264 3.8s"
                    metric="tti"
                    rawValue={page.coreWebVitals.timeToInteractive}
                  />
                  {page.coreWebVitals.cumulativeLayoutShift != null && (
                    <CwvCard
                      label="CLS"
                      fullName="Cumulative Layout Shift"
                      value={page.coreWebVitals.cumulativeLayoutShift.toFixed(3)}
                      unit=""
                      target="\u2264 0.1"
                      metric="cls"
                      rawValue={page.coreWebVitals.cumulativeLayoutShift}
                    />
                  )}
                </div>
                {/* Additional metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {page.loadTime != null && (
                    <MetricBox label="Load Time" value={`${page.loadTime.toFixed(2)}s`} warn={page.loadTime > 3} />
                  )}
                  <MetricBox label="DOM Complete" value={`${page.coreWebVitals.domComplete.toFixed(2)}s`} warn={page.coreWebVitals.domComplete > 4} />
                </div>
                {/* Status guide */}
                <div className="flex items-center gap-6 mt-3 pt-2 border-t border-secondary">
                  <span className="text-[10px] text-quaternary uppercase tracking-wider">Status:</span>
                  <div className="flex items-center gap-1.5">
                    <CwvStatusDot status="good" />
                    <span className="text-[10px] text-tertiary">Good</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CwvStatusDot status="needs-improvement" />
                    <span className="text-[10px] text-tertiary">Needs Improvement</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CwvStatusDot status="poor" />
                    <span className="text-[10px] text-tertiary">Poor</span>
                  </div>
                </div>
              </div>
            )}

            {/* Performance (load time only, when no CWV) */}
            {!page.coreWebVitals && page.loadTime != null && (
              <div>
                <SectionHeader icon={Zap} title="Performance" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricBox label="Load Time" value={`${page.loadTime.toFixed(2)}s`} warn={page.loadTime > 3} />
                </div>
              </div>
            )}

            {/* Lighthouse Scores */}
            {page.lighthouseScores && (
              <div>
                <SectionHeader icon={BarChart01} title="Lighthouse Scores" />
                <div className="flex items-center justify-around py-3 rounded-lg border border-secondary bg-secondary/10">
                  <LhScoreCircle score={page.lighthouseScores.performance} label="Performance" />
                  <LhScoreCircle score={page.lighthouseScores.accessibility} label="Accessibility" />
                  <LhScoreCircle score={page.lighthouseScores.bestPractices} label="Best Practices" />
                  <LhScoreCircle score={page.lighthouseScores.seo} label="SEO" />
                </div>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-utility-success-500" />
                    <span className="text-[10px] text-tertiary">90-100: Good</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-utility-warning-500" />
                    <span className="text-[10px] text-tertiary">50-89: Needs Improvement</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-utility-error-500" />
                    <span className="text-[10px] text-tertiary">0-49: Poor</span>
                  </div>
                </div>
              </div>
            )}

            {/* Technical */}
            {(page.scriptsCount != null || page.cacheControl || page.resourceErrors) && (
              <div>
                <SectionHeader icon={Clock} title="Technical" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {page.scriptsCount != null && (
                    <MetricBox label="Scripts" value={page.scriptsCount} />
                  )}
                  {page.renderBlockingScriptsCount != null && (
                    <MetricBox label="Render Blocking" value={page.renderBlockingScriptsCount} warn={page.renderBlockingScriptsCount > 0} />
                  )}
                  {page.cacheControl && (
                    <>
                      <MetricBox label="Cacheable" value={page.cacheControl.cachable ? "Yes" : "No"} warn={!page.cacheControl.cachable} />
                      <MetricBox label="Cache TTL" value={page.cacheControl.ttl > 0 ? `${page.cacheControl.ttl}s` : "None"} />
                    </>
                  )}
                  {page.resourceErrors && (
                    <>
                      <MetricBox label="Resource Errors" value={page.resourceErrors.errorCount} warn={page.resourceErrors.errorCount > 0} />
                      <MetricBox label="Resource Warnings" value={page.resourceErrors.warningCount} warn={page.resourceErrors.warningCount > 0} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Social & Flags */}
            {(page.socialMediaTags || page.brokenLinks || page.brokenResources || page.duplicateTitle || page.duplicateDescription || page.duplicateContent) && (
              <div>
                <SectionHeader icon={ShieldTick} title="Status Flags" />
                <div className="flex flex-wrap gap-2">
                  {page.socialMediaTags?.hasOgTags && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-success-50 text-utility-success-700">
                      <CheckCircle className="w-3 h-3" /> OG Tags
                    </span>
                  )}
                  {page.socialMediaTags && !page.socialMediaTags.hasOgTags && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-warning-50 text-utility-warning-700">
                      <AlertTriangle className="w-3 h-3" /> No OG Tags
                    </span>
                  )}
                  {page.socialMediaTags?.hasTwitterCard && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-success-50 text-utility-success-700">
                      <CheckCircle className="w-3 h-3" /> Twitter Card
                    </span>
                  )}
                  {page.socialMediaTags && !page.socialMediaTags.hasTwitterCard && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-warning-50 text-utility-warning-700">
                      <AlertTriangle className="w-3 h-3" /> No Twitter Card
                    </span>
                  )}
                  {page.brokenLinks && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-error-50 text-utility-error-700">
                      <AlertCircle className="w-3 h-3" /> Broken Links
                    </span>
                  )}
                  {page.brokenResources && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-error-50 text-utility-error-700">
                      <AlertCircle className="w-3 h-3" /> Broken Resources
                    </span>
                  )}
                  {page.duplicateTitle && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-warning-50 text-utility-warning-700">
                      <AlertTriangle className="w-3 h-3" /> Duplicate Title
                    </span>
                  )}
                  {page.duplicateDescription && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-warning-50 text-utility-warning-700">
                      <AlertTriangle className="w-3 h-3" /> Duplicate Description
                    </span>
                  )}
                  {page.duplicateContent && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-error-50 text-utility-error-700">
                      <AlertCircle className="w-3 h-3" /> Duplicate Content
                    </span>
                  )}
                  {!page.brokenLinks && !page.brokenResources && !page.duplicateTitle && !page.duplicateDescription && !page.duplicateContent && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-utility-success-50 text-utility-success-700">
                      <CheckCircle className="w-3 h-3" /> No duplicate/broken flags
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
