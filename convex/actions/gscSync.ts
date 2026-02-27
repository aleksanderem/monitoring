"use node";

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Helper: refresh access token if expired ────────────────────────

async function refreshTokenIfNeeded(
  ctx: any,
  connection: {
    _id: any;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt?: number;
  }
): Promise<string> {
  // If token is still valid (with 5-min buffer), return as-is
  if (connection.tokenExpiresAt && connection.tokenExpiresAt > Date.now() + 5 * 60 * 1000) {
    return connection.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${tokenResponse.status} ${errorBody}`);
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token as string;
  const expiresIn = (tokenData.expires_in as number) || 3600;

  await ctx.runMutation(internal.gsc.updateGscTokens, {
    connectionId: connection._id,
    accessToken: newAccessToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  });

  return newAccessToken;
}

// ─── Action: exchange OAuth code for real tokens ────────────────────

export const exchangeGscCode = action({
  args: {
    organizationId: v.id("organizations"),
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, { organizationId, code, redirectUri }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    // Step 1: Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("Token exchange failed:", errorBody);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string;
    const expiresIn = (tokenData.expires_in as number) || 3600;

    // Step 2: Get user email from Google
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let googleEmail = "unknown@gmail.com";
    if (userinfoResponse.ok) {
      const userinfo = await userinfoResponse.json();
      googleEmail = userinfo.email || googleEmail;
    }

    // Step 3: Get list of GSC properties
    const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let properties: { url: string; type: string }[] = [];
    if (sitesResponse.ok) {
      const sitesData = await sitesResponse.json();
      properties = (sitesData.siteEntry || []).map(
        (entry: { siteUrl: string; permissionLevel: string }) => ({
          url: entry.siteUrl,
          type: entry.permissionLevel || "siteFullUser",
        })
      );
    }

    // Step 4: Store connection with real tokens
    await ctx.runMutation(internal.gsc.upsertGscConnection, {
      organizationId,
      googleEmail,
      accessToken,
      refreshToken,
      tokenExpiresAt: Date.now() + expiresIn * 1000,
      properties,
    });

    return { success: true, email: googleEmail, propertyCount: properties.length };
  },
});

// ─── Helper: generic GSC API fetch with pagination and retry ────────

type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function fetchGscAnalytics(params: {
  accessToken: string;
  propertyUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit?: number;
  dataState?: string;
}): Promise<GscRow[]> {
  const {
    accessToken,
    propertyUrl,
    startDate,
    endDate,
    dimensions,
    rowLimit = 5000,
    dataState = "all",
  } = params;

  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
  const allRows: GscRow[] = [];
  let startRow = 0;

  while (true) {
    const body = JSON.stringify({
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow,
      dataState,
    });

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body,
        });

        if (response.ok) break;

        const status = response.status;
        if (status === 429 || status >= 500) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.warn(`GSC API ${status} for ${propertyUrl}, retrying in ${delay}ms (attempt ${attempt + 1}/3)`);
          await new Promise((r) => setTimeout(r, delay));
          response = null;
          continue;
        }

        // Non-retryable error
        const errorBody = await response.text();
        throw new Error(`GSC API error ${status}: ${errorBody}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("GSC API error")) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 2) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error(`GSC API failed after 3 retries for ${propertyUrl}`);
    }

    const data = await response.json();
    const rows: GscRow[] = data.rows || [];
    allRows.push(...rows);

    // If we got fewer rows than the limit, there are no more pages
    if (rows.length < rowLimit) break;

    startRow += rows.length;
  }

  return allRows;
}

// ─── Action: trigger sync from UI ───────────────────────────────────

export const triggerGscSync = action({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await syncGscDataInternal(ctx, organizationId);
    return { success: true };
  },
});

export const triggerGscSyncForDomain = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const domain = await ctx.runQuery(internal.gsc.getDomainOrgId, { domainId, userId });
    if (!domain) throw new Error("Domain not found or access denied");

    await syncGscDataInternal(ctx, domain.organizationId);
    return { success: true };
  },
});

// ─── Internal action: sync GSC data for one org (multi-dimension) ───

async function syncGscDataInternal(ctx: any, organizationId: any) {
  const connection = await ctx.runQuery(
    internal.gsc.getConnectionInternal,
    { organizationId }
  );
  if (!connection || connection.status !== "active") return;

  if (connection.accessToken === "pending_exchange" || !connection.refreshToken) {
    console.warn(`GSC connection for org ${organizationId} has no real tokens, skipping sync`);
    return;
  }

  let accessToken: string;
  try {
    accessToken = await refreshTokenIfNeeded(ctx, connection);
  } catch (error) {
    console.error(`Token refresh failed for org ${organizationId}:`, error);
    return;
  }

  const domains = await ctx.runQuery(internal.gsc.getDomainsWithGscProperty, {
    organizationId,
  });
  if (!domains || domains.length === 0) return;

  // Last 3 days for daily sync
  const now = new Date();
  const endDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  for (const domain of domains) {
    if (!domain.gscPropertyUrl) continue;

    const fetchParams = {
      accessToken,
      propertyUrl: domain.gscPropertyUrl,
      startDate,
      endDate,
      dataState: "all",
    };

    // Phase 1 — Keywords
    try {
      const rows = await fetchGscAnalytics({
        ...fetchParams,
        dimensions: ["query"],
        rowLimit: 5000,
      });
      if (rows.length > 0) {
        const metrics = rows.map((row) => ({
          domainId: domain._id,
          organizationId,
          keyword: row.keys[0],
          date: endDate,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        for (let i = 0; i < metrics.length; i += 100) {
          await ctx.runMutation(internal.gsc.storeGscMetrics, {
            metrics: metrics.slice(i, i + 100),
          });
        }

        // Denormalize GSC data onto tracked keywords (writes to effective position fields when gscPrimary)
        const denormMetrics = rows.map((row) => ({
          keyword: row.keys[0],
          date: endDate,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          url: undefined as string | undefined,
        }));
        for (let i = 0; i < denormMetrics.length; i += 100) {
          await ctx.runMutation(internal.keywords.storeGscPositionDenormalized, {
            domainId: domain._id,
            metrics: denormMetrics.slice(i, i + 100),
          });
        }
      }
    } catch (error) {
      console.error(`GSC keyword sync error for domain ${domain._id}:`, error);
    }

    // Phase 2 — Pages
    try {
      const rows = await fetchGscAnalytics({
        ...fetchParams,
        dimensions: ["page"],
        rowLimit: 5000,
      });
      if (rows.length > 0) {
        const metrics = rows.map((row) => ({
          domainId: domain._id,
          organizationId,
          page: row.keys[0],
          date: endDate,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        for (let i = 0; i < metrics.length; i += 100) {
          await ctx.runMutation(internal.gsc.storeGscPageMetrics, {
            metrics: metrics.slice(i, i + 100),
          });
        }
      }
    } catch (error) {
      console.error(`GSC page sync error for domain ${domain._id}:`, error);
    }

    // Phase 3 — Device
    try {
      const rows = await fetchGscAnalytics({
        ...fetchParams,
        dimensions: ["device"],
        rowLimit: 10,
      });
      if (rows.length > 0) {
        const metrics = rows.map((row) => ({
          domainId: domain._id,
          organizationId,
          device: row.keys[0],
          date: endDate,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        await ctx.runMutation(internal.gsc.storeGscDeviceMetrics, {
          metrics,
        });
      }
    } catch (error) {
      console.error(`GSC device sync error for domain ${domain._id}:`, error);
    }

    // Phase 4 — Country
    try {
      const rows = await fetchGscAnalytics({
        ...fetchParams,
        dimensions: ["country"],
        rowLimit: 250,
      });
      if (rows.length > 0) {
        const metrics = rows.map((row) => ({
          domainId: domain._id,
          organizationId,
          country: row.keys[0],
          date: endDate,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        for (let i = 0; i < metrics.length; i += 100) {
          await ctx.runMutation(internal.gsc.storeGscCountryMetrics, {
            metrics: metrics.slice(i, i + 100),
          });
        }
      }
    } catch (error) {
      console.error(`GSC country sync error for domain ${domain._id}:`, error);
    }
  }

  await ctx.runMutation(internal.gsc.updateConnectionSyncTime, {
    connectionId: connection._id,
    lastSyncAt: Date.now(),
  });
}

export const syncGscData = internalAction({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    await syncGscDataInternal(ctx, organizationId);
  },
});

// ─── Internal action: historical backfill for one domain ────────────

export const historicalBackfill = internalAction({
  args: {
    organizationId: v.id("organizations"),
    domainId: v.id("domains"),
    propertyUrl: v.string(),
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId, domainId, propertyUrl, monthsBack = 16 } = args;

    const connection = await ctx.runQuery(
      internal.gsc.getConnectionInternal,
      { organizationId }
    );
    if (!connection || connection.status !== "active") {
      console.error(`No active GSC connection for org ${organizationId}, aborting backfill`);
      return;
    }

    let accessToken: string;
    try {
      accessToken = await refreshTokenIfNeeded(ctx, connection);
    } catch (error) {
      console.error(`Token refresh failed for backfill org ${organizationId}:`, error);
      return;
    }

    const now = new Date();

    for (let m = 0; m < monthsBack; m++) {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - m, 0);
      const monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1);

      const startDate = monthStart.toISOString().split("T")[0];
      const endDate = monthEnd.toISOString().split("T")[0];

      try {
        const rows = await fetchGscAnalytics({
          accessToken,
          propertyUrl,
          startDate,
          endDate,
          dimensions: ["query"],
          rowLimit: 5000,
          dataState: "final",
        });

        if (rows.length > 0) {
          const metrics = rows.map((row) => ({
            domainId,
            organizationId,
            keyword: row.keys[0],
            date: endDate,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }));

          for (let i = 0; i < metrics.length; i += 100) {
            await ctx.runMutation(internal.gsc.storeGscMetrics, {
              metrics: metrics.slice(i, i + 100),
            });
          }
        }

        console.log(`Backfill month ${startDate} to ${endDate}: ${rows.length} rows for domain ${domainId}`);
      } catch (error) {
        console.error(`Backfill error for month ${startDate}-${endDate}, domain ${domainId}:`, error);
      }

      // Small delay between months to be gentle on the API
      if (m < monthsBack - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  },
});

// ─── Action: trigger historical backfill from UI ────────────────────

export const triggerHistoricalBackfill = action({
  args: {
    organizationId: v.id("organizations"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, { organizationId, domainId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the domain to find its GSC property URL
    const domains = await ctx.runQuery(internal.gsc.getDomainsWithGscProperty, {
      organizationId,
    });

    const domain = domains?.find((d: any) => d._id === domainId);
    if (!domain?.gscPropertyUrl) {
      throw new Error("Domain has no GSC property URL mapped");
    }

    // Schedule backfill as background job
    await ctx.scheduler.runAfter(0, internal.actions.gscSync.historicalBackfill, {
      organizationId,
      domainId,
      propertyUrl: domain.gscPropertyUrl,
    });

    return { success: true };
  },
});

// ─── Internal action: sync all orgs (cron) ──────────────────────────

export const syncAllGscConnections = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.runQuery(
      internal.gsc.getAllActiveConnections,
      {}
    );
    for (const conn of connections) {
      try {
        await ctx.runAction(internal.actions.gscSync.syncGscData, {
          organizationId: conn.organizationId,
        });
      } catch (error) {
        console.error(
          `GSC sync failed for org ${conn.organizationId}:`,
          error
        );
      }
    }
  },
});
