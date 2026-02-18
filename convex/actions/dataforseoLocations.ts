"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

/**
 * Fetch all Google SERP locations from DataForSEO.
 * Filters to country-level only, then stores in cache.
 */
export const fetchLocations = internalAction({
  args: {},
  handler: async (ctx) => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars required");
    }

    const authHeader = Buffer.from(`${login}:${password}`).toString("base64");

    const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/locations`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      throw new Error(`DataForSEO locations API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status_code !== 20000 || !data.tasks?.[0]?.result) {
      throw new Error(data.status_message || "No location results");
    }

    const allLocations: Array<{
      location_code: number;
      location_name: string;
      country_iso_code: string;
      location_type: string;
    }> = data.tasks[0].result;

    // Filter to countries only (the dropdown needs ~200 countries, not 100K+ cities)
    const countries = allLocations
      .filter((loc) => loc.location_type === "Country")
      .map((loc) => ({
        location_code: loc.location_code,
        location_name: loc.location_name,
        country_iso_code: loc.country_iso_code,
      }))
      .sort((a, b) => a.location_name.localeCompare(b.location_name));

    // Store in cache
    await ctx.runMutation(internal.dataforseoLocations.cacheLocations, {
      locations: JSON.stringify(countries),
    });

    return { count: countries.length };
  },
});

/**
 * Fetch all Google SERP languages from DataForSEO.
 */
export const fetchLanguages = internalAction({
  args: {},
  handler: async (ctx) => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars required");
    }

    const authHeader = Buffer.from(`${login}:${password}`).toString("base64");

    const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/languages`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      throw new Error(`DataForSEO languages API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status_code !== 20000 || !data.tasks?.[0]?.result) {
      throw new Error(data.status_message || "No language results");
    }

    const languages: Array<{ language_code: string; language_name: string }> =
      data.tasks[0].result.map(
        (lang: { language_code: string; language_name: string }) => ({
          language_code: lang.language_code,
          language_name: lang.language_name,
        })
      );

    languages.sort((a, b) => a.language_name.localeCompare(b.language_name));

    // Store in cache
    await ctx.runMutation(internal.dataforseoLocations.cacheLanguages, {
      languages: JSON.stringify(languages),
    });

    return { count: languages.length };
  },
});

/**
 * Public action to refresh both locations and languages cache.
 */
export const refreshLocationsCache = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; locations: number; languages: number }> => {
    const [locResult, langResult]: [{ count: number }, { count: number }] = await Promise.all([
      ctx.runAction(internal.actions.dataforseoLocations.fetchLocations, {}),
      ctx.runAction(internal.actions.dataforseoLocations.fetchLanguages, {}),
    ]);

    return {
      success: true,
      locations: locResult.count,
      languages: langResult.count,
    };
  },
});
