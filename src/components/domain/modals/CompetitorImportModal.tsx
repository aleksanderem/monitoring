"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ImportWizardModal, type ImportResult } from "./ImportWizardModal";
import type { FieldDefinition } from "@/utils/csvParser";
import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

interface CompetitorImportModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function CompetitorImportModal({ domainId, isOpen, onClose }: CompetitorImportModalProps) {
  const t = useTranslations("domains");
  const addCompetitor = useMutation(api.competitors.addCompetitor);

  const competitorFields: FieldDefinition[] = useMemo(() => [
    { key: "competitorDomain", label: t("fieldCompetitorDomain"), required: true, aliases: ["domain", "url", "competitor", "site", "website"] },
    { key: "name", label: t("fieldName"), aliases: ["display name", "label", "company", "brand"] },
  ], [t]);

  const validateRow = useCallback((row: Record<string, string>): string | null => {
    const domain = row.competitorDomain?.trim();
    if (!domain) return t("validationMissingDomain");
    // Basic domain validation
    const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!cleaned.includes(".") || cleaned.includes(" ")) return t("validationInvalidDomain");
    if (cleaned.length < 4) return t("validationDomainTooShort");
    return null;
  }, [t]);

  const handleImport = useCallback(
    async (rows: Record<string, string>[]): Promise<ImportResult> => {
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of rows) {
        const domain = row.competitorDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
        try {
          await addCompetitor({
            domainId,
            competitorDomain: domain,
            name: row.name?.trim() || undefined,
          });
          imported++;
        } catch (err) {
          const msg = (err as Error).message;
          if (msg.includes("already being tracked")) {
            skipped++;
          } else {
            errors.push(`${domain}: ${msg}`);
          }
        }
      }

      return { imported, skipped, errors };
    },
    [domainId, addCompetitor]
  );

  return (
    <ImportWizardModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("importCompetitorsTitle")}
      fields={competitorFields}
      validateRow={validateRow}
      onImport={handleImport}
      maxRows={100}
    />
  );
}
