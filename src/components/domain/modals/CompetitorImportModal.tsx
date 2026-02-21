"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ImportWizardModal, type ImportResult } from "./ImportWizardModal";
import type { FieldDefinition } from "@/utils/csvParser";
import { useCallback } from "react";

const COMPETITOR_FIELDS: FieldDefinition[] = [
  { key: "competitorDomain", label: "Competitor Domain", required: true, aliases: ["domain", "url", "competitor", "site", "website"] },
  { key: "name", label: "Name", aliases: ["display name", "label", "company", "brand"] },
];

interface CompetitorImportModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function CompetitorImportModal({ domainId, isOpen, onClose }: CompetitorImportModalProps) {
  const addCompetitor = useMutation(api.competitors.addCompetitor);

  const validateRow = useCallback((row: Record<string, string>): string | null => {
    const domain = row.competitorDomain?.trim();
    if (!domain) return "Missing competitor domain";
    // Basic domain validation
    const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!cleaned.includes(".") || cleaned.includes(" ")) return "Invalid domain format";
    if (cleaned.length < 4) return "Domain too short";
    return null;
  }, []);

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
      title="Import Competitors from CSV"
      fields={COMPETITOR_FIELDS}
      validateRow={validateRow}
      onImport={handleImport}
      maxRows={100}
    />
  );
}
