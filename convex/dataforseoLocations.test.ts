import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { buildLocationParam, LOCATION_CODE_MAP } from "./dataforseoLocations";

const modules = import.meta.glob("./**/*.ts");

// ===========================================================================
// buildLocationParam (pure function — no Convex needed)
// ===========================================================================

describe("buildLocationParam", () => {
  test("returns location_code for known country", () => {
    const result = buildLocationParam("United States");
    expect(result).toEqual({ location_code: 2840 });
  });

  test("returns location_code for Poland", () => {
    const result = buildLocationParam("Poland");
    expect(result).toEqual({ location_code: 2616 });
  });

  test("returns location_name for unknown country", () => {
    const result = buildLocationParam("Narnia");
    expect(result).toEqual({ location_name: "Narnia" });
  });

  test("returns location_name for empty string", () => {
    const result = buildLocationParam("");
    expect(result).toEqual({ location_name: "" });
  });

  test("is case-sensitive (lowercase fails lookup)", () => {
    const result = buildLocationParam("united states");
    expect(result).toEqual({ location_name: "united states" });
  });
});

// ===========================================================================
// LOCATION_CODE_MAP
// ===========================================================================

describe("LOCATION_CODE_MAP", () => {
  test("contains expected number of entries", () => {
    const keys = Object.keys(LOCATION_CODE_MAP);
    expect(keys.length).toBeGreaterThanOrEqual(50);
  });

  test("all values are positive numbers", () => {
    for (const [, code] of Object.entries(LOCATION_CODE_MAP)) {
      expect(typeof code).toBe("number");
      expect(code).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// cacheLocations (internal mutation)
// ===========================================================================

describe("dataforseoLocations.cacheLocations", () => {
  test("inserts cache entry when none exists", async () => {
    const t = convexTest(schema, modules);

    const data = JSON.stringify([
      { location_code: 2840, location_name: "United States", country_iso_code: "US" },
    ]);

    await t.mutation(internal.dataforseoLocations.cacheLocations, {
      locations: data,
    });

    const result = await t.query(api.dataforseoLocations.getLocations, {});
    expect(result).toHaveLength(1);
    expect(result[0].location_name).toBe("United States");
  });

  test("updates existing cache entry (upsert)", async () => {
    const t = convexTest(schema, modules);

    const data1 = JSON.stringify([
      { location_code: 2840, location_name: "United States", country_iso_code: "US" },
    ]);
    await t.mutation(internal.dataforseoLocations.cacheLocations, {
      locations: data1,
    });

    const data2 = JSON.stringify([
      { location_code: 2840, location_name: "United States", country_iso_code: "US" },
      { location_code: 2826, location_name: "United Kingdom", country_iso_code: "GB" },
    ]);
    await t.mutation(internal.dataforseoLocations.cacheLocations, {
      locations: data2,
    });

    const result = await t.query(api.dataforseoLocations.getLocations, {});
    expect(result).toHaveLength(2);
  });
});

// ===========================================================================
// cacheLanguages (internal mutation)
// ===========================================================================

describe("dataforseoLocations.cacheLanguages", () => {
  test("inserts cache entry when none exists", async () => {
    const t = convexTest(schema, modules);

    const data = JSON.stringify([
      { language_code: "en", language_name: "English" },
    ]);

    await t.mutation(internal.dataforseoLocations.cacheLanguages, {
      languages: data,
    });

    const result = await t.query(api.dataforseoLocations.getLanguages, {});
    expect(result).toHaveLength(1);
    expect(result[0].language_name).toBe("English");
  });

  test("updates existing cache entry (upsert)", async () => {
    const t = convexTest(schema, modules);

    const data1 = JSON.stringify([
      { language_code: "en", language_name: "English" },
    ]);
    await t.mutation(internal.dataforseoLocations.cacheLanguages, {
      languages: data1,
    });

    const data2 = JSON.stringify([
      { language_code: "en", language_name: "English" },
      { language_code: "pl", language_name: "Polish" },
    ]);
    await t.mutation(internal.dataforseoLocations.cacheLanguages, {
      languages: data2,
    });

    const result = await t.query(api.dataforseoLocations.getLanguages, {});
    expect(result).toHaveLength(2);
  });
});

// ===========================================================================
// getLocations (public query)
// ===========================================================================

describe("dataforseoLocations.getLocations", () => {
  test("returns empty array when cache is empty", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.dataforseoLocations.getLocations, {});
    expect(result).toEqual([]);
  });

  test("returns parsed locations from cache", async () => {
    const t = convexTest(schema, modules);

    const locations = [
      { location_code: 2840, location_name: "United States", country_iso_code: "US" },
      { location_code: 2616, location_name: "Poland", country_iso_code: "PL" },
    ];
    await t.mutation(internal.dataforseoLocations.cacheLocations, {
      locations: JSON.stringify(locations),
    });

    const result = await t.query(api.dataforseoLocations.getLocations, {});
    expect(result).toHaveLength(2);
    expect(result[0].location_code).toBe(2840);
    expect(result[1].country_iso_code).toBe("PL");
  });
});

// ===========================================================================
// getLanguages (public query)
// ===========================================================================

describe("dataforseoLocations.getLanguages", () => {
  test("returns empty array when cache is empty", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.dataforseoLocations.getLanguages, {});
    expect(result).toEqual([]);
  });

  test("returns parsed languages from cache", async () => {
    const t = convexTest(schema, modules);

    const languages = [
      { language_code: "en", language_name: "English" },
      { language_code: "de", language_name: "German" },
    ];
    await t.mutation(internal.dataforseoLocations.cacheLanguages, {
      languages: JSON.stringify(languages),
    });

    const result = await t.query(api.dataforseoLocations.getLanguages, {});
    expect(result).toHaveLength(2);
    expect(result[0].language_code).toBe("en");
    expect(result[1].language_name).toBe("German");
  });
});
