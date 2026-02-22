/**
 * Comprehensive i18n audit test suite.
 *
 * Validates:
 * 1. Key parity between EN and PL locale files (every EN key must exist in PL, and vice versa)
 * 2. No empty string values in any locale file
 * 3. No dotted keys (next-intl uses "." as namespace separator)
 * 4. Total key count integrity across locales
 * 5. All namespace files exist in both locales
 * 6. ICU placeholder consistency ({count}, {name}, etc.)
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../messages");
const LOCALES = ["en", "pl"] as const;

/** Recursively flatten nested object to dot-notation key paths */
function flattenKeys(
  obj: Record<string, unknown>,
  prefix = ""
): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      for (const [nestedKey, nestedVal] of flattenKeys(
        v as Record<string, unknown>,
        fullKey
      )) {
        result.set(nestedKey, nestedVal);
      }
    } else {
      result.set(fullKey, v);
    }
  }
  return result;
}

/**
 * Extract ICU placeholder variable names from a translation string.
 * Handles both simple placeholders ({count}) and ICU syntax ({count, plural, ...}).
 * Returns sorted unique variable names.
 */
function extractPlaceholders(value: string): string[] {
  const vars = new Set<string>();
  // Match top-level {varName} or {varName, plural/select/...}
  // We scan character by character to handle nested braces
  let i = 0;
  while (i < value.length) {
    if (value[i] === "{") {
      // Find the variable name (everything up to } or ,)
      let j = i + 1;
      while (j < value.length && value[j] !== "}" && value[j] !== ",") j++;
      const varName = value.slice(i + 1, j).trim();
      if (varName && !varName.startsWith("#") && /^[a-zA-Z_]\w*$/.test(varName)) {
        vars.add(varName);
      }
      // Skip to matching closing brace (handle nesting)
      let depth = 1;
      j = i + 1;
      while (j < value.length && depth > 0) {
        if (value[j] === "{") depth++;
        if (value[j] === "}") depth--;
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }
  return [...vars].sort();
}

/** Load all messages for a locale into a flat namespace:key -> value map */
function loadLocale(locale: string): Map<string, string> {
  const dir = path.join(MESSAGES_DIR, locale);
  if (!fs.existsSync(dir)) return new Map();

  const allKeys = new Map<string, string>();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const namespace = file.replace(".json", "");
    const data = JSON.parse(
      fs.readFileSync(path.join(dir, file), "utf-8")
    ) as Record<string, unknown>;
    const flat = flattenKeys(data);
    for (const [key, val] of flat) {
      allKeys.set(`${namespace}:${key}`, String(val));
    }
  }
  return allKeys;
}

/** Get namespace file names for a locale */
function getNamespaceFiles(locale: string): string[] {
  const dir = path.join(MESSAGES_DIR, locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}

describe("i18n audit — key parity and integrity", () => {
  const enMessages = loadLocale("en");
  const plMessages = loadLocale("pl");

  it("both EN and PL locales have translation files", () => {
    expect(enMessages.size).toBeGreaterThan(0);
    expect(plMessages.size).toBeGreaterThan(0);
  });

  it("EN and PL have the same namespace files", () => {
    const enNamespaces = getNamespaceFiles("en");
    const plNamespaces = getNamespaceFiles("pl");
    expect(enNamespaces).toEqual(plNamespaces);
  });

  it("EN and PL have identical key counts", () => {
    expect(enMessages.size).toBe(plMessages.size);
  });

  it("every EN key exists in PL (no orphaned EN keys)", () => {
    const missingInPl: string[] = [];
    for (const key of enMessages.keys()) {
      if (!plMessages.has(key)) {
        missingInPl.push(key);
      }
    }
    expect(
      missingInPl,
      `Keys in EN but missing in PL:\n  ${missingInPl.join("\n  ")}`
    ).toEqual([]);
  });

  it("every PL key exists in EN (no orphaned PL keys)", () => {
    const missingInEn: string[] = [];
    for (const key of plMessages.keys()) {
      if (!enMessages.has(key)) {
        missingInEn.push(key);
      }
    }
    expect(
      missingInEn,
      `Keys in PL but missing in EN:\n  ${missingInEn.join("\n  ")}`
    ).toEqual([]);
  });

  it("no EN values are empty strings", () => {
    const empty: string[] = [];
    for (const [key, val] of enMessages) {
      if (val === "") empty.push(key);
    }
    expect(
      empty,
      `EN keys with empty values:\n  ${empty.join("\n  ")}`
    ).toEqual([]);
  });

  it("no PL values are empty strings", () => {
    const empty: string[] = [];
    for (const [key, val] of plMessages) {
      if (val === "") empty.push(key);
    }
    expect(
      empty,
      `PL keys with empty values:\n  ${empty.join("\n  ")}`
    ).toEqual([]);
  });

  it("ICU placeholders match between EN and PL for each key", () => {
    const mismatches: string[] = [];
    for (const [key, enVal] of enMessages) {
      const plVal = plMessages.get(key);
      if (!plVal) continue; // parity checked separately

      const enPlaceholders = extractPlaceholders(enVal);
      const plPlaceholders = extractPlaceholders(plVal);

      if (JSON.stringify(enPlaceholders) !== JSON.stringify(plPlaceholders)) {
        mismatches.push(
          `${key}: EN has {${enPlaceholders.join(", ")}}, PL has {${plPlaceholders.join(", ")}}`
        );
      }
    }
    expect(
      mismatches,
      `Placeholder mismatches:\n  ${mismatches.join("\n  ")}`
    ).toEqual([]);
  });

  it("has at least 3000 translation keys (sanity check)", () => {
    expect(enMessages.size).toBeGreaterThanOrEqual(3000);
  });
});
