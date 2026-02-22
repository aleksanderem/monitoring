import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ─── Daily Digest Data ──────────────────────────────────

export const getDailyDigestData = internalQuery({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const totalKeywords = keywords.length;
    const withPosition = keywords.filter((k) => k.currentPosition != null);
    const trackedWithPosition = withPosition.length;

    const avgPosition =
      trackedWithPosition > 0
        ? Math.round(
            (withPosition.reduce((sum, k) => sum + (k.currentPosition as number), 0) /
              trackedWithPosition) *
              10
          ) / 10
        : null;

    // Top 5 gainers: biggest positive positionChange
    const gainers = keywords
      .filter((k) => k.positionChange != null && (k.positionChange as number) > 0)
      .sort((a, b) => (b.positionChange as number) - (a.positionChange as number))
      .slice(0, 5)
      .map((k) => ({
        phrase: k.phrase,
        position: k.currentPosition as number,
        change: k.positionChange as number,
      }));

    // Top 5 losers: biggest negative positionChange
    const losers = keywords
      .filter((k) => k.positionChange != null && (k.positionChange as number) < 0)
      .sort((a, b) => (a.positionChange as number) - (b.positionChange as number))
      .slice(0, 5)
      .map((k) => ({
        phrase: k.phrase,
        position: k.currentPosition as number,
        change: k.positionChange as number,
      }));

    return {
      totalKeywords,
      trackedWithPosition,
      avgPosition,
      gainers,
      losers,
    };
  },
});

// ─── Weekly Report Data ─────────────────────────────────

export const getWeeklyReportData = internalQuery({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    const domainName = domain?.domain ?? "unknown";

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const totalKeywords = keywords.length;

    // Position distribution
    let top3 = 0;
    let top10 = 0;
    let top20 = 0;
    let top50 = 0;
    let improved = 0;
    let declined = 0;
    let stable = 0;

    for (const k of keywords) {
      const pos = k.currentPosition;
      if (pos != null) {
        if (pos <= 3) top3++;
        if (pos <= 10) top10++;
        if (pos <= 20) top20++;
        if (pos <= 50) top50++;
      }

      const change = k.positionChange;
      if (change != null) {
        if (change > 0) improved++;
        else if (change < 0) declined++;
        else stable++;
      }
    }

    return {
      totalKeywords,
      top3,
      top10,
      top20,
      top50,
      improved,
      declined,
      stable,
      domainName,
    };
  },
});

// ─── Active Orgs with Domains ───────────────────────────

export const getActiveOrgsWithDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();

    const results: Array<{
      org: { _id: Id<"organizations">; name: string };
      members: Array<{
        userId: Id<"users">;
        email: string;
        name: string;
        prefs: {
          dailyRankingReports?: boolean;
          positionAlerts?: boolean;
          keywordOpportunities?: boolean;
          teamInvitations?: boolean;
          systemUpdates?: boolean;
          frequency?: string;
        } | null;
      }>;
      domains: Array<{ _id: Id<"domains">; domain: string }>;
    }> = [];

    for (const org of orgs) {
      // Get teams for this org
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();

      // Collect unique members across all teams
      const memberMap = new Map<
        string,
        { userId: Id<"users">; email: string; name: string; prefs: any }
      >();

      for (const team of teams) {
        const teamMembers = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        for (const tm of teamMembers) {
          if (memberMap.has(tm.userId as string)) continue;

          const user = await ctx.db.get(tm.userId);
          if (!user) continue;

          const prefs = await ctx.db
            .query("userNotificationPreferences")
            .withIndex("by_user", (q) => q.eq("userId", tm.userId))
            .unique();

          memberMap.set(tm.userId as string, {
            userId: tm.userId,
            email: (user as any).email ?? "",
            name: (user as any).name ?? "",
            prefs: prefs
              ? {
                  dailyRankingReports: prefs.dailyRankingReports,
                  positionAlerts: prefs.positionAlerts,
                  keywordOpportunities: prefs.keywordOpportunities,
                  teamInvitations: prefs.teamInvitations,
                  systemUpdates: prefs.systemUpdates,
                  frequency: prefs.frequency,
                }
              : null,
          });
        }
      }

      // Get all domains across projects in this org's teams
      const domains: Array<{ _id: Id<"domains">; domain: string }> = [];
      for (const team of teams) {
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        for (const project of projects) {
          const projectDomains = await ctx.db
            .query("domains")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect();

          for (const d of projectDomains) {
            domains.push({ _id: d._id, domain: d.domain });
          }
        }
      }

      results.push({
        org: { _id: org._id, name: org.name },
        members: Array.from(memberMap.values()),
        domains,
      });
    }

    return results;
  },
});
