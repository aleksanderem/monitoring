/**
 * Independent diagnostic modules (8, 6, 11).
 * These modules query their own tables and don't depend on pre-loaded collections
 * from DiagnosticInput (beyond ctx and domain).
 */

import {
  DiagnosticInput,
  OnSiteDiagnostic,
  LinkBuildingDiagnostic,
  AIResearchDiagnostic,
  safeNumber,
} from "./diagnosticTypes";

// ─── Module 8: On-Site Diagnostic ───

export async function computeOnSiteDiagnostic(
  input: DiagnosticInput
): Promise<OnSiteDiagnostic> {
  const { ctx, domain, now } = input;
  const contradictions: string[] = [];

  // Query domainOnsiteAnalysis
  const analysis = await ctx.db
    .query("domainOnsiteAnalysis")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .first();

  const hasAnalysis = analysis !== null;
  const healthScore = analysis ? safeNumber(analysis.healthScore) : null;

  // Query latest onSiteScans (ordered desc by startedAt)
  const scans = await ctx.db
    .query("onSiteScans")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .order("desc")
    .take(1);
  const latestScan = scans.length > 0 ? scans[0] : null;

  let lastScanAge: number | null = null;
  let scanStatus: string | null = null;

  if (latestScan) {
    scanStatus = latestScan.status;
    const ageMs = now - latestScan.startedAt;
    lastScanAge = Math.round(ageMs / (1000 * 60 * 60)); // hours

    // Warning if scan older than 30 days (720h)
    if (lastScanAge > 720) {
      contradictions.push(
        `Last on-site scan is ${lastScanAge}h old (>${720}h / 30 days). Data may be stale.`
      );
    }

    // Warning if scan stuck (crawling > 2h)
    if (scanStatus === "crawling") {
      const crawlingAgeH = ageMs / (1000 * 60 * 60);
      if (crawlingAgeH > 2) {
        contradictions.push(
          `On-site scan has been in "crawling" status for ${Math.round(crawlingAgeH)}h (>2h). Possibly stuck.`
        );
      }
    }
  }

  // Violation: analysis exists but no scan
  if (hasAnalysis && !latestScan) {
    contradictions.push(
      "Orphaned analysis: domainOnsiteAnalysis exists but no onSiteScans found for this domain."
    );
  }

  // Issues summary
  let issuesSummary: { critical: number; warning: number; info: number } | null = null;
  if (analysis) {
    issuesSummary = {
      critical: safeNumber(analysis.criticalIssues),
      warning: safeNumber(analysis.warnings),
      info: safeNumber(analysis.recommendations),
    };
  }

  // Insights on-site score: (healthScore / 100) * 20, or 10 default
  let insightsOnsiteScore = 10;
  if (healthScore !== null) {
    insightsOnsiteScore = Math.round((healthScore / 100) * 20);
  }

  // Contradiction: high healthScore but many critical issues
  if (healthScore !== null && healthScore > 80 && analysis && safeNumber(analysis.criticalIssues) > 10) {
    contradictions.push(
      `Health score is ${healthScore} (>80) but criticalIssues=${analysis.criticalIssues} (>10). These metrics contradict each other.`
    );
  }

  return {
    hasAnalysis,
    healthScore,
    lastScanAge,
    scanStatus,
    issuesSummary,
    insightsOnsiteScore,
    contradictions,
  };
}

// ─── Module 6: Link Building Diagnostic ───

export async function computeLinkBuildingDiagnostic(
  input: DiagnosticInput
): Promise<LinkBuildingDiagnostic> {
  const { ctx, domain } = input;
  const contradictions: string[] = [];

  // Query all link building prospects for this domain
  const prospects = await ctx.db
    .query("linkBuildingProspects")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  const totalProspects = prospects.length;

  let identifiedProspects = 0;
  let reviewingProspects = 0;
  let dismissedCount = 0;
  let nanScoring = 0;

  for (const p of prospects) {
    if (p.status === "identified") identifiedProspects++;
    else if (p.status === "reviewing") reviewingProspects++;
    else if (p.status === "dismissed") dismissedCount++;

    // Check for NaN in prospectScore or estimatedImpact
    if (typeof p.prospectScore !== "number" || isNaN(p.prospectScore)) nanScoring++;
    if (typeof p.estimatedImpact !== "number" || isNaN(p.estimatedImpact)) nanScoring++;
  }

  const activeProspects = totalProspects - dismissedCount;

  if (nanScoring > 0) {
    contradictions.push(
      `${nanScoring} NaN value(s) found in prospect prospectScore or estimatedImpact fields.`
    );
  }

  const insightsVsLinkBuildingNote =
    `Insights counts 'identified' prospects (${identifiedProspects}), ` +
    `Link Building tab counts 'active' (non-dismissed: ${activeProspects}). ` +
    `Difference of ${activeProspects - identifiedProspects} comes from 'reviewing' prospects.`;

  return {
    totalProspects,
    activeProspects,
    identifiedProspects,
    reviewingProspects,
    nanScoring,
    insightsVsLinkBuildingNote,
    contradictions,
  };
}

// ─── Module 11: AI Research Diagnostic ───

export async function computeAIResearchDiagnostic(
  input: DiagnosticInput
): Promise<AIResearchDiagnostic> {
  const { ctx, domain } = input;

  // Query AI research sessions for this domain
  const sessions = await ctx.db
    .query("aiResearchSessions")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  return {
    totalSessions: sessions.length,
    stuckSessions: 0, // aiResearchSessions has no status field; all are completed results
  };
}
