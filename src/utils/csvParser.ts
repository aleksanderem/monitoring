import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParseResult {
  headers: string[];
  rows: string[][];
  error?: string;
}

/**
 * Parse a CSV file using papaparse.
 */
export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete(results) {
        const data = results.data as string[][];
        if (data.length === 0) {
          resolve({ headers: [], rows: [], error: "File is empty" });
          return;
        }
        const headers = data[0].map((h) => (h ?? "").toString().trim());
        const rows = data.slice(1).filter((row) => row.some((cell) => cell && cell.toString().trim()));
        resolve({ headers, rows });
      },
      error(err) {
        resolve({ headers: [], rows: [], error: err.message });
      },
    });
  });
}

/**
 * Parse an XLSX file using SheetJS.
 */
export function parseXLSXFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          resolve({ headers: [], rows: [], error: "No sheets found" });
          return;
        }
        const json = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: "" });
        if (json.length === 0) {
          resolve({ headers: [], rows: [], error: "Sheet is empty" });
          return;
        }
        const headers = (json[0] as string[]).map((h) => (h ?? "").toString().trim());
        const rows = json.slice(1).filter((row: string[]) => row.some((cell) => cell && cell.toString().trim()));
        resolve({ headers, rows: rows as string[][] });
      } catch (err) {
        resolve({ headers: [], rows: [], error: (err as Error).message });
      }
    };
    reader.onerror = () => {
      resolve({ headers: [], rows: [], error: "Failed to read file" });
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Auto-detect file format and parse accordingly.
 */
export function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") {
    return parseXLSXFile(file);
  }
  return parseCSVFile(file);
}

/**
 * Field definition for the column mapping wizard.
 */
export interface FieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  /** Possible header names to auto-detect this field */
  aliases?: string[];
}

/**
 * Auto-detect column mapping from headers.
 * Returns a map from header index to field key.
 */
export function autoDetectMapping(
  headers: string[],
  fields: FieldDefinition[]
): Record<number, string> {
  const mapping: Record<number, string> = {};
  const usedFields = new Set<string>();

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const field of fields) {
      if (usedFields.has(field.key)) continue;
      const allNames = [field.key, field.label, ...(field.aliases || [])].map((n) =>
        n.toLowerCase().replace(/[^a-z0-9]/g, "")
      );
      if (allNames.includes(h)) {
        mapping[i] = field.key;
        usedFields.add(field.key);
        break;
      }
    }
  }
  return mapping;
}

/**
 * Apply column mapping to raw rows.
 * Returns array of objects with field keys as properties.
 */
export function applyMapping(
  rows: string[][],
  mapping: Record<number, string>
): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    for (const [indexStr, fieldKey] of Object.entries(mapping)) {
      const index = parseInt(indexStr, 10);
      obj[fieldKey] = (row[index] ?? "").toString().trim();
    }
    return obj;
  });
}
