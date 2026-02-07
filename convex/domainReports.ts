import { v } from "convex/values";
import { query, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─── Report Steps Definition ────────────────────────────────────

const REPORT_STEPS = [
  { name: "Fetching competitor backlinks" },
  { name: "Analyzing content gaps" },
  { name: "Generating link building prospects" },
  { name: "Checking on-site data" },
  { name: "Collecting keyword data" },
  { name: "Collecting backlink data" },
  { name: "Collecting competitor data" },
  { name: "Collecting content gap data" },
  { name: "Collecting on-site data" },
  { name: "Collecting insights & recommendations" },
];

// ─── Public Queries ─────────────────────────────────────────────

export const getDomainReport = query({
  args: { reportId: v.id("domainReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

export const getLatestDomainReport = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("domainReports")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(5);

    // Return latest ready report
    return reports.find((r) => r.status === "ready") ?? null;
  },
});

// ─── Public Action (Entry Point) ────────────────────────────────

export const generateDomainReport = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<{ reportId: Id<"domainReports"> }> => {
    const domain = await ctx.runQuery(internal.domainReports.getDomainInternal, {
      domainId: args.domainId,
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    const reportId = await ctx.runMutation(internal.domainReports.createDomainReportInternal, {
      domainId: args.domainId,
      name: `SEO Report — ${domain.domain}`,
    });

    await ctx.scheduler.runAfter(0, internal.domainReports.processReport, {
      reportId,
      domainId: args.domainId,
    });

    return { reportId };
  },
});

// ─── Internal Mutations ─────────────────────────────────────────

export const createDomainReportInternal = internalMutation({
  args: {
    domainId: v.id("domains"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const steps = REPORT_STEPS.map((s) => ({
      name: s.name,
      status: "pending" as const,
    }));

    return await ctx.db.insert("domainReports", {
      domainId: args.domainId,
      name: args.name,
      status: "initializing",
      progress: 0,
      currentStep: "Initializing...",
      steps,
      createdAt: Date.now(),
    });
  },
});

export const updateReportProgress = internalMutation({
  args: {
    reportId: v.id("domainReports"),
    progress: v.number(),
    currentStep: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("initializing"),
      v.literal("analyzing"),
      v.literal("collecting"),
      v.literal("ready"),
      v.literal("failed")
    )),
    stepIndex: v.optional(v.number()),
    stepStatus: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("skipped"), v.literal("failed"))),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return;

    const patch: Record<string, unknown> = {
      progress: args.progress,
    };

    if (args.currentStep !== undefined) patch.currentStep = args.currentStep;
    if (args.status !== undefined) patch.status = args.status;

    if (args.stepIndex !== undefined && args.stepStatus !== undefined && report.steps) {
      const steps = [...report.steps];
      if (steps[args.stepIndex]) {
        steps[args.stepIndex] = {
          ...steps[args.stepIndex],
          status: args.stepStatus,
          ...(args.stepStatus === "running" ? { startedAt: Date.now() } : {}),
          ...(args.stepStatus === "completed" || args.stepStatus === "skipped" || args.stepStatus === "failed" ? { completedAt: Date.now() } : {}),
        };
        patch.steps = steps;
      }
    }

    await ctx.db.patch(args.reportId, patch);
  },
});

export const storeReportData = internalMutation({
  args: {
    reportId: v.id("domainReports"),
    reportData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      reportData: args.reportData,
      status: "ready",
      progress: 100,
      currentStep: "Report ready!",
      completedAt: Date.now(),
    });
  },
});

export const failReport = internalMutation({
  args: {
    reportId: v.id("domainReports"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

// ─── Cancel Report (Public Mutation) ────────────────────────────

export const cancelReport = internalMutation({
  args: { reportId: v.id("domainReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return;
    if (report.status === "ready" || report.status === "failed") return;

    await ctx.db.patch(args.reportId, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
    });
  },
});

export const cancelDomainReport = action({
  args: { reportId: v.id("domainReports") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(internal.domainReports.cancelReport, {
      reportId: args.reportId,
    });
  },
});

// ─── Internal Queries ───────────────────────────────────────────

export const getDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.domainId);
  },
});

export const getReportInternal = internalQuery({
  args: { reportId: v.id("domainReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

/**
 * Single comprehensive data collection query.
 * Gathers all report data in one internal query to avoid needing
 * dozens of separate internal query wrappers.
 */
export const collectReportDataInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domainId = args.domainId;

    // ── Keywords ──────────────────────────────────────────────
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const activeKeywords = keywords.filter((k) => k.status === "active");

    // Position distribution from discovered keywords
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const positionDistribution = { top3: 0, pos4_10: 0, pos11_20: 0, pos21_50: 0, pos51_100: 0, pos100plus: 0 };
    for (const kw of discoveredKeywords.filter((dk) => dk.bestPosition !== 999)) {
      const pos = kw.bestPosition;
      if (pos > 0 && pos <= 3) positionDistribution.top3++;
      else if (pos <= 10) positionDistribution.pos4_10++;
      else if (pos <= 20) positionDistribution.pos11_20++;
      else if (pos <= 50) positionDistribution.pos21_50++;
      else if (pos <= 100) positionDistribution.pos51_100++;
      else positionDistribution.pos100plus++;
    }

    // Monitoring stats
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    let totalPosition = 0;
    let positionCount = 0;
    let gainers = 0;
    let losers = 0;
    let stable = 0;
    const topPerformersGainers: Array<{ phrase: string; oldPosition: number; newPosition: number; change: number }> = [];
    const topPerformersLosers: Array<{ phrase: string; oldPosition: number; newPosition: number; change: number }> = [];
    const nearPage1: Array<{ phrase: string; position: number; searchVolume: number | null }> = [];
    const atRisk: Array<{ phrase: string; currentPosition: number; drop: number }> = [];

    for (const kw of activeKeywords.slice(0, 100)) {
      const latestPos = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
        .order("desc")
        .first();

      if (!latestPos?.position) continue;

      totalPosition += latestPos.position;
      positionCount++;

      // Near page 1
      if (latestPos.position >= 11 && latestPos.position <= 20) {
        nearPage1.push({ phrase: kw.phrase, position: latestPos.position, searchVolume: latestPos.searchVolume ?? null });
      }

      const oldPos = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", kw._id))
        .filter((q) => q.lte(q.field("date"), sevenDaysAgoStr))
        .order("desc")
        .first();

      if (!oldPos?.position) continue;

      const change = oldPos.position - latestPos.position;
      if (change > 0) {
        gainers++;
        topPerformersGainers.push({ phrase: kw.phrase, oldPosition: oldPos.position, newPosition: latestPos.position, change });
      } else if (change < 0) {
        losers++;
        topPerformersLosers.push({ phrase: kw.phrase, oldPosition: oldPos.position, newPosition: latestPos.position, change });
        if (change < -5) {
          atRisk.push({ phrase: kw.phrase, currentPosition: latestPos.position, drop: Math.abs(change) });
        }
      } else {
        stable++;
      }
    }

    topPerformersGainers.sort((a, b) => b.change - a.change);
    topPerformersLosers.sort((a, b) => a.change - b.change);
    atRisk.sort((a, b) => b.drop - a.drop);
    nearPage1.sort((a, b) => a.position - b.position);

    const avgPosition = positionCount > 0 ? Math.round((totalPosition / positionCount) * 10) / 10 : 0;

    // ── Backlinks ─────────────────────────────────────────────
    const backlinkSummary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .unique();

    const backlinkDistributions = await ctx.db
      .query("domainBacklinksDistributions")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .unique();

    const allBacklinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    // Anchor text distribution
    const domain = await ctx.db.get(domainId);
    const domainName = domain?.domain || "";
    const anchorCategories: Record<string, number> = { branded: 0, exact_url: 0, generic: 0, other: 0 };
    const GENERIC_ANCHORS = new Set(["click here", "here", "read more", "learn more", "visit", "website", "link", "source", "view"]);
    for (const bl of allBacklinks) {
      const anchor = (bl.anchor || "").toLowerCase().trim();
      if (!anchor) { anchorCategories.generic++; continue; }
      if (/^https?:\/\//.test(anchor) || /^www\./.test(anchor)) { anchorCategories.exact_url++; continue; }
      const domainBase = domainName.replace(/\.(com|org|net|io|pl|co|de|uk|eu|info|biz)$/i, "").toLowerCase();
      if (domainBase.length > 2 && anchor.includes(domainBase)) { anchorCategories.branded++; continue; }
      if (GENERIC_ANCHORS.has(anchor)) { anchorCategories.generic++; continue; }
      anchorCategories.other++;
    }

    // Toxic links
    const toxicLinks = allBacklinks
      .filter((bl) => (bl.backlink_spam_score ?? 0) >= 70)
      .sort((a, b) => (b.backlink_spam_score ?? 0) - (a.backlink_spam_score ?? 0))
      .slice(0, 50)
      .map((bl) => ({
        urlFrom: bl.urlFrom, domainFrom: bl.domainFrom, anchor: bl.anchor,
        spamScore: bl.backlink_spam_score ?? 0, dofollow: bl.dofollow,
      }));

    // ── Competitors ───────────────────────────────────────────
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const competitorList = competitors.map((c) => ({
      domain: c.competitorDomain,
      name: c.name,
      status: c.status,
      lastCheckedAt: c.lastCheckedAt,
    }));

    // ── Content Gaps ──────────────────────────────────────────
    const contentGaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    // Sanitize NaN scores and recalculate priority if needed
    const sanitizedGaps = contentGaps.map((g) => {
      let score = g.opportunityScore;
      let priority = g.priority;
      if (isNaN(score) || score === null || score === undefined) {
        // Recalculate from available fields
        const vol = g.searchVolume ?? 0;
        const diff = g.difficulty ?? 50;
        const compPos = g.competitorPosition ?? 50;
        const volScore = Math.min((vol / 10000) * 50, 50);
        const diffScore = Math.max(50 - diff / 2, 0);
        const posBonus = compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0;
        score = Math.min(Math.round(volScore + diffScore + posBonus), 100);
      }
      if (score >= 70) priority = "high";
      else if (score >= 40) priority = "medium";
      else priority = "low";
      return { ...g, opportunityScore: score, priority };
    });

    const gapsByPriority = {
      high: sanitizedGaps.filter((g) => g.priority === "high").length,
      medium: sanitizedGaps.filter((g) => g.priority === "medium").length,
      low: sanitizedGaps.filter((g) => g.priority === "low").length,
    };

    const totalEstimatedValue = sanitizedGaps.reduce((s, g) => s + (g.estimatedTrafficValue ?? 0), 0);

    const topGaps = await Promise.all(
      [...sanitizedGaps]
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 50)
        .map(async (gap) => {
          const kw = await ctx.db.get(gap.keywordId);
          const comp = await ctx.db.get(gap.competitorId);
          return {
            keyword: kw?.phrase ?? "Unknown",
            competitor: comp?.competitorDomain ?? "Unknown",
            opportunityScore: gap.opportunityScore,
            searchVolume: gap.searchVolume,
            difficulty: gap.difficulty ?? null,
            competitorPosition: gap.competitorPosition,
            yourPosition: gap.yourPosition,
            priority: gap.priority,
            estimatedValue: gap.estimatedTrafficValue,
          };
        })
    );

    // ── On-Site ───────────────────────────────────────────────
    const latestAnalysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .order("desc")
      .first();

    const criticalIssues = await ctx.db
      .query("onSiteIssues")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const criticalOnly = criticalIssues
      .filter((i) => i.severity === "critical")
      .sort((a, b) => b.affectedPages - a.affectedPages)
      .slice(0, 10)
      .map((i) => ({ title: i.title, description: i.description, affectedPages: i.affectedPages, category: i.category }));

    const coreWebVitals = await ctx.db
      .query("coreWebVitals")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .order("desc")
      .take(2); // mobile + desktop latest

    // ── Link Building ─────────────────────────────────────────
    const prospects = await ctx.db
      .query("linkBuildingProspects")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const activeProspects = prospects.filter((p) => p.status !== "dismissed");
    const topProspects = activeProspects
      .sort((a, b) => b.prospectScore - a.prospectScore)
      .slice(0, 30)
      .map((p) => ({
        referringDomain: p.referringDomain,
        domainRank: p.domainRank,
        linksToCompetitors: p.linksToCompetitors,
        competitors: p.competitors,
        prospectScore: p.prospectScore,
        acquisitionDifficulty: p.acquisitionDifficulty,
        suggestedChannel: p.suggestedChannel,
        estimatedImpact: p.estimatedImpact,
      }));

    const prospectsByChannel: Record<string, number> = {};
    for (const p of activeProspects) {
      prospectsByChannel[p.suggestedChannel] = (prospectsByChannel[p.suggestedChannel] || 0) + 1;
    }

    // ── Health Score ──────────────────────────────────────────
    let keywordScore = 0;
    if (positionCount > 0) {
      keywordScore = Math.min(30, Math.round(30 * Math.max(0, 1 - avgPosition / 100)));
      if (gainers > losers) keywordScore = Math.min(30, keywordScore + 3);
      if (losers > gainers * 2) keywordScore = Math.max(0, keywordScore - 5);
    }

    let backlinkScore = 0;
    if (backlinkSummary) {
      backlinkScore += Math.min(15, Math.round((backlinkSummary.totalDomains ?? 0) / 10));
      const ratio = (backlinkSummary.totalBacklinks ?? 0) > 0 ? (backlinkSummary.totalDomains ?? 0) / (backlinkSummary.totalBacklinks ?? 0) : 0;
      backlinkScore += ratio > 0.3 ? 10 : ratio > 0.1 ? 5 : 2;
      backlinkScore = Math.min(30, backlinkScore);
    }

    let onsiteScore = 10;
    if (latestAnalysis?.healthScore != null) {
      onsiteScore = Math.round((latestAnalysis.healthScore / 100) * 20);
    }

    const totalGapsNotDismissed = sanitizedGaps.filter((g) => g.status !== "dismissed").length;
    let contentScore = 20;
    if (totalGapsNotDismissed > 100) contentScore = 5;
    else if (totalGapsNotDismissed > 50) contentScore = 10;
    else if (totalGapsNotDismissed > 20) contentScore = 15;

    const healthScore = {
      total: keywordScore + backlinkScore + onsiteScore + contentScore,
      breakdown: {
        keywords: { score: keywordScore, max: 30 },
        backlinks: { score: backlinkScore, max: 30 },
        onsite: { score: onsiteScore, max: 20 },
        content: { score: contentScore, max: 20 },
      },
    };

    // ── Recommendations ───────────────────────────────────────
    const recommendations: Array<{ priority: string; category: string; title: string; description: string }> = [];

    if (losers > 5) {
      recommendations.push({ priority: "high", category: "keywords", title: "Significant ranking drops detected", description: `${losers} keywords lost positions in the last 7 days.` });
    }
    if (nearPage1.length > 0) {
      recommendations.push({ priority: "medium", category: "keywords", title: "Keywords near page 1", description: `${nearPage1.length} keywords rank on page 2 (positions 11-20).` });
    }
    if (toxicLinks.length > 10) {
      recommendations.push({ priority: "high", category: "backlinks", title: "Toxic backlinks detected", description: `${toxicLinks.length} backlinks have high spam scores.` });
    }
    if (activeProspects.length > 0) {
      recommendations.push({ priority: "medium", category: "backlinks", title: "Link building opportunities", description: `${activeProspects.length} link prospects identified.` });
    }
    if (latestAnalysis && latestAnalysis.healthScore != null && latestAnalysis.healthScore < 70) {
      recommendations.push({ priority: "high", category: "onsite", title: "Low on-page score", description: `On-page score is ${latestAnalysis.healthScore}/100.` });
    }
    if (!latestAnalysis) {
      recommendations.push({ priority: "medium", category: "onsite", title: "No on-site scan performed", description: "Run an on-site scan to identify technical SEO issues." });
    }
    const highPriorityGaps = sanitizedGaps.filter((g) => g.priority === "high" && g.status === "identified").length;
    if (highPriorityGaps > 0) {
      recommendations.push({ priority: highPriorityGaps > 10 ? "high" : "medium", category: "content", title: "Content gaps found", description: `${highPriorityGaps} high-priority content gaps identified.` });
    }

    recommendations.sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    });

    // ── Assemble ──────────────────────────────────────────────
    return {
      generatedAt: Date.now(),
      domainName: domain?.domain ?? "",
      healthScore,
      keywords: {
        total: activeKeywords.length,
        avgPosition,
        positionDistribution,
        movement: { gainers, losers, stable },
        topGainers: topPerformersGainers.slice(0, 10),
        topLosers: topPerformersLosers.slice(0, 10),
        atRisk: atRisk.slice(0, 10),
        nearPage1: nearPage1.slice(0, 10),
        discoveredTotal: discoveredKeywords.length,
      },
      backlinks: {
        summary: backlinkSummary ? {
          totalBacklinks: backlinkSummary.totalBacklinks,
          totalDomains: backlinkSummary.totalDomains,
          dofollow: backlinkSummary.dofollow,
          nofollow: backlinkSummary.nofollow,
          newBacklinks: backlinkSummary.newBacklinks,
          lostBacklinks: backlinkSummary.lostBacklinks,
        } : null,
        anchorDistribution: anchorCategories,
        toxicLinks,
        totalToxic: allBacklinks.filter((bl) => (bl.backlink_spam_score ?? 0) >= 70).length,
      },
      competitors: {
        list: competitorList,
        total: competitors.length,
        active: competitors.filter((c) => c.status === "active").length,
      },
      contentGaps: {
        total: sanitizedGaps.length,
        byPriority: gapsByPriority,
        totalEstimatedValue,
        topGaps: topGaps.slice(0, 30),
      },
      onSite: latestAnalysis ? {
        healthScore: latestAnalysis.healthScore,
        totalPages: latestAnalysis.totalPages,
        criticalIssues: latestAnalysis.criticalIssues,
        warnings: latestAnalysis.warnings,
        recommendations: latestAnalysis.recommendations,
        issues: latestAnalysis.issues,
        criticalIssuesList: criticalOnly,
      } : null,
      coreWebVitals: coreWebVitals.map((cwv) => ({
        device: cwv.device,
        lcp: cwv.lcp,
        fid: cwv.fid,
        cls: cwv.cls,
        performanceScore: cwv.performanceScore,
      })),
      linkBuilding: {
        totalProspects: prospects.length,
        activeProspects: activeProspects.length,
        topProspects,
        byChannel: prospectsByChannel,
      },
      recommendations,
    };
  },
});

// ─── Staleness Check Queries ────────────────────────────────────

export const checkDataStaleness = internalQuery({
  args: { domainId: v.id("domains"), thresholdMs: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threshold = now - args.thresholdMs;

    // Check competitor backlinks staleness
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) => q.eq("domainId", args.domainId).eq("status", "active"))
      .collect();

    const staleCompetitors: Id<"competitors">[] = [];
    for (const comp of competitors) {
      const summary = await ctx.db
        .query("competitorBacklinksSummary")
        .withIndex("by_competitor", (q) => q.eq("competitorId", comp._id))
        .first();
      if (!summary || summary.fetchedAt < threshold) {
        staleCompetitors.push(comp._id);
      }
    }

    // Check content gaps staleness
    const latestGapReport = await ctx.db
      .query("gapAnalysisReports")
      .withIndex("by_domain_date", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
    const contentGapsStale = !latestGapReport || latestGapReport.generatedAt < threshold;

    // Check link building prospects staleness
    const latestProspect = await ctx.db
      .query("linkBuildingProspects")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
    const linkBuildingStale = !latestProspect || latestProspect.generatedAt < threshold;

    // Check on-site data
    const latestAnalysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
    const onsiteAvailable = !!latestAnalysis;

    return {
      staleCompetitors,
      contentGapsStale,
      linkBuildingStale,
      onsiteAvailable,
    };
  },
});

// ─── Process Report (Orchestrator) ──────────────────────────────

export const processReport = internalAction({
  args: {
    reportId: v.id("domainReports"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const { reportId, domainId } = args;
    const FRESHNESS_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

    // Helper: check if report was cancelled
    const isCancelled = async () => {
      const report = await ctx.runQuery(internal.domainReports.getReportInternal, { reportId });
      return !report || report.status === "failed";
    };

    try {
      // ── Phase A: Analyses (0-60%) ───────────────────────────

      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId,
        progress: 0,
        status: "analyzing",
        currentStep: "Checking data freshness...",
      });

      const staleness = await ctx.runQuery(internal.domainReports.checkDataStaleness, {
        domainId,
        thresholdMs: FRESHNESS_THRESHOLD,
      });

      // Step 1: Competitor backlinks (0-15%)
      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId,
        progress: 2,
        currentStep: "Fetching competitor backlinks...",
        stepIndex: 0,
        stepStatus: "running",
      });

      if (staleness.staleCompetitors.length > 0) {
        for (const competitorId of staleness.staleCompetitors.slice(0, 3)) {
          try {
            await ctx.runAction(api.backlinks.fetchCompetitorBacklinksFromAPI, { competitorId });
          } catch (e) {
            console.warn(`[REPORT] Failed to fetch backlinks for competitor ${competitorId}:`, e);
          }
        }
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 15, stepIndex: 0, stepStatus: "completed",
        });
      } else {
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 15, stepIndex: 0, stepStatus: "skipped",
        });
      }

      // Check cancellation before Step 2
      if (await isCancelled()) return;

      // Step 2: Content gaps (15-35%)
      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId, progress: 16, currentStep: "Analyzing content gaps...", stepIndex: 1, stepStatus: "running",
      });

      if (staleness.contentGapsStale) {
        try {
          await ctx.runAction(api.contentGaps_actions.analyzeContentGaps, { domainId });
        } catch (e) {
          console.warn("[REPORT] Failed to analyze content gaps:", e);
        }
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 35, stepIndex: 1, stepStatus: "completed",
        });
      } else {
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 35, stepIndex: 1, stepStatus: "skipped",
        });
      }

      // Check cancellation before Step 3
      if (await isCancelled()) return;

      // Step 3: Link building prospects (35-50%)
      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId, progress: 36, currentStep: "Generating link building prospects...", stepIndex: 2, stepStatus: "running",
      });

      if (staleness.linkBuildingStale) {
        try {
          await ctx.runMutation(internal.domainReports.generateProspectsInternal, { domainId });
        } catch (e) {
          console.warn("[REPORT] Failed to generate prospects:", e);
        }
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 50, stepIndex: 2, stepStatus: "completed",
        });
      } else {
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 50, stepIndex: 2, stepStatus: "skipped",
        });
      }

      // Step 4: On-site data (50-60%)
      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId, progress: 51, currentStep: "Checking on-site data...", stepIndex: 3, stepStatus: "running",
      });

      // We don't trigger a new crawl, just check if data exists
      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId,
        progress: 60,
        stepIndex: 3,
        stepStatus: staleness.onsiteAvailable ? "skipped" : "skipped",
      });

      // Check cancellation before Phase B
      if (await isCancelled()) return;

      // ── Phase B: Data Collection (60-90%) ───────────────────

      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId, progress: 60, status: "collecting", currentStep: "Collecting report data...",
      });

      // Mark steps 4-9 as running then completed as we collect
      for (let i = 4; i <= 9; i++) {
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId,
          progress: 60 + (i - 4) * 5,
          stepIndex: i,
          stepStatus: "running",
          currentStep: REPORT_STEPS[i].name,
        });
      }

      // Single comprehensive data collection
      const reportData = await ctx.runQuery(internal.domainReports.collectReportDataInternal, { domainId });

      // Mark all collection steps as completed
      for (let i = 4; i <= 9; i++) {
        await ctx.runMutation(internal.domainReports.updateReportProgress, {
          reportId, progress: 60 + (i - 3) * 5, stepIndex: i, stepStatus: "completed",
        });
      }

      // Check cancellation before Phase C
      if (await isCancelled()) return;

      // ── Phase C: Store (90-100%) ────────────────────────────

      await ctx.runMutation(internal.domainReports.updateReportProgress, {
        reportId, progress: 95, currentStep: "Finalizing report...",
      });

      await ctx.runMutation(internal.domainReports.storeReportData, {
        reportId,
        reportData,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[REPORT] processReport failed:", errorMessage);
      await ctx.runMutation(internal.domainReports.failReport, {
        reportId,
        error: errorMessage,
      });
    }
  },
});

// ─── Internal: Generate Prospects (copy of linkBuilding_mutations logic) ──

export const generateProspectsInternal = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const ourBacklinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const ourDomains = new Set(ourBacklinks.map((bl) => bl.domainFrom).filter(Boolean));

    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain_status", (q) => q.eq("domainId", args.domainId).eq("status", "active"))
      .collect();

    if (competitors.length === 0) return;

    const gapMap: Record<string, { domain: string; competitors: string[]; totalLinks: number; totalDomainRank: number; dofollow: number; anchors: Set<string> }> = {};

    for (const comp of competitors) {
      const compBacklinks = await ctx.db
        .query("competitorBacklinks")
        .withIndex("by_competitor", (q) => q.eq("competitorId", comp._id))
        .collect();

      for (const bl of compBacklinks) {
        const domain = bl.domainFrom;
        if (!domain || ourDomains.has(domain)) continue;

        if (!gapMap[domain]) {
          gapMap[domain] = { domain, competitors: [], totalLinks: 0, totalDomainRank: 0, dofollow: 0, anchors: new Set() };
        }
        const g = gapMap[domain];
        if (!g.competitors.includes(comp.competitorDomain)) g.competitors.push(comp.competitorDomain);
        g.totalLinks++;
        g.totalDomainRank += bl.domainFromRank ?? 0;
        if (bl.dofollow === true) g.dofollow++;
        if (bl.anchor) g.anchors.add(bl.anchor);
      }
    }

    // Delete existing
    const existing = await ctx.db
      .query("linkBuildingProspects")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    for (const p of existing) {
      await ctx.db.delete(p._id);
    }

    const now = Date.now();
    const gaps = Object.values(gapMap).sort((a, b) => {
      const scoreA = a.competitors.length * 25 + Math.min((a.totalDomainRank / Math.max(a.totalLinks, 1)) / 10, 50);
      const scoreB = b.competitors.length * 25 + Math.min((b.totalDomainRank / Math.max(b.totalLinks, 1)) / 10, 50);
      return scoreB - scoreA;
    });

    for (const gap of gaps.slice(0, 200)) {
      const avgDomainRank = gap.totalLinks > 0 ? Math.round(gap.totalDomainRank / gap.totalLinks) : 0;
      const dofollowRate = gap.totalLinks > 0 ? gap.dofollow / gap.totalLinks : 0;

      const competitorScore = Math.min(gap.competitors.length * 20, 50);
      const rankScore = Math.min(avgDomainRank / 20, 30);
      const dofollowScore = dofollowRate * 20;
      const prospectScore = Math.round(Math.min(100, competitorScore + rankScore + dofollowScore));

      const acquisitionDifficulty: "easy" | "medium" | "hard" = avgDomainRank > 500 ? "hard" : avgDomainRank > 200 ? "medium" : "easy";

      let suggestedChannel: "broken_link" | "guest_post" | "resource_page" | "outreach" | "content_mention";
      if (gap.totalLinks > 5) suggestedChannel = "guest_post";
      else if (dofollowRate > 0.8) suggestedChannel = "resource_page";
      else if (gap.competitors.length >= 3) suggestedChannel = "outreach";
      else if (gap.anchors.size > 3) suggestedChannel = "content_mention";
      else suggestedChannel = "broken_link";

      const estimatedImpact = Math.round(Math.min(100, rankScore * 2 + dofollowScore * 1.5 + competitorScore * 0.3));

      await ctx.db.insert("linkBuildingProspects", {
        domainId: args.domainId,
        referringDomain: gap.domain,
        domainRank: avgDomainRank,
        linksToCompetitors: gap.totalLinks,
        competitors: gap.competitors,
        prospectScore,
        acquisitionDifficulty,
        suggestedChannel,
        estimatedImpact,
        status: "identified",
        generatedAt: now,
      });
    }
  },
});
