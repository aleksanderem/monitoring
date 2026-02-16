"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";

// ─── Types ───

interface StrategyDataSummary {
  domain: string;
  location: string;
  language: string;
  keywords: {
    activeCount: number;
    pausedCount: number;
    avgPosition: number | null;
    gainers7d: number;
    losers7d: number;
    positionDistribution: Record<string, number>;
    topPerformers: Array<{ phrase: string; position: number; searchVolume?: number; cpc?: number }>;
    atRisk: Array<{ phrase: string; currentPosition: number; previousPosition: number; drop: number }>;
    quickWins: Array<{ phrase: string; position: number; difficulty: number; searchVolume: number }>;
  };
  discoveredKeywords: {
    totalCount: number;
    rankedCount: number;
    avgPosition: number | null;
    top3: number;
    top10: number;
  };
  contentGaps: {
    totalCount: number;
    identifiedCount: number;
    highPriorityCount: number;
    topOpportunities: Array<{
      keyword: string;
      opportunityScore: number;
      searchVolume: number;
      difficulty: number;
      estimatedTrafficValue: number;
    }>;
    topicClusters: Array<{
      topic: string;
      gapCount: number;
      totalSearchVolume: number;
      totalEstimatedValue: number;
      avgDifficulty: number;
      avgOpportunityScore: number;
      topKeywords: string[];
      keywords: Array<{
        phrase: string;
        searchVolume: number;
        opportunityScore: number;
        difficulty: number;
        estimatedTrafficValue: number;
        competitorPosition: number | null;
        priority: string;
        status: string;
      }>;
    }>;
  };
  competitors: Array<{
    domain: string;
    keywordsCovered: number;
    totalKeywords: number;
    coveragePct: number;
  }>;
  backlinks: {
    totalCount: number;
    storedCount: number;
    dofollowRatio: number;
    toxicCount: number;
    toxicPct: number;
    anchorDistribution: Record<string, number>;
    referringDomains: number;
  };
  onSite: {
    healthScore: number | null;
    grade: string | null;
    totalPages: number;
    criticalIssues: number;
    warnings: number;
    recommendations: number;
    avgLoadTime: number | null;
    avgWordCount: number | null;
    avgPerformance: number | null;
    issues: Record<string, number>;
    sections: Record<string, any> | null;
    topIssues: Array<{ priority: string; section: string; issue: string; action: string }>;
    pageScoring: {
      avgScore: number | null;
      distribution: Record<string, number> | null;
      axes: Record<string, number> | null;
    };
    crawledPages: Array<{
      url: string;
      title: string | null;
      metaDescription: string | null;
      h1: string | null;
      h2s: string[];
      statusCode: number;
      wordCount: number;
      issueCount: number;
      criticalCount: number;
      warningCount: number;
      onpageScore: number | null;
      loadTime: number | null;
      duplicateTitle: boolean;
      duplicateDescription: boolean;
    }>;
  };
  visibility: {
    currentETV: number | null;
    isUp: number;
    isDown: number;
  };
  linkBuilding: {
    totalProspects: number;
    activeProspects: number;
    identifiedProspects: number;
    prospects: Array<{
      referringDomain: string;
      domainRank: number;
      linksToCompetitors: number;
      competitors: string[];
      prospectScore: number;
      acquisitionDifficulty: string;
      suggestedChannel: string;
      estimatedImpact: number;
      status: string;
      reasoning: string | null;
    }>;
  };
  jobs: {
    pending: number;
    processing: number;
    failed: number;
    stuckCount: number;
  };
  keywordMap: {
    competitorOverlap: Array<{
      keyword: string;
      yourPosition: number | null;
      competitors: Array<{ domain: string; position: number | null }>;
    }>;
    cannibalization: Array<{
      url: string;
      keywordCount: number;
      keywords: Array<{ keyword: string; position: number }>;
      avgPosition: number;
    }>;
    quickWinsEnriched: Array<{
      keyword: string; position: number; searchVolume: number;
      difficulty: number; cpc: number | null; etv: number | null;
      intent: string | null; serpFeatures: string[];
      referringDomains: number | null; mainDomainRank: number | null;
      url: string | null;
    }>;
    serpFeatures: Array<{
      feature: string;
      count: number;
      avgPosition: number;
      exampleKeywords: string[];
      keywordsWithData: Array<{ keyword: string; position: number; searchVolume: number; difficulty: number }>;
    }>;
    clusterQuickWins: Array<{
      topic: string;
      gapCount: number;
      totalSearchVolume: number;
      totalEstimatedValue: number;
      avgDifficulty: number;
      topKeywords: string[];
      keywords: Array<{
        phrase: string;
        searchVolume: number;
        difficulty: number;
        estimatedTrafficValue: number;
        competitorPosition: number | null;
      }>;
    }>;
  };
  backlinkVelocity: {
    avgNewPerDay: number; avgLostPerDay: number; netChange: number;
    trend: Array<{ date: string; newCount: number; lostCount: number }>;
  };
  backlinkDistributions: {
    tldDistribution: Array<{ tld: string; count: number }>;
    countries: Array<{ country: string; count: number }>;
    linkAttributes: Record<string, number>;
    platformTypes: Record<string, number>;
  };
  visibilityTrend: Array<{ date: string; etv: number | null; keywordsUp: number; keywordsDown: number }>;
  insights: {
    healthScore: number | null;
    healthBreakdown: Record<string, number> | null;
    atRiskKeywords: Array<{ phrase: string; position: number; drop: number }>;
    risingKeywords: Array<{ phrase: string; position: number; gain: number }>;
    nearPage1: Array<{ phrase: string; position: number; searchVolume: number }>;
    recommendations: Array<{ category: string; priority: string; title: string; description: string }>;
  };
}

// ─── Data Collection ───

async function collectDomainData(
  ctx: any,
  domainId: string,
): Promise<StrategyDataSummary | null> {
  // Get domain
  const domain = await ctx.runQuery(internal.domains.getDomainInternal, { domainId });
  if (!domain) return null;

  const now = Date.now();
  const sevenDaysAgoStr = new Date(now - 7 * 24 * 3600_000).toISOString().split("T")[0];

  // ── Parallel data fetch ──
  const [
    allKeywords,
    discovered,
    gaps,
    competitors,
    backlinks,
    backlinkSummary,
    visHistory,
    onSiteAnalysis,
    prospects,
    checkJobs,
    serpJobs,
    competitorOverlap,
    cannibalization,
    quickWinsEnriched,
    serpFeatures,
    backlinkVelocity,
    backlinkDistributions,
    visibilityTrend,
    insightsData,
    topicClusters,
  ] = await Promise.all([
    ctx.runQuery(internal.domains.getMonitoredKeywordsInternal, { domainId }),
    ctx.runQuery(internal.domains.getDiscoveredKeywordsInternal, { domainId, limit: 500 }),
    ctx.runQuery(internal.aiStrategy.getContentGapsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getCompetitorsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getBacklinksInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getBacklinkSummaryInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getVisibilityHistoryInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getOnSiteAnalysisInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getLinkBuildingProspectsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getCheckJobsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getSerpJobsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getCompetitorOverlapInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getCannibalizationInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getQuickWinsEnrichedInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getSerpFeaturesInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getBacklinkVelocityInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getBacklinkDistributionsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getVisibilityTrendInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getInsightsInternal, { domainId }),
    ctx.runQuery(internal.aiStrategy.getTopicClustersInternal, { domainId }),
  ]);

  // ── Process keywords ──
  const activeKws = allKeywords.filter((k: any) => k.status === "active");
  const pausedKws = allKeywords.filter((k: any) => k.status === "paused");

  let totalPos = 0;
  let posCount = 0;
  let gainers = 0;
  let losers = 0;
  const buckets: Record<string, number> = { "1-3": 0, "4-10": 0, "11-20": 0, "21-50": 0, "51-100": 0, "100+": 0 };

  const topPerformers: StrategyDataSummary["keywords"]["topPerformers"] = [];
  const atRisk: StrategyDataSummary["keywords"]["atRisk"] = [];
  const quickWinCandidates: StrategyDataSummary["keywords"]["quickWins"] = [];

  for (const kw of activeKws) {
    const cp = kw.currentPosition;
    if (cp != null && typeof cp === "number") {
      totalPos += cp;
      posCount++;
      if (cp >= 1 && cp <= 3) buckets["1-3"]++;
      else if (cp <= 10) buckets["4-10"]++;
      else if (cp <= 20) buckets["11-20"]++;
      else if (cp <= 50) buckets["21-50"]++;
      else if (cp <= 100) buckets["51-100"]++;
      else buckets["100+"]++;

      if (cp <= 10) {
        topPerformers.push({
          phrase: kw.phrase,
          position: cp,
          searchVolume: kw.searchVolume,
          cpc: kw.latestCpc,
        });
      }
    }

    // Movement
    const change = kw.positionChange;
    if (typeof change === "number" && !isNaN(change)) {
      if (change > 3) {
        atRisk.push({
          phrase: kw.phrase,
          currentPosition: kw.currentPosition ?? 0,
          previousPosition: kw.previousPosition ?? 0,
          drop: change,
        });
      }
      // 7-day movement from recentPositions
      const recent = kw.recentPositions ?? [];
      if (recent.length >= 2) {
        const weekEntries = recent.filter((p: any) => p.date >= sevenDaysAgoStr);
        if (weekEntries.length >= 2) {
          const oldPos = weekEntries[0].position;
          const newPos = weekEntries[weekEntries.length - 1].position;
          if (oldPos != null && newPos != null) {
            if (newPos < oldPos) gainers++;
            else if (newPos > oldPos) losers++;
          }
        }
      }
    }
  }

  // Sort and trim
  topPerformers.sort((a, b) => a.position - b.position);
  atRisk.sort((a, b) => b.drop - a.drop);

  // Quick wins from discovered keywords
  for (const dk of discovered) {
    if (dk.bestPosition >= 4 && dk.bestPosition <= 30 &&
        typeof dk.difficulty === "number" && !isNaN(dk.difficulty) && dk.difficulty < 50 &&
        typeof dk.searchVolume === "number" && dk.searchVolume > 0) {
      quickWinCandidates.push({
        phrase: dk.keyword,
        position: dk.bestPosition,
        difficulty: dk.difficulty,
        searchVolume: dk.searchVolume,
      });
    }
  }
  quickWinCandidates.sort((a, b) => b.searchVolume - a.searchVolume);

  // ── Process discovered keywords ──
  const rankedDiscovered = discovered.filter((d: any) => d.bestPosition !== 999);
  let visTop3 = 0, visTop10 = 0, visTotalPos = 0, visPosCount = 0;
  for (const dk of rankedDiscovered) {
    if (dk.bestPosition > 0 && dk.bestPosition <= 100) {
      visTotalPos += dk.bestPosition;
      visPosCount++;
      if (dk.bestPosition <= 3) visTop3++;
      if (dk.bestPosition <= 10) visTop10++;
    }
  }

  // ── Process content gaps (gaps is { items, totalCount, identifiedCount } from optimized query) ──
  const gapsTotalCount = (gaps as any).totalCount ?? 0;
  const gapsIdentifiedCount = (gaps as any).identifiedCount ?? 0;
  const gapItems = (gaps as any).items ?? gaps;
  const activeGaps = gapItems.filter((g: any) => g.status !== "dismissed");
  const highPriorityGaps = activeGaps.filter(
    (g: any) => typeof g.opportunityScore === "number" && !isNaN(g.opportunityScore) && g.opportunityScore >= 70
  );
  const topOpportunities = activeGaps
    .filter((g: any) => typeof g.opportunityScore === "number" && !isNaN(g.opportunityScore))
    .sort((a: any, b: any) => b.opportunityScore - a.opportunityScore)
    .slice(0, 20)
    .map((g: any) => ({
      keyword: g.keywordPhrase ?? "unknown keyword",
      opportunityScore: g.opportunityScore,
      searchVolume: g.searchVolume ?? 0,
      difficulty: g.difficulty ?? 0,
      estimatedTrafficValue: g.estimatedTrafficValue ?? 0,
    }));

  // ── Process competitors (parallel instead of sequential) ──
  const activeCompetitors = competitors.filter((c: any) => c.status !== "paused");
  const competitorResults = await Promise.all(
    activeCompetitors.map((comp: any) =>
      ctx.runQuery(internal.aiStrategy.getCompetitorPositionsInternal, {
        competitorId: comp._id,
      })
    )
  );
  const competitorSummaries: StrategyDataSummary["competitors"] = activeCompetitors.map(
    (comp: any, i: number) => ({
      domain: comp.competitorDomain,
      keywordsCovered: competitorResults[i].coveredKeywords,
      totalKeywords: activeKws.length,
      coveragePct: activeKws.length > 0
        ? Math.round((competitorResults[i].coveredKeywords / activeKws.length) * 100)
        : 0,
    })
  );

  // ── Process backlinks ──
  let toxicCount = 0;
  let dofollowCount = 0;
  const anchorDist: Record<string, number> = {};
  for (const bl of backlinks) {
    if (bl.backlink_spam_score != null && bl.backlink_spam_score >= 70) toxicCount++;
    if (bl.dofollow === true) dofollowCount++;
    const aType = bl.itemType ?? "unknown";
    anchorDist[aType] = (anchorDist[aType] ?? 0) + 1;
  }

  // ── Process link building ──
  let identifiedProspects = 0;
  let activeProspectCount = 0;
  for (const p of prospects) {
    if (p.status !== "dismissed") activeProspectCount++;
    if (p.status === "identified") identifiedProspects++;
  }

  // ── Process jobs ──
  const allJobs = [...checkJobs, ...serpJobs];
  const stuckJobs = allJobs.filter(
    (j: any) => j.status === "processing" && j.startedAt && (now - j.startedAt) > 30 * 60_000
  );

  return {
    domain: domain.domain,
    location: domain.settings.location,
    language: domain.settings.language,
    keywords: {
      activeCount: activeKws.length,
      pausedCount: pausedKws.length,
      avgPosition: posCount > 0 ? Math.round((totalPos / posCount) * 10) / 10 : null,
      gainers7d: gainers,
      losers7d: losers,
      positionDistribution: buckets,
      topPerformers: topPerformers.slice(0, 20),
      atRisk: atRisk.slice(0, 20),
      quickWins: quickWinCandidates.slice(0, 20),
    },
    discoveredKeywords: {
      totalCount: discovered.length,
      rankedCount: rankedDiscovered.length,
      avgPosition: visPosCount > 0 ? Math.round((visTotalPos / visPosCount) * 10) / 10 : null,
      top3: visTop3,
      top10: visTop10,
    },
    contentGaps: {
      totalCount: gapsTotalCount,
      identifiedCount: gapsIdentifiedCount,
      highPriorityCount: highPriorityGaps.length,
      topOpportunities,
      topicClusters: (topicClusters as any[]).slice(0, 15).map((c: any) => ({
        topic: c.topic,
        gapCount: c.gapCount,
        totalSearchVolume: c.totalSearchVolume,
        totalEstimatedValue: c.totalEstimatedValue,
        avgDifficulty: c.avgDifficulty,
        avgOpportunityScore: c.avgOpportunityScore,
        topKeywords: c.topKeywords,
        keywords: c.keywords.slice(0, 50),
      })),
    },
    competitors: competitorSummaries,
    backlinks: {
      totalCount: backlinkSummary?.totalBacklinks ?? backlinks.length,
      storedCount: backlinks.length,
      dofollowRatio: backlinks.length > 0 ? Math.round((dofollowCount / backlinks.length) * 100) : 0,
      toxicCount,
      toxicPct: backlinks.length > 0 ? Math.round((toxicCount / backlinks.length) * 100) : 0,
      anchorDistribution: anchorDist,
      referringDomains: backlinkSummary?.totalDomains ?? 0,
    },
    onSite: {
      healthScore: onSiteAnalysis?.healthScore ?? null,
      grade: onSiteAnalysis?.grade ?? null,
      totalPages: onSiteAnalysis?.totalPages ?? 0,
      criticalIssues: onSiteAnalysis?.criticalIssues ?? 0,
      warnings: onSiteAnalysis?.warnings ?? 0,
      recommendations: onSiteAnalysis?.recommendations ?? 0,
      avgLoadTime: onSiteAnalysis?.avgLoadTime ?? null,
      avgWordCount: onSiteAnalysis?.avgWordCount ?? null,
      avgPerformance: onSiteAnalysis?.avgPerformance ?? null,
      issues: onSiteAnalysis?.issues ? Object.fromEntries(
        Object.entries(onSiteAnalysis.issues).filter(([, val]) => typeof val === "number" && val > 0)
      ) as Record<string, number> : {},
      sections: onSiteAnalysis?.sections ?? null,
      topIssues: Array.isArray(onSiteAnalysis?.allIssues)
        ? (onSiteAnalysis.allIssues as any[])
            .filter((i: any) => i.priority === "critical" || i.priority === "high")
            .slice(0, 25)
            .map((i: any) => ({
              priority: i.priority,
              section: i.section,
              issue: i.issue,
              action: i.action,
            }))
        : [],
      pageScoring: {
        avgScore: onSiteAnalysis?.avgPageScore ?? null,
        distribution: onSiteAnalysis?.pageScoreDistribution ?? null,
        axes: onSiteAnalysis?.pageScoreAxes ?? null,
      },
      crawledPages: [], // drill-down uses session snapshot, not per-page data
    },
    visibility: {
      currentETV: visHistory?.metrics?.etv ?? null,
      isUp: visHistory?.metrics?.is_up ?? 0,
      isDown: visHistory?.metrics?.is_down ?? 0,
    },
    linkBuilding: {
      totalProspects: prospects.length,
      activeProspects: activeProspectCount,
      identifiedProspects,
      prospects: prospects
        .filter((p: any) => p.status !== "dismissed")
        .sort((a: any, b: any) => b.prospectScore - a.prospectScore)
        .slice(0, 25)
        .map((p: any) => ({
          referringDomain: p.referringDomain,
          domainRank: p.domainRank,
          linksToCompetitors: p.linksToCompetitors,
          competitors: p.competitors,
          prospectScore: p.prospectScore,
          acquisitionDifficulty: p.acquisitionDifficulty,
          suggestedChannel: p.suggestedChannel,
          estimatedImpact: p.estimatedImpact,
          status: p.status,
          reasoning: p.reasoning ?? null,
        })),
    },
    jobs: {
      pending: allJobs.filter((j: any) => j.status === "pending").length,
      processing: allJobs.filter((j: any) => j.status === "processing").length,
      failed: allJobs.filter((j: any) => j.status === "failed").length,
      stuckCount: stuckJobs.length,
    },
    keywordMap: {
      competitorOverlap: competitorOverlap.matrix.slice(0, 30),
      cannibalization: cannibalization.slice(0, 15),
      quickWinsEnriched: quickWinsEnriched.slice(0, 20),
      serpFeatures: serpFeatures.slice(0, 10),
      clusterQuickWins: (topicClusters as any[])
        .filter((c: any) => c.avgDifficulty < 50 && c.totalSearchVolume > 0)
        .sort((a: any, b: any) => b.totalSearchVolume - a.totalSearchVolume)
        .slice(0, 10)
        .map((c: any) => ({
          topic: c.topic,
          gapCount: c.gapCount,
          totalSearchVolume: c.totalSearchVolume,
          totalEstimatedValue: c.totalEstimatedValue,
          avgDifficulty: c.avgDifficulty,
          topKeywords: c.topKeywords,
          keywords: c.keywords.slice(0, 30).map((kw: any) => ({
            phrase: kw.phrase,
            searchVolume: kw.searchVolume,
            difficulty: kw.difficulty,
            estimatedTrafficValue: kw.estimatedTrafficValue,
            competitorPosition: kw.competitorPosition ?? null,
          })),
        })),
    },
    backlinkVelocity: {
      ...backlinkVelocity,
      trend: backlinkVelocity.trend.slice(0, 14),
    },
    backlinkDistributions: {
      tldDistribution: (Array.isArray(backlinkDistributions.tldDistribution)
        ? backlinkDistributions.tldDistribution.slice(0, 15)
        : Object.entries(backlinkDistributions.tldDistribution || {}).map(([tld, count]) => ({ tld, count: count as number })).sort((a: any, b: any) => b.count - a.count).slice(0, 15)) as Array<{ tld: string; count: number }>,
      countries: (Array.isArray(backlinkDistributions.countries)
        ? backlinkDistributions.countries.slice(0, 10)
        : Object.entries(backlinkDistributions.countries || {}).map(([country, count]) => ({ country, count: count as number })).sort((a: any, b: any) => b.count - a.count).slice(0, 10)) as Array<{ country: string; count: number }>,
      linkAttributes: backlinkDistributions.linkAttributes || {},
      platformTypes: backlinkDistributions.platformTypes || {},
    },
    visibilityTrend: visibilityTrend.slice(0, 12),
    insights: {
      healthScore: insightsData.healthScore,
      healthBreakdown: insightsData.healthBreakdown,
      atRiskKeywords: insightsData.atRiskKeywords.slice(0, 10),
      risingKeywords: insightsData.risingKeywords.slice(0, 10),
      nearPage1: insightsData.nearPage1.slice(0, 10),
      recommendations: insightsData.recommendations.slice(0, 15),
    },
  };
}

// ─── Prompt Builder ───

function buildStrategyPromptLegacy(
  data: StrategyDataSummary,
  businessDescription: string,
  targetCustomer: string,
  language: string,
): string {
  const langName = LANGUAGE_NAMES[language] || language;

  return `You are a senior SEO strategist. Analyze the comprehensive domain data below and generate a detailed, data-driven SEO strategy.

CRITICAL RULES:
1. Every recommendation MUST reference specific numbers from the data
2. Do NOT give generic SEO advice — only actionable items backed by provided metrics
3. NEVER fabricate, invent, or assume ANY data. Use ONLY the exact values from the data below:
   - Health scores: use the EXACT healthScore number. If it's 32/100, say 32/100
   - Issues: reference ONLY issues listed in the CRAWLED PAGES and TOP ISSUES sections. If a page HAS a title tag in the data, do NOT claim it's missing
   - Page details: the CRAWLED PAGES section shows real title tags, meta descriptions, H1s, word counts, and issues for each page. ONLY reference problems that actually exist in that data
   - If data shows a page has title="Agencja SEO...", do NOT say "missing title tags" for that page
4. Generate ALL text content in ${langName}
5. Return ONLY valid JSON matching the schema below, no markdown fences
6. ZERO REPETITION ACROSS SECTIONS — this is critical:
   - Each insight, recommendation, or data point must appear in EXACTLY ONE section
   - executiveSummary: high-level overview ONLY — do NOT list specific keywords, fixes, or action steps (those belong in their dedicated sections)
   - quickWins: keyword-level optimizations ONLY — do NOT mention technical issues or link building
   - contentStrategy: content creation plan ONLY — do NOT repeat keywords already in quickWins
   - competitorAnalysis: competitor-specific SWOT ONLY — do NOT repeat keyword or content recommendations
   - backlinkStrategy: link profile and link building ONLY — do NOT mention content or technical fixes
   - technicalSEO: site health and technical fixes ONLY — do NOT mention content gaps or keywords
   - riskAssessment: risks and mitigations ONLY — do NOT restate recommendations from other sections
   - keywordClustering: cluster groupings ONLY — do NOT repeat individual keyword recommendations from quickWins
   - roiForecast: projections and assumptions ONLY — do NOT restate action items
   - actionPlan: consolidated task list that REFERENCES other sections (e.g. "Implement quick win #1") but does NOT duplicate their content. Each action item should be a unique task, not a restatement of advice given elsewhere
   - If two sections would naturally cover the same topic, put the DETAIL in the more specific section and only REFERENCE it from the other

=== BUSINESS CONTEXT ===
Domain: ${data.domain}
Market: ${data.location}
Language: ${langName}
Business: ${businessDescription}
Target Customer: ${targetCustomer}

=== KEYWORD DATA (${data.keywords.activeCount} active, ${data.keywords.pausedCount} paused) ===
Average Position: ${data.keywords.avgPosition ?? "no data"}
Position Distribution: ${JSON.stringify(data.keywords.positionDistribution)}
7-Day Movement: ${data.keywords.gainers7d} improving, ${data.keywords.losers7d} declining
Top Performers (in top 10): ${JSON.stringify(data.keywords.topPerformers.slice(0, 15))}
At Risk (dropping): ${JSON.stringify(data.keywords.atRisk.slice(0, 15))}
Quick Win Candidates (pos 4-30, diff <50): ${JSON.stringify(data.keywords.quickWins.slice(0, 15))}

=== DISCOVERED KEYWORDS (${data.discoveredKeywords.totalCount} total, ${data.discoveredKeywords.rankedCount} ranked) ===
Top 3: ${data.discoveredKeywords.top3} | Top 10: ${data.discoveredKeywords.top10}
Average Position: ${data.discoveredKeywords.avgPosition ?? "no data"}

=== CONTENT GAPS (${data.contentGaps.totalCount} total, ${data.contentGaps.highPriorityCount} high priority) ===
Top Opportunities: ${JSON.stringify(data.contentGaps.topOpportunities.slice(0, 15))}

=== TOPIC CLUSTERS (${data.contentGaps.topicClusters.length} clusters — THE MOST IMPORTANT DATA SOURCE for content + quick win strategy) ===
CRITICAL RULES FOR TOPIC CLUSTERS:
1. A cluster with LOW avg difficulty (< 30) and HIGH total search volume IS A MASSIVE QUICK WIN. Treat it as the #1 priority in quickWins and actionableSteps.
2. Low-difficulty clusters = the domain can rank for dozens/hundreds of keywords by creating ONE pillar page + supporting articles. This is exponentially more valuable than individual keyword quick wins.
3. When building quickWins: prioritize ENTIRE low-difficulty clusters over individual keywords. A cluster of 128 keywords at difficulty 1 with 184K volume beats any single keyword.
4. When building contentStrategy: use cluster data to recommend pillar pages with exact keyword counts, volumes, and difficulty. BUT FIRST check the CONTENT INVENTORY below — if a page already covers this topic, recommend OPTIMIZING it, not creating new.
5. When building keywordClustering: use THESE exact clusters — do NOT invent your own. Map each cluster to a content piece.
6. When building actionableSteps: create specific content briefs for top clusters, listing the pillar keyword, supporting keywords, total addressable volume.
7. EXISTING CONTENT CHECK: Before recommending "create pillar page for [topic]", check the CONTENT INVENTORY section below for pages that already cover that topic (match by URL path, title, H1, H2 headings). If found, recommend OPTIMIZING the existing page instead.

${data.contentGaps.topicClusters.map((cluster, i) => {
  const kwLines = cluster.keywords.map((kw) =>
    "  " + kw.phrase + " | vol:" + kw.searchVolume + " | score:" + kw.opportunityScore + " | diff:" + kw.difficulty + " | etv:" + kw.estimatedTrafficValue + " | compPos:" + (kw.competitorPosition ?? "–") + " | priority:" + kw.priority + " | status:" + kw.status
  ).join("\n");
  return "--- Cluster " + (i + 1) + ': "' + cluster.topic + '" (' + cluster.gapCount + " keywords) ---\n" +
    "Total Search Volume: " + cluster.totalSearchVolume + " | Est. Traffic Value: " + cluster.totalEstimatedValue + " | Avg Difficulty: " + cluster.avgDifficulty + " | Avg Opportunity Score: " + cluster.avgOpportunityScore + "\n" +
    "Top Keywords: " + cluster.topKeywords.join(", ") + "\n" +
    "ALL Keywords in cluster:\n" + kwLines;
}).join("\n\n")}

=== COMPETITORS (${data.competitors.length}) ===
${data.competitors.map((c) => `${c.domain}: ${c.coveragePct}% keyword coverage (${c.keywordsCovered}/${c.totalKeywords})`).join("\n")}

=== BACKLINKS ===
Total: ${data.backlinks.totalCount} | Stored: ${data.backlinks.storedCount}
Dofollow Ratio: ${data.backlinks.dofollowRatio}% | Toxic: ${data.backlinks.toxicCount} (${data.backlinks.toxicPct}%)
Referring Domains: ${data.backlinks.referringDomains}
Anchor Distribution: ${JSON.stringify(data.backlinks.anchorDistribution)}

=== ON-SITE HEALTH (REAL SCAN DATA — use these exact numbers, do NOT invent scores) ===
Health Score: ${data.onSite.healthScore ?? "no scan"}/100${data.onSite.grade ? ` | Grade: ${data.onSite.grade}` : ""}
Pages Scanned: ${data.onSite.totalPages}
Critical Issues: ${data.onSite.criticalIssues} | Warnings: ${data.onSite.warnings} | Recommendations: ${data.onSite.recommendations}${data.onSite.avgLoadTime != null ? `\nAvg Load Time: ${data.onSite.avgLoadTime}ms` : ""}${data.onSite.avgPerformance != null ? ` | Avg Performance: ${data.onSite.avgPerformance}/100` : ""}${data.onSite.avgWordCount != null ? ` | Avg Word Count: ${data.onSite.avgWordCount}` : ""}
Issue Breakdown: ${JSON.stringify(data.onSite.issues)}${data.onSite.sections ? `\nSection Scores: ${JSON.stringify(data.onSite.sections)}` : ""}${data.onSite.topIssues.length > 0 ? `\nTop Issues (critical/high priority):\n${data.onSite.topIssues.map((i) => `- [${i.priority}] ${i.section}: ${i.issue} → ${i.action}`).join("\n")}` : ""}${data.onSite.pageScoring.avgScore != null ? `\nPage Scoring: avg ${data.onSite.pageScoring.avgScore}/100${data.onSite.pageScoring.distribution ? ` | Distribution: ${JSON.stringify(data.onSite.pageScoring.distribution)}` : ""}${data.onSite.pageScoring.axes ? ` | Axes: ${JSON.stringify(data.onSite.pageScoring.axes)}` : ""}` : ""}

=== CRAWLED PAGES (${data.onSite.crawledPages.length} pages — REAL DATA, do NOT invent issues not present here) ===
${data.onSite.crawledPages.map((p) => {
  const issues: string[] = [];
  if (!p.title) issues.push("MISSING TITLE");
  if (!p.metaDescription) issues.push("MISSING META DESC");
  if (!p.h1) issues.push("MISSING H1");
  if (p.duplicateTitle) issues.push("DUPLICATE TITLE");
  if (p.duplicateDescription) issues.push("DUPLICATE DESC");
  if (p.statusCode !== 200) issues.push(`STATUS ${p.statusCode}`);
  return `${p.url} | title="${p.title ?? "NONE"}" | score=${p.onpageScore ?? "?"} | words=${p.wordCount} | issues=${p.issueCount} (${p.criticalCount}crit,${p.warningCount}warn)${issues.length > 0 ? ` | PROBLEMS: ${issues.join(", ")}` : ""}`;
}).join("\n")}

=== CONTENT INVENTORY (EXISTING PAGES — CHECK BEFORE RECOMMENDING NEW CONTENT) ===
MANDATORY: Before recommending "create a pillar page" or "create new content" for ANY topic, CHECK this list.
- Match by URL path keywords, title, H1, and H2 headings
- If a matching page EXISTS: recommend OPTIMIZING it (add sections, improve word count, update meta), NOT creating new
- Only recommend NEW content when NO existing page covers the topic
${data.onSite.crawledPages.filter((p) => p.statusCode === 200 && p.wordCount > 0).map((p) => {
  const h2Preview = p.h2s.length > 0 ? ` | h2s: ${p.h2s.slice(0, 8).join(" / ")}${p.h2s.length > 8 ? ` (+${p.h2s.length - 8} more)` : ""}` : "";
  return `${p.url} | title="${p.title ?? "NONE"}" | h1="${p.h1 ?? "NONE"}" | ${p.wordCount} words | score=${p.onpageScore ?? "?"}${h2Preview}`;
}).join("\n")}

=== VISIBILITY ===
Estimated Traffic Value: ${data.visibility.currentETV ?? "no data"}
Movement: ${data.visibility.isUp} up, ${data.visibility.isDown} down

=== LINK BUILDING PROSPECTS (${data.linkBuilding.totalProspects} total, ${data.linkBuilding.activeProspects} active, ${data.linkBuilding.identifiedProspects} identified) ===
CRITICAL: Analyze each prospect below for:
1. EASE OF ACQUISITION — acquisitionDifficulty + suggestedChannel. "easy" + "broken_link" or "resource_page" = quick link. "hard" + "outreach" = long-term effort.
2. DR QUALITY — domainRank. DR 50+ = high authority. DR 20-50 = medium. DR < 20 = low value unless niche-relevant.
3. CONTENT OPPORTUNITY — suggestedChannel. "guest_post" and "content_mention" = can add valuable content. "broken_link" = replacement only.
4. POSITION IMPACT — estimatedImpact + prospectScore. Cross-reference with quick wins: prospects linking to competitors for keywords where we rank pos 4-20 = highest impact targets.
5. COMPETITOR INTELLIGENCE — linksToCompetitors + competitors list. Prospects linking to MULTIPLE competitors = industry standard site, MUST be acquired.

Use this data to create SPECIFIC, ACTIONABLE link building recommendations in backlinkStrategy. Reference actual prospect domains, not generic advice.
${data.linkBuilding.prospects.length > 0 ? data.linkBuilding.prospects.map((p, i) => {
  return "PROSPECT #" + (i + 1) + ": " + p.referringDomain + " | DR:" + p.domainRank + " | score:" + p.prospectScore + "/100 | impact:" + p.estimatedImpact + "/100 | difficulty:" + p.acquisitionDifficulty + " | channel:" + p.suggestedChannel + " | linksToCompetitors:" + p.linksToCompetitors + " | competitors:" + p.competitors.join(", ") + " | status:" + p.status + (p.reasoning ? " | reason: " + p.reasoning : "");
}).join("\n") : "No active prospects — recommend prospect discovery as priority action"}

=== JOBS ===
Pending: ${data.jobs.pending} | Processing: ${data.jobs.processing} | Failed: ${data.jobs.failed} | Stuck: ${data.jobs.stuckCount}

=== TAB: KEYWORD MAP — Competitive Landscape ===

--- Competitor Position Matrix (keyword × competitor SERP positions) ---
${data.keywordMap.competitorOverlap.length > 0 ? data.keywordMap.competitorOverlap.map((row) => `${row.keyword} | you: ${row.yourPosition ?? "–"} | ${row.competitors.map((c) => `${c.domain}: ${c.position ?? "–"}`).join(" | ")}`).join("\n") : "No competitor overlap data"}

--- Keyword Cannibalization (URLs ranking for multiple keywords — consolidation needed) ---
${data.keywordMap.cannibalization.length > 0 ? data.keywordMap.cannibalization.map((c) => `${c.url} | ${c.keywordCount} keywords | ${c.keywords.map((k) => `${k.keyword}@${k.position}`).join(", ")} | avg pos: ${c.avgPosition}`).join("\n") : "No cannibalization detected"}

--- Quick Win Opportunities (enriched with full metrics) ---
${data.keywordMap.quickWinsEnriched.length > 0 ? data.keywordMap.quickWinsEnriched.map((qw) => `${qw.keyword} | pos:${qw.position} | vol:${qw.searchVolume} | diff:${qw.difficulty} | cpc:${qw.cpc ?? "–"} | etv:${qw.etv ?? "–"} | intent:${qw.intent ?? "–"} | SERP:${qw.serpFeatures.join(",") || "none"} | refDomains:${qw.referringDomains ?? "–"} | domainRank:${qw.mainDomainRank ?? "–"} | url:${qw.url ?? "–"}`).join("\n") : "No enriched quick wins"}

--- CLUSTER QUICK WINS (LOW-DIFFICULTY TOPIC CLUSTERS = HIGHEST VALUE QUICK WINS) ---
CRITICAL: These clusters are content gaps with avg difficulty < 50. Each one represents dozens/hundreds of keywords capturable with a SINGLE pillar page. They are MORE valuable than individual quick wins above. Prioritize them FIRST.
${data.keywordMap.clusterQuickWins.length > 0 ? data.keywordMap.clusterQuickWins.map((cq, i) => {
  const kwPreview = cq.keywords.slice(0, 10).map((kw) => "  " + kw.phrase + " | vol:" + kw.searchVolume + " | diff:" + kw.difficulty + " | etv:" + kw.estimatedTrafficValue + " | compPos:" + (kw.competitorPosition ?? "–")).join("\n");
  return "CLUSTER QW#" + (i + 1) + ": \"" + cq.topic + "\" | " + cq.gapCount + " keywords | totalVol:" + cq.totalSearchVolume + " | totalETV:" + cq.totalEstimatedValue + " | avgDiff:" + cq.avgDifficulty + "\n" + "Top keywords: " + cq.topKeywords.join(", ") + "\n" + kwPreview;
}).join("\n\n") : "No low-difficulty cluster quick wins found"}

--- SERP Feature Opportunities (ranked keywords with SERP feature presence — optimization targets) ---
CRITICAL: Keywords already in pos 1-10 with a SERP feature = highest ROI for featured snippet/PAA optimization. Cross-reference with quick wins.
${data.keywordMap.serpFeatures.length > 0 ? data.keywordMap.serpFeatures.map((f) => {
  const kwDetail = f.keywordsWithData.slice(0, 5).map((kw) => "  " + kw.keyword + " | pos:" + kw.position + " | vol:" + kw.searchVolume + " | diff:" + kw.difficulty).join("\n");
  return f.feature + " | " + f.count + " keywords | avgPos:" + f.avgPosition + "\n" + kwDetail;
}).join("\n\n") : "No SERP feature data"}

=== TAB: BACKLINKS — Extended Analysis ===

--- Backlink Velocity (acquisition/loss rate, last 14 days) ---
Avg new/day: ${data.backlinkVelocity.avgNewPerDay} | Avg lost/day: ${data.backlinkVelocity.avgLostPerDay} | Net: ${data.backlinkVelocity.netChange}
${data.backlinkVelocity.trend.length > 0 ? `Trend:\n${data.backlinkVelocity.trend.map((t) => `${t.date}: +${t.newCount} / -${t.lostCount}`).join("\n")}` : "No velocity data"}

--- Distributions ---
Top TLDs: ${JSON.stringify(data.backlinkDistributions.tldDistribution)}
Top Countries: ${JSON.stringify(data.backlinkDistributions.countries)}
Link Attributes: ${JSON.stringify(data.backlinkDistributions.linkAttributes)}
Platform Types: ${JSON.stringify(data.backlinkDistributions.platformTypes)}

=== TAB: VISIBILITY — Historical Trend ===
${data.visibilityTrend.length > 0 ? data.visibilityTrend.map((vt) => `${vt.date} | ETV: ${vt.etv ?? "–"} | up: ${vt.keywordsUp} | down: ${vt.keywordsDown}`).join("\n") : "No visibility history"}

=== TAB: INSIGHTS — Aggregated Intelligence ===
Health Score: ${data.insights.healthScore ?? "N/A"}/100
${data.insights.healthBreakdown ? `Score Breakdown: keywords=${data.insights.healthBreakdown.keywords ?? 0}, backlinks=${data.insights.healthBreakdown.backlinks ?? 0}, onsite=${data.insights.healthBreakdown.onsite ?? 0}, content=${data.insights.healthBreakdown.content ?? 0}` : ""}
${data.insights.atRiskKeywords.length > 0 ? `At-Risk Keywords:\n${data.insights.atRiskKeywords.map((k) => `${k.phrase} | pos: ${k.position} | drop: -${k.drop}`).join("\n")}` : ""}
${data.insights.risingKeywords.length > 0 ? `Rising Opportunities:\n${data.insights.risingKeywords.map((k) => `${k.phrase} | pos: ${k.position} | gain: +${k.gain}`).join("\n")}` : ""}
${data.insights.nearPage1.length > 0 ? `Near Page 1 (pos 11-20):\n${data.insights.nearPage1.map((k) => `${k.phrase} | pos: ${k.position} | vol: ${k.searchVolume}`).join("\n")}` : ""}
${data.insights.recommendations.length > 0 ? `Top Recommendations:\n${data.insights.recommendations.map((r) => `[${r.priority}] ${r.category}: ${r.title} — ${r.description}`).join("\n")}` : ""}

=== DATA RELATIONSHIPS & CROSS-TAB DEPENDENCIES ===

Use these relationships to connect insights across data sources:

1. COMPETITOR OVERLAP ↔ CONTENT GAPS: Overlap matrix = head-to-head keyword battles. Content gaps = keywords competitors rank for that we DON'T. Different strategies for each.

2. CANNIBALIZATION ↔ ON-SITE: URLs ranking for multiple keywords need content consolidation or internal link restructuring. Cross-reference with crawled page scores.

3. QUICK WINS ↔ BACKLINK VELOCITY: Quick wins in pos 4-30 may be achievable faster if backlink velocity is positive. Prioritize wins where link momentum supports the push.

4. SERP FEATURES ↔ QUICK WINS: Keywords with featured snippet opportunity + already pos 4-10 = highest ROI optimization targets.

5. VISIBILITY TREND ↔ BACKLINK VELOCITY: Correlate ETV changes with link acquisition to identify which link building efforts drive visibility gains.

6. INSIGHTS RECOMMENDATIONS ↔ ALL DATA: Validate each recommendation against raw tab data. Prioritize recommendations that multiple data sources support.

7. CANNIBALIZATION ↔ KEYWORD CLUSTERING: Cannibalized URLs often indicate poor keyword clustering. Use cannibalization data to inform cluster consolidation strategy.

8. COMPETITOR OVERLAP ↔ BACKLINKS: Keywords where competitors outrank us AND have more referring domains = content + links needed. Keywords where we have fewer links but rank close = content quality advantage to leverage.

9. **HIGHEST PRIORITY** TOPIC CLUSTERS ↔ QUICK WINS: A topic cluster with low avg difficulty (< 30) and high total search volume IS the biggest quick win available. One pillar page targeting a low-competition cluster can capture hundreds of keywords at once. ALWAYS check cluster difficulty before recommending individual keyword quick wins — if there's a cluster of 100+ keywords at difficulty < 10, that single cluster is worth more than ALL individual quick wins combined. Put these cluster-level quick wins FIRST in quickWins, contentStrategy, and actionableSteps.

10. TOPIC CLUSTERS ↔ CONTENT STRATEGY: Each cluster = one content hub (pillar page + supporting articles). Use exact keyword counts and volumes from cluster data. Do NOT split a cluster across multiple unrelated content pieces.

11. TOPIC CLUSTERS ↔ COMPETITOR OVERLAP: Cross-reference cluster keywords with competitor positions. Clusters where competitors rank poorly = easiest wins. Clusters where competitors dominate = need link building + superior content.

12. LINK PROSPECTS ↔ QUICK WINS: Match "easy" prospects (broken_link, resource_page) with quick win keywords in pos 4-20. A DR 50+ prospect linking to competitors for a keyword where we rank #8 = immediate priority. Recommend specific prospect→keyword pairings in backlinkStrategy.

13. LINK PROSPECTS ↔ COMPETITOR OVERLAP: Prospects that already link to multiple competitors = industry authority sites. Acquiring a link from these sites has outsized impact because it signals to Google that we belong in the same competitive set. Prioritize prospects with linksToCompetitors >= 2.

14. LINK PROSPECTS ↔ BACKLINK VELOCITY: If backlink velocity is negative (losing links), prioritize "easy" prospects to stop the bleeding. If positive, focus on high-DR "hard" prospects for quality growth. Match acquisition pace to velocity trends.

=== OUTPUT FORMAT ===
Return JSON with exactly these 11 keys. REMEMBER: each section must contain UNIQUE content — no insight should appear in more than one section.
{
  "executiveSummary": "3-5 sentence HIGH-LEVEL overview only. Mention strengths/weaknesses by category name, do NOT list specific keywords or fixes (those go in their sections)",
  "quickWins": [{"keyword":"...","currentPosition":N,"targetPosition":N,"difficulty":N,"searchVolume":N,"estimatedTrafficGain":"...","actionItems":["step1","step2"]}],
  "contentStrategy": [{"targetKeyword":"...","opportunityScore":N,"searchVolume":N,"suggestedContentType":"blog|landing|guide|comparison","competitorsCovering":["domain1"],"estimatedImpact":"..."}] — ONLY keywords NOT already in quickWins,
  "competitorAnalysis": [{"domain":"...","strengths":["..."],"weaknesses":["..."],"threatsToUs":["..."],"opportunitiesAgainstThem":["..."]}] — competitor-specific insights ONLY,
  "backlinkStrategy": {"profileAssessment":"...","toxicCleanup":{"description":"...","priority":"high|medium|low","count":N},"linkBuildingPriorities":["..."],"prospectRecommendations":"..."} — link-related ONLY,
  "technicalSEO": {"healthScore":N,"criticalFixes":["..."],"warnings":["..."],"healthScoreTarget":N,"improvementSteps":["..."]} — site health ONLY. CRITICAL: healthScore MUST be the exact value from ON-SITE HEALTH data. criticalFixes and warnings MUST reference ONLY actual issues from the CRAWLED PAGES data above. If a page has title="Some Title" in the data, it is NOT missing a title tag. Only report problems that actually appear in the PROBLEMS column of the crawled pages data,
  "riskAssessment": [{"risk":"...","severity":"high|medium|low","impact":"...","mitigation":"..."}] — unique risks, not restated recommendations,
  "keywordClustering": [{"clusterName":"...","theme":"...","keywords":["k1","k2"],"suggestedContentPiece":"...","totalSearchVolume":N,"avgDifficulty":N}] — cluster groupings, not individual keyword advice,
  "roiForecast": {"currentEstimatedTraffic":N,"projectedTraffic30d":N,"projectedTraffic90d":N,"keyDrivers":["..."],"assumptions":["..."]} — projections only,
  "actionPlan": [{"priority":1,"action":"...","category":"content|technical|links|keywords","expectedImpact":"...","effort":"low|medium|high","timeframe":"immediate|short-term|long-term"}] — each action REFERENCES a section (e.g. "Execute quick win: [keyword]") but does NOT restate the advice,
  "actionableSteps": [{"title":"Create landing page: Klimatyzacja Warszawa","type":"landing|blog|guide|technical|outreach|cleanup","goal":"Rank top 5 for 'klimatyzacja Warszawa' cluster","specs":{"minWordCount":1500,"targetKeywords":["klimatyzacja Warszawa","montaż klimatyzacji"],"keywordDensity":"1-2% for primary, 0.5% for secondary","internalLinks":2,"externalLinks":1,"headingStructure":"H1 with primary keyword, 3-5 H2s covering subtopics","metaTitle":"max 60 chars with primary keyword","metaDescription":"max 155 chars, include CTA","callToAction":"Contact form or phone number"},"notes":"Include local schema markup, embed Google Maps, add customer testimonials"}] — DETAILED step-by-step implementation briefs. Each step must be a concrete deliverable with exact specifications someone can execute immediately. For content: include word count, keyword targets with density, heading structure, internal/external link counts, meta tags, CTA. For technical: include exact files/settings to change. For outreach: include target sites, pitch angle, anchor text. Max 8 items, ordered by priority.
}

Max items: quickWins 10, contentStrategy 10, competitorAnalysis per competitor, riskAssessment 8, keywordClustering 8, actionPlan 15, actionableSteps 8.

SELF-CHECK BEFORE RESPONDING: Scan all 11 sections. If any recommendation, keyword, or insight appears in more than one section, remove the duplicate and keep it only in the most specific section.`;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", pl: "Polish", de: "German", fr: "French", es: "Spanish",
  it: "Italian", nl: "Dutch", pt: "Portuguese", cs: "Czech", sk: "Slovak",
};

// ─── Phase 1: Keyword & Content Analyst Prompt ───

function buildPhase1KeywordPrompt(data: StrategyDataSummary, langName: string, businessDescription?: string, focusKeywords?: string[]): string {
  const hasFocus = focusKeywords && focusKeywords.length > 0;
  return `You are a keyword and content analyst. Analyze the keyword and content data below and produce a focused analysis.

CRITICAL RULES:
1. Every finding MUST reference specific numbers from the data
2. Do NOT give generic advice — only actionable items backed by provided metrics
3. Generate ALL text in ${langName}
4. Return ONLY valid JSON matching the schema below, no markdown fences
5. Cluster quick wins with avgDifficulty < 30 are HIGHEST priority — a single pillar page can capture dozens/hundreds of keywords
6. clusterQuickWins MUST be populated with low-difficulty clusters from the CLUSTER QUICK WINS section below — these are the most valuable quick wins available${businessDescription ? `
7. BUSINESS FIT FILTER: Read the business description below. EXCLUDE any keywords or clusters related to products/services the business explicitly says they do NOT offer or sell.
   Business: ${businessDescription}` : ""}${hasFocus ? `
${businessDescription ? "8" : "7"}. FOCUS KEYWORDS PRIORITY: The user wants the strategy to specifically focus on these target phrases: [${focusKeywords.join(", ")}].
   - ALWAYS include these keywords (or their clusters) in quickWins and contentPriorities even if their metrics are not the best
   - When scoring contentOpportunities, boost items related to focus keywords
   - In clusterQuickWins, prioritize clusters containing or related to focus keywords
   - If a focus keyword doesn't appear in the data, still include it as a manual recommendation with a note` : ""}

=== KEYWORD DATA (${data.keywords.activeCount} active, ${data.keywords.pausedCount} paused) ===
Average Position: ${data.keywords.avgPosition ?? "no data"}
Position Distribution: ${JSON.stringify(data.keywords.positionDistribution)}
7-Day Movement: ${data.keywords.gainers7d} improving, ${data.keywords.losers7d} declining
Top Performers (in top 10): ${JSON.stringify(data.keywords.topPerformers.slice(0, 15))}
At Risk (dropping): ${JSON.stringify(data.keywords.atRisk.slice(0, 15))}
Quick Win Candidates (pos 4-30, diff <50): ${JSON.stringify(data.keywords.quickWins.slice(0, 15))}

=== DISCOVERED KEYWORDS (${data.discoveredKeywords.totalCount} total, ${data.discoveredKeywords.rankedCount} ranked) ===
Top 3: ${data.discoveredKeywords.top3} | Top 10: ${data.discoveredKeywords.top10}
Average Position: ${data.discoveredKeywords.avgPosition ?? "no data"}

=== CONTENT GAPS (${data.contentGaps.totalCount} total, ${data.contentGaps.highPriorityCount} high priority) ===
Top Opportunities: ${JSON.stringify(data.contentGaps.topOpportunities.slice(0, 15))}

=== TOPIC CLUSTERS (${data.contentGaps.topicClusters.length} clusters) ===
${data.contentGaps.topicClusters.map((cluster, i) => {
  const kwLines = cluster.keywords.slice(0, 30).map((kw) =>
    "  " + kw.phrase + " | vol:" + kw.searchVolume + " | score:" + kw.opportunityScore + " | diff:" + kw.difficulty + " | etv:" + kw.estimatedTrafficValue + " | compPos:" + (kw.competitorPosition ?? "–") + " | priority:" + kw.priority + " | status:" + kw.status
  ).join("\n");
  return "--- Cluster " + (i + 1) + ': "' + cluster.topic + '" (' + cluster.gapCount + " keywords) ---\n" +
    "Total Search Volume: " + cluster.totalSearchVolume + " | Est. Traffic Value: " + cluster.totalEstimatedValue + " | Avg Difficulty: " + cluster.avgDifficulty + " | Avg Opportunity Score: " + cluster.avgOpportunityScore + "\n" +
    "Top Keywords: " + cluster.topKeywords.join(", ") + "\n" +
    "Keywords:\n" + kwLines;
}).join("\n\n")}

=== KEYWORD MAP — Quick Wins Enriched ===
${data.keywordMap.quickWinsEnriched.length > 0 ? data.keywordMap.quickWinsEnriched.map((qw) => `${qw.keyword} | pos:${qw.position} | vol:${qw.searchVolume} | diff:${qw.difficulty} | cpc:${qw.cpc ?? "–"} | etv:${qw.etv ?? "–"} | intent:${qw.intent ?? "–"} | SERP:${qw.serpFeatures.join(",") || "none"} | refDomains:${qw.referringDomains ?? "–"} | url:${qw.url ?? "–"}`).join("\n") : "No enriched quick wins"}

=== CLUSTER QUICK WINS (LOW-DIFFICULTY TOPIC CLUSTERS) ===
${data.keywordMap.clusterQuickWins.length > 0 ? data.keywordMap.clusterQuickWins.map((cq, i) => {
  const kwPreview = cq.keywords.slice(0, 10).map((kw) => "  " + kw.phrase + " | vol:" + kw.searchVolume + " | diff:" + kw.difficulty + " | etv:" + kw.estimatedTrafficValue + " | compPos:" + (kw.competitorPosition ?? "–")).join("\n");
  return "CLUSTER QW#" + (i + 1) + ": \"" + cq.topic + "\" | " + cq.gapCount + " keywords | totalVol:" + cq.totalSearchVolume + " | totalETV:" + cq.totalEstimatedValue + " | avgDiff:" + cq.avgDifficulty + "\n" + "Top keywords: " + cq.topKeywords.join(", ") + "\n" + kwPreview;
}).join("\n\n") : "No low-difficulty cluster quick wins found"}

=== SERP FEATURE OPPORTUNITIES ===
${data.keywordMap.serpFeatures.length > 0 ? data.keywordMap.serpFeatures.map((f) => {
  const kwDetail = f.keywordsWithData.slice(0, 5).map((kw) => "  " + kw.keyword + " | pos:" + kw.position + " | vol:" + kw.searchVolume + " | diff:" + kw.difficulty).join("\n");
  return f.feature + " | " + f.count + " keywords | avgPos:" + f.avgPosition + "\n" + kwDetail;
}).join("\n\n") : "No SERP feature data"}

=== CANNIBALIZATION ===
${data.keywordMap.cannibalization.length > 0 ? data.keywordMap.cannibalization.map((c) => `${c.url} | ${c.keywordCount} keywords | ${c.keywords.map((k) => `${k.keyword}@${k.position}`).join(", ")} | avg pos: ${c.avgPosition}`).join("\n") : "No cannibalization detected"}

=== EXISTING CONTENT INVENTORY (${data.onSite.crawledPages.length} pages on site — CROSS-REFERENCE BEFORE RECOMMENDING NEW CONTENT) ===
CRITICAL: Before recommending "create a pillar page" or "create new content" for ANY topic, you MUST check this inventory for pages that ALREADY cover that topic.
- Match by URL path keywords, title, H1, and H2 headings
- If a matching page EXISTS: recommend OPTIMIZING it (improve content, add sections, update meta), NOT creating a new one
- Only recommend creating NEW content when NO existing page covers the topic
- For each clusterQuickWin and contentGapPriority, specify "existingPage" if a matching page is found

${data.onSite.crawledPages.filter((p) => p.statusCode === 200 && p.wordCount > 0).map((p) => {
  const h2Preview = p.h2s.length > 0 ? ` | h2s: ${p.h2s.slice(0, 8).join(" / ")}${p.h2s.length > 8 ? ` (+${p.h2s.length - 8} more)` : ""}` : "";
  return `${p.url} | title="${p.title ?? "NONE"}" | h1="${p.h1 ?? "NONE"}" | ${p.wordCount} words | score=${p.onpageScore ?? "?"}${h2Preview}`;
}).join("\n")}

=== OUTPUT FORMAT ===
Return JSON with exactly these 3 keys:
{
  "keywordHealth": {
    "avgPosition": <number|null>,
    "positionDistribution": <Record<string,number>>,
    "movement7d": {"gainers":<number>,"losers":<number>},
    "topPerformers": [{"keyword":"...","position":<number>,"volume":<number>}],
    "atRiskKeywords": [{"keyword":"...","position":<number>,"drop":<number>,"urgency":"high|medium|low"}],
    "cannibalization": [{"url":"...","keywords":["..."],"recommendation":"..."}]
  },
  "contentOpportunities": {
    "clusterQuickWins": [{"topic":"...","gapCount":<number>,"totalVolume":<number>,"avgDifficulty":<number>,"pillarKeyword":"...","supportingKeywords":["..."],"contentFormat":"pillar|hub|guide|optimize","estimatedTraffic":"...","existingPage":"<URL if matching page exists, null if new content needed>","existingPageScore":<onpageScore if exists, null>,"existingPageWordCount":<wordCount if exists, null>,"recommendation":"<if existing: what to improve; if new: what to create>"}],
    "individualQuickWins": [{"keyword":"...","position":<number>,"difficulty":<number>,"volume":<number>,"serpFeatures":["..."],"actionItems":["..."],"rankingUrl":"<URL currently ranking for this keyword, if known>"}],
    "serpFeatureTargets": [{"feature":"...","keywords":["..."],"optimizationApproach":"..."}],
    "contentGapPriorities": [{"keyword":"...","opportunityScore":<number>,"volume":<number>,"competitorCoverage":"...","existingPage":"<URL if site already has relevant page, null otherwise>"}]
  },
  "contentPriorities": {
    "immediate": ["..."],
    "shortTerm": ["..."],
    "longTerm": ["..."]
  }
}`;
}

// ─── Phase 1: Backlink & Competitive Analyst Prompt ───

function buildPhase1LinkPrompt(data: StrategyDataSummary, langName: string): string {
  return `You are a backlink and competitive analyst. Analyze the link profile and competitive data below and produce a focused analysis.

CRITICAL RULES:
1. Every finding MUST reference specific numbers from the data
2. Do NOT give generic advice — only actionable items backed by provided metrics
3. Generate ALL text in ${langName}
4. Return ONLY valid JSON matching the schema below, no markdown fences
5. Prospects linking to 2+ competitors = industry standard site, MUST acquire

=== BACKLINKS ===
Total: ${data.backlinks.totalCount} | Stored: ${data.backlinks.storedCount}
Dofollow Ratio: ${data.backlinks.dofollowRatio}% | Toxic: ${data.backlinks.toxicCount} (${data.backlinks.toxicPct}%)
Referring Domains: ${data.backlinks.referringDomains}
Anchor Distribution: ${JSON.stringify(data.backlinks.anchorDistribution)}

=== BACKLINK VELOCITY (last 14 days) ===
Avg new/day: ${data.backlinkVelocity.avgNewPerDay} | Avg lost/day: ${data.backlinkVelocity.avgLostPerDay} | Net: ${data.backlinkVelocity.netChange}
${data.backlinkVelocity.trend.length > 0 ? `Trend:\n${data.backlinkVelocity.trend.map((t) => `${t.date}: +${t.newCount} / -${t.lostCount}`).join("\n")}` : "No velocity data"}

=== BACKLINK DISTRIBUTIONS ===
Top TLDs: ${JSON.stringify(data.backlinkDistributions.tldDistribution)}
Top Countries: ${JSON.stringify(data.backlinkDistributions.countries)}
Link Attributes: ${JSON.stringify(data.backlinkDistributions.linkAttributes)}
Platform Types: ${JSON.stringify(data.backlinkDistributions.platformTypes)}

=== LINK BUILDING PROSPECTS (${data.linkBuilding.totalProspects} total, ${data.linkBuilding.activeProspects} active, ${data.linkBuilding.identifiedProspects} identified) ===
${data.linkBuilding.prospects.length > 0 ? data.linkBuilding.prospects.map((p, i) => {
  return "PROSPECT #" + (i + 1) + ": " + p.referringDomain + " | DR:" + p.domainRank + " | score:" + p.prospectScore + "/100 | impact:" + p.estimatedImpact + "/100 | difficulty:" + p.acquisitionDifficulty + " | channel:" + p.suggestedChannel + " | linksToCompetitors:" + p.linksToCompetitors + " | competitors:" + p.competitors.join(", ") + " | status:" + p.status + (p.reasoning ? " | reason: " + p.reasoning : "");
}).join("\n") : "No active prospects"}

=== COMPETITORS (${data.competitors.length}) ===
${data.competitors.map((c) => `${c.domain}: ${c.coveragePct}% keyword coverage (${c.keywordsCovered}/${c.totalKeywords})`).join("\n")}

=== COMPETITOR OVERLAP MATRIX ===
${data.keywordMap.competitorOverlap.length > 0 ? data.keywordMap.competitorOverlap.map((row) => `${row.keyword} | you: ${row.yourPosition ?? "–"} | ${row.competitors.map((c) => `${c.domain}: ${c.position ?? "–"}`).join(" | ")}`).join("\n") : "No competitor overlap data"}

=== OUTPUT FORMAT ===
Return JSON with exactly these 3 keys:
{
  "linkProfile": {
    "totalBacklinks": <number>,
    "referringDomains": <number>,
    "dofollowRatio": <number>,
    "toxicCount": <number>,
    "toxicPct": <number>,
    "velocityTrend": "growing|stable|declining",
    "netVelocity": <number>,
    "anchorHealthAssessment": "...",
    "distributionInsights": "...",
    "toxicCleanupPriority": "high|medium|low",
    "toxicCleanupActions": ["..."]
  },
  "prospectAnalysis": {
    "highPriorityProspects": [{"domain":"...","domainRank":<number>,"channel":"...","linksToCompetitors":<number>,"rationale":"...","outreachApproach":"..."}],
    "quickWinProspects": [{"domain":"...","channel":"...","rationale":"..."}],
    "longTermTargets": [{"domain":"...","domainRank":<number>,"strategy":"..."}],
    "monthlyTargets": {"newLinksTarget":<number>,"newDomainsTarget":<number>}
  },
  "competitivePosition": {
    "competitors": [{"domain":"...","coveragePct":<number>,"strengths":["..."],"weaknesses":["..."],"keyGaps":["..."]}],
    "overlapInsights": "...",
    "competitiveAdvantages": ["..."],
    "competitiveThreats": ["..."]
  }
}`;
}

// ─── Phase 1: Technical SEO & Visibility Analyst Prompt ───

function buildPhase1TechnicalPrompt(data: StrategyDataSummary, langName: string): string {
  return `You are a technical SEO and visibility analyst. Analyze the technical health and visibility data below and produce a focused analysis.

CRITICAL RULES:
1. Every finding MUST reference specific numbers from the data
2. NEVER fabricate issues — ONLY reference actual issues from the CRAWLED PAGES data
3. healthScore MUST be the EXACT value from the data: ${data.onSite.healthScore ?? "no scan"}
4. If a page has a title in the data, do NOT claim it's "missing title tags"
5. Generate ALL text in ${langName}
6. Return ONLY valid JSON matching the schema below, no markdown fences

=== ON-SITE HEALTH ===
Health Score: ${data.onSite.healthScore ?? "no scan"}/100${data.onSite.grade ? ` | Grade: ${data.onSite.grade}` : ""}
Pages Scanned: ${data.onSite.totalPages}
Critical Issues: ${data.onSite.criticalIssues} | Warnings: ${data.onSite.warnings} | Recommendations: ${data.onSite.recommendations}${data.onSite.avgLoadTime != null ? `\nAvg Load Time: ${data.onSite.avgLoadTime}ms` : ""}${data.onSite.avgPerformance != null ? ` | Avg Performance: ${data.onSite.avgPerformance}/100` : ""}${data.onSite.avgWordCount != null ? ` | Avg Word Count: ${data.onSite.avgWordCount}` : ""}
Issue Breakdown: ${JSON.stringify(data.onSite.issues)}${data.onSite.sections ? `\nSection Scores: ${JSON.stringify(data.onSite.sections)}` : ""}${data.onSite.topIssues.length > 0 ? `\nTop Issues:\n${data.onSite.topIssues.map((i) => `- [${i.priority}] ${i.section}: ${i.issue} → ${i.action}`).join("\n")}` : ""}${data.onSite.pageScoring.avgScore != null ? `\nPage Scoring: avg ${data.onSite.pageScoring.avgScore}/100${data.onSite.pageScoring.distribution ? ` | Distribution: ${JSON.stringify(data.onSite.pageScoring.distribution)}` : ""}${data.onSite.pageScoring.axes ? ` | Axes: ${JSON.stringify(data.onSite.pageScoring.axes)}` : ""}` : ""}

=== CRAWLED PAGES (${data.onSite.crawledPages.length} pages — REAL DATA) ===
${data.onSite.crawledPages.map((p) => {
  const issues: string[] = [];
  if (!p.title) issues.push("MISSING TITLE");
  if (!p.metaDescription) issues.push("MISSING META DESC");
  if (!p.h1) issues.push("MISSING H1");
  if (p.duplicateTitle) issues.push("DUPLICATE TITLE");
  if (p.duplicateDescription) issues.push("DUPLICATE DESC");
  if (p.statusCode !== 200) issues.push(`STATUS ${p.statusCode}`);
  return `${p.url} | title="${p.title ?? "NONE"}" | score=${p.onpageScore ?? "?"} | words=${p.wordCount} | issues=${p.issueCount} (${p.criticalCount}crit,${p.warningCount}warn)${issues.length > 0 ? ` | PROBLEMS: ${issues.join(", ")}` : ""}`;
}).join("\n")}

=== VISIBILITY ===
Estimated Traffic Value: ${data.visibility.currentETV ?? "no data"}
Movement: ${data.visibility.isUp} up, ${data.visibility.isDown} down

=== VISIBILITY TREND ===
${data.visibilityTrend.length > 0 ? data.visibilityTrend.map((vt) => `${vt.date} | ETV: ${vt.etv ?? "–"} | up: ${vt.keywordsUp} | down: ${vt.keywordsDown}`).join("\n") : "No visibility history"}

=== INSIGHTS ===
Health Score: ${data.insights.healthScore ?? "N/A"}/100
${data.insights.healthBreakdown ? `Breakdown: keywords=${data.insights.healthBreakdown.keywords ?? 0}, backlinks=${data.insights.healthBreakdown.backlinks ?? 0}, onsite=${data.insights.healthBreakdown.onsite ?? 0}, content=${data.insights.healthBreakdown.content ?? 0}` : ""}
${data.insights.recommendations.length > 0 ? `Recommendations:\n${data.insights.recommendations.map((r) => `[${r.priority}] ${r.category}: ${r.title} — ${r.description}`).join("\n")}` : ""}

=== JOBS ===
Pending: ${data.jobs.pending} | Processing: ${data.jobs.processing} | Failed: ${data.jobs.failed} | Stuck: ${data.jobs.stuckCount}

=== OUTPUT FORMAT ===
Return JSON with exactly these 4 keys:
{
  "technicalHealth": {
    "healthScore": ${data.onSite.healthScore ?? "null"},
    "grade": ${data.onSite.grade ? `"${data.onSite.grade}"` : "null"},
    "criticalFixes": [{"issue":"...","affectedPages":["..."],"fix":"...","impact":"high|medium|low"}],
    "warnings": [{"issue":"...","affectedPages":<number>,"recommendation":"..."}],
    "performanceMetrics": {"avgLoadTime":${data.onSite.avgLoadTime ?? "null"},"avgPerformance":${data.onSite.avgPerformance ?? "null"},"avgWordCount":${data.onSite.avgWordCount ?? "null"}},
    "healthScoreTarget": <number>,
    "improvementRoadmap": ["step1","step2","..."]
  },
  "visibilityAssessment": {
    "currentETV": ${data.visibility.currentETV ?? "null"},
    "trend": "improving|stable|declining",
    "trendAnalysis": "...",
    "keywordMovement": {"up":${data.visibility.isUp},"down":${data.visibility.isDown}},
    "projectedETV30d": <number|null>,
    "projectedETV90d": <number|null>
  },
  "insightsSummary": {
    "overallHealthScore": ${data.insights.healthScore ?? "null"},
    "healthBreakdown": ${data.insights.healthBreakdown ? JSON.stringify(data.insights.healthBreakdown) : "null"},
    "topRecommendations": [{"category":"...","priority":"...","title":"...","action":"..."}],
    "riskFactors": ["..."]
  },
  "healthRecommendations": {
    "immediate": ["..."],
    "shortTerm": ["..."],
    "monitoring": ["..."]
  }
}`;
}

// ─── Phase 2: Strategy Synthesis Prompt ───

function buildPhase2SynthesisPrompt(
  phase1: { keyword: Record<string, any>; link: Record<string, any>; technical: Record<string, any> },
  businessContext: { domain: string; market: string; language: string; description: string; targetCustomer: string; focusKeywords: string[]; generateBacklinkContent: boolean; generateContentMockups: boolean },
  langName: string,
): string {
  const hasFocus = businessContext.focusKeywords.length > 0;
  return `You are a senior SEO strategist synthesizing three analyst reports into a unified strategy.

CRITICAL RULES:
1. Every recommendation MUST reference specific numbers from the analyst reports
2. Do NOT give generic SEO advice — only actionable items backed by provided metrics
3. NEVER fabricate data — use ONLY what the analysts provided
4. Generate ALL text in ${langName}
5. Return ONLY valid JSON matching the schema below, no markdown fences
6. ZERO REPETITION ACROSS SECTIONS — each insight appears in EXACTLY ONE section:
   - quickWins: keyword-level optimizations ONLY
   - contentStrategy: content creation plan ONLY — do NOT repeat keywords from quickWins
   - competitorAnalysis: competitor-specific SWOT ONLY
   - backlinkStrategy: link profile and link building ONLY
   - technicalSEO: site health and technical fixes ONLY
   - keywordClustering: cluster groupings ONLY — use the analyst's clusters, do NOT invent new ones
   - riskAssessment: risks and mitigations ONLY
7. technicalSEO.healthScore MUST match the EXACT value from the Technical Analyst report
8. keywordClustering MUST use clusters from the Keyword Analyst report, not invented ones
9. backlinkStrategy MUST reference specific prospect domains from the Link Analyst report
10. quickWins MUST include BOTH individual keyword wins AND cluster-level wins from clusterQuickWins. For cluster wins: use the pillar keyword as "keyword", set currentPosition to 0 (not ranking), set source to "cluster", include cluster topic and keyword count in actionItems. At least 30-50% of quickWins should come from low-difficulty clusters.
11. BUSINESS RELEVANCE FILTER — this is MANDATORY:
    - Read the business description carefully. If the business says they do NOT sell/offer a product or service, EXCLUDE all keywords related to that product/service from ALL sections.
    - If the description says "nie sprzedajemy X" or "we don't offer X" or any negation about a product, that product and related keywords must be COMPLETELY REMOVED from quickWins, contentStrategy, keywordClustering, actionPlan, and actionableSteps.
    - This filter applies even if the keyword has high volume or low difficulty — business fit overrides SEO metrics.

=== BUSINESS CONTEXT (READ CAREFULLY — filter all recommendations against this) ===
Domain: ${businessContext.domain}
Market: ${businessContext.market}
Language: ${langName}
Business Description: ${businessContext.description}
Target Customer: ${businessContext.targetCustomer}${hasFocus ? `
FOCUS KEYWORDS (HIGH PRIORITY): ${businessContext.focusKeywords.join(", ")}` : ""}
IMPORTANT: Only recommend keywords and content that MATCH the products/services described above. If the business description excludes certain products, exclude related keywords from ALL sections.${hasFocus ? `
FOCUS KEYWORDS RULE: The strategy MUST prioritize the focus keywords listed above. Include them in quickWins (if not already ranking #1), contentStrategy, and keywordClustering. If a focus keyword has no data in the analyst reports, still include it with reasonable estimates.` : ""}${businessContext.generateBacklinkContent ? `
BACKLINK CONTENT RULE: Generate a SEPARATE "backlinkContentExamples" section — an array of 5-8 outreach/content ideas for backlink acquisition. Each item: {"type":"guest-post|resource|data-study|infographic|tool|expert-roundup","title":"...","description":"...","targetSites":"...","suggestedAnchorText":"...","emailSubject":"...","category":"..."}. These should be specific, actionable content pieces that would attract links from the types of sites found in the Link Analyst report.` : ""}

=== KEYWORD & CONTENT ANALYST REPORT ===
${JSON.stringify(phase1.keyword, null, 1)}

=== BACKLINK & COMPETITIVE ANALYST REPORT ===
${JSON.stringify(phase1.link, null, 1)}

=== TECHNICAL & VISIBILITY ANALYST REPORT ===
${JSON.stringify(phase1.technical, null, 1)}

=== DATA RELATIONSHIPS (use these to connect insights across analyst reports) ===
1. COMPETITOR OVERLAP ↔ CONTENT GAPS: Overlap = head-to-head battles. Gaps = keywords competitors rank for that we don't.
2. CANNIBALIZATION ↔ ON-SITE: URLs ranking for multiple keywords need content consolidation.
3. QUICK WINS ↔ BACKLINK VELOCITY: Quick wins achievable faster if link velocity is positive.
4. SERP FEATURES ↔ QUICK WINS: Keywords with featured snippet + pos 4-10 = highest ROI.
5. VISIBILITY TREND ↔ BACKLINK VELOCITY: Correlate ETV changes with link acquisition.
6. TOPIC CLUSTERS ↔ QUICK WINS: Low-difficulty cluster = biggest quick win. One pillar page captures hundreds of keywords — BUT ONLY IF the page doesn't already exist (check existingPage from Keyword Analyst).
7. TOPIC CLUSTERS ↔ CONTENT STRATEGY: Each cluster = one content hub (pillar + supporting). If existingPage is set, the strategy is OPTIMIZATION, not creation.
8. TOPIC CLUSTERS ↔ COMPETITOR OVERLAP: Clusters where competitors rank poorly = easiest wins.
9. LINK PROSPECTS ↔ QUICK WINS: Match easy prospects with quick win keywords in pos 4-20.
10. LINK PROSPECTS ↔ COMPETITOR OVERLAP: Prospects linking to multiple competitors = industry authority.
11. LINK PROSPECTS ↔ BACKLINK VELOCITY: Negative velocity → prioritize easy prospects. Positive → focus on high-DR targets.
12. CANNIBALIZATION ↔ KEYWORD CLUSTERING: Cannibalized URLs indicate poor clustering.
13. INSIGHTS RECOMMENDATIONS ↔ ALL DATA: Validate each recommendation against raw data.
14. COMPETITOR OVERLAP ↔ BACKLINKS: Where competitors outrank AND have more links = content + links needed.
15. EXISTING CONTENT ↔ CONTENT STRATEGY: The Keyword Analyst has cross-referenced content gaps against EXISTING pages on the site. If "existingPage" is set on a clusterQuickWin or contentGapPriority, the page ALREADY EXISTS. Do NOT recommend creating it — recommend IMPROVING it instead.

=== EXISTING CONTENT AWARENESS (MANDATORY) ===
The Keyword Analyst report includes "existingPage", "existingPageScore", "existingPageWordCount" fields on clusterQuickWins and contentGapPriorities. These indicate that the site ALREADY HAS a page covering that topic. You MUST:
1. NEVER say "create a pillar page" or "create new content" when existingPage is set — instead say "optimize existing page at [URL]"
2. For quickWins with source:"cluster": if existingPage is set, actionItems should be about IMPROVING the existing page (add missing sections, improve word count, add internal links, update meta tags), NOT creating a new page
3. For contentStrategy items: if a matching existing page exists, set suggestedContentType to "optimize" and include specific improvement recommendations in estimatedImpact
4. For keywordClustering items: set suggestedContentPiece to describe optimization of the existing page, including its current word count and score if available

=== OUTPUT FORMAT ===
Return JSON with exactly these ${businessContext.generateBacklinkContent ? "8" : "7"} keys:
{
  "quickWins": [
    {"keyword":"...","currentPosition":<number>,"targetPosition":<number>,"difficulty":<number>,"searchVolume":<number>,"estimatedTrafficGain":"...","actionItems":["step1","step2"]},
    {"keyword":"[pillar keyword from cluster]","currentPosition":0,"targetPosition":<number>,"difficulty":<number>,"searchVolume":<total cluster volume>,"estimatedTrafficGain":"...","actionItems":["Optimize existing page at /url — add missing sections, improve from X to Y words","..."],"source":"cluster","clusterTopic":"...","clusterKeywordCount":<number>,"existingPage":"<URL if page exists, null if new>"}
  ],
  "contentStrategy": [{"targetKeyword":"...","opportunityScore":<number>,"searchVolume":<number>,"suggestedContentType":"blog|landing|guide|comparison|optimize","competitorsCovering":["domain1"],"estimatedImpact":"...","existingPage":"<URL if exists, null if new>"}],
  "competitorAnalysis": [{"domain":"...","strengths":["..."],"weaknesses":["..."],"threatsToUs":["..."],"opportunitiesAgainstThem":["..."]}],
  "backlinkStrategy": {"profileAssessment":"...","toxicCleanup":{"description":"...","priority":"high|medium|low","count":<number>},"linkBuildingPriorities":["..."],"prospectRecommendations":"..."},
  "technicalSEO": {"healthScore":<number>,"criticalFixes":["..."],"warnings":["..."],"healthScoreTarget":<number>,"improvementSteps":["..."]},
  "keywordClustering": [{"clusterName":"...","theme":"...","keywords":["k1","k2"],"suggestedContentPiece":"...","totalSearchVolume":<number>,"avgDifficulty":<number>,"existingPage":"<URL if exists, null if new>"}],
  "riskAssessment": [{"risk":"...","severity":"high|medium|low","impact":"...","mitigation":"..."}]${businessContext.generateBacklinkContent ? `,
  "backlinkContentExamples": [{"type":"guest-post|resource|data-study|infographic|tool|expert-roundup","title":"...","description":"2-3 sentence pitch","targetSites":"type of sites to pitch","suggestedAnchorText":"...","emailSubject":"...","category":"..."}]` : ""}
}

QUICKWINS COMPOSITION RULE: At least 3-5 of the 10 quickWins MUST be cluster-level wins from clusterQuickWins (with source:"cluster"). These should be the FIRST items if their avgDifficulty < 30. The remaining slots go to individual keyword quick wins.
EXISTING CONTENT RULE: If the Keyword Analyst marked a cluster/gap with existingPage, your quickWin/contentStrategy/keywordClustering entry MUST use "optimize" action, NOT "create". Include the existing URL and specific improvement recommendations.

Max items: quickWins 10, contentStrategy 10, competitorAnalysis per competitor, riskAssessment 8, keywordClustering 8${businessContext.generateBacklinkContent ? ", backlinkContentExamples 8" : ""}.

SELF-CHECK before responding:
1. Scan all ${businessContext.generateBacklinkContent ? "8" : "7"} sections — no recommendation/keyword/insight in more than one section
2. Verify quickWins contains cluster-level entries from clusterQuickWins data
3. Verify NO keyword relates to products/services the business explicitly does NOT offer (re-read business description)`;
}

// ─── Phase 3: Action Plan & Executive Summary Prompt ───

function buildPhase3ActionPlanPrompt(
  phase2: Record<string, any>,
  businessContext: { domain: string; market: string; language: string; description: string; targetCustomer: string; focusKeywords: string[]; generateBacklinkContent: boolean; generateContentMockups: boolean },
  keyMetrics: {
    avgPosition: number | null;
    activeKeywords: number;
    healthScore: number | null;
    currentETV: number | null;
    backlinkCount: number;
    referringDomains: number;
    competitorCount: number;
    contentGapCount: number;
  },
  langName: string,
): string {
  const hasFocus = businessContext.focusKeywords.length > 0;
  return `You are a senior SEO consultant presenting to a client. Based on the strategy synthesis below, create an executive summary and detailed action plan.

CRITICAL RULES:
1. executiveSummary: HIGH-LEVEL overview ONLY — do NOT list specific keywords, fixes, or action steps
2. actionPlan: max 15 items. Each REFERENCES a section from the strategy (e.g. "Execute quick win: [keyword]") but does NOT restate advice
3. actionableSteps: max 8 items with DETAILED specifications — word count, keyword targets, heading structure, meta tags, CTAs
4. roiForecast: based on realistic projections from the key metrics
5. Generate ALL text in ${langName}
6. Return ONLY valid JSON matching the schema below, no markdown fences
EXISTING CONTENT RULE: The Phase 2 strategy contains "existingPage" fields on quickWins, contentStrategy, and keywordClustering. When existingPage is set:
- actionPlan items MUST say "Optimize existing page" NOT "Create new page"
- actionableSteps MUST set type to "optimize" (not "landing" or "blog") and include the existing URL in the title
- actionableSteps specs should focus on IMPROVING the existing page: what sections to add, how to increase word count, what H2s to add, how to improve meta tags
- Do NOT recommend creating content that already exists on the site — this wastes the user's time and money${hasFocus ? `
7. FOCUS KEYWORDS: Ensure the action plan and actionable steps prioritize these user-specified target phrases: [${businessContext.focusKeywords.join(", ")}]. At least 2-3 actionableSteps should directly target these keywords.` : ""}${businessContext.generateContentMockups ? `
${hasFocus ? "8" : "7"}. CONTENT MOCKUPS: For each actionableStep, include a "mockup" field — a JSON array of page sections representing a visual wireframe of the proposed page. Each section: {"type":"hero|features|content|faq|cta|testimonials|stats|comparison|steps|gallery","heading":"actual proposed H2 text","content":"1-2 sentences of proposed body text","items":["item1","item2"]}.
   Rules for mockup sections:
   - First section should be "hero" with the H1 heading and value proposition
   - Include 4-8 sections per page, covering the full page layout
   - "faq" type: items = array of 3-5 questions
   - "features"/"steps" type: items = array of feature/step names
   - "cta" type: content = CTA button text, items = trust signals
   - "stats" type: items = array of "number — label" strings
   - Use actual proposed text in the user's language, not placeholders` : ""}

=== BUSINESS CONTEXT ===
Domain: ${businessContext.domain}
Market: ${businessContext.market}
Language: ${langName}
Business: ${businessContext.description}
Target Customer: ${businessContext.targetCustomer}${hasFocus ? `
Focus Keywords: ${businessContext.focusKeywords.join(", ")}` : ""}

=== KEY METRICS ===
Average Position: ${keyMetrics.avgPosition ?? "no data"}
Active Keywords: ${keyMetrics.activeKeywords}
Health Score: ${keyMetrics.healthScore ?? "no scan"}/100
Estimated Traffic Value: ${keyMetrics.currentETV ?? "no data"}
Backlinks: ${keyMetrics.backlinkCount} | Referring Domains: ${keyMetrics.referringDomains}
Competitors: ${keyMetrics.competitorCount}
Content Gaps: ${keyMetrics.contentGapCount}

=== STRATEGY SYNTHESIS (7 sections from Phase 2) ===
${JSON.stringify(phase2, null, 1)}

=== OUTPUT FORMAT ===
Return JSON with exactly these 4 keys:
{
  "executiveSummary": "3-5 sentence HIGH-LEVEL overview. Mention strengths/weaknesses by category, do NOT list specific keywords or fixes",
  "actionPlan": [{"priority":<number>,"action":"...","category":"content|technical|links|keywords","expectedImpact":"...","effort":"low|medium|high","timeframe":"immediate|short-term|long-term"}],
  "actionableSteps": [{"title":"...","type":"landing|blog|guide|technical|outreach|cleanup|optimize","goal":"...","existingPage":"<URL if optimizing existing page, null if creating new>","specs":{"minWordCount":<number>,"targetKeywords":["..."],"keywordDensity":"...","internalLinks":<number>,"externalLinks":<number>,"headingStructure":"...","metaTitle":"...","metaDescription":"...","callToAction":"..."},"notes":"..."${businessContext.generateContentMockups ? ',"mockup":[{"type":"hero","heading":"...","content":"...","items":[]},{"type":"features","heading":"...","content":"...","items":["feat1","feat2"]},{"type":"faq","heading":"FAQ","content":"","items":["Q1?","Q2?","Q3?"]}]' : ""}}],
  "roiForecast": {"currentEstimatedTraffic":<number>,"projectedTraffic30d":<number>,"projectedTraffic90d":<number>,"keyDrivers":["..."],"assumptions":["..."]}
}

Max items: actionPlan 15, actionableSteps 8.`;
}

// ─── Merge Strategy Results ───

function mergeStrategyResults(
  phase2: Record<string, any>,
  phase3: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {
    quickWins: phase2.quickWins ?? [],
    contentStrategy: phase2.contentStrategy ?? [],
    competitorAnalysis: phase2.competitorAnalysis ?? [],
    backlinkStrategy: phase2.backlinkStrategy ?? {},
    technicalSEO: phase2.technicalSEO ?? {},
    keywordClustering: phase2.keywordClustering ?? [],
    riskAssessment: phase2.riskAssessment ?? [],
    executiveSummary: phase3.executiveSummary ?? "",
    actionPlan: phase3.actionPlan ?? [],
    actionableSteps: phase3.actionableSteps ?? [],
    roiForecast: phase3.roiForecast ?? {},
  };
  // Optional sections — only include if AI generated them
  if (phase2.backlinkContentExamples?.length > 0) {
    result.backlinkContentExamples = phase2.backlinkContentExamples;
  }
  return result;
}

// ─── Phase 1 Parallel Execution with Retry ───

async function executePhase1WithRetry(
  aiConfig: { provider: "anthropic" | "google" | "zai"; model: string },
  data: StrategyDataSummary,
  langName: string,
  businessDescription?: string,
  focusKeywords?: string[],
): Promise<{
  keyword: Record<string, any>;
  link: Record<string, any>;
  technical: Record<string, any>;
  allFailed: boolean;
}> {
  const prompts = [
    { name: "keyword", build: () => buildPhase1KeywordPrompt(data, langName, businessDescription, focusKeywords) },
    { name: "link", build: () => buildPhase1LinkPrompt(data, langName) },
    { name: "technical", build: () => buildPhase1TechnicalPrompt(data, langName) },
  ] as const;

  async function callAndParse(prompt: string, name: string): Promise<Record<string, any>> {
    const result = await callAI({
      provider: aiConfig.provider,
      model: aiConfig.model,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8000,
      temperature: 0.3,
    });
    console.log(`[Strategy] Phase 1 ${name}: ${result.text.length} chars, stopReason: ${result.stopReason ?? "unknown"}`);
    const parsed = parseStrategyJson(result.text);
    if (!parsed) throw new Error(`Failed to parse ${name} response`);
    return parsed;
  }

  const results = await Promise.allSettled(
    prompts.map(async ({ name, build }) => {
      const prompt = build();
      try {
        return await callAndParse(prompt, name);
      } catch (err) {
        console.warn(`[Strategy] Phase 1 ${name} failed, retrying: ${err instanceof Error ? err.message : String(err)}`);
        // Retry once
        return await callAndParse(prompt, name);
      }
    })
  );

  const keyword = results[0].status === "fulfilled" ? results[0].value : {};
  const link = results[1].status === "fulfilled" ? results[1].value : {};
  const technical = results[2].status === "fulfilled" ? results[2].value : {};

  if (results[0].status === "rejected") console.error(`[Strategy] Phase 1 keyword failed: ${results[0].reason}`);
  if (results[1].status === "rejected") console.error(`[Strategy] Phase 1 link failed: ${results[1].reason}`);
  if (results[2].status === "rejected") console.error(`[Strategy] Phase 1 technical failed: ${results[2].reason}`);

  const allFailed = Object.keys(keyword).length === 0 && Object.keys(link).length === 0 && Object.keys(technical).length === 0;

  console.log(`[Strategy] Phase 1 results: keyword=${Object.keys(keyword).length}keys link=${Object.keys(link).length}keys tech=${Object.keys(technical).length}keys${allFailed ? " — ALL FAILED" : ""}`);

  return { keyword, link, technical, allFailed };
}

// ─── JSON Parser with truncation repair ───

function parseStrategyJson(text: string): Record<string, any> | null {
  // Strip markdown fences
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Extract the outermost JSON object
  const startIdx = cleaned.indexOf("{");
  if (startIdx === -1) return null;
  cleaned = cleaned.slice(startIdx);

  // Try parsing as-is first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Response was likely truncated — try to repair
  }

  // Repair: close any unclosed brackets/braces and strip trailing commas
  let repaired = cleaned;
  // Remove trailing incomplete string (cut mid-value)
  repaired = repaired.replace(/,\s*"[^"]*$/, "");
  // Remove trailing comma before we close
  repaired = repaired.replace(/,\s*$/, "");

  // Count open/close brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;
  for (const ch of repaired) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openBraces++;
    else if (ch === "}") openBraces--;
    else if (ch === "[") openBrackets++;
    else if (ch === "]") openBrackets--;
  }

  // Close what's open
  for (let i = 0; i < openBrackets; i++) repaired += "]";
  for (let i = 0; i < openBraces; i++) repaired += "}";

  try {
    return JSON.parse(repaired);
  } catch {
    // Last resort: try closing any open string first
    repaired = repaired.replace(/,\s*"[^"]*$/, "") + "]".repeat(Math.max(0, openBrackets)) + "}".repeat(Math.max(0, openBraces));
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

// ─── Main Action: Generate Strategy (thin launcher) ───

export const generateDomainStrategy = action({
  args: {
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
    focusKeywords: v.optional(v.array(v.string())),
    generateBacklinkContent: v.optional(v.boolean()),
    generateContentMockups: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    const sessionId = await ctx.runMutation(internal.aiStrategy.createSession, {
      domainId: args.domainId,
      businessDescription: args.businessDescription,
      targetCustomer: args.targetCustomer,
      focusKeywords: args.focusKeywords,
      generateBacklinkContent: args.generateBacklinkContent,
      generateContentMockups: args.generateContentMockups,
    });

    await ctx.scheduler.runAfter(0, internal.actions.aiStrategy.processStrategyGeneration, {
      sessionId,
      domainId: args.domainId,
      businessDescription: args.businessDescription,
      targetCustomer: args.targetCustomer,
      focusKeywords: args.focusKeywords,
      generateBacklinkContent: args.generateBacklinkContent,
      generateContentMockups: args.generateContentMockups,
    });

    return { success: true, sessionId: sessionId as string };
  },
});

// ─── Progress Helper ───

async function markStep(
  ctx: any,
  sessionId: any,
  stepIndex: number,
  progress: number,
  status: "initializing" | "collecting" | "analyzing",
  currentStep: string,
) {
  if (stepIndex > 0) {
    await ctx.runMutation(internal.aiStrategy.updateSessionProgress, {
      sessionId,
      stepIndex: stepIndex - 1,
      stepStatus: "completed" as const,
      progress,
    });
  }
  await ctx.runMutation(internal.aiStrategy.updateSessionProgress, {
    sessionId,
    progress,
    status,
    currentStep,
    stepIndex,
    stepStatus: "running" as const,
  });
}

// ─── Background Processing Action ───

export const processStrategyGeneration = internalAction({
  args: {
    sessionId: v.id("aiStrategySessions"),
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
    focusKeywords: v.optional(v.array(v.string())),
    generateBacklinkContent: v.optional(v.boolean()),
    generateContentMockups: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { sessionId, domainId, businessDescription, targetCustomer, focusKeywords, generateBacklinkContent, generateContentMockups } = args;

    try {
      // Step 0 (5%, collecting): Load domain record
      await markStep(ctx, sessionId, 0, 5, "collecting", "Loading domain data...");

      const domain = await ctx.runQuery(internal.domains.getDomainInternal, { domainId });
      if (!domain) {
        await ctx.runMutation(internal.aiStrategy.failSession, {
          sessionId,
          error: "Domain not found",
        });
        return;
      }

      const now = Date.now();
      const sevenDaysAgoStr = new Date(now - 7 * 24 * 3600_000).toISOString().split("T")[0];

      // Step 1 (15%, collecting): Run parallel queries
      await markStep(ctx, sessionId, 1, 15, "collecting", "Collecting keyword, competitor & extended data...");

      const [
        allKeywords,
        discovered,
        gaps,
        competitors,
        backlinks,
        backlinkSummary,
        visHistory,
        onSiteAnalysis,
        onSitePages,
        prospects,
        checkJobs,
        serpJobs,
        competitorOverlap,
        cannibalization,
        quickWinsEnriched,
        serpFeatures,
        backlinkVelocity,
        backlinkDistributions,
        visibilityTrend,
        insightsData,
        topicClusters,
      ] = await Promise.all([
        ctx.runQuery(internal.domains.getMonitoredKeywordsInternal, { domainId }),
        ctx.runQuery(internal.domains.getDiscoveredKeywordsInternal, { domainId, limit: 500 }),
        ctx.runQuery(internal.aiStrategy.getContentGapsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getCompetitorsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getBacklinksInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getBacklinkSummaryInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getVisibilityHistoryInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getOnSiteAnalysisInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getOnSitePagesInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getLinkBuildingProspectsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getCheckJobsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getSerpJobsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getCompetitorOverlapInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getCannibalizationInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getQuickWinsEnrichedInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getSerpFeaturesInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getBacklinkVelocityInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getBacklinkDistributionsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getVisibilityTrendInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getInsightsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getTopicClustersInternal, { domainId }),
      ]);

      // Step 2 (35%, collecting): Competitor enrichment
      await markStep(ctx, sessionId, 2, 35, "collecting", "Analyzing competitors & keyword map...");

      const activeKws = allKeywords.filter((k: any) => k.status === "active");
      const pausedKws = allKeywords.filter((k: any) => k.status === "paused");
      const activeCompetitors = competitors.filter((c: any) => c.status !== "paused");
      const competitorResults = await Promise.all(
        activeCompetitors.map((comp: any) =>
          ctx.runQuery(internal.aiStrategy.getCompetitorPositionsInternal, {
            competitorId: comp._id,
          })
        )
      );
      const competitorSummaries: StrategyDataSummary["competitors"] = activeCompetitors.map(
        (comp: any, i: number) => ({
          domain: comp.competitorDomain,
          keywordsCovered: competitorResults[i].coveredKeywords,
          totalKeywords: activeKws.length,
          coveragePct: activeKws.length > 0
            ? Math.round((competitorResults[i].coveredKeywords / activeKws.length) * 100)
            : 0,
        })
      );

      // Step 3 (50%, collecting): Data aggregation/processing
      await markStep(ctx, sessionId, 3, 50, "collecting", "Processing collected data...");

      // ── Process keywords ──
      let totalPos = 0;
      let posCount = 0;
      let gainers = 0;
      let losers = 0;
      const buckets: Record<string, number> = { "1-3": 0, "4-10": 0, "11-20": 0, "21-50": 0, "51-100": 0, "100+": 0 };

      const topPerformers: StrategyDataSummary["keywords"]["topPerformers"] = [];
      const atRisk: StrategyDataSummary["keywords"]["atRisk"] = [];
      const quickWinCandidates: StrategyDataSummary["keywords"]["quickWins"] = [];

      for (const kw of activeKws) {
        const cp = kw.currentPosition;
        if (cp != null && typeof cp === "number") {
          totalPos += cp;
          posCount++;
          if (cp >= 1 && cp <= 3) buckets["1-3"]++;
          else if (cp <= 10) buckets["4-10"]++;
          else if (cp <= 20) buckets["11-20"]++;
          else if (cp <= 50) buckets["21-50"]++;
          else if (cp <= 100) buckets["51-100"]++;
          else buckets["100+"]++;

          if (cp <= 10) {
            topPerformers.push({
              phrase: kw.phrase,
              position: cp,
              searchVolume: kw.searchVolume,
              cpc: kw.latestCpc,
            });
          }
        }

        const change = kw.positionChange;
        if (typeof change === "number" && !isNaN(change)) {
          if (change > 3) {
            atRisk.push({
              phrase: kw.phrase,
              currentPosition: kw.currentPosition ?? 0,
              previousPosition: kw.previousPosition ?? 0,
              drop: change,
            });
          }
          const recent = kw.recentPositions ?? [];
          if (recent.length >= 2) {
            const weekEntries = recent.filter((p: any) => p.date >= sevenDaysAgoStr);
            if (weekEntries.length >= 2) {
              const oldPos = weekEntries[0].position;
              const newPos = weekEntries[weekEntries.length - 1].position;
              if (oldPos != null && newPos != null) {
                if (newPos < oldPos) gainers++;
                else if (newPos > oldPos) losers++;
              }
            }
          }
        }
      }

      topPerformers.sort((a, b) => a.position - b.position);
      atRisk.sort((a, b) => b.drop - a.drop);

      for (const dk of discovered) {
        if (dk.bestPosition >= 4 && dk.bestPosition <= 30 &&
            typeof dk.difficulty === "number" && !isNaN(dk.difficulty) && dk.difficulty < 50 &&
            typeof dk.searchVolume === "number" && dk.searchVolume > 0) {
          quickWinCandidates.push({
            phrase: dk.keyword,
            position: dk.bestPosition,
            difficulty: dk.difficulty,
            searchVolume: dk.searchVolume,
          });
        }
      }
      quickWinCandidates.sort((a, b) => b.searchVolume - a.searchVolume);

      // Process discovered keywords
      const rankedDiscovered = discovered.filter((d: any) => d.bestPosition !== 999);
      let visTop3 = 0, visTop10 = 0, visTotalPos = 0, visPosCount = 0;
      for (const dk of rankedDiscovered) {
        if (dk.bestPosition > 0 && dk.bestPosition <= 100) {
          visTotalPos += dk.bestPosition;
          visPosCount++;
          if (dk.bestPosition <= 3) visTop3++;
          if (dk.bestPosition <= 10) visTop10++;
        }
      }

      // Process content gaps
      const gapsTotalCount = (gaps as any).totalCount ?? 0;
      const gapsIdentifiedCount = (gaps as any).identifiedCount ?? 0;
      const gapItems = (gaps as any).items ?? gaps;
      const activeGaps = gapItems.filter((g: any) => g.status !== "dismissed");
      const highPriorityGaps = activeGaps.filter(
        (g: any) => typeof g.opportunityScore === "number" && !isNaN(g.opportunityScore) && g.opportunityScore >= 70
      );
      const topOpportunities = activeGaps
        .filter((g: any) => typeof g.opportunityScore === "number" && !isNaN(g.opportunityScore))
        .sort((a: any, b: any) => b.opportunityScore - a.opportunityScore)
        .slice(0, 20)
        .map((g: any) => ({
          keyword: g.keywordPhrase ?? "unknown keyword",
          opportunityScore: g.opportunityScore,
          searchVolume: g.searchVolume ?? 0,
          difficulty: g.difficulty ?? 0,
          estimatedTrafficValue: g.estimatedTrafficValue ?? 0,
        }));

      // Process backlinks
      let toxicCount = 0;
      let dofollowCount = 0;
      const anchorDist: Record<string, number> = {};
      for (const bl of backlinks) {
        if (bl.backlink_spam_score != null && bl.backlink_spam_score >= 70) toxicCount++;
        if (bl.dofollow === true) dofollowCount++;
        const aType = bl.itemType ?? "unknown";
        anchorDist[aType] = (anchorDist[aType] ?? 0) + 1;
      }

      // Process link building
      let identifiedProspects = 0;
      let activeProspectCount = 0;
      for (const p of prospects) {
        if (p.status !== "dismissed") activeProspectCount++;
        if (p.status === "identified") identifiedProspects++;
      }

      // Process jobs
      const allJobs = [...checkJobs, ...serpJobs];
      const stuckJobs = allJobs.filter(
        (j: any) => j.status === "processing" && j.startedAt && (now - j.startedAt) > 30 * 60_000
      );

      const data: StrategyDataSummary = {
        domain: domain.domain,
        location: domain.settings.location,
        language: domain.settings.language,
        keywords: {
          activeCount: activeKws.length,
          pausedCount: pausedKws.length,
          avgPosition: posCount > 0 ? Math.round((totalPos / posCount) * 10) / 10 : null,
          gainers7d: gainers,
          losers7d: losers,
          positionDistribution: buckets,
          topPerformers: topPerformers.slice(0, 20),
          atRisk: atRisk.slice(0, 20),
          quickWins: quickWinCandidates.slice(0, 20),
        },
        discoveredKeywords: {
          totalCount: discovered.length,
          rankedCount: rankedDiscovered.length,
          avgPosition: visPosCount > 0 ? Math.round((visTotalPos / visPosCount) * 10) / 10 : null,
          top3: visTop3,
          top10: visTop10,
        },
        contentGaps: {
          totalCount: gapsTotalCount,
          identifiedCount: gapsIdentifiedCount,
          highPriorityCount: highPriorityGaps.length,
          topOpportunities,
          topicClusters: (topicClusters as any[]).slice(0, 15).map((c: any) => ({
            topic: c.topic,
            gapCount: c.gapCount,
            totalSearchVolume: c.totalSearchVolume,
            totalEstimatedValue: c.totalEstimatedValue,
            avgDifficulty: c.avgDifficulty,
            avgOpportunityScore: c.avgOpportunityScore,
            topKeywords: c.topKeywords,
            keywords: c.keywords.slice(0, 50),
          })),
        },
        competitors: competitorSummaries,
        backlinks: {
          totalCount: backlinkSummary?.totalBacklinks ?? backlinks.length,
          storedCount: backlinks.length,
          dofollowRatio: backlinks.length > 0 ? Math.round((dofollowCount / backlinks.length) * 100) : 0,
          toxicCount,
          toxicPct: backlinks.length > 0 ? Math.round((toxicCount / backlinks.length) * 100) : 0,
          anchorDistribution: anchorDist,
          referringDomains: backlinkSummary?.totalDomains ?? 0,
        },
        onSite: {
          healthScore: onSiteAnalysis?.healthScore ?? null,
          grade: onSiteAnalysis?.grade ?? null,
          totalPages: onSiteAnalysis?.totalPages ?? 0,
          criticalIssues: onSiteAnalysis?.criticalIssues ?? 0,
          warnings: onSiteAnalysis?.warnings ?? 0,
          recommendations: onSiteAnalysis?.recommendations ?? 0,
          avgLoadTime: onSiteAnalysis?.avgLoadTime ?? null,
          avgWordCount: onSiteAnalysis?.avgWordCount ?? null,
          avgPerformance: onSiteAnalysis?.avgPerformance ?? null,
          issues: onSiteAnalysis?.issues ? Object.fromEntries(
            Object.entries(onSiteAnalysis.issues).filter(([, val]) => typeof val === "number" && val > 0)
          ) as Record<string, number> : {},
          sections: onSiteAnalysis?.sections ?? null,
          topIssues: Array.isArray(onSiteAnalysis?.allIssues)
            ? (onSiteAnalysis.allIssues as any[])
                .filter((i: any) => i.priority === "critical" || i.priority === "high")
                .slice(0, 25)
                .map((i: any) => ({
                  priority: i.priority,
                  section: i.section,
                  issue: i.issue,
                  action: i.action,
                }))
            : [],
          pageScoring: {
            avgScore: onSiteAnalysis?.avgPageScore ?? null,
            distribution: onSiteAnalysis?.pageScoreDistribution ?? null,
            axes: onSiteAnalysis?.pageScoreAxes ?? null,
          },
          crawledPages: (onSitePages as any[]).map((p: any) => ({
            url: p.url,
            title: p.title ?? null,
            metaDescription: p.metaDescription ?? null,
            h1: p.h1 ?? null,
            h2s: p.htags?.h2 ?? [],
            statusCode: p.statusCode,
            wordCount: p.wordCount,
            issueCount: p.issueCount,
            criticalCount: p.issues?.filter((i: any) => i.type === "critical").length ?? 0,
            warningCount: p.issues?.filter((i: any) => i.type === "warning").length ?? 0,
            onpageScore: p.onpageScore ?? null,
            loadTime: p.loadTime ?? null,
            duplicateTitle: p.duplicateTitle ?? false,
            duplicateDescription: p.duplicateDescription ?? false,
          })),
        },
        visibility: {
          currentETV: visHistory?.metrics?.etv ?? null,
          isUp: visHistory?.metrics?.is_up ?? 0,
          isDown: visHistory?.metrics?.is_down ?? 0,
        },
        linkBuilding: {
          totalProspects: prospects.length,
          activeProspects: activeProspectCount,
          identifiedProspects,
          prospects: prospects
            .filter((p: any) => p.status !== "dismissed")
            .sort((a: any, b: any) => b.prospectScore - a.prospectScore)
            .slice(0, 25)
            .map((p: any) => ({
              referringDomain: p.referringDomain,
              domainRank: p.domainRank,
              linksToCompetitors: p.linksToCompetitors,
              competitors: p.competitors,
              prospectScore: p.prospectScore,
              acquisitionDifficulty: p.acquisitionDifficulty,
              suggestedChannel: p.suggestedChannel,
              estimatedImpact: p.estimatedImpact,
              status: p.status,
              reasoning: p.reasoning ?? null,
            })),
        },
        jobs: {
          pending: allJobs.filter((j: any) => j.status === "pending").length,
          processing: allJobs.filter((j: any) => j.status === "processing").length,
          failed: allJobs.filter((j: any) => j.status === "failed").length,
          stuckCount: stuckJobs.length,
        },
        keywordMap: {
          competitorOverlap: competitorOverlap.matrix.slice(0, 30),
          cannibalization: cannibalization.slice(0, 15),
          quickWinsEnriched: quickWinsEnriched.slice(0, 20),
          serpFeatures: serpFeatures.slice(0, 10),
          clusterQuickWins: (topicClusters as any[])
            .filter((c: any) => c.avgDifficulty < 50 && c.totalSearchVolume > 0)
            .sort((a: any, b: any) => b.totalSearchVolume - a.totalSearchVolume)
            .slice(0, 10)
            .map((c: any) => ({
              topic: c.topic,
              gapCount: c.gapCount,
              totalSearchVolume: c.totalSearchVolume,
              totalEstimatedValue: c.totalEstimatedValue,
              avgDifficulty: c.avgDifficulty,
              topKeywords: c.topKeywords,
              keywords: c.keywords.slice(0, 30).map((kw: any) => ({
                phrase: kw.phrase,
                searchVolume: kw.searchVolume,
                difficulty: kw.difficulty,
                estimatedTrafficValue: kw.estimatedTrafficValue,
                competitorPosition: kw.competitorPosition ?? null,
              })),
            })),
        },
        backlinkVelocity: {
          ...backlinkVelocity,
          trend: backlinkVelocity.trend.slice(0, 14),
        },
        backlinkDistributions: {
          tldDistribution: (Array.isArray(backlinkDistributions.tldDistribution)
            ? backlinkDistributions.tldDistribution.slice(0, 15)
            : Object.entries(backlinkDistributions.tldDistribution || {}).map(([tld, count]) => ({ tld, count: count as number })).sort((a: any, b: any) => b.count - a.count).slice(0, 15)) as Array<{ tld: string; count: number }>,
          countries: (Array.isArray(backlinkDistributions.countries)
            ? backlinkDistributions.countries.slice(0, 10)
            : Object.entries(backlinkDistributions.countries || {}).map(([country, count]) => ({ country, count: count as number })).sort((a: any, b: any) => b.count - a.count).slice(0, 10)) as Array<{ country: string; count: number }>,
          linkAttributes: backlinkDistributions.linkAttributes || {},
          platformTypes: backlinkDistributions.platformTypes || {},
        },
        visibilityTrend: visibilityTrend.slice(0, 12),
        insights: {
          healthScore: insightsData.healthScore,
          healthBreakdown: insightsData.healthBreakdown,
          atRiskKeywords: insightsData.atRiskKeywords.slice(0, 10),
          risingKeywords: insightsData.risingKeywords.slice(0, 10),
          nearPage1: insightsData.nearPage1.slice(0, 10),
          recommendations: insightsData.recommendations.slice(0, 15),
        },
      };

      // Step 4 (55%, analyzing): Resolve AI configuration
      await markStep(ctx, sessionId, 4, 55, "analyzing", "Resolving AI configuration...");

      const aiConfig = await getAIConfigFromAction(ctx, domainId);
      const langName = LANGUAGE_NAMES[data.language] || data.language;

      const businessContext = {
        domain: data.domain,
        market: data.location,
        language: data.language,
        description: businessDescription,
        targetCustomer,
        focusKeywords: focusKeywords?.filter((k) => k.trim()) ?? [],
        generateBacklinkContent: generateBacklinkContent ?? false,
        generateContentMockups: generateContentMockups ?? false,
      };

      // Step 5 (55%->75%, analyzing): Phase 1 — Parallel Analysis
      await markStep(ctx, sessionId, 5, 55, "analyzing", "Analyzing keywords, links & technical data...");

      const phase1Results = await executePhase1WithRetry(aiConfig, data, langName, businessDescription, businessContext.focusKeywords);
      console.log(`[Strategy] Phase 1 complete: keyword=${JSON.stringify(phase1Results.keyword).length}chars link=${JSON.stringify(phase1Results.link).length}chars technical=${JSON.stringify(phase1Results.technical).length}chars`);

      let strategy: Record<string, any> | null = null;

      if (phase1Results.allFailed) {
        // Fallback: legacy single-shot prompt
        console.warn("[Strategy] Phase 1 all failed — falling back to legacy single-shot prompt");
        // Mark steps 6+7 as skipped
        await ctx.runMutation(internal.aiStrategy.updateSessionProgress, { sessionId, stepIndex: 6, stepStatus: "skipped" as const, progress: 75 });
        await ctx.runMutation(internal.aiStrategy.updateSessionProgress, { sessionId, stepIndex: 7, stepStatus: "skipped" as const, progress: 90 });

        const legacyPrompt = buildStrategyPromptLegacy(data, businessDescription, targetCustomer, data.language);
        const legacyResult = await callAI({
          provider: aiConfig.provider,
          model: aiConfig.model,
          messages: [{ role: "user", content: legacyPrompt }],
          maxTokens: 16000,
          temperature: 0.3,
        });
        console.log(`[Strategy] Legacy fallback: ${legacyResult.text.length} chars, stopReason: ${legacyResult.stopReason ?? "unknown"}`);
        strategy = parseStrategyJson(legacyResult.text);
        if (!strategy) {
          const preview = legacyResult.text.slice(0, 300).replace(/\n/g, " ");
          console.error(`[Strategy] Legacy fallback also failed to parse. Head: ${preview}`);
          await ctx.runMutation(internal.aiStrategy.failSession, {
            sessionId,
            error: `Failed to parse AI response — all Phase 1 analysts failed, legacy fallback also failed (${legacyResult.text.length} chars)`,
          });
          return;
        }
      } else {
        // Step 6 (75%->90%, analyzing): Phase 2 — Strategy Synthesis
        await markStep(ctx, sessionId, 6, 75, "analyzing", "Synthesizing strategy recommendations...");

        const phase2Prompt = buildPhase2SynthesisPrompt(phase1Results, businessContext, langName);
        const phase2Result = await callAI({
          provider: aiConfig.provider,
          model: aiConfig.model,
          messages: [{ role: "user", content: phase2Prompt }],
          maxTokens: 12000,
          temperature: 0.3,
        });
        console.log(`[Strategy] Phase 2: ${phase2Result.text.length} chars, stopReason: ${phase2Result.stopReason ?? "unknown"}`);

        const phase2Parsed = parseStrategyJson(phase2Result.text);

        if (!phase2Parsed) {
          // Fallback: legacy single-shot prompt
          console.warn("[Strategy] Phase 2 parse failed — falling back to legacy single-shot prompt");
          await ctx.runMutation(internal.aiStrategy.updateSessionProgress, { sessionId, stepIndex: 7, stepStatus: "skipped" as const, progress: 90 });

          const legacyPrompt = buildStrategyPromptLegacy(data, businessDescription, targetCustomer, data.language);
          const legacyResult = await callAI({
            provider: aiConfig.provider,
            model: aiConfig.model,
            messages: [{ role: "user", content: legacyPrompt }],
            maxTokens: 16000,
            temperature: 0.3,
          });
          console.log(`[Strategy] Legacy fallback (phase2 fail): ${legacyResult.text.length} chars, stopReason: ${legacyResult.stopReason ?? "unknown"}`);
          strategy = parseStrategyJson(legacyResult.text);
          if (!strategy) {
            await ctx.runMutation(internal.aiStrategy.failSession, {
              sessionId,
              error: `Phase 2 parse failed, legacy fallback also failed`,
            });
            return;
          }
        } else {
          // Step 7 (90%->95%, analyzing): Phase 3 — Action Plan & Executive Summary
          await markStep(ctx, sessionId, 7, 90, "analyzing", "Building action plan & executive summary...");

          const keyMetrics = {
            avgPosition: data.keywords.avgPosition,
            activeKeywords: data.keywords.activeCount,
            healthScore: data.onSite.healthScore,
            currentETV: data.visibility.currentETV,
            backlinkCount: data.backlinks.totalCount,
            referringDomains: data.backlinks.referringDomains,
            competitorCount: data.competitors.length,
            contentGapCount: data.contentGaps.totalCount,
          };

          const phase3Prompt = buildPhase3ActionPlanPrompt(phase2Parsed, businessContext, keyMetrics, langName);
          const phase3Result = await callAI({
            provider: aiConfig.provider,
            model: aiConfig.model,
            messages: [{ role: "user", content: phase3Prompt }],
            maxTokens: 8000,
            temperature: 0.3,
          });
          console.log(`[Strategy] Phase 3: ${phase3Result.text.length} chars, stopReason: ${phase3Result.stopReason ?? "unknown"}`);

          const phase3Parsed = parseStrategyJson(phase3Result.text);

          if (!phase3Parsed) {
            // Phase 3 failed: use Phase 2's 7 sections + empty defaults for remaining 4
            console.warn("[Strategy] Phase 3 parse failed — using Phase 2 sections with empty defaults");
            strategy = mergeStrategyResults(phase2Parsed, {});
          } else {
            strategy = mergeStrategyResults(phase2Parsed, phase3Parsed);
          }
        }
      }

      // Step 8 (95%->100%): Store Results
      await markStep(ctx, sessionId, 8, 95, "analyzing", "Storing strategy results...");

      // Inject raw backlink gap prospects into backlinkStrategy for frontend rendering
      if (strategy.backlinkStrategy && data.linkBuilding.prospects.length > 0) {
        strategy.backlinkStrategy.topProspects = data.linkBuilding.prospects.slice(0, 15).map((p) => ({
          domain: p.referringDomain,
          domainRank: p.domainRank,
          linksToCompetitors: p.linksToCompetitors,
          competitors: p.competitors,
          score: p.prospectScore,
          difficulty: p.acquisitionDifficulty,
          channel: p.suggestedChannel,
        }));
      }

      const dataSnapshot = {
        keywordCount: data.keywords.activeCount,
        discoveredCount: data.discoveredKeywords.totalCount,
        contentGapCount: data.contentGaps.totalCount,
        competitorCount: data.competitors.length,
        backlinkCount: data.backlinks.totalCount,
        healthScore: data.onSite.healthScore,
        avgPosition: data.keywords.avgPosition,
        generatedAt: Date.now(),
      };

      await ctx.runMutation(internal.aiStrategy.updateStrategy, {
        sessionId,
        dataSnapshot,
        strategy,
      });

      // Save business context to domain for auto-fill
      await ctx.runMutation(internal.domains.saveBusinessContext, {
        domainId,
        businessDescription,
        targetCustomer,
      });

      // Done (100%, completed): Mark step 8 as completed
      await ctx.runMutation(internal.aiStrategy.updateSessionProgress, {
        sessionId,
        stepIndex: 8,
        stepStatus: "completed" as const,
        progress: 100,
        status: "completed" as const,
        currentStep: "Strategy complete",
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.aiStrategy.failSession, {
        sessionId,
        error: msg,
      });
    }
  },
});

// ─── Section-Specific Drill-Down Focus ───

const SECTION_FOCUS: Record<string, { title: string; focus: string; structure: string }> = {
  executiveSummary: {
    title: "Executive Summary",
    focus: "Overall domain health, key strengths/weaknesses, strategic trajectory",
    structure: `## Domain Health Assessment
(Specific metrics: avg position, visibility, health score)

## Key Strengths
(Bullet list with data backing each strength)

## Critical Weaknesses
(Bullet list with data backing each weakness)

## Strategic Priorities
(Numbered priority list with expected impact)

## 90-Day Outlook
(Projected trajectory based on current data)`,
  },
  quickWins: {
    title: "Quick Wins",
    focus: "Detailed optimization steps for each quick-win keyword opportunity",
    structure: `## Quick Wins Overview

| Keyword | Current | Target | Difficulty | Volume | Est. Traffic Gain | Priority |
|---------|---------|--------|-----------|--------|------------------|----------|
| ... | ... | ... | ... | ... | ... | ... |

For each quick win keyword, provide:

## [Keyword] — Position X → Target Y
- **Why it's a quick win**: difficulty, search volume, current proximity
- **Optimization steps**: 3-5 specific actions (title tag, content, internal links, etc.)
- **Expected traffic gain**: estimated monthly sessions
- **Timeline**: how long to see results

> Use tables when comparing keyword metrics side by side`,
  },
  contentStrategy: {
    title: "Content Strategy",
    focus: "Content creation plan: what to write, for which keywords, in what format",
    structure: `## Content Priority Matrix

| Priority | Target Keyword | Content Type | Search Intent | Volume | Difficulty | Urgency |
|----------|---------------|-------------|--------------|--------|-----------|---------|
| 1 | ... | ... | ... | ... | ... | ... |

## Detailed Content Briefs
For each recommended piece:
- Target keyword cluster
- Search intent analysis
- Recommended format and length
- Key topics to cover
- Internal linking opportunities

## Content Calendar

| Week | Content Piece | Target Keyword | Type | Est. Impact |
|------|-------------|---------------|------|------------|
| ... | ... | ... | ... | ... |

> Use markdown tables (| col | col |) for ALL structured data`,
  },
  competitorAnalysis: {
    title: "Competitor Analysis",
    focus: "Per-competitor SWOT, keyword overlap, strategies to outperform",
    structure: `## Competitive Landscape Overview

| Competitor | Key Strength | Key Weakness | Keyword Overlap | Threat Level |
|-----------|-------------|-------------|----------------|-------------|
| ... | ... | ... | ... | HIGH/MED/LOW |

For each competitor:

## [Competitor Domain]

### SWOT Summary

| Category | Details |
|----------|---------|
| Strengths | ... |
| Weaknesses | ... |
| Threats | ... |
| Opportunities | ... |

### Keyword Overlap
| Keyword | Their Position | Our Position | Gap | Action |
|---------|---------------|-------------|-----|--------|
| ... | ... | ... | ... | ... |

### How to Outperform
(Concrete actionable tactics)`,
  },
  backlinkStrategy: {
    title: "Backlink Strategy",
    focus: "Link profile health, toxic cleanup, link building priorities and targets",
    structure: `## Current Profile Assessment

> Key metric callout: total backlinks, referring domains, dofollow ratio

| Metric | Current Value | Industry Benchmark | Gap |
|--------|--------------|-------------------|-----|
| Referring Domains | ... | ... | ... |
| Dofollow Ratio | ... | ... | ... |
| Domain Diversity | ... | ... | ... |
| Anchor Text Health | ... | ... | ... |

### Anchor Text Distribution

| Type | Current % | Recommended % | Action |
|------|----------|--------------|--------|
| Branded | ... | ... | ... |
| Exact Match | ... | ... | ... |
| Partial Match | ... | ... | ... |
| Generic | ... | ... | ... |
| URL-based | ... | ... | ... |

## Toxic Link Cleanup Plan

> Total toxic links found and urgency assessment

| Priority | Domain | Spam Score | Link Type | Action |
|----------|--------|-----------|-----------|--------|
| ... | ... | ... | ... | disavow / contact webmaster |

### Disavow Strategy
1. (specific steps with timeline)

## Link Building Priorities

| Priority | Strategy | Target DR Range | Est. Links/Month | Effort | Expected Impact |
|----------|----------|----------------|-------------------|--------|----------------|
| 1 | ... | ... | ... | ... | ... |
| 2 | ... | ... | ... | ... | ... |

### Detailed Tactics per Strategy
(expand on each row from the table above)

## Prospect Recommendations

| Prospect Type | Example Sites | Outreach Method | Success Rate | Priority |
|--------------|--------------|----------------|-------------|----------|
| ... | ... | ... | ... | ... |

### Outreach Templates Summary
(brief approach for each prospect type)

## Monthly Link Building Targets

| Month | New Links Target | New Domains Target | Focus Strategy | KPI |
|-------|-----------------|-------------------|---------------|-----|
| M1 | ... | ... | ... | ... |
| M2 | ... | ... | ... | ... |
| M3 | ... | ... | ... | ... |

> Use markdown tables (| col | col |) for ALL data comparisons. Use > for key callouts. Use ### for sub-sections.`,
  },
  technicalSEO: {
    title: "Technical SEO",
    focus: "Technical issues, fixes, page speed, crawlability, structured data",
    structure: `## Health Score Summary

> Current: X/100 → Target: Y/100

## Critical Fixes

| # | Issue | Impact | Fix | Effort | Priority |
|---|-------|--------|-----|--------|----------|
| 1 | ... | ... | ... | ... | ... |

## Warnings

| # | Issue | Pages Affected | Recommended Fix | Timeline |
|---|-------|---------------|----------------|----------|
| 1 | ... | ... | ... | ... |

## Improvement Roadmap
(Step-by-step plan to reach target health score, numbered steps with milestones)

## Monitoring Recommendations

| Metric | Current | Target | Alert Threshold | Check Frequency |
|--------|---------|--------|----------------|----------------|
| ... | ... | ... | ... | ... |`,
  },
  riskAssessment: {
    title: "Risk Assessment",
    focus: "Identified risks, probability/impact analysis, mitigation strategies",
    structure: `## Risk Matrix Overview

| Risk | Severity | Probability | Impact Score | Priority |
|------|----------|------------|-------------|----------|
| ... | HIGH/MED/LOW | HIGH/MED/LOW | 1-10 | ... |

For each risk:

## [Risk Name] — Severity: [HIGH/MEDIUM/LOW]

| Aspect | Details |
|--------|---------|
| Probability | ... and why |
| Potential Impact | ... on traffic, rankings, revenue |
| Early Warning Signs | ... what to monitor |
| Mitigation Plan | ... specific steps with timeline |
| Contingency | ... what to do if risk materializes |`,
  },
  keywordClustering: {
    title: "Keyword Clusters",
    focus: "Cluster composition, content mapping, internal linking between clusters",
    structure: `## Cluster Overview

| Cluster | Theme | Keywords | Total Volume | Avg Difficulty | Pillar Page |
|---------|-------|----------|-------------|---------------|------------|
| ... | ... | ... | ... | ... | ... |

For each cluster:

## Cluster: [Name] — Theme: [Theme]

| Keyword | Volume | Difficulty | Current Position | Content Page |
|---------|--------|-----------|-----------------|-------------|
| ... | ... | ... | ... | ... |

### Content Mapping
- **Pillar page**: (page that targets the cluster head term)
- **Supporting pages**: (specific pages for each keyword group)

### Internal Linking Plan

| From Page | To Page | Anchor Text | Purpose |
|-----------|---------|------------|---------|
| ... | ... | ... | ... |`,
  },
  roiForecast: {
    title: "ROI Forecast",
    focus: "Traffic projections, revenue modeling, investment requirements, milestones",
    structure: `## Traffic Projection

| Timeframe | Estimated Traffic | Growth % | Key Driver |
|-----------|-----------------|----------|-----------|
| Current | ... | — | — |
| 30 days | ... | +X% | ... |
| 90 days | ... | +X% | ... |

## Revenue Impact Estimate

| Source | Current Monthly | 30-Day Projected | 90-Day Projected |
|-------|----------------|-----------------|-----------------|
| Organic traffic value | ... | ... | ... |
| Conversion estimate | ... | ... | ... |

## Key Assumptions
(What the forecast depends on)

## Investment Requirements

| Resource | Monthly Cost/Effort | Expected ROI | Timeline to Impact |
|----------|-------------------|-------------|-------------------|
| ... | ... | ... | ... |

## KPIs to Track

| KPI | Current Value | 30-Day Target | 90-Day Target | Measurement |
|-----|-------------|--------------|--------------|------------|
| ... | ... | ... | ... | ... |`,
  },
  actionPlan: {
    title: "Action Plan",
    focus: "Implementation steps, resource needs, dependencies, weekly milestones",
    structure: `## Immediate Actions (This Week)
(Numbered list with owner, effort, expected outcome)

## Short-Term Actions (1-4 Weeks)
(Numbered list with owner, effort, expected outcome)

## Medium-Term Actions (1-3 Months)
(Numbered list with owner, effort, expected outcome)

## Dependencies
(Which actions must complete before others can start)

## Weekly Milestone Schedule
(Week 1: ..., Week 2: ..., etc.)`,
  },
};

// ─── Drill-Down Action ───

export const drillDownSection = action({
  args: {
    sessionId: v.id("aiStrategySessions"),
    sectionKey: v.string(),
    question: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string }> => {
    // 1. Load original session
    const session = await ctx.runQuery(internal.aiStrategy.getSessionInternal, {
      sessionId: args.sessionId,
    });
    if (!session || session.status !== "completed" || !session.strategy) {
      return { success: false, error: "Session not found or not completed" };
    }

    // 2. Resolve AI provider config from organization
    const aiConfig = await getAIConfigFromAction(ctx, session.domainId);

    // 3. Get fresh domain data for this section
    const data = await collectDomainData(ctx, session.domainId);
    if (!data) {
      return { success: false, error: "Domain not found" };
    }

    // 4. Build section-specific drill-down prompt
    const sectionData = session.strategy[args.sectionKey];
    const langName = LANGUAGE_NAMES[data.language] || data.language;
    const sectionInfo = SECTION_FOCUS[args.sectionKey];

    // Collect existing drill-downs for this section to prevent repetition
    const existingDrillDowns = (session.drillDowns ?? [])
      .filter((d: any) => d.sectionKey === args.sectionKey);
    const previousAnalyses = existingDrillDowns.length > 0
      ? `\n\n=== PREVIOUS DEEP-DIVE ANALYSES FOR THIS SECTION (DO NOT REPEAT) ===\n${existingDrillDowns.map((d: any, i: number) => `--- Previous analysis #${i + 1}${d.question ? ` (Q: ${d.question})` : ""} ---\n${d.response.slice(0, 2000)}`).join("\n\n")}`
      : "";

    // Collect summaries of other sections to avoid cross-section repetition
    const otherSections = Object.entries(session.strategy)
      .filter(([key]) => key !== args.sectionKey)
      .map(([key, value]) => {
        const summary = typeof value === "string" ? value.slice(0, 300) :
          Array.isArray(value) ? `[${value.length} items]` :
          JSON.stringify(value).slice(0, 300);
        return `${key}: ${summary}`;
      })
      .join("\n");

    const userQuestion = args.question
      ? `\n\nUSER'S SPECIFIC QUESTION: ${args.question}\nAnswer this question thoroughly, but stay within the scope of "${sectionInfo?.title ?? args.sectionKey}".`
      : "";

    const sectionFocus = sectionInfo
      ? `\n\nSECTION FOCUS: ${sectionInfo.focus}\n\nSTRUCTURE YOUR RESPONSE EXACTLY LIKE THIS:\n${sectionInfo.structure}`
      : "";

    const prompt = `You are a senior SEO strategist performing a deep-dive on the "${sectionInfo?.title ?? args.sectionKey}" section of a domain strategy.

CRITICAL RULES:
1. Generate ALL text in ${langName}
2. STAY STRICTLY within the scope of "${sectionInfo?.title ?? args.sectionKey}" — do NOT cover topics from other sections
3. Every point MUST reference specific numbers from the data
4. Use the exact structure template provided below
5. Use RICH markdown formatting:
   - ## for section headers, ### for sub-headers
   - **bold** for emphasis on key metrics and action items
   - Markdown tables (| col | col |) for ALL comparisons, metrics, and structured data — this is CRITICAL for readability
   - > blockquotes for key insights and metric callouts
   - Numbered lists for sequential steps/priorities
   - Bullet lists for non-sequential items
6. Be thorough and detailed — expand on every item from the original analysis
7. INCLUDE AT LEAST 2-3 markdown tables with specific data — tables make analysis much more actionable
8. ZERO REPETITION:
   - Do NOT restate what is already in the original analysis — EXPAND on it with NEW details, deeper reasoning, and additional data points
   - Do NOT repeat conclusions or recommendations that appear in other strategy sections (listed below)
   - If there are previous deep-dive analyses for this section, provide ADDITIONAL insights not covered before — do NOT restate them${existingDrillDowns.length > 0 ? `\n   - There are ${existingDrillDowns.length} previous analyses — you MUST provide fresh, unique content` : ""}
${sectionFocus}

=== BUSINESS CONTEXT ===
Domain: ${data.domain}
Business: ${session.businessDescription}
Target Customer: ${session.targetCustomer}

=== ORIGINAL "${sectionInfo?.title ?? args.sectionKey}" ANALYSIS (to be expanded, NOT restated) ===
${JSON.stringify(sectionData, null, 2)}

=== OTHER STRATEGY SECTIONS (already covered — do NOT repeat their content) ===
${otherSections}
${previousAnalyses}

=== RELEVANT DOMAIN DATA ===
${JSON.stringify(data, null, 2)}
${userQuestion}

Now provide the deep-dive analysis following the structure above. EXPAND with new insights — do NOT restate what is already covered in the original analysis or other sections. Be specific, data-driven, and actionable.`;

    try {
      const aiResult = await callAI({
        provider: aiConfig.provider,
        model: aiConfig.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 12000,
        temperature: 0.3,
      });

      const response = aiResult.text;

      // 5. Append to session
      await ctx.runMutation(internal.aiStrategy.appendDrillDown, {
        sessionId: args.sessionId,
        sectionKey: args.sectionKey,
        question: args.question,
        response,
      });

      return { success: true, response };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  },
});
