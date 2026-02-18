import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isSuperAdmin, requireSuperAdmin } from "./admin";
import { PERMISSIONS, ALL_MODULES } from "./permissions";

// ─── Queries ────────────────────────────────────────────

export const getPlans = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return [];
    return await ctx.db.query("plans").collect();
  },
});

export const getPlan = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.planId);
  },
});

export const getPlanByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

export const getDefaultPlan = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("plans")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();
  },
});

// ─── Mutations ──────────────────────────────────────────

export const createPlan = mutation({
  args: {
    name: v.string(),
    key: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    modules: v.array(v.string()),
    limits: v.object({
      maxKeywords: v.optional(v.number()),
      maxDomains: v.optional(v.number()),
      maxProjects: v.optional(v.number()),
      maxDomainsPerProject: v.optional(v.number()),
      maxKeywordsPerDomain: v.optional(v.number()),
      maxDailyRefreshes: v.optional(v.number()),
      refreshCooldownMinutes: v.optional(v.number()),
      maxKeywordsPerBulkRefresh: v.optional(v.number()),
      maxDailyApiCost: v.optional(v.number()),
    }),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    // Verify key uniqueness
    const existing = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) throw new Error("Plan z takim kluczem już istnieje");

    // If setting as default, unset other defaults
    if (args.isDefault) {
      const currentDefault = await ctx.db
        .query("plans")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();
      for (const plan of currentDefault) {
        await ctx.db.patch(plan._id, { isDefault: false });
      }
    }

    return await ctx.db.insert("plans", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("plans"),
    name: v.optional(v.string()),
    key: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    modules: v.optional(v.array(v.string())),
    limits: v.optional(v.object({
      maxKeywords: v.optional(v.number()),
      maxDomains: v.optional(v.number()),
      maxProjects: v.optional(v.number()),
      maxDomainsPerProject: v.optional(v.number()),
      maxKeywordsPerDomain: v.optional(v.number()),
      maxDailyRefreshes: v.optional(v.number()),
      refreshCooldownMinutes: v.optional(v.number()),
      maxKeywordsPerBulkRefresh: v.optional(v.number()),
      maxDailyApiCost: v.optional(v.number()),
    })),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan nie istnieje");

    if (args.key && args.key !== plan.key) {
      const existing = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", args.key))
        .unique();
      if (existing) throw new Error("Plan z takim kluczem już istnieje");
    }

    if (args.isDefault) {
      const currentDefault = await ctx.db
        .query("plans")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();
      for (const p of currentDefault) {
        if (p._id !== args.planId) {
          await ctx.db.patch(p._id, { isDefault: false });
        }
      }
    }

    const { planId, ...updates } = args;
    await ctx.db.patch(planId, updates);
    return planId;
  },
});

export const deletePlan = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan nie istnieje");

    // Check if any organizations use this plan
    const orgsUsingPlan = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("planId"), args.planId))
      .collect();

    if (orgsUsingPlan.length > 0) {
      throw new Error(`Ten plan jest używany przez ${orgsUsingPlan.length} organizacji. Najpierw zmień ich plan.`);
    }

    await ctx.db.delete(args.planId);
  },
});

export const assignPlanToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organizacja nie istnieje");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan nie istnieje");

    await ctx.db.patch(args.organizationId, {
      planId: args.planId,
      limits: plan.limits,
    });

    return args.organizationId;
  },
});

// ─── Seed Data ──────────────────────────────────────────

export const seedPlans = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    // Check if plans already exist
    const existing = await ctx.db.query("plans").first();
    if (existing) throw new Error("Plany już istnieją");

    const allPerms = Object.keys(PERMISSIONS);

    // Free plan
    const freeModules = ["positioning", "reports"];
    const freePerms = [
      "org.settings.view", "org.limits.view",
      "members.view",
      "projects.view", "projects.create", "projects.edit",
      "domains.view", "domains.create", "domains.edit",
      "keywords.view", "keywords.add", "keywords.remove", "keywords.refresh",
      "reports.view", "reports.create",
    ];

    await ctx.db.insert("plans", {
      name: "Free",
      key: "free",
      description: "Podstawowy monitoring pozycji i raporty",
      permissions: freePerms,
      modules: freeModules,
      limits: {
        maxKeywords: 50,
        maxDomains: 3,
        maxProjects: 1,
        maxDomainsPerProject: 3,
        maxKeywordsPerDomain: 50,
        maxDailyRefreshes: 5,
      },
      isDefault: true,
      createdAt: Date.now(),
    });

    // Pro plan
    const proModules = ["positioning", "backlinks", "seo_audit", "reports", "competitors", "link_building"];
    const proPerms = allPerms.filter(
      (p) => !p.startsWith("ai.") && !p.startsWith("forecasts.")
    );

    await ctx.db.insert("plans", {
      name: "Pro",
      key: "pro",
      description: "Pełny monitoring z backlinkami, audytem i konkurencją",
      permissions: proPerms,
      modules: proModules,
      limits: {
        maxKeywords: 500,
        maxDomains: 20,
        maxProjects: 10,
        maxDomainsPerProject: 10,
        maxKeywordsPerDomain: 100,
        maxDailyRefreshes: 50,
      },
      isDefault: false,
      createdAt: Date.now(),
    });

    // Enterprise plan
    await ctx.db.insert("plans", {
      name: "Enterprise",
      key: "enterprise",
      description: "Wszystkie moduły bez limitów",
      permissions: allPerms,
      modules: [...ALL_MODULES],
      limits: {},
      isDefault: false,
      createdAt: Date.now(),
    });

    return { seeded: 3 };
  },
});
