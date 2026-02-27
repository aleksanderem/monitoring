"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ImportWizardModal, type ImportResult } from "./ImportWizardModal";
import type { FieldDefinition } from "@/utils/csvParser";
import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

const BATCH_SIZE = 100;

interface KeywordImportModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordImportModal({ domainId, isOpen, onClose }: KeywordImportModalProps) {
  const t = useTranslations("domains");
  const addKeywords = useMutation(api.keywords.addKeywords);

  const keywordFields: FieldDefinition[] = useMemo(() => [
    { key: "phrase", label: t("fieldKeywordPhrase"), required: true, aliases: ["keyword", "query", "term", "search term", "keyphrase"] },
    { key: "searchVolume", label: t("fieldSearchVolume"), aliases: ["volume", "monthly searches", "avg monthly searches", "search_volume"] },
    { key: "difficulty", label: t("fieldDifficulty"), aliases: ["kd", "keyword difficulty", "seo difficulty"] },
    { key: "tags", label: t("fieldTags"), aliases: ["tag", "labels", "categories", "group"] },
    { key: "keywordType", label: t("fieldKeywordType"), aliases: ["type", "intent type"] },
  ], [t]);

  const validateRow = useCallback((row: Record<string, string>): string | null => {
    const phrase = row.phrase?.trim();
    if (!phrase) return t("validationMissingPhrase");
    if (phrase.length < 2) return t("validationKeywordTooShort");
    if (phrase.length > 80) return t("validationKeywordTooLong");
    if (/^https?:\/\//i.test(phrase)) return t("validationLooksLikeUrl");
    if (/^[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(phrase) && !phrase.includes(" ")) return t("validationLooksLikeDomain");
    if (/^\d+$/.test(phrase)) return t("validationPureNumbers");
    return null;
  }, [t]);

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
      title={t("importTitle")}
      fields={keywordFields}
      validateRow={validateRow}
      onImport={handleImport}
      maxRows={10000}
    />
  );
}
