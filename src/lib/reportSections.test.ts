import { describe, it, expect } from "vitest";
import {
  SECTION_REGISTRY,
  PRESET_PROFILES,
  configFromPreset,
  resolveConfig,
} from "./reportSections";

describe("SECTION_REGISTRY", () => {
  it("has 7 sections", () => {
    expect(SECTION_REGISTRY).toHaveLength(7);
  });

  it("every section has id, labelKey, and subElements array", () => {
    for (const sec of SECTION_REGISTRY) {
      expect(sec).toHaveProperty("id");
      expect(sec).toHaveProperty("labelKey");
      expect(Array.isArray(sec.subElements)).toBe(true);
    }
  });

  it("executive section has 2 sub-elements", () => {
    const exec = SECTION_REGISTRY.find((s) => s.id === "executive");
    expect(exec).toBeDefined();
    expect(exec!.subElements).toHaveLength(2);
  });

  it("keywords section has 5 sub-elements", () => {
    const kw = SECTION_REGISTRY.find((s) => s.id === "keywords");
    expect(kw).toBeDefined();
    expect(kw!.subElements).toHaveLength(5);
  });
});

describe("PRESET_PROFILES", () => {
  it("quick preset includes only executive", () => {
    expect(PRESET_PROFILES.quick.sectionIds).toEqual(["executive"]);
  });

  it("standard preset includes 4 sections", () => {
    expect(PRESET_PROFILES.standard.sectionIds).toHaveLength(4);
  });

  it("full preset includes all 7 sections", () => {
    expect(PRESET_PROFILES.full.sectionIds).toHaveLength(7);
  });
});

describe("configFromPreset", () => {
  it("quick preset returns config with all 7 sections, only executive enabled", () => {
    const config = configFromPreset("quick");
    expect(config.sections).toHaveLength(7);
    const enabled = config.sections.filter((s) => s.enabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0].id).toBe("executive");
  });

  it("full preset returns config with all 7 sections enabled", () => {
    const config = configFromPreset("full");
    expect(config.sections).toHaveLength(7);
    expect(config.sections.every((s) => s.enabled)).toBe(true);
  });
});

describe("resolveConfig", () => {
  it("always includes cover and toc in enabledSections", () => {
    const config = configFromPreset("quick");
    const resolved = resolveConfig(config);
    expect(resolved.enabledSections.has("cover")).toBe(true);
    expect(resolved.enabledSections.has("toc")).toBe(true);
  });

  it("returns orderedSections matching config order", () => {
    const config = configFromPreset("standard");
    const resolved = resolveConfig(config);
    expect(resolved.orderedSections).toEqual(
      config.sections.map((s) => s.id)
    );
  });

  it("includes subElements when provided in config", () => {
    const config = configFromPreset("quick");
    config.sections[0].subElements = { healthBreakdown: true, keyMetrics: false };
    const resolved = resolveConfig(config);
    expect(resolved.subElements["executive"]).toEqual({
      healthBreakdown: true,
      keyMetrics: false,
    });
  });

  it("disabled sections are not in enabledSections", () => {
    const config = configFromPreset("quick");
    const resolved = resolveConfig(config);
    const disabledIds = config.sections
      .filter((s) => !s.enabled)
      .map((s) => s.id);
    for (const id of disabledIds) {
      expect(resolved.enabledSections.has(id)).toBe(false);
    }
  });
});
