"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Upload01, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading } from "react-aria-components";
import { parseFile, autoDetectMapping, applyMapping, type FieldDefinition, type ParseResult } from "@/utils/csvParser";

type WizardStep = "upload" | "preview" | "importing" | "done";

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: FieldDefinition[];
  /** Validate a single mapped row. Return error string or null if valid. */
  validateRow: (row: Record<string, string>) => string | null;
  /** Import the validated rows. Called with all valid rows. */
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  maxRows?: number;
}

export function ImportWizardModal({
  isOpen,
  onClose,
  title,
  fields,
  validateRow,
  onImport,
  maxRows = 10000,
}: ImportWizardModalProps) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setParseResult(null);
    setMapping({});
    setImportResult(null);
    setIsImporting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        setParseResult({ headers: [], rows: [], error: "File too large (max 5MB)" });
        return;
      }
      const result = await parseFile(file);
      if (result.error) {
        setParseResult(result);
        return;
      }
      if (result.rows.length > maxRows) {
        setParseResult({ ...result, error: `Too many rows (${result.rows.length}). Maximum is ${maxRows}.` });
        return;
      }
      setParseResult(result);
      const detected = autoDetectMapping(result.headers, fields);
      setMapping(detected);
      setStep("preview");
    },
    [fields, maxRows]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const setColumnMapping = useCallback((colIndex: number, fieldKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      // Remove any existing mapping to this field
      for (const [k, v] of Object.entries(next)) {
        if (v === fieldKey) delete next[parseInt(k, 10)];
      }
      if (fieldKey === "") {
        delete next[colIndex];
      } else {
        next[colIndex] = fieldKey;
      }
      return next;
    });
  }, []);

  // Compute validation preview
  const validationPreview = useMemo(() => {
    if (!parseResult || step !== "preview") return null;
    const mapped = applyMapping(parseResult.rows, mapping);
    let valid = 0;
    let invalid = 0;
    const errors: string[] = [];
    for (let i = 0; i < mapped.length; i++) {
      const err = validateRow(mapped[i]);
      if (err) {
        invalid++;
        if (errors.length < 5) errors.push(`Row ${i + 2}: ${err}`);
      } else {
        valid++;
      }
    }
    return { valid, invalid, errors, totalRows: mapped.length };
  }, [parseResult, mapping, step, validateRow]);

  const requiredFieldsMapped = useMemo(() => {
    const mappedFields = new Set(Object.values(mapping));
    return fields.filter((f) => f.required).every((f) => mappedFields.has(f.key));
  }, [mapping, fields]);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;
    setIsImporting(true);
    setStep("importing");
    try {
      const mapped = applyMapping(parseResult.rows, mapping);
      const validRows = mapped.filter((row) => !validateRow(row));
      const result = await onImport(validRows);
      setImportResult(result);
      setStep("done");
    } catch (err) {
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: [(err as Error).message],
      });
      setStep("done");
    } finally {
      setIsImporting(false);
    }
  }, [parseResult, mapping, validateRow, onImport]);

  const previewRows = parseResult?.rows.slice(0, 5) ?? [];

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <ModalOverlay isDismissable>
        <Modal className="max-w-3xl">
          <Dialog>
            <div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-3xl">
              <CloseButton onPress={handleClose} theme="light" size="lg" className="absolute top-3 right-3 z-10" />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={Upload01} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {title}
                  </AriaHeading>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 sm:px-6">
                {/* Upload Step */}
                {step === "upload" && (
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                      dragOver ? "border-brand-500 bg-brand-25" : "border-secondary"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <Upload01 className="mb-4 h-10 w-10 text-tertiary" />
                    <p className="mb-2 text-sm font-medium text-primary">
                      Drag & drop your file here, or{" "}
                      <button
                        className="text-brand-600 hover:text-brand-700 underline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-tertiary">Supports CSV and XLSX files up to 5MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                    {parseResult?.error && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-error-600">
                        <AlertCircle className="h-4 w-4" />
                        {parseResult.error}
                      </div>
                    )}
                  </div>
                )}

                {/* Preview & Map Step */}
                {step === "preview" && parseResult && (
                  <div className="space-y-6">
                    {/* Column Mapping */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-primary">Map Columns</h3>
                      <p className="mb-4 text-xs text-tertiary">
                        Select which field each column maps to. Required fields are marked with *.
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-secondary">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-secondary bg-secondary">
                              {parseResult.headers.map((header, i) => (
                                <th key={i} className="px-3 py-2 text-left font-medium text-secondary">
                                  <div className="mb-1 truncate text-xs text-tertiary">{header}</div>
                                  <select
                                    className="w-full rounded border border-secondary bg-primary px-2 py-1 text-xs text-primary"
                                    value={mapping[i] ?? ""}
                                    onChange={(e) => setColumnMapping(i, e.target.value)}
                                  >
                                    <option value="">— Skip —</option>
                                    {fields.map((field) => (
                                      <option key={field.key} value={field.key}>
                                        {field.label}{field.required ? " *" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, ri) => (
                              <tr key={ri} className="border-b border-secondary last:border-0">
                                {row.map((cell, ci) => (
                                  <td key={ci} className="max-w-[200px] truncate px-3 py-2 text-xs text-primary">
                                    {cell?.toString() ?? ""}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {parseResult.rows.length > 5 && (
                        <p className="mt-2 text-xs text-tertiary">
                          Showing 5 of {parseResult.rows.length} rows
                        </p>
                      )}
                    </div>

                    {/* Validation Preview */}
                    {validationPreview && (
                      <div className="rounded-lg border border-secondary p-4">
                        <h3 className="mb-2 text-sm font-semibold text-primary">Validation Preview</h3>
                        <div className="flex gap-6 text-sm">
                          <span className="text-success-600">{validationPreview.valid} valid rows</span>
                          {validationPreview.invalid > 0 && (
                            <span className="text-error-600">{validationPreview.invalid} invalid rows (will be skipped)</span>
                          )}
                        </div>
                        {validationPreview.errors.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {validationPreview.errors.map((err, i) => (
                              <p key={i} className="text-xs text-error-600">{err}</p>
                            ))}
                            {validationPreview.invalid > 5 && (
                              <p className="text-xs text-tertiary">
                                ...and {validationPreview.invalid - 5} more errors
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!requiredFieldsMapped && (
                      <div className="flex items-center gap-2 text-sm text-warning-600">
                        <AlertCircle className="h-4 w-4" />
                        Please map all required fields before importing.
                      </div>
                    )}
                  </div>
                )}

                {/* Importing Step */}
                {step === "importing" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    <p className="text-sm text-primary">Importing data...</p>
                  </div>
                )}

                {/* Done Step */}
                {step === "done" && importResult && (
                  <div className="flex flex-col items-center py-8">
                    {importResult.imported > 0 ? (
                      <CheckCircle className="mb-4 h-12 w-12 text-success-500" />
                    ) : (
                      <AlertCircle className="mb-4 h-12 w-12 text-error-500" />
                    )}
                    <h3 className="mb-2 text-lg font-semibold text-primary">Import Complete</h3>
                    <div className="mb-4 space-y-1 text-center text-sm">
                      {importResult.imported > 0 && (
                        <p className="text-success-600">{importResult.imported} items imported successfully</p>
                      )}
                      {importResult.skipped > 0 && (
                        <p className="text-tertiary">{importResult.skipped} duplicates skipped</p>
                      )}
                      {importResult.errors.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto text-left">
                          {importResult.errors.map((err, i) => (
                            <p key={i} className="text-xs text-error-600">{err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-secondary px-6 py-4">
                <div>
                  {step === "preview" && (
                    <Button color="tertiary" size="sm" onClick={() => { reset(); }}>
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  {step === "done" ? (
                    <Button color="primary" size="sm" onClick={handleClose}>
                      Close
                    </Button>
                  ) : step === "preview" ? (
                    <Button
                      color="primary"
                      size="sm"
                      onClick={handleImport}
                      isDisabled={!requiredFieldsMapped || isImporting || (validationPreview?.valid ?? 0) === 0}
                    >
                      Import {validationPreview?.valid ?? 0} rows
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button color="tertiary" size="sm" onClick={handleClose}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
