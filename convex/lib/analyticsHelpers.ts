import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { auth } from "../auth";
import type { Id } from "../_generated/dataModel";

/**
 * Get all domain IDs the current user has access to.
 * Used by analytics actions to scope Supabase queries by tenant.
 */
export const getUserDomainIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return [];

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", membership.organizationId)
      )
      .collect();

    const domainIds: string[] = [];
    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      for (const project of projects) {
        const domains = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        domainIds.push(...domains.map((d) => d._id));
      }
    }

    return domainIds;
  },
});

/**
 * Get domain IDs with their domain names (for labeling in analytics).
 */
export const getUserDomainsWithNames = internalQuery({
  args: {},
  handler: async (
    ctx
  ): Promise<Array<{ id: string; domain: string }>> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return [];

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", membership.organizationId)
      )
      .collect();

    const result: Array<{ id: string; domain: string }> = [];
    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      for (const project of projects) {
        const domains = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        result.push(...domains.map((d) => ({ id: d._id, domain: d.domain })));
      }
    }

    return result;
  },
});

/**
 * Verify the current user has access to a specific domain.
 * Returns the domain doc if authorized, null otherwise.
 */
export const verifyDomainAccess = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const domain = await ctx.db.get(args.domainId);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership || membership.organizationId !== team.organizationId) {
      return null;
    }

    return domain;
  },
});

/**
 * Verify the current user has access to a specific keyword.
 * Returns the keyword doc if authorized, null otherwise.
 */
export const verifyKeywordAccess = internalQuery({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return null;

    const domain = await ctx.db.get(keyword.domainId);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership || membership.organizationId !== team.organizationId) {
      return null;
    }

    return keyword;
  },
});

/**
 * Get all active keywords for a domain (for actions that need keyword list).
 */
export const getDomainKeywordIds = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args): Promise<string[]> => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    return keywords.map((k) => k._id);
  },
});
