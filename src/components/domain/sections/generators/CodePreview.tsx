"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface CodePreviewProps {
  code: string;
  language: "json" | "markdown";
  filename: string;
  onEdit?: (newCode: string) => void;
}

export function CodePreview({ code, language, filename, onEdit }: CodePreviewProps) {
  const t = useTranslations("generators");
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(isEditing ? editedCode : code);
    toast.success(t("copied"));
  }, [code, editedCode, isEditing, t]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([isEditing ? editedCode : code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, editedCode, filename, isEditing]);

  const handleSaveEdit = useCallback(() => {
    onEdit?.(editedCode);
    setIsEditing(false);
  }, [editedCode, onEdit]);

  return (
    <div className="rounded-lg border border-secondary bg-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-secondary px-4 py-2">
        <span className="text-xs font-medium text-tertiary">{filename}</span>
        <div className="flex gap-2">
          {onEdit && !isEditing && (
            <button
              onClick={() => { setEditedCode(code); setIsEditing(true); }}
              className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
            >
              {t("editBeforeDownload")}
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
              >
                {t("cancelEdits")}
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded bg-brand-500 px-2 py-1 text-xs text-white hover:bg-brand-600"
              >
                {t("saveEdits")}
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
          >
            {t("copyToClipboard")}
          </button>
          <button
            onClick={handleDownload}
            className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
          >
            {t("download")}
          </button>
        </div>
      </div>

      {/* Code area */}
      {isEditing ? (
        <textarea
          value={editedCode}
          onChange={(e) => setEditedCode(e.target.value)}
          className="w-full resize-y bg-primary p-4 font-mono text-xs text-primary focus:outline-none"
          rows={20}
          spellCheck={false}
        />
      ) : (
        <pre className="max-h-[500px] overflow-auto p-4">
          <code className="whitespace-pre-wrap break-words font-mono text-xs text-primary">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
