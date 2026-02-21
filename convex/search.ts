import { query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const searchAll = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { domains: [], keywords: [], projects: [] };

    const searchTerm = args.query.toLowerCase();
    const limit = args.limit ?? 5;

    if (!searchTerm.trim()) {
      return { domains: [], keywords: [], projects: [] };
    }

    // Get user's accessible organizations via membership
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const orgIds = memberships.map((m) => m.organizationId);

    // Get teams for those organizations
    const allTeams = [];
    for (const orgId of orgIds) {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
      allTeams.push(...teams);
    }

    // Get projects for those teams
    const allProjects = [];
    for (const team of allTeams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      allProjects.push(...projects);
    }

    const matchedProjects = allProjects
      .filter((p) => p.name?.toLowerCase().includes(searchTerm))
      .slice(0, limit)
      .map((p) => ({
        id: p._id,
        name: p.name,
        type: "project" as const,
      }));

    // Get domains for those projects
    const allDomains = [];
    for (const project of allProjects) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      allDomains.push(
        ...domains.map((d) => ({ ...d, projectName: project.name }))
      );
    }

    const matchedDomains = allDomains
      .filter(
        (d) =>
          d.domain?.toLowerCase().includes(searchTerm) ||
          d.projectName?.toLowerCase().includes(searchTerm)
      )
      .slice(0, limit)
      .map((d) => ({
        id: d._id,
        name: d.domain,
        projectName: d.projectName,
        projectId: d.projectId,
        type: "domain" as const,
      }));

    // Search keywords across first 10 domains for performance
    const allKeywords = [];
    for (const domain of allDomains.slice(0, 10)) {
      const keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
        .collect();
      allKeywords.push(
        ...keywords.map((k) => ({
          ...k,
          domainName: domain.domain,
        }))
      );
    }

    const matchedKeywords = allKeywords
      .filter((k) => k.phrase?.toLowerCase().includes(searchTerm))
      .slice(0, limit)
      .map((k) => ({
        id: k._id,
        phrase: k.phrase,
        domainName: k.domainName,
        domainId: k.domainId,
        type: "keyword" as const,
      }));

    return {
      domains: matchedDomains,
      keywords: matchedKeywords,
      projects: matchedProjects,
    };
  },
});
