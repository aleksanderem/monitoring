/**
 * Missing Translations Test
 *
 * Scans all TSX components for useTranslations() calls and t('key') usage,
 * then verifies every referenced key exists in the corresponding EN and PL
 * message files. Catches MISSING_MESSAGE errors before they hit production.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { glob } from "glob";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const SRC_DIR = path.resolve(__dirname, "../..");

// Languages to check (must have complete coverage)
const REQUIRED_LANGS = ["en", "pl"];

function loadMessages(lang: string, namespace: string): Record<string, unknown> {
  const filePath = path.join(MESSAGES_DIR, lang, `${namespace}.json`);
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const nested of flattenKeys(value as Record<string, unknown>, full)) {
        keys.add(nested);
      }
    } else {
      keys.add(full);
    }
  }
  return keys;
}

interface TranslationUsage {
  file: string;
  namespace: string;
  key: string;
  line: number;
}

function extractTranslationUsages(filePath: string): TranslationUsage[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const usages: TranslationUsage[] = [];

  // Find all useTranslations('namespace') calls and track which variable they assign to
  const hookPattern = /const\s+(\w+)\s*=\s*useTranslations\(\s*['"](\w+)['"]\s*\)/g;
  const varToNamespace = new Map<string, string>();

  for (const match of content.matchAll(hookPattern)) {
    varToNamespace.set(match[1], match[2]);
  }

  if (varToNamespace.size === 0) return usages;

  // Find all t('key'), tc('key'), tX('key') calls
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [varName, namespace] of varToNamespace) {
      // Match: varName('keyName') or varName('keyName', ...)
      // Skip dynamic keys like t(someVariable) or t(`template`)
      const callPattern = new RegExp(`\\b${varName}\\(\\s*['"]([a-zA-Z0-9_.]+)['"]`, "g");
      for (const match of line.matchAll(callPattern)) {
        usages.push({
          file: filePath,
          namespace,
          key: match[1],
          line: i + 1,
        });
      }
    }
  }

  return usages;
}

describe("Translation completeness", () => {
  // Collect all TSX files
  const tsxFiles = glob.sync("**/*.tsx", {
    cwd: SRC_DIR,
    absolute: true,
    ignore: ["**/node_modules/**", "**/.next/**", "**/test/**", "**/*.test.*"],
  });

  // Extract all translation key usages from components
  const allUsages: TranslationUsage[] = [];
  for (const file of tsxFiles) {
    allUsages.push(...extractTranslationUsages(file));
  }

  // Group by namespace
  const byNamespace = new Map<string, TranslationUsage[]>();
  for (const usage of allUsages) {
    const list = byNamespace.get(usage.namespace) ?? [];
    list.push(usage);
    byNamespace.set(usage.namespace, list);
  }

  for (const lang of REQUIRED_LANGS) {
    describe(`[${lang}] all referenced keys exist`, () => {
      for (const [namespace, usages] of byNamespace) {
        it(`${namespace}.json has all keys used in components`, () => {
          const messages = loadMessages(lang, namespace);
          const availableKeys = flattenKeys(messages);
          const missing: string[] = [];

          // Deduplicate
          const checked = new Set<string>();
          for (const usage of usages) {
            if (checked.has(usage.key)) continue;
            checked.add(usage.key);

            if (!availableKeys.has(usage.key)) {
              const relFile = path.relative(SRC_DIR, usage.file);
              missing.push(`  "${usage.key}" (used in ${relFile}:${usage.line})`);
            }
          }

          if (missing.length > 0) {
            expect.fail(
              `Missing ${missing.length} key(s) in ${lang}/${namespace}.json:\n${missing.join("\n")}`
            );
          }
        });
      }
    });
  }
});
