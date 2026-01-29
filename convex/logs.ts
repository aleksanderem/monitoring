import { v } from "convex/values";
import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { auth } from "./auth";

/**
 * Helper function to check if user is super admin
 */
async function isSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await auth.getUserId(ctx);
  if (!userId) return false;

  const superAdmin = await ctx.db
    .query("superAdmins")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  return !!superAdmin;
}

/**
 * Get system logs with advanced filtering and pagination
 */
export const getSystemLogs = query({
  args: {
    level: v.optional(v.union(v.literal("info"), v.literal("warning"), v.literal("error"))),
    eventType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    dateFrom: v.optional(v.number()), // Unix timestamp
    dateTo: v.optional(v.number()),   // Unix timestamp
    searchQuery: v.optional(v.string()), // Search in message and stackTrace
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // For pagination (createdAt of last item)
  },
  handler: async (ctx, args) => {
    // Only super admins can view system logs
    if (!(await isSuperAdmin(ctx))) {
      return { logs: [], hasMore: false };
    }

    const limit = args.limit ?? 50;

    // Build query with appropriate index (can't chain multiple withIndex calls)
    let logs;
    if (args.level) {
      logs = await ctx.db
        .query("systemLogs")
        .withIndex("by_level", (q: any) => q.eq("level", args.level!))
        .order("desc")
        .take(limit + 1);
    } else if (args.eventType) {
      logs = await ctx.db
        .query("systemLogs")
        .withIndex("by_event_type", (q: any) => q.eq("eventType", args.eventType!))
        .order("desc")
        .take(limit + 1);
    } else if (args.userId) {
      logs = await ctx.db
        .query("systemLogs")
        .withIndex("by_user", (q: any) => q.eq("userId", args.userId!))
        .order("desc")
        .take(limit + 1);
    } else if (args.cursor) {
      // For pagination, use createdAt index
      logs = await ctx.db
        .query("systemLogs")
        .withIndex("by_created_at", (q: any) => q.lt("createdAt", args.cursor!))
        .order("desc")
        .take(limit + 1);
    } else {
      // Default: order by createdAt descending
      logs = await ctx.db
        .query("systemLogs")
        .withIndex("by_created_at")
        .order("desc")
        .take(limit + 1);
    }

    // Apply date range filter (post-query since we can't use multiple indexes)
    if (args.dateFrom || args.dateTo) {
      logs = logs.filter((log) => {
        if (args.dateFrom && log.createdAt < args.dateFrom) return false;
        if (args.dateTo && log.createdAt > args.dateTo) return false;
        return true;
      });
    }

    // Apply search filter (post-query)
    if (args.searchQuery) {
      const searchLower = args.searchQuery.toLowerCase();
      logs = logs.filter((log) => {
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const stackTraceMatch = log.stackTrace?.toLowerCase().includes(searchLower) || false;
        return messageMatch || stackTraceMatch;
      });
    }

    // Determine if there are more results
    const hasMore = logs.length > limit;
    if (hasMore) {
      logs = logs.slice(0, limit); // Remove the extra record
    }

    // Enrich logs with user info
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let userEmail: string | undefined;
        if (log.userId) {
          const user = await ctx.db.get(log.userId);
          userEmail = (user as any)?.email;
        }
        return {
          ...log,
          userEmail,
        };
      })
    );

    return {
      logs: enrichedLogs,
      hasMore,
    };
  },
});

/**
 * Get log details by ID (for SlideoutMenu)
 */
export const getLogDetails = query({
  args: {
    logId: v.id("systemLogs"),
  },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) {
      return null;
    }

    const log = await ctx.db.get(args.logId);
    if (!log) return null;

    // Enrich with user info
    let userEmail: string | undefined;
    let userName: string | undefined;
    if (log.userId) {
      const user = await ctx.db.get(log.userId);
      userEmail = (user as any)?.email;
      userName = (user as any)?.name;
    }

    return {
      ...log,
      userEmail,
      userName,
    };
  },
});

/**
 * Get unique event types for filter dropdown
 */
export const getEventTypes = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) {
      return [];
    }

    // Get all logs and extract unique event types
    const logs = await ctx.db.query("systemLogs").take(1000); // Sample for performance
    const eventTypes = new Set(logs.map((log) => log.eventType));
    return Array.from(eventTypes).sort();
  },
});

/**
 * Seed test data (DEVELOPMENT ONLY - remove in production)
 */
export const seedTestLogs = mutation({
  args: {},
  handler: async (ctx) => {
    // Only super admins can seed data
    if (!(await isSuperAdmin(ctx))) {
      throw new Error("Only super admins can seed data");
    }

    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Sample log entries
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const mockLogs = [
      {
        level: "error" as const,
        message: "Failed to fetch backlink profile from DataForSEO",
        eventType: "api_error",
        userId: userId,
        ipAddress: "192.168.1.100",
        stackTrace: "Error: Network timeout\n  at DataForSEOClient.fetchBacklinks (dataforseo.ts:45)\n  at async fetchAndStoreBacklinkProfile (backlinks.ts:123)",
        requestMetadata: {
          url: "/api/backlinks/fetch",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { domainId: "abc123" },
        },
        createdAt: now - 2 * oneHour,
      },
      {
        level: "warning" as const,
        message: "Keyword limit approaching for domain example.com",
        eventType: "limit_warning",
        userId: userId,
        ipAddress: "192.168.1.100",
        createdAt: now - 5 * oneHour,
      },
      {
        level: "info" as const,
        message: "User successfully added 50 keywords to domain",
        eventType: "keyword_import",
        userId: userId,
        ipAddress: "192.168.1.101",
        createdAt: now - 1 * oneDay,
      },
      {
        level: "error" as const,
        message: "Database connection pool exhausted",
        eventType: "database_error",
        stackTrace: "Error: Connection pool exhausted\n  at Pool.getConnection (pool.ts:78)\n  at async query (database.ts:34)",
        createdAt: now - 2 * oneDay,
      },
      {
        level: "warning" as const,
        message: "Slow query detected: getKeywords took 5.2s",
        eventType: "performance_warning",
        createdAt: now - 3 * oneDay,
      },
      {
        level: "info" as const,
        message: "Daily digest email sent successfully",
        eventType: "email_sent",
        createdAt: now - 4 * oneDay,
      },
      {
        level: "error" as const,
        message: "Failed to validate API credentials for SE Ranking",
        eventType: "api_error",
        stackTrace: "Error: Invalid API key\n  at SERankingClient.validateCredentials (seranking.ts:23)",
        requestMetadata: {
          url: "/api/seranking/validate",
          method: "POST",
        },
        createdAt: now - 5 * oneDay,
      },
      {
        level: "warning" as const,
        message: "Rate limit exceeded for DataForSEO API",
        eventType: "rate_limit_warning",
        createdAt: now - 6 * oneDay,
      },
      {
        level: "info" as const,
        message: "On-site crawl completed for domain test.com",
        eventType: "crawl_completed",
        userId: userId,
        ipAddress: "192.168.1.102",
        createdAt: now - 7 * oneDay,
      },
      {
        level: "error" as const,
        message: "Failed to parse SERP response from DataForSEO",
        eventType: "parsing_error",
        stackTrace: "TypeError: Cannot read property 'items' of undefined\n  at parseSerpResults (parser.ts:56)",
        requestMetadata: {
          url: "/api/serp/parse",
          method: "POST",
          body: { taskId: "xyz789" },
        },
        createdAt: now - 8 * oneDay,
      },
    ];

    // Insert all mock logs
    for (const log of mockLogs) {
      await ctx.db.insert("systemLogs", log);
    }

    return { count: mockLogs.length };
  },
});

/**
 * Log a system error/warning/info message (internal only)
 */
export const logSystemMessage = internalMutation({
  args: {
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
    eventType: v.string(),
    userId: v.optional(v.id("users")),
    stackTrace: v.optional(v.string()),
    requestMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("systemLogs", {
      level: args.level,
      message: args.message,
      eventType: args.eventType,
      userId: args.userId,
      stackTrace: args.stackTrace,
      requestMetadata: args.requestMetadata,
      createdAt: Date.now(),
    });
  },
});
