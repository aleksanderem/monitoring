import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkKeywordLimit } from "./limits";
import { requirePermission, getContextFromDomain, getContextFromKeyword } from "./permissions";

// Get keywords for a domain
export const getKeywords = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Get latest position for each keyword
    const keywordsWithPositions = await Promise.all(
      keywords.map(async (keyword) => {
        const positions = await ctx.db
          .query("keywordPositions")
          .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
          .order("desc")
          .take(2);

        const currentPosition = positions[0] || null;
        const previousPosition = positions[1] || null;

        let change = null;
        if (currentPosition?.position && previousPosition?.position) {
          change = previousPosition.position - currentPosition.position;
        }

        return {
          ...keyword,
          currentPosition: currentPosition?.position ?? null,
          url: currentPosition?.url ?? null,
          searchVolume: currentPosition?.searchVolume,
          difficulty: currentPosition?.difficulty,
          lastUpdated: keyword.lastUpdated ?? currentPosition?.fetchedAt,
          change,
          checkingStatus: keyword.checkingStatus,
          checkJobId: keyword.checkJobId,
        };
      })
    );

    return keywordsWithPositions;
  },
});

// Get keyword with history
export const getKeywordWithHistory = query({
  args: {
    keywordId: v.id("keywords"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword) {
      return null;
    }

    const daysToFetch = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToFetch);
    const startDateStr = startDate.toISOString().split("T")[0];

    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .filter((q) => q.gte(q.field("date"), startDateStr))
      .collect();

    // Get latest 2 positions to calculate change
    const allPositions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .order("desc")
      .take(2);

    const currentPosition = allPositions[0] || null;
    const previousPosition = allPositions[1] || null;

    let change = null;
    if (currentPosition?.position && previousPosition?.position) {
      change = previousPosition.position - currentPosition.position;
    }

    return {
      ...keyword,
      currentPosition: currentPosition?.position ?? null,
      rankingUrl: currentPosition?.url ?? null,
      searchVolume: currentPosition?.searchVolume,
      difficulty: currentPosition?.difficulty,
      lastUpdated: currentPosition?.fetchedAt,
      change,
      history: positions.sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});

// Get recent keyword position changes (for recent changes table)
export const getRecentChanges = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = args.days || 7;
    const limit = args.limit || 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const changesPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(50);

      if (positions.length < 2) return null;

      const current = positions[0];
      const oldPosition = positions.find(p => p.date <= cutoffStr);

      if (!current.position || !oldPosition?.position) return null;

      const change = oldPosition.position - current.position;
      if (change === 0) return null;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPosition.position,
        newPosition: current.position,
        change,
        searchVolume: current.searchVolume,
        url: current.url,
      };
    });

    const changes = (await Promise.all(changesPromises)).filter(c => c !== null);

    // Sort by absolute change, biggest first
    changes.sort((a, b) => Math.abs(b!.change) - Math.abs(a!.change));

    return changes.slice(0, limit);
  },
});

// Get top gainers and losers (for performance tables)
export const getTopPerformers = query({
  args: {
    domainId: v.id("domains"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = args.days || 30;
    const limit = args.limit || 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const changesPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(100);

      if (positions.length < 2) return null;

      const current = positions[0];
      const oldPosition = positions.find(p => p.date <= cutoffStr);

      if (!current.position || !oldPosition?.position) return null;

      const change = oldPosition.position - current.position;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        oldPosition: oldPosition.position,
        newPosition: current.position,
        change,
        searchVolume: current.searchVolume,
        url: current.url,
      };
    });

    const allChanges = (await Promise.all(changesPromises)).filter(c => c !== null);

    const gainers = allChanges.filter(c => c!.change > 0).sort((a, b) => b!.change - a!.change).slice(0, limit);
    const losers = allChanges.filter(c => c!.change < 0).sort((a, b) => a!.change - b!.change).slice(0, limit);

    return { gainers, losers };
  },
});

// Get top keywords by search volume (for top keywords table)
export const getTopKeywordsByVolume = query({
  args: {
    domainId: v.id("domains"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const keywordsWithDataPromises = keywords.map(async (keyword) => {
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keyword._id))
        .order("desc")
        .take(8);

      if (positions.length === 0) return null;

      const current = positions[0];
      if (!current.searchVolume) return null;

      const previous = positions.find(p => p.date !== current.date);
      const change = previous?.position && current.position
        ? previous.position - current.position
        : null;

      return {
        keywordId: keyword._id,
        phrase: keyword.phrase,
        position: current.position,
        searchVolume: current.searchVolume,
        url: current.url,
        change,
        history: positions.slice(0, 7).reverse(),
      };
    });

    const keywordsWithData = (await Promise.all(keywordsWithDataPromises))
      .filter(k => k !== null)
      .sort((a, b) => b!.searchVolume! - a!.searchVolume!);

    return keywordsWithData.slice(0, limit);
  },
});

// Add keyword
export const addKeyword = mutation({
  args: {
    domainId: v.id("domains"),
    phrase: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // Check keyword limit
    const limitCheck = await checkKeywordLimit(ctx, args.domainId, 1);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.message || "Keyword limit exceeded");
    }

    // Check if keyword already exists
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("phrase"), args.phrase.toLowerCase().trim()))
      .unique();

    if (existing) {
      throw new Error("Keyword already exists");
    }

    return await ctx.db.insert("keywords", {
      domainId: args.domainId,
      phrase: args.phrase.toLowerCase().trim(),
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Add multiple keywords
export const addKeywords = mutation({
  args: {
    domainId: v.id("domains"),
    phrases: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    // Filter out existing keywords first to get accurate count
    const uniquePhrases: string[] = [];
    for (const phrase of args.phrases) {
      const normalized = phrase.toLowerCase().trim();
      if (!normalized) continue;

      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), normalized))
        .unique();

      if (!existing && !uniquePhrases.includes(normalized)) {
        uniquePhrases.push(normalized);
      }
    }

    // Check keyword limit for the batch
    if (uniquePhrases.length > 0) {
      const limitCheck = await checkKeywordLimit(ctx, args.domainId, uniquePhrases.length);
      if (!limitCheck.allowed) {
        const canAdd = limitCheck.remaining ?? 0;
        throw new Error(
          `Przekroczono limit fraz. Limit: ${limitCheck.limit}, obecnie: ${limitCheck.currentCount}, można dodać: ${canAdd}, próbujesz dodać: ${uniquePhrases.length}`
        );
      }
    }

    // Insert the unique phrases
    const results = [];
    for (const normalized of uniquePhrases) {
      const id = await ctx.db.insert("keywords", {
        domainId: args.domainId,
        phrase: normalized,
        status: "active",
        createdAt: Date.now(),
      });
      results.push(id);
    }

    return results;
  },
});

// Update keyword status
export const updateKeywordStatus = mutation({
  args: {
    keywordId: v.id("keywords"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("pending_approval")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromKeyword(ctx, args.keywordId);
    if (!context) {
      throw new Error("Keyword not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    await ctx.db.patch(args.keywordId, {
      status: args.status,
    });

    return args.keywordId;
  },
});

// Delete keyword
export const deleteKeyword = mutation({
  args: { keywordId: v.id("keywords") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromKeyword(ctx, args.keywordId);
    if (!context) {
      throw new Error("Keyword not found");
    }
    await requirePermission(ctx, "keywords.remove", context);

    // Delete positions
    const positions = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword", (q) => q.eq("keywordId", args.keywordId))
      .collect();

    for (const pos of positions) {
      await ctx.db.delete(pos._id);
    }

    await ctx.db.delete(args.keywordId);
  },
});

// Delete multiple keywords (bulk operation)
export const deleteKeywords = mutation({
  args: { keywordIds: v.array(v.id("keywords")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    for (const keywordId of args.keywordIds) {
      // Check permission for each keyword
      const context = await getContextFromKeyword(ctx, keywordId);
      if (!context) {
        continue; // Skip if keyword not found
      }
      await requirePermission(ctx, "keywords.remove", context);

      // Delete positions
      const positions = await ctx.db
        .query("keywordPositions")
        .withIndex("by_keyword", (q) => q.eq("keywordId", keywordId))
        .collect();

      for (const pos of positions) {
        await ctx.db.delete(pos._id);
      }

      await ctx.db.delete(keywordId);
    }
  },
});

// Store position data (called by DataForSEO integration)
export const storePosition = mutation({
  args: {
    keywordId: v.id("keywords"),
    date: v.string(),
    position: v.union(v.number(), v.null()),
    url: v.union(v.string(), v.null()),
    searchVolume: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    cpc: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if position for this date already exists
    const existing = await ctx.db
      .query("keywordPositions")
      .withIndex("by_keyword_date", (q) =>
        q.eq("keywordId", args.keywordId).eq("date", args.date)
      )
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        position: args.position,
        url: args.url,
        searchVolume: args.searchVolume,
        difficulty: args.difficulty,
        cpc: args.cpc,
        fetchedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("keywordPositions", {
      keywordId: args.keywordId,
      date: args.date,
      position: args.position,
      url: args.url,
      searchVolume: args.searchVolume,
      difficulty: args.difficulty,
      cpc: args.cpc,
      fetchedAt: Date.now(),
    });
  },
});

// Bulk import keywords with detailed results
export const importKeywords = mutation({
  args: {
    domainId: v.id("domains"),
    keywords: v.array(v.object({
      phrase: v.string(),
      searchEngine: v.optional(v.string()),
      location: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const context = await getContextFromDomain(ctx, args.domainId);
    if (!context) {
      throw new Error("Domain not found");
    }
    await requirePermission(ctx, "keywords.add", context);

    const results = {
      imported: [] as string[],
      duplicates: [] as string[],
      errors: [] as { phrase: string; error: string }[],
      total: args.keywords.length,
    };

    // Normalize and deduplicate input
    const uniquePhrases = new Map<string, typeof args.keywords[0]>();
    for (const kw of args.keywords) {
      const normalized = kw.phrase.toLowerCase().trim();
      if (!normalized) continue;
      if (!uniquePhrases.has(normalized)) {
        uniquePhrases.set(normalized, { ...kw, phrase: normalized });
      }
    }

    // Check for existing keywords
    const phrasesArray = Array.from(uniquePhrases.entries());
    for (const [normalized, kw] of phrasesArray) {
      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), normalized))
        .unique();

      if (existing) {
        results.duplicates.push(kw.phrase);
        uniquePhrases.delete(normalized);
      }
    }

    // Check keyword limit for remaining keywords
    const toImport = Array.from(uniquePhrases.values());
    if (toImport.length > 0) {
      const limitCheck = await checkKeywordLimit(ctx, args.domainId, toImport.length);
      if (!limitCheck.allowed) {
        const canAdd = limitCheck.remaining ?? 0;
        throw new Error(
          `Keyword limit exceeded. Limit: ${limitCheck.limit}, current: ${limitCheck.currentCount}, can add: ${canAdd}, trying to add: ${toImport.length}`
        );
      }
    }

    // Insert keywords
    for (const kw of toImport) {
      try {
        await ctx.db.insert("keywords", {
          domainId: args.domainId,
          phrase: kw.phrase,
          status: "active",
          createdAt: Date.now(),
        });
        results.imported.push(kw.phrase);
      } catch (error) {
        results.errors.push({
          phrase: kw.phrase,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});
