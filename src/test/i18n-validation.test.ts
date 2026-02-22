/**
 * Validates i18n message files for common mistakes that cause runtime errors.
 *
 * Catches:
 *  - Dotted keys (next-intl uses "." as namespace separator)
 *  - Missing keys between EN and PL (parity check)
 *  - Empty string values (likely forgotten translations)
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../messages");
const LOCALES = ["en", "pl", "de", "es", "fr"] as const;

// Discover all namespace files from the EN directory (source of truth)
const namespaces = fs
  .readdirSync(path.join(MESSAGES_DIR, "en"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

/** Recursively collect all key paths in a nested object */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeyPaths(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Check if any direct key at any nesting level contains a dot */
function findDottedKeys(obj: Record<string, unknown>, path = ""): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.includes(".")) {
      bad.push(path ? `${path} → "${k}"` : `"${k}"`);
    }
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      bad.push(...findDottedKeys(v as Record<string, unknown>, path ? `${path}.${k}` : k));
    }
  }
  return bad;
}

describe("i18n message files", () => {
  for (const ns of namespaces) {
    describe(ns, () => {
      const files: Record<string, Record<string, unknown>> = {};

      for (const locale of LOCALES) {
        const filePath = path.join(MESSAGES_DIR, locale, `${ns}.json`);
        if (fs.existsSync(filePath)) {
          files[locale] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      }

      it("has no dotted keys (next-intl uses '.' as namespace separator)", () => {
        for (const [locale, data] of Object.entries(files)) {
          const dotted = findDottedKeys(data);
          expect(dotted, `${locale}/${ns}.json has dotted keys: ${dotted.join(", ")}`).toEqual([]);
        }
      });

      for (const locale of LOCALES) {
        if (locale === "en") continue;
        it(`EN and ${locale.toUpperCase()} have the same key paths`, () => {
          if (!files.en || !files[locale]) return; // skip if locale file missing

          const enKeys = new Set(collectKeyPaths(files.en));
          const localeKeys = new Set(collectKeyPaths(files[locale]));

          const missingInLocale = [...enKeys].filter((k) => !localeKeys.has(k));
          const missingInEn = [...localeKeys].filter((k) => !enKeys.has(k));

          expect(missingInLocale, `Keys in EN but missing in ${locale.toUpperCase()}: ${missingInLocale.join(", ")}`).toEqual([]);
          expect(missingInEn, `Keys in ${locale.toUpperCase()} but missing in EN: ${missingInEn.join(", ")}`).toEqual([]);
        });
      }

      it("has no empty string values", () => {
        for (const [locale, data] of Object.entries(files)) {
          const allKeys = collectKeyPaths(data);
          const empty = allKeys.filter((keyPath) => {
            const parts = keyPath.split(".");
            let val: unknown = data;
            for (const p of parts) val = (val as Record<string, unknown>)[p];
            return val === "";
          });
          expect(empty, `${locale}/${ns}.json has empty values: ${empty.join(", ")}`).toEqual([]);
        }
      });
    });
  }
});
