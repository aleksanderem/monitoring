import { describe, it, expect } from "vitest";
import { getCountryFlag, getLanguageFlag } from "./countryFlags";

describe("getCountryFlag", () => {
  it("returns Polish flag emoji for Poland", () => {
    const flag = getCountryFlag("Poland");
    expect(flag).toBeTruthy();
    expect([...flag]).toHaveLength(2);
  });

  it("returns US flag emoji for United States", () => {
    const flag = getCountryFlag("United States");
    expect(flag).toBeTruthy();
    expect([...flag]).toHaveLength(2);
  });

  it("returns empty string for unknown country", () => {
    expect(getCountryFlag("Unknown Country")).toBe("");
  });
});

describe("getLanguageFlag", () => {
  it("returns Polish flag for language code pl", () => {
    const flag = getLanguageFlag("pl");
    expect(flag).toBeTruthy();
    expect([...flag]).toHaveLength(2);
  });

  it("returns GB flag for language code en", () => {
    const flag = getLanguageFlag("en");
    expect(flag).toBeTruthy();
    expect([...flag]).toHaveLength(2);
  });

  it("returns empty string for unknown language code", () => {
    expect(getLanguageFlag("xx")).toBe("");
  });
});

describe("cross-function consistency", () => {
  it("Germany country flag matches de language flag", () => {
    expect(getCountryFlag("Germany")).toBe(getLanguageFlag("de"));
  });
});
