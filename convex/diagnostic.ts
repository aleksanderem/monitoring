import { query, internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";
import { resolveKeywordLimit, resolveKeywordLimitSource, DEFAULT_KEYWORD_LIMIT } from "./limits";
import { DiagnosticInput, OverviewDiagnostic, MonitoringExtDiagnostic, KeywordMapDiagnostic, VisibilityDiagnostic, BacklinksExtDiagnostic, LinkBuildingDiagnostic, OnSiteDiagnostic, CompetitorsExtDiagnostic, ContentGapsExtDiagnostic, InsightsDiagnostic, AIResearchDiagnostic, CrossTabDiagnostic } from "./lib/diagnosticTypes";
import { computeOnSiteDiagnostic, computeLinkBuildingDiagnostic, computeAIResearchDiagnostic } from "./lib/diagnosticIndependent";
import { computeOverviewDiagnostic, computeMonitoringExtDiagnostic, computeKeywordMapDiagnostic, computeVisibilityDiagnostic, computeBacklinksExtDiagnostic } from "./lib/diagnosticCore";
import { computeCompetitorsExtDiagnostic, computeContentGapsExtDiagnostic, computeInsightsDiagnostic, computeCrossTabDiagnostic } from "./lib/diagnosticCross";

// ─── Shared types ────

type Invariant = { name: string; status: "ok" | "warning" | "violation"; details: string };

type CrossValidation = {
  monitoring: {
    top3: number; top10: number; avgPosition: number;
    totalWithPosition: number; gainers7d: number; losers7d: number;
  };
  visibility: {
    top3: number; top10: number; avgPosition: number;
    totalKeywords: number; gainers: number; losers: number;
  };
  denormalization: {
    keywordsWithPositionRecords: number;
    keywordsWithDenormalizedPosition: number;
    keywordsWithRecentPositions: number;
    staleCount: number;
    missingDenormalization: string[];
  };
  contradictions: string[];
};

type DomainStats = {
  name: string;
  id: string;
  keywords: {
    active: number; paused: number; pendingApproval: number;
    total: number; limit: number; limitSource: string; withinLimit: boolean;
  };
  positions: { total: number; lastUpdated: number | null };
  discoveredKeywords: { total: number; ranked: number };
  contentGaps: {
    total: number; identified: number; monitoring: number; dismissed: number;
    nanScores: number; nanDifficulty: number; highPriority: number;
  };
  competitors: { count: number; withPositions: number };
  backlinks: {
    tableRecords: number; summaryTotal: number;
    summaryDofollow: number; summaryNofollow: number; capped: boolean;
  };
  jobs: {
    pending: number; processing: number; completed: number;
    failed: number; lastJobAt: number | null;
  };
  crossValidation: CrossValidation;
  overview: OverviewDiagnostic;
  monitoringExt: MonitoringExtDiagnostic;
  keywordMap: KeywordMapDiagnostic;
  visibility: VisibilityDiagnostic;
  backlinksExt: BacklinksExtDiagnostic;
  linkBuilding: LinkBuildingDiagnostic;
  onSite: OnSiteDiagnostic;
  competitorsExt: CompetitorsExtDiagnostic;
  contentGapsExt: ContentGapsExtDiagnostic;
  insights: InsightsDiagnostic;
  aiResearch: AIResearchDiagnostic;
  crossTab: CrossTabDiagnostic;
};

// ─── Per-domain diagnostic logic ────

async function buildDomainDiagnostic(
  ctx: QueryCtx,
  domain: Doc<"domains">,
  project: Doc<"projects">,
  org: Doc<"organizations">,
  now: number,
): Promise<{ stats: DomainStats; invariants: Invariant[] }> {
  const invariants: Invariant[] = [];
  const sevenDaysAgoStr = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // ── Keywords ──
  const allKeywords = await ctx.db
    .query("keywords")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  const activeKws = allKeywords.filter((k) => k.status === "active");
  const active = activeKws.length;
  const paused = allKeywords.filter((k) => k.status === "paused").length;
  const pendingApproval = allKeywords.filter((k) => k.status === "pending_approval").length;
  const limit = resolveKeywordLimit(domain, project, org);
  const limitSource = resolveKeywordLimitSource(domain, project, org);

  if (active > limit) {
    invariants.push({
      name: "limit_exceeded",
      status: "violation",
      details: `${domain.domain}: ${active} active keywords > limit ${limit} (${limitSource})`,
    });
  }

  // ── Monitoring: position distribution from denormalized fields ──
  let monTop3 = 0;
  let monTop10 = 0;
  let monTotalPos = 0;
  let monPosCount = 0;
  let monGainers = 0;
  let monLosers = 0;

  // ── Denormalization health ──
  let kwWithDenormPos = 0;
  let kwWithRecentPos = 0;
  let kwWithPositionRecords = 0;
  let staleCount = 0;
  const missingDenorm: string[] = [];

  // Phase 1: stats from denormalized fields (no DB queries)
  for (const kw of activeKws) {
    const cp = kw.currentPosition;
    if (cp != null) {
      kwWithDenormPos++;
      monTotalPos += cp;
      monPosCount++;
      if (cp >= 1 && cp <= 3) monTop3++;
      if (cp >= 1 && cp <= 10) monTop10++;
    }

    const recent = kw.recentPositions ?? [];
    if (recent.length > 0) kwWithRecentPos++;

    if (recent.length >= 2) {
      const weekEntries = recent.filter((p) => p.date >= sevenDaysAgoStr);
      if (weekEntries.length >= 2) {
        const oldPos = weekEntries[0].position;
        const newPos = weekEntries[weekEntries.length - 1].position;
        if (oldPos !== null && newPos !== null) {
          if (newPos < oldPos) monGainers++;
          else if (newPos > oldPos) monLosers++;
        }
      }
    }
  }

  // Phase 2: batch-fetch position records for all keywords in parallel
  const posRecordsByKeyword = await Promise.all(
    activeKws.map((kw) =>
      ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
        .collect()
    )
  );

  // Phase 3: denormalization health checks from position records
  for (let i = 0; i < activeKws.length; i++) {
    const kw = activeKws[i];
    const posRecords = posRecordsByKeyword[i];
    const cp = kw.currentPosition;

    if (posRecords.length > 0) {
      kwWithPositionRecords++;
      const latestPos = posRecords.reduce((a, b) => a.date > b.date ? a : b);
      if (cp == null && latestPos.position != null) {
        missingDenorm.push(kw.phrase);
      }
      if (kw.positionUpdatedAt && latestPos.fetchedAt - kw.positionUpdatedAt > 48 * 3600_000) {
        staleCount++;
      }
    }
  }

  const monAvgPos = monPosCount > 0 ? Math.round((monTotalPos / monPosCount) * 10) / 10 : 0;

  // ── Discovered keywords: visibility data ──
  const discovered = await ctx.db
    .query("discoveredKeywords")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  const rankedDiscovered = discovered.filter((d) => d.bestPosition !== 999);
  let visTop3 = 0;
  let visTop10 = 0;
  let visTotalPos = 0;
  let visPosCount = 0;

  for (const dk of rankedDiscovered) {
    const p = dk.bestPosition;
    if (p > 0 && p <= 100) {
      visTotalPos += p;
      visPosCount++;
      if (p <= 3) visTop3++;
      if (p <= 10) visTop10++;
    }
  }

  const visAvgPos = visPosCount > 0 ? Math.round((visTotalPos / visPosCount) * 10) / 10 : 0;

  // ── Visibility history ──
  const visHistory = await ctx.db
    .query("domainVisibilityHistory")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .order("desc")
    .first();

  const visGainers = visHistory?.metrics.is_up ?? 0;
  const visLosers = visHistory?.metrics.is_down ?? 0;

  // ── Cross-validation: detect contradictions ──
  const contradictions: string[] = [];

  if (monPosCount === 0 && missingDenorm.length > 0) {
    contradictions.push(
      `UI shows "no position data" (0 denormalized) but ${missingDenorm.length} keywords have non-null position records in DB. Denormalization broken — run repairDenormalization.`
    );
  }
  if (monAvgPos === 0 && missingDenorm.length > 0) {
    contradictions.push(
      `Avg position shows 0.0 but ${missingDenorm.length} keywords have non-null position records. currentPosition field is null on these keywords.`
    );
  }
  if (visTop3 > 0 && monTop3 === 0 && active > 0) {
    contradictions.push(
      `Visibility says ${visTop3} keywords in top 3, but monitoring shows 0. Likely missing position checks for monitored keywords, or keyword overlap is low.`
    );
  }
  if (monTop3 > 0 && visTop3 > 0 && Math.abs(monTop3 - visTop3) > Math.max(monTop3, visTop3) * 0.5) {
    contradictions.push(
      `Top 3 count mismatch: monitoring=${monTop3} (from ${active} tracked keywords), visibility=${visTop3} (from ${rankedDiscovered.length} discovered keywords). These are DIFFERENT keyword populations — UI should label which is which.`
    );
  }
  if (monGainers === 0 && monLosers === 0 && (visGainers > 0 || visLosers > 0) && active > 0) {
    contradictions.push(
      `Monitoring shows 0 position changes (7d) but visibility data shows ${visGainers} up / ${visLosers} down. Monitoring relies on recentPositions array (${kwWithRecentPos}/${active} keywords have it). Visibility data comes from DataForSEO domain scans.`
    );
  }
  if (missingDenorm.length > 0) {
    const sample = missingDenorm.slice(0, 5).join(", ");
    const more = missingDenorm.length > 5 ? ` (+${missingDenorm.length - 5} more)` : "";
    contradictions.push(
      `${missingDenorm.length} keywords have position records but null currentPosition (stale denormalization): ${sample}${more}`
    );
  }
  if (kwWithPositionRecords > 0 && kwWithRecentPos === 0) {
    contradictions.push(
      `${kwWithPositionRecords} keywords have position records but 0 have recentPositions array populated. 7-day movement will always show 0.`
    );
  }
  if (missingDenorm.length > 0 && kwWithRecentPos === 0) {
    contradictions.push(
      `${missingDenorm.length} keywords have non-null position records but recentPositions is empty. Movement trend chart will show no data. Run repairDenormalization.`
    );
  }

  if (contradictions.length > 0) {
    invariants.push({
      name: "cross_view_contradiction",
      status: "violation",
      details: `${domain.domain}: ${contradictions.length} data contradictions between monitoring and visibility views`,
    });
  }

  // ── Content gaps ──
  const gaps = await ctx.db
    .query("contentGaps")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  const nanScoreGaps = gaps.filter((g) => isNaN(g.opportunityScore));
  const nanDiffGaps = gaps.filter((g) => isNaN(g.difficulty));
  if (nanScoreGaps.length > 0 || nanDiffGaps.length > 0) {
    contradictions.push(
      `Content gaps have corrupted data: ${nanScoreGaps.length} with NaN opportunityScore, ${nanDiffGaps.length} with NaN difficulty. Run repairContentGapScores.`
    );
  }

  const activeGaps = gaps.filter((g) => g.status !== "dismissed");
  const storedHighPriority = activeGaps.filter((g) => g.priority === "high").length;
  let recalcHighPriority = 0;
  for (const g of activeGaps) {
    if (isNaN(g.opportunityScore)) continue;
    if (g.opportunityScore >= 70) recalcHighPriority++;
  }
  if (storedHighPriority !== recalcHighPriority && activeGaps.length > 0) {
    contradictions.push(
      `Content gap priority mismatch: ${storedHighPriority} stored as "high" but ${recalcHighPriority} have score >= 70. Priority field may be stale.`
    );
  }

  // ── Competitors ──
  const competitors = await ctx.db
    .query("competitors")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  let competitorsWithPositions = 0;
  for (const comp of competitors) {
    const compPos = await ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", comp._id))
      .first();
    if (compPos) competitorsWithPositions++;
  }

  if (competitors.length > 0 && competitorsWithPositions === 0) {
    invariants.push({
      name: "competitors_without_positions",
      status: "warning",
      details: `${domain.domain}: ${competitors.length} competitors but none have position data`,
    });
  }

  // ── Backlinks ──
  const backlinks = await ctx.db
    .query("domainBacklinks")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();

  const backlinkSummary = await ctx.db
    .query("domainBacklinksSummary")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .unique();

  if (backlinkSummary && backlinkSummary.totalBacklinks > backlinks.length && backlinks.length > 0) {
    contradictions.push(
      `Backlink count mismatch: summary says ${backlinkSummary.totalBacklinks} total but only ${backlinks.length} records stored (capped at 1000). Ratios calculated from table sample may be inaccurate.`
    );
  }

  if (backlinkSummary && backlinks.length > 0) {
    const summaryDfRatio = (backlinkSummary.dofollow + backlinkSummary.nofollow) > 0
      ? Math.round((backlinkSummary.dofollow / (backlinkSummary.dofollow + backlinkSummary.nofollow)) * 100)
      : 0;
    const tableDfCount = backlinks.filter((bl) => bl.dofollow === true).length;
    const tableDfRatio = Math.round((tableDfCount / backlinks.length) * 100);
    if (Math.abs(summaryDfRatio - tableDfRatio) > 10) {
      contradictions.push(
        `Backlink dofollow ratio diverges: summary=${summaryDfRatio}% (from API totals), table=${tableDfRatio}% (from ${backlinks.length} stored records). Sample may not be representative.`
      );
    }
  }

  // ── Jobs ──
  const checkJobs = await ctx.db
    .query("keywordCheckJobs")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();
  const serpJobs = await ctx.db
    .query("keywordSerpJobs")
    .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
    .collect();
  const allJobs = [...checkJobs, ...serpJobs];

  const jobsPending = allJobs.filter((j) => j.status === "pending").length;
  const jobsProcessing = allJobs.filter((j) => j.status === "processing").length;
  const jobsCompleted = allJobs.filter((j) => j.status === "completed").length;
  const jobsFailed = allJobs.filter((j) => j.status === "failed").length;
  const lastJobAt = allJobs.length > 0 ? Math.max(...allJobs.map((j) => j.createdAt)) : null;

  const stuckJobs = allJobs.filter(
    (j) => j.status === "processing" && j.startedAt && (now - j.startedAt) > 30 * 60_000
  );
  if (stuckJobs.length > 0) {
    invariants.push({
      name: "stuck_jobs",
      status: "violation",
      details: `${domain.domain}: ${stuckJobs.length} jobs processing for over 30 minutes`,
    });
  }

  // ── Build DiagnosticInput for helper modules ──
  const diagInput: DiagnosticInput = {
    ctx,
    domain,
    activeKws,
    allKeywords,
    discovered,
    rankedDiscovered,
    gaps,
    competitors,
    backlinks,
    backlinkSummary: backlinkSummary ?? null,
    visHistory: visHistory ?? null,
    monitoringComputed: {
      top3: monTop3, top10: monTop10, avgPosition: monAvgPos,
      totalWithPosition: monPosCount, gainers7d: monGainers, losers7d: monLosers,
    },
    visibilityComputed: {
      top3: visTop3, top10: visTop10, avgPosition: visAvgPos,
      totalKeywords: rankedDiscovered.length,
    },
    contentGapComputed: {
      storedHighPriority, recalcHighPriority,
      nanScores: nanScoreGaps.length, nanDifficulty: nanDiffGaps.length,
    },
    now,
  };

  // ── Call helper modules (independent ones in parallel) ──
  const [overview, monitoringExt, keywordMap, visibility, backlinksExt, linkBuilding, onSite, competitorsExt, contentGapsExt] = await Promise.all([
    computeOverviewDiagnostic(diagInput),
    computeMonitoringExtDiagnostic(diagInput),
    computeKeywordMapDiagnostic(diagInput),
    computeVisibilityDiagnostic(diagInput),
    computeBacklinksExtDiagnostic(diagInput),
    computeLinkBuildingDiagnostic(diagInput),
    computeOnSiteDiagnostic(diagInput),
    computeCompetitorsExtDiagnostic(diagInput),
    computeContentGapsExtDiagnostic(diagInput),
  ]);

  const insights = await computeInsightsDiagnostic(diagInput, {
    onSiteHealthScore: onSite.healthScore,
    toxicBacklinkCount: backlinksExt.toxicCount,
    identifiedProspectsCount: linkBuilding.identifiedProspects,
    linkBuildingActiveProspects: linkBuilding.activeProspects,
    backlinksTabToxicCount: backlinksExt.toxicCount,
  });

  const aiResearch = await computeAIResearchDiagnostic(diagInput);

  const crossTab = await computeCrossTabDiagnostic(diagInput, {
    insightsKeywordCount: activeKws.length,
    linkBuildingActiveProspects: linkBuilding.activeProspects,
    identifiedProspects: linkBuilding.identifiedProspects,
    toxicBacklinkCount: backlinksExt.toxicCount,
    contentGapsHighPriority: recalcHighPriority,
  });

  // ── Collect all module contradictions ──
  const allModuleContradictions = [
    ...overview.contradictions,
    ...keywordMap.contradictions,
    ...visibility.contradictions,
    ...backlinksExt.contradictions,
    ...linkBuilding.contradictions,
    ...onSite.contradictions,
    ...competitorsExt.contradictions,
    ...contentGapsExt.contradictions,
    ...insights.contradictions,
    ...crossTab.contradictions,
  ];
  contradictions.push(...allModuleContradictions);

  if (allModuleContradictions.length > 0) {
    invariants.push({
      name: "extended_diagnostics_issues",
      status: "warning",
      details: `${domain.domain}: ${allModuleContradictions.length} additional issues found by extended diagnostic modules`,
    });
  }

  const stats: DomainStats = {
    name: domain.domain,
    id: domain._id,
    keywords: { active, paused, pendingApproval, total: allKeywords.length, limit, limitSource, withinLimit: active <= limit },
    positions: { total: kwWithPositionRecords > 0 ? allKeywords.filter((k) => k.status === "active").length : 0, lastUpdated: null },
    discoveredKeywords: { total: discovered.length, ranked: rankedDiscovered.length },
    contentGaps: {
      total: gaps.length,
      identified: gaps.filter((g) => g.status === "identified").length,
      monitoring: gaps.filter((g) => g.status === "monitoring").length,
      dismissed: gaps.filter((g) => g.status === "dismissed").length,
      nanScores: nanScoreGaps.length,
      nanDifficulty: nanDiffGaps.length,
      highPriority: storedHighPriority,
    },
    competitors: { count: competitors.length, withPositions: competitorsWithPositions },
    backlinks: {
      tableRecords: backlinks.length,
      summaryTotal: backlinkSummary?.totalBacklinks ?? 0,
      summaryDofollow: backlinkSummary?.dofollow ?? 0,
      summaryNofollow: backlinkSummary?.nofollow ?? 0,
      capped: backlinkSummary ? backlinkSummary.totalBacklinks > backlinks.length : false,
    },
    jobs: { pending: jobsPending, processing: jobsProcessing, completed: jobsCompleted, failed: jobsFailed, lastJobAt },
    crossValidation: {
      monitoring: {
        top3: monTop3, top10: monTop10, avgPosition: monAvgPos,
        totalWithPosition: monPosCount, gainers7d: monGainers, losers7d: monLosers,
      },
      visibility: {
        top3: visTop3, top10: visTop10, avgPosition: visAvgPos,
        totalKeywords: rankedDiscovered.length, gainers: visGainers, losers: visLosers,
      },
      denormalization: {
        keywordsWithPositionRecords: kwWithPositionRecords,
        keywordsWithDenormalizedPosition: kwWithDenormPos,
        keywordsWithRecentPositions: kwWithRecentPos,
        staleCount,
        missingDenormalization: missingDenorm,
      },
      contradictions,
    },
    overview,
    monitoringExt,
    keywordMap,
    visibility,
    backlinksExt,
    linkBuilding,
    onSite,
    competitorsExt,
    contentGapsExt,
    insights,
    aiResearch,
    crossTab,
  };

  return { stats, invariants };
}

// ─── Org-wide snapshot (calls per-domain helper in a loop) ────

async function buildDiagnosticSnapshot(ctx: QueryCtx, org: Doc<"organizations">) {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
    .collect();

  const allInvariants: Invariant[] = [];
  const now = Date.now();

  type ProjectStats = {
    name: string;
    id: string;
    domainCount: number;
    domains: DomainStats[];
  };

  const projects: ProjectStats[] = [];

  for (const team of teams) {
    const teamProjects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    for (const project of teamProjects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      const domainStats: DomainStats[] = [];

      const domainResults = await Promise.all(
        domains.map((domain) => buildDomainDiagnostic(ctx, domain, project, org, now))
      );
      for (const { stats, invariants } of domainResults) {
        domainStats.push(stats);
        allInvariants.push(...invariants);
      }

      projects.push({
        name: project.name,
        id: project._id,
        domainCount: domains.length,
        domains: domainStats,
      });
    }
  }

  // ── Summary invariants ──
  if (!allInvariants.some((i) => i.name === "limit_exceeded")) {
    allInvariants.push({ name: "limit_enforcement", status: "ok", details: "All domains within keyword limits" });
  }
  if (!allInvariants.some((i) => i.name === "stuck_jobs")) {
    allInvariants.push({ name: "job_health", status: "ok", details: "No stuck jobs detected" });
  }
  if (!allInvariants.some((i) => i.name === "cross_view_contradiction")) {
    allInvariants.push({ name: "cross_view_consistency", status: "ok", details: "No contradictions between monitoring and visibility data" });
  }

  const dataSources = {
    note: "This app has TWO parallel data systems. If their numbers disagree in the UI, that is a bug or a labeling issue.",
    monitoring: {
      description: "User-added keywords tracked by position checking jobs",
      tables: ["keywords", "keywordPositions"],
      statsQuery: "keywords.getMonitoringStats → reads keywords.currentPosition, recentPositions",
      distributionQuery: "keywords.getPositionDistribution → reads keywords.currentPosition",
      trendQuery: "keywords.getMovementTrend → reads keywords.recentPositions (monitoring data)",
      trendNote: "FIXED: getMovementTrend now reads monitoring data (keywords.recentPositions) instead of domainVisibilityHistory.",
    },
    visibility: {
      description: "All keywords discovered by DataForSEO domain visibility scans",
      tables: ["discoveredKeywords", "domainVisibilityHistory"],
      statsQuery: "domains.getVisibilityStats → reads discoveredKeywords.bestPosition",
      metricsQuery: "domains.getLatestVisibilityMetrics → reads domainVisibilityHistory.metrics",
    },
  };

  return {
    generatedAt: now,
    organization: {
      name: org.name,
      id: org._id,
      limits: org.limits ?? null,
      defaultKeywordLimit: DEFAULT_KEYWORD_LIMIT,
    },
    hierarchy: { projects },
    invariants: allInvariants,
    dataSources,
  };
}

// ─── Public query: org-wide snapshot (requires superAdmin) ────

export const getDiagnosticSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const superAdmin = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!superAdmin) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const org = await ctx.db.get(membership.organizationId);
    if (!org) return null;

    return buildDiagnosticSnapshot(ctx, org);
  },
});

// ─── Public query: per-domain diagnostic (requires superAdmin) ────

export const getDomainDiagnostic = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const superAdmin = await ctx.db
      .query("superAdmins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!superAdmin) return null;

    const domain = await ctx.db.get(args.domainId);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return null;

    // Need org for keyword limit resolution
    const team = await ctx.db.get(project.teamId);
    if (!team) return null;
    const org = await ctx.db.get(team.organizationId);
    if (!org) return null;

    const now = Date.now();
    const { stats, invariants } = await buildDomainDiagnostic(ctx, domain, project, org, now);

    // Add summary invariants
    if (!invariants.some((i) => i.name === "limit_exceeded")) {
      invariants.push({ name: "limit_enforcement", status: "ok", details: "Within keyword limits" });
    }
    if (!invariants.some((i) => i.name === "stuck_jobs")) {
      invariants.push({ name: "job_health", status: "ok", details: "No stuck jobs detected" });
    }
    if (!invariants.some((i) => i.name === "cross_view_contradiction")) {
      invariants.push({ name: "cross_view_consistency", status: "ok", details: "No data contradictions" });
    }

    return { generatedAt: now, domain: stats, invariants };
  },
});

// ─── Internal query (for CLI / dev tooling, no auth) ────

export const getDiagnosticSnapshotInternal = internalQuery({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    let org: Doc<"organizations"> | null = null;

    if (args.organizationId) {
      org = await ctx.db.get(args.organizationId);
    } else {
      const firstOrg = await ctx.db.query("organizations").first();
      org = firstOrg;
    }

    if (!org) return null;
    return buildDiagnosticSnapshot(ctx, org);
  },
});
