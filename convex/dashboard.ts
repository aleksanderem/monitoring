import { query } from "./_generated/server";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";

// Get dashboard statistics for the current user's organization
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get user's first organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      return {
        totalKeywords: 0,
        avgPosition: null,
        positionChanges: 0,
        domainsCount: 0,
        projectsCount: 0,
        hasProjects: false,
        hasDomains: false,
        hasKeywords: false,
      };
    }

    // Get all teams in the organization
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
      .collect();

    // Get all projects in those teams
    let allProjects: any[] = [];
    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      allProjects = [...allProjects, ...projects];
    }

    // Get all domains in those projects
    let allDomains: any[] = [];
    for (const project of allProjects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      allDomains = [...allDomains, ...domains];
    }

    // Get all keywords in those domains
    let allKeywords: any[] = [];
    for (const domain of allDomains) {
      const keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      allKeywords = [...allKeywords, ...keywords];
    }

    // Get latest positions and calculate stats
    let totalPositions = 0;
    let positionCount = 0;
    let positionChanges = 0;

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    for (const keyword of allKeywords) {
      // Get latest two positions
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(2);

      if (positions.length > 0 && positions[0].position !== null) {
        totalPositions += positions[0].position;
        positionCount++;

        // Check for position change in last 7 days
        if (positions.length > 1 && positions[1].position !== null) {
          const change = positions[1].position - positions[0].position;
          if (change !== 0 && positions[0].date >= sevenDaysAgoStr) {
            positionChanges++;
          }
        }
      }
    }

    const avgPosition = positionCount > 0 ? totalPositions / positionCount : null;

    return {
      totalKeywords: allKeywords.length,
      avgPosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
      positionChanges,
      domainsCount: allDomains.length,
      projectsCount: allProjects.length,
      hasProjects: allProjects.length > 0,
      hasDomains: allDomains.length > 0,
      hasKeywords: allKeywords.length > 0,
    };
  },
});

// Get position distribution for histogram chart
export const getPositionDistribution = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      return [];
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
      .collect();

    let allProjects: any[] = [];
    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      allProjects = [...allProjects, ...projects];
    }

    let allDomains: any[] = [];
    for (const project of allProjects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      allDomains = [...allDomains, ...domains];
    }

    let allKeywords: any[] = [];
    for (const domain of allDomains) {
      const keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      allKeywords = [...allKeywords, ...keywords];
    }

    // Count keywords in each position bucket
    const buckets = {
      "1-3": 0,
      "4-10": 0,
      "11-20": 0,
      "21-50": 0,
      "51-100": 0,
      "100+": 0,
    };

    for (const keyword of allKeywords) {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(1);

      if (positions.length > 0 && positions[0].position !== null) {
        const pos = positions[0].position;
        if (pos >= 1 && pos <= 3) buckets["1-3"]++;
        else if (pos >= 4 && pos <= 10) buckets["4-10"]++;
        else if (pos >= 11 && pos <= 20) buckets["11-20"]++;
        else if (pos >= 21 && pos <= 50) buckets["21-50"]++;
        else if (pos >= 51 && pos <= 100) buckets["51-100"]++;
        else if (pos > 100) buckets["100+"]++;
      }
    }

    return [
      { range: "1-3", count: buckets["1-3"] },
      { range: "4-10", count: buckets["4-10"] },
      { range: "11-20", count: buckets["11-20"] },
      { range: "21-50", count: buckets["21-50"] },
      { range: "51-100", count: buckets["51-100"] },
      { range: "100+", count: buckets["100+"] },
    ];
  },
});

// Get recent position changes (top gainers and losers)
export const getRecentChanges = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return { gainers: [], losers: [] };
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      return { gainers: [], losers: [] };
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
      .collect();

    let allProjects: any[] = [];
    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      allProjects = [...allProjects, ...projects];
    }

    let allDomains: any[] = [];
    for (const project of allProjects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      allDomains = [...allDomains, ...domains];
    }

    type KeywordChange = {
      keyword: string;
      domain: string;
      oldPosition: number;
      newPosition: number;
      change: number;
      domainId: Id<"domains">;
    };

    const changes: KeywordChange[] = [];

    for (const domain of allDomains) {
      const keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      for (const keyword of keywords) {
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .order("desc")
          .take(2);

        if (positions.length >= 2 && positions[0].position !== null && positions[1].position !== null) {
          const change = positions[1].position - positions[0].position; // Positive = improvement (lower position number)
          if (change !== 0) {
            changes.push({
              keyword: keyword.phrase,
              domain: domain.domain,
              oldPosition: positions[1].position,
              newPosition: positions[0].position,
              change,
              domainId: domain._id,
            });
          }
        }
      }
    }

    // Sort by absolute change
    changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    // Top 10 gainers (positive change = moved up in rankings)
    const gainers = changes.filter((c) => c.change > 0).slice(0, 10);
    // Top 10 losers (negative change = moved down in rankings)
    const losers = changes.filter((c) => c.change < 0).slice(0, 10);

    return { gainers, losers };
  },
});

// Get recent activity feed
export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      return [];
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
      .collect();

    let allProjects: any[] = [];
    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      allProjects = [...allProjects, ...projects];
    }

    type ActivityItem = {
      type: "keyword_added" | "domain_checked" | "position_change";
      message: string;
      timestamp: number;
      keywordId?: Id<"keywords">;
      domainId?: Id<"domains">;
    };

    const activities: ActivityItem[] = [];

    // Get recently added keywords
    for (const project of allProjects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      for (const domain of domains) {
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
          .order("desc")
          .take(20);

        for (const keyword of keywords) {
          activities.push({
            type: "keyword_added",
            message: `Added keyword "${keyword.phrase}" to ${domain.domain}`,
            timestamp: keyword._creationTime,
            keywordId: keyword._id,
            domainId: domain._id,
          });
        }
      }
    }

    // Get recent position changes
    const recentChanges = await ctx.db
      .query("keywordPositions")
      .order("desc")
      .take(50);

    for (const positionRecord of recentChanges) {
      const keyword = await ctx.db.get(positionRecord.keywordId);
      if (!keyword) continue;

      const domain = await ctx.db.get(keyword.domainId);
      if (!domain) continue;

      // Check if this domain belongs to user's organization
      const project = await ctx.db.get(domain.projectId);
      if (!project) continue;

      const team = await ctx.db.get(project.teamId);
      if (!team || team.organizationId !== membership.organizationId) continue;

      // Get previous position to detect changes
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(2);

      if (positions.length >= 2 && positions[0].position !== null && positions[1].position !== null) {
        const change = positions[1].position - positions[0].position;
        if (change !== 0) {
          activities.push({
            type: "position_change",
            message: `"${keyword.phrase}" ${change > 0 ? "improved" : "dropped"} ${Math.abs(change)} positions on ${domain.domain}`,
            timestamp: positionRecord._creationTime,
            keywordId: keyword._id,
            domainId: domain._id,
          });
        }
      }
    }

    // Sort by timestamp descending and take top 20
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, 20);
  },
});
