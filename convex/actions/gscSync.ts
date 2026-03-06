"use node";

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { writeGscPerformance, writeKeywordPositions, writeUrlInspections, type GscPerformanceRow, type UrlInspectionRow } from "../lib/supabase";

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
        const allMatchedPositions: Array<{ keywordId: string; date: string; position: number; url?: string }> = [];
        for (let i = 0; i < denormMetrics.length; i += 100) {
          const result = await ctx.runMutation(internal.keywords.storeGscPositionDenormalized, {
            domainId: domain._id,
            metrics: denormMetrics.slice(i, i + 100),
          });
          if (result?.matchedPositions) {
            allMatchedPositions.push(...result.matchedPositions);
          }
        }

        // Dual-write GSC positions to Supabase keyword_positions table
        if (allMatchedPositions.length > 0) {
          writeKeywordPositions(
            allMatchedPositions.map((p) => ({
              convex_domain_id: domain._id,
              convex_keyword_id: p.keywordId as any,
              date: p.date,
              position: p.position,
              url: p.url ?? null,
            }))
          ).catch((err) =>
            console.error(`[gscSync] Supabase keyword_positions write failed:`, err)
          );
        }

        // Phase 1c — Auto-import top GSC keywords into monitoring (up to domain limit)
        try {
          const importMetrics = [...denormMetrics].sort(
            (a, b) => a.position - b.position || b.impressions - a.impressions
          );
          for (let i = 0; i < importMetrics.length; i += 100) {
            await ctx.runMutation(internal.keywords.autoImportGscKeywords, {
              domainId: domain._id,
              metrics: importMetrics.slice(i, i + 100),
            });
          }
        } catch (error) {
          console.error(`[gscSync] Auto-import keywords error for domain ${domain._id}:`, error);
        }

        // Dual-write to Supabase
        const sbRows: GscPerformanceRow[] = rows.map((row) => ({
          convex_domain_id: domain._id,
          date: endDate,
          query: row.keys[0],
          page: null,
          device: null,
          country: null,
          search_type: "web",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        await writeGscPerformance(sbRows);
      }
    } catch (error) {
      console.error(`GSC keyword sync error for domain ${domain._id}:`, error);
    }

    // Phase 1b — Query+Page (needed for cannibalization view in Supabase)
    try {
      const rows = await fetchGscAnalytics({
        ...fetchParams,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      });
      if (rows.length > 0) {
        const sbRows: GscPerformanceRow[] = rows.map((row) => ({
          convex_domain_id: domain._id,
          date: endDate,
          query: row.keys[0],
          page: row.keys[1],
          device: null,
          country: null,
          search_type: "web",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        await writeGscPerformance(sbRows);
      }
    } catch (error) {
      console.error(`GSC query+page sync error for domain ${domain._id}:`, error);
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

        const sbRows: GscPerformanceRow[] = rows.map((row) => ({
          convex_domain_id: domain._id,
          date: endDate,
          query: null,
          page: row.keys[0],
          device: null,
          country: null,
          search_type: "web",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        await writeGscPerformance(sbRows);
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

        const sbRows: GscPerformanceRow[] = rows.map((row) => ({
          convex_domain_id: domain._id,
          date: endDate,
          query: null,
          page: null,
          device: row.keys[0],
          country: null,
          search_type: "web",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        await writeGscPerformance(sbRows);
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

        const sbRows: GscPerformanceRow[] = rows.map((row) => ({
          convex_domain_id: domain._id,
          date: endDate,
          query: null,
          page: null,
          device: null,
          country: row.keys[0],
          search_type: "web",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        await writeGscPerformance(sbRows);
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

          const sbRows: GscPerformanceRow[] = rows.map((row) => ({
            convex_domain_id: domainId,
            date: endDate,
            query: row.keys[0],
            page: null,
            device: null,
            country: null,
            search_type: "web",
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }));
          await writeGscPerformance(sbRows);
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

    // After backfill, denormalize the most recent GSC data onto tracked keywords
    // so effective position fields (currentPosition, positionSource, recentPositions)
    // reflect real GSC data instead of D4S estimates.
    try {
      const latestEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .split("T")[0];
      const latestStartDate = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      )
        .toISOString()
        .split("T")[0];

      const latestRows = await fetchGscAnalytics({
        accessToken,
        propertyUrl,
        startDate: latestStartDate,
        endDate: latestEndDate,
        dimensions: ["query"],
        rowLimit: 5000,
        dataState: "final",
      });

      if (latestRows.length > 0) {
        const denormMetrics = latestRows.map((row) => ({
          keyword: row.keys[0],
          date: latestEndDate,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          url: undefined as string | undefined,
        }));
        const backfillPositions: Array<{ keywordId: string; date: string; position: number; url?: string }> = [];
        for (let i = 0; i < denormMetrics.length; i += 100) {
          const result = await ctx.runMutation(
            internal.keywords.storeGscPositionDenormalized,
            {
              domainId,
              metrics: denormMetrics.slice(i, i + 100),
            }
          );
          if (result?.matchedPositions) {
            backfillPositions.push(...result.matchedPositions);
          }
        }

        // Dual-write backfill GSC positions to Supabase
        if (backfillPositions.length > 0) {
          writeKeywordPositions(
            backfillPositions.map((p) => ({
              convex_domain_id: domainId,
              convex_keyword_id: p.keywordId as any,
              date: p.date,
              position: p.position,
              url: p.url ?? null,
            }))
          ).catch((err) =>
            console.error(`[gscSync] Backfill Supabase keyword_positions write failed:`, err)
          );
        }

        console.log(
          `Backfill denormalization: updated ${latestRows.length} keywords for domain ${domainId}`
        );
      }
    } catch (error) {
      console.error(
        `Backfill denormalization error for domain ${domainId}:`,
        error
      );
    }
  },
});

// ─── Internal action: inspect top pages via URL Inspection API ──────

export const inspectTopPages = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.runQuery(
      internal.gsc.getAllActiveConnections,
      {}
    );

    for (const conn of connections) {
      try {
        let accessToken: string;
        try {
          accessToken = await refreshTokenIfNeeded(ctx, conn);
        } catch {
          console.error(`Token refresh failed for URL inspection, org ${conn.organizationId}`);
          continue;
        }

        const domains = await ctx.runQuery(internal.gsc.getDomainsWithGscProperty, {
          organizationId: conn.organizationId,
        });

        for (const domain of domains ?? []) {
          if (!domain.gscPropertyUrl) continue;

          const topPages = await ctx.runQuery(internal.gsc.getTopPagesByClicks, {
            domainId: domain._id,
            limit: 200,
          });

          if (topPages.length === 0) continue;

          const inspectionRows: UrlInspectionRow[] = [];

          for (const pageUrl of topPages) {
            try {
              const response = await fetch(
                "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    inspectionUrl: pageUrl,
                    siteUrl: domain.gscPropertyUrl,
                  }),
                }
              );

              if (response.status === 429) {
                console.warn(`URL Inspection rate limited for ${domain.gscPropertyUrl}, stopping`);
                break;
              }

              if (!response.ok) {
                const errText = await response.text();
                console.warn(`URL Inspection failed for ${pageUrl}: ${response.status} ${errText}`);
                continue;
              }

              const data = await response.json();
              const idx = data.inspectionResult?.indexStatusResult;
              const mob = data.inspectionResult?.mobileUsabilityResult;
              const rich = data.inspectionResult?.richResultsResult;

              inspectionRows.push({
                convex_domain_id: domain._id,
                url: pageUrl,
                indexing_state: idx?.verdict ?? null,
                coverage_state: idx?.coverageState ?? null,
                robots_txt_state: idx?.robotsTxtState ?? null,
                last_crawl_time: idx?.lastCrawlTime ?? null,
                crawled_as: idx?.crawledAs ?? null,
                google_canonical: idx?.googleCanonical ?? null,
                user_canonical: idx?.userCanonical ?? null,
                mobile_usability: mob?.verdict ?? null,
                rich_results_valid: rich?.detectedItems?.filter((i: any) => i.items?.length > 0).length ?? 0,
                rich_results_errors: rich?.detectedItems?.filter((i: any) => i.items?.some((it: any) => it.issues?.length > 0)).length ?? 0,
              });

              // Respect rate limits: 100ms delay between calls
              await new Promise((r) => setTimeout(r, 100));
            } catch (err) {
              console.warn(`URL Inspection error for ${pageUrl}:`, err);
            }
          }

          if (inspectionRows.length > 0) {
            await writeUrlInspections(inspectionRows);
            console.log(`URL Inspection: wrote ${inspectionRows.length} results for domain ${domain._id}`);
          }
        }
      } catch (error) {
        console.error(`URL Inspection failed for org ${conn.organizationId}:`, error);
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
