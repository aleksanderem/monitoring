import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requirePermission, getContextFromDomain } from "./permissions";

// Create a new keyword group
export const createGroup = mutation({
  args: {
    domainId: v.id("domains"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // Check if group with this name already exists
    const existing = await ctx.db
      .query("keywordGroups")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .unique();

    if (existing) {
      throw new Error("A group with this name already exists");
    }

    const groupId = await ctx.db.insert("keywordGroups", {
      domainId: args.domainId,
      name: args.name,
      description: args.description,
      color: args.color,
      createdAt: Date.now(),
    });

    return groupId;
  },
});

// Update a keyword group
export const updateGroup = mutation({
  args: {
    groupId: v.id("keywordGroups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, group.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // If name is being updated, check for duplicates
    if (args.name && args.name !== group.name) {
      const existing = await ctx.db
        .query("keywordGroups")
        .withIndex("by_domain", (q) => q.eq("domainId", group.domainId))
        .filter((q) => q.eq(q.field("name"), args.name))
        .unique();

      if (existing) {
        throw new Error("A group with this name already exists");
      }
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.groupId, updates);
    return args.groupId;
  },
});

// Delete a keyword group
export const deleteGroup = mutation({
  args: { groupId: v.id("keywordGroups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, group.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.remove", context);

    // Delete all memberships
    const memberships = await ctx.db
      .query("keywordGroupMemberships")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete the group
    await ctx.db.delete(args.groupId);
  },
});

// Add keywords to a group
export const addKeywordsToGroup = mutation({
  args: {
    groupId: v.id("keywordGroups"),
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, group.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    const added = [];
    for (const keywordId of args.keywordIds) {
      // Check if keyword belongs to the same domain
      const keyword = await ctx.db.get(keywordId);
      if (!keyword || keyword.domainId !== group.domainId) {
        continue; // Skip keywords from different domains
      }

      // Check if already in group
      const existing = await ctx.db
        .query("keywordGroupMemberships")
        .withIndex("by_keyword_group", (q) =>
          q.eq("keywordId", keywordId).eq("groupId", args.groupId)
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("keywordGroupMemberships", {
          keywordId,
          groupId: args.groupId,
          addedAt: Date.now(),
        });
        added.push(keywordId);
      }
    }

    return { added: added.length };
  },
});

// Remove keywords from a group
export const removeKeywordsFromGroup = mutation({
  args: {
    groupId: v.id("keywordGroups"),
    keywordIds: v.array(v.id("keywords")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, group.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    let removed = 0;
    for (const keywordId of args.keywordIds) {
      const membership = await ctx.db
        .query("keywordGroupMemberships")
        .withIndex("by_keyword_group", (q) =>
          q.eq("keywordId", keywordId).eq("groupId", args.groupId)
        )
        .unique();

      if (membership) {
        await ctx.db.delete(membership._id);
        removed++;
      }
    }

    return { removed };
  },
});

// Bulk tag keywords (add tags to multiple keywords)
export const bulkTagKeywords = mutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.keywordIds.length === 0) {
      throw new Error("No keywords selected");
    }

    // Get the first keyword to check domain and permission
    const firstKeyword = await ctx.db.get(args.keywordIds[0]);
    if (!firstKeyword) {
      throw new Error("Keyword not found");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, firstKeyword.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    let updated = 0;
    for (const keywordId of args.keywordIds) {
      const keyword = await ctx.db.get(keywordId);
      if (!keyword) continue;

      // Merge new tags with existing tags, remove duplicates
      const currentTags = keyword.tags || [];
      const newTags = [...new Set([...currentTags, ...args.tags])];

      await ctx.db.patch(keywordId, {
        tags: newTags,
      });
      updated++;
    }

    return { updated };
  },
});

// Remove tag from keywords
export const removeTagFromKeywords = mutation({
  args: {
    keywordIds: v.array(v.id("keywords")),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.keywordIds.length === 0) {
      throw new Error("No keywords selected");
    }

    // Get the first keyword to check domain and permission
    const firstKeyword = await ctx.db.get(args.keywordIds[0]);
    if (!firstKeyword) {
      throw new Error("Keyword not found");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, firstKeyword.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    let updated = 0;
    for (const keywordId of args.keywordIds) {
      const keyword = await ctx.db.get(keywordId);
      if (!keyword) continue;

      const currentTags = keyword.tags || [];
      const newTags = currentTags.filter((t) => t !== args.tag);

      if (newTags.length !== currentTags.length) {
        await ctx.db.patch(keywordId, {
          tags: newTags.length > 0 ? newTags : undefined,
        });
        updated++;
      }
    }

    return { updated };
  },
});
