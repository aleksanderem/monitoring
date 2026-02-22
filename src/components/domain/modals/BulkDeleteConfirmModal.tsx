"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/base/buttons/button";
import { Modal } from "@/components/base/modal/modal";

interface BulkDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  count: number;
}

export function BulkDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  count,
}: BulkDeleteConfirmModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
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
      title={t("bulkDeleteTitle")}
      size="sm"
      footer={
        <>
          <Button size="sm" color="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            color="primary-destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? tc("deleting") : tc("delete")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-primary">
          {t("bulkDeleteConfirm", { count })}
        </p>
        <div className="rounded-lg border border-utility-error-200 bg-utility-error-50 px-3 py-2">
          <p className="text-sm text-utility-error-700">
            {t("bulkDeleteWarning")}
          </p>
        </div>
      </div>
    </Modal>
  );
}
