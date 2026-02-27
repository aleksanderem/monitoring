import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { getSupabaseAdmin } from "./lib/supabase";
import type { Id } from "./_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────

interface KeywordMeta {
  id: string;
  phrase: string;
  domainId: string;
  creationTime: number;
}

interface DomainMeta {
  id: string;
  domain: string;
}

interface UserKeywordMeta {
  keywords: KeywordMeta[];
  domains: DomainMeta[];
  projectsCount: number;
}

interface StatsResult {
  totalKeywords: number;
  avgPosition: number | null;
  positionChanges: number;
  domainsCount: number;
  projectsCount: number;
  hasProjects: boolean;
  hasDomains: boolean;
  hasKeywords: boolean;
}

interface DistributionBucket {
  range: string;
  count: number;
}

interface KeywordChange {
  keyword: string;
  domain: string;
  oldPosition: number;
  newPosition: number;
  change: number;
  domainId: string;
}

interface ChangesResult {
  gainers: KeywordChange[];
  losers: KeywordChange[];
}

interface ActivityItem {
  type: "keyword_added" | "domain_checked" | "position_change";
  message: string;
  timestamp: number;
  keywordId?: string;
  domainId?: string;
}

// ─── Internal helpers ─────────────────────────────────────────

/**
 * Get keyword and domain metadata for the current user's active keywords.
 * Returns { keywords, domains, projectsCount } so actions can join with Supabase position data.
 */
export const _getUserKeywordMeta = internalQuery({
  args: {},
  handler: async (ctx): Promise<UserKeywordMeta | null> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", membership.organizationId)
      )
      .collect();

    const domains: Array<{ id: string; domain: string }> = [];
    let projectsCount = 0;

    for (const team of teams) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      projectsCount += projects.length;

      for (const project of projects) {
        const domainDocs = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        domains.push(...domainDocs.map((d) => ({ id: d._id, domain: d.domain })));
      }
    }

    const keywords: Array<{
      id: string;
      phrase: string;
      domainId: string;
      creationTime: number;
    }> = [];
    for (const domain of domains) {
      const kwDocs = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", domain.id as Id<"domains">))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      keywords.push(
        ...kwDocs.map((k) => ({
          id: k._id,
          phrase: k.phrase,
          domainId: k.domainId,
          creationTime: k._creationTime,
        }))
      );
    }

    return { keywords, domains, projectsCount };
  },
});

// ─── Dashboard actions (Supabase-backed) ──────────────────────

// Get dashboard statistics for the current user's organization
export const getStats = action({
  args: {},
  handler: async (ctx): Promise<StatsResult | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const meta: UserKeywordMeta | null = await ctx.runQuery(internal.dashboard._getUserKeywordMeta);
    if (!meta) {
      return null;
    }

    const { keywords, domains, projectsCount } = meta;

    if (domains.length === 0) {
      return {
        totalKeywords: 0,
        avgPosition: null,
        positionChanges: 0,
        domainsCount: 0,
        projectsCount: 0,
        hasProjects: false,
        hasDomains: false,
        hasKeywords: false,
      };
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      // Graceful degradation: return metadata-only stats
      return {
        totalKeywords: keywords.length,
        avgPosition: null,
        positionChanges: 0,
        domainsCount: domains.length,
        projectsCount,
        hasProjects: projectsCount > 0,
        hasDomains: domains.length > 0,
        hasKeywords: keywords.length > 0,
      };
    }

    const domainIds = domains.map((d) => d.id);

    // Fetch latest positions for all user keywords
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 14); // 14 days for 2-position comparison
    const cutoffDate = sevenDaysAgo.toISOString().split("T")[0];

    const { data, error } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, position, date")
      .in("convex_domain_id", domainIds)
      .gte("date", cutoffDate)
      .order("date", { ascending: false });

    if (error || !data) {
      return {
        totalKeywords: keywords.length,
        avgPosition: null,
        positionChanges: 0,
        domainsCount: domains.length,
        projectsCount,
        hasProjects: projectsCount > 0,
        hasDomains: domains.length > 0,
        hasKeywords: keywords.length > 0,
      };
    }

    // Deduplicate to latest 2 per keyword
    const positionsByKeyword = new Map<string, Array<{ position: number | null; date: string }>>();
    for (const row of data) {
      const existing = positionsByKeyword.get(row.convex_keyword_id);
      if (!existing) {
        positionsByKeyword.set(row.convex_keyword_id, [{ position: row.position, date: row.date }]);
      } else if (existing.length < 2) {
        existing.push({ position: row.position, date: row.date });
      }
    }

    let totalPositions = 0;
    let positionCount = 0;
    let positionChanges = 0;
    const sevenDaysAgoStr = new Date(
      today.getTime() - 7 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

    for (const [, positions] of positionsByKeyword) {
      if (positions.length > 0 && positions[0].position !== null) {
        totalPositions += positions[0].position;
        positionCount++;

        if (
          positions.length > 1 &&
          positions[1].position !== null &&
          positions[0].date >= sevenDaysAgoStr
        ) {
          const change = positions[1].position - positions[0].position;
          if (change !== 0) {
            positionChanges++;
          }
        }
      }
    }

    const avgPosition =
      positionCount > 0 ? Math.round((totalPositions / positionCount) * 10) / 10 : null;

    return {
      totalKeywords: keywords.length,
      avgPosition,
      positionChanges,
      domainsCount: domains.length,
      projectsCount,
      hasProjects: projectsCount > 0,
      hasDomains: domains.length > 0,
      hasKeywords: keywords.length > 0,
    };
  },
});

// Get position distribution for histogram chart
export const getPositionDistribution = action({
  args: {},
  handler: async (ctx): Promise<DistributionBucket[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const emptyBuckets: DistributionBucket[] = [
      { range: "1-3", count: 0 },
      { range: "4-10", count: 0 },
      { range: "11-20", count: 0 },
      { range: "21-50", count: 0 },
      { range: "51-100", count: 0 },
      { range: "100+", count: 0 },
    ];

    const meta: UserKeywordMeta | null = await ctx.runQuery(
      internal.dashboard._getUserKeywordMeta
    );
    if (!meta) return emptyBuckets;

    const domainIds = meta.domains.map((d) => d.id);
    if (domainIds.length === 0) return emptyBuckets;

    const sb = getSupabaseAdmin();
    if (!sb) return emptyBuckets;

    // Fetch all positions for the user's domains, ordered by date desc
    const { data, error } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, position, date")
      .in("convex_domain_id", domainIds)
      .order("date", { ascending: false });

    if (error || !data) return emptyBuckets;

    // Deduplicate to latest per keyword
    const latestByKeyword = new Map<string, number | null>();
    for (const row of data) {
      if (!latestByKeyword.has(row.convex_keyword_id)) {
        latestByKeyword.set(row.convex_keyword_id, row.position);
      }
    }

    const buckets: Record<string, number> = {
      "1-3": 0,
      "4-10": 0,
      "11-20": 0,
      "21-50": 0,
      "51-100": 0,
      "100+": 0,
    };

    for (const [, pos] of latestByKeyword) {
      if (pos !== null) {
        if (pos >= 1 && pos <= 3) buckets["1-3"]++;
        else if (pos >= 4 && pos <= 10) buckets["4-10"]++;
        else if (pos >= 11 && pos <= 20) buckets["11-20"]++;
        else if (pos >= 21 && pos <= 50) buckets["21-50"]++;
        else if (pos >= 51 && pos <= 100) buckets["51-100"]++;
        else if (pos > 100) buckets["100+"]++;
      }
    }

    return [
      { range: "1-3", count: buckets["1-3"] },
      { range: "4-10", count: buckets["4-10"] },
      { range: "11-20", count: buckets["11-20"] },
      { range: "21-50", count: buckets["21-50"] },
      { range: "51-100", count: buckets["51-100"] },
      { range: "100+", count: buckets["100+"] },
    ];
  },
});

// Get recent position changes (top gainers and losers)
export const getRecentChanges = action({
  args: {},
  handler: async (ctx): Promise<ChangesResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const meta: UserKeywordMeta | null = await ctx.runQuery(internal.dashboard._getUserKeywordMeta);
    if (!meta || meta.domains.length === 0) {
      return { gainers: [], losers: [] };
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      return { gainers: [], losers: [] };
    }

    const domainIds = meta.domains.map((d) => d.id);

    // Fetch positions from last 14 days to get at least 2 data points
    const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await sb
      .from("keyword_positions")
      .select("convex_keyword_id, convex_domain_id, position, date")
      .in("convex_domain_id", domainIds)
      .gte("date", cutoffDate)
      .order("date", { ascending: false });

    if (error || !data) {
      return { gainers: [], losers: [] };
    }

    // Group latest 2 positions per keyword
    const positionsByKeyword = new Map<
      string,
      Array<{ position: number | null; date: string; domainId: string }>
    >();
    for (const row of data) {
      const existing = positionsByKeyword.get(row.convex_keyword_id);
      if (!existing) {
        positionsByKeyword.set(row.convex_keyword_id, [
          { position: row.position, date: row.date, domainId: row.convex_domain_id },
        ]);
      } else if (existing.length < 2) {
        existing.push({
          position: row.position,
          date: row.date,
          domainId: row.convex_domain_id,
        });
      }
    }

    // Build lookup maps for keyword phrases and domain names
    const keywordMap = new Map<string, string>();
    for (const kw of meta.keywords) {
      keywordMap.set(kw.id, kw.phrase);
    }
    const domainMap = new Map<string, string>();
    for (const d of meta.domains) {
      domainMap.set(d.id, d.domain);
    }

    const changes: KeywordChange[] = [];

    for (const [keywordId, positions] of positionsByKeyword) {
      if (
        positions.length >= 2 &&
        positions[0].position !== null &&
        positions[1].position !== null
      ) {
        const change = positions[1].position - positions[0].position;
        if (change !== 0) {
          changes.push({
            keyword: keywordMap.get(keywordId) ?? "Unknown",
            domain: domainMap.get(positions[0].domainId) ?? "Unknown",
            oldPosition: positions[1].position,
            newPosition: positions[0].position,
            change,
            domainId: positions[0].domainId,
          });
        }
      }
    }

    // Sort by absolute change
    changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    // Top 10 gainers (positive change = moved up in rankings)
    const gainers = changes.filter((c) => c.change > 0).slice(0, 10);
    // Top 10 losers (negative change = moved down in rankings)
    const losers = changes.filter((c) => c.change < 0).slice(0, 10);

    return { gainers, losers };
  },
});

// Get recent activity feed
export const getRecentActivity = action({
  args: {},
  handler: async (ctx): Promise<ActivityItem[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const meta: UserKeywordMeta | null = await ctx.runQuery(internal.dashboard._getUserKeywordMeta);
    if (!meta || meta.domains.length === 0) {
      return [];
    }

    const domainIds = meta.domains.map((d) => d.id);

    // Build lookup maps
    const keywordMap = new Map<string, { phrase: string; domainId: string }>();
    for (const kw of meta.keywords) {
      keywordMap.set(kw.id, { phrase: kw.phrase, domainId: kw.domainId });
    }
    const domainMap = new Map<string, string>();
    for (const d of meta.domains) {
      domainMap.set(d.id, d.domain);
    }

    const activities: ActivityItem[] = [];

    // Recently added keywords (from Convex metadata)
    for (const kw of meta.keywords) {
      const domainName = domainMap.get(kw.domainId) ?? "Unknown";
      activities.push({
        type: "keyword_added",
        message: `Added keyword "${kw.phrase}" to ${domainName}`,
        timestamp: kw.creationTime,
        keywordId: kw.id,
        domainId: kw.domainId,
      });
    }

    // Recent position changes from Supabase
    const sb = getSupabaseAdmin();
    if (sb) {
      const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { data, error } = await sb
        .from("keyword_positions")
        .select("convex_keyword_id, convex_domain_id, position, date")
        .in("convex_domain_id", domainIds)
        .gte("date", cutoffDate)
        .order("date", { ascending: false });

      if (data && !error) {
        // Group latest 2 per keyword to detect changes
        const positionsByKeyword = new Map<
          string,
          Array<{ position: number | null; date: string }>
        >();
        for (const row of data) {
          const existing = positionsByKeyword.get(row.convex_keyword_id);
          if (!existing) {
            positionsByKeyword.set(row.convex_keyword_id, [
              { position: row.position, date: row.date },
            ]);
          } else if (existing.length < 2) {
            existing.push({ position: row.position, date: row.date });
          }
        }

        for (const [keywordId, positions] of positionsByKeyword) {
          if (
            positions.length >= 2 &&
            positions[0].position !== null &&
            positions[1].position !== null
          ) {
            const change = positions[1].position - positions[0].position;
            if (change !== 0) {
              const kwMeta = keywordMap.get(keywordId);
              const phrase = kwMeta?.phrase ?? "Unknown";
              const domainName = kwMeta
                ? domainMap.get(kwMeta.domainId) ?? "Unknown"
                : "Unknown";

              activities.push({
                type: "position_change",
                message: `"${phrase}" ${change > 0 ? "improved" : "dropped"} ${Math.abs(change)} positions on ${domainName}`,
                timestamp: new Date(positions[0].date).getTime(),
                keywordId,
                domainId: kwMeta?.domainId,
              });
            }
          }
        }
      }
    }

    // Sort by timestamp descending and take top 20
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, 20);
  },
});
