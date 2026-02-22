"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/base/buttons/button";
import { Modal } from "@/components/base/modal/modal";

interface BulkChangeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tags: string[], operation: "set" | "add" | "remove") => Promise<void>;
  count: number;
}

export function BulkChangeTagsModal({
  isOpen,
  onClose,
  onConfirm,
  count,
}: BulkChangeTagsModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const [tagsInput, setTagsInput] = useState("");
  const [operation, setOperation] = useState<"set" | "add" | "remove">("add");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (tags.length === 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(tags, operation);
      onClose();
      setTagsInput("");
      setOperation("add");
    } catch {
      // errors handled by caller via toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("bulkChangeTagsTitle")}
      description={t("bulkChangeTagsDescription", { count })}
      size="sm"
      footer={
        <>
          <Button size="sm" color="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            color="primary"
            onClick={handleConfirm}
            disabled={isSubmitting || !tagsInput.trim()}
          >
            {isSubmitting ? tc("loading") : tc("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("tagsLabel")}
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t("tagsPlaceholder")}
            className="w-full rounded-md border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-tertiary"
          />
          <p className="mt-1 text-xs text-tertiary">{t("tagsHint")}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("tagOperation")}
          </label>
          <div className="flex flex-col gap-2">
            {(["add", "remove", "set"] as const).map((op) => (
              <label key={op} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tagOperation"
                  value={op}
                  checked={operation === op}
                  onChange={() => setOperation(op)}
                  className="h-4 w-4 border-secondary"
                />
                <span className="text-sm text-primary">{t(`tagOp_${op}`)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
