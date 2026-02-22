import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { requirePermission, requireTenantAccess } from "./permissions";

// =================================================================
// Queries
// =================================================================

/**
 * List all client orgs for an agency
 */
export const getAgencyClients = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    await requireTenantAccess(ctx, "organization", args.orgId);

    const clients = await ctx.db
      .query("agencyClients")
      .withIndex("by_agency", (q) => q.eq("agencyOrgId", args.orgId))
      .collect();

    // Enrich with org details
    const enriched = await Promise.all(
      clients.map(async (client) => {
        const org = await ctx.db.get(client.clientOrgId);
        return {
          ...client,
          clientName: org?.name ?? "Unknown",
          clientSlug: org?.slug ?? "",
        };
      })
    );

    return enriched;
  },
});

/**
 * Get branding overrides for a client org
 */
export const getClientBranding = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    await requireTenantAccess(ctx, "organization", args.orgId);

    return await ctx.db
      .query("brandingOverrides")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
  },
});

/**
 * Check if org is an agency (has any client relationships)
 */
export const isAgencyOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;

    const clients = await ctx.db
      .query("agencyClients")
      .withIndex("by_agency", (q) => q.eq("agencyOrgId", args.orgId))
      .first();

    return !!clients;
  },
});

// =================================================================
// Mutations
// =================================================================

/**
 * Create new client org linked to agency
 */
export const addClientOrg = mutation({
  args: {
    agencyOrgId: v.id("organizations"),
    clientName: v.string(),
    clientDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(ctx, "org.settings.edit", {
      organizationId: args.agencyOrgId,
    });

    // Create the client organization
    const slug = args.clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const clientOrgId = await ctx.db.insert("organizations", {
      name: args.clientName,
      slug: `${slug}-${Date.now()}`,
      createdAt: Date.now(),
      settings: {
        defaultRefreshFrequency: "weekly",
      },
    });

    // Create the agency-client relationship
    await ctx.db.insert("agencyClients", {
      agencyOrgId: args.agencyOrgId,
      clientOrgId,
      status: "active",
      createdAt: Date.now(),
      addedBy: userId,
    });

    return clientOrgId;
  },
});

/**
 * Remove client relationship
 */
export const removeClientOrg = mutation({
  args: {
    agencyOrgId: v.id("organizations"),
    clientOrgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(ctx, "org.settings.edit", {
      organizationId: args.agencyOrgId,
    });

    const relationship = await ctx.db
      .query("agencyClients")
      .withIndex("by_agency", (q) => q.eq("agencyOrgId", args.agencyOrgId))
      .filter((q) => q.eq(q.field("clientOrgId"), args.clientOrgId))
      .unique();

    if (!relationship) {
      throw new Error("Client relationship not found");
    }

    await ctx.db.delete(relationship._id);
  },
});

/**
 * Update branding overrides for client
 */
export const updateBrandingOverrides = mutation({
  args: {
    orgId: v.id("organizations"),
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    companyName: v.optional(v.string()),
    customDomain: v.optional(v.string()),
    footerText: v.optional(v.string()),
    reportHeaderHtml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(ctx, "org.settings.edit", {
      organizationId: args.orgId,
    });

    const existing = await ctx.db
      .query("brandingOverrides")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();

    const { orgId, ...brandingFields } = args;

    if (existing) {
      await ctx.db.patch(existing._id, brandingFields);
      return existing._id;
    }

    return await ctx.db.insert("brandingOverrides", {
      orgId: args.orgId,
      ...brandingFields,
    });
  },
});

/**
 * Suspend client access
 */
export const suspendClient = mutation({
  args: {
    agencyOrgId: v.id("organizations"),
    clientOrgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requirePermission(ctx, "org.settings.edit", {
      organizationId: args.agencyOrgId,
    });

    const relationship = await ctx.db
      .query("agencyClients")
      .withIndex("by_agency", (q) => q.eq("agencyOrgId", args.agencyOrgId))
      .filter((q) => q.eq(q.field("clientOrgId"), args.clientOrgId))
      .unique();

    if (!relationship) {
      throw new Error("Client relationship not found");
    }

    await ctx.db.patch(relationship._id, { status: "suspended" });
  },
});
