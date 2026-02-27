"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";

// ─── Color mapping for event categories ───

// Maps to EventViewColor: gray | brand | green | blue | indigo | purple | pink | orange | yellow
const CATEGORY_COLORS: Record<string, string> = {
  position_check: "blue",
  ranking_drop: "pink",
  ranking_opportunity: "green",
  content_gap: "purple",
  content_plan: "indigo",
  competitor_alert: "orange",
  link_building: "yellow",
  seasonal_trend: "blue",
  audit_task: "pink",
  follow_up: "gray",
  custom: "brand",
};

// ─── Public action: trigger AI Strategist for a domain ───

export const runStrategist = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    // Auth: verify caller has access to this domain
    const domainAccess = await ctx.runQuery(internal.lib.analyticsHelpers.verifyDomainAccess, {
      domainId: args.domainId,
    });
    if (!domainAccess) {
      throw new Error("Not authorized");
    }

    // Schedule the background processing
    await ctx.scheduler.runAfter(
      0,
      internal.actions.aiSeoStrategist.processStrategist,
      { domainId: args.domainId }
    );
    return { success: true };
  },
});

// ─── Background processing action ───

export const processStrategist = internalAction({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const { domainId } = args;

    try {
      // 1. Collect domain data (reuse existing internal queries)
      const domain = await ctx.runQuery(
        internal.domains.getDomainInternal,
        { domainId }
      );
      if (!domain) {
        await ctx.runMutation(internal.calendarEvents.recordStrategistRun, {
          domainId,
          eventsGenerated: 0,
          status: "failed",
          error: "Domain not found",
        });
        return;
      }

      // Parallel data fetch — focused on what the strategist needs
      const [
        allKeywords,
        gapsResult,
        competitors,
        insightsData,
        existingEvents,
      ] = await Promise.all([
        ctx.runQuery(internal.domains.getMonitoredKeywordsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getContentGapsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getCompetitorsInternal, { domainId }),
        ctx.runQuery(internal.aiStrategy.getInsightsInternal, { domainId }),
        // Get recent AI-generated events to avoid duplicates
        ctx.runQuery(internal.calendarEvents.getRecentAIEvents, { domainId }),
      ]);

      const gaps = gapsResult.items;

      console.log(`[AI Strategist] Domain: ${domain.domain}, keywords: ${allKeywords.length}, gaps: ${gaps.length}`);

      // 2. Build a concise data snapshot for the AI
      const activeKws = allKeywords.filter((k: any) => k.status === "active");

      const rankingDrops = activeKws.filter((kw: any) => {
        const change = kw.positionChange;
        return change != null && change < -3; // Dropped 3+ positions
      });

      const nearTop3 = activeKws.filter((kw: any) => {
        const pos = kw.currentPosition;
        return pos != null && pos >= 4 && pos <= 10;
      });

      const quickWins = activeKws.filter((kw: any) => {
        const pos = kw.currentPosition;
        const vol = kw.searchVolume ?? 0;
        return pos != null && pos >= 11 && pos <= 20 && vol > 100;
      });

      // Also gather all keywords with known positions for general strategy
      const withPositions = activeKws.filter((kw: any) => kw.currentPosition != null);

      console.log(`[AI Strategist] drops: ${rankingDrops.length}, nearTop3: ${nearTop3.length}, quickWins: ${quickWins.length}, withPositions: ${withPositions.length}`);

      // Identify keywords with positions and data
      const existingEventPhrases = new Set(
        existingEvents
          .filter((e: any) => e.status === "scheduled" || e.status === "in_progress")
          .map((e: any) => e.keywordPhrase)
          .filter(Boolean)
      );

      // Filter out keywords that already have scheduled events
      const newDrops = rankingDrops.filter(
        (kw: any) => !existingEventPhrases.has(kw.phrase)
      );
      const newOpportunities = nearTop3.filter(
        (kw: any) => !existingEventPhrases.has(kw.phrase)
      );

      const dataSnapshot = {
        domain: domain.domain,
        totalKeywords: activeKws.length,
        avgPosition: activeKws.reduce((sum: number, kw: any) => {
          return sum + (kw.currentPosition ?? 0);
        }, 0) / (activeKws.filter((kw: any) => kw.currentPosition != null).length || 1),
        rankingDrops: newDrops.slice(0, 10).map((kw: any) => ({
          phrase: kw.phrase,
          currentPosition: kw.currentPosition,
          previousPosition: kw.previousPosition,
          drop: kw.positionChange,
          searchVolume: kw.searchVolume,
          id: kw._id,
        })),
        nearTop3Opportunities: newOpportunities.slice(0, 10).map((kw: any) => ({
          phrase: kw.phrase,
          position: kw.currentPosition,
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
          id: kw._id,
        })),
        quickWins: quickWins.slice(0, 10).map((kw: any) => ({
          phrase: kw.phrase,
          position: kw.currentPosition,
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
          id: kw._id,
        })),
        contentGaps: gaps.slice(0, 10).map((g: any) => ({
          keyword: g.keywordPhrase || g.keyword || g.phrase,
          opportunityScore: g.opportunityScore,
          searchVolume: g.searchVolume,
        })),
        // General keyword overview (top performers, worst performers)
        topKeywords: withPositions
          .sort((a: any, b: any) => (a.currentPosition ?? 100) - (b.currentPosition ?? 100))
          .slice(0, 10)
          .map((kw: any) => ({
            phrase: kw.phrase,
            position: kw.currentPosition,
            searchVolume: kw.searchVolume,
            change: kw.positionChange,
          })),
        competitorCount: competitors.length,
        insights: {
          atRisk: insightsData?.atRiskKeywords?.slice(0, 5) ?? [],
          rising: insightsData?.risingKeywords?.slice(0, 5) ?? [],
          nearPage1: insightsData?.nearPage1?.slice(0, 5) ?? [],
          recommendations: insightsData?.recommendations?.slice(0, 5) ?? [],
        },
        businessContext: domain.businessDescription || "",
        targetCustomer: domain.targetCustomer || "",
      };

      // 3. If there are zero keywords, skip AI call
      if (activeKws.length === 0) {
        console.log(`[AI Strategist] No active keywords, skipping.`);
        await ctx.runMutation(internal.calendarEvents.recordStrategistRun, {
          domainId,
          eventsGenerated: 0,
          dataSnapshot: JSON.stringify({ skipped: "no_active_keywords" }),
          status: "completed",
        });
        return;
      }

      // 4. Call AI to generate calendar events
      const aiConfig = await getAIConfigFromAction(ctx, domainId as string);

      const now = Date.now();
      const todayStr = new Date(now).toISOString().split("T")[0];

      const prompt = buildPrompt(dataSnapshot, todayStr);

      const result = await callAI({
        provider: aiConfig.provider,
        model: aiConfig.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 4000,
        temperature: 0.3,
      });

      // 5. Parse AI response
      const events = parseAIEvents(result.text, domainId as string, dataSnapshot);

      if (events.length === 0) {
        await ctx.runMutation(internal.calendarEvents.recordStrategistRun, {
          domainId,
          eventsGenerated: 0,
          dataSnapshot: JSON.stringify(dataSnapshot),
          status: "completed",
        });
        return;
      }

      // 6. Batch insert events
      await ctx.runMutation(internal.calendarEvents.batchCreateEvents, {
        events: events as any,
      });

      // 7. Record the run
      await ctx.runMutation(internal.calendarEvents.recordStrategistRun, {
        domainId,
        eventsGenerated: events.length,
        dataSnapshot: JSON.stringify({
          drops: newDrops.length,
          opportunities: newOpportunities.length,
          quickWins: quickWins.length,
          gaps: gaps.length,
        }),
        status: "completed",
      });
    } catch (error: any) {
      await ctx.runMutation(internal.calendarEvents.recordStrategistRun, {
        domainId,
        eventsGenerated: 0,
        status: "failed",
        error: error.message?.slice(0, 500),
      });
    }
  },
});

// ─── Prompt builder ───

function buildPrompt(data: any, todayStr: string): string {
  return `You are an AI SEO Strategist. Analyze the following domain data and generate calendar events for actionable SEO tasks.

TODAY'S DATE: ${todayStr}

DOMAIN: ${data.domain}
${data.businessContext ? `BUSINESS: ${data.businessContext}` : ""}
${data.targetCustomer ? `TARGET CUSTOMER: ${data.targetCustomer}` : ""}

TOTAL TRACKED KEYWORDS: ${data.totalKeywords}
AVERAGE POSITION: ${Math.round(data.avgPosition * 10) / 10}

${data.rankingDrops.length > 0 ? `
RANKING DROPS (need immediate attention):
${data.rankingDrops.map((kw: any) => `- "${kw.phrase}" dropped from #${kw.previousPosition} to #${kw.currentPosition} (Δ${kw.drop}, vol: ${kw.searchVolume ?? "?"})`).join("\n")}
` : ""}

${data.nearTop3Opportunities.length > 0 ? `
NEAR TOP-3 OPPORTUNITIES (positions 4-10, push to top 3):
${data.nearTop3Opportunities.map((kw: any) => `- "${kw.phrase}" at #${kw.position} (vol: ${kw.searchVolume ?? "?"}, diff: ${kw.difficulty ?? "?"})`).join("\n")}
` : ""}

${data.quickWins.length > 0 ? `
QUICK WINS (positions 11-20, move to page 1):
${data.quickWins.map((kw: any) => `- "${kw.phrase}" at #${kw.position} (vol: ${kw.searchVolume ?? "?"}, diff: ${kw.difficulty ?? "?"})`).join("\n")}
` : ""}

${data.contentGaps.length > 0 ? `
CONTENT GAPS (keywords competitors rank for, you don't):
${data.contentGaps.map((g: any) => `- "${g.keyword}" (opp: ${g.opportunityScore ?? "?"}, vol: ${g.searchVolume ?? "?"})`).join("\n")}
` : ""}

${data.topKeywords?.length > 0 ? `
TOP TRACKED KEYWORDS (by position):
${data.topKeywords.map((kw: any) => `- "${kw.phrase}" at #${kw.position} (vol: ${kw.searchVolume ?? "?"}, change: ${kw.change != null ? (kw.change > 0 ? "+" : "") + kw.change : "n/a"})`).join("\n")}
` : ""}

${data.insights.recommendations?.length > 0 ? `
RECOMMENDATIONS:
${data.insights.recommendations.map((r: any) => `- [${r.priority}] ${r.title}: ${r.description}`).join("\n")}
` : ""}

Generate a JSON array of calendar events. Each event should be scheduled within the next 14 days from today.
IMPORTANT: You MUST generate at least 3 events, even if data is limited. Use the top keywords to suggest optimization tasks, content improvements, link building activities, or follow-up position checks.

Rules:
- Critical ranking drops: schedule within 1-2 days
- Near top-3 opportunities: schedule within 3-5 days
- Content gap actions: schedule within 5-10 days
- Quick wins: schedule within 7-14 days
- Follow-up checks: schedule 7 days after the main task
- Maximum 15 events total
- Be specific about what action to take
- Include reasoning for each event

Response format (JSON array only, no markdown):
[
  {
    "category": "ranking_drop|ranking_opportunity|content_gap|content_plan|link_building|follow_up|audit_task",
    "title": "Short action title",
    "description": "Detailed description of what to do",
    "aiReasoning": "Why this event was created",
    "aiActionItems": ["Step 1", "Step 2", "Step 3"],
    "scheduledDate": "YYYY-MM-DD",
    "priority": "critical|high|medium|low",
    "keywordPhrase": "keyword if applicable",
    "competitorDomain": "competitor.com if applicable"
  }
]`;
}

// ─── Response parser ───

function parseAIEvents(
  aiText: string,
  domainId: string,
  dataSnapshot: any
): Array<{
  domainId: string;
  category: string;
  title: string;
  description?: string;
  aiReasoning?: string;
  aiActionItems?: string[];
  scheduledAt: number;
  scheduledEndAt?: number;
  priority: string;
  keywordPhrase?: string;
  competitorDomain?: string;
  color?: string;
}> {
  try {
    // Extract JSON from possible markdown wrapper
    let jsonStr = aiText.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const rawEvents = JSON.parse(jsonStr);
    if (!Array.isArray(rawEvents)) return [];

    // Build keyword ID lookup from snapshot data
    const keywordIdMap = new Map<string, string>();
    for (const list of [
      dataSnapshot.rankingDrops,
      dataSnapshot.nearTop3Opportunities,
      dataSnapshot.quickWins,
    ]) {
      for (const kw of list || []) {
        if (kw.phrase && kw.id) {
          keywordIdMap.set(kw.phrase.toLowerCase(), kw.id);
        }
      }
    }

    const events = [];
    for (const raw of rawEvents.slice(0, 15)) {
      // Validate required fields
      if (!raw.category || !raw.title || !raw.scheduledDate || !raw.priority) {
        continue;
      }

      // Parse date
      const dateParts = raw.scheduledDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!dateParts) continue;

      const scheduledAt = new Date(
        `${raw.scheduledDate}T09:00:00`
      ).getTime();

      if (isNaN(scheduledAt)) continue;

      // Look up keyword ID
      const keywordPhrase = raw.keywordPhrase || undefined;
      const keywordId = keywordPhrase
        ? keywordIdMap.get(keywordPhrase.toLowerCase())
        : undefined;

      events.push({
        domainId,
        category: raw.category,
        title: raw.title,
        description: raw.description || undefined,
        aiReasoning: raw.aiReasoning || undefined,
        aiActionItems: raw.aiActionItems || undefined,
        scheduledAt,
        scheduledEndAt: scheduledAt + 60 * 60 * 1000, // 1 hour default
        priority: raw.priority,
        keywordId: keywordId || undefined,
        keywordPhrase,
        competitorDomain: raw.competitorDomain || undefined,
        color: CATEGORY_COLORS[raw.category] || "sky",
      });
    }

    return events;
  } catch (e) {
    console.error("Failed to parse AI strategist response:", e);
    return [];
  }
}
