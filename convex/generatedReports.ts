import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { requirePermission, getOrgFromProject } from "./permissions";
import type { Id } from "./_generated/dataModel";

// Get generated reports for a project
export const getGeneratedReports = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("generatedReports")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(50);
  },
});

// Get single generated report
export const getGeneratedReport = query({
  args: { reportId: v.id("generatedReports") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.get(args.reportId);
  },
});

// Generate report (async action)
export const generateReport = action({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    reportType: v.union(
      v.literal("summary"),
      v.literal("detailed"),
      v.literal("executive")
    ),
    format: v.union(
      v.literal("pdf"),
      v.literal("csv"),
      v.literal("excel")
    ),
    dateRange: v.object({
      start: v.string(),
      end: v.string(),
    }),
    domainsIncluded: v.array(v.id("domains")),
    sendEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ reportId: Id<"generatedReports"> }> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const organizationId = await ctx.runQuery(internal.permissions.getOrgFromProjectInternal, {
      projectId: args.projectId,
    });
    if (!organizationId) {
      throw new Error("Project not found");
    }

    // Create report record
    const reportId: Id<"generatedReports"> = await ctx.runMutation(internal.generatedReports.createReportRecord, {
      projectId: args.projectId,
      name: args.name,
      reportType: args.reportType,
      format: args.format,
      dateRange: args.dateRange,
      domainsIncluded: args.domainsIncluded,
      createdBy: userId,
    });

    // Start async report generation
    await ctx.scheduler.runAfter(0, internal.generatedReports.processReportGeneration, {
      reportId,
      sendEmail: args.sendEmail ?? false,
    });

    return { reportId };
  },
});

// Internal mutation to create report record
export const createReportRecord = internalMutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    reportType: v.union(
      v.literal("summary"),
      v.literal("detailed"),
      v.literal("executive")
    ),
    format: v.union(
      v.literal("pdf"),
      v.literal("csv"),
      v.literal("excel")
    ),
    dateRange: v.object({
      start: v.string(),
      end: v.string(),
    }),
    domainsIncluded: v.array(v.id("domains")),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedReports", {
      projectId: args.projectId,
      name: args.name,
      reportType: args.reportType,
      format: args.format,
      dateRange: args.dateRange,
      domainsIncluded: args.domainsIncluded,
      status: "generating",
      progress: 0,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

// Internal action to process report generation
export const processReportGeneration = internalAction({
  args: {
    reportId: v.id("generatedReports"),
    sendEmail: v.boolean(),
  },
  handler: async (ctx, args) => {
    try {
      // Update progress: 10%
      await ctx.runMutation(internal.generatedReports.updateReportProgress, {
        reportId: args.reportId,
        progress: 10,
      });

      // Get report details
      const report = await ctx.runQuery(internal.generatedReports.getReportInternal, {
        reportId: args.reportId,
      });

      if (!report) {
        throw new Error("Report not found");
      }

      // Fetch domains data
      await ctx.runMutation(internal.generatedReports.updateReportProgress, {
        reportId: args.reportId,
        progress: 30,
      });

      const domains = await Promise.all(
        report.domainsIncluded.map((domainId: Id<"domains">) =>
          ctx.runQuery(internal.generatedReports.getDomainDataInternal, { domainId })
        )
      );

      // Fetch keywords and positions for each domain
      await ctx.runMutation(internal.generatedReports.updateReportProgress, {
        reportId: args.reportId,
        progress: 50,
      });

      // Generate report content based on type
      await ctx.runMutation(internal.generatedReports.updateReportProgress, {
        reportId: args.reportId,
        progress: 70,
      });

      // In a real implementation, this would:
      // 1. Generate PDF/CSV/Excel file
      // 2. Upload to file storage (S3, Cloudflare R2, etc.)
      // 3. Get public URL
      // For MVP, we'll simulate with a data URL
      const fileUrl = `data:text/plain;base64,${Buffer.from(
        `Generated Report: ${report.name}\nType: ${report.reportType}\nFormat: ${report.format}\nDomains: ${domains.length}\nDate Range: ${report.dateRange.start} to ${report.dateRange.end}`
      ).toString("base64")}`;

      const fileSize = 1024 * 50; // 50KB placeholder

      // Update report as ready
      await ctx.runMutation(internal.generatedReports.updateReportProgress, {
        reportId: args.reportId,
        progress: 90,
      });

      await ctx.runMutation(internal.generatedReports.completeReport, {
        reportId: args.reportId,
        fileUrl,
        fileSize,
      });

      // Send email notification if requested
      if (args.sendEmail) {
        await ctx.runMutation(internal.generatedReports.updateReportProgress, {
          reportId: args.reportId,
          progress: 95,
        });

        // Stub: In real implementation, send email via notification system
        await ctx.runMutation(internal.generatedReports.markEmailSent, {
          reportId: args.reportId,
        });
      }

      await ctx.runMutation(internal.generatedReports.updateReportProgress, {
        reportId: args.reportId,
        progress: 100,
      });
    } catch (error) {
      console.error("Report generation failed:", error);
      await ctx.runMutation(internal.generatedReports.failReport, {
        reportId: args.reportId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

// Internal mutations for updating report status
export const updateReportProgress = internalMutation({
  args: {
    reportId: v.id("generatedReports"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      progress: args.progress,
    });
  },
});

export const completeReport = internalMutation({
  args: {
    reportId: v.id("generatedReports"),
    fileUrl: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "ready",
      progress: 100,
      fileUrl: args.fileUrl,
      fileSize: args.fileSize,
      completedAt: Date.now(),
    });
  },
});

export const failReport = internalMutation({
  args: {
    reportId: v.id("generatedReports"),
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

export const markEmailSent = internalMutation({
  args: {
    reportId: v.id("generatedReports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      emailSent: true,
    });
  },
});

// Internal queries
export const getReportInternal = internalQuery({
  args: { reportId: v.id("generatedReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

export const getDomainDataInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return null;

    // Get keywords for this domain
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return {
      ...domain,
      keywordCount: keywords.length,
    };
  },
});

// Delete generated report
export const deleteGeneratedReport = mutation({
  args: { reportId: v.id("generatedReports") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    // Check permission
    const organizationId = await getOrgFromProject(ctx, report.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }
    await requirePermission(ctx, "reports.edit", {
      organizationId,
      projectId: report.projectId,
    });

    await ctx.db.delete(args.reportId);
  },
});
