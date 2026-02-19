import { v } from "convex/values";
import { query, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { requireTenantAccess } from "./permissions";
import { getSupabaseAdmin } from "./lib/supabase";

// Get all groups for a domain
export const getGroupsByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    await requireTenantAccess(ctx, "domain", args.domainId);

    const groups = await ctx.db
      .query("keywordGroups")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Get keyword count for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const memberships = await ctx.db
          .query("keywordGroupMemberships")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        return {
          ...group,
          keywordCount: memberships.length,
        };
      })
    );

    return groupsWithCounts;
  },
});

// Get detailed stats for a specific group
export const getGroupStats = query({
  args: { groupId: v.id("keywordGroups") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return null;
    }
    await requireTenantAccess(ctx, "domain", group.domainId);

    const memberships = await ctx.db
      .query("keywordGroupMemberships")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    let totalPosition = 0;
    let positionCount = 0;
    let totalVolume = 0;

    for (const membership of memberships) {
      const keyword = await ctx.db.get(membership.keywordId);
      if (!keyword) continue;

      if (keyword.currentPosition != null) {
        totalPosition += keyword.currentPosition;
        positionCount++;
      }

      if (keyword.searchVolume) {
        totalVolume += keyword.searchVolume;
      }
    }

    const avgPosition =
      positionCount > 0 ? Math.round((totalPosition / positionCount) * 10) / 10 : null;

    return {
      ...group,
      keywordCount: memberships.length,
      avgPosition,
      totalVolume,
    };
  },
});

// Get keywords in a specific group
export const getKeywordsByGroup = query({
  args: {
    groupId: v.id("keywordGroups"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const group = await ctx.db.get(args.groupId);
    if (!group) return [];
    await requireTenantAccess(ctx, "domain", group.domainId);

    const memberships = await ctx.db
      .query("keywordGroupMemberships")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    const keywords = [];

    for (const membership of memberships) {
      const keyword = await ctx.db.get(membership.keywordId);
      if (!keyword) continue;

      keywords.push({
        ...keyword,
        currentPosition: keyword.currentPosition ?? null,
        url: keyword.currentUrl ?? null,
        searchVolume: keyword.searchVolume ?? null,
        difficulty: keyword.difficulty ?? null,
        lastUpdated: keyword.positionUpdatedAt ?? keyword._creationTime,
      });
    }

    return keywords;
  },
});

// Get groups for a specific keyword
export const getGroupsForKeyword = query({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) return [];
    await requireTenantAccess(ctx, "domain", keyword.domainId);

    const memberships = await ctx.db
      .query("keywordGroupMemberships")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .collect();

    const groups = [];
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (group) {
        groups.push(group);
      }
    }

    return groups;
  },
});

// Internal query to resolve group -> keyword IDs (used by Supabase actions)
export const _getGroupKeywordIds = internalQuery({
  args: { groupId: v.id("keywordGroups") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("keywordGroupMemberships")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    return memberships.map((m) => m.keywordId as string);
  },
});

// Internal query to get all groups for a domain (used by Supabase actions)
export const _getGroupsByDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("keywordGroups")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

// Helper: fetch group performance history from Supabase
async function fetchGroupPerformanceHistoryFromSupabase(
  sb: ReturnType<typeof getSupabaseAdmin>,
  keywordIds: string[],
  days: number
): Promise<Array<{ date: number; avgPosition: number }>> {
  if (!sb || keywordIds.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  const { data, error } = await sb
    .from("keyword_positions")
    .select("date, position")
    .in("convex_keyword_id", keywordIds)
    .gte("date", cutoffDateStr)
    .not("position", "is", null);

  if (error || !data) return [];

  // Group by date and compute averages
  const datePositionsMap = new Map<string, number[]>();
  for (const row of data) {
    if (row.position == null) continue;
    if (!datePositionsMap.has(row.date)) {
      datePositionsMap.set(row.date, []);
    }
    datePositionsMap.get(row.date)!.push(row.position);
  }

  return Array.from(datePositionsMap.entries())
    .map(([date, positions]) => ({
      date: new Date(date).getTime(),
      avgPosition:
        Math.round((positions.reduce((sum, p) => sum + p, 0) / positions.length) * 10) / 10,
    }))
    .sort((a, b) => a.date - b.date);
}

// Get average position history for a single group (Supabase action)
export const getGroupPerformanceHistory = action({
  args: {
    groupId: v.id("keywordGroups"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{ date: number; avgPosition: number }>> => {
    const keywordIds: string[] = await ctx.runQuery(
      internal.keywordGroups_queries._getGroupKeywordIds,
      { groupId: args.groupId }
    );
    if (keywordIds.length === 0) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    return fetchGroupPerformanceHistoryFromSupabase(sb, keywordIds, args.days || 30);
  },
});

// Get performance comparison across all groups (Supabase action)
export const getAllGroupsPerformance = action({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{
    groupId: string;
    name: string;
    color: string | undefined;
    history: Array<{ date: number; avgPosition: number }>;
  }>> => {
    const domain = await ctx.runQuery(
      internal.lib.analyticsHelpers.verifyDomainAccess,
      { domainId: args.domainId }
    );
    if (!domain) return [];

    const sb = getSupabaseAdmin();
    if (!sb) return [];

    const groups: Array<{ _id: string; name: string; color?: string; domainId: string }> =
      await ctx.runQuery(
        internal.keywordGroups_queries._getGroupsByDomain,
        { domainId: args.domainId }
      );

    const daysToFetch = args.days || 30;

    const groupsPerformance = await Promise.all(
      groups.map(async (group) => {
        const keywordIds: string[] = await ctx.runQuery(
          internal.keywordGroups_queries._getGroupKeywordIds,
          { groupId: group._id as any }
        );

        const history = await fetchGroupPerformanceHistoryFromSupabase(
          sb,
          keywordIds,
          daysToFetch
        );

        return {
          groupId: group._id,
          name: group.name,
          color: group.color,
          history,
        };
      })
    );

    return groupsPerformance;
  },
});
