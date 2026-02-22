import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Device info parser (simple regex, no heavy dependencies)
// ---------------------------------------------------------------------------

function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "Unknown";
}

function parseOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function parseDeviceType(ua: string): string {
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  if (/Mobile|iPhone|Android.*Mobile/i.test(ua)) return "mobile";
  return "desktop";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect();

    // Sort by lastActivityAt desc
    return sessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  },
});

export const getLoginHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 50;
    const entries = await ctx.db
      .query("loginHistory")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return entries;
  },
});

// ---------------------------------------------------------------------------
// Mutations (user-facing)
// ---------------------------------------------------------------------------

export const revokeSession = mutation({
  args: { sessionId: v.id("userSessions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) throw new Error("Not authorized");
    if (session.status !== "active") throw new Error("Session is not active");

    await ctx.db.patch(args.sessionId, {
      status: "revoked",
      revokedAt: Date.now(),
    });
  },
});

export const revokeAllOtherSessions = mutation({
  args: { currentSessionId: v.optional(v.id("userSessions")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect();

    const now = Date.now();
    let revokedCount = 0;
    for (const session of sessions) {
      // Keep the current session if provided
      if (args.currentSessionId && session._id === args.currentSessionId) {
        continue;
      }
      await ctx.db.patch(session._id, {
        status: "revoked",
        revokedAt: now,
      });
      revokedCount++;
    }

    return { revokedCount };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (called from auth callbacks or cron)
// ---------------------------------------------------------------------------

export const trackSession = internalMutation({
  args: {
    userId: v.id("users"),
    deviceInfo: v.object({
      userAgent: v.string(),
      browser: v.optional(v.string()),
      os: v.optional(v.string()),
      deviceType: v.string(),
    }),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Parse browser/OS from user agent if not provided
    const browser = args.deviceInfo.browser || parseBrowser(args.deviceInfo.userAgent);
    const os = args.deviceInfo.os || parseOS(args.deviceInfo.userAgent);

    return await ctx.db.insert("userSessions", {
      userId: args.userId,
      deviceInfo: {
        userAgent: args.deviceInfo.userAgent,
        browser,
        os,
        deviceType: args.deviceInfo.deviceType,
      },
      ipAddress: args.ipAddress,
      status: "active",
      loginAt: now,
      lastActivityAt: now,
    });
  },
});

export const updateSessionActivity = internalMutation({
  args: { sessionId: v.id("userSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "active") return;

    await ctx.db.patch(args.sessionId, {
      lastActivityAt: Date.now(),
    });
  },
});

export const trackLoginAttempt = internalMutation({
  args: {
    userId: v.id("users"),
    loginMethod: v.string(),
    deviceInfo: v.object({
      userAgent: v.string(),
      browser: v.optional(v.string()),
      os: v.optional(v.string()),
    }),
    ipAddress: v.optional(v.string()),
    status: v.string(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const browser = args.deviceInfo.browser || parseBrowser(args.deviceInfo.userAgent);
    const os = args.deviceInfo.os || parseOS(args.deviceInfo.userAgent);

    return await ctx.db.insert("loginHistory", {
      userId: args.userId,
      loginMethod: args.loginMethod,
      deviceInfo: {
        userAgent: args.deviceInfo.userAgent,
        browser,
        os,
      },
      ipAddress: args.ipAddress,
      status: args.status,
      failureReason: args.failureReason,
      loginAt: Date.now(),
    });
  },
});

export const cleanExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Get all active sessions and mark old ones as expired
    // We query without a specific user to clean all expired sessions
    const allActive = await ctx.db
      .query("userSessions")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.lt(q.field("lastActivityAt"), thirtyDaysAgo)
        )
      )
      .take(100); // Process in batches

    for (const session of allActive) {
      await ctx.db.patch(session._id, { status: "expired" });
    }

    return { expiredCount: allActive.length };
  },
});
