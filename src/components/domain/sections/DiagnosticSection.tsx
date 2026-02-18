"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const STATUS_COLORS: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  violation: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICON: Record<string, string> = {
  ok: "\u2705",
  warning: "\u26a0\ufe0f",
  violation: "\u274c",
};

function CollapsibleSection({ title, badge, defaultOpen, children }: {
  title: string;
  badge?: { count: number; color: string };
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-secondary">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-primary hover:bg-secondary/30"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs text-tertiary">{open ? "\u25be" : "\u25b8"}</span>
          {title}
        </span>
        {badge && badge.count > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
            {badge.count}
          </span>
        )}
      </button>
      {open && <div className="border-t border-secondary px-4 py-3">{children}</div>}
    </div>
  );
}

function KV({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-xs text-tertiary">{label}</span>
      <span className={`text-xs font-mono ${warn ? "text-red-600 font-semibold" : "text-primary"}`}>{value}</span>
    </div>
  );
}

function ContradictionList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-xs text-tertiary italic">No contradictions</p>;
  return (
    <div className="space-y-1.5">
      {items.map((c, i) => (
        <div key={i} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {c}
        </div>
      ))}
    </div>
  );
}

export function DiagnosticSection({ domainId }: { domainId: Id<"domains"> }) {
  const data = useQuery(api.diagnostic.getDomainDiagnostic, { domainId });
  const [showRaw, setShowRaw] = useState(false);

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-secondary" />
        <div className="h-40 animate-pulse rounded-lg bg-secondary" />
        <div className="h-40 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="rounded-lg border border-secondary bg-primary p-6 text-center text-sm text-tertiary">
        SuperAdmin access required to view diagnostics.
      </div>
    );
  }

  const { domain: d, invariants } = data;
  const allContradictions = d.crossValidation.contradictions;
  const violations = invariants.filter((i) => i.status === "violation");
  const warnings = invariants.filter((i) => i.status === "warning");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Diagnostics</h2>
          <p className="text-sm text-tertiary">
            Generated {new Date(data.generatedAt).toLocaleString()} &mdash; {d.name}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {violations.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
              {violations.length} violation{violations.length !== 1 ? "s" : ""}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
              {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </span>
          )}
          {violations.length === 0 && warnings.length === 0 && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
              All clear
            </span>
          )}
        </div>
      </div>

      {/* Invariants */}
      <CollapsibleSection
        title="Invariants"
        badge={violations.length > 0 ? { count: violations.length, color: "bg-red-100 text-red-700" } : undefined}
        defaultOpen={violations.length > 0}
      >
        <div className="space-y-1.5">
          {invariants.map((inv, i) => (
            <div key={i} className={`flex items-start gap-2 rounded border px-3 py-2 text-xs ${STATUS_COLORS[inv.status]}`}>
              <span>{STATUS_ICON[inv.status]}</span>
              <span><span className="font-semibold">{inv.name}:</span> {inv.details}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Cross Validation Contradictions */}
      {allContradictions.length > 0 && (
        <CollapsibleSection
          title="Cross Validation Contradictions"
          badge={{ count: allContradictions.length, color: "bg-amber-100 text-amber-700" }}
          defaultOpen
        >
          <ContradictionList items={allContradictions} />
        </CollapsibleSection>
      )}

      {/* Keywords Summary */}
      <CollapsibleSection title="Keywords" defaultOpen>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <KV label="Active" value={d.keywords.active} />
          <KV label="Paused" value={d.keywords.paused} />
          <KV label="Pending approval" value={d.keywords.pendingApproval} />
          <KV label="Total" value={d.keywords.total} />
          <KV label="Limit" value={`${d.keywords.limit} (${d.keywords.limitSource})`} />
          <KV label="Within limit" value={d.keywords.withinLimit ? "Yes" : "NO"} warn={!d.keywords.withinLimit} />
        </div>
        <div className="mt-3 border-t border-secondary pt-3">
          <p className="mb-1 text-xs font-medium text-secondary">Denormalization Health</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <KV label="With position records" value={d.crossValidation.denormalization.keywordsWithPositionRecords} />
            <KV label="With denormalized pos" value={d.crossValidation.denormalization.keywordsWithDenormalizedPosition} />
            <KV label="With recentPositions" value={d.crossValidation.denormalization.keywordsWithRecentPositions} />
            <KV label="Stale (>48h)" value={d.crossValidation.denormalization.staleCount} warn={d.crossValidation.denormalization.staleCount > 0} />
            <KV
              label="Missing denorm"
              value={d.crossValidation.denormalization.missingDenormalization.length}
              warn={d.crossValidation.denormalization.missingDenormalization.length > 0}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Jobs */}
      <CollapsibleSection title="Jobs">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <KV label="Pending" value={d.jobs.pending} />
          <KV label="Processing" value={d.jobs.processing} warn={d.jobs.processing > 3} />
          <KV label="Completed" value={d.jobs.completed} />
          <KV label="Failed" value={d.jobs.failed} warn={d.jobs.failed > 0} />
          <KV label="Last job" value={d.jobs.lastJobAt ? new Date(d.jobs.lastJobAt).toLocaleString() : "—"} />
        </div>
      </CollapsibleSection>

      {/* Content Gaps */}
      <CollapsibleSection title="Content Gaps">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <KV label="Total" value={d.contentGaps.total} />
          <KV label="Identified" value={d.contentGaps.identified} />
          <KV label="Monitoring" value={d.contentGaps.monitoring} />
          <KV label="Dismissed" value={d.contentGaps.dismissed} />
          <KV label="High priority" value={d.contentGaps.highPriority} />
          <KV label="NaN scores" value={d.contentGaps.nanScores} warn={d.contentGaps.nanScores > 0} />
          <KV label="NaN difficulty" value={d.contentGaps.nanDifficulty} warn={d.contentGaps.nanDifficulty > 0} />
        </div>
      </CollapsibleSection>

      {/* Competitors & Backlinks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CollapsibleSection title="Competitors">
          <KV label="Count" value={d.competitors.count} />
          <KV label="With positions" value={d.competitors.withPositions} warn={d.competitors.count > 0 && d.competitors.withPositions === 0} />
        </CollapsibleSection>
        <CollapsibleSection title="Backlinks">
          <KV label="Table records" value={d.backlinks.tableRecords} />
          <KV label="Summary total" value={d.backlinks.summaryTotal} />
          <KV label="Dofollow" value={d.backlinks.summaryDofollow} />
          <KV label="Nofollow" value={d.backlinks.summaryNofollow} />
          <KV label="Capped" value={d.backlinks.capped ? "Yes" : "No"} warn={d.backlinks.capped} />
        </CollapsibleSection>
      </div>

      {/* Cross Validation Numbers */}
      <CollapsibleSection title="Monitoring vs Visibility">
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <p className="mb-1 text-xs font-medium text-secondary">Monitoring (tracked keywords)</p>
            <KV label="TOP-3" value={d.crossValidation.monitoring.top3} />
            <KV label="TOP-10" value={d.crossValidation.monitoring.top10} />
            <KV label="Avg position" value={d.crossValidation.monitoring.avgPosition} />
            <KV label="With position" value={d.crossValidation.monitoring.totalWithPosition} />
            <KV label="Gainers (7d)" value={d.crossValidation.monitoring.gainers7d} />
            <KV label="Losers (7d)" value={d.crossValidation.monitoring.losers7d} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-secondary">Visibility (discovered keywords)</p>
            <KV label="TOP-3" value={d.crossValidation.visibility.top3} />
            <KV label="TOP-10" value={d.crossValidation.visibility.top10} />
            <KV label="Avg position" value={d.crossValidation.visibility.avgPosition} />
            <KV label="Total" value={d.crossValidation.visibility.totalKeywords} />
            <KV label="Gainers" value={d.crossValidation.visibility.gainers} />
            <KV label="Losers" value={d.crossValidation.visibility.losers} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Module Results */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">Module Results</h3>

        <CollapsibleSection title="Overview" badge={{ count: d.overview.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          {d.overview.visibilityMetrics && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
              <KV label="Vis total" value={d.overview.visibilityMetrics.total} />
              <KV label="Vis TOP-3" value={d.overview.visibilityMetrics.top3} />
              <KV label="Vis TOP-10" value={d.overview.visibilityMetrics.top10} />
              <KV label="ETV" value={d.overview.visibilityMetrics.etv} />
            </div>
          )}
          <KV label="Actual discovered" value={`${d.overview.actualDiscoveredCounts.total} (TOP-3: ${d.overview.actualDiscoveredCounts.top3}, TOP-10: ${d.overview.actualDiscoveredCounts.top10})`} />
          <ContradictionList items={d.overview.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Monitoring Extension">
          <p className="text-xs font-medium text-secondary mb-1">Position Distribution</p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 mb-2">
            {Object.entries(d.monitoringExt.positionDistribution).map(([bucket, count]) => (
              <KV key={bucket} label={bucket} value={count} />
            ))}
          </div>
          <KV label="Distribution sum matches" value={d.monitoringExt.distributionSumMatchesTotal ? "Yes" : "NO"} warn={!d.monitoringExt.distributionSumMatchesTotal} />
          <p className="text-xs font-medium text-secondary mt-2 mb-1">recentPositions Health</p>
          <KV label="Fresh" value={d.monitoringExt.recentPositionsHealth.fresh} />
          <KV label="Stale (7d)" value={d.monitoringExt.recentPositionsHealth.stale7d} warn={d.monitoringExt.recentPositionsHealth.stale7d > 0} />
          <KV label="Empty" value={d.monitoringExt.recentPositionsHealth.empty} warn={d.monitoringExt.recentPositionsHealth.empty > 0} />
        </CollapsibleSection>

        <CollapsibleSection title="Keyword Map" badge={{ count: d.keywordMap.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="Discovered total" value={d.keywordMap.discoveredKeywordsTotal} />
            <KV label="Quick win candidates" value={d.keywordMap.quickWinCandidates} />
            <KV label="Excluded by NaN" value={d.keywordMap.quickWinExcludedByNaN} warn={d.keywordMap.quickWinExcludedByNaN > 0} />
            <KV label="Cannibalization URLs" value={d.keywordMap.cannibalizationUrlCount} warn={d.keywordMap.cannibalizationUrlCount > 5} />
            <KV label="Monitored match" value={d.keywordMap.monitoredMatchCount} />
            <KV label="Monitored no match" value={d.keywordMap.monitoredNoMatchCount} warn={d.keywordMap.monitoredNoMatchCount > 0} />
          </div>
          <ContradictionList items={d.keywordMap.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Visibility" badge={{ count: d.visibility.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="From DK: total" value={d.visibility.fromDiscoveredKeywords.total} />
            <KV label="From DK: TOP-3" value={d.visibility.fromDiscoveredKeywords.top3} />
            {d.visibility.fromVisibilityHistory && (
              <>
                <KV label="From VH: total" value={d.visibility.fromVisibilityHistory.total} />
                <KV label="From VH: TOP-3" value={d.visibility.fromVisibilityHistory.top3} />
              </>
            )}
          </div>
          <ContradictionList items={d.visibility.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Backlinks Extension" badge={{ count: d.backlinksExt.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="Null spam score" value={d.backlinksExt.nullSpamScore} warn={d.backlinksExt.nullSpamScore > 0} />
            <KV label="Null dofollow" value={d.backlinksExt.nullDofollow} />
            <KV label="Toxic count" value={d.backlinksExt.toxicCount} warn={d.backlinksExt.toxicCount > 10} />
          </div>
          <ContradictionList items={d.backlinksExt.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Link Building" badge={{ count: d.linkBuilding.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="Total prospects" value={d.linkBuilding.totalProspects} />
            <KV label="Active" value={d.linkBuilding.activeProspects} />
            <KV label="Identified" value={d.linkBuilding.identifiedProspects} />
            <KV label="Reviewing" value={d.linkBuilding.reviewingProspects} />
            <KV label="NaN scoring fields" value={d.linkBuilding.nanScoring} warn={d.linkBuilding.nanScoring > 0} />
          </div>
          <p className="text-xs text-tertiary italic mb-2">{d.linkBuilding.insightsVsLinkBuildingNote}</p>
          <ContradictionList items={d.linkBuilding.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="On-Site" badge={{ count: d.onSite.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="Has analysis" value={d.onSite.hasAnalysis ? "Yes" : "No"} />
            <KV label="Health score" value={d.onSite.healthScore ?? "—"} />
            <KV label="Last scan age (h)" value={d.onSite.lastScanAge ?? "—"} warn={d.onSite.lastScanAge != null && d.onSite.lastScanAge > 720} />
            <KV label="Scan status" value={d.onSite.scanStatus ?? "—"} />
          </div>
          {d.onSite.issuesSummary && (
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 mb-2">
              <KV label="Critical" value={d.onSite.issuesSummary.critical} warn={d.onSite.issuesSummary.critical > 0} />
              <KV label="Warning" value={d.onSite.issuesSummary.warning} />
              <KV label="Info" value={d.onSite.issuesSummary.info} />
            </div>
          )}
          <ContradictionList items={d.onSite.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Competitors Extension" badge={{ count: d.competitorsExt.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          {d.competitorsExt.perCompetitor.length > 0 && (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-tertiary">
                    <th className="pb-1 pr-3">Domain</th>
                    <th className="pb-1 pr-3">Coverage</th>
                    <th className="pb-1 pr-3">Keywords</th>
                    <th className="pb-1">Latest date</th>
                  </tr>
                </thead>
                <tbody>
                  {d.competitorsExt.perCompetitor.map((c, i) => (
                    <tr key={i} className="border-t border-secondary">
                      <td className="py-1 pr-3 font-mono">{c.domain}</td>
                      <td className={`py-1 pr-3 ${c.coveragePct < 50 ? "text-red-600 font-semibold" : ""}`}>{c.coveragePct}%</td>
                      <td className="py-1 pr-3">{c.keywordsCovered}/{c.keywordsTotal}</td>
                      <td className="py-1">{c.latestPositionDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ContradictionList items={d.competitorsExt.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Content Gaps Extension" badge={{ count: d.contentGapsExt.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="NaN estimatedTrafficValue" value={d.contentGapsExt.nanEstimatedTrafficValue} warn={d.contentGapsExt.nanEstimatedTrafficValue > 0} />
            <KV label="Orphaned gaps" value={d.contentGapsExt.orphanedGaps} warn={d.contentGapsExt.orphanedGaps > 0} />
            <KV label="Orphaned competitor refs" value={d.contentGapsExt.orphanedCompetitorRefs} warn={d.contentGapsExt.orphanedCompetitorRefs > 0} />
          </div>
          <ContradictionList items={d.contentGapsExt.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="Insights" badge={{ count: d.insights.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <p className="text-xs font-medium text-secondary mb-1">Health Score: {d.insights.healthScore.total}/100</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="Keywords (max 30)" value={d.insights.healthScore.breakdown.keywords} />
            <KV label="Backlinks (max 30)" value={d.insights.healthScore.breakdown.backlinks} />
            <KV label="On-site (max 20)" value={d.insights.healthScore.breakdown.onsite} />
            <KV label="Content (max 20)" value={d.insights.healthScore.breakdown.content} />
            <KV label="Math correct" value={d.insights.healthScore.mathCorrect ? "Yes" : "NO"} warn={!d.insights.healthScore.mathCorrect} />
            <KV label="Within bounds" value={d.insights.healthScore.withinBounds ? "Yes" : "NO"} warn={!d.insights.healthScore.withinBounds} />
          </div>
          <p className="text-xs font-medium text-secondary mt-2 mb-1">Keyword Insights vs Monitoring</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <KV label="At risk (>5 drop)" value={d.insights.keywordInsightsVsMonitoring.insightsAtRisk} />
            <KV label="Opportunities (>5 gain)" value={d.insights.keywordInsightsVsMonitoring.insightsOpportunities} />
            <KV label="Monitoring gainers" value={d.insights.keywordInsightsVsMonitoring.monitoringGainers} />
            <KV label="Monitoring losers" value={d.insights.keywordInsightsVsMonitoring.monitoringLosers} />
          </div>
          <ContradictionList items={d.insights.contradictions} />
        </CollapsibleSection>

        <CollapsibleSection title="AI Research">
          <KV label="Total sessions" value={d.aiResearch.totalSessions} />
          <KV label="Stuck sessions" value={d.aiResearch.stuckSessions} warn={d.aiResearch.stuckSessions > 0} />
        </CollapsibleSection>

        <CollapsibleSection title="Cross-Tab Checks" badge={{ count: d.crossTab.contradictions.length, color: "bg-amber-100 text-amber-700" }}>
          <div className="space-y-2 mb-2">
            <div>
              <p className="text-xs font-medium text-secondary">CT1: Keyword Count</p>
              <KV label="Monitoring" value={d.crossTab.ct1KeywordCountConsistency.monitoring} />
              <KV label="Insights" value={d.crossTab.ct1KeywordCountConsistency.insights} />
              <KV label="All match" value={d.crossTab.ct1KeywordCountConsistency.allMatch ? "Yes" : "NO"} warn={!d.crossTab.ct1KeywordCountConsistency.allMatch} />
            </div>
            <div>
              <p className="text-xs font-medium text-secondary">CT2: Content Gaps High Priority</p>
              <KV label="Content gaps tab" value={d.crossTab.ct2ContentGapsHighPriority.contentGapsTab} />
              <KV label="All match" value={d.crossTab.ct2ContentGapsHighPriority.allMatch ? "Yes" : "NO"} warn={!d.crossTab.ct2ContentGapsHighPriority.allMatch} />
            </div>
            <div>
              <p className="text-xs font-medium text-secondary">CT3: Toxic Backlinks</p>
              <KV label="Backlinks tab" value={d.crossTab.ct3ToxicBacklinks.backlinksTab} />
              <KV label="All match" value={d.crossTab.ct3ToxicBacklinks.allMatch ? "Yes" : "NO"} warn={!d.crossTab.ct3ToxicBacklinks.allMatch} />
            </div>
            <div>
              <p className="text-xs font-medium text-secondary">CT4: Link Building Prospects</p>
              <KV label="Link building tab" value={d.crossTab.ct4LinkBuildingProspects.linkBuildingTab} />
              <KV label="Insights tab" value={d.crossTab.ct4LinkBuildingProspects.insightsTab} />
              <KV label="All match" value={d.crossTab.ct4LinkBuildingProspects.allMatch ? "Yes" : "NO"} warn={!d.crossTab.ct4LinkBuildingProspects.allMatch} />
            </div>
          </div>
          <ContradictionList items={d.crossTab.contradictions} />
        </CollapsibleSection>
      </div>

      {/* Raw JSON toggle */}
      <div>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-brand-600 hover:underline"
        >
          {showRaw ? "Hide raw JSON" : "Show raw JSON"}
        </button>
        {showRaw && (
          <pre className="mt-2 max-h-[600px] overflow-auto rounded-lg border border-secondary bg-secondary/30 p-4 text-[11px] leading-relaxed font-mono text-primary">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
