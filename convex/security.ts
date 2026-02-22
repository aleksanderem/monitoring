import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// =================================================================
// Queries
// =================================================================

/**
 * Get active (non-revoked, non-expired) sessions for the current user.
 * Returns newest first, up to 50 sessions.
 */
export const getActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isRevoked", false))
      .collect();

    const now = Date.now();
    // Filter out expired sessions and sort newest first
    return sessions
      .filter((s) => !s.expiresAt || s.expiresAt > now)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .slice(0, 50);
  },
});

/**
 * Get login history for the current user.
 * Returns most recent entries first, up to 100.
 */
export const getLoginHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 50;

    const entries = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return entries;
  },
});

// =================================================================
// Mutations (user-facing)
// =================================================================

/**
 * Revoke a specific session. Verifies ownership before revoking.
 */
export const revokeSession = mutation({
  args: {
    sessionId: v.id("userSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) throw new Error("Unauthorized");
    if (session.isRevoked) return; // Already revoked

    await ctx.db.patch(args.sessionId, {
      isRevoked: true,
      revokedAt: Date.now(),
    });
  },
});

/**
 * Revoke all other sessions (keep current one if identifiable).
 * Since we may not know the current session ID, this revokes ALL sessions.
 */
export const revokeAllOtherSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isRevoked", false))
      .collect();

    const now = Date.now();
    // Revoke all sessions except the most recently active one (assumed current)
    const sorted = sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    for (let i = 1; i < sorted.length; i++) {
      await ctx.db.patch(sorted[i]._id, {
        isRevoked: true,
        revokedAt: now,
      });
    }

    return { revokedCount: Math.max(0, sorted.length - 1) };
  },
});

// =================================================================
// Internal mutations (called by auth callbacks or cron jobs)
// =================================================================

/**
 * Track a new session when user logs in.
 */
export const trackSession = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deviceLabel = args.userAgent ? parseDeviceLabel(args.userAgent) : undefined;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("userSessions", {
      userId: args.userId,
      sessionId: args.sessionId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      deviceLabel,
      lastActiveAt: now,
      createdAt: now,
      expiresAt: now + thirtyDays,
      isRevoked: false,
    });
  },
});

/**
 * Update last activity timestamp for a session.
 */
export const updateSessionActivity = internalMutation({
  args: {
    sessionId: v.id("userSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.isRevoked) return;

    await ctx.db.patch(args.sessionId, {
      lastActiveAt: Date.now(),
    });
  },
});

/**
 * Track a login attempt (success or failure).
 */
export const trackLoginAttempt = internalMutation({
  args: {
    userId: v.id("users"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    method: v.union(
      v.literal("password"),
      v.literal("google"),
      v.literal("email_link"),
      v.literal("unknown")
    ),
    success: v.boolean(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deviceLabel = args.userAgent ? parseDeviceLabel(args.userAgent) : undefined;

    await ctx.db.insert("loginHistory", {
      userId: args.userId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      deviceLabel,
      method: args.method,
      success: args.success,
      failureReason: args.failureReason,
      createdAt: Date.now(),
    });
  },
});

/**
 * Clean expired and old revoked sessions.
 * Intended to be called by a cron job periodically.
 */
export const cleanExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Get all sessions — we'll filter in memory
    // In production this would be paginated, but for now this is sufficient
    const allSessions = await ctx.db.query("userSessions").collect();

    let cleaned = 0;
    for (const session of allSessions) {
      const isExpired = session.expiresAt && session.expiresAt < now;
      const isOldRevoked = session.isRevoked && session.revokedAt && session.revokedAt < ninetyDaysAgo;

      if (isExpired || isOldRevoked) {
        await ctx.db.delete(session._id);
        cleaned++;
      }
    }

    return { cleaned };
  },
});

// =================================================================
// Helpers
// =================================================================

/**
 * Simple user-agent parser that extracts browser + OS.
 * No heavy dependencies — just regex matching.
 */
function parseDeviceLabel(userAgent: string): string {
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // Browser detection
  if (/Edg\//i.test(userAgent)) {
    browser = "Edge";
  } else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(userAgent)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = "Safari";
  } else if (/Opera|OPR\//i.test(userAgent)) {
    browser = "Opera";
  }

  // OS detection
  if (/Windows/i.test(userAgent)) {
    os = "Windows";
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    os = "macOS";
  } else if (/Linux/i.test(userAgent)) {
    os = "Linux";
  } else if (/Android/i.test(userAgent)) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    os = "iOS";
  }

  return `${browser} on ${os}`;
}
