#!/usr/bin/env node
/**
 * Sync missing translation keys from EN locale to DE, ES, FR.
 * Missing keys get the EN value prefixed with "[DE] ", "[ES] ", "[FR] "
 * to mark them as needing professional translation.
 *
 * Preserves existing translations — only adds missing keys.
 * Handles nested objects recursively.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(__dirname, "../src/messages");

const LOCALES = [
  { code: "de", prefix: "[DE] " },
  { code: "es", prefix: "[ES] " },
  { code: "fr", prefix: "[FR] " },
];

function getAllKeys(obj, prefix = "") {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj, keyPath) {
  const parts = keyPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj, keyPath, value) {
  const parts = keyPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function prefixValue(value, prefix) {
  if (typeof value === "string") {
    return `${prefix}${value}`;
  }
  return value;
}

// Read EN namespace files
const enDir = path.join(messagesDir, "en");
const nsFiles = fs.readdirSync(enDir).filter((f) => f.endsWith(".json"));

let totalAdded = 0;

for (const nsFile of nsFiles) {
  const enData = JSON.parse(fs.readFileSync(path.join(enDir, nsFile), "utf-8"));
  const enKeys = getAllKeys(enData);

  for (const { code, prefix } of LOCALES) {
    const localeFile = path.join(messagesDir, code, nsFile);
    if (!fs.existsSync(localeFile)) {
      // If the entire file is missing, create it with all keys prefixed
      const localeData = {};
      for (const key of enKeys) {
        setNestedValue(localeData, key, prefixValue(getNestedValue(enData, key), prefix));
      }
      fs.writeFileSync(localeFile, JSON.stringify(localeData, null, 2) + "\n");
      console.log(`  Created ${code}/${nsFile} with ${enKeys.length} keys`);
      totalAdded += enKeys.length;
      continue;
    }

    const localeData = JSON.parse(fs.readFileSync(localeFile, "utf-8"));
    let added = 0;

    for (const key of enKeys) {
      const existing = getNestedValue(localeData, key);
      if (existing === undefined) {
        const enValue = getNestedValue(enData, key);
        setNestedValue(localeData, key, prefixValue(enValue, prefix));
        added++;
      }
    }

    if (added > 0) {
      fs.writeFileSync(localeFile, JSON.stringify(localeData, null, 2) + "\n");
      console.log(`  ${code}/${nsFile}: added ${added} missing keys`);
      totalAdded += added;
    }
  }
}

console.log(`\nDone. Total keys added: ${totalAdded}`);
