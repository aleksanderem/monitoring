import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get all groups for a domain
export const getGroupsByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
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
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      return null;
    }

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

      // Get latest position
      const latestPosition = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", membership.keywordId))
        .order("desc")
        .first();

      if (latestPosition?.position) {
        totalPosition += latestPosition.position;
        positionCount++;
      }

      if (latestPosition?.searchVolume) {
        totalVolume += latestPosition.searchVolume;
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
    const memberships = await ctx.db
      .query("keywordGroupMemberships")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    const keywords = [];

    for (const membership of memberships) {
      const keyword = await ctx.db.get(membership.keywordId);
      if (!keyword) continue;

      // Get latest position
      const latestPosition = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", membership.keywordId))
        .order("desc")
        .first();

      keywords.push({
        ...keyword,
        currentPosition: latestPosition?.position ?? null,
        url: latestPosition?.url ?? null,
        searchVolume: latestPosition?.searchVolume ?? null,
        difficulty: latestPosition?.difficulty ?? null,
        lastUpdated: latestPosition?._creationTime ?? keyword._creationTime,
      });
    }

    return keywords;
  },
});

// Get groups for a specific keyword
export const getGroupsForKeyword = query({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
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

// Get average position history for a group (for the performance chart)
// Helper function to fetch group performance history
async function fetchGroupPerformanceHistory(
  ctx: QueryCtx,
  groupId: Id<"keywordGroups">,
  days: number = 30
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  const memberships = await ctx.db
    .query("keywordGroupMemberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  // Build a map of date -> average position
  const datePositionsMap = new Map<string, number[]>();

  for (const membership of memberships) {
    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", membership.keywordId))
      .filter((q) => q.gte(q.field("date"), cutoffDateStr))
      .collect();

    for (const position of positions) {
      if (position.position === null) continue;

      if (!datePositionsMap.has(position.date)) {
        datePositionsMap.set(position.date, []);
      }
      datePositionsMap.get(position.date)!.push(position.position);
    }
  }

  // Calculate average position for each date
  const history = Array.from(datePositionsMap.entries())
    .map(([date, positions]) => ({
      date: new Date(date).getTime(),
      avgPosition:
        Math.round((positions.reduce((sum, p) => sum + p, 0) / positions.length) * 10) / 10,
    }))
    .sort((a, b) => a.date - b.date);

  return history;
}

export const getGroupPerformanceHistory = query({
  args: {
    groupId: v.id("keywordGroups"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysToFetch = args.days || 30;
    return fetchGroupPerformanceHistory(ctx, args.groupId, daysToFetch);
  },
});

// Get performance comparison across all groups
export const getAllGroupsPerformance = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const groups = await ctx.db
      .query("keywordGroups")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    const daysToFetch = args.days || 30;

    const groupsPerformance = await Promise.all(
      groups.map(async (group) => {
        const history = await fetchGroupPerformanceHistory(ctx, group._id, daysToFetch);

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
