import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Queries ───────────────────────────────────────────────────────

export const getGscConnection = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify user is member of org
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) return null;

    const connection = await ctx.db
      .query("gscConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.neq(q.field("status"), "disconnected"))
      .first();

    if (!connection) return null;

    return {
      googleEmail: connection.googleEmail,
      properties: connection.properties,
      selectedPropertyUrl: connection.selectedPropertyUrl,
      lastSyncAt: connection.lastSyncAt,
      status: connection.status,
      connectedAt: connection.connectedAt,
    };
  },
});

export const getGscMetrics = query({
  args: {
    domainId: v.id("domains"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, { domainId, startDate, endDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", team.organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) return null;

    // Default to last 28 days
    const now = new Date();
    const end = endDate || now.toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

    const metrics = await ctx.db
      .query("gscKeywordMetrics")
      .withIndex("by_domain_date", (q) =>
        q.eq("domainId", domainId).gte("date", start)
      )
      .filter((q) => q.lte(q.field("date"), end))
      .collect();

    if (metrics.length === 0) {
      return {
        totalClicks: 0,
        totalImpressions: 0,
        avgCtr: 0,
        avgPosition: 0,
        topKeywords: [],
      };
    }

    const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
    const avgCtr =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.ctr, 0) / metrics.length
        : 0;
    const avgPosition =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.position, 0) / metrics.length
        : 0;

    // Aggregate top keywords by total clicks
    const keywordMap = new Map<
      string,
      { clicks: number; impressions: number; ctr: number; position: number; count: number }
    >();
    for (const m of metrics) {
      const existing = keywordMap.get(m.keyword);
      if (existing) {
        existing.clicks += m.clicks;
        existing.impressions += m.impressions;
        existing.ctr += m.ctr;
        existing.position += m.position;
        existing.count += 1;
      } else {
        keywordMap.set(m.keyword, {
          clicks: m.clicks,
          impressions: m.impressions,
          ctr: m.ctr,
          position: m.position,
          count: 1,
        });
      }
    }

    const topKeywords = Array.from(keywordMap.entries())
      .map(([keyword, data]) => ({
        keyword,
        clicks: data.clicks,
        impressions: data.impressions,
        avgCtr: data.ctr / data.count,
        avgPosition: data.position / data.count,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    return {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
      topKeywords,
    };
  },
});

export const getGscKeywordComparison = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", team.organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) return null;

    // Get GSC metrics (latest per keyword)
    const now = new Date();
    const startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const gscMetrics = await ctx.db
      .query("gscKeywordMetrics")
      .withIndex("by_domain_date", (q) =>
        q.eq("domainId", domainId).gte("date", startDate)
      )
      .collect();

    // Aggregate GSC data per keyword (latest position, total clicks/impressions)
    const gscByKeyword = new Map<
      string,
      { position: number; clicks: number; impressions: number }
    >();
    for (const m of gscMetrics) {
      const existing = gscByKeyword.get(m.keyword);
      if (existing) {
        existing.clicks += m.clicks;
        existing.impressions += m.impressions;
        // Keep position from most recent date
        existing.position = m.position;
      } else {
        gscByKeyword.set(m.keyword, {
          position: m.position,
          clicks: m.clicks,
          impressions: m.impressions,
        });
      }
    }

    // Get tracked keywords for this domain
    const trackedKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const trackedByPhrase = new Map<string, number>();
    for (const kw of trackedKeywords) {
      if (kw.currentPosition !== undefined && kw.currentPosition !== null) {
        trackedByPhrase.set(kw.phrase.toLowerCase(), kw.currentPosition);
      }
    }

    // Match by keyword phrase
    const comparison = [];
    for (const [keyword, gscData] of gscByKeyword) {
      const trackedPosition = trackedByPhrase.get(keyword.toLowerCase());
      comparison.push({
        keyword,
        gscPosition: gscData.position,
        trackedPosition: trackedPosition ?? null,
        clicks: gscData.clicks,
        impressions: gscData.impressions,
      });
    }

    comparison.sort((a, b) => b.clicks - a.clicks);

    const maxResults = limit ?? 50;
    return comparison.slice(0, maxResults);
  },
});

// ─── Mutations ─────────────────────────────────────────────────────

export const initiateGscConnection = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member of this organization");

    // Generate state token with org info
    const stateData = {
      organizationId,
      nonce: Math.random().toString(36).substring(2, 15),
    };
    const state = btoa(JSON.stringify(stateData));

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GSC_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/auth/gsc-callback`;

    if (!clientId) {
      throw new Error("Google OAuth not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return { authUrl, state };
  },
});

export const completeGscConnection = mutation({
  args: {
    organizationId: v.id("organizations"),
    code: v.string(),
    state: v.string(),
    googleEmail: v.string(),
    properties: v.array(
      v.object({
        url: v.string(),
        type: v.string(),
      })
    ),
  },
  handler: async (ctx, { organizationId, code: _code, state: _state, googleEmail, properties }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member of this organization");

    // Check for existing connection
    const existing = await ctx.db
      .query("gscConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.neq(q.field("status"), "disconnected"))
      .first();

    if (existing) {
      // Update existing connection
      await ctx.db.patch(existing._id, {
        googleEmail,
        accessToken: "pending_exchange",
        refreshToken: "pending_exchange",
        tokenExpiresAt: Date.now() + 3600 * 1000,
        properties,
        status: "active",
        connectedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new connection
    const connectionId = await ctx.db.insert("gscConnections", {
      organizationId,
      googleEmail,
      accessToken: "pending_exchange",
      refreshToken: "pending_exchange",
      tokenExpiresAt: Date.now() + 3600 * 1000,
      properties,
      status: "active",
      connectedAt: Date.now(),
    });

    return connectionId;
  },
});

export const disconnectGsc = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member of this organization");

    const connection = await ctx.db
      .query("gscConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.neq(q.field("status"), "disconnected"))
      .first();

    if (connection) {
      await ctx.db.patch(connection._id, {
        status: "disconnected",
        accessToken: "",
        refreshToken: "",
      });
    }
  },
});

export const getGscPropertiesForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const project = await ctx.db.get(domain.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", team.organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) return null;

    const connection = await ctx.db
      .query("gscConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", team.organizationId))
      .filter((q) => q.neq(q.field("status"), "disconnected"))
      .first();

    if (!connection) {
      return { connected: false, properties: [], selectedPropertyUrl: undefined };
    }

    return {
      connected: true,
      properties: connection.properties ?? [],
      selectedPropertyUrl: domain.gscPropertyUrl,
    };
  },
});

export const setDomainGscProperty = mutation({
  args: {
    domainId: v.id("domains"),
    propertyUrl: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { domainId, propertyUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const domain = await ctx.db.get(domainId);
    if (!domain) throw new Error("Domain not found");

    const project = await ctx.db.get(domain.projectId);
    if (!project) throw new Error("Project not found");

    const team = await ctx.db.get(project.teamId);
    if (!team) throw new Error("Team not found");

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", team.organizationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member of this organization");

    await ctx.db.patch(domainId, {
      gscPropertyUrl: propertyUrl ?? undefined,
    });
  },
});

// ─── Internal queries ──────────────────────────────────────────────

export const getConnectionInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    return await ctx.db
      .query("gscConnections")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.neq(q.field("status"), "disconnected"))
      .first();
  },
});

export const getAllActiveConnections = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("gscConnections")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

// ─── Internal mutations ────────────────────────────────────────────

export const storeGscMetrics = internalMutation({
  args: {
    metrics: v.array(
      v.object({
        domainId: v.id("domains"),
        organizationId: v.id("organizations"),
        keyword: v.string(),
        date: v.string(),
        clicks: v.number(),
        impressions: v.number(),
        ctr: v.number(),
        position: v.number(),
        url: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { metrics }) => {
    for (const metric of metrics) {
      await ctx.db.insert("gscKeywordMetrics", metric);
    }
  },
});

export const updateConnectionSyncTime = internalMutation({
  args: {
    connectionId: v.id("gscConnections"),
    lastSyncAt: v.number(),
  },
  handler: async (ctx, { connectionId, lastSyncAt }) => {
    await ctx.db.patch(connectionId, { lastSyncAt });
  },
});
