import * as XLSX from "xlsx";

/**
 * Escape a CSV cell value, wrapping in quotes if needed.
 */
function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export data as a CSV file download.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) =>
    row.map((cell) => escapeCell(cell?.toString() ?? "")).join(",")
  );
  const csv = [headerLine, ...dataLines].join("\n");
  const bom = "\uFEFF"; // BOM for Excel UTF-8 compatibility
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

/**
 * Export data as a multi-sheet XLSX file download.
 */
export function exportToExcel(
  filename: string,
  sheets: {
    name: string;
    headers: string[];
    rows: (string | number | null | undefined)[][];
  }[]
): void {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows.map((row) => row.map((c) => c ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31)); // Sheet names max 31 chars
  }
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
