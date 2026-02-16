import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

export const STRATEGY_STEPS = [
  { name: "Loading domain data" },                            // 0
  { name: "Collecting keyword, competitor & extended data" },  // 1
  { name: "Analyzing competitors & keyword map" },             // 2
  { name: "Processing collected data" },                       // 3
  { name: "Resolving AI configuration" },                      // 4
  { name: "Analyzing keywords, links & technical data" },      // 5
  { name: "Synthesizing strategy recommendations" },           // 6
  { name: "Building action plan & executive summary" },        // 7
  { name: "Storing strategy results" },                        // 8
];

export const getHistory = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiStrategySessions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(10);
  },
});

export const getLatest = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiStrategySessions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

export const createSession = internalMutation({
  args: {
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
    focusKeywords: v.optional(v.array(v.string())),
    generateBacklinkContent: v.optional(v.boolean()),
    generateContentMockups: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiStrategySessions", {
      domainId: args.domainId,
      businessDescription: args.businessDescription,
      targetCustomer: args.targetCustomer,
      focusKeywords: args.focusKeywords,
      generateBacklinkContent: args.generateBacklinkContent,
      generateContentMockups: args.generateContentMockups,
      dataSnapshot: null,
      strategy: null,
      drillDowns: [],
      status: "initializing",
      progress: 0,
      currentStep: "Initializing...",
      steps: STRATEGY_STEPS.map((s) => ({
        name: s.name,
        status: "pending" as const,
      })),
      createdAt: Date.now(),
    });
  },
});

export const updateSessionProgress = internalMutation({
  args: {
    sessionId: v.id("aiStrategySessions"),
    progress: v.number(),
    currentStep: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("initializing"),
      v.literal("collecting"),
      v.literal("analyzing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    stepIndex: v.optional(v.number()),
    stepStatus: v.optional(v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("skipped"), v.literal("failed"))),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    const patch: Record<string, unknown> = {
      progress: args.progress,
    };

    if (args.currentStep !== undefined) patch.currentStep = args.currentStep;
    if (args.status !== undefined) patch.status = args.status;

    if (args.stepIndex !== undefined && args.stepStatus !== undefined && session.steps) {
      const steps = [...session.steps];
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

    await ctx.db.patch(args.sessionId, patch);
  },
});

export const updateStrategy = internalMutation({
  args: {
    sessionId: v.id("aiStrategySessions"),
    dataSnapshot: v.any(),
    strategy: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      dataSnapshot: args.dataSnapshot,
      strategy: args.strategy,
      status: "completed",
      completedAt: Date.now(),
    });
  },
});

export const failSession = internalMutation({
  args: {
    sessionId: v.id("aiStrategySessions"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    const patch: Record<string, unknown> = {
      status: "failed",
      error: args.error,
    };

    // Mark the currently running step as failed
    if (session?.steps) {
      const steps = [...session.steps];
      const runningIdx = steps.findIndex((s) => s.status === "running");
      if (runningIdx !== -1) {
        steps[runningIdx] = {
          ...steps[runningIdx],
          status: "failed",
          completedAt: Date.now(),
        };
        patch.steps = steps;
      }
    }

    await ctx.db.patch(args.sessionId, patch);
  },
});

export const appendDrillDown = internalMutation({
  args: {
    sessionId: v.id("aiStrategySessions"),
    sectionKey: v.string(),
    question: v.optional(v.string()),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const drillDowns = [...session.drillDowns, {
      sectionKey: args.sectionKey,
      question: args.question,
      response: args.response,
      createdAt: Date.now(),
    }];

    await ctx.db.patch(args.sessionId, { drillDowns });
  },
});

export const deleteSession = mutation({
  args: { id: v.id("aiStrategySessions") },
  handler: async (ctx, args) => {
    // If this session is the active strategy for its domain, clear the reference
    const session = await ctx.db.get(args.id);
    if (session) {
      const domain = await ctx.db.get(session.domainId);
      if (domain?.activeStrategyId === args.id) {
        await ctx.db.patch(session.domainId, { activeStrategyId: undefined });
      }
    }
    await ctx.db.delete(args.id);
  },
});

export const getActiveStrategy = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain?.activeStrategyId) return null;
    return await ctx.db.get(domain.activeStrategyId);
  },
});

export const setActiveStrategy = mutation({
  args: {
    domainId: v.id("domains"),
    sessionId: v.optional(v.id("aiStrategySessions")),
  },
  handler: async (ctx, args) => {
    if (!args.sessionId) {
      // Clear active strategy
      await ctx.db.patch(args.domainId, { activeStrategyId: undefined });
      return;
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.domainId !== args.domainId) throw new Error("Session does not belong to this domain");
    if (session.status !== "completed") throw new Error("Only completed strategies can be activated");

    // Initialize taskStatuses from action plan if not already set
    const patches: Record<string, any> = {};
    if (!session.taskStatuses && session.strategy?.actionPlan) {
      patches.taskStatuses = (session.strategy.actionPlan as any[]).map((_: any, i: number) => ({
        index: i,
        completed: false,
      }));
    }
    // Initialize stepStatuses from actionable steps if not already set
    if (!session.stepStatuses && session.strategy?.actionableSteps) {
      patches.stepStatuses = (session.strategy.actionableSteps as any[]).map((_: any, i: number) => ({
        index: i,
        completed: false,
      }));
    }
    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(args.sessionId, patches);
    }

    await ctx.db.patch(args.domainId, { activeStrategyId: args.sessionId });
  },
});

export const updateTaskStatus = mutation({
  args: {
    sessionId: v.id("aiStrategySessions"),
    taskIndex: v.number(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const taskStatuses = [...(session.taskStatuses ?? [])];
    const existing = taskStatuses.find((t) => t.index === args.taskIndex);
    if (existing) {
      existing.completed = args.completed;
      existing.completedAt = args.completed ? Date.now() : undefined;
    } else {
      taskStatuses.push({
        index: args.taskIndex,
        completed: args.completed,
        completedAt: args.completed ? Date.now() : undefined,
      });
    }

    await ctx.db.patch(args.sessionId, { taskStatuses });
  },
});

export const updateStepStatus = mutation({
  args: {
    sessionId: v.id("aiStrategySessions"),
    stepIndex: v.number(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const stepStatuses = [...(session.stepStatuses ?? [])];
    const existing = stepStatuses.find((s) => s.index === args.stepIndex);
    if (existing) {
      existing.completed = args.completed;
      existing.completedAt = args.completed ? Date.now() : undefined;
    } else {
      stepStatuses.push({
        index: args.stepIndex,
        completed: args.completed,
        completedAt: args.completed ? Date.now() : undefined,
      });
    }

    await ctx.db.patch(args.sessionId, { stepStatuses });
  },
});

// ─── Org AI settings resolver (used by aiProvider) ───

export const getOrgAISettingsForDomain = internalQuery({
  args: { domainId: v.string() },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId as any);
    if (!domain) return null;
    const project = await ctx.db.get((domain as any).projectId);
    if (!project) return null;
    const team = await ctx.db.get((project as any).teamId);
    if (!team) return null;
    const org = await ctx.db.get((team as any).organizationId);
    return (org as any)?.aiSettings ?? null;
  },
});

// ─── Internal queries (used by the action) ───

export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("aiStrategySessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getContentGapsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Only fetch top 50 gaps by score — strategy only needs top opportunities
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_score", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(50);

    // Count total and status distribution via streaming (no collect)
    let totalCount = 0;
    let identifiedCount = 0;
    for await (const g of ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
    ) {
      totalCount++;
      if (g.status === "identified") identifiedCount++;
    }

    // Resolve keyword phrases using targeted gets (deduplicated)
    const uniqueKeywordIds = [...new Set(gaps.map((g) => g.keywordId))];
    const keywordDocs = await Promise.all(
      uniqueKeywordIds.map((id) => ctx.db.get(id))
    );
    const keywordMap = new Map(
      uniqueKeywordIds.map((id, i) => [id, keywordDocs[i]])
    );

    const items = gaps.map((gap) => ({
      ...gap,
      keywordPhrase: keywordMap.get(gap.keywordId)?.phrase ?? null,
    }));

    return { items, totalCount, identifiedCount };
  },
});

export const getCompetitorsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getCompetitorPositionsInternal = internalQuery({
  args: { competitorId: v.id("competitors") },
  handler: async (ctx, args) => {
    // Only count unique keyword coverage — don't collect all position records
    const keywordIds = new Set<string>();
    for await (const p of ctx.db
      .query("competitorKeywordPositions")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
    ) {
      keywordIds.add(String(p.keywordId));
    }
    return { coveredKeywords: keywordIds.size };
  },
});

export const getBacklinksInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Cap at 2000 — strategy only needs aggregate stats (dofollow ratio, toxic count)
    return await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .take(2000);
  },
});

export const getBacklinkSummaryInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .unique();
  },
});

export const getVisibilityHistoryInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

export const getOnSiteAnalysisInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
  },
});

export const getOnSitePagesInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Get all crawled pages for the domain — used by strategy to provide real per-page data
    return await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getLinkBuildingProspectsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("linkBuildingProspects")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getCheckJobsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywordCheckJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getSerpJobsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywordSerpJobs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

// ─── Quick-win score helper ───

function calcQuickWinScore(position: number, searchVolume: number | null, difficulty: number | null): number {
  if (!searchVolume || position > 30 || position <= 3) return 0;
  const positionFactor = position >= 11 && position <= 20 ? 1.5 : 1.0;
  const difficultyBonus = difficulty !== null ? (100 - difficulty) / 100 : 0.5;
  return Math.round(searchVolume * difficultyBonus * positionFactor / position);
}

// ─── Extended internal queries (used by AI strategy action) ───

export const getCompetitorOverlapInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const competitorDomains = competitors.map((c) =>
      c.competitorDomain.toLowerCase().replace(/^www\./, "")
    );

    if (competitorDomains.length === 0) {
      return { competitors: [], matrix: [] };
    }

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const matrix: Array<{
      keyword: string;
      yourPosition: number | null;
      competitors: Array<{ domain: string; position: number | null }>;
    }> = [];

    for (const keyword of keywords.slice(0, 50)) {
      const serpResults = await ctx.db
        .query("keywordSerpResults")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(100);

      if (serpResults.length === 0) continue;

      const latestDate = serpResults[0].date;
      const latestResults = serpResults.filter((r) => r.date === latestDate);

      const yourResult = latestResults.find((r) => r.isYourDomain);
      const yourPosition = yourResult?.position ?? null;

      const competitorPositions = competitorDomains.map((compDomain) => {
        const compResult = latestResults.find((r) => {
          const resultDomain = (r.mainDomain || r.domain || "").toLowerCase().replace(/^www\./, "");
          return resultDomain === compDomain || resultDomain.endsWith("." + compDomain);
        });
        return {
          domain: compDomain,
          position: compResult?.position ?? null,
        };
      });

      matrix.push({
        keyword: keyword.phrase,
        yourPosition,
        competitors: competitorPositions,
      });
    }

    return { competitors: competitorDomains, matrix };
  },
});

export const getCannibalizationInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const urlKeywordMap: Record<string, Array<{ keyword: string; position: number }>> = {};

    for (const keyword of keywords) {
      const serpResults = await ctx.db
        .query("keywordSerpResults")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(100);

      if (serpResults.length === 0) continue;

      const latestDate = serpResults[0].date;
      const yourResults = serpResults.filter((r) => r.date === latestDate && r.isYourDomain);

      for (const result of yourResults) {
        const normalizedUrl = result.url.replace(/\/$/, "").toLowerCase();
        if (!urlKeywordMap[normalizedUrl]) {
          urlKeywordMap[normalizedUrl] = [];
        }
        urlKeywordMap[normalizedUrl].push({
          keyword: keyword.phrase,
          position: result.position,
        });
      }
    }

    const cannibalization = Object.entries(urlKeywordMap)
      .filter(([, kws]) => kws.length > 1)
      .map(([url, kws]) => ({
        url,
        keywordCount: kws.length,
        keywords: kws.sort((a, b) => a.position - b.position),
        avgPosition: Math.round((kws.reduce((sum, k) => sum + k.position, 0) / kws.length) * 10) / 10,
      }))
      .sort((a, b) => b.keywordCount - a.keywordCount);

    return cannibalization;
  },
});

export const getQuickWinsEnrichedInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const quickWins = discoveredKeywords
      .filter((dk) => {
        const pos = dk.bestPosition;
        const vol = dk.searchVolume ?? 0;
        const diff = dk.difficulty ?? 100;
        return pos > 3 && pos <= 30 && vol >= 100 && diff < 50;
      })
      .map((dk) => {
        const quickWinScore = calcQuickWinScore(dk.bestPosition, dk.searchVolume ?? null, dk.difficulty ?? null);
        return {
          keyword: dk.keyword,
          position: dk.bestPosition,
          searchVolume: dk.searchVolume ?? 0,
          difficulty: dk.difficulty ?? 0,
          cpc: dk.cpc ?? null,
          etv: dk.etv ?? null,
          intent: dk.intent ?? null,
          serpFeatures: dk.serpFeatures ?? [],
          referringDomains: (dk.backlinksInfo as any)?.referringDomains ?? null,
          mainDomainRank: dk.mainDomainRank ?? null,
          url: dk.url ?? null,
          quickWinScore,
        };
      })
      .sort((a, b) => b.quickWinScore - a.quickWinScore);

    return quickWins;
  },
});

export const getSerpFeaturesInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const featureMap: Record<string, {
      count: number;
      positionSum: number;
      keywords: Array<{ keyword: string; position: number; searchVolume: number; difficulty: number }>;
    }> = {};

    for (const dk of discoveredKeywords) {
      if (!dk.serpFeatures || dk.serpFeatures.length === 0) continue;
      if (dk.bestPosition === 999) continue; // only ranked keywords
      for (const feature of dk.serpFeatures) {
        if (!featureMap[feature]) {
          featureMap[feature] = { count: 0, positionSum: 0, keywords: [] };
        }
        featureMap[feature].count++;
        featureMap[feature].positionSum += dk.bestPosition;
        if (featureMap[feature].keywords.length < 10) {
          featureMap[feature].keywords.push({
            keyword: dk.keyword,
            position: dk.bestPosition,
            searchVolume: dk.searchVolume ?? 0,
            difficulty: dk.difficulty ?? 0,
          });
        }
      }
    }

    const features = Object.entries(featureMap)
      .map(([name, data]) => ({
        feature: name,
        count: data.count,
        avgPosition: data.count > 0 ? Math.round((data.positionSum / data.count) * 10) / 10 : 0,
        exampleKeywords: data.keywords.map((k) => k.keyword),
        keywordsWithData: data.keywords.sort((a, b) => a.position - b.position),
      }))
      .sort((a, b) => b.count - a.count);

    return features;
  },
});

export const getBacklinkVelocityInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("backlinkVelocityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString().split("T")[0];
    const recent = entries.filter((e) => e.date >= thirtyDaysAgo);

    let totalNew = 0;
    let totalLost = 0;
    for (const e of recent) {
      totalNew += e.newBacklinks;
      totalLost += e.lostBacklinks;
    }

    const days = recent.length || 1;
    const avgNewPerDay = Math.round((totalNew / days) * 100) / 100;
    const avgLostPerDay = Math.round((totalLost / days) * 100) / 100;
    const netChange = totalNew - totalLost;

    const trend = recent
      .map((e) => ({ date: e.date, newCount: e.newBacklinks, lostCount: e.lostBacklinks }))
      .sort((a, b) => (b.date > a.date ? 1 : -1));

    return { avgNewPerDay, avgLostPerDay, netChange, trend };
  },
});

export const getBacklinkDistributionsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("domainBacklinksDistributions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    if (!record) {
      return { tldDistribution: {}, countries: {}, linkAttributes: {}, platformTypes: {} };
    }

    return {
      tldDistribution: record.tldDistribution ?? {},
      countries: record.countries ?? {},
      linkAttributes: record.linkAttributes ?? {},
      platformTypes: record.platformTypes ?? {},
    };
  },
});

export const getVisibilityTrendInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("domainVisibilityHistory")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(12);

    return entries.map((entry) => ({
      date: entry.date,
      etv: entry.metrics.etv ?? null,
      keywordsUp: entry.metrics.is_up ?? 0,
      keywordsDown: entry.metrics.is_down ?? 0,
      totalKeywords: entry.metrics.count ?? 0,
    }));
  },
});

export const getInsightsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // ── Health Score ──
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const activeKeywords = keywords.filter((k) => k.status === "active");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Keyword score (0-30)
    let keywordScore = 0;
    let avgPosition = 0;
    let keywordsWithPosition = 0;
    let improving = 0;
    let declining = 0;

    for (const kw of activeKeywords.slice(0, 100)) {
      const currentPos = kw.currentPosition;
      if (currentPos != null) {
        keywordsWithPosition++;
        avgPosition += currentPos;

        const recent = kw.recentPositions ?? [];
        const oldEntry = recent.find((p) => p.date <= sevenDaysAgo);
        if (oldEntry?.position != null) {
          const diff = oldEntry.position - currentPos;
          if (diff > 1) improving++;
          else if (diff < -1) declining++;
        }
      }
    }

    if (keywordsWithPosition > 0) {
      avgPosition = avgPosition / keywordsWithPosition;
      keywordScore = Math.min(30, Math.round(30 * Math.max(0, 1 - avgPosition / 100)));
      if (improving > declining) keywordScore = Math.min(30, keywordScore + 3);
      if (declining > improving * 2) keywordScore = Math.max(0, keywordScore - 5);
    }

    // Backlink score (0-30)
    const backlinkSummary = await ctx.db
      .query("domainBacklinksSummary")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    let backlinkScore = 0;
    if (backlinkSummary) {
      const referringDomains = backlinkSummary.totalDomains ?? 0;
      const totalBacklinks = backlinkSummary.totalBacklinks ?? 0;
      backlinkScore += Math.min(15, Math.round(referringDomains / 10));
      const ratio = totalBacklinks > 0 ? referringDomains / totalBacklinks : 0;
      backlinkScore += ratio > 0.3 ? 10 : ratio > 0.1 ? 5 : 2;
      backlinkScore = Math.min(30, backlinkScore);
    }

    // On-site score (0-20)
    const latestAnalysis = await ctx.db
      .query("domainOnsiteAnalysis")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();

    let onsiteScore = 10;
    if (latestAnalysis?.healthScore != null) {
      onsiteScore = Math.round((latestAnalysis.healthScore / 100) * 20);
    }

    // Content score (0-20)
    const contentGaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const totalGaps = contentGaps.filter((g) => g.status !== "dismissed").length;
    let contentScore = 20;
    if (totalGaps > 100) contentScore = 5;
    else if (totalGaps > 50) contentScore = 10;
    else if (totalGaps > 20) contentScore = 15;

    const healthScore = keywordScore + backlinkScore + onsiteScore + contentScore;

    // ── Keyword Insights ──
    const atRiskKeywords: Array<{ phrase: string; position: number; drop: number }> = [];
    const risingKeywords: Array<{ phrase: string; position: number; gain: number }> = [];
    const nearPage1: Array<{ phrase: string; position: number; searchVolume: number }> = [];

    for (const kw of activeKeywords) {
      const currentPos = kw.currentPosition;
      if (currentPos == null) continue;

      if (currentPos >= 11 && currentPos <= 20) {
        nearPage1.push({
          phrase: kw.phrase,
          position: currentPos,
          searchVolume: kw.searchVolume ?? 0,
        });
      }

      const recent = kw.recentPositions ?? [];
      const oldEntry = recent.find((p) => p.date <= sevenDaysAgo);
      if (!oldEntry?.position) continue;

      const diff = oldEntry.position - currentPos;

      if (diff < -5) {
        atRiskKeywords.push({
          phrase: kw.phrase,
          position: currentPos,
          drop: Math.abs(diff),
        });
      }

      if (diff > 5) {
        risingKeywords.push({
          phrase: kw.phrase,
          position: currentPos,
          gain: diff,
        });
      }
    }

    atRiskKeywords.sort((a, b) => b.drop - a.drop);
    risingKeywords.sort((a, b) => b.gain - a.gain);
    nearPage1.sort((a, b) => a.position - b.position);

    // ── Recommendations ──
    const recommendations: Array<{
      category: string;
      priority: string;
      title: string;
      description: string;
    }> = [];

    // Dropping keywords
    const droppingCount = atRiskKeywords.length;
    if (droppingCount > 5) {
      recommendations.push({
        category: "keywords",
        priority: "high",
        title: "Significant ranking drops",
        description: `${droppingCount} keywords dropped more than 5 positions in 7 days`,
      });
    } else if (droppingCount > 0) {
      recommendations.push({
        category: "keywords",
        priority: "medium",
        title: "Some rankings declining",
        description: `${droppingCount} keywords declined more than 5 positions in 7 days`,
      });
    }

    // Near page 1
    if (nearPage1.length > 0) {
      recommendations.push({
        category: "keywords",
        priority: "medium",
        title: "Keywords near page 1",
        description: `${nearPage1.length} keywords are at positions 11-20 and could reach page 1 with targeted effort`,
      });
    }

    // Toxic backlinks
    const backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .take(2000);

    const toxicCount = backlinks.filter((bl) => (bl.backlink_spam_score ?? 0) >= 70).length;
    if (toxicCount > 10) {
      recommendations.push({
        category: "backlinks",
        priority: "high",
        title: "Toxic backlinks detected",
        description: `${toxicCount} backlinks have spam score >= 70`,
      });
    } else if (toxicCount > 0) {
      recommendations.push({
        category: "backlinks",
        priority: "low",
        title: "Minor toxic backlinks",
        description: `${toxicCount} backlinks have elevated spam scores`,
      });
    }

    // Link building prospects
    const prospects = await ctx.db
      .query("linkBuildingProspects")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const identifiedProspects = prospects.filter((p) => p.status === "identified").length;
    if (identifiedProspects > 0) {
      recommendations.push({
        category: "backlinks",
        priority: "medium",
        title: "Link building opportunities available",
        description: `${identifiedProspects} link building prospects identified from competitor analysis`,
      });
    }

    // On-site health
    if (latestAnalysis) {
      if (latestAnalysis.healthScore != null && latestAnalysis.healthScore < 70) {
        recommendations.push({
          category: "onsite",
          priority: "high",
          title: "Low on-page health score",
          description: `On-site health score is ${latestAnalysis.healthScore}/100 — technical improvements needed`,
        });
      }
    } else {
      recommendations.push({
        category: "onsite",
        priority: "medium",
        title: "No on-site scan available",
        description: "Run an on-site audit to identify technical SEO issues",
      });
    }

    // Content gaps
    const highPriorityGaps = contentGaps.filter((g) => {
      if (g.status !== "identified") return false;
      const score = g.opportunityScore;
      return score != null && !isNaN(score) && score >= 70;
    }).length;

    if (highPriorityGaps > 10) {
      recommendations.push({
        category: "content",
        priority: "high",
        title: "High-priority content gaps",
        description: `${highPriorityGaps} high-priority content opportunities identified from competitor analysis`,
      });
    } else if (highPriorityGaps > 0) {
      recommendations.push({
        category: "content",
        priority: "medium",
        title: "Content opportunities available",
        description: `${highPriorityGaps} content gap opportunities identified`,
      });
    }

    if (contentGaps.length === 0) {
      recommendations.push({
        category: "content",
        priority: "low",
        title: "No content gap analysis",
        description: "Run a content gap analysis to discover keyword opportunities your competitors rank for",
      });
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

    return {
      healthScore: activeKeywords.length > 0 ? healthScore : null,
      healthBreakdown: activeKeywords.length > 0
        ? { keywords: keywordScore, backlinks: backlinkScore, onsite: onsiteScore, content: contentScore }
        : null,
      atRiskKeywords,
      risingKeywords,
      nearPage1,
      recommendations,
    };
  },
});

// ─── Topic Clusters (content gaps grouped by semantic similarity) ───

function safeNum(val: number | null | undefined, fallback: number): number {
  if (val == null || isNaN(val) || !isFinite(val)) return fallback;
  return val;
}

function derivePriority(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const getTopicClustersInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    // Top 2000 gaps by score
    const gaps = await ctx.db
      .query("contentGaps")
      .withIndex("by_score", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .take(2000);

    const activeGaps = gaps.filter((g) => g.status !== "dismissed");

    // Targeted keyword loading
    const uniqueKeywordIds = [...new Set(activeGaps.map((g) => g.keywordId))];
    const keywordDocs = await Promise.all(
      uniqueKeywordIds.map((id) => ctx.db.get(id))
    );
    const keywordMap = new Map(
      uniqueKeywordIds.map((id, i) => [id, keywordDocs[i]])
    );

    const gapsWithKeywords = activeGaps.map((gap) => ({
      ...gap,
      phrase: keywordMap.get(gap.keywordId)?.phrase ?? "",
    }));

    // Cluster by first meaningful word
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to",
      "for", "of", "with", "by", "from", "as", "is", "was", "are",
      "were", "been", "be", "have", "has", "had", "do", "does", "did",
    ]);

    const clusters = new Map<string, typeof gapsWithKeywords>();

    for (const gap of gapsWithKeywords) {
      const words = gap.phrase
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

      if (words.length > 0) {
        const clusterKey = words[0];
        const existing = clusters.get(clusterKey) || [];
        clusters.set(clusterKey, [...existing, gap]);
      }
    }

    const clusterArray = Array.from(clusters.entries()).map(
      ([topic, clusterGaps]) => {
        const totalScore = clusterGaps.reduce(
          (sum, g) => sum + safeNum(g.opportunityScore, 0), 0
        );
        const totalValue = clusterGaps.reduce(
          (sum, g) => sum + safeNum(g.estimatedTrafficValue, 0), 0
        );
        const avgScore = clusterGaps.length > 0 ? totalScore / clusterGaps.length : 0;

        const sorted = [...clusterGaps].sort((a, b) =>
          safeNum(b.opportunityScore, 0) - safeNum(a.opportunityScore, 0)
        );
        const topKeywords = sorted.slice(0, 3).map((g) => g.phrase);

        // All keywords with full details
        const keywords = sorted.map((g) => ({
          phrase: g.phrase,
          searchVolume: safeNum(g.searchVolume, 0),
          opportunityScore: safeNum(g.opportunityScore, 0),
          difficulty: safeNum(g.difficulty, 0),
          estimatedTrafficValue: safeNum(g.estimatedTrafficValue, 0),
          competitorPosition: g.competitorPosition ?? null,
          priority: derivePriority(safeNum(g.opportunityScore, 0)),
          status: g.status,
        }));

        const totalSearchVolume = clusterGaps.reduce(
          (sum, g) => sum + safeNum(g.searchVolume, 0), 0
        );
        const avgDifficulty = clusterGaps.length > 0
          ? clusterGaps.reduce((sum, g) => sum + safeNum(g.difficulty, 0), 0) / clusterGaps.length
          : 0;

        return {
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          gapCount: clusterGaps.length,
          totalOpportunityScore: Math.round(totalScore),
          avgOpportunityScore: Math.round(avgScore),
          totalEstimatedValue: Math.round(totalValue),
          totalSearchVolume,
          avgDifficulty: Math.round(avgDifficulty),
          topKeywords,
          keywords,
        };
      }
    );

    clusterArray.sort((a, b) => b.totalOpportunityScore - a.totalOpportunityScore);

    return clusterArray;
  },
});
