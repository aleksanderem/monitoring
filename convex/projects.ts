import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { requirePermission, getOrgFromProject } from "./permissions";

// Get projects for a team
export const getProjects = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Get domain count and keyword count for each project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const domains = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        // Count total keywords across all domains in this project
        let keywordCount = 0;
        for (const domain of domains) {
          const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
            .collect();
          keywordCount += keywords.length;
        }

        return {
          ...project,
          domainCount: domains.length,
          keywordCount,
        };
      })
    );

    return projectsWithStats;
  },
});

// Get single project
export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Get domain count and keyword count
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    let keywordCount = 0;
    for (const domain of domains) {
      const keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
        .collect();
      keywordCount += keywords.length;
    }

    return {
      ...project,
      domainCount: domains.length,
      keywordCount,
    };
  },
});

// Create a new project
export const createProject = mutation({
  args: {
    name: v.string(),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get team to access organizationId
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check permission - uses Owner/Admin/Member roles
    await requirePermission(ctx, "projects.create", {
      organizationId: team.organizationId,
    });

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      teamId: args.teamId,
      createdAt: Date.now(),
    });

    return projectId;
  },
});

// Update project
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get organization context
    const organizationId = await getOrgFromProject(ctx, args.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }

    // Check permission - Owner/Admin/Member can edit
    await requirePermission(ctx, "projects.edit", {
      organizationId,
      projectId: args.projectId,
    });

    await ctx.db.patch(args.projectId, {
      name: args.name,
    });
  },
});

// Get domains for a project
export const getDomains = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get keyword count for each domain
    const domainsWithKeywordCount = await Promise.all(
      domains.map(async (domain) => {
        const keywords = await ctx.db
          .query("keywords")
          .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
          .collect();

        return {
          ...domain,
          keywordCount: keywords.length,
        };
      })
    );

    return domainsWithKeywordCount;
  },
});

// Delete project
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get organization context
    const organizationId = await getOrgFromProject(ctx, args.projectId);
    if (!organizationId) {
      throw new Error("Project not found");
    }

    // Check permission - Only Owner/Admin can delete projects
    await requirePermission(ctx, "projects.delete", {
      organizationId,
      projectId: args.projectId,
    });

    // Delete all related data
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const domain of domains) {
      // Delete keywords
      const keywords = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain._id))
        .collect();

      for (const keyword of keywords) {
        // Delete positions
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .collect();

        for (const pos of positions) {
          await ctx.db.delete(pos._id);
        }

        await ctx.db.delete(keyword._id);
      }

      await ctx.db.delete(domain._id);
    }

    await ctx.db.delete(args.projectId);
  },
});

// Get recent projects for current user (for command palette)
export const getRecentProjects = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get user's teams
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (memberships.length === 0) {
      return [];
    }

    const teamIds = memberships.map((m) => m.teamId);

    // Get all projects from user's teams
    const allProjects: any[] = [];
    for (const teamId of teamIds) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      allProjects.push(...projects);
    }

    // Sort by creation time (most recent first) and limit
    const sortedProjects = allProjects
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit || 5);

    return sortedProjects;
  },
});

// Get recent domains for current user (for command palette)
export const getRecentDomains = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get user's teams
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (memberships.length === 0) {
      return [];
    }

    const teamIds = memberships.map((m) => m.teamId);

    // Get all projects from user's teams
    const allProjects: any[] = [];
    for (const teamId of teamIds) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      allProjects.push(...projects);
    }

    const projectIds = allProjects.map((p: any) => p._id);

    // Get all domains from these projects
    const allDomains: any[] = [];
    for (const projectId of projectIds) {
      const domains = await ctx.db
        .query("domains")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();

      // Add project reference to each domain
      const domainsWithProject = domains.map((d) => ({
        ...d,
        project: allProjects.find((p: any) => p._id === projectId),
      }));

      allDomains.push(...domainsWithProject);
    }

    // Sort by creation time (most recent first) and limit
    const sortedDomains = allDomains
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit || 5);

    return sortedDomains;
  },
});
