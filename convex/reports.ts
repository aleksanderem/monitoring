import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { requirePermission, getOrgFromProject, requireTenantAccess } from "./permissions";

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
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "project", args.projectId);

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

// Get existing share link for a domain
export const getShareLinkForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    await requireTenantAccess(ctx, "domain", args.domainId);

    const domain = await ctx.db.get(args.domainId);
    if (!domain) return null;

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", domain.projectId))
      .collect();

    // Find report that includes this domain
    const shareReport = reports.find(
      (r) =>
        r.settings.domainsIncluded.length === 1 &&
        r.settings.domainsIncluded[0] === args.domainId
    );

    if (!shareReport) return null;

    return {
      token: shareReport.token,
      reportId: shareReport._id,
      name: shareReport.name,
      expiresAt: shareReport.expiresAt,
      createdAt: shareReport.createdAt,
    };
  },
});

// Create a simple share link for a single domain
export const createShareLink = mutation({
  args: {
    domainId: v.id("domains"),
    name: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    const organizationId = await getOrgFromProject(ctx, domain.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }
    await requirePermission(ctx, "reports.create", {
      organizationId,
      projectId: domain.projectId,
    });

    const token = generateToken();

    const reportId = await ctx.db.insert("reports", {
      projectId: domain.projectId,
      name: args.name || `${domain.domain} — monitoring`,
      token,
      expiresAt: args.expiresAt,
      settings: {
        domainsIncluded: [args.domainId],
        showSearchVolume: true,
        showDifficulty: true,
        allowKeywordProposals: false,
      },
      createdAt: Date.now(),
    });

    return { token, reportId };
  },
});

// Public query: get report data with optional date range for position history
export const getPublicReportData = query({
  args: {
    token: v.string(),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("reports")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!report) return null;

    if (report.expiresAt && report.expiresAt < Date.now()) {
      return { expired: true as const };
    }

    const domains = await Promise.all(
      report.settings.domainsIncluded.map((id) => ctx.db.get(id))
    );

    const domainsWithData = await Promise.all(
      domains.filter(Boolean).map(async (domain) => {
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain!._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        // Batch fetch discoveredKeywords as fallback (same pattern as dashboard)
        const allDiscovered = await ctx.db
          .query("discoveredKeywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain!._id))
          .collect();
        const discoveredMap = new Map<string, typeof allDiscovered[0]>();
        for (const dk of allDiscovered) {
          discoveredMap.set(dk.keyword, dk);
        }

        // Helper: sanitize numeric values (catches NaN, undefined)
        const num = (v: number | undefined | null): number | null =>
          v != null && Number.isFinite(v) ? v : null;

        // Build keyword data with discoveredKeywords fallback
        const keywordsData = keywords.map((kw) => {
          const discovered = discoveredMap.get(kw.phrase) ?? null;

          const position = num(kw.currentPosition)
            ?? (discovered?.bestPosition && discovered.bestPosition !== 999
              ? discovered.bestPosition : null);

          let previousPosition = num(kw.previousPosition);
          if (previousPosition == null) {
            if (discovered?.previousPosition != null && discovered.previousPosition !== 999) {
              previousPosition = discovered.previousPosition;
            } else if (discovered?.previousRankAbsolute != null && discovered.previousRankAbsolute !== 999) {
              previousPosition = discovered.previousRankAbsolute;
            }
          }

          let change = num(kw.positionChange);
          if (change == null && position != null && previousPosition != null) {
            change = previousPosition - position;
          }

          return {
            _id: kw._id,
            phrase: kw.phrase,
            position,
            previousPosition,
            change,
            url: kw.currentUrl || discovered?.url || null,
            searchVolume: report.settings.showSearchVolume
              ? num(discovered?.searchVolume) ?? num(kw.searchVolume)
              : null,
            difficulty: report.settings.showDifficulty
              ? num(discovered?.difficulty) ?? num(kw.difficulty)
              : null,
            updatedAt: kw.positionUpdatedAt ?? null,
          };
        });

        // Fetch position history for chart + trackingSince in a single pass
        let trackingSince: number | null = null;
        const positionHistory: Array<{
          date: string;
          position: number;
        }> = [];

        for (const keyword of keywords) {
          const positions = await ctx.db
            .query("keywordPositions")
            .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
            .collect();

          for (const pos of positions) {
            const posTime = pos.fetchedAt ?? pos._creationTime;

            // Track earliest record
            if (trackingSince === null || posTime < trackingSince) {
              trackingSince = posTime;
            }

            // Collect for chart within date range
            if (pos.position !== null && args.from && args.to
              && posTime >= args.from && posTime <= args.to) {
              positionHistory.push({
                date: pos.date,
                position: pos.position,
              });
            }
          }
        }

        // Aggregate position history into daily averages for the chart
        const dailyMap = new Map<string, { sum: number; count: number }>();
        for (const entry of positionHistory) {
          const existing = dailyMap.get(entry.date);
          if (existing) {
            existing.sum += entry.position;
            existing.count += 1;
          } else {
            dailyMap.set(entry.date, { sum: entry.position, count: 1 });
          }
        }

        const chartData = Array.from(dailyMap.entries())
          .map(([date, { sum, count }]) => ({
            date,
            avgPosition: Math.round((sum / count) * 10) / 10,
            keywordCount: count,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return {
          _id: domain!._id,
          domain: domain!.domain,
          settings: {
            searchEngine: domain!.settings.searchEngine,
            location: domain!.settings.location,
            language: domain!.settings.language,
          },
          keywords: keywordsData,
          chartData,
          trackingSince,
        };
      })
    );

    // Traverse report → project → team → org to get branding logo
    let orgLogoUrl: string | null = null;
    const project = await ctx.db.get(report.projectId);
    if (project) {
      const team = await ctx.db.get(project.teamId);
      if (team) {
        const org = await ctx.db.get(team.organizationId);
        if (org?.branding?.logoUrl) {
          orgLogoUrl = org.branding.logoUrl;
        }
      }
    }

    return {
      name: report.name,
      createdAt: report.createdAt,
      customization: report.settings.customization,
      orgLogoUrl,
      domains: domainsWithData,
    };
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
