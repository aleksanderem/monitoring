/**
 * R33: Multi-Language Expansion Tests
 *
 * Validates that German (de), Spanish (es), and French (fr) translations
 * are correctly structured, complete, and registered in the i18n config.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const NEW_LOCALES = ["de", "es", "fr"] as const;
const ALL_LOCALES = ["en", "pl", "de", "es", "fr"] as const;

// EN namespaces (source of truth)
const EN_DIR = path.join(MESSAGES_DIR, "en");
const enFiles = fs
  .readdirSync(EN_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();
const enNamespaces = enFiles.map((f) => f.replace(".json", ""));

/** Recursively collect all key paths in a nested object */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys.push(
        ...collectKeyPaths(v as Record<string, unknown>, fullKey)
      );
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Get the value at a dot-separated key path */
function getValueAtPath(
  obj: Record<string, unknown>,
  keyPath: string
): unknown {
  const parts = keyPath.split(".");
  let val: unknown = obj;
  for (const p of parts) {
    if (typeof val !== "object" || val === null) return undefined;
    val = (val as Record<string, unknown>)[p];
  }
  return val;
}

describe("R33: Multi-Language Expansion", () => {
  describe("locale directories exist", () => {
    for (const locale of NEW_LOCALES) {
      it(`src/messages/${locale}/ directory exists`, () => {
        const localeDir = path.join(MESSAGES_DIR, locale);
        expect(fs.existsSync(localeDir)).toBe(true);
        expect(fs.statSync(localeDir).isDirectory()).toBe(true);
      });
    }
  });

  describe("each new locale has all 16 files matching EN", () => {
    for (const locale of NEW_LOCALES) {
      it(`${locale} has all ${enFiles.length} translation files`, () => {
        const localeDir = path.join(MESSAGES_DIR, locale);
        const localeFiles = fs
          .readdirSync(localeDir)
          .filter((f) => f.endsWith(".json"))
          .sort();
        expect(localeFiles).toEqual(enFiles);
      });
    }
  });

  describe("key counts match between EN and each new locale", () => {
    for (const ns of ["common", "nav", "admin", "jobs", "share"]) {
      for (const locale of NEW_LOCALES) {
        it(`${locale}/${ns}.json has same key count as EN`, () => {
          const enPath = path.join(EN_DIR, `${ns}.json`);
          const localePath = path.join(MESSAGES_DIR, locale, `${ns}.json`);
          const enData = JSON.parse(fs.readFileSync(enPath, "utf-8"));
          const localeData = JSON.parse(
            fs.readFileSync(localePath, "utf-8")
          );
          const enKeys = collectKeyPaths(enData);
          const localeKeys = collectKeyPaths(localeData);
          expect(localeKeys.length).toBe(enKeys.length);
        });
      }
    }
  });

  describe("key paths match exactly between EN and new locales", () => {
    for (const ns of enNamespaces) {
      for (const locale of NEW_LOCALES) {
        it(`${locale}/${ns}.json has identical key paths to EN`, () => {
          const enPath = path.join(EN_DIR, `${ns}.json`);
          const localePath = path.join(MESSAGES_DIR, locale, `${ns}.json`);
          if (!fs.existsSync(localePath)) {
            throw new Error(`Missing file: ${locale}/${ns}.json`);
          }
          const enData = JSON.parse(fs.readFileSync(enPath, "utf-8"));
          const localeData = JSON.parse(
            fs.readFileSync(localePath, "utf-8")
          );
          const enKeys = new Set(collectKeyPaths(enData));
          const localeKeys = new Set(collectKeyPaths(localeData));

          const missingInLocale = [...enKeys].filter(
            (k) => !localeKeys.has(k)
          );
          const extraInLocale = [...localeKeys].filter(
            (k) => !enKeys.has(k)
          );

          expect(
            missingInLocale,
            `Keys in EN but missing in ${locale}/${ns}.json: ${missingInLocale.slice(0, 5).join(", ")}`
          ).toEqual([]);
          expect(
            extraInLocale,
            `Extra keys in ${locale}/${ns}.json: ${extraInLocale.slice(0, 5).join(", ")}`
          ).toEqual([]);
        });
      }
    }
  });

  describe("no translation values are empty strings", () => {
    for (const locale of NEW_LOCALES) {
      it(`${locale} has no empty string values across all files`, () => {
        const localeDir = path.join(MESSAGES_DIR, locale);
        const emptyKeys: string[] = [];

        for (const file of enFiles) {
          const filePath = path.join(localeDir, file);
          if (!fs.existsSync(filePath)) continue;
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const keys = collectKeyPaths(data);
          for (const key of keys) {
            const val = getValueAtPath(data, key);
            if (val === "") {
              emptyKeys.push(`${file}:${key}`);
            }
          }
        }

        expect(
          emptyKeys,
          `${locale} has empty string values: ${emptyKeys.slice(0, 10).join(", ")}`
        ).toEqual([]);
      });
    }
  });

  describe("i18n config includes all 5 locales", () => {
    it("config.ts exports all locales", async () => {
      const configPath = path.resolve(
        __dirname,
        "../../i18n/config.ts"
      );
      const content = fs.readFileSync(configPath, "utf-8");
      for (const locale of ALL_LOCALES) {
        expect(content).toContain(`"${locale}"`);
      }
    });

    it("config.ts has localeNames for all locales", () => {
      const configPath = path.resolve(
        __dirname,
        "../../i18n/config.ts"
      );
      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toContain("Deutsch");
      expect(content).toContain("Español");
      expect(content).toContain("Français");
    });

    it("config.ts has localeFlags for all locales", () => {
      const configPath = path.resolve(
        __dirname,
        "../../i18n/config.ts"
      );
      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toContain('"DE"');
      expect(content).toContain('"ES"');
      expect(content).toContain('"FR"');
    });
  });

  describe("translation files are valid JSON", () => {
    for (const locale of NEW_LOCALES) {
      it(`all ${locale} files parse as valid JSON`, () => {
        const localeDir = path.join(MESSAGES_DIR, locale);
        for (const file of enFiles) {
          const filePath = path.join(localeDir, file);
          expect(() => {
            JSON.parse(fs.readFileSync(filePath, "utf-8"));
          }).not.toThrow();
        }
      });
    }
  });

  describe("ICU message format placeholders preserved", () => {
    it("simple placeholder variable names in EN are preserved in all new locales", () => {
      // Match simple placeholders {name} and extract variable names from
      // complex ICU expressions like {count, plural, ...}
      const simplePhPattern = /\{([a-zA-Z_]+)\}/g;
      const icuVarPattern = /\{([a-zA-Z_]+),\s*(?:plural|select|selectordinal)/g;

      function extractVarNames(str: string): string[] {
        const vars = new Set<string>();
        let m: RegExpExecArray | null;
        simplePhPattern.lastIndex = 0;
        while ((m = simplePhPattern.exec(str)) !== null) {
          vars.add(m[1]);
        }
        icuVarPattern.lastIndex = 0;
        while ((m = icuVarPattern.exec(str)) !== null) {
          vars.add(m[1]);
        }
        return [...vars].sort();
      }

      for (const ns of enNamespaces) {
        const enData = JSON.parse(
          fs.readFileSync(path.join(EN_DIR, `${ns}.json`), "utf-8")
        );
        const enKeys = collectKeyPaths(enData);

        for (const locale of NEW_LOCALES) {
          const localePath = path.join(
            MESSAGES_DIR,
            locale,
            `${ns}.json`
          );
          if (!fs.existsSync(localePath)) continue;
          const localeData = JSON.parse(
            fs.readFileSync(localePath, "utf-8")
          );

          for (const key of enKeys) {
            const enVal = getValueAtPath(enData, key);
            const localeVal = getValueAtPath(localeData, key);
            if (typeof enVal !== "string" || typeof localeVal !== "string")
              continue;

            const enVars = extractVarNames(enVal);
            const localeVars = extractVarNames(localeVal);

            for (const varName of enVars) {
              expect(
                localeVars,
                `${locale}/${ns}.json key "${key}" is missing placeholder variable {${varName}}`
              ).toContain(varName);
            }
          }
        }
      }
    });
  });
});
