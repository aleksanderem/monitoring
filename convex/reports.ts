import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { requirePermission, getOrgFromProject } from "./permissions";

// Generate random token
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Get reports for a project
export const getReports = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Get report by token (public access)
export const getReportByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("reports")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!report) {
      return null;
    }

    // Check expiration
    if (report.expiresAt && report.expiresAt < Date.now()) {
      return { expired: true };
    }

    // Get domains included in report
    const domains = await Promise.all(
      report.settings.domainsIncluded.map((id) => ctx.db.get(id))
    );

    // Get keywords for each domain
    const domainsWithKeywords = await Promise.all(
      domains.filter(Boolean).map(async (domain) => {
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain!._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        // Get latest position for each keyword
        const keywordsWithPositions = await Promise.all(
          keywords.map(async (keyword) => {
            const positions = await ctx.db
              .query("keywordPositions")
              .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
              .order("desc")
              .take(2);

            const current = positions[0];
            const previous = positions[1];

            return {
              _id: keyword._id,
              phrase: keyword.phrase,
              position: current?.position ?? null,
              url: current?.url ?? null,
              searchVolume: report.settings.showSearchVolume
                ? current?.searchVolume
                : undefined,
              difficulty: report.settings.showDifficulty
                ? current?.difficulty
                : undefined,
              change:
                current?.position && previous?.position
                  ? previous.position - current.position
                  : null,
              lastUpdated: current?.fetchedAt,
            };
          })
        );

        return {
          ...domain,
          keywords: keywordsWithPositions,
        };
      })
    );

    return {
      ...report,
      domains: domainsWithKeywords,
    };
  },
});

// Create report
export const createReport = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    expiresAt: v.optional(v.number()),
    template: v.optional(v.union(
      v.literal("executive-summary"),
      v.literal("detailed-keyword"),
      v.literal("competitor-analysis"),
      v.literal("progress-report")
    )),
    settings: v.object({
      domainsIncluded: v.array(v.id("domains")),
      showSearchVolume: v.boolean(),
      showDifficulty: v.boolean(),
      allowKeywordProposals: v.boolean(),
      updateFrequency: v.optional(v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("manual")
      )),
      lastAutoUpdate: v.optional(v.number()),
      customization: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        brandColor: v.optional(v.string()),
        introText: v.optional(v.string()),
      })),
      sections: v.optional(v.object({
        showCoverPage: v.optional(v.boolean()),
        showExecutiveSummary: v.optional(v.boolean()),
        showPositionChanges: v.optional(v.boolean()),
        showKeywordPerformance: v.optional(v.boolean()),
        showTopGainersLosers: v.optional(v.boolean()),
        showSerpVisibility: v.optional(v.boolean()),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const organizationId = await getOrgFromProject(ctx, args.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }
    await requirePermission(ctx, "reports.create", {
      organizationId,
      projectId: args.projectId,
    });

    const token = generateToken();

    return await ctx.db.insert("reports", {
      projectId: args.projectId,
      name: args.name,
      token,
      expiresAt: args.expiresAt,
      template: args.template,
      settings: args.settings,
      createdAt: Date.now(),
    });
  },
});

// Update report
export const updateReport = mutation({
  args: {
    reportId: v.id("reports"),
    name: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    template: v.optional(v.union(
      v.literal("executive-summary"),
      v.literal("detailed-keyword"),
      v.literal("competitor-analysis"),
      v.literal("progress-report")
    )),
    settings: v.optional(
      v.object({
        domainsIncluded: v.array(v.id("domains")),
        showSearchVolume: v.boolean(),
        showDifficulty: v.boolean(),
        allowKeywordProposals: v.boolean(),
        updateFrequency: v.optional(v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly"),
          v.literal("manual")
        )),
        lastAutoUpdate: v.optional(v.number()),
        customization: v.optional(v.object({
          logoUrl: v.optional(v.string()),
          brandColor: v.optional(v.string()),
          introText: v.optional(v.string()),
        })),
        sections: v.optional(v.object({
          showCoverPage: v.optional(v.boolean()),
          showExecutiveSummary: v.optional(v.boolean()),
          showPositionChanges: v.optional(v.boolean()),
          showKeywordPerformance: v.optional(v.boolean()),
          showTopGainersLosers: v.optional(v.boolean()),
          showSerpVisibility: v.optional(v.boolean()),
        })),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get report to access projectId
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

    const updates: Record<string, unknown> = {};
    if (args.name) updates.name = args.name;
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;
    if (args.template) updates.template = args.template;
    if (args.settings) updates.settings = args.settings;

    await ctx.db.patch(args.reportId, updates);
    return args.reportId;
  },
});

// Delete report
export const deleteReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get report to access projectId
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    // Check permission - Viewer cannot delete
    const organizationId = await getOrgFromProject(ctx, report.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }
    await requirePermission(ctx, "reports.edit", {
      organizationId,
      projectId: report.projectId,
    });

    // Delete related data
    const proposals = await ctx.db
      .query("keywordProposals")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    for (const p of proposals) {
      await ctx.db.delete(p._id);
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    for (const m of messages) {
      await ctx.db.delete(m._id);
    }

    const accesses = await ctx.db
      .query("clientReportAccess")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    for (const a of accesses) {
      await ctx.db.delete(a._id);
    }

    await ctx.db.delete(args.reportId);
  },
});

// Regenerate token
export const regenerateToken = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get report to access projectId
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    // Check permission - requires reports.share permission
    const organizationId = await getOrgFromProject(ctx, report.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }
    await requirePermission(ctx, "reports.share", {
      organizationId,
      projectId: report.projectId,
    });

    const newToken = generateToken();
    await ctx.db.patch(args.reportId, { token: newToken });
    return newToken;
  },
});
