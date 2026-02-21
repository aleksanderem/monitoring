"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ImportWizardModal, type ImportResult } from "./ImportWizardModal";
import type { FieldDefinition } from "@/utils/csvParser";
import { useCallback } from "react";

const KEYWORD_FIELDS: FieldDefinition[] = [
  { key: "phrase", label: "Keyword Phrase", required: true, aliases: ["keyword", "query", "term", "search term", "keyphrase"] },
  { key: "searchVolume", label: "Search Volume", aliases: ["volume", "monthly searches", "avg monthly searches", "search_volume"] },
  { key: "difficulty", label: "Difficulty", aliases: ["kd", "keyword difficulty", "seo difficulty"] },
  { key: "tags", label: "Tags", aliases: ["tag", "labels", "categories", "group"] },
  { key: "keywordType", label: "Keyword Type", aliases: ["type", "intent type"] },
];

const BATCH_SIZE = 100;

interface KeywordImportModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordImportModal({ domainId, isOpen, onClose }: KeywordImportModalProps) {
  const addKeywords = useMutation(api.keywords.addKeywords);

  const validateRow = useCallback((row: Record<string, string>): string | null => {
    const phrase = row.phrase?.trim();
    if (!phrase) return "Missing keyword phrase";
    if (phrase.length < 2) return "Keyword too short (min 2 chars)";
    if (phrase.length > 80) return "Keyword too long (max 80 chars)";
    if (/^https?:\/\//i.test(phrase)) return "Looks like a URL, not a keyword";
    if (/^[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(phrase) && !phrase.includes(" ")) return "Looks like a domain";
    if (/^\d+$/.test(phrase)) return "Pure numbers are not valid keywords";
    return null;
  }, []);

  const handleImport = useCallback(
    async (rows: Record<string, string>[]): Promise<ImportResult> => {
      const phrases = rows.map((r) => r.phrase.trim().toLowerCase()).filter(Boolean);
      let totalImported = 0;
      let totalSkipped = 0;
      const errors: string[] = [];

      // Batch in chunks of BATCH_SIZE
      for (let i = 0; i < phrases.length; i += BATCH_SIZE) {
        const batch = phrases.slice(i, i + BATCH_SIZE);
        try {
          const result = await addKeywords({
            domainId,
            phrases: batch,
            source: "csv_import",
          });
          totalImported += (result as any)?.added ?? batch.length;
          totalSkipped += (result as any)?.skipped ?? 0;
        } catch (err) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${(err as Error).message}`);
        }
      }

      return { imported: totalImported, skipped: totalSkipped, errors };
    },
    [domainId, addKeywords]
  );

  return (
    <ImportWizardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Keywords from CSV"
      fields={KEYWORD_FIELDS}
      validateRow={validateRow}
      onImport={handleImport}
      maxRows={10000}
    />
  );
}
