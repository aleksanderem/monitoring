import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { auth } from "./auth";

/**
 * Get notifications for the current user, newest first
 */
export const getNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 50;

    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get unread notification count
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

/**
 * Mark a single notification as read
 */
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    // Verify the notification belongs to the current user
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== userId) throw new Error("Access denied");

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true });
    }
  },
});

/**
 * Internal: create a notification for all team members of a domain
 * Called from job completion handlers
 */
export const createJobNotification = internalMutation({
  args: {
    domainId: v.id("domains"),
    type: v.union(v.literal("job_started"), v.literal("job_completed"), v.literal("job_failed")),
    title: v.string(),
    message: v.string(),
    jobType: v.optional(v.string()),
    jobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return;

    const domainName = domain.domain;

    // domain -> project -> team -> teamMembers
    const project = await ctx.db.get(domain.projectId);
    if (!project) return;

    // Find all team members who have access
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .collect();

    for (const member of teamMembers) {
      await ctx.db.insert("notifications", {
        userId: member.userId,
        domainId: args.domainId,
        type: args.type,
        title: args.title,
        message: args.message,
        isRead: false,
        createdAt: Date.now(),
        jobType: args.jobType,
        jobId: args.jobId,
        domainName,
      });
    }
  },
});
