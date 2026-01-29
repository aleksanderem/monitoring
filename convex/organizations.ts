import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// Get organizations for current user
export const getUserOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const organizations = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId);
        return org ? { ...org, role: m.role } : null;
      })
    );

    return organizations.filter(Boolean);
  },
});

// Get single organization with membership info
export const getOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    // Check membership
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    if (!membership) {
      return null;
    }

    const org = await ctx.db.get(args.organizationId);
    return org ? { ...org, role: membership.role } : null;
  },
});

// Update organization settings
export const updateOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    settings: v.optional(
      v.object({
        defaultRefreshFrequency: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("on_demand")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin or owner
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Not authorized");
    }

    const updates: Record<string, unknown> = {};
    if (args.name) updates.name = args.name;
    if (args.settings) updates.settings = args.settings;

    await ctx.db.patch(args.organizationId, updates);
    return args.organizationId;
  },
});

// Get organization members
export const getOrganizationMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if user is a member
    const userMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    if (!userMembership) {
      return [];
    }

    // Get all members
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Get user details for each member
    const membersWithUsers = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          user: user ? { email: (user as any).email, name: (user as any).name } : null,
        };
      })
    );

    return membersWithUsers;
  },
});

// Update member role
export const updateMemberRole = mutation({
  args: {
    membershipId: v.id("organizationMembers"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the membership being updated
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    // Cannot change owner role
    if (membership.role === "owner") {
      throw new Error("Cannot change owner role");
    }

    // Check if current user is owner or admin
    const currentUserMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", membership.organizationId).eq("userId", userId)
      )
      .unique();

    if (!currentUserMembership || !["owner", "admin"].includes(currentUserMembership.role)) {
      throw new Error("Not authorized to change roles");
    }

    await ctx.db.patch(args.membershipId, { role: args.role });
    return args.membershipId;
  },
});

// Invite member to organization by email
export const inviteMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is owner or admin
    const currentUserMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    if (!currentUserMembership || !["owner", "admin"].includes(currentUserMembership.role)) {
      throw new Error("Tylko administratorzy mogą zapraszać użytkowników");
    }

    // Find user by email
    const users = await ctx.db.query("users").collect();
    const targetUser = users.find((u: any) => u.email?.toLowerCase() === args.email.toLowerCase());

    if (!targetUser) {
      throw new Error(`Nie znaleziono użytkownika z adresem email: ${args.email}`);
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", targetUser._id)
      )
      .unique();

    if (existingMembership) {
      throw new Error("Ten użytkownik jest już członkiem organizacji");
    }

    // Add membership
    const membershipId = await ctx.db.insert("organizationMembers", {
      organizationId: args.organizationId,
      userId: targetUser._id,
      role: args.role,
      joinedAt: Date.now(),
    });

    return membershipId;
  },
});

// Remove member from organization
export const removeMember = mutation({
  args: { membershipId: v.id("organizationMembers") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    // Cannot remove owner
    if (membership.role === "owner") {
      throw new Error("Cannot remove owner");
    }

    // Check if current user is owner or admin
    const currentUserMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", membership.organizationId).eq("userId", userId)
      )
      .unique();

    if (!currentUserMembership || !["owner", "admin"].includes(currentUserMembership.role)) {
      throw new Error("Not authorized to remove members");
    }

    // Also remove from all teams in this org
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
      .collect();

    for (const team of teams) {
      const teamMembership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .filter((q) => q.eq(q.field("userId"), membership.userId))
        .unique();

      if (teamMembership) {
        await ctx.db.delete(teamMembership._id);
      }
    }

    await ctx.db.delete(args.membershipId);
  },
});
