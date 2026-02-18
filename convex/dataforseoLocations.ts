import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// =================================================================
// Shared Location Code Map (fallback when cache is not populated)
// =================================================================

export const LOCATION_CODE_MAP: Record<string, number> = {
  "Poland": 2616,
  "United States": 2840,
  "United Kingdom": 2826,
  "Germany": 2276,
  "France": 2250,
  "Spain": 2724,
  "Italy": 2380,
  "Netherlands": 2528,
  "Canada": 2124,
  "Australia": 2036,
  "Brazil": 2076,
  "Japan": 2392,
  "India": 2356,
  "Mexico": 2484,
  "Sweden": 2752,
  "Norway": 2578,
  "Denmark": 2208,
  "Finland": 2246,
  "Czech Republic": 2203,
  "Austria": 2040,
  "Switzerland": 2756,
  "Belgium": 2056,
  "Portugal": 2620,
  "Ireland": 2372,
  "Romania": 2642,
  "Hungary": 2348,
  "Turkey": 2792,
  "South Korea": 2410,
  "Argentina": 2032,
  "Chile": 2152,
  "Colombia": 2170,
  "Ukraine": 2804,
  "Thailand": 2764,
  "Indonesia": 2360,
  "Philippines": 2608,
  "Vietnam": 2704,
  "Malaysia": 2458,
  "Singapore": 2702,
  "New Zealand": 2554,
  "South Africa": 2710,
  "Israel": 2376,
  "United Arab Emirates": 2784,
  "Saudi Arabia": 2682,
  "Greece": 2300,
  "Croatia": 2191,
  "Slovakia": 2703,
  "Bulgaria": 2100,
  "Lithuania": 2440,
  "Latvia": 2428,
  "Estonia": 2233,
  "Slovenia": 2705,
};

/**
 * Build the location parameter object for DataForSEO API calls.
 * Prefers location_code (more reliable) with fallback to location_name.
 */
export function buildLocationParam(locationName: string): { location_code: number } | { location_name: string } {
  const code = LOCATION_CODE_MAP[locationName];
  return code ? { location_code: code } : { location_name: locationName };
}

// ============================================================
// Internal Mutations — upsert into cache table
// ============================================================

export const cacheLocations = internalMutation({
  args: {
    locations: v.string(), // JSON stringified array
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dataforseoCache")
      .withIndex("by_key", (q) => q.eq("key", "locations"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.locations,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dataforseoCache", {
        key: "locations",
        data: args.locations,
        updatedAt: Date.now(),
      });
    }
  },
});

export const cacheLanguages = internalMutation({
  args: {
    languages: v.string(), // JSON stringified array
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dataforseoCache")
      .withIndex("by_key", (q) => q.eq("key", "languages"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.languages,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dataforseoCache", {
        key: "languages",
        data: args.languages,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================================
// Public Queries — read from cache
// ============================================================

export const getLocations = query({
  args: {},
  handler: async (
    ctx
  ): Promise<
    Array<{ location_code: number; location_name: string; country_iso_code: string }>
  > => {
    const cached = await ctx.db
      .query("dataforseoCache")
      .withIndex("by_key", (q) => q.eq("key", "locations"))
      .first();

    if (!cached) return [];

    return JSON.parse(cached.data);
  },
});

export const getLanguages = query({
  args: {},
  handler: async (
    ctx
  ): Promise<Array<{ language_code: string; language_name: string }>> => {
    const cached = await ctx.db
      .query("dataforseoCache")
      .withIndex("by_key", (q) => q.eq("key", "languages"))
      .first();

    if (!cached) return [];

    return JSON.parse(cached.data);
  },
});
