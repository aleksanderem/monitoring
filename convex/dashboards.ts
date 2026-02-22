import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// =============================================
// Queries
// =============================================

/** Get dashboard layouts for an org (user's own + shared defaults) */
export const getDashboardLayouts = query({
  args: {
    orgId: v.id("organizations"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const layouts = await ctx.db
      .query("dashboardLayouts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    if (args.userId) {
      // Return user's own layouts + any default layouts from others
      return layouts.filter(
        (l) => l.userId === args.userId || l.isDefault
      );
    }

    return layouts;
  },
});

/** Get saved views for an org, optionally filtered by target table */
export const getSavedViews = query({
  args: {
    orgId: v.id("organizations"),
    targetTable: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.targetTable) {
      return await ctx.db
        .query("savedViews")
        .withIndex("by_org_table", (q) =>
          q.eq("orgId", args.orgId).eq("targetTable", args.targetTable!)
        )
        .collect();
    }

    return await ctx.db
      .query("savedViews")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

/** Get the default dashboard layout for an org */
export const getDefaultLayout = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const layouts = await ctx.db
      .query("dashboardLayouts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return layouts.find((l) => l.isDefault) ?? null;
  },
});

// =============================================
// Mutations
// =============================================

/** Save (create or update) a dashboard layout */
export const saveDashboardLayout = mutation({
  args: {
    layoutId: v.optional(v.id("dashboardLayouts")),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    widgets: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // If setting as default, unset any existing defaults for this user
    if (args.isDefault) {
      const existing = await ctx.db
        .query("dashboardLayouts")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", args.userId)
        )
        .collect();

      for (const layout of existing) {
        if (layout.isDefault) {
          await ctx.db.patch(layout._id, { isDefault: false, updatedAt: now });
        }
      }
    }

    if (args.layoutId) {
      // Update existing
      await ctx.db.patch(args.layoutId, {
        name: args.name,
        widgets: args.widgets,
        isDefault: args.isDefault ?? false,
        updatedAt: now,
      });
      return args.layoutId;
    }

    // Create new
    return await ctx.db.insert("dashboardLayouts", {
      orgId: args.orgId,
      userId: args.userId,
      name: args.name,
      widgets: args.widgets,
      isDefault: args.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Delete a dashboard layout */
export const deleteDashboardLayout = mutation({
  args: { layoutId: v.id("dashboardLayouts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.layoutId);
  },
});

/** Set a layout as default for the user */
export const setDefaultLayout = mutation({
  args: {
    layoutId: v.id("dashboardLayouts"),
  },
  handler: async (ctx, args) => {
    const layout = await ctx.db.get(args.layoutId);
    if (!layout) throw new Error("Layout not found");

    const now = Date.now();

    // Unset other defaults for this user
    const existing = await ctx.db
      .query("dashboardLayouts")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", layout.orgId).eq("userId", layout.userId)
      )
      .collect();

    for (const l of existing) {
      if (l.isDefault && l._id !== args.layoutId) {
        await ctx.db.patch(l._id, { isDefault: false, updatedAt: now });
      }
    }

    await ctx.db.patch(args.layoutId, { isDefault: true, updatedAt: now });
  },
});

/** Save a view preset */
export const saveView = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    targetTable: v.string(),
    filters: v.string(),
    sortBy: v.optional(v.string()),
    sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    columns: v.array(v.string()),
    isShared: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("savedViews", {
      orgId: args.orgId,
      userId: args.userId,
      name: args.name,
      targetTable: args.targetTable,
      filters: args.filters,
      sortBy: args.sortBy,
      sortDirection: args.sortDirection,
      columns: args.columns,
      isShared: args.isShared,
      createdAt: Date.now(),
    });
  },
});

/** Delete a saved view */
export const deleteView = mutation({
  args: { viewId: v.id("savedViews") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.viewId);
  },
});

/** Apply (read) a view — returns config for client to apply */
export const applyView = query({
  args: { viewId: v.id("savedViews") },
  handler: async (ctx, args) => {
    const view = await ctx.db.get(args.viewId);
    if (!view) return null;

    return {
      name: view.name,
      targetTable: view.targetTable,
      filters: view.filters,
      sortBy: view.sortBy,
      sortDirection: view.sortDirection,
      columns: view.columns,
      isShared: view.isShared,
    };
  },
});
