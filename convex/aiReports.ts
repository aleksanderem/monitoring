import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";

// =================================================================
// Queries
// =================================================================

export const getReportSessions = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    return await ctx.db
      .query("aiReportSessions")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .collect();
  },
});

export const getReportSession = query({
  args: { sessionId: v.id("aiReportSessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await requireTenantAccess(ctx, "domain", session.domainId);
    return session;
  },
});

// Internal query for actions
export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("aiReportSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

// =================================================================
// Mutations
// =================================================================

export const createReportSession = mutation({
  args: {
    domainId: v.id("domains"),
    reportType: v.string(),
    config: v.object({
      dateRange: v.object({ start: v.number(), end: v.number() }),
      sections: v.array(v.string()),
      audience: v.optional(v.string()),
      language: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const organizationId = await requireTenantAccess(ctx, "domain", args.domainId);

    const sessionId = await ctx.db.insert("aiReportSessions", {
      domainId: args.domainId,
      organizationId,
      createdBy: userId,
      reportType: args.reportType,
      config: args.config,
      status: "initializing",
      progress: 0,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.actions.aiReportGeneration.generateReport,
      { sessionId }
    );

    return sessionId;
  },
});

export const cancelReportSession = mutation({
  args: { sessionId: v.id("aiReportSessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await requireTenantAccess(ctx, "domain", session.domainId);

    await ctx.db.patch(args.sessionId, {
      status: "failed",
      error: "Cancelled by user",
    });
  },
});

// =================================================================
// Internal Mutations
// =================================================================

export const updateSessionProgress = internalMutation({
  args: {
    sessionId: v.id("aiReportSessions"),
    status: v.string(),
    progress: v.number(),
    currentStep: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      progress: args.progress,
    };
    if (args.currentStep !== undefined) {
      patch.currentStep = args.currentStep;
    }
    if (args.data) {
      if (args.data.collectedData) patch.collectedData = args.data.collectedData;
      if (args.data.analysisResults) patch.analysisResults = args.data.analysisResults;
      if (args.data.synthesisResult) patch.synthesisResult = args.data.synthesisResult;
    }
    await ctx.db.patch(args.sessionId, patch);
  },
});

export const completeSession = internalMutation({
  args: {
    sessionId: v.id("aiReportSessions"),
    generatedReportId: v.optional(v.id("generatedReports")),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: "completed",
      progress: 100,
      completedAt: Date.now(),
    };
    if (args.generatedReportId) {
      patch.generatedReportId = args.generatedReportId;
    }
    await ctx.db.patch(args.sessionId, patch);
  },
});

export const failSession = internalMutation({
  args: {
    sessionId: v.id("aiReportSessions"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "failed",
      error: args.error,
    });
  },
});

export const processScheduledReports = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Placeholder for scheduled report processing
    // Will be implemented when report scheduling UI is added
  },
});
