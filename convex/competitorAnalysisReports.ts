import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Create a new competitor analysis report for a keyword
 * Called when user selects competitors from SERP results
 */
export const createAnalysisReport = mutation({
  args: {
    domainId: v.id("domains"),
    keywordId: v.id("keywords"),
    keyword: v.string(),
    competitorPages: v.array(v.object({
      domain: v.string(),
      url: v.string(),
      position: v.number(),
    })),
    userPage: v.optional(v.object({
      url: v.string(),
      position: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // Create report record
    const reportId = await ctx.db.insert("competitorAnalysisReports", {
      domainId: args.domainId,
      keywordId: args.keywordId,
      keyword: args.keyword,
      competitorPages: args.competitorPages,
      userPage: args.userPage,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule background analysis
    await ctx.scheduler.runAfter(0, internal.competitorAnalysisReports.analyzeReportInternal, {
      reportId,
    });

    return reportId;
  },
});

/**
 * Get all reports for a domain
 */
export const getReportsForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("competitorAnalysisReports")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .collect();

    return reports;
  },
});

/**
 * Get a specific report by ID
 */
export const getReport = query({
  args: { reportId: v.id("competitorAnalysisReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

/**
 * Delete a report
 */
export const deleteReport = mutation({
  args: { reportId: v.id("competitorAnalysisReports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
  },
});

/**
 * Internal action to analyze competitors and generate recommendations
 */
export const analyzeReportInternal = internalAction({
  args: { reportId: v.id("competitorAnalysisReports") },
  handler: async (ctx, args) => {
    console.log(`[analyzeReport] Starting analysis for report ${args.reportId}`);

    // Update status to analyzing
    await ctx.runMutation(internal.competitorAnalysisReports.updateReportInternal, {
      reportId: args.reportId,
      status: "analyzing",
    });

    try {
      // Get report details
      const report = await ctx.runQuery(internal.competitorAnalysisReports.getReportInternal, {
        reportId: args.reportId,
      });

      if (!report) {
        throw new Error("Report not found");
      }

      // Analyze each competitor page using DataForSEO Instant Pages API
      const pageAnalyses = [];
      for (const compPage of report.competitorPages) {
        try {
          // Call DataForSEO to analyze the page
          const analysis = await analyzePageWithDataForSEO(compPage.url);

          // Store the analysis in competitorPageAnalysis table
          const pageAnalysisId = await ctx.runMutation(
            internal.competitorAnalysis.storeCompetitorPageAnalysis,
            {
              competitorId: undefined, // This is keyword-specific, not tied to a tracked competitor
              keywordId: report.keywordId,
              url: compPage.url,
              position: compPage.position,
              ...analysis,
            }
          );

          pageAnalyses.push({
            ...compPage,
            pageAnalysisId,
            analysis,
          });
        } catch (error) {
          console.error(`[analyzeReport] Failed to analyze ${compPage.url}:`, error);
        }
      }

      // Calculate average metrics
      const avgWordCount = pageAnalyses.length > 0
        ? pageAnalyses.reduce((sum, p) => sum + (p.analysis?.wordCount || 0), 0) / pageAnalyses.length
        : 0;
      const avgH2Count = pageAnalyses.length > 0
        ? pageAnalyses.reduce((sum, p) => sum + (p.analysis?.htags?.h2?.length || 0), 0) / pageAnalyses.length
        : 0;
      const avgImagesCount = pageAnalyses.length > 0
        ? pageAnalyses.reduce((sum, p) => sum + (p.analysis?.imagesCount || 0), 0) / pageAnalyses.length
        : 0;

      // Generate recommendations
      const recommendations = generateRecommendations({
        userPage: report.userPage,
        competitorPages: pageAnalyses,
        avgWordCount,
        avgH2Count,
        avgImagesCount,
      });

      // Update report with analysis and recommendations
      await ctx.runMutation(internal.competitorAnalysisReports.updateReportInternal, {
        reportId: args.reportId,
        status: "completed",
        competitorPages: pageAnalyses.map(p => ({
          domain: p.domain,
          url: p.url,
          position: p.position,
          pageAnalysisId: p.pageAnalysisId,
        })),
        analysis: {
          avgCompetitorWordCount: Math.round(avgWordCount),
          avgCompetitorH2Count: Math.round(avgH2Count),
          avgCompetitorImagesCount: Math.round(avgImagesCount),
        },
        recommendations,
        completedAt: Date.now(),
      });

      console.log(`[analyzeReport] Report ${args.reportId} completed`);
    } catch (error: any) {
      console.error(`[analyzeReport] Failed:`, error);

      await ctx.runMutation(internal.competitorAnalysisReports.updateReportInternal, {
        reportId: args.reportId,
        status: "failed",
        error: error.message || "Unknown error",
        completedAt: Date.now(),
      });
    }
  },
});

/**
 * Analyze a page using DataForSEO Instant Pages API
 */
async function analyzePageWithDataForSEO(url: string) {
  const username = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  const auth = btoa(`${username}:${password}`);

  const requestBody = [{
    url: url,
    enable_javascript: true,
    load_resources: true,
    enable_browser_rendering: true,
  }];

  const response = await fetch(
    "https://api.dataforseo.com/v3/on_page/instant_pages",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO API error: ${data.status_code}`);
  }

  const result = data.tasks?.[0]?.result?.[0];
  if (!result) {
    throw new Error("No analysis data returned");
  }

  return {
    title: result.meta?.title,
    metaDescription: result.meta?.description,
    h1: result.meta?.htags?.h1?.[0],
    wordCount: result.page_metrics?.plain_text_word_count || 0,
    htags: {
      h1: result.meta?.htags?.h1 || [],
      h2: result.meta?.htags?.h2 || [],
      h3: result.meta?.htags?.h3 || [],
    },
    internalLinksCount: result.page_metrics?.links_count?.internal || 0,
    externalLinksCount: result.page_metrics?.links_count?.external || 0,
    imagesCount: result.page_metrics?.images_count || 0,
    loadTime: result.page_timing?.time_to_interactive,
    pageSize: result.page_metrics?.page_size,
    onpageScore: result.onpage_score,
  };
}

/**
 * Generate actionable recommendations based on competitor analysis
 */
function generateRecommendations(params: {
  userPage: any;
  competitorPages: any[];
  avgWordCount: number;
  avgH2Count: number;
  avgImagesCount: number;
}) {
  const recommendations = [];

  // Content length recommendation
  if (!params.userPage || (params.userPage.wordCount || 0) < params.avgWordCount) {
    const wordGap = Math.round(params.avgWordCount - (params.userPage?.wordCount || 0));
    recommendations.push({
      category: "content" as const,
      priority: wordGap > 500 ? "high" as const : "medium" as const,
      title: "Increase content length",
      description: `Competitors average ${Math.round(params.avgWordCount)} words. ${wordGap > 0 ? `Add ~${wordGap} more words.` : 'Your content is shorter.'}`,
      actionSteps: [
        "Expand existing sections with more detail",
        "Add FAQ section",
        "Include case studies or examples",
        "Add related subtopics",
      ],
    });
  }

  // Heading structure recommendation
  if (!params.userPage || (params.userPage.h2Count || 0) < params.avgH2Count) {
    recommendations.push({
      category: "onpage" as const,
      priority: "medium" as const,
      title: "Improve heading structure",
      description: `Competitors use an average of ${Math.round(params.avgH2Count)} H2 headings. Add more section headings.`,
      actionSteps: [
        "Break content into clear sections with H2 tags",
        "Use descriptive, keyword-rich headings",
        "Create logical content hierarchy",
      ],
    });
  }

  // Images recommendation
  if (!params.userPage || (params.userPage.imagesCount || 0) < params.avgImagesCount) {
    recommendations.push({
      category: "content" as const,
      priority: "low" as const,
      title: "Add more images",
      description: `Competitors use an average of ${Math.round(params.avgImagesCount)} images. Visual content improves engagement.`,
      actionSteps: [
        "Add relevant images to each section",
        "Use alt text with target keywords",
        "Consider infographics or diagrams",
      ],
    });
  }

  // Backlinks recommendation (always relevant)
  recommendations.push({
    category: "backlinks" as const,
    priority: "high" as const,
    title: "Build quality backlinks",
    description: "Analyze where competitors get their backlinks and target similar sources.",
    actionSteps: [
      "Review competitor backlink sources in report",
      "Reach out to top referring domains",
      "Create linkable assets (guides, tools, infographics)",
      "Guest post on relevant sites",
    ],
  });

  return recommendations;
}

/**
 * Internal query to get report
 */
export const getReportInternal = internalQuery({
  args: { reportId: v.id("competitorAnalysisReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

/**
 * Internal mutation to update report
 */
export const updateReportInternal = internalMutation({
  args: {
    reportId: v.id("competitorAnalysisReports"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("analyzing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    competitorPages: v.optional(v.array(v.object({
      domain: v.string(),
      url: v.string(),
      position: v.number(),
      pageAnalysisId: v.optional(v.id("competitorPageAnalysis")),
    }))),
    analysis: v.optional(v.object({
      avgCompetitorWordCount: v.number(),
      avgCompetitorH2Count: v.number(),
      avgCompetitorImagesCount: v.number(),
    })),
    recommendations: v.optional(v.array(v.object({
      category: v.union(
        v.literal("content"),
        v.literal("onpage"),
        v.literal("backlinks"),
        v.literal("technical")
      ),
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
      title: v.string(),
      description: v.string(),
      actionSteps: v.optional(v.array(v.string())),
    }))),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { reportId, ...updates } = args;
    await ctx.db.patch(reportId, updates);
  },
});
