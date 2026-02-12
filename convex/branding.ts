import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { auth } from "./auth";
import type { Id } from "./_generated/dataModel";

// Helper: resolve the user's organization ID and verify admin/owner role
async function getOrgForCurrentUser(ctx: MutationCtx): Promise<{ userId: Id<"users">; organizationId: Id<"organizations"> }> {
  const userId = await auth.getUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!membership) throw new Error("No organization membership found");

  if (!["owner", "admin"].includes(membership.role)) {
    throw new Error("Only organization owners and admins can manage branding");
  }

  return { userId, organizationId: membership.organizationId };
}

// Get organization branding for current user
export const getOrganizationBranding = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) return null;

    const org = await ctx.db.get(membership.organizationId);
    if (!org) return null;

    return {
      organizationId: org._id,
      organizationName: org.name,
      branding: org.branding ?? null,
    };
  },
});

// Generate a signed upload URL for logo file
export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getOrgForCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Save uploaded logo to organization branding
export const saveOrganizationLogo = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const { organizationId } = await getOrgForCurrentUser(ctx);

    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error("Organization not found");

    // Delete old logo from storage if replacing
    const oldStorageId = org.branding?.logoStorageId;
    if (oldStorageId) {
      try {
        await ctx.storage.delete(oldStorageId as any);
      } catch {
        // Old file may already be gone
      }
    }

    const logoUrl = await ctx.storage.getUrl(args.storageId as any);

    await ctx.db.patch(organizationId, {
      branding: {
        logoStorageId: args.storageId,
        logoUrl: logoUrl ?? undefined,
      },
    });

    return { logoUrl };
  },
});

// Remove organization logo
export const removeOrganizationLogo = mutation({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await getOrgForCurrentUser(ctx);

    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error("Organization not found");

    const storageId = org.branding?.logoStorageId;
    if (storageId) {
      try {
        await ctx.storage.delete(storageId as any);
      } catch {
        // File may already be gone
      }
    }

    await ctx.db.patch(organizationId, {
      branding: undefined,
    });
  },
});
