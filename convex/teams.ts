import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// Get teams for an organization
export const getTeams = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check org membership
    const orgMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .unique();

    if (!orgMembership) {
      return [];
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Get membership status, project count, and role for each team
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        const membership = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        const projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        const isMember = membership.some((m) => m.userId === userId);

        // Sort by joinedAt to determine owner (first member)
        const sortedMembers = [...membership].sort((a, b) => a.joinedAt - b.joinedAt);
        const isOwner = sortedMembers.length > 0 && sortedMembers[0].userId === userId;

        return {
          ...team,
          isMember,
          memberCount: membership.length,
          projectCount: projects.length,
          isOwner,
          userRole: isOwner ? "owner" : isMember ? "member" : null,
        };
      })
    );

    return teamsWithDetails;
  },
});

// Create team
export const createTeam = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
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

    if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
      throw new Error("Not authorized to create teams");
    }

    const teamId = await ctx.db.insert("teams", {
      organizationId: args.organizationId,
      name: args.name,
      createdAt: Date.now(),
    });

    // Add creator to team as owner
    await ctx.db.insert("teamMembers", {
      teamId: teamId,
      userId: userId,
      role: "owner",
      joinedAt: Date.now(),
    });

    return teamId;
  },
});

// Get team members
export const getTeamMembers = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? {
          ...user,
          joinedAt: m.joinedAt,
          lastActiveAt: m.lastActiveAt,
          role: m.role,
          membershipId: m._id
        } : null;
      })
    );

    return members.filter(Boolean);
  },
});

// Add member to team
export const addTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.optional(v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    )),
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), args.userId)
        )
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      userId: args.userId,
      role: args.role || "member",
      joinedAt: Date.now(),
    });
  },
});

// Update team
export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is a member of the team (only members can edit)
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const isMember = membership.some((m) => m.userId === userId);
    if (!isMember) {
      throw new Error("Not authorized to edit this team");
    }

    await ctx.db.patch(args.teamId, {
      name: args.name,
    });

    return args.teamId;
  },
});

// Delete team
export const deleteTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is the first member (owner) of the team
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Sort by joinedAt to find the first member (owner)
    const sortedMembers = [...members].sort((a, b) => a.joinedAt - b.joinedAt);
    const isOwner = sortedMembers.length > 0 && sortedMembers[0].userId === userId;

    if (!isOwner) {
      throw new Error("Only the team owner can delete the team");
    }

    // Delete all team members
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all projects in the team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    for (const project of projects) {
      await ctx.db.delete(project._id);
    }

    // Delete the team
    await ctx.db.delete(args.teamId);

    return args.teamId;
  },
});

// Leave team
export const leaveTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Find user's membership
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const userMembership = membership.find((m) => m.userId === userId);
    if (!userMembership) {
      throw new Error("You are not a member of this team");
    }

    // Check if user is the owner (first member)
    const sortedMembers = [...membership].sort((a, b) => a.joinedAt - b.joinedAt);
    const isOwner = sortedMembers.length > 0 && sortedMembers[0].userId === userId;

    if (isOwner && membership.length > 1) {
      throw new Error("Team owner cannot leave while there are other members. Delete the team or transfer ownership first.");
    }

    // Delete the membership
    await ctx.db.delete(userMembership._id);

    // If this was the last member, delete the team
    if (membership.length === 1) {
      // Delete all projects in the team
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .collect();

      for (const project of projects) {
        await ctx.db.delete(project._id);
      }

      await ctx.db.delete(args.teamId);
    }

    return args.teamId;
  },
});

// Get team details with members and projects
export const getTeamDetails = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }

    // Get all members
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Get user details for each member
    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: m.role,
          joinedAt: m.joinedAt,
          membershipId: m._id,
        } : null;
      })
    );

    // Sort members by join date to determine owner (first member)
    const sortedMembers = members.filter(Boolean).sort((a, b) => (a?.joinedAt || 0) - (b?.joinedAt || 0));

    // Get projects for the team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Check if current user is a member
    const currentMembership = memberships.find((m) => m.userId === userId);
    const isMember = !!currentMembership;
    const isOwner = sortedMembers.length > 0 && sortedMembers[0]?._id === userId;

    return {
      ...team,
      members: sortedMembers,
      projects,
      memberCount: memberships.length,
      projectCount: projects.length,
      isMember,
      isOwner,
      userRole: currentMembership?.role || null,
    };
  },
});

// Update member role
export const updateMemberRole = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is owner or admin
    const currentMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), currentUserId)
        )
      )
      .unique();

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role || "member")) {
      throw new Error("Only team owners and admins can update member roles");
    }

    // Find the target membership
    const targetMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), args.userId)
        )
      )
      .unique();

    if (!targetMembership) {
      throw new Error("Member not found");
    }

    // Permission checks for owner role changes
    if (args.role === "owner" || targetMembership.role === "owner") {
      // Only current owner can change owner role
      if (currentMembership.role !== "owner") {
        throw new Error("Only the team owner can change owner role");
      }

      if (args.role === "owner" && targetMembership.role !== "owner") {
        throw new Error("Cannot assign owner role. Transfer ownership is not supported yet.");
      }

      if (targetMembership.role === "owner" && args.role !== "owner") {
        throw new Error("Cannot change owner role. Transfer ownership first.");
      }
    }

    await ctx.db.patch(targetMembership._id, {
      role: args.role,
    });

    return targetMembership._id;
  },
});

// Remove member from team
export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is owner or admin
    const currentMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), currentUserId)
        )
      )
      .unique();

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role || "member")) {
      throw new Error("Only team owners and admins can remove members");
    }

    // Find the target membership
    const targetMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), args.userId)
        )
      )
      .unique();

    if (!targetMembership) {
      throw new Error("Member not found");
    }

    // Prevent removing owner
    if (targetMembership.role === "owner") {
      throw new Error("Cannot remove team owner");
    }

    // Admins can't remove other admins unless they're the owner
    if (targetMembership.role === "admin" && currentMembership.role !== "owner") {
      throw new Error("Only the team owner can remove admins");
    }

    await ctx.db.delete(targetMembership._id);

    return targetMembership._id;
  },
});

// Invite member by email
export const inviteMember = mutation({
  args: {
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is owner or admin
    const currentMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), currentUserId)
        )
      )
      .unique();

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role || "member")) {
      throw new Error("Only team owners and admins can invite members");
    }

    // Check if already a member
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();

    if (user) {
      const existing = await ctx.db
        .query("teamMembers")
        .filter((q) =>
          q.and(
            q.eq(q.field("teamId"), args.teamId),
            q.eq(q.field("userId"), user._id)
          )
        )
        .unique();

      if (existing) {
        throw new Error("User is already a member of this team");
      }
    }

    // Check if there's already a pending invitation
    const pendingInvitation = await ctx.db
      .query("teamInvitations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) =>
        q.and(
          q.eq(q.field("email"), args.email),
          q.eq(q.field("status"), "pending")
        )
      )
      .unique();

    if (pendingInvitation) {
      throw new Error("An invitation has already been sent to this email");
    }

    // Generate unique token for invitation
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Create invitation (expires in 7 days)
    const invitationId = await ctx.db.insert("teamInvitations", {
      teamId: args.teamId,
      email: args.email,
      role: args.role,
      invitedBy: currentUserId,
      token,
      customMessage: args.customMessage,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // TODO: Send email notification with magic link (implement with email service)
    // For now, log the invitation
    await ctx.db.insert("notificationLogs", {
      type: "email",
      recipient: args.email,
      subject: "Team Invitation",
      status: "pending",
      metadata: { invitationId, token },
      createdAt: Date.now(),
    });

    return invitationId;
  },
});

// Get pending invitations for a team
export const getPendingInvitations = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if user is a member
    const membership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), args.teamId),
          q.eq(q.field("userId"), userId)
        )
      )
      .unique();

    if (!membership) {
      return [];
    }

    // Get pending invitations
    const invitations = await ctx.db
      .query("teamInvitations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Get inviter details for each invitation
    const invitationsWithDetails = await Promise.all(
      invitations.map(async (inv) => {
        const inviter = await ctx.db.get(inv.invitedBy);
        return {
          ...inv,
          inviterName: inviter?.name || inviter?.email || "Unknown",
        };
      })
    );

    return invitationsWithDetails;
  },
});

// Cancel invitation
export const cancelInvitation = mutation({
  args: { invitationId: v.id("teamInvitations") },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Check if current user is owner or admin of the team
    const currentMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), invitation.teamId),
          q.eq(q.field("userId"), currentUserId)
        )
      )
      .unique();

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role || "member")) {
      throw new Error("Only team owners and admins can cancel invitations");
    }

    await ctx.db.patch(args.invitationId, {
      status: "cancelled",
    });

    return args.invitationId;
  },
});

// Resend invitation
export const resendInvitation = mutation({
  args: { invitationId: v.id("teamInvitations") },
  handler: async (ctx, args) => {
    const currentUserId = await auth.getUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error("Can only resend pending invitations");
    }

    // Check if current user is owner or admin of the team
    const currentMembership = await ctx.db
      .query("teamMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("teamId"), invitation.teamId),
          q.eq(q.field("userId"), currentUserId)
        )
      )
      .unique();

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role || "member")) {
      throw new Error("Only team owners and admins can resend invitations");
    }

    // Extend expiration and log resend
    await ctx.db.patch(args.invitationId, {
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // Extend by 7 days
    });

    // TODO: Send email notification with magic link
    await ctx.db.insert("notificationLogs", {
      type: "email",
      recipient: invitation.email,
      subject: "Team Invitation (Resent)",
      status: "pending",
      metadata: { invitationId: args.invitationId, token: invitation.token },
      createdAt: Date.now(),
    });

    return args.invitationId;
  },
});
